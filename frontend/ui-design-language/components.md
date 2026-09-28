# Core UI Components

## Overview

Components must provide high information density, clear visual hierarchy, explicit feedback states, and strict type safety. Avoid decorative clutter and prioritize predictable user interactions.

---

## 1. Buttons

Every button in the application must follow strict interactive and accessibility standards.

### Standards & Rules

- **Leading Icon Mandatory**: Every functional button must feature an appropriate vector icon (e.g., `Plus` for create, `Trash2` for delete, `Download` for export, `Check` for save, `X` for cancel).
- **Explicit Loading State**: When an asynchronous action occurs, the button must:
  - Display a spinning loader icon (`Loader2` with `animate-spin`).
  - Disable user clicks (`disabled={isLoading}`).
  - Announce busy state (`aria-busy={isLoading}`).
  - Maintain identical button dimensions to prevent layout shifts.
- **Visual Hierarchy**:
  - **Primary**: High-contrast solid accent (e.g., `bg-blue-600 hover:bg-blue-700 text-white`). Used for the single primary action per view.
  - **Secondary / Outline**: Subdued border with subtle background tint on hover (`border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200`).
  - **Ghost**: Zero background until hover (`hover:bg-slate-800 text-slate-300`). Used for table actions or tertiary controls.
  - **Destructive**: Clear warning tone (`bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white`).
  - **Button Proportions (2:1 Rule)**: Horizontal padding must equal double vertical padding (e.g., `padding: 8px 16px`). The total horizontal footprint should be roughly double the height.
- **Icon-Only Buttons & Tooltips**: Every icon-only toolbar button must be wrapped in an accessible UI tooltip (`Tooltip`, `TooltipTrigger asChild`, `TooltipContent`) and possess an explicit `aria-label`. Never rely on unstyled native browser `title` tooltips.
- **Action Bar Overflow Hygiene**: When an action header presents > 2 actions alongside a primary button (e.g. Save, Export, Delete), keep the primary call-to-action visible, pair with an unboxed toggle if applicable, and consolidate secondary/destructive utilities into an overflow dropdown menu (`...` / `MoreHorizontal`).
- **5 Mandatory Interactive States**: Every button must implement all states:
  1. **Default**: Baseline styling with obvious container affordance.
  2. **Hover**: Slightly darkened/lightened background fill + pointer cursor.
  3. **Active/Pressed**: Inset depression feedback (`transform: scale(0.98)`).
  4. **Focus**: High-contrast focus ring (`outline: 2px solid #2563EB; outline-offset: 2px`).
  5. **Disabled**: Muted typography, 50% opacity, `cursor: not-allowed`.

---

## 2. Cards

Cards form the structural building blocks for content grouping.

### Standards & Rules

- **Compact Spacing**: Avoid bloated padding. Standardize on `p-4` or `p-5` (desktop) and `p-3.5` (mobile).
- **Corner Radii**: Use consistent rounding (`rounded-lg` or `rounded-xl`, e.g., 8px to 12px) across all card elements.
- **Zero Wasted Whitespace**: Group related fields logically with clear dividers or subtle background shifts instead of giant blank margins.
- **Borders & Elevation**: Rely on crisp 1px borders (`border border-slate-800/80`) paired with subtle dark tinted surface backgrounds (`bg-slate-900/70`) rather than heavy diffuse drop shadows.
- **Coordinated Adjacent Header Chrome**: When panels sit side-by-side (e.g., editor beside a sidebar or navigation panel), their top headers must share identical background tone (`bg-muted/60 dark:bg-muted/30 border-b border-border/70`), matching vertical height/padding (`min-h-[48px] px-4 py-3`), and typography to preserve visual continuity.
- **Explicit Zeroed Internal Gaps**: When housing structured trees, lists, or edge-to-edge tables inside cards, explicitly override default component gaps and padding (e.g., `gap-0 py-0`) to eliminate dead vertical whitespace above the first item.
- **Card Visual Hierarchy Recipe**: Guide the user's eye naturally through each card:
  1. **Visual Anchor**: Image thumbnail or icon avatar at top for immediate scanability.
  2. **Primary Identifier**: Item name/title positioned near top, bold, largest font on card (16px).
  3. **Contextual Subtext**: Date, author, or timestamp directly beneath title in smaller muted grey font (12px).
  4. **Distinct Output**: Important numerical values (price, quantity, status badge) positioned top-right in contrasting color (blue/green).
  5. **Visual Flows**: Replace verbose directional text (`From: London - To: Manchester`) with visual connectors (`London → Manchester`).

---

## 3. Tabs

Tabs organize related views within a single route without triggering page reloads.

### Standards & Rules

- **Maximum 5 Tabs**: Limit tab lists to 5 items. If more views are required, switch to a sub-navigation sidebar or select dropdown.
- **Icon Requirement**: Every tab trigger must include an associated vector icon.
- **Desktop Layout**:
  - Horizontally stacked trigger list.
  - Each trigger has an inline horizontal icon and label (`flex items-center gap-2`).
- **Mobile Layout**: Choose one of two standard mobile adaptations:
  1. **Option A (Stacked rows)**: Full-width vertically stacked triggers with horizontal icon + label.
  2. **Option B (Segmented grid)**: Horizontally distributed triggers with vertically stacked icon above label (`flex-col items-center gap-1`).

---

## 4. Tables

Tables display structured tabular records. They must remain readable on all screen sizes and avoid stretched cells.

### Standards & Rules

- **Controlled Column Widths**: Set explicit widths or min/max constraints on table columns (e.g., `w-16` for checkboxes, `w-48` for dates/status, `max-w-xs` for descriptions).
- **No Stretched Columns**: Prevent empty or single-word columns from spanning hundreds of unnecessary pixels. Use `table-fixed` when strict width clamping is needed.
- **Text Truncation & Tooltips**: Truncate long strings (names, emails, descriptions) with `truncate` or `line-clamp-1` and expose full text via a tooltip on hover.
- **Alignment Conventions**:
  - Text and names: Left-aligned (`text-left`).
  - Numeric values, currency, dates: Right-aligned (`text-right`).
  - Badges, status pills, action buttons: Center-aligned or right-aligned.
- **Tabular Figures**: Enable `font-variant-numeric: tabular-nums` on all numeric cells. Proportional digits (`1` is narrower than `8`) cause horizontal jitter across rows.
- **Categorical Chips**: Render finite categorical values (status, department, tier) as enclosed chips with tinted backgrounds matching semantic status (green=active, amber=pending, grey=inactive) instead of plain text strings. Use compact padding (`2px 8px`).
- **Inactive Record De-emphasis**: Apply `opacity: 0.5` or subdued tertiary grey text (`text-slate-500`) to inactive, closed, or soft-deleted rows to reduce visual clutter.
- **Horizontal Scrolling Container**: Wrap all tables in an `overflow-x-auto` container with sticky header support (`sticky top-0 bg-slate-900`).

---

## 5. Metric & Stat Cards

Metric widgets highlight key operational numbers and system metrics.

### Standards & Rules

- **Grounded in Reality**: Metrics must represent actual operational values (e.g., "Active Subscriptions", "API Error Rate", "Server Memory Usage").
- **Time Horizons & Comparison**: Always pair metric values with a defined comparison period (e.g., `+14.2% vs previous 30 days`, `-2.1% from last week`).
- **Trend Indicators**: Include clear vector trend badges (`TrendingUp` in emerald for positive, `TrendingDown` in rose for negative).
- **FORBIDDEN (Hollow Vanity Dials)**: Never generate fake, static, or uncalibrated progress rings (e.g., a dial permanently stuck at "78% efficiency" with no real data backend).

---

## 6. Modals & Forms

Forms and dialogs capture user input with strict validation and feedback.

### Standards & Rules

- **Input Styling**: Consistent rounding (`rounded-lg`), subtle borders (`border-slate-700 focus:border-blue-500`), and dark tinted backgrounds (`bg-slate-950`).
- **Action Buttons with Icons**:
  - Submit button: Primary style with a `Check` or `Save` icon (plus loading spinner on submission).
  - Cancel / Dismiss button: Secondary or Ghost style with an `X` icon.
- **Validation Messages**: Display field-level error messages immediately below the offending input with an `AlertCircle` icon and `text-red-400 text-xs font-medium`.
- **Mobile Modals**: Convert desktop dialogs (`Dialog`) into bottom sheets (`Drawer`) on mobile viewports for easier thumb reachability.
- **In-Place Header Editing & Slug Subtext**: In entity configuration or detail views, expose the entity title directly as the page heading rather than creating an isolated "Rename" form card. Pair with a monospace identifier or command slug directly underneath (`font-mono text-xs text-muted-foreground`).
- **Grid-Aligned Description Fields**: Multiline description inputs positioned above multi-column layouts must match the exact column span of the primary content below them (e.g., `w-full` within the primary column span) rather than using arbitrary detached `max-w-*` constraints that break vertical alignment.
- **Character Count Indicators**: Form controls with length limits must display live counter indicators (`text-xs text-muted-foreground text-right`) and enforce limits both client-side and through schema validation.
- **Unboxed Toggle Controls**: Status switches (e.g., active/inactive, enable/disable) located in page headers or action toolbars must sit flush alongside actions without redundant enclosing boxes or card borders.
- **Form Input Focus State**: Provide immediate border color shift and matching focus ring whenever an input receives focus.
- **Form Input Error State**: Outline input in red, place alert icon on right edge, show explicit error message directly beneath the input field.
- **Form Loading State**: When input or button triggers async operation, disable the control and replace icon/label with spinning loader. Never leave user wondering if their click registered.
- **Micro-Interaction Feedback**: After successful actions (copy, save), display brief confirmation (slide-up "Copied!" badge for 1.5s, or green checkmark inside button before returning to default).

---

## 7. Component Decomposition

Prevent monolithic, unmaintainable page files by decomposing interfaces into modular units.

```
                    ┌─────────────────────────┐
                    │  Top-Level View / Page  │
                    │   (Route / Data Layer)  │
                    └────────────┬────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐            ┌──────────────┐
│  Stat Grid   │          │ Filter / Bar │            │ Table / List │
│ (MetricCard) │          │ (SearchForm) │            │ (TableRows)  │
└──────────────┘          └──────────────┘            └──────────────┘
```

### Decomposition Checklist

1. **Extract Sub-components**: If a page file exceeds 200 lines, extract independent sections (e.g., `OverviewStats`, `FilterBar`, `RecordsTable`, `EditRecordModal`).
2. **Isolate Local State**: Forms, dropdowns, and drawers must manage or isolate their interaction state rather than forcing all state into the page root.
3. **Dedicated Item Rows**: Extract table rows or list items into dedicated components (`RecordRow.tsx`) when row actions or formatting logic are present.
