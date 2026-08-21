---
name: pyright
description: Use when configuring Pyright/Pylance type checker, writing Python type hints for Pyright, resolving Pyright type errors, or integrating Pyright with MyPy for comprehensive type safety
---

# Pyright/Pylance for Python Type Checking

## Overview

Pyright is a fast Python static type checker. Pylance is the VS Code extension that wraps Pyright with IDE features. This skill covers configuration, type hints, error resolution, and MyPy integration.

**Core principle:** Pyright catches type errors early through precise static analysis. Use it alongside MyPy for comprehensive type coverage.

## When to Use

Use when:
- Configuring Pyright or Pylance for a Python project
- Writing Python type hints that Pyright will check
- Resolving Pyright type errors
- Integrating Pyright with existing MyPy setup
- Choosing between Pyright and MyPy
- Setting type checking strictness levels
- Working in VS Code with Python

Symptoms/triggers:
- "Parameter X is missing type annotation"
- "Return type is not specified"
- "Cannot access member for type Unknown"
- Setting up type checking in CI
- VS Code Python IntelliSense issues
- Need both Pyright and MyPy running

When NOT to use:
- Pure runtime type checking (use runtime validators)
- Type checking for non-Python languages
- You only use PyCharm (has its own type checker)

## Quick Reference

| Task | Action |
|------|--------|
| Configure Pyright | Create `pyrightconfig.json` or `[tool.pyright]` in pyproject.toml |
| Set strictness | `typeCheckingMode`: "off", "basic", "standard", "strict" |
| Ignore error | `# type: ignore` or `# pyright: ignore[errorCode]` |
| Check via CLI | `pyright` or `pyright path/to/file.py` |
| VS Code settings | Settings → Python → Analysis |
| MyPy + Pyright | Separate configs, both in pyproject.toml |

## Implementation

All detail in reference files. Read these for comprehensive guidance:

- **[configuration.md](configuration.md)** - Config file formats, options, strictness modes, VS Code settings
- **[type-hints.md](type-hints.md)** - Annotations, generics, Protocol, TypeVar, avoiding Any
- **[mypy-integration.md](mypy-integration.md)** - Running both checkers without conflicts
- **[common-errors.md](common-errors.md)** - Error categories, fixes, when to suppress

### Pyright vs Pylance

**Pyright** = command-line type checker (open source)  
**Pylance** = VS Code extension using Pyright + IDE features (closed source)

Use Pyright for: CLI, CI, non-VS Code editors  
Use Pylance for: VS Code development

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Mixing config files | Choose one: pyrightconfig.json OR pyproject.toml |
| Using `Any` everywhere | Be specific; Any defeats type checking |
| Suppressing without understanding | Fix root cause, don't silence |
| Ignoring "Unknown" types | Add imports or type annotations |
| MyPy conflict in config | Separate `[tool.pyright]` and `[tool.mypy]` sections |
| Wrong Python version in config | Set `pythonVersion` to match runtime |
| Not excluding venv/build dirs | Add to `exclude` patterns |
