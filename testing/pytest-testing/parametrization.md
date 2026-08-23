# PyTest Parametrization

## Overview

Parametrization runs the same test logic with multiple inputs. This guide covers patterns from production MCP server testing.

## Basic Parametrization

```python
@pytest.mark.parametrize("action,expected_status", [
    ("rename", "renamed"),
    ("delete", "deleted"),
    ("hide", "hidden"),
    ("unhide", "visible"),
])
def test_sheet_actions(sample_xlsx: str, action: str, expected_status: str) -> None:
    result = sheet_management(action, sample_xlsx, "Sheet1")
    assert expected_status in str(result).lower()
```

## Multiple Parameters (Cartesian Product)

```python
@pytest.mark.parametrize("chart_type", ["bar", "line", "pie", "scatter", "column"])
@pytest.mark.parametrize("style", [10, 1, 6])
def test_chart_styles(chart_type: str, style: int) -> None:
    # Runs 5 × 2 = 10 test cases
    ...
```

## Custom Test IDs

```python
@pytest.mark.parametrize("operation,expected", [
    pytest.param("fv", lambda r: r["future_value"] > 0, id="fv-positive"),
    pytest.param("pv", lambda r: r["present_value"] > 0, id="pv-positive"),
    pytest.param("irr", lambda r: abs(r["irr"]) < 1.0, id="irr-reasonable"),
])
def test_time_value_calc(operation: str, expected: Callable) -> None:
    ...
```

## Indirect Parameters

For expensive setup that depends on a parameter:

```python
@pytest.fixture(params=["xlsx", "csv"], indirect=True)
def input_file(request, tmp_path):
    """Converts 'xlsx'/'csv' string param into actual file path."""
    ext = request.param
    path = tmp_path / f"test.{ext}"
    # ... create file ...
    return str(path)

def test_read_input(input_file: str) -> None:
    data = read_file(input_file)
    assert len(data) > 0
```

## Parametrized Fixtures

Define parameters at fixture level for cleaner tests:

```python
@pytest.fixture(params=[
    {"fixed_costs": 1000, "price": 10, "variable": 5},
    {"fixed_costs": 5000, "price": 25, "variable": 15},
    {"fixed_costs": 0, "price": 100, "variable": 50},
])
def break_even_params(request):
    return request.param

def test_break_even(break_even_params: dict) -> None:
    result = break_even_analysis(
        fixed_costs=break_even_params["fixed_costs"],
        price_per_unit=break_even_params["price"],
        variable_cost_per_unit=break_even_params["variable"],
    )
    assert result["break_even_units"] >= 0
```

## Dynamic Parameter Generation

Use `pytest_generate_tests` hook in conftest:

```python
def pytest_generate_tests(metafunc):
    if "chart_type" in metafunc.fixturenames:
        metafunc.parametrize(
            "chart_type",
            ["bar", "line", "pie", "scatter", "column"],
            ids=[f"chart-{t}" for t in ["bar", "line", "pie", "scatter", "column"]],
        )
```

## Common Patterns from excel-mcp

### Action-Dispatch Matrices

For consolidated tools with action/operation dispatch:

```python
@pytest.mark.parametrize("action", [
    "set", "batch", "fill", "auto_sum",
])
def test_formula_write_actions(sample_xlsx: str, action: str) -> None:
    result = formula_write(action, sample_xlsx, "Sheet1", "A1", "=SUM(B1:B10)")
    assert result is not None
```

### Financial Operation Tests

```python
@pytest.mark.parametrize("operation,params,expected_key", [
    ("fv", {"rate": 0.05, "nper": 10, "pmt": -100}, "future_value"),
    ("pv", {"rate": 0.05, "nper": 10, "pmt": -100}, "present_value"),
    ("irr", {"values": [-100, 30, 40, 50]}, "irr"),
])
def test_time_value_operations(operation, params, expected_key) -> None:
    result = time_value_calc(operation, **params)
    assert expected_key in result
```

## Anti-Patterns

| Anti-Pattern                                | Problem                         | Fix                                                          |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| One massive parametrized file (>1000 lines) | Hard to navigate, slow to debug | Split by domain (charts, financial, formatting)              |
| Lambda assertions in params                 | Hard to read failure messages   | Use named functions or explicit assert blocks                |
| Missing `ids` for long parameter lists      | Unclear which case failed       | Add `ids=[...]` or use `pytest.param()`                      |
| Over-parametrizing trivial variations       | Test explosion                  | Group similar cases, parametrize only meaningful differences |
