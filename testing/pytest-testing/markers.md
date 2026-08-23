# PyTest Markers

## Overview

Markers annotate tests with metadata for selective execution and categorization. This guide covers marker patterns from production MCP server testing.

## Built-in Markers

### skip / skipif

```python
import pytest

@pytest.mark.skip(reason="Feature not yet implemented")
def test_future_feature() -> None:
    ...

_HAS_ANALYSIS_MODELS = True  # or check import availability

@pytest.mark.skipif(not _HAS_ANALYSIS_MODELS, reason="SortDescriptor model not available")
def test_sort_descriptor() -> None:
    ...
```

### xfail (expected failure)

```python
@pytest.mark.xfail(reason="Known bug in chart type handling", raises=ValueError)
def test_chart_edge_case() -> None:
    ...

# Strict xfail — test must fail for it to count as xpass
@pytest.mark.xfail(strict=True, reason="Should always fail currently")
def test_broken_feature() -> None:
    ...
```

## Custom Markers

Register in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = [
    "slow: tests that take >1 second",
    "integration: tests requiring external services",
    "security: security edge case tests",
    "financial: financial calculation tests",
    "charts: chart creation and manipulation tests",
    "dispatch: consolidated tool dispatch tests",
]
```

Use in tests:

```python
@pytest.mark.slow
def test_large_workbook_performance(tmp_path: Path) -> None:
    # Test with 100k+ rows
    ...

@pytest.mark.security
def test_path_traversal_blocked(tmp_path: Path) -> None:
    ...

@pytest.mark.financial
def test_loan_amortization_schedule() -> None:
    ...
```

## Running Subset of Tests

```bash
# Run only slow tests
pytest -m slow

# Run everything EXCEPT slow tests
pytest -m "not slow"

# Run security OR financial tests
pytest -m "security or financial"

# Combine with keyword filtering
pytest -m "security" -k "traversal"

# Run last failed tests
pytest --lf

# Run in reverse order (catches hidden dependencies)
pytest --reverse
```

## Common Patterns from excel-mcp

### Conditional Model Availability

```python
try:
    from mcp_server.models.analysis import SortDescriptor
    _HAS_ANALYSIS_MODELS = True
except ImportError:
    _HAS_ANALYSIS_MODELS = False

@pytest.mark.skipif(not _HAS_ANALYSIS_MODELS, reason="SortDescriptor model not available")
def test_sort_data_integration(sample_xlsx: str) -> None:
    ...
```

## Anti-Patterns

| Anti-Pattern                           | Problem                   | Fix                                                          |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------ |
| Using markers without registering them | `--strict-markers` fails  | Register all custom markers in pyproject.toml                |
| Overusing `@pytest.mark.skip`          | Test rot accumulates      | Use `xfail` for known issues, remove when fixed              |
| Marker expressions too complex         | Hard to read and maintain | Keep expressions simple; use helper scripts for complex runs |
| No marker strategy for CI              | All tests run every time  | Categorize tests by speed/type; run subsets in parallel      |
