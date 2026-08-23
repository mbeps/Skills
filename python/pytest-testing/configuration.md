# PyTest Configuration

## Overview

pytest configuration lives in `pyproject.toml` under `[tool.pytest.ini_options]`. This guide covers configuration patterns from production MCP server testing.

## Minimal Configuration

For quick scripts or small projects, this is enough:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v"
```

## Minimal Production Configuration

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --strict-markers"
markers = [
    "slow: tests that take >1 second",
    "security: security edge case tests",
]
filterwarnings = ["error"]
```

See [pytest docs](https://docs.pytest.org/en/stable/reference/reference.html#ini-options-ref) for the full option set (timeouts, parallel execution, plugins, etc.).

## CLI Options

```bash
# Run specific file
pytest tests/test_cell_ops.py

# Run specific test function
pytest tests/test_cell_ops.py::test_read_cell

# Run specific test class/method
pytest tests/test_financial.py::TestFinancialRatioAnalysisComprehensive::test_basic_current_ratio

# Keyword filtering (-k matches against test names)
pytest -k "filter or sort"
pytest -k "not slow"

# Marker filtering (-m matches against markers)
pytest -m "security or financial"

# Failed tests only
pytest --lf          # Last failed
pytest --ff          # First failed (run failed first, then rest)

# Parallel execution (requires pytest-xdist)
pytest -n auto

# Duration reporting
pytest --durations=10

# Traceback styles
pytest --tb=short     # Module line only (default for unit tests)
pytest --tb=long      # Full traceback
pytest --tb=no        # No tracebacks
pytest --tb=line      # One line per failure

# Stop at first failure
pytest -x
```

## pytest-asyncio

For async test functions, install [`pytest-asyncio`](https://pytest-asyncio.org/) and configure in `pyproject.toml`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"  # or "strict" (recommended — requires explicit @pytest.mark.asyncio)
```

## Environment Variables

```bash
# Disable tool registration during tests
MCP_SERVER_DISABLE_TOOL_REGISTRATION=1 pytest

# Custom log level
PYTEST_ADDOPTS="-v --cov=src/mcp_server" pytest
```

## Common Patterns from excel-mcp

### Current State (No Configuration)

The excel-mcp project has NO `[tool.pytest.ini_options]` section — all configuration is implicit. Tests rely on defaults:

```bash
# Standard run
uv run pytest -v

# Coverage
uv run pytest -v --cov=src/mcp_server --cov-report=term-missing

# Lint
uv run ruff check src/ tests/
```

**Recommended additions:**
- `markers` registration (currently only `skipif` used)
- `filterwarnings` for cleaner output
- `testpaths` for explicit test directory
- `strict-markers` to catch typos

## Anti-Patterns

| Anti-Pattern                                         | Problem                                   | Fix                                     |
| ---------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| No pytest config at all                              | Inconsistent behavior across environments | Add minimal `[tool.pytest.ini_options]` |
| Registering markers but not using `--strict-markers` | Typos in marker names silently ignored    | Always use `--strict-markers`           |
| Overriding `python_files/classes/functions`          | Non-standard naming breaks discovery      | Use defaults unless you have a reason   |
| Putting config in setup.cfg/.pytest.ini              | Fragmented configuration                  | Use pyproject.toml exclusively          |
