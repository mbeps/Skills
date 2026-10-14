# Fine-Tuning Recipes: PEFT, LoRA & QLoRA

## 1. LoRA vs. QLoRA Decision Matrix

| Dimension | 16-Bit LoRA | 4-Bit QLoRA (NormalFloat4) |
|---|---|---|
| **Base Model Precision** | FP16 or BF16 (16-bit weights) | NF4 (4-bit quantized weights via `bitsandbytes`) |
| **VRAM Consumption** | ~16–18 GB for 8B base model | ~5–7 GB for 8B base model |
| **Adapter Rank ($r$)** | 16 – 32 | 16 – 32 (use 24–32 for complex reasoning) |
| **Adapter Alpha ($\alpha$)** | $\alpha = 2 \times r$ (e.g. 32 or 48) | $\alpha = 2 \times r$ (keeps scaling factor $\alpha/r = 2.0$) |
| **Optimizer** | `adamw_torch` | `adamw_bnb_8bit` (cuts optimizer memory by 75%) |
| **Training Speed** | ~15–20% faster (no dequantization overhead) | Slightly slower due to on-the-fly NF4 dequantization |
| **Downstream Quality** | Baseline full fidelity | Identical to 16-bit for almost all instruction tasks |
| **Best Used For** | Multi-GPU clusters, unconstrained VRAM, rapid iteration | Consumer GPUs (RTX 3090/4090 24GB), 8B–70B models |

---

## 2. Production QLoRA Configuration

### Model Loading & Quantization Setup
```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

def setup_qlora_model(
    model_name: str,
    lora_r: int = 24,
    lora_alpha: int = 48,
    lora_dropout: float = 0.1,
    gradient_checkpointing: bool = True
):
    # 1. 4-bit Quantization Config (NormalFloat4)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    # 2. Tokenizer setup (Crucial: padding_side="right" for training)
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Load base model in 4-bit
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True
    )

    # 4. Prepare quantized model for k-bit training
    # Freezes base weights, casts layer norms to float32, enables input gradients
    model = prepare_model_for_kbit_training(
        model,
        use_gradient_checkpointing=gradient_checkpointing
    )

    # 5. LoRA Adapter Configuration
    # Target all linear projections for optimal performance across reasoning and domain tasks
    target_modules = [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ]

    peft_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=lora_dropout,
        target_modules=target_modules,
        bias="none",
        task_type="CAUSAL_LM"
    )

    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    return model, tokenizer
```

---

## 3. Standard 16-Bit LoRA Setup

For unquantized 16-bit LoRA (when VRAM allows or when training speed is paramount):

```python
def setup_lora_16bit_model(
    model_name: str,
    lora_r: int = 16,
    lora_alpha: int = 32,
    gradient_checkpointing: bool = True
):
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )

    # For 16-bit models, DO NOT call prepare_model_for_kbit_training!
    if gradient_checkpointing:
        model.enable_input_require_grads()
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})

    peft_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none",
        task_type="CAUSAL_LM"
    )
    return get_peft_model(model, peft_config), tokenizer
```

---

## 4. TRL SFTTrainer & Sequence Packing

Sequence packing concatenates multiple short sequences into a single context window up to `max_length`, eliminating 60–80% of compute wasted on pad tokens.

```python
from trl import SFTConfig, SFTTrainer

def create_sft_trainer(model, tokenizer, train_dataset, config):
    training_args = SFTConfig(
        output_dir=config.output_dir,
        per_device_train_batch_size=config.batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        learning_rate=config.learning_rate,
        num_train_epochs=config.num_epochs,
        max_length=config.max_length,  # Note: Use max_seq_length in older TRL versions if max_length is not recognized
        lr_scheduler_type=config.lr_scheduler_type,
        warmup_ratio=0.1,
        logging_steps=10,
        save_strategy="epoch",
        save_total_limit=2,
        fp16=False,
        bf16=torch.cuda.is_bf16_supported(),
        # Sequence packing config
        packing=True,
        # Optimizer selection: 8-bit AdamW for 4-bit QLoRA
        optim="adamw_bnb_8bit" if config.load_in_4bit else "adamw_torch",
        # Critical for LoRA + DDP / Checkpointing compatibility
        gradient_checkpointing=config.gradient_checkpointing,
        gradient_checkpointing_kwargs={"use_reentrant": False}
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        dataset_text_field="text",
        args=training_args
    )
    return trainer
```

---

## 5. Chat Templates & Reasoning Traces

### Using `apply_chat_template`
Always format conversation turns through the model's native chat template rather than building raw string templates:

```python
def format_chat_example(tokenizer, question: str, answer: str, system_prompt: str = None) -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": question})
    messages.append({"role": "assistant", "content": answer})

    # Returns formatted string including special tokens (<|im_start|>, <|im_end|>, etc.)
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
```

### Chain-of-Thought & Thinking Tokens (`<think>`)
When fine-tuning reasoning models (like Qwen 2.5/3 or DeepSeek):
1. Wrap reasoning traces inside `<think>...</think>` tags in assistant responses.
2. In mixed datasets, preserve thinking tags on complex math/reasoning tasks while omitting them on simple lookup tasks.
3. For thinking-enabled models, increase `max_length` from 512 up to 1536–2048 to prevent truncating reasoning steps.
