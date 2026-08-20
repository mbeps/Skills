# Type Hinting Constructs (grounded in this repo)

Pyrefly fully supports modern PEP 484/604/695 typing plus Python 3.12 syntax. Below are the constructs this repo actually uses, plus the broader vocabulary Pyrefly handles.

## What this repo uses (house style)
- **`Optional[X]`** for nullable params/fields (this repo's dominant form; PEP 604 `X | None` is also valid and Pyrefly accepts both — match the file you're editing).
- **`List[...]` / `Dict[...]` / `Union[...]`** from `typing` dominate in schemas; builtin `list[...]`/`dict[...]` appear in some util files. Pyrefly accepts both.
- **`Field(..., description=...)`** on every Pydantic model field.
- **`Annotated[T, operator.add]`** for LangGraph state reducers (see below).
- **`Literal[...]`** for fixed string returns, e.g. `-> Literal["generator", "rewriter", "generate"]`.
- **`TypeAlias`** for reusable unions, e.g. `JsonValue` (recursive: `list["JsonValue"]` / `dict[str, "JsonValue"]`).
- **`cast()`** to bridge an untyped helper to a typed shape.
- **`Any`** only at genuine trust boundaries / third-party shims (e.g. `Dict[str, Any]` for unstructured chunk payloads, minio iterables). Never as a fallback for authored logic.
- **`from __future__ import annotations`** rarely used here (only where needed); fine to add when forward references get messy.

## Not used in this repo (available if genuinely needed)
- **`TypedDict`** — dict-shaped outputs/results. Use when you need a precise dict shape without validation/defaults.
- **`Protocol`** — structural subtyping / duck typing.
- **`TypeVar` / `Generic`** — reusable generic functions/classes.
- **`NewType`**, **`NotRequired`**, **`TypeGuard` / `TypeIs`**, **`ParamSpec`**, **`overload`** — advanced constructs; only introduce if a concrete need appears (YAGNI).

## Key patterns
### PEP 695 type aliases & generics (Python 3.12)
```python
type JsonValue = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
```
```python
type ListOrTuple[T] = list[T] | tuple[T, ...]
```

### `Annotated` with a reducer (LangGraph)
This repo uses `Annotated[T, callable]` for state reducers that merge values across nodes:
```python
from typing import Annotated
from pydantic import BaseModel, Field
import operator

class AgentState(BaseModel):
    visual_references: Annotated[
        list[dict[str, str | int | float | bool]], operator.add
    ] = Field(default_factory=list, description="Visual references to aggregate")
```

### `cast` to bridge untyped → typed
```python
from typing import cast
raw: object = get_untyped_thing()
typed: dict[str, str] = cast(dict[str, str], raw)
```
Use only to bridge an untyped boundary; don't cast redundantly (Pyrefly's "Remove redundant cast" quick fix flags those).

### Narrowing instead of `Any`
Avoid leaking `Any`: narrow with `isinstance` before returning, or use `TypeGuard`/`TypeIs` for custom guards.

### Empty-container inference
`x = []` then `x.append(1)`: Pyrefly (like mypy) infers `list[int]` from first use and flags a later `x.append("two")`. This is controlled by `infer-with-first-use` (default `true`); setting `false` behaves like Pyright (`list[Any]`).

## Config hooks for typing behavior
- `check-unannotated-defs` (default `true`) — check bodies of unannotated functions (≈ mypy `check_untyped_defs`).
- `infer-return-types` (`never|annotated|checked`) — when to infer return types.
- `strict-callable-subtyping` — strict param compatibility.
- `treat-all-caps-as-final` — re-assigning `ALL_CAPS` → `bad-assignment`.
