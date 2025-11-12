import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { Manager } from '../Manager/Manager.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { weapons } from '../weapons.js';
import { blockResourceManager } from '../Manager/BlockResourceManager.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
 
export class Forager {

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
        sprite.speed = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.baseSpeed = sprite.speed;
        sprite.setTint(0x228B22); // greenish tint for foragers
        sprite.unitTint = 0x228B22;
        sprite.body.pushable = false;
        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.name = NameGenerator.generate();
        sprite.weapon = weapons.hands;
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
        if(forager.task) return

        // 1.5. check for nearby enemies and flee in case.
        Player.updateTracking(forager);
        if(StorageManager.isCarrying(forager)){
            return StorageManager.tryCreateStorageDeliveryTask(forager);
        }
        const queue = Teams.teamLists[forager.body.team].foragerQueue;
        if (queue.length) {
            Manager.assignOneTroopToAction(forager, queue, CONTROL_STATES.TRACK_MODE);
        }
        if(!forager.task && forager.state == CONTROL_STATES.TRACK_MODE && !forager.roam){
            Player.roam(forager);
        }
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];
        if (!team?.foragerList) return;

        const index = team.foragerList.indexOf(troop);
        if (index !== -1) {
            team.foragerList.splice(index, 1);
        }

        // Clear any active timers or tasks
        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        if (troop.visionId != null) {
            VisibilitySystem.removeVisionBubble(troop.visionId);
            troop.visionId = null;
        }

        // Clear references
        if (troop.task) {troop.task.assigned--; troop.task = null;}
        if (troop.carrying) troop.carrying = null;
    }

}