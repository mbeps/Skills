# UI Anti-Patterns & Mandatory Corrections

## Overview

This guide catalogs common visual, structural, and interaction anti-patterns in web applications. Every anti-pattern includes the root rationale for its prohibition and the mandatory design correction.

---

## Anti-Patterns Summary Table

| #      | Forbidden Anti-Pattern                              | Root Cause / Harm                                          | Mandatory Correction                                                          |
| ------ | --------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **1**  | Unicode emojis as UI icons (`🔥`, `🚀`, `⚙️`)          | Inconsistent OS rendering, no stroke matching, unscaled    | Use Lucide / Tabler / Phosphor vector SVGs                                    |
| **2**  | Marketing filler tropes ("Supercharge", "Unleash")  | Vague, unprofessional, hides functional intent             | Use direct, domain-specific operational copy                                  |
| **3**  | Hollow dashboard dials & fake static gauges         | Misleads users with ungrounded arbitrary numbers           | Real metrics with time horizons & comparisons                                 |
| **4**  | Sandwich text (eyebrow + heading + subtext crammed) | Visual fatigue, weak hierarchy, wasted vertical space      | Clean title + single clear label or value                                     |
| **5**  | Mobile hamburger menus / desktop nav on mobile      | Inaccessible top-corner reach, hidden destinations         | Fixed bottom navigation bar + bottom drawer                                   |
| **6**  | Unfixed / scrolling navigation bars                 | User loses navigation context when scrolling down          | Fixed or sticky navigation bar (`fixed` / `sticky`)                           |
| **7**  | Flat lifeless monochrome gray dark mode (`#121212`) | Muddy low contrast, lack of depth, cheap appearance        | Rich tinted dark palettes (slate, navy, emerald)                              |
| **8**  | Missing button icons & absent loading spinners      | Ambiguous actions, no visual feedback during async tasks   | Mandatory leading vector icon + loading spinner state                         |
| **9**  | Oversized / stretched table columns                 | Distorted layout, poor readability, empty whitespace       | Constrained column widths, truncation, tooltips                               |
| **10** | Giant monolithic page components (>300 LOC)         | Fragile maintenance, hard to test, bloated re-renders      | Decompose into modular cards, tabs, rows, forms                               |
| **11** | Action button sprawl in page headers                | Horizontal wrapping, visual competition, lost hierarchy    | Primary action + unboxed toggle + `...` overflow menu                         |
| **12** | Redundant wrapper cards around self-contained views | Nested borders, double margins, lost vertical real estate  | Mount self-contained components flush without wrapper                         |
| **13** | Left-aligned or centre-aligned numbers in tables    | Misaligned decimal points, impossible magnitude comparison | Right-align all numerics with `font-variant-numeric: tabular-nums`            |
| **14** | Plain text for categorical data (status, tier)      | Slow scanability, mental fatigue reading full strings      | Convert to enclosed tinted chips (green=active, amber=pending, grey=inactive) |
| **15** | Arbitrary decorative color usage                    | Visual noise, confuses users, no operational meaning       | Color from data only: blue=info, green=success, amber=warning, red=danger     |
| **16** | Heavy/dark drop shadows in light mode               | Visual mud, shadow noticed before data content             | Soft diffuse shadows: high blur radius, low opacity (< 0.08)                  |
| **17** | Drop shadows for depth in dark mode                 | Shadows invisible against dark canvas backgrounds          | Surface luminance tiers: progressively lighter fills for elevation            |
| **18** | Full-page views for record editing/details          | Loses scroll position, active filters, table context       | Slide-out inspection drawers from right edge                                  |
| **19** | Full-screen onboarding modals with bullet lists     | Users dismiss immediately and forget everything            | Sequential contextual tooltips + persistent progress checklist                |
| **20** | Missing interaction states on controls              | Users can't tell if click registered, no keyboard nav      | Implement all 5 states: Default, Hover, Active, Focus, Disabled               |
| **21** | Arbitrary non-4px spacing values (5px, 7px, 10px)   | Fractional sub-pixels, inconsistent visual rhythm          | All spacing as multiples of 4px (4, 8, 12, 16, 24, 32px)                      |
| **22** | More than 6 font sizes across dashboard             | Typography anarchy, no clear hierarchy                     | Cap at 6 discrete sizes; max 24px for dashboards                              |
| **23** | Solid dark overlay blocks on photography            | Destroys image content, feels heavy and amateurish         | Directional linear gradient or progressive backdrop blur                      |

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

---

### 11. Header Action Button Sprawl

- **Anti-Pattern**: Placing 4 or more standalone action buttons horizontally across a header bar (e.g., `Save`, `Export`, `Duplicate`, `Archive`, `Delete` all rendered as full buttons side-by-side).
- **Why Forbidden**: Causes visual noise, competes with the primary call-to-action, breaks or wraps awkwardly on smaller viewports, and dilutes user focus.
- **Correction**: Keep only the primary action button and an unboxed toggle switch visible. Group secondary, infrequent, and destructive options into an accessible `DropdownMenu` triggered by a standard `...` (`MoreHorizontal`) button.

```tsx
// ❌ WRONG (Sprawling button row)
<div className="flex items-center gap-2">
  <div className="border rounded p-1"><Switch /> Active</div>
  <Button variant="outline"><Share2 /> Share</Button>
  <Button variant="outline"><Download /> Export</Button>
  <Button variant="destructive"><Trash2 /> Delete</Button>
  <Button><Save /> Save Changes</Button>
</div>

// ✅ CORRECT (Prioritized hierarchy with overflow)
<div className="flex items-center gap-3">
  <div className="flex items-center gap-2">
    <Switch id="status" />
    <Label htmlFor="status" className="text-sm text-muted-foreground cursor-pointer">Active</Label>
  </div>
  <Button size="sm"><Save className="w-4 h-4 mr-1.5" /> Save Changes</Button>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="More actions">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem><Share2 className="w-4 h-4 mr-2" /> Share</DropdownMenuItem>
      <DropdownMenuItem><Download className="w-4 h-4 mr-2" /> Export</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

---

### 12. Redundant Wrapper Cards Around Self-Contained Views

- **Anti-Pattern**: Wrapping complex, self-contained components (such as tabbed code editors, interactive canvases, file browsers, or markdown renderers) inside a generic outer `Card` with redundant header boxes and extra padding.
- **Why Forbidden**: Produces nested borders, double margins, claustrophobic inner panels, and wastes valuable vertical and horizontal viewport space.
- **Correction**: Allow self-contained components that provide their own chrome (toolbars, tab triggers, status bars) to mount flush within the layout grid or viewport. Keep cards strictly for grouping unstructured form inputs or discrete metric summaries.


---

### 13. Left-Aligned Numbers in Data Tables

- **Anti-Pattern**: Left-aligning or centre-aligning numeric columns (financial values, percentages, counts).
- **Why Forbidden**: Misaligns decimal points, units, tens, and hundreds across rows. Users cannot compare order of magnitude at a glance. Proportional digit widths (digit `1` is narrower than `8`) cause horizontal jitter even among same-length numbers.
- **Correction**: Right-align all numeric values. Apply `font-variant-numeric: tabular-nums` for monospace digit widths.

---

### 14. Plain Text for Categorical Data

- **Anti-Pattern**: Displaying status fields, department names, contract types, or tier values as plain text strings in table cells.
- **Why Forbidden**: Forces line-by-line reading of full words. Destroys scanability across rows containing dozens of records.
- **Correction**: Wrap categorical values in enclosed chip containers with rounded corners, light tinted backgrounds matched to semantic color (green=active/completed, amber=pending/review, grey=inactive/terminated), and compact vertical padding (`2px 8px`).

---

### 15. Decorative Color Usage

- **Anti-Pattern**: Using vibrant colours to make dashboards look "lively" without mapping to data meaning.
- **Why Forbidden**: Creates visual noise that competes for attention with genuinely important status indicators. Users cannot learn color = meaning when colors are assigned arbitrarily.
- **Correction**: Reserve color strictly for semantic meaning. Blue for information/focus, green for success/safety, amber for warnings, red for critical/danger. All other elements use neutral greys.

---

### 16. Heavy Drop Shadows in Light Mode

- **Anti-Pattern**: Using dark, high-opacity drop shadows (`box-shadow: 0 4px 12px rgba(0,0,0,0.3)`).
- **Why Forbidden**: Creates visual mud. If the user notices the shadow before the data inside the container, the shadow is too strong.
- **Correction**: Use soft, diffuse shadows with high blur radius and opacity below 0.08 (e.g., `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`).

---

### 17. Shadows for Dark Mode Depth

- **Anti-Pattern**: Relying on drop shadows to create depth in dark mode interfaces.
- **Why Forbidden**: Shadows are invisible against dark canvas backgrounds. Elements appear flat and undifferentiated.
- **Correction**: Communicate depth through surface luminance tiers — progressively lighter background fills as elements rise toward the user (Canvas: `#0F172A` → Card: `#1E293B` → Modal: `#334155`).

---

### 18. Full-Page Navigation for Record Details

- **Anti-Pattern**: Opening a completely new page (`/records/123/edit`) to view or edit a single record from a data table.
- **Why Forbidden**: Destroys the user's scroll position, active filter state, and table context. Returning requires full page reload and re-navigation.
- **Correction**: Use slide-out inspection drawers (sheets) from the right edge. The table remains visible and interactive in the background.

---

### 19. Full-Screen Onboarding Modals

- **Anti-Pattern**: Greeting new users with a full-screen modal showing a 6-bullet feature summary.
- **Why Forbidden**: Users dismiss immediately and forget everything. No sequential learning occurs.
- **Correction**: Load interface with empty/demo state. Point single focused tooltip at the most important initial action. On completion, trigger next sequential prompt or dock persistent checklist in bottom corner.

---

### 20. Missing Interaction States

- **Anti-Pattern**: Buttons and controls that only have a default visual state with no hover, active, focus, or disabled variations.
- **Why Forbidden**: Users cannot confirm clicks registered. Keyboard users have no navigation visibility. Disabled controls are indistinguishable from active ones.
- **Correction**: Every interactive control must implement 5 states: Default (baseline), Hover (background shift + pointer), Active/Pressed (`transform: scale(0.98)`), Focus (ring: `outline: 2px solid #2563EB; outline-offset: 2px`), Disabled (50% opacity + `cursor: not-allowed`).

---

### 21. Non-Grid Spacing Values

- **Anti-Pattern**: Using arbitrary spacing values like 5px, 7px, 10px, 15px, or other non-multiples of 4.
- **Why Forbidden**: Odd bases fail when scaled across diverse resolutions, generating fractional sub-pixels that cause blurry rendering. Inconsistent spacing breaks visual rhythm.
- **Correction**: All spacing must use multiples of 4px (4, 8, 12, 16, 24, 32, 48, 64px). Multiples of 4 divide cleanly in half without fractional pixels.

---

### 22. Typography Scale Bloat

- **Anti-Pattern**: Using 10+ different font sizes across a dashboard, or using 48px–72px display sizes on operational screens.
- **Why Forbidden**: Destroys hierarchy when everything competes for attention. Large sizes break information density and push critical data below the viewport fold.
- **Correction**: Cap at exactly 6 discrete font sizes (12px, 14px, 16px, 18px, 20px, 24px). Maximum dashboard text size is 24px. Use weight (400–600) and color for additional hierarchy.

---

### 23. Solid Overlays on Photography

- **Anti-Pattern**: Placing a solid dark rectangle (`background: rgba(0,0,0,0.8)`) over an entire photograph to make overlaid text readable.
- **Why Forbidden**: Destroys the image content that was presumably included for a reason. Feels heavy and amateurish.
- **Correction**: Use a directional linear gradient (`linear-gradient(to top, rgba(15,23,42,0.95) 10%, rgba(15,23,42,0) 80%)`) or progressive `backdrop-filter: blur(4px)` to preserve visible portions of the image.
