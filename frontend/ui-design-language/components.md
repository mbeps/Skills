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

---

## 2. Cards

Cards form the structural building blocks for content grouping.

### Standards & Rules

- **Compact Spacing**: Avoid bloated padding. Standardize on `p-4` or `p-5` (desktop) and `p-3.5` (mobile).
- **Corner Radii**: Use consistent rounding (`rounded-lg` or `rounded-xl`, e.g., 8px to 12px) across all card elements.
- **Zero Wasted Whitespace**: Group related fields logically with clear dividers or subtle background shifts instead of giant blank margins.
- **Borders & Elevation**: Rely on crisp 1px borders (`border border-slate-800/80`) paired with subtle dark tinted surface backgrounds (`bg-slate-900/70`) rather than heavy diffuse drop shadows.

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
