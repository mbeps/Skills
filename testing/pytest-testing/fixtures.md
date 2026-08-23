# PyTest Fixtures

## Overview

Fixtures provide test data and setup/teardown infrastructure. This guide covers fixture design patterns from production MCP server testing.

## Fixture Scopes

Five scopes control fixture lifetime (default is `function`):

```python
@pytest.fixture(scope="function")  # Default: fresh per test
def sample_xlsx(tmp_path: Path) -> str:
    path = str(tmp_path / "sample.xlsx")
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["Name", "Age", "City", "Salary"])
    ws.append(["Alice", 30, "New York", 70000])
    wb.save(path)
    return path

@pytest.fixture(scope="module")  # Fresh per test module
def large_dataset():
    data = generate_large_dataset()  # Expensive setup
    yield data
    cleanup(data)  # Teardown
```

**Scope hierarchy:** function → class → module → package → session

**Rule of thumb:** Use `function` scope by default. Only escalate scope when setup is genuinely expensive AND tests don't mutate shared state.

## Factory Fixtures

For creating multiple instances per test:

```python
def make_workbook(tmp_path: Path):
    """Factory fixture — call it multiple times within a test."""
    def _create(name: str = "test.xlsx") -> str:
        path = str(tmp_path / name)
        wb = Workbook()
        wb.save(path)
        return path
    return _create

def test_multiple_workbooks(make_workbook: Callable) -> None:
    wb1 = make_workbook("first.xlsx")
    wb2 = make_workbook("second.xlsx")
    assert os.path.exists(wb1)
    assert os.path.exists(wb2)
```

## Yield-Based Teardown

When cleanup is needed:

```python
@pytest.fixture
def temp_server():
    server = start_server()
    yield server  # Test runs here
    server.stop()  # Teardown after test
```

## Fixture Override via Conftest Hierarchy

Conftest.py files are scoped by directory; child conftest shadows parent with the same fixture name. See [conftest.md](conftest.md#fixture-override-pattern) for the canonical example with code.

## Common Patterns from excel-mcp

### String Path Returns

Return string paths (not `Path` objects) to match tool layer API expectations:

```python
@pytest.fixture()
def sample_xlsx(tmp_path: Path) -> str:
    path = str(tmp_path / "sample.xlsx")  # Convert to str
    # ... build workbook ...
    return path
```

### Private Helper Functions

Use `_make_*` prefixed functions (not fixtures) for specialized data shapes:

```python
def _make_chart_workbook(tmp_path: Path, name: str = "chart.xlsx") -> str:
    """Create a workbook with numeric data suitable for charting."""
    path = str(tmp_path / name)
    wb = Workbook()
    ws = wb.active
    for i in range(1, 11):
        ws.append([i, i * 2, i ** 2])
    wb.save(path)
    wb.close()
    return path
```

These accept `tmp_path` as parameter (not a fixture themselves), giving callers control over lifecycle.

### pathlib over Legacy tmpdir

Use `tmp_path` (returns `pathlib.Path`) rather than the legacy `tmpdir` (`py.path`). `tmp_path` is the modern standard with better IDE support and type hints.

### No Autouse Fixtures

Prefer explicit fixture requests over autouse. Makes dependencies visible in test signatures:

```python
# ❌ BAD: Hidden dependency
@pytest.fixture(autouse=True)
def setup_logging():
    logging.basicConfig(level=logging.DEBUG)

# ✅ GOOD: Explicit
def test_something(sample_xlsx: str):
    ...
```

## Anti-Patterns

| Anti-Pattern                            | Problem                        | Fix                              |
| --------------------------------------- | ------------------------------ | -------------------------------- |
| Returning `Path` when API expects `str` | Type mismatch at boundary      | Convert with `str()`             |
| Mutable shared state across tests       | Flaky tests                    | Function scope + fresh instances |
| Fixture returns bool                    | Can't inspect test results     | Return structured data           |
| Importing fixtures                      | Breaks test isolation          | Request as parameter             |
| Overusing session scope                 | Slow feedback, hidden coupling | Default to function scope        |
