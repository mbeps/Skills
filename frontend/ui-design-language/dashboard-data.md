# Dashboard Data Architecture & Interaction Design

## Overview

Dashboards exist strictly to display and manipulate data. The shape, type, and volume of the underlying data must dictate layout, alignment, and component selection. This guide covers data-driven architecture, progressive disclosure, spacing systems, dashboard typography, card hierarchy, color semantics, elevation, interaction states, and a comprehensive UI audit checklist.

---

## 1. Data-Driven Architecture: Form Follows Data

### Categorical Data as Enclosed Chips

Convert bounded categorical values (status, department, tier) into visual **chips** (badges/tags) instead of plain text strings:

- Rounded pill containers with light tinted background + high-contrast foreground text
- Minimal vertical padding (`2px 8px` or `4px 8px`) to avoid inflating table row height
- **Mode matters**: a light tint fill (`#EFF6FF`) is a light-mode token. In dark mode use a dark fill with the semantic hue held and saturation lowered, with a lighter foreground.
- **Standard color mappings**:
  - Active / Completed → green (soft green background, dark green text in light mode)
  - Pending / In Review → amber (soft amber background, dark amber text in light mode)
  - Inactive / Terminated → neutral grey background, muted grey text

### Numeric Data & Tabular Figures

Right-align **all** numeric quantities, financial values, percentages, and metrics. Align both body cells AND column headers to the right.

```css
.numeric-cell,
th.numeric-header {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

Why `tabular-nums`: Proportional digits have variable widths (digit `1` is narrower than `8`), causing horizontal jitter across rows even among same-length numbers.

### Controlled String Truncation

Truncate dynamic text fields (emails, URLs, job titles, business names) at a defined container width:

```css
.text-truncate {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**MANDATORY**: Never truncate without an accessible tooltip on hover/focus revealing the full unabridged string.

### De-emphasising Inactive Records

Lower visual weight of inactive, closed, or soft-deleted rows:

- Set text to subdued grey `#94A3B8`. Avoid `opacity: 0.5`, which composites below 4.5:1 on dark
- Preserve basic readability while signalling disabled/archived state

### Chronological Data: Timelines & Charts vs Tables

Don't display time-sorted events (audit logs, user activities, status changes) in raw timestamp grids. Instead:

- **Timeline Component**: Vertical connective line linking circular nodes. Group by relative temporal buckets (`Today`, `Yesterday`, `Last Week`) instead of raw ISO timestamps. Place in a dedicated secondary column or slide-out drawer.
- **Roll-Up Chart**: Aggregated sparkline, bar chart, or area chart above/beside the activity log. Summarises volume peaks and valleys at a glance.

### Purposeful Color & Avatars

- Color must emerge exclusively from data — never decorative
- Reserve bold saturated colours (crimson, amber) exclusively for errors, warnings, or urgent actions
- Replace plain text name columns with circular user **avatars** (initials or photo) for faster visual scanning

---

## 2. Progressive Disclosure & Spectrum of Explicitness

```
[ HIGH EXPLICITNESS ] ◄──────────────────────────────────► [ LOW EXPLICITNESS ]
Always Visible                Triggered / Contextual        Concealed / Dynamic
• Global Search Input         • Dropdown Popovers           • Hover-revealed icons
• Primary Action Buttons      • Slide-out Drawers           • Cell-copy action chips
• Primary Navigation          • Contextual Menus            • Gestures (Swipe to delete)
```

### High Explicitness (Always Visible)

Reserved for primary workflows, core data views, and essential tools.

- Examples: global filter bar, main table headers, primary CTA (`+ New Project`, `Search`)

### Medium Explicitness (On-Demand / Contextual)

Secondary flows that don't warrant permanent screen real estate.

- Examples: user permissions/sharing in a **popover** anchored to a share button. Primary task (Search User) visible at top, secondary utilities grouped below.

### Low Explicitness (Hover / Gesture Revealed)

Minor, high-frequency, or destructive utilities.

- Examples: "Remove User" button appears only on hover over that user item
- Mobile: secondary controls (delete, flag, edit) hidden behind swipe gestures

### The Invisible UI Layer

- **Hover Copy Actions**: Display compact "Copy" chip/icon over API key, order ID, UUID cells on hover
- **Annotation Indicators**: Tiny corner triangle for data comments/audit flags; hover/click opens comment popover
- **Universal Tooltips**: EVERY condensed icon button, truncated string, or ambiguous metric header (`ARR`, `LTV`, `Churn Rate`) MUST have a tooltip explaining its exact function or formula
- **Inspection Drawers (Sheets)**: Slide-out drawer from right edge instead of full-page views for record editing/detail viewing. Retains scroll position, active filters, and table context in the background.

### Structured Onboarding Flows

Don't use full-screen modals with 6-bullet feature summaries (users dismiss immediately). Sequence progressively:

1. Load interface with empty/demo state
2. Point single focused tooltip at the most important initial action (e.g., "Click here to connect your data source")
3. On completion, dismiss and trigger next sequential prompt, or dock persistent checklist in bottom corner
4. Reveal tools only as prerequisites are met

---

## 3. The 4-Point Grid System

Every dimension, margin, padding, and gap must be a multiple of **4px**:

| Value                    | Usage                                                          |
| ------------------------ | -------------------------------------------------------------- |
| `4px`                    | Micro spacing (chip padding, icon-to-text)                     |
| `8px`                    | Standard compact (input padding, list item gaps)               |
| `12px`                   | Moderate spacing                                               |
| `16px`                   | Standard layout (card interior, table cell horizontal padding) |
| `24px`                   | Section gaps                                                   |
| `32px` / `48px` / `64px` | Macro containers, canvas boundaries                            |

**Why multiples of 4**: Divides cleanly in half without fractional sub-pixels (16→8→4→2), ensuring sharp rendering on standard and high-DPI displays. Arbitrary bases (5px, 7px, 10px) fail at scale.

### Gestalt Proximity Grouping

Elements that relate must sit physically closer than unrelated elements:

- Badge to headline: `8px` separation
- Headline to subtext: `8px` or `12px` separation
- Text block to CTA button group: `24px` to `32px` separation

Group elements into spatial clusters so users parse the page in chunks, not as loose items.

### Responsive Breakpoint Grids

| Viewport    | Grid Columns | Splits                                               |
| ----------- | ------------ | ---------------------------------------------------- |
| **Desktop** | 12 columns   | 3:9, 4:8, 6:6, 4:4:4, 3:3:3:3                        |
| **Tablet**  | 8 columns    | Medium screens where 12 columns compress too tightly |
| **Mobile**  | 4 columns    | Single-column cards and list layouts                 |

---

## 4. Dashboard Typography

### Single Sans-Serif Font Rule

Use exactly **one** clean sans-serif typeface across all dashboard elements. Recommended: Inter, Roboto, Geist, SF Pro, Segoe UI, Helvetica Neue. Generate hierarchy through font-weight (`400`, `500`, `600`), size, and color — NOT font pairings.

### Strict Scale: Maximum 6 Font Sizes

**Exactly six steps. Nothing else is permitted in the scale.**

| Step | Size   | Usage                                       |
| ---- | ------ | ------------------------------------------- |
| 1    | `12px` | Captions, metadata, tooltips, tags          |
| 2    | `14px` | Body text, table cell values, form labels   |
| 3    | `16px` | Subheadings, card titles, prominent buttons |
| 4    | `18px` | Section headers, modal titles               |
| 5    | `20px` | Primary page sub-headers                    |
| 6    | `24px` | Maximum: dashboard page title / KPI metric  |

11px, 13px, and 15px are **not** on the scale. If a design seems to need them, it needs one of the six above. Per-component limits are tighter still: 4 sizes and 2 weights on any single card, per [craft-and-copy.md](craft-and-copy.md).

### The 24px Density Cap

Dashboards cap text at **24px**. Consumer landing page sizes (48px–72px) break information density and push critical operational data below the viewport fold.

### Header Tightening Formula

Large headings render with excess letter-spacing and line-height. Tighten them:

- **Letter-spacing**: `-0.02em` to `-0.03em`
- **Line-height**: `1.1` to `1.2`

```css
h1, .dashboard-title {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
```

---

## 5. Card Construction & Visual Hierarchy

```
┌────────────────────────────────────────────────────────┐
│  [Thumbnail / Hero Image]                              │
│                                                        │
│  Primary Title (Bold, 16px)            [$120.00] (Blue)│
│  Subtitle / Timestamp (12px, Muted)                    │
│                                                        │
│  [A] ───────────────► [B]                              │
│  Origin               Destination                      │
└────────────────────────────────────────────────────────┘
```

### Card Hierarchy Recipe

1. **Visual Anchor**: Image thumbnail or icon avatar at top for immediate scanability during rapid scrolling
2. **Primary Identifier**: Item name/title near top, bold, largest font on card (16px)
3. **Contextual Subtext**: Date, creation time, or author directly beneath title in smaller, muted grey font (12px)
4. **Distinct Output Positioning**: Important numerical values (price, status badge, quantity) in top-right corner, using contrasting color (blue or green) for immediate visual separation
5. **Text-to-Visual Flows**: Replace verbose directional text (`From: London - To: Manchester`) with visual connectors using icons: `London → Manchester`

---

## 6. Color Systems, Semantics & Elevation

### Brand Ramp & Semantic Palette

- **Brand Anchor**: One primary brand color (e.g., Royal Blue: `#2563EB`)
  - Light tint surface: `#EFF6FF` for chip fills and active hover states in **light mode only**
  - Deep contrast shade: `#1E40AF` for highlighted text in **light mode** (8.01:1 on a `#EFF6FF` chip). In dark mode, brand-coloured text must step brightness **up** instead: `#3B82F6` (4.85:1) or `#60A5FA` (7.02:1) on a dark card.

- **Semantic Colors (Function Over Form):**

| Color            | Semantic Meaning    | Use Cases                                                       |
| ---------------- | ------------------- | --------------------------------------------------------------- |
| **Blue**         | Information & Focus | Active tabs, primary buttons, input focus rings, links          |
| **Green**        | Success & Safety    | Healthy system, paid invoices, active accounts, positive deltas |
| **Amber/Yellow** | Warning & Caution   | Expiring certificates, approaching limits, non-blocking issues  |
| **Red**          | Critical & Danger   | Destructive actions (Delete, Terminate), fatal errors, outages  |

### Light Mode Elevation: Soft Shadows

Shadows must be soft and diffuse. **Benchmark**: If a user notices the shadow before the data inside the container, the shadow is too strong.

| Tier              | CSS                                                                               | Use Case                       |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------ |
| Flat Cards        | `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`              | Default card state             |
| Raised / Hovered  | `box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.03)`    | Hovered cards, raised controls |
| Floating Overlays | `box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)` | Popovers, tooltips, modals     |

### Dark Mode Elevation: Surface Luminance

Shadows are invisible against dark backgrounds. Communicate depth through progressively lighter surface fills:

- **Canvas** (lowest): Darkest tone (`#0F172A`)
- **Card / Panel**: Lighter (`#1E293B`)
- **Modals / Flyouts**: Lighter still (`#334155`)
- **Borders**: Subtle (`rgba(255,255,255,0.08)`) — avoid bright white borders that strain eyes
- **Status chips in dark mode**: Lower saturation to avoid harsh glowing against dark surfaces

### Photography & Graphic Overlays

Never place a solid dark block over an entire photo. Use directional gradient or progressive blur:

```css
.card-overlay {
  background: linear-gradient(to top, rgba(15,23,42,0.95) 10%, rgba(15,23,42,0) 80%);
  backdrop-filter: blur(4px);
}
```

---

## 7. Component Mechanics & Signifiers

### Signifier Principles

- Encapsulating text in a container → signals grouping
- Shading a button's background → signals selected / active
- Grey + `cursor: not-allowed` → signals inactive / non-responsive

### Icon Calibration Rule

Set icon bounding box to match the `line-height` of adjacent typography. If body text is 14px with 20px line-height → icon bounding box = **20×20px** with 1.5px or 2px internal stroke.

### Button Proportions

- **2:1 Rule**: Horizontal padding = 2× vertical padding (e.g., `padding: 8px 16px`)
- **Ghost Buttons**: Secondary/neutral actions render as text + icon with no border or background. Container fill appears only on hover. Pair ghost with solid primary CTA for clear visual hierarchy.

---

## 8. Interaction States & Feedback Loops

### 5 Mandatory Interactive States

Every button, selectable item, and input field must implement:

| State                | Implementation                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Default**          | Baseline styling with obvious container affordance                                                                 |
| **Hover**            | Slightly darkened/lightened background + pointer cursor                                                            |
| **Active / Pressed** | Inset depression: `transform: scale(0.98)`                                                                         |
| **Focus**            | High-contrast focus ring: `outline: 2px solid #60A5FA; outline-offset: 2px` (must clear 3:1 on every surface tier) |
| **Disabled**         | Muted typography that already passes contrast, `cursor: not-allowed`. Do not halve opacity                         |

### Form Input Edge Cases

- **Focus**: Immediate border color shift + matching focus ring on receive focus
- **Error**: Red outline + alert icon on right edge + explicit error message directly beneath input
- **Loading**: Disable control + replace icon/label with spinning loader. Never leave user guessing if click registered.

### Micro-Interactions for Closed Feedback Loops

- Click confirms interaction registered, but NOT task completion
- Copy action → slide-up "Copied to clipboard!" badge for 1.5 seconds
- Save configuration → brief green checkmark inside button before returning to default

---

## 9. UI Audit Implementation Checklist

Use during code reviews and UI audits to verify every screen.

### Data Architecture & Tables

- [ ] Numbers, currency, and metrics are right-aligned
- [ ] `font-variant-numeric: tabular-nums` enabled on all numeric cells
- [ ] Categorical fields rendered as compact visual chips
- [ ] Long strings truncated with ellipsis + full-text tooltips
- [ ] Inactive/soft-deleted records use muted grey text, not halved opacity
- [ ] Time-sorted data displayed as timelines or summary charts, not raw timestamp grids
- [ ] User identifiers use visual avatars for fast scanning

### Hierarchy & Progressive Disclosure

- [ ] Primary actions (Search, Create) permanently visible in fixed header
- [ ] Secondary config workflows in contextual popovers or slide-out drawers
- [ ] Row-level utilities (Copy ID, Delete, Edit) revealed on hover or mobile swipe
- [ ] Complex entity details open in slide-out inspection sheets
- [ ] Onboarding uses sequential targeted tooltips, not generic multi-bullet modals

### Spacing & Grid

- [ ] All spacing uses 4-point grid multiples (4, 8, 12, 16, 24, 32, 48, 64px)
- [ ] Related elements closer together (8px) than distinct sections (24px+)
- [ ] Responsive layouts: Desktop 12-col, Tablet 8-col, Mobile 4-col

### Typography

- [ ] Single sans-serif font family across entire application
- [ ] Typography scale capped at the six steps: 12, 14, 16, 18, 20, 24px
- [ ] No single card uses more than 4 sizes or 2 weights
- [ ] Max text size 24px on dashboard screens
- [ ] Headings use tightened letter-spacing (-2% to -3%) and line-height (110%–120%)

### Color, Depth & Elevation

- [ ] Colors assigned by semantic meaning (blue=info, green=success, yellow=warning, red=danger)
- [ ] Light mode shadows: low opacity, high blur
- [ ] Dark mode depth via surface luminance tiers, not shadows
- [ ] Dark mode status chips: lower saturation to avoid glowing
- [ ] Image overlays: directional gradients or backdrop blur, never solid blocks

### Colour Mechanics & Ratio (see [color-hsb.md](color-hsb.md))

- [ ] 60% of the surface is neutral base, 30% structural secondary, 10% accent
- [ ] Accent appears only on the primary CTA and active status cues
- [ ] Dark shades generated with saturation up AND brightness down, never brightness alone
- [ ] All dark neutral tiers share one hue (no per-tier hue shifting)
- [ ] Competing elements muted by lowering saturation, not by shifting hue
- [ ] Accent hues nudged off raw primaries (210° / 260° rather than a flat 240°)
- [ ] Body text clears WCAG AA 4.5:1 against its own surface tier (checked per tier, not once against the canvas)
- [ ] Saturated brand colour used as fill, not as body text; brand-coloured text steps brightness up

### Copy & Typography Precision (see [craft-and-copy.md](craft-and-copy.md))

- [ ] Every button label names the exact user outcome
- [ ] No label repeats a word already stated by its parent card or section title
- [ ] 4 font sizes and 2 weights maximum on any single card
- [ ] Dynamic numbers use `tabular-nums` with a fixed decimal count
- [ ] Decimal point and trailing fraction use an existing scale step, not a new size
- [ ] Live counters reserve width so they cannot shift neighbouring layout

### Choreography (Static Frame Trap)

- [ ] Hover, active, focus, and disabled states specified on every control
- [ ] Loading state defined: skeleton matching final layout, or spinner
- [ ] Empty state defined for zero-data views
- [ ] Error state defined with a recoverable next action
- [ ] Screen-to-screen transitions mapped, not left as a hard cut
- [ ] `prefers-reduced-motion` respected


### Interactive Components & States

- [ ] Icon bounding boxes match label line-height
- [ ] Secondary actions use ghost buttons (no competition with primary CTA)
- [ ] Every control implements all 5 states: Default, Hover, Active, Focus, Disabled
- [ ] Form inputs have focus rings, error states, and loading indicators
- [ ] Micro-interactions provide immediate feedback ("Copied" chips, save checkmarks)
- [ ] All ambiguous icons, metric acronyms, and truncated strings have informative tooltips
