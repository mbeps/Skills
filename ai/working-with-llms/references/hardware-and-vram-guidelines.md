# Hardware & VRAM Guidelines for LLM Workloads

## 1. VRAM Consumption by Model Size & Workload

The table below provides empirical VRAM estimates for modern LLM architectures (e.g. LLaMA 3, Qwen 2.5/3, Mistral) at sequence length $\approx 2048$:

| Model Size | Weights Only (16-bit) | 4-Bit QLoRA Fine-Tuning | 16-Bit LoRA Fine-Tuning | vLLM Batch Inference (FP16/BF16) | Minimum Recommended GPU |
|---|---|---|---|---|---|
| **0.5B – 1.5B** | 1.0 – 3.0 GB | ~3 – 5 GB | ~5 – 7 GB | ~4 – 6 GB | RTX 3060 (12 GB) |
| **3B – 4B** | 6.0 – 8.0 GB | ~6 – 8 GB | ~10 – 14 GB | ~8 – 12 GB | RTX 3060 / 4070 (12–16 GB) |
| **7B – 8B** | 14.0 – 16.0 GB | ~8 – 12 GB | ~20 – 24 GB | ~16 – 20 GB | RTX 3090 / 4090 (24 GB) |
| **14B** | ~28 GB | ~14 – 18 GB | ~36 – 44 GB | ~32 – 40 GB | RTX A6000 / A100 (40–48 GB) |
| **32B** | ~64 GB | ~22 – 28 GB | ~75 – 85 GB | ~70 – 80 GB | A100 / H100 (80 GB) |
| **70B** | ~140 GB | ~44 – 52 GB | Multi-GPU / FSDP | 2× A100 (80 GB) | 1× A100 (4-bit QLoRA) or 2–4× A100 |

---

## 2. Dynamic Memory Sizing & Schedulers

### The Effective Batch Size Formula
To achieve stable convergence without overflowing GPU memory:

$$\text{Effective Batch Size} = \text{per\_device\_batch\_size} \times \text{gradient\_accumulation\_steps} \times \text{num\_gpus}$$

- **Target Effective Batch Size:** Usually 16 to 64 for instruction fine-tuning.
- If GPU VRAM is tight (e.g. 8B model on 16GB GPU):
  - Set `per_device_batch_size = 1` or `2`.
  - Compensate by setting `gradient_accumulation_steps = 16` or `32`.
  - Result: Exact same gradient step quality as physical batch size 32, but fits in small VRAM!

### Sequence Length Impact on KV Cache
- Memory for weights is static ($O(1)$ relative to batch size).
- Memory for activations and KV cache scales linearly with sequence length $L$ and batch size $B$:
  $$\text{KV Cache (bytes)} \approx 2 \times 2 \times n_{\text{layers}} \times n_{\text{heads}} \times d_{\text{head}} \times L \times B$$
- **vLLM Context Cap:** Always set `max_model_len` (e.g. 4096 or 8192) in `LLM()`. If left uncapped, a model declaring 128k context will reserve 90%+ of VRAM for KV cache up front, choking concurrency.

---

## 3. GPU Memory Recovery & Hygiene

When running multiple training or benchmarking runs in succession inside the same Python process or notebook session:

```python
import gc
import torch

def force_gpu_cleanup():
    """Flushes unreferenced objects and releases cached GPU memory back to the driver."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
        allocated = torch.cuda.memory_allocated() / (1024**3)
        reserved = torch.cuda.memory_reserved() / (1024**3)
        print(f"🧹 GPU Cache Cleared. Allocated: {allocated:.2f} GB | Reserved: {reserved:.2f} GB")
```
