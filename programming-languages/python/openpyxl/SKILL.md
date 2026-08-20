---
name: openpyxl
description: Use when reading, writing, styling, or manipulating Excel .xlsx files in Python with the openpyxl library — creating workbooks, worksheets, charts, tables, images, comments, data validation, or conditional formatting, converting between Excel and pandas DataFrames, or fixing openpyxl code.
---

# openpyxl (Python Excel library)

## Overview

openpyxl reads and writes Office Open XML files (`.xlsx`, `.xlsm`, `.xltx`, `.xltm`) — not legacy `.xls`. It has **no formula calculation engine** (formulas are stored as strings, never evaluated) and no visual output. This skill covers openpyxl **3.1.x**.

## When to Use / When NOT to Use

Use when:
- Creating or modifying workbooks, worksheets, cells, charts, tables, images, comments.
- Styling cells; validation, conditional formatting, protection, print settings.
- Converting between pandas DataFrames and Excel.
- Reading cell values or cached formula results saved by a spreadsheet app.

When NOT to use:
- Legacy `.xls` files — use `xlrd` (read) / `xlwt` (write).
- Formula evaluation — openpyxl does not calculate; use Python or round-trip via LibreOffice headless.
- Very large files in normal mode (~50× memory) — use `read_only`/`write_only` modes.
- Rendering or previewing files — openpyxl has no visual output.

## Quick Reference

| Task | File | Key API |
|---|---|---|
| Workbook I/O | workbooks.md | `Workbook()`, `load_workbook()`, `wb.save()` |
| Cells and ranges | worksheets-and-cells.md | `ws['A1']`, `ws.iter_rows(values_only=True)` |
| Fonts, fills, borders | styling.md | `Font`, `PatternFill`, `Border`, `Alignment` |
| Charts, images, comments, tables | charts-and-visuals.md | `BarChart`, `Image`, `Comment`, `Table` |
| Validation, protection, print | validation-and-protection.md | `DataValidation`, `ColorScaleRule`, `ws.protection` |
| Formulas, dates, performance | formulas-and-gotchas.md | `load_workbook(data_only=True)`, `Translator` |

| Task | Code |
|---|---|
| New workbook | `wb = Workbook(); ws = wb.active` |
| Save | `wb.save("out.xlsx")` |
| Load cached values | `wb = load_workbook("in.xlsx", data_only=True)` |
| Write a cell | `ws["A1"] = 42` |
| DataFrame to sheet | `for r in dataframe_to_rows(df): ws.append(r)` |

## File Map

| File | Topics |
|---|---|
| SKILL.md (this file) | Entry point, routing, common mistakes |
| workbooks.md | Lifecycle, I/O, modes, copying, pandas |
| worksheets-and-cells.md | Cells, ranges, iteration, merges, coordinates |
| styling.md | Fonts, fills, borders, alignment, number formats |
| charts-and-visuals.md | Charts, axes, trendlines, images, tables |
| validation-and-protection.md | Validation, conditional formatting, protection, print |
| formulas-and-gotchas.md | Formulas, dates, performance, pitfalls |

## Common Mistakes

- `data_only=True` returns `None` for formulas never saved by a spreadsheet app. See formulas-and-gotchas.md.
- `PatternFill` without `fill_type` and `Side` without `border_style` render nothing. See styling.md.
- Merged cells: value lives only in the top-left cell; writing elsewhere raises. See worksheets-and-cells.md.
- Validators without `dv.add(range)` are dropped on save. See validation-and-protection.md.
- `showDropDown=True` hides the dropdown arrow (inverted). See validation-and-protection.md.
- `read_only` workbooks must be closed with `wb.close()`. See workbooks.md.
- `wb.copy_worksheet()` silently drops charts and images. See workbooks.md.
- `ws.cell()` loops create cells in memory — use `iter_rows`/`append`. See worksheets-and-cells.md.

## Version & Install

- openpyxl **3.1.x**: `pip install openpyxl`.
- Images need Pillow: `pip install pillow`.
- For untrusted files, install `defusedxml` (no XML-blowup protection by default).
