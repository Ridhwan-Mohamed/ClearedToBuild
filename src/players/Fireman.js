// === Fireman.js ===

import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';
import { Manager } from '../Manager/Manager.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { waterSourcesQuadTree } from '../mainMenu.js';
import { ClayOven } from '../buildings/ClayOven.js';
import { buildingManager } from '../Manager/buildingManager.js';
import { weapons } from '../weapons.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';

const MAX_CARRY = 1;

export class Fireman {
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
        sprite.setTint(0xff9933); // orange tint
        sprite.unitTint = 0xff9933;
        sprite.body.pushable = false;
        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.name = NameGenerator.generate();
        sprite.skip = false; //flag for manager task allocation
        sprite.weapon = weapons.hands;
 
        sprite.carrying = null; // [{ item, count }]
        sprite.isFireman = true;

        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);

        Teams.teamLists[teamNumber].firemanList.push(sprite);
        sprite.destroySelf = () => Fireman.destroy(sprite);
        return sprite;
    }

    static update(troop) {
        if (troop.task || troop.pendingOvenJob || troop.pendingFuelJob) return;

        // check for nearby enemies and flee in case.
        Player.updateTracking(troop);

        const outputList = Teams.teamLists[troop.body.team].ovenPickupItems;
        if (outputList) {
            const unassignedTask = outputList.find(val => val.assigned < val.amount);
            if(unassignedTask) {
                Manager.assignOneTroopToAction(troop, outputList, CONTROL_STATES.GET_FROM_OVEN);
                return;
            }
        }

        // Try to find refill job
        if (Fireman.assignFromOvenFuelJobs(troop)) return;

        // Try to work on an oven job, if any
        if (Fireman.assignFromOvenJobs(troop)) return;

        const carrying = StorageManager.isCarrying(troop);
        if (carrying) {
            const carryEntry = troop.carrying?.cooksTo;
            if (!carryEntry) return;

            if (troop.pendingFuelJob && troop.carrying && troop.carrying.item === UI_ITEM_TYPES.wood) {
                // skip list creation entirely
                return Fireman.deliverFuelToOven(troop);
            }

            const assigned = this.maybeAssignOvenDeliveryTask(troop, troop.carrying, 1);
            if (assigned) return;
        }

        if(!troop.task && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam){
            Player.roam(troop);
        }
    }

    static assignFromOvenJobs(troop) {
        const team = Teams.teamLists[troop.body.team];
        if (!team) return false;

        // find a job with remaining work
        const job = team.ovenJobs.find(j => !j.canceled && j.remaining > j.assigned && j.oven?.sprite?.active);
        if (!job) return false;

        // if the job is water: go to lake (we'll deliver to the exact oven/slot later)
        if (job.item.name === UI_ITEM_TYPES.unclean_water.name) {
            const nearest = waterSourcesQuadTree.nearest(Math.floor(troop.x/SQUARESIZE), Math.floor(troop.y/SQUARESIZE));
            if (nearest) {
                troop.pendingOvenJob = job;             // remember which job this trip is for
                troop.skip = true;
                Teams.movePlayerState(troop, CONTROL_STATES.GET_WATER_MODE);
                Player.moveTo(troop, Player.pathTo(troop, nearest.x, nearest.y));
                return true;
            }
            return false; // no lake found -> wait
        }

        // otherwise: try to pick from storage for THIS job’s item
        troop.pendingOvenJob = job;
        return StorageManager.tryCreateStoragePickupTask(troop, job.item);
    }

    static assignFromOvenFuelJobs(troop) {
        const team = Teams.teamLists[troop.body.team];
        if (!team) return false;

        // find lowest-fuel oven job
        const job = team.ovenFuelJobs.find(j => !j.canceled && j.remaining > j.assigned && j.oven?.sprite?.active);
        if (!job) return false;

        troop.pendingFuelJob = job;
        return StorageManager.tryCreateStoragePickupTask(troop, UI_ITEM_TYPES.wood);
    }

    static maybeAssignOvenFuelDelivery(troop, job, item) {
        const team = Teams.teamLists[troop.body.team];
        if (!team || !job || job.canceled) return false;

        const list = team.ovenFuelDeliveryItems;
        let task = list.find(t => t.oven === job.oven && t.item.name === "wood");

        if (task) {
            if (task.assigned >= job.remaining) return false;
        } else {
            task = {
                type: TILE_TYPES.clayOven,
                x: job.oven.x, y: job.oven.y,
                oven: job.oven,
                item: item || UI_ITEM_TYPES.wood,
                count: 1,
                assigned: 0,
                remaining: job.remaining,
                taskType: 'ovenFuelDelivery',
                job
            };
            list.push(task);
        }

        return Manager.assignOneTroopToAction(troop, list, CONTROL_STATES.SEND_TO_OVEN);
    }

    static deliverFuelToOven(troop) {
        const job = troop.pendingFuelJob;
        if (!job || !job.oven) return false;

        const oven = job.oven;
        const amount = troop.carrying?.count || 1;

        if (oven.addFuel(amount)) {
            job.remaining -= amount;
            if (job.remaining <= 0) job.canceled = true;
        }

        StorageManager.removeCarriedItem(troop);
        troop.pendingFuelJob = null;
        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        return true;
    }

    static goRefuelOven(troop, job) {
        if (!job?.oven) return false;

        // Prepare to move back to oven
        troop.roam = false;
        Teams.movePlayerState(troop, CONTROL_STATES.SEND_TO_OVEN);
        troop.task = { oven: job.oven, taskType: 'ovenFuelDelivery' };

        // compute path to oven
        const approachTile = buildingManager.findBuildApproachBlock(
            job.oven.x, job.oven.y, TILE_TYPES.clayOven, troop
        );

        if (approachTile) {
            Player.moveTo(troop, approachTile.path);
            return true;
        }
        return false;
    }


    static maybeAssignOvenDeliveryTask(troop, item, count = 1) {
        const freeSlotInfo = ClayOven.findFreeCookingSlot(UI_ITEM_TYPES.unclean_water, troop.body.team)
        if (!freeSlotInfo) return false;

        const { oven, idx, remaining } = freeSlotInfo;
        if (remaining <= 0) return false;

        const deliveryList = Teams.teamLists[troop.body.team].ovenDeliveryItems;
        const existingTask = deliveryList?.find(task =>
            task.oven === oven &&
            task.item.name === item.name &&
            task.inputidx === idx
        );

        if (existingTask) {
            if (existingTask.assigned >= existingTask.remaining) return false;
            if(troop.skip) {existingTask.assigned++; troop.task = existingTask;};
        } else {
            const newTask = {
                type: TILE_TYPES.clayOven,
                x: oven.x,
                y: oven.y,
                oven,
                item,
                count,
                inputidx: idx,
                assigned: 0,
                remaining,
                taskType: 'ovenDelivery'
            };
            if(troop.skip) {newTask.assigned++; troop.task = newTask;}
            deliveryList.push(newTask);
        }
        if(!troop.skip) Manager.assignOneTroopToAction(troop, deliveryList, CONTROL_STATES.SEND_TO_OVEN);
        return true;
    }

    static maybeAssignOvenJobDelivery(troop, job, item) {
        const team = Teams.teamLists[troop.body.team];
        if (!team || !job || job.canceled) return false;

        const list = team.ovenDeliveryItems;
        // see if a delivery task for this oven/slot/item already exists
        let task = list.find(t =>
            t.oven === job.oven &&
            t.inputidx === job.inputidx &&
            t.item.name === (item?.name || job.item.name)
        );

        if (task) {
            // if that slot already has all units assigned, bail
            if (task.assigned >= job.remaining) return false;
        } else {
            // otherwise create a new delivery task object
            task = {
                type: TILE_TYPES.clayOven,
                x: job.oven.x,
                y: job.oven.y,
                oven: job.oven,
                item: item || job.item,
                count: 1,
                inputidx: job.inputidx,
                assigned: 0,
                remaining: job.remaining,
                taskType: 'ovenDelivery',
                job,                      // 🔗 keep link to job for bookkeeping
            };
            list.push(task);
        }

        // send this troop to the oven
        return Manager.assignOneTroopToAction(
            troop,
            list,
            CONTROL_STATES.SEND_TO_OVEN
        );
    }


    static deliverToOven(troop) {
        const task = troop.task;
        const oven = task.oven;

        const success = oven.addItemToCook(task.item, task.count);
        if (success) {
            // job bookkeeping
            const job = task.job || troop.pendingOvenJob;
            if (job) {
                job.assigned = Math.max(0, job.assigned - 1);
                job.delivered += 1;
                job.remaining = Math.max(0, job.target - job.delivered);
                if (job.remaining <= 0 || job.canceled) {
                    // remove job from queue
                    const jobs = Teams.teamLists[troop.body.team].ovenJobs;
                    const i = jobs.indexOf(job);
                    if (i !== -1) jobs.splice(i,1);
                }
            }

            // task bookkeeping
            task.assigned--;
            task.remaining = Math.max(0, task.remaining - 1);
            if (task.remaining <= 0) {
                Teams.removeFromStateArray(troop.body.team, 'ovenDeliveryItems', task);
            }
            StorageManager.removeCarriedItem(troop);
        }

        troop.pendingOvenJob = null;
        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }


    static handleOvenPickupComplete(troop) {
        const task = troop.task;
        if (!task || task.taskType !== 'ovenPickup') {
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        const oven = task.oven;
        const slotIdx = task.outputidx;

        const item = oven.removeItemFromSlot(slotIdx, true); // fromOutput = true
        if (!item) {
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        StorageManager.addCarriedItem(troop, item);

        // Update task state
        task.amount -= 1;
        task.assigned -= 1;

        if (task.amount <= 0) {
            Teams.removeFromStateArray(troop.body.team, 'ovenPickupItems', task);
        }

        const assigned = StorageManager.tryCreateStorageDeliveryTask(troop);
        if (!assigned) {
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        }
    }

    static firemanCompleteWaterPickup(troop){
        const job = troop.pendingOvenJob;
        const approachTile = buildingManager.findBuildApproachBlock(job?.x ?? 0, job?.y ?? 0, TILE_TYPES.clayOven, troop);
        if (approachTile){
            StorageManager.addCarriedItem(troop, UI_ITEM_TYPES.unclean_water);
            troop.roam = false;
            Teams.movePlayerState(troop, CONTROL_STATES.SEND_TO_OVEN);
            // 🚚 assign delivery to the specific oven job
            Fireman.maybeAssignOvenJobDelivery(troop, job, UI_ITEM_TYPES.unclean_water);
            Player.moveTo(troop, approachTile.path);
            return;
        }
        if (troop.task) troop.task.assigned--;
        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];
        if (!team?.firemanList) return;

        const index = team.firemanList.indexOf(troop);
        if (index !== -1) {
            team.firemanList.splice(index, 1);
        }

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        // Clear references
        if (troop.task) {troop.task.assigned--; troop.task = null;}
        if (troop.carrying) troop.carrying = null;
    }
}
