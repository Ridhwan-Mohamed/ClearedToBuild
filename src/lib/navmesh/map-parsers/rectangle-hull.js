/**
 * Class for managing hulls created by combining square tiles.
 */
export class RectangleHull {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    setSize(width, height) {
        this.width = width;
        this.height = height;
    }
    set(left, top, width, height) {
        this.setPosition(left, top);
        this.setSize(width, height);
    }
    get left() {
        return this.x;
    }
    set left(val) {
        this.x = val;
    }
    get top() {
        return this.y;
    }
    set top(val) {
        this.y = val;
    }
    // TODO: make consistent. Either left/right should both resize or they should both just reposition
    get right() {
        return this.x + this.width;
    }
    set right(val) {
        this.width = val - this.x;
    }
    get bottom() {
        return this.y + this.height;
    }
    set bottom(val) {
        this.height = val - this.top;
    }
    get center() {
        return { x: (this.x + this.right) / 2, y: (this.y + this.bottom) / 2 };
    }
    doesOverlap(otherHull) {
        return !(this.right < otherHull.x ||
            this.x > otherHull.right ||
            this.y > otherHull.bottom ||
            this.bottom < otherHull.y);
    }
    /**
     * Attempt to merge another hull into this one. If they share an edge, `this` will be extended to
     * contain `otherHull`.
     * @param otherHull
     */
    attemptMergeIn(otherHull) {
        const horizontalMatch = this.x === otherHull.x && this.width === otherHull.width;
        const verticalMatch = this.y === otherHull.y && this.height === otherHull.height;
        if (horizontalMatch && this.top === otherHull.bottom) {
            this.height += otherHull.height;
            this.y = otherHull.y;
            return true;
        }
        if (horizontalMatch && this.bottom === otherHull.top) {
            this.bottom = otherHull.bottom;
            return true;
        }
        if (verticalMatch && this.left === otherHull.right) {
            this.width += otherHull.width;
            this.x = otherHull.x;
            return true;
        }
        if (verticalMatch && this.right === otherHull.left) {
            this.right = otherHull.right;
            return true;
        }
        return false;
    }
    toPoints() {
        const { left, right, top, bottom } = this;
        return [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom },
        ];
    }
}
