---
name: gnome-shell-extension
description: Use when creating, developing, porting, debugging, or packaging GNOME Shell extensions (GNOME 45+) in JavaScript or TypeScript, including top bar indicators, Quick Settings toggles, Libadwaita preferences, GSettings schemas, window management, search providers, or when encountering errors like missing ESM imports, schema not installed, or desktop freezes.
---

# GNOME Shell Extension Development (GNOME 45+)

## Overview

Starting with GNOME 45, GNOME Shell migrated entirely to standard ECMAScript Modules (ESM) and class-based extension architecture. Legacy systems (`imports.gi`, `imports.ui`, `ExtensionUtils`, global `init()`, and standalone `enable()`/`disable()` functions) are strictly obsolete.

Extensions can be authored in **Vanilla JavaScript (ESM)** (zero build step) or **TypeScript** (compiled via `esbuild` with `@girs` types). Extensions run across two strictly isolated process contexts: the **Shell Compositor Process** (`extension.js`) and the **Preferences Process** (`prefs.js`).

**Core principle:** Maintain absolute symmetry between `enable()` and `disable()`. Never block the main Shell thread, strictly isolate GTK from Clutter/St, and manage all signal lifetimes using `connectObject` and `disconnectObject`.

---

## When to Use

- Developing a new extension for GNOME Shell 45 through 50+ in JavaScript or TypeScript.
- Porting legacy pre-45 extensions to the modern ESM class architecture.
- Adding top panel status buttons (`PanelMenu.Button`) or dropdown menus.
- Adding toggles, sliders, or sub-menus to the Quick Settings menu drawer (`QuickToggle`, `QuickMenuToggle`, `SystemIndicator`).
- Designing GTK4 and Libadwaita (`Adw-1`) preference windows with GSettings synchronization or `.ui` templates.
- Interacting with Mutter windows, monitors, and workspaces (`Meta`, `Mtk.Rectangle`, `Shell.WindowTracker`).
- Integrating with the Overview search bar as a custom Search Provider.
- Monkey-patching GNOME Shell internal methods cleanly using `InjectionManager`.
- Executing non-blocking CLI processes, promisifying Gio methods (`Gio._promisify`), or exporting DBus services.

## When NOT to Use

- Pre-GNOME 45 environments (GNOME 40–44 legacy import syntax).
- Standalone GTK desktop applications (use standard GJS or Python GTK apps).
- Running synchronous operations or blocking commands on the main desktop thread.

---

## Modern Import Conventions (GNOME 45+)

GNOME 45+ mandates standard ESM imports with URI schemes.

```javascript
// GObject Introspection libraries
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';

// Versioned GI libraries (specify version via query parameter)
import Soup from 'gi://Soup?version=3.0';

// GNOME Shell internal resources (compositor process only)
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { Extension, InjectionManager, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// Preferences resources (prefs.js only)
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
```

### 🚫 Strictly Forbidden Legacy Patterns:
- `const { Gio, GLib } = imports.gi;` ❌
- `const Main = imports.ui.main;` ❌
- `const Me = imports.misc.extensionUtils.getCurrentExtension();` ❌
- `function init() {}` ❌
- `function enable() {}` / `function disable() {}` outside of `Extension` class ❌
- `getPreferencesWidget()` ❌
- `Meta.Rectangle` (use `Mtk.Rectangle`) ❌

---

## Architecture: Shell vs. Preferences Isolation

GNOME Shell extensions operate across two distinct, non-communicating processes:

```text
┌────────────────────────────────────────────────────────┐
│  gnome-shell Process (Compositor & Window Manager)    │
│  Entry Point: extension.js                            │
│  UI Framework: Clutter + St (Shell Toolkit)            │
│  Allowed: gi://St, gi://Clutter, gi://Meta, gi://Mtk   │
│  FORBIDDEN: gi://Gtk, gi://Adw                         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  gnome-extensions-app Process (GTK4 Application)       │
│  Entry Point: prefs.js                                │
│  UI Framework: GTK4 + Libadwaita (Adw)                │
│  Allowed: gi://Gtk, gi://Adw, gi://Gdk                 │
│  FORBIDDEN: gi://St, gi://Clutter, resource:///org/... │
└────────────────────────────────────────────────────────┘
```

Communication between the two processes occurs exclusively via **GSettings** (`Gio.Settings`) or **DBus**.

---

## Language Selection: JavaScript vs. TypeScript

| Feature | Vanilla JavaScript (ESM) | TypeScript (with `@girs` & `esbuild`) |
|---------|--------------------------|---------------------------------------|
| **Build Step** | Zero build step; edit files directly | Fast build with `node build.js` / `--watch` |
| **Type Safety** | Runtime only (optional JSDoc) | Full compile-time static type checking |
| **API Autocomplete** | Basic IDE inference | Complete autocomplete across GObject, Mutter & Shell |
| **Best Suited For** | Small extensions (<500 lines), rapid tweaks | Multi-file extensions, complex state, window managers |
| **Detailed Guide** | [javascript-quickstart.md](references/javascript-quickstart.md) | [typescript-setup.md](references/typescript-setup.md) |

---

## Minimal Extension Anatomy

### 1. `metadata.json`

```json
{
  "uuid": "my-extension@example.com",
  "name": "My Modern Extension",
  "description": "Modern GNOME 45+ Extension",
  "shell-version": ["45", "46", "47", "48", "49", "50"],
  "settings-schema": "org.gnome.shell.extensions.my-extension",
  "gettext-domain": "my-extension",
  "url": "https://example.com",
  "version": 1
}
```

### 2. `extension.js` (Compositor Lifecycle)

```javascript
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class MyExtension extends Extension {
    enable() {
        this.initTranslations();
        this._settings = this.getSettings();
        // Setup UI actors and connect signals with 'this' as lifetime owner
    }

    disable() {
        // Disconnect all signals, destroy UI actors, nullify references
        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }
    }
}
```

### 3. `prefs.js` (Preferences UI)

```javascript
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.initTranslations();
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'Settings' });
        const row = new Adw.SwitchRow({ title: 'Enable Feature' });
        settings.bind('feature-enabled', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        page.add(group);
        window.add(page);
    }
}
```

---

## Specialized Reference Manuals

Targeted, deep reference guides covering every subsystem of modern GNOME extension authoring:

- **[JavaScript Quickstart](references/javascript-quickstart.md)**: Full vanilla ESM structure, top panel menus, quick settings indicators, metadata specifications, and built-in instance properties.
- **[TypeScript Setup & Tooling](references/typescript-setup.md)**: `tsconfig.json`, `ambient.d.ts`, verified `@girs` types (including Mutter and Mtk), `esbuild` build script with schema/locale/gresource compilation, and typed GObject subclassing.
- **[GNOME Shell UI Components](references/ui-components.md)**: St widgets (`St.BoxLayout`, `St.Label`, `St.Button`), Clutter layout, `PanelMenu.Button`, `QuickToggle`, `QuickMenuToggle`, `SystemIndicator`, OSD popups (`Main.osdWindowManager`), in-shell notifications, and `stylesheet.css`.
- **[Preferences with Libadwaita](references/preferences-libadwaita.md)**: `Adw.PreferencesWindow`, `Adw.ActionRow`, `Adw.SwitchRow`, `Adw.ComboRow`, `Adw.SpinRow`, `Adw.EntryRow`, multi-page layouts, `Gtk.Builder` `.ui` template loading with `Gtk.BuilderScope`, dark mode sync (`Adw.StyleManager`), and custom CSS.
- **[Window & Workspace Management](references/window-and-workspace-management.md)**: Mutter window tracking (`Meta.Window`, `Meta.WindowActor`), GNOME 45 geometry migration (`Mtk.Rectangle`), `Shell.WindowTracker`, monitor metrics and scaling, and window/workspace lifecycle signals.
- **[Overview Search Providers](references/search-providers.md)**: Implementing search providers in the Activities Overview, `getInitialResultSet`, `getSubsearchResultSet`, `getResultMetas`, `filterResults`, `activateResult`, and registration with `Main.overview.searchController`.
- **[GSettings & Schemas](references/gsettings-and-schemas.md)**: Schema XML definitions, GVariant types (`b`, `i`, `s`, `as`, `a{ss}`), schema enums (`<enum id="...">`), `glib-compile-schemas --strict`, typed getters/setters, change listeners, and global keybindings.
- **[Signals, Lifecycle & Memory Safety](references/signals-and-lifecycle.md)**: Avoiding memory leaks, symmetry rules, multi-signal `connectObject`/`disconnectObject`, GLib timers (`GLib.timeout_add`), session modes (`Main.sessionMode`), desktop shutdown hooks, and clean monkeypatching with `InjectionManager`.
- **[DBus, Subprocesses & GResources](references/dbus-and-system-integration.md)**: Asynchronous subprocesses with `Gio._promisify`, MPRIS DBus proxies, exporting custom DBus services (`Gio.DBusExportedObject.wrapJSObject`), and bundling assets into `.gresource` containers.
- **[Tooling, Debugging, Linting & EGO Review](references/tooling-and-debugging.md)**: `gnome-extensions` CLI commands (`create`, `pack`, `enable`, `prefs`), Looking Glass (`lg`), nested Wayland sessions (`--nested --wayland` and `--devkit`), journalctl log streaming, static linting with `shexli`, and official extensions.gnome.org (EGO) submission guidelines.

---

## Quick Reference: Common APIs & Patterns

| Goal | Modern API / Approach | Reference Guide |
|------|-----------------------|-----------------|
| Add top panel button | Subclass `PanelMenu.Button`, call `Main.panel.addToStatusArea()` | [ui-components.md](references/ui-components.md) |
| Add Quick Settings toggle | Subclass `QuickSettings.QuickToggle` & `SystemIndicator` | [ui-components.md](references/ui-components.md) |
| Add Quick Settings submenu | Subclass `QuickSettings.QuickMenuToggle`, use `this.menu.addAction()` | [ui-components.md](references/ui-components.md) |
| Show OSD popup | `Main.osdWindowManager.showAll ? showAll(icon, msg) : show(-1, icon, msg)` | [ui-components.md](references/ui-components.md) |
| Overview search provider | Subclass search provider, call `Main.overview.searchController.addProvider()` | [search-providers.md](references/search-providers.md) |
| Track windows & monitors | Query `global.display.get_tab_list()`, use `Mtk.Rectangle` | [window-and-workspace-management.md](references/window-and-workspace-management.md) |
| Monkeypatch Shell method | Use `new InjectionManager()` & `overrideMethod()` | [signals-and-lifecycle.md](references/signals-and-lifecycle.md) |
| Connect signal without leaks | `target.connectObject('sig', callback, this)` | [signals-and-lifecycle.md](references/signals-and-lifecycle.md) |
| Bind setting to UI toggle | `settings.bind('key', switchRow, 'active', Gio.SettingsBindFlags.DEFAULT)` | [preferences-libadwaita.md](references/preferences-libadwaita.md) |
| Load GTK `.ui` template in prefs | `new Gtk.Builder()` with `new Gtk.BuilderScope()` for signal closures | [preferences-libadwaita.md](references/preferences-libadwaita.md) |
| Async non-blocking command | `Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async')` | [dbus-and-system-integration.md](references/dbus-and-system-integration.md) |
| Bundle & register assets | `glib-compile-resources` + `Gio.resources_register(resource)` | [dbus-and-system-integration.md](references/dbus-and-system-integration.md) |
| Periodic timer | `id = GLib.timeout_add(...)`; remove with `GLib.source_remove(id)` | [signals-and-lifecycle.md](references/signals-and-lifecycle.md) |
| In-shell inspection | Press `Alt + F2`, type `lg`, open Evaluator & Picker | [tooling-and-debugging.md](references/tooling-and-debugging.md) |
| Automated review check | Run `shexli dist/` or `shexli <bundle.zip>` | [tooling-and-debugging.md](references/tooling-and-debugging.md) |
| Package extension | `gnome-extensions pack <dir> --force` | [tooling-and-debugging.md](references/tooling-and-debugging.md) |

---

## Common Pitfalls & Solutions

| Symptom / Error | Root Cause | Solution |
|-----------------|------------|----------|
| `ImportError: Unable to load file from: resource:///...` | Using legacy `imports.ui` or `imports.gi` syntax | Convert all imports to modern ESM (`import St from 'gi://St'`) |
| `TypeError: Gtk is not defined` inside `extension.js` | Importing GTK into the compositor process | Move GTK and Libadwaita code into `prefs.js`; use `St` in `extension.js` |
| `TypeError: Meta.Rectangle is not a constructor` | Calling `Meta.Rectangle` in GNOME 45+ | Import `Mtk from 'gi://Mtk'` and use `Mtk.Rectangle` |
| Entire desktop freezes when extension executes | Using synchronous I/O or `GLib.spawn_command_line_sync` | Use `Gio._promisify` with `Gio.Subprocess` or `Gio.File.load_contents_async` |
| `TypeError: GLib.Variant.new_dict is not a function` | Attempting C-style dict constructor in GJS | Use `new GLib.Variant('a{ss}', { key: 'value' })` constructor |
| Signal handlers from `.ui` files fail to resolve in GTK4 | GTK4 requires closure resolution scope | Attach `Gtk.BuilderScope` with `vfunc_create_closure` to `Gtk.Builder` |
| Memory leaks or errors after toggling extension | Lingering signal handlers, GLib timers, or undeleted actors | Disconnect all signals via `disconnectObject`, call `GLib.source_remove`, and destroy actors in `disable()` |
| Extension preferences crash with `schema ... is not installed` | Schema XML was not compiled | Run `glib-compile-schemas --strict schemas/` to produce `gschemas.compiled` |
| Extension rejected on extensions.gnome.org | Bundling minified/obfuscated code or missing lifecycle symmetry | Ensure `buildOptions.minify = false`, remove `eval()`, and test with `shexli <bundle.zip>` |
| `npm error notarget No matching version found for @girs/...` | Non-existent package version in `package.json` | Use verified `@girs` generator versions (`^5.5.0`) and shell versions (`^50.0.0`) |
| TypeScript `TS2416` or `TS4114` in `_init` / `fillPreferencesWindow` | Method signature mismatch with base GObject / `@girs` types | Use `override _init(_params?: any, ..._args: any[]): void` and `async fillPreferencesWindow(window): Promise<void>` |
| Overridden Shell methods remain active after disabling | Manual prototype mutation without restoration | Use `InjectionManager` and call `this._injectionManager.clear()` in `disable()` |
