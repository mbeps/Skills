---
name: pyrefly
description: Use when writing or reviewing Python type annotations, when Pyrefly reports type errors, when configuring `[tool.pyrefly]` in pyproject.toml or a `pyrefly.toml`, when adding or updating typing constructs (TypedDict, TypeAlias, Literal, Protocol, TypeVar, cast, `# pyrefly: ignore`), or when choosing strictness presets. Pyrefly is the all-in-one replacement for Pylance/Pyright and mypy.
---

# Pyrefly

## Overview
Pyrefly is Meta's open-source **all-in-one Python type checker + language server**, written in Rust. It replaces the **IDE** role of **Pylance/Pyright** and the **CLI** role of **mypy** — one tool, one config, no plugin for Pydantic. It is faster (~1.8M lines/sec), spec-conformant (96.9% vs Pyright 93.4%, mypy 74.8%), and infers/inserts annotations (`pyrefly infer`) that mypy/Pyright cannot.

## When to Use
- Annotating or reviewing functions/classes — every `def` must be fully annotated.
- Pyrefly reports errors — map to error codes and fix idiomatically (`error-codes.md`).
- Configuring `[tool.pyrefly]` / `pyrefly.toml`, presets, `search-path`, `errors`.
- Choosing a data type: TypedDict vs BaseModel vs dataclass, unions, generics.
- Using `# pyrefly: ignore` / `pyrefly suppress` / baselines correctly.
- Migrating an existing mypy/Pyright/Pylance setup.

**When NOT to use:** trivial one-liners, or repos that don't run Pyrefly. This repo runs mypy **and** pyrefly in CI (`uv run pyrefly check`); the `meta.pyrefly` extension would power IDE checking. The mypy skill covers `[tool.mypy]`-only concerns (e.g. the `pydantic.mypy` plugin, which Pyrefly does **not** need).

## House Style (this repo — replicate these)
1. Pydantic `BaseModel` + `Field(..., description=...)`; required = `Field(..., ...)`, optional = `Field(None, ...)`, mutable container = `Field(default_factory=..., ...)`.
2. Config via `pydantic_settings.BaseSettings` + `SettingsConfigDict` (`env_file`, `extra="ignore"`, `env_ignore_empty`) with a module-level `settings` singleton.
3. `Optional[X]` / `List[...]` / `Dict[...]` / `Union[...]` from `typing` dominate here (Pyrefly also accepts PEP 604 `X | Y` and builtin `list[...]` — be consistent with the file you're editing).
4. LangGraph state reducers via `Annotated[T, operator.add]`.
5. `field_validator(..., mode="after")` on `@classmethod` for field normalization.
6. `Any` only at genuine trust boundaries / third-party shims — never as a fallback for authored logic.
7. `# pyrefly: ignore[error-code]` always names the code — never bare.
8. `from __future__ import annotations` only where needed (rare in this repo).

## Core Config (this repo)
```toml
[tool.pyrefly]
# root as search path so 'src.' prefixed imports resolve
search-path = ["."]
```
Pyrefly reads `pyrefly.toml` or `[tool.pyrefly]` in `pyproject.toml`. Run: `pyrefly check` (this repo runs `uv run pyrefly check` in CI). Full options, presets, precedence: `config.md`.

## Quick Reference
| Task | Do |
|---|---|
| Optional param | `x: Optional[int] = None` (or `int \| None`) |
| Validated schema | `class X(BaseModel)` with `Field(..., description=...)` |
| Config | `class Settings(BaseSettings)` + `SettingsConfigDict(env_file=".env", ...)` |
| LangGraph reducer | `x: Annotated[list[T], operator.add] = Field(default_factory=list)` |
| Reusable union | `Alias: TypeAlias = A \| B` (or `type Alias = A \| B` on 3.12) |
| Enum-like strings | `X = Literal["a", "b"]` |
| Silence a type error | `# pyrefly: ignore[<code>]` — always name the code |
| Bulk-suppress | `pyrefly suppress` (see `error-codes.md`) |
| Auto-annotate | `pyrefly infer src/` (see `cli.md`) |
| Run Pyrefly | `pyrefly check` (add `--summarize-errors`) |
| Coverage gate | `pyrefly coverage check src/ --fail-under 80` |

## Reference Files
- `config.md` — `pyrefly.toml`/`[tool.pyrefly]` options, strictness presets, precedence
- `cli.md` — install + all CLI commands/flags (`init`, `check`, `suppress`, `infer`, `coverage`, `lsp`, `dump-config`)
- `error-codes.md` — error codes + `# pyrefly: ignore`/`suppress`/baselines
- `types.md` — TypedDict, aliases, unions, generics, narrowing, `cast`, PEP 604/695
- `pydantic-support.md` — Pyrefly's built-in Pydantic v2 support (lax/strict modes)
- `ide.md` — VS Code/LSP setup, inlay hints, and migration from mypy/Pyright/Pylance
- `references.md` — official documentation URLs
