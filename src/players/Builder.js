// === Builder.js ===
import { BLOCKDEPTH, CONTROL_STATES, SQUARESIZE } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { buildingManager } from '../Manager/buildingManager.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { Manager } from '../Manager/Manager.js';

export class Builder {

    static speed = 80;
    static stamina = 0.02;

    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'player'
        );

        Player.scene.uiCamera.ignore(sprite);

        sprite.setInteractive();
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.setSize(16, 12).setOffset(8, 20);
        sprite.setCollideWorldBounds(true);
        sprite.setTint(0x4433ff); // PURPLE TINT
        sprite.unitTint = 0x4433ff;
        sprite.name = NameGenerator.generate();

        sprite.id = Player.count++;
        sprite.body.team = teamNumber;
        sprite.health = 100;
        sprite.maxHealth = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.body.pushable = false;
        sprite.type = Builder

        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.carry = 'carry';

        sprite.isBuilder = true;

        // === Register with systems ===
        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].builderList.push(sprite);
        sprite.destroySelf = () => Builder.destroy(sprite);
        return sprite
    }
 
    static update(troop) {
        // If currently fleeing, only maintain flee behaviour.
        if (troop.state === CONTROL_STATES.FLEE_MODE) {
            Player.updateTracking(troop);   // may keep fleeing or drop back to TRACK_MODE when safe
            return;
        }

        // Always check for nearby enemies first (can flip into FLEE_MODE and drop tasks).
        Player.updateTracking(troop);
        if (troop.state === CONTROL_STATES.FLEE_MODE) {
            // Just started fleeing this tick; do not do builder logic.
            return;
        }

        // If we still have a task after tracking (i.e., not dropped by flee), just work it.
        if (troop.task) return;

        const team = Teams.teamLists[troop.body.team];

        if (team.destroyStates?.length) {
            const destroyList = team.destroyStates;
            Manager.assignOneTroopToAction(troop, destroyList, CONTROL_STATES.DESTROY_MODE); 
        } else if (team.blockBuildingStates?.length) { 
            const blockBuildList = team.blockBuildingStates;
            Manager.assignOneTroopToAction(troop, blockBuildList, CONTROL_STATES.BUILD_MODE_B);
        } else if (team.buildingTileStates?.length) {
            const tileList = team.buildingTileStates;
            Manager.assignOneTroopToAction(troop, tileList, CONTROL_STATES.BUILD_MODE_T);
        } else if (team.buildingFixTasks.length){
            const fixList = team.buildingFixTasks;
            Manager.assignOneTroopToAction(troop, fixList, CONTROL_STATES.FIX_BUILDING);
        } else if (!troop.task && !troop.track && troop.state === CONTROL_STATES.TRACK_MODE && !troop.roam) {
            Player.roam(troop);
        }
    }


    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];

        Player._destroyMiniBars(troop)

        if (team?.builderList) {
            const index = team.builderList.indexOf(troop);
            if (index !== -1) {
                team.builderList.splice(index, 1);
            }
        }

        let plIndex = team.playerList.indexOf(troop)
        if (plIndex !== -1) {
            team.playerList.splice(plIndex, 1);
        }
        const scene = troop.scene;
        if (scene?.playerTab?.onPlayerDestroyed) {
            scene.playerTab.onPlayerDestroyed(troop);
        }

        // Clear references
        if (troop.task) {troop.task.assigned--; troop.task = null;}
        if (troop.carrying) troop.carrying = null;

        if (troop.visionId != null) {
            VisibilitySystem.removeVisionBubble(troop.visionId);
            troop.visionId = null;
        }
        
        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

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
