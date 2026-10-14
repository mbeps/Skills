# Chat Templates, Reasoning Models & Tokenizer Best Practices

## Overview

Modern instruction-tuned and reasoning Large Language Models (LLMs) rely on specific prompt token formatting (e.g., ChatML for Qwen, Llama 3 header tokens `<|start_header_id|>`, Mistral `[INST]` markers).

Hardcoding prompt strings with manual concatenations is brittle, error-prone, and destroys reusability across models. Instead, modern pipelines rely on **Hugging Face Native Chat Templates** (`tokenizer.apply_chat_template`) paired with configurable **Chain-of-Thought / Reasoning modes**.

---

## 1. Native Chat Templates (`apply_chat_template`)

### The Standard Conversational Schema
All diverse dataset formats should be normalized into a standard list of message dictionaries:
```python
messages = [
    {"role": "system", "content": "You are an expert medical assistant."},
    {"role": "user", "content": "What are the common symptoms of acute bronchitis?"},
    {"role": "assistant", "content": "Common symptoms include persistent cough, fatigue, and mild fever."}
]
```

### Applying the Template
```python
formatted_text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,                # Returns the formatted string
    add_generation_prompt=False    # False for training; True for inference
)
```

### Why Manual String Formatting Fails Across Model Families
| Model Family | System Prompt Header | Turn Delimiters | End of Turn / Sequence |
|---|---|---|---|
| **Llama 3 / 3.1** | `<|start_header_id|>system<|end_header_id|>` | `<|eot_id|>` | `<|end_of_text|>` |
| **Qwen 2.5 / 3** | `<|im_start|>system` | `<|im_start|>user`, `<|im_start|>assistant` | `<|im_end|>` |
| **Mistral / Magistral**| Inside initial `[INST]` block | `[INST] ... [/INST]` | `</s>` |
| **Gemma 2** | `<start_of_turn>user` | `<start_of_turn>model` | `<end_of_turn>` |

By calling `tokenizer.apply_chat_template()`, the same codebase automatically formats prompts correctly for **any** supported model family without modifying pipeline logic.

---

## 2. Multi-Schema Dataset Normalizer

In production pipelines, datasets arrive in different schemas (raw `messages`, Alpaca instruction/input/output, or multiple-choice questions with options). The normalizer converts any of these into a unified chat format:

```python
from typing import Dict, Any, List
from enum import Enum

class ThinkingMode(str, Enum):
    ENABLED = "enabled"    # Enforce <think> reasoning trace on all examples
    DISABLED = "disabled"  # Strip reasoning trace and train on direct answers only
    MIXED = "mixed"        # Use reasoning if present in the data, direct answer otherwise

def normalize_example_to_messages(
    example: Dict[str, Any], 
    thinking_mode: ThinkingMode = ThinkingMode.DISABLED
) -> List[Dict[str, str]]:
    """Normalizes any dataset schema into standard chat messages."""
    
    # 1. Already in messages schema
    if "messages" in example:
        return example["messages"]

    # 2. Question / Options / Answer schema
    if "question" in example:
        user_content = example["question"]
        if "options" in example and example["options"]:
            options = example["options"]
            options_lines = []
            for opt in options:
                if isinstance(opt, dict):
                    options_lines.append(f"{list(opt.keys())[0]}) {list(opt.values())[0]}")
                else:
                    options_lines.append(str(opt))
            user_content += "\n\n" + "\n".join(options_lines)
            
        answer = example.get("answer", "")
        thinking = example.get("thinking", None)
        
        use_thinking = (
            thinking_mode == ThinkingMode.ENABLED or 
            (thinking_mode == ThinkingMode.MIXED and thinking is not None)
        )
        if use_thinking and thinking:
            assistant_content = f"<think>\n{thinking.strip()}\n</think>\n\n{answer.strip()}"
        else:
            assistant_content = answer.strip()
            
        return [
            {"role": "user", "content": user_content.strip()},
            {"role": "assistant", "content": assistant_content.strip()}
        ]

    # 3. Instruction / Input / Output schema (Alpaca)
    if "instruction" in example:
        user_content = example["instruction"]
        if example.get("input"):
            user_content += f"\n\n{example['input']}"
        return [
            {"role": "user", "content": user_content.strip()},
            {"role": "assistant", "content": example.get("output", "").strip()}
        ]

    raise ValueError(f"Unknown data schema: keys={list(example.keys())}")
```

---

## 3. Supporting Reasoning & Chain-of-Thought (`<think>` Tags)

Models like Magistral, Qwen 2.5/3, and DeepSeek-R1 output reasoning traces inside `<think>...</think>` tokens before outputting final answers.

When applying chat templates on reasoning-capable models:
```python
def format_chat_prompt(
    example: dict, 
    tokenizer: Any, 
    thinking_mode: ThinkingMode = ThinkingMode.DISABLED
) -> str:
    messages = normalize_example_to_messages(example, thinking_mode)
    use_thinking = (thinking_mode != ThinkingMode.DISABLED)
    
    # Pass enable_thinking if supported by tokenizer (e.g. Qwen), otherwise standard call
    try:
        return tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=False,
            enable_thinking=use_thinking
        )
    except TypeError:
        return tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=False
        )
```

---

## 4. Tokenizer Padding & Direction Rules

Misconfigured tokenizer padding is the **#1 source of silent training and evaluation bugs**.

### 1. Training Mode Padding: RIGHT
During training with `SFTTrainer` (or causal language modeling without packing), padding must be on the **right**:
```python
tokenizer.padding_side = "right"
```
**Why:** Causal language models mask future tokens with an upper triangular mask. If padding is on the left during training, positional embeddings become shifted and attention masks can cause the loss to be computed over padding tokens.

### 2. Inference & Batch Generation Padding: LEFT
During autoregressive batch generation with `.generate()`, padding must be on the **left**:
```python
tokenizer.padding_side = "left"
```
**Why:** Autoregressive generation appends new tokens to the rightmost edge of the sequence. If padding is on the right, the generation starts after the padding tokens instead of immediately after the prompt!

### 3. Setting Missing Pad Tokens
Many open-weights tokenizers (e.g. Llama, Mistral) do not define an explicit `pad_token`:
```python
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.pad_token_id = tokenizer.eos_token_id

if getattr(model.config, "pad_token_id", None) is None:
    model.config.pad_token_id = tokenizer.pad_token_id
```

### 4. Handling Slow vs. Fast Tokenizer Conversion
Some models (e.g. Mistral/Magistral) have custom regex tokenizers that can fail with Hugging Face fast tokenizers (`tokenizers` Rust backend).

**Defensive loading pattern:**
```python
try:
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        token=hf_token,
        use_fast=False  # Try slow tokenizer first if fast fails
    )
except Exception:
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        token=hf_token
    )
```

---

## 5. Dataset Distribution Analysis Pattern

Before starting training, always inspect category balance, token lengths, and answer distributions to catch dataset imbalance before burning GPU compute:

```python
from collections import defaultdict
from typing import List, Dict, Any

def analyze_dataset_distribution(data: List[Dict[str, Any]], dataset_name: str = "Dataset") -> None:
    categories = defaultdict(int)
    answers = defaultdict(int)
    has_thinking = 0
    
    for row in data:
        if "category" in row:
            categories[row["category"]] += 1
        if "answer" in row:
            answers[row["answer"]] += 1
        if row.get("thinking"):
            has_thinking += 1
            
    print(f"\n📊 {dataset_name} Summary:")
    print(f"Total Examples:      {len(data)}")
    if categories:
        print(f"Categories ({len(categories)}):   {dict(categories)}")
    if answers:
        print(f"Answer Distribution: {dict(sorted(answers.items()))}")
    if has_thinking > 0:
        print(f"Reasoning Examples:  {has_thinking} ({has_thinking / len(data) * 100:.1f}%)")
```
