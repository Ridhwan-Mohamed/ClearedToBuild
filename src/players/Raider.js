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
    static speed   = 80;  // a bit quick
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

        // Make sure stamina math is well-defined (even if we never drain it)
        raider.maxStamina = raider.maxStamina ?? 100;
        raider.stamina    = raider.stamina ?? raider.maxStamina;

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
                const speed = 40;
                const dx = troop.swimDirX || 0;
                const dy = troop.swimDirY || 0;
                troop.body.setVelocity(dx * speed, dy * speed);
            }

            // Swimming uses manual velocities → skip stamina/followPath this frame
            return true;
        }

        // 2) Land-raider behaviour:
        // if they have no task, try to grab a destroy task
        const teamZero = Teams.teamLists["0"];
        if (!troop.task && teamZero && teamZero.destroyStates && teamZero.destroyStates.length) {
            Manager.assignOneTroopToAction(
                troop,
                teamZero.destroyStates,
                CONTROL_STATES.DESTROY_MODE
            );
        }

        // Let the shared stamina + followPath stuff run from Player.update
        return false;
    }
}
