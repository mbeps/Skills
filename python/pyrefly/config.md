# Configuration (`pyrefly.toml` / `[tool.pyrefly]`)

## Discovery & precedence
- Config lives in **`pyrefly.toml`** (top-level keys) **or** `pyproject.toml` under **`[tool.pyrefly]`**. Other filenames only via `-c`/`--config` (not auto-found).
- **Precedence**: CLI flags → config → Pyrefly defaults. Explicit settings override the preset.
- Project root discovery: 1) `-c` file's dir → 2) upward search for `pyrefly.toml`, `pyproject.toml`, `setup.py`, `mypy.ini`, `pyrightconfig.json` → 3) import-component walk-up.
- **Modes**: Project mode (no `FILES...`; uses `project-includes`/`project-excludes`) vs single-file mode (given `FILES...`; ignores them).
- Unconfigured projects: auto-migrate a found mypy/pyright config **in memory**, else fall back to the `basic` preset. `pyrefly init` commits the same migration to disk.

## Strictness presets (`preset`, least→most strict)
`off` → `basic` → `legacy` → `default` → `strict` → `all`. **`auto` is NOT a valid preset** (it is only an IDE `typeCheckingMode` value). Docs recommend `strict` + opting into individual error kinds for stability.

| Preset    | Behavior                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`     | Silences every error kind (IDE hover/goto only)                                                                                                                                                               |
| `basic`   | Minimal checking; `check-unannotated-defs=false`, `infer-return-types="never"`, `infer-with-first-use=false`, `permissive-ignores=true`; only high-confidence errors (syntax, missing imports, unknown names) |
| `legacy`  | For mypy migrations (written by `pyrefly init` on mypy config); `check-unannotated-defs=false`, `infer-return-types="never"`, `legacy-overload-expansion=true`                                                |
| `default` | Each error kind at its own default severity (overrides nothing)                                                                                                                                               |
| `strict`  | `strict-callable-subtyping=true`; enables `implicit-any`, `missing-override-decorator`, `unused-ignore`, etc. as errors                                                                                       |
| `all`     | Every error kind at `error`                                                                                                                                                                                   |

CLI: `-p`/`--preset`. Setting any preset value via `-p` also disables auto-migration of nearby mypy/pyright config.

## Key options
| Key                          | Type / default                           | Notes                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-includes`           | globs, `["**/*.py*"]`                    | Pyright `include` / mypy `files`                                                                                                                                                                                 |
| `project-excludes`           | globs, sensible defaults + site-packages | Pyright/mypy `exclude`; dotfiles/non-`.py` always filtered                                                                                                                                                       |
| `search-path`                | list of dirs                             | Pyright `extraPaths` / mypy `mypy_path`; highest precedence. **This repo: `search-path = ["."]`** to resolve `src.` imports                                                                                      |
| `site-package-path`          | list, `./typings` + interpreter          | lowest priority                                                                                                                                                                                                  |
| `python-version`             | `3.12`, etc.                             | from interpreter or `3.13.0` default                                                                                                                                                                             |
| `python-platform`            | `"linux"`, `"all"`, or list              | `"all"` avoids platform pruning                                                                                                                                                                                  |
| `errors`                     | `{code = true/false}`                    | enable/disable error kinds; flags `--error`/`--warn`/`--ignore`                                                                                                                                                  |
| `disable-type-errors-in-ide` | bool                                     | no CLI flag; CLI/CI unaffected                                                                                                                                                                                   |
| `check-unannotated-defs`     | bool, `true`                             | ≈ mypy `check_untyped_defs`                                                                                                                                                                                      |
| `infer-return-types`         | `never\|annotated\|checked`, `checked`   | infer returns for unannotated defs                                                                                                                                                                               |
| `infer-with-first-use`       | bool, `true`                             | mypy-like; `false` = Pyright-like (`Any`)                                                                                                                                                                        |
| `ignore-missing-imports`     | list of regex                            | replace unresolved with `Any`                                                                                                                                                                                    |
| `replace-imports-with-any`   | list of regex                            | unconditional module→`Any`                                                                                                                                                                                       |
| `treat-all-caps-as-final`    | bool                                     | re-assigning `ALL_CAPS` → `bad-assignment`                                                                                                                                                                       |
| `strict-callable-subtyping`  | bool                                     | strict `*args: Any, **kwargs: Any` callable compat                                                                                                                                                               |
| `permissive-ignores`         | bool                                     | respect `# pyright: ignore`/`# ty: ignore` too                                                                                                                                                                   |
| `enabled-ignores`            | list, `["type","pyrefly"]`               | which tools' ignores to respect                                                                                                                                                                                  |
| `use-ignore-files`           | bool, `true`                             | auto-add `.gitignore`/`.ignore` to excludes                                                                                                                                                                      |
| `sub-config`                 | array of tables                          | per-glob overrides (Pyright `executionEnvironments` / mypy per-module); only `errors`, `replace-imports-with-any`, `check-unannotated-defs`, `infer-return-types`, `ignore-errors-in-generated-code` overridable |
| `baseline`                   | path to JSON                             | project-level; can't be set in sub-config                                                                                                                                                                        |
| `baseline-error-level`       | `ignore\|info\|warn\|error`, `ignore`    | severity for baselined matches                                                                                                                                                                                   |
| `min-severity`               | `ignore\|info\|warn\|error`, `error`     | CLI display + exit code                                                                                                                                                                                          |
| `output-format`              | `full-text` default                      | see `cli.md`                                                                                                                                                                                                     |

## Environment autoconfiguration
Unless `skip-interpreter-query`, Pyrefly queries an interpreter for platform/version/site-packages. Lookup order: explicit flags → active venv (preferred over conda) → config values → `pyvenv.cfg` search → `which python3`/`which python` → defaults. Run **`pyrefly dump-config`** to see resolved values.

## Gotchas
- `search-path` vs `site-package-path`: search-path is user import roots; site-package-path is where the interpreter's installed packages live.
- Changing `project-includes`/`project-excludes` with explicit `FILES...` is ignored unless the same flag is also passed.
- Deprecated: `untyped-def-behavior` (→ `check-unannotated-defs` + `infer-return-types`), `pytorch-efficiency-lints` (→ `--warn=pytorch-efficiency-lints`).
