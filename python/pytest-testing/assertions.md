# PyTest Assertions

## Overview

Pytest assertion rewriting provides detailed failure messages. This guide covers assertion strategies from production MCP server testing.

## Direct Value Assertions

Preferred approach — pytest rewrites asserts for introspection:

```python
def test_read_cell(sample_xlsx: str) -> None:
    result = read_cell(sample_xlsx, "Sheet1", "A1")
    assert result["value"] == "Name"
    assert result["row"] == 1
    assert result["column"] == "A"
```

**Why prefer over `assertEqual`:** Pytest shows actual vs expected on failure without needing `-v`.

## Numerical Precision

```python
# ✅ GOOD: pytest.approx for floats
assert result["current_ratio"]["value"] == pytest.approx(2.0)
assert result["quick_ratio"]["value"] == pytest.approx(1.5, abs=0.01)

# ❌ BAD: Manual epsilon comparisons
assert abs(result["value"] - 5.0) < 0.001
```

## Exception Assertions

```python
# ✅ GOOD: Context manager with match
with pytest.raises(ValueError, match="outside allowed directories"):
    create_workbook(file_path=traversal_path)

# ✅ GOOD: Unknown action dispatch
with pytest.raises(ValueError, match="Unknown action"):
    sheet_management("invalid", "path.xlsx", "S1")

# ❌ BAD: try/except (loses pytest introspection)
try:
    create_workbook(file_path=bad_path)
    assert False, "Should have raised"
except ValueError:
    pass
```

## Structured Dict Assertions

```python
# ✅ GOOD: Assert specific keys and values
assert result["sheets"] == []
assert result["row_count"] == 2
assert result["rows"][0] == ["Name", "Age", "City", "Salary"]

# ❌ BAD: Case-insensitive substring checks (fragile)
assert "sorted" in str(res).lower()
assert "Copied" in result or "copied" in result.lower()
```

## Truthiness and Containment

```python
# ✅ GOOD: Explicit containment
assert "target_sheet" in result
assert len(result["charts"]) > 0

# ✅ GOOD: Empty collection checks
assert not result.get("errors")
assert bool(result.get("success"))
```

## Custom Assertion Messages

```python
assert result["value"] == expected, f"Expected {expected}, got {result['value']} at {result.get('cell')}"
```

## Common Patterns from excel-mcp

### Financial Ratio Validation

```python
def test_all_seven_ratios_present(result: dict) -> None:
    expected_ratios = [
        "current_ratio", "quick_ratio", "debt_to_equity",
        "gross_margin", "operating_margin", "net_margin", "roe",
    ]
    for ratio_name in expected_ratios:
        assert ratio_name in result, f"Missing ratio: {ratio_name}"
```

### Chart Type Verification

```python
CHART_TYPES = ["bar", "line", "pie", "scatter", "column"]

@pytest.mark.parametrize("chart_type", CHART_TYPES)
def test_chart_creation(chart_type: str, tmp_path: Path) -> None:
    path = str(tmp_path / f"{chart_type}.xlsx")
    # ... create chart ...
    charts = list_charts(path, "Sheet1")
    assert len(charts) == 1
    assert charts[0]["type"] == chart_type
```

## Anti-Patterns

| Anti-Pattern                           | Problem                                    | Fix                                |
| -------------------------------------- | ------------------------------------------ | ---------------------------------- |
| `assert "text" in str(result).lower()` | Fragile, depends on implementation wording | Assert on structured return values |
| `self.assertEqual()` from unittest     | Loses pytest's assertion rewriting         | Use plain `assert`                 |
| Bare `assert result`                   | No failure detail if it fails              | Assert specific properties         |
| Catching broad `Exception`             | Hides actual errors                        | Catch specific exception types     |
| Returning `True`/`False` from tests    | Can't see why it failed                    | Use explicit assertions            |
