# Notebook-Module Architecture & Package Conventions

## 1. Overview: The Thin-Notebook Principle

Jupyter notebooks are interactive dashboards, not application codebases. When training loops, data pipelines, regexes, and model loaders are embedded directly inside notebook cells, critical engineering problems arise:
- **No reusability:** Logic written in a LLaMA notebook cannot be reused for Qwen or Mistral without copying and pasting cells.
- **Untestable & brittle:** Functions inside cells cannot be unit-tested with standard CI/CD frameworks like `pytest`.
- **Git diff pollution:** Cell outputs, execution counts, and metadata obscure actual code changes.
- **Fragile state:** Out-of-order cell execution leads to non-reproducible runs and hard-to-debug memory leaks.

### The Rule
> **Zero business logic inside Jupyter notebooks.**
> All hyperparameter schemas, dataset parsers, model lifecycle handlers, training loops, answer extraction regexes, and metric calculations MUST live in modular Python packages (`<package_name>/`).
> Notebooks serve solely as thin orchestration dashboards (<7–10 cells) that import, configure, and invoke modular functions and classes.

---

## 2. Directory Layouts

### Option A: Model-Dedicated Package (Standard)
Best when tuning or benchmarking a specific family (e.g. `llama_finetuning/`, `qwen3_benchmark/`):

```text
<project_root>/
├── .env                              # API keys (HF_TOKEN, WANDB_API_KEY)
├── .gitignore                        # Git exclusions (.env, results/, checkpoints/, cache/)
├── pyproject.toml / requirements.txt # Explicit dependencies
├── data/
│   ├── train.jsonl                   # Training dataset
│   └── test.jsonl                    # Benchmark dataset
├── <model_prefix>_finetuning/        # Modular Python package
│   ├── __init__.py                   # Clean exports (Config, FineTuner, ThinkingMode)
│   ├── config.py                     # Configuration dataclass & hardware checks
│   ├── dataset.py                    # Dataset parsing, chat template formatting, stats
│   ├── finetuning.py                 # Core model & trainer lifecycle
│   └── utils.py                      # Memory cleanup, GPU checks, helper utilities
├── 01_train.ipynb                    # Thin training orchestration dashboard
├── 02_benchmark.ipynb                # Thin benchmark orchestration dashboard
└── results/                          # Output artifacts, LoRA checkpoints, CSV metrics
```

### Option B: Unified Multi-Model Package (Cross-Model Reuse)
Best for repositories that fine-tune or benchmark multiple model families (LLaMA, Qwen, Mistral, Gemma) from a single shared codebase:

```text
<project_root>/
├── .env
├── pyproject.toml
├── data/
├── llm_core/                         # Shared modular core package
│   ├── __init__.py
│   ├── base_config.py                # Abstract BaseConfig with shared parameters
│   ├── dataset.py                    # Multi-schema JSONL parser & chat template formatter
│   ├── finetuning.py                 # Universal PEFT / SFTTrainer lifecycle
│   ├── benchmark.py                  # Universal vLLM / Transformers benchmark runner
│   ├── utils.py                      # Memory cleanup, answer extraction regexes
│   └── models/                       # Model-specific specializations
│       ├── __init__.py
│       ├── llama.py                  # LLaMA chat templates & target modules
│       ├── qwen.py                   # Qwen thinking tokens & prompt formatting
│       └── mistral.py                # Mistral instruction token handling
├── train_llama.ipynb                 # Thin dashboard for LLaMA
├── train_qwen.ipynb                  # Thin dashboard for Qwen
└── results/
```

---

## 3. Thin Notebook Dashboards (<8 Cells)

### A. Thin Fine-Tuning Dashboard (`train.ipynb`)
```python
# Cell 1: Clean imports
from llama_finetuning import LlamaFineTuningConfig, LlamaFineTuning

# Cell 2: Hyperparameter configuration
config = LlamaFineTuningConfig(
    model_name="meta-llama/Llama-3.1-8B-Instruct",
    train_file="data/train.jsonl",
    output_dir="./results/llama_run1",
    batch_size=4,
    gradient_accumulation_steps=8,
    learning_rate=5e-5,
    num_epochs=1,
    lora_r=24,
    lora_alpha=48,
    max_length=512,
    load_in_4bit=True,
    gradient_checkpointing=True
)

# Cell 3: Validate and display configuration
config.print_config()

# Cell 4: Initialize engine (loads env, verifies GPU & tokens)
finetuner = LlamaFineTuning(config)

# Cell 5: Load and inspect dataset
train_data = finetuner.load_jsonl(config.train_file)
finetuner.analyze_data(train_data, name="Italian Training Corpus")

# Cell 6: Execute full training pipeline
finetuner.run_complete_pipeline(train_data)

# Cell 7: Summary & verification
print(f"Training completed successfully. Checkpoints saved to {config.output_dir}")
```

### B. Thin Benchmark Dashboard (`benchmark.ipynb`)
```python
# Cell 1: Clean imports
from qwen3_benchmark import QwenBenchmarkConfig, QwenBenchmark

# Cell 2: Benchmark configuration
config = QwenBenchmarkConfig(
    model_name="Qwen/Qwen3-8B",
    test_file="data/test.jsonl",
    batch_size=32,
    max_length=8192,
    max_new_tokens=256,
    gpu_memory_utilization=0.85,
    output_prefix="qwen3_8b_eval"
)

# Cell 3: Initialize benchmark engine
benchmark = QwenBenchmark(config)

# Cell 4: Run full benchmark pipeline (loads, verifies single item, runs batch, saves)
results, accuracy, category_stats = benchmark.run_benchmark()

# Cell 5: Display per-category performance breakdown
benchmark.analyse_results_by_category(category_stats)

# Cell 6: Inspect sample predictions
benchmark.show_sample_predictions(results, num_samples=5)
```

---

## 4. Package Module Architecture

A production LLM package separates concerns cleanly across four standard modules:

### 1. `config.py` — Dataclass & Validation
- Encapsulates all hyperparameters (model path, batch sizes, LoRA rank/alpha, max sequence length, learning rate).
- Validates environment requirements (CUDA availability, minimum VRAM check, HF token presence).
- Computes derived properties (e.g., `effective_batch_size = batch_size * gradient_accumulation_steps`).

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
class BaseConfig:
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
        "q_proj", "k_proj", "v_proj", "o_proj", 
        "gate_proj", "up_proj", "down_proj"
    ])
    min_vram_gb: float = 12.0

    def __post_init__(self):
        # Dynamically scale down batch size and increase sequence length for reasoning traces
        if self.thinking_mode in (ThinkingMode.ENABLED, ThinkingMode.MIXED):
            self.batch_size = max(1, self.batch_size // 2)
            self.learning_rate = self.learning_rate * 0.8
            if self.max_length == 512:
                self.max_length = 2048

    @property
    def effective_batch_size(self) -> int:
        return self.batch_size * self.gradient_accumulation_steps

    def validate_hardware(self) -> None:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is not available. GPU is required for LLM training/benchmarking.")
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        if vram_gb < self.min_vram_gb:
            raise RuntimeError(f"Available VRAM ({vram_gb:.1f} GB) is below required minimum ({self.min_vram_gb} GB).")
        print(f"✅ Hardware validated: {torch.cuda.get_device_name(0)} ({vram_gb:.1f} GB VRAM)")

    def print_config(self) -> None:
        print("================ CONFIGURATION ================")
        print(f"Model: {self.model_name}")
        print(f"Thinking Mode: {self.thinking_mode.value}")
        print(f"Effective Batch Size: {self.effective_batch_size} (Batch: {self.batch_size}, GradAcc: {self.gradient_accumulation_steps})")
        print(f"Learning Rate: {self.learning_rate} | Epochs: {self.num_epochs} | Max Length: {self.max_length}")
        print(f"LoRA: r={self.lora_r}, alpha={self.lora_alpha}, dropout={self.lora_dropout}")
        print(f"Quantization: 4-bit QLoRA={self.load_in_4bit} | Gradient Checkpointing={self.gradient_checkpointing}")
        print("===============================================")
```

### 2. `dataset.py` — Multi-Schema Parsing & Chat Templates
- Parses raw datasets (`.jsonl`, `.json`, Hugging Face datasets).
- Applies native chat templates (`tokenizer.apply_chat_template`) rather than hardcoded prompt strings.
- Manages stratified sampling and category balance.

### 3. `finetuning.py` / `benchmark.py` — Engine Lifecycle
- Coordinates model initialization, adapter injection, trainer configuration, execution, and artifact saving.
- Implements a single public entry point: `run_complete_pipeline()`.
- Guarantees teardown and resource cleanup in `finally:` blocks.

### 4. `utils.py` — Telemetry, Sampling & Memory
- Multi-stage regex parsers for extracting multiple-choice letters or numerical answers.
- Reasoning model token handling (splitting on `</think>`).
- Stratified sampling with remainder distribution across categories.
- VRAM cache flush:

```python
import gc
import random
from collections import defaultdict
from typing import Any, Dict, List
import torch

def cleanup_cuda():
    """Forces garbage collection and clears CUDA memory cache."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()

def create_uniform_subset(data: List[Dict[str, Any]], n_samples: int, category_key: str = "category") -> List[Dict[str, Any]]:
    """Creates a balanced evaluation subset with uniform distribution and remainder distribution."""
    if not data or category_key not in data[0] or len(data) <= n_samples:
        return data[:n_samples]

    category_groups = defaultdict(list)
    for item in data:
        category_groups[item[category_key]].append(item)

    categories = list(category_groups.keys())
    base_per_cat = n_samples // len(categories)
    remainder = n_samples % len(categories)

    selected = []
    for i, cat in enumerate(categories):
        take = base_per_cat + (1 if i < remainder else 0)
        selected.extend(category_groups[cat][:take])
    return selected
```

---

## 5. Cross-Model Reuse Patterns

When developing across multiple model families (e.g. LLaMA 3, Qwen 2.5/3, Mistral), all heavy training, k-bit preparation, and checkpointing logic lives in an abstract base class. Model-specific packages subclass it and override only prompt formatting:

```python
# Shared base in llm_core/base_finetuning.py
import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer

class BaseFineTuner:
    """Universal fine-tuning engine reusable across all decoder-only LLMs."""
    def __init__(self, config: BaseConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.trainer = None

    def setup_model(self):
        self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"

        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16
        ) if self.config.load_in_4bit else None

        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            quantization_config=quant_config,
            device_map="auto",
            torch_dtype=torch.bfloat16,
            trust_remote_code=True
        )

        if self.config.load_in_4bit:
            self.model = prepare_model_for_kbit_training(self.model, use_gradient_checkpointing=self.config.gradient_checkpointing)
        elif self.config.gradient_checkpointing:
            self.model.enable_input_require_grads()

        peft_config = LoraConfig(
            r=self.config.lora_r,
            lora_alpha=self.config.lora_alpha,
            lora_dropout=self.config.lora_dropout,
            target_modules=self.config.target_modules,
            bias="none",
            task_type="CAUSAL_LM"
        )
        self.model = get_peft_model(self.model, peft_config)

    def format_prompt(self, example: dict) -> str:
        """Subclasses override this method to provide model-specific chat templates."""
        raise NotImplementedError

    def prepare_dataset(self, data: list) -> Dataset:
        formatted = [{"text": self.format_prompt(ex)} for ex in data]
        return Dataset.from_list(formatted)

    def run_complete_pipeline(self, train_data: list, test_data: list = None):
        try:
            self.setup_model()
            dataset = self.prepare_dataset(train_data)
            # Setup trainer, train, and save
            self.setup_trainer(dataset)
            self.train()
            self.save_model()
        finally:
            cleanup_cuda()

# Model-specific specialization: overrides ONLY format_prompt
class QwenFineTuner(BaseFineTuner):
    def format_prompt(self, example: dict) -> str:
        messages = [{"role": "user", "content": example["question"]}]
        if "answer" in example:
            content = f"<think>\n{example['thinking']}\n</think>\n{example['answer']}" if example.get("thinking") else example["answer"]
            messages.append({"role": "assistant", "content": content})
        return self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)

class LlamaFineTuner(BaseFineTuner):
    def format_prompt(self, example: dict) -> str:
        messages = [{"role": "user", "content": example["question"]}]
        if "answer" in example:
            messages.append({"role": "assistant", "content": example["answer"]})
        return self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
```

---

## 6. Resolving Imports in Subdirectories

If notebooks are placed in a `notebooks/` subfolder rather than the project root:

```python
# Cell 1 of notebooks/01_train.ipynb
import os
import sys

# Add repository root to python search path
repo_root = os.path.abspath(os.path.join(os.getcwd(), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

# Now standard imports succeed without installation
from llama_finetuning import LlamaFineTuningConfig, LlamaFineTuning
```

Alternatively, install the package in editable mode from the repository root:
```bash
pip install -e .
```
