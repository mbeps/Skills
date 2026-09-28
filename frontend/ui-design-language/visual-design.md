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
- **Icon-to-Typography Calibration**: Set icon bounding box size to match the `line-height` of adjacent text. If body text is 14px with 20px line-height, size the icon bounding box to exactly **20×20px**. This prevents icons from looking disproportionately large or small next to labels.

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

### Semantic Color Assignments

Colors must emerge exclusively from data and signal operational status — never decorative:

| Color            | Semantic Meaning    | Use Cases                                                       |
| ---------------- | ------------------- | --------------------------------------------------------------- |
| **Blue**         | Information & Focus | Active tabs, primary buttons, input focus rings, links          |
| **Green**        | Success & Safety    | Healthy system, paid invoices, active accounts, positive deltas |
| **Amber/Yellow** | Warning & Caution   | Expiring certificates, approaching limits, non-blocking issues  |
| **Red**          | Critical & Danger   | Destructive actions (Delete, Terminate), fatal errors, outages  |

### Brand Ramp

- Choose one primary brand color (e.g., Royal Blue `#2563EB`)
- Generate a light tint surface (`#EFF6FF`) for chip fills and hover states
- Generate a deep contrast shade (`#1E40AF`) for highlighted text

### Elevation & Depth

**Light Mode — Soft Shadows** (high blur, low opacity; if user notices shadow before data, it's too strong):

| Tier              | CSS                                                                               |
| ----------------- | --------------------------------------------------------------------------------- |
| Flat Cards        | `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`              |
| Raised/Hovered    | `box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.03)`    |
| Floating Overlays | `box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)` |

**Dark Mode — Surface Luminance** (shadows invisible on dark canvas; use progressively lighter surfaces):
- Canvas (lowest): Darkest tone (e.g., `#0F172A`)
- Card/Panel: Lighter (e.g., `#1E293B`)
- Modals/Flyouts: Lighter still (e.g., `#334155`)
- Borders: Subtle (`rgba(255,255,255,0.08)`) — avoid bright white borders
- Status chips: Lower saturation in dark mode to avoid harsh glowing

### Photography & Graphic Overlays

Never place solid dark block over entire photo. Use directional gradient or progressive blur:

```css
.card-overlay {
  background: linear-gradient(to top, rgba(15,23,42,0.95) 10%, rgba(15,23,42,0) 80%);
  backdrop-filter: blur(4px);
}
```

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

### Dashboard Typography Rules

- **Single Font Family**: Use exactly ONE sans-serif typeface across all dashboard elements. Generate hierarchy through weight (400, 500, 600), size, and color — not font pairings.
- **Maximum 6 Font Sizes**: Never use more than 6 distinct sizes across the entire stylesheet.
- **24px Density Cap**: Dashboard text caps at 24px. Consumer landing page sizes (48px–72px) break information density and push operational data below the viewport fold.
- **Header Tightening Formula**: Reduce loose spacing on headings:
  - Letter-spacing: `-0.02em` to `-0.03em`
  - Line-height: `1.1` to `1.2`

```css
h1, .dashboard-title {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
```

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

### The 4-Point Grid System

Every dimension, margin, padding, and gap must be a multiple of **4px**:

| Value                    | Usage                                                          |
| ------------------------ | -------------------------------------------------------------- |
| `4px`                    | Micro spacing (chip padding, icon-to-text)                     |
| `8px`                    | Standard compact (input padding, list item gaps)               |
| `12px`                   | Moderate spacing                                               |
| `16px`                   | Standard layout (card interior, table cell horizontal padding) |
| `24px`                   | Section gaps                                                   |
| `32px` / `48px` / `64px` | Macro containers, canvas boundaries                            |

Multiples of 4 divide cleanly in half without fractional sub-pixels (16→8→4→2), ensuring sharp rendering on all displays.

### Gestalt Proximity Grouping

- Related elements (badge + title): `8px` separation
- Title and subtext: `8px` or `12px` separation
- Text block to CTA button group: `24px` to `32px` separation
- Group elements into spatial clusters so users parse the page in chunks, not as loose items

### Responsive Breakpoint Grids

| Viewport | Grid Columns | Use Case                                                      |
| -------- | ------------ | ------------------------------------------------------------- |
| Desktop  | 12 columns   | Asymmetric splits (3:9, 4:8), symmetric (6:6, 4:4:4, 3:3:3:3) |
| Tablet   | 8 columns    | Medium screens where 12 columns compress too tightly          |
| Mobile   | 4 columns    | Single-column cards and list layouts                          |

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
