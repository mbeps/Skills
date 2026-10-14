# QuickToggle and SystemIndicator Development (GNOME 45+)

## Overview

In GNOME Shell 45+, standard toggles in the Quick Settings menu drawer are paired with top bar status indicators. The architectural bridge connecting the top panel to the Quick Settings menu drawer is the `QuickSettings.SystemIndicator` class, which manages one or more `QuickSettings.QuickToggle` items.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Top Panel: Main.panel.statusArea.quickSettings._indicators             │
│   [ Indicator Icon 1 ]  [ Indicator Icon 2 ]  [ ... ]                  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ paired via SystemIndicator
┌────────────────────────────────────▼───────────────────────────────────┐
│ Quick Settings Drawer: Main.panel.statusArea.quickSettings.menu._grid  │
│   ┌─────────────────────┐  ┌─────────────────────┐                     │
│   │ QuickToggle 1       │  │ QuickToggle 2       │                     │
│   └─────────────────────┘  └─────────────────────┘                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Anatomy of a QuickToggle

`QuickSettings.QuickToggle` inherits from `St.Button`. It represents a standard toggle button with an icon, title, optional subtitle, and active/checked state.

### Key Constructor Properties

| Property | Type | Description |
|---|---|---|
| `title` | `string` | Primary label shown inside the toggle button |
| `subtitle` | `string \| null` | Secondary subtitle text below the title |
| `iconName` | `string` | Named icon from the icon theme (symbolic icon recommended) |
| `gicon` | `Gio.Icon` | `Gio.ThemedIcon` or `Gio.FileIcon` instance (takes precedence over `iconName`) |
| `toggleMode` | `boolean` | `true` for a checkable switch button; `false` for an action button |
| `checked` | `boolean` | Initial boolean activation state (sets `:checked` CSS pseudo-class) |

### Key Signals

- `clicked`: Emitted when the user activates the button (standard button press).
- `notify::checked`: Emitted whenever the toggle's `checked` property changes (either via user click or programmatically).

---

## Anatomy of a SystemIndicator

`QuickSettings.SystemIndicator` inherits from `St.BoxLayout`. It represents the top panel status indicator associated with your Quick Settings items.

### Visibility Synchronization Mechanism

`SystemIndicator` initializes with `visible: false`. It maintains an internal method:
```javascript
_syncIndicatorsVisible() {
    this.visible = this.get_children().some(a => a.visible);
}
```
When you call `this._addIndicator()`, GNOME Shell returns an `St.Icon` and automatically connects its `notify::visible` signal to `_syncIndicatorsVisible()`. As soon as your indicator icon becomes visible (e.g. when your feature is activated), the parent `SystemIndicator` box in the top bar automatically reveals itself.

### Key Member Properties & Methods

- `this._addIndicator()`: Allocates, connects, and returns an indicator icon actor (`St.Icon`) with style class `system-status-icon`.
- `this.quickSettingsItems`: An `Array` holding all toggles, sliders, or items belonging to this indicator.
- `Main.panel.statusArea.quickSettings.addExternalIndicator(indicator, colSpan = 1)`: Registers the indicator in the top panel and automatically adds all elements in `indicator.quickSettingsItems` to the Quick Settings drawer grid with the given column span (`colSpan = 1` for single-column toggle, `colSpan = 2` for full-width control).

---

## Complete Implementation Pattern

The standard, leak-free pattern for creating a custom QuickToggle paired with a top-panel indicator:

```javascript
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

// 1. Define the QuickToggle
export const MyToggle = GObject.registerClass(
class MyToggle extends QuickSettings.QuickToggle {
    _init(title, iconName) {
        super._init({
            title: title,
            iconName: iconName,
            toggleMode: true, // Enables switch/checked behavior
        });
    }
});

// 2. Define the SystemIndicator
export const MyIndicator = GObject.registerClass(
class MyIndicator extends QuickSettings.SystemIndicator {
    _init(settings) {
        super._init();
        this._settings = settings;

        // Create the top bar indicator icon (starts hidden)
        this._indicatorIcon = this._addIndicator();
        this._indicatorIcon.icon_name = 'weather-clear-symbolic';

        // Create the drawer toggle
        this._toggle = new MyToggle('My Feature', 'weather-clear-symbolic');

        // Associate toggle with this indicator
        this.quickSettingsItems.push(this._toggle);

        // Bind toggle checked state directly to indicator visibility.
        // When checked is true, _indicatorIcon becomes visible, which automatically
        // triggers _syncIndicatorsVisible() to make this SystemIndicator visible in the panel.
        this._toggle.bind_property(
            'checked',
            this._indicatorIcon,
            'visible',
            GObject.BindingFlags.SYNC_CREATE
        );

        // Listen for user clicks / state changes
        this._toggle.connectObject(
            'notify::checked',
            () => this._onToggleStateChanged(),
            this
        );

        // Bind GSettings if applicable
        if (this._settings) {
            this._settings.bind(
                'my-feature-enabled',
                this._toggle,
                'checked',
                Gio.SettingsBindFlags.DEFAULT
            );
        }
    }

    _onToggleStateChanged() {
        if (this._toggle.checked) {
            this._toggle.subtitle = 'Active';
        } else {
            this._toggle.subtitle = null;
        }
    }

    destroy() {
        // Disconnect all signals registered on this indicator
        this.disconnectObject(this);
        this._toggle.disconnectObject(this);

        // Destroy all drawer items and any attached flyout submenus in _overlay
        this.quickSettingsItems.forEach(item => {
            if (item.menu)
                item.menu.destroy();
            item.destroy();
        });
        this.quickSettingsItems = [];

        // Destroy the top-bar indicator container itself
        super.destroy();
    }
});
```

---

## Registering and Unregistering in Extension Lifecycle

In `extension.js`, always register during `enable()` and symmetrically clean up in `disable()`:

```javascript
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { MyIndicator } from './myIndicator.js';

export default class MyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new MyIndicator(this._settings);

        // Adds top bar indicator and places drawer items into quickSettings.menu._grid
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}
```

---

## Multiple Toggles per Indicator

A single `SystemIndicator` can manage multiple `QuickToggle` buttons in the drawer:

```javascript
export const MultiToggleIndicator = GObject.registerClass(
class MultiToggleIndicator extends QuickSettings.SystemIndicator {
    _init() {
        super._init();

        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'system-run-symbolic';
        this._indicator.visible = false;

        this._toggleA = new MyToggle('Mode A', 'media-playback-start-symbolic');
        this._toggleB = new MyToggle('Mode B', 'media-playback-pause-symbolic');

        // Both items will be added to the Quick Settings grid side-by-side
        this.quickSettingsItems.push(this._toggleA);
        this.quickSettingsItems.push(this._toggleB);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        this.quickSettingsItems = [];
        super.destroy();
    }
});
```

---

## Styling Indicator Icons

Indicator icons can be customized with GNOME Shell style classes:

```javascript
// Style as a privacy indicator (orange tint, matching microphone/camera in GNOME)
this._indicatorIcon.add_style_class_name('privacy-indicator');

// Add custom text badge next to indicator icon (e.g., timer or percentage)
this._badgeLabel = new St.Label({
    y_expand: true,
    y_align: Clutter.ActorAlign.CENTER,
    style_class: 'quick-settings-indicator-label',
});
this.add_child(this._badgeLabel);
```

---

## Common Traps & Rules

1. **Never forget `quickSettingsItems.push(toggle)`**: If you create a `QuickToggle` inside a `SystemIndicator` but don't push it into `this.quickSettingsItems`, `addExternalIndicator()` will add the top panel icon, but your toggle will never appear in the drawer.
2. **Never call `addExternalIndicator` multiple times with the same instance**: It will re-add actors to the grid and cause visual duplication or layout crashes.
3. **Always destroy items before destroying the indicator**: In `destroy()`, iterate over `this.quickSettingsItems` and call `.destroy()` on each item, then call `super.destroy()`. Otherwise Clutter actors remain orphaned in `_grid`.
