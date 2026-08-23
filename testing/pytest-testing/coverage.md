# PyTest Coverage

## Overview

Coverage measurement identifies untested code paths. This guide covers pytest-cov patterns from production MCP server testing.

## Basic Coverage Commands

```bash
# Full coverage with missing line numbers
pytest --cov=src/mcp_server --cov-report=term-missing

# HTML report for browser viewing
pytest --cov=src/mcp_server --cov-report=html

# XML report for CI integration
pytest --cov=src/mcp_server --cov-report=xml

# Combined reports
pytest --cov=src/mcp_server --cov-report=term-missing --cov-report=html --cov-report=xml
```

## pyproject.toml Configuration

```toml
[tool.pytest.ini_options]
addopts = [
    "-v",
    "--cov=src/mcp_server",
    "--cov-report=term-missing",
    "--strict-markers",
]

[tool.coverage.run]
source = ["mcp_server"]
omit = [
    "*/tests/*",
    "*/__init__.py",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.:",
]

[tool.coverage.html]
directory = "htmlcov"
```

## Excluding Paths

```python
# In tests, mark specific lines:
def test_with_unreachable_path() -> None:
    if impossible_condition():  # pragma: no cover
        raise ValueError("unreachable")
```

## Coverage Thresholds

```toml
[tool.coverage.report]
fail_under = 80  # Fail CI if coverage < 80%
show_missing = true
precision = 2
```

## Common Patterns from excel-mcp

### Standard Coverage Command

```bash
uv run pytest -v --cov=src/mcp_server --cov-report=term-missing
```

Covers `src/mcp_server/` (routes + tools + models + utils). Tests excluded by default via coverage source configuration.

## Anti-Patterns

| Anti-Pattern                     | Problem                          | Fix                                         |
| -------------------------------- | -------------------------------- | ------------------------------------------- |
| No coverage thresholds in CI     | Degraded coverage goes unnoticed | Set `fail_under` in pyproject.toml          |
| Overusing `pragma: no cover`     | Hides real gaps                  | Only mark truly unreachable code            |
| Measuring coverage on test files | Inflated numbers, misleading     | Exclude tests from coverage source          |
| One monolithic coverage run      | Slow feedback                    | Use `--lf` for last-failed; split by domain |
