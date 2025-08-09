// Farmer.js
import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES } from '../constants.js';
import { Manager } from '../Manager/Manager.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';
import { waterSourcesQuadTree } from '../town.js';
import { weapons } from '../weapons.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';

export class Farmer {
    constructor(x, y, teamNumber) {
        const farmer = Player.scene.physics.add.sprite(SQUARESIZE *x + SQUARESIZE/2, SQUARESIZE*y + SQUARESIZE/2, 'player');
        farmer.setInteractive();
        farmer.id = this.count;
        Player.count += 1;
        farmer.setOrigin(0.5,0.5);
        farmer.setDepth(BLOCKDEPTH+1)
        farmer.roam = false;
        farmer.currentPath = []
        farmer.body.team = teamNumber;
        farmer.health = 100;
        farmer.speed = 100
        farmer.setTint(0x8B5A2B)
        farmer.unitTint = 0x8B5A2B;
        farmer.body.pushable = false;
        farmer.name = NameGenerator.generate();
        farmer.animState = 'idle'
        farmer.walk = 'walk';
        farmer.idle = 'idle';
        farmer.action = 'action';
        farmer.carrying = null;
        farmer.waterBucket = {count: 0};
        farmer.oldState = null;
        Teams.movePlayerState(farmer, CONTROL_STATES.TRACK_MODE);
        farmer.weapon = weapons.hands;
        Player.characters.add(farmer);
        Player.troops.push(farmer);
        Player.configureCubeInteractivity(farmer);
        Teams.addPlayer(teamNumber, farmer);
        farmer.isFarmer = true;
        Teams.teamLists[teamNumber].farmerList.push(farmer);
        return farmer;
    }

    static update(troop){
        const teamData = Teams.teamLists[troop.body.team];
        // 1. If manually assigned via tilling or harvesting
        if (troop.task) return;
        // 2. if carrying, go and store
        if(StorageManager.isCarrying(troop)){
            const assigned = StorageManager.tryCreateStorageDeliveryTask(troop);
            if(assigned) return;
        }
        // 3. Harvest ready crops
        const readyCrop = teamData.TeamFarmSpots?.[0];
        if (readyCrop && !StorageManager.isCarrying(troop)) {
            Manager.assignOneTroopToAction(troop, Teams.teamLists['1'].TeamFarmSpots, CONTROL_STATES.R_FARM_MODE);
            return;
        }
        // 4. Water crops
        const cropNeedingWater = Teams.getCropsNeedingWater(troop.body.team);
        if (cropNeedingWater.length) {
            if (!troop.waterBucket.count) {
                this.assignWaterTask(troop);
                return;
            }
            Manager.assignOneTroopToAction(troop, cropNeedingWater, CONTROL_STATES.WATER_CROPS_MODE);
            return;
        }
        // 5. roam
        else if(!troop.task && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam){
            Player.roam(troop);
        }
    }

    static assignWaterTask(troop) {
        const nearest = waterSourcesQuadTree.nearest(Math.floor(troop.x/SQUARESIZE), Math.floor(troop.y/SQUARESIZE));
        if (!nearest) return; 
        troop.task = { type: 'getWater', x: nearest.x, y: nearest.y };
        Teams.movePlayerState(troop, CONTROL_STATES.GET_WATER_MODE);
        Player.moveTo(troop, Player.pathTo(troop, nearest.x, nearest.y));
    }

    static addCarryToFarmer(troop, item, count = 1) {

        // If not carrying anything, create new carry object
        if (!troop.carrying) {
            troop.carrying = { item, count };
            return true;
        }

        // Already carrying something
        if (troop.carrying.item !== item) {
            return false; // can't carry multiple types
        }

        const newTotal = troop.carrying.count + count;
        troop.carrying.count = newTotal;
        // optional: update visual label or sprite (if needed)
        return true;
    }


    static handleStorageDropoff(troop) {
        const task = troop.task;
        if (!task || task.type !== 'storeCrop' || !task.storage) return;

        const storage = task.storage;
        storage.addItem(troop.carrying.item, troop.carrying.count);

        // Cleanup
        troop.carrying = null;
        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }
    
    static giveTroopWater(sprite){
        sprite.waterBucket = { count: 3 };
        sprite.task = null;
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
    }
}
