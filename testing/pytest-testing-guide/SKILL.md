# pytest Testing Guide for Python MCP Servers

A practical guide for writing tests against FastMCP servers with Excel/data manipulation tooling. Grounded in real patterns from `excel-mcp` (69 tools, openpyxl + pandas + scipy + pydantic).

---

## 1. Project Setup — pytest Configuration

Add this to `pyproject.toml`. The project has **no** `[tool.pytest.ini_options]` by default — add one:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests that touch the filesystem",
    "security: marks tests that validate security boundaries",
]
```

Install dev dependencies:

```bash
uv add --dev pytest pytest-cov
```

Run with coverage:

```bash
uv run pytest -v                          # all tests
uv run pytest -v --cov=src/mcp_server     # with coverage report
uv run pytest -v --cov=src/mcp_server --cov-report=term-missing
uv run pytest -v tests/test_cell_ops.py   # single file
uv run pytest -v -k "filter"              # keyword filter
uv run pytest -v -m security              # marker filter
```

### Conftest at the Root

Place shared fixtures in `tests/conftest.py` (pytest auto-discovers it):

```python
from __future__ import annotations

import csv
from pathlib import Path

import pytest
from openpyxl import Workbook

HEADERS = ["Name", "Age", "City", "Salary"]
ROWS = [
    ["Alice", 30, "New York", 70000],
    ["Bob", 25, "Chicago", 55000],
    ["Charlie", 35, "New York", 90000],
]


@pytest.fixture()
def sample_xlsx(tmp_path: Path) -> str:
    """Create a workbook with headers + sample data. Returns absolute path string."""
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
def empty_xlsx(tmp_path: Path) -> str:
    """Create an empty workbook. Returns path string."""
    path = str(tmp_path / "empty.xlsx")
    wb = Workbook()
    wb.active.title = "Sheet1"
    wb.save(path)
    return path
```

Key pattern: **fixtures return `str` paths, not `Path` objects.** Tool APIs expect string paths. `tmp_path` is auto-cleaned by pytest after each test.

---

## 2. Fixture Patterns

### 2.1 Function-Scoped Fixtures (Default)

The default scope is `function` — one fixture instance per test. This is correct for test workbooks; tests must never share state.

```python
def test_read_cell(sample_xlsx: str) -> None:
    result = read_cell(sample_xlsx, "Sheet1", "A1")
    assert result["value"] == "Name"
```

### 2.2 Parametrised Fixtures

```python
@pytest.fixture(params=["Sheet1", "Data"])
def multi_sheet_xlsx(tmp_path: Path, request: pytest.FixtureRequest) -> tuple[str, str]:
    """Returns (file_path, active_sheet_name)."""
    path = str(tmp_path / "multi.xlsx")
    wb = Workbook()
    wb.active.title = "Sheet1"
    wb.create_sheet("Data")
    wb.save(path)
    return path, request.param
```

### 2.3 Fixture Factories (Setup Helpers)

For complex setup, use a factory fixture or module-level helper:

```python
def _create_lookup_workbook(path: str) -> None:
    """Create a workbook with lookup values."""
    wb = Workbook()
    ws = wb.active
    ws.append(["ItemID", "FullName"])
    ws.append([1, "Alice"])
    ws.append([2, "Bob"])
    wb.save(path)
```

### 2.4 Environment Patching with `monkeypatch`

```python
def test_allowed_dirs_outside_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    forbidden = tmp_path / "forbidden"
    forbidden.mkdir()
    monkeypatch.setenv("EXCEL_MCP_ALLOWED_DIRS", str(allowed))

    with pytest.raises(ValueError, match="outside allowed"):
        create_workbook(file_path=str(forbidden / "evil.xlsx"))
```

### 2.5 Autouse Fixtures

For setup that every test needs (e.g., disabling real registration):

```python
@pytest.fixture(autouse=True)
def disable_tool_registration(monkeypatch: pytest.MonkeyPatch) -> None:
    """Swap in no-op MCP for import-safe testing."""
    monkeypatch.setenv("MCP_SERVER_DISABLE_TOOL_REGISTRATION", "1")
```

---

## 3. Assertion Strategies

### 3.1 Direct Value Assertions

```python
def test_read_range(sample_xlsx: str) -> None:
    result = read_range(sample_xlsx, "Sheet1", "A1", "D2")
    assert result["row_count"] == 2
    assert result["col_count"] == 4
    assert result["rows"][0] == ["Name", "Age", "City", "Salary"]
```

### 3.2 String Containment Checks

When tools return human-readable status strings:

```python
def test_scenario_lifecycle(sample_xlsx: str) -> None:
    res = scenario(action="add", file_path=sample_xlsx, name="Test", ...)
    assert "saved" in str(res).lower()

    res_list = scenario(action="list", file_path=sample_xlsx)
    assert len(res_list) >= 1
```

### 3.3 Exception Assertions

```python
def test_missing_file() -> None:
    with pytest.raises(ValueError, match="not found"):
        get_sheet_summary(file_path="non_existent.xlsx", sheet_name="Sheet1")

def test_invalid_chart_type(tmp_path: Path) -> None:
    fp = str(tmp_path / "test.xlsx")
    create_workbook(fp)
    with pytest.raises(ValueError, match="type"):
        create_chart(file_path=fp, sheet_name="Sheet1", chart_type="invalid_type", ...)
```

### 3.4 Pydantic Model Assertions

```python
from mcp_server.models.workbook import SheetInfo, WorkbookMetadata

@patch("mcp_server.tools.workbook.get_workbook_metadata")
def test_resource_sheets(mock_meta):
    mock_meta.return_value = WorkbookMetadata(
        file_path="/path/to/test.xlsx",
        sheets=[SheetInfo(name="Sheet1", min_row=1, max_row=10, min_col=1, max_col=5)],
        active_sheet="Sheet1",
        named_ranges=[],
    )
    result = resource_list_sheets("/path/to/test.xlsx")
    data = json.loads(result)
    assert data[0]["name"] == "Sheet1"
```

### 3.5 Truthiness and Membership

```python
assert res["status"] == "success"
assert res["row_count"] == 3
assert len(res["groups"]) == 3
assert "formula" in result
assert all(v is None for v in result["rows"][0])
```

---

## 4. Test Organization

### 4.1 File-Level Organisation

Organise by domain, mirroring the `routes/` structure:

```
tests/
├── conftest.py                    # shared fixtures (sample_xlsx, empty_xlsx)
├── test_cell_ops.py               # cell read/write/clear/copy
├── test_route_dispatch.py         # route entry points + dispatch
├── test_analysis.py               # analysis tools (sort, filter, aggregate)
├── test_charts.py                 # chart lifecycle
├── test_cleaning.py               # data cleaning pipelines
├── test_error_paths.py            # error handling validation
├── test_financial.py              # financial calculations
├── test_formatting.py             # cell formatting, styles
├── test_formulas.py               # formula set/get/audit
├── test_main.py                   # main module / resource mocks
├── test_security.py               # path traversal, ALLOWED_DIRS
├── test_sandbox_security.py       # custom code sandbox restrictions
└── test_statistical.py            # regression, smoothing
```

### 4.2 Class-Based Test Groups

Use classes to group related tests and improve output readability:

```python
class TestAnalysisRoutes:
    def test_filter_dispatch(self, sample_xlsx: str) -> None:
        res = filter_data_advanced(
            file_path=sample_xlsx,
            conditions=[FilterCondition(column="Age", operator=">", value=28)]
        )
        assert res["rows"] == 2

    def test_sort_dispatch(self, sample_xlsx: str) -> None:
        res = sort_data(file_path=sample_xlsx, column="Age", ascending=True)
        assert "sorted" in str(res).lower()


class TestScenarioRoute:
    def test_scenario_lifecycle(self, sample_xlsx: str) -> None:
        # Create → List → Apply
        ...
```

### 4.3 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Test file | `test_<domain>.py` | `test_cell_ops.py` |
| Test function | `test_<action>_<condition>` | `test_read_cell`, `test_error_missing_file` |
| Test class | `Test<Domain><Aspect>` | `TestAnalysisRoutes` |
| Helper function | `_create_<thing>_workbook` | `_create_lookup_workbook` |
| Fixture | `descriptive_name` | `sample_xlsx`, `empty_xlsx` |

---

## 5. Mocking Approaches

### 5.1 `unittest.mock.patch` for Route-Level Tests

When testing resources or top-level imports that delegate to tools:

```python
from unittest.mock import patch

@patch("mcp_server.tools.workbook.get_workbook_metadata")
def test_get_workbook_metadata(mock_wb_meta):
    mock_wb_meta.return_value = {"sheets": []}
    result = get_workbook_metadata("/path/to/test.xlsx")
    assert result["sheets"] == []


@patch("mcp_server.tools.workbook.rename_sheet")
@patch("mcp_server.tools.workbook.delete_sheet")
@patch("mcp_server.tools.workbook.copy_sheet")
def test_sheet_management(mock_copy, mock_del, mock_rename):
    mock_rename.return_value = "Renamed"
    mock_del.return_value = "Deleted"
    mock_copy.return_value = "Copied"

    assert sheet_management("rename", "path", "S1", "S2") == "Renamed"
    assert sheet_management("delete", "path", "S1") == "Deleted"
```

### 5.2 Patching Return Values for Resources

Resources return JSON strings — parse them:

```python
import json

@patch("mcp_server.tools.cell_ops.read_range")
def test_resource_sheet_preview(mock_read_range):
    mock_read_range.return_value = {"rows": [[1, 2]]}
    result = resource_sheet_preview("/path/to/test.xlsx", "Sheet1")
    data = json.loads(result)
    assert data["rows"] == [[1, 2]]
```

### 5.3 When NOT to Mock

- **Tool logic tests**: If you're testing `tools/cell_ops.py` directly, use real workbooks via `tmp_path`. Mocking defeats the purpose.
- **Integration tests**: Route dispatch tests should use real files to verify the full stack.

Rule of thumb: **mock boundaries, not internals.** Mock the tool call inside a route/resource, but test the tool itself against real data.

---

## 6. Parametrisation Examples

### 6.1 Simple Parameter Lists

```python
@pytest.mark.parametrize("import_stmt", [
    "import os",
    "import subprocess",
    "import socket",
    "from os import path",
    "import sys",
])
def test_custom_code_imports_blocked(tmp_path: Path, import_stmt: str) -> None:
    fp = str(tmp_path / "test.xlsx")
    create_workbook(fp)
    code = f"{import_stmt}\nresult = 1"
    result = execute_custom_code(file_path=fp, code=code)
    assert result["status"] == "error"
    assert "import statements are not allowed" in result["message"]
```

### 6.2 Multiple Parameters

```python
@pytest.mark.parametrize("chart_type,should_fail", [
    ("column", False),
    ("line", False),
    ("invalid_type", True),
    ("bar", False),
])
def test_chart_types(tmp_path: Path, chart_type: str, should_fail: bool) -> None:
    fp = str(tmp_path / "test.xlsx")
    create_workbook(fp)
    if should_fail:
        with pytest.raises(ValueError, match="type"):
            create_chart(file_path=fp, sheet_name="Sheet1", chart_type=chart_type, ...)
    else:
        result = create_chart(file_path=fp, sheet_name="Sheet1", chart_type=chart_type, ...)
        assert result is not None
```

### 6.3 Indirect Parameters via `request`

```python
@pytest.fixture(params=["2024-01-15", "March 3, 2024", "15/06/2024"])
def date_string(request: pytest.FixtureRequest) -> str:
    return request.param
```

---

## 7. Common Patterns for Testing MCP Servers

### 7.1 Testing Consolidated Dispatch Tools

Dispatch tools accept an action/operation parameter and route internally:

```python
from mcp_server.routes.cell_ops import write_cells

def test_write_cells_single(sample_xlsx: str) -> None:
    result = write_cells(mode="single", file_path=sample_xlsx, sheet_name="Sheet1",
                         cell_ref="E1", value="Status")
    assert "set" in str(result).lower()

def test_write_cells_series(sample_xlsx: str) -> None:
    result = write_cells(mode="series", file_path=sample_xlsx, sheet_name="Sheet1",
                         start_cell="F1", data=[1, 2, 3, 4, 5])
    # verify series was written sequentially
```

### 7.2 Testing Standalone Tools Directly

Import from `tools/` for pure logic tests:

```python
from mcp_server.tools.cell_ops import read_cell, write_cell, clear_range

def test_clear_range(sample_xlsx: str) -> None:
    clear_range(sample_xlsx, "Sheet1", "A2", "D2")
    result = read_range(sample_xlsx, "Sheet1", "A2", "D2")
    assert all(v is None for v in result["rows"][0])
```

### 7.3 Testing Security Boundaries

```python
def test_path_traversal_blocked(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    monkeypatch.setenv("EXCEL_MCP_ALLOWED_DIRS", str(allowed))

    # Resolves outside allowed dir
    with pytest.raises(ValueError, match="outside allowed directories"):
        create_workbook(file_path=str(allowed / ".." / "escape.xlsx"))

def test_absolute_path_blocked(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    monkeypatch.setenv("EXCEL_MCP_ALLOWED_DIRS", str(allowed))

    with pytest.raises(ValueError, match="outside allowed directories"):
        create_workbook(file_path="/etc/passwd.xlsx")
```

### 7.4 Testing Error Paths

```python
def test_error_missing_file() -> None:
    with pytest.raises(ValueError, match="not found"):
        get_sheet_summary(file_path="non_existent.xlsx", sheet_name="Sheet1")

def test_error_missing_sheet(tmp_path: Path) -> None:
    fp = str(tmp_path / "test.xlsx")
    create_workbook(fp, sheet_name="Sheet1")
    with pytest.raises(ValueError, match="not found"):
        get_sheet_summary(file_path=fp, sheet_name="MissingSheet")

def test_error_delete_last_sheet(tmp_path: Path) -> None:
    fp = str(tmp_path / "test.xlsx")
    create_workbook(fp, sheet_name="Sheet1")
    with pytest.raises(ValueError, match="only sheet"):
        sheet_management(action="delete", file_path=fp, sheet_name="Sheet1")
```

### 7.5 Testing Lifecycle Operations

```python
class TestHyperlinkLifecycle:
    def test_add_read_delete(self, sample_xlsx: str) -> None:
        fp = sample_xlsx

        # Add
        res = hyperlink(action="add", file_path=fp, sheet_name="Sheet1",
                        cell_ref="D1", url="https://example.com", tooltip="Go")
        assert "added" in str(res).lower()

        # Read
        res = hyperlink(action="read", file_path=fp, sheet_name="Sheet1", cell_ref="D1")
        assert "example.com" in str(res)

        # Delete
        res = hyperlink(action="delete", file_path=fp, sheet_name="Sheet1", cell_ref="D1")
        assert "deleted" in str(res).lower()
```

### 7.6 Testing with Real Data vs Mocks

| What to test | Approach | Why |
|---|---|---|
| Tool logic (cell ops, formulas, charts) | Real `tmp_path` workbooks | Verify actual openpyxl behaviour |
| Route dispatch correctness | Real `tmp_path` workbooks | Verify routing + tool integration |
| Resource JSON output | `@patch` tool calls | Isolate JSON serialisation |
| Top-level imports from `main.py` | `@patch` tool calls | No real server needed |
| Security/validation | Real workbooks + `monkeypatch` env | End-to-end boundary check |
| Sandbox security | Real workbooks + code injection | Verify AST guards actually block |

### 7.7 Testing Financial/Statistical Functions

```python
def test_goal_seek(tmp_path: Path) -> None:
    fp = str(tmp_path / "test.xlsx")
    create_workbook(fp)
    write_cells(mode="range", file_path=fp, sheet_name="Sheet1",
                start_cell="A1", data=[["Rate"], [0.05], ["Result"], ["=A2*B2"], ["Target"], [100]])
    result = goal_seek(file_path=fp, sheet_name="Sheet1", cell_ref="D2", target_value=100,
                       change_cell="B2")
    assert result["success"] is True
    assert abs(result["final_value"] - 100.0) < 0.01
```

### 7.8 Testing Multi-File Operations

```python
def test_multi_file_aggregate(tmp_path: Path) -> None:
    # Create two workbooks
    fp1 = str(tmp_path / "a.xlsx")
    fp2 = str(tmp_path / "b.xlsx")
    create_workbook(fp1)
    create_workbook(fp2)
    write_cells(mode="range", file_path=fp1, sheet_name="Sheet1", start_cell="A1",
                data=[["Region", "Sales"], ["East", 100], ["West", 200]])
    write_cells(mode="range", file_path=fp2, sheet_name="Sheet1", start_cell="A1",
                data=[["Region", "Sales"], ["North", 150]])

    result = multi_file(action="aggregate", file_paths=[fp1, fp2],
                        column="Sales", operation="sum")
    assert result["total"] == 450
```

---

## 8. Useful pytest Plugins

| Plugin | Purpose | Install |
|---|---|---|
| `pytest-cov` | Coverage reporting | `uv add --dev pytest-cov` |
| `pytest-xdist` | Parallel test execution | `uv add --dev pytest-xdist` |
| `pytest-timeout` | Per-test timeouts | `uv add --dev pytest-timeout` |
| `pytest-mock` | Cleaner mocking API | `uv add --dev pytest-mock` |

Example with timeout:

```python
@pytest.mark.timeout(30)
def test_large_file_read(tmp_path: Path) -> None:
    # ... creates 100k-row workbook ...
    result = read_file_chunked(large_path, "Sheet1", chunk_size=10000)
    assert result["total_rows"] == 100000
```

---

## 9. Quick Reference Checklist

- [ ] Fixtures return `str` paths, not `Path` objects
- [ ] Each test gets fresh `tmp_path` — no shared state between tests
- [ ] Use `pytest.raises(ValueError, match="...")` for expected errors
- [ ] Mock tool calls inside resources/routes, not the tools themselves
- [ ] Use `monkeypatch.setenv` / `monkeypatch.delenv` for environment-dependent tests
- [ ] Group related tests in `TestClass` classes for readable output
- [ ] Parametrise repetitive cases (invalid inputs, multiple chart types, etc.)
- [ ] Name tests descriptively: `test_<action>_<condition>`
- [ ] Keep helpers private (`_prefix`) and out of `conftest.py`
- [ ] Run `uv run pytest -v` before committing — all 69 tools should have test coverage
