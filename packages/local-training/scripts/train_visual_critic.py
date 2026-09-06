from __future__ import annotations

import argparse
import gc
import hashlib
import json
import os
import random
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from PIL import Image
from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForImageTextToText, AutoProcessor


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_commit(root: Path) -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()


def multimodal_inputs(processor, example: dict, root: Path, generation: bool):
    image = Image.open(root / example["imagePath"]).convert("RGB")
    content = [{"type": "image"}, {"type": "text", "text": example["prompt"]}]
    messages = [{"role": "user", "content": content}]
    if not generation:
        messages.append({"role": "assistant", "content": [{"type": "text", "text": example["response"]}]})
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=generation)
    return processor(text=text, images=[image], return_tensors="pt")


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def move_batch(batch, device):
    return {key: value.to(device) if hasattr(value, "to") else value for key, value in batch.items()}


def run_quality(args, root: Path, manifest_path: Path, output: Path) -> None:
    if not args.config:
        raise ValueError("quality mode requires --config")
    config = json.loads(Path(args.config).resolve().read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("purpose") != "visual-critic-production":
        raise ValueError("quality mode only accepts a production dataset")
    if config["datasetId"] != manifest["datasetId"] or config["datasetSha256"] != manifest["datasetSha256"]:
        raise ValueError("quality config and immutable dataset do not match")

    dataset_dir = manifest_path.parent
    train = read_jsonl(dataset_dir / manifest["files"]["train"])
    validation = read_jsonl(dataset_dir / manifest["files"]["validation"])
    if config.get("maxSamples"):
        train = train[: int(config["maxSamples"])]
    if config["validation"].get("maxSamples"):
        validation = validation[: int(config["validation"]["maxSamples"])]
    if not train or len(validation) < 2:
        raise ValueError("quality mode requires a non-empty train split and at least two validation examples")
    for example in train + validation:
        image_path = root / example["imagePath"]
        if sha256_file(image_path) != example["imageSha256"]:
            raise ValueError(f"image hash mismatch: {example['exampleId']}")
        if not example.get("explicitHumanDecision") or not example.get("humanLabel"):
            raise ValueError(f"non-human example rejected: {example['exampleId']}")

    from transformers import BitsAndBytesConfig

    random.seed(config["seed"])
    torch.manual_seed(config["seed"])
    started_at = utc_now()
    run_id = output.parent.name
    adapter_path = output / "adapter"
    output.mkdir(parents=True, exist_ok=True)
    processor = AutoProcessor.from_pretrained(config["baseModel"], revision=config["baseRevision"])
    model_kwargs = {
        "revision": config["baseRevision"],
        "low_cpu_mem_usage": True,
        "device_map": "auto" if config["device"] == "cuda" else None,
        "torch_dtype": torch.bfloat16 if config["device"] == "cuda" else torch.float32,
    }
    if config["quantization"] == "bnb-4bit":
        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
    model = AutoModelForImageTextToText.from_pretrained(config["baseModel"], **model_kwargs)
    if config["quantization"] == "bnb-4bit":
        model = prepare_model_for_kbit_training(model)
    lora = config["lora"]
    model = get_peft_model(model, LoraConfig(
        r=lora["r"], lora_alpha=lora["alpha"], lora_dropout=lora["dropout"],
        target_modules=lora["targetModules"], bias="none", task_type="CAUSAL_LM",
    ))
    model.train()
    optimizer = torch.optim.AdamW((parameter for parameter in model.parameters() if parameter.requires_grad), lr=config["learningRate"])
    optimizer_steps = 0
    final_loss = 0.0
    accumulation = config["gradientAccumulation"]
    for _ in range(int(config["epochs"])):
        for index, example in enumerate(train):
            batch = move_batch(multimodal_inputs(processor, example, root, generation=False), model.device)
            labels = batch["input_ids"].clone()
            result = model(**batch, labels=labels)
            loss = result.loss / accumulation
            loss.backward()
            final_loss = float(result.loss.detach().cpu())
            if (index + 1) % accumulation == 0 or index == len(train) - 1:
                optimizer.step()
                optimizer.zero_grad(set_to_none=True)
                optimizer_steps += 1

    validation_losses = []
    model.eval()
    with torch.inference_mode():
        for example in validation:
            batch = move_batch(multimodal_inputs(processor, example, root, generation=False), model.device)
            result = model(**batch, labels=batch["input_ids"].clone())
            validation_losses.append(float(result.loss.detach().cpu()))
    model.save_pretrained(adapter_path, safe_serialization=True)
    processor.save_pretrained(output / "processor")
    adapter_file = adapter_path / "adapter_model.safetensors"
    adapter_hash = sha256_file(adapter_file)
    del optimizer, model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    reload_kwargs = dict(model_kwargs)
    base = AutoModelForImageTextToText.from_pretrained(config["baseModel"], **reload_kwargs)
    reloaded = PeftModel.from_pretrained(base, adapter_path)
    reloaded.eval()
    inference = move_batch(multimodal_inputs(processor, validation[0], root, generation=True), reloaded.device)
    inference_started = time.perf_counter()
    with torch.inference_mode():
        generated = reloaded.generate(**inference, max_new_tokens=config["validation"]["maxNewTokens"], do_sample=False)
    latency_ms = (time.perf_counter() - inference_started) * 1000
    prompt_length = inference["input_ids"].shape[1]
    generated_text = processor.batch_decode(generated[:, prompt_length:], skip_special_tokens=True)[0].strip()
    record = {
        "schemaVersion": "0.1", "trainingRunId": run_id, "mode": "quality", "status": "completed",
        "modelStatus": "trained-unbenchmarked", "qualityClaim": False,
        "datasetId": manifest["datasetId"], "datasetSha256": manifest["datasetSha256"],
        "sourceEventCount": len(manifest["sourceEventIds"]), "humanLabelCount": manifest["humanLabelCount"],
        "readyPositiveCount": manifest["readyPositiveCount"], "baseModel": config["baseModel"],
        "baseRevision": config["baseRevision"], "lora": lora, "quantization": config["quantization"],
        "epochs": config["epochs"], "optimizerSteps": optimizer_steps, "learningRate": config["learningRate"],
        "batchSize": config["batchSize"], "gradientAccumulation": accumulation, "seed": config["seed"],
        "device": config["device"], "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "peakVramMb": torch.cuda.max_memory_allocated() / 1024 / 1024 if torch.cuda.is_available() else None,
        "startedAt": started_at, "finishedAt": utc_now(), "finalTrainLoss": final_loss,
        "validationLoss": sum(validation_losses) / len(validation_losses) if validation_losses else None,
        "adapterPath": str(adapter_path.relative_to(root)).replace("\\", "/"), "adapterSha256": adapter_hash,
        "adapterReloaded": True,
        "inferenceSmoke": {"passed": len(generated_text) > 0, "generatedText": generated_text, "latencyMs": latency_ms},
        "codeGitCommit": git_commit(root),
    }
    (output / "run-record.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, ensure_ascii=True, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run R8 smoke or production visual-critic LoRA training.")
    parser.add_argument("--mode", choices=["smoke", "quality"], default="smoke")
    parser.add_argument("--root", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="HuggingFaceTB/SmolVLM-256M-Instruct")
    parser.add_argument("--base-revision", default="main")
    parser.add_argument("--config")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    manifest_path = (root / args.manifest).resolve()
    output = (root / args.output).resolve()
    if args.mode == "quality":
        run_quality(args, root, manifest_path, output)
        return
    adapter_path = output / "adapter"
    output.mkdir(parents=True, exist_ok=True)
    random.seed(42)
    torch.manual_seed(42)
    started_at = utc_now()
    run_id = f"r8-smoke-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    examples = {example["exampleId"]: example for example in manifest["examples"]}
    for example in examples.values():
        actual_hash = sha256_file(root / example["imagePath"])
        if actual_hash != example["imageSha256"]:
            raise ValueError(f"image hash mismatch: {example['exampleId']}")

    processor = AutoProcessor.from_pretrained(args.base_model, revision=args.base_revision)
    model = AutoModelForImageTextToText.from_pretrained(
        args.base_model,
        revision=args.base_revision,
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True,
    )
    config = LoraConfig(
        r=4,
        lora_alpha=8,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"],
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, config)
    model.train()
    optimizer = torch.optim.AdamW((parameter for parameter in model.parameters() if parameter.requires_grad), lr=1e-4)

    # The corpus is intentionally too small for a quality claim. One real optimizer
    # step proves forward/backward/update/save without pretending to train a critic.
    example = examples[manifest["trainIds"][0]]
    batch = multimodal_inputs(processor, example, root, generation=False)
    labels = batch["input_ids"].clone()
    optimizer.zero_grad(set_to_none=True)
    result = model(**batch, labels=labels)
    loss = result.loss
    loss.backward()
    optimizer.step()
    final_loss = float(loss.detach().cpu())
    model.save_pretrained(adapter_path, safe_serialization=True)
    processor.save_pretrained(output / "processor")
    del result, loss, batch, optimizer, model
    gc.collect()

    adapter_file = adapter_path / "adapter_model.safetensors"
    adapter_hash = sha256_file(adapter_file)
    base = AutoModelForImageTextToText.from_pretrained(
        args.base_model,
        revision=args.base_revision,
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True,
    )
    reloaded = PeftModel.from_pretrained(base, adapter_path)
    reloaded.eval()
    validation = examples[manifest["validationIds"][0]]
    inference = multimodal_inputs(processor, validation, root, generation=True)
    inference_started = time.perf_counter()
    with torch.inference_mode():
        generated = reloaded.generate(**inference, max_new_tokens=12, do_sample=False)
    latency_ms = (time.perf_counter() - inference_started) * 1000
    prompt_length = inference["input_ids"].shape[1]
    generated_text = processor.batch_decode(generated[:, prompt_length:], skip_special_tokens=True)[0].strip()

    record = {
        "schemaVersion": "0.1",
        "trainingRunId": run_id,
        "status": "completed-smoke",
        "claim": "adapter-pipeline-smoke-only",
        "baseModel": args.base_model,
        "baseModelRevision": args.base_revision,
        "datasetId": manifest["datasetId"],
        "datasetSha256": manifest["datasetSha256"],
        "trainCount": len(manifest["trainIds"]),
        "validationCount": len(manifest["validationIds"]),
        "lora": {"r": 4, "alpha": 8, "dropout": 0.05, "targetModules": ["q_proj", "v_proj"]},
        "quantization": "none-cpu-smoke",
        "epochs": 1,
        "optimizerSteps": 1,
        "learningRate": 0.0001,
        "batchSize": 1,
        "seed": 42,
        "device": "cpu",
        "gpu": "NVIDIA GeForce RTX 4060 Ti (not used by CPU smoke)",
        "peakVramMb": None,
        "startedAt": started_at,
        "finishedAt": utc_now(),
        "finalLoss": final_loss,
        "adapterPath": str(adapter_path.relative_to(root)).replace("\\", "/"),
        "adapterSha256": adapter_hash,
        "adapterReloaded": True,
        "inferenceSmoke": {"passed": len(generated_text) > 0, "generatedText": generated_text, "latencyMs": latency_ms},
        "evaluation": {
            "meaningfulQualityClaim": False,
            "reason": "Human-labelled pages are only sufficient for a bounded adapter pipeline smoke test, not critic quality training.",
        },
        "codeGitCommit": git_commit(root),
    }
    (output / "run-record.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Windows PowerShell may use cp949; escaped output keeps the successful run
    # from being reported as failed merely because a smoke generation contains
    # a tokenizer replacement character.
    print(json.dumps(record, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
