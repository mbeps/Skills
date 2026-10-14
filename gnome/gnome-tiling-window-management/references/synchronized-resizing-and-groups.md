# Synchronized Resizing & Window Groups (GNOME 45+)

When windows are tiled into adjacent slots, users expect them to act as a cohesive unit. This entails two primary features:
1. **Raise Together (Window Groups):** Focusing or clicking any window in a tiled set brings all grouped windows to the top of the stack above floating windows.
2. **Synchronized (Complementary) Resizing:** Dragging the border between two tiled windows resizes both windows simultaneously, expanding one while shrinking the other to preserve the layout grid.

---

## 1. Window Grouping & Raise Together

### Infinite Recursion Defense

The core pitfall when implementing "Raise Together" is the recursive signal storm. When Window 1 is focused, Mutter emits its `raised` signal. Raising Window 2 inside that handler causes Mutter to emit Window 2's `raised` signal, triggering an infinite loop that freezes GNOME Shell.

You **must** temporarily block signal handlers using `GObject.Object.block_signal_handler()` during raising operations.

```text
User clicks Window A
       │
       ▼
Emit: Window A "raised"
       │
       ▼
Block Window B "raised" handler ◄── Prevent recursive echo
       │
       ▼
Window B.raise()
       │
       ▼
Unblock Window B "raised" handler
```

### Complete Implementation

```javascript
export class WindowGroupManager {
    constructor() {
        this._tileGroups = new Map(); // windowId -> Set of windowIds
        this._signalHandlers = new Map(); // windowId -> { raisedId, unmanagingId, wsChangedId, window }
    }

    /**
     * Registers a set of windows as a mutual tile group.
     * @param {Meta.Window[]} windows
     */
    registerGroup(windows) {
        const groupIds = new Set(windows.map(w => w.get_id()));

        for (const win of windows) {
            const winId = win.get_id();
            this._tileGroups.set(winId, groupIds);
            this._attachSignals(win);
        }
    }

    _attachSignals(window) {
        const winId = window.get_id();
        if (this._signalHandlers.has(winId)) return;

        const raisedId = window.connect('raised', () => {
            this._onWindowRaised(window);
        });

        const unmanagingId = window.connect('unmanaging', () => {
            this.unregisterWindow(winId);
        });

        const wsChangedId = window.connect('workspace-changed', () => {
            this._onWindowWorkspaceChanged(window);
        });

        this._signalHandlers.set(winId, { raisedId, unmanagingId, wsChangedId, window });
    }

    _onWindowRaised(triggerWindow) {
        const triggerId = triggerWindow.get_id();
        const group = this._tileGroups.get(triggerId);
        if (!group || group.size <= 1) return;

        const activeWs = global.workspace_manager.get_active_workspace();

        // Raise each partner window with blocked signal handler
        for (const partnerId of group) {
            if (partnerId === triggerId) continue;

            const handlerData = this._signalHandlers.get(partnerId);
            if (!handlerData || !handlerData.window) continue;

            const partnerWin = handlerData.window;

            // Only raise if on active workspace
            if (partnerWin.get_workspace() !== activeWs) continue;

            partnerWin.block_signal_handler(handlerData.raisedId);

            if (typeof partnerWin.raise_and_make_recent_on_workspace === 'function') {
                partnerWin.raise_and_make_recent_on_workspace(activeWs);
            } else {
                partnerWin.raise();
            }

            partnerWin.unblock_signal_handler(handlerData.raisedId);
        }

        // Re-raise trigger window so it remains at top of active group
        const triggerData = this._signalHandlers.get(triggerId);
        if (triggerData) {
            triggerWindow.block_signal_handler(triggerData.raisedId);
            if (typeof triggerWindow.raise_and_make_recent_on_workspace === 'function') {
                triggerWindow.raise_and_make_recent_on_workspace(activeWs);
            } else {
                triggerWindow.raise();
            }
            triggerWindow.unblock_signal_handler(triggerData.raisedId);
        }
    }

    _onWindowWorkspaceChanged(window) {
        const winId = window.get_id();
        const group = this._tileGroups.get(winId);
        if (!group) return;

        const targetWs = window.get_workspace();
        if (!targetWs) return;

        // Move all partner windows to the new workspace together
        for (const partnerId of group) {
            if (partnerId === winId) continue;
            const data = this._signalHandlers.get(partnerId);
            if (data?.window && data.window.get_workspace() !== targetWs) {
                data.window.change_workspace(targetWs);
            }
        }
    }

    unregisterWindow(windowId) {
        const handlerData = this._signalHandlers.get(windowId);
        if (handlerData && handlerData.window) {
            handlerData.window.disconnect(handlerData.raisedId);
            handlerData.window.disconnect(handlerData.unmanagingId);
            handlerData.window.disconnect(handlerData.wsChangedId);
        }
        this._signalHandlers.delete(windowId);

        const group = this._tileGroups.get(windowId);
        if (group) {
            group.delete(windowId);
            this._tileGroups.delete(windowId);
        }
    }

    destroy() {
        for (const winId of Array.from(this._signalHandlers.keys())) {
            this.unregisterWindow(winId);
        }
        this._tileGroups.clear();
    }
}
```

---

## 2. Synchronized (Complementary) Resizing

### Full GrabOp Classification (Mouse, Keyboard & Corners)

During window resizes, `global.display` issues `grab-op-begin` with specific directions. Resizes must handle cardinal, intercardinal (corners), and keyboard variants:

```javascript
import Meta from 'gi://Meta';
import St from 'gi://St';

/**
 * Deconstructs any Mutter resize GrabOp into vertical and horizontal components.
 * @param {number} grabOp
 * @returns {{ vertical: number|null, horizontal: number|null }}
 */
export function parseResizeDirections(grabOp) {
    const cleanOp = grabOp & ~1024; // Strip unconstrained flag
    let vertical = null;
    let horizontal = null;

    // Vertical components
    switch (cleanOp) {
        case Meta.GrabOp.RESIZING_N:
        case Meta.GrabOp.RESIZING_NW:
        case Meta.GrabOp.RESIZING_NE:
        case Meta.GrabOp.KEYBOARD_RESIZING_N:
        case Meta.GrabOp.KEYBOARD_RESIZING_NW:
        case Meta.GrabOp.KEYBOARD_RESIZING_NE:
            vertical = St.Side.TOP;
            break;
        case Meta.GrabOp.RESIZING_S:
        case Meta.GrabOp.RESIZING_SW:
        case Meta.GrabOp.RESIZING_SE:
        case Meta.GrabOp.KEYBOARD_RESIZING_S:
        case Meta.GrabOp.KEYBOARD_RESIZING_SW:
        case Meta.GrabOp.KEYBOARD_RESIZING_SE:
            vertical = St.Side.BOTTOM;
            break;
    }

    // Horizontal components
    switch (cleanOp) {
        case Meta.GrabOp.RESIZING_W:
        case Meta.GrabOp.RESIZING_NW:
        case Meta.GrabOp.RESIZING_SW:
        case Meta.GrabOp.KEYBOARD_RESIZING_W:
        case Meta.GrabOp.KEYBOARD_RESIZING_NW:
        case Meta.GrabOp.KEYBOARD_RESIZING_SW:
            horizontal = St.Side.LEFT;
            break;
        case Meta.GrabOp.RESIZING_E:
        case Meta.GrabOp.RESIZING_NE:
        case Meta.GrabOp.RESIZING_SE:
        case Meta.GrabOp.KEYBOARD_RESIZING_E:
        case Meta.GrabOp.KEYBOARD_RESIZING_NE:
        case Meta.GrabOp.KEYBOARD_RESIZING_SE:
            horizontal = St.Side.RIGHT;
            break;
    }

    return { vertical, horizontal };
}
```

---

## 3. Seam Detection & Relationship Mapping

Bordering windows can have two relationships with the resized edge:
- **OPPOSING:** Windows on the other side of the dividing line. When Window A expands East, Window B's West edge contracts by the same delta.
- **SAME:** Windows stacked alongside Window A that share the boundary. When Window A expands East, Window C also expands East.

```javascript
import Mtk from 'gi://Mtk';
import St from 'gi://St';

/**
 * Finds adjacent partners and classifies whether they share the same border or face opposingly.
 *
 * @param {Meta.Window} window
 * @param {number} side - St.Side enum
 * @param {Meta.Window[]} candidateWindows
 * @param {number} innerGap
 * @returns {Array<{partner: Meta.Window, isOpposing: boolean}>}
 */
export function findBorderingWindows(window, side, candidateWindows, innerGap = 4) {
    const winRect = window.get_frame_rect();
    const probeRect = winRect.copy();
    const tolerance = innerGap * 3 + 4;

    // Expand probe rect across the border boundary
    switch (side) {
        case St.Side.TOP:
            probeRect.y -= tolerance;
            probeRect.height = tolerance;
            break;
        case St.Side.BOTTOM:
            probeRect.y += probeRect.height;
            probeRect.height = tolerance;
            break;
        case St.Side.LEFT:
            probeRect.x -= tolerance;
            probeRect.width = tolerance;
            break;
        case St.Side.RIGHT:
            probeRect.x += probeRect.width;
            probeRect.width = tolerance;
            break;
    }

    const partners = [];

    for (const other of candidateWindows) {
        if (other === window) continue;
        const otherRect = other.get_frame_rect();
        const [hasInter, inter] = otherRect.intersect(probeRect);
        if (!hasInter) continue;

        // Verify meaningful overlap along the parallel axis
        const isParallelOverlap = (side === St.Side.LEFT || side === St.Side.RIGHT)
            ? inter.height > 20
            : inter.width > 20;

        if (isParallelOverlap) {
            partners.push({ partner: other, isOpposing: true });
        }
    }

    return partners;
}
```

---

## 4. Live Complementary Delta Resize Execution

Listen to `size-changed` on the actively dragged window and synchronously compute and apply inverse dimensions to opposing partners:

```javascript
export class ComplementaryResizeController {
    constructor() {
        this._activeResize = null;
    }

    startResize(window, grabOp, candidateGroup, innerGap = 4) {
        const { vertical, horizontal } = parseResizeDirections(grabOp);
        if (vertical === null && horizontal === null) return;

        const startRect = window.get_frame_rect().copy();

        const vPartners = vertical !== null ? findBorderingWindows(window, vertical, candidateGroup, innerGap) : [];
        const hPartners = horizontal !== null ? findBorderingWindows(window, horizontal, candidateGroup, innerGap) : [];

        // Snapshot initial geometries of all partners
        const partnerSnapshots = new Map();
        for (const { partner } of [...vPartners, ...hPartners]) {
            if (!partnerSnapshots.has(partner.get_id())) {
                partnerSnapshots.set(partner.get_id(), {
                    partner,
                    initialRect: partner.get_frame_rect().copy(),
                });
            }
        }

        const sizeChangedId = window.connect('size-changed', () => {
            const curRect = window.get_frame_rect();
            const deltaX = curRect.x - startRect.x;
            const deltaY = curRect.y - startRect.y;
            const deltaW = curRect.width - startRect.width;
            const deltaH = curRect.height - startRect.height;

            // Apply horizontal inverse delta
            if (horizontal === St.Side.RIGHT) {
                for (const { partner } of hPartners) {
                    const snap = partnerSnapshots.get(partner.get_id());
                    const newX = snap.initialRect.x + deltaW;
                    const newW = Math.max(120, snap.initialRect.width - deltaW);
                    partner.move_resize_frame(false, newX, snap.initialRect.y, newW, snap.initialRect.height);
                }
            } else if (horizontal === St.Side.LEFT) {
                for (const { partner } of hPartners) {
                    const snap = partnerSnapshots.get(partner.get_id());
                    const newW = Math.max(120, snap.initialRect.width + deltaX);
                    partner.move_resize_frame(false, snap.initialRect.x, snap.initialRect.y, newW, snap.initialRect.height);
                }
            }

            // Apply vertical inverse delta
            if (vertical === St.Side.BOTTOM) {
                for (const { partner } of vPartners) {
                    const snap = partnerSnapshots.get(partner.get_id());
                    const newY = snap.initialRect.y + deltaH;
                    const newH = Math.max(100, snap.initialRect.height - deltaH);
                    partner.move_resize_frame(false, snap.initialRect.x, newY, snap.initialRect.width, newH);
                }
            } else if (vertical === St.Side.TOP) {
                for (const { partner } of vPartners) {
                    const snap = partnerSnapshots.get(partner.get_id());
                    const newH = Math.max(100, snap.initialRect.height + deltaY);
                    partner.move_resize_frame(false, snap.initialRect.x, snap.initialRect.y, snap.initialRect.width, newH);
                }
            }
        });

        this._activeResize = { window, sizeChangedId };
    }

    endResize() {
        if (this._activeResize) {
            this._activeResize.window.disconnect(this._activeResize.sizeChangedId);
            this._activeResize = null;
        }
    }
}
```

---

## 5. Edge Cases & Trap Avoidance

1. **Size Hint Constraints (Terminal Grids):** Applications like `gnome-terminal` only resize in discrete character cell increments (e.g., 9px horizontal, 17px vertical). Setting `user_op = false` during passive partner resizes allows Mutter to honor terminal cell increments without stuttering.
2. **Minimum Window Size Limits:** When shrinking a partner window, always clamp with `Math.max(newDimension, minSize)` (minimum 100–150px). If an application refuses to shrink further, stop advancing the complementary resize to avoid window overlap.
3. **Workspace Switching Isolation:** Groups must only be raised if all partner windows belong to the active workspace. Check `partner.get_workspace() === global.workspace_manager.get_active_workspace()` before calling `raise()`.
