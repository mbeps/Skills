# Notebook-Module Architecture & Package Conventions for Benchmarking

## Overview

A core engineering principle for production-grade LLM benchmarking is **zero evaluation or inference logic inside Jupyter notebooks**.

Notebooks are stateful, non-modular environments that lead to silent bugs, unreproducible benchmarks, git merge conflicts, and lost execution states. Under the **thin-dashboard architecture**, notebooks contain only ~5–8 cells dedicated strictly to configuration and orchestration. All heavy logic—dataset ingestion, stratified sampling, model lifecycle management, batch generation, regex answer extraction, category-level metric calculations, and GPU memory cleanup—lives in modular, version-controlled Python packages.

---

## 1. Directory Structure Standard

Every LLM benchmarking repository should adhere to this standardized layout:

```text
<project_root>/
├── .env                              # API tokens (HF_TOKEN, WANDB_API_KEY)
├── .gitignore                        # Git exclusions (.env, results/, cache/, *.safetensors)
├── pyproject.toml / requirements.txt # Explicit dependencies (vllm, peft, torch, pandas, tqdm)
├── data/
│   ├── test.jsonl                    # Benchmark corpus (e.g. MMLU, ARC, ITALIC)
│   └── dev.jsonl                     # Optional sample/validation corpus
├── <model_prefix>_benchmark/         # Dedicated model package (or unified llm_benchmark/)
│   ├── __init__.py                   # Clean surface exports (Config, BenchmarkRunner)
│   ├── config.py                     # Dataclass config, hardware checks, dynamic batch sizing
│   ├── dataset.py                    # JSONL parser, uniform/stratified sampler, prompt formatter
│   ├── benchmark.py                  # Core engine lifecycle (load, batch inference, evaluate, report)
│   └── utils.py                      # Robust answer regex, GPU memory cleaner, hardware telemetry
├── 01_benchmark_<model>.ipynb        # Thin orchestration dashboard notebook (at root)
└── results/                          # Per-sample CSVs and structured JSON summaries
```

> **Note on Notebook Placement:**
> If notebooks are stored in a `notebooks/` subfolder, ensure the parent directory is added to `sys.path` in Cell 1:
```python
import os, sys
sys.path.insert(0, os.path.abspath(".."))
```

Placing notebooks directly at `<project_root>/` eliminates path resolution issues.

---

## 2. Modular Implementation Specification

### 1. `config.py`: Dataclass Configuration & Auto-Validation
Centralizes all hyperparameters, file paths, hardware thresholds, and sampling options:

```python
"""
Configuration schema for LLM benchmarking pipelines.
"""

import os
import random
import warnings
from dataclasses import dataclass
from typing import Optional
import torch


@dataclass
class BenchmarkConfig:
    """Configuration for LLM benchmarking with vLLM and optional LoRA support."""

    # Model and Adapter
    model_name: Optional[str] = None
    lora_adapter_path: Optional[str] = None
    merged_model_save_path: Optional[str] = None
    merge_adapter_in_memory: bool = True

    # Dataset & Evaluation
    test_file: str = "data/test.jsonl"
    max_eval_samples: Optional[int] = None
    use_uniform_subset: bool = True
    random_seed: int = 42

    # Inference & Generation
    max_length: int = 4096
    max_new_tokens: int = 350
    temperature: float = 0.0
    top_p: float = 1.0
    top_k: int = -1
    repetition_penalty: float = 1.0

    # Engine & Hardware
    batch_size: Optional[int] = None
    min_vram_gb: float = 16.0
    gpu_memory_utilization: float = 0.85
    tensor_parallel_size: int = 1
    max_num_seqs: int = 64
    suppress_warnings: bool = True

    # Prompting & Output
    system_message: str = "You are a helpful assistant."
    output_prefix: Optional[str] = None
    save_results: bool = True
    save_summary: bool = True
    hf_token_env_var: str = "HF_TOKEN"

    def __post_init__(self):
        random.seed(self.random_seed)
        if self.suppress_warnings:
            warnings.filterwarnings("ignore")
            os.environ["TRANSFORMERS_VERBOSITY"] = "error"

        # Authentication
        hf_token = os.getenv(self.hf_token_env_var)
        if hf_token:
            os.environ["HF_TOKEN"] = hf_token

        # Resolve model name if LoRA adapter provided
        if self.lora_adapter_path:
            self._validate_lora_path()
            if not self.model_name:
                self.model_name = self._resolve_base_model_from_adapter()
        elif not self.model_name:
            raise ValueError("model_name is required when lora_adapter_path is not specified.")

        # Default output prefix
        if self.output_prefix is None:
            clean_name = self.model_name.split("/")[-1].lower().replace("-", "_")
            if self.lora_adapter_path:
                adapter_name = os.path.basename(self.lora_adapter_path.rstrip("/"))
                self.output_prefix = f"{clean_name}_lora_{adapter_name}"
            else:
                self.output_prefix = f"{clean_name}_bench"

        # Auto-detect batch size if not explicitly set
        if self.batch_size is None:
            self.batch_size = self._auto_detect_batch_size()

        # Hardware verification
        self._validate_hardware()

    def _validate_lora_path(self):
        if not os.path.exists(self.lora_adapter_path):
            raise FileNotFoundError(f"LoRA adapter directory not found: {self.lora_adapter_path}")
        cfg_path = os.path.join(self.lora_adapter_path, "adapter_config.json")
        if not os.path.exists(cfg_path):
            raise FileNotFoundError(f"Missing adapter_config.json in: {self.lora_adapter_path}")

    def _resolve_base_model_from_adapter(self) -> str:
        import json
        cfg_path = os.path.join(self.lora_adapter_path, "adapter_config.json")
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        base = data.get("base_model_name_or_path")
        if not base:
            raise ValueError(f"Could not resolve base_model_name_or_path from {cfg_path}")
        return base

    def _auto_detect_batch_size(self) -> int:
        """Auto-detect optimal batch size based on available VRAM and min required VRAM."""
        if not torch.cuda.is_available():
            return 1
        total_vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        if total_vram < self.min_vram_gb:
            return 1
        used_memory = total_vram * self.gpu_memory_utilization
        available = total_vram - used_memory
        multiplier = 0.8 if self.lora_adapter_path else 1.0
        if self.min_vram_gb >= 140:
            return max(1, min(4, int(available * multiplier // 2)))
        elif self.min_vram_gb >= 32:
            return max(2, min(8, int(available * multiplier // 1)))
        else:
            return max(4, min(16, int(available * multiplier // 0.5)))

    def _validate_hardware(self):
        if torch.cuda.is_available():
            total_vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            if total_vram < self.min_vram_gb:
                print(f"⚠️ Warning: Available VRAM ({total_vram:.1f} GB) is below recommended ({self.min_vram_gb:.1f} GB).")
        else:
            print("⚠️ Notice: CUDA not detected during config initialization. GPU required at runner initialization.")

    def print_config(self):
        print(f"\n{'=' * 60}")
        print("BENCHMARK CONFIGURATION")
        print(f"{'=' * 60}")
        print(f"✓ Base Model: {self.model_name}")
        if self.lora_adapter_path:
            print(f"✓ LoRA Adapter: {self.lora_adapter_path}")
        print(f"✓ Test File: {self.test_file}")
        print(f"✓ Max Length: {self.max_length}")
        print(f"✓ Max New Tokens: {self.max_new_tokens}")
        print(f"✓ Batch Size: {self.batch_size or 'Auto'}")
        print(f"✓ GPU Utilization: {self.gpu_memory_utilization}")
        print(f"✓ Output Prefix: {self.output_prefix}")
        print(f"{'=' * 60}\n")
```

---

### 2. `dataset.py`: Multi-Schema Parsing, Stratification & Formatting
Encapsulates data ingestion, category balance, and prompt building:

```python
"""
Dataset handling, stratified category subsampling, and prompt payload creation.
"""

import json
import random
from collections import defaultdict
from typing import Any, Dict, List, Tuple


def load_benchmark_dataset(file_path: str) -> List[Dict[str, Any]]:
    """Loads a benchmark dataset from a JSONL file."""
    records = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def create_uniform_subset(
    data: List[Dict[str, Any]], n_samples: int, seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Creates a balanced evaluation subset with uniform distribution across categories.
    Handles category size deficits by redistributing shortfall across remaining categories.
    """
    random.seed(seed)
    if not data or len(data) <= n_samples or "category" not in data[0]:
        return random.sample(data, min(len(data), n_samples))

    category_groups = defaultdict(list)
    for row in data:
        category_groups[row["category"]].append(row)

    categories = sorted(category_groups.keys())
    base_per_cat = n_samples // len(categories)
    remainder = n_samples % len(categories)

    selected = []
    remaining_pool = []
    for i, cat in enumerate(categories):
        quota = base_per_cat + (1 if i < remainder else 0)
        available = category_groups[cat]
        shuffled = random.sample(available, len(available))
        take = min(quota, len(shuffled))
        selected.extend(shuffled[:take])
        remaining_pool.extend(shuffled[take:])

    # Reallocate shortfall if small categories had fewer samples than quota
    deficit = n_samples - len(selected)
    if deficit > 0 and remaining_pool:
        backfill = random.sample(remaining_pool, min(deficit, len(remaining_pool)))
        selected.extend(backfill)

    random.shuffle(selected)
    return selected


def format_options(options: List[Dict[str, str]]) -> Tuple[str, str]:
    """
    Formats a list of option dictionaries: [{'A': 'val1'}, {'B': 'val2'}]
    Returns (formatted_options_str, available_letters)
    """
    lines = []
    letters = []
    for item in options:
        for letter, text in item.items():
            lines.append(f"{letter}) {text}")
            letters.append(letter)
    return "\n".join(lines), "".join(letters)


def configure_prompt_payload(
    question_data: Dict[str, Any],
    system_message: str,
    query_template: Optional[str] = None,
) -> Tuple[List[Dict[str, str]], str]:
    """
    Constructs OpenAI/vLLM chat messages format: [{'role': 'system', ...}, {'role': 'user', ...}]
    """
    question = question_data["question"]
    options = question_data["options"]
    correct_answer = question_data["answer"]
    category = question_data.get("category", "general")

    formatted_options, letters = format_options(options)

    if query_template:
        user_content = query_template.format(
            question=question,
            options=formatted_options,
            category=category,
            merged_letters=letters,
        )
    else:
        user_content = (
            f"Answer the following multiple-choice question on '{category}'. "
            f"Your response must be strictly in the format: 'LETTER' where LETTER is one of [{letters}]. "
            f"Provide only the letter corresponding to your answer without explanation.\n\n"
            f"{question}\n\n"
            f"{formatted_options}\n\n"
            f"Answer:"
        )

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_content},
    ]
    return messages, correct_answer
```

---

### 3. `utils.py`: Regex Parsing, Telemetry & GPU Memory Cleanup
Encapsulates all evaluation utilities:

```python
"""
Evaluation utilities: multi-pattern answer regex, GPU memory management, and system telemetry.
"""

import gc
import re
from typing import Optional, Tuple
import torch


def extract_answer_robust(output: str) -> str:
    """
    Extracts multiple-choice answer letter using prioritized regex patterns.
    Safeguards against keyword collision ('lettera' vs 'letter') and prose false positives.
    """
    if not output or not output.strip():
        return ""

    text = output.strip()

    # Priority 1: Direct formatted markers: 'A)', 'A.', 'A:'
    for pattern in [r"\b([ABCDE])\)", r"\b([ABCDE])\.", r"\b([ABCDE]):"]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Priority 2: Explicit keyword prefixes (multilingual: Italian & English)
    # Word boundaries ensure 'letter' cannot partially match inside 'lettera'
    prefix_pattern = r"\b(?:lettera|letter|risposta|answer|opzione|option|scelta|choice)\b[:\s]*([ABCDE])\b"
    match = re.search(prefix_pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).upper()

    # Priority 3: Markdown bold/italic emphasis: '**A**' or '*A*'
    for pattern in [r"\*\*([ABCDE])\*\*", r"\*([ABCDE])\*"]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Priority 4: Standalone isolated uppercase letter (case-sensitive to avoid matching English 'a' or Italian 'a')
    match = re.search(r"\b([A-E])\b", text)
    if match:
        return match.group(1)

    # Priority 5: Last fallback: scan single unique occurrence
    candidates = [char for char in "ABCDE" if char in text]
    if len(candidates) == 1:
        return candidates[0]

    return ""


def show_sample_predictions(results: list, n_samples: int = 5) -> None:
    """Displays a representative sample of correct and incorrect predictions for inspection."""
    print(f"\nSAMPLE PREDICTIONS (total {len(results)} evaluated):")
    correct = [r for r in results if r["is_correct"]][: n_samples // 2]
    incorrect = [r for r in results if not r["is_correct"]][: n_samples // 2]
    samples = correct + incorrect

    for i, res in enumerate(samples[:n_samples], 1):
        status = "✅ CORRECT" if res["is_correct"] else "❌ INCORRECT"
        print(f"\nExample {i} {status}:")
        print(f"  Category: {res.get('category', 'unknown')}")
        print(f"  Question: {res['question'][:100]}...")
        print(f"  Expected: {res['correct_answer']}")
        print(f"  Predicted: {res['predicted_answer']}")
        if res.get("raw_response"):
            print(f"  Raw output: '{res['raw_response'][:60]}...'")


def cleanup_gpu_memory():
    """Flushes PyTorch CUDA caches and triggers garbage collection."""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    gc.collect()


def get_gpu_info() -> Tuple[Optional[str], float]:
    """Returns GPU device name and total VRAM in GB."""
    if not torch.cuda.is_available():
        return None, 0.0
    name = torch.cuda.get_device_name(0)
    total_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    return name, total_gb
```

---

### 4. `benchmark.py`: Complete Lifecycle Runner
Orchestrates model loading, adapter merging, batch inference, category accounting, and file persistence:

```python
"""
Core Benchmark runner managing vLLM inference and result accounting.
"""

import json
import os
import shutil
import tempfile
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from tqdm import tqdm
from vllm import LLM, SamplingParams

from .config import BenchmarkConfig
from .dataset import (
    load_benchmark_dataset,
    create_uniform_subset,
    configure_prompt_payload,
)
from .utils import (
    extract_answer_robust,
    cleanup_gpu_memory,
    get_gpu_info,
)


class BenchmarkRunner:
    """Production-grade LLM Benchmark Runner using vLLM."""

    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self.model: Optional[LLM] = None
        self.sampling_params: Optional[SamplingParams] = None
        self.dataset: List[Dict[str, Any]] = []
        self.merged_model_path: Optional[str] = None

        self.config.print_config()
        cleanup_gpu_memory()

    def _merge_lora_adapter(self) -> str:
        """Merges LoRA adapter into unquantized 16-bit base weights."""
        from peft import AutoPeftModelForCausalLM
        from transformers import AutoTokenizer
        import torch

        print(f"📦 Merging LoRA adapter: {self.config.lora_adapter_path} into {self.config.model_name}...")
        peft_model = AutoPeftModelForCausalLM.from_pretrained(
            self.config.lora_adapter_path,
            device_map="auto",
            torch_dtype=torch.bfloat16,
            trust_remote_code=True,
        )
        merged_model = peft_model.merge_and_unload()

        target_dir = self.config.merged_model_save_path or tempfile.mkdtemp(prefix="bench_merged_")
        os.makedirs(target_dir, exist_ok=True)
        merged_model.save_pretrained(target_dir, safe_serialization=True)

        # Save tokenizer
        try:
            tok_source = (
                self.config.lora_adapter_path
                if any(f.startswith("tokenizer") for f in os.listdir(self.config.lora_adapter_path))
                else self.config.model_name
            )
            tok = AutoTokenizer.from_pretrained(tok_source, trust_remote_code=True)
            tok.save_pretrained(target_dir)
        except Exception as e:
            print(f"⚠️ Warning saving tokenizer: {e}")

        del peft_model
        del merged_model
        cleanup_gpu_memory()
        print(f"✅ Standalone merged model saved to: {target_dir}")
        return target_dir

    def load_dataset(self) -> List[Dict[str, Any]]:
        full_data = load_benchmark_dataset(self.config.test_file)
        if self.config.max_eval_samples and len(full_data) > self.config.max_eval_samples:
            if self.config.use_uniform_subset:
                self.dataset = create_uniform_subset(
                    full_data, self.config.max_eval_samples, self.config.random_seed
                )
            else:
                self.dataset = full_data[: self.config.max_eval_samples]
        else:
            self.dataset = full_data
        print(f"Loaded {len(self.dataset)} evaluation questions.")
        return self.dataset

    def load_model(self):
        model_path = self._merge_lora_adapter() if self.config.lora_adapter_path else self.config.model_name
        self.merged_model_path = model_path if self.config.lora_adapter_path else None

        print(f"🚀 Initializing vLLM engine with: {model_path}...")
        self.model = LLM(
            model=model_path,
            tensor_parallel_size=self.config.tensor_parallel_size,
            max_model_len=self.config.max_length,
            gpu_memory_utilization=self.config.gpu_memory_utilization,
            max_num_seqs=self.config.max_num_seqs,
            trust_remote_code=True,
            enforce_eager=False,
        )

        self.sampling_params = SamplingParams(
            temperature=self.config.temperature,
            top_p=self.config.top_p,
            top_k=self.config.top_k,
            repetition_penalty=self.config.repetition_penalty,
            max_tokens=self.config.max_new_tokens,
            skip_special_tokens=True,
        )

    def generate_batch_responses(self, batch_messages: List[List[Dict[str, str]]]) -> List[str]:
        outputs = self.model.chat(
            batch_messages,
            sampling_params=self.sampling_params,
            use_tqdm=False,
        )
        return [out.outputs[0].text.strip() for out in outputs]

    def test_inference(self) -> bool:
        """Validates inference, chat templating, and regex extraction on a single sample before full evaluation."""
        if not self.dataset:
            self.load_dataset()
        if not self.model:
            self.load_model()

        print("\n🧪 Running single-item pre-flight inference test...")
        sample = self.dataset[0]
        test_messages, expected_answer = configure_prompt_payload(sample, self.config.system_message)
        test_responses = self.generate_batch_responses([test_messages])
        raw_output = test_responses[0]
        extracted = self.extract_answer(raw_output)

        print(f"  Question: {sample['question'][:80]}...")
        print(f"  Expected answer: '{expected_answer}'")
        print(f"  Raw response: '{raw_output[:60]}...'")
        print(f"  Extracted answer: '{extracted}'")
        print(f"  Status: {'✅ Pass' if extracted == expected_answer else '⚠️ Mismatch (check prompt/regex)'}")
        return extracted == expected_answer

    def extract_answer(self, raw_response: str) -> str:
        """Extracts answer letter using standard robust regex."""
        return extract_answer_robust(raw_response)

    def run_evaluation(self) -> Tuple[List[Dict[str, Any]], float, Dict[str, Dict[str, int]]]:
        if not self.dataset:
            self.load_dataset()
        if not self.model:
            self.load_model()

        results = []
        correct = 0
        total = 0
        category_stats = defaultdict(lambda: {"correct": 0, "total": 0})
        bs = self.config.batch_size or 8

        print(f"\nEvaluating on {len(self.dataset)} questions (batch_size={bs})...")
        pbar = tqdm(range(0, len(self.dataset), bs), desc="Benchmarking")
        for batch_start in pbar:
            batch_end = min(batch_start + bs, len(self.dataset))
            batch = self.dataset[batch_start:batch_end]
            batch_messages = []
            batch_answers = []

            for item in batch:
                msgs, ans = configure_prompt_payload(item, self.config.system_message)
                batch_messages.append(msgs)
                batch_answers.append(ans)

            try:
                responses = self.generate_batch_responses(batch_messages)
            except Exception as e:
                print(f"⚠️ Error in batch {batch_start}-{batch_end}: {e}. Retrying sequentially...")
                responses = []
                for msgs in batch_messages:
                    try:
                        responses.extend(self.generate_batch_responses([msgs]))
                    except Exception as inner_e:
                        responses.append(f"ERROR: {inner_e}")

            for i, (item, resp, expected) in enumerate(zip(batch, responses, batch_answers)):
                pred = self.extract_answer(resp)
                is_correct = (pred == expected)
                cat = item.get("category", "general")
                macro_cat = item.get("macro_category", "unknown")

                category_stats[cat]["total"] += 1
                total += 1
                if is_correct:
                    correct += 1
                    category_stats[cat]["correct"] += 1

                results.append({
                    "index": batch_start + i,
                    "question": item["question"],
                    "category": cat,
                    "macro_category": macro_cat,
                    "correct_answer": expected,
                    "predicted_answer": pred,
                    "raw_response": resp,
                    "is_correct": is_correct,
                })

            acc = correct / total if total > 0 else 0
            pbar.set_postfix({"Acc": f"{acc * 100:.2f}%", "Done": f"{total}/{len(self.dataset)}"})

            # Periodic memory management every 10 batches
            if (batch_start // bs) % 10 == 0:
                cleanup_gpu_memory()

        accuracy = correct / total if total > 0 else 0.0
        return results, accuracy, category_stats

    def analyze_results(self, category_stats: Dict[str, Dict[str, int]]) -> float:
        """Alias for analyse_results_by_category"""
        return self.analyse_results_by_category(category_stats)

    def analyse_results_by_category(self, category_stats: Dict[str, Dict[str, int]]) -> float:
        print(f"\n{'=' * 65}")
        print(f"{'Category':30s} {'Accuracy':>12s} {'Score':>18s}")
        print(f"{'=' * 65}")
        total_correct = sum(v["correct"] for v in category_stats.values())
        total_q = sum(v["total"] for v in category_stats.values())
        overall_acc = (total_correct / total_q * 100) if total_q > 0 else 0.0

        for cat, stats in sorted(category_stats.items()):
            c, t = stats["correct"], stats["total"]
            cat_acc = (c / t * 100) if t > 0 else 0.0
            print(f"{cat:30s} {cat_acc:11.2f}% {c:>8d} / {t:<8d}")

        print(f"{'-' * 65}")
        print(f"{'TOTAL (Micro Average)':30s} {overall_acc:11.2f}% {total_correct:>8d} / {total_q:<8d}")
        print(f"{'=' * 65}\n")
        return overall_acc

    @staticmethod
    def show_sample_predictions(results: List[Dict[str, Any]], n_samples: int = 5):
        """Displays representative sample predictions directly in notebook output."""
        show_sample_predictions(results, n_samples)

    def save_results(self, results: List[Dict[str, Any]], accuracy: float, category_stats: Dict[str, Dict[str, int]]):
        gpu_name, vram = get_gpu_info()
        suffix = gpu_name.lower().replace(" ", "_").replace("nvidia_", "").replace("geforce_", "").split("_")[0] if gpu_name else "cpu"

        # Default to standard results/ directory
        results_dir = os.path.join(os.getcwd(), "results")
        os.makedirs(results_dir, exist_ok=True)

        csv_file = os.path.join(results_dir, f"{self.config.output_prefix}_{suffix}_results.csv")
        pd.DataFrame(results).to_csv(csv_file, index=False)
        print(f"📁 Detailed CSV saved to: {csv_file}")

        summary_file = os.path.join(results_dir, f"{self.config.output_prefix}_{suffix}_summary.json")
        summary = {
            "model": self.config.model_name,
            "lora_adapter": self.config.lora_adapter_path,
            "overall_accuracy": accuracy,
            "total_questions": len(results),
            "hardware": {"gpu": gpu_name, "vram_gb": vram, "batch_size": self.config.batch_size},
            "categories": {
                k: {"accuracy": v["correct"] / v["total"], "correct": v["correct"], "total": v["total"]}
                for k, v in category_stats.items()
            },
        }
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"📊 Summary JSON saved to: {summary_file}")

    def cleanup(self):
        """Releases vLLM engine, clears GPU memory, and cleans temp directories."""
        if self.model:
            del self.model
            self.model = None
        cleanup_gpu_memory()

        if self.merged_model_path and self.merged_model_path.startswith(tempfile.gettempdir()):
            try:
                shutil.rmtree(self.merged_model_path)
                print(f"🧹 Cleaned up temporary merged model directory: {self.merged_model_path}")
            except Exception as e:
                print(f"⚠️ Could not delete temp dir {self.merged_model_path}: {e}")

    def run_benchmark(self) -> Tuple[List[Dict[str, Any]], float, Dict[str, Dict[str, int]]]:
        """Complete benchmark workflow matching codebase conventions."""
        try:
            self.load_dataset()
            self.load_model()
            self.test_inference()
            results, accuracy, category_stats = self.run_evaluation()
            self.analyze_results(category_stats)
            if self.config.save_results:
                self.save_results(results, accuracy, category_stats)
            return results, accuracy, category_stats
        finally:
            self.cleanup()

    # Alias for pipeline execution
    run_complete_pipeline = run_benchmark


class ReasoningBenchmarkRunner(BenchmarkRunner):
    """
    Benchmark runner specifically tailored for reasoning models (e.g., Qwen 2.5/3 Thinking,
    DeepSeek-R1, Magistral Reasoning) that generate <think>...</think> traces.
    """

    def load_model(self):
        super().load_model()
        # Configure sampling parameters for reasoning mode
        self.sampling_params = SamplingParams(
            temperature=0.6,          # Optimal exploration temperature for reasoning models
            top_p=0.95,
            top_k=20,
            max_tokens=self.config.max_new_tokens or 600,
            skip_special_tokens=False # CRITICAL: retain <think> tags for post-processing
        )

    def generate_batch_responses(self, batch_messages: List[List[Dict[str, str]]]) -> List[str]:
        outputs = self.model.chat(
            batch_messages,
            sampling_params=self.sampling_params,
            use_tqdm=False,
            chat_template_kwargs={"enable_thinking": True}  # Enforce thinking generation
        )
        return [out.outputs[0].text.strip() for out in outputs]

    def extract_answer(self, raw_response: str) -> str:
        from .utils import extract_answer_with_reasoning
        return extract_answer_with_reasoning(raw_response)
```

---

## 3. Thin Dashboard Notebook Pattern

A benchmark notebook must strictly act as a **thin orchestration dashboard** (under 8 cells). It contains zero definitions of regexes, vLLM parameters, loops, or metrics:

```python
# Cell 1: Clean Imports
from llama31_benchmark import Llama31BenchmarkConfig, Llama31Benchmark
# or for unified runner: from benchmark import BenchmarkConfig, BenchmarkRunner

# Cell 2: Declarative Configuration
config = Llama31BenchmarkConfig(
    model_name="DeepMount00/Llama-3.1-8b-ITA",
    test_file="data/test.jsonl",
    batch_size=8,
    max_length=4096,
    max_new_tokens=350,
    gpu_memory_utilization=0.85,
    output_prefix="llama31_8b_ita"
)

# Cell 3: Verification & VRAM Check
config.print_config()

# Cell 4: Initialize Runner
benchmark = Llama31Benchmark(config)

# Cell 5: Run Benchmark Pipeline (single method execution)
results, accuracy, category_stats = benchmark.run_benchmark()

# Cell 6: Detailed Category Performance Breakdown
benchmark.analyse_results_by_category(category_stats)

# Cell 7: Inspect Sample Predictions
benchmark.show_sample_predictions(results, 10)
```
