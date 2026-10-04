# Data Table UI & UX Design Guide

UI and UX design rules and implementation guidelines for building data tables in Next.js (App Router, Tailwind CSS, Base UI / shadcn/ui). Grounded in core UX principles for data-dense tables.

## Core Design Rules

### 1. Navigation and View Controls

- **Minimal Tabs Over Heavy Bars:**
  - Avoid heavy borders, full-width colored background bars, or thick container borders for view/tab switching.
  - Use clean, minimal text tabs that blend into the container background. Reduces visual clutter and directs focus to the table data.
- **Prominent Search Field:**
  - Small or truncated search bars are hard to locate and interact with.
  - Make the search input wide and prominent. Pair it with an inline magnifying glass icon inside the box.

### 2. Table Header and Sorting

- **Distinct Header Row Background:**
  - Never format the header row identically to regular data rows.
  - Apply a subtle, light background tint (e.g. `bg-muted/50` or `bg-slate-50 dark:bg-slate-900`) to create an immediate visual boundary between column definitions and records.
- **Accent-Coloured Sort Controls:**
  - Low-contrast or muted grey sort indicators fail to signal interactivity.
  - Highlight sort controls and active sort states with an accent colour (e.g. primary/blue). Gives clear visual feedback on sortable columns.

### 3. Borders and Spacing

- **Subtle Row Dividers:**
  - High-contrast or dark divider lines create harsh visual noise and fragment rows.
  - Use low-contrast, light border dividers (e.g. `border-border/40` or subtle light grey) so the actual data values stand out.
- **Generous Vertical Padding:**
  - Overly compact rows create visual fatigue and scan errors.
  - Provide sufficient vertical padding (e.g. `py-3` or `py-3.5`). Breathing room enables users to scan long lists comfortably.

### 4. Text and Number Formatting

- **Right-Align Numerical Values:**
  - Left-aligned numbers make comparing magnitudes across rows difficult.
  - Always right-align numerical columns (currency, quantities, metrics, percentages) so digits and decimal points align vertically (`text-right`).
- **Abbreviate Month Names in Dates:**
  - Pure numeric date strings (e.g. `04/10/2026` vs `10/04/2026`) cause cross-locale ambiguity.
  - Use three-letter month abbreviations (e.g. `14 Oct 2026` or `04 Oct 2026`).
- **Bold Primary Entity Identifier:**
  - If the primary entity name (first column or main title) uses regular weight, scanning records down the table lacks an anchor.
  - Apply semibold/bold weight (`font-semibold` / `font-medium`) to the primary record column to establish clear visual hierarchy.

### 5. Actions and Interactive States

- **Icon Buttons for Repeated Row Actions:**
  - Repeating text links like "Edit", "Delete", "View" on every row creates repetitive text noise.
  - Replace repeated inline row actions with recognizable icon buttons (e.g. pencil for edit, trash for delete) with accessible `aria-label` / tooltips.
- **Paired Icon + Text for Bulk Actions:**
  - When multiple rows are selected, pure text buttons take longer to identify.
  - Add descriptive leading icons alongside action labels (e.g. download icon + "Export", trash icon + "Delete Selected") to minimize cognitive load.
- **Coloured Semantic Chips for Status Fields:**
  - Plain unstyled text statuses fail to communicate urgency or state.
  - Wrap status values in pill-shaped badges/chips using semantic background and text colors (e.g. green for completed/active, amber/yellow for pending, red for overdue/failed).
- **Tint Selected Rows:**
  - A checkbox tick alone provides weak selection feedback across wide tables.
  - Apply a soft background tint across the entire selected row (e.g. `bg-primary/5` or `bg-accent/50`) so active selection is visible across the entire row width.

---

## Quick Comparison & Checklist

| Category | Bad Practice | Recommended Solution |
| :--- | :--- | :--- |
| **Header** | White or plain unstyled background | Soft tinted background (`bg-muted/50`) |
| **Sort Cues** | Subtle or muted grey arrows | Accent-coloured sort indicators |
| **Dividers** | Harsh high-contrast dark lines | Low-contrast light borders (`border-border/40`) |
| **Padding** | Tight, cramped vertical padding | Increased vertical row height (`py-3` to `py-4`) |
| **Numbers** | Left-aligned numbers | Right-aligned numbers (`text-right`) |
| **Dates** | Pure digits (`04/10/2026`) | Abbreviated month names (`04 Oct 2026`) |
| **Primary Column** | Regular font weight | Bold / semibold weight (`font-semibold`) |
| **Status** | Plain unstyled text | Coloured semantic status chips/badges |
| **Row Actions** | Repeated text links ("Edit", "Delete") | Compact icon buttons with tooltips |
| **Row Selection** | Checkbox checkmark only | Full row background tint |
| **Bulk Actions** | Text-only action buttons | Icon + text paired buttons |
| **Search** | Small or narrow input field | Prominent, wide search bar with search icon |

---

## Next.js Component Structure Pattern

When building data tables following this skill's domain-first Next.js structure:

```
components/
  [domain]/
    [domain]-data-table.tsx       # Main table component (one default/named export)
    [domain]-table-toolbar.tsx    # Wide search bar, minimal filter tabs, bulk actions
    [domain]-table-row-action.tsx # Action icon buttons (edit, delete)
    [domain]-status-badge.tsx     # Semantic pill chip badge
```

- Query parameter state (filtering, search, page, sorting) must be managed via `nuqs` (see `nuqs` pattern in `SKILL.md`).
- Formatting utilities for dates and numbers belong in `lib/formatters/` (e.g. `lib/formatters/date.ts`, `lib/formatters/currency.ts`).
