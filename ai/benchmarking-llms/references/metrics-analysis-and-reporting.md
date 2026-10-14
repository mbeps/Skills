# Evaluation Metrics, Category Analysis & Standardized Reporting

## Overview

Accurate LLM benchmarking requires objective scoring, category balance, and verifiable audit trails. Ad-hoc string comparisons or naive regex searches fail when models introduce conversational filler, markdown formatting (`**A**`), or multilingual response structures.

This guide details stratified dataset sampling, multi-pattern answer parsing, category-level metric aggregation, and standardized JSON/CSV report serialization.

---

## 1. Uniform Stratified Sampling

When evaluating on a subset of a large benchmark (e.g. 1,000 samples out of 10,000), naive slicing (`data[:1000]`) frequently skews category representation, favoring categories indexed first in the file.

Uniform stratified sampling balances representation across all task categories while handling integer division remainders deterministically:

```python
"""
Stratified sampling with remainder distribution.
"""

import random
from collections import defaultdict
from typing import Any, Dict, List


def create_uniform_category_subset(
    dataset: List[Dict[str, Any]],
    n_samples: int,
    seed: int = 42,
    category_key: str = "category",
) -> List[Dict[str, Any]]:
    """
    Selects n_samples with equal representation across all categories in the dataset.
    Redistributes shortfall from small categories across remaining categories to ensure exact sample count.
    """
    random.seed(seed)
    if not dataset or len(dataset) <= n_samples or category_key not in dataset[0]:
        return random.sample(dataset, min(len(dataset), n_samples))

    # Group by category
    category_map = defaultdict(list)
    for sample in dataset:
        category_map[sample[category_key]].append(sample)

    categories = sorted(category_map.keys())
    num_cats = len(categories)
    base_per_cat = n_samples // num_cats
    remainder = n_samples % num_cats

    selected = []
    remaining_pool = []
    for i, cat in enumerate(categories):
        quota = base_per_cat + (1 if i < remainder else 0)
        available = category_map[cat]
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
```

---

## 2. Multi-Pattern Robust Answer Extraction

LLMs produce diverse answer formats despite strict zero-shot system prompts. Robust extraction uses prioritized regular expressions:

```python
"""
Prioritized regular expression answer extractor.
"""

import re
from typing import List


def extract_answer_robust(output: str, valid_options: str = "ABCDE") -> str:
    """
    Extracts the chosen option letter from raw model output using prioritized patterns.
    Guarantees word-boundary isolation so prefix words like 'letter' never partially match inside 'lettera'.
    """
    if not output or not output.strip():
        return ""

    text = output.strip()

    # Priority 1: Direct formatted option markers: 'A)', 'A.', 'A:'
    for pattern in [r"\b([ABCDE])\)", r"\b([ABCDE])\.", r"\b([ABCDE]):"]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match and match.group(1).upper() in valid_options:
            return match.group(1).upper()

    # Priority 2: Explicit prefix markers (multilingual: English & Italian)
    # Using isolated keyword word-boundaries prevents false matching of 'a' in 'lettera'
    prefix_patterns = [
        r"\b(?:lettera|letter|answer|risposta|option|opzione|choice|scelta)\b[:\s]*([ABCDE])\b",
        r"(?:the correct answer is|la risposta corretta è)[:\s]*([ABCDE])\b",
    ]
    for pattern in prefix_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match and match.group(1).upper() in valid_options:
            return match.group(1).upper()

    # Priority 3: Markdown emphasized letter: '**A**' or '*A*'
    for pattern in [r"\*\*([ABCDE])\*\*", r"\*([ABCDE])\*"]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match and match.group(1).upper() in valid_options:
            return match.group(1).upper()

    # Priority 4: Standalone isolated uppercase letter (case-sensitive to avoid matching English 'a' or Italian 'a')
    match = re.search(r"\b([A-E])\b", text)
    if match and match.group(1) in valid_options:
        return match.group(1)

    # Priority 5: Fallback scan for single occurrences of valid letters
    candidates = [char for char in valid_options if char in text]
    if len(candidates) == 1:
        return candidates[0]

    return ""
```

---

## 3. Metrics Aggregation: Micro vs. Macro Accuracy

When categories have differing counts (e.g. syntax: 980 questions, morphology: 140 questions), both **Micro Average** and **Macro Average** provide vital insight:

* **Micro Average (Overall Accuracy):**
  $$\text{Micro Accuracy} = \frac{\sum \text{Correct Across All Categories}}{\sum \text{Total Questions Across All Categories}}$$
* **Macro Average (Balanced Accuracy):**
  $$\text{Macro Accuracy} = \frac{1}{K} \sum_{k=1}^K \text{Category Accuracy}_k$$

### Standard Terminal Report Table

```python
from typing import Dict

def print_category_evaluation_table(category_stats: Dict[str, Dict[str, int]]) -> Dict[str, float]:
    """
    Renders an ASCII performance table and returns aggregated accuracy metrics.
    """
    print(f"\n{'=' * 65}")
    print(f"{'Category':30s} {'Accuracy':>12s} {'Correct / Total':>18s}")
    print(f"{'=' * 65}")

    total_correct = sum(s["correct"] for s in category_stats.values())
    total_samples = sum(s["total"] for s in category_stats.values())
    micro_accuracy = (total_correct / total_samples * 100) if total_samples > 0 else 0.0

    category_accuracies = []
    for cat, s in sorted(category_stats.items()):
        c, t = s["correct"], s["total"]
        acc = (c / t * 100) if t > 0 else 0.0
        category_accuracies.append(acc)
        print(f"{cat:30s} {acc:11.2f}% {c:>8d} / {t:<8d}")

    macro_accuracy = sum(category_accuracies) / len(category_accuracies) if category_accuracies else 0.0

    print(f"{'-' * 65}")
    print(f"{'MICRO ACCURACY (Overall)':30s} {micro_accuracy:11.2f}% {total_correct:>8d} / {total_samples:<8d}")
    print(f"{'MACRO ACCURACY (Balanced)':30s} {macro_accuracy:11.2f}%")
    print(f"{'=' * 65}\n")

    return {"micro_accuracy": micro_accuracy, "macro_accuracy": macro_accuracy}
```

---

## 4. Standardized Output Serialization

To enable cross-run comparisons and regression tracking, benchmark outputs must produce both per-sample raw predictions (CSV) and structured experiment metadata (JSON) tagged with the executing GPU architecture:

```python
"""
Structured reporting serializers for LLM benchmarks.
"""

import json
import os
from typing import Any, Dict, List, Tuple
import pandas as pd


def export_benchmark_artifacts(
    output_prefix: str,
    results: List[Dict[str, Any]],
    summary_data: Dict[str, Any],
    gpu_suffix: str = "gpu",
    output_dir: str = "./results"
) -> Tuple[str, str]:
    """
    Exports CSV and JSON artifacts tagged with hardware architecture.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Per-Sample Detailed CSV
    csv_filename = os.path.join(output_dir, f"{output_prefix}_{gpu_suffix}_results.csv")
    df = pd.DataFrame(results)
    df.to_csv(csv_filename, index=False)
    print(f"📄 Raw evaluation CSV: {csv_filename}")

    # 2. Structured JSON Summary
    json_filename = os.path.join(output_dir, f"{output_prefix}_{gpu_suffix}_summary.json")
    with open(json_filename, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    print(f"📊 Metadata JSON summary: {json_filename}")

    return csv_filename, json_filename
```
