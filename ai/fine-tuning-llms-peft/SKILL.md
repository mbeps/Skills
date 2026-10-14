---
name: fine-tuning-llms-peft
description: Use when fine-tuning open-weights Large Language Models (LLMs) with PEFT, LoRA, or QLoRA, designing modular training packages outside Jupyter notebooks, managing VRAM with k-bit quantization, configuring native chat templates or reasoning formats, or preparing adapters for inference engines like vLLM.
---

# Fine-Tuning LLMs with PEFT

## Overview

Parameter-Efficient Fine-Tuning (PEFT) freezes the base LLM weights and updates only lightweight adapter matrices (~0.1%–1.5% of total parameters). 

**Core principle:** **Zero computational or training logic inside Jupyter notebooks.** All hyperparameters, data loaders, model instantiations, training loops, and evaluation metrics live in reusable Python packages (`<model>_finetuning/`), keeping notebooks as thin, human-readable orchestration dashboards.

---

## When to Use

### Use When:
- Adapting open-weights models (LLaMA 3/3.1, Mistral, Qwen 2.5/3, Gemma 2, DeepSeek) to custom instruction, domain, or reasoning tasks.
- Operating under GPU VRAM limits (e.g., 8B models on 16GB VRAM, or 24B–70B models on 24GB–80GB VRAM via 4-bit QLoRA).
- Building multi-model pipelines requiring logic reuse across different model architectures without copying notebook cells.
- Standardizing prompt handling with Hugging Face native chat templates (`apply_chat_template`) and Chain-of-Thought reasoning traces (`<think>...</think>`).
- Exporting and merging low-rank adapters for high-throughput serving via vLLM or SGLang.

### When NOT to Use:
- Pre-training a foundation model from scratch (use Megatron-LM, Nanotron, or torchtitan).
- The task is solvable with prompt engineering, few-shot in-context learning, or RAG without parameter updates.
- Full-parameter fine-tuning on massive multi-node clusters with unconstrained GPU memory.

---

## Core Pattern: Thin Notebook vs. Bloated Notebook

### ❌ Anti-Pattern: Monolithic Notebook
```python
# Cell 1: 50 lines of imports & raw transformers setup
# Cell 2: BitsAndBytesConfig manually written in cell
# Cell 3: Raw JSON parsing loop with hardcoded prompt formatting
# Cell 4: LoraConfig defined inline
# Cell 5: SFTTrainer initialized with 20 raw arguments
# Cell 6: Long training run; state lost on disconnection; zero reusability
```

### ✅ Modern Standard: Thin Dashboard + Reusable Package
```python
# Notebook: 01_train.ipynb (<8 cells, pure orchestration)
from llama_finetuning import LlamaFineTuningConfig, LlamaFineTuning

config = LlamaFineTuningConfig(
    model_name="meta-llama/Llama-3.1-8B-Instruct",
    train_file="data/train.jsonl",
    batch_size=4,
    gradient_accumulation_steps=8,
    lora_r=16,
    lora_alpha=32
)
config.print_config()

finetuner = LlamaFineTuning(config)
train_data = finetuner.load_jsonl(config.train_file)
finetuner.analyze_data(train_data, name="Train Corpus")

finetuner.run_complete_pipeline(train_data)
```

---

## Architecture: Standard Directory Layout

```text
<project_root>/
├── .env                              # API secrets (HF_TOKEN, WANDB_API_KEY)
├── pyproject.toml / requirements.txt # Explicit dependencies
├── data/
│   ├── train.jsonl                   # Training corpus
│   └── test.jsonl                    # Benchmark/eval corpus
├── <model_prefix>_finetuning/        # Reusable Python package
│   ├── __init__.py                   # Clean re-exports (Config, FineTuner, ThinkingMode)
│   ├── config.py                     # Dataclass config, hardware check & dynamic sizing
│   ├── dataset.py                    # Multi-schema JSONL parser, chat templates, data stats
│   ├── finetuning.py                 # Lifecycle (setup_model, setup_trainer, train, save, eval)
│   └── utils.py                      # Robust answer regex, GPU memory cleanup, VRAM checks
├── 01_train.ipynb                    # Thin training dashboard (or in notebooks/ with sys.path)
├── 02_benchmark.ipynb                # Thin evaluation dashboard
└── results/                          # Checkpoints, adapters, logs (gitignored)
```

---

## Quick Reference

| Component | LoRA (16-bit) | QLoRA (4-bit) | Rationale |
|---|---|---|---|
| **Quantization** | `quantization_config=None` | `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16)` | QLoRA slashes base model VRAM by ~70% with negligible perplexity difference. |
| **Model Prep** | `model.enable_input_require_grads()` | `prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)` | Prepares gradient flow through frozen quantized weights and layer norms. |
| **LoRA Rank ($r$)** | `r = 16` | `r = 16` (or `24` for reasoning tasks) | Balances expressiveness with adapter parameter count. |
| **LoRA Alpha ($\alpha$)** | `alpha = 2 * r` (e.g. `32`) | `alpha = 2 * r` (e.g. `32` or `48`) | Keeps weight scaling factor $\alpha / r \approx 2.0$ for stable gradient steps. |
| **Target Modules** | All linear projections: `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` | Adapting attention + MLP projections substantially outperforms attention-only tuning. |
| **Optimizer** | `optim="adamw_torch"` | `optim="adamw_bnb_8bit"` | 8-bit AdamW cuts optimizer state memory by 75%. |
| **Learning Rate** | `1e-4` to `2e-4` | `5e-5` to `1e-4` | Quantized base weights introduce minor noise; lower LR preserves stability. |
| **Sequence Packing** | `packing=True` in `SFTConfig` | Concatenates short sequences up to `max_length`, preventing 80%+ wasted compute on pad tokens. |
| **Gradient Checkpoint** | `gradient_checkpointing=True` with `gradient_checkpointing_kwargs={"use_reentrant": False}` | Prevents backward pass crashes with PEFT hooks and DDP. |
| **Adapter Merging** | `AutoPeftModelForCausalLM.from_pretrained(adapter_path).merge_and_unload()` | **Never merge directly on 4-bit weights.** Must merge on unquantized 16-bit base. |

---

## Implementation Standard

Keep Python module code modular across `config.py`, `dataset.py`, `finetuning.py`, and `utils.py`. The interface contract connects config, dataset parsing, and execution:

```python
# Minimal execution pattern in <model>_finetuning/finetuning.py
class FineTuner:
    """Core fine-tuning engine adhering to the thin-notebook standard."""
    def __init__(self, config: BaseFineTuningConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.trainer = None
        self._setup_env()

    def setup_model(self) -> None:
        """Loads tokenizer, configures 4-bit QLoRA or 16-bit LoRA, and attaches PEFT."""
        self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"  # Mandatory for training

        quant_config = self._get_quantization_config() if self.config.load_in_4bit else None
        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            quantization_config=quant_config,
            torch_dtype=torch.bfloat16,
            device_map="auto"
        )
        if self.config.load_in_4bit:
            self.model = prepare_model_for_kbit_training(self.model, use_gradient_checkpointing=self.config.gradient_checkpointing)
        elif self.config.gradient_checkpointing:
            self.model.enable_input_require_grads()

        lora_config = LoraConfig(
            r=self.config.lora_r,
            lora_alpha=self.config.lora_alpha,
            target_modules=self.config.target_modules,
            lora_dropout=self.config.lora_dropout,
            bias="none",
            task_type="CAUSAL_LM"
        )
        self.model = get_peft_model(self.model, lora_config)
```

See [notebook-module-conventions.md](references/notebook-module-conventions.md) for the complete multi-file package implementation.

---

## Common Mistakes & Red Flags

| Red Flag | Consequence | Fix |
|---|---|---|
| **Merging LoRA on a 4-bit model** | Degraded weights or `RuntimeError: Quantized models do not support merge_and_unload`. | Use `AutoPeftModelForCausalLM` in unquantized `bfloat16`, then call `merge_and_unload()`. See [merging-and-benchmarking.md](references/merging-and-benchmarking.md). |
| **Calling `prepare_model_for_kbit_training` on unquantized model** | Unnecessary float32 type casting or unexpected gradient behavior. | Only call for `load_in_4bit=True`. For 16-bit LoRA, use `model.enable_input_require_grads()`. |
| **Wrong Tokenizer Padding Side** | Degraded loss if left-padded during training; corrupted output if right-padded during `.generate()`. | Set `tokenizer.padding_side = "right"` for training, `"left"` for generation. |
| **Missing `use_reentrant=False`** | PyTorch crash during backprop when gradient checkpointing is paired with LoRA hooks. | Always pass `gradient_checkpointing_kwargs={"use_reentrant": False}` to `SFTConfig`. |
| **Notebook import failure (`ModuleNotFoundError`)** | Notebook in subdirectory cannot find parent modules. | Place notebook at project root, or include `sys.path.insert(0, os.path.abspath(".."))`, or install package with `pip install -e .`. |
| **Hardcoding `optim="adamw_bnb_8bit"` for 16-bit LoRA** | Crash on systems without compiled bitsandbytes CUDA optimizer. | Default to `adamw_bnb_8bit` when `load_in_4bit=True`; use `adamw_torch` for 16-bit LoRA. |
| **Hardcoded prompt strings instead of `apply_chat_template`** | Special turn tokens (`<\|im_start\|>`, `[INST]`, `<\|start_header_id\|>`) misaligned. | Pass message dictionaries to `tokenizer.apply_chat_template()`. See [chat-templates-and-reasoning.md](references/chat-templates-and-reasoning.md). |

---

## Supporting Reference Documentation

- [Notebook-Module Architecture & Package Conventions](references/notebook-module-conventions.md) — Complete multi-file package layout (`config.py`, `dataset.py`, `finetuning.py`, `utils.py`), multi-model inheritance, and execution flow.
- [QLoRA, Memory Optimization & Hyperparameter Tuning](references/qlora-memory-and-tuning.md) — VRAM formulas, 4-bit NormalFloat setup, sequence packing, and gradient checkpointing.
- [Chat Templates & Reasoning Models](references/chat-templates-and-reasoning.md) — Native `apply_chat_template`, multi-schema dataset support, `<think>` token handling, and padding rules.
- [Adapter Merging, Serving & Benchmarking](references/merging-and-benchmarking.md) — Safe weight merging with `AutoPeftModelForCausalLM`, vLLM offline engine setup, and robust answer extraction.
