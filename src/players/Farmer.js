// Farmer.js
import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES } from '../constants.js';
import { Manager } from '../Manager/Manager.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { waterSourcesQuadTree } from '../mainMenu.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { DailyNeedsTracker } from '../UI/DailyNeedsTracker.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';
import { AudioManager } from '../Manager/AudioManager.js';
import { Scheduler } from '../ai/scheduler/Scheduler.js';

export class Farmer {

    static speed = 80;
    static stamina = 0.02;
    static maxWaterPailCarry = 3;

    constructor(x, y, teamNumber) {
        const farmer = Player.scene.physics.add.sprite(SQUARESIZE *x + SQUARESIZE/2, SQUARESIZE*y + SQUARESIZE/2, 'player');
        Player.scene.uiCamera.ignore(farmer);
        farmer.setInteractive();
        farmer.id = this.count;
        Player.count += 1;
        farmer.setOrigin(0.5,0.5);
        farmer.setDepth(BLOCKDEPTH+1)
        farmer.roam = false;
        farmer.currentPath = []
        farmer.body.team = teamNumber;
        farmer.health = 60;
        farmer.maxHealth = 60;
        farmer.stamina = 100;
        farmer.maxStamina = 100;
        farmer.type = Farmer;
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
        farmer.pendingFarmSpot = null;
        ZoomMixer.createPlayerMoniker(farmer);
        Teams.movePlayerState(farmer, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(farmer);
        Player.troops.push(farmer);
        Player.configureCubeInteractivity(farmer);
        Teams.addPlayer(teamNumber, farmer);
        farmer.isFarmer = true;
        Teams.teamLists[teamNumber].farmerList.push(farmer);
        farmer.destroySelf = () => Farmer.destroy(farmer);
        return farmer;
    }
 
    static update(troop){
        // If currently fleeing, only maintain flee behaviour
        if (troop.state === CONTROL_STATES.FLEE_MODE) {
            Player.updateTracking(troop);   // can drop back to TRACK_MODE when safe
            return;
        }

        // Always check for nearby enemies first – may flip into FLEE_MODE
        Player.updateTracking(troop);
        if (troop.state === CONTROL_STATES.FLEE_MODE) {
            return; // we just started fleeing, don't do farm logic this tick
        }

        // 1. If manually assigned via tilling or harvesting
        if (troop.task) return;
        if (Scheduler.stepUnit(troop)) return;

        if(!troop.task && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam){
            Player.roam(troop);
        }
    }

    static tryAssignSeedFlow(troop, preferredSpot = null) {
        const teamData = Teams.teamLists[troop.body.team];
        if (!teamData) return false;

        const carrying = troop.carrying;
        const seedItemType = UI_ITEM_TYPES.seedCrop;
        const carryingSeeds = carrying && carrying === seedItemType;

        const reserveAndFetch = (spot) => {
            if (!spot) return false;
            spot.reservedBy = troop;
            troop.pendingFarmSpot = spot;

            if (carryingSeeds) {
                if (spot.reservedBy === troop) delete spot.reservedBy;
                troop.pendingFarmSpot = null;
                return Manager.assignTaskToTroop(troop, spot, CONTROL_STATES.FARM_MODE);
            }

            const gotPickup = StorageManager.tryCreateStoragePickupTask(troop, seedItemType);
            if (gotPickup) return true;

            if (spot.reservedBy === troop) delete spot.reservedBy;
            troop.pendingFarmSpot = null;
            return false;
        };

        if (troop.pendingFarmSpot) {
            const plot = troop.pendingFarmSpot;
            if (carryingSeeds) {
                if (plot.reservedBy === troop) delete plot.reservedBy;
                troop.pendingFarmSpot = null;
                return Manager.assignTaskToTroop(troop, plot, CONTROL_STATES.FARM_MODE);
            }
            if (StorageManager.tryCreateStoragePickupTask(troop, seedItemType)) return true;
            if (plot.reservedBy === troop) delete plot.reservedBy;
            troop.pendingFarmSpot = null;
            return false;
        }

        const tillSpots = teamData.tileList || [];
        if (preferredSpot && !preferredSpot.reservedBy && !Manager.tooManyAssigned(preferredSpot, 1)) {
            return reserveAndFetch(preferredSpot);
        }
        const spot = tillSpots.find((s) => !s.reservedBy && !Manager.tooManyAssigned(s, 1));
        return reserveAndFetch(spot);
    }

    static tryAssignWaterWork(troop, preferredCrop = null) {
        if (!troop.waterBucket.count) {
            this.assignWaterTask(troop);
            return true;
        }
        if (preferredCrop) {
            return Manager.assignOneTroopToAction(troop, [preferredCrop], CONTROL_STATES.WATER_CROPS_MODE);
        }
        const cropNeedingWater = Teams.getCropsNeedingWater(troop.body.team);
        if (!cropNeedingWater.length) return false;
        return Manager.assignOneTroopToAction(troop, cropNeedingWater, CONTROL_STATES.WATER_CROPS_MODE);
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
        DailyNeedsTracker.updateUIItems(troop.carrying.item, troop.carrying.count);

        // Cleanup
        troop.carrying = null;
        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }
    
    static giveTroopWater(sprite){
        sprite.waterBucket = { count: this.maxWaterPailCarry };
        sprite.task = null;
        AudioManager.playWaterPickup();
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
    }

    static destroy(farmer) {
        const teamList = Teams.teamLists[farmer.body.team];

        Player._destroyMiniBars(farmer)
        
        // Remove from farmerList
        const index = teamList.farmerList.indexOf(farmer);
        if (index !== -1) teamList.farmerList.splice(index, 1);

        let plIndex = teamList.playerList.indexOf(farmer)
        if (plIndex !== -1) {
            teamList.playerList.splice(plIndex, 1);
        }
        const scene = farmer.scene;
        if (scene?.playerTab?.onPlayerDestroyed) {
            scene.playerTab.onPlayerDestroyed(farmer);
        }

        // Clear references
        if (farmer.task) {farmer.task.assigned--; farmer.task = null;}
        if (farmer.carrying) farmer.carrying = null;

        if (farmer.visionId != null) {
            VisibilitySystem.removeVisionBubble(farmer.visionId);
            farmer.visionId = null;
        }

        if (farmer.timer) {
            farmer.timer.remove(false);
            farmer.timer = null;
        }

        // ❗ Remove from Player.characters group
        Player.characters.remove(farmer);

        // 💥 CRITICAL FIX: remove from physics world
        if (farmer.body) {
            farmer.scene.physics.world.remove(farmer.body);
            farmer.body.destroy();
        }

        const ind = Player.troops.indexOf(farmer);
        if (ind !== -1) Player.troops.splice(ind, 1);

        // Now safe to destroy the sprite
        farmer.destroy();
    }
}
