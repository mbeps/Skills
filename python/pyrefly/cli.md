# CLI Commands

## Install
```bash
# pip
pip install pyrefly
# uv (this repo uses uv)
uv add --dev pyrefly
# poetry / pixi / conda
poetry add --group dev pyrefly
conda install -c conda-forge pyrefly
```
Pyrefly ≥ 0.33.0 is needed for Pydantic support. This repo pins `pyrefly>=1.1.1`.

## `pyrefly init`
Writes `pyrefly.toml` or `[tool.pyrefly]` in `pyproject.toml`; **migrates existing mypy/pyright config**. Writes the `legacy` preset when it detects a mypy config. Read the generated config before committing — unrecognized settings are skipped silently.

## `pyrefly check [FILES...]`
Project mode (no files) or single-file mode.
```bash
pyrefly check                     # default
pyrefly check src/ --summarize-errors
pyrefly check --output-format=github   # inline PR annotations (CI)
```
| Flag                                 | Meaning                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `--summarize-errors[=<INDEX>]`       | summarize errors by directory (optional index = file-path segment to group by; default 0)              |
| `--output-format <F>`                | `min-text\|full-text\|json\|github\|junit-xml\|code-climate\|sarif\|omit-errors` (default `full-text`) |
| `--min-severity <L>`                 | `ignore\|info\|warn\|error` (default `error`)                                                          |
| `-p`/`--preset <P>`                  | `off\|basic\|legacy\|default\|strict\|all`                                                             |
| `--error`/`--warn`/`--ignore <code>` | per-error-kind severity override                                                                       |
| `--baseline <file>`                  | use baseline; report only new errors                                                                   |
| `--update-baseline`                  | regenerate baseline                                                                                    |
| `--prune-baseline`                   | drop stale baseline entries (no new errors)                                                            |
| `--error-stale-baseline`             | nonzero exit if baseline stale (CI)                                                                    |
| `--suppress-errors`                  | equivalent to `pyrefly suppress`                                                                       |
| `-c`/`--config <file>`               | explicit config file                                                                                   |
| `--python-version`                   | e.g. `3.12`                                                                                            |

Exit codes: `0` success · `1` user error (type errors found) · `3` infrastructure error · `101` panic.

## `pyrefly suppress [PATHS...]`
Bulk-adds `# pyrefly: ignore` comments for all current errors (equiv `check --suppress-errors`).
- `--comment-location=same-line` — place as trailing comments (avoids conflicts with linters/other checkers; default is the line before).
- `--remove-unused[=KIND]` — bare / `=pyrefly` removes pyrefly+pyre ignores (preserves `# type: ignore`); `=type` removes unused `# type: ignore`; `=all` removes all.
- Upgrade loop: `pyrefly suppress` → format → `pyrefly suppress --remove-unused`, repeat until clean.

## `pyrefly infer [PATHS...]`
Auto-inserts inferred type annotations into source files (return types, params, containers) — unique to Pyrefly vs mypy/Pyright. Review and commit.
```bash
pyrefly infer src/utils.py
```

## `pyrefly coverage`
```bash
pyrefly coverage check src/ --fail-under 80   # enforce threshold (CI gate); exit non-zero below it
pyrefly coverage report src/                  # JSON report (schema_version 0.2)
```
The report is a JSON doc with a `module_reports` array; each module has `coverage`/`strict_coverage` (percent) and counts (`n_typed`, `n_any`, `n_untyped`). Uses `coverage.includes`/`coverage.excludes` config options (default `project-includes`/`project-excludes`).

## `pyrefly lsp`
Starts the LSP server over stdin/stdout. Invoked by editor clients (the VS Code extension launches `pyrefly lsp`). Most people never run this directly.

## `pyrefly dump-config [<file>...]`
Prints resolved search path, interpreter, `site-package-path`, and other config-debugging info. Great for diagnosing import-resolution problems (e.g. `src.` imports not resolving).

## CI
- Official action: `uses: facebook/pyrefly@main` (inputs `version`, `args`, `python-version`, `working-directory`).
- This repo: `uv run pyrefly check` in `.github/workflows/merge.yml` (`pyrefly` job).
- Pre-commit: `facebook/pyrefly-pre-commit`.
