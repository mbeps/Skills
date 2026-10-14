# Tooling, Debugging, Linting & EGO Review (GNOME 45+)

Developing GNOME Shell extensions requires specialized debugging techniques because code runs directly inside the compositor process. Errors can cause session crashes or memory leaks.

---

## 1. The `gnome-extensions` CLI Tool

GNOME's official command-line utility for managing the extension lifecycle:

```bash
# List all extensions
gnome-extensions list

# List enabled extensions
gnome-extensions list --enabled

# Display extension metadata and operational status
gnome-extensions info my-extension@example.com

# Enable / Disable extension
gnome-extensions enable my-extension@example.com
gnome-extensions disable my-extension@example.com

# Open the extension's preferences window directly
gnome-extensions prefs my-extension@example.com

# Clear an extension's error state
gnome-extensions reset my-extension@example.com

# Uninstall extension from user directory
gnome-extensions uninstall my-extension@example.com
```

### Packaging for Release (`gnome-extensions pack`):

```bash
# Standard JavaScript extension packaging:
gnome-extensions pack \
  --extra-source=stylesheet.css \
  --extra-source=icons \
  --extra-source=ui \
  --schema=schemas/org.gnome.shell.extensions.my-extension.gschema.xml \
  --podir=po \
  --force \
  --out-dir=./build \
  .

# TypeScript extension packaging (from dist/):
gnome-extensions pack dist/ --force --out-dir=./build
```

---

## 2. Interactive In-Shell Inspection: Looking Glass

Looking Glass is GNOME Shell's built-in graphical debugger and REPL console.

### Opening Looking Glass:
1. Press `Alt + F2`.
2. Type `lg` and press `Enter`.
3. Press `Esc` to close.

### Key Tabs & Tools:
- **Evaluator Tab:** An interactive JavaScript console inside the compositor. Test code live:
  ```javascript
  // Look up your extension instance
  const ext = Main.extensionManager.lookup('my-extension@example.com');
  console.log(ext.state); // 1 = INITIALIZED, 2 = ENABLED, 3 = DISABLED, 4 = ERROR

  // Inspect extension settings
  const settings = ext.getSettings();
  console.log(settings.get_boolean('show-indicator'));

  // Inspect top panel actors
  Main.panel.statusArea;
  ```
- **Picker Tool (Top-Left Crosshair):** Click any on-screen UI element to inspect its Clutter hierarchy, dimensions, margins, and applied CSS classes.
- **Extensions Tab:** Lists all installed extensions, their current state, and backtraces for any runtime exceptions.

---

## 3. Safe Testing: Nested GNOME Shell Session

Because Wayland cannot reload the compositor in-place without closing all running applications, always test new extensions inside a **nested Wayland session** running in a separate window:

### Launching Nested Session:

#### GNOME 45 through GNOME 48:
```bash
dbus-run-session gnome-shell --nested --wayland
```

#### GNOME 49 and GNOME 50+:
```bash
dbus-run-session gnome-shell --devkit --wayland
```

### Running with Debug Flags:
```bash
# Print full backtraces for GObject warnings and errors:
SHELL_DEBUG=backtrace-warnings dbus-run-session gnome-shell --nested --wayland

# Enable all shell debug logs:
SHELL_DEBUG=all dbus-run-session gnome-shell --nested --wayland
```

Inside the nested window, open a terminal or run `gnome-extensions enable my-extension@example.com`.

---

## 4. Real-Time Journal Logging

All `console.log()`, `console.warn()`, and `console.error()` calls output directly to the systemd journal.

```bash
# Live stream gnome-shell logs (omitting journal prefixes)
journalctl -f -o cat /usr/bin/gnome-shell

# Filter exclusively by extension UUID
journalctl -f -o cat GNOME_SHELL_EXTENSION_UUID=my-extension@example.com

# Grep for messages from current boot
journalctl -b /usr/bin/gnome-shell -g "my-extension"
```

---

## 5. Automated Review & Linting with `shexli`

**`shexli`** is the official static analysis tool and linter used by the GNOME Extensions review system (`extensions.gnome.org`). It scans unpacked extension source trees or packaged `.zip` bundles to detect compliance violations, forbidden synchronous calls, memory leaks, and deprecations before submission.

### Installation:
```bash
# Install via pip or pipx
pip install --user shexli
# Or in a virtual environment:
pipx install shexli
```

### Running Shexli:
```bash
# Run shexli against an unpacked source directory or dist/ output:
shexli dist/

# Run shexli against the packaged zip bundle (exact EGO submission check):
shexli build/my-extension@example.com.shell-extension.zip
```

### Inline Rule Suppression:
If Shexli flags a false positive (for example, an intentional dynamic import or an abstract class parameter), suppress the specific rule inline:

```javascript
// shexli: disable-next-line <rule-id>
const dynamicModule = await import(dynamicPath);
```

---

## 6. Official EGO (extensions.gnome.org) Review Checklist

To ensure approval on extensions.gnome.org, verify every item:

- [ ] **No Minification or Obfuscation:** Minified code is strictly forbidden. Source code must be readable by human reviewers.
- [ ] **No Remote Code Execution:** Extensions must not download executable code, scripts, or binaries at runtime. All assets must be bundled.
- [ ] **No `eval()` or `Function()` Constructors:** Prohibited for security reasons.
- [ ] **Strict ESM Imports:** Only use modern `import` / `export` syntax (`gi://`, `resource:///`). Zero legacy `imports.*` or `ExtensionUtils`.
- [ ] **Lifecycle Symmetry:** Every signal connected, timer created, or actor added in `enable()` must be cleanly disconnected/destroyed in `disable()`.
- [ ] **Strict Schema Compilation:** Schemas must compile cleanly with `glib-compile-schemas --strict schemas/`.
- [ ] **Translation Setup:** If using gettext, `metadata.json` must specify `gettext-domain`, and `this.initTranslations()` must be called in `enable()`.
- [ ] **Valid `metadata.json`:** Must contain `uuid`, `name`, `description`, and `shell-version` (e.g. `["45", "46", "47", "48", "49", "50"]`).
