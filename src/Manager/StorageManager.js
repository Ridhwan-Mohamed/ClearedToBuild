import { StorageBuilding } from "../buildings/Storage";
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "../constants";
import { Fireman } from "../players/Fireman";
import { Teams } from "../Teams";
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker";
import { StorageUI } from "../UI/StorageUI";
import { Manager } from "./Manager";

export class StorageManager {
    static scene;

    static tryCreateStorageDeliveryTask(troop) {
        const carryEntry = troop.carrying;
        if (!carryEntry) return false;

        const result = StorageBuilding.canAcceptItem(carryEntry, 1)
        if(!result) return false;
        let {storage, idx, remaining } = result;

        const existingTask = Teams.teamLists[troop.body.team].storageDeliveryItems.find(task =>
            task.storage === storage && task.item.name === carryEntry.name && task.index == idx
        );

        if (existingTask) {
            if (existingTask.assigned >= existingTask.remaining) return false;
        } else {
            const newTask = {
                type: TILE_TYPES.storage,
                x: storage.x,
                y: storage.y,
                storage,
                item: carryEntry,
                count: 1,
                index: idx,
                assigned: 0,
                remaining,
                taskType: 'storageDelivery'
            };
            Teams.teamLists[troop.body.team].storageDeliveryItems.push(newTask);
        }

        return Manager.assignOneTroopToAction(troop, Teams.teamLists[troop.body.team].storageDeliveryItems, CONTROL_STATES.SEND_TO_STORAGE);
    }

    static tryCreateStoragePickupTask(troop, itemType) {
        const storages = Teams.teamLists[troop.body.team].storageList;
        for (const storage of storages) {
            const amount = storage.getItemCount(itemType);
            if (amount <= 0) continue;

            const existingTask = Teams.teamLists[troop.body.team].storagePickupItems.find(task =>
                task.storage === storage && task.item.name === itemType.name
            );

            if (existingTask) {
                if (existingTask.assigned >= amount) continue;
                troop.task = existingTask;
            } else {
                const newTask = {
                    type: TILE_TYPES.storage,
                    x: storage.x,
                    y: storage.y,
                    storage,
                    item: itemType,
                    assigned: 0,
                    remaining: amount,
                    taskType: 'storagePickup'
                };
                Teams.teamLists[troop.body.team].storagePickupItems.push(newTask);
                troop.task = newTask;
            }
            
            return Manager.assignOneTroopToAction(troop, Teams.teamLists[troop.body.team].storagePickupItems, CONTROL_STATES.GET_FROM_STORAGE);;
        }

        return false;
    }

    static handleStorageDropoff(troop) {
        const task = troop.task;
        if (!task || task.taskType !== 'storageDelivery' || !task.storage) return;

        const carried = troop.carrying;
        if (!carried || carried.name !== task.item.name) {
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        const success = task.storage.addItem(task.item, 1);
        if (success) {
            this.removeCarriedItem(troop);
        }

        // Clean up task
        task.assigned--;
        task.remaining--;

        if (task.remaining <= 0 || task.assigned <= 0) {
            Teams.removeFromStateArray(troop.body.team, 'storageDeliveryItems', task);
        }

        DailyNeedsTracker.updateUIItems(carried, 1);

        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }

    static tryPickupFromStorage(troop) {
        const task = troop.task;
        if (!task || task.taskType !== 'storagePickup' || !task.storage) {
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        const taken = task.storage.removeItem(task.item.name, 1);
        if (!taken) {
            // Item was stolen by another troop, cancel
            task.assigned--;
            task.remaining--;
            if (task.remaining <= 0 || task.assigned <= 0) {
                Teams.removeFromStateArray(troop.body.team, 'storagePickupItems', task);
            }
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        this.addCarriedItem(troop, task.item);

        task.assigned--;
        task.remaining--;

        if (task.remaining <= 0 || task.assigned <= 0) {
            Teams.removeFromStateArray(troop.body.team, 'storagePickupItems', task);
        }

        if(troop.isFireman){
            const assigned = Fireman.maybeAssignOvenDeliveryTask(troop, task.item, 1);
            if (!assigned) {
                troop.task = null;
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            }
        }else{
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        }
    }

    static consumeItemFromStorage(teamID, itemFilter, count = 1) {
        const team = Teams.teamLists[teamID];
        if (!team) return 0;

        let consumed = 0;

        for (const storage of team.storageList) {
            for (let i = 0; i < storage.storageItems.length; i++) {
                const slot = storage.storageItems[i];
                if (
                    slot &&
                    (!itemFilter.name || slot.item.name === itemFilter.name) &&
                    (!itemFilter.type || slot.item.type === itemFilter.type)
                ) {
                    const toTake = Math.min(slot.amount, count - consumed);
                    slot.amount -= toTake;
                    consumed += toTake;

                    // Remove slot if empty
                    if (slot.amount <= 0) {
                        storage.storageItems[i] = null;
                    }

                    // Early exit if we've consumed enough
                    if (consumed >= count) {
                        StorageUI.refreshMajor?.(storage);
                        StorageUI.refreshMinor?.(storage);
                        return consumed;
                    }
                }
            }
        }

        return consumed;
    }

    static isCarrying(troop) {
        let isCarrying;
        troop.carrying ? isCarrying = true : isCarrying = false;
        return isCarrying;
    }

    static addCarriedItem(troop, item) {
        troop.carrying = item;
        troop.walk = 'carryWalk';
        troop.idle = 'carryIdle';
    }

    static removeCarriedItem(troop) {
        troop.carrying = null;
        troop.walk = 'walk';
        troop.idle = 'idle';
    }

}