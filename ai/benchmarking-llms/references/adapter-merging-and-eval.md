# LoRA & QLoRA Adapter Merging for High-Throughput Benchmarking

## Overview

When fine-tuning open-weights models with Parameter-Efficient Fine-Tuning (PEFT/LoRA/QLoRA), training saves only the low-rank delta matrices (~50MB–300MB) in `adapter_model.safetensors` alongside `adapter_config.json`.

To evaluate these adapters at maximum speed with high-throughput engines like **vLLM**, the adapters must be merged into the base model weights to produce a standalone model directory.

---

## 1. The Core Invariant: Unquantized 16-Bit Merging

> ⚠️ **THE GOLDEN MERGE RULE:**
> **NEVER call `.merge_and_unload()` on a 4-bit or 8-bit quantized model (`load_in_4bit=True`).**
> 
> Merging floating-point LoRA matrices into integer-quantized weights corrupts numerical precision or throws:
> `RuntimeError: Quantized models do not support merge_and_unload`.
> 
> **Always reload the base model in unquantized 16-bit (`bfloat16` or `float16`), attach the adapter weights, and call `merge_and_unload()`.**

---

## 2. Production Adapter Merger Implementation

The merger resolves the base model path automatically from `adapter_config.json`, fuses the adapter weights, saves a complete standalone directory, and ensures tokenizer files are preserved:

```python
"""
Robust LoRA adapter merging pipeline for benchmark evaluation.
"""

import os
import gc
import json
import shutil
import tempfile
from typing import Optional
import torch
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer


def merge_lora_for_benchmark(
    lora_adapter_path: str,
    output_dir: Optional[str] = None,
    hf_token: Optional[str] = None,
) -> str:
    """
    Merges a LoRA/QLoRA adapter into an unquantized 16-bit base model.
    Returns the absolute path to the merged model directory.
    """
    if not os.path.isdir(lora_adapter_path):
        raise FileNotFoundError(f"Adapter directory does not exist: {lora_adapter_path}")

    cfg_path = os.path.join(lora_adapter_path, "adapter_config.json")
    if not os.path.exists(cfg_path):
        raise FileNotFoundError(f"adapter_config.json missing from: {lora_adapter_path}")

    with open(cfg_path, "r", encoding="utf-8") as f:
        adapter_cfg = json.load(f)
    base_model_name = adapter_cfg.get("base_model_name_or_path")
    print(f"📦 Resolving base model: {base_model_name} for adapter: {lora_adapter_path}")

    # Determine output location
    target_dir = output_dir or tempfile.mkdtemp(prefix="benchmark_merged_")
    os.makedirs(target_dir, exist_ok=True)

    print("🔄 Loading PEFT model in unquantized bfloat16 for mathematical fusion...")
    peft_model = AutoPeftModelForCausalLM.from_pretrained(
        lora_adapter_path,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
        token=hf_token or os.getenv("HF_TOKEN"),
    )

    print("⚡ Fusing low-rank adapter weights into base model layers...")
    merged_model = peft_model.merge_and_unload()

    print(f"💾 Saving merged weights (safetensors) to: {target_dir}...")
    merged_model.save_pretrained(target_dir, safe_serialization=True)

    # Copy / save tokenizer
    try:
        # Check if tokenizer files exist in the adapter directory
        has_adapter_tokenizer = any(f.startswith("tokenizer") for f in os.listdir(lora_adapter_path))
        tok_source = lora_adapter_path if has_adapter_tokenizer else base_model_name

        tokenizer = AutoTokenizer.from_pretrained(tok_source, trust_remote_code=True, token=hf_token)
        tokenizer.save_pretrained(target_dir)
        print("✅ Tokenizer packaged with merged model.")
    except Exception as e:
        print(f"⚠️ Warning saving tokenizer: {e}. vLLM will fall back to base model tokenizer.")

    # Free memory before initializing vLLM
    del peft_model
    del merged_model
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    gc.collect()

    print(f"✅ Merged model ready for evaluation at: {target_dir}")
    return target_dir
```

---

## 3. Temporary vs Persistent Merged Storage

| Scenario | Storage Strategy | Implementation |
|---|---|---|
| **One-Off Benchmark in Notebook** | In-Memory / Temporary Directory | Save to `tempfile.mkdtemp()`. Automatically purge with `shutil.rmtree()` in runner `cleanup()` or `finally:` block. |
| **Repeated Multi-Task Benchmark** | Persistent Disk Directory | Set `config.merged_model_save_path = "./models/merged_llama3_lora"`. Skip merge if directory already exists. |
| **Multi-GPU Distributed Benchmark** | Shared Network Mount | Ensure all worker ranks point to the same pre-merged directory. |

### Purging Temporary Artifacts
To prevent disk exhaustion when testing multiple checkpoints in a single session:

```python
def cleanup_temporary_model(merged_dir: str):
    """Safely removes temporary model checkpoint directory if created in temp."""
    if merged_dir and merged_dir.startswith(tempfile.gettempdir()):
        try:
            shutil.rmtree(merged_dir)
            print(f"🧹 Successfully cleaned up temp model directory: {merged_dir}")
        except Exception as e:
            print(f"⚠️ Failed to remove temp directory {merged_dir}: {e}")
```
