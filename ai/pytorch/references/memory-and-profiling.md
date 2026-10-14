# PyTorch Memory Profiling, Optimization & OOM Mitigation Reference

## 1. CUDA Memory Architecture: Allocated vs Reserved

Understanding the distinction between allocated memory and reserved memory is fundamental to debugging out-of-memory (OOM) errors.

```
+-------------------------------------------------------------------+
|                        Total GPU VRAM                             |
|  +---------------------------------------------+  +------------+  |
|  |           Reserved Memory (Cached)          |  |  Non-PyTorch|  |
|  |  +---------------------+  +---------------+ |  |  Context /  |  |
|  |  |   Allocated Memory  |  |  Free Cached   | |  |  Driver /   |  |
|  |  |   (Active Tensors)  |  |  Memory Blocks | |  |  OS Display |  |
|  |  +---------------------+  +---------------+ |  +------------+  |
|  +---------------------------------------------+                  |
+-------------------------------------------------------------------+
```

- **Allocated Memory (`torch.cuda.memory_allocated()`):** The exact bytes currently occupied by live PyTorch `Tensor` buffers.
- **Reserved Memory (`torch.cuda.memory_reserved()`):** The total memory pool grabbed by PyTorch's caching allocator from the NVIDIA driver.
- **CUDA Caching Allocator:** PyTorch avoids expensive `cudaMalloc` and `cudaFree` OS calls by keeping freed memory blocks in a private memory pool for immediate reuse.

### The `torch.cuda.empty_cache()` Myth
- Calling `torch.cuda.empty_cache()` **never** releases active tensors or solves fundamental OOM bugs.
- It only releases unallocated cached blocks from the caching allocator back to the GPU driver.
- **Performance penalty:** Invoking `empty_cache()` synchronizes the GPU and forces subsequent tensor allocations to make slow driver calls.
- **Legitimate uses:** Only call it when transitioning major execution phases (e.g., after large validation runs, before starting inference serving, or inside an `except torch.cuda.OutOfMemoryError:` cleanup handler).

---

## 2. Visual Memory Profiling with Snapshots

The most accurate way to find memory leaks and peak allocation spikes is PyTorch's native memory history recorder.

### Recording a Memory Snapshot

```python
import torch

# 1. Start recording memory history before the critical training steps
# max_entries sets the trace depth
torch.cuda.memory._record_memory_history(max_entries=100000)

for step, (inputs, targets) in enumerate(dataloader):
    outputs = model(inputs.to("cuda"))
    loss = criterion(outputs, targets.to("cuda"))
    loss.backward()
    optimizer.step()
    optimizer.zero_grad(set_to_none=True)

    # Record 3-5 representative steps, then dump
    if step == 4:
        break

# 2. Dump the snapshot to a pickle file
torch.cuda.memory._dump_snapshot("cuda_memory_snapshot.pickle")

# 3. Stop recording to avoid runtime overhead
torch.cuda.memory._record_memory_history(enabled=None)
```

### Visualizing the Snapshot
1. Open [https://pytorch.org/memory_viz](https://pytorch.org/memory_viz) in a browser.
2. Drag and drop `cuda_memory_snapshot.pickle`.
3. Inspect:
   - Peak allocation timeline.
   - Exact Python stack trace where the largest memory buffers were allocated.
   - Memory fragmentation (difference between reserved pool and allocated blocks).

---

## 3. Activation Checkpointing (`torch.utils.checkpoint`)

Activation checkpointing discards intermediate activation tensors during the forward pass and recomputes them on-the-fly during the backward pass. This trades compute ($\approx 20\%-30\%$ extra forward time) to reduce activation memory footprint from $O(N)$ layers to $O(1)$ or $O(\sqrt{N})$.

### Modern Checkpointing API (`use_reentrant=False`)
Always set `use_reentrant=False`. The legacy reentrant API is incompatible with nested autograd, hooks, and mixed precision.

```python
import torch
import torch.nn as nn
from torch.utils.checkpoint import checkpoint

class TransformerBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.attn = nn.MultiheadAttention(embed_dim=dim, num_heads=8, batch_first=True)
        self.mlp = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Linear(dim * 4, dim)
        )

    def forward(self, x):
        attn_out, _ = self.attn(x, x, x)
        x = x + attn_out
        x = x + self.mlp(x)
        return x

class DeepModel(nn.Module):
    def __init__(self, num_layers=24, dim=1024):
        super().__init__()
        self.layers = nn.ModuleList([TransformerBlock(dim) for _ in range(num_layers)])

    def forward(self, x):
        for layer in self.layers:
            if self.training:
                # Discards layer activations; recomputes during backward
                x = checkpoint(layer, x, use_reentrant=False)
            else:
                x = layer(x)
        return x
```

### Checkpointing with Frozen Parameters (PEFT / LoRA)
- In legacy checkpointing (`use_reentrant=True`), if all inputs to a checkpointed block did not have `requires_grad=True` (e.g. frozen base model embeddings in PEFT/LoRA), PyTorch silently failed to backpropagate to adapter layers or threw `RuntimeError: None of the inputs have requires_grad=True`.
- With modern `use_reentrant=False`, autograd correctly backpropagates gradients to trainable parameters inside the block even when input tensors do not require gradients.

---

## 4. Fused Optimizers & `set_to_none=True`

### Gradient Invalidation: `set_to_none=True`
```python
# ❌ Traditional: Writes zero tensors over gradient memory
optimizer.zero_grad()

# ✅ Modern: Deletes gradient memory entirely
optimizer.zero_grad(set_to_none=True)
```
- Sets `param.grad = None` instead of allocating and populating zeros.
- Reduces memory bandwidth and peak allocation during backpropagation.
- Executes faster because PyTorch autograd allocates gradients on first accumulation.

### Fused AdamW
PyTorch provides fused CUDA implementations of popular optimizers that fuse parameter update loops into a single kernel launch.

```python
# Fused AdamW executes kernel updates in a single GPU pass
# Ensure parameters are resident on CUDA before passing fused=True
is_cuda_model = torch.cuda.is_available() and next(model.parameters(), torch.empty(0)).is_cuda
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3,
    weight_decay=0.01,
    fused=is_cuda_model
)
```
- Reduces kernel launch overhead by combining moment updates, decay, and scaling into one kernel.
- Lowers optimizer state latency significantly compared to standard loop-based AdamW.

---

## 5. Gradient Accumulation Memory Optimization

Gradient accumulation simulates larger batch sizes by summing gradients over multiple micro-batches before calling `optimizer.step()`.

```python
accumulation_steps = 4
optimizer.zero_grad(set_to_none=True)

for i, (inputs, targets) in enumerate(dataloader):
    inputs = inputs.to("cuda", non_blocking=True)
    targets = targets.to("cuda", non_blocking=True)

    with torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16):
        outputs = model(inputs)
        # Normalize loss so gradient magnitudes match equivalent full batch
        loss = criterion(outputs, targets) / accumulation_steps

    loss.backward()

    if (i + 1) % accumulation_steps == 0 or (i + 1) == len(dataloader):
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
```

---

## 6. OOM Prevention Checklist

1. **Never accumulate loss tensors across iterations:**

```python
# ❌ Memory leak: retains computational graph for entire epoch
total_loss += loss

# ✅ Detached scalar: releases autograd graph immediately
total_loss += loss.item()
```

2. **Use `torch.inference_mode()` during evaluation:**

```python
# Bypasses autograd tracking and version counting entirely
with torch.inference_mode():
    for val_inputs, val_targets in val_loader:
        outputs = model(val_inputs)
```
3. **Set PyTorch memory allocator configuration:**
   To reduce memory fragmentation in long runs, configure expandable segments:
   ```bash
   export PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True"
   ```
