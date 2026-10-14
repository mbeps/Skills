# Benchmarking Reasoning Models & Thinking Tokens

## Overview

Reasoning models (e.g. Qwen 2.5/3 Thinking, DeepSeek-R1, Magistral Reasoning) generate an explicit internal monologue or Chain-of-Thought (CoT) enclosed within `<think>...</think>` tokens prior to generating their final answer.

Evaluating reasoning models introduces distinct engineering challenges:
1. **Answer Extraction Pollution:** If regular expressions match tokens inside the thinking monologue, they frequently capture exploratory hypothesis letters (e.g. *"Could it be A? No, because..."*) rather than the model's actual verdict.
2. **Runaway Thinking Loops:** On objective benchmarks, unconstrained reasoning models can generate 2,000+ thinking tokens per question, causing evaluations to run 10× slower or exceed max token limits before outputting the final answer.
3. **Token Stripping Pitfall:** Passing `skip_special_tokens=True` strips the `<think>` boundary tags, making it impossible to separate the internal monologue from the final answer.

---

## 1. Controlling Reasoning in vLLM

### Sampling Parameters & Special Tokens
For reasoning models, configure sampling to prevent token stripping and use standard reasoning hyperparameters:

```python
from vllm import SamplingParams

sampling_params = SamplingParams(
    temperature=0.6,          # Optimal exploration temperature for reasoning models
    top_p=0.95,
    top_k=20,
    max_tokens=600,           # Generous budget for reasoning trace + final letter
    skip_special_tokens=False # CRITICAL: Retain <think> and </think> tags in output!
)
```

### Passing `chat_template_kwargs`
vLLM supports native reasoning toggle flags via `chat_template_kwargs`:

```python
# Enable reasoning mode in vLLM batch chat
outputs = llm.chat(
    batch_messages,
    sampling_params=sampling_params,
    use_tqdm=False,
    chat_template_kwargs={"enable_thinking": True}  # Enforce thinking generation
)

# Or explicitly disable thinking to benchmark zero-shot baseline capability
outputs_baseline = llm.chat(
    batch_messages,
    sampling_params=sampling_params,
    use_tqdm=False,
    chat_template_kwargs={"enable_thinking": False}
)
```

---

## 2. Bounding Reasoning: Aggressive Prompting

To prevent reasoning models from deliberating excessively on simple multiple-choice questions, employ **bounded aggressive prompt directives**:

```python
def configure_reasoning_prompt(
    question_data: dict,
    system_message: str = "You are an expert reasoning assistant."
) -> tuple:
    category = question_data.get("category", "general")
    question = question_data["question"]
    formatted_options, letters = format_options(question_data["options"])
    expected_answer = question_data["answer"]

    user_content = f"""Answer the following multiple-choice question on '{category}'.

{question}

{formatted_options}

CRITICAL INSTRUCTIONS:
1. Think quickly and concisely — maximum 3-5 sentences of reasoning!
2. Do not dwell or overthink simple definitions.
3. You MUST conclude your response with 'FINAL: X' where X is one of [{letters}].

Reason briefly and give your answer NOW:"""

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_content}
    ]
    return messages, expected_answer
```

---

## 3. Multi-Stage Answer Extraction Pipeline

Never apply generic regexes directly across the entire output when reasoning tokens are present. Always split on `</think>` first:

```python
"""
Multi-stage answer parser designed for reasoning models with <think> traces.
"""

import re
from typing import List, Tuple


def extract_answer_with_reasoning(output: str) -> str:
    """
    Extracts the multiple choice letter from a model output containing reasoning tags.
    Prioritizes post-thinking tokens, then explicit conclusion markers, then formatted letter fallbacks.
    Safeguards against matching prose words (e.g. English article 'a' or Italian 'a').
    """
    if not output or not output.strip():
        return ""

    raw_text = output.strip()

    # Stage 1: Separate thinking trace from post-thinking verdict
    if "</think>" in raw_text:
        parts = raw_text.split("</think>")
        post_thinking = parts[-1].strip()

        # 1a. Explicit conclusion phrases in post-thinking content
        post_explicit = [
            r"\b(?:FINAL|FINALE|final answer|risposta finale)\b[:\s]*([ABCDE])\b",
            r"(?:the correct answer is|la risposta corretta è)[:\s]*([ABCDE])\b",
            r"\b(?:lettera|letter|risposta|answer|opzione|option)\b[:\s]*([ABCDE])\b",
            r"^([ABCDE])$",               # Exact single letter on line
            r"^([ABCDE])\b",              # Letter at start of line
            r"\*\*([ABCDE])\*\*",         # Bolded markdown letter
        ]
        for pattern in post_explicit:
            match = re.search(pattern, post_thinking, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).upper()

        # 1b. Standalone isolated uppercase letter in post-thinking (case-sensitive)
        match = re.search(r"\b([A-E])\b", post_thinking)
        if match:
            return match.group(1)

    # Stage 2: Scan full text for explicit final answer assertions
    full_text_patterns = [
        r"\b(?:FINAL|FINALE|final answer|risposta finale)\b[:\s]*([ABCDE])\b",
        r"(?:the correct answer is|la risposta corretta è)[:\s]*([ABCDE])\b",
        r"\b(?:therefore|quindi|pertanto)[,\s]*([ABCDE])\b",
        r"\b(?:lettera|letter|risposta|answer|opzione|option|choice|scelta)\b[:\s]*([ABCDE])\b",
    ]
    for pattern in full_text_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Stage 3: Inspect the trailing 3 lines for markdown emphasis or standalone letters
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    for line in reversed(lines[-3:]):
        for pat in [r"\*\*([ABCDE])\*\*", r"\*([ABCDE])\*"]:
            match = re.search(pat, line, re.IGNORECASE)
            if match:
                return match.group(1).upper()
        # Case-sensitive standalone letter on short line
        if len(line) <= 15:
            match = re.search(r"\b([A-E])\b", line)
            if match:
                return match.group(1)

    # Stage 4: Fallback to last occurrence of a formatted letter
    fallback_matches = list(re.finditer(r"\b([ABCDE])\)", raw_text, re.IGNORECASE))
    if fallback_matches:
        return fallback_matches[-1].group(1).upper()

    return ""
```

---

## 4. Reasoning Telemetry & Quality Tracking

In addition to standard accuracy, benchmark runners should track reasoning statistics:

```python
def analyze_reasoning_metrics(results: list) -> dict:
    """
    Computes reasoning coverage and token statistics across benchmark results.
    """
    total = len(results)
    if total == 0:
        return {}

    thinking_samples = [
        r for r in results 
        if "<think>" in r.get("raw_response", "") and "</think>" in r.get("raw_response", "")
    ]
    thinking_count = len(thinking_samples)
    thinking_percentage = (thinking_count / total) * 100

    # Calculate average reasoning length (character count between <think> tags)
    reasoning_lengths = []
    for r in thinking_samples:
        raw = r["raw_response"]
        start = raw.find("<think>") + len("<think>")
        end = raw.find("</think>")
        if start < end:
            reasoning_lengths.append(end - start)

    avg_reasoning_chars = (sum(reasoning_lengths) / len(reasoning_lengths)) if reasoning_lengths else 0

    return {
        "total_evaluated": total,
        "questions_with_thinking": thinking_count,
        "thinking_percentage": thinking_percentage,
        "avg_reasoning_chars": avg_reasoning_chars
    }
```
