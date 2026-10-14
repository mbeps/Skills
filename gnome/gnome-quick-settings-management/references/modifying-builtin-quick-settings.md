# Modifying and Reordering Built-in Quick Settings (GNOME 45+)

## Overview

GNOME Shell exposes all of its default indicators and toggles through properties on `Main.panel.statusArea.quickSettings`. Extensions can inspect, reorder, restyle, hide, or replace these built-in controls.

---

## Registry of Built-in Quick Settings Components

Access these on `Main.panel.statusArea.quickSettings`:

| Property | Component Class | Managed Drawer Items | Notes |
|---|---|---|---|
| `_system` | `SystemStatus.Indicator` | Power, Lock, Suspend, Settings | Bottom system bar (`_systemItem`) |
| `_volumeOutput` | `VolumeStatus.OutputIndicator` | Speaker/Headphone `QuickSlider` | Audio output stream |
| `_volumeInput` | `VolumeStatus.InputIndicator` | Microphone `QuickSlider` | Audio input stream (privacy) |
| `_brightness` | `BrightnessStatus.Indicator` | Screen brightness `QuickSlider` | Display backlight slider |
| `_backlight` | `BacklightStatus.Indicator` | Keyboard backlight `QuickSlider` | Keyboard illumination |
| `_network` | `NetworkStatus.Indicator` | Wired & Wi-Fi `QuickMenuToggle` | NetworkManager integration |
| `_bluetooth` | `BluetoothStatus.Indicator` | Bluetooth `QuickMenuToggle` | BlueZ integration |
| `_powerProfiles` | `PowerProfileStatus.Indicator` | Power Profiles `QuickMenuToggle` | power-profiles-daemon |
| `_doNotDisturb` | `DoNotDisturb.Indicator` | Do Not Disturb `QuickToggle` | Notifications silencing |
| `_nightLight` | `NightLightStatus.Indicator` | Night Light `QuickToggle` | Color temperature |
| `_darkMode` | `DarkModeStatus.Indicator` | Dark Mode `QuickToggle` | Freedesktop appearance |
| `_rfkill` | `RFKillStatus.Indicator` | Airplane Mode `QuickToggle` | Hardware RF kill |
| `_autoRotate` | `AutoRotateStatus.Indicator` | Auto Rotate `QuickToggle` | Accelerometer rotation lock |
| `_camera` | `CameraStatus.Indicator` | (Indicator icon only) | Active camera indicator (privacy) |
| `_location` | `LocationStatus.Indicator` | (Indicator icon only) | Geolocation active (privacy) |
| `_remoteAccess` | `RemoteAccessApplet` | (Indicator icon only) | Screen sharing / remote access |
| `_thunderbolt` | `ThunderboltStatus.Indicator` | (Indicator icon only) | Thunderbolt authorization |
| `_unsafeMode` | `UnsafeModeIndicator` | Unsafe Mode `QuickToggle` | Shell debugging / unsafe mode |
| `_backgroundApps` | `BackgroundAppsStatus.Indicator` | Background Apps `QuickToggle` | Flatpak/cgroup tracking |

> [!NOTE]
> In GNOME Shell's `panel.js`, `_setupIndicators()` is an `async` method that dynamically loads network and bluetooth status modules. Built-in indicators populate asynchronously during shell startup; always guard property accesses with optional chaining (e.g. `qs._doNotDisturb?.quickSettingsItems[0]`).

---

## Replacing a Built-in Toggle

The recommended pattern to replace a built-in toggle (for instance, replacing the standard Do Not Disturb toggle with a timed or enhanced version):

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { MyCustomDndToggle } from './myCustomDndToggle.js';

export default class ReplaceDndExtension {
    enable() {
        const qs = Main.panel.statusArea.quickSettings;
        const qsMenu = qs.menu;

        // 1. Locate the built-in toggle via direct property access, falling back to grid children
        this._originalToggle = qs._doNotDisturb?.quickSettingsItems?.[0] ?? null;

        if (!this._originalToggle) {
            for (const child of qsMenu._grid.get_children()) {
                if (child.constructor.name === 'DoNotDisturbToggle') {
                    this._originalToggle = child;
                    break;
                }
            }
        }

        // 2. Instantiate custom replacement
        this._replacementToggle = new MyCustomDndToggle(this);

        if (this._originalToggle) {
            // 3. Hide the original instead of destroying it
            this._originalToggle.hide();

            // 4. Add custom toggle to the grid
            qsMenu.addItem(this._replacementToggle);

            // 5. Place custom toggle at the original toggle's exact layout position.
            // In Clutter, set_child_below_sibling places the actor BEFORE the sibling
            // in layout order, occupying the hidden toggle's original grid slot.
            qsMenu._grid.set_child_below_sibling(
                this._replacementToggle,
                this._originalToggle
            );
        } else {
            qsMenu.addItem(this._replacementToggle);
        }
    }

    disable() {
        // Destroy replacement toggle and its flyout menu in _overlay
        if (this._replacementToggle) {
            if (this._replacementToggle.menu)
                this._replacementToggle.menu.destroy();
            this._replacementToggle.destroy();
            this._replacementToggle = null;
        }

        // Restore original built-in toggle
        if (this._originalToggle) {
            this._originalToggle.show();
            this._originalToggle = null;
        }
    }
}
```

---

## Hiding Built-in Toggles & Indicators

To completely hide a built-in toggle (for example, the Auto-Rotate lock toggle):

```javascript
function setHideAutoRotate(shouldHide) {
    const qs = Main.panel.statusArea.quickSettings;
    const autoRotateIndicator = qs._autoRotate;
    if (!autoRotateIndicator)
        return;

    const toggle = autoRotateIndicator.quickSettingsItems[0];

    if (shouldHide) {
        // Remove from top panel
        qs._indicators.remove_child(autoRotateIndicator);
        // Remove from drawer grid
        qs.menu._grid.remove_child(toggle);
    } else {
        // Restore to top panel
        qs._indicators.add_child(autoRotateIndicator);
        // Restore to grid before rfkill toggle
        const anchor = qs._rfkill?.quickSettingsItems[0];
        if (anchor) {
            qs._addItemsBefore(autoRotateIndicator.quickSettingsItems, anchor);
        } else {
            qs.menu.addItem(toggle);
        }
    }
}
```

---

## Reordering Quick Settings Indicators in the Top Panel

To place your indicator at a specific index in the top panel bar:

```javascript
function setIndicatorPosition(myIndicator, targetIndex) {
    const indicatorsBox = Main.panel.statusArea.quickSettings._indicators;

    // Remove from current position
    indicatorsBox.remove_child(myIndicator);

    // Clamp index to valid bounds
    const maxIndex = indicatorsBox.get_n_children();
    const clampedIndex = Math.max(0, Math.min(targetIndex, maxIndex));

    // Insert at desired index
    indicatorsBox.insert_child_at_index(myIndicator, clampedIndex);
}
```

---

## Reordering Grid Items

To reorder toggles or custom widgets inside the Quick Settings drawer grid:

```javascript
const grid = Main.panel.statusArea.quickSettings.menu._grid;

// In Clutter layout managers, children order determines grid slot order:
// Place actorA immediately AFTER actorB (higher index in children array)
grid.set_child_above_sibling(actorA, actorB);

// Place actorA immediately BEFORE actorB (lower index in children array)
grid.set_child_below_sibling(actorA, actorB);
```

---

## Dynamic Item Tracking with `child-added`

When extensions or the shell add items to the Quick Settings menu dynamically:

```javascript
export class QuickSettingsTracker {
    constructor() {
        this._grid = Main.panel.statusArea.quickSettings.menu._grid;
        this._connectionId = 0;
    }

    start(onChildAdded) {
        // Process existing items
        for (const child of this._grid.get_children()) {
            onChildAdded(child);
        }

        // Track future additions
        this._connectionId = this._grid.connect('child-added', (_container, child) => {
            onChildAdded(child);
        });
    }

    stop() {
        if (this._connectionId) {
            this._grid.disconnect(this._connectionId);
            this._connectionId = 0;
        }
    }
}
```
