import { buildingManager } from "./buildingManager";
import { CONTROL_STATES, SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "../constants";
import { Manager } from "./Manager";
import { Player } from "../players/Player";
import { Teams } from "../Teams";
import { spawnPoints } from "../town";
import Phaser from "phaser";
import { Map } from "../map";
import { ZoomMixer } from "../UI/ZoomMixer";
import { Raider } from "../players/Raider";
import { SiegePlanner } from "../lib/navmesh/SiegePlanner";

export function recalculateDestroyTasksFromPoint(x = null, y = null, teamNumber = "0", troop) {
    const targetsAdded = new Set();
    const buildingArray = Teams.teamLists["1"].buildings;
    const pointsToCheck = (x !== null && y !== null) ? [[x, y]] : spawnPoints;

    for (const [px, py] of pointsToCheck) {
        const playerMock = { x: px, y: py };

        for (const [bx, by, type, building] of buildingArray) {
            const key = `${bx},${by}`;

            const alreadyInState = Teams.teamLists[teamNumber].destroyStates.some(
                (t) => t.x === bx && t.y === by
            );

            if (alreadyInState || targetsAdded.has(key)) continue;

            const pathData = buildingManager.findBuildApproachBlock(bx, by, type, troop, playerMock.x, playerMock.y);
            if (pathData) {
                const task = {
                    type,
                    value: building,
                    x: bx,
                    y: by,
                    duration: 100,
                    assigned: 0,
                };
                Teams.addToStateArrayIfNotExists(teamNumber, "destroyStates", task);
                targetsAdded.add(key);
            }
        }
    }
}

export function pickRaidApproachForPOI(poiX, poiY, type, raiderTroop) {
    const targets = SiegePlanner.buildPerimeterTargets(
        poiX, poiY, type.lenX, type.lenY,
        Map.enemyNavGrid[0].length,
        Map.enemyNavGrid.length
    );

    targets.sort((a, b) => {
        const awx = a.x * SQUARESIZE + SQUARESIZE / 2;
        const awy = a.y * SQUARESIZE + SQUARESIZE / 2;
        const bwx = b.x * SQUARESIZE + SQUARESIZE / 2;
        const bwy = b.y * SQUARESIZE + SQUARESIZE / 2;
        const da = (awx - raiderTroop.x) ** 2 + (awy - raiderTroop.y) ** 2;
        const db = (bwx - raiderTroop.x) ** 2 + (bwy - raiderTroop.y) ** 2;
        return da - db;
    });

    for (const t of targets) {
        if (Map.enemyNavGrid[t.y][t.x] !== 1) continue;
        const res = buildingManager.findApproachAnyPerimeter(
            poiX, poiY, type, raiderTroop
        );

        if (res && res.path && res.path.length) {
            return res;
        }
    }
    return null;
}

export function spawnAndSend() {
    const [x, y] = Phaser.Utils.Array.GetRandom(spawnPoints);
    const player = Player.addPlayer(x, y, 0);

    Manager.assignOneTroopToAction(
        player,
        Teams.teamLists["0"].destroyStates,
        CONTROL_STATES.DESTROY_MODE
    );
}

export function spawnRaiderAtWorld(worldX, worldY, teamNumber = 0) {
    const gx = Math.floor(worldX / SQUARESIZE);
    const gy = Math.floor(worldY / SQUARESIZE);

    const x = Math.max(0, Math.min(WORLD_DIMENSIONX - 1, gx));
    const y = Math.max(0, Math.min(WORLD_DIMENSIONY - 1, gy));

    const nav = Map.enemyNavGrid;
    if (nav && nav[y] && nav[y][x] !== 1) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= WORLD_DIMENSIONX || ny >= WORLD_DIMENSIONY) continue;
                if (nav[ny]?.[nx] === 1) return new Raider(nx, ny, teamNumber);
            }
        }
    }

    return new Raider(x, y, teamNumber);
}

function normalizeSeaEdge(edge = null) {
    const value = String(edge || "").toLowerCase();
    if (value === "top" || value === "right" || value === "bottom" || value === "left") {
        return value;
    }
    return null;
}

function collectSeaEdgeCandidates(edge = null) {
    const nav = Map.navGrid;
    if (!nav || !nav.length) return [];

    const h = nav.length;
    const w = nav[0].length;
    const normalizedEdge = normalizeSeaEdge(edge);
    const candidates = [];

    const pushIfWater = (gx, gy, side) => {
        if (normalizedEdge && normalizedEdge !== side) return;
        if (nav[gy]?.[gx] !== 0) return;
        candidates.push({ gx, gy, edge: side });
    };

    for (let x = 0; x < w; x++) {
        pushIfWater(x, 0, "top");
        pushIfWater(x, h - 1, "bottom");
    }
    for (let y = 0; y < h; y++) {
        pushIfWater(0, y, "left");
        pushIfWater(w - 1, y, "right");
    }

    return candidates;
}

function applySeaRaiderMods(unit, modifier = null, options = {}) {
    if (!unit) return null;

    const speedMultiplier = Math.max(0.5, Number(options.speedMultiplier ?? modifier?.speedMultiplier ?? 1) || 1);
    const healthMultiplier = Math.max(0.5, Number(options.healthMultiplier ?? modifier?.healthMultiplier ?? 1) || 1);
    const damageMultiplier = Math.max(0.5, Number(options.damageMultiplier ?? modifier?.damageMultiplier ?? 1) || 1);

    unit.moveSpeedMultiplier = speedMultiplier;
    unit.hordeModifierKey = options.modifierKey ?? modifier?.key ?? null;
    unit.hordeModifierLabel = options.modifierLabel ?? modifier?.label ?? null;
    unit.hordeEnemyTypeLabel = options.enemyTypeLabel ?? modifier?.enemyTypeLabel ?? "Raiders";

    if (Number.isFinite(unit.maxHealth)) {
        unit.maxHealth = Math.max(1, Math.round(unit.maxHealth * healthMultiplier));
        unit.health = Math.min(unit.maxHealth, Math.max(1, Math.round((unit.health ?? unit.maxHealth) * healthMultiplier)));
    }

    if (unit.weapon) {
        unit.weapon = {
            ...unit.weapon,
            baseDmg: Math.max(1, Math.round(Number(unit.weapon.baseDmg ?? 0) * damageMultiplier)),
            critDmg: Math.max(1, Math.round(Number(unit.weapon.critDmg ?? 0) * damageMultiplier)),
        };
    }

    return {
        speedMultiplier,
        healthMultiplier,
        damageMultiplier,
    };
}

function attachSeaRaiderIcon(scene, raider) {
    const iconScene = scene ?? ZoomMixer.scene;
    if (!iconScene || !raider?.active) return;

    const iconKey = "enemyIcon";
    if (!iconScene.textures.exists(iconKey)) {
        const g = iconScene.add.graphics();
        g.fillStyle(0xff0000, 1).fillCircle(6, 6, 5);
        g.lineStyle(1, 0x000000, 1).strokeCircle(6, 6, 5);
        g.generateTexture(iconKey, 12, 12);
        g.destroy();
    }

    const icon = ZoomMixer.createZoomInvariantIcon(
        iconKey,
        "Sea Raider",
        raider.x,
        raider.y,
        { baseScale: 0.9 }
    );
    icon.setTint(0xff4444);

    const updateCb = () => {
        if (!raider.active || !icon.active) {
            iconScene.events.off("update", updateCb);
            if (icon.active) icon.destroy();
            return;
        }
        icon.setPosition(raider.x, raider.y);
    };

    iconScene.events.on("update", updateCb);
}

function spawnSingleSeaRaider(scene, options = {}) {
    const nav = Map.navGrid;
    if (!scene || !nav || !nav.length) return null;

    const rng = scene?.rng ?? Math.random;
    let candidates = collectSeaEdgeCandidates(options.edge);
    if (!candidates.length && options.edge) {
        candidates = collectSeaEdgeCandidates(null);
    }
    if (!candidates.length) return null;

    const candidate = candidates[Math.floor(rng() * candidates.length)];
    const gx = candidate.gx;
    const gy = candidate.gy;
    const startX = gx * SQUARESIZE + SQUARESIZE / 2;
    const startY = gy * SQUARESIZE + SQUARESIZE / 2;
    const targetPoint = options.targetPoint ?? {
        x: (WORLD_DIMENSIONX * SQUARESIZE) / 2,
        y: (WORLD_DIMENSIONY * SQUARESIZE) / 2,
    };

    const raider = new Raider(gx, gy, options.teamNumber ?? 0);
    const appliedMods = applySeaRaiderMods(raider, options.modifier, options);

    raider.isSeaRaider = true;
    raider.isSwimming = true;
    raider.isNightHordeEnemy = !!options.nightHordeId;
    raider.nightHordeId = options.nightHordeId ?? null;
    raider.hordeIndex = options.hordeIndex ?? null;
    raider.seaSpawnEdge = candidate.edge;
    raider.swimTargetX = Number(targetPoint?.x ?? startX);
    raider.swimTargetY = Number(targetPoint?.y ?? startY);

    const dir = new Phaser.Math.Vector2(raider.swimTargetX - startX, raider.swimTargetY - startY);
    if (dir.lengthSq() <= 0.001) dir.set(0, 1);
    dir.normalize();
    raider.swimDirX = dir.x;
    raider.swimDirY = dir.y;

    const fallbackSpeed = Math.round(220 * Math.max(1, Number(appliedMods?.speedMultiplier ?? 1) || 1));
    const swimSpeed = Math.max(160, Number(options.swimSpeed ?? 0) || fallbackSpeed);
    raider.swimSpeed = swimSpeed;
    raider.body.setVelocity(dir.x * swimSpeed, dir.y * swimSpeed);

    attachSeaRaiderIcon(scene, raider);
    return raider;
}

export function spawnSeaRaider(scene, options = {}) {
    const count = Math.max(1, Math.floor(Number(options?.count ?? 1) || 1));
    if (count === 1) {
        return spawnSingleSeaRaider(scene, options);
    }

    const spawned = [];
    for (let i = 0; i < count; i++) {
        const unit = spawnSingleSeaRaider(scene, options);
        if (unit) spawned.push(unit);
    }
    return spawned;
}
