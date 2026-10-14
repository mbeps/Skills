# DBus, Subprocesses & GResource Integration (GNOME 45+)

GNOME Shell extensions frequently need to execute external commands, interact with system services via DBus (e.g. MPRIS media players, UPower, systemd), export their own DBus API, or bundle binary assets using GResources.

> **CRITICAL RULE:** GNOME Shell runs on a single main UI thread. Never use synchronous execution functions such as `GLib.spawn_command_line_sync()` or synchronous file reads. Doing so freezes the entire user interface and compositor. Always use asynchronous APIs with `Gio._promisify` or `Promise` wrappers.

---

## 1. Native Asynchronous Patterns: `Gio._promisify`

GJS provides a built-in helper `Gio._promisify()` that automatically converts callback-based asynchronous methods in GLib/Gio into functions returning standard JavaScript `Promise` instances.

### Promisifying Subprocesses and File I/O:

```javascript
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Promisify common asynchronous prototypes once at module root
Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');
Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');

/**
 * Executes a CLI command and returns stdout using promisified Gio.Subprocess.
 *
 * @param {string[]} argv Command and arguments array (e.g. ['uptime', '-p'])
 * @param {Gio.Cancellable} [cancellable]
 * @returns {Promise<string>}
 */
export async function runCommandAsync(argv, cancellable = null) {
    const proc = new Gio.Subprocess({
        argv: argv,
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });
    proc.init(cancellable);

    // Directly await the promisified method
    const [stdout, stderr] = await proc.communicate_utf8_async(null, cancellable);

    if (!proc.get_successful()) {
        throw new Error(stderr || `Process exited with code ${proc.get_exit_status()}`);
    }

    return stdout ? stdout.trim() : '';
}

/**
 * Reads a text file asynchronously without blocking the compositor.
 *
 * @param {string} filePath Absolute path to file
 * @returns {Promise<string>}
 */
export async function readFileAsync(filePath) {
    const file = Gio.File.new_for_path(filePath);
    const [contents] = await file.load_contents_async(null);
    return new TextDecoder('utf-8').decode(contents);
}
```

---

## 2. Calling External DBus Services (`Gio.DBusProxy`)

To invoke methods, read properties, or listen to signals on external DBus services (e.g. media players or system daemons), use `Gio.DBusProxy.makeProxyWrapper`.

### Controlling MPRIS Media Players (e.g. Spotify, VLC):

```javascript
import Gio from 'gi://Gio';

const MprisIface = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="PlayPause"/>
    <method name="Next"/>
    <method name="Previous"/>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
  </interface>
</node>`;

const MprisProxy = Gio.DBusProxy.makeProxyWrapper(MprisIface);

export class MediaPlayerController {
    constructor() {
        this._proxy = new MprisProxy(
            Gio.DBus.session,
            'org.mpris.MediaPlayer2.spotify',
            '/org/mpris/MediaPlayer2',
            (proxy, error) => {
                if (error) {
                    console.error(`DBus connection error: ${error.message}`);
                }
            }
        );
    }

    playPause() {
        this._proxy.PlayPauseRemote((result, error) => {
            if (error) {
                console.error(`DBus call failed: ${error.message}`);
            }
        });
    }

    get status() {
        return this._proxy.PlaybackStatus; // 'Playing' | 'Paused' | 'Stopped'
    }

    destroy() {
        this._proxy = null;
    }
}
```

---

## 3. Exporting a DBus Interface from Your Extension

Exporting a DBus interface allows external scripts, shortcuts, widgets, or CLI tools to invoke methods on your extension while it is active in GNOME Shell.

```javascript
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const ExtensionIface = `
<node>
  <interface name="org.gnome.Shell.Extensions.MyExtension">
    <method name="GetStatus">
      <arg type="s" direction="out" name="status"/>
    </method>
    <method name="Toggle">
      <arg type="b" direction="in" name="enabled"/>
    </method>
    <signal name="StatusChanged">
      <arg type="s" name="newStatus"/>
    </signal>
  </interface>
</node>`;

export default class MyExtension extends Extension {
    enable() {
        this._state = false;

        // Wrap JS object as DBus exported service
        this._dbus = Gio.DBusExportedObject.wrapJSObject(
            ExtensionIface,
            this
        );

        // Export on session bus
        this._dbus.export(
            Gio.DBus.session,
            '/org/gnome/Shell/Extensions/MyExtension'
        );
    }

    disable() {
        if (this._dbus) {
            this._dbus.flush();
            this._dbus.unexport();
            this._dbus = null;
        }
    }

    // Exposed DBus Methods:
    GetStatus() {
        return this._state ? 'active' : 'inactive';
    }

    Toggle(enabled) {
        this._state = enabled;
        console.log(`Extension toggled via DBus to: ${enabled}`);

        // Emit DBus signal to subscribers
        this._dbus.emit_signal(
            'StatusChanged',
            new GLib.Variant('(s)', [this._state ? 'active' : 'inactive'])
        );
    }
}
```

### Testing with `gdbus`:

```bash
# Call method
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/MyExtension \
  --method org.gnome.Shell.Extensions.MyExtension.GetStatus

# Monitor signals
gdbus monitor --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/MyExtension
```

---

## 4. GResource Bundling (`.gresource`)

Extensions with multiple SVG icons, UI templates, or static assets can bundle them into a single binary `.gresource` container using `glib-compile-resources`.

### Step 1: Create `resources.gresource.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gresources>
  <gresource prefix="/org/gnome/shell/extensions/my-extension">
    <file>icons/custom-action-symbolic.svg</file>
    <file>ui/preferences.ui</file>
  </gresource>
</gresources>
```

### Step 2: Compile the GResource Binary

```bash
glib-compile-resources resources.gresource.xml --target=resources.gresource
```

### Step 3: Register and Unregister at Runtime

```javascript
import Gio from 'gi://Gio';

export default class MyExtension extends Extension {
    enable() {
        // Load and register GResource
        const resourcePath = `${this.path}/resources.gresource`;
        this._resource = Gio.Resource.load(resourcePath);
        Gio.resources_register(this._resource);

        // Assets are now accessible via standard resource URIs:
        // 'resource:///org/gnome/shell/extensions/my-extension/icons/custom-action-symbolic.svg'
    }

    disable() {
        if (this._resource) {
            Gio.resources_unregister(this._resource);
            this._resource = null;
        }
    }
}
```
