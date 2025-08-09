// === Fireman.js ===

import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';
import { Manager } from '../Manager/Manager.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { StorageBuilding } from '../buildings/Storage.js';
import { waterSourcesQuadTree } from '../town.js';
import { ClayOven } from '../buildings/ClayOven.js';
import { buildingManager } from '../Manager/buildingManager.js';

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
        sprite.speed = 80;
        sprite.setTint(0xff9933); // orange tint
        sprite.unitTint = 0xff9933;
        sprite.body.pushable = false;
        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.name = NameGenerator.generate();
        sprite.skip = false; //flag for manager task allocation

        sprite.carrying = null; // [{ item, count }]
        sprite.isFireman = true;

        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);

        Teams.teamLists[teamNumber].firemanList.push(sprite);
        return sprite;
    }

    static update(troop) {
        if (troop.task) return;

        const outputList = Teams.teamLists['1'].ovenPickupItems;
        if (outputList) {
            const unassignedTask = outputList.find(val => val.assigned < val.amount);
            if(unassignedTask) {
                Manager.assignOneTroopToAction(troop, outputList, CONTROL_STATES.GET_FROM_OVEN)
                return;
            }
        }

        const carrying = StorageManager.isCarrying(troop);
        if (carrying) {
            const carryEntry = troop.carrying?.cooksTo;
            if (!carryEntry) return;

            const assigned = this.maybeAssignOvenDeliveryTask(troop, troop.carrying, 1);
            if (assigned) return;
        }


        // Not carrying anything → try to pick up something to cook
        if (!carrying) {
            const cookableItems = Object.values(UI_ITEM_TYPES).filter(it => it.cooksTo);
            for (const itemType of cookableItems) {
                const assigned = StorageManager.tryCreateStoragePickupTask(troop, itemType);
                if (assigned) return;
            }
        }

        const nearest = waterSourcesQuadTree.nearest(Math.floor(troop.x/SQUARESIZE), Math.floor(troop.y/SQUARESIZE));
        if (!carrying && nearest){
            troop.skip = true;
            const canReserve = this.maybeAssignOvenDeliveryTask(troop, UI_ITEM_TYPES.unclean_water, 1)
            if(canReserve){
                Teams.movePlayerState(troop, CONTROL_STATES.GET_WATER_MODE);
                Player.moveTo(troop, Player.pathTo(troop, nearest.x, nearest.y));
                return;
            }
        }

        if(!troop.task && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam){
            Player.roam(troop);
        }
    }

    static maybeAssignOvenDeliveryTask(troop, item, count = 1) {
        const freeSlotInfo = ClayOven.findFreeCookingSlot(UI_ITEM_TYPES.unclean_water, 1)
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

    static deliverToOven(troop) {
        const task = troop.task;
        const oven = task.oven;

        const success = oven.addItemToCook(task.item, task.count);
        if (success) {
            task.assigned--;
            task.remaining--;
            if (task.remaining <= 0 || task.assigned <= 0) {
                Teams.removeFromStateArray(troop.body.team, 'ovenDeliveryItems', task);
            }
            StorageManager.removeCarriedItem(troop)
        }

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
        const task = troop.task;
        const approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
        if(approachTile){
            StorageManager.addCarriedItem(troop, UI_ITEM_TYPES.unclean_water);
            troop.roam = false;
            Teams.movePlayerState(troop, CONTROL_STATES.SEND_TO_OVEN)
            Player.moveTo(troop, approachTile.path)
            return;
        }else{
            task.assigned--;
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        }
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

        troop.task = null;
        troop.carrying = [];
        troop.body.sprite.destroy();
    }
}
