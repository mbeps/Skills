# UI Anti-Patterns & Mandatory Corrections

## Overview

This guide catalogs common visual, structural, and interaction anti-patterns in web applications. Every anti-pattern includes the root rationale for its prohibition and the mandatory design correction.

---

## Anti-Patterns Summary Table

| #      | Forbidden Anti-Pattern                              | Root Cause / Harm                                        | Mandatory Correction                                  |
| ------ | --------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| **1**  | Unicode emojis as UI icons (`🔥`, `🚀`, `⚙️`)          | Inconsistent OS rendering, no stroke matching, unscaled  | Use Lucide / Tabler / Phosphor vector SVGs            |
| **2**  | Marketing filler tropes ("Supercharge", "Unleash")  | Vague, unprofessional, hides functional intent           | Use direct, domain-specific operational copy          |
| **3**  | Hollow dashboard dials & fake static gauges         | Misleads users with ungrounded arbitrary numbers         | Real metrics with time horizons & comparisons         |
| **4**  | Sandwich text (eyebrow + heading + subtext crammed) | Visual fatigue, weak hierarchy, wasted vertical space    | Clean title + single clear label or value             |
| **5**  | Mobile hamburger menus / desktop nav on mobile      | Inaccessible top-corner reach, hidden destinations       | Fixed bottom navigation bar + bottom drawer           |
| **6**  | Unfixed / scrolling navigation bars                 | User loses navigation context when scrolling down        | Fixed or sticky navigation bar (`fixed` / `sticky`)   |
| **7**  | Flat lifeless monochrome gray dark mode (`#121212`) | Muddy low contrast, lack of depth, cheap appearance      | Rich tinted dark palettes (slate, navy, emerald)      |
| **8**  | Missing button icons & absent loading spinners      | Ambiguous actions, no visual feedback during async tasks | Mandatory leading vector icon + loading spinner state |
| **9**  | Oversized / stretched table columns                 | Distorted layout, poor readability, empty whitespace     | Constrained column widths, truncation, tooltips       |
| **10** | Giant monolithic page components (>300 LOC)         | Fragile maintenance, hard to test, bloated re-renders    | Decompose into modular cards, tabs, rows, forms       |

---

## Detailed Rationales & Corrections

### 1. Unicode Emojis in Functional UI

- **Anti-Pattern**: Using emojis (e.g. `🚀 Launch App`, `🔥 Popular`, `⚙️ Settings`) for buttons, tabs, or badges.
- **Why Forbidden**: Emojis render differently across platforms (Apple, Google, Microsoft, Linux). A clean icon on macOS may render distorted or pixelated on Linux or older Android devices. They ignore CSS `currentColor` and cannot be styled with hover tints.
- **Correction**: Use standard vector SVGs (`Rocket`, `Flame`, `Settings` from `lucide-react`).

```tsx
// ❌ WRONG
<button className="flex items-center gap-2">
  <span>🚀</span> Deploy Cluster
</button>

// ✅ CORRECT
<button className="flex items-center gap-2">
  <Rocket className="w-4 h-4 text-blue-400" />
  <span>Deploy Cluster</span>
</button>
```

---

### 2. Marketing Filler & Copywriting Tropes

- **Anti-Pattern**: Using generic marketing buzzwords in operational tools ("Supercharge your team with next-level AI magic").
- **Why Forbidden**: Obscures what the system actually does, creates false expectations, and degrades credibility in enterprise software.
- **Correction**: Write concise, action-oriented, domain-specific instructions ("Configure Webhook Endpoint", "Export Invoice Ledger as CSV").

---

### 3. Hollow Vanity Widgets & Fake Static Dials

- **Anti-Pattern**: Radial progress rings stuck at "84% Health" with no backend metric or timestamp.
- **Why Forbidden**: Vanity dials consume massive screen real estate without providing actionable insights. Users cannot determine what causes the number to change.
- **Correction**: Display concrete metrics with clear time horizons and relative comparisons (e.g., `99.98% Uptime (last 30 days) | +0.02% vs previous period`).

---

### 4. Sandwich Text

- **Anti-Pattern**: Cramming 3 micro-layers of text: a tiny uppercase category label (eyebrow), followed by a medium title, followed by a tiny explanatory caption.
- **Why Forbidden**: Clutters the vertical rhythm and splits user attention across three competing font sizes.
- **Correction**: Use a strong title and a single clear metric or concise description.

```tsx
// ❌ WRONG (Sandwich Text)
<div className="flex flex-col">
  <span className="text-[10px] uppercase tracking-wider text-blue-400">FINANCE / METRICS</span>
  <h4 className="text-base font-bold text-white">Monthly Recurring Revenue</h4>
  <p className="text-xs text-slate-400">Total estimated subscription revenue calculated on monthly cycle</p>
</div>

// ✅ CORRECT
<div className="flex items-center justify-between">
  <span className="text-sm font-medium text-slate-400">Monthly Recurring Revenue</span>
  <span className="text-xl font-semibold text-slate-100">$48,250</span>
</div>
```

---

### 5. Mobile Hamburger Flyouts & Desktop Headers on Mobile

- **Anti-Pattern**: Replicating a 7-item desktop header on mobile viewports or hiding everything behind a top-left hamburger menu.
- **Why Forbidden**: Top corners are outside the natural thumb zone on modern smartphones (6-inch+ screens). Hamburger flyouts force 2 to 3 taps for basic navigation.
- **Correction**: Implement a **Fixed Mobile Bottom Bar** for the top 4 destinations plus a "More" trigger that slides up a **Mobile Bottom Drawer**.

---

### 6. Unfixed / Scrollable Navigation Bars

- **Anti-Pattern**: Allowing the main header or sidebar to scroll off the screen as the user browses content.
- **Why Forbidden**: Forces users to scroll all the way back to the top of a long table or page just to switch tabs or open settings.
- **Correction**: Ensure desktop navbars and sidebars use `fixed` or `sticky top-0 z-50` positioning.

---

### 7. Flat Lifeless Gray Dark Mode

- **Anti-Pattern**: Using monochromatic `#121212` backgrounds and `#222222` card containers.
- **Why Forbidden**: Pure grays look unrefined and lack optical depth. Elements blend together in dim ambient lighting.
- **Correction**: Use tinted slate, navy, or emerald dark palettes (`#020617` canvas, `#0f172a` cards, with subtle `#334155` borders).

---

### 8. Missing Button Icons & Loading States

- **Anti-Pattern**: Text-only buttons that freeze without feedback when clicked during asynchronous API operations.
- **Why Forbidden**: Users double-click or assume the interface is broken, triggering duplicate API mutations.
- **Correction**: Always attach a relevant vector icon, disable the button during active mutations, and display a spinning loader icon (`Loader2`).

---

### 9. Oversized & Stretched Table Columns

- **Anti-Pattern**: Letting a short 2-digit status code or ID column stretch across 300px of table width.
- **Why Forbidden**: Drags related data fields far apart, creating horizontal eye strain and awkward whitespace.
- **Correction**: Apply fixed or max width constraints (`w-24`, `max-w-xs`), enable `table-fixed` where appropriate, and truncate overflowing content with tooltip reveals.

---

### 10. Giant Monolithic Components

- **Anti-Pattern**: 500+ line JSX files housing forms, tables, modals, and tab state all in one component.
- **Why Forbidden**: Slows editor tooling, causes unnecessary re-renders across unrelated UI sub-trees, and prevents isolated unit testing.
- **Correction**: Decompose into modular parts (`StatsOverview`, `FilterToolbar`, `DataTable`, `ItemRow`, `EditModal`).
