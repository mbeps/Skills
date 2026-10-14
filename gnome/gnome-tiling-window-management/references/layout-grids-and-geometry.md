# Layout Grids & Coordinate Geometry (GNOME 45+)

Tiling extensions partition monitor work areas into predictable, discrete window slots. High-quality window managers avoid hardcoding pixel coordinates because monitor resolutions, aspect ratios, fractional scaling factors, and system chrome (panels, docks) vary dynamically. Instead, layouts are modeled in **normalized coordinate space** `[0.0, 1.0]` and projected onto the monitor's usable workarea at runtime.

---

## 1. Normalized Grid Model

A layout is represented as a collection of tiles, where each tile defines a unit rectangle relative to the monitor's work area:

```javascript
// Normalized Tile Definition
export class TileSlot {
    /**
     * @param {Object} params
     * @param {number} params.x - Normalized horizontal offset [0.0 - 1.0]
     * @param {number} params.y - Normalized vertical offset [0.0 - 1.0]
     * @param {number} params.width - Normalized width ratio [0.0 - 1.0]
     * @param {number} params.height - Normalized height ratio [0.0 - 1.0]
     * @param {number[]} [params.groups] - Optional group IDs for synchronized behaviors
     */
    constructor({ x, y, width, height, groups = [] }) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.groups = groups;
    }
}
```

### Common Layout Definitions

```javascript
export const STANDARD_LAYOUTS = {
    // 2-column: 50% / 50% split
    SPLIT_HALF: [
        new TileSlot({ x: 0.0, y: 0.0, width: 0.5, height: 1.0 }),
        new TileSlot({ x: 0.5, y: 0.0, width: 0.5, height: 1.0 }),
    ],

    // 3-column: 25% / 50% / 25% (Master in center)
    THREE_COLUMN_CENTER_MASTER: [
        new TileSlot({ x: 0.0, y: 0.0, width: 0.25, height: 1.0 }),
        new TileSlot({ x: 0.25, y: 0.0, width: 0.50, height: 1.0 }),
        new TileSlot({ x: 0.75, y: 0.0, width: 0.25, height: 1.0 }),
    ],

    // 2x2 Quarter Grid
    QUARTERS: [
        new TileSlot({ x: 0.0, y: 0.0, width: 0.5, height: 0.5 }), // Top-Left
        new TileSlot({ x: 0.5, y: 0.0, width: 0.5, height: 0.5 }), // Top-Right
        new TileSlot({ x: 0.0, y: 0.5, width: 0.5, height: 0.5 }), // Bottom-Left
        new TileSlot({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 }), // Bottom-Right
    ],

    // 1 Master (left 60%) + 2 Stacks (right 40% stacked vertically)
    MASTER_STACK_VERTICAL: [
        new TileSlot({ x: 0.0, y: 0.0, width: 0.6, height: 1.0 }),
        new TileSlot({ x: 0.6, y: 0.0, width: 0.4, height: 0.5 }),
        new TileSlot({ x: 0.6, y: 0.5, width: 0.4, height: 0.5 }),
    ],
};
```

---

## 2. Work Area Computation Across Monitors

In Mutter, the usable screen area excluding the top bar and permanent docks is the **work area**. Always query the workspace for the target monitor:

```javascript
import Mtk from 'gi://Mtk';

/**
 * Returns the exact bounding box for a monitor workarea.
 * @param {number} monitorIndex
 * @returns {Mtk.Rectangle}
 */
export function getMonitorWorkArea(monitorIndex) {
    const ws = global.workspace_manager.get_active_workspace();
    // Querying active workspace guarantees per-workspace dock reservations are included
    return ws.get_work_area_for_monitor(monitorIndex);
}
```

> **Warning:** Do not use `Main.layoutManager.monitors[index]` directly for window placement. The monitor geometry represents the physical display viewport including system chrome (panel, dash). `ws.get_work_area_for_monitor(monitorIndex)` correctly excludes reserved struts.

---

## 3. Pixel Transformation & Gap Mathematics

Tiling systems must support two distinct types of spacing:
1. **Outer Screen Gaps:** Padding between windows and the monitor/panel boundaries (top, bottom, left, right).
2. **Inner Window Gaps:** Margins separating neighboring windows. To keep borders uniform, adjacent edges share half the inner gap.

```text
┌─────────────────────────────────────────────────────────────────┐
│ Monitor Boundary (Outer Gap: Top)                              │
│   ┌────────────────────────┐  Inner  ┌──────────────────────┐   │
│ O │                        │   Gap   │                      │ O │
│ G │        Window 1        │◄───────►│       Window 2       │ G │
│ : │                        │         │                      │ : │
│ L │                        │         │                      │ R │
│   └────────────────────────┘         └──────────────────────┘   │
│ Monitor Boundary (Outer Gap: Bottom)                            │
└─────────────────────────────────────────────────────────────────┘
```

### HiDPI & Monitor Scale Factors

Gaps must be scaled according to the monitor's scaling factor to prevent microscopic gaps on 4K/HiDPI screens:

```javascript
import St from 'gi://St';

/**
 * Resolves the effective scale factor for a given monitor.
 * @param {number} monitorIndex
 * @returns {number}
 */
export function getMonitorScalingFactor(monitorIndex) {
    const stageScale = St.ThemeContext.get_for_stage(global.get_stage()).get_scale_factor();
    if (stageScale === 1 && typeof global.display.get_monitor_scale === 'function') {
        return global.display.get_monitor_scale(monitorIndex);
    }
    return stageScale;
}
```

### Production Gap Calculation Algorithm

Rather than subtracting arbitrary pixel fractions, the battle-tested pattern (used in `tilingshell`) detects whether a tile edge touches the outer container boundary:

```javascript
import Clutter from 'gi://Clutter';
import Mtk from 'gi://Mtk';

/**
 * Determines which edges of a tile coincide with the container's outer bounds.
 * @param {Mtk.Rectangle} tilePos
 * @param {Mtk.Rectangle} container
 * @returns {{ isTop: boolean, isRight: boolean, isBottom: boolean, isLeft: boolean }}
 */
export function isTileOnContainerBorder(tilePos, container) {
    const almostEqual = (a, b) => Math.abs(a - b) <= 1;
    return {
        isTop: almostEqual(tilePos.y, container.y),
        isBottom: almostEqual(tilePos.y + tilePos.height, container.y + container.height),
        isLeft: almostEqual(tilePos.x, container.x),
        isRight: almostEqual(tilePos.x + tilePos.width, container.x + container.width),
    };
}

/**
 * Projects a normalized TileSlot to pixel coordinates with robust inner/outer gap arithmetic.
 *
 * @param {TileSlot} tile - Normalized tile
 * @param {Mtk.Rectangle} workArea - Monitor work area
 * @param {Object} gaps
 * @param {number} gaps.outerTop
 * @param {number} gaps.outerBottom
 * @param {number} gaps.outerLeft
 * @param {number} gaps.outerRight
 * @param {number} gaps.inner
 * @param {number} monitorIndex
 * @returns {Mtk.Rectangle}
 */
export function projectTileToPixels(tile, workArea, gaps, monitorIndex) {
    const scale = getMonitorScalingFactor(monitorIndex);

    const outerTop = Math.round(gaps.outerTop * scale);
    const outerBottom = Math.round(gaps.outerBottom * scale);
    const outerLeft = Math.round(gaps.outerLeft * scale);
    const outerRight = Math.round(gaps.outerRight * scale);
    const inner = Math.round(gaps.inner * scale);

    // 1. Calculate container bounds inside outer margins
    const containerInnerX = workArea.x + outerLeft;
    const containerInnerY = workArea.y + outerTop;
    const containerInnerW = workArea.width - outerLeft - outerRight;
    const containerInnerH = workArea.height - outerTop - outerBottom;

    // 2. Base raw geometry from normalized ratios
    const rawX = Math.round(containerInnerX + (tile.x * containerInnerW));
    const rawY = Math.round(containerInnerY + (tile.y * containerInnerH));
    const rawW = Math.round(tile.width * containerInnerW);
    const rawH = Math.round(tile.height * containerInnerH);

    const baseRect = new Mtk.Rectangle({ x: rawX, y: rawY, width: rawW, height: rawH });
    const containerRect = new Mtk.Rectangle({
        x: containerInnerX,
        y: containerInnerY,
        width: containerInnerW,
        height: containerInnerH
    });

    const { isTop, isBottom, isLeft, isRight } = isTileOnContainerBorder(baseRect, containerRect);

    // 3. Margin deductions: outer gap if edge touches border, else half inner gap
    const halfInner = Math.floor(inner / 2);
    const mTop = isTop ? 0 : halfInner;
    const mBottom = isBottom ? 0 : (inner - halfInner); // preserves odd pixel sum
    const mLeft = isLeft ? 0 : halfInner;
    const mRight = isRight ? 0 : (inner - halfInner);

    const finalX = rawX + mLeft;
    const finalY = rawY + mTop;
    const finalW = Math.max(50, rawW - mLeft - mRight);
    const finalH = Math.max(50, rawH - mTop - mBottom);

    return new Mtk.Rectangle({
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
    });
}
```

---

## 4. Reverse Mapping: Pixel Rect to Normalized Slot

When a user snaps a window by edge or drags a window into a custom position, reverse projection determines which slot is occupied or what normalized rectangle matches the window's geometry:

```javascript
/**
 * Converts a pixel rectangle into normalized coordinates relative to workarea.
 * @param {Mtk.Rectangle} pixelRect
 * @param {Mtk.Rectangle} workArea
 * @returns {TileSlot}
 */
export function pixelRectToNormalized(pixelRect, workArea) {
    const nx = (pixelRect.x - workArea.x) / workArea.width;
    const ny = (pixelRect.y - workArea.y) / workArea.height;
    const nw = pixelRect.width / workArea.width;
    const nh = pixelRect.height / workArea.height;

    // Clamp between 0.0 and 1.0 with rounding to eliminate floating point jitter
    const round3 = n => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;

    return new TileSlot({
        x: round3(nx),
        y: round3(ny),
        width: round3(nw),
        height: round3(nh),
    });
}
```

---

## 5. Detecting Free Screen Geometry (Two Production Approaches)

There are two primary paradigms used by production extensions to detect unoccupied screen space:

### Paradigm A: Layout Slot Matching (`tilingshell` Model)
Instead of attempting arbitrary geometric splitting, map open windows against the active layout's pre-defined slots. Any slot whose projected rectangle does not intersect an existing tiled window is considered vacant. This is deterministic, matches user expectations, and avoids geometry fragmentation.

```javascript
/**
 * Finds vacant slots in an active layout by testing overlap with tiled windows.
 * @param {TileSlot[]} layoutSlots
 * @param {Mtk.Rectangle} workArea
 * @param {Object} gaps
 * @param {number} monitorIndex
 * @param {Meta.Window[]} tiledWindows
 * @returns {Mtk.Rectangle[]} Array of vacant pixel rectangles
 */
export function getVacantLayoutSlots(layoutSlots, workArea, gaps, monitorIndex, tiledWindows) {
    const vacantRects = [];

    for (const slot of layoutSlots) {
        const slotPixelRect = projectTileToPixels(slot, workArea, gaps, monitorIndex);
        const isOccupied = tiledWindows.some(win => {
            const winRect = win.get_frame_rect();
            const [intersects, inter] = slotPixelRect.intersect(winRect);
            if (!intersects) return false;
            // Overlap area check (must overlap by at least 50% to count as occupied)
            return (inter.width * inter.height) > (slotPixelRect.width * slotPixelRect.height * 0.5);
        });

        if (!isOccupied) {
            vacantRects.push(slotPixelRect);
        }
    }

    return vacantRects;
}
```

### Paradigm B: Free Rect Partitioning (`tiling-assistant` Model)
Subtracts occupied window rectangles from the monitor workarea to find maximal free rectangular bounding boxes:

```javascript
import Mtk from 'gi://Mtk';

export class GeometryUtils {
    static areRectsEqual(r1, r2, margin = 2) {
        return Math.abs(r1.x - r2.x) <= margin &&
               Math.abs(r1.y - r2.y) <= margin &&
               Math.abs(r1.width - r2.width) <= margin &&
               Math.abs(r1.height - r2.height) <= margin;
    }

    /**
     * Calculates unoccupied rectangles by cutting occupied areas out of the work area.
     * @param {Mtk.Rectangle} workArea
     * @param {Mtk.Rectangle[]} occupiedRects
     * @returns {Mtk.Rectangle[]}
     */
    static findFreeScreenRects(workArea, occupiedRects) {
        let freeAreas = [workArea.copy()];

        for (const occupied of occupiedRects) {
            const nextFree = [];
            for (const free of freeAreas) {
                const [intersects, inter] = free.intersect(occupied);
                if (!intersects) {
                    nextFree.push(free);
                    continue;
                }

                // Partition the free area into 4 surrounding rectangular slices
                if (inter.y > free.y) {
                    nextFree.push(new Mtk.Rectangle({
                        x: free.x, y: free.y, width: free.width, height: inter.y - free.y,
                    }));
                }
                if (free.y + free.height > inter.y + inter.height) {
                    nextFree.push(new Mtk.Rectangle({
                        x: free.x, y: inter.y + inter.height,
                        width: free.width, height: (free.y + free.height) - (inter.y + inter.height),
                    }));
                }
                if (inter.x > free.x) {
                    nextFree.push(new Mtk.Rectangle({
                        x: free.x, y: inter.y, width: inter.x - free.x, height: inter.height,
                    }));
                }
                if (free.x + free.width > inter.x + inter.width) {
                    nextFree.push(new Mtk.Rectangle({
                        x: inter.x + inter.width, y: inter.y,
                        width: (free.x + free.width) - (inter.x + inter.width), height: inter.height,
                    }));
                }
            }
            // Discard slices smaller than minimum usable window dimensions
            freeAreas = nextFree.filter(r => r.width >= 160 && r.height >= 120);
        }

        return freeAreas;
    }
}
```

---

## 6. Mutter Vertical/Horizontal Maximize Flags

When a tile's bounds touch both the top and bottom of the work area (e.g. 50/50 left or right split), Mutter supports setting `Meta.MaximizeFlags.VERTICAL`:

```javascript
import Meta from 'gi://Meta';

/**
 * Applies vertical/horizontal maximize flags when a tile spans the full monitor axis.
 * @param {Meta.Window} window
 * @param {Mtk.Rectangle} targetRect
 * @param {Mtk.Rectangle} workArea
 */
export function applySpanMaximizeFlags(window, targetRect, workArea) {
    const isFullHeight = targetRect.y === workArea.y && targetRect.height === workArea.height;
    const isFullWidth = targetRect.x === workArea.x && targetRect.width === workArea.width;

    if (isFullHeight && !isFullWidth) {
        if (typeof window.set_maximize_flags === 'function') {
            window.set_maximize_flags(Meta.MaximizeFlags.VERTICAL);
        }
    } else if (isFullWidth && !isFullHeight) {
        if (typeof window.set_maximize_flags === 'function') {
            window.set_maximize_flags(Meta.MaximizeFlags.HORIZONTAL);
        }
    }
}
```

---

## 7. Edge Cases & Trap Avoidance

1. **Fractional Scaling Jitter:** On displays with 125% or 150% fractional scaling, integer rounding can cause 1-pixel borders or overlapping gaps. Always compute intermediate coordinates with `Math.round()` and let odd inner gaps be absorbed by complementary opposite margins (`inner - halfInner`).
2. **Dynamic Workarea Changes:** When an external panel (e.g., Dash to Panel, Dash to Dock) hides or expands, `global.display.connect('workareas-changed', ...)` fires. Cache the last known work area per monitor; when a change is detected, re-project all tiled windows to fit the new boundaries.
3. **Multi-Monitor Coordinate Offsets:** Work areas on secondary monitors have non-zero `x` or `y` offsets (e.g., monitor 2 at `x = 1920, y = 0`). Never assume `workArea.x === 0`.
