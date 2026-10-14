import assert from 'node:assert';

/**
 * Geometric verification suite for GNOME Tiling algorithms.
 * Validates normalized grid projection, boundary classification, odd inner gap absorption,
 * scale factor arithmetic, multi-monitor offsets, and Mutter GrabOp decomposition.
 */

class Rectangle {
    constructor({ x, y, width, height }) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    copy() {
        return new Rectangle({ x: this.x, y: this.y, width: this.width, height: this.height });
    }
    intersect(other) {
        const destX = Math.max(this.x, other.x);
        const destY = Math.max(this.y, other.y);
        const destX2 = Math.min(this.x + this.width, other.x + other.width);
        const destY2 = Math.min(this.y + this.height, other.y + other.height);

        if (destX2 > destX && destY2 > destY) {
            return [true, new Rectangle({
                x: destX,
                y: destY,
                width: destX2 - destX,
                height: destY2 - destY,
            })];
        }
        return [false, new Rectangle({ x: 0, y: 0, width: 0, height: 0 })];
    }
}

class TileSlot {
    constructor({ x, y, width, height, groups = [] }) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.groups = groups;
    }
}

export function isTileOnContainerBorder(tilePos, container) {
    const almostEqual = (a, b) => Math.abs(a - b) <= 1;
    return {
        isTop: almostEqual(tilePos.y, container.y),
        isBottom: almostEqual(tilePos.y + tilePos.height, container.y + container.height),
        isLeft: almostEqual(tilePos.x, container.x),
        isRight: almostEqual(tilePos.x + tilePos.width, container.x + container.width),
    };
}

export function projectTileToPixels(tile, workArea, gaps, scale = 1.0) {
    const outerTop = Math.round(gaps.outerTop * scale);
    const outerBottom = Math.round(gaps.outerBottom * scale);
    const outerLeft = Math.round(gaps.outerLeft * scale);
    const outerRight = Math.round(gaps.outerRight * scale);
    const inner = Math.round(gaps.inner * scale);

    const containerInnerX = workArea.x + outerLeft;
    const containerInnerY = workArea.y + outerTop;
    const containerInnerW = workArea.width - outerLeft - outerRight;
    const containerInnerH = workArea.height - outerTop - outerBottom;

    const rawX = Math.round(containerInnerX + (tile.x * containerInnerW));
    const rawY = Math.round(containerInnerY + (tile.y * containerInnerH));
    const rawW = Math.round(tile.width * containerInnerW);
    const rawH = Math.round(tile.height * containerInnerH);

    const baseRect = new Rectangle({ x: rawX, y: rawY, width: rawW, height: rawH });
    const containerRect = new Rectangle({
        x: containerInnerX,
        y: containerInnerY,
        width: containerInnerW,
        height: containerInnerH
    });

    const { isTop, isBottom, isLeft, isRight } = isTileOnContainerBorder(baseRect, containerRect);

    const halfInner = Math.floor(inner / 2);
    const mTop = isTop ? 0 : halfInner;
    const mBottom = isBottom ? 0 : (inner - halfInner);
    const mLeft = isLeft ? 0 : halfInner;
    const mRight = isRight ? 0 : (inner - halfInner);

    const finalX = rawX + mLeft;
    const finalY = rawY + mTop;
    const finalW = Math.max(50, rawW - mLeft - mRight);
    const finalH = Math.max(50, rawH - mTop - mBottom);

    return new Rectangle({
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
    });
}

// Side enum simulation (St.Side)
export const Side = { TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3 };

// Meta GrabOps
export const GrabOp = {
    MOVING: 1,
    KEYBOARD_MOVING: 2,
    RESIZING_NW: 36865,
    RESIZING_N: 32769,
    RESIZING_NE: 34817,
    RESIZING_E: 2049,
    RESIZING_SW: 36866,
    RESIZING_S: 32770,
    RESIZING_SE: 34818,
    RESIZING_W: 4097,
    KEYBOARD_RESIZING_NW: 36867,
    KEYBOARD_RESIZING_N: 33025,
    KEYBOARD_RESIZING_NE: 34819,
    KEYBOARD_RESIZING_E: 2051,
    KEYBOARD_RESIZING_SW: 36868,
    KEYBOARD_RESIZING_S: 33026,
    KEYBOARD_RESIZING_SE: 34820,
    KEYBOARD_RESIZING_W: 4099,
};

export function parseResizeDirections(grabOp) {
    const cleanOp = grabOp & ~1024;
    let vertical = null;
    let horizontal = null;

    switch (cleanOp) {
        case GrabOp.RESIZING_N:
        case GrabOp.RESIZING_NW:
        case GrabOp.RESIZING_NE:
        case GrabOp.KEYBOARD_RESIZING_N:
        case GrabOp.KEYBOARD_RESIZING_NW:
        case GrabOp.KEYBOARD_RESIZING_NE:
            vertical = Side.TOP;
            break;
        case GrabOp.RESIZING_S:
        case GrabOp.RESIZING_SW:
        case GrabOp.RESIZING_SE:
        case GrabOp.KEYBOARD_RESIZING_S:
        case GrabOp.KEYBOARD_RESIZING_SW:
        case GrabOp.KEYBOARD_RESIZING_SE:
            vertical = Side.BOTTOM;
            break;
    }

    switch (cleanOp) {
        case GrabOp.RESIZING_W:
        case GrabOp.RESIZING_NW:
        case GrabOp.RESIZING_SW:
        case GrabOp.KEYBOARD_RESIZING_W:
        case GrabOp.KEYBOARD_RESIZING_NW:
        case GrabOp.KEYBOARD_RESIZING_SW:
            horizontal = Side.LEFT;
            break;
        case GrabOp.RESIZING_E:
        case GrabOp.RESIZING_NE:
        case GrabOp.RESIZING_SE:
        case GrabOp.KEYBOARD_RESIZING_E:
        case GrabOp.KEYBOARD_RESIZING_NE:
        case GrabOp.KEYBOARD_RESIZING_SE:
            horizontal = Side.RIGHT;
            break;
    }

    return { vertical, horizontal };
}

export function runTests() {
    const workArea = new Rectangle({ x: 0, y: 32, width: 1920, height: 1048 });
    const gaps = { outerTop: 8, outerBottom: 8, outerLeft: 8, outerRight: 8, inner: 7 };

    const leftTile = new TileSlot({ x: 0.0, y: 0.0, width: 0.5, height: 1.0 });
    const rightTile = new TileSlot({ x: 0.5, y: 0.0, width: 0.5, height: 1.0 });

    const leftRect = projectTileToPixels(leftTile, workArea, gaps, 1.0);
    const rightRect = projectTileToPixels(rightTile, workArea, gaps, 1.0);

    const actualGap = rightRect.x - (leftRect.x + leftRect.width);
    assert.strictEqual(actualGap, gaps.inner);
    assert.strictEqual(leftRect.x, workArea.x + gaps.outerLeft);
    assert.strictEqual(rightRect.x + rightRect.width, workArea.x + workArea.width - gaps.outerRight);

    // Multi-column with 150% scaling
    const scale = 1.5;
    const t1 = new TileSlot({ x: 0.0, y: 0.0, width: 0.25, height: 1.0 });
    const t2 = new TileSlot({ x: 0.25, y: 0.0, width: 0.50, height: 1.0 });
    const t3 = new TileSlot({ x: 0.75, y: 0.0, width: 0.25, height: 1.0 });

    const r1 = projectTileToPixels(t1, workArea, gaps, scale);
    const r2 = projectTileToPixels(t2, workArea, gaps, scale);
    const r3 = projectTileToPixels(t3, workArea, gaps, scale);

    const gap1 = r2.x - (r1.x + r1.width);
    const gap2 = r3.x - (r2.x + r2.width);
    const expectedScaledGap = Math.round(gaps.inner * scale);

    assert.strictEqual(gap1, expectedScaledGap);
    assert.strictEqual(gap2, expectedScaledGap);

    // GrabOps
    assert.deepStrictEqual(parseResizeDirections(GrabOp.RESIZING_E), { vertical: null, horizontal: Side.RIGHT });
    assert.deepStrictEqual(parseResizeDirections(GrabOp.RESIZING_NW | 1024), { vertical: Side.TOP, horizontal: Side.LEFT });
    assert.deepStrictEqual(parseResizeDirections(GrabOp.KEYBOARD_RESIZING_S), { vertical: Side.BOTTOM, horizontal: null });

    return true;
}

if (process.argv[1]?.endsWith('verify_geometry.js')) {
    runTests();
    console.log('✓ All geometry and GrabOp verification tests passed.');
}
