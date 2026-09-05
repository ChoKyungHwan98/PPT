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
from peft import LoraConfig, PeftModel, get_peft_model
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
    text = processor.apply_chat_template(messages, add_generation_prompt=generation)
    return processor(text=text, images=[image], return_tensors="pt")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the bounded R8 visual-critic LoRA smoke proof.")
    parser.add_argument("--root", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="HuggingFaceTB/SmolVLM-256M-Instruct")
    parser.add_argument("--base-revision", default="main")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    manifest_path = (root / args.manifest).resolve()
    output = (root / args.output).resolve()
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
    print(json.dumps(record, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
