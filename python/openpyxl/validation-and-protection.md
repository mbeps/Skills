# Data validation, conditional formatting, protection, print

## Data validation

```python
from openpyxl.worksheet.datavalidation import DataValidation

dv = DataValidation(type="list", formula1='"Dog,Cat,Bat"', allow_blank=True)
dv.error = 'Your entry is not in the list'
dv.errorTitle = 'Invalid Entry'
dv.prompt = 'Please select from the list'
dv.promptTitle = 'List Selection'
ws.add_data_validation(dv)
dv.add('B1:B1048576')        # whole column B — the range is MANDATORY
```

- `DataValidation(type=None, formula1=None, formula2=None, showErrorMessage=False, showInputMessage=False, showDropDown=False, allowBlank=False, sqref=(), promptTitle=None, errorStyle=None, error=None, prompt=None, errorTitle=None, imeMode=None, operator=None, allow_blank=None)`.
- `type` ∈ `{'whole', 'custom', 'time', 'list', 'decimal', 'textLength', 'date'}`.
- `operator` ∈ `{'lessThanOrEqual', 'notBetween', 'lessThan', 'greaterThan', 'equal', 'greaterThanOrEqual', 'notEqual', 'between'}`.
- `errorStyle` ∈ `{'information', 'stop', 'warning'}`; `allow_blank`/`allowBlank` are aliases.
- `dv.add(...)` accepts a `Cell` or a range string; `"B4" in dv` works. **Validations with no cell ranges are dropped when saving.**
- `sqref` is a `MultiCellRange` — non-contiguous ranges like `"A1 B2:B5"` are fine.

Other types:

```python
DataValidation(type="whole", operator="greaterThan", formula1=100)
DataValidation(type="decimal", operator="between", formula1=0, formula2=1)
DataValidation(type="textLength", operator="lessThanOrEqual", formula1=15)
DataValidation(type="custom", formula1="=SOMEFORMULA")

# List referencing a worksheet range — sheet name MUST be quoted:
from openpyxl.utils import quote_sheetname
dv = DataValidation(type="list",
                    formula1="{0}!$B$1:$B$10".format(quote_sheetname("Data Sheet")))
```

List formula quoting rules: a literal list is a single string wrapped in double quotes (`formula1='"Dog,Cat,Bat"'`); a range reference starts with `=` and quotes the sheet name. `showDropDown=True` is **inverted** — it hides the dropdown arrow (XML `hideDropDown`); leave it `False` to show the arrow. Validators are metadata — openpyxl does not enforce them; Excel does.

## Conditional formatting

```python
from openpyxl.formatting.rule import CellIsRule, FormulaRule, ColorScaleRule

redFill = PatternFill(start_color='EE1111', end_color='EE1111', fill_type='solid')

ws.conditional_formatting.add('A1:A10',
    ColorScaleRule(start_type='min', start_color='AA0000',
                   end_type='max', end_color='00AA00'))

ws.conditional_formatting.add('B1:B10',
    ColorScaleRule(start_type='percentile', start_value=10, start_color='AA0000',
                   mid_type='percentile', mid_value=50, mid_color='0000AA',
                   end_type='percentile', end_value=90, end_color='00AA00'))

ws.conditional_formatting.add('C2:C10',
    CellIsRule(operator='lessThan', formula=['C$1'], stopIfTrue=True, fill=redFill))
ws.conditional_formatting.add('D2:D10',
    CellIsRule(operator='between', formula=['1', '5'], stopIfTrue=True, fill=redFill))

ws.conditional_formatting.add('E1:E10',
    FormulaRule(formula=['ISBLANK(E1)'], stopIfTrue=True, fill=redFill))
```

- Rule factories: `CellIsRule(operator, formula, stopIfTrue, font, border, fill)`, `FormulaRule(formula, stopIfTrue, font, border, fill)`, `ColorScaleRule(start_type, start_value, start_color, mid_type, mid_value, mid_color, end_type, end_value, end_color)`, `DataBarRule(start_type, start_value, end_type, end_value, color, showValue, minLength, maxLength)`, `IconSetRule(icon_style, type, values, showValue, percent, reverse)`.
- `formula` is always a **list of strings**, even for a single condition; **no leading `=`** in the formula text.
- Colors are Excel-style `'RRGGBB'` hex strings (no `#`).
- Whole-row rules use the low-level `Rule(type="expression", dxf=dxf, stopIfTrue=True)` with an absolute-column/relative-row formula and a `DifferentialStyle`:

```python
from openpyxl.styles.differential import DifferentialStyle
r = Rule(type="expression", dxf=DifferentialStyle(fill=PatternFill(bgColor="FFC7CE")), stopIfTrue=True)
r.formula = ['$A2="Microsoft"']
ws.conditional_formatting.add("A1:C10", r)
```

- `Rule.type` values include `'cellIs'`, `'expression'`, `'colorScale'`, `'dataBar'`, `'iconSet'`, `'containsText'`, `'top10'`, `'aboveAverage'`, `'duplicateValues'`, `'uniqueValues'`.
- openpyxl does not validate rule semantics — invalid rules are serialised anyway.

## Protection

**Passwords are obfuscation, not encryption** — worksheet/workbook protection is not file security, and free tools can strip it.

Worksheet protection:

```python
ws.protection.sheet = True            # or ws.protection.enable() / disable()
ws.protection.password = 'secret'
# unlock specific actions — see the defaults trap below
ws.protection.formatCells = False
ws.protection.formatRows = False
ws.protection.formatColumns = False
```

- `SheetProtection` defaults: `sheet=False, objects=False, scenarios=False` but **`formatCells/formatRows/formatColumns/insertRows/insertColumns/insertHyperlinks/deleteRows/deleteColumns/sort/autoFilter/pivotTables = True`**. So `ws.protection.sheet = True` alone locks everything — set the flags you want to allow to `False`.
- Cell-level: `cell.protection = Protection(locked=False)` on editable ranges (default is `locked=True`). Only takes effect when sheet protection is enabled.
- `selectLockedCells`/`selectUnlockedCells` default `False` (selecting stays allowed).
- Password helpers: `ws.protection.set_password(value, already_hashed=False)`.

Workbook (structure) protection:

```python
wb.security.lockStructure = True      # blocks add/move/delete/hide/rename sheets
wb.security.set_workbook_password('secret')
```

- `wb.security` is a `WorkbookProtection` (`DocumentSecurity` alias): `lockStructure`, `lockWindows`, `lockRevision`; enforcement requires a password.

## Print settings

```python
ws.print_area = 'A1:F10'
ws.print_title_rows = '1:1'          # repeat header row on every page
ws.print_title_cols = 'A:B'          # repeat first two columns
ws.print_options.horizontalCentered = True
ws.print_options.verticalCentered = True

ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
ws.page_setup.paperSize = ws.PAPERSIZE_A5    # aliases PAPERSIZE_*
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 0                # 0 disables

ws.oddHeader.left.text = "Page &[Page] of &N"  # &-code language
ws.oddHeader.left.size = 14
ws.oddHeader.left.font = "Tahoma,Bold"
ws.oddHeader.left.color = "CC3366"
# also evenHeader/evenFooter/firstHeader/firstFooter with left/center/right
```

- Fit-to-page requires constructing the page-setup properties first (they are not initialised by default):

```python
from openpyxl.worksheet.properties import PageSetupProperties
ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True, autoPageBreaks=False)
```

- Margins: `ws.page_margins` with `left, right, top, bottom, header, footer` in inches (defaults 0.75/0.75/1/1/0.3/0.3).
- Headers/footers use Excel's `&`-codes (`&[Page]`, `&N` total pages, `&F` filename); writing is fully supported, reading only partially.

## Gotchas

- **Forgotten `dv.add(range)`** — validators without cell ranges are silently dropped on save.
- `showDropDown=True` hides the dropdown arrow (inverted semantics).
- List formulas need exact quoting: literal lists wrapped in double quotes, ranges start with `=` and quote the sheet name.
- Conditional-format formulas have no leading `=` and must be lists of strings.
- `ws.protection.sheet = True` locks everything by default — explicitly allow what users may do.
- Protection passwords are legacy-hash obfuscation, not encryption; they never secure the file.
- Cell-level `Protection(locked=False)` is meaningless unless the sheet is protected.
- `pageSetUpPr` is `None` until you assign a `PageSetupProperties`; `fitToPage` lives there, not on `page_setup`.
