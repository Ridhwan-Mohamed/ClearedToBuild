import Phaser from "phaser";
import { NavMesh } from "../../lib/navmesh/navmesh.js";
import { NavMeshUpdater } from "../../lib/navmesh/NavMeshUpdater.js";
import { buildPolysFromGridMap } from "../../lib/navmesh/map-parsers/build-polys-from-grid-map.js";
import {
    attachDirectionalSix,
    syncDirectionalAnimationState,
    updateDirectionalAnimationFromVelocity,
} from "../../players/PlayerDirectionalAnimator.js";

import grassInterior from "url:../../assets/terrain/grass/grass_interior.png";
import grassEdgeWater from "url:../../assets/terrain/grass/grass_edge_water.png";
import grassCornerWater from "url:../../assets/terrain/grass/grass_corner_water.png";
import grassInnerCornerWater from "url:../../assets/terrain/grass/grass_inner_corner_water.png";
import waterInterior from "url:../../assets/terrain/water/water_interior.png";
import wallInterior from "url:../../assets/wall/stone_interior.png";

import brawlerWalkDown from "url:../../assets/Players/brawler/brawler_walk_down.png";
import brawlerWalkDownLeft from "url:../../assets/Players/brawler/brawler_walk_down_left.png";
import brawlerWalkDownRight from "url:../../assets/Players/brawler/brawler_walk_down_right.png";
import brawlerWalkUp from "url:../../assets/Players/brawler/brawler_walk_up.png";
import brawlerWalkUpLeft from "url:../../assets/Players/brawler/brawler_walk_up_left.png";
import brawlerWalkUpRight from "url:../../assets/Players/brawler/brawler_walk_up_right.png";
import brawlerSwimUp from "url:../../assets/Players/brawler/brawler_swim_up.png";
import brawlerSwimDown from "url:../../assets/Players/brawler/brawler_swim_down.png";
import brawlerSwimSidewards from "url:../../assets/Players/brawler/brawler_swim_sidewards.png";

const TILE_SIZE = 32;
const MAP_WIDTH = 50;
const MAP_HEIGHT = 50;
const WORLD_WIDTH = MAP_WIDTH * TILE_SIZE;
const WORLD_HEIGHT = MAP_HEIGHT * TILE_SIZE;
const PLAYER_SPEED = 130;
const MAIN_TAG = "main";

const TOOLS = {
    move: "move",
    land: "land",
    water: "water",
    wall: "wall",
    eraseWall: "eraseWall",
};

const NAV_MODES = {
    land: "land",
    amphibious: "amphibious",
};

const UPDATE_MODES = {
    accelerated: "accelerated",
    legacy: "legacy",
};

const TOOL_META = {
    [TOOLS.move]: { label: "Move / Select", color: "#f1c96c" },
    [TOOLS.land]: { label: "Paint Land", color: "#77b255" },
    [TOOLS.water]: { label: "Paint Water", color: "#3db7d6" },
    [TOOLS.wall]: { label: "Paint Wall", color: "#8b6b46" },
    [TOOLS.eraseWall]: { label: "Erase Wall", color: "#dd6a5f" },
};

const NAV_META = {
    [NAV_MODES.land]: { label: "Land Only", color: "#9ed96f" },
    [NAV_MODES.amphibious]: { label: "Land + Water", color: "#78dff2" },
};

const UPDATE_META = {
    [UPDATE_MODES.accelerated]: { label: "Accelerated Patch", color: "#f1c96c" },
    [UPDATE_MODES.legacy]: { label: "Legacy Rebuild", color: "#dd6a5f" },
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMs(value) {
    return `${value.toFixed(2)} ms`;
}

function create2D(fillValue) {
    return Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(fillValue));
}

function createCellStore() {
    return Array.from({ length: MAP_HEIGHT }, () =>
        Array.from({ length: MAP_WIDTH }, () => ({
            base: null,
            overlays: [],
            wall: null,
        }))
    );
}

function normalizeBounds(bounds) {
    if (!bounds) return null;
    const minX = clamp(Math.floor(bounds.minX), 0, MAP_WIDTH - 1);
    const minY = clamp(Math.floor(bounds.minY), 0, MAP_HEIGHT - 1);
    const maxX = clamp(Math.floor(bounds.maxX), 0, MAP_WIDTH - 1);
    const maxY = clamp(Math.floor(bounds.maxY), 0, MAP_HEIGHT - 1);
    if (maxX < minX || maxY < minY) return null;
    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
    };
}

function expandBounds(bounds, pad = 1) {
    const normalized = normalizeBounds(bounds);
    if (!normalized) return null;
    return {
        minX: clamp(normalized.minX - pad, 0, MAP_WIDTH - 1),
        minY: clamp(normalized.minY - pad, 0, MAP_HEIGHT - 1),
        maxX: clamp(normalized.maxX + pad, 0, MAP_WIDTH - 1),
        maxY: clamp(normalized.maxY + pad, 0, MAP_HEIGHT - 1),
        width: clamp(normalized.maxX + pad, 0, MAP_WIDTH - 1) - clamp(normalized.minX - pad, 0, MAP_WIDTH - 1) + 1,
        height: clamp(normalized.maxY + pad, 0, MAP_HEIGHT - 1) - clamp(normalized.minY - pad, 0, MAP_HEIGHT - 1) + 1,
    };
}

function tileDistanceKey(x, y) {
    return `${x},${y}`;
}

function getTileCenter(tileX, tileY) {
    return {
        x: tileX * TILE_SIZE + TILE_SIZE / 2,
        y: tileY * TILE_SIZE + TILE_SIZE / 2,
    };
}

function makeEllipseWater(terrain, centerX, centerY, radiusX, radiusY) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const dx = (x - centerX) / radiusX;
            const dy = (y - centerY) / radiusY;
            if ((dx * dx + dy * dy) <= 1) {
                terrain[y][x] = "water";
            }
        }
    }
}

function setWaterRibbon(terrain, yCenter, halfWidth = 1) {
    for (let x = 4; x < MAP_WIDTH - 4; x++) {
        const wave = Math.round(Math.sin(x / 4.2) * 3.3 + Math.cos(x / 7.1) * 1.2);
        const y = clamp(yCenter + wave, 3, MAP_HEIGHT - 4);
        for (let offset = -halfWidth; offset <= halfWidth; offset++) {
            terrain[clamp(y + offset, 0, MAP_HEIGHT - 1)][x] = "water";
        }
    }
}

function markLandBridge(terrain, xStart, xEnd, yStart, yEnd) {
    for (let y = yStart; y <= yEnd; y++) {
        for (let x = xStart; x <= xEnd; x++) {
            terrain[y][x] = "grass";
        }
    }
}

export class NavmeshLabScene extends Phaser.Scene {
    constructor({ renderSnapshot }) {
        super({ key: "NavmeshLabScene" });
        this.renderSnapshot = renderSnapshot;
        this.tool = TOOLS.move;
        this.navMode = NAV_MODES.land;
        this.updateMode = UPDATE_MODES.accelerated;
        this.stats = {
            accelerated: [],
            legacy: [],
        };
        this.lastPatchLabel = "Last patch: local 3x3";
        this.lastSummary = "Accelerated mode patches only the edited tile bounds plus a one-tile border.";
        this.isPainting = false;
        this.lastPaintKey = null;
        this.cameraPanSpeed = 700;
    }

    preload() {
        this.load.image("lab_grass", grassInterior);
        this.load.image("lab_grass_edge_water", grassEdgeWater);
        this.load.image("lab_grass_corner_water", grassCornerWater);
        this.load.image("lab_grass_inner_corner_water", grassInnerCornerWater);
        this.load.spritesheet("lab_water", waterInterior, { frameWidth: 32, frameHeight: 32 });
        this.load.image("lab_wall", wallInterior);

        this.load.spritesheet("brawler_walk_down", brawlerWalkDown, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_walk_down_left", brawlerWalkDownLeft, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_walk_down_right", brawlerWalkDownRight, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_walk_up", brawlerWalkUp, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_walk_up_left", brawlerWalkUpLeft, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_walk_up_right", brawlerWalkUpRight, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_swim_up", brawlerSwimUp, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_swim_down", brawlerSwimDown, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet("brawler_swim_sidewards", brawlerSwimSidewards, { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        this.resolveParcelTagForTile = () => MAIN_TAG;
        this.resolveParcelTagForTiles = () => MAIN_TAG;

        this._createAnimations();
        this._createTerrainData();
        this._createRenderLayers();
        this._createMapBackdrop();
        this._redrawBounds({ minX: 0, minY: 0, maxX: MAP_WIDTH - 1, maxY: MAP_HEIGHT - 1 });
        this._createNavMeshes();
        this._createPlayer();
        this._createSelectionFx();
        this._createPathFx();
        this._bindInput();
        this._fitCameraToWorld();
        this._refreshNavOverlay();
        this._renderUi();
    }

    handleExternalResize() {
        this._fitCameraToWorld(false);
    }

    setTool(tool) {
        if (!TOOLS[tool]) return;
        this.tool = tool;
        this.isPainting = false;
        this.lastPaintKey = null;
        if (!this.terrain) return;
        this._refreshHover();
        this._refreshNavOverlay();
        this._renderUi();
    }

    setNavMode(navMode) {
        if (!NAV_MODES[navMode]) return;
        this.navMode = navMode;
        if (!this.terrain) return;
        this._repathPlayerToGoal();
        this._refreshNavOverlay();
        this._renderUi();
    }

    setUpdateMode(updateMode) {
        if (!UPDATE_MODES[updateMode]) return;
        this.updateMode = updateMode;
        this.lastSummary = updateMode === UPDATE_MODES.accelerated
            ? "Accelerated mode patches only the edited tile bounds plus a one-tile border."
            : "Legacy mode rebuilds both navmeshes from the full map on every edit.";
        if (!this.terrain) return;
        this._renderUi();
    }

    update(time, delta) {
        this._updateCamera(delta);
        this._updatePlayer(delta);
        this._updateSelectionFx(time);
        this._updatePathFx(time);
        this._refreshHover();
    }

    _createAnimations() {
        if (!this.anims.exists("lab_water")) {
            this.anims.create({
                key: "lab_water",
                frames: this.anims.generateFrameNumbers("lab_water", { start: 0, end: 2 }),
                frameRate: 3,
                repeat: -1,
            });
        }
    }

    _createTerrainData() {
        this.terrain = create2D("grass");
        this.walls = create2D(false);
        this.landGrid = create2D(1);
        this.amphibiousGrid = create2D(1);
        this.cellNodes = createCellStore();

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (x < 3 || y < 3 || x >= MAP_WIDTH - 3 || y >= MAP_HEIGHT - 3) {
                    this.terrain[y][x] = "water";
                }
            }
        }

        makeEllipseWater(this.terrain, 24, 24, 7, 5);
        makeEllipseWater(this.terrain, 37, 12, 5, 4);
        makeEllipseWater(this.terrain, 13, 36, 4, 3);
        setWaterRibbon(this.terrain, 17, 1);
        markLandBridge(this.terrain, 12, 15, 15, 18);
        markLandBridge(this.terrain, 26, 29, 16, 19);
        markLandBridge(this.terrain, 39, 42, 17, 20);

        this._rebuildAllNavGrids();
    }

    _createRenderLayers() {
        this.groundLayer = this.add.layer();
        this.overlayLayer = this.add.layer();
        this.wallLayer = this.add.layer();
        this.pathLayer = this.add.layer();

        this.navGraphics = this.add.graphics().setDepth(70);
        this.patchGraphics = this.add.graphics().setDepth(72);
        this.hoverGraphics = this.add.graphics().setDepth(75);
        this.selectionGraphics = this.add.graphics().setDepth(76);
        this.pathGraphics = this.add.graphics().setDepth(77);
        this.commandMarker = this.add.graphics().setDepth(78);
    }

    _createMapBackdrop() {
        this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH + 160, WORLD_HEIGHT + 160, 0x0c4251)
            .setDepth(-20)
            .setStrokeStyle(26, 0x2f8597, 0.4);

        this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH + 20, WORLD_HEIGHT + 20, 0x164f3a, 0)
            .setDepth(-19)
            .setStrokeStyle(2, 0xf1c96c, 0.25);

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBackgroundColor("#0c4251");
    }

    _createNavMeshes() {
        this.landNavMesh = this._buildNavMesh(this.landGrid);
        this.amphibiousNavMesh = this._buildNavMesh(this.amphibiousGrid);

        this.landUpdater = new NavMeshUpdater(this.landNavMesh, this, { toggleKey: "L" });
        this.amphibiousUpdater = new NavMeshUpdater(this.amphibiousNavMesh, this, { toggleKey: "K" });
    }

    _buildNavMesh(grid) {
        const navMesh = new NavMesh(buildPolysFromGridMap(grid, TILE_SIZE, TILE_SIZE, undefined, 0));
        for (const poly of navMesh.getPolygons()) {
            poly.parcelTag = MAIN_TAG;
        }
        return navMesh;
    }

    _createPlayer() {
        const spawn = getTileCenter(8, 10);
        const player = this.physics.add.sprite(spawn.x, spawn.y, "brawler_walk_down", 1);
        player.setDepth(30);
        player.setInteractive({ useHandCursor: true });
        player.setSize(16, 12).setOffset(8, 20);
        player.setCollideWorldBounds(true);
        player.body.setAllowGravity(false);
        player.pathPoints = [];
        player.goalPoint = null;
        player.selected = true;
        player.speed = PLAYER_SPEED;
        player.animState = "idle";
        attachDirectionalSix(player, {
            animPrefix: "lab_brawler",
            defaultDirection: "down",
            walkStateKey: "walk",
            idleStateKey: "idle",
            swimStateKey: "swim",
            idleFrame: 1,
            swimIdleFrame: 1,
            frameRate: 7,
            swimFrameRate: 8,
            directions: {
                down: "brawler_walk_down",
                down_left: "brawler_walk_down_left",
                down_right: "brawler_walk_down_right",
                up: "brawler_walk_up",
                up_left: "brawler_walk_up_left",
                up_right: "brawler_walk_up_right",
            },
            swimDirections: {
                up: "brawler_swim_up",
                down: "brawler_swim_down",
                side: "brawler_swim_sidewards",
            }
        });
        syncDirectionalAnimationState(player, "idle");

        player.on("pointerdown", (pointer) => {
            pointer.event.stopPropagation();
            player.selected = true;
            this._flashSelection();
        });

        this.player = player;
    }

    _createSelectionFx() {
        this.selectionPulse = 0;
    }

    _createPathFx() {
        this.pathOrb = this.add.circle(this.player.x, this.player.y, 5, 0xf1c96c, 0.92)
            .setDepth(79)
            .setVisible(false);
        this.pathTarget = this.add.circle(this.player.x, this.player.y, 7, 0xffffff, 0)
            .setStrokeStyle(2, 0xf1c96c, 0.85)
            .setDepth(79)
            .setVisible(false);
    }

    _bindInput() {
        this.paintPointer = null;
        this.moveKeys = this.input.keyboard.addKeys("W,A,S,D,ONE,TWO,THREE,FOUR,FIVE");

        this.input.on("pointerdown", (pointer) => {
            if (pointer.rightButtonDown()) return;

            const tile = this._pointerToTile(pointer);
            if (!tile) return;

            if (this.tool === TOOLS.move) {
                this._commandPlayerToTile(tile.x, tile.y);
                return;
            }

            this.isPainting = true;
            this.paintPointer = pointer;
            this._applyToolAtTile(tile.x, tile.y);
        });

        this.input.on("pointermove", (pointer) => {
            if (!this.isPainting || this.tool === TOOLS.move) return;
            if (!pointer.isDown) return;
            const tile = this._pointerToTile(pointer);
            if (!tile) return;
            this._applyToolAtTile(tile.x, tile.y);
        });

        this.input.on("pointerup", () => {
            this.isPainting = false;
            this.paintPointer = null;
            this.lastPaintKey = null;
        });

        this.input.on("gameout", () => {
            this.isPainting = false;
            this.paintPointer = null;
            this.lastPaintKey = null;
        });

        this.input.on("wheel", (pointer, _gameObjects, _dx, dy) => {
            const camera = this.cameras.main;
            const oldZoom = camera.zoom;
            const nextZoom = clamp(oldZoom * (dy > 0 ? 0.91 : 1.1), 0.48, 1.65);
            const worldPoint = pointer.positionToCamera(camera);
            camera.setZoom(nextZoom);
            const newWorldPoint = pointer.positionToCamera(camera);
            camera.scrollX += worldPoint.x - newWorldPoint.x;
            camera.scrollY += worldPoint.y - newWorldPoint.y;
        });

        this.input.keyboard.on("keydown-ONE", () => this.setTool(TOOLS.move));
        this.input.keyboard.on("keydown-TWO", () => this.setTool(TOOLS.land));
        this.input.keyboard.on("keydown-THREE", () => this.setTool(TOOLS.water));
        this.input.keyboard.on("keydown-FOUR", () => this.setTool(TOOLS.wall));
        this.input.keyboard.on("keydown-FIVE", () => this.setTool(TOOLS.eraseWall));
    }

    _pointerToTile(pointer) {
        const worldPoint = pointer.positionToCamera(this.cameras.main);
        const x = Math.floor(worldPoint.x / TILE_SIZE);
        const y = Math.floor(worldPoint.y / TILE_SIZE);
        if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
        return { x, y };
    }

    _rebuildAllNavGrids() {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                this._refreshNavCell(x, y);
            }
        }
    }

    _refreshNavCell(x, y) {
        const walkableLand = this.terrain[y][x] === "grass" && !this.walls[y][x];
        const walkableAmphibious = !this.walls[y][x];
        this.landGrid[y][x] = walkableLand ? 1 : 0;
        this.amphibiousGrid[y][x] = walkableAmphibious ? 1 : 0;
    }

    _redrawBounds(bounds) {
        const normalized = normalizeBounds(bounds);
        if (!normalized) return;
        for (let y = normalized.minY; y <= normalized.maxY; y++) {
            for (let x = normalized.minX; x <= normalized.maxX; x++) {
                this._redrawCell(x, y);
            }
        }
    }

    _redrawCell(x, y) {
        const cell = this.cellNodes[y][x];
        cell.base?.destroy();
        cell.wall?.destroy();
        cell.base = null;
        cell.wall = null;
        for (const overlay of cell.overlays) {
            overlay.destroy();
        }
        cell.overlays = [];

        const center = getTileCenter(x, y);
        if (this.terrain[y][x] === "water") {
            const base = this.add.sprite(center.x, center.y, "lab_water").setDepth(2);
            base.play("lab_water");
            this.groundLayer.add(base);
            cell.base = base;
        } else {
            const base = this.add.image(center.x, center.y, "lab_grass").setDepth(2);
            this.groundLayer.add(base);
            cell.base = base;
            cell.overlays = this._createGrassOverlays(x, y, center);
        }

        if (this.walls[y][x]) {
            const wall = this.add.image(center.x, center.y, "lab_wall").setDepth(18);
            wall.setAlpha(0.96);
            this.wallLayer.add(wall);
            cell.wall = wall;
        }
    }

    _createGrassOverlays(x, y, center) {
        const overlays = [];
        const waterN = this._isWater(x, y - 1);
        const waterE = this._isWater(x + 1, y);
        const waterS = this._isWater(x, y + 1);
        const waterW = this._isWater(x - 1, y);
        const waterNW = this._isWater(x - 1, y - 1);
        const waterNE = this._isWater(x + 1, y - 1);
        const waterSE = this._isWater(x + 1, y + 1);
        const waterSW = this._isWater(x - 1, y + 1);

        const addOverlay = (key, angle) => {
            const overlay = this.add.image(center.x, center.y, key).setDepth(4);
            overlay.setAngle(angle);
            this.overlayLayer.add(overlay);
            overlays.push(overlay);
        };

        if (waterN) addOverlay("lab_grass_edge_water", 0);
        if (waterE) addOverlay("lab_grass_edge_water", 90);
        if (waterS) addOverlay("lab_grass_edge_water", 180);
        if (waterW) addOverlay("lab_grass_edge_water", 270);

        if (!waterN && !waterW && waterNW) addOverlay("lab_grass_corner_water", 0);
        if (!waterN && !waterE && waterNE) addOverlay("lab_grass_corner_water", 90);
        if (!waterS && !waterE && waterSE) addOverlay("lab_grass_corner_water", 180);
        if (!waterS && !waterW && waterSW) addOverlay("lab_grass_corner_water", 270);

        if (waterN && waterW && !waterNW) addOverlay("lab_grass_inner_corner_water", 0);
        if (waterN && waterE && !waterNE) addOverlay("lab_grass_inner_corner_water", 90);
        if (waterS && waterE && !waterSE) addOverlay("lab_grass_inner_corner_water", 180);
        if (waterS && waterW && !waterSW) addOverlay("lab_grass_inner_corner_water", 270);

        return overlays;
    }

    _isWater(x, y) {
        if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return true;
        return this.terrain[y][x] === "water";
    }

    _getActiveNavMesh() {
        return this.navMode === NAV_MODES.land ? this.landNavMesh : this.amphibiousNavMesh;
    }

    _getActiveGrid() {
        return this.navMode === NAV_MODES.land ? this.landGrid : this.amphibiousGrid;
    }

    _commandPlayerToTile(tileX, tileY) {
        if (!this.player?.active) return;
        const target = getTileCenter(tileX, tileY);
        const navMesh = this._getActiveNavMesh();
        const startRes = navMesh.findClosestMeshPoint({ x: this.player.x, y: this.player.y }, TILE_SIZE * 4);
        const endRes = navMesh.findClosestMeshPoint(target, TILE_SIZE * 3);

        if (!startRes?.point || !endRes?.point) {
            this._flashCommandFailure(target.x, target.y);
            return;
        }

        const pathResult = navMesh.findPathDetailed(startRes.point, endRes.point, { includePolys: true });
        if (!pathResult?.points?.length) {
            this._flashCommandFailure(target.x, target.y);
            return;
        }

        const points = pathResult.points.map((point) => ({ x: point.x, y: point.y }));
        if (points.length > 1) points.shift();

        this.player.pathPoints = points;
        this.player.goalPoint = target;
        this.player.pathPolyIds = pathResult.polyIds || [];
        this.pathTarget.setPosition(endRes.point.x, endRes.point.y).setVisible(true);
        this._flashCommandMarker(endRes.point.x, endRes.point.y, 0xf1c96c);
    }

    _repathPlayerToGoal() {
        if (!this.player?.goalPoint) return;
        const goal = this.player.goalPoint;
        this._commandPlayerToTile(Math.floor(goal.x / TILE_SIZE), Math.floor(goal.y / TILE_SIZE));
    }

    _updatePlayer(delta) {
        if (!this.player?.body) return;
        const dt = delta / 1000;
        const body = this.player.body;

        if (this.player.pathPoints?.length) {
            const next = this.player.pathPoints[0];
            const dx = next.x - this.player.x;
            const dy = next.y - this.player.y;
            const distance = Math.hypot(dx, dy);
            const speed = this.player.speed;

            if (distance <= speed * dt) {
                this.player.setPosition(next.x, next.y);
                this.player.pathPoints.shift();
                if (!this.player.pathPoints.length) {
                    body.setVelocity(0, 0);
                    this.player.goalPoint = null;
                    this.pathTarget.setVisible(false);
                }
            } else {
                const velocityX = (dx / distance) * speed;
                const velocityY = (dy / distance) * speed;
                body.setVelocity(velocityX, velocityY);
            }
        } else {
            body.setVelocity(0, 0);
        }

        const isMoving = body.velocity.lengthSq() > 1;
        const terrainUnderPlayer = this._isWater(
            Math.floor(this.player.x / TILE_SIZE),
            Math.floor(this.player.y / TILE_SIZE)
        ) ? "water" : "grass";
        const desiredState = isMoving
            ? (terrainUnderPlayer === "water" ? "swim" : "walk")
            : (terrainUnderPlayer === "water" ? "swim" : "idle");

        if (this.player.animState !== desiredState) {
            this.player.animState = desiredState;
            syncDirectionalAnimationState(this.player, desiredState);
        }

        updateDirectionalAnimationFromVelocity(
            this.player,
            body.velocity.x,
            body.velocity.y,
            isMoving
        );
    }

    _updateCamera(delta) {
        const dt = delta / 1000;
        const camera = this.cameras.main;
        const step = this.cameraPanSpeed * dt / camera.zoom;

        if (this.moveKeys.W.isDown) camera.scrollY -= step;
        if (this.moveKeys.S.isDown) camera.scrollY += step;
        if (this.moveKeys.A.isDown) camera.scrollX -= step;
        if (this.moveKeys.D.isDown) camera.scrollX += step;
    }

    _updateSelectionFx(time) {
        if (!this.player?.selected) return;
        this.selectionGraphics.clear();
        const pulse = 1 + Math.sin(time * 0.006) * 0.08;
        this.selectionGraphics.lineStyle(3, 0xf1c96c, 0.92);
        this.selectionGraphics.strokeCircle(this.player.x, this.player.y + 7, 17 * pulse);
        this.selectionGraphics.lineStyle(1, 0xffffff, 0.75);
        this.selectionGraphics.strokeCircle(this.player.x, this.player.y + 7, 22 * pulse);
    }

    _updatePathFx(time) {
        this.pathGraphics.clear();
        const pathPoints = this.player?.pathPoints;
        if (!pathPoints?.length) {
            this.pathOrb.setVisible(false);
            return;
        }

        const drawPoints = [{ x: this.player.x, y: this.player.y }, ...pathPoints];
        this.pathGraphics.lineStyle(6, 0xffffff, 0.88);
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(drawPoints[0].x, drawPoints[0].y);
        for (let i = 1; i < drawPoints.length; i++) {
            this.pathGraphics.lineTo(drawPoints[i].x, drawPoints[i].y);
        }
        this.pathGraphics.strokePath();

        this.pathGraphics.lineStyle(3, this.navMode === NAV_MODES.land ? 0x99db68 : 0x55d9f1, 0.92);
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(drawPoints[0].x, drawPoints[0].y);
        for (let i = 1; i < drawPoints.length; i++) {
            this.pathGraphics.lineTo(drawPoints[i].x, drawPoints[i].y);
        }
        this.pathGraphics.strokePath();

        for (let i = 1; i < drawPoints.length; i++) {
            this.pathGraphics.fillStyle(0xf1c96c, 0.8);
            this.pathGraphics.fillCircle(drawPoints[i].x, drawPoints[i].y, 3);
        }

        const orbPosition = this._samplePointOnPolyline(drawPoints, (time * 0.00022) % 1);
        if (orbPosition) {
            this.pathOrb.setPosition(orbPosition.x, orbPosition.y).setVisible(true);
        } else {
            this.pathOrb.setVisible(false);
        }
    }

    _samplePointOnPolyline(points, t) {
        if (!points || points.length < 2) return null;
        let totalLength = 0;
        const segments = [];
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const length = Math.hypot(dx, dy);
            if (length <= 0.001) continue;
            segments.push({ start: points[i - 1], end: points[i], length });
            totalLength += length;
        }
        if (totalLength <= 0) return null;

        let targetLength = totalLength * t;
        for (const segment of segments) {
            if (targetLength <= segment.length) {
                const alpha = targetLength / segment.length;
                return {
                    x: Phaser.Math.Linear(segment.start.x, segment.end.x, alpha),
                    y: Phaser.Math.Linear(segment.start.y, segment.end.y, alpha),
                };
            }
            targetLength -= segment.length;
        }
        return segments.length ? { ...segments[segments.length - 1].end } : null;
    }

    _refreshHover() {
        this.hoverGraphics.clear();
        const pointer = this.input.activePointer;
        if (!pointer) return;
        const tile = this._pointerToTile(pointer);
        if (!tile) return;

        const color = Phaser.Display.Color.HexStringToColor(TOOL_META[this.tool].color).color;
        this.hoverGraphics.lineStyle(2, color, 0.9);
        this.hoverGraphics.fillStyle(color, this.tool === TOOLS.move ? 0.06 : 0.18);
        this.hoverGraphics.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.hoverGraphics.strokeRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    _applyToolAtTile(x, y) {
        const key = tileDistanceKey(x, y);
        if (key === this.lastPaintKey) return;
        this.lastPaintKey = key;

        let changed = false;
        switch (this.tool) {
            case TOOLS.land:
                if (this.terrain[y][x] !== "grass" || this.walls[y][x]) {
                    this.terrain[y][x] = "grass";
                    this.walls[y][x] = false;
                    changed = true;
                }
                break;
            case TOOLS.water:
                if (this.terrain[y][x] !== "water" || this.walls[y][x]) {
                    this.terrain[y][x] = "water";
                    this.walls[y][x] = false;
                    changed = true;
                }
                break;
            case TOOLS.wall:
                if (!this.walls[y][x]) {
                    this.walls[y][x] = true;
                    changed = true;
                }
                break;
            case TOOLS.eraseWall:
                if (this.walls[y][x]) {
                    this.walls[y][x] = false;
                    changed = true;
                }
                break;
            default:
                break;
        }

        if (!changed) return;

        const editBounds = { minX: x, minY: y, maxX: x, maxY: y };
        const redrawBounds = expandBounds(editBounds, 1);
        this._redrawBounds(redrawBounds);

        const timing = this.updateMode === UPDATE_MODES.accelerated
            ? this._applyAcceleratedPatch(redrawBounds)
            : this._applyLegacyRebuild();

        this.stats[this.updateMode].push(timing);
        if (this.stats[this.updateMode].length > 36) {
            this.stats[this.updateMode].shift();
        }

        this.lastPatchLabel = this.updateMode === UPDATE_MODES.accelerated
            ? `Last patch: local ${redrawBounds.width}x${redrawBounds.height}`
            : `Last patch: full ${MAP_WIDTH}x${MAP_HEIGHT}`;

        this.lastSummary = this.updateMode === UPDATE_MODES.accelerated
            ? `Accelerated edit patched both navmeshes in ${formatMs(timing)} over a ${redrawBounds.width}x${redrawBounds.height} region.`
            : `Legacy edit rebuilt both navmeshes from the full ${MAP_WIDTH}x${MAP_HEIGHT} map in ${formatMs(timing)}.`;

        this._flashPatchBounds(
            this.updateMode === UPDATE_MODES.accelerated
                ? redrawBounds
                : { minX: 0, minY: 0, maxX: MAP_WIDTH - 1, maxY: MAP_HEIGHT - 1 },
            this.updateMode
        );

        this._repathPlayerToGoal();
        this._refreshNavOverlay();
        this._renderUi();
    }

    _applyAcceleratedPatch(bounds) {
        const normalized = normalizeBounds(bounds);
        if (!normalized) return 0;

        for (let y = normalized.minY; y <= normalized.maxY; y++) {
            for (let x = normalized.minX; x <= normalized.maxX; x++) {
                this._refreshNavCell(x, y);
            }
        }

        const started = performance.now();
        this.landUpdater.replaceBounds(normalized, this.landGrid, {
            parcelTag: MAIN_TAG,
            allowMerge: true,
        });
        this.amphibiousUpdater.replaceBounds(normalized, this.amphibiousGrid, {
            parcelTag: MAIN_TAG,
            allowMerge: true,
        });
        return performance.now() - started;
    }

    _applyLegacyRebuild() {
        this._rebuildAllNavGrids();
        const started = performance.now();
        this.landNavMesh = this._buildNavMesh(this.landGrid);
        this.amphibiousNavMesh = this._buildNavMesh(this.amphibiousGrid);
        this.landUpdater.navMesh = this.landNavMesh;
        this.amphibiousUpdater.navMesh = this.amphibiousNavMesh;
        return performance.now() - started;
    }

    _flashPatchBounds(bounds, mode) {
        const normalized = normalizeBounds(bounds);
        if (!normalized) return;
        this.patchGraphics.clear();
        this.patchGraphics.lineStyle(3, mode === UPDATE_MODES.accelerated ? 0xf1c96c : 0xdd6a5f, 0.95);
        this.patchGraphics.fillStyle(mode === UPDATE_MODES.accelerated ? 0xf1c96c : 0xdd6a5f, 0.08);
        this.patchGraphics.fillRect(
            normalized.minX * TILE_SIZE,
            normalized.minY * TILE_SIZE,
            normalized.width * TILE_SIZE,
            normalized.height * TILE_SIZE
        );
        this.patchGraphics.strokeRect(
            normalized.minX * TILE_SIZE,
            normalized.minY * TILE_SIZE,
            normalized.width * TILE_SIZE,
            normalized.height * TILE_SIZE
        );

        this.tweens.killTweensOf(this.patchGraphics);
        this.patchGraphics.alpha = 1;
        this.tweens.add({
            targets: this.patchGraphics,
            alpha: 0,
            duration: 900,
            ease: "Cubic.easeOut",
        });
    }

    _refreshNavOverlay() {
        this.navGraphics.clear();
        if (this.tool === TOOLS.move) return;

        const navMesh = this._getActiveNavMesh();
        const fillColor = this.navMode === NAV_MODES.land ? 0xa7db67 : 0x59d9f4;
        const polygons = navMesh.getPolygons ? navMesh.getPolygons() : navMesh.navPolygons;
        const drawnPortals = new Set();

        for (const polygon of polygons) {
            const points = polygon.polygon.points;
            if (!points?.length) continue;

            this.navGraphics.lineStyle(1, 0xffffff, 0.32);
            this.navGraphics.fillStyle(fillColor, 0.18);
            this.navGraphics.beginPath();
            this.navGraphics.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.navGraphics.lineTo(points[i].x, points[i].y);
            }
            this.navGraphics.closePath();
            this.navGraphics.strokePath();
            this.navGraphics.fillPath();

            for (const portal of polygon.portals || []) {
                const forward = `${portal.start.x},${portal.start.y}-${portal.end.x},${portal.end.y}`;
                const reverse = `${portal.end.x},${portal.end.y}-${portal.start.x},${portal.start.y}`;
                if (drawnPortals.has(forward) || drawnPortals.has(reverse)) continue;
                drawnPortals.add(forward);
                this.navGraphics.lineStyle(3, 0x0e0e0e, 0.92);
                this.navGraphics.beginPath();
                this.navGraphics.moveTo(portal.start.x, portal.start.y);
                this.navGraphics.lineTo(portal.end.x, portal.end.y);
                this.navGraphics.strokePath();
            }
        }
    }

    _fitCameraToWorld(forceCenter = true) {
        const camera = this.cameras.main;
        const width = this.scale.width || 1280;
        const height = this.scale.height || 720;
        const zoom = clamp(Math.min((width - 64) / WORLD_WIDTH, (height - 64) / WORLD_HEIGHT), 0.5, 1);
        if (forceCenter || camera.zoom < 0.1) {
            camera.setZoom(zoom);
            camera.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
            return;
        }
        camera.setZoom(clamp(camera.zoom, 0.48, 1.65));
    }

    _flashCommandMarker(x, y, color) {
        this.commandMarker.clear();
        this.commandMarker.lineStyle(2, color, 0.95);
        this.commandMarker.strokeCircle(x, y, 10);
        this.commandMarker.strokeCircle(x, y, 18);
        this.commandMarker.alpha = 1;

        this.tweens.killTweensOf(this.commandMarker);
        this.tweens.add({
            targets: this.commandMarker,
            alpha: 0,
            duration: 550,
            ease: "Cubic.easeOut",
            onComplete: () => this.commandMarker.clear(),
        });
    }

    _flashCommandFailure(x, y) {
        this._flashCommandMarker(x, y, 0xdd6a5f);
    }

    _flashSelection() {
        this._flashCommandMarker(this.player.x, this.player.y, 0xf1c96c);
    }

    _renderUi() {
        const activeGrid = this._getActiveGrid();
        let activeWalkableTiles = 0;
        let landTiles = 0;
        let waterTiles = 0;
        let wallTiles = 0;

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (this.terrain[y][x] === "water") waterTiles += 1;
                else landTiles += 1;
                if (this.walls[y][x]) wallTiles += 1;
                if (activeGrid[y][x]) activeWalkableTiles += 1;
            }
        }

        const navMesh = this._getActiveNavMesh();
        const polygons = navMesh.getPolygons ? navMesh.getPolygons() : navMesh.navPolygons;

        this.renderSnapshot?.({
            tool: this.tool,
            toolLabel: TOOL_META[this.tool].label,
            toolColor: TOOL_META[this.tool].color,
            navMode: this.navMode,
            navModeLabel: NAV_META[this.navMode].label,
            navModeColor: NAV_META[this.navMode].color,
            updateMode: this.updateMode,
            updateModeLabel: UPDATE_META[this.updateMode].label,
            updateModeColor: UPDATE_META[this.updateMode].color,
            summary: this.lastSummary,
            lastPatchLabel: this.lastPatchLabel,
            activePolygons: polygons.length,
            activeWalkableTiles,
            landTiles,
            waterTiles,
            wallTiles,
            note: this.stats.accelerated.length || this.stats.legacy.length
                ? "Switch update modes and keep painting to build a direct timing comparison."
                : "Paint the map to populate timing history.",
            stats: {
                accelerated: {
                    last: formatMs(this.stats.accelerated.at(-1) ?? 0),
                    avg: formatMs(average(this.stats.accelerated)),
                    count: String(this.stats.accelerated.length),
                },
                legacy: {
                    last: formatMs(this.stats.legacy.at(-1) ?? 0),
                    avg: formatMs(average(this.stats.legacy)),
                    count: String(this.stats.legacy.length),
                },
            }
        });
    }
}
