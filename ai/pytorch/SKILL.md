---
name: pytorch
description: Use when building, training, fine-tuning, profiling, optimizing, or debugging deep learning models in PyTorch (2.x+) — covering tensors, device transfers, autograd, nn.Module architecture, DataLoader tuning, mixed precision (torch.amp), compilation (torch.compile), CUDA OOM, memory profiling, or distributed training (DDP/FSDP).
---

# PyTorch (2.x+) Engineering Playbook

## Overview

A unified engineering guide for building, training, fine-tuning, and optimizing deep learning models using modern PyTorch (2.x+).

**Core principle:** **Treat PyTorch as a compiled, hardware-accelerated computation engine rather than a NumPy wrapper.** Write device-agnostic, allocation-free code that minimizes Python overhead, eliminates host-to-device synchronization bottlenecks, leverages automated kernel fusion (`torch.compile`), and manages GPU memory defensively.

---

## When to Use

### Use When:
- Implementing custom neural network layers, loss functions, or training loops in PyTorch 2.x+.
- Optimizing PyTorch training throughput, batch sizes, or multi-worker DataLoader pipelines.
- Managing GPU VRAM constraints, resolving `torch.cuda.OutOfMemoryError`, or profiling memory allocation histories.
- Implementing automatic mixed precision (`torch.amp`) with `bfloat16` or `float16` (`GradScaler`).
- Accelerating inference or training passes with `torch.compile` and TorchInductor.
- Scaling models across multiple GPUs or nodes using Distributed Data Parallel (`DDP`) or Fully Sharded Data Parallel (`FSDP`/`FSDP2`).
- Debugging autograd graphs, in-place tensor mutation errors, or silent gradient leaks.

### When NOT to Use:
- Running non-tensor tabular machine learning models (use `scikit-learn`, `LightGBM`, or `XGBoost`).
- High-level orchestrations where raw PyTorch code is fully abstracted by frameworks and no custom module or loop adjustments are needed (e.g. basic Hugging Face `Trainer` scripts without custom logic).
- Pure high-level LLM serving configurations without model internals modifications (use specialized engines like `vLLM` or `SGLang`).

---

## Quick Reference

| Area | Modern Idiom (PyTorch 2.x+) | Legacy / Anti-Pattern | Critical Rationale |
|---|---|---|---|
| **Device Agnostic** | `device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))` | Hardcoding `x.cuda()` | Portability across NVIDIA CUDA, Apple Silicon MPS, and CPU. |
| **Tensor Creation** | `torch.zeros((B, D), device=device, dtype=torch.float32)` | `torch.zeros((B, D)).to(device)` | Direct allocation avoids redundant CPU allocation and memory churn. |
| **Meta / Large Models** | `with torch.device("meta"): model = MyModel()` + `load_state_dict(..., assign=True)` | Instantiating full weights on CPU/GPU before loading checkpoints | Meta device has zero memory footprint; prevents OOM during large model loading. |
| **Host-to-Device** | `tensor.to(device, non_blocking=True)` with `pin_memory=True` | `tensor.to(device)` without pinned memory | Enables direct memory access (DMA) asynchronous transfer overlapping with GPU compute. |
| **Inference Scope** | `with torch.inference_mode():` | `with torch.no_grad():` or unadorned `model.eval()` | `inference_mode` disables autograd tracking and version counter recording for maximum speed. |
| **Gradient Reset** | `optimizer.zero_grad(set_to_none=True)` | `optimizer.zero_grad()` | Sets gradient tensors to `None` instead of writing zeros, saving memory and bandwidth. |
| **Loss Logging** | `total_loss += loss.item()` | `total_loss += loss` | Prevents retaining the full dynamic autograd computation graph across steps (memory leak). |
| **Mixed Precision** | `with torch.amp.autocast("cuda", dtype=torch.bfloat16):` | `torch.cuda.amp.autocast()` with `fp16` only | Modern unified namespace; `bfloat16` prevents underflow and eliminates `GradScaler` overhead. |
| **Attention** | `F.scaled_dot_product_attention(q, k, v, is_causal=True)` | Manual `(q @ k.T / math.sqrt(d)).softmax()` | Native dispatch to FlashAttention-2 or Cutlass with $O(N)$ memory and fused CUDA kernels. |
| **Compilation** | `torch.compile(model, mode="default")` | Pure Python eager execution | Traces graph and fuses operations into optimized Triton/C++ kernels via TorchInductor. |
| **Module State** | `self.register_buffer("mask", tensor, persistent=False)` | `self.mask = tensor` or Python lists of layers | Plain attributes fail to move on `.to(device)` and Python lists drop submodules. |

---

## Core Patterns: Before & After

### 1. Device Allocation & Asynchronous Transfers

#### ❌ Anti-Pattern: Redundant CPU Allocations & Blocking Copies
```python
# Allocates on host CPU memory, then performs blocking copy to GPU
x = torch.randn(1024, 1024)
x = x.to("cuda")

for batch_x, batch_y in dataloader:
    # Synchronous transfer halts GPU execution until copy finishes
    batch_x = batch_x.to("cuda")
    batch_y = batch_y.to("cuda")
```

#### ✅ Modern Standard: Direct Initialization & Pinned Asynchronous Transfers
```python
# Direct GPU allocation: zero host memory overhead
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x = torch.randn(1024, 1024, device=device, dtype=torch.float32)

# Paired with DataLoader(pin_memory=True), non_blocking allows DMA background transfer
for batch_x, batch_y in dataloader:
    batch_x = batch_x.to(device, non_blocking=True)
    batch_y = batch_y.to(device, non_blocking=True)
```

---

### 2. Mixed Precision & Scaler Lifecycle

#### ❌ Anti-Pattern: Deprecated `torch.cuda.amp` & Unsafe Clipping
```python
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()
with autocast():
    loss = criterion(model(inputs), targets)

loss.backward()
# BUG: Clipping scaled gradients ruins gradient norm thresholds!
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
scaler.step(optimizer)
scaler.update()
```

#### ✅ Modern Standard: Unified `torch.amp` with Proper Unscaling
```python
# Modern unified API supporting CUDA, CPU, XPU
autocast_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
use_scaler = (autocast_dtype == torch.float16)
scaler = torch.amp.GradScaler("cuda", enabled=use_scaler)

optimizer.zero_grad(set_to_none=True)

with torch.amp.autocast(device_type="cuda", dtype=autocast_dtype):
    outputs = model(inputs)
    loss = criterion(outputs, targets)

if use_scaler:
    scaler.scale(loss).backward()
    # Mandatory: unscale gradients before norm clipping
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)
    scaler.update()
else:
    # bfloat16 does not suffer float16 underflow; no scaler overhead
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()
```

---

### 3. State Management: Parameters vs Buffers

#### ❌ Anti-Pattern: Bare Attributes & Hidden State Bugs
```python
class FaultyBlock(torch.nn.Module):
    def __init__(self, dim):
        super().__init__()
        # BUG 1: Python list doesn't register layers with PyTorch!
        self.linears = [torch.nn.Linear(dim, dim) for _ in range(3)]
        # BUG 2: Won't move to GPU when model.to('cuda') is called!
        self.running_mean = torch.zeros(dim)
        # BUG 3: Direct .forward() call bypasses forward hooks
```

#### ✅ Modern Standard: `nn.ModuleList` & Explicit Buffer Registration
```python
class RobustBlock(torch.nn.Module):
    def __init__(self, dim):
        super().__init__()
        # Properly registered submodule container
        self.linears = torch.nn.ModuleList([torch.nn.Linear(dim, dim) for _ in range(3)])

        # Persistent buffer: saved in state_dict and moved with model.to(device)
        self.register_buffer("running_mean", torch.zeros(dim), persistent=True)

        # Non-persistent buffer: moved with .to(device) but omitted from checkpoint files
        self.register_buffer("position_ids", torch.arange(512), persistent=False)

    def forward(self, x):
        for layer in self.linears:
            x = layer(x)
        return x + self.running_mean
```

---

## Implementation Recipes

### 1. High-Performance DataLoader Setup

```python
import os
import torch
from torch.utils.data import DataLoader, Dataset

def create_optimized_dataloader(dataset: Dataset, batch_size: int, is_train: bool = True) -> DataLoader:
    # Rule of thumb: min(4 * num_gpus, cpu_count)
    num_workers = min(4, os.cpu_count() or 1)

    def seed_worker(worker_id):
        # Ensures deterministic yet unique seeds across multi-process workers
        worker_seed = torch.initial_seed() % (2**32)
        import random
        import numpy as np
        random.seed(worker_seed)
        np.random.seed(worker_seed)

    generator = torch.Generator()
    generator.manual_seed(42)

    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=is_train,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),   # Required for non_blocking=True transfer
        persistent_workers=(num_workers > 0),   # Keeps worker processes alive between epochs
        prefetch_factor=2 if num_workers > 0 else None,
        worker_init_fn=seed_worker if is_train else None,
        generator=generator if is_train else None,
        drop_last=is_train                     # Avoids recompilation on remainder batch sizes
    )
```

---

### 2. Production Model Compilation (`torch.compile`) & SDPA

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class TransformerLayer(nn.Module):
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads

        self.qkv_proj = nn.Linear(d_model, 3 * d_model, bias=False)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, S, D = x.shape
        residual = x
        x = self.norm(x)

        # Fused projection and reshape to [B, H, S, D_h]
        qkv = self.qkv_proj(x).reshape(B, S, 3, self.n_heads, self.head_dim)
        q, k, v = qkv.unbind(dim=2)
        q = q.transpose(1, 2).contiguous()
        k = k.transpose(1, 2).contiguous()
        v = v.transpose(1, 2).contiguous()

        # Dispatches directly to FlashAttention-2 / Cutlass
        attn_out = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        attn_out = attn_out.transpose(1, 2).reshape(B, S, D)

        return residual + self.out_proj(attn_out)

# Compilation for production
raw_model = TransformerLayer(d_model=768, n_heads=12).to("cuda")

# dynamic=True prevents graph recompilation if sequence lengths vary across steps
compiled_model = torch.compile(raw_model, mode="default", dynamic=True)
```

---

### 3. Distributed Data Parallel (DDP) Setup

```python
import os
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DistributedSampler

def init_distributed():
    dist.init_process_group(backend="nccl")
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    return local_rank

def train_ddp_epoch(model, dataloader, sampler, optimizer, criterion, epoch, local_rank):
    # Mandatory: ensures different shuffle ordering per epoch across ranks
    sampler.set_epoch(epoch)
    model.train()

    for inputs, targets in dataloader:
        inputs = inputs.to(local_rank, non_blocking=True)
        targets = targets.to(local_rank, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)
        with torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16):
            outputs = model(inputs)
            loss = criterion(outputs, targets)

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
```

---

## Common Pitfalls & Red Flags

| Red Flag / Symptom | Root Cause | Modern Fix |
|---|---|---|
| `CUDA out of memory` during epoch loop | Accumulating loss tensors (`total_loss += loss`) keeps autograd graph alive indefinitely. | Use `total_loss += loss.item()`. |
| `RuntimeError: modified by an inplace operation` | In-place operation (`x += y`, `x[idx] = ...`) modifies tensor needed for backward pass. | Use out-of-place equivalents (`x = x + y`) or clone slices before mutation. |
| Model parameters not updating on GPU | Layers stored in a bare Python `list` instead of `nn.ModuleList`. | Wrap layers in `nn.ModuleList` or `nn.Sequential`. |
| Submodule buffers missing on `.to(device)` | Custom state saved as plain tensor attributes instead of registered buffers. | Use `self.register_buffer("name", tensor)`. |
| `torch.compile` recompiles on every step | Shapes vary between steps without setting `dynamic=True`. | Pass `dynamic=True` to `torch.compile` or pad inputs to fixed boundaries. |
| Evaluation runs slower and consumes high memory | Missing `torch.inference_mode()` context. | Wrap evaluation in `with torch.inference_mode():`. |
| DDP shuffles identical data each epoch | Omission of `sampler.set_epoch(epoch)` in training loop. | Call `sampler.set_epoch(epoch)` at the beginning of every training epoch. |
| `scaler.step()` yields constant NaNs/Infs | Gradient clipping applied before calling `scaler.unscale_(optimizer)`. | Always call `scaler.unscale_(optimizer)` before `clip_grad_norm_`. |
| Calling `torch.cuda.empty_cache()` inside loop | Empties allocator cache, forcing expensive synchronous driver calls. | Never call inside training step loops; rely on allocator block reuse. |

---

## Detailed References

For specialized configurations and deep dives, refer to the following companion guides:

- [amp-and-compilation.md](references/amp-and-compilation.md) — Comprehensive guide to modern `torch.amp`, `bfloat16` vs `float16`, `GradScaler` unscaling rules, `torch.compile` internals (TorchDynamo, TorchInductor, AOTAutograd), graph break debugging (`torch._dynamo.explain`), dynamic shapes, SDPA, and FlexAttention.
- [memory-and-profiling.md](references/memory-and-profiling.md) — Memory allocator mechanics (allocated vs reserved), snapshot recording (`_record_memory_history`), visual profiling with `pytorch.org/memory_viz`, activation checkpointing (`use_reentrant=False`), fused optimizers, and gradient accumulation.
- [distributed-ddp-fsdp.md](references/distributed-ddp-fsdp.md) — Multi-GPU distributed training with `torchrun`, NCCL process groups, DDP configuration with `model.no_sync()`, Fully Sharded Data Parallel (FSDP & FSDP2 `fully_shard`), and multi-dimensional `DeviceMesh`.
- [autograd-and-modules.md](references/autograd-and-modules.md) — Autograd mechanics, custom `torch.autograd.Function` implementation, persistent vs non-persistent buffer management, forward/backward hooks, weight initialization patterns, and secure checkpoint loading (`weights_only=True`).
