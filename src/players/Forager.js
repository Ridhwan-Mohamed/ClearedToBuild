import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { Manager } from '../Manager/Manager.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';

const MAX_CARRY = 1;

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
        sprite.speed = 90;
        sprite.setTint(0x228B22); // greenish tint for foragers
        sprite.unitTint = 0x228B22;
        sprite.body.pushable = false;
        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.name = NameGenerator.generate();

        sprite.carrying = null; 
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);

        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);

        sprite.isForager = true;
        Teams.addPlayer(teamNumber, sprite);

        Teams.teamLists[teamNumber].foragerList.push(sprite);
        return sprite;
    }

    static update(forager){
        if(forager.task) return
        const seedList = Teams.teamLists['1'].seedList;
        if(seedList.length && !StorageManager.isCarrying(forager)){
            return Manager.assignOneTroopToAction(forager, seedList, CONTROL_STATES.SEED_MODE);
        }
        if(StorageManager.isCarrying(forager)){
            return StorageManager.tryCreateStorageDeliveryTask(forager);
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

        troop.task = null;
        troop.carrying = null;

        // Remove sprite from the scene
        troop.body.sprite.destroy();
    }

}