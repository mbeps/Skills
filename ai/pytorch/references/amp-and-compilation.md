# Modern PyTorch AMP, Compilation & Attention Reference

## 1. Automatic Mixed Precision (`torch.amp`)

### Modern Namespace vs Legacy
PyTorch 2.x unified mixed precision under `torch.amp`. Do not use the legacy `torch.cuda.amp` namespace.

```python
import torch

# Modern PyTorch 2.x API
device_type = "cuda" if torch.cuda.is_available() else "cpu"
autocast_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

with torch.amp.autocast(device_type=device_type, dtype=autocast_dtype):
    output = model(inputs)
    loss = criterion(output, targets)
```

### `bfloat16` vs `float16` Rules

| Aspect | `bfloat16` | `float16` |
|---|---|---|
| **Exponent Bits** | 8 (identical to `float32`) | 5 |
| **Mantissa Bits** | 7 | 10 |
| **Dynamic Range** | $\sim 10^{-38}$ to $10^{38}$ | $\sim 6 \times 10^{-5}$ to $65504$ |
| **GradScaler Required?** | **No** (virtually impossible to underflow) | **Yes** (strict underflow risk) |
| **Hardware Support** | Ampere (A100, RTX 3000+), Hopper, Blackwell, recent CPUs | Volta, Turing, Ampere, Hopper, Blackwell |

### The `GradScaler` Lifecycle (Mandatory for `float16`)
When using `float16`, gradients often underflow to zero. `torch.amp.GradScaler` multiplies the loss by a dynamic scale factor before backward, and divides before the optimizer step.

```python
scaler = torch.amp.GradScaler(device_type="cuda", enabled=(autocast_dtype == torch.float16))

for inputs, targets in dataloader:
    inputs = inputs.to("cuda", non_blocking=True)
    targets = targets.to("cuda", non_blocking=True)
    optimizer.zero_grad(set_to_none=True)

    with torch.amp.autocast(device_type="cuda", dtype=autocast_dtype):
        outputs = model(inputs)
        loss = criterion(outputs, targets)

    # 1. Backward pass with scaled loss
    scaler.scale(loss).backward()

    # 2. Gradient clipping requires unscaling FIRST
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

    # 3. Step optimizer through scaler (skips step if NaNs/Infs found)
    scaler.step(optimizer)

    # 4. Update scale factor for next iteration
    scaler.update()
```

### Critical Scaler Rules
- **Always unscale before clipping:** Calling `clip_grad_norm_` without `scaler.unscale_(optimizer)` computes the norm on scaled gradients, destroying the gradient norm threshold.
- **Never call `optimizer.step()` directly** when using `GradScaler`; always call `scaler.step(optimizer)`.
- If using `bfloat16`, omit `GradScaler` entirely or initialize with `enabled=False` to save CPU-GPU sync overhead.

---

## 2. Compilation (`torch.compile`)

PyTorch 2.x introduces `torch.compile`, which captures graphs via TorchDynamo, traces backward passes with AOTAutograd, and generates optimized kernel code via TorchInductor (Triton on GPUs, C++/OpenMP on CPUs).

### Compilation Modes

| Mode | Target Use Case | Characteristics |
|---|---|---|
| `mode="default"` | General training & inference | Balanced compile times, safe kernel fusion, dynamic shape friendly. |
| `mode="reduce-overhead"` | Small batch sizes, CPU-GPU overhead bottlenecks | Embeds CUDA Graphs. Requires static shapes and fixed memory addresses. |
| `mode="max-autotune"` | Production serving, long training runs | Benchmarks multiple Triton kernel variants to select fastest code. Slowest initial compile. |

### Compilation Options & Syntax

```python
import torch

# Standard compilation
compiled_model = torch.compile(
    model,
    mode="default",
    dynamic=None,       # None: dynamic shapes inferred automatically
    fullgraph=False,    # True: enforces zero graph breaks (raises error if break occurs)
    backend="inductor"  # Default Triton/C++ compiler backend
)

# For serving with fixed input dimensions (CUDA Graph optimization)
optimized_inference = torch.compile(
    model,
    mode="reduce-overhead",
    dynamic=False
)
```

### Dynamic Shapes (`dynamic=True`)
- When batch size or sequence length varies every step (e.g. NLP padding or variable-sized images), setting `dynamic=True` informs Inductor to generate symbolic shapes instead of recompiling for each distinct dimension.
- If dynamic shapes are not specified on variable data, `torch.compile` will recompile repeatedly (compilation thrashing), severely degrading performance.

### Eliminating Graph Breaks
A **graph break** forces PyTorch to fall back to the slow Python eager interpreter in the middle of a compiled model.

#### Common Graph Break Triggers

1. **Dynamic Python control flow on tensor values:**

```python
# ❌ Graph break: Python `if` depends on tensor content
if x.sum() > 0:
    y = x * 2
else:
    y = x * 0.5

# ✅ Pure tensor branch (no graph break)
y = torch.where(x.sum() > 0, x * 2, x * 0.5)
```

2. **Calling unsupported standard library / C-extensions:**

```python
# ❌ Graph break: numpy array conversion or printing
np_arr = x.detach().cpu().numpy()
print(f"Shape: {x.shape}")

# ✅ Keep operations in native PyTorch tensors
```
3. **In-place mutation of Python collections:**
   Modifying `dict` or `list` structures inside `forward` can cause state synchronization breaks.

#### Inspecting and Debugging Graph Breaks
```python
import torch._dynamo as dynamo

# Explain why graph breaks occur
explanation = dynamo.explain(model)(sample_input)
print(explanation)

# Environment variable for deep logging:
# TORCH_LOGS="graph_breaks,recompiles" python train.py
```

---

## 3. Scaled Dot-Product Attention (SDPA)

Modern PyTorch replaces manual attention implementations with `torch.nn.functional.scaled_dot_product_attention`.

### Automatic Kernel Dispatch
SDPA automatically dispatches to the most efficient backend available without external packages:
1. **FlashAttention-2**: For fp16/bf16 on Ampere/Hopper/Blackwell GPUs, head dimension $\le 256$.
2. **Memory-Efficient Attention (Cutlass)**: Broad hardware support including older architectures.
3. **Math backend**: PyTorch eager fallback for unsupported combinations.

```python
import torch
import torch.nn.functional as F

# Q, K, V shapes: [batch_size, num_heads, seq_len, head_dim]
# Ensure tensors are contiguous and in fp16 or bf16 for FlashAttention dispatch
q = q.contiguous()
k = k.contiguous()
v = v.contiguous()

# Efficient causal attention (no materialization of [seq_len, seq_len] mask matrix)
out = F.scaled_dot_product_attention(
    query=q,
    key=k,
    value=v,
    attn_mask=None,
    dropout_p=0.1 if model.training else 0.0,
    is_causal=True
)
```

### Backend Control Context
```python
from torch.nn.attention import SDPBackend, sdpa_kernel

# Force FlashAttention only (fails explicitly if requirements not met)
with sdpa_kernel(SDPBackend.FLASH_ATTENTION):
    out = F.scaled_dot_product_attention(q, k, v, is_causal=True)
```

---

## 4. Modern FlexAttention (`torch.nn.attention.flex_attention`)

Introduced in PyTorch 2.5+, `flex_attention` compiles custom attention variants (ALiBi, sliding window, document masking, soft-capping) into fused Triton or FlashAttention kernels without hand-written CUDA.

```python
import torch
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

# 1. Define custom mask function (mask_mod: 4 args [b, h, q_idx, kv_idx] -> bool)
def sliding_window_mask(b, h, q_idx, kv_idx):
    # Returns True for attended positions, False for masked positions
    return (q_idx - kv_idx <= 512) & (q_idx >= kv_idx)

# 2. Pre-compute block mask to avoid O(N^2) memory footprint
block_mask = create_block_mask(sliding_window_mask, B=None, H=None, Q_LEN=4096, KV_LEN=4096, device="cuda")

# 3. Optional: Define score modifier (score_mod: 5 args [score, b, h, q_idx, kv_idx] -> score)
def soft_cap_score(score, b, h, q_idx, kv_idx):
    cap = 50.0
    return cap * torch.tanh(score / cap)

# 4. Call flex_attention inside compiled module
# Must be wrapped with torch.compile to generate fused kernels
out = flex_attention(q, k, v, score_mod=soft_cap_score, block_mask=block_mask)
```
