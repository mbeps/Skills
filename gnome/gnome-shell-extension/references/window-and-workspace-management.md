# Window & Workspace Management (GNOME 45+)

Extensions that implement custom tiling, window decorators, taskbars, dock panels, or window switchers interact directly with Mutter (`Meta`), the Meta Toolkit (`Mtk`), and GNOME Shell's window tracker (`Shell.WindowTracker`).

> **CRITICAL RULE (GNOME 45+ Migration):** GNOME 45 split Meta geometry types into the dedicated **`Mtk` (Meta Toolkit)** library (`gi://Mtk`). Legacy `Meta.Rectangle` is obsolete; always import and use `Mtk.Rectangle`.

---

## 1. Key Introspection Libraries for Window Management

```javascript
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
```

---

## 2. Geometry: Using `Mtk.Rectangle`

`Mtk.Rectangle` represents window bounds, monitor bounding boxes, and clip regions:

```javascript
import Mtk from 'gi://Mtk';

// Instantiate rectangle: x, y, width, height
const rect = new Mtk.Rectangle({
    x: 100,
    y: 100,
    width: 800,
    height: 600,
});

// Geometry comparisons and intersections
const otherRect = new Mtk.Rectangle({ x: 50, y: 50, width: 200, height: 200 });

// Overlap boolean check:
const hasOverlap = rect.overlap(otherRect);

// Intersection calculation: returns [hasIntersection, destRectangle]
const [hasIntersection, intersectionRect] = rect.intersect(otherRect);

// Union: bounding box containing both rectangles
const unionRect = rect.union(otherRect);

// Containment checks:
const containsPt = rect.contains_point(150, 150);
const containsRc = rect.contains_rect(otherRect);

// Copy or clone
const rectCopy = rect.copy();
```

---

## 3. Querying & Tracking Windows

### Getting All Open Windows
```javascript
export function getWorkspaceWindows(workspace = null) {
    const ws = workspace ?? global.workspace_manager.get_active_workspace();
    
    // Returns list of Meta.Window objects for this workspace
    return ws.list_windows().filter(metaWindow => {
        // Filter out dialogs, tooltips, or desktop background actors if needed
        return !metaWindow.is_override_redirect() &&
               metaWindow.get_window_type() === Meta.WindowType.NORMAL;
    });
}
```

### Getting Global Tab/Focus Order
```javascript
// Returns windows across all monitors and workspaces in MRU (Most Recently Used) order
const mruWindows = global.display.get_tab_list(
    Meta.TabList.NORMAL_ALL,
    global.workspace_manager.get_active_workspace()
);
```

### Tracking the Focused Window
```javascript
// Direct access via global.display
const activeMetaWindow = global.display.focus_window;

// Shell WindowTracker maps Meta.Window to Shell.App (desktop entry metadata)
const tracker = Shell.WindowTracker.get_default();
const activeApp = tracker.focus_app; // Shell.App instance or null
if (activeApp) {
    console.log(`Focused application: ${activeApp.get_name()} (${activeApp.get_id()})`);
}
```

---

## 4. Window Actor vs. `Meta.Window`

In GNOME Shell / Clutter architecture:
- `Meta.Window`: The window manager's logical window representation (properties, state, PID, title, WM class).
- `Meta.WindowActor`: The Clutter scenegraph actor that renders the window contents on screen.

### Converting Between Logical Window and Actor:

```javascript
// 1. From Meta.Window to Meta.WindowActor:
const windowActor = metaWindow.get_compositor_private();

// 2. From Meta.WindowActor to Meta.Window:
const metaWin = windowActor?.metaWindow ?? windowActor?.get_meta_window?.();
```

### Checking Window State:

```javascript
export function getWindowState(metaWindow) {
    return {
        title: metaWindow.get_title(),
        wmClass: metaWindow.get_wm_class(),
        pid: metaWindow.get_pid(),
        isFullscreen: metaWindow.is_fullscreen(),
        isMaximized: metaWindow.get_maximized() === Meta.MaximizeFlags.BOTH,
        isMinimized: metaWindow.minimized,
        isAlive: metaWindow.is_alive(),
        monitorIndex: metaWindow.get_monitor(),
        frameRect: metaWindow.get_frame_rect(), // Returns Mtk.Rectangle
        bufferRect: metaWindow.get_buffer_rect(), // Returns Mtk.Rectangle (includes shadows)
    };
}
```

---

## 5. Manipulating Window Position & Size

### Moving and Resizing:
```javascript
// Move and resize using frame rectangle coordinates
metaWindow.move_resize_frame(
    true, // user_op (true if user action)
    new Mtk.Rectangle({ x: 0, y: 0, width: 960, height: 1080 })
);

// Maximize, unmaximize, minimize
metaWindow.maximize(Meta.MaximizeFlags.BOTH);
metaWindow.unmaximize(Meta.MaximizeFlags.BOTH);
metaWindow.minimize();
metaWindow.unminimize();

// Pin window on top ("Always on Top")
metaWindow.make_above();
metaWindow.unmake_above();

// Pin window across all workspaces ("Always on Visible Workspace")
metaWindow.stick();
metaWindow.unstick();

// Focus and raise window
metaWindow.activate(global.get_current_time());
```

---

## 6. Monitors and Scaling Factors

Multi-monitor systems and Wayland fractional scaling require querying monitor geometries correctly:

```javascript
export function getMonitorGeometry(monitorIndex = null) {
    const display = global.display;
    const idx = monitorIndex ?? display.get_current_monitor();
    
    // Returns Mtk.Rectangle representing the monitor's coordinates on the virtual desktop
    const geometry = display.get_monitor_geometry(idx);
    
    // Scale factor (e.g. 1.0, 1.5, 2.0)
    const scale = display.get_monitor_scale(idx);
    
    // Check if monitor is primary
    const isPrimary = display.get_primary_monitor() === idx;

    return { geometry, scale, isPrimary };
}
```

---

## 7. Listening to Window, Workspace & Monitor Events

Always manage window signal connections using `connectObject` with `this` as the lifetime owner.

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class WindowTrackingExtension extends Extension {
    enable() {
        // 1. Window creation, destruction, focus changes
        global.display.connectObject(
            'window-created', (display, metaWindow) => this._onWindowCreated(metaWindow),
            'notify::focus-window', () => this._onFocusChanged(),
            'restacked', () => this._onWindowsRestacked(),
            'window-demands-attention', (display, metaWindow) => this._onAttention(metaWindow),
            this
        );

        // 2. Workspace switching & management
        global.workspace_manager.connectObject(
            'active-workspace-changed', () => this._onWorkspaceChanged(),
            'workspace-added', (wm, index) => this._onWorkspaceAdded(index),
            'workspace-removed', (wm, index) => this._onWorkspaceRemoved(index),
            this
        );

        // 3. Monitor hotplug, resolution, or display scaling changes
        Main.layoutManager.connectObject(
            'monitors-changed', () => this._onMonitorsChanged(),
            this
        );
    }

    disable() {
        // Cleanly disconnect all registered signals on display, workspace_manager, and layoutManager
        global.display.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
    }

    _onWindowCreated(metaWindow) {
        // Connect to individual window events
        metaWindow.connectObject(
            'size-changed', () => console.log('Window resized'),
            'position-changed', () => console.log('Window moved'),
            'unmanaged', () => metaWindow.disconnectObject(this),
            this
        );
    }

    _onFocusChanged() {
        const win = global.display.focus_window;
        if (win) {
            console.log(`Focus switched to: ${win.get_title()}`);
        }
    }

    _onWorkspaceChanged() {
        const activeIdx = global.workspace_manager.get_active_workspace_index();
        console.log(`Switched to workspace: ${activeIdx}`);
    }

    _onWindowsRestacked() {
        // Triggered when windows change stacking order (Z-order)
    }

    _onAttention(metaWindow) {
        console.log(`Window demands attention: ${metaWindow.get_title()}`);
    }
}
```
