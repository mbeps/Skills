# QuickMenuToggle and Submenus (GNOME 45+)

## Overview

A `QuickSettings.QuickMenuToggle` expands a standard toggle into an interactive menu drawer. It provides a expandable dropdown/flyout menu capable of displaying lists, preset actions, radio selections, or custom Clutter/St layouts.

In GNOME Shell's architecture, submenus do **not** expand inside the main popup box pointer; instead, they are hosted inside `Main.panel.statusArea.quickSettings.menu._overlay` and dynamically tethered to the toggle using Clutter constraints.

---

## `toggleMode`: Dual Action vs Single Action

`QuickMenuToggle` supports two distinct interaction models configured via the `toggleMode` boolean:

```text
┌──────────────────────────────────────────────────────────────────┐
│ toggleMode: true (Split Button)                                  │
│   [ Icon + Title ] (Toggles state) │ [ > ] (Opens Submenu)       │
├──────────────────────────────────────────────────────────────────┤
│ toggleMode: false (Action Button)                                │
│   [ Icon + Title                         > ] (Opens Submenu)     │
└──────────────────────────────────────────────────────────────────┘
```

1. **`toggleMode: true` (Split Button)**:
   - The button has two clickable targets: the left area toggles `checked` state; the right chevron arrow button opens the submenu.
   - Example: Wi-Fi toggle (clicking left toggles Wi-Fi on/off; clicking chevron opens network list).
   - Listen to: `notify::checked` for toggle state, or `clicked` for clicks on the main body.

2. **`toggleMode: false` (Menu-Only Button)**:
   - The entire button acts as an opener for the submenu (or a primary action that opens the menu if inactive).
   - Example: Bluetooth devices menu, Timer selection menu, Cast menu.
   - Set `menuEnabled: true` and handle the click event to open the menu.

---

## Anatomy of a QuickMenuToggle

```javascript
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const MyMenuToggle = GObject.registerClass(
class MyMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(extension) {
        super._init({
            title: 'Presets',
            iconName: 'preferences-system-symbolic',
            toggleMode: false, // Entire button opens menu
            menuEnabled: true,
        });

        this._ext = extension;

        // 1. When toggleMode: false, clicking the toggle body emits 'clicked'.
        // Hook 'clicked' so clicking anywhere on the button opens/closes the menu:
        this.connect('clicked', () => {
            if (this.menu.isOpen)
                this.menu.close();
            else
                this.menu.open();
        });

        // 2. Set the submenu header (icon, title, optional subtitle)
        this.menu.setHeader(
            'preferences-system-symbolic',
            'Preset Profiles',
            'Select an active profile'
        );

        // 3. Optional: Add a header suffix action widget (e.g., refresh button or icon)
        // const refreshBtn = new St.Button({ style_class: 'icon-button flat' });
        // this.menu.addHeaderSuffix(refreshBtn);

        // 4. Build menu items
        this._buildMenu();
    }

    _buildMenu() {
        // Section container for grouped items
        this._section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._section);

        this._items = new Map();
        const profiles = ['Balanced', 'Performance', 'Power Saver'];

        profiles.forEach(name => {
            const item = new PopupMenu.PopupMenuItem(name);
            item.connectObject('activate', () => {
                this._selectProfile(name);
            }, this);

            this._section.addMenuItem(item);
            this._items.set(name, item);
        });

        // Separator line
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Preferences action (guarded by lock screen session mode)
        const settingsItem = this.menu.addAction('Extension Settings', () => {
            this.menu.close();
            Main.panel.closeQuickSettings();
            this._ext.openPreferences();
        });
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[this._ext.uuid] = settingsItem;
    }

    _selectProfile(activeName) {
        // Update checkmarks (ornamentation)
        for (const [name, item] of this._items) {
            item.setOrnament(name === activeName
                ? PopupMenu.Ornament.CHECK
                : PopupMenu.Ornament.NONE
            );
        }

        // Update toggle label & subtitle in the drawer
        this.subtitle = activeName;
        this.checked = true;

        // Close submenu
        this.menu.close();
    }

    destroy() {
        this.disconnectObject(this);
        for (const item of this._items.values()) {
            item.disconnectObject(this);
        }
        this._items.clear();

        // 1. Unregister settings action from session mode tracking
        delete this.menu._settingsActions[this._ext.uuid];

        // 2. CRITICAL: Destroy the submenu container actor in menu._overlay!
        // QuickSettingsItem.destroy() only destroys the button in _grid.
        // It does NOT automatically destroy this.menu or its actor in _overlay.
        if (this.menu) {
            this.menu.destroy();
        }

        super.destroy();
    }
});
```

---

## Submenu Header and Suffix Widgets

`this.menu` (instance of `QuickToggleMenu`) provides built-in methods to structure the top header bar of the flyout menu:

```javascript
// 1. Set title, icon, and optional subtitle:
this.menu.setHeader(
    'audio-volume-high-symbolic', // string or Gio.Icon
    _('Sound Output'),            // Header title
    _('Select active speaker')    // Optional subtitle
);

// 2. Add custom action widgets into the header (next to title):
const refreshBtn = new St.Button({
    style_class: 'icon-button flat',
    child: new St.Icon({ icon_name: 'view-refresh-symbolic' }),
    can_focus: true,
});
refreshBtn.connect('clicked', () => this._refreshDevices());
this.menu.addHeaderSuffix(refreshBtn);

// 3. Quick shortcut to add standard GNOME Control Center settings panel:
// Automatically closes Quick Settings, opens gnome-control-center panel,
// and manages lock-screen session mode visibility:
this.menu.addSettingsAction(_('Sound Settings'), 'gnome-sound-panel.desktop');
```

---

## Submenu Item Types

Submenus in `QuickMenuToggle` use standard `PopupMenu` items:

| Class | Purpose | Typical Use Case |
|---|---|---|
| `PopupMenu.PopupMenuItem` | Standard text menu row | Option selection, commands |
| `PopupMenu.PopupImageMenuItem` | Menu row with icon + label | Actions with associated symbolic icons |
| `PopupMenu.PopupSeparatorMenuItem` | Subtle dividing line | Separating groups or actions from settings |
| `PopupMenu.PopupMenuSection` | Invisible grouping container | Dynamic item lists that get rebuilt/cleared |
| `PopupMenu.PopupSwitchMenuItem` | Menu item with built-in toggle switch | Secondary feature toggles inside submenu |
| `PopupMenu.PopupBaseMenuItem` | Low-level base row | Custom complex widget layouts (grids, sliders, entries) |

### Setting Checkmarks and Radios (`setOrnament`)

`PopupMenu.Ornament` provides standard markings:

```javascript
item.setOrnament(PopupMenu.Ornament.NONE);  // No icon
item.setOrnament(PopupMenu.Ornament.CHECK); // Checkmark (radio or checkbox)
item.setOrnament(PopupMenu.Ornament.DOT);   // Circular dot
item.setOrnament(PopupMenu.Ornament.HIDDEN);// Invisible spacer (maintains alignment)
```

---

## Complex Layouts inside Submenus

You can insert arbitrary Clutter and St widgets into a submenu using `PopupBaseMenuItem({ reactive: false })`:

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

function buildCustomGrid(menu, onSelect) {
    const customContainerItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });

    const box = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style: 'padding: 8px 12px;',
    });

    const buttonRow = new St.BoxLayout({
        vertical: false,
        x_expand: true,
    });

    const durations = [15, 30, 60];
    for (const mins of durations) {
        const btn = new St.Button({
            label: `${mins}m`,
            style_class: 'button',
            x_expand: true,
            can_focus: true,
        });

        btn.connect('clicked', () => {
            onSelect(mins);
            menu.close();
        });

        buttonRow.add_child(btn);
    }

    box.add_child(buttonRow);
    customContainerItem.add_child(box);
    menu.addMenuItem(customContainerItem);
}
```

---

## Session Mode Awareness: Lock Screen Safety

Quick Settings is visible on both the unlocked desktop and the lock/login screen (`unlock-dialog` session mode).

When adding an action that opens an external window (such as preferences or a terminal):
1. Verify `Main.sessionMode.allowSettings` is `true`.
2. Register the action with `this.menu._settingsActions[uuid] = settingsItem;` so the shell can automatically disable it when the screen locks.

```javascript
const settingsAction = this.menu.addAction('Preferences', () => {
    this.menu.close();
    Main.panel.closeQuickSettings();
    extension.openPreferences();
});

// Guard visibility against lock screen
settingsAction.visible = Main.sessionMode.allowSettings;
this.menu._settingsActions[extension.uuid] = settingsAction;
```

---

## Programmatic Menu Control

```javascript
// Open this toggle's submenu
this.menu.open();

// Close this toggle's submenu
this.menu.close();

// Close the entire Quick Settings panel drawer
Main.panel.closeQuickSettings();

// Toggle submenu open/closed on click
this.connect('clicked', () => {
    if (this.menu.isOpen) {
        this.menu.close();
    } else {
        this.menu.open();
    }
});
```

---

## Dynamic Menu Content Updates

When refreshing a dynamic list (e.g. available networks, active devices, or timers):
1. Put dynamic items inside a `PopupMenu.PopupMenuSection`.
2. Call `this._section.removeAll()` before rebuilding.
3. Disconnect any item signal handlers prior to clearing.

```javascript
_refreshDevices(deviceList) {
    // 1. Remove previous items
    this._section.removeAll();
    this._deviceItemMap.clear();

    // 2. Populate fresh items
    for (const dev of deviceList) {
        const item = new PopupMenu.PopupImageMenuItem(
            dev.name,
            dev.iconName || 'audio-card-symbolic'
        );
        item.connectObject('activate', () => this._onDeviceSelected(dev), this);
        this._section.addMenuItem(item);
        this._deviceItemMap.set(dev.id, item);
    }
}
```
