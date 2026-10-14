# QuickSliders and Custom Grid Items (GNOME 45+)

## Overview

While standard buttons use `QuickToggle` (span = 1), full-width controls such as volume sliders, brightness controllers, and media controls use `QuickSettings.QuickSlider` or custom `QuickSettingsItem` widgets spanning **2 columns** across the grid.

```text
┌──────────────────────────────────────────────────────────────┐
│ QuickSettingsGrid (2-column layout)                          │
├──────────────────────────────┬───────────────────────────────┤
│ Toggle 1 (span 1)            │ Toggle 2 (span 1)             │
├──────────────────────────────┴───────────────────────────────┤
│ QuickSlider 1 (Volume) (span 2)                              │
├──────────────────────────────────────────────────────────────┤
│ QuickSlider 2 (Custom Control / Cast) (span 2)               │
└──────────────────────────────────────────────────────────────┘
```

---

## Anatomy of a QuickSlider

`QuickSettings.QuickSlider` inherits from `QuickSettingsItem`.
> [!IMPORTANT]
> `QuickSettingsItem` inherits directly from `St.Button` (which is an `St.Bin`, a single-child container), **not** an `St.BoxLayout`. Its internal layout is managed by setting its child via `this.set_child(box)`.

`QuickSlider` initializes with `hasMenu: true` and contains:
1. An icon button on the left (`_iconButton` wrapping `_icon`) that emits `icon-clicked`.
2. A continuous draggable slider bar in the center (`this.slider`).
3. An expandable submenu arrow on the right (`_menuButton`) bound to `menu-enabled`.

### Key Member Properties & Signals

| Member | Type | Purpose |
|---|---|---|
| `this.slider` | `resource:///org/gnome/shell/ui/slider.js.Slider` | The underlying draggable Clutter/St slider actor |
| `this.slider.value` | `number` (0.0 to 1.0) | Normalized current position |
| `this.slider.accessible_name` | `string` | Screen-reader accessible label |
| `this.iconName` | `string` | Symbolic icon name on the left |
| `this.gicon` | `Gio.Icon` | GIcon instance (takes precedence over `iconName`) |
| `this.iconReactive` | `boolean` | If `true`, clicking the icon emits `icon-clicked` |
| `this.menuEnabled` | `boolean` | If `true`, displays the chevron arrow button on the right to open `this.menu` |
| `this.menu` | `QuickToggleMenu` | The flyout submenu displayed in `_overlay` when opened |
| `icon-clicked` | Signal | Emitted when user clicks the icon (e.g., mute toggle) |
| `slider.notify::value` | Signal | Emitted continuously as value changes |
| `slider.drag-begin` | Signal | Emitted when user starts dragging the slider knob |
| `slider.drag-end` | Signal | Emitted when user releases the slider knob |

---

## Custom QuickSlider Implementation

The following example implements a custom volume/level slider with an interactive mute icon and an expandable device-selection submenu:

```javascript
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

export const CustomVolumeSlider = GObject.registerClass(
class CustomVolumeSlider extends QuickSettings.QuickSlider {
    _init(onChangeCallback, onMuteCallback) {
        super._init({
            iconName: 'audio-volume-high-symbolic',
        });

        this._onChange = onChangeCallback;
        this._onMute = onMuteCallback;
        this._isMuted = false;

        // 1. Configure the interactive icon
        this.iconReactive = true;
        this.connectObject('icon-clicked', () => {
            this._isMuted = !this._isMuted;
            this.iconName = this._isMuted
                ? 'audio-volume-muted-symbolic'
                : 'audio-volume-high-symbolic';
            if (this._onMute)
                this._onMute(this._isMuted);
        }, this);

        // 2. Track slider drag to prevent feedback loops with external daemons
        this._inDrag = false;
        this.slider.connectObject(
            'drag-begin', () => { this._inDrag = true; },
            'drag-end', () => { this._inDrag = false; },
            'notify::value', () => {
                if (this._inDrag && this._onChange) {
                    this._onChange(this.slider.value);
                }
            },
            this
        );

        // 3. Optional: Configure expandable submenu for output devices
        this.menuEnabled = true;
        this.menu.setHeader('audio-volume-high-symbolic', 'Audio Output');
        const item = new PopupMenu.PopupMenuItem('Default Speakers');
        item.setOrnament(PopupMenu.Ornament.CHECK);
        this.menu.addMenuItem(item);
    }

    setLevel(val) {
        // Only update if not actively dragged by user
        if (!this._inDrag) {
            this.slider.value = Math.max(0.0, Math.min(1.0, val));
        }
    }

    destroy() {
        this.disconnectObject(this);
        this.slider.disconnectObject(this);
        // Clean up submenu overlay actor to avoid leaks in _overlay
        if (this.menu) {
            this.menu.destroy();
        }
        super.destroy();
    }
});
```

---

## Placement and Spanning in Quick Settings Grid

In GNOME Shell, `Main.panel.statusArea.quickSettings.menu._grid` is an `St.Widget` powered by `QuickSettingsLayout` (a custom `Clutter.LayoutManager`). The layout arranges children across `nColumns` (default 2).

### Grid Spanning Methods on `quickSettings.menu`

- `menu.addItem(item, colSpan = 1)`: Appends an item to the end of the grid.
- `menu.insertItemBefore(item, sibling, colSpan = 1)`: Inserts an item immediately preceding `sibling`.

Under the hood, these methods configure the child layout property:
```javascript
grid.layout_manager.child_set_property(grid, item, 'column-span', colSpan);
```

```javascript
const qsMenu = Main.panel.statusArea.quickSettings.menu;

// Standard toggle (occupies 1 column)
qsMenu.addItem(myToggle, 1);

// Slider or broad card (occupies full 2 columns)
qsMenu.addItem(mySlider, 2);
```

---

## Anchoring Beside Built-in Sliders

To place a custom slider alongside the system volume and brightness sliders, traverse the grid children using public API:

```javascript
function findLastSliderAnchor(menu) {
    let lastSlider = null;
    for (let item = menu.getFirstItem(); item; item = item.get_next_sibling()) {
        if (item instanceof QuickSettings.QuickSlider) {
            lastSlider = item;
        } else if (lastSlider) {
            // Reached non-slider after finding at least one slider
            break;
        }
    }
    // Return the item immediately following the last slider, or null
    return lastSlider?.get_next_sibling() ?? null;
}
```

---

## Startup Race Conditions (GNOME Shell 49, 50+)

In GNOME 49, 50+, GNOME Shell initializes built-in status area indicators and grid items inside an **asynchronous** function:
```javascript
// From GNOME Shell's panel.js:
this._setupIndicators().catch(error => logError(error, 'Failed to setup quick settings'));
```
Because `_setupIndicators()` awaits dynamic ES module imports (`await import('./status/network.js')`, `await import('./status/bluetooth.js')`), the built-in sliders and toggles may not yet be attached to `_grid` when an extension's `enable()` method executes during initial login. `getFirstItem()` can return `null` or omit the system volume/brightness sliders.

### The Safe Retry Pattern

```javascript
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

class SliderManager {
    constructor() {
        this._slider = null;
        this._retries = 0;
        this._maxRetries = 10;
        this._intervalMs = 200;
        this._timeoutId = 0;
    }

    attachSlider(slider) {
        this._slider = slider;
        this._addSlider();
    }

    _addSlider() {
        try {
            const menu = Main.panel.statusArea.quickSettings.menu;
            const anchor = findLastSliderAnchor(menu);

            if (anchor) {
                // Sibling found, insert with colSpan = 2
                menu.insertItemBefore(this._slider, anchor, 2);
            } else if (this._retries++ < this._maxRetries) {
                // Retry in 200ms
                this._timeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    this._intervalMs,
                    () => {
                        this._timeoutId = 0;
                        this._addSlider();
                        return GLib.SOURCE_REMOVE;
                    }
                );
            } else {
                // Fallback: append at bottom with colSpan = 2
                menu.addItem(this._slider, 2);
            }
        } catch (e) {
            console.warn(`Failed to attach QuickSlider: ${e}`);
        }
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._slider) {
            this._slider.destroy();
            this._slider = null;
        }
    }
}
```

---

## Creating Non-Slider Custom Widgets in the Grid

To add arbitrary Clutter and St widgets (such as now-playing banners, weather cards, or multi-button clusters) as full-width items in the grid, subclass `QuickSettingsItem`.

> [!IMPORTANT]
> Because `QuickSettingsItem` inherits from `St.Button` (a single-child container bin), always wrap child widgets in an `St.BoxLayout` or `Clutter.Actor` and assign it with `this.set_child(container)`. Calling `this.add_child(...)` directly without setting a bin child will violate St.Bin constraints.

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { QuickSettingsItem } from 'resource:///org/gnome/shell/ui/quickSettings.js';

export const MediaBannerWidget = GObject.registerClass(
class MediaBannerWidget extends QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'quick-settings-media-banner',
            can_focus: true,
        });

        // 1. Create container box
        const box = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: 'padding: 10px;',
        });

        // 2. Add inner widgets
        this._trackLabel = new St.Label({
            text: 'Now Playing: None',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        box.add_child(this._trackLabel);

        // 3. Attach layout container as the single child of this St.Bin
        this.set_child(box);
    }
});

// Added to grid with colSpan = 2:
menu.addItem(new MediaBannerWidget(), 2);
```
