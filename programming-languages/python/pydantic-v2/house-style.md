# House Style — THIS repo (excel-mcp, pydantic 2.12.5)

This file is **authoritative for excel-mcp**. It documents the tiny subset of
Pydantic v2 actually used. The reference files (`models.md`, `validators.md`,
etc.) document the full API — reach for those only when a feature genuinely
requires it.

## What IS used here

- **Every substantive model file starts with `from __future__ import annotations`**
  (the non-init placeholder model files — e.g. `cleaning.py`, `financial.py` — are
  empty docstrings with no classes and don't need it).
- **`BaseModel` + `Field(..., description=...)`** — every field gets a
  `description`. Required = `Field(..., ...)`; optional `T | None` =
  `Field(None, ...)`; bool default = `Field(True, ...)`.

  ```python
  class SheetSummary(BaseModel):
      """High-level summary of a worksheet's contents."""
      name: str = Field(..., description="Name of the worksheet.")
      row_count: int = Field(..., description="Total number of used rows.")
      headers: list[str] = Field(..., description="Column header values from the first row.")
  ```

- **Output models are constructed at the boundary and returned directly**
  (e.g. to FastMCP):
  ```python
  return ColumnStats(column=column, count=int(col.count()), message=...)
  ```

- **`model_dump()` is called at boundaries, always NO-ARG** (python mode):
  ```python
  raw = [s.model_dump() for s in sort_by] if sort_by else None
  ```
  For MCP resource JSON:
  ```python
  json.dumps([s.model_dump() for s in metadata.sheets], indent=2)
  ```

- **`TypedDict` (incl. `total=False`) for loose output shapes:**
  ```python
  class RegressionResult(TypedDict, total=False):
      r_squared: float
      coefficients: dict[str, float]
      n_observations: int
  ```

- **`TypeAlias` for shared scalar unions** (`models/common.py`):
  ```python
  CellScalar: TypeAlias = str | int | float | bool | datetime | date | None
  ```

- **`Literal` (NOT `Enum`) for constrained string values:**
  ```python
  BorderStyle = Literal["dashDot", "dashed", "double", "hair", "thin", ...]
  ```

- **Route/tool signatures use PLAIN typed Python + `Literal[...]` + docstring
  `Args:` sections.** FastMCP infers the schema from annotations + docstrings.
  Pydantic `Field` is **NOT** used at the route layer.

- **No Field constraints** (no `gt/ge/le`, `min_length`, `alias`, `examples`,
  `deprecated`). Deliberate YAGNI — don't force them in.

## What is NOT used here (do not introduce casually)

None of these appear anywhere in the repo: `field_validator`, `model_validator`,
`computed_field`, `TypeAdapter`, `Annotated`, `ConfigDict`, discriminated unions,
`ValidationError` catching, `model_validate`, `model_dump_json`.

They are documented as available reference (see the reference files) but are
**not project idiom**. Before adding one, ask whether house style already covers
the need — if not, add it deliberately and document why.
