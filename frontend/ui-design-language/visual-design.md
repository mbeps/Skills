# Visual Design & Aesthetic Standards

## Overview

Visual design must communicate clarity, speed, and precision. Interfaces should feel sharp, responsive, and functional rather than decorative or distracting.

---

## 1. Iconography

Icons are critical navigational anchors and visual landmarks.

### Strict Iconography Rules

- **Vector SVGs ONLY**: Use established vector libraries such as **Lucide**, **Tabler Icons**, **Phosphor**, or **Heroicons**.
- **FORBIDDEN (Unicode Emojis)**: NEVER use Unicode emojis (such as 🚀, 💡, 🔥, ⚙️, 📊, ⚡) as UI icons, button symbols, or navigation glyphs.
  - *Why emojis fail*: Emojis render inconsistently across Apple, Android, Windows, and Linux operating systems. They do not match stroke widths or text colours, cannot scale predictably, and reduce visual credibility in professional tools.
- **Stroke & Size Consistency**: Standardise icon sizes across the interface:
  - Small / Inline (e.g. inside badges, table cells): `w-3.5 h-3.5` or `w-4 h-4` (14px to 16px).
  - Medium / Buttons & Navigation: `w-4 h-4` or `w-5 h-5` (16px to 20px).
  - Large / Metric cards & Empty states: `w-6 h-6` or `w-8 h-8` (24px to 32px).
- **Stroke Width**: Standardise on a consistent stroke width (1.5px to 2px) throughout the entire application.

---

## 2. Rich Dark Mode Palettes

Avoid flat, lifeless, washed-out monochrome gray (`#121212` or `#1f1f1f`). Use deep, tinted dark foundations that provide optical depth and contrast.

### Palette Architecture

| Theme Tone             | Canvas / Background (`bg-primary`) | Surface / Card (`bg-card`) | Elevated / Popover (`bg-popover`) | Border Accent (`border-subtle`) |
| ---------------------- | ---------------------------------- | -------------------------- | --------------------------------- | ------------------------------- |
| **Slate / Steel**      | `#020617` (`slate-950`)            | `#0f172a` (`slate-900`)    | `#1e293b` (`slate-800`)           | `#334155` (`slate-700/60`)      |
| **Deep Navy / Indigo** | `#030712` (`gray-950`)             | `#0a0f1d` (tinted indigo)  | `#111827` (`gray-900`)            | `#1e293b` (`slate-800/80`)      |
| **Emerald / Forest**   | `#021a12` (tinted dark green)      | `#062b1e` (card emerald)   | `#0b3d2b` (elevated)              | `#134e38` (`emerald-900/60`)    |
| **Burgundy / Crimson** | `#18040a` (tinted dark red)        | `#2b0b14` (card burgundy)  | `#3d121f` (elevated)              | `#5c1d30` (`rose-900/60`)       |

### Contrast & Hierarchy in Dark Mode

- **Background Layering**: Ensure at least 3 distinct surface tiers: Canvas (lowest), Card/Section (middle), Modal/Dropdown (highest elevation).
- **Subtle Borders**: Use 1px semi-transparent borders (`border-slate-800` or `border-white/10`) to define card boundaries rather than heavy drop shadows.
- **Text Contrast Levels**:
  - Primary text: `text-slate-100` or `text-white` (high contrast).
  - Secondary text: `text-slate-400` (labels, metadata).
  - Muted / Disabled text: `text-slate-500` or `text-slate-600`.

---

## 3. Typography & Hierarchy

Maintain a clear, readable type system that guides the eye naturally.

### Rules

- **Font Family Selection**: Use a single robust sans-serif font family (e.g., Inter, Geist, Plus Jakarta Sans) or a clean pairing of sans-serif with a monospace variant (e.g., JetBrains Mono) for tabular/numeric data.
- **FORBIDDEN (Sandwich Text)**: Avoid cramming three stacked lines of text with alternating sizes into tight spaces (e.g. tiny uppercase eyebrow + bold title + tiny gray sub-sentence). Use direct, clean title-and-value or title-and-description structures.
- **Heading Scale**:
  - Page Title: `text-2xl font-bold tracking-tight text-slate-100` (24px to 28px).
  - Section Title: `text-lg font-semibold text-slate-200` (18px).
  - Card Header / Subheading: `text-sm font-medium text-slate-300` (14px).
  - Body Text: `text-sm text-slate-400` (14px).
  - Caption / Metadata: `text-xs text-slate-500` (12px).

---

## 4. Spacing & Responsive Layout

Layouts must dynamically adapt between desktop precision and mobile reachability.

### Layout Standards

- **Mobile Viewports (< 768px)**:
  - Single-column layout (`grid-cols-1`).
  - Edge padding: `px-4 py-4`.
  - Full-width tap targets and stacked forms.
- **Desktop Viewports (>= 768px)**:
  - Multi-column grids (2, 3, or 4 columns for stat cards and dashboards).
  - Edge padding: `px-6 py-6` or `px-8 py-8`.
  - Max container width clamped (e.g., `max-w-7xl mx-auto`).
- **Consistent Corner Radii**: Stick to one border-radius scale across components (e.g., `rounded-lg` for badges/inputs, `rounded-xl` for cards/modals).

---

## 5. Animations & Gradients

Motion and colour treatments must assist comprehension without slowing the user down.

### Rules

- **Restraint on Gradients**: Avoid loud, multi-stop rainbow gradients. Use subtle single-colour radial glow effects or solid dark fills.
- **Functional, Fast Transitions**: Keep animations between 150ms and 200ms (`duration-150 ease-out`).
- **Forbidden Excessive Animation**: Do not bounce, flip, or spin content on initial page load. Restrict animation to:
  - Dropdown / Drawer slide and fade (`enter: transition ease-out duration-150`).
  - Button loading spinners (`animate-spin`).
  - Skeleton loading pulses (`animate-pulse`).

---

## 6. Copywriting & Content Tone

Interface copy must be crisp, operational, and unambiguous.

### Rules

- **Domain-Specific & Direct**: Write text describing exact operations (e.g., "Export Transaction Ledger (CSV)", "Generate API Token", "Re-index Search Catalog").
- **FORBIDDEN (Marketing Tropes & Vapourware Buzzwords)**:
  - ❌ *"Supercharge your daily workflow with next-generation AI"*
  - ❌ *"Unlock unlimited productivity and unleash your team's power"*
  - ❌ *"Experience the magic of seamless cloud synergy"*
  - ✅ *"Connect your PostgreSQL database to sync user accounts"*
  - ✅ *"Generate daily invoice summaries for pending billings"*
