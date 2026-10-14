# High-Throughput Inference Engines & Batching Strategies

## Overview

Benchmarking LLMs across thousands of evaluation questions requires an inference engine optimized for throughput and memory efficiency. Standard sequential generation via native Hugging Face loops often takes hours for datasets of 5,000–10,000 samples.

By leveraging **vLLM** with **PagedAttention**, memory allocation for Key-Value (KV) caches is dynamically managed in non-contiguous virtual memory blocks, eliminating memory fragmentation and boosting throughput by 5× to 20×. When vLLM is unavailable or when operating under extreme hardware constraints requiring 4-bit base model quantization, **Hugging Face Transformers with BitsAndBytes** serves as a fallback.

---

## 1. vLLM Engine Configuration & Sizing

### The KV Cache & `max_model_len` Sizing Rule
vLLM pre-allocates KV cache blocks based on `max_model_len` (or `max_length`) and `gpu_memory_utilization`. 

> ⚠️ **CRITICAL MEMORY TRAP:**
> Many foundation models declare native context windows of 32,768 to 131,072 tokens in their `config.json`. If you initialize vLLM without constraining `max_model_len`, vLLM reserves nearly all available GPU VRAM for the KV cache of a single sequence.
> On a 24GB GPU (RTX 3090/4090, A10G), running an 8B model with `max_model_len=30000` leaves almost zero memory for batching (`max_num_seqs` drops to 1–2), or crashes with `CUDA out of memory` during warmup.
> 
> **Standard Fix:** Explicitly cap `max_model_len=4096` or `8192` for multiple-choice or short-answer benchmarks. This frees up to 10+ GB of VRAM for concurrent sequence processing.

### Engine Parameters Reference

| Parameter | Recommended Value | Rationale |
|---|---|---|
| `model` | HF repo or local directory path | Path to base weights or merged standalone LoRA checkpoint. |
| `max_model_len` | `4096` (benchmarking standard) | Prevents runaway KV cache pre-allocation for typical QA benchmarks. |
| `gpu_memory_utilization` | `0.85` to `0.90` | Reserves 10–15% VRAM buffer for CUDA activations and temp tensors. |
| `max_num_seqs` | `64` to `256` | Maximum concurrent sequences processed in parallel. |
| `tensor_parallel_size` | `1` (single GPU) or `$NUM_GPUS` | Multi-GPU tensor parallelism across NVLink / PCIe. |
| `enforce_eager` | `False` | Enables CUDA graph compilation for higher decoding throughput. |
| `trust_remote_code` | `True` | Required for custom architectures (Qwen, Mistral, Gemma). |

---

## 2. Dynamic Memory Retry Pattern

In diverse execution environments (shared nodes, varying VRAM cards), hardcoded utilization settings may cause OOM. Implement a multi-tier fallback loader:

```python
"""
vLLM Engine loader with progressive memory fallback.
"""

from typing import List, Dict, Any
from vllm import LLM


def load_vllm_with_fallback(
    model_path: str,
    target_utilization: float = 0.85,
    max_seqs: int = 64,
    max_model_len: int = 4096,
    tensor_parallel_size: int = 1,
) -> LLM:
    """
    Attempts to initialize vLLM, progressively scaling down memory usage on OOM.
    """
    tiers: List[Dict[str, Any]] = [
        {"gpu_memory_utilization": target_utilization, "max_num_seqs": max_seqs},
        {"gpu_memory_utilization": max(0.70, target_utilization - 0.15), "max_num_seqs": max(32, max_seqs // 2)},
        {"gpu_memory_utilization": 0.60, "max_num_seqs": 16},
        {"gpu_memory_utilization": 0.50, "max_num_seqs": 8},
    ]

    last_error: Exception | None = None
    for attempt, params in enumerate(tiers, 1):
        try:
            print(
                f"🔄 Attempt {attempt}/{len(tiers)}: loading vLLM "
                f"(gpu_util={params['gpu_memory_utilization']}, max_seqs={params['max_num_seqs']})..."
            )
            llm = LLM(
                model=model_path,
                max_model_len=max_model_len,
                gpu_memory_utilization=params["gpu_memory_utilization"],
                max_num_seqs=params["max_num_seqs"],
                tensor_parallel_size=tensor_parallel_size,
                trust_remote_code=True,
                enforce_eager=False,
            )
            print("✅ vLLM engine initialized successfully.")
            return llm
        except Exception as e:
            print(f"⚠️ Attempt {attempt} failed with error: {e}")
            last_error = e

    raise RuntimeError(f"❌ All vLLM initialization attempts failed: {last_error}")
```

---

## 3. High-Throughput Batch Generation: `llm.chat()`

Always prefer `llm.chat()` over manual prompt string concatenation and `llm.generate()`. `llm.chat()` formats messages using the model's native `tokenizer.apply_chat_template`, preventing subtle token mismatches with special tokens (`<|start_header_id|>`, `[INST]`, `<|im_start|>`).

```python
from typing import List, Dict
from vllm import LLM, SamplingParams

def run_vllm_batch_chat(
    llm: LLM,
    batch_messages: List[List[Dict[str, str]]],
    sampling_params: SamplingParams,
    chat_template_kwargs: Dict[str, Any] | None = None
) -> List[str]:
    """
    Executes high-throughput batch inference across conversational message payloads.
    """
    outputs = llm.chat(
        batch_messages,
        sampling_params=sampling_params,
        use_tqdm=False,
        chat_template_kwargs=chat_template_kwargs or {}
    )
    return [output.outputs[0].text.strip() for output in outputs]
```

---

## 4. Fallback Architecture: Transformers + BitsAndBytes

When benchmarking on environments where vLLM is not installed, or when evaluating in 4-bit precision without unquantized weights:

### ⚠️ MANDATORY RULE: Left-Padding for Batch Generation
When using Hugging Face Transformers for batch generation with causal language models:

```python
# ❌ CATASTROPHIC BUG: Right padding causes generation on top of pad tokens
tokenizer.padding_side = "right"  # Corrupts output during model.generate()

# ✅ MANDATORY STANDARD: Left padding preserves continuous autoregressive generation
tokenizer.padding_side = "left"
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
```

### Complete Transformers Batch Generation Pattern

```python
"""
Fallback batch generation with Hugging Face Transformers and BitsAndBytes 4-bit.
"""

import os
from typing import List, Dict, Any
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig


class HFTransformersBenchmarkEngine:
    def __init__(self, model_name: str, use_4bit: bool = True):
        self.model_name = model_name
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            token=os.getenv("HF_TOKEN", ""),
            padding_side="left",  # Mandatory for batch generation!
            trust_remote_code=True
        )
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        quant_config = None
        if use_4bit:
            quant_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True
            )

        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=quant_config,
            device_map="auto",
            torch_dtype=torch.bfloat16,
            token=os.getenv("HF_TOKEN", ""),
            trust_remote_code=True
        )
        self.model.eval()

    def generate_batch(
        self,
        batch_messages: List[List[Dict[str, str]]],
        max_new_tokens: int = 150,
        skip_special_tokens: bool = True,
    ) -> List[str]:
        # Apply native chat template
        prompts = [
            self.tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
            for msgs in batch_messages
        ]

        inputs = self.tokenizer(
            prompts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=4096
        ).to(self.model.device)

        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,  # Deterministic greedy decoding
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )

        # Slice off input tokens to retain only newly generated text
        input_len = inputs["input_ids"].shape[1]
        generated_ids = output_ids[:, input_len:]
        return self.tokenizer.batch_decode(generated_ids, skip_special_tokens=skip_special_tokens)
```
