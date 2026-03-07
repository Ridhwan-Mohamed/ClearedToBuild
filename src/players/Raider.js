// players/Raider.js
import { SQUARESIZE, CONTROL_STATES, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_MAP, TILE_TYPES } from "../constants";
import { Player } from "./Player";
import { Teams } from "../Teams";
import { Manager } from "../Manager/Manager";
import { Map } from "../map";
import { weapons } from "../weapons";
import { pickRaidApproachForPOI, recalculateDestroyTasksFromPoint } from "../Manager/spawnManager";
import { SiegePlanner } from "../lib/navmesh/SiegePlanner"
import { ZoomMixer } from "../UI/ZoomMixer";
export class Raider {
    // Used by Player.followPath via sprite.type.speed / sprite.type.stamina
    static speed   = 100;  // a bit quick
    static stamina = 0;   // no stamina drain
    static tint   = 0xff0000; // default red tint for enemies (can be overridden per raider if you want)
    
    constructor(x, y, teamNumber = 0) {
        // Reuse generic cube creation, but then specialize
        const raider = Player.addPlayer(
            x,
            y,
            teamNumber,
            "player", // sprite sheet
            "walk",
            "idle",
            "action",
            weapons.hands
        );
        
        raider.unitTint = Raider.tint; // if you use a separate tint for weapons/effects, set it here too
        raider.type       = Raider;
        raider.isRaider   = true;
        raider.isSeaRaider = false;   // sea mode is set in spawnSeaRaider
        raider.roam       = false;
        raider.maxHealth  = 100;
        raider.killReward  = 40;   // reward for player when killed (for contract tracking)

        // Make sure stamina math is well-defined (even if we never drain it)
        raider.maxStamina = raider.maxStamina ?? 100;
        raider.stamina    = raider.stamina ?? raider.maxStamina;
        raider.weapon     = weapons.hands;
        raider.destroySelf = () => Raider.destroy(raider); 
        ZoomMixer.createPlayerMoniker(raider);

        // Enemies (team 0) already default to red tint in Player.applyDefaultTint,
        // so we don't have to override tint here.
        return raider;
    }

    static update(troop) {
        // Cache the raider's "start" (used for O(1) region reach checks)
        if (troop._spawnWorldX == null || troop._spawnWorldY == null) {
            troop._spawnWorldX = troop.x;
            troop._spawnWorldY = troop.y;
        }

        if(troop.task){
            return false;
        }
        // -------------------------
        // 1) Sea-raider swimming phase
        // -------------------------
        if (troop.isSeaRaider && troop.isSwimming) {
            const gx = Math.floor(troop.x / SQUARESIZE);
            const gy = Math.floor(troop.y / SQUARESIZE);

            const onLandForRaider = Map.enemyNavGrid?.[gy]?.[gx] === 1;

            if (onLandForRaider) {
            troop.isSwimming = false;
            troop.body.setVelocity(0, 0);

            // Now that we are on land, lock the "start" point to the landing spot
            troop._spawnWorldX = troop.x;
            troop._spawnWorldY = troop.y;

            // Immediately pick a reachable building (random) using region checks
            troop.task = null;
            troop.currentPath = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            } else {
            const speed = 100;
            const dx = troop.swimDirX || 0;
            const dy = troop.swimDirY || 0;
            troop.body.setVelocity(dx * speed, dy * speed);
            }

            // swimming uses manual velocity
            return true;
        }

        // -------------------------
        // 2) Land behaviour: fight nearby TEAM 1 units first
        // -------------------------
        Player.updateTracking(troop);
        if (troop.track && troop.track[0] && troop.track[0].team === 1) {
            return false; // chase/attack handled elsewhere
        }

        // -------------------------
        // Helpers
        // -------------------------
        const isAdjacentTo = (tx, ty) => {
            const cx = Math.floor(troop.x / SQUARESIZE);
            const cy = Math.floor(troop.y / SQUARESIZE);
            return (Math.abs(cx - tx) + Math.abs(cy - ty)) === 1;
        };

        const pathToAdjacentWalkable = (tx, ty) => {
            const candidates = [
            { x: tx + 1, y: ty },
            { x: tx - 1, y: ty },
            { x: tx, y: ty + 1 },
            { x: tx, y: ty - 1 },
            ];

            candidates.sort((a, b) => {
            const awx = a.x * SQUARESIZE + SQUARESIZE / 2;
            const awy = a.y * SQUARESIZE + SQUARESIZE / 2;
            const bwx = b.x * SQUARESIZE + SQUARESIZE / 2;
            const bwy = b.y * SQUARESIZE + SQUARESIZE / 2;
            const da = (awx - troop.x) ** 2 + (awy - troop.y) ** 2;
            const db = (bwx - troop.x) ** 2 + (bwy - troop.y) ** 2;
            return da - db;
            });

            for (const n of candidates) {
            if (!Map.enemyNavGrid?.[n.y]?.[n.x]) continue;
            if (Map.enemyNavGrid[n.y][n.x] !== 1) continue;

            const dst = {
                x: n.x * SQUARESIZE + SQUARESIZE / 2,
                y: n.y * SQUARESIZE + SQUARESIZE / 2,
            };

            const p = Map.enemyNavMesh?.findPath?.({ x: troop.x, y: troop.y }, dst);
            if (p && p.length) return p;
            }

            return null;
        };

        const pickRandomReachableBuildingTask = () => {
            const buildingArray = Teams.teamLists?.["1"]?.buildings;
            if (!Array.isArray(buildingArray) || buildingArray.length === 0) return null;

            // Shuffle indices for unbiased random choice
            const n = buildingArray.length;
            const idxs = Array.from({ length: n }, (_, i) => i);
            for (let i = n - 1; i > 0; i--) {
                const j = (Math.random() * (i + 1)) | 0;
                [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
            }

            const rs = Map.enemyRegionSystem;

            const canReach = (bx, by) => {
                if (!rs?.canReachWorldToWorld) return true; // fallback if region system isn't ready
                const wx = bx * SQUARESIZE + SQUARESIZE / 2;
                const wy = by * SQUARESIZE + SQUARESIZE / 2;
                // IMPORTANT: use CURRENT location, not spawn
                return rs.canReachWorldToWorld(troop.x, troop.y, wx, wy);
            };

            // Two buckets: reachable and blocked (blocked might be solvable via siege)
            const reachable = [];
            const blocked = [];

            for (const k of idxs) {
                const [bx, by, type, building] = buildingArray[k];
                const entry = { bx, by, type, building };
                (canReach(bx, by) ? reachable : blocked).push(entry);
            }

            // Prefer reachable; otherwise attempt siege on a blocked POI
            const chosen = (reachable.length ? reachable[0] : (blocked.length ? blocked[0] : null));
            if (!chosen) return null;

            return {
                type: chosen.type,
                value: chosen.building,
                x: chosen.bx,
                y: chosen.by,
                duration: 100,
                assigned: 0,
            };
        };

        const beginSiegeForTask = (task) => {
            // Build perimeter targets around the POI footprint
            const fp = { x: task.x, y: task.y, w: task.type?.lenX ?? 1, h: task.type?.lenY ?? 1 };

            const gridH = Map.enemyNavGrid?.length ?? 0;
            const gridW = gridH ? (Map.enemyNavGrid[0]?.length ?? 0) : 0;
            if (!gridW || !gridH) return false;

            const targets = SiegePlanner.buildPerimeterTargets(fp.x, fp.y, fp.w, fp.h, gridW, gridH);

            // Ensure planner exists (your Raider has _ensureSiegePlanner in-file)
            const planner = Raider._ensureSiegePlanner?.();
            const breachTiles = planner?.planBreach?.(troop.x, troop.y, targets);

            if (!breachTiles || breachTiles.length === 0) return false;

            // Raider.js — inside beginSiegeForTask(task), right before the for-loop push :contentReference[oaicite:1]{index=1}
            const team0 = Teams.teamLists["0"];
            if (!Array.isArray(team0.siegeTileStates)) team0.siegeTileStates = [];

            // ✅ Put “seen” on the TEAM so all raiders share it (global dedupe)
            if (!team0._siegeSeen) team0._siegeSeen = new Set();

            for (const t of breachTiles) {
                const key = `${t.x},${t.y}`;
                if (team0._siegeSeen.has(key)) continue;
                team0._siegeSeen.add(key);

                team0.siegeTileStates.push({
                    x: t.x,
                    y: t.y,
                    duration: 500,
                    assigned: 0,
                    siege: true,
                    type: Raider._tileTypeAt(t.x, t.y) ?? { lenX: 1, lenY: 1, name: "wallTile" },
                });
            }


            // Mark the raider as in “siege posture” (no specific tile yet)
            troop.__postSiegeTask = task;
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.SIEGE_MODE);
            const taskObtained = Manager.assignOneTroopToAction(troop, team0.siegeTileStates, CONTROL_STATES.DESTROY_MODE_T);

            // Let update() pick up a distributed tile via Manager
            return taskObtained;
        };

        const roamToCenterEnemy = () => {
            const destX = (WORLD_DIMENSIONX * SQUARESIZE) / 2;
            const destY = (WORLD_DIMENSIONY * SQUARESIZE) / 2;
            const path = Map.enemyNavMesh?.findPath?.({ x: troop.x, y: troop.y }, { x: destX, y: destY });
            if (path && path.length) Player.moveTo(troop, path);
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        };

        const assignAndPathToTask = (task) => {

            // 1) Try normal raid approach (perimeter/door bias) first
            const res = Manager.assignTaskToTroop(troop, task, CONTROL_STATES.DESTROY_MODE)
            if (res) {
                return true;
            }

            // 2) If unreachable by path, attempt siege breach plan for this POI
            if (beginSiegeForTask(task)) return true;

            // 3) If no siege plan possible, fall back to roaming
            roamToCenterEnemy();
            return false;
        };

        // -------------------------
        // 3) If no current task: choose a RANDOM reachable building via region checks
        // -------------------------
        if (!troop.task) {
            const task = pickRandomReachableBuildingTask();
            if (task) {
                // If task is reachable -> normal path.
                // If task is blocked -> assignAndPathToTask will siege if needed.
                const obtainedTask = assignAndPathToTask(task);
                if(obtainedTask) return false;
            } else {
                // No buildings exist at all -> just roam
                roamToCenterEnemy();
            }
        }

        // -------------------------
        // 4) Siege-aware destroy handling (wall tiles)
        // -------------------------
        // const task = troop.task;

        // if (task?.siege === true) {
        //     if (troop.state !== CONTROL_STATES.SIEGE_MODE && troop.state !== CONTROL_STATES.DESTROY_MODE_T) {
        //         Teams.movePlayerState(troop, CONTROL_STATES.SIEGE_MODE);
        //     }

        //     const tx = task.x ?? task.tx;
        //     const ty = task.y ?? task.ty;

        //     if (Number.isFinite(tx) && Number.isFinite(ty)) {
        //         if (isAdjacentTo(tx, ty)) {
        //             Teams.movePlayerState(troop, CONTROL_STATES.DESTROY_MODE_T);
        //         } else {
        //             if (!troop.currentPath || troop.currentPath.length === 0) {
        //                 const p = pathToAdjacentWalkable(tx, ty);
        //                 if (p?.length) Player.moveTo(troop, p);
        //             }
        //         }
        //     }

        //     return false;
        // }

        // -------------------------
        // 5) Normal POI/building destroy task: ensure we have an approach path or siege
        // -------------------------
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        return false;
    }

    static _ensureSiegePlanner() {
        if (!Map.siegePlanner) {
            Map.siegePlanner = new SiegePlanner({
                squareSize: SQUARESIZE,
                enemyNavGrid: Map.enemyNavGrid,
                // "breachable" = walls or doors (whatever you used to paint/mark them in Map.grid)
                isBreachableTile: (tx, ty) => {
                    const cell = Map.grid?.[ty]?.[tx];
                    if (!cell) return false;

                    // If your grid stores [base, top] for placed tiles, look at the "top"
                    const top = Array.isArray(cell) ? cell[1] : cell;
                    const name = TILE_MAP(top);

                    // If you store numeric tile ids, adapt this check to your TILE_MAP/TILE_TYPES setup
                    if (name) return name == "woodWall" || name == "woodWall_door" || name == "wall" || name == "wall_door"

                    return false;
                },
                // Optional: tiles that siege should NEVER traverse even as "breach candidates"
                isHardBlockedTile: (tx, ty) => {
                    // example: outside bounds handled internally; here you can ban water if you want:
                    const cell = Map.grid?.[ty]?.[tx];
                    const top = Array.isArray(cell) ? cell[1] : cell;
                    const name = typeof top === "string" ? top : null;
                    return name === "water";
                },
                regionSystem: Map.enemyRegionSystem
            });
        }
        return Map.siegePlanner;
    }

    // task → footprint for POI buildings
    static _taskToFootprint(task) {
        if (!task) return null;

        // Preferred: building task.type has lenX/lenY (3x3 etc)
        if (task.type && Number.isFinite(task.type.lenX) && Number.isFinite(task.type.lenY)) {
            return { x: task.x, y: task.y, w: task.type.lenX, h: task.type.lenY };
        }

        // Fallback: if you store the target object on task.value
        const b = task.value;
        if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.lenX) && Number.isFinite(b.lenY)) {
            return { x: b.x, y: b.y, w: b.lenX, h: b.lenY };
        }

        return null;
    }

    static _tileToWorldCenter(tx, ty) {
        return { x: tx * SQUARESIZE + SQUARESIZE / 2, y: ty * SQUARESIZE + SQUARESIZE / 2 };
    }

    static siegeComplete(troop) {
        // Defensive: only raiders
        if (troop?.body?.team !== 0) return;

        // Clear *current* task without reassigning a bunch of state.
        // (You wanted “don’t reassign, just clear task and let update pick next”.)
        Teams.removeFromStateArray("0", "siegeTileStates", troop.task);
        troop.task = null;

        // If more siege walls remain, jump to next siege wall and let Manager path it
        if (troop._siegeQueue && troop._siegeQueue.length > 0) {
            const next = troop._siegeQueue.shift();
            next.assigned = next.assigned ?? 0;

            // Manager owns state + pathing
            Manager.assignTaskToTroop(troop, next, CONTROL_STATES.SIEGE_MODE);
            return;
        }

        // Siege is done: resume original goal (usually destroying the POI/building)
        const post = troop._postSiegeTask;
        troop._postSiegeTask = null;

        if (post) {
            post.assigned = post.assigned ?? 0;

            // IMPORTANT: use DESTROY_MODE so buildingManager destroy loop definitely ticks,
            // or keep SIEGE_MODE now that beginDestroyingBlock allows it.
            Manager.assignTaskToTroop(troop, post, CONTROL_STATES.DESTROY_MODE);
            return;
        }

        // Nothing left to do; fall back to default behavior (roam/idle/etc.)
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.roam = true;
    }

    // This should match whatever you used earlier for build/destroy approach
    static _makeWallDestroyTask(tx, ty) {
        const tileType = Raider._tileTypeAt(tx, ty);

        return {
            x: tx,
            y: ty,

            // ✅ actual tile type object (not a fake wallTile)
            // fallback keeps your code safe if something weird is on that tile
            type: tileType ?? { lenX: 1, lenY: 1, name: "wallTile" },

            duration: 6,
            assigned: 0,
            siege: true,
        };
    }


    static _tileTypeAt(tx, ty) {
        const cell = Map.grid?.[ty]?.[tx];
        if (!cell) return null;
        const top = Array.isArray(cell) ? cell[1] : cell;
        const name = TILE_MAP(top);              // "wall" | "woodWall" | "wall_door" | "woodWall_door" etc :contentReference[oaicite:2]{index=2}
        return name ? TILE_TYPES[name] : null;   // full type object with lenX/lenY/etc :contentReference[oaicite:3]{index=3}
    }

    // Call this whenever a raider finishes a destroy task (or periodically if you want)
    static tryResumePOIIfOpen(raider) {
        const siege = raider.__siege;
        if (!siege || !siege.originalTask) return false;

        // Attempt path to POI again (enemy mesh will be used because team==0 in your findPath selector)
        const fp = siege.footprint;
        const targetWorld = Raider._tileToWorldCenter(fp.x, fp.y);

        const path = Map.findPath(raider, targetWorld.x, targetWorld.y, fp.w, fp.h); // adjust signature to your finder
        if (path && path.length) {
            // Restore original POI task and go
            raider.task = siege.originalTask;
            raider.__siege = null;
            Player.moveTo(raider, path);
            return true;
        }

        return false;
    }

    isAdjacentToTile(tx, ty) {
        const cx = this.tileX, cy = this.tileY; // or however you store grid coords
        return Math.abs(cx - tx) + Math.abs(cy - ty) === 1;
    }

    static destroy(troop) {
        if (!troop || !troop.body) return;
        const scene = troop.scene;

        Player._destroyMiniBars(troop)
        troop.spawner?.notifyEnemyDied?.();

        // ✅ count kill toward the parcel contract (updates ⚔ text + completion)
        scene?.parcelManager?.notifyRaiderKilled?.(troop.contractId);

        const team = Teams.teamLists["0"];
        if (team) {
            if (team.fighterList) {
                const fidx = team.fighterList.indexOf(troop);
                if (fidx !== -1) team.fighterList.splice(fidx, 1);
            }
            const pidx = team.playerList.indexOf(troop);
            if (pidx !== -1) team.playerList.splice(pidx, 1);
        }

        // Cancel active timers
        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        // Drop task cleanly
        if (troop.task) {
            if (typeof troop.task.assigned === "number") troop.task.assigned--;
            troop.task = null;
        }

        troop.track = null;
        troop.forcedTarget = null;

        // Remove physics body
        if (troop.body) {
            try { scene.physics.world.remove(troop.body); } catch {}
            try { troop.body.destroy(); } catch {}
        }

        // Remove from global lists
        const idx = Player.troops.indexOf(troop);
        if (idx !== -1) Player.troops.splice(idx, 1);

        Player.characters.remove(troop);

        troop.destroy();
    }
}
