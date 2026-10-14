# PyTorch Autograd Engine & `nn.Module` Architecture Reference

## 1. Autograd Engine & Custom `torch.autograd.Function`

PyTorch autograd constructs a directed acyclic graph (DAG) of `Node` objects during the forward pass. Every tensor created by an operation possesses a `.grad_fn` pointing to the backward operator.

### Custom Autograd Function Implementation

When implementing non-standard forward math or custom gradient formulas, subclass `torch.autograd.Function`.

```python
import torch

class GradientReversalFunction(torch.autograd.Function):
    """Reverses and scales gradients during backward pass (useful in domain adaptation)."""

    @staticmethod
    def forward(ctx, x: torch.Tensor, alpha: float) -> torch.Tensor:
        # ctx is a context object used to stash information for backward computation
        ctx.alpha = alpha
        # Return a view or new tensor; do not modify in-place
        return x.view_as(x)

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor) -> tuple[torch.Tensor, None]:
        # backward MUST return as many gradients as there were inputs to forward()
        # For non-tensor arguments (like alpha), return None
        grad_input = grad_output.neg() * ctx.alpha
        return grad_input, None

# Convenience wrapper
def grad_reverse(x: torch.Tensor, alpha: float = 1.0) -> torch.Tensor:
    return GradientReversalFunction.apply(x, alpha)
```

### Autograd Context Rules
- Use `ctx.save_for_backward(*tensors)` only for tensors needed in backward computation. Tensors saved with `save_for_backward` are monitored by version counters to detect unlawful in-place mutation.
- Non-tensor metadata (ints, floats, strings) should be saved directly as attributes on `ctx` (e.g. `ctx.alpha = alpha`).
- Never perform in-place mutation on tensors returned from forward or saved in `ctx`.

---

## 2. `nn.Module` Architecture & Buffer Management

### Parameters vs Buffers vs Attributes

| Mechanism | Registered in `model.parameters()`? | Saved in `state_dict()`? | Moved with `model.to(device)`? | Use Case |
|---|---|---|---|---|
| `nn.Parameter` | **Yes** | **Yes** | **Yes** | Trainable weights & biases |
| Persistent Buffer | **No** | **Yes** | **Yes** | Running statistics (BatchNorm `running_mean`, EMA weights) |
| Non-Persistent Buffer | **No** | **No** | **Yes** | Precomputed static caches (RoPE frequencies, causal masks) |
| Standard Python Attribute | **No** | **No** | **No** | Hyperparameters, shape tuples, config objects |

### Buffer Registration Pattern

```python
import torch
import torch.nn as nn

class RotaryEmbedding(nn.Module):
    def __init__(self, dim: int, max_seq_len: int = 4096):
        super().__init__()
        self.dim = dim

        # Trainable parameter
        self.scale = nn.Parameter(torch.ones(1))

        # Persistent buffer: saved in state_dict, moves with .to(device)
        self.register_buffer("step_counter", torch.zeros(1, dtype=torch.long), persistent=True)

        # Non-persistent buffer: moves with .to(device), but OMITTED from checkpoint files
        inv_freq = 1.0 / (10000 ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq, persistent=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        self.step_counter += 1
        # self.inv_freq is guaranteed on the same device as x
        return x * self.scale
```

### Container Modules: Avoid Bare Python Lists
Standard Python lists (`[layer1, layer2]`) and dictionaries do **not** register submodules or parameters.

```python
# ❌ BUG: Submodules invisible to PyTorch. Parameters will not update or move to GPU!
class BadModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = [nn.Linear(64, 64) for _ in range(4)]

# ✅ CORRECT: nn.ModuleList properly registers submodules and parameter trees
class GoodModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([nn.Linear(64, 64) for _ in range(4)])
```

---

## 3. Hooks: Diagnostics & Feature Extraction

Hooks allow non-invasive observation or alteration of tensor activations and gradients during execution.

```python
import torch
import torch.nn as nn

class FeatureExtractor:
    def __init__(self, target_module: nn.Module):
        self.features = None
        # Register forward hook
        self.hook_handle = target_module.register_forward_hook(self._hook_fn)

    def _hook_fn(self, module, inputs, output):
        # Detach to avoid holding computation graph in memory
        self.features = output.detach()

    def remove(self):
        self.hook_handle.remove()

# Usage
model = nn.Sequential(nn.Linear(10, 20), nn.ReLU(), nn.Linear(20, 5))
extractor = FeatureExtractor(model[1])

x = torch.randn(2, 10)
_ = model(x)
print("Extracted intermediate activation shape:", extractor.features.shape)
extractor.remove()  # Clean up hook to prevent memory leaks
```

---

## 4. Checkpoint Serialization & Security Hygiene

### Safe Checkpoint Loading (`weights_only=True`)
PyTorch uses Python's `pickle` library for checkpoint loading. Untrusted checkpoint files can execute arbitrary system commands during unpickling. Always set `weights_only=True`.

```python
# Modern safe loading (PyTorch 2.4+ default)
state_dict = torch.load("model_checkpoint.pt", map_location="cpu", weights_only=True)
model.load_state_dict(state_dict, strict=True)
```

### Weight Initialization Recipe
```python
def init_weights(module: nn.Module):
    """Recursive weight initializer for linear and normalization layers."""
    if isinstance(module, nn.Linear):
        nn.init.kaiming_normal_(module.weight, nonlinearity="relu")
        if module.bias is not None:
            nn.init.zeros_(module.bias)
    elif isinstance(module, (nn.BatchNorm2d, nn.LayerNorm)):
        nn.init.ones_(module.weight)
        nn.init.zeros_(module.bias)

model.apply(init_weights)
```

---

## 5. Meta Device & Deferred Initialization (`assign=True`)

When loading large architectures (e.g. LLMs, vision transformers, or PEFT base models), initializing random weights on CPU or GPU wastes gigabytes of host/device memory and causes OOM crashes before checkpoints are loaded.

PyTorch provides the `meta` device where tensors have shapes and dtypes but occupy zero physical storage.

```python
import torch
import torch.nn as nn

# 1. Instantiate architecture on 'meta' device: 0 bytes of memory consumed
with torch.device("meta"):
    model = nn.Sequential(
        nn.Linear(4096, 16384),
        nn.GELU(),
        nn.Linear(16384, 4096)
    )

# 2. Load checkpoint state dict safely
state_dict = torch.load("checkpoint.pt", map_location="cpu", weights_only=True)

# 3. Materialize and swap parameters directly using assign=True (PyTorch 2.1+)
# assign=True swaps meta parameter pointers with loaded tensors without double allocation
model.load_state_dict(state_dict, assign=True)

# 4. If training without pre-trained checkpoint, materialize uninitialized storage directly:
# model.to_empty(device="cuda")
# model.apply(init_weights)
```
