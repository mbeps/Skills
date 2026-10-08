---
name: python-project-conventions
description: Use when creating, configuring, structuring, or maintaining Python projects and repositories
---

# Python Project Conventions

## Overview
Standards and baseline layout for all Python projects. Follow these conventions across all repositories.

## Quick Reference

| Category | Standard | Prohibited / Avoid |
|---|---|---|
| Dependency Management | `uv` | `pip`, `poetry`, `pipenv` |
| Type Checking | Strict type hints, `Pydantic` as needed | `Any` |
| Language Server / Linter | `pyrefly` | `Pyright`, `Pylance`, `mypy` |
| Formatter | `ruff` | `black`, `pylint`, `autopep8` |
| Testing | `pytest` | `unittest` |
| Code Location | `./src/` | Root-level module files |
| Test Location | `./tests/` | Tests inside source directory |

## Project Structure

All Python projects must follow this directory layout:

```text
.
├── pyproject.toml
├── src/
│   ├── models/
│   ├── routes/
│   ├── tools/
│   ├── utils/
│   ├── __init__.py
│   ├── main.py
│   └── prompts.py
└── tests/
    └── test_*.py

```

### Layout Rules

* Store all project source code inside `./src`.
* Keep `main.py` directly inside `./src`.
* Use folders to organise code within the `src` directory (such as `models/`, `routes/`, `tools/`, and `utils/`).
* Store test files inside `./tests` at the root of the project.

## Code Standards & Idioms

### Idiomatic Python

* Write idiomatic Python: use list comprehensions, generators, `enumerate`, and `zip`.
* Avoid unnecessary manual indexing and verbose looping constructs.

### Typing & Interfaces

* Apply strict type hints thoroughly across:
* Function arguments
* Return types
* Variables
* Class properties


* Avoid the `Any` type. Use `Pydantic` models when necessary.
* Define interfaces and structural types using `typing.Protocol`, `TypedDict`, or `dataclasses`.
* Select type-safe dependencies: use libraries with native type stubs or explicitly require `types-*` stub packages.

## Tooling & Dependency Rules

### Dependency Management

* Use `uv` for dependency management instead of `pip`, `poetry`, or other tools unless otherwise stated.

### poethepoet & poe Tasks

* Use `poethepoet` to generate and manage `poe` tasks defined in `pyproject.toml`.
* Run `poethepoet generate` to scaffold task boilerplate from your codebase.
* Customize generated tasks in `pyproject.toml` as needed.
* Example minimal `pyproject.toml` poe configuration:

```toml
[tool.poe.tasks]
run = "uv run src/your_module/main.py"
test = "uv run pytest -v"
lint = "ruff check src/"
format = "ruff format ."
type-check = "pyrefly check"
```

### Quality Control & Tooling

* Use `pyrefly` as the language server to check Python code quality. Do not use `Pyright`, `Pylance`, or `mypy`.
* Use the `ruff` formatter. Do not use other formatters such as `black` or `pylint`.

### Testing

* Write tests with `pytest`.
* Keep tests isolated within the root `./tests` directory.
