import { walkUpBindingElementsAndPatterns } from "typescript";
import { StorageBuilding } from "../buildings/Storage";
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "../constants";
import { Fireman } from "../players/Fireman";
import { Teams } from "../Teams";
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker";
import { StorageUI } from "../UI/StorageUI";
import { Manager } from "./Manager";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

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
        const team = Teams.teamLists[troop.body.team];
        if (!team) return false;

        const storages = team.storageList;
        if (!storages || storages.length === 0) return false;

        for (const storage of storages) {
            // how many of this item are actually free to be picked up?
            const available = storage.getAvailableForPickup(itemType);
            if (available <= 0) continue;

            // one-shot task just for this troop
            const task = {
                type: TILE_TYPES.storage,
                x: storage.x,
                y: storage.y,
                storage,
                item: itemType,
                assigned: 0,   // Manager will bump this to 1
                amount: 1,     // for Manager.tooManyAssigned(GET_FROM_STORAGE)
                taskType: 'storagePickup'
            };

            // 🔒 Try to reserve 1 unit; if someone else grabbed it between
            // available-check and now, this will fail and we move on.
            const reserved = storage.reservePickup(itemType, 1);
            if (!reserved) continue;

            // try to send the troop there; if pathing fails, undo reservation and try another storage
            const ok = Manager.assignTaskToTroop(
                troop,
                task,
                CONTROL_STATES.GET_FROM_STORAGE
            );

            if (!ok) {
                storage.releasePickup(itemType, 1);
                continue;
            }

            return true;
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

        const storage = task.storage;

        // Actually try to take 1 item
        const taken = storage.removeItem(task.item.name, 1);

        // Whatever happens, release the reservation
        storage.releasePickup(task.item, 1);

        if (!taken) {
            // Item was already used or removed by something else
                console.error("Failed to take form storage, STORAGE ALLOC ERROR")
            troop.task = null;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        // We successfully got one unit
        DailyNeedsTracker.updateUIItems(task.item, 1, true);
        this.addCarriedItem(troop, task.item);

        if (troop.isFireman) {
            // 🔥 fuel run: wood for an oven fuel job
            if (troop.pendingFuelJob && troop.carrying === UI_ITEM_TYPES.wood) {
                Fireman.goRefuelOven(troop, troop.pendingFuelJob);
                return;
            }

            // regular oven ingredient delivery
            Fireman.maybeAssignOvenJobDelivery(troop, troop.pendingOvenJob, task.item);
        } 
        else if (troop.isFarmer) {
            //if pending job go check if you can do it
            if (troop.pendingFarmSpot) {
                const plot = troop.pendingFarmSpot;
                // If we already fetched seeds, go plant this specific spot
                if (plot.reservedBy === troop) delete plot.reservedBy;
                troop.pendingFarmSpot = null;
                const canFarm = Manager.assignTaskToTroop(
                    troop,
                    plot,
                    CONTROL_STATES.FARM_MODE
                );
                if(!canFarm){
                    console.error("Failed to farm after seed pickup, FARM PATH ERROR")
                    StorageManager.tryCreateStorageDeliveryTask(troop);
                    troop.pendingFarmSpot.assigned = 0;
                    troop.pendingFarmSpot = null;
                    troop.task = null;
                }
                this.scene.enableTillFlash(plot.x, plot.y);
                return;
            }
        }
        else {
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
    }

    static removeCarriedItem(troop) {
        troop.carrying = null;
    }

}
