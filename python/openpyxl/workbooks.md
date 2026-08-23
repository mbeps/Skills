# Workbooks: lifecycle, I/O, modes, pandas

## Creating and saving

```python
from openpyxl import Workbook, load_workbook

wb = Workbook()                  # always contains at least one worksheet
ws = wb.active                   # first sheet; wb.active = ws also works
ws.title = "Data"
ws1 = wb.create_sheet("Report")  # appended at the end
ws2 = wb.create_sheet("First", 0)  # inserted at position 0
ws3 = wb.create_sheet("Penultimate", -1)
wb.save("balances.xlsx")         # overwrites existing files without warning
```

- Constructor: `Workbook(write_only=False, iso_dates=False)`.
- Sheet access: `wb['name']` (by name), `wb.sheetnames` (ordered list of names), `wb.worksheets` (list of `Worksheet`), `for sheet in wb:` iterates worksheets, `wb.index(ws)`.
- Removal: `wb.remove(ws)` or `del wb['name']`. Legacy `remove_sheet()`, `get_sheet_by_name()`, `get_sheet_names()`, `get_index()` are deprecated.
- Reorder: `wb.move_sheet(sheet, offset=0)`.
- Templates: `wb.template = True` then save as `.xltx`/`.xltm`.
- Auto-named sheets are `Sheet`, `Sheet1`, `Sheet2`, ... when no title is given.

## Loading

Exact signature:

```python
load_workbook(filename, read_only=False, keep_vba=False,
              data_only=False, keep_links=True, rich_text=False)
```

| Flag         | Effect                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `data_only`  | Formula cells return the cached value stored by the last app that read the sheet, else `None` (see formulas-and-gotchas.md) |
| `read_only`  | Streaming, low-memory mode; limited features (below)                                                                        |
| `keep_vba`   | Preserve macros (`.xlsm`); does not make them editable                                                                      |
| `keep_links` | Preserve data cached from external workbooks; `False` speeds up loading                                                     |
| `rich_text`  | Preserve rich-text runs in cells                                                                                            |

`filename` may be a path **or a file-like object open in binary mode**.

```python
wb = load_workbook("book.xlsm", keep_vba=True)
wb = load_workbook("book.xlsx", data_only=True)
wb = load_workbook("big.xlsx", read_only=True)
```

## Workbook properties and metadata

```python
wb.properties.title = "Annual Report"
wb.properties.creator = "Finance Team"          # default is 'openpyxl'
wb.properties.keywords = "budget, fy2026"
wb.properties.created = datetime.datetime.now()  # created/modified/lastPrinted are datetimes

wb.calculation.calcMode = 'auto'                 # {'auto', 'autoNoTable', 'manual'}
wb.calculation.fullCalcOnLoad = True             # force recalc when Excel opens
```

- `wb.properties` is a `DocumentProperties` object: `title`, `creator`, `keywords`, `description`, `subject`, `category`, `identifier`, `language`, `version`, `revision`, `contentStatus`, `created`, `modified`, `lastPrinted`, `lastModifiedBy`.
- `wb.calculation` is a `CalcProperties` object: `calcMode`, `fullCalcOnLoad`, `refMode` (`'A1'`/`'R1C1'`), and others.
- `wb.iso_dates` — workbook-level option; when `True`, dates are written as ISO 8601 strings instead of Excel serials.
- `wb.epoch` / `wb.excel_base_date` — the workbook's date epoch (see formulas-and-gotchas.md).
- `wb.template`, `wb.data_only`, `wb.read_only`, `wb.write_only` — introspection.

Named ranges (3.1 API; `create_named_range` is deprecated):

```python
from openpyxl.workbook.defined_name import DefinedName

wb.defined_names.add(DefinedName("TaxRate", attr_text="'Sheet1'!$B$1"))
dn = wb.defined_names["TaxRate"]   # DefinedNameDict, a dict subclass
# scoped name: DefinedName(..., localSheetId=<sheet index>)
```

## Read-only mode (streaming reads)

- Open with `load_workbook(path, read_only=True)`; worksheets load lazily and the workbook **must** be closed: `wb.close()`.
- Cells are `ReadOnlyCell` objects; only `ws.rows` / `ws.iter_rows` / `ws.values` iteration is available — **no `iter_cols()`, no `ws.columns`**, no random access.
- Charts, images, and comments are not available.
- Some producers store wrong dimensions (e.g. `A1:A1`); call `ws.reset_dimensions()` to clear `max_row`/`max_column` and re-iterate.
- Suited to dumping data and parallel reads (open several instances of the same file across processes).

```python
wb = load_workbook("large.xlsx", read_only=True)
ws = wb["big_data"]
for row in ws.values:
    print(row)
wb.close()                       # mandatory
```

## Write-only mode (streaming writes)

```python
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell

wb = Workbook(write_only=True)
ws = wb.create_sheet()           # required — there is NO default sheet
for i in range(1000):
    ws.append([i, i * 2, None])
cell = WriteOnlyCell(ws, value="styled")
cell.font = Font(name="Courier", size=36)
ws.append([cell, 3.14])
wb.save("big.xlsx")              # can only be called ONCE
```

- Append-only: no `ws.cell()`, no `iter_rows()`, no reading back.
- Memory stays under ~10 MB for very large exports; install **lxml** for faster dumping.
- Everything serialised before cell data (e.g. `freeze_panes`) must be set **before** the first `append()`.
- A second `save()`/`append()` raises `WorkbookAlreadySaved`.
- Call `wb.close()` when done — optional (`save()` already closes the archive) but matches the docs.

## Copying

```python
target = wb.copy_worksheet(wb.active)   # same workbook only
wb2 = load_workbook("original.xlsx"); wb2.save("copy.xlsx")  # "copy" a file
```

- `copy_worksheet()` copies cells (values, styles, hyperlinks, comments) and some sheet attributes — **not charts or images**.
- Not supported across workbooks, nor in read-only or write-only mode.
- Round-tripping a file through load/save can drop unrecognised parts (e.g. shapes).

## pandas interop

```python
from openpyxl.utils.dataframe import dataframe_to_rows

for r in dataframe_to_rows(df, index=True, header=True):
    ws.append(r)
for cell in ws['A'] + ws[1]:
    cell.style = 'Pandas'        # style the index/header columns
wb.save("pandas.xlsx")
```

- `dataframe_to_rows(df, index=True, header=True)` — index and header are included only when asked; the top-left corner cell is `None`; pandas `NaN` becomes `None`.
- DataFrame → sheet: `df = pd.DataFrame(ws.values)` works when the sheet has no header/index; otherwise slice manually (`ws.values` yields `None` for empty cells, which pandas turns into `NaN`).
- Reading: `pd.read_excel("book.xlsx", sheet_name="Data")` uses openpyxl as the default `.xlsx` engine.
- NumPy float/int/bool and pandas `Timestamp` are supported natively.

## Gotchas

- `wb.save()` overwrites silently — no confirmation.
- Extension mismatches break files: loading `.xlsm` and saving without `keep_vba=True`, or saving a template as `.xlsx`, produces files Excel will not open.
- Shapes are lost from existing files opened and saved with the same name.
- By default openpyxl does not guard against XML-blowup attacks — install `defusedxml` for untrusted files.
- Memory use is roughly **50× the file size** in normal mode — use read-only/write-only modes for big files.
- `copy_worksheet()` silently drops charts and images (see charts-and-visuals.md).
- Creating sheets is cheap; cells are created lazily on first access (see worksheets-and-cells.md).
