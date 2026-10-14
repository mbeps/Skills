---
name: benchmarking-llms
description: Use when benchmarking, evaluating, or running batch inference on open-weights Large Language Models (LLMs) or PEFT/LoRA adapters with vLLM or Hugging Face Transformers, designing modular evaluation packages outside Jupyter notebooks, benchmarking reasoning models with thinking tokens, or calculating multi-category zero-shot accuracy metrics.
---

# Benchmarking Large Language Models (LLMs)

## Overview

High-throughput LLM benchmarking measures model capability, fine-tuning retention, and zero-shot reasoning across large evaluation datasets.

**Core principle:** **Zero evaluation or inference logic inside Jupyter notebooks.** All dataset parsers, stratified sampling, model lifecycle handlers, batch generation loops, regex answer extractors, and metric calculators live in reusable Python packages (`<model>_benchmark/`), keeping notebooks as thin, human-readable orchestration dashboards.

---

## When to Use

### Use When:
- Benchmarking open-weights models (LLaMA 3/3.1, Qwen 2.5/3, Mistral, Gemma 2, DeepSeek) or custom fine-tuned LoRA adapters on standard benchmarks (MMLU, ARC, GSM8K, ITALIC).
- Running high-throughput offline batch evaluation via vLLM with PagedAttention or fallback Hugging Face Transformers.
- Standardizing evaluation pipelines across multiple model architectures without duplicating notebook cells.
- Evaluating reasoning models that output Chain-of-Thought traces inside `<think>...</think>` tokens without corrupting answer extraction.
- Fusing low-rank adapters (LoRA/QLoRA) into standalone unquantized models for high-speed offline inference.
- Generating stratified evaluation subsets, per-category accuracy breakdowns, per-sample CSV logs, and JSON summary telemetry.

### When NOT to Use:
- Training or fine-tuning models (use `fine-tuning-llms-peft` instead).
- Deploying persistent online HTTP API serving in production (use dedicated vLLM/TGI server deployments).
- Qualitative manual human evaluation or single-prompt playground testing.

---

## Core Pattern: Thin Notebook vs. Bloated Notebook

### ❌ Anti-Pattern: Monolithic Notebook
```python
# Cell 1: 40 lines of random imports, regexes, and device setups
# Cell 2: Raw JSON parsing loop with hardcoded prompt formatting
# Cell 3: Initializing vLLM or Transformers with raw inline dictionaries
# Cell 4: 100-line sequential inference loop with messy try/except and print statements
# Cell 5: Ad-hoc regex parsing directly embedded in notebook cells
# Cell 6: State lost on kernel interruption; zero reusability across other models
```

### ✅ Modern Standard: Thin Dashboard + Reusable Package
```python
# Notebook: 01_benchmark.ipynb (<7 cells, pure orchestration)
from llama31_benchmark import Llama31BenchmarkConfig, Llama31Benchmark
# or: from benchmark import BenchmarkConfig, BenchmarkRunner

config = Llama31BenchmarkConfig(
    model_name="DeepMount00/Llama-3.1-8b-ITA",
    test_file="data/test.jsonl",
    batch_size=8,
    max_length=4096,
    max_new_tokens=350,
    gpu_memory_utilization=0.85
)
config.print_config()

benchmark = Llama31Benchmark(config)
results, accuracy, category_stats = benchmark.run_benchmark()

# Category performance breakdown
benchmark.analyse_results_by_category(category_stats)

# Inspect sample predictions
benchmark.show_sample_predictions(results, 10)
```

---

## Architecture: Standard Directory Layout

```text
<project_root>/
├── .env                              # API secrets (HF_TOKEN, WANDB_API_KEY)
├── .gitignore                        # Git exclusions (.env, results/, cache/, *.safetensors)
├── pyproject.toml / requirements.txt # Explicit dependencies (vllm, peft, torch, pandas, tqdm)
├── data/
│   ├── test.jsonl                    # Benchmark corpus
│   └── dev.jsonl                     # Optional sample/validation corpus
├── <model_prefix>_benchmark/         # Dedicated model package (or unified llm_benchmark/)
│   ├── __init__.py                   # Clean surface exports (BenchmarkConfig, BenchmarkRunner)
│   ├── config.py                     # Dataclass config, hardware checks, dynamic batch sizing
│   ├── dataset.py                    # JSONL parser, uniform/stratified sampler, prompt formatter
│   ├── benchmark.py                  # Core engine lifecycle (load, batch inference, evaluate, report)
│   └── utils.py                      # Robust answer regex, GPU memory cleaner, hardware telemetry
├── 01_benchmark_<model>.ipynb        # Thin orchestration dashboard notebook (at root)
└── results/                          # Per-sample CSVs and structured JSON summaries
```

---

## Quick Reference

| Feature | Standard Benchmark (vLLM) | Reasoning Benchmark (vLLM) | Fallback (Transformers) |
|---|---|---|---|
| **Engine** | `vllm.LLM` | `vllm.LLM` with thinking enabled | `transformers.AutoModelForCausalLM` |
| **Batch API** | `llm.chat(batch_messages)` | `llm.chat(batch_messages, chat_template_kwargs={"enable_thinking": True})` | `model.generate(**inputs)` |
| **Sampling** | Greedy: `temperature=0.0`, `top_p=1.0` | Exploratory: `temperature=0.6`, `top_p=0.95`, `top_k=20` | Greedy: `do_sample=False` |
| **Special Tokens** | `skip_special_tokens=True` | `skip_special_tokens=False` (retains `<think>` tags) | `tokenizer.batch_decode(skip_special_tokens=True)` |
| **Context Limit** | Cap `max_model_len=4096` | Cap `max_model_len=8192` | Explicit `max_length=4096` |
| **Padding Rule** | Handled natively by PagedAttention | Handled natively by PagedAttention | **Mandatory:** `tokenizer.padding_side = "left"` |
| **LoRA Evaluation** | Merge into 16-bit unquantized base via PEFT before loading | Merge into 16-bit unquantized base via PEFT before loading | Can evaluate with `PeftModel` or merged weights |
| **Answer Extraction** | Prioritized regex matching | Split on `</think>`, prioritize post-thinking verdict | Prioritized regex matching |

---

## Implementation Standard

Every benchmark runner implementation must provide a clean execution contract separating configuration, model preparation, batch evaluation, and cleanup:

```python
# Minimal execution pattern in <model_prefix>_benchmark/benchmark.py
class BenchmarkRunner:
    """Core benchmark lifecycle adhering to thin-notebook standards."""
    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self.model = None
        self.dataset = []
        self._setup_env()

    def run_benchmark(self):
        """Loads data, prepares model/adapters, tests single inference, executes batch evaluation, and reports."""
        try:
            self.load_dataset()
            self.load_model()
            self.test_inference()  # Immediate validation of prompt & extraction before batch run
            results, accuracy, category_stats = self.run_evaluation()
            self.analyze_results(category_stats)
            if self.config.save_results:
                self.save_results(results, accuracy, category_stats)
            return results, accuracy, category_stats
        finally:
            self.cleanup()

    # Alias for pipeline execution
    run_complete_pipeline = run_benchmark
```

See [notebook-module-conventions.md](references/notebook-module-conventions.md) for complete multi-file implementations.

---

## Common Mistakes & Red Flags

| Red Flag | Consequence | Fix |
|---|---|---|
| **Unconstrained `max_model_len` in vLLM** | vLLM allocates massive KV cache for default context (e.g. 32k–128k), causing immediate `CUDA out of memory` or reducing concurrency to 1. | Explicitly cap `max_model_len=4096` or `8192` in `LLM()` config. See [vllm-engine-and-batching.md](references/vllm-engine-and-batching.md). |
| **Calling `.merge_and_unload()` on 4-bit model** | Corrupted weights or `RuntimeError: Quantized models do not support merge_and_unload`. | Load base model in unquantized `bfloat16`, attach adapter, then call `merge_and_unload()`. See [adapter-merging-and-eval.md](references/adapter-merging-and-eval.md). |
| **Setting `skip_special_tokens=True` on reasoning models** | Strips `<think>` and `</think>` tags, causing regex extractors to match exploratory tokens inside thought chains instead of final answers. | Set `skip_special_tokens=False` and split output on `</think>`. See [reasoning-models-and-thinking.md](references/reasoning-models-and-thinking.md). |
| **Right-padding in Transformers batch generation** | Generation starts over padding tokens, corrupting autoregressive positions and degrading accuracy. | Set `tokenizer.padding_side = "left"` before batch encoding. |
| **Naive dataset slicing (`data[:N]`)** | Severely biases category representation if dataset is ordered by topic. | Use stratified sampling with uniform category allocation and remainder balancing. See [metrics-analysis-and-reporting.md](references/metrics-analysis-and-reporting.md). |
| **Hardcoded prompt strings instead of `llm.chat()`** | Misses special prompt markers (`<\|im_start\|>`, `[INST]`, `<\|start_header_id\|>`) across architectures. | Format inputs as structured `[{"role": "user", ...}]` and call `llm.chat()`. |
| **Failing to clean up temporary merged models** | Gigabytes of merged checkpoints accumulate in `/tmp`, eventually causing disk full errors. | Register cleanup in `finally:` block or runner `cleanup()` method using `shutil.rmtree()`. |

---

## Supporting Reference Documentation

- [Notebook-Module Architecture & Package Conventions](references/notebook-module-conventions.md) — Complete package architecture (`config.py`, `dataset.py`, `benchmark.py`, `utils.py`), thin notebook dashboard examples, and multi-model abstractions.
- [High-Throughput Inference Engines & Batching Strategies](references/vllm-engine-and-batching.md) — vLLM PagedAttention configuration, KV cache sizing vs `max_model_len`, dynamic memory retry fallbacks, and Transformers left-padding rules.
- [Benchmarking Reasoning Models & Thinking Tokens](references/reasoning-models-and-thinking.md) — Handling `<think>` traces, bounded aggressive prompting, multi-stage answer parsing after `</think>`, and reasoning telemetry.
- [LoRA & QLoRA Adapter Merging for Benchmarking](references/adapter-merging-and-eval.md) — Safe 16-bit unquantized merging with `AutoPeftModelForCausalLM`, temporary directory lifecycle, and memory management.
- [Evaluation Metrics, Category Analysis & Standardized Reporting](references/metrics-analysis-and-reporting.md) — Stratified sampling with remainder distribution, multi-pattern regex extractors, micro vs macro category metrics, and hardware-tagged JSON/CSV export.
