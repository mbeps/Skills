# Lifecycle, Memory Safety, and State Synchronization (GNOME 45+)

## Overview

Because GNOME Shell runs in a single persistent process, any uncleaned actors, lingering signal connections, or leaked timers in Quick Settings will persist across extension disables and reloads, resulting in duplicated UI items, ghost indicators in the top panel, and memory leaks.

---

## The Complete Teardown Requirement (Indicators, Grid Items, and Submenus)

A major trap in Quick Settings extensions is partial destruction during `disable()`. Because Quick Settings spans two separate actor branches (`_indicators` in the top panel and `_grid` / `_overlay` in the menu drawer), standard GObject destruction does not cascade across them automatically:

1. **`SystemIndicator.destroy()` does NOT destroy drawer items**: Calling `indicator.destroy()` removes the top bar indicator icon from `Main.panel.statusArea.quickSettings._indicators`, but leaves all toggles and sliders in `indicator.quickSettingsItems` orphaned inside `menu._grid`.
2. **`QuickSettingsItem.destroy()` does NOT destroy submenus in `_overlay`**: `QuickMenuToggle` and `QuickSlider` mount their submenu container actor (`QuickToggleMenu.actor`) into `menu._overlay`. Because `_overlay` is a sibling of `_boxPointer` and not a child of the grid button, destroying the toggle button destroys its actor in `_grid`, but leaves the `.quick-toggle-menu-container` orphaned in `_overlay`.
3. **`QuickToggleMenu` holds a global listener**: `QuickToggleMenu` connects to `Main.sessionMode.connectObject('updated')`. Only calling `menu.destroy()` disconnects this listener.

### The Proper Teardown Pattern

```javascript
destroy() {
    // 1. Disconnect all signals tracked on this indicator
    this.disconnectObject(this);

    // 2. Destroy all items in the drawer grid AND their submenus in _overlay
    if (this.quickSettingsItems) {
        this.quickSettingsItems.forEach(item => {
            // Clean up sessionMode action mapping if registered
            if (item.menu?._settingsActions && this._extensionUuid) {
                delete item.menu._settingsActions[this._extensionUuid];
            }
            // Destroy flyout submenu actor in _overlay & disconnect sessionMode
            if (item.menu) {
                item.menu.destroy();
            }
            // Destroy button actor in _grid
            item.destroy();
        });
        this.quickSettingsItems = [];
    }

    // 3. Destroy custom sliders or items added directly via menu.addItem()
    if (this._customSlider) {
        if (this._customSlider.menu)
            this._customSlider.menu.destroy();
        this._customSlider.destroy();
        this._customSlider = null;
    }

    // 4. Destroy the top panel indicator itself
    super.destroy();
}
```

---

## Signal Safety with `connectObject` and `disconnectObject`

Always use `connectObject` with `this` as the lifetime tracker:

```javascript
// ✅ GOOD: Automatically cleaned up when this.disconnectObject(this) is called
this._toggle.connectObject(
    'notify::checked', () => this._syncState(),
    'clicked', () => this._onClick(),
    this
);

this._settings.connectObject(
    'changed::feature-enabled', () => this._onSettingsChanged(),
    this
);

// On destruction:
this.disconnectObject(this);
```

---

## GSettings Two-Way Synchronization

### Pattern A: Direct Binding (`settings.bind`)

For simple boolean switches that match GSettings keys directly:

```javascript
// Synchronizes both ways automatically
this._settings.bind(
    'feature-enabled',
    this._toggle,
    'checked',
    Gio.SettingsBindFlags.DEFAULT
);
```

### Pattern B: External State with Signal Blocking

When an external process or asynchronous command determines the toggle state, prevent recursive feedback loops using `signal_handler_block`:

```javascript
_syncStateFromExternal(externalState) {
    if (this._toggle.checked === externalState)
        return;

    // Block notify::checked handler to avoid triggering the toggle command again
    GObject.signal_handler_block(this._toggle, this._toggleSignalId);
    this._toggle.checked = externalState;
    GObject.signal_handler_unblock(this._toggle, this._toggleSignalId);
}
```

---

## Debouncing Rapid Settings Changes

When handling settings that could fire in rapid succession (e.g., text inputs or sliders):

```javascript
import GLib from 'gi://GLib';

export class DebounceManager {
    constructor() {
        this._timeoutIds = new Map();
    }

    debounce(key, func, delayMs = 300) {
        if (this._timeoutIds.has(key)) {
            GLib.source_remove(this._timeoutIds.get(key));
        }

        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._timeoutIds.delete(key);
            func();
            return GLib.SOURCE_REMOVE;
        });

        this._timeoutIds.set(key, id);
    }

    cancelAll() {
        for (const id of this._timeoutIds.values()) {
            GLib.source_remove(id);
        }
        this._timeoutIds.clear();
    }
}
```

---

## Extension Teardown Checklist

In your main `extension.js` `disable()` method:
- [ ] Destroy all `SystemIndicator` instances (ensuring `quickSettingsItems` are destroyed).
- [ ] Destroy any independently added sliders or widgets (`menu.addItem`).
- [ ] Restore any hidden or modified built-in components (`_originalToggle.show()`).
- [ ] Cancel all active `GLib.timeout_add` / `GLib.idle_add` timers with `GLib.source_remove`.
- [ ] Disconnect all settings handlers via `this._settings.disconnectObject(this)`.
- [ ] Disconnect all `Main.panel.statusArea.quickSettings` listeners.
