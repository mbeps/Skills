# GNOME Shell UI Components (GNOME 45+)

GNOME Shell's graphical interface is built on **Clutter** (the 3D scenegraph rendering engine) and **St** (Shell Toolkit, providing CSS-styleable UI widgets).

> **CRITICAL RULE:** All UI code documented here runs exclusively inside the `gnome-shell` compositor process (`extension.js`). Never import or use GTK (`gi://Gtk`) or Libadwaita (`gi://Adw`) inside `extension.js`. GTK belongs strictly to `prefs.js`.

---

## 1. Core St (Shell Toolkit) Widgets

All St widgets inherit from `Clutter.Actor`, providing properties such as `reactive`, `can_focus`, `x_expand`, `y_expand`, `x_align`, `y_align`, and layout positioning.

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';

// 1. BoxLayout (Horizontal or Vertical Container)
const container = new St.BoxLayout({
    vertical: false,
    x_expand: true,
    y_align: Clutter.ActorAlign.CENTER,
    style_class: 'my-custom-container',
});

// 2. Icon (Themed or Symbolic)
const icon = new St.Icon({
    icon_name: 'dialog-information-symbolic',
    icon_size: 16,
    style_class: 'system-status-icon',
});
container.add_child(icon);

// 3. Label (Text Display)
const label = new St.Label({
    text: 'Extension Active',
    y_align: Clutter.ActorAlign.CENTER,
    style_class: 'my-status-label',
});
container.add_child(label);

// 4. Button (Interactive with Hover and Click Events)
const button = new St.Button({
    child: container,
    reactive: true,
    can_focus: true,
    track_hover: true,
    style_class: 'button my-action-button',
});

button.connect('clicked', () => {
    console.log('Button clicked!');
});

// 5. ScrollView (For Overflow Content)
const scrollView = new St.ScrollView({
    hscrollbar_policy: St.PolicyType.NEVER,
    vscrollbar_policy: St.PolicyType.AUTOMATIC,
    style_class: 'my-scroll-view',
});
scrollView.set_child(container);
```

---

## 2. Top Panel Buttons (`PanelMenu.Button`)

The standard approach for placing buttons and dropdown menus in the GNOME top bar.

```javascript
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

export const PanelIndicator = GObject.registerClass(
class PanelIndicator extends PanelMenu.Button {
    _init(extension) {
        // Parameters: menuAlignment (0.0 = left, 0.5 = center, 1.0 = right), nameText, dontCreateMenu (false)
        super._init(0.5, _('My Extension'), false);
        this._extension = extension;

        // Visual icon in the panel
        this._icon = new St.Icon({
            icon_name: 'starred-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._buildMenu();
    }

    _buildMenu() {
        // 1. Regular Clickable Menu Item
        const actionItem = new PopupMenu.PopupMenuItem(_('Trigger Action'));
        actionItem.connect('activate', () => {
            console.log('Action activated from menu');
        });
        this.menu.addMenuItem(actionItem);

        // 2. Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 3. Switch Menu Item (Toggle)
        const switchItem = new PopupMenu.PopupSwitchMenuItem(_('Enable Notifications'), true);
        switchItem.connect('toggled', (widget, state) => {
            console.log(`Toggle switched to: ${state}`);
        });
        this.menu.addMenuItem(switchItem);

        // 4. Submenu Item
        const subMenu = new PopupMenu.PopupSubMenuMenuItem(_('More Actions'));
        subMenu.menu.addAction(_('Sub Action 1'), () => console.log('Sub 1'));
        subMenu.menu.addAction(_('Preferences'), () => this._extension.openPreferences());
        this.menu.addMenuItem(subMenu);
    }
});
```

### Adding to and Removing from `Main.panel`:

```javascript
// In enable():
this._indicator = new PanelIndicator(this);
// Position parameters: role/uuid, actor, index (numeric order), box ('left' | 'center' | 'right')
Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');

// In disable():
if (this._indicator) {
    this._indicator.destroy(); // Automatically removes from statusArea
    this._indicator = null;
}
```

---

## 3. Quick Settings Integration (GNOME 45+)

Quick Settings provides a unified menu drawer in the top right. Extensions can add:
- `QuickSettings.QuickToggle`: A simple push/toggle button.
- `QuickSettings.QuickMenuToggle`: A toggle button with a drop-down arrow opening an inline sub-menu.
- `QuickSettings.QuickSlider`: An inline slider widget (e.g. volume/brightness).
- `QuickSettings.SystemIndicator`: Bridges top bar tray icons with drawer controls.

### QuickMenuToggle with Header and Actions:

```javascript
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const MyQuickMenuToggle = GObject.registerClass(
class MyQuickMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(extension) {
        super._init({
            title: _('Profiles'),
            subtitle: _('Select mode'),
            iconName: 'video-display-symbolic',
            toggleMode: true,
        });

        this._extension = extension;

        // Configure inline sub-menu header
        this.menu.setHeader('video-display-symbolic', _('Display Profiles'), _('Switch active layout'));

        // Add menu items
        this.menu.addAction(_('Standard Mode'), () => this._setMode('standard'));
        this.menu.addAction(_('Presentation Mode'), () => this._setMode('presentation'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_('Settings'), () => this._extension.openPreferences());
    }

    _setMode(mode) {
        console.log(`Switched to mode: ${mode}`);
        this.subtitle = mode;
    }
});

const MySystemIndicator = GObject.registerClass(
class MySystemIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();

        // Top bar icon
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'video-display-symbolic';
        this._indicator.visible = false;

        // Drawer item
        this.quickToggle = new MyQuickMenuToggle(extension);
        this.quickSettingsItems.push(this.quickToggle);

        // Synchronize top icon visibility with toggle state
        this.quickToggle.bind_property(
            'checked',
            this._indicator,
            'visible',
            GObject.BindingFlags.SYNC_CREATE
        );
    }
});
```

### Registering and Destroying Quick Settings:

```javascript
export default class QuickSettingsExtension extends Extension {
    enable() {
        this._indicator = new MySystemIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            // Destroy all inner drawer items
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
```

---

## 4. On-Screen Display (OSD) & Desktop Notifications

### On-Screen Display (OSD) Popups
When an extension toggles a state via keyboard shortcut, display a HUD confirmation using `Main.osdWindowManager`:

```javascript
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function showOsdMessage(iconName, message) {
    const icon = Gio.ThemedIcon.new(iconName);

    // Feature detection: GNOME 49+ uses showAll; earlier releases use show(-1, ...)
    if (typeof Main.osdWindowManager.showAll === 'function') {
        Main.osdWindowManager.showAll(icon, message, null, null);
    } else {
        Main.osdWindowManager.show(-1, icon, message, null, null);
    }
}
```

### Loading Bundled Custom SVG Icons:
For custom icons packaged in your extension's `icons/` folder:

```javascript
import Gio from 'gi://Gio';
import St from 'gi://St';

// 1. Using Gio.FileIcon with this.dir:
const iconFile = this.dir.get_child('icons').get_child('my-custom-symbolic.svg');
const gicon = new Gio.FileIcon({ file: iconFile });
const iconWidget = new St.Icon({
    gicon: gicon,
    style_class: 'system-status-icon',
});

// 2. Or using Gio.icon_new_for_string with this.path:
const fileGIcon = Gio.icon_new_for_string(`${this.path}/icons/my-custom-symbolic.svg`);
```

### In-Shell Desktop Notifications
Send desktop notification banners directly through GNOME Shell:

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Show a temporary system notification banner
Main.notify(_('Extension Title'), _('Task completed successfully!'));

// Show an error banner
Main.notifyError(_('Extension Error'), _('Could not connect to external service.'));
```

---

## 5. Event Handling on Clutter Actors

To handle pointer scroll, hover, or clicks on custom actors:

```javascript
import Clutter from 'gi://Clutter';

const actor = new St.Bin({
    reactive: true,
    track_hover: true,
    can_focus: true,
});

// Scroll event (e.g. mouse wheel or two-finger scroll)
actor.connect('scroll-event', (actor, event) => {
    const direction = event.get_scroll_direction();
    if (direction === Clutter.ScrollDirection.UP) {
        console.log('Scrolled UP');
    } else if (direction === Clutter.ScrollDirection.DOWN) {
        console.log('Scrolled DOWN');
    }
    return Clutter.EVENT_STOP;
});

// Hover state notification
actor.connect('notify::hover', () => {
    if (actor.hover) {
        console.log('Pointer entered actor');
    } else {
        console.log('Pointer left actor');
    }
});
```

---

## 6. Custom Styling (`stylesheet.css`)

Place `stylesheet.css` in your extension root directory. GNOME Shell automatically links it when the extension is enabled and unlinks it when disabled.

```css
/* Style custom top panel indicator */
.my-custom-container {
    spacing: 6px;
    padding: 0 4px;
}

.my-status-label {
    font-weight: bold;
    color: #f6f5f4;
}

/* Custom interactive button styling */
.my-action-button {
    border-radius: 8px;
    padding: 4px 8px;
    background-color: rgba(255, 255, 255, 0.08);
    transition-duration: 200ms;
}

.my-action-button:hover {
    background-color: rgba(255, 255, 255, 0.16);
}

.my-action-button:active {
    background-color: rgba(255, 255, 255, 0.24);
}
```
