# Benchmarking, Inference & Model Serving

## 1. High-Throughput Batch Inference with vLLM

vLLM's PagedAttention engine provides 5–20× higher throughput than standard Hugging Face Transformers batching by eliminating memory waste in key-value (KV) caches.

### Setting Up the vLLM Offline Engine
```python
from vllm import LLM, SamplingParams

def create_vllm_engine(
    model_path: str,
    max_model_len: int = 8192,
    gpu_memory_utilization: float = 0.85,
    tensor_parallel_size: int = 1
) -> LLM:
    """
    Initializes a vLLM offline inference engine.
    
    CRITICAL: Always set max_model_len! Without an explicit cap, models with
    32k-128k context windows will allocate massive KV caches, causing immediate
    CUDA Out-of-Memory or dropping concurrency to 1.
    """
    llm = LLM(
        model=model_path,
        max_model_len=max_model_len,
        gpu_memory_utilization=gpu_memory_utilization,
        tensor_parallel_size=tensor_parallel_size,
        trust_remote_code=True
    )
    return llm
```

### Batch Chat Generation
```python
def run_batch_inference(llm: LLM, batch_conversations: list, is_reasoning: bool = False):
    """
    Runs high-throughput batched chat generation.
    
    Args:
        batch_conversations: List of conversation message lists, e.g.
            [[{"role": "user", "content": "..."}], ...]
        is_reasoning: Set True if evaluating models with <think> tokens.
    """
    if is_reasoning:
        # Exploratory sampling for reasoning models; keep special tokens to preserve <think>
        sampling_params = SamplingParams(
            temperature=0.6,
            top_p=0.95,
            top_k=20,
            max_tokens=512,
            skip_special_tokens=False
        )
    else:
        # Greedy decoding for standard multiple-choice or deterministic benchmarks
        sampling_params = SamplingParams(
            temperature=0.0,
            max_tokens=150,
            skip_special_tokens=True
        )

    chat_kwargs = {"chat_template_kwargs": {"enable_thinking": True}} if is_reasoning else {}
    outputs = llm.chat(batch_conversations, sampling_params=sampling_params, use_tqdm=True, **chat_kwargs)
    return [output.outputs[0].text for output in outputs]
```

---

## 2. Fallback: Hugging Face Transformers Batching

When vLLM is not installed or when running on unsupported hardware (e.g., Apple Silicon or older GPU architectures), use Transformers batch generation.

### Mandatory Left-Padding Rule & Generation Pipeline
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

def setup_transformers_engine(model_name: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        
    # CRITICAL: Batch generation in Transformers MUST be left-padded!
    # Right-padding causes the model to generate continuation over padding tokens,
    # corrupting positional embeddings and hallucinating answers.
    tokenizer.padding_side = "left"

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )
    model.eval()
    return model, tokenizer

def run_batch_transformers(model, tokenizer, prompt_texts: list, max_new_tokens: int = 150) -> list:
    """Executes batched generation with left-padding and slices prompt tokens from responses."""
    inputs = tokenizer(prompt_texts, return_tensors="pt", padding=True, truncation=True)
    input_ids = inputs["input_ids"].to(model.device)
    attention_mask = inputs["attention_mask"].to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            input_ids=input_ids,
            attention_mask=attention_mask,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id
        )

    # Slice output tensors past prompt length: outputs[i][input_ids.shape[1]:]
    prompt_len = input_ids.shape[1]
    responses = [
        tokenizer.decode(out[prompt_len:], skip_special_tokens=True).strip()
        for out in outputs
    ]
    return responses
```

---

## 3. Reasoning Models & Thinking Token Extraction

Models with integrated Chain-of-Thought reasoning (e.g. Qwen 2.5/3, DeepSeek) output internal thought processes enclosed in `<think>...</think>` tokens.

### Extraction Pattern
```python
import re

def extract_answer_from_reasoning_output(raw_output: str, is_multiple_choice: bool = True) -> str:
    """
    Safely extracts the final answer from reasoning model output.
    Prevents matching candidate tokens inside the exploratory <think> block.
    """
    # 1. Separate thinking trace from final response
    if "</think>" in raw_output:
        post_think = raw_output.split("</think>", 1)[1].strip()
    else:
        post_think = raw_output.strip()

    if not is_multiple_choice:
        return post_think

    # 2. Prioritized regex extraction on the post-think text
    patterns = [
        r"(?:risposta(?:\s+corretta)?(?:\s+è)?:?\s*)([A-E])\b",
        r"(?:the(?:\s+correct)?(?:\s+answer)?(?:\s+is)?:?\s*)([A-E])\b",
        r"(?:LETTERA|OPZIONE)\s*[:(]?\s*([A-E])\b",
        r"\b([A-E])\)",
        r"^\s*([A-E])\b"
    ]
    for pattern in patterns:
        match = re.search(pattern, post_think, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # 3. Fallback: Last uppercase letter in the post-thinking text
    letters = re.findall(r"\b([A-E])\b", post_think)
    return letters[-1] if letters else ""
```

---

## 4. Safe LoRA Adapter Merging for Serving & Benchmarking

vLLM does not directly run 4-bit QLoRA adapters with high throughput without weight fusing. Fusing merges the low-rank delta weights $\Delta W = B \cdot A$ directly into the base weights $W$.

### The Iron Rule of Adapter Merging
> **NEVER call `.merge_and_unload()` on a 4-bit quantized base model.**
> Attempting to merge on 4-bit weights will either raise a `RuntimeError` or produce severely distorted, corrupted floating-point weights.
> **Solution:** Load the base model in unquantized 16-bit precision (`bfloat16`), attach the adapter, and execute `merge_and_unload()`.

```python
import os
import shutil
import torch
from peft import AutoPeftModelForCausalLM

def merge_lora_to_standalone_model(
    adapter_path: str,
    output_dir: str,
    torch_dtype=torch.bfloat16
) -> str:
    """
    Fuses LoRA adapter into an unquantized base model for vLLM serving.
    """
    print(f"Loading adapter from {adapter_path} onto unquantized 16-bit base...")
    model = AutoPeftModelForCausalLM.from_pretrained(
        adapter_path,
        torch_dtype=torch_dtype,
        device_map="cpu",  # Load on CPU or GPU depending on available RAM
        low_cpu_mem_usage=True
    )
    
    print("Fusing adapter weights...")
    merged_model = model.merge_and_unload()
    
    print(f"Saving standalone merged model to {output_dir}...")
    merged_model.save_pretrained(output_dir, safe_serialization=True)
    
    # Save tokenizer alongside weights (fallback to base model if missing in adapter path)
    from transformers import AutoTokenizer
    try:
        tokenizer = AutoTokenizer.from_pretrained(adapter_path, trust_remote_code=True)
    except Exception:
        import json
        with open(os.path.join(adapter_path, "adapter_config.json")) as f:
            base_model = json.load(f).get("base_model_name_or_path")
        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    tokenizer.save_pretrained(output_dir)
    
    print("✅ Model fused and saved successfully.")
    return output_dir
```
