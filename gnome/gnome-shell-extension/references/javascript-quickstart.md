# JavaScript (ESM) Extension Quickstart (GNOME 45+)

Modern GNOME Shell extensions (GNOME 45+) run standard ECMAScript Modules (ESM) executed by GJS. This guide details how to build extensions in vanilla JavaScript without any build tool or transpiler.

---

## 1. Project Directory Structure

```text
my-extension@example.com/
├── metadata.json
├── extension.js
├── prefs.js
├── stylesheet.css
├── icons/
│   └── custom-symbolic.svg
├── locale/
│   └── de/LC_MESSAGES/my-extension.mo
└── schemas/
    ├── org.gnome.shell.extensions.my-extension.gschema.xml
    └── gschemas.compiled
```

- `metadata.json`: Defines UUID, name, compatible GNOME Shell versions, and schema IDs.
- `extension.js`: Entry point loaded inside the `gnome-shell` compositor process.
- `prefs.js`: Preferences UI loaded inside the independent `gnome-extensions-app` (GTK4/Libadwaita) process.
- `stylesheet.css`: Custom CSS styling for top panel or shell actors.
- `schemas/`: GSettings XML schema and compiled binary.

---

## 2. Extension Metadata (`metadata.json`)

`metadata.json` must specify GNOME 45 or higher:

```json
{
  "uuid": "my-extension@example.com",
  "name": "My Modern Extension",
  "description": "A modern GNOME Shell 45+ extension in Vanilla JavaScript",
  "shell-version": [
    "45",
    "46",
    "47",
    "48",
    "49",
    "50"
  ],
  "url": "https://github.com/example/my-extension",
  "settings-schema": "org.gnome.shell.extensions.my-extension",
  "gettext-domain": "my-extension",
  "version": 1,
  "version-name": "1.0.0",
  "session-modes": ["user"],
  "donations": {
    "github": "username",
    "kofi": "username"
  }
}
```

> **Optional Metadata Keys:**
> - `session-modes`: Array of supported desktop states (e.g. `["user"]` for normal desktop, or `["user", "unlock-dialog"]` if active on the lock screen).
> - `version-name`: Human-readable semver string displayed in extension managers.
> - `donations`: Links for sponsorship (`github`, `kofi`, `buymeacoffee`, `patreon`).

---

## 3. Compositor Entry Point (`extension.js`)

In GNOME 45+, `extension.js` must default-export a class that extends `Extension` imported from `resource:///org/gnome/shell/extensions/extension.js`.

### Top Panel Indicator Example:

```javascript
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Custom Panel Menu Indicator
 */
const MyIndicator = GObject.registerClass(
class MyIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, _('My Indicator'), false);
        this._extension = extension;

        // Add iconic label in top panel
        const icon = new St.Icon({
            icon_name: 'starred-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(icon);

        this._buildMenu();
    }

    _buildMenu() {
        // Menu action button
        const item = new PopupMenu.PopupMenuItem(_('Preferences'));
        item.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Toggle switch
        const toggleItem = new PopupMenu.PopupSwitchMenuItem(_('Active State'), false);
        toggleItem.connect('toggled', (widget, state) => {
            console.log(`Toggle switched to: ${state}`);
        });
        this.menu.addMenuItem(toggleItem);
    }
});

/**
 * Main Extension Lifecycle Class
 *
 * CRITICAL RULE: Never construct UI actors, access Main.panel, or connect
 * signals in the constructor! The constructor runs at GNOME startup even when
 * the extension is disabled. All setup belongs strictly in enable().
 */
export default class MyExtension extends Extension {
    enable() {
        // Initialize gettext translations
        this.initTranslations();

        // Retrieve settings
        this._settings = this.getSettings();

        // Instantiate and add indicator to status area
        this._indicator = new MyIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');

        // Connect to settings change events using connectObject for auto-cleanup
        this._settings.connectObject(
            'changed::some-key',
            () => this._onSettingChanged(),
            this
        );

        console.log(`[${this.metadata.name}] Enabled`);
    }

    disable() {
        // Disconnect settings signals
        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }

        // Destroy UI actor (automatically unregisters from Main.panel)
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        console.log(`[${this.metadata.name}] Disabled`);
    }

    _onSettingChanged() {
        console.log('Setting changed!');
    }
}
```

---

## 4. Quick Settings Toggle Example (`extension.js`)

Add controls to the top-right Quick Settings menu drawer using `QuickToggle` and `SystemIndicator`:

```javascript
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const MyQuickToggle = GObject.registerClass(
class MyQuickToggle extends QuickSettings.QuickToggle {
    _init(extension) {
        super._init({
            title: _('My Toggle'),
            subtitle: _('Click to switch'),
            iconName: 'weather-clear-night-symbolic',
            toggleMode: true,
        });

        this._extension = extension;
    }
});

const MyQuickSettingsIndicator = GObject.registerClass(
class MyQuickSettingsIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();
        this._extension = extension;

        // Top bar tray icon
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'weather-clear-night-symbolic';
        this._indicator.visible = false;

        // Drawer toggle
        this.quickToggle = new MyQuickToggle(extension);
        this.quickSettingsItems.push(this.quickToggle);

        // Bind checked state to top bar icon visibility
        this.quickToggle.bind_property(
            'checked',
            this._indicator,
            'visible',
            GObject.BindingFlags.SYNC_CREATE
        );

        this.quickToggle.connect('clicked', () => {
            console.log(`Toggle clicked, state: ${this.quickToggle.checked}`);
        });
    }
});

export default class QuickSettingsExtension extends Extension {
    enable() {
        this.initTranslations();
        this._indicator = new MyQuickSettingsIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
```

---

## 5. Preferences Entry Point (`prefs.js`)

In GNOME 45+, `prefs.js` subclasses `ExtensionPreferences` and builds UI in `fillPreferencesWindow(window)` using Libadwaita (`gi://Adw`):

```javascript
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.initTranslations();
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-other-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Behavior'),
        });
        page.add(group);

        const switchRow = new Adw.SwitchRow({
            title: _('Show Status Icon'),
            subtitle: _('Display the extension icon in the top panel'),
        });
        settings.bind('show-indicator', switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(switchRow);
    }
}
```

---

## 6. Built-in Properties & Methods on `this`

Both `Extension` (in `extension.js`) and `ExtensionPreferences` (in `prefs.js`) provide:

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `this.metadata` | `object` | Parsed contents of `metadata.json` |
| `this.uuid` | `string` | Extension UUID |
| `this.dir` | `Gio.File` | Extension directory as a `Gio.File` object |
| `this.path` | `string` | Absolute filesystem path of the extension directory |
| `this.getSettings(schemaId?)` | `Gio.Settings` | Gets the `Gio.Settings` instance for the extension |
| `this.initTranslations(domain?)` | `void` | Initializes gettext internationalization |
| `this.gettext(str)` / `_` | `string` | Translates a string within the extension domain |
| `this.openPreferences()` | `void` | Opens the extension's preferences window (`extension.js` only) |
