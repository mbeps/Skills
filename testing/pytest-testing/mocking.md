# PyTest Mocking

## Overview

Mocking replaces real dependencies with test doubles. This guide covers when and how to mock in production MCP server testing.

## Decision Framework: Mock vs Real

```
Does the code manipulate files/data you can create?
├── Yes → Use REAL files (tmp_path fixtures)
│         └── Domain logic tests (cell_ops, charts, financial)
└── No → MOCK the boundary
          └── Route wrappers, network calls, external services
```

**Rule of thumb:** Test domain logic with real operations. Mock I/O boundaries and route wrappers.

## monkeypatch (Preferred)

Auto-teardown, cleanest API:

```python
def test_route_with_mocked_tool(monkeypatch) -> None:
    """Mock a tool function within a route wrapper."""
    mock_func = monkeypatch.setattr(
        "mcp_server.tools.workbook.get_workbook_metadata",
        lambda file_path: {"sheets": ["Sheet1"], "sheet_count": 1},
        raising=False,
    )
    
    result = get_workbook_metadata("/fake/path.xlsx")
    assert result["sheets"] == ["Sheet1"]
```

## @patch Decorator

For patching at module level:

```python
from unittest.mock import patch

@patch("mcp_server.tools.workbook.get_workbook_metadata")
def test_get_workbook_metadata(mock_wb_meta) -> None:
    mock_wb_meta.return_value = {"sheets": []}
    result = get_workbook_metadata("/path/to/test.xlsx")
    assert result["sheets"] == []
```

**Patch at the layer where it's used**, not where it's defined. Patch `mcp_server.tools.workbook.func` not `openpyxl.func`.

## MagicMock for Complex Interactions

```python
from unittest.mock import MagicMock, call

def test_multiple_calls(mock_service):
    mock_service.process.side_effect = [
        {"status": "ok"},
        {"status": "error", "message": "fail"},
    ]
    
    assert mock_service.process() == {"status": "ok"}
    assert mock_service.process() == {"status": "error"}
    assert mock_service.process.call_count == 2
```

## Fixtures with Mocks

```python
@pytest.fixture
def mock_http_client(monkeypatch):
    """Provide a mocked HTTP client for API tests."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"data": "test"}
    
    def mock_get(*args, **kwargs):
        return mock_response
    
    monkeypatch.setattr("httpx.Client.get", mock_get)
    return mock_response
```

## Common Patterns from excel-mcp

### Route Wrapper Testing

Test dispatch logic without hitting real files:

```python
def test_sheet_management_paths(monkeypatch) -> None:
    monkeypatch.setattr(
        main._workbook, "rename_sheet",
        lambda file_path, sheet_name, new_name: "RENAMED",
    )
    monkeypatch.setattr(
        main._workbook, "delete_sheet",
        lambda file_path, sheet_name: "DELETED",
    )
    
    result = sheet_management("rename", "path.xlsx", "Sheet1", new_name="New")
    assert result == "RENAMED"
```

### Full-Coverage Mock Tests

One massive test mocking every route action:

```python
@patch("mcp_server.tools.workbook.get_workbook_metadata")
@patch("mcp_server.tools.cell_ops.read_cell")
def test_full_coverage(mock_read, mock_meta) -> None:
    mock_meta.return_value = {"sheets": ["Sheet1"]}
    mock_read.return_value = {"value": "test"}
    # ... test all routes ...
```

## Anti-Patterns

| Anti-Pattern                              | Problem                                      | Fix                                      |
| ----------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Mocking domain logic that uses real files | Tests pass but real usage fails              | Use tmp_path fixtures for domain logic   |
| Patching at wrong layer                   | Fragile to refactoring                       | Patch where the dependency is looked up  |
| Over-mocking                              | Tests verify nothing                         | Mock only I/O boundaries, not pure logic |
| Forgetting to restore mocks               | Cross-test pollution                         | Prefer monkeypatch (auto-restore)        |
| Mocking too much                          | Tests become documentation of implementation | Mock interfaces, not implementations     |
