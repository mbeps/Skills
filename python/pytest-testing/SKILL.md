---
name: pytest-testing
description: Use when writing or reviewing pytest tests for Python projects — fixture design, parametrization, assertion strategies, conftest organization, mocking boundaries, markers, coverage, test configuration, MCP server testing patterns, security edge cases, real-file vs mock decisions
---

# PyTest Testing Skill

## Overview

Comprehensive pytest testing patterns from production MCP server codebases. Covers fixture design, parametrization, assertion strategies, conftest organization, mocking boundaries, markers, coverage, and tool-dispatch server patterns.

**Core principle:** Test the boundary between what you control (domain logic) and what you don't (I/O, network, external services). Use real files for domain logic, mocks for boundaries.

## When to Use

- Writing or reviewing pytest tests for Python projects
- Setting up pytest configuration, fixtures, or parametrization
- Deciding when to mock vs use real operations
- Testing MCP servers, CLI tools, API wrappers

## When NOT to Use

- Simple pure functions (use `assert` directly)
- Property-based testing (use hypothesis)

## Quick Reference

| Concern | Pattern | Reference |
|---------|---------|-----------|
| Fixtures | scopes, factories, yield teardown, override | [fixtures.md](fixtures.md) |
| Built-in fixtures | caplog, capsys, tmp_path | [built-in-fixtures.md](built-in-fixtures.md) |
| Parametrization | @pytest.mark.parametrize, stacked, indirect | [parametrization.md](parametrization.md) |
| Assertions | direct values, pytest.approx, pytest.raises | [assertions.md](assertions.md) |
| Conftest hierarchy | shared → domain-specific → file-local | [conftest.md](conftest.md) |
| Mocking | monkeypatch > patch; real files for domain logic | [mocking.md](mocking.md) |
| Markers | custom markers, skipif, xfail, expressions | [markers.md](markers.md) |
| Coverage | pytest-cov, thresholds, excluded paths | [coverage.md](coverage.md) |
| Configuration | pyproject.toml [tool.pytest.ini_options] | [configuration.md](configuration.md) |

## Core Patterns

### Real-File Verification Cycle

For domain logic that manipulates files:

```python
def test_write_and_read(tmp_path: Path) -> None:
    path = str(tmp_path / "test.xlsx")
    
    # Write via function under test
    write_cell(path, "Sheet1", "A1", "value")
    
    # Verify by re-reading
    result = read_cell(path, "Sheet1", "A1")
    assert result["value"] == "value"
```

### Dispatch Tool Testing

For consolidated tools with action/operation parameters:

```python
@pytest.mark.parametrize("action,expected", [
    ("rename", lambda r: r["new_name"] == "NewSheet"),
    ("delete", lambda r: "deleted" in r.get("status", "").lower()),
])
def test_sheet_management_dispatch(sample_xlsx: str, action: str, expected: Callable) -> None:
    result = sheet_management(action, sample_xlsx, "Sheet1", new_name="NewSheet")
    assert expected(result), f"{action} failed: {result}"
```

### Security Edge Cases

```python
def test_path_traversal_blocked(tmp_path: Path) -> None:
    outside = str(tmp_path.parent / "outside" / "file.xlsx")
    with pytest.raises(ValueError, match="outside allowed directories"):
        create_workbook(file_path=outside)
```

## Implementation Guide

Detailed patterns and examples are in the reference files linked above. Start with [fixtures.md](fixtures.md) for test setup, then [assertions.md](assertions.md) for verification patterns.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Case-insensitive substring assertions (`"sorted" in str(res).lower()`) | Structured dict assertions on returned values |
| Duplicated fixtures across test files | Lift to conftest.py |
| No pytest config in pyproject.toml | Add `[tool.pytest.ini_options]` with markers, filterwarnings |
| Mutable shared state between tests | Function-scoped fixtures with fresh instances |

## Related Skills

- **superpowers:test-driven-development** — RED-GREEN-REFACTOR cycle for test-first development
- **superpowers:verification-before-completion** — run tests before claiming work is complete
- **coding-practices:karpathy-guidelines** — reduce common LLM coding mistakes including test-related errors
