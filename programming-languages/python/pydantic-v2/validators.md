# Validators — reference

`field_validator`, `model_validator`, and `computed_field`. Not used in this repo
(see `house-style.md`) — reference only.

## field_validator

```python
from pydantic import field_validator

class M(BaseModel):
    x: int

    @field_validator('x', mode='before')
    @classmethod
    def parse_x(cls, v):
        return int(v)
```

- `mode`: `'before'` | `'after'` (default) | `'wrap'` | `'plain'`.
- `'*'` targets all fields.
- `check_fields=False` for base-class validators where fields aren't on the class.
- Validators **do NOT run on defaults** unless `validate_default=True`.
- To raise, use `raise ValueError`, `raise AssertionError`, or
  `raise PydanticCustomError(...)`.

## model_validator

```python
from typing import Self
from pydantic import model_validator

class M(BaseModel):
    @model_validator(mode='before')
    @classmethod
    def pre(cls, data: Any):
        return data

    @model_validator(mode='after')
    def post(self) -> Self:
        # MUST return self (or Self)
        return self
```

- `mode='before'` is a classmethod taking raw `data: Any`.
- `mode='after'` is an **instance method and MUST return `self` / `Self`**.
- `mode='wrap'` gets a `handler` callable; call `handler(data)` to continue.

## computed_field

```python
from pydantic import computed_field

class M(BaseModel):
    x: int

    @computed_field
    @property
    def doubled(self) -> int:
        return self.x * 2
```

- Put `@computed_field` over a `@property`.
- **Explicit return annotation is required** — it drives the JSON schema.
- Included in `model_dump` / `model_dump_json` and the JSON schema.
- `computed_field(exclude_if=...)` is **v2.13-only** — do NOT claim it for 2.12.
