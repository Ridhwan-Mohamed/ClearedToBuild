// Farmer.js
import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES } from '../constants.js';
import { Manager } from '../Manager/Manager.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { weapons } from '../weapons.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { waterSourcesQuadTree } from '../mainMenu.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { DailyNeedsTracker } from '../UI/DailyNeedsTracker.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';

export class Farmer {

    static speed = 80;
    static stamina = 0.02;
    static maxWaterPailCarry = 3;

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
        farmer.weapon = weapons.hands;
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
        // 1. If manually assigned via tilling or harvesting
        if (troop.task) return;

        // 1.5. check for nearby enemies and flee in case.
        Player.updateTracking(troop);
        const teamData = Teams.teamLists[troop.body.team];

        // ---- Carry state / seed detection ----
        const isCarryingAnything = StorageManager.isCarrying(troop);
        const carrying = troop.carrying;
        const seedItemType = UI_ITEM_TYPES.seedCrop;     // <-- seed item used for planting
        const carryingSeeds = (carrying && carrying === seedItemType);

        // 2. If carrying something that is NOT seeds, send it to storage as before
        if (isCarryingAnything && !carryingSeeds) {
            const assigned = StorageManager.tryCreateStorageDeliveryTask(troop);
            if (assigned) return;
        }

        // 3. Harvest ready crops (same logic as before, but we keep it before tilling)
        const readyCrop = teamData.TeamFarmSpots?.[0];
        if (readyCrop && !isCarryingAnything) {
            const isHarvesting = Manager.assignOneTroopToAction(
                troop,
                Teams.teamLists[troop.body.team].TeamFarmSpots,
                CONTROL_STATES.R_FARM_MODE
            );
            if (isHarvesting) return;
        }

        // 3.5. Tilling / planting flow:
        //  - Find an unreserved till spot
        //  - Mark it reserved by this farmer (so only 1 farmer per tile)
        //  - Create a storage pickup job for seeds
        //  - After seeds are picked up, come back and FARM that exact tile

        const tillSpots = teamData.tileList || [];

        // --- Case A: we already have a reserved till spot ---
        if (troop.pendingFarmSpot) {
            const plot = troop.pendingFarmSpot;

            // If we already fetched seeds, go plant this specific spot
            if (carryingSeeds) {
                if (plot.reservedBy === troop) delete plot.reservedBy;
                troop.pendingFarmSpot = null;

                Manager.assignTaskToTroop(
                    troop,
                    plot,
                    CONTROL_STATES.FARM_MODE
                );
                return;
            }

            // No seeds yet: try to create a pickup job for seeds
            const gotPickup = StorageManager.tryCreateStoragePickupTask(
                troop,
                seedItemType
            );
            if (gotPickup) return;

            // If no seeds available at all, release the reservation so the tile
            // can be used later when seeds exist.
            if (plot.reservedBy === troop) delete plot.reservedBy;
            troop.pendingFarmSpot = null;
            // fall through to watering / roaming
        } else {
            // --- Case B: no reserved till spot yet: try to claim one ---
            if (tillSpots.length) {
                // "unassigned" here = not reserved & not already at max workers
                const spot = tillSpots.find(
                    (s) => !s.reservedBy && !Manager.tooManyAssigned(s, 1)
                );

                if (spot) {
                    // Reserve this tile for this farmer only
                    spot.reservedBy = troop;
                    troop.pendingFarmSpot = spot;

                    // If we already have seeds on us (e.g. leftover from previous run),
                    // just go plant immediately.
                    if (carryingSeeds) {
                        if (spot.reservedBy === troop) delete spot.reservedBy;
                        troop.pendingFarmSpot = null;

                        Manager.assignTaskToTroop(
                            troop,
                            spot,
                            CONTROL_STATES.FARM_MODE
                        );
                        return;
                    }

                    // Otherwise: go fetch seeds from storage
                    const gotPickup = StorageManager.tryCreateStoragePickupTask(
                        troop,
                        seedItemType
                    );
                    if (gotPickup) {
                        return;
                    }else{
                        spot.reservedBy = null;
                        troop.pendingFarmSpot = null;
                    }

                    // If no seeds can be picked up right now, we keep the reservation
                    // for a bit so this farmer will keep trying once storage has seeds.
                    // If you want to immediately release it on failure, uncomment:
                    // if (spot.reservedBy === troop) delete spot.reservedBy;
                    // troop.pendingFarmSpot = null;
                }
            }
        }

        // 4. Water crops
        const cropNeedingWater = Teams.getCropsNeedingWater(troop.body.team);
        if (cropNeedingWater.length) {
            if (!troop.waterBucket.count) {
                this.assignWaterTask(troop);
                return;
            }
            const isWatering = Manager.assignOneTroopToAction(troop, cropNeedingWater, CONTROL_STATES.WATER_CROPS_MODE);
            if(isWatering) return;
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
        DailyNeedsTracker.updateUIItems(troop.carrying.item, troop.carrying.count);

        // Cleanup
        troop.carrying = null;
        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }
    
    static giveTroopWater(sprite){
        sprite.waterBucket = { count: this.maxWaterPailCarry };
        sprite.task = null;
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
    }

    static destroy(farmer) {
        const teamList = Teams.teamLists[farmer.body.team];
        
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
