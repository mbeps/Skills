---
name: ui-design-language
description: Use when designing, building, or refactoring user interfaces across web frameworks (React, Next.js, Vue, Svelte, Tailwind), structuring desktop or mobile navigation, standardising component density, styling dark mode palettes, choosing iconography, fixing UI anti-patterns, building dashboard data tables, applying progressive disclosure, calibrating interaction states, establishing 4-point grid spacing, constructing card visual hierarchies, or conducting UI audits.
---

# UI Design Language

## Core Philosophy

A flexible, disciplined UI design language across web frameworks (React, Next.js, Vue, Svelte, Tailwind CSS). It prioritises high information density, clear visual hierarchy, accessible touch targets, and domain-grounded interfaces.

---

## When to Use

- Designing new application views, dashboards, or interfaces.
- Structuring desktop navigation (fixed top navbar vs sidebar) and mobile navigation (fixed bottom bar + drawer).
- Styling buttons, cards, tabs, tables, metric widgets, modals, and forms.
- Establishing rich tinted dark modes, typography, and vector iconography.
- Refactoring inconsistent, low-density, or cluttered layouts.
- Building data-driven dashboard tables (numeric alignment, categorical chips, truncation, inactive records).
- Implementing progressive disclosure and calibrating the spectrum of explicitness.
- Designing interaction states, feedback loops, and micro-interactions.
- Applying the 4-point grid spacing system and Gestalt proximity grouping.
- Constructing card visual hierarchies and elevation/depth systems.
- Conducting UI audits using implementation checklists.

### When NOT to Use

- Writing backend services or API routes with no user interface.
- Raw command line tools or terminal applications.
- Framework-specific state management internals unrelated to visual presentation.

---

## Navigation Selection Flowchart

```
Desktop Viewport:
<= 5 main destinations?
  ├─ YES ──> Fixed Top Navbar (max 5 visible items, overflow in 'More' dropdown)
  └─ NO  ──> Fixed Sidebar (all destinations visible with vector icons)

Mobile Viewport:
All configurations:
  └─ Fixed Bottom Navigation Bar (max 5 items with icons and labels)
     └─ Overflow / Profile / Extra pages ──> Mobile Bottom Drawer (Sheet)
```

---

## Quick Reference Matrix

| Area | Standard | Fallback / Overflow |
|---|---|---|
| **Desktop Nav** | Fixed top navbar (<= 5 items) | Sidebar if > 5 items; "More" dropdown for overflow |
| **Mobile Nav** | Fixed bottom bar (<= 5 items) | Mobile bottom drawer for extra links and profile |
| **Buttons** | Vector icon + label + loading spinner | Icon-only with tooltips; collapse >2 header actions to `...` menu |
| **Cards** | Coordinated adjacent headers, zero-gap lists (`gap-0 py-0`) | Mount self-contained views flush without outer wrapper card |
| **Tabs** | Max 5 tabs with vector icons | Horizontal on desktop, vertical or stacked on mobile |
| **Metrics** | Real time comparisons (e.g., +12% vs last month) | Grounded data; zero fake static dials |
| **Theme** | Deep tinted dark mode (slate, navy, emerald) | Pure black OLED or clean high-contrast light mode |
| **Icons** | Lucide / Tabler / Phosphor vector SVGs | Zero Unicode emojis in functional UI |
| **Tables** | Constrained column widths with truncation | Tooltips on hover for truncated cells |
| **Modals & Forms** | Rounded inputs, in-place title editing, grid-aligned textareas | Monospace slug subtext, live counter, unboxed header toggle |
| **Data Display** | Right-align numbers with `tabular-nums`; categorical fields as tinted chips | Truncate strings with ellipsis + tooltip; dim inactive rows |
| **Spacing** | 4-point grid (4, 8, 12, 16, 24, 32px multiples) | Gestalt proximity: 8px within groups, 24px+ between groups |
| **Interaction** | 5 states on all controls: Default, Hover, Active, Focus, Disabled | Micro-feedback ("Copied!" chips), loading spinners, error rings |
| **Progressive Disclosure** | Primary actions always visible; secondary in popovers/drawers | Hover-revealed utilities, inspection sheets, contextual tooltips |
| **Elevation** | Light: soft low-opacity shadows; Dark: surface luminance tiers | Flat → Raised → Floating overlay shadow/luminance progression |
| **Card Hierarchy** | Visual anchor → Bold title → Muted subtext → Distinct output | Directional flows (A → B) replace verbose text labels |

---

## Supporting Guides

- [navigation.md](navigation.md) (Desktop top navbar, sidebar, mobile bottom bar, bottom drawer)
- [components.md](components.md) (Buttons, cards, tabs, tables, metric cards, modals, forms, decomposition)
- [visual-design.md](visual-design.md) (Vector iconography, rich dark mode, typography, layout, copywriting)
- [anti-patterns.md](anti-patterns.md) (Forbidden UI anti-patterns, rationales, and mandatory corrections)
- [dashboard-data.md](dashboard-data.md) (Data-driven architecture, progressive disclosure, interaction states, spacing grid, card hierarchy, elevation, UI audit checklist)
- [references.md](references.md) (Production-ready React, Tailwind CSS, and TypeScript implementations)
