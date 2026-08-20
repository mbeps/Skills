# IDE Integration & Migration

## Pyrefly replaces Pylance/Pyright + mypy (all-in-one)
- **IDE**: Pyrefly's language server is a full replacement for **Pylance/Pyright** — the extension fully disables Pylance so checkers don't interfere.
- **CLI/CI**: `pyrefly check` replaces **mypy**. Pyrefly has **built-in Pydantic/pytest/Django/attrs support**, so no mypy plugin or Pyright `dataclass_transform` shims are needed.
- One config (`pyrefly.toml` / `[tool.pyrefly]`) powers both the language server and the CLI.

## VS Code
1. Install the extension: **`meta.pyrefly`** (VS Code Marketplace) or **`meta/pyrefly`** (OpenVSX).
2. Open a Python file — it activates automatically. The extension launches `pyrefly lsp`.
3. For inlay hints set `editor.inlayHints.enabled` to `true`.

### Key extension settings
| Setting                                  | Values / default                                                 | Effect                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `python.pyrefly.typeCheckingMode`        | `auto\|off\|basic\|legacy\|default\|strict\|all`, default `auto` | `auto` migrates a nearby mypy/pyright config in memory (fallback `basic`); non-`auto` forces a preset. A committed pyrefly config always wins |
| `python.pyrefly.disableTypeErrors`       | bool, `false`                                                    | workspace kill switch for type-error diagnostics                                                                                              |
| `python.pyrefly.diagnosticMode`          | `openFilesOnly\|workspace`                                       | scope of diagnostics                                                                                                                          |
| `python.pyrefly.disableLanguageServices` | bool                                                             | disable completions/hover/etc. (type errors separate)                                                                                         |
| `python.pyrefly.configPath`              | path                                                             | force a specific config file for the workspace                                                                                                |
| `python.pyrefly.streamDiagnostics`       | bool, `true`                                                     | stream diagnostics during recheck                                                                                                             |

### Features
Go to definition/type/declaration/implementation, find references, rename (project-wide), hover, completion, document/workspace symbols, signature help, semantic tokens, inlay hints (reuses Pyright `python.analysis.inlayHints.*` settings), call/type hierarchy, notebook support.

- **Quick fixes** (lightbulb `Ctrl+.`): Add missing import; Remove redundant cast.
- **Fix All**: `source.fixAll.pyrefly` (typically on save).
- **Refactorings**: Pull Member Up/Down, Convert to Package/Module, Extract to Variable/Field, Introduce Parameter, Inline Variable, Invert Boolean.
- Unused imports/vars are greyed out — **IDE-only hints, not present in the CLI**.

### Non-VSCode editors
Configure the binary with args `["lsp"]`:
- Neovim (nvim-lspconfig): `cmd = { "pyrefly", "lsp" }`.
- Helix: `[language-server.pyrefly] command = "pyrefly"` / `args = ["lsp"]`.
- PyCharm: **Python | Tools | Pyrefly** → Enable.
- Emacs eglot, coc.nvim, ALE, Sublime, Marimo also supported.

## Migration from mypy / Pyright / Pylance
Incremental adoption — install beside your current checker, keep both in CI, drop the old one once differences are accepted.
1. **Install**: `uv add --dev pyrefly` (or `python -m pip install pyrefly`).
2. **Convert config**: `pyrefly init`. It writes `[tool.pyrefly]`/`pyrefly.toml` and migrates `mypy.ini`/`setup.cfg`/`[tool.mypy]`/`pyrightconfig.json`/`[tool.pyright]`. **Not every setting maps exactly — unrecognized ones are skipped silently**, so read the generated config before committing.
3. **Type check**: `pyrefly check`. Your existing mypy/pyright config stays in place, so both checkers keep working.
4. **Handle new errors**: `# pyrefly: ignore` comments, `pyrefly suppress`, or an experimental baseline file so CI reports only new errors.
5. **Remove** the old checker and any unused ignore comments.

### Behavioral differences vs mypy/Pyright
- Pyrefly is **not** a reimplementation — diagnostics won't be identical. A successful migration ends in understood, accepted differences.
- Empty containers: Pyrefly/mypy infer element type from first use (`infer-with-first-use`); Pyright infers `list[Any]`.
- `# type: ignore` → Pyrefly's own form is `# pyrefly: ignore` (both are respected; the former is the spec form).
- **Strict modes differ across tools** — compare specific policies (implicit `Any`, missing annotations, override decorators, unused ignores), not the "strict" setting.

## Baseline-driven migration (experimental)
```bash
pyrefly check --baseline=baseline.json --update-baseline  # snapshot current errors
pyrefly check --baseline=baseline.json                    # CI: fail only on NEW errors
```
See `error-codes.md` for full baseline flags.
