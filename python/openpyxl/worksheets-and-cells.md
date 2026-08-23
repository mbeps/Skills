# Worksheets and cells

## Worksheet state and appearance

```python
ws.title = "New Title"                 # max 31 chars; invalid/duplicate names raise
ws.sheet_state = 'hidden'              # {'visible', 'hidden', 'veryHidden'}
ws.sheet_properties.tabColor = "1072BA"  # hex string WITHOUT '#'
ws.freeze_panes = 'A2'                 # freeze everything above/left of the cell; None or 'A1' clears
ws.auto_filter.ref = 'A1:C10'          # configures filter dropdowns (see below)
ws.sheet_view.zoomScale = 85
ws.sheet_view.showGridLines = False    # ws.show_gridlines = False also works
```

- `'veryHidden'` sheets cannot be unhidden from the Excel UI.
- `ws.sheet_state` constants: `SHEETSTATE_VISIBLE`, `SHEETSTATE_HIDDEN`, `SHEETSTATE_VERYHIDDEN`.
- `ws.auto_filter` only stores the filter configuration — Excel applies it; openpyxl does not filter or sort.
- A worksheet can have multiple views (`ws.views.sheetView[0]`, ...); `ws.sheet_view` returns only the first.
- Row/column outline groups: `ws.column_dimensions.group('A', 'D', hidden=True)`, `ws.row_dimensions.group(1, 10, hidden=True)`.

## Cell access

```python
ws['A1'] = 42                          # creates the cell if it doesn't exist
c = ws.cell(row=4, column=2, value=10) # row/column notation (1-based)
cell_range = ws['A1':'C2']             # tuple of rows of Cells
col_c = ws['C']; cols = ws['C:D']      # whole columns
row_10 = ws[10]; rows = ws[5:10]       # whole rows
```

`Cell` attributes: `value`, `coordinate` (`'A5'`), `column_letter`, `row`, `column` (1-based), `col_idx`, `data_type`, `is_date`, `comment`, `hyperlink`, `offset(row=0, column=0)`.

## Iteration and bounds

```python
for row in ws.iter_rows(min_row=1, max_row=10, max_col=3, values_only=True):
    print(row)
for row in ws.values:                  # all values by row (skips trailing blank rows)
    print(row)
ws.append([1, 2, 3])                   # values at the bottom of the sheet
ws.append({'A': 'x', 'C': 'y'})        # dict keyed by column letter or 1-based number
```

- `ws.iter_rows(min_row, max_row, min_col, max_col, values_only=False)` — generator by row.
- `ws.iter_cols(...)` — generator by column; `ws.rows` / `ws.columns` — generator properties.
- **`iter_cols()` and `ws.columns` are not available in read-only mode.**
- Bounds: `ws.max_row`, `ws.max_column`, `ws.min_row`, `ws.min_column` (1-based extents); `ws.calculate_dimension()` returns the bounding range string (`'A1:M24'`); `ws.dimensions` is the same as a property.
- `ws.append` raises `TypeError` for anything that is not a list/tuple/range/generator/dict.

## Coordinate utilities

| Function                        | Result                                                |
| ------------------------------- | ----------------------------------------------------- |
| `get_column_letter(27)`         | `'AA'` (1-based int → letters)                        |
| `column_index_from_string('C')` | `3` (base-26 letters → 1-based int)                   |
| `coordinate_from_string('B12')` | `('B', 12)`                                           |
| `coordinate_to_tuple('B12')`    | `(12, 2)` — (row, column)                             |
| `range_boundaries('A1:C3')`     | `(1, 1, 3, 3)` — (min_col, min_row, max_col, max_row) |
| `absolute_coordinate('B12')`    | `'$B$12'`                                             |
| `quote_sheetname('My Sheet')`   | `"'My Sheet'"`                                        |

Import from `openpyxl.utils` (and `openpyxl.utils.cell` for `range_boundaries`).

## Merged cells

```python
ws.merge_cells('A1:D2')                              # range-string form
ws.merge_cells(start_row=4, start_column=1, end_row=4, end_column=4)
ws['A1'] = "Title"                                   # value lives in the TOP-LEFT cell only
for rng in ws.merged_cells.ranges:
    print(rng)                                       # e.g. A1:D2
ws.unmerge_cells('A1:D2')
```

- Non-anchor cells of a merge are `MergedCell` objects whose `value` is always `None`; writing to them raises.
- The merged range's style comes from the top-left cell (see styling.md).
- Overlapping merges are not allowed.

## Row and column dimensions

```python
ws.column_dimensions['A'].width = 20.0    # keyed by column letter
ws.row_dimensions[1].height = 30.0        # keyed by row number
ws.row_dimensions[2].hidden = True
ws.column_dimensions['B'].width = max(len(str(v)) for v in col_values) + 2  # manual "auto-fit"
```

- `customWidth`/`customHeight` are set automatically when a width/height is assigned.
- `bestFit`/`auto_size` is only a serialised hint — openpyxl does **not** auto-fit; compute the width yourself.
- Styles assigned via row/column dimensions only affect cells created (in Excel) after the file is closed — apply per-cell for existing ranges (see styling.md).

## Insert, delete, move

- `ws.insert_rows(idx)`, `ws.insert_cols(idx)`, `ws.delete_rows(idx, amount=1)`, `ws.delete_cols(idx, amount=1)` — 1-based positions.
- openpyxl does **not** manage dependencies: inserting/deleting rows or columns does not update formulas, tables, charts, or defined names.
- `ws.move_range("D4:F10", rows=-1, cols=2, translate=False)` moves values but **does not update formulas** unless `translate=True`; references *to* the moved range from elsewhere are never updated, and existing cells in the destination are overwritten.

## Gotchas

- **Cells are created on access**: `for x in ...: for y in ...: ws.cell(row=x, column=y)` creates every cell in memory for nothing — use `iter_rows`/`values`/`append` for bulk work.
- `iter_cols()` and `ws.columns` are unavailable in read-only mode (see workbooks.md).
- `ws.values` only yields rows that contain cells; trailing blank rows/columns are skipped.
- `move_range` overwrites destination cells and leaves formulas stale unless `translate=True`.
- Merged cells: value and style are defined only by the top-left cell; writing elsewhere raises.
- Invalid sheet titles raise `ValueError` (empty, too-long, duplicates) or `SheetTitleException` (illegal characters: `: \ / ? * [ ]`).
- Row/column dimension styles do not affect existing cells — see styling.md.
