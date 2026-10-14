# GSettings & Schema Architecture (GNOME 45+)

GSettings is the unified, transactional configuration store across GNOME. Extensions define their configuration keys using an XML schema file, compile it into a binary `gschemas.compiled` file using `glib-compile-schemas`, and access values dynamically via `Gio.Settings`.

---

## 1. Schema File Specification

Create schema files in the `schemas/` directory following the naming pattern:
`schemas/<schema-id>.gschema.xml`

### Complete Schema with Enums, Arrays, and Shortcuts:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist gettext-domain="my-extension">

  <!-- Define Enums before the schema -->
  <enum id="org.gnome.shell.extensions.my-extension.IndicatorPosition">
    <value nick="left" value="0"/>
    <value nick="center" value="1"/>
    <value nick="right" value="2"/>
  </enum>

  <schema id="org.gnome.shell.extensions.my-extension" path="/org/gnome/shell/extensions/my-extension/">

    <!-- Boolean Key -->
    <key name="show-indicator" type="b">
      <default>true</default>
      <summary>Show Indicator</summary>
      <description>Whether to show the top panel indicator icon.</description>
    </key>

    <!-- Integer Key -->
    <key name="refresh-interval" type="i">
      <default>60</default>
      <summary>Refresh Interval</summary>
      <description>Interval in seconds between refreshes.</description>
    </key>

    <!-- Double (Float) Key -->
    <key name="opacity" type="d">
      <default>0.85</default>
      <summary>Window Opacity</summary>
      <description>Opacity level between 0.0 and 1.0.</description>
    </key>

    <!-- String Key -->
    <key name="custom-label" type="s">
      <default>'Default Label'</default>
      <summary>Indicator Label</summary>
      <description>Custom text to display in panel.</description>
    </key>

    <!-- Enum Key (References enum defined above) -->
    <key name="position" enum="org.gnome.shell.extensions.my-extension.IndicatorPosition">
      <default>'right'</default>
      <summary>Indicator Position</summary>
      <description>Where the indicator appears in the top bar.</description>
    </key>

    <!-- String Array Key -->
    <key name="whitelist-apps" type="as">
      <default>['org.gnome.Nautilus', 'org.gnome.Terminal']</default>
      <summary>Whitelisted Applications</summary>
      <description>List of application desktop IDs.</description>
    </key>

    <!-- Keyboard Shortcut Keybinding -->
    <key name="shortcut-toggle" type="as">
      <default>['&lt;Super&gt;&lt;Alt&gt;t']</default>
      <summary>Toggle Shortcut</summary>
      <description>Keyboard shortcut to trigger extension toggle.</description>
    </key>

    <!-- Dictionary Key (String to String Map) -->
    <key name="custom-mappings" type="a{ss}">
      <default>{}</default>
      <summary>Custom Key-Value Mappings</summary>
      <description>User-defined mapping table.</description>
    </key>

  </schema>
</schemalist>
```

---

## 2. GVariant Types Quick Reference

| GVariant Code | Type Name | XML Default Example | GJS Getter / Setter |
|---------------|-----------|---------------------|---------------------|
| `b` | Boolean | `<default>true</default>` | `get_boolean()` / `set_boolean()` |
| `i` | 32-bit signed int | `<default>10</default>` | `get_int()` / `set_int()` |
| `u` | 32-bit unsigned int | `<default>10</default>` | `get_uint()` / `set_uint()` |
| `d` | Double float | `<default>1.5</default>` | `get_double()` / `set_double()` |
| `s` | String | `<default>'text'</default>` | `get_string()` / `set_string()` |
| `<enum>` | Enumeration | `<default>'nick'</default>` | `get_enum()` / `set_enum()` |
| `as` | String Array | `<default>['a', 'b']</default>` | `get_strv()` / `set_strv()` |
| `a{ss}` | Dict (string:string) | `<default>{}</default>` | `get_value().deepUnpack()` / `set_value()` |
| `a{sv}` | Dict (string:variant)| `<default>{}</default>` | `get_value().deepUnpack()` / `set_value()` |

---

## 3. Compiling Schemas

Before GNOME Shell can parse new or updated schema keys, compile the XML into `gschemas.compiled`:

```bash
# Compile with strict validation
glib-compile-schemas --strict schemas/
```

Always link the schema ID in `metadata.json`:

```json
{
  "uuid": "my-extension@example.com",
  "settings-schema": "org.gnome.shell.extensions.my-extension"
}
```

---

## 4. Reading and Writing Values in GJS

Inside an `Extension` or `ExtensionPreferences` instance, obtain the settings instance using `this.getSettings()`:

```javascript
export default class MyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // 1. Primitives
        const enabled = this._settings.get_boolean('show-indicator');
        const interval = this._settings.get_int('refresh-interval');
        const label = this._settings.get_string('custom-label');

        // 2. Enums
        // Read numeric value:
        const posValue = this._settings.get_enum('position'); // e.g. 2
        // Read string nickname:
        const posNick = this._settings.get_string('position'); // e.g. 'right'
        // Write enum:
        this._settings.set_enum('position', 1);

        // 3. String Arrays
        const apps = this._settings.get_strv('whitelist-apps');
        this._settings.set_strv('whitelist-apps', [...apps, 'org.gnome.Calculator']);

        // 4. Complex GVariant Dictionaries
        // deepUnpack() converts GVariant tuples/dicts directly to native JS Objects
        const mappings = this._settings.get_value('custom-mappings').deepUnpack();
        console.log(`Mapping keys: ${Object.keys(mappings)}`);

        // Write GVariant string dict ('a{ss}'):
        const newDict = new GLib.Variant('a{ss}', {
            theme: 'nord',
            layout: 'grid',
        });
        this._settings.set_value('custom-mappings', newDict);

        // Write GVariant generic variant dict ('a{sv}'):
        const variantDict = new GLib.Variant('a{sv}', {
            enabled: new GLib.Variant('b', true),
            count: new GLib.Variant('i', 42),
            title: new GLib.Variant('s', 'Custom Title'),
        });
        // this._settings.set_value('my-variant-dict', variantDict);
    }
}
```

---

## 5. Listening to Changes (`changed::key`)

Always connect to settings using `connectObject` with `this` to ensure automatic disconnection:

```javascript
// Listen to a single specific key
this._settings.connectObject(
    'changed::show-indicator', () => this._updateVisibility(),
    'changed::refresh-interval', () => this._restartTimer(),
    this
);

// Listen to any key changed in schema
this._settings.connectObject(
    'changed', (settings, key) => {
        console.log(`Setting changed: ${key}`);
    },
    this
);
```

---

## 6. Global Keybindings via GSettings

GNOME Shell manages window manager global shortcuts via `Main.wm.addKeybinding`:

```javascript
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class ShortcutExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Register shortcut
        Main.wm.addKeybinding(
            'shortcut-toggle', // Key name in gschema
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, // Active in normal and overview modes
            () => {
                console.log('Shortcut triggered!');
                this._toggleAction();
            }
        );
    }

    disable() {
        // Unregister shortcut
        Main.wm.removeKeybinding('shortcut-toggle');
        this._settings = null;
    }
}
```

### Shell Action Modes:
- `Shell.ActionMode.NORMAL`: Standard desktop window mode.
- `Shell.ActionMode.OVERVIEW`: When Activities Overview is active.
- `Shell.ActionMode.LOCK_SCREEN`: Lock screen state.
- `Shell.ActionMode.ALL`: Everywhere.
