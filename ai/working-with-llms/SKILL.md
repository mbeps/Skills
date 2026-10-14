---
name: working-with-llms
description: Use when developing, fine-tuning, benchmarking, or serving open-weights Large Language Models (LLMs), structuring modular Python packages outside Jupyter notebooks, designing cross-model reusable architectures, or configuring PEFT/LoRA and high-throughput vLLM inference.
---

# Working with Large Language Models (LLMs)

## Overview

A unified engineering playbook for fine-tuning, evaluating, benchmarking, and serving open-weights LLMs (LLaMA, Qwen, Mistral, Gemma, DeepSeek).

**Core principle:** **Zero business logic inside Jupyter notebooks.** All hyperparameters, data loaders, chat templates, model initializations, training loops, regex answer extractors, and metrics calculations live in modular Python packages (`<model>_finetuning/`, `<model>_benchmark/`, or a unified `llm_core/`). Jupyter notebooks serve exclusively as thin, human-readable orchestration dashboards (<8 cells).

---

## When to Use

### Use When:
- Building, fine-tuning, or evaluating open-weights models (e.g. LLaMA 3/3.1, Qwen 2.5/3, Mistral, Gemma 2, DeepSeek).
- Structuring LLM projects for cross-model code reuse without duplicating notebook cells.
- Adapting models under GPU VRAM constraints via 4-bit QLoRA (BitsAndBytes) or 16-bit LoRA (PEFT).
- Standardizing prompt formatting using model-native Hugging Face chat templates (`apply_chat_template`).
- Benchmarking models at scale using high-throughput offline batch engines (vLLM with PagedAttention or fallback Transformers).
- Handling reasoning models that produce Chain-of-Thought traces inside `<think>...</think>` tokens.
- Fusing low-rank adapters into unquantized 16-bit base weights for production deployment.

### When NOT to Use:
- Pre-training a foundation model from scratch across multi-node superclusters (use Megatron-LM, Nanotron, or torchtitan).
- Pure zero-shot prompting on proprietary closed-source cloud APIs (OpenAI, Anthropic) without local weights or fine-tuning.
- Building standard RAG vector stores without model tuning or local inference (use `designing-rag-systems`).

---

## Core Pattern: Thin Notebook vs. Monolithic Notebook

### ❌ Anti-Pattern: Monolithic Notebook
```python
# Cell 1: 50 lines of imports, CUDA setups, BitsAndBytes configurations
# Cell 2: Inline JSON parsing loop with hardcoded prompt formatting
# Cell 3: Raw LoraConfig and SFTTrainer setup with 25 manual arguments
# Cell 4: 200-line training/inference loop with messy print statements
# Cell 5: Ad-hoc regex parsing directly embedded in notebook cells
# Consequence: Untestable, zero cross-model reusability, git diff nightmares, state lost on crash
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
    lora_r=24,
    lora_alpha=48
)
config.print_config()

finetuner = LlamaFineTuning(config)
train_data = finetuner.load_jsonl(config.train_file)
finetuner.run_complete_pipeline(train_data)
```

---

## Architecture: Standard Directory Layout

```text
<project_root>/
├── .env                              # API keys (HF_TOKEN, WANDB_API_KEY)
├── .gitignore                        # Git exclusions (.env, results/, checkpoints/, cache/)
├── pyproject.toml / requirements.txt # Explicit dependencies (torch, peft, trl, vllm, transformers)
├── data/
│   ├── train.jsonl                   # Fine-tuning corpus
│   └── test.jsonl                    # Evaluation / benchmark corpus
├── <model_prefix>_finetuning/        # Modular Python package (or unified llm_core/)
│   ├── __init__.py                   # Clean surface exports (Config, Engine, ThinkingMode)
│   ├── config.py                     # Dataclass config, hardware checks, dynamic sizing
│   ├── dataset.py                    # Multi-schema JSONL parser, chat templates, data stats
│   ├── finetuning.py                 # Core lifecycle (setup_model, setup_trainer, train, save)
│   └── utils.py                      # Answer regex, GPU memory cleaner, hardware telemetry
├── 01_train.ipynb                    # Thin training dashboard notebook (at root)
├── 02_benchmark.ipynb                # Thin benchmark dashboard notebook (at root)
└── results/                          # Checkpoints, adapters, CSV metrics, JSON logs (gitignored)
```

> **Subdirectory Note:** If notebooks are placed in a `notebooks/` subfolder, add `sys.path.insert(0, os.path.abspath(".."))` in Cell 1, or install the package in editable mode via `pip install -e .`.

---

## Quick Reference

| Phase | Core Mechanism | Key Parameter / Configuration | Engineering Rule |
|---|---|---|---|
| **Data Formatting** | `tokenizer.apply_chat_template` | `tokenize=False, add_generation_prompt=False` (train) | Never hardcode raw prompt strings; preserve model-native special tokens. |
| **Quantization** | `BitsAndBytesConfig` | `load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16` | Slashes 8B model base VRAM from ~16GB to ~5.5GB with negligible quality loss. |
| **Model Prep** | `prepare_model_for_kbit_training` | `use_gradient_checkpointing=True` | Call ONLY for 4-bit QLoRA. For 16-bit LoRA, use `model.enable_input_require_grads()`. |
| **LoRA Target Modules** | All linear projections | `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` | Adapting attention + MLP projections substantially outperforms attention-only tuning. |
| **LoRA Scaling** | $r$ and $\alpha$ | $r = 16\text{–}32$, $\alpha = 2 \times r$ (e.g. $r=24, \alpha=48$) | Maintains constant scaling factor $\alpha / r = 2.0$ for numerical stability. |
| **Sequence Packing** | `SFTConfig(packing=True)` | Packed sequences up to `max_length` | Eliminates 60–80% wasted compute on padding tokens. |
| **Gradient Checkpointing** | `SFTConfig` | `gradient_checkpointing_kwargs={"use_reentrant": False}` | Mandatory to avoid backprop crashes with LoRA hooks and PyTorch DDP. |
| **Adapter Merging** | `AutoPeftModelForCausalLM` | `.merge_and_unload()` on **16-bit unquantized** base | **Never merge on 4-bit weights.** Produces corrupted weights or runtime errors. |
| **Batch Inference** | `vllm.LLM` | `max_model_len=4096` or `8192`, `gpu_memory_utilization=0.85` | Explicitly cap `max_model_len` to prevent vLLM from allocating massive KV cache. |
| **Transformers Fallback** | `AutoModelForCausalLM` | `tokenizer.padding_side = "left"` | Generation must be left-padded. Training must be right-padded (`"right"`). |
| **Reasoning Models** | Thinking trace extraction | `skip_special_tokens=False`, split on `</think>` | Prevents regex matching on exploratory thoughts inside `<think>...</think>`. |

---

## Implementation Playbook

### 1. Cross-Model Package Abstraction (`config.py`)
Encapsulate all hardware checks, hyperparameters, and reasoning configurations in a reusable dataclass. Support dynamic sizing based on reasoning modes:

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional
import torch

class ThinkingMode(str, Enum):
    DISABLED = "disabled"
    ENABLED = "enabled"
    MIXED = "mixed"

@dataclass
class BaseLLMConfig:
    model_name: str
    output_dir: str = "./results"
    batch_size: int = 4
    gradient_accumulation_steps: int = 8
    learning_rate: float = 5e-5
    num_epochs: int = 1
    max_length: int = 512
    lora_r: int = 24
    lora_alpha: int = 48
    lora_dropout: float = 0.1
    load_in_4bit: bool = True
    gradient_checkpointing: bool = True
    thinking_mode: ThinkingMode = ThinkingMode.DISABLED
    target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
    ])
    min_vram_gb: float = 12.0

    def __post_init__(self):
        # Dynamically adapt resources when reasoning/thinking tokens are active
        if self.thinking_mode in (ThinkingMode.ENABLED, ThinkingMode.MIXED):
            self.batch_size = max(1, self.batch_size // 2)
            self.learning_rate = self.learning_rate * 0.8
            if self.max_length == 512:
                self.max_length = 2048

    @property
    def effective_batch_size(self) -> int:
        return self.batch_size * self.gradient_accumulation_steps

    def validate_environment(self) -> None:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA required for training/inference.")
        vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        if vram < self.min_vram_gb:
            raise RuntimeError(f"VRAM ({vram:.1f}GB) is below required {self.min_vram_gb}GB.")
```

### 2. Fine-Tuning Engine Lifecycle (`finetuning.py`)
Expose a single high-level `run_complete_pipeline()` method to keep the notebook orchestration down to a single call:

```python
class FineTuningEngine:
    def __init__(self, config: BaseLLMConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.trainer = None
        self.config.validate_environment()

    def run_complete_pipeline(self, train_data: list, test_data: list = None) -> Optional[float]:
        try:
            self.setup_model()
            dataset = self.prepare_dataset(train_data)
            self.setup_trainer(dataset)
            self.train()
            self.save_model()
            if test_data:
                return self.evaluate_model(test_data)
            return None
        finally:
            self.cleanup()

    def cleanup(self) -> None:
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
```

### 3. High-Throughput Batch Benchmarking (`benchmark.py`)
Utilize vLLM with PagedAttention for 5–20× faster evaluation than sequential loops, enabling thinking template kwargs for reasoning models:

```python
from vllm import LLM, SamplingParams

class BenchmarkRunner:
    def __init__(self, config):
        self.config = config
        self.llm = LLM(
            model=config.model_name,
            max_model_len=config.max_length,
            gpu_memory_utilization=config.gpu_memory_utilization,
            trust_remote_code=True
        )

    def evaluate_batch(self, batch_conversations: list, is_reasoning: bool = False):
        sampling_params = SamplingParams(
            temperature=0.6 if is_reasoning else 0.0,
            max_tokens=self.config.max_new_tokens,
            skip_special_tokens=not is_reasoning
        )
        # Pass enable_thinking to chat template for Qwen/DeepSeek reasoning models
        chat_kwargs = {"chat_template_kwargs": {"enable_thinking": True}} if is_reasoning else {}
        outputs = self.llm.chat(batch_conversations, sampling_params=sampling_params, **chat_kwargs)
        return [out.outputs[0].text for out in outputs]
```

### 4. Adapter Merging for Serving
Fuse low-rank adapter weights into an unquantized 16-bit base model before serving with vLLM, ensuring tokenizer files are saved alongside weights:

```python
import os
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer
import torch

def export_merged_model(adapter_path: str, output_path: str):
    # 1. Load on 16-bit unquantized base (NEVER 4-bit)
    model = AutoPeftModelForCausalLM.from_pretrained(
        adapter_path,
        torch_dtype=torch.bfloat16,
        device_map="cpu",
        low_cpu_mem_usage=True
    )
    merged = model.merge_and_unload()
    merged.save_pretrained(output_path, safe_serialization=True)

    # 2. Crucial: Save tokenizer to output_path so vLLM/HF can load directly
    try:
        tokenizer = AutoTokenizer.from_pretrained(adapter_path, trust_remote_code=True)
    except Exception:
        # Fallback to base model tokenizer if adapter directory lacks tokenizer files
        import json
        with open(os.path.join(adapter_path, "adapter_config.json")) as f:
            base_model = json.load(f).get("base_model_name_or_path")
        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    tokenizer.save_pretrained(output_path)

---

## Common Mistakes & Red Flags

| Red Flag | Consequence | Fix |
|---|---|---|
| **Merging LoRA on a 4-bit base model** | Severe weight corruption or `RuntimeError: Quantized models do not support merge_and_unload`. | Load base model in unquantized 16-bit `bfloat16`, attach adapter, then call `merge_and_unload()`. |
| **Uncapped `max_model_len` in vLLM** | vLLM reserves 90%+ VRAM for default 32k–128k context KV cache, causing instant OOM. | Explicitly pass `max_model_len=4096` or `8192` to `LLM()`. |
| **Right-padding during batch generation** | Model generates output on top of padding tokens, corrupting positions and hallucinating. | Set `tokenizer.padding_side = "left"` for inference; use `"right"` only for training. |
| **Stripping special tokens on reasoning models** | Removing `<think>` tags causes regex to match exploratory thoughts rather than final answers. | Set `skip_special_tokens=False` and split output on `</think>`. |
| **Embedding logic inside notebook cells** | Code duplication across models, untestable functions, notebook crashes lose state. | Move all logic to `<package_name>/`; notebooks only import and invoke orchestrators. |
| **Calling `prepare_model_for_kbit_training` on 16-bit models** | Unexpected float32 type casting and broken gradient flow. | Call ONLY when `load_in_4bit=True`. For 16-bit LoRA, use `model.enable_input_require_grads()`. |
| **Missing `use_reentrant=False` in gradient checkpointing** | Backward pass crashes when combining PEFT adapter hooks with gradient checkpointing. | Pass `gradient_checkpointing_kwargs={"use_reentrant": False}` to `SFTConfig`. |

---

## Supporting Reference Documentation

- [Notebook-Module Architecture & Package Conventions](references/notebook-module-conventions.md) — Detailed thin-notebook standards, package file layout (`config.py`, `dataset.py`, `finetuning.py`, `utils.py`), multi-model inheritance, and sys.path resolution.
- [Fine-Tuning Recipes: PEFT, LoRA & QLoRA](references/fine-tuning-recipes.md) — BitsAndBytes 4-bit quantization, 16-bit LoRA, TRL sequence packing, native `apply_chat_template`, and Chain-of-Thought handling.
- [Benchmarking, Inference & Serving](references/benchmarking-and-serving.md) — vLLM PagedAttention offline engine, KV cache optimization, Transformers left-padding fallback, reasoning token extractors, and safe adapter weight fusing.
- [Hardware & VRAM Guidelines](references/hardware-and-vram-guidelines.md) — Memory tables across 0.5B to 70B models, effective batch size mathematics, context window scaling, and CUDA cache cleanup.
