import { SQUARESIZE, UIDEPTH, TILE_TYPES, TILE_MAP } from "../constants";
import { Teams } from "../Teams";
import { Wall } from "../buildings/Wall";
import { Map as GameMap } from "../map";
import { buildingManager } from "../Manager/buildingManager";

const DRAG_THRESHOLD = 6;

function normalizeCostBundle(cost) {
    if (!cost) return {};
    if (typeof cost === "number") return { money: cost };
    if (typeof cost !== "object") return {};

    const bundle = {};
    for (const [key, rawValue] of Object.entries(cost)) {
        const value = Math.max(0, Number(rawValue) || 0);
        if (value > 0) bundle[key] = value;
    }
    return bundle;
}

function addCostBundle(target, cost) {
    for (const [key, amount] of Object.entries(normalizeCostBundle(cost))) {
        target[key] = Math.max(0, Number(target[key] || 0)) + amount;
    }
    return target;
}

function formatCostBundle(cost) {
    const parts = [];
    for (const [key, rawValue] of Object.entries(normalizeCostBundle(cost))) {
        const value = Math.max(0, Number(rawValue) || 0);
        if (!(value > 0)) continue;
        if (key === "money") parts.push(`$${value}`);
        else if (key === "permits") parts.push(`${value} permit${value === 1 ? "" : "s"}`);
        else parts.push(`${value} ${key.replace(/_/g, " ")}`);
    }
    return parts.join(" | ");
}

export class WallDestroyController {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.consumeNextClick = false;
        this.selected = new globalThis.Map();
        this.dragGraphics = scene.add.graphics().setDepth(UIDEPTH + 3).setVisible(false);

        this.dragPending = false;
        this.dragActive = false;
        this.dragPointerId = null;
        this.dragStartScreen = null;
        this.dragStartWorld = null;
        this.dragEndWorld = null;
        this.pendingTarget = null;
    }

    start() {
        this.active = true;
        this.consumeNextClick = false;
        this.selected.clear();
        this._resetDrag();
        this.scene.input.setDefaultCursor("url(hammer.png), pointer");
        this._syncCommandBar();
    }

    stop() {
        this.active = false;
        this.consumeNextClick = false;
        this._resetDrag();
        this._clearSelection();
        this.scene.input.setDefaultCursor("default");
        this.scene.destroyWallMode = false;
        this._clearCommandBar();
        buildingManager._syncBuildQueueCommandBar?.();
    }

    onEsc() {
        if (!this.active) return;
        if (this.selected.size > 0) {
            this._clearSelection();
            this._syncCommandBar();
            return;
        }
        this.stop();
    }

    onPointerMove(pointer) {
        if (!this.active || !pointer?.isDown) return;
        if (!this.dragPending && !this.dragActive) return;
        if (this.dragPointerId != null && pointer?.id !== this.dragPointerId) return;

        const dx = (pointer?.x ?? 0) - (this.dragStartScreen?.x ?? 0);
        const dy = (pointer?.y ?? 0) - (this.dragStartScreen?.y ?? 0);
        if (!this.dragActive && ((dx * dx) + (dy * dy) >= DRAG_THRESHOLD * DRAG_THRESHOLD)) {
            this.dragActive = true;
            this.dragGraphics.setVisible(true);
        }

        if (!this.dragActive) return;
        this.dragEndWorld = { x: pointer.worldX, y: pointer.worldY };
        this._drawDragRect();
    }

    onClick(pointer) {
        if (!this.active || pointer?.button !== 0) return false;

        if (this.consumeNextClick) {
            this.consumeNextClick = false;
            return true;
        }

        this.dragPending = true;
        this.dragActive = false;
        this.dragPointerId = pointer?.id ?? null;
        this.dragStartScreen = { x: pointer?.x ?? 0, y: pointer?.y ?? 0 };
        this.dragStartWorld = { x: pointer.worldX, y: pointer.worldY };
        this.dragEndWorld = { x: pointer.worldX, y: pointer.worldY };
        this.pendingTarget = this._getTargetAtWorld(pointer.worldX, pointer.worldY);
        return true;
    }

    onPointerUp(pointer) {
        if (!this.active || pointer?.button !== 0) return false;
        if (this.dragPointerId != null && pointer?.id !== this.dragPointerId) return false;

        if (this.dragActive && this.dragStartWorld && this.dragEndWorld) {
            this._applyDragSelection();
            this._resetDrag();
            return true;
        }

        if (this.dragPending) {
            if (this.pendingTarget) {
                this._toggleTarget(this.pendingTarget);
            }
            this._resetDrag();
            return true;
        }

        return false;
    }

    finalize() {
        if (!this.active || this.selected.size === 0) return;

        const destroyTileTasks = [];
        const destroyBlockTasks = [];
        const destroyJobId = buildingManager.createDestroyJobId?.("1") ?? null;
        let destroyJobOrder = 0;
        for (const target of this.selected.values()) {
            if (target.kind === "wall") {
                destroyTileTasks.push({
                    x: target.x,
                    y: target.y,
                    originalGridVal: target.originalGridVal,
                    type: target.type,
                    refundCost: target.refundCost,
                    destroyJobId,
                    destroyJobOrder: destroyJobOrder++,
                });
                continue;
            }

            destroyBlockTasks.push({
                x: target.x,
                y: target.y,
                duration: target.duration,
                totalDuration: target.totalDuration,
                type: target.type,
                value: target.value,
                refundCost: target.refundCost,
                assigned: 0,
                destroyJobId,
                destroyJobOrder: destroyJobOrder++,
            });
        }

        if (destroyTileTasks.length) {
            buildingManager.createDestroyTileStateArray(destroyTileTasks, "1", { destroyJobId });
            buildingManager.assignTroopsToDestroyTile?.(1);
        }
        if (destroyBlockTasks.length) {
            buildingManager.createDestroyStateArray?.(destroyBlockTasks, "1", { destroyJobId });
            buildingManager.assingTroopsToDestroy?.(1);
        }

        this.stop();
    }

    _team() {
        return Teams.teamLists?.["1"] ?? Teams.teamLists?.[1] ?? null;
    }

    _buildingEntries() {
        const team = this._team();
        const buildings = Array.isArray(team?.buildings) ? team.buildings : [];
        const unique = new globalThis.Map();

        for (const entry of buildings) {
            const [x, y, tileType, sprite] = entry || [];
            const building = sprite?.buildingRef || sprite || null;
            const type = building?.tileType ?? tileType ?? building?.buildType ?? null;
            if (!building || !type) continue;
            if (building._destroyed || building.sprite?._destroyed || building.sprite?.active === false) continue;
            const hp = Number(building.health ?? building.hp ?? building.maxHealth ?? building.maxHp ?? 1);
            if (!(hp > 0)) continue;
            const teamNumber = Number(building.teamNumber ?? building.team ?? sprite?.team ?? 1);
            if (teamNumber !== 1) continue;
            const key = `building:${x},${y}:${type.name ?? type.value ?? "unknown"}`;
            if (unique.has(key)) continue;
            unique.set(key, { key, x, y, type, value: building });
        }

        return [...unique.values()];
    }

    _gridRectFromWorld(a, b) {
        const minWorldX = Math.min(a.x, b.x);
        const maxWorldX = Math.max(a.x, b.x);
        const minWorldY = Math.min(a.y, b.y);
        const maxWorldY = Math.max(a.y, b.y);
        return {
            minX: Math.max(0, Math.floor(minWorldX / SQUARESIZE)),
            maxX: Math.max(0, Math.floor(Math.max(0, maxWorldX - 1) / SQUARESIZE)),
            minY: Math.max(0, Math.floor(minWorldY / SQUARESIZE)),
            maxY: Math.max(0, Math.floor(Math.max(0, maxWorldY - 1) / SQUARESIZE)),
        };
    }

    _targetKeyForBuilding(entry) {
        return entry?.key ?? `building:${entry?.x},${entry?.y}:${entry?.type?.name ?? "unknown"}`;
    }

    _isBuildingQueued(entry) {
        const team = this._team();
        const queue = Array.isArray(team?.destroyStates) ? team.destroyStates : [];
        return queue.some((task) => task?.x === entry.x && task?.y === entry.y);
    }

    _isWallQueued(x, y) {
        const team = this._team();
        const queue = Array.isArray(team?.destroyTileStates) ? team.destroyTileStates : [];
        return queue.some((task) => task?.x === x && task?.y === y);
    }

    _findBuildingAtGrid(gridX, gridY) {
        for (const entry of this._buildingEntries()) {
            const lenX = Math.max(1, Number(entry.type?.lenX || 1));
            const lenY = Math.max(1, Number(entry.type?.lenY || 1));
            const inside =
                gridX >= entry.x &&
                gridX < entry.x + lenX &&
                gridY >= entry.y &&
                gridY < entry.y + lenY;
            if (!inside) continue;
            if (this._isBuildingQueued(entry)) return null;
            return entry;
        }
        return null;
    }

    _wallTargetAtGrid(gridX, gridY) {
        const wall = Wall.getAt(gridX, gridY);
        if (!wall?.active || Number(wall.team ?? 1) !== 1) return null;
        if (this._isWallQueued(gridX, gridY)) return null;

        const cell = GameMap.grid?.[gridY]?.[gridX];
        const top = Array.isArray(cell) ? cell[1] : cell;
        const typeName = TILE_MAP(top);
        const type = TILE_TYPES[typeName];
        if (!type) return null;

        return {
            key: `wall:${gridX},${gridY}`,
            kind: "wall",
            x: gridX,
            y: gridY,
            type,
            originalGridVal: top,
            refundCost: normalizeCostBundle(type.cost ?? type.price),
        };
    }

    _buildingTarget(entry) {
        if (!entry?.value || !entry?.type) return null;
        const rawHealth = Number(entry.value.health ?? entry.value.hp ?? entry.value.maxHealth ?? entry.value.maxHp ?? 100);
        if (!(rawHealth > 0) || entry.value._destroyed || entry.value.sprite?._destroyed) return null;
        const health = Math.max(1, rawHealth);
        const maxHealth = Math.max(health, Number(entry.value.maxHealth ?? entry.value.maxHp ?? health));
        return {
            key: this._targetKeyForBuilding(entry),
            kind: "building",
            x: entry.x,
            y: entry.y,
            type: entry.type,
            value: entry.value,
            duration: health,
            totalDuration: maxHealth,
            refundCost: normalizeCostBundle(entry.type.cost ?? entry.type.price),
        };
    }

    _getTargetAtWorld(worldX, worldY) {
        const gridX = Math.floor(worldX / SQUARESIZE);
        const gridY = Math.floor(worldY / SQUARESIZE);
        if (gridX < 0 || gridY < 0) return null;

        const building = this._findBuildingAtGrid(gridX, gridY);
        if (building) return this._buildingTarget(building);
        return this._wallTargetAtGrid(gridX, gridY);
    }

    _toggleTarget(target) {
        if (!target?.key) return;
        if (this.selected.has(target.key)) this._unselect(target.key);
        else this._select(target);
        this._syncCommandBar();
    }

    _select(target) {
        const marker = this._createMarker(target);
        this.selected.set(target.key, { ...target, marker });
    }

    _unselect(key) {
        const entry = this.selected.get(key);
        if (!entry) return;
        entry.marker?.destroy?.();
        this.selected.delete(key);
    }

    _clearSelection() {
        for (const key of [...this.selected.keys()]) this._unselect(key);
    }

    _createMarker(target) {
        if (target.kind === "building") {
            const lenX = Math.max(1, Number(target.type?.lenX || 1));
            const lenY = Math.max(1, Number(target.type?.lenY || 1));
            const centerX = (target.x + (lenX / 2)) * SQUARESIZE;
            const centerY = (target.y + (lenY / 2)) * SQUARESIZE;
            return this.scene.add.rectangle(centerX, centerY, lenX * SQUARESIZE, lenY * SQUARESIZE)
                .setStrokeStyle(3, 0xff4040, 1)
                .setFillStyle(0xff2a2a, 0.08)
                .setDepth(UIDEPTH + 2);
        }

        return this.scene.add.rectangle(
            target.x * SQUARESIZE + SQUARESIZE / 2,
            target.y * SQUARESIZE + SQUARESIZE / 2,
            SQUARESIZE,
            SQUARESIZE
        )
            .setStrokeStyle(2, 0xff4040, 1)
            .setFillStyle(0xff2a2a, 0.08)
            .setDepth(UIDEPTH + 2);
    }

    _drawDragRect() {
        if (!this.dragStartWorld || !this.dragEndWorld) return;
        const minX = Math.min(this.dragStartWorld.x, this.dragEndWorld.x);
        const minY = Math.min(this.dragStartWorld.y, this.dragEndWorld.y);
        const width = Math.max(1, Math.abs(this.dragEndWorld.x - this.dragStartWorld.x));
        const height = Math.max(1, Math.abs(this.dragEndWorld.y - this.dragStartWorld.y));

        this.dragGraphics.clear();
        this.dragGraphics.lineStyle(2, 0xff4545, 1);
        this.dragGraphics.fillStyle(0xff2a2a, 0.12);
        this.dragGraphics.fillRect(minX, minY, width, height);
        this.dragGraphics.strokeRect(minX, minY, width, height);
    }

    _applyDragSelection() {
        const rect = this._gridRectFromWorld(this.dragStartWorld, this.dragEndWorld);
        const seen = new Set();

        for (const entry of this._buildingEntries()) {
            const lenX = Math.max(1, Number(entry.type?.lenX || 1));
            const lenY = Math.max(1, Number(entry.type?.lenY || 1));
            const overlaps =
                entry.x <= rect.maxX &&
                entry.x + lenX - 1 >= rect.minX &&
                entry.y <= rect.maxY &&
                entry.y + lenY - 1 >= rect.minY;
            if (!overlaps) continue;
            const target = this._buildingTarget(entry);
            if (!target || seen.has(target.key)) continue;
            seen.add(target.key);
            if (!this.selected.has(target.key)) this._select(target);
        }

        for (let y = rect.minY; y <= rect.maxY; y += 1) {
            for (let x = rect.minX; x <= rect.maxX; x += 1) {
                const target = this._wallTargetAtGrid(x, y);
                if (!target || seen.has(target.key)) continue;
                seen.add(target.key);
                if (!this.selected.has(target.key)) this._select(target);
            }
        }

        this._syncCommandBar();
    }

    _resetDrag() {
        this.dragPending = false;
        this.dragActive = false;
        this.dragPointerId = null;
        this.dragStartScreen = null;
        this.dragStartWorld = null;
        this.dragEndWorld = null;
        this.pendingTarget = null;
        this.dragGraphics.clear();
        this.dragGraphics.setVisible(false);
    }

    _refundPreview() {
        const bundle = {};
        for (const target of this.selected.values()) {
            addCostBundle(bundle, target.refundCost);
        }
        return bundle;
    }

    _bannerText() {
        const count = this.selected.size;
        if (count <= 0) {
            return "DESTROY MODE | Click or drag to select walls/buildings";
        }

        const walls = [...this.selected.values()].filter((target) => target.kind === "wall").length;
        const buildings = count - walls;
        const refundText = formatCostBundle(this._refundPreview()) || "no resource return";
        return `DESTROY ${count} | ${walls} walls | ${buildings} buildings | Return ${refundText}`;
    }

    _commandBar() {
        return this.scene?.uiScene?.selectionCommandBar ?? null;
    }

    _syncCommandBar() {
        const bar = this._commandBar();
        if (!bar) return;
        bar.setContext("destroy-mode", {
            helperText: () => this._bannerText(),
            buttons: () => {
                const buttons = [
                    {
                        id: "destroy-exit",
                        label: "EXIT DESTROY",
                        styleKey: "neutral",
                        onClick: () => this.stop(),
                    },
                ];
                if (this.selected.size > 0) {
                    buttons.unshift(
                        {
                            id: "destroy-clear",
                            label: "CLEAR",
                            styleKey: "cancel",
                            onClick: () => {
                                this._clearSelection();
                                this._syncCommandBar();
                            },
                        },
                        {
                            id: "destroy-confirm",
                            label: "CONFIRM DESTROY",
                            styleKey: "destroy",
                            onClick: () => this.finalize(),
                        }
                    );
                }
                return buttons;
            },
        });
    }

    _clearCommandBar() {
        this._commandBar()?.clearContext?.("destroy-mode");
    }
}
