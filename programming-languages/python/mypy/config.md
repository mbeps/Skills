# Mypy Configuration

Sources: https://mypy.readthedocs.io/en/stable/config_file.html · https://mypy.readthedocs.io/en/stable/command_line.html · https://mypy.readthedocs.io/en/stable/inline_config.html

## Config file discovery & precedence
- Mypy searches (walking up): `mypy.ini` → `.mypy.ini` → `pyproject.toml` (`[tool.mypy]`) → `setup.cfg` (`[mypy]`), then `$XDG_CONFIG_HOME/mypy/config`, `~/.config/mypy/config`, `~/.mypy.ini`.
- **There is NO merging of config files — only one is used.**
- `--config-file` (CLI) wins; `--config-file=` ignores all config files.
- Option precedence: ① inline `# mypy:` → ② concrete module sections (`foo.bar`) → ③ unstructured wildcards → ④ well-structured wildcards → ⑤ CLI → ⑥ top-level `[mypy]`.
- Boolean flags invert with `no_` prefix (e.g. `no_implicit_reexport`).

## pyproject.toml mapping
- `[mypy]` → `[tool.mypy]`. Per-module sections → `[[tool.mypy.overrides]]` with `module = "name"` or a `module = [...]` array.
- TOML booleans lowercase; strings quoted. `exclude` is regex (array or multiline string).

```toml
[tool.mypy]
python_version = "3.12"
warn_return_any = true

[[tool.mypy.overrides]]
module = "mycode.foo.*"
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = ["somelibrary", "some_other_library"]
ignore_missing_imports = true
```

## Key flags
| Flag                          | Default         | Meaning                                                                                                                                                       |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`                      | False           | Enables a set of error-checking flags (list below).                                                                                                           |
| `disallow_untyped_defs`       | False           | Error on any def missing annotations (superset of `disallow_incomplete_defs`).                                                                                |
| `disallow_incomplete_defs`    | False           | Error only on partly-annotated defs (`def f(a: int, b)`).                                                                                                     |
| `warn_return_any`             | False           | Warn returning `Any` from a function declared non-`Any`.                                                                                                      |
| `warn_unused_ignores`         | False           | Warn on `# type: ignore` that silences nothing. **Global-only.**                                                                                              |
| `warn_redundant_casts`        | False           | Warn on `cast()` to the already-inferred type. **Global-only.**                                                                                               |
| `check_untyped_defs`          | False           | Type-check bodies of unannotated functions (args/return = `Any`).                                                                                             |
| `no_implicit_optional`        | (on by default) | `x: int = None` is an error; write `int \| None`.                                                                                                             |
| `ignore_missing_imports`      | False           | Silence unresolved-import errors. Gotcha: in a per-module section it matches the *imported* module. Does NOT suppress missing attributes in resolved modules. |
| `plugins`                     | ""              | Comma-separated mypy plugins (e.g. `pydantic.mypy`). **Global-only.**                                                                                         |
| `python_version`              | runtime         | `MAJOR.MINOR`. **Global-only.**                                                                                                                               |
| `exclude`                     | —               | Regex of files/dirs to skip. **Global-only.**                                                                                                                 |
| `strict_optional`             | True            | `false` "is evil" per docs.                                                                                                                                   |
| `warn_unreachable`            | False           | Error on unreachable code. **NOT enabled by `strict`.**                                                                                                       |
| `disallow_any_generics`       | False           | Require explicit type args (`list` → `list[int]`).                                                                                                            |
| `disallow_untyped_calls`      | False           | Error when a typed function calls an untyped one.                                                                                                             |
| `disallow_untyped_decorators` | False           | Error when a typed function is wrapped by an untyped decorator.                                                                                               |

## What `strict = true` enables exactly
`--disallow-any-generics`, `--disallow-subclassing-any`, `--disallow-untyped-calls`, `--disallow-untyped-defs`, `--disallow-incomplete-defs`, `--check-untyped-defs`, `--disallow-untyped-decorators`, `--warn-redundant-casts`, `--warn-unused-ignores`, `--warn-return-any`, `--no-implicit-reexport`.

**Gotchas:**
- `--warn-unreachable` is NOT auto-enabled. `strict_equality` is NOT part of `strict`.
- The exact list "may change over time".
- `strict` does not take precedence: `strict = true; warn_return_any = false` is valid.

**Recommended incremental strictness order** (existing-codebase guide):
`warn_unused_configs` → `warn_redundant_casts`, `warn_unused_ignores` → `strict_equality` → `check_untyped_defs` → `disallow_subclassing_any`, `disallow_untyped_decorators`, `disallow_any_generics` → `disallow_untyped_calls`, `disallow_incomplete_defs`, `disallow_untyped_defs` → `no_implicit_reexport` → `warn_return_any` → `extra_checks`.

## Inline per-file config (`# mypy:`)
Takes precedence over all other config:
```python
# mypy: disallow-any-generics
# mypy: disallow-untyped-defs, always-false="FOO,BAR"
```

## Common misconfigurations
1. `warn_unused_ignores` / `warn_redundant_casts` are **global-only** — cannot be set per-module.
2. `ignore_missing_imports` in an override matches the **imported** module name, not the importing file.
3. `plugins`, `python_version`, `exclude` are global-only.
