# pydantic.mypy Plugin

Source: https://pydantic.dev/docs/validation/latest/integrations/dev-tools/mypy/

This repo has `plugins = ["pydantic.mypy"]` enabled and uses `BaseModel` + `Field(..., description=...)` extensively in `models/`. This file covers the plugin's behavior and gotchas.

## Enabling
```toml
[tool.mypy]
plugins = ["pydantic.mypy"]
```
For `pydantic.v1` models use `pydantic.v1.mypy`. Plugin settings live in a separate `[tool.pydantic-mypy]` section.

## What the plugin adds
- **Synthesizes a typed `__init__`** for Pydantic models (required fields become required keyword args). Without it, mypy misses untyped fields and mis-validates coerced args.
- **Typed `model_construct`** signature.
- **Frozen-model checks** (mutation errors).
- **Validates `Field(default=...)`/`default_factory`** types; errors if both are given.
- **Warns on untyped fields** (`[pydantic-field]` error code).
- **Required-dynamic-alias guard** (via `warn_required_dynamic_aliases`).

## Configuring
```toml
[tool.pydantic-mypy]
init_forbid_extra = true
init_typed = true
warn_required_dynamic_aliases = true
```
- `init_typed` — Pydantic coerces by default (`Model(a='1')` is valid), so the plugin uses `Any` for field types in `__init__` unless `init_typed` is set (or strict mode on).
- `init_forbid_extra` — Pydantic ignores extra args by default, so the plugin adds `**kwargs: Any` unless this is set (or `extra='forbid'`).
- **Gotcha:** strictness flags like `disallow_any_explicit` error on the synthesized `__init__`'s `Any` annotations — enable both `init_forbid_extra` and `init_typed` to avoid it.

## House-style interaction (this repo)
BaseModel fields are fully annotated with PEP 604 optionals and `Field(..., description=...)`:
```python
class SheetInfo(BaseModel):
    name: str = Field(..., description="Name of the worksheet.")
    min_row: int | None = Field(None, description="First used row (1-based), or None if empty.")
```
Because the plugin infers `__init__` types from field annotations, every field must carry a precise type — never leave a field untyped, or you get `[pydantic-field]` and lose constructor checking. Prefer typing each field over relying on defaults to imply types.
