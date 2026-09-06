from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import time

import torch
from PIL import Image
from peft import PeftModel
from transformers import AutoModelForImageTextToText, AutoProcessor


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--adapter-path")
    args = parser.parse_args()
    request = json.loads(sys.stdin.read())
    started = time.perf_counter()
    processor = AutoProcessor.from_pretrained(args.base_model)
    base = AutoModelForImageTextToText.from_pretrained(args.base_model, dtype=torch.float32, low_cpu_mem_usage=True)
    model = PeftModel.from_pretrained(base, args.adapter_path) if args.adapter_path else base
    model.eval()
    image = Image.open(io.BytesIO(base64.b64decode(request["imageBase64"]))).convert("RGB")
    prompt = f"{request['systemInstruction']}\n{json.dumps(request['compactState'], ensure_ascii=False)}"
    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt}]}]
    text = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=text, images=[image], return_tensors="pt")
    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=min(int(request["maxOutputTokens"]), 64), do_sample=False)
    generated = processor.batch_decode(output[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
    print(json.dumps({"generatedText": generated, "adapterLoaded": bool(args.adapter_path), "baseModel": args.base_model, "adapterPath": args.adapter_path, "latencyMs": (time.perf_counter() - started) * 1000}, ensure_ascii=True))


if __name__ == "__main__":
    main()
