---
name: ui-design-language
description: Use when designing, building, or refactoring user interfaces across web frameworks (React, Next.js, Vue, Svelte, Tailwind), structuring desktop or mobile navigation, standardising component density, styling dark mode palettes, choosing iconography, or fixing UI anti-patterns.
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
| **Buttons** | Vector icon + label + loading spinner | Icon-only for compact toolbars with tooltips |
| **Tabs** | Max 5 tabs with vector icons | Horizontal on desktop, vertical or stacked on mobile |
| **Metrics** | Real time comparisons (e.g., +12% vs last month) | Grounded data; zero fake static dials |
| **Theme** | Deep tinted dark mode (slate, navy, emerald) | Pure black OLED or clean high-contrast light mode |
| **Icons** | Lucide / Tabler / Phosphor vector SVGs | Zero Unicode emojis in functional UI |
| **Tables** | Constrained column widths with truncation | Tooltips on hover for truncated cells |
| **Modals** | Rounded inputs, icon action buttons (Check / X) | Bottom drawer equivalent on mobile viewports |

---

## Supporting Guides

- [navigation.md](navigation.md) (Desktop top navbar, sidebar, mobile bottom bar, bottom drawer)
- [components.md](components.md) (Buttons, cards, tabs, tables, metric cards, modals, forms, decomposition)
- [visual-design.md](visual-design.md) (Vector iconography, rich dark mode, typography, layout, copywriting)
- [anti-patterns.md](anti-patterns.md) (Forbidden UI anti-patterns, rationales, and mandatory corrections)
- [references.md](references.md) (Production-ready React, Tailwind CSS, and TypeScript implementations)
