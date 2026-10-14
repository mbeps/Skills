# QLoRA, Memory Optimization & Hyperparameter Tuning

## Overview

Parameter-Efficient Fine-Tuning (PEFT) dramatically reduces memory consumption by keeping the pre-trained base model weights frozen and injecting small, low-rank trainable matrices into model layers.

**QLoRA (Quantized Low-Rank Adaptation)** pushes this further: the base model is quantized to **4-bit NormalFloat (NF4)** with double quantization, reducing base weight memory by ~70–75%.
- A 7B/8B model drops from ~16 GB (16-bit) to ~5–6 GB of VRAM.
- A 24B–32B model drops from ~64 GB to ~18–20 GB of VRAM, running comfortably on a single consumer or cloud GPU (e.g., RTX 3090/4090, A100, H100).

---

## 1. VRAM Budgeting & Sizing Formula

When calculating GPU memory requirements for fine-tuning:

$$\text{Total VRAM} \approx \text{Model Weights} + \text{Trainable LoRA Parameters} + \text{Optimizer States} + \text{Activation Memory} + \text{Overhead}$$

| Component | Standard 16-bit Fine-Tuning | 4-bit QLoRA |
|---|---|---|
| **Base Model Weights** | 2 bytes / parameter (16 GB for 8B) | 0.55 bytes / parameter (~5 GB for 8B) |
| **Trainable Parameters** | 100% of weights | 0.1% – 1.5% of weights (~20–80 MB) |
| **Optimizer States (AdamW)** | 8 bytes / parameter (64 GB for 8B) | Only for trainable parameters (~150 MB) |
| **8-bit AdamW Optimizer** | 4 bytes / parameter | Further halves adapter optimizer memory |
| **Gradients** | 2 bytes / parameter (16 GB) | Only for trainable parameters (<100 MB) |
| **Activations** | Substantial without checkpointing | Controlled via `gradient_checkpointing=True` |

**Rule of Thumb Hardware Minimums:**
- **7B – 8B Models**: Min 12–16 GB VRAM (RTX 4080/4090, T4, A10G, V100).
- **14B – 24B Models**: Min 24 GB VRAM (RTX 3090/4090, A10G, L4, A5000).
- **70B Models**: Min 48–80 GB VRAM (A100 80GB or 2x RTX 3090 with FSDP/Accelerate).

---

## 2. Quantization Configuration: QLoRA vs. Standard LoRA

### 1. QLoRA (4-bit) Configuration
Always use **NormalFloat4 (NF4)** with **double quantization** and **bfloat16 compute dtype**:

```python
import torch
from transformers import BitsAndBytesConfig, AutoModelForCausalLM
from peft import prepare_model_for_kbit_training, get_peft_model, LoraConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",               # Information-theoretically optimal for normal weights
    bnb_4bit_use_double_quant=True,          # Quantizes quantization constants, saving ~0.4 bits/param
    bnb_4bit_compute_dtype=torch.bfloat16    # Unquantized on-the-fly during forward/backward passes
)

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True
)

# Mandatory for k-bit models: casts norms to fp32 and prepares input gradients
model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
```

> **Warning on Compute Dtype:** 
> - On Ampere or newer GPUs (RTX 30xx/40xx, A100, H100), always use `torch.bfloat16` to prevent underflow/overflow during gradient accumulation.
> - On older architectures (T4, V100), use `torch.float16`.

### 2. Standard LoRA (16-bit Unquantized) Configuration
When GPU memory allows (e.g. 8B on 24GB VRAM) and maximum numeric precision is desired:

```python
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=None,                 # No quantization
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True
)

# Enable gradients for inputs when gradient checkpointing is active
model.enable_input_require_grads()
```

> ⚠️ **Common Trap:** Do **NOT** call `prepare_model_for_kbit_training` on an unquantized 16-bit model. It casts all LayerNorm and embedding layers to float32 unnecessarily and is intended strictly for integer-quantized weights.

---

## 3. LoRA Configuration & Target Modules

### Target All Linear Projections
Earlier implementations only adapted attention query and value matrices (`q_proj`, `v_proj`). Extensive empirical studies show that **adapting all linear layers yields substantially higher task accuracy and cross-domain generalization**:

| Model Family | Target Modules List |
|---|---|
| **LLaMA (3, 3.1, 3.3)** | `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` |
| **Mistral / Magistral** | `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` |
| **Qwen (2, 2.5, 3)** | `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` |
| **Gemma 2** | `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` |
| **Phi (3, 3.5, 4)** | `["o_proj", "qkv_proj", "gate_up_proj", "down_proj"]` |

### Recommended `LoraConfig`
```python
from peft import LoraConfig, TaskType

lora_config = LoraConfig(
    r=16,                                    # Rank: 16 (or 24 for reasoning tasks)
    lora_alpha=32,                           # Scaling alpha: typically 2x r
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj", 
        "gate_proj", "up_proj", "down_proj"
    ],
    lora_dropout=0.05,                       # Dropout rate for regularization (0.05 to 0.1)
    bias="none",                             # Always "none" for causal LM
    task_type=TaskType.CAUSAL_LM
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

---

## 4. Hyperparameter Guide: LoRA vs. QLoRA

| Hyperparameter | Standard LoRA (16-bit) | QLoRA (4-bit) | Rationale |
|---|---|---|---|
| **Learning Rate** | `1e-4` to `3e-4` | `5e-5` to `2e-4` | Quantized base weights introduce minor numeric noise; slightly lower LR stabilizes optimization. |
| **LoRA Rank ($r$)** | 8 – 16 | 16 – 32 | With all linear modules targeted, $r=16$ provides ample expressive capacity. |
| **LoRA Alpha ($\alpha$)** | $2 \times r$ (e.g. 32) | $2 \times r$ (e.g. 32 or 48) | The scaling factor is $\alpha / r$. Keeping the ratio $\approx 2.0$ stabilizes gradient scales. |
| **LR Scheduler** | `cosine` | `cosine` | Smooth decay prevents abrupt disruptions to low-rank manifolds. |
| **Warmup Ratio** | 0.05 – 0.10 | 0.05 – 0.10 | Prevents catastrophic early gradient updates to freshly initialized adapter matrices. |
| **Weight Decay** | 0.01 | 0.01 | Regularizes adapter weights. |
| **Optimizer** | `adamw_torch` | `adamw_bnb_8bit` | 8-bit AdamW stores optimizer momentum/variance in 8-bit, cutting state memory by 75%. |

---

## 5. Throughput & Activation Optimizations

### 1. Sequence Packing (`packing=True`)
In standard fine-tuning without packing, short examples are padded with `pad_token` up to `max_length`. If your average sample is 200 tokens but `max_length=1024`, **over 80% of computation is wasted processing padding tokens**.

With `packing=True` in `SFTConfig`:
- Short sequences are concatenated end-to-end, separated by `eos_token`.
- Self-attention masking ensures tokens in document A cannot attend to document B.
- Training throughput improves by **2x to 5x**.

```python
sft_config = SFTConfig(
    output_dir="./results",
    max_length=1024,
    packing=True,                   # Enables sample concatenation
    dataset_text_field="text",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
)
```

> **Packing vs. Prompt Masking Trade-Off:**
> - When `packing=True`, the model trains on the entire sequence (both prompt and response).
> - If you strictly require training loss to be computed *only* on assistant responses (masking prompt tokens via `DataCollatorForCompletionOnlyLM`), you must set `packing=False` and use right-padding (`tokenizer.padding_side = "right"`).

### 2. Gradient Checkpointing
Gradient checkpointing trades computation for memory by discarding intermediate activations during the forward pass and recomputing them during backprop. This reduces activation memory by up to 70%.

**Mandatory PyTorch / Transformers setting:**
```python
sft_config = SFTConfig(
    ...,
    gradient_checkpointing=True,
    gradient_checkpointing_kwargs={"use_reentrant": False}, # Mandatory for PyTorch DDP and PEFT compatibility
)
```
> **Gotcha:** If `use_reentrant` is omitted or set to `True`, gradients may fail to backpropagate through LoRA adapter hooks or crash with `RuntimeError: Trying to backward through the graph a second time`.

### 3. FlashAttention-2
If supported by your GPU (Ampere, Ada Lovelace, Hopper), enable FlashAttention-2:
```python
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    attn_implementation="flash_attention_2",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)
```

### 4. Mitigating VRAM Spikes
During long training runs with large models (e.g. 24B or 70B), memory fragmentation can trigger mid-training OOMs. Add `torch_empty_cache_steps` to `SFTConfig`:
```python
sft_config = SFTConfig(
    ...,
    torch_empty_cache_steps=4  # Periodically flushes unused CUDA memory
)
```
