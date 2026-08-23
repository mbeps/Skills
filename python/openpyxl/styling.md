# Styling, formatting, number formats

All style classes import from `openpyxl.styles`: `Font`, `PatternFill`, `GradientFill`, `Border`, `Side`, `Alignment`, `NamedStyle`, `Protection`.

## Font

```python
from openpyxl.styles import Font

ws['A1'].font = Font(color="FF0000", italic=True, size=14)
ws['B1'].font = Font(vertAlign="superscript")   # or "subscript" / "baseline"
ws['C1'].font = Font(underline="single")        # or "double", "singleAccounting", "doubleAccounting"
```

| Attribute                  | Values                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| `name`                     | font face, e.g. `'Calibri'`, `'Arial'`                             |
| `size`                     | points (alias `sz`)                                                |
| `bold`, `italic`, `strike` | bool                                                               |
| `underline`                | `'single'`, `'double'`, `'singleAccounting'`, `'doubleAccounting'` |
| `vertAlign`                | `{'superscript', 'baseline', 'subscript'}`                         |
| `color`                    | aRGB hex or `Color` (below)                                        |
| `scheme`                   | `{'minor', 'major'}`                                               |

Colors: aRGB strings are 8 hex digits `'AARRGGBB'`. A 6-digit value gets `00` prepended as the alpha byte — `Font(color="00FF00")` gives `rgb == '0000FF00'`. Legacy indexed: `Color(indexed=32)` (64/65 reserved). Theme: `Color(theme=6, tint=0.5)` — prefer aRGB because theme colors depend on the workbook theme.

## Fills

```python
ws['A1'].fill = PatternFill(fill_type='solid', start_color='FFC7CE', end_color='FFC7CE')
ws['A2'].fill = PatternFill("solid", fgColor="DDDDDD")   # fgColor/start_color and bgColor/end_color are aliases
ws['A3'].fill = GradientFill(stop=("000000", "FFFFFF"))  # type 'linear' (default) or 'path'
```

- **`fill_type` is required** — a `PatternFill` without it has no effect.
- Valid `patternType` values: `solid`, `gray125`, `darkGrid`, `darkVertical`, `gray0625`, `lightHorizontal`, `lightDown`, `lightUp`, `darkGray`, `darkHorizontal`, `lightGray`, `lightTrellis`, `darkUp`, `mediumGray`, `lightGrid`, `darkDown`, `darkTrellis`, `lightVertical`.
- `GradientFill(type='linear'|'path', degree=0, stop=())`; `stop` accepts hex strings or `Stop(color, position)` objects.

## Borders

```python
from openpyxl.styles import Border, Side

thin = Side(border_style="thin", color="000000")
double = Side(border_style="double", color="ff0000")
ws['B2'].border = Border(top=double, left=thin, right=thin, bottom=double)
```

- **`border_style` is required** — a `Side` with only a color renders nothing.
- Valid styles: `thin`, `medium`, `thick`, `double`, `dotted`, `dashed`, `hair`, `dashDot`, `dashDotDot`, `mediumDashDot`, `mediumDashDotDot`, `slantDashDot`, `mediumDashed`.
- Diagonal borders also need `diagonalUp=True` and/or `diagonalDown=True` on the `Border`.

## Alignment

```python
ws['A1'].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True, shrink_to_fit=True)
ws['B1'].alignment = Alignment(horizontal="right", indent=1)
```

- `horizontal` ∈ `{'general', 'left', 'center', 'right', 'fill', 'justify', 'centerContinuous', 'distributed'}`
- `vertical` ∈ `{'top', 'center', 'bottom', 'justify', 'distributed'}`
- `text_rotation` integer 0–180, plus `255` for stacked text (90 = vertical).
- Aliases: `wrap_text`, `shrink_to_fit`, `text_rotation` (snake_case) ↔ `wrapText`, `shrinkToFit`, `textRotation`.

## Applying styles to cells

```python
cell.font = Font(...)
cell.fill = PatternFill(...)
cell.border = Border(...)
cell.alignment = Alignment(...)
cell.number_format = "0.00"        # plain string, default 'General'
cell.protection = Protection(locked=True, hidden=False)
```

- **Cell styles are shared and immutable after assignment.** `a1.font.italic = True` raises — `cell.font` returns a read-only `StyleProxy`. To change a style, reassign a new object: `a1.font = Font(color="FF0000", italic=True)`.
- Copy a style before mutating it:

```python
from copy import copy
ft2 = copy(ft1)
ft2.name = "Tahoma"        # ft1 untouched
```

- Styles on `ws.column_dimensions` / `ws.row_dimensions` only affect cells created (in Excel) after the file is closed — style each cell individually for existing data.
- Merged cells: style the **top-left** cell (value, fill, font, border, alignment) — the rest of the merge derives from it.

## NamedStyle and builtin styles

```python
from openpyxl.styles import NamedStyle, Font, Border, Side

highlight = NamedStyle(name="highlight")   # NamedStyles ARE mutable
highlight.font = Font(bold=True, size=20)
bd = Side(style='thick', color="000000")
highlight.border = Border(left=bd, top=bd, right=bd, bottom=bd)
wb.add_named_style(highlight)              # explicit registration
# or auto-registered on first assignment:
ws['A1'].style = highlight
ws['D5'].style = 'highlight'               # reference by name afterwards
```

- Named styles are a per-workbook registry; once a style is assigned to a cell, later mutations of the `NamedStyle` do **not** affect that cell (assignment snapshots).
- A named style defines the whole cell style — it cannot be combined with partial per-cell overrides.

Builtin styles (from `openpyxl.styles.builtins`, assign via `cell.style`): openpyxl only recognises the **exact English names** — `'Headline 1'`, not `'Heading 1'`:

| Style                                                                 | Typical use                                 |
| --------------------------------------------------------------------- | ------------------------------------------- |
| `'Title'`, `'Headline 1'`–`'Headline 4'`                              | headings and titles                         |
| `'Hyperlink'`, `'Followed Hyperlink'`                                 | links, visited links                        |
| `'Linked Cell'`, `'Input'`, `'Output'`, `'Check Cell'`                | model cells: linked, input, output, checked |
| `'Calculation'`, `'Total'`                                            | computed values, totals                     |
| `'Good'`, `'Bad'`, `'Neutral'`                                        | comparison highlights                       |
| `'Note'`, `'Warning Text'`, `'Explanatory Text'`                      | annotations                                 |
| `'Comma'`, `'Comma [0]'`, `'Currency'`, `'Currency [0]'`, `'Percent'` | number formats                              |
| `'Accent1'`–`'Accent6'`, `'20 % - Accent1'`–`'60 % - Accent6'`        | theme accent fills                          |
| `'Pandas'`, `'Normal'`                                                | pandas export, default plain style          |

## Number formats

```python
ws['A2'] = 0.123456
ws['A2'].number_format = "0.00"     # display 2 dp
ws['B2'].number_format = FORMAT_PERCENTAGE_00   # '0.00%'
```

| Code               | Meaning              |
| ------------------ | -------------------- |
| `'0.00'`           | 2 decimal places     |
| `'#,##0'`          | thousands separators |
| `'#,##0.00'`       | separators + 2 dp    |
| `'0.00%'` / `'0%'` | percent              |
| `'yyyy-mm-dd'`     | ISO date             |
| `'@'`              | text                 |
| `'General'`        | default              |

Constants live in `openpyxl.styles.numbers` as `FORMAT_*`: `FORMAT_GENERAL`, `FORMAT_TEXT`, `FORMAT_NUMBER_00`, `FORMAT_NUMBER_COMMA_SEPARATED1`, `FORMAT_PERCENTAGE_00`, `FORMAT_DATE_YYYYMMDD2`, `FORMAT_DATE_DATETIME` (`'yyyy-mm-dd h:mm:ss'`), `FORMAT_DATE_TIMEDELTA` (`'[hh]:mm:ss'`). Helpers: `builtin_format_code(id)`, `builtin_format_id(code)`, `is_date_format(fmt)`, `is_datetime(fmt)`, `is_timedelta_format(fmt)`.

- Writing a Python `datetime` auto-assigns `'yyyy-mm-dd h:mm:ss'`; `time`/`timedelta` get auto time formats — but overwriting the style can lose them (see formulas-and-gotchas.md).
- Custom format strings can have up to 4 `;`-separated sections (positive;negative;zero;text).

## Gotchas

- `PatternFill` without `fill_type` and `Side` without `border_style` are silently invisible.
- Cell styles are immutable after assignment — mutate via reassignment or `copy()`, never in place.
- 6-digit hex colors get an alpha byte prepended: `"00FF00"` becomes `rgb='0000FF00'` (alpha 00).
- Row/column dimension styles never apply to existing cells.
- Builtin style names must be the exact English spellings (`'Headline 1'`, not `'Heading 1'`).
- Named-style assignment snapshots the style; mutate before assigning.
- Excel has a ~65,530 style limit — generating many distinct styles breaks the file.
- Merged cells: only the top-left cell's style matters.
