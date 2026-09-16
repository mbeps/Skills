# Navigation Architecture

## Overview

Navigation must remain predictable, accessible, and effortless across all viewport sizes. The application must never hide critical navigation paths or allow navigation bars to scroll out of view.

---

## Desktop Navigation

Select between a Top Navbar and a Sidebar based on destination count and hierarchy complexity.

```
Destination Count <= 5 ──> Fixed Top Navbar
Destination Count > 5  ──> Fixed Sidebar
Complex Sub-trees      ──> Fixed Sidebar
```

### 1. Fixed Top Navbar

Use the Top Navbar for applications with focused workflows and 5 or fewer primary views.

- **Positioning**: Fixed or sticky at the top (`fixed top-0 inset-x-0 z-50` or `sticky top-0 z-50`). The user must never scroll away from the navbar.
- **Item Limit**: Maximum 5 visible navigation items in the main bar.
- **Overflow Handling**: Place item 6 and beyond inside a "More" dropdown menu.
- **Iconography**: Icons alongside text labels are optional on desktop navbars, but must remain consistent (either all items have icons, or none do).
- **Profile Area**: Place the user avatar on the far right. Clicking the avatar opens an action dropdown (Profile, Settings, Organisation switch, Logout) where each action has a vector icon.
- **Active State**: Highlight the current route clearly with subtle background tinting, high-contrast text, or a bottom border indicator.
- **Keyboard Focus**: Apply visible keyboard focus states (`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`) to all navigation links, buttons, and dropdown triggers to ensure full WCAG 2.1 AA keyboard accessibility.

### 2. Fixed Sidebar

Use the Sidebar for dashboards, administration panels, and complex applications with more than 5 navigation destinations or multi-tier hierarchies.

- **Positioning**: Fixed to the left edge (`fixed top-0 bottom-0 left-0 w-64 z-40`). Content area scrolls independently.
- **Icon Requirement**: Every navigation entry must include a distinct vector icon (Lucide, Tabler, Phosphor) preceding the label.
- **Grouping & Hierarchy**: Group related destinations under subtle section headings (for example: Overview, Management, Analytics, System).
- **Collapsible State**: If collapsible to an icon-only rail, provide clear tooltips on hover for every icon.
- **Profile Area**: Pin the user profile block to the bottom of the sidebar. It displays the user avatar, name, email/role, and triggers a popover or dropdown containing account actions with icons.
- **Keyboard Focus**: Apply visible keyboard focus states (`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`) to all navigation links, buttons, and dropdown triggers to ensure full WCAG 2.1 AA keyboard accessibility.

---

## Mobile Navigation

Mobile viewports (under 768px / `md` breakpoint) require specialized ergonomics based on single-hand usage and thumb reachability.

### 1. Fixed Bottom Navigation Bar

The bottom bar is the primary navigation method on mobile.

- **Positioning**: Fixed at the bottom of the viewport (`fixed bottom-0 inset-x-0 z-50`).
- **Safe Area Insets**: Always include `pb-[env(safe-area-inset-bottom)]` for modern mobile devices.
- **Capacity**: Maximum 5 action slots.
- **Item Format**: Each slot contains a vertically stacked vector icon (20px to 24px) and a short text label (10px to 12px).
- **Slot Allocation**:
  - Slots 1 to 4: Primary app views (e.g., Home, Orders, Analytics, Messages).
  - Slot 5: "More" button (Menu / MoreHorizontal icon) that triggers the Mobile Bottom Drawer.

### 2. Mobile Bottom Drawer (Sheet)

All secondary navigation, account actions, and overflow pages open within a slide-up bottom drawer.

#### Why Bottom Drawers Win on Mobile

1. **Thumb Zone Ergonomics**: Bottom drawers place interactive targets in the natural sweep of the thumb (bottom 50% of the screen), eliminating top-corner reaching strains.
2. **Larger Touch Targets**: Bottom sheets provide full-width rows with generous touch heights (minimum 48px to 56px per row).
3. **Context Retention**: A dimmed backdrop sheet keeps the user grounded in their current task while accessing secondary controls.
4. **Superior to Sidebars & Dropdowns**: Slide-out sidebars on mobile feel cramped, hide behind distant hamburger icons at top-left, and desktop dropdown menus easily clip off small screens.

#### Drawer Contents Structure

Structure the mobile bottom drawer in the following order:

1. **Header / Profile Section**:
   - User avatar, full name, and email or role badge.
   - Quick link to Account / Profile settings with an icon.
2. **Navigation Links (Overflow Destinations)**:
   - Full list of secondary routes not present in the main bottom bar.
   - Every link must feature a leading vector icon and an optional trailing chevron.
3. **Preferences / Utilities**:
   - Theme toggle (Light / Dark mode), notifications switch, or workspace switcher.
4. **Destructive Actions**:
   - Logout button placed at the bottom with a red tint or neutral subdued tone and a `LogOut` icon.

---

## Navigation Decision Matrix

| Dimension                     | Desktop Navbar           | Desktop Sidebar         | Mobile Bottom Bar + Drawer  |
| ----------------------------- | ------------------------ | ----------------------- | --------------------------- |
| **Max Visible Primary Links** | 5 items                  | Unlimited (grouped)     | 4 links + 1 "More" trigger  |
| **Overflow Pattern**          | "More" Dropdown menu     | Scrollable sidebar list | Slide-up Bottom Drawer      |
| **Icons Required?**           | Optional (be consistent) | Mandatory on all items  | Mandatory on all items      |
| **Profile Menu Location**     | Top right dropdown       | Bottom of sidebar       | Inside Bottom Drawer header |
| **Scroll Behaviour**          | Fixed / Sticky header    | Fixed permanent panel   | Fixed bottom bar            |
