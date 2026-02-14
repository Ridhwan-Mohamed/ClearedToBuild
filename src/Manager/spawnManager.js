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

export function recalculateDestroyTasksFromPoint(x = null, y = null, teamNumber = '0', troop) {
    const targetsAdded = new Set();
    const buildingArray = Teams.teamLists['1'].buildings;
    const pointsToCheck = (x !== null && y !== null) ? [[x, y]] : spawnPoints;

    for (const [px, py] of pointsToCheck) {
        const playerMock = { x: px, y: py };

        for (let [bx, by, type, building] of buildingArray) {
            const key = `${bx},${by}`;

            const alreadyInState = Teams.teamLists[teamNumber].destroyStates.some(
                t => t.x === bx && t.y === by
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
                    assigned: 0
                };
                Teams.addToStateArrayIfNotExists(teamNumber, 'destroyStates', task);
                targetsAdded.add(key);
            }
        }
    }
}

// helper (inside spawnManager)
export function pickRaidApproachForPOI(poiX, poiY, type, raiderTroop) {
    const targets = SiegePlanner.buildPerimeterTargets(
        poiX, poiY, type.lenX, type.lenY,
        Map.enemyNavGrid[0].length,
        Map.enemyNavGrid.length
    );

    // Try nearest-first by euclid; validate with path
    targets.sort((a, b) => {
        const awx = a.x * SQUARESIZE + SQUARESIZE/2, awy = a.y * SQUARESIZE + SQUARESIZE/2;
        const bwx = b.x * SQUARESIZE + SQUARESIZE/2, bwy = b.y * SQUARESIZE + SQUARESIZE/2;
        const da = (awx - raiderTroop.x)**2 + (awy - raiderTroop.y)**2;
        const db = (bwx - raiderTroop.x)**2 + (bwy - raiderTroop.y)**2;
        return da - db;
    });

    for (const t of targets) {
        if (Map.enemyNavGrid[t.y][t.x] !== 1) continue;
            // use troop-aware approach finder (now mesh-agnostic after patch #1)
            const res = buildingManager.findApproachAnyPerimeter(
            poiX, poiY, type, raiderTroop
        );

        if (res && res.path && res.path.length) {
            return res; // { tx, ty, path }
        }
    }
    return null;
}

export function spawnAndSend() {
    const [x, y] = Phaser.Utils.Array.GetRandom(spawnPoints);
    const player = Player.addPlayer(x, y, 0);

    Manager.assignOneTroopToAction(
        player,
        Teams.teamLists['0'].destroyStates,
        CONTROL_STATES.DESTROY_MODE
    );
}
export function spawnRaiderAtWorld(worldX, worldY, teamNumber = 0) {
    const gx = Math.floor(worldX / SQUARESIZE);
    const gy = Math.floor(worldY / SQUARESIZE);

    const x = Math.max(0, Math.min(WORLD_DIMENSIONX - 1, gx));
    const y = Math.max(0, Math.min(WORLD_DIMENSIONY - 1, gy));

    // If blocked, try a tiny local search
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
// 🌊 Spawn a single sea-raider on a random water edge, moving toward center
export function spawnSeaRaider(scene) {
    const nav = Map.navGrid;
    if (!nav || !nav.length) return;

    const h = nav.length;
    const w = nav[0].length;
    const candidates = [];

    // Collect all edge tiles that are NOT walkable (water)
    for (let x = 0; x < w; x++) {
        if (nav[0][x] === 0)        candidates.push([x, 0]);
        if (nav[h - 1][x] === 0)    candidates.push([x, h - 1]);
    }
    for (let y = 0; y < h; y++) {
        if (nav[y][0] === 0)        candidates.push([0, y]);
        if (nav[y][w - 1] === 0)    candidates.push([w - 1, y]);
    }

    if (!candidates.length) return;

    const [gx, gy] = Phaser.Utils.Array.GetRandom(candidates);

    // grid → world
    const startX = gx * SQUARESIZE + SQUARESIZE / 2;
    const startY = gy * SQUARESIZE + SQUARESIZE / 2;

    const centerX = (WORLD_DIMENSIONX * SQUARESIZE) / 2;
    const centerY = (WORLD_DIMENSIONY * SQUARESIZE) / 2;

    // Build a proper Raider unit so it plugs into the class-based system
    const raider = new Raider(gx, gy, 0); // team 0 = enemy

    raider.isSeaRaider = true;
    raider.isSwimming  = true;

    const dir = new Phaser.Math.Vector2(centerX - startX, centerY - startY).normalize();
    raider.swimDirX = dir.x;
    raider.swimDirY = dir.y;

    // low swim speed; Player.update will keep this going
    const swimSpeed = 40;
    raider.body.setVelocity(dir.x * swimSpeed, dir.y * swimSpeed);

    // 🔴 Create a minimap / overview icon for this enemy
    if (ZoomMixer.scene) {
        const s = ZoomMixer.scene;   // this is the Phaser.Scene, not the ZoomMixer instance

        const iconKey = "enemyIcon";
        if (!s.textures.exists(iconKey)) {
            const g = s.add.graphics();
            g.fillStyle(0xff0000, 1).fillCircle(6, 6, 5);      // red dot
            g.lineStyle(1, 0x000000, 1).strokeCircle(6, 6, 5); // black outline
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

        // Follow the raider in world space
        const updateCb = () => {
            if (!raider.active || !icon.active) {
                s.events.off("update", updateCb);
                if (icon.active) icon.destroy();
                return;
            }
            icon.setPosition(raider.x, raider.y);
        };

        s.events.on("update", updateCb);
    }


    return raider;
}
