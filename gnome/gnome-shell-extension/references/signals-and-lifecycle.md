# Signals, Lifecycle & Memory Management (GNOME 45+)

GNOME Shell is a long-running, single-process desktop compositor. If an extension fails to disconnect a signal, stop a timer, or destroy a Clutter actor, the leak persists for the entire user session, degrades performance, and can crash the shell.

---

## 1. The Symmetry Rule

**Every resource acquired, registered, or connected in `enable()` MUST be released, unregistered, or disconnected in `disable()`.**

| In `enable()` | In `disable()` |
|---------------|----------------|
| `Main.panel.addToStatusArea(uuid, indicator)` | `indicator.destroy()` |
| `quickSettings.addExternalIndicator(indicator)` | `indicator.quickSettingsItems.forEach(i => i.destroy()); indicator.destroy()` |
| `target.connectObject('sig', callback, this)` | `target.disconnectObject(this)` |
| `id = GLib.timeout_add(priority, ms, cb)` | `GLib.source_remove(id); id = null` |
| `Main.wm.addKeybinding(name, settings, ...)` | `Main.wm.removeKeybinding(name)` |
| `injectionManager.overrideMethod(...)` | `injectionManager.clear()` |
| `Gio.resources_register(resource)` | `Gio.resources_unregister(resource)` |
| `searchController.addProvider(provider)` | `searchController.removeProvider(provider)` |
| `dbusImpl.export(bus, path)` | `dbusImpl.flush(); dbusImpl.unexport()` |
| `id = global.connect('shutdown', cb)` | `global.disconnect(id)` |
| `settings.connect(...)` in `prefs.js` | `window.connect('close-request', () => settings.disconnect(id))` |

---

## 2. Signal Management: `connectObject` and `disconnectObject`

GNOME Shell injects `connectObject` and `disconnectObject` into GObjects to track signal lifetimes automatically.

### Multi-Signal Syntax:
`connectObject` accepts multiple signal-callback pairs with the lifetime owner as the final argument:

```javascript
export default class MyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // 1. Multi-signal connection on GSettings
        this._settings.connectObject(
            'changed::active-profile', () => this._onProfileChanged(),
            'changed::accent-color', () => this._onColorChanged(),
            'changed::show-indicator', () => this._onVisibilityChanged(),
            this
        );

        // 2. Global shell and display signals
        global.display.connectObject(
            'window-created', (display, win) => this._onWindowCreated(win),
            'notify::focus-window', () => this._onFocusChanged(),
            this
        );

        // 3. Overview events
        Main.overview.connectObject(
            'showing', () => this._onOverviewShowing(),
            'hiding', () => this._onOverviewHiding(),
            this
        );
    }

    disable() {
        // Disconnect all signal handlers owned by 'this' on each object
        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }

        global.display.disconnectObject(this);
        Main.overview.disconnectObject(this);
    }
}
```

---

## 3. Session Modes & Lock Screen Isolation

Extensions may need to alter behavior when the screen locks or when the user switches session modes (e.g. lock screen, login screen, unlock dialog).

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class SessionAwareExtension extends Extension {
    enable() {
        // Listen to session mode changes
        Main.sessionMode.connectObject('updated', () => {
            this._onSessionModeChanged();
        }, this);

        this._onSessionModeChanged();
    }

    disable() {
        Main.sessionMode.disconnectObject(this);
    }

    _onSessionModeChanged() {
        const isLocked = Main.sessionMode.isLocked;
        const allowSettings = Main.sessionMode.allowSettings;

        if (isLocked) {
            // Hide sensitive data or pause background tasks while screen is locked
            this._indicator?.set_child_visible(false);
        } else {
            this._indicator?.set_child_visible(true);
        }
    }
}
```

### Desktop Shutdown Cleanup Hook:

```javascript
export default class CleanExtension extends Extension {
    enable() {
        // Cleanly handle desktop logout/shutdown
        this._shutdownId = global.connect('shutdown', () => {
            this.disable();
        });
    }

    disable() {
        if (this._shutdownId) {
            global.disconnect(this._shutdownId);
            this._shutdownId = null;
        }
        // ... perform normal resource cleanup
    }
}
```

---

## 4. GLib Timers & Idle Callbacks

Never use JavaScript `setTimeout()` or `setInterval()` inside GNOME Shell extensions. They are not integrated with the GLib main loop and cause memory retention. Always use `GLib.timeout_add()` or `GLib.idle_add()`.

```javascript
import GLib from 'gi://GLib';

export default class PollingExtension extends Extension {
    enable() {
        this._sourceId = null;
        this._startTimer();
    }

    _startTimer() {
        // Return GLib.SOURCE_CONTINUE to repeat, GLib.SOURCE_REMOVE to terminate
        this._sourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            5000, // milliseconds
            () => {
                this._fetchUpdates();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    disable() {
        if (this._sourceId) {
            GLib.source_remove(this._sourceId);
            this._sourceId = null;
        }
    }
}
```

---

## 5. Method Monkey-Patching with `InjectionManager`

GNOME 45+ provides `InjectionManager` to cleanly intercept and restore GNOME Shell methods without mutating prototypes permanently:

```javascript
import { Extension, InjectionManager } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { WindowPreview } from 'resource:///org/gnome/shell/ui/windowPreview.js';

export default class PatchingExtension extends Extension {
    enable() {
        this._injectionManager = new InjectionManager();

        // Safely override WindowPreview._addWindow method
        this._injectionManager.overrideMethod(
            WindowPreview.prototype,
            '_addWindow',
            (originalMethod) => {
                // Must return a standard function (not an arrow function) to preserve 'this'
                return function (metaWindow) {
                    // Call the original implementation
                    originalMethod.call(this, metaWindow);

                    // Extension-specific augmentation
                    console.log(`Window added to preview: ${metaWindow.get_title()}`);
                };
            }
        );
    }

    disable() {
        // Restores all patched methods to their exact original implementations
        if (this._injectionManager) {
            this._injectionManager.clear();
            this._injectionManager = null;
        }
    }
}
```

---

## 6. Registering Custom GObject Classes

Any class with custom GObject properties, signals, or custom widget subclasses must be registered via `GObject.registerClass`:

```javascript
import GObject from 'gi://GObject';
import St from 'gi://St';

export const CustomIndicatorBox = GObject.registerClass(
    {
        GTypeName: 'MyCustomIndicatorBox',
        Properties: {
            'active-count': GObject.ParamSpec.int(
                'active-count',
                'Active Count',
                'Number of active tasks',
                GObject.ParamFlags.READWRITE,
                0, 1000, 0
            ),
        },
        Signals: {
            'count-exhausted': {
                param_types: [GObject.TYPE_INT],
            },
        },
    },
    class CustomIndicatorBox extends St.BoxLayout {
        _init() {
            super._init({
                vertical: false,
                style_class: 'custom-indicator-box',
            });

            this._count = 0;
            this._label = new St.Label({ text: '0' });
            this.add_child(this._label);
        }

        get active_count() {
            return this._count;
        }

        set active_count(value) {
            if (this._count !== value) {
                this._count = value;
                this._label.text = `${value}`;
                this.notify('active-count');

                if (value === 0) {
                    this.emit('count-exhausted', 0);
                }
            }
        }
    }
);
```
