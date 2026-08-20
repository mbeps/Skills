# Built-in Pydantic Support

Pyrefly ships **built-in Pydantic v2 support** — no plugin, no manual config (unlike mypy, which needs `plugins = ["pydantic.mypy"]`). This repo's `[tool.mypy]` still uses the pydantic plugin for mypy, but Pyrefly runs `pyrefly check` with only `search-path = ["."]`.

Requires **pyrefly ≥ 0.33.0**. Supports Pydantic v2+ only (deprecated v1 features are not included).

## What it understands
- `BaseModel`, `Field`, `ConfigDict`, and model-level config.
- `pydantic_settings.BaseSettings` (used in this repo for `src/config/settings.py`).
- `@pydantic.dataclasses.dataclass`.

Pyrefly inspects your model config directly (e.g. `strict=True`, `extra='forbid'`) to mirror Pydantic's runtime validation and minimize false positives.

## Validation modes
- **Lax (default)**: values coerced when possible, e.g. `"123"` → int.
- **Strict**: only exactly matching types accepted.

Pyrefly reads the model config to determine which mode applies.

## Lax mode / named union types
In lax mode, Pyrefly represents a field's acceptable **input** types as named unions. An `int` field becomes `LaxInt` ≡ `int | bool | float | str | bytes | Decimal`. Named unions apply to atomic types and **recursively to nested types**; containers generalize, e.g. `list[int]` → `Iterable[LaxInt]`; unions like `int | bool` are expanded per-member then flattened.

Practical consequence: assigning a plain `int`/`float`/`str` to an `int` field type-checks in lax mode. This is intentional and mirrors Pydantic runtime coercion — don't "fix" it unless you mean strict mode.

## Supported features
- Immutable fields: `ConfigDict(frozen=True)`.
- Strict vs non-strict field validation.
- Extra fields (Pydantic v2 default `extra='ignore'`).
- Field constraints (limited range support).
- `RootModel`, e.g. `RootModel[int]`, `RootModel[StrictInt]`.
- Alias validation: `validate_by_name=True`, `validate_by_alias=True`.

## NOT yet supported
- **Alias Generators** — Pyrefly does not recognize `alias_generator` / `AliasGenerator` set via `ConfigDict`; fields are type-checked by their original names rather than generated aliases. If you rely on `alias_generator`, type-check against the field names.

## Pydantic settings (this repo's config pattern)
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "Agentic RAG Service"
    OPENAI_API_KEY: Optional[str] = None

    @field_validator("OPENAI_API_KEY", mode="after")
    @classmethod
    def _strip_api_key(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip().strip('"').strip("'")
        return value or None

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8",
        case_sensitive=False, extra="ignore", env_ignore_empty=True,
    )
```
Pyrefly type-checks `BaseSettings` fields and `field_validator` signatures without any plugin.
