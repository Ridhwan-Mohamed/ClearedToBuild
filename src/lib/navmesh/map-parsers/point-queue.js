/**
 * Internal helper class to manage a queue of points when parsing a square map.
 */
export class PointQueue {
    constructor() {
        this.data = [];
    }
    add(point) {
        this.data.push(point);
    }
    shift() {
        return this.data.shift();
    }
    isEmpty() {
        return this.data.length === 0;
    }
    containsPoint(point) {
        return this.data.find((p) => p.x === point.x && p.y === point.y) !== undefined ? true : false;
    }
    containsAllPoints(points) {
        return points.every((p) => this.containsPoint(p));
    }
    getIndexOfPoint(point) {
        return this.data.findIndex((p) => p.x == point.x && p.y == point.y);
    }
    removePoint(point) {
        const index = this.getIndexOfPoint(point);
        if (index !== -1)
            this.data.splice(index, 1);
    }
    removePoints(points) {
        points.forEach((p) => this.removePoint(p));
    }
}
