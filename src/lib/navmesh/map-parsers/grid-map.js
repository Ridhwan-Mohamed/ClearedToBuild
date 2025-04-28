export class GridMap {
    constructor(map, isWalkable, tileWidth, tileHeight) {
        this.map = map;
        this.isWalkableTest = isWalkable;
        this.height = map.length;
        this.width = map[0].length;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
    }
    forEach(fn) {
        this.map.forEach((row, y) => {
            row.forEach((col, x) => {
                fn(x, y, this.map[y][x]);
            });
        });
    }
    isInGrid(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    isWalkable(x, y) {
        return this.isInGrid(x, y) && this.isWalkableTest(this.map[y][x], x, y);
    }
    isBlocked(x, y) {
        return this.isInGrid(x, y) && !this.isWalkableTest(this.map[y][x], x, y);
    }
    isBlockedAtWorld(worldX, worldY) {
        return this.isBlocked(this.getGridX(worldX), this.getGridY(worldY));
    }
    getGridX(worldX) {
        return Math.floor(worldX / this.tileWidth);
    }
    getGridY(worldY) {
        return Math.floor(worldY / this.tileHeight);
    }
    getGridXY(worldX, worldY) {
        return { x: this.getGridX(worldX), y: this.getGridY(worldY) };
    }
    getWorldX(gridX) {
        return gridX * this.tileWidth;
    }
    getWorldY(gridY) {
        return gridY * this.tileHeight;
    }
    getWorldXY(gridX, gridY) {
        return { x: this.getWorldX(gridX), y: this.getWorldY(gridY) };
    }
}
