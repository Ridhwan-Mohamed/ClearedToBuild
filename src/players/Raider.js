// players/Raider.js
import { SQUARESIZE, CONTROL_STATES, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "../constants";
import { Player } from "./Player";
import { Teams } from "../Teams";
import { Manager } from "../Manager/Manager";
import { Map } from "../map";
import { weapons } from "../weapons";
import { recalculateDestroyTasksFromPoint } from "../Manager/spawnManager";

export class Raider {
    // Used by Player.followPath via sprite.type.speed / sprite.type.stamina
    static speed   = 100;  // a bit quick
    static stamina = 0;   // no stamina drain

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

        raider.type       = Raider;
        raider.isRaider   = true;
        raider.isSeaRaider = false;   // sea mode is set in spawnSeaRaider
        raider.roam       = false;
        raider.maxHealth  = 100;

        // Make sure stamina math is well-defined (even if we never drain it)
        raider.maxStamina = raider.maxStamina ?? 100;
        raider.stamina    = raider.stamina ?? raider.maxStamina;
        raider.weapon     = weapons.hands;
        raider.destroySelf = () => Raider.destroy(raider); 

        // Enemies (team 0) already default to red tint in Player.applyDefaultTint,
        // so we don't have to override tint here.
        return raider;
    }

    /**
     * Raider AI.
     * Returns true if we handled movement completely (so Player.update should
     * skip stamina/followPath), false otherwise.
     */
    static update(troop) {
        // 1) Sea-raider swimming phase (coming in from the water)
        if (troop.isSeaRaider && troop.isSwimming) {
            const gx = Math.floor(troop.x / SQUARESIZE);
            const gy = Math.floor(troop.y / SQUARESIZE);

            const row  = Map.navGrid[gy];
            const tile = row ? row[gx] : 0;

            if (tile === 1) {
                // Reached walkable land
                troop.isSwimming = false;
                troop.body.setVelocity(0, 0);

                const landGX = gx;
                const landGY = gy;

                // Build destroy tasks for enemy team 0, around this landing point
                recalculateDestroyTasksFromPoint(landGX, landGY, "0");

                const teamZero = Teams.teamLists["0"];

                if (teamZero && teamZero.destroyStates && teamZero.destroyStates.length) {
                    // Use the same pipeline as spawnAndSend
                    Manager.assignOneTroopToAction(
                        troop,
                        teamZero.destroyStates,
                        CONTROL_STATES.DESTROY_MODE
                    );
                } else {
                    // No destroy targets? Just head toward map center as fallback
                    const destX = (WORLD_DIMENSIONX * SQUARESIZE) / 2;
                    const destY = (WORLD_DIMENSIONY * SQUARESIZE) / 2;
                    const path = Map.navMesh.findPath(
                        { x: troop.x, y: troop.y },
                        { x: destX,   y: destY }
                    );
                    if (path && path.length) {
                        Player.moveTo(troop, path);
                    }
                }
            } else {
                // Still in water: keep swimming toward the center
                const speed = 100;
                const dx = troop.swimDirX || 0;
                const dy = troop.swimDirY || 0;
                troop.body.setVelocity(dx * speed, dy * speed);
            }

            // Swimming uses manual velocities → skip stamina/followPath this frame
            return true;
        }

        // 2) Land-raider behaviour:

        // First: scan for nearby TEAM 1 units. If any are in threat radius,
        // treat them as primary targets (fight like a normal combatant).
        Player.updateTracking(troop);

        if (troop.track && troop.track[0] && troop.track[0].team === 1) {
            // Now the shared movement + fightManager.attack will handle the chase
            return false;
        }

        // 🔁 No valid player target (or we just cleared it) → go back to destroying buildings/crops
        const teamZero = Teams.teamLists["0"];
        if (!troop.task && teamZero && teamZero.destroyStates && teamZero.destroyStates.length) {
            Manager.assignOneTroopToAction(
                troop,
                teamZero.destroyStates,
                CONTROL_STATES.DESTROY_MODE
            );
        }

        // Let generic stamina + followPath run this frame
        return false;
    }

    static destroy(troop) {
        if (!troop || !troop.body) return;
        const scene = troop.scene;

        Player._destroyMiniBars(troop)

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
