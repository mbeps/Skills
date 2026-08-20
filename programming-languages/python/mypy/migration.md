# Migration / Gradual Typing

Sources: https://mypy.readthedocs.io/en/stable/existing_code.html · https://mypy.readthedocs.io/en/stable/config_file.html · https://mypy.readthedocs.io/en/stable/error_code_list2.html

For annotating an existing codebase incrementally, or introducing mypy to one.

## Incremental approach (official guide)
1. **Start small:** get mypy passing on a subset (5k–50k lines) *before* adding annotations; silence remaining errors with `# type: ignore`.
2. **Run consistently:** commit a config file + pin the mypy version; run in CI early to prevent regressions.
3. **Ignore whole modules** you aren't ready for via per-module `ignore_errors`:
   ```toml
   [[tool.mypy.overrides]]
   module = "package_to_fix_later.*"
   ignore_errors = true
   ```
   Or invert: global `ignore_errors = true`, flip to `false` for ready modules.
4. **Fix import errors:** install stub packages; for untyped third-party use `# type: ignore[import-untyped]` (few sites) or a per-module `ignore_missing_imports` override (many sites). Avoid global `ignore_missing_imports` — it hides later errors.
5. **Annotate widely-imported modules first** (`utils`, `models`) — biggest payoff.
6. **Write annotations as you go** (new/modified code).
7. **Increase strictness gradually** — see `config.md` for the recommended order.

## `# type: ignore` discipline
- **Always include the error code** — bare `# type: ignore` silences *all* errors on the line (hides typos). Enforce with `enable_error_code=ignore-without-code`.
- `warn_unused_ignores` (part of `strict`) flags ignores that no longer silence anything — run it when upgrading mypy to prune stale workarounds.
- The only way to silence `[unused-ignore]` itself is to name the code explicitly: `# type: ignore[import,unused-ignore]`.
- Ignores on statically-unreachable code (version/platform branches) don't trigger `unused-ignore`.

## `reveal_type()` and inline config
```python
reveal_type(x)   # prints inferred type as a note
```
- Debugging only; remove before commit.
- py3.11+ import from `typing`; older `typing_extensions`.
- Per-file inline config via `# mypy:` comments takes precedence over *all* other config:
  ```python
  # mypy: disallow-any-generics
  ```

## Running on this repo
- `uv run mypy src/mcp_server` (tests are excluded via `exclude = ["tests/"]`).
- After any edit: run mypy and confirm zero errors before committing. This is the same discipline as running the test suite.
- When a `# type: ignore` you added becomes unnecessary (because the underlying library shipped stubs, or you fixed the type), remove it — `warn_unused_ignores` will flag it.
