---
name: pydantic-v2
description: Use when writing, reading, or refactoring Pydantic v2 code — BaseModel classes, Field() declarations, validation, model_dump / model_dump_json serialization, TypedDict outputs, TypeAdapter, field_validator / model_validator, ConfigDict, discriminated unions, or ValidationError handling. Grounded in excel-mcp (pydantic 2.12.5). Do not use for general Python code without Pydantic.
---

# Pydantic v2 Skill

Reusable Pydantic v2 knowledge for agents, grounded in the real usage of this
project (`excel-mcp`, pinned `pydantic 2.12.5`) plus accurate reference material
from the official docs.

## Overview

Pydantic v2 is a runtime validation + serialization library. In this repo only a
tiny subset is used (see house-style.md). The reference files document the full
API for when a feature genuinely requires it.

## When to Use

- Defining request/response shapes as `BaseModel` classes or `Field(...)` declarations.
- Validating incoming data and serializing it back out (`model_dump` / `model_dump_json`).
- Using `TypedDict` for loose output dicts or `TypeAdapter` for non-model types.
- Handling `ValidationError`, or writing `field_validator` / `model_validator` / `computed_field`.
- Deciding between this repo's idiom and the broader Pydantic feature set.

## House style vs Reference

Read **house-style.md first**. It is authoritative for THIS repo: `BaseModel` +
`Field(..., description=...)` only, `TypedDict` for loose outputs, `TypeAlias` +
PEP 604 unions + `Literal`, `model_dump()` no-arg at boundaries. The advanced
features (field_validator, TypeAdapter, ConfigDict, discriminated unions,
ValidationError catching) are **NOT used** in this repo — do not introduce them
casually. Reach for the reference files only when a feature is genuinely needed.

## File map

| File | Purpose |
|---|---|
| `house-style.md` | The project's actual idiom (authoritative for THIS repo). Read first. |
| `models.md` | Reference: BaseModel, ConfigDict, Field() constraints. |
| `validators.md` | Reference: field_validator, model_validator, computed_field. |
| `serialization.md` | Reference: model_dump / model_dump_json / TypeAdapter. |
| `types-unions.md` | Reference: PEP 604, Literal, TypeAlias, Annotated, discriminated unions. |
| `errors.md` | Reference: ValidationError structure and handling. |
| `references.md` | Canonical doc URLs + version notes (2.12 vs 2.13-only). |
| `examples/example.py` | Runnable self-check (plain asserts). |
