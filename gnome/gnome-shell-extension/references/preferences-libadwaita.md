# Preferences UI with GTK4 & Libadwaita (GNOME 45+)

In GNOME 45+, extension preferences execute in a separate GTK4 process (`gnome-extensions-app` or `gnome-extensions prefs`). The preferences entry point (`prefs.js`) subclasses `ExtensionPreferences` and builds modern interfaces using **Libadwaita** (`gi://Adw`) and **GTK4** (`gi://Gtk`).

> **CRITICAL ARCHITECTURAL ISOLATION:** 
> - Inside `prefs.js`, you may import `gi://Gtk`, `gi://Adw`, `gi://Gdk`, `gi://Gio`, `gi://GLib`, and `gi://GObject`.
> - **NEVER** import `resource:///org/gnome/shell/ui/*` or `gi://St` inside `prefs.js`. The Shell compositor UI toolkit does not exist in the GTK application process.

---

## 1. Preferences Hierarchy

A modern GNOME settings window adheres to this hierarchy:

```text
Adw.PreferencesWindow (provided by GNOME via fillPreferencesWindow)
└── Adw.PreferencesPage (tabbed or scrollable page)
    └── Adw.PreferencesGroup (logical section with title & description)
        ├── Adw.SwitchRow (boolean toggle)
        ├── Adw.ComboRow (dropdown selection / enum)
        ├── Adw.SpinRow (numerical input)
        ├── Adw.EntryRow (text input)
        ├── Adw.ExpanderRow (collapsible group containing nested rows)
        └── Adw.ActionRow (action button, badge, or custom controls)
```

---

## 2. Programmatic Libadwaita Preferences (`prefs.js`)

```javascript
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Automatically resolves GSettings schema configured in metadata.json
        const settings = this.getSettings();

        // 1. Create a Preferences Page
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // 2. Create a Group
        const group = new Adw.PreferencesGroup({
            title: _('Indicator Configuration'),
            description: _('Manage how the status icon displays in the panel'),
        });
        page.add(group);

        // 3. SwitchRow (Boolean Setting)
        const switchRow = new Adw.SwitchRow({
            title: _('Show Status Icon'),
            subtitle: _('Display the extension icon in the top panel'),
        });
        settings.bind('show-indicator', switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(switchRow);

        // 4. SpinRow (Numerical Setting with Gtk.Adjustment)
        const spinRow = new Adw.SpinRow({
            title: _('Refresh Interval (Seconds)'),
            subtitle: _('Frequency of background status updates'),
            adjustment: new Gtk.Adjustment({
                value: settings.get_int('refresh-interval'),
                lower: 5,
                upper: 3600,
                step_increment: 5,
                page_increment: 30,
            }),
        });
        settings.bind('refresh-interval', spinRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(spinRow);

        // 5. ComboRow (Dropdown Selection)
        const stringList = Gtk.StringList.new([
            _('Right Panel'),
            _('Center Panel'),
            _('Left Panel'),
        ]);
        const comboRow = new Adw.ComboRow({
            title: _('Panel Position'),
            model: stringList,
        });
        settings.bind('position-index', comboRow, 'selected', Gio.SettingsBindFlags.DEFAULT);
        group.add(comboRow);

        // 6. EntryRow (Text Input)
        const entryRow = new Adw.EntryRow({
            title: _('Custom Label'),
            text: settings.get_string('custom-label'),
            show_apply_button: true,
        });
        entryRow.connect('apply', () => {
            settings.set_string('custom-label', entryRow.text);
        });
        group.add(entryRow);
    }
}
```

---

## 3. Declarative UI with `Gtk.Builder` (`.ui` Templates)

Extensions with rich or complex layouts often construct their preferences using GTK `.ui` XML templates (designed in Cambalache or hand-written).

### Step 1: The UI File (`ui/preferences.ui`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<interface>
  <requires lib="gtk" version="4.0"/>
  <requires lib="Adw" version="1"/>
  <object class="Adw.PreferencesPage" id="main_page">
    <property name="title" translatable="yes">Settings</property>
    <property name="icon-name">preferences-other-symbolic</property>
    <child>
      <object class="Adw.PreferencesGroup" id="main_group">
        <property name="title" translatable="yes">Options</property>
        <child>
          <object class="Adw.SwitchRow" id="switch_feature">
            <property name="title" translatable="yes">Enable Feature</property>
            <signal name="notify::active" handler="on_feature_toggled"/>
          </object>
        </child>
      </object>
    </child>
  </object>
</interface>
```

### Step 2: Implementing `Gtk.BuilderScope` for Signal Handlers in GTK4

In GTK4, when `.ui` files contain `<signal handler="..."/>`, you must attach a `Gtk.BuilderScope` implementing `vfunc_create_closure` to map handler names to JavaScript methods:

```javascript
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MyBuilderScope = GObject.registerClass(
    {
        Implements: [Gtk.BuilderScope],
    },
    class MyBuilderScope extends GObject.Object {
        _init(preferences) {
            super._init();
            this._prefs = preferences;
        }

        vfunc_create_closure(builder, handlerName, flags, connectObject) {
            if (typeof this._prefs[handlerName] !== 'function') {
                throw new Error(`Handler method "${handlerName}" not found on preferences object`);
            }
            return this._prefs[handlerName].bind(connectObject || this._prefs);
        }
    }
);

export default class TemplatedPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const builder = new Gtk.Builder();
        builder.set_scope(new MyBuilderScope(this));
        builder.set_translation_domain(this.metadata['gettext-domain']);

        // Load .ui template from extension directory
        const uiFile = `${this.path}/ui/preferences.ui`;
        builder.add_from_file(uiFile);

        // Retrieve widgets by their XML IDs
        const page = builder.get_object('main_page');
        const switchRow = builder.get_object('switch_feature');

        // Bind widget to GSettings
        settings.bind('feature-enabled', switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Add page to window
        window.add(page);
    }

    // Handler wired via XML <signal name="notify::active" handler="on_feature_toggled"/>
    on_feature_toggled(switchRow) {
        console.log(`Feature switched to: ${switchRow.active}`);
    }
}
```

---

## 4. Custom CSS, Icon Assets & Dark Mode Sync

### Dynamic Dark / Light CSS Loading:
In GTK4, reuse a single `Gtk.CssProvider` instance and reload stylesheet paths on dark mode transitions to avoid accumulating leaked providers on `Gdk.Display`:

```javascript
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';

export default class StyledPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const display = Gdk.Display.get_default();
        const styleManager = Adw.StyleManager.get_default();

        // Register custom icons directory for preferences UI
        const iconTheme = Gtk.IconTheme.get_for_display(display);
        iconTheme.add_search_path(`${this.path}/icons`);

        // Load custom CSS without provider accumulation
        const cssProvider = new Gtk.CssProvider();
        const updateTheme = () => {
            const fileName = styleManager.dark ? 'prefs-dark.css' : 'prefs.css';
            const file = this.dir.get_child(fileName);
            if (file.query_exists(null)) {
                cssProvider.load_from_path(file.get_path());
            }
        };

        updateTheme();
        Gtk.StyleContext.add_provider_for_display(
            display,
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        const darkSignalId = styleManager.connect('notify::dark', updateTheme);

        // Remove provider and disconnect listener when preferences window closes
        window.connect('close-request', () => {
            styleManager.disconnect(darkSignalId);
            Gtk.StyleContext.remove_provider_for_display(display, cssProvider);
        });
    }
}
```

---

## 5. Keyboard Shortcut Capture Rows (Modal Editor Pattern)

To configure global shortcuts accurately across X11 and Wayland (handling modifiers, Caps Lock, non-Latin keys, and keycodes), activate a modal editor dialog on row click:

```javascript
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import GObject from 'gi://GObject';

export function createShortcutRow(settings, keyName, title, parentWindow) {
    const actionRow = new Adw.ActionRow({
        title: title,
        subtitle: _('Click to set keyboard shortcut'),
        activatable: true,
    });

    const shortcutLabel = new Gtk.ShortcutLabel({
        disabled_text: _('Disabled'),
        valign: Gtk.Align.CENTER,
    });

    // Load initial shortcut from GSettings
    const currentShortcuts = settings.get_strv(keyName);
    shortcutLabel.accelerator = currentShortcuts[0] || '';
    actionRow.add_suffix(shortcutLabel);

    // Open modal recording dialog on row activation
    actionRow.connect('activated', () => {
        const controller = new Gtk.EventControllerKey();

        const statusPage = new Adw.StatusPage({
            title: _('New Accelerator…'),
            description: _('Press any key combination, Backspace to clear, or Escape to cancel'),
            icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
        });

        const dialog = new Adw.Window({
            modal: true,
            transient_for: parentWindow ?? actionRow.get_root(),
            width_request: 450,
            height_request: 300,
            content: statusPage,
        });

        dialog.add_controller(controller);

        controller.connect('key-pressed', (_controller, keyval, keycode, state) => {
            // Mask out non-modifier keys and ignore Caps Lock (LOCK_MASK)
            let mask = state & Gtk.accelerator_get_default_mod_mask();
            mask &= ~Gdk.ModifierType.LOCK_MASK;

            // 1. Cancel on Escape (without modifiers)
            if (!mask && keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }

            // 2. Clear on BackSpace (without modifiers)
            if (!mask && keyval === Gdk.KEY_BackSpace) {
                settings.set_strv(keyName, []);
                shortcutLabel.accelerator = '';
                dialog.close();
                return Gdk.EVENT_STOP;
            }

            // 3. Ignore lone modifier keys (Shift, Ctrl, Alt, Super)
            if (!Gtk.accelerator_valid(keyval, mask)) {
                return Gdk.EVENT_STOP;
            }

            // 4. Format accelerator with keycode for reliable Wayland mapping
            const accel = Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask);
            if (accel) {
                settings.set_strv(keyName, [accel]);
                shortcutLabel.accelerator = accel;
                dialog.close();
            }

            return Gdk.EVENT_STOP;
        });

        dialog.present();
    });

    return actionRow;
}
```
