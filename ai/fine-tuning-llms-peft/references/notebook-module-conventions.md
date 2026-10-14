# Notebook-Module Architecture & Package Conventions

## Overview

A core engineering standard for production-grade LLM fine-tuning is **zero business logic in Jupyter notebooks**. 

Notebooks are stateful, ephemeral execution environments that complicate unit-testing, code reviews, git diffs, and linting. Under this architecture, notebooks serve exclusively as **thin orchestration dashboards**, while all hyperparameter definitions, data loading, chat template formatting, model instantiation, training loops, and metric evaluations are encapsulated in modular, testable Python packages.

---

## 1. Directory Structure Standard

Every fine-tuning or benchmarking repository must follow this clean directory layout:

```text
<project_root>/
├── .env                              # Private environment variables (e.g. HF_TOKEN, WANDB_API_KEY)
├── .gitignore                        # Git ignore (.env, checkpoints, venv, cache, __pycache__)
├── pyproject.toml / requirements.txt # Explicit dependencies (peft, transformers, trl, bitsandbytes, torch)
├── data/
│   ├── train.jsonl                   # Primary training corpus
│   └── test.jsonl                    # Validation or benchmark dataset
├── <model_prefix>_finetuning/        # Dedicated or unified Python package
│   ├── __init__.py                   # Clean surface API exposing Config and Engine classes
│   ├── config.py                     # Hyperparameter schema (dataclass), validation, hardware check
│   ├── dataset.py                    # Multi-schema JSONL loading, chat template formatting, data stats
│   ├── finetuning.py                 # Core fine-tuning lifecycle (setup_model, setup_trainer, train, save, eval)
│   └── utils.py                      # Robust answer extraction, GPU cache cleanup, hardware validation
├── 01_train_<model>.ipynb            # Thin training dashboard notebook (at root)
├── 02_benchmark_<model>.ipynb        # Thin evaluation dashboard notebook (at root)
└── results/                          # Checkpoints, adapters, and logs (gitignored)
```

> **Note on Notebook Location & Imports:**
> If you place notebooks in a `notebooks/` subdirectory instead of project root, Python's module search path will not see the project root by default. Always include standard path resolution in Cell 1:

```python
import sys, os
sys.path.insert(0, os.path.abspath(".."))
```

> Or install your package in editable mode from project root: `pip install -e .`. Placing notebooks at project root avoids this entirely.

---

## 2. Complete Production-Grade Package Implementation

Here is the complete, modular reference implementation for `<model_prefix>_finetuning/`.

### 1. `config.py`: Centralized Configuration & Sizing
```python
import os
import torch
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

class ThinkingMode(str, Enum):
    """Controls Chain-of-Thought reasoning traces in datasets."""
    DISABLED = "disabled"  # Direct answer only (no thinking tokens)
    ENABLED = "enabled"    # All examples must include <think> reasoning tokens
    MIXED = "mixed"        # Use thinking tokens when available in the example

@dataclass
class BaseFineTuningConfig:
    """Base configuration shared across all LLM fine-tuning pipelines."""
    model_name: str
    train_file: str = "data/train.jsonl"
    output_dir: str = "./results"
    
    # Batch & Compute
    batch_size: int = 4
    gradient_accumulation_steps: int = 8
    learning_rate: float = 5e-5
    num_epochs: int = 1
    max_length: int = 512
    lr_scheduler_type: str = "cosine"
    warmup_ratio: float = 0.1
    gradient_checkpointing: bool = True
    
    # LoRA Parameters
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj", 
        "gate_proj", "up_proj", "down_proj"
    ])
    
    # Quantization (QLoRA vs. standard 16-bit LoRA)
    load_in_4bit: bool = True
    bnb_4bit_quant_type: str = "nf4"
    bnb_4bit_compute_dtype: str = "bfloat16"
    bnb_4bit_use_double_quant: bool = True
    optim: Optional[str] = None  # Auto-selects adamw_bnb_8bit or adamw_torch
    
    # Reasoning & Hardware
    thinking_mode: ThinkingMode = ThinkingMode.DISABLED
    min_vram_gb: float = 12.0
    random_seed: int = 42
    dataloader_num_workers: int = 4
    packing: bool = True

    def __post_init__(self):
        # Auto-adjust batch size and sequence length for reasoning traces
        if self.thinking_mode in [ThinkingMode.ENABLED, ThinkingMode.MIXED]:
            if self.max_length == 512:
                self.max_length = 2048
            self.batch_size = max(1, self.batch_size // 2)
            self.learning_rate = self.learning_rate * 0.8

        # Auto-select optimizer based on quantization mode
        if self.optim is None:
            self.optim = "adamw_bnb_8bit" if self.load_in_4bit else "adamw_torch"

    @property
    def effective_batch_size(self) -> int:
        return self.batch_size * self.gradient_accumulation_steps

    def print_config(self) -> None:
        print("=" * 60)
        print("🔧 FINE-TUNING CONFIGURATION")
        print("=" * 60)
        print(f"Model ID:              {self.model_name}")
        print(f"Quantization:          {'4-bit QLoRA (NF4)' if self.load_in_4bit else '16-bit LoRA'}")
        print(f"Optimizer:             {self.optim}")
        print(f"Effective Batch Size:  {self.effective_batch_size} (Batch: {self.batch_size} x Acc: {self.gradient_accumulation_steps})")
        print(f"Learning Rate:         {self.learning_rate} ({self.lr_scheduler_type})")
        print(f"Epochs:                {self.num_epochs}")
        print(f"Max Sequence Length:   {self.max_length}")
        print(f"Thinking Mode:         {self.thinking_mode.value}")
        print(f"LoRA:                  r={self.lora_r}, alpha={self.lora_alpha}, dropout={self.lora_dropout}")
        print(f"Target Modules:        {', '.join(self.target_modules)}")
        print("=" * 60)

# Model subclasses override only architecture-specific defaults
@dataclass
class QwenFineTuningConfig(BaseFineTuningConfig):
    """Qwen-specific overrides."""
    learning_rate: float = 4e-5
    warmup_ratio: float = 0.1

@dataclass
class LlamaFineTuningConfig(BaseFineTuningConfig):
    """Llama-specific overrides."""
    learning_rate: float = 5e-5

@dataclass
class MagistralFineTuningConfig(BaseFineTuningConfig):
    """Mistral/Magistral 24B overrides."""
    batch_size: int = 2
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
```

### 2. `dataset.py`: Multi-Schema Parsing & Chat Templates
```python
import json
from collections import defaultdict
from typing import List, Dict, Any, Optional
from datasets import Dataset
from tqdm import tqdm
from .config import ThinkingMode

class DatasetLoader:
    """Handles multi-format JSONL loading, statistics, and chat template formatting."""

    @staticmethod
    def load_jsonl(path: str) -> List[Dict[str, Any]]:
        with open(path, "r", encoding="utf-8") as f:
            return [json.loads(line) for line in f]

    @staticmethod
    def format_chat_prompt(
        example: Dict[str, Any], 
        tokenizer: Any, 
        thinking_mode: ThinkingMode = ThinkingMode.DISABLED
    ) -> Dict[str, str]:
        """
        Formats diverse dataset schemas (messages, QA with options, or instruction/input)
        into standard chat messages and applies the model tokenizer's chat template.
        """
        # 1. Native messages schema
        if "messages" in example:
            messages = example["messages"]
            text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            return {"text": text}

        # 2. Question / Options / Answer schema
        if "question" in example:
            question = example["question"]
            options = example.get("options", [])
            answer = example.get("answer", "")
            thinking = example.get("thinking", None)

            if options:
                options_lines = []
                for opt in options:
                    if isinstance(opt, dict):
                        options_lines.append(f"{list(opt.keys())[0]}) {list(opt.values())[0]}")
                    else:
                        options_lines.append(str(opt))
                user_msg = f"{question}\n\n" + "\n".join(options_lines)
            else:
                user_msg = question

            use_thinking = (
                thinking_mode == ThinkingMode.ENABLED or 
                (thinking_mode == ThinkingMode.MIXED and thinking is not None)
            )
            if use_thinking and thinking:
                assistant_msg = f"<think>\n{thinking.strip()}\n</think>\n\n{answer.strip()}"
            else:
                assistant_msg = answer.strip()

            messages = [
                {"role": "user", "content": user_msg.strip()},
                {"role": "assistant", "content": assistant_msg.strip()}
            ]

        # 3. Instruction / Input / Output schema (Alpaca style)
        elif "instruction" in example:
            instruction = example["instruction"]
            inp = example.get("input", "")
            user_msg = f"{instruction}\n\n{inp}".strip() if inp else instruction
            assistant_msg = example.get("output", "")
            messages = [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": assistant_msg}
            ]
        else:
            raise ValueError(f"Unrecognized data schema: keys={list(example.keys())}")

        try:
            text = tokenizer.apply_chat_template(
                messages, 
                tokenize=False, 
                add_generation_prompt=False,
                enable_thinking=(thinking_mode != ThinkingMode.DISABLED)
            )
        except TypeError:
            text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)

        return {"text": text}

    @classmethod
    def prepare_dataset(
        cls, 
        data: List[Dict[str, Any]], 
        tokenizer: Any, 
        thinking_mode: ThinkingMode = ThinkingMode.DISABLED
    ) -> Dataset:
        formatted = []
        for example in tqdm(data, desc="Applying Chat Template"):
            formatted.append(cls.format_chat_prompt(example, tokenizer, thinking_mode))
        return Dataset.from_list(formatted)

    @staticmethod
    def analyze_dataset(data: List[Dict[str, Any]], name: str = "Dataset") -> None:
        categories = defaultdict(int)
        answers = defaultdict(int)
        thinking_count = 0

        for item in data:
            if "category" in item:
                categories[item["category"]] += 1
            if "answer" in item:
                answers[item["answer"]] += 1
            if item.get("thinking"):
                thinking_count += 1

        print(f"\n📊 {name} Analysis:")
        print(f"Total Samples:       {len(data)}")
        if categories:
            print(f"Categories ({len(categories)}):   {dict(categories)}")
        if answers:
            print(f"Answer Distribution: {dict(sorted(answers.items()))}")
        if thinking_count > 0:
            print(f"Reasoning Samples:   {thinking_count} ({thinking_count / len(data) * 100:.1f}%)")
```

### 3. `finetuning.py`: Complete FineTuner Engine
```python
import os
import torch
from dotenv import load_dotenv
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTConfig, SFTTrainer
from tqdm import tqdm
from .config import BaseFineTuningConfig
from .dataset import DatasetLoader
from .utils import extract_answer_robust, cleanup_gpu_memory

class FineTuner:
    """Modular fine-tuning engine supporting QLoRA (4-bit) and LoRA (16-bit)."""

    def __init__(self, config: BaseFineTuningConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.trainer = None
        self._setup_env()

    def _setup_env(self) -> None:
        load_dotenv()
        self.hf_token = os.getenv("HF_TOKEN")
        torch.manual_seed(self.config.random_seed)

    def load_jsonl(self, path: str) -> list:
        return DatasetLoader.load_jsonl(path)

    def analyze_data(self, data: list, name: str = "Dataset") -> None:
        DatasetLoader.analyze_dataset(data, name=name)

    def _get_quantization_config(self) -> BitsAndBytesConfig:
        return BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type=self.config.bnb_4bit_quant_type,
            bnb_4bit_use_double_quant=self.config.bnb_4bit_use_double_quant,
            bnb_4bit_compute_dtype=getattr(torch, self.config.bnb_4bit_compute_dtype),
        )

    def setup_model(self) -> None:
        print(f"📦 Loading tokenizer for {self.config.model_name}...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.config.model_name,
            trust_remote_code=True,
            token=self.hf_token
        )
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"

        print(f"📦 Loading base model ({'4-bit QLoRA' if self.config.load_in_4bit else '16-bit LoRA'})...")
        quant_config = self._get_quantization_config() if self.config.load_in_4bit else None
        compute_dtype = getattr(torch, self.config.bnb_4bit_compute_dtype)

        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            quantization_config=quant_config,
            device_map="auto",
            torch_dtype=compute_dtype,
            trust_remote_code=True,
            token=self.hf_token
        )

        # Prepare model for gradient checkpointing and training
        if self.config.load_in_4bit:
            self.model = prepare_model_for_kbit_training(
                self.model,
                use_gradient_checkpointing=self.config.gradient_checkpointing
            )
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
        self.model.print_trainable_parameters()

    def setup_trainer(self, train_data: list) -> None:
        print("⚙️ Setting up SFTTrainer...")
        dataset = DatasetLoader.prepare_dataset(
            train_data, 
            self.tokenizer, 
            thinking_mode=self.config.thinking_mode
        )

        training_args = SFTConfig(
            output_dir=self.config.output_dir,
            num_train_epochs=self.config.num_epochs,
            per_device_train_batch_size=self.config.batch_size,
            gradient_accumulation_steps=self.config.gradient_accumulation_steps,
            gradient_checkpointing=self.config.gradient_checkpointing,
            gradient_checkpointing_kwargs={"use_reentrant": False} if self.config.gradient_checkpointing else None,
            learning_rate=self.config.learning_rate,
            lr_scheduler_type=self.config.lr_scheduler_type,
            warmup_ratio=self.config.warmup_ratio,
            weight_decay=0.01,
            logging_steps=20,
            save_strategy="epoch",
            seed=self.config.random_seed,
            bf16=True,
            optim=self.config.optim,
            max_length=self.config.max_length,
            packing=self.config.packing,
            dataset_text_field="text",
            dataloader_num_workers=self.config.dataloader_num_workers,
            dataloader_pin_memory=True
        )

        self.trainer = SFTTrainer(
            model=self.model,
            train_dataset=dataset,
            args=training_args,
            data_collator=DataCollatorForLanguageModeling(tokenizer=self.tokenizer, mlm=False)
        )
        print(f"✅ Trainer ready ({len(dataset)} samples, effective batch size: {self.config.effective_batch_size})")

    def train(self) -> None:
        if self.trainer is None:
            raise RuntimeError("Trainer not set up. Call setup_trainer() first.")
        print("🚀 Starting training...")
        self.trainer.train()
        print("✅ Training complete.")

    def save_model(self) -> None:
        if self.trainer is None:
            raise RuntimeError("Trainer not found.")
        print(f"💾 Saving adapter to {self.config.output_dir}...")
        self.trainer.save_model()
        self.tokenizer.save_pretrained(self.config.output_dir)
        print("✅ Adapter and tokenizer saved.")

    def evaluate_model(self, test_data: list) -> float:
        """Evaluates model with autoregressive generation and robust regex answer parsing."""
        if self.model is None or self.tokenizer is None:
            raise RuntimeError("Model or tokenizer not loaded.")
        
        self.model.eval()
        correct = 0
        total = len(test_data)
        failed_extractions = 0

        # Set left padding for autoregressive inference
        original_padding_side = self.tokenizer.padding_side
        self.tokenizer.padding_side = "left"

        print(f"🧪 Evaluating {total} test samples...")
        for example in tqdm(test_data, desc="Evaluating"):
            prompt_dict = DatasetLoader.format_chat_prompt(
                {"question": example["question"], "options": example.get("options", [])},
                self.tokenizer,
                thinking_mode=self.config.thinking_mode
            )
            inputs = self.tokenizer(
                prompt_dict["text"], 
                return_tensors="pt", 
                truncation=True, 
                max_length=self.config.max_length
            ).to(self.model.device)

            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=256 if self.config.thinking_mode == ThinkingMode.DISABLED else 1024,
                    do_sample=False,
                    pad_token_id=self.tokenizer.eos_token_id
                )

            response = self.tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
            predicted = extract_answer_robust(response)

            if not predicted:
                failed_extractions += 1
            elif predicted == example.get("answer"):
                correct += 1

        self.tokenizer.padding_side = original_padding_side
        accuracy = correct / total if total > 0 else 0.0
        print(f"📊 Accuracy: {accuracy:.4f} ({correct}/{total}) | Failed Extractions: {failed_extractions}")
        return accuracy

    def run_complete_pipeline(self, train_data: list, test_data: Optional[list] = None) -> Optional[float]:
        self.setup_model()
        self.setup_trainer(train_data)
        self.train()
        self.save_model()
        if test_data:
            return self.evaluate_model(test_data)
        return None
```

### 4. `utils.py`: Memory Management & Answer Extraction
```python
import gc
import re
import torch
from typing import Optional

def cleanup_gpu_memory() -> None:
    """Purges python garbage collector and releases unallocated CUDA memory."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
        torch.cuda.synchronize()

def extract_answer_robust(output: str, valid_choices: str = "ABCDE") -> str:
    """Robust multi-pattern regex answer parser for multiple-choice benchmarks."""
    if not output:
        return ""
    cleaned = output.strip()

    # Separate CoT reasoning trace if present
    if "</think>" in cleaned:
        cleaned = cleaned.split("</think>")[-1].strip()

    # Immediate single letter
    if len(cleaned) == 1 and cleaned.upper() in valid_choices:
        return cleaned.upper()

    # Explicit prefix patterns
    patterns = [
        rf"(?:answer|risposta|choice|option)\s*(?:is|è|:)?\s*[\(\[]?([{valid_choices}])[\)\]]?",
        rf"(?:therefore|quindi|the correct answer is)\s*[\(\[]?([{valid_choices}])[\)\]]?"
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Word boundary match
    boundary_match = re.search(rf"\b([{valid_choices}])\b", cleaned.upper())
    if boundary_match:
        return boundary_match.group(1)

    # Reverse fallback
    for char in reversed(cleaned.upper()):
        if char in valid_choices:
            return char
    return ""

def validate_gpu_vram(min_vram_gb: float) -> None:
    """Ensures host GPU has sufficient VRAM before training begins."""
    if not torch.cuda.is_available():
        print("⚠️ CUDA not detected; running in CPU fallback mode.")
        return
    total_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    print(f"🖥️ GPU: {torch.cuda.get_device_name(0)} ({total_gb:.1f} GB VRAM)")
    if total_gb < min_vram_gb:
        raise RuntimeError(f"❌ Insufficient VRAM: {total_gb:.1f}GB available, {min_vram_gb:.1f}GB required.")
```

### 5. `__init__.py`: Clean Surface Re-Exports
```python
from .config import (
    BaseFineTuningConfig,
    ThinkingMode,
    LlamaFineTuningConfig,
    QwenFineTuningConfig,
    MagistralFineTuningConfig
)
from .dataset import DatasetLoader
from .finetuning import FineTuner
from .utils import cleanup_gpu_memory, extract_answer_robust, validate_gpu_vram

__all__ = [
    "BaseFineTuningConfig",
    "ThinkingMode",
    "LlamaFineTuningConfig",
    "QwenFineTuningConfig",
    "MagistralFineTuningConfig",
    "DatasetLoader",
    "FineTuner",
    "cleanup_gpu_memory",
    "extract_answer_robust",
    "validate_gpu_vram"
]
```

---

## 3. Thin Notebook Execution Template (`01_train.ipynb`)

With all logic encapsulated in the local package, the notebook is clean, testable, and under 8 cells:

```python
# Cell 1: Imports (at root or with sys.path if in subfolder)
import sys, os
from llama_finetuning import LlamaFineTuningConfig, FineTuner, cleanup_gpu_memory

# Cell 2: Configure Run
config = LlamaFineTuningConfig(
    model_name="meta-llama/Llama-3.1-8B-Instruct",
    train_file="data/train.jsonl",
    output_dir="./results_llama31_adapter",
    batch_size=4,
    gradient_accumulation_steps=8,
    lora_r=16,
    lora_alpha=32
)
config.print_config()

# Cell 3: Data Loading & Verification
finetuner = FineTuner(config)
train_data = finetuner.load_jsonl(config.train_file)
finetuner.analyze_data(train_data, name="Training Dataset")

# Cell 4: Model & Trainer Setup
finetuner.setup_model()
finetuner.setup_trainer(train_data)

# Cell 5: Training Execution
finetuner.train()

# Cell 6: Save Adapter
finetuner.save_model()

# Cell 7: Sanity Evaluation
test_data = finetuner.load_jsonl("data/test.jsonl")[:20]
finetuner.evaluate_model(test_data)
cleanup_gpu_memory()
```

---

## 4. Anti-Patterns to Avoid

| Anti-Pattern | Why It Breaks Down | Correct Pattern |
|---|---|---|
| **Raw HuggingFace setup inside cells** | Cannot reuse between models; copy-pasting across 5 notebooks causes configuration drift and silent bugs. | Encapsulate model and trainer instantiation in a class method. |
| **Defining custom functions in notebook cells** | Functions cannot be unit-tested or imported by batch evaluation scripts. | Store functions in `utils.py` or `dataset.py` and import them. |
| **Hardcoding API tokens or paths in notebooks** | Security breach if pushed to git; breaks on different machines. | Use `.env` with `python-dotenv` and explicit config paths. |
| **Running full benchmark loops in notebook cells** | Notebooks disconnect or lose output on long runs; no checkpoint resumption. | Move evaluation logic into `benchmark.py` and run headless or stream structured logs. |
| **Leaving GPU tensors uncollected in memory** | Successive cell re-runs cause `CUDA out of memory` (OOM). | Provide a `cleanup_gpu_memory()` helper calling `gc.collect()` and `torch.cuda.empty_cache()`. |
