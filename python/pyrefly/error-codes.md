# Error Codes & Suppressions

Pyrefly groups diagnostics into named **error kinds** (e.g. `bad-return`, `bad-assignment`, `missing-import`, `unused-ignore`, `implicit-any`). Severity is controlled per-kind via the `errors` table or `--error`/`--warn`/`--ignore` flags; the `preset` selects which kinds fire by default.

## Suppression comment syntax
| Form                                      | Scope                | Placement                             |
| ----------------------------------------- | -------------------- | ------------------------------------- |
| `# pyrefly: ignore`                       | one line             | own line above, or trailing same-line |
| `# pyrefly: ignore[code]`                 | one line, one kind   | e.g. `# pyrefly: ignore[bad-return]`  |
| `# pyrefly: ignore-errors`                | whole file           | **before any code**                   |
| `# pyrefly: ignore-errors[code]`          | whole file, one kind | **before any code**                   |
| `# type: ignore` / `# type: ignore[code]` | also respected       | Python typing spec                    |

**Always name the code** — a bare `# pyrefly: ignore` hides everything on the line and can mask real regressions.

### Gotchas
- A file-level `ignore-errors` placed **after the first line of code is silently inert** (suppresses nothing) and Pyrefly reports a **`misplaced-ignore`** warning pointing at it. Use line-level `# pyrefly: ignore[code]` for errors below the top of a file.
- `permissive-ignores` (default off) additionally respects `# pyright: ignore` and `# ty: ignore`; `enabled-ignores` (default `["type","pyrefly"]`) controls which tools' directives are honored.
- `unused-ignore` fires when an ignore comment no longer matches an error — the `strict`/`all` presets enable it. Clean these up with `pyrefly suppress --remove-unused`.

## `pyrefly suppress`
Auto-suppresses all current errors by inserting `# pyrefly: ignore` comments. See `cli.md`. Recommended adoption loop: suppress → format → `suppress --remove-unused`, repeat.

## Baselines (experimental)
For large mypy/Pyright migrations: record current errors in a JSON file so CI reports **only new** errors.
```bash
pyrefly check --baseline=baseline.json --update-baseline   # generate
pyrefly check --baseline=baseline.json                     # check against it
```
- Matched by **file + error code + column**. Baselined errors still show in the IDE (as hints).
- Config: `baseline = "baseline.json"` in `[tool.pyrefly]`. Project-level; not overridable in sub-configs.
- `--prune-baseline` drops stale entries; `--error-stale-baseline` fails CI on stale entries (mutually exclusive with `--update-baseline`).
- If a configured baseline is unreadable the run fails (except with `--update-baseline`).

## Common error kinds & idiomatic fixes
| Code                                   | Meaning                              | Fix                                                                                                                                  |
| -------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `bad-return`                           | return type doesn't match annotation | narrow / correct the return value or annotation                                                                                      |
| `bad-assignment`                       | value not assignable to target       | align types; narrow with `isinstance`                                                                                                |
| `missing-import` / `unresolved-import` | module not found                     | add dependency or `# pyrefly: ignore[missing-import]` at third-party boundaries; or configure `search-path`/`ignore-missing-imports` |
| `implicit-any`                         | param/return inferred `Any`          | add explicit annotation (this repo annotates every def)                                                                              |
| `unused-ignore`                        | ignore comment matches nothing       | remove it (or `pyrefly suppress --remove-unused`)                                                                                    |
| `misplaced-ignore`                     | file-level ignore too late           | move to top or use line-level ignore                                                                                                 |
| `invalid-annotation`                   | malformed type annotation            | fix the annotation syntax                                                                                                            |
| `bad-argument` / `unexpected-keyword`  | wrong call args                      | align with the callee signature                                                                                                      |
| `potential-bad-keyword-argument`       | keyword arg may not exist            | check the target signature                                                                                                           |

For the complete, current list of error kinds, run `pyrefly check` on a file that triggers them (use `--summarize-errors` to group diagnostics by directory) and see the official error-code pages linked in `references.md`.
