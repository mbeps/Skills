# Charts, images, comments, tables

## Chart creation pattern

```python
from openpyxl.chart import BarChart, Reference

values = Reference(ws, min_col=1, min_row=1, max_col=1, max_row=10)
cats = Reference(ws, min_col=2, min_row=2, max_row=10)
# titles_from_data consumes row 1 for the series title — categories must start at row 2
chart = BarChart()
chart.title = "Sample"
chart.add_data(values, titles_from_data=True)   # series titles from first row/column
chart.set_categories(cats)                       # x-axis labels
ws.add_chart(chart, "E15")                       # anchor cell, or set chart.anchor
wb.save("chart.xlsx")
```

- `Reference(ws, min_col, min_row, max_col, max_row)` — 1-based; any argument can be omitted for a full row/column.
- `chart.width` / `chart.height` are floats in **centimetres** (defaults 15 × 7.5 cm).
- `chart.style = n` — preset style integer (docs examples use 10–26).
- Anchors (`openpyxl.drawing.spreadsheet_drawing`): `OneCellAnchor` (default; move but don't size), `TwoCellAnchor` (move and size with cells — coordinates are **0-based**: `anchor._from.col = 0`, `anchor._from.row = 8`), `AbsoluteAnchor`.
- Clone configured charts with `deepcopy` and tweak.

## Chart types

| Chart           | Key parameters                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BarChart`      | `type='col'` (default, vertical) / `'bar'` (horizontal, axes swapped); `grouping` ∈ `{'clustered', 'stacked', 'percentStacked', 'standard'}`; **`overlap=100` required for stacked**; `gapWidth` (default 150) |
| `LineChart`     | `grouping` ∈ `{'standard', 'stacked', 'percentStacked'}`; `series.smooth = True`                                                                                                                               |
| `ScatterChart`  | series built manually: `Series(values, xvalues, title_from_data=True)`; `type` values are shortcuts with no effect in Excel                                                                                    |
| `PieChart`      | **single series only**; `DataPoint(idx=0, explosion=20)` via `series[0].data_points = [slice]`; `ProjectedPieChart` with `type='pie'                                                                           | 'bar'`, `splitType` ∈ `{'cust','pos','percent','val','auto'}` |
| `DoughnutChart` | multiple concentric series; `holeSize` is a percentage                                                                                                                                                         |
| `RadarChart`    | `type='filled'`; `'marker'` has no effect                                                                                                                                                                      |
| `AreaChart`     | `grouping` ∈ `{'standard','stacked','percentStacked'}`                                                                                                                                                         |
| `SurfaceChart`  | 3D by default; `wireframe=True` for contour                                                                                                                                                                    |

## Series and trendlines

```python
from openpyxl.chart import Series
from openpyxl.chart.trendline import Trendline

series = Series(values=yvalues, xvalues=xvalues, zvalues=size, title="2013")  # zvalues = bubble size
chart.series.append(series)

s = chart.series[0]
s.trendline = Trendline(trendlineType='linear', dispEq=True, dispRSqr=True)
s.marker.symbol = "triangle"                 # {'star','diamond','square','triangle','x','picture','circle','dash','plus','dot','auto'}
s.graphicalProperties.line.dashStyle = "sysDot"
s.graphicalProperties.line.width = 100050    # EMUs
```

- `Trendline(trendlineType, order, period, forward, backward, intercept, dispRSqr, dispEq, name)` — `trendlineType` ∈ `{'power','exp','movingAvg','linear','log','poly'}`; `order` for `'poly'`, `period` for `'movingAvg'`.
- The display flags are **`dispEq`** and **`dispRSqr`** (not `displayEquation`/`displayRSquared`).
- `smooth` and `trendline` are per-series properties.

## Axes

```python
chart.x_axis.title = 'Days'
chart.y_axis.title = 'Values'
chart.x_axis.scaling.min = 0                 # nested: axis.scaling, not axis.min
chart.x_axis.scaling.max = 11
chart.x_axis.scaling.logBase = 10            # negative values are discarded on log axes
chart.y_axis.delete = True                   # hide an axis (bool attribute)
chart.y_axis.majorGridlines = None           # remove gridlines
```

- Axis classes: `TextAxis` (categories), `NumericAxis` (values), `DateAxis` (subclass of `TextAxis`), `SeriesAxis` (3D z-axis).
- `axis.scaling` — `Scaling(logBase=None, orientation='minMax', max=None, min=None)`; `orientation='maxMin'` reverses.
- `axis.crosses` ∈ `{'autoZero', 'max', 'min'}`; `axis.axId` (int), `axis.crossAx` (int).
- `DateAxis` extras: `number_format` (e.g. `'d-mmm'`), `majorTimeUnit` ∈ `{'days','months','years'}`.

## Legend and data labels

```python
chart.legend = None                    # remove legend entirely
# legend positions: 'r', 'l', 't', 'b', 'tr'  (right default)

from openpyxl.chart.label import DataLabelList
chart.series[0].dLbls = DataLabelList(showVal=True, dLblPos='outEnd')   # per-series
```

- `DataLabelList(showVal, showPercent, showCatName, showSerName, showLegendKey, showBubbleSize, showLeaderLines, numFmt, separator, dLblPos)` — all flags are bools.
- `dLblPos` ∈ `{'l','t','bestFit','r','b','outEnd','inEnd','inBase','ctr'}`.
- Percentages on pie/doughnut: `series.dLbls = DataLabelList(showPercent=True, numFmt='0%')`.

## Combo charts (second axis)

```python
c1 = BarChart()
c1.add_data(v1, titles_from_data=True, from_rows=True)   # from_rows=True when each row is a series
c1.y_axis.majorGridlines = None
c2 = LineChart()
c2.add_data(v2, titles_from_data=True, from_rows=True)
c2.y_axis.axId = 200                   # unique axis id for the second y-axis
c2.y_axis.title = "Humans"
c1.y_axis.crosses = "max"              # push second axis to the right
c1 += c2                               # combine — there is no dedicated "combo chart" class
ws.add_chart(c1, "D4")
```

## Images

```python
from openpyxl.drawing.image import Image

img = Image('logo.png')                # requires Pillow (pip install pillow)
img.width, img.height = 300, 150       # PIXELS (unlike chart cm)
ws.add_image(img, 'A1')                # or img.anchor = 'A1'
```

- Pillow-backed formats: PNG, JPEG, GIF.
- Set `width`/`height` before `add_image` to control displayed size.

## Comments

```python
from openpyxl.comments import Comment
from openpyxl.utils import units

comment = Comment("This is the text", "Comment Author", height=79, width=144)
comment.width = units.points_to_pixels(300)   # pixel dimensions
comment.height = units.points_to_pixels(50)
ws["A1"].comment = comment                    # read back with ws["A1"].comment
```

- Assigning one `Comment` to several cells auto-copies it (`ws["A1"].comment is ws["B2"].comment` → `False`).
- Not supported in read-only mode; only comment text round-trips (formatting and original box dimensions are lost on load).

## Tables

```python
from openpyxl.worksheet.table import Table, TableStyleInfo

tab = Table(displayName="Table1", ref="A1:E5")
tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium9",
                                    showFirstColumn=False, showLastColumn=False,
                                    showRowStripes=True, showColumnStripes=True)
ws.add_table(tab)                      # validates the name — use this, not ws.tables
```

- **`displayName` constraints**: unique within the workbook, **no spaces**, must not collide with defined names or look like a cell reference (e.g. `"A1"`).
- Column headings must be **strings**; tables always come with a header row and filters on every column.
- Access: `ws.tables["Table1"]`, `ws.tables.values()`, `del ws.tables["Table1"]`.
- Totals row: `tab.totalsRowShown = True`; `tab.tableColumns[1].totalsRowFunction = "sum"` (enum: `{'min','count','countNums','var','average','custom','max','sum','stdDev'}`), optional `totalsRowLabel`.
- Print areas cannot reference table names — use `ws.tables["InvoiceData"].ref` to build `ws.print_area`.
- Write-only mode: headings are not auto-added — set `headerRowCount`/initialise columns explicitly.

## Gotchas

- `copy_worksheet()` does not copy charts or images (see workbooks.md).
- Stacked bars need `overlap = 100`; `type = "bar"` swaps x and y axes.
- Pie charts accept one series only; use a doughnut for concentric rings.
- Trendline equation/R² flags are `dispEq`/`dispRSqr`.
- Axis scaling is nested: `axis.scaling.min`, never `axis.min`; `axis.delete` is a bool, not a method.
- Chart size is in **cm**; image size is in **pixels**.
- `TwoCellAnchor` coordinates are 0-based; the default `OneCellAnchor` keeps the chart's size.
- Table names: no spaces, unique, not cell-like; headings must be strings.
- Comments are unavailable in read-only mode and only their text survives a round-trip.
