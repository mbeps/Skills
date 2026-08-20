# Formulas, dates, performance, pitfalls

## Writing formulas

Formulas are plain strings starting with `=`. openpyxl stores them verbatim and sets `cell.data_type == 'f'`; it does **not** validate that functions exist.

```python
ws['F2'] = "=SUM(B2:E2)"
ws['A1'] = '=IF(B1>0, "positive", "non-positive")'
```

## openpyxl has no calculation engine

openpyxl never evaluates formulas and stores no computed results. Cached values only exist if the file was last saved by an app that calculated them (Excel/LibreOffice). Files written purely by openpyxl have **no cached values**.

```python
wb = load_workbook('book.xlsx')               # formula strings (default)
wb = load_workbook('book.xlsx', data_only=True)  # cached values
```

- `data_only=True` on a formula cell returns the cached value **or `None`** if the file never went through a spreadsheet app — the classic "my formulas read back as None" trap.
- If you need computed results, calculate in Python, or round-trip through an external calculator (e.g. LibreOffice headless) before reading with `data_only=True`.

## Moving and translating formulas

```python
from openpyxl.formula.translate import Translator
ws['G2'] = Translator("=SUM(B2:E2)", origin="F2").translate_formula("G2")
# -> '=SUM(C2:F2)'
```

- `Translator` supports A1-style references only — no defined names, no R1C1.
- `ws.move_range("G4:H10", rows=1, cols=1, translate=True)` rewrites relative references *inside* the moved range; references to the moved cells from elsewhere are **not** updated.
- Inserting/deleting rows or columns does **not** adjust formulas, tables, charts, or defined names — openpyxl does not manage dependencies; rewrite affected formulas yourself.
- Tokenising for inspection: `openpyxl.formula.Tokenizer("=SUM(A1:A10)")` yields tokens with `.value`, `.type`, `.subtype`.

## Dates and times

```python
import datetime
ws['A1'] = datetime.datetime.now()        # auto-converted to an Excel serial
ws['B1'] = datetime.date(2026, 8, 20)
ws['C1'] = datetime.time(14, 30)
ws['D1'] = datetime.timedelta(hours=3)
ws['A1'].number_format = 'yyyy-mm-dd'     # display format is a style, not the value
```

- The Excel date epoch is `datetime.datetime(1899, 12, 30)` — Excel serial 1 = 1900-01-01 and serial 60 is the fictitious 1900-02-29, so the epoch is *not* 1900-01-01.
- Manual conversion: `from openpyxl.utils.datetime import to_excel, from_excel` — `to_excel(dt)`, `from_excel(46254)` (both default to the 1899-12-30 epoch).
- Cells read back as `datetime` **only when the stored number format is a date format** (`cell.is_date`); otherwise you get a bare float serial. If you want dates back, set `cell.number_format` to a date code.
- `datetime` values auto-get `'yyyy-mm-dd h:mm:ss'`; `time`/`timedelta` auto-get time formats — overwriting the style loses the format.
- `timedelta` is not part of the OOXML spec; it only round-trips in strict-OOXML timedelta encoding.
- `Workbook(iso_dates=True)` writes dates as ISO 8601 strings instead of Excel serials — Excel may not interpret them as dates.
- Timedelta helpers: `timedelta_to_days`, `time_to_days`, `days_to_time`, `to_ISO8601`, `from_ISO8601` in `openpyxl.utils.datetime`.

## Performance

- Normal mode memory use is roughly **50× the file size** (e.g. 2.5 GB for a 50 MB file).
- Large reads: `load_workbook(path, read_only=True)` streams rows; must `wb.close()`; supports parallel reads of the same file across processes.
- Large writes: `Workbook(write_only=True)` stays under ~10 MB and saves once; install **lxml** to speed it up.
- Read chunks: `ws.iter_rows(min_row=..., max_row=..., values_only=True)` avoids materialising the whole sheet.
- `keep_links=False` on load skips cached external-workbook data and speeds up loading.
- Never create cells in a loop with `ws.cell(row, col)` for bulk data — use `append`/`iter_rows` (see worksheets-and-cells.md).

## Gotchas

Consolidated pitfalls and fixes:

| Pitfall                                                                   | Fix                                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `data_only=True` returns `None` for formulas in openpyxl-written files    | No cached values exist until a spreadsheet app saves the file — see above                                 |
| Formulas not updated by row/col insert/delete or `move_range`             | Rewrite formulas yourself; `move_range(..., translate=True)` only fixes references inside the moved range |
| Dates read back as float serials                                          | Ensure the cell's number format is a date format                                                          |
| Cells created on access (`ws.cell()` loops)                               | Use `ws.append()` / `iter_rows()`                                                                         |
| Style mutation in place raises                                            | Reassign a new style object; use `copy()` (see styling.md)                                                |
| `PatternFill`/`Side` without type/style render nothing                    | Always pass `fill_type` / `border_style` (see styling.md)                                                 |
| Merged-cell non-anchor writes fail; value is `None`                       | Write to the top-left cell only (see worksheets-and-cells.md)                                             |
| Row/column dimension styles don't apply to existing cells                 | Style each cell individually (see styling.md)                                                             |
| `copy_worksheet()` loses charts/images                                    | Recreate them; copies within one workbook only (see workbooks.md)                                         |
| Read-only workbook leaks file handle                                      | Always call `wb.close()`                                                                                  |
| Read-only mode: no `iter_cols()`/`columns`, no comments                   | Use `ws.values`/`iter_rows(values_only=True)`                                                             |
| Write-only workbook: second `save()` raises `WorkbookAlreadySaved`        | Build all rows first; save once                                                                           |
| `.xlsm` loads/saves without `keep_vba=True`                               | Preserve macros on both load and save, keep matching extension                                            |
| `wb.save()` overwrites silently                                           | Check the target path first                                                                               |
| Protection passwords give false security                                  | They are obfuscation, not encryption (see validation-and-protection.md)                                   |
| Conditional-format formula with leading `=` or a string instead of a list | No `=`, always `formula=['...']` (see validation-and-protection.md)                                       |
| Table `displayName` with spaces or a cell-like name                       | No spaces, unique, not `"A1"`-shaped (see charts-and-visuals.md)                                          |
| Shapes lost on round-trip                                                 | openpyxl does not read every part; expect loss when re-saving foreign files                               |
| Excel style limit (~65,530 styles)                                        | Reuse style objects instead of creating new ones per cell                                                 |
| Legacy `.xls` files                                                       | Not supported — use xlrd/xlwt                                                                             |
| Untrusted files                                                           | Install `defusedxml`; openpyxl does not guard XML-blowup attacks by default                               |
