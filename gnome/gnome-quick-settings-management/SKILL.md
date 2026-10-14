---
name: gnome-quick-settings-management
description: Use when building, modifying, or debugging GNOME Shell Quick Settings components (GNOME 45+) in JavaScript or TypeScript, including QuickToggle buttons, QuickMenuToggle submenus, QuickSlider controls, SystemIndicator top bar items, reordering or replacing built-in Quick Settings toggles, or troubleshooting menu overlay clipping, scroll event drops, and lifecycle leaks.
---

# GNOME Quick Settings Management (GNOME 45+)

## Overview

In GNOME Shell (GNOME 45+), the Quick Settings menu drawer is a specialized Clutter/St subsystem coordinating top bar status icons (`SystemIndicator`), a 2-column drawer grid (`_grid`), and an isolated flyout submenu overlay (`_overlay`).

**Core principle:** Maintain absolute symmetry between `enable()` and `disable()`. Always destroy drawer items in `quickSettingsItems` AND their flyout submenus in `_overlay` when destroying a `SystemIndicator`, strictly isolate submenus in `_overlay` from `_boxPointer` dimming, and use `captured-event` for menu-level pointer scrolling.

---

## When to Use

- Creating new toggle buttons in the Quick Settings menu drawer (`QuickSettings.QuickToggle`).
- Adding expandable submenus or dropdowns to Quick Settings (`QuickSettings.QuickMenuToggle`).
- Adding full-width sliders for audio, brightness, or hardware controls (`QuickSettings.QuickSlider`).
- Pairing Quick Settings drawer items with top bar status indicators (`QuickSettings.SystemIndicator`).
- Modifying, hiding, or replacing built-in GNOME Shell toggles (such as Auto-Rotate, Do Not Disturb, Volume, or Wi-Fi).
- Reordering toggles or indicators in the top panel or Quick Settings drawer grid.
- Intercepting scroll wheel events or building custom layouts inside Quick Settings.
- Diagnosing issues where drawer toggles fail to destroy, submenus dim erroneously, or mouse scrolling does not work over toggles.

## When NOT to Use

- General GNOME Shell extension lifecycle, GSettings schemas, or Libadwaita preference windows (refer to `gnome-shell-extension` skill).
- Top panel buttons outside the Quick Settings area (use standard `PanelMenu.Button` in `Main.panel.addToStatusArea()`).
- Pre-GNOME 45 extensions (legacy `imports.ui.quickSettings` syntax).

---

## Decision Flowchart

```text
Add or Modify Quick Settings?
 ├── New Item
 │    ├── Continuous numeric adjustment? ──────► QuickSlider (span 2)
 │    ├── Expandable flyout menu?
 │    │    ├── Dual-action switch + submenu? ──► QuickMenuToggle (toggleMode: true)
 │    │    └── Menu launcher only? ────────────► QuickMenuToggle (toggleMode: false, connect 'clicked')
 │    ├── Full-width custom widget card? ─────► QuickSettingsItem (set_child with St.BoxLayout, span 2)
 │    └── Simple on/off toggle? ───────────────► QuickToggle (toggleMode: true)
 └── Modify Built-in Item
      ├── Hide existing control? ──────────────► remove_child from _indicators and/or _grid
      ├── Replace existing toggle? ────────────► hide original, addItem + set_child_below_sibling
      └── Reorder items? ──────────────────────► set_child_above_sibling / set_child_below_sibling
```

---

## Quick Settings Architecture

```text
Main.panel.statusArea.quickSettings (PanelMenu.Button)
 │
 ├── Top Panel Area
 │     └── _indicators (St.BoxLayout)  <-- Top-bar indicator icons (visible via _syncIndicatorsVisible)
 │
 └── Drawer Area (menu: QuickSettingsMenu)
       └── actor (St.Widget 0x0)
             ├── _boxPointer (BoxPointer)
             │     └── bin -> box (.quick-settings)
             │                 └── _grid (St.Widget with QuickSettingsLayout)  <-- 2-column layout
             │
             └── _overlay (St.Widget)  <-- Anchored submenus outside _boxPointer (prevents dimming)
```

---

## Core Quick Settings Pattern

The complete, minimal implementation pairing a top bar indicator with a Quick Settings toggle and clean lifecycle teardown:

```javascript
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const MyIndicator = GObject.registerClass(
class MyIndicator extends QuickSettings.SystemIndicator {
    _init() {
        super._init();

        // 1. Create the top bar indicator icon (starts hidden)
        this._indicatorIcon = this._addIndicator();
        this._indicatorIcon.icon_name = 'starred-symbolic';
        this._indicatorIcon.visible = false;

        // 2. Create the drawer toggle button
        this._toggle = new QuickSettings.QuickToggle({
            title: 'My Service',
            iconName: 'starred-symbolic',
            toggleMode: true,
        });

        // 3. Link toggle checked state directly to indicator icon visibility.
        // SystemIndicator._syncIndicatorsVisible automatically shows/hides the top bar icon.
        this._toggle.bind_property(
            'checked',
            this._indicatorIcon,
            'visible',
            GObject.BindingFlags.SYNC_CREATE
        );

        // 4. Register toggle with this indicator
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        // Critical: Destroy drawer items and any attached flyout menus before super.destroy()
        this.quickSettingsItems.forEach(item => {
            if (item.menu)
                item.menu.destroy();
            item.destroy();
        });
        this.quickSettingsItems = [];
        super.destroy();
    }
});

export default class QuickSettingsExtension extends Extension {
    enable() {
        this._indicator = new MyIndicator();
        // Registers indicator in top panel and places drawer items into quickSettings.menu._grid
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
```

---

## Specialized Reference Manuals

Targeted, deep-dive reference guides covering every subsystem of Quick Settings management:

- **[QuickToggle & SystemIndicators](references/quick-toggle-and-indicators.md)**: `QuickToggle` properties, `SystemIndicator` pairing, state binding, 1-col layout, and multiple toggles per indicator.
- **[QuickMenuToggle & Submenus](references/quick-menu-toggle-and-submenus.md)**: `QuickMenuToggle`, `toggleMode` (dual action vs single action), headers, `addHeaderSuffix`, `addSettingsAction`, radio checkmarks, custom button grids, entries, and lock-screen session mode gating.
- **[QuickSliders & Custom Grid Items](references/quick-sliders-and-custom-items.md)**: Subclassing `QuickSlider`, slider submenus (`menuEnabled`), 2-column span (`colSpan = 2`), continuous dragging vs external state, custom widget cards (`QuickSettingsItem` as `St.Button` bin), and async Shell 49/50+ startup retry anchors.
- **[Menu Hierarchy & Overlay Architecture](references/menu-hierarchy-and-overlay.md)**: Deep actor tree, why `_overlay` lives outside `_boxPointer`, Clutter event delivery, why `St.Button` consumes scroll events, `captured-event` listeners, and GNOME 51+ `ScrollController`.
- **[Modifying Built-in Quick Settings](references/modifying-builtin-quick-settings.md)**: Registry of built-in components (`_system`, `_volumeOutput`, `_brightness`, `_backlight`, `_doNotDisturb`, `_rfkill`, etc.), cleanly hiding/replacing toggles, reordering top panel indicators, and tracking dynamic items.
- **[Lifecycle & State Synchronization](references/lifecycle-and-state-synchronization.md)**: The complete teardown requirement (indicators, grid items, and submenus), avoiding ghost toggles, leak-free `connectObject`, GSettings two-way binding with signal blocking, and debounce managers.

---

## Quick Reference: Common APIs & Patterns

| Goal | Modern API / Approach | Reference Guide |
|---|---|---|
| Add toggle to Quick Settings | Subclass `SystemIndicator`, push `QuickToggle` into `quickSettingsItems`, call `addExternalIndicator()` | [quick-toggle-and-indicators.md](references/quick-toggle-and-indicators.md) |
| Add toggle with expandable menu | Subclass `QuickMenuToggle`, configure `this.menu.setHeader()`, connect `'clicked'` if `toggleMode: false` | [quick-menu-toggle-and-submenus.md](references/quick-menu-toggle-and-submenus.md) |
| Add continuous slider control | Subclass `QuickSlider`, call `menu.addItem(slider, 2)` or `insertItemBefore(slider, anchor, 2)` | [quick-sliders-and-custom-items.md](references/quick-sliders-and-custom-items.md) |
| Close entire Quick Settings menu | `Main.panel.closeQuickSettings()` | [quick-menu-toggle-and-submenus.md](references/quick-menu-toggle-and-submenus.md) |
| Hide built-in toggle cleanly | Remove toggle from `_grid` and indicator from `_indicators`; restore on `disable()` | [modifying-builtin-quick-settings.md](references/modifying-builtin-quick-settings.md) |
| Replace built-in toggle | Hide original toggle, add replacement with `addItem()`, position with `set_child_below_sibling()` | [modifying-builtin-quick-settings.md](references/modifying-builtin-quick-settings.md) |
| Reorder indicator in top panel | Call `_indicators.remove_child(indicator)` followed by `_indicators.insert_child_at_index(indicator, idx)` | [modifying-builtin-quick-settings.md](references/modifying-builtin-quick-settings.md) |
| Orange privacy accent on icon | `indicatorIcon.add_style_class_name('privacy-indicator')` | [quick-toggle-and-indicators.md](references/quick-toggle-and-indicators.md) |
| Intercept scroll wheel over drawer | Listen to `captured-event` on `menu._boxPointer` and each child of `menu._overlay` | [menu-hierarchy-and-overlay.md](references/menu-hierarchy-and-overlay.md) |
| Safe destruction without leaks | Iterate `quickSettingsItems.forEach(i => { i.menu?.destroy(); i.destroy(); })`, then call `super.destroy()` | [lifecycle-and-state-synchronization.md](references/lifecycle-and-state-synchronization.md) |

---

## Common Pitfalls & Solutions

| Symptom / Error | Root Cause | Solution |
|---|---|---|
| Indicator icon appears in top panel, but toggle is missing from drawer | Forgot to push toggle to `this.quickSettingsItems` before calling `addExternalIndicator()` | Add `this.quickSettingsItems.push(this._toggle)` in indicator `_init()` |
| Duplicate toggles appear after disabling and re-enabling extension | Called `indicator.destroy()` without destroying items in `quickSettingsItems` | Implement `destroy()` to iterate `this.quickSettingsItems.forEach(i => i.destroy())` before `super.destroy()` |
| Leaked submenu in `_overlay` after disabling extension | Submenu actor lives in `_overlay` (separate Clutter parent from `_grid`); destroying button does not destroy menu | Call `item.menu?.destroy()` explicitly when tearing down toggles/sliders |
| Dead clicks on toggle button when `toggleMode: false` | Only chevron arrow opens menu by default; main button body emits `clicked` | Connect to `clicked` on the toggle to call `this.menu.open()` |
| Layout crash when adding multiple child actors to `QuickSettingsItem` | `QuickSettingsItem` inherits from `St.Button` (a single-child Bin), not `St.BoxLayout` | Wrap child widgets in an `St.BoxLayout` and assign with `this.set_child(box)` |
| Slider appears squeezed into a narrow half-width column | Added slider with default column span of 1 | Use `menu.addItem(slider, 2)` or `menu.insertItemBefore(slider, anchor, 2)` |
| Submenu text appears dark grey or dimmed when opened | Appended submenu inside `menu._boxPointer.bin.box` instead of standard `_overlay` | Use `QuickMenuToggle.menu` which automatically mounts into `_overlay` outside the dimming shader |
| Mouse wheel scrolling does not work when hovered over Quick Toggles | `St.Button` consumes scroll events in capture phase via `ClutterClickGesture` | Connect to `captured-event` on `menu._boxPointer` to intercept events ahead of buttons |
| Mouse wheel scrolling breaks as soon as any submenu is opened | Open submenu takes Clutter modal grab, routing events away from `_boxPointer` | Connect to `captured-event` on children of `menu._overlay` in addition to `_boxPointer` |
| Preferences menu item visible on lock screen | Extension settings action not gated by session mode | Check `Main.sessionMode.allowSettings` and assign to `this.menu._settingsActions[uuid]` |
| Crashes on GNOME 46+ with `actor-added is not a valid signal` | GNOME 46 removed deprecated Clutter container signals | Use `child-added` and `child-removed` instead of `actor-added` and `actor-removed` |
| Slider placement fails intermittently on system startup / login | GNOME Shell's `_setupIndicators()` is an `async` function awaiting dynamic ES imports | Implement retry loop (`GLib.timeout_add`) to locate slider anchor before settling for end of grid |
| Infinite signal loop when synchronizing toggle with external daemon | `notify::checked` triggers command which triggers external change event | Block signal with `GObject.signal_handler_block(toggle, id)` while applying incoming state |
