---
name: mypy
description: Use when writing or reviewing Python type annotations, when mypy reports type errors, when adding or updating typing constructs (TypedDict, TypeAlias, Literal, Protocol, TypeVar, cast, type: ignore), or when configuring `[tool.mypy]` in pyproject.toml. Also use when deciding between a TypedDict, dataclass, or Pydantic model for a data shape.
---

# Mypy & Type Hinting

## Overview
Write Python type annotations that satisfy the project's mypy profile (not just any annotations). The skill is grounded in the real mypy config and house style of this repo (`src/mcp_server/`): a curated medium-strictness profile with `pydantic.mypy` plugin and per-module overrides for third-party numeric libs. Reference files hold the detail; this file is the entry point.

## When to Use
- Annotating new or modified functions/classes (every def must be fully annotated).
- mypy reports errors — map them to error codes and fix idiomatically (see `error-codes.md`).
- Choosing a type: TypedDict vs dataclass vs Pydantic model.
- Configuring `[tool.mypy]` / `[[tool.mypy.overrides]]`.
- Using `# type: ignore` or `cast()` correctly.

**When NOT to use:** trivial one-line scripts, or when the codebase does not run mypy. Tests are excluded from mypy here — do not copy conventions from `tests/`.

## House Style (this repo — replicate these)
1. `from __future__ import annotations` at the top of every module.
2. **Every def is fully annotated** (params + return) — mandatory per `disallow_untyped_defs`/`disallow_incomplete_defs`.
3. **PEP 604 unions**: `int | None`, never `Optional[int]`; never implicit-optional params.
4. **TypedDict = dict-shaped output/result**; **BaseModel = schema needing validation/defaults/`Field(...)`**; both live in `models/`.
5. Named string constants via module-level `X = Literal[...]`; dispatch `Literal[...]` written inline on route params (multi-line when long).
6. `# type: ignore` **always with an explicit error code** (`# type: ignore[arg-type]`), never bare.
7. `cast()` only to bridge an untyped helper to a typed shape — never redundantly.
8. `Any` confined to test stubs / pass-throughs (`Callable[..., Any]`); avoid in return positions.
9. Reusable unions via `CellScalar: TypeAlias = str | int | ...`.
10. Built-in lowercase generics (`list[str]`, `dict[str, float]`, `tuple[str, ...]`) — no `typing.List`/`typing.Dict`.
11. Required-then-optional keys modeled with a private `TypedDict` base + `total=False` subclass (instead of `NotRequired`).
12. Small pragmatic vocabulary: no `NewType`, `Protocol`, `TypeVar`, `NotRequired` unless actually needed (YAGNI).

## Core Config (this repo)
```toml
[tool.mypy]
plugins = ["pydantic.mypy"]
python_version = "3.12"
strict = false
warn_return_any = true
warn_unused_ignores = true
warn_redundant_casts = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
no_implicit_optional = true
ignore_missing_imports = true
exclude = ["tests/"]

[[tool.mypy.overrides]]
module = ["openpyxl.*", "pandas.*", "scipy.*", "statsmodels.*", "numpy_financial.*", "calamine.*"]
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = ["dateutil.*"]
ignore_missing_imports = true
```
Full flag meanings, `strict` semantics, per-module overrides, and gotchas: `config.md`.

## Quick Reference
| Task | Do |
|---|---|
| Optional param | `x: int \| None = None` (never `Optional[int]`) |
| Dict-shaped output | `class X(TypedDict)` in `models/` |
| Validated schema | `class X(BaseModel)` with `Field(..., description=...)` |
| Reusable union | `Alias: TypeAlias = A \| B` (or `type Alias = A \| B` on 3.12) |
| Enum-like strings | `X = Literal["a", "b"]` |
| Silence a type error | `# type: ignore[<code>]` — always name the code |
| Bridge untyped→typed | `cast(dict[str, T], untyped_value)` |
| Avoid leaking `Any` | `assert isinstance(x, T)` / narrow before returning |
| Run mypy | `uv run mypy src/mcp_server` |

## Reference Files
- `config.md` — all mypy flags, `strict` semantics, overrides, precedence, gotchas
- `error-codes.md` — common error codes + idiomatic fix for each
- `types.md` — TypedDict, type aliases, NewType, TypeVar/Generic/ParamSpec/Protocol/overload, PEP 604/695
- `narrowing.md` — avoiding `Any`, narrowing, `cast`, `TypeGuard`/`TypeIs`, `Never`
- `pydantic-plugin.md` — pydantic.mypy plugin settings and gotchas
- `migration.md` — gradual typing, `# type: ignore` discipline, `reveal_type`
- `references.md` — official documentation URLs

## Common Mistakes
- **Bare `# type: ignore`** — hides all errors on the line and trips `warn_unused_ignores`. Always name the code.
- **`Optional[X]` for "has a default"** — `Optional` means `None` is a valid *value*, not "has a default".
- **`strict = true` assumed to enable everything** — it does not enable `warn_unreachable` or `strict_equality`, and an explicit flag overrides `strict`.
- **`ignore_missing_imports` override matching the wrong name** — in an override it matches the *imported* module, not the importing file.
- **Unparameterized container returns** (bare `dict`, `list`) — push the typing burden onto every caller; use `dict[str, T]`.
- **`cast()` to the already-inferred type** — `[redundant-cast]` under `warn_redundant_casts`.
- **Overload variants ordered wrong** — "first variant wins"; order most-specific first.
- **Protocol attributes are invariant** — use `@property` for read-only to accept narrower types.

## Anti-Patterns in This Repo (avoid)
- `models/financial.py` is a stub (docstring-only, promised TypedDicts absent) — don't replicate empty model files; implement the TypedDicts or delete.
- `load_hidden_json` returns bare `dict`, forcing `cast()` at call sites — parameterize containers at the source.
- Raw `Any` outside test stubs — keep it contained.

**REQUIRED SUB-SKILL:** Use `programming-languages/python/pydantic-v2` when writing Pydantic models — this skill covers only the mypy/typing layer, not Pydantic validation patterns.
