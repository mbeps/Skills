# Multi-Tasking, Animations & Platform Quirks (GNOME 45+)

Window tiling in GNOME Shell operates at the intersection of Mutter's compositor pipeline, Clutter actor rendering, and platform-specific display server quirks (Wayland vs X11). This reference covers multi-tasking Alt+Tab integration, active window focus hints with Cairo smart border radius, smooth clone animations, and solutions for terminal cell size constraints.

---

## 1. Multi-Tasking Alt+Tab Group Integration

When windows are tiled into a shared group, cycling through them individually in Alt+Tab disrupts multi-tasking workflows. Extensions can combine grouped windows into a single composite switcher card using one of two production techniques:

### Pattern A: Custom Keybinding Handler (`tiling-assistant` Model)

The cleanest, non-destructive way to intercept application switching without prototype collisions:

```javascript
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class AltTabOverride {
    static enable(customSwitcherCallback) {
        Main.wm.setCustomKeybindingHandler(
            'switch-applications',
            Shell.ActionMode.NORMAL,
            (display, window, binding) => {
                if (Main.wm._workspaceSwitcherPopup !== null) {
                    Main.wm._workspaceSwitcherPopup.destroy();
                }
                customSwitcherCallback(binding);
            }
        );
    }

    static disable() {
        Main.wm.setCustomKeybindingHandler(
            'switch-applications',
            Shell.ActionMode.NORMAL,
            Main.wm._startSwitcher.bind(Main.wm)
        );
    }
}
```

### Pattern B: WindowSwitcherPopup Patching (`tilingshell` Model)

Combines tiled window icons into a composite `MultipleWindowsIcon` actor and raises the whole tile group when chosen:

```javascript
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

export class OverriddenAltTab {
    static enable(groupManager) {
        if (this._oldShow) return;

        this._groupManager = groupManager;
        this._oldShow = AltTab.WindowSwitcherPopup.prototype.show;

        const self = this;
        AltTab.WindowSwitcherPopup.prototype.show = function(backward, binding, mask) {
            // Disable square icon forcing to support wide composite tiles
            if (this._switcherList) {
                this._switcherList._squareItems = false;
                if (this._switcherList._list?.get_layout_manager()) {
                    this._switcherList._list.get_layout_manager().homogeneous = false;
                }
            }

            const res = self._oldShow.call(this, backward, binding, mask);
            self._injectTiledGroups(this);
            return res;
        };
    }

    static disable() {
        if (!this._oldShow) return;
        AltTab.WindowSwitcherPopup.prototype.show = this._oldShow;
        this._oldShow = null;
    }

    static _injectTiledGroups(switcherPopup) {
        // Find items whose windows are in the same tile group and replace with a composite card
        const items = switcherPopup._items || [];
        // When activated, groupManager.raiseGroup(tiledGroup) is called
    }
}
```

---

## 2. Active Window Border via Cairo (`St.DrawingArea`)

When windows are tiled with small or zero gaps, identifying the active window at a glance is essential. While a simple CSS border on `St.Widget` can work, production extensions use `St.DrawingArea` with Cairo to implement **Smart Border Radius**: drawing rounded corners (e.g. 11px) on the top bar and sharp corners (0px) on the bottom to match modern GTK4/Libadwaita Client-Side Decorations (CSD).

```javascript
import St from 'gi://St';
import Cairo from 'cairo';
import GObject from 'gi://GObject';

export const SmartWindowBorder = GObject.registerClass(
class SmartWindowBorder extends St.DrawingArea {
    _init(metaWindow, scaleFactor = 1) {
        super._init({
            style_class: 'tiled-active-border',
            reactive: false,
        });

        this._window = metaWindow;
        this._scale = scaleFactor;
        this._borderWidth = Math.max(1, Math.round(2 * this._scale));
        this._topRadius = 11 * this._scale;
        this._bottomRadius = 0; // GTK CSD typically sharp at bottom

        global.windowGroup.add_child(this);
        this._updateBounds();

        this._posId = metaWindow.connect('position-changed', () => this._updateBounds());
        this._sizeId = metaWindow.connect('size-changed', () => this._updateBounds());
    }

    _updateBounds() {
        const rect = this._window.get_frame_rect();
        this.set_position(rect.x, rect.y);
        this.set_size(rect.width, rect.height);

        const winActor = this._window.get_compositor_private();
        if (winActor) {
            global.windowGroup.set_child_above_sibling(this, winActor);
        }
        this.queue_repaint();
    }

    vfunc_repaint() {
        const cr = this.get_context();
        const w = this.width;
        const h = this.height;
        const bw = this._borderWidth;
        const halfBw = bw / 2;
        const tr = this._topRadius;
        const br = this._bottomRadius;

        // Accent color (Libadwaita Blue: #3584e4)
        cr.setSourceRGBA(0.208, 0.518, 0.894, 0.95);
        cr.setLineWidth(bw);

        // Path with rounded top corners and square bottom corners
        cr.newSubPath();
        // Top edge
        cr.arc(w - tr - halfBw, tr + halfBw, tr, -Math.PI / 2, 0); // Top-right
        // Right edge
        cr.arc(w - br - halfBw, h - br - halfBw, br, 0, Math.PI / 2); // Bottom-right
        // Bottom edge
        cr.arc(br + halfBw, h - br - halfBw, br, Math.PI / 2, Math.PI); // Bottom-left
        // Left edge
        cr.arc(tr + halfBw, tr + halfBw, tr, Math.PI, (3 * Math.PI) / 2); // Top-left
        cr.closePath();

        cr.stroke();
        cr.$dispose();
    }

    destroy() {
        if (this._window) {
            this._window.disconnect(this._posId);
            this._window.disconnect(this._sizeId);
            this._window = null;
        }
        super.destroy();
    }
});
```

---

## 3. Flicker-Free Tiling Animations via `Clutter.Clone`

Directly animating `Meta.Window` geometry causes client redraw stutter and black frames because GTK/Qt/Electron applications resize asynchronously. The **Clone Proxy Technique** solves this by animating a static texture proxy:

```javascript
import Clutter from 'gi://Clutter';

/**
 * Smoothly animates a window from its current frame into target tile coordinates.
 *
 * @param {Meta.Window} window
 * @param {Mtk.Rectangle} targetRect
 * @param {number} durationMs
 */
export function animateWindowToTile(window, targetRect, durationMs = 180) {
    const winActor = window.get_compositor_private();
    if (!winActor) {
        applyWindowGeometry(window, targetRect);
        return;
    }

    const currentRect = window.get_frame_rect();
    const shadowX = currentRect.x - winActor.get_x();
    const shadowY = currentRect.y - winActor.get_y();

    // 1. Create a lightweight clone proxy of the current window visual
    const clone = new Clutter.Clone({
        source: winActor,
        reactive: false,
        x: currentRect.x - shadowX,
        y: currentRect.y - shadowY,
        width: winActor.width,
        height: winActor.height,
    });

    global.windowGroup.add_child(clone);

    // 2. Hide original actor while animating proxy
    winActor.opacity = 0;

    // 3. Ease clone to target geometry
    clone.ease({
        x: targetRect.x - shadowX,
        y: targetRect.y - shadowY,
        width: targetRect.width + (shadowX * 2),
        height: targetRect.height + (shadowY * 2),
        duration: durationMs,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onStopped: () => {
            // 4. Restore original actor and destroy clone proxy
            winActor.opacity = 255;
            clone.destroy();
        },
    });

    // 5. Update underlying window manager geometry immediately
    applyWindowGeometry(window, targetRect);
}

function applyWindowGeometry(window, rect) {
    const userOp = true;
    window.move_frame(userOp, rect.x, rect.y);
    window.move_resize_frame(userOp, rect.x, rect.y, rect.width, rect.height);
}
```

---

## 4. Terminal Cell Size Hints & The `user_op = true` Rule

Terminal emulators (`gnome-terminal`, `xterm`, `kitty`) declare window size increments (character cell widths/heights) via X11/Wayland size hints. When Mutter resizes a window with `user_op = false`, it forcibly clamps the dimensions to cell increments, leaving unwanted gaps or failing to move.

### The Two-Step Movement Rule:

```javascript
export function applyTileGeometryWithCellHints(window, targetRect, monitorIndex) {
    // 1. Migrate window to target monitor first
    window.move_to_monitor(monitorIndex);

    // 2. Move position with user_op = true
    window.move_frame(true, targetRect.x, targetRect.y);

    // 3. Move and resize dimensions with user_op = true
    window.move_resize_frame(
        true, // user_op = true bypasses automated clamp rejection
        targetRect.x,
        targetRect.y,
        targetRect.width,
        targetRect.height
    );
}
```

---

## 5. Mutter Constraints Evolution (GNOME 45–51+)

In GNOME 45–47, extensions used `window.override_constraints()` with `Meta.WindowConstraint` to notify Mutter which window edges touched the monitor boundary vs other windows. In newer GNOME/Mutter releases (Mutter 18+), constraints were refactored into `ExternalConstraint`.

Always guard constraint overrides with runtime existence checks:

```javascript
import Meta from 'gi://Meta';

export function setTileConstraints(window, targetRect, workArea) {
    // Guard against API deprecation across Mutter versions
    if (typeof window.override_constraints === 'function' && Meta.WindowConstraint) {
        const top = targetRect.y === workArea.y ? Meta.WindowConstraint.MONITOR : Meta.WindowConstraint.WINDOW;
        const bottom = (targetRect.y + targetRect.height) === (workArea.y + workArea.height)
            ? Meta.WindowConstraint.MONITOR : Meta.WindowConstraint.WINDOW;
        const left = targetRect.x === workArea.x ? Meta.WindowConstraint.MONITOR : Meta.WindowConstraint.WINDOW;
        const right = (targetRect.x + targetRect.width) === (workArea.x + workArea.width)
            ? Meta.WindowConstraint.MONITOR : Meta.WindowConstraint.WINDOW;

        window.override_constraints(top, left, right, bottom);
    }
}
```

---

## 6. Saving Pre-Tile Floating Geometry (`untiledRect`)

When a user untiles a window (via shortcut or dragging away), it should return to its original floating dimensions. Save this state directly onto the `Meta.Window` instance or in an internal WeakMap:

```javascript
const windowTileState = new WeakMap();

export function recordPreTileState(window) {
    if (!windowTileState.has(window)) {
        windowTileState.set(window, {
            untiledRect: window.get_frame_rect().copy(),
            isTiled: false,
        });
    }
}

export function restorePreTileState(window, { restoreFullPos = true } = {}) {
    const state = windowTileState.get(window);
    if (!state || !state.untiledRect) return;

    if (restoreFullPos) {
        window.move_frame(true, state.untiledRect.x, state.untiledRect.y);
        window.move_resize_frame(
            true,
            state.untiledRect.x,
            state.untiledRect.y,
            state.untiledRect.width,
            state.untiledRect.height
        );
    } else {
        // Keep current titlebar position, only restore dimensions
        const curRect = window.get_frame_rect();
        window.move_resize_frame(
            true,
            curRect.x,
            curRect.y,
            state.untiledRect.width,
            state.untiledRect.height
        );
    }

    windowTileState.delete(window);
}
```
