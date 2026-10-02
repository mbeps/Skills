---
name: ui-design-language
description: Use when designing, building, or refactoring user interfaces across web frameworks (React, Next.js, Vue, Svelte, Tailwind), structuring desktop or mobile navigation, standardising component density, styling dark mode palettes, choosing iconography, fixing UI anti-patterns, building dashboard data tables, applying progressive disclosure, calibrating interaction states, establishing 4-point grid spacing, constructing card visual hierarchies, generating colour ramps or deriving tints and shades, applying the 60-30-10 colour rule, rewriting verbose or redundant button labels, stabilising live-updating numbers, specifying hover and loading states, or conducting UI audits.
---

# UI Design Language

## Core Philosophy

A flexible, disciplined UI design language across web frameworks (React, Next.js, Vue, Svelte, Tailwind CSS). It prioritises high information density, clear visual hierarchy, accessible touch targets, and domain-grounded interfaces.

This skill sets a floor, not a ceiling. Every standard here is overridable when a real constraint demands it.

---

## When to Use

- Designing new application views, dashboards, or interfaces.
- Structuring desktop navigation (fixed top navbar vs sidebar) and mobile navigation (fixed bottom bar + drawer).
- Styling buttons, cards, tabs, tables, metric widgets, modals, and forms.
- Establishing rich tinted dark modes, typography, and vector iconography.
- Refactoring inconsistent, low-density, or cluttered layouts.
- Building data-driven dashboard tables and progressive disclosure (see [dashboard-data.md](dashboard-data.md)).
- Designing interaction states, feedback loops, and micro-interactions.
- Applying the 4-point grid spacing system and Gestalt proximity grouping.
- Constructing card visual hierarchies and elevation/depth systems.
- Deriving colour ramps in HSB, generating dark shades, or rebalancing a palette that feels washed out or chaotic.
- Rewriting button labels and section copy that repeat their parent context.
- Writing the full state matrix (hover, press, focus, loading, empty, error) for a screen.
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
| **Colour Ratio** | 60% neutral base / 30% structural / 10% accent | Accent is rationed; never a broad saturated field |
| **Dark Shades** | `Saturation ↑` + `Brightness ↓` ("remove white") | `Brightness ↓` alone gives dead, muddy colour |
| **Muting** | Lower saturation to de-emphasise | Never shift hue to soften a colour |
| **Copy** | Verb names the exact outcome; drop words the parent already says | "Claim" under "Rewards", not "Claim Rewards" |
| **Type Scale** | 4 sizes + 2 weights per component; 6 across the app | Decimal fractions borrow an existing scale step |
| **Icons** | Lucide / Tabler / Phosphor vector SVGs | Zero Unicode emojis in functional UI |
| **Tables** | Constrained column widths with truncation | Tooltips on hover for truncated cells |
| **Modals & Forms** | Rounded inputs, in-place title editing, grid-aligned textareas | Monospace slug subtext, live counter, unboxed header toggle |
| **Data Display** | Right-align numbers with `tabular-nums`; categorical fields as tinted chips | Truncate strings with ellipsis + tooltip; dim inactive rows |
| **Spacing** | Every value a multiple of 4 (4, 8, 12, 16, 24, 32, 48, 64px) | Layout containers step in 8s; 4s reserved for compact internals. Gestalt: 8px within a group, 24px+ between groups |
| **Interaction** | 5 states on all controls: Default, Hover, Active, Focus, Disabled | Micro-feedback ("Copied!" chips), loading spinners, error rings |
| **Progressive Disclosure** | Primary actions always visible; secondary in popovers/drawers | Hover-revealed utilities, inspection sheets, contextual tooltips |
| **Elevation** | Light: soft low-opacity shadows; Dark: surface luminance tiers | Flat → Raised → Floating overlay shadow/luminance progression |
| **Card Hierarchy** | Visual anchor → Bold title → Muted subtext → Distinct output | Directional flows (A → B) replace verbose text labels |

---

## Supporting Guides

- [navigation.md](navigation.md) (Desktop top navbar, sidebar, mobile bottom bar, bottom drawer)
- [components.md](components.md) (Buttons, cards, tabs, tables, metric cards, modals, forms, decomposition)
- [visual-design.md](visual-design.md) (Vector iconography, rich dark mode, typography, layout, copywriting)
- [color-hsb.md](color-hsb.md) (HSB channel mechanics, the "remove white" shade method, 60-30-10, hue shifts)
- [craft-and-copy.md](craft-and-copy.md) (Five quality pillars, four design levels, zero-redundancy copy, state choreography)
- [anti-patterns.md](anti-patterns.md) (Forbidden UI anti-patterns, rationales, and mandatory corrections)
- [dashboard-data.md](dashboard-data.md) (Data-driven architecture, progressive disclosure, interaction states, spacing grid, card hierarchy, elevation, UI audit checklist)
- [references.md](references.md) (Production-ready React, Tailwind CSS, and TypeScript implementations)
