---
name: pyrefly-cli
description: "Must be used whenever needing to use Pyrefly CLI. This is used for Python language server related tasks."
---

Pyrefly is a high-performance Python static type checker and Language Server Protocol (LSP) server developed by Meta. Written in Rust, it performs static analysis and powers IDE features like autocomplete, go-to-definition, and hover hints.

---

## 1. Installation

Install Pyrefly into your Python environment using your preferred package manager:

```bash
# pip
pip install pyrefly

# uv
uv add --dev pyrefly

# Poetry
poetry add --group dev pyrefly

# Pixi
pixi add pyrefly

```

---

## 2. Core CLI Commands

### `pyrefly init`

Initialises Pyrefly configuration in your project.

* Creates `pyrefly.toml` or adds a `[tool.pyrefly]` section to `pyproject.toml`.
* Automatically detects and migrates existing `mypy` or `pyright` configurations.

```bash
pyrefly init

```

---

### `pyrefly check`

Runs static type checking across your project or specified paths.

```bash
pyrefly check [PATHS...] [OPTIONS]

```

#### Key Flags:

| Flag | Description |
| --- | --- |
| `--summarize-errors` | Displays a summary breakdown of error kinds alongside individual diagnostics. |
| `--min-severity <LEVEL>` | Sets minimum severity to report and fail on (`info`, `warn`, `error`). Defaults to `error`. |
| `--output-format <FORMAT>` | Configures output formatting. Options include `text`, `github` (for inline PR annotations), and `junit-xml`. |
| `--baseline <FILE>` | Uses or generates a JSON baseline file tracking existing errors, reporting only new ones. |
| `--suppress-errors` | Silences all current type errors by writing `# pyrefly: ignore` comments directly into source files. |

```bash
# Example: Check src directory with summary and GitHub Actions output format
pyrefly check src/ --summarize-errors --output-format=github

```

---

### `pyrefly lsp`

Starts the Language Server Protocol process communicating over standard I/O (`stdin`/`stdout`).

```bash
pyrefly lsp

```

This subcommand is invoked directly by editor LSP clients (e.g. Neovim, Zed, Helix, VS Code) to power IDE capabilities.

---

### `pyrefly suppress`

Bulk-suppresses existing type errors across files.

```bash
pyrefly suppress [PATHS...] [OPTIONS]

```

#### Key Flags:

* `--remove-unused`: Cleans up redundant `# pyrefly: ignore` directives that no longer match active errors.

```bash
# Suppress all existing errors in the repository
pyrefly suppress

# Remove stale ignore comments
pyrefly suppress --remove-unused

```

---

### `pyrefly infer`

Automatically inserts inferred type annotations directly into your Python source files for function parameters, return types, and containers.

```bash
pyrefly infer [PATHS...]

```

```bash
# Infer types for a specific module
pyrefly infer src/utils.py

```

---

### `pyrefly coverage`

Measures type annotation completeness across codebases.

#### Subcommands:

* **`pyrefly coverage check <PATH> --fail-under <PERCENT>`**: Validates that type coverage meets a specified threshold. Exits with a non-zero code if below the target (ideal for CI).
* **`pyrefly coverage report <PATH>`**: Generates a detailed JSON report detailing symbol-level and module-level annotation coverage.

```bash
# Enforce a 80% coverage floor in CI
pyrefly coverage check src/ --fail-under 80

# Output a JSON report and parse the strict coverage metric
pyrefly coverage report src/ | jq .summary.strict_coverage

```

---

## 3. IDE Integration via `pyrefly lsp`

To connect Pyrefly to editor environments without extensions, point the client binary command to `pyrefly lsp`.

### Neovim (`nvim-lspconfig` / Lua)

```lua
local lspconfig = require('lspconfig')

lspconfig.pyrefly.setup({
  cmd = { "pyrefly", "lsp" },
  filetypes = { "python" },
  root_dir = lspconfig.util.root_pattern("pyrefly.toml", "pyproject.toml", ".git"),
})

```

### Helix (`languages.toml`)

```toml
[language-server.pyrefly]
command = "pyrefly"
args = ["lsp"]

[[language]]
name = "python"
language-servers = ["pyrefly"]

```

### Zed (`settings.json`)

```json
{
  "lsp": {
    "pyrefly": {
      "binary": {
        "path": "pyrefly",
        "arguments": ["lsp"]
      }
    }
  },
  "languages": {
    "Python": {
      "language_servers": ["pyrefly"]
    }
  }
}

```

---

## 4. Adoption Workflow

To introduce Pyrefly into an un-typed or legacy codebase step by step:

1. **Initialize Configuration:** Command: pyrefly init.
Run `pyrefly init` at your repository root to generate configuration defaults or migrate existing Mypy/Pyright settings.


2. **Suppress Pre-existing Errors:** Command: pyrefly suppress.
Run `pyrefly suppress` to mark existing errors with `# pyrefly: ignore` comments. This establishes a clean state so new PRs do not introduce new regressions.


3. **Auto-Infer Annotations:** Command: pyrefly infer.
Run `pyrefly infer src/` on specific modules to draft annotations automatically. Review and commit the changes.


4. **Enforce CI Gate:** Command: pyrefly coverage check.
Add `pyrefly coverage check . --fail-under <TARGET>` and `pyrefly check --output-format=github` to your continuous integration pipeline to prevent type regression.