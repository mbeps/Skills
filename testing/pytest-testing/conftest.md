# PyTest Conftest Organization

## Overview

Conftest.py files provide shared fixtures, hooks, and configuration scoped by directory hierarchy. This guide covers organization patterns from production MCP server testing.

## Directory Structure

```
tests/
├── conftest.py              # Shared across all tests
├── test_main.py             # Uses shared fixtures
├── test_cell_ops.py         # Uses shared fixtures
├── test_security.py         # Uses shared fixtures
└── routes/
    ├── conftest.py          # Route-specific overrides
    └── test_dispatch.py     # Gets overridden fixtures
```

## Shared Fixtures (Root conftest.py)

Place fixtures used across multiple test files in the root conftest:

```python
import pytest
from pathlib import Path
from openpyxl import Workbook

HEADERS = ["Name", "Age", "City", "Salary"]
ROWS = [
    ["Alice", 30, "New York", 70000],
    ["Bob", 25, "Chicago", 55000],
    ["Charlie", 35, "Boston", 80000],
    ["Diana", 28, "Seattle", 65000],
    ["Eve", 32, "Denver", 75000],
]

@pytest.fixture()
def sample_xlsx(tmp_path: Path) -> str:
    """Create a sample Excel workbook with headers and 5 data rows."""
    path = str(tmp_path / "sample.xlsx")
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(HEADERS)
    for row in ROWS:
        ws.append(row)
    wb.save(path)
    return path

@pytest.fixture()
def sample_csv(tmp_path: Path) -> str:
    """Create a sample CSV file mirroring sample_xlsx structure."""
    import csv
    path = str(tmp_path / "sample.csv")
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(HEADERS)
        for row in ROWS:
            writer.writerow(row)
    return path
```

## Domain-Specific Conftest

For larger projects, create subdirectory conftest files:

```
tests/
├── conftest.py                    # Shared base fixtures
├── financial/
│   ├── conftest.py                # Financial test fixtures
│   │   └── loan_params = {...}
│   └── test_loan_amortization.py
├── charts/
│   ├── conftest.py                # Chart test fixtures
│   └── test_chart_creation.py
└── security/
    ├── conftest.py                # Security test fixtures
    └── test_path_traversal.py
```

## Fixture Override Pattern

Child conftest can override parent fixtures:

```python
# tests/routes/conftest.py
import pytest
from pathlib import Path
from mcp_server.tools.workbook import create_workbook
from mcp_server.tools.cell_ops import write_cells

@pytest.fixture
def sample_xlsx(tmp_path: Path) -> str:
    """Route-layer version: builds via tool functions instead of openpyxl."""
    fp = str(tmp_path / "test.xlsx")
    create_workbook(file_path=fp, sheet_name="Sheet1")
    write_cells(
        mode="range", file_path=fp, sheet_name="Sheet1",
        start_cell="A1", values=[["Name", "Age"], ["Alice", 30]],
    )
    return fp
```

This is useful when you need to test different code paths that produce the same data shape.

## Hooks

### Custom Test Collection

```python
def pytest_ignore_collect(collection_path, path, config):
    """Skip specific files during collection."""
    if path.endswith("test_bug_fixes_comprehensive.py"):
        return True  # Skip slow comprehensive tests in normal runs
    return False
```

### Parameter Generation Hook

```python
def pytest_generate_tests(metafunc):
    """Dynamic parameter generation based on test function signature."""
    if "chart_type" in metafunc.fixturenames:
        metafunc.parametrize(
            "chart_type",
            ["bar", "line", "pie", "scatter", "column"],
            ids=[f"chart-{t}" for t in ["bar", "line", "pie", "scatter", "column"]],
        )
```

### Assertion Rewrite Hook

```python
def pytest_assertrepr_compare(config, op, left, right):
    """Custom comparison messages for complex objects."""
    if isinstance(left, dict) and isinstance(right, dict) and op == "==":
        lines = []
        for key in set(list(left.keys()) + list(right.keys())):
            if key not in left:
                lines.append(f"  Missing key: {key!r} (expected in left)")
            elif key not in right:
                lines.append(f"  Extra key: {key!r} (not in right)")
            elif left[key] != right[key]:
                lines.append(f"  {key!r}: {left[key]!r} != {right[key]!r}")
        if lines:
            return lines
```

## Anti-Patterns

| Anti-Pattern                          | Problem                                   | Fix                                            |
| ------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| Massive root conftest (>200 lines)    | Hard to navigate, slow fixture resolution | Split into domain-specific conftest files      |
| Autouse fixtures for logging/setup    | Hidden dependencies, harder to debug      | Request fixtures explicitly                    |
| Conftest with business logic          | Mixes test infrastructure with test data  | Keep conftest focused on fixtures/hooks only   |
| Deep conftest hierarchies (>3 levels) | Unclear fixture resolution order          | Keep hierarchy flat; use module-level fixtures |
