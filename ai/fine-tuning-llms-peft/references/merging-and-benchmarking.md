# Adapter Merging, Serving & Benchmarking

## Overview

After fine-tuning with PEFT/LoRA, the output directory contains only the low-rank adapter weights (typically 50 MB to 200 MB), not the entire multi-gigabyte base model.

To deploy fine-tuned models into high-throughput inference engines like **vLLM**, **SGLang**, or **TGI**, the adapter weights must be mathematically merged back into the base model parameters, producing a standalone, unquantized model checkpoint.

---

## 1. The Adapter Merge Pattern

### ⚠️ THE GOLDEN RULE OF MERGING
> **NEVER call `.merge_and_unload()` on a 4-bit or 8-bit quantized model.**
> 
> Merging LoRA weights directly into quantized integer weights irreversibly degrades model precision or raises `RuntimeError: Quantized models do not support merge_and_unload`.
> 
> **Always reload the base model in unquantized 16-bit (`bfloat16` or `float16`), attach the adapter, and then merge.**

### Production Merging Implementation

Using `AutoPeftModelForCausalLM` from PEFT automatically resolves the base model path from `adapter_config.json`, loads the unquantized base model in `bfloat16`, attaches the adapter, and merges:

```python
import os
import torch
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer

def merge_lora_to_standalone(
    adapter_path: str,
    output_dir: str,
    base_model_override: str | None = None,
    hf_token: str | None = None
) -> str:
    """
    Safely merges LoRA adapters into an unquantized base model and saves a standalone checkpoint.
    """
    print(f"📦 Loading PEFT model and unquantized base from: {adapter_path}")
    
    # AutoPeftModel automatically reads adapter_config.json to load the base model
    peft_model = AutoPeftModelForCausalLM.from_pretrained(
        adapter_path,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
        token=hf_token
    )
    
    print("⚡ Merging adapter weights into base model layers...")
    merged_model = peft_model.merge_and_unload()
    
    print(f"💾 Saving merged standalone model to: {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    merged_model.save_pretrained(output_dir, safe_serialization=True)
    
    # Save tokenizer: try adapter directory first; fall back to base model
    try:
        if any(f.startswith("tokenizer") for f in os.listdir(adapter_path)):
            tokenizer_source = adapter_path
        else:
            tokenizer_source = peft_model.config._name_or_path
        
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_source, trust_remote_code=True, token=hf_token)
        tokenizer.save_pretrained(output_dir)
        print("✅ Tokenizer saved with merged model.")
    except Exception as e:
        print(f"⚠️ Warning saving tokenizer: {e}")
        
    print(f"✅ Standalone model ready for deployment at {output_dir}")
    return output_dir
```

---

## 2. High-Throughput Inference with vLLM

Once merged, the model can be served with vLLM for high-throughput batch generation and low-latency serving.

### Running vLLM Offline for Benchmarking
```python
from vllm import LLM, SamplingParams

def initialize_vllm_engine(
    model_path: str,
    gpu_memory_utilization: float = 0.90,
    max_model_len: int = 4096,
    tensor_parallel_size: int = 1
) -> LLM:
    """Initializes a high-throughput vLLM engine for benchmarking."""
    return LLM(
        model=model_path,
        tensor_parallel_size=tensor_parallel_size,
        gpu_memory_utilization=gpu_memory_utilization,
        max_model_len=max_model_len,
        trust_remote_code=True,
        dtype="bfloat16"
    )
```

### Dynamic LoRA Loading in vLLM (Without Prior Merging)
vLLM also supports hot-swapping LoRA adapters at runtime without permanently saving merged weights to disk:

```python
from vllm import LLM, SamplingParams
from vllm.lora.request import LoRARequest

# 1. Enable LoRA support in the vLLM engine
llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    enable_lora=True,
    max_lora_rank=64
)

# 2. Pass LoRARequest during generation
sampling_params = SamplingParams(temperature=0.0, max_tokens=128)
prompts = ["Question: What is the capital of Italy?\nAnswer:"]

outputs = llm.generate(
    prompts,
    sampling_params,
    lora_request=LoRARequest("adapter_v1", 1, "./results_llama31_adapter")
)

for output in outputs:
    print(output.outputs[0].text)
```

---

## 3. Robust Answer Extraction & Benchmark Metric Pipeline

When evaluating models on multiple-choice, math, or reasoning benchmarks, models frequently produce conversational prefixes (e.g. "The correct option is (B) because..."). 

### Robust Multi-Stage Regex Extractor
```python
import re

def extract_answer_robust(output: str, valid_choices: str = "ABCDE") -> str:
    """
    Extracts the predicted multiple choice letter from model responses,
    handling Chain-of-Thought, <think> tags, and conversational prefixes.
    """
    if not output:
        return ""
        
    cleaned = output.strip()
    
    # 1. If response has <think> tags, separate reasoning from final response
    if "</think>" in cleaned:
        cleaned = cleaned.split("</think>")[-1].strip()
        
    # 2. Strict immediate single letter
    if len(cleaned) == 1 and cleaned.upper() in valid_choices:
        return cleaned.upper()
        
    # 3. Explicit prefix matching (supports multi-language: English, Italian, etc.)
    prefix_patterns = [
        rf"(?:answer|risposta|choice|option|soluzione)\s*(?:is|è|:)?\s*[\(\[]?([{valid_choices}])[\)\]]?",
        rf"(?:therefore|quindi|the correct answer is|la risposta corretta è)\s*[\(\[]?([{valid_choices}])[\)\]]?"
    ]
    for pattern in prefix_patterns:
        match = re.search(pattern, cleaned, re.IGNORECASE)
        if match:
            return match.group(1).upper()
            
    # 4. Word boundary check (e.g., "(B)", " B.")
    boundary_match = re.search(rf"\b([{valid_choices}])\b", cleaned.upper())
    if boundary_match:
        return boundary_match.group(1)
        
    # 5. Fallback: last occurrence of a valid choice character
    for char in reversed(cleaned.upper()):
        if char in valid_choices:
            return char
            
    return ""
```

---

## 4. Hardware Memory Cleanup Pattern

When chaining fine-tuning, merging, and benchmarking within the same session or script, stale CUDA tensors and CUDA context caches often trigger false Out-Of-Memory errors.

Always run explicit memory cleanup between stages:
```python
import gc
import torch

def cleanup_gpu_memory() -> None:
    """Fully purges garbage collector and empties PyTorch CUDA cache."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
        torch.cuda.synchronize()
        allocated_mb = torch.cuda.memory_allocated() / (1024 ** 2)
        print(f"🧹 GPU Cache Cleared. Allocated: {allocated_mb:.1f} MB")
```
