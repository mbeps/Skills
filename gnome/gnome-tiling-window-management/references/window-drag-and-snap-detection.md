# Window Drag & Snap Detection (GNOME 45+)

Window snapping intercepts the user's cursor or touch drag in real-time, computing whether the pointer has entered an edge zone or a layout slot, and rendering an animated translucent tile preview under the active window actor.

---

## 1. Intercepting Mutter Grab Operations

Mutter notifies the compositor of window movements via the `grab-op-begin` and `grab-op-end` signals on `global.display`.

```javascript
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';

const META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED = 1024;
const MOVE_GRAB_OPS = [Meta.GrabOp.MOVING, Meta.GrabOp.KEYBOARD_MOVING];

export class DragManager {
    constructor() {
        this._activeWindow = null;
        this._dragSprite = null;

        // Monitor drag start
        global.display.connectObject(
            'grab-op-begin',
            (display, metaWindow, grabOp, sprite) => {
                // Strip unconstrained mask flag (set on Super+drag or modifier drag)
                const cleanGrabOp = grabOp & ~META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED;

                if (metaWindow && MOVE_GRAB_OPS.includes(cleanGrabOp)) {
                    this._dragSprite = sprite;
                    this._onDragStarted(metaWindow, cleanGrabOp);
                }
            },
            this
        );

        // Monitor drag completion
        global.display.connectObject(
            'grab-op-end',
            (display, metaWindow, grabOp) => {
                const cleanGrabOp = grabOp & ~META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED;
                if (metaWindow && MOVE_GRAB_OPS.includes(cleanGrabOp)) {
                    this._onDragEnded(metaWindow, cleanGrabOp);
                }
            },
            this
        );
    }

    destroy() {
        global.display.disconnectObject(this);
    }
}
```

---

## 2. Robust Pointer Tracking Across Wayland & Touch

In Wayland and modern Mutter, pointer position during window grabs can desync if only querying stage coordinates. Using `Clutter.Sprite` (when available) ensures sub-pixel accuracy, with fallback to stage pointer or touch delta tracking:

```javascript
import Clutter from 'gi://Clutter';

export class PointerTracker {
    constructor() {
        this._dragSprite = null;
        this._touchDeviceActive = false;
        this._touchX = -1;
        this._touchY = -1;
        this._lastWindowPos = { x: 0, y: 0 };
    }

    setDragSprite(sprite) {
        this._dragSprite = sprite;
    }

    setTouchPosition(x, y, window) {
        this._touchDeviceActive = true;
        this._touchX = x;
        this._touchY = y;
        const rect = window.get_frame_rect();
        this._lastWindowPos = { x: rect.x, y: rect.y };
    }

    resetTouch() {
        this._touchDeviceActive = false;
        this._touchX = -1;
        this._touchY = -1;
    }

    /**
     * Resolves current cursor [x, y] coordinates reliably under Wayland, X11, and Touch.
     * @param {Meta.Window} [window]
     * @returns {[number, number]}
     */
    getPointerCoords(window = null) {
        // 1. Touch device active: track relative window delta
        if (this._touchDeviceActive && window) {
            const currPos = window.get_frame_rect();
            this._touchX += currPos.x - this._lastWindowPos.x;
            this._touchY += currPos.y - this._lastWindowPos.y;
            this._lastWindowPos = { x: currPos.x, y: currPos.y };
            return [Math.round(this._touchX), Math.round(this._touchY)];
        }

        // 2. Clutter.Sprite coordinates (Wayland sub-pixel pointer)
        if (this._dragSprite && typeof this._dragSprite.get_coords === 'function') {
            const coords = this._dragSprite.get_coords();
            if (coords && typeof coords.x === 'number') {
                return [Math.round(coords.x), Math.round(coords.y)];
            }
        }

        // 3. Global Clutter stage pointer fallback
        const [x, y] = global.get_pointer().slice(0, 2);
        return [Math.round(x), Math.round(y)];
    }
}
```

---

## 3. Dynamic Untiling on Drag (`_restoreSizeAndRestartGrab`)

When a user grabs the titlebar of an already-tiled (or maximized) window and begins dragging, they expect the window to smoothly untile to its floating dimensions *while the drag continues uninterrupted*.

```javascript
import GLib from 'gi://GLib';

/**
 * Attaches a drag watcher that untiles the window if dragged beyond threshold.
 * @param {Meta.Window} window
 * @param {Meta.GrabOp} grabOp
 * @param {Function} untileCallback
 * @param {Function} onRestartGrabCallback
 */
export function monitorDragToUntile(window, grabOp, untileCallback, onRestartGrabCallback) {
    const [startX, startY] = global.get_pointer().slice(0, 2);
    let counter = 0;

    const timerId = GLib.timeout_add(GLib.PRIORITY_HIGH_IDLE, 10, () => {
        if (!global.display.is_grabbed()) {
            return GLib.SOURCE_REMOVE;
        }

        counter += 10;
        const [curX, curY] = global.get_pointer().slice(0, 2);
        const dist = Math.hypot(curX - startX, curY - startY);

        // If dragged more than 10px or 400ms elapsed, restore floating size
        if (dist > 10 || counter >= 400) {
            // Untile without snapping window to old position (keep titlebar under cursor)
            untileCallback(window, { restoreFullPos: false });
            onRestartGrabCallback(window, grabOp);
            return GLib.SOURCE_REMOVE;
        }

        return GLib.SOURCE_CONTINUE;
    });

    return () => GLib.Source.remove(timerId);
}
```

---

## 4. Multi-Monitor Drag Grace Period

On multi-monitor setups without a physical bezel between displays, moving a window towards the screen boundary instantly triggers `window-entered-monitor`, jumping to the adjacent screen before the user can complete an edge snap. Implement a 150ms grace period lock:

```javascript
import GLib from 'gi://GLib';

export class MultiMonitorDragLock {
    constructor() {
        this._currentMonitor = global.display.get_current_monitor();
        this._lastMonitor = this._currentMonitor;
        this._lockTimerId = null;
    }

    /**
     * Resolves effective monitor with a grace period for edge snapping.
     * @param {Meta.Window} window
     * @param {Function} onRecalculatePreview
     * @returns {number} Active monitor index
     */
    resolveMonitor(window, onRecalculatePreview) {
        const activeMon = global.display.get_current_monitor();

        if (this._lastMonitor !== activeMon) {
            const preservedMon = this._lastMonitor;

            if (this._lockTimerId) GLib.Source.remove(this._lockTimerId);

            this._lockTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                this._currentMonitor = global.display.get_current_monitor();
                this._lockTimerId = null;
                if (global.display.is_grabbed() && window.get_compositor_private()) {
                    onRecalculatePreview(this._currentMonitor);
                }
                return GLib.SOURCE_REMOVE;
            });

            this._lastMonitor = activeMon;
            return preservedMon; // Hold onto previous monitor during grace period
        }

        this._lastMonitor = activeMon;
        this._currentMonitor = activeMon;
        return activeMon;
    }

    destroy() {
        if (this._lockTimerId) {
            GLib.Source.remove(this._lockTimerId);
            this._lockTimerId = null;
        }
    }
}
```

---

## 5. Snap Zone Detection & Titlebar Hit-Testing

```javascript
export const SnapZone = Object.freeze({
    NONE: 'NONE',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    TOP: 'TOP',
    BOTTOM: 'BOTTOM',
    TOP_LEFT: 'TOP_LEFT',
    TOP_RIGHT: 'TOP_RIGHT',
    BOTTOM_LEFT: 'BOTTOM_LEFT',
    BOTTOM_RIGHT: 'BOTTOM_RIGHT',
});

/**
 * Evaluates cursor coordinates and window titlebar position against monitor work area.
 *
 * @param {number} x - Cursor X
 * @param {number} y - Cursor Y
 * @param {Meta.Window} window - Active dragged window
 * @param {Mtk.Rectangle} workArea - Monitor work area
 * @param {number} edgeThreshold - Edge threshold in px (e.g., 32px)
 * @param {number} cornerThreshold - Corner box threshold in px (e.g., 64px)
 * @returns {string} One of SnapZone constants
 */
export function detectSnapZone(x, y, window, workArea, edgeThreshold = 32, cornerThreshold = 64) {
    const wRect = window.get_frame_rect();

    // Check if titlebar is physically touching the top edge (assists slow drags)
    const titleBarGrabbed = (y - wRect.y) < 50;
    const windowAtTopEdge = titleBarGrabbed && (wRect.y === workArea.y);

    const leftEdge = x <= workArea.x + edgeThreshold;
    const rightEdge = x >= workArea.x + workArea.width - edgeThreshold;
    const topEdge = (y <= workArea.y + edgeThreshold) || windowAtTopEdge;
    const bottomEdge = y >= workArea.y + workArea.height - edgeThreshold;

    const leftCorner = x <= workArea.x + cornerThreshold;
    const rightCorner = x >= workArea.x + workArea.width - cornerThreshold;
    const topCorner = (y <= workArea.y + cornerThreshold) || windowAtTopEdge;
    const bottomCorner = y >= workArea.y + workArea.height - cornerThreshold;

    // Corner Quarters take precedence
    if (leftCorner && topCorner) return SnapZone.TOP_LEFT;
    if (rightCorner && topCorner) return SnapZone.TOP_RIGHT;
    if (leftCorner && bottomCorner) return SnapZone.BOTTOM_LEFT;
    if (rightCorner && bottomCorner) return SnapZone.BOTTOM_RIGHT;

    // Cardinal Edges
    if (leftEdge) return SnapZone.LEFT;
    if (rightEdge) return SnapZone.RIGHT;
    if (topEdge) return SnapZone.TOP;
    if (bottomEdge) return SnapZone.BOTTOM;

    return SnapZone.NONE;
}
```

---

## 6. Tile Preview Actor Architecture

The preview is an `St.Widget` placed into `global.windowGroup`. It must never capture input events (`reactive = false`) and must sit directly beneath the window being moved.

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

export const TilePreviewActor = GObject.registerClass(
class TilePreviewActor extends St.Widget {
    _init() {
        super._init({
            style_class: 'tile-preview', // Styled by extension stylesheet.css
            reactive: false,
            visible: false,
            opacity: 0,
        });

        // Add into the window compositor stage layer
        global.windowGroup.add_child(this);
    }

    open(targetRect, grabbedWindow, durationMs = 150) {
        // Place below the actively dragged window actor
        const windowActor = grabbedWindow.get_compositor_private();
        if (windowActor) {
            global.windowGroup.set_child_below_sibling(this, windowActor);
        }

        this.visible = true;
        this.remove_all_transitions();

        if (this.opacity === 0) {
            this.set_position(targetRect.x, targetRect.y);
            this.set_size(targetRect.width, targetRect.height);
            this.ease({
                opacity: 255,
                duration: durationMs,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        } else {
            // Already visible, animate morph to new slot
            this.ease({
                x: targetRect.x,
                y: targetRect.y,
                width: targetRect.width,
                height: targetRect.height,
                opacity: 255,
                duration: durationMs,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    close(durationMs = 150) {
        if (!this.visible) return;

        this.remove_all_transitions();
        this.ease({
            opacity: 0,
            duration: durationMs,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this.visible = false;
            },
        });
    }

    destroy() {
        this.remove_all_transitions();
        if (this.get_parent()) {
            this.get_parent().remove_child(this);
        }
        super.destroy();
    }
});
```

---

## 7. Edge Cases & Trap Avoidance

1. **Wayland Grab State Race:** When calling `Meta.Window.move_resize_frame()` while a grab is active, Mutter can drop the grab or misinterpret mouse coordinates. Always wait for `grab-op-end` before committing the final window position.
2. **Actor Hierarchy Positioning:** Always add preview actors to `global.windowGroup`, NOT `Main.uiGroup`. Adding to `Main.uiGroup` causes previews to render above popups and top bar menus.
3. **Modal Dialog Handling:** Dialogs attached to parent windows (`metaWindow.is_attached_dialog()`) or transient windows should generally not trigger tile previews. Filter them out during `grab-op-begin`:
   ```javascript
   if (metaWindow.is_attached_dialog() || metaWindow.is_override_redirect()) {
       return;
   }
   ```
