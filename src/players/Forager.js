import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { Manager } from '../Manager/Manager.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { Scheduler } from '../ai/scheduler/Scheduler.js';
 
export class Forager {

    static speed = 80;
    static stamina = 0.02;

    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(SQUARESIZE * x + SQUARESIZE / 2, SQUARESIZE * y + SQUARESIZE / 2, 'player');
        sprite.setInteractive();
        sprite.id = Player.count++;
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.roam = false;
        sprite.currentPath = [];
        sprite.body.team = teamNumber;
        sprite.health = 100;
        sprite.maxHealth = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.setTint(0x228B22); // greenish tint for foragers
        sprite.unitTint = 0x228B22;
        sprite.body.pushable = false;
        sprite.animState = 'idle';
        sprite.type = Forager;
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.swim = 'swim';
        sprite.name = NameGenerator.generate();
        sprite.carrying = null;
        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        sprite.isForager = true;
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].foragerList.push(sprite);
        sprite.destroySelf = () => Forager.destroy(sprite);
        return sprite;
    }

    static update(forager){
        // If currently fleeing, only maintain flee behaviour.
        if (forager.state === CONTROL_STATES.FLEE_MODE) {
            Player.updateTracking(forager);   // may keep fleeing or drop back to TRACK_MODE when safe
            return;
        }

        // Always check for nearby enemies first (can flip into FLEE_MODE and drop tasks).
        Player.updateTracking(forager);
        if (forager.state === CONTROL_STATES.FLEE_MODE) {
            // Just started fleeing this tick; do not do forager logic.
            return;
        }

        // If we still have a task after tracking (i.e., not dropped by flee), just work it.
        if (forager.task) return;

        if (Scheduler.stepUnit(forager)) return;

        if (!forager.task && forager.state === CONTROL_STATES.TRACK_MODE && !forager.roam) {
            Player.roam(forager);
        }
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];
        if (!team?.foragerList) return;

        Player._destroyMiniBars(troop)

        let plIndex = team.playerList.indexOf(troop)
        if (plIndex !== -1) {
            team.playerList.splice(plIndex, 1);
        }
        const scene = troop.scene;
        if (scene?.playerTab?.onPlayerDestroyed) {
            scene.playerTab.onPlayerDestroyed(troop);
        }

        const index = team.foragerList.indexOf(troop);
        if (index !== -1) {
            team.foragerList.splice(index, 1);
        }

        // Kill timers
        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        // Remove FoW bubble
        if (troop.visionId != null) {
            VisibilitySystem.removeVisionBubble(troop.visionId);
            troop.visionId = null;
        }

        // Clear tasks
        if (troop.task) { troop.task.assigned--; troop.task = null; }
        troop.carrying = null;

        // ❗ Remove from Player.characters group
        Player.characters.remove(troop);

        // 💥 CRITICAL FIX: remove from physics world
        if (troop.body) {
            troop.scene.physics.world.remove(troop.body);
            troop.body.destroy();
        }

        const ind = Player.troops.indexOf(troop);
        if (ind !== -1) Player.troops.splice(ind, 1);

        // Now safe to destroy the sprite
        troop.destroy();
    }

}
