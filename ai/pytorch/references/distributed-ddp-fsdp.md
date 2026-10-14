# PyTorch Distributed Training: DDP, FSDP & DeviceMesh Reference

## 1. Multi-GPU Orchestration & Process Groups

PyTorch distributed training uses `torchrun` to spawn worker processes per GPU and orchestrates communication via the NCCL backend on NVIDIA hardware.

### Launching with `torchrun`
```bash
# Launch on single machine with 4 GPUs
torchrun --nproc_per_node=4 train_distributed.py --batch_size 32

# Multi-node launch (e.g., 2 nodes with 8 GPUs each)
# Run on master node (10.0.0.1):
torchrun --nproc_per_node=8 --nnodes=2 --node_rank=0 --master_addr="10.0.0.1" --master_port=29500 train.py
# Run on worker node:
torchrun --nproc_per_node=8 --nnodes=2 --node_rank=1 --master_addr="10.0.0.1" --master_port=29500 train.py
```

### Process Group Initialization Bootstrap

```python
import os
import torch
import torch.distributed as dist

def setup_distributed():
    """Initializes process group and binds each rank to its designated GPU."""
    dist.init_process_group(backend="nccl")
    local_rank = int(os.environ["LOCAL_RANK"])
    global_rank = int(os.environ["RANK"])
    world_size = int(os.environ["WORLD_SIZE"])

    # Mandatory: bind the process to the specific local GPU
    torch.cuda.set_device(local_rank)
    return local_rank, global_rank, world_size

def cleanup_distributed():
    """Synchronizes and closes communication channels."""
    dist.barrier()
    dist.destroy_process_group()
```

---

## 2. Distributed Data Parallel (DDP)

In DDP, each process maintains a complete replica of model parameters and optimizer states. During `loss.backward()`, DDP asynchronously synchronizes gradients across all ranks using NCCL ring all-reduce operations.

### Clean DDP Training Pattern

```python
import torch
import torch.nn as nn
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler

def run_ddp():
    local_rank, global_rank, world_size = setup_distributed()

    # 1. Instantiate model and move to local GPU BEFORE DDP wrapping
    model = MyModel().to(local_rank)

    # 2. Wrap model in DDP
    # find_unused_parameters=False eliminates redundant graph traversal
    model = DDP(model, device_ids=[local_rank], output_device=local_rank, find_unused_parameters=False)

    # 3. Setup DistributedSampler
    dataset = MyDataset()
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=global_rank, shuffle=True)
    dataloader = DataLoader(
        dataset,
        batch_size=32,
        sampler=sampler,
        num_workers=4,
        pin_memory=True,
        persistent_workers=True
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, fused=True)

    for epoch in range(epochs):
        # CRITICAL: set_epoch ensures unique deterministic shuffling across epochs
        sampler.set_epoch(epoch)

        for inputs, targets in dataloader:
            inputs = inputs.to(local_rank, non_blocking=True)
            targets = targets.to(local_rank, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

    cleanup_distributed()
```

### DDP Gradient Accumulation with `no_sync()`
In standard DDP, every `loss.backward()` triggers an all-reduce across GPUs. When accumulating gradients, suppress communication on non-stepping micro-batches:

```python
import contextlib
import torch

accumulation_steps = 4

for i, (inputs, targets) in enumerate(dataloader):
    # Suppress all-reduce on intermediate micro-batches, but ensure sync on last batch
    is_accumulating = (i + 1) % accumulation_steps != 0 and (i + 1) != len(dataloader)

    sync_context = model.no_sync() if is_accumulating else contextlib.nullcontext()

    with sync_context:
        with torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16):
            outputs = model(inputs)
            loss = criterion(outputs, targets) / accumulation_steps
        loss.backward()

    if not is_accumulating:
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
```

---

## 3. Fully Sharded Data Parallel (FSDP & FSDP2)

When models exceed single-GPU VRAM (e.g., 7B–70B parameters), DDP runs out of memory because each GPU must store model weights, gradients, and optimizer states ($16\times$ parameter count in fp32 AdamW). FSDP shards all three components across ranks.

### Classic FSDP Configuration

```python
from functools import partial
import torch
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    ShardingStrategy,
    MixedPrecision,
    CPUOffload
)
from torch.distributed.fsdp.wrap import size_based_auto_wrap_policy

# Mixed precision policy: keep parameters in bfloat16, reduce in float32 for numerical stability
mp_policy = MixedPrecision(
    param_dtype=torch.bfloat16,
    reduce_dtype=torch.float32,
    buffer_dtype=torch.bfloat16
)

# Auto-wrap modules larger than 100M parameters
auto_wrap_policy = partial(size_based_auto_wrap_policy, min_num_params=100_000_000)

fsdp_model = FSDP(
    model.to(local_rank),
    sharding_strategy=ShardingStrategy.FULL_SHARD,  # ZeRO-3 equivalent
    auto_wrap_policy=auto_wrap_policy,
    mixed_precision=mp_policy,
    cpu_offload=CPUOffload(offload_params=False),    # Set True if VRAM is severely limited
    device_id=local_rank
)
```

### Modern FSDP2 (`torch.distributed.fsdp.fully_shard`)
In PyTorch 2.4+, FSDP2 offers per-module sharding composable with `torch.compile` and activation checkpointing via `DTensor`.

```python
import torch
import torch.nn as nn
# Available via torch.distributed.fsdp or torch.distributed._composable.fsdp
try:
    from torch.distributed.fsdp import fully_shard
except ImportError:
    from torch.distributed._composable.fsdp import fully_shard

class TransformerBlock(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.attn = nn.MultiheadAttention(embed_dim=dim, num_heads=8, batch_first=True)
        self.mlp = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Linear(dim * 4, dim)
        )
        self.norm = nn.LayerNorm(dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        attn_out, _ = self.attn(x, x, x)
        x = self.norm(x + attn_out)
        return x + self.mlp(x)

class Transformer(nn.Module):
    def __init__(self, dim: int, num_layers: int):
        super().__init__()
        self.layers = nn.ModuleList([TransformerBlock(dim) for _ in range(num_layers)])
        self.head = nn.Linear(dim, 1000)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x)
        return self.head(x)

# 1. Instantiate on target device
model = Transformer(dim=4096, num_layers=32).to("cuda")

# 2. Shard submodules inside-out (TransformerBlock level)
for layer in model.layers:
    fully_shard(layer)

# 3. Shard top-level model container
fully_shard(model)
```

---

## 4. Multi-Dimensional Parallelism with `DeviceMesh`

When training multi-billion parameter models across hundreds of GPUs, hybrid parallelism is required (e.g., 2-way Tensor Parallelism + 4-way Data Parallelism across 8 GPUs).

```python
import torch
from torch.distributed.device_mesh import init_device_mesh

# Creates a 2D grid: 2 nodes/ranks for DP, 4 ranks for TP
mesh_2d = init_device_mesh("cuda", (2, 4), mesh_dim_names=("dp", "tp"))

dp_mesh = mesh_2d["dp"]
tp_mesh = mesh_2d["tp"]

print(f"Global rank {dist.get_rank()} mesh coordinate: {mesh_2d.get_coordinate()}")
```
