import { walkUpBindingElementsAndPatterns } from "typescript";
import { StorageBuilding } from "../buildings/Storage";
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "../constants";
import { Fireman } from "../players/Fireman";
import { Teams } from "../Teams";
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker";
import { StorageUI } from "../UI/StorageUI";
import { Manager } from "./Manager";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

export const STORAGE_SELL_PRICES = Object.freeze({
    clean_water: 2,
    unclean_water: 2,
    food: 3,
    rawFood: 3,
    crop: 3,
    wood: 4,
    stone: 5,
    seedCrop: 2,
    seedBerry: 3,
});

export class StorageManager {
    static scene;

    static getStorageSellPrice(itemOrName) {
        const name = typeof itemOrName === "string" ? itemOrName : itemOrName?.name;
        return STORAGE_SELL_PRICES[name] ?? 0;
    }

    static _countActiveDeliveryAssignments(task, players) {
        if (!task) return 0;
        return (players || []).reduce((count, troop) => {
            const validTroop =
                troop?.active !== false &&
                troop?.task === task &&
                troop?.state === CONTROL_STATES.SEND_TO_STORAGE &&
                troop?.carrying?.name === task.item?.name;
            return count + (validTroop ? 1 : 0);
        }, 0);
    }

    static pruneTeamDeliveryTasks(teamNumber) {
        const team = Teams.teamLists?.[`${teamNumber}`] ?? Teams.teamLists?.[teamNumber];
        if (!team) return [];

        const players = Array.isArray(team.playerList) ? team.playerList : [];
        const storages = Array.isArray(team.storageList) ? team.storageList : [];
        const tasks = Array.isArray(team.storageDeliveryItems) ? team.storageDeliveryItems : [];

        team.storageDeliveryItems = tasks.filter(task => {
            if (!task || task.taskType !== "storageDelivery" || !task.storage || !task.item) return false;
            if (!storages.includes(task.storage)) return false;

            const actualAssigned = this._countActiveDeliveryAssignments(task, players);
            task.assigned = actualAssigned;
            if (actualAssigned <= 0) return false;

            const projected = StorageBuilding.canAcceptItem(task.item, teamNumber, task.storage);
            if (projected?.storage === task.storage) {
                task.index = projected.idx;
                task.remaining = Math.max(actualAssigned, actualAssigned + Math.max(0, Number(projected.remaining || 0)));
            } else {
                task.remaining = Math.max(actualAssigned, Number(task.remaining || 0));
            }

            return true;
        });

        return team.storageDeliveryItems;
    }

    static grantItemToTeam(teamNumber, itemType, amount, scene = this.scene) {
        const team = Teams.teamLists?.[`${teamNumber}`] ?? Teams.teamLists?.[teamNumber];
        const itemDef = typeof itemType === "string" ? UI_ITEM_TYPES[itemType] : itemType;
        const requested = Math.max(0, Math.floor(Number(amount) || 0));
        if (!team || !itemDef || requested <= 0) return 0;

        const storages = Array.isArray(team.storageList) ? team.storageList : [];
        let remaining = requested;

        for (const storage of storages) {
            if (!(remaining > 0) || !storage?.addItem) break;
            const before = storage.getItemCount?.(itemDef) ?? 0;
            storage.addItem(itemDef, remaining);
            const after = storage.getItemCount?.(itemDef) ?? before;
            remaining -= Math.max(0, after - before);
        }

        const added = requested - remaining;
        if (added > 0) {
            DailyNeedsTracker.updateUIItems(itemDef, added, false);
        } else if (!storages.length && scene) {
            DailyNeedsTracker.updateUIItems(itemDef, requested, false);
            return requested;
        }

        return added;
    }

    static tryCreateStorageDeliveryTask(troop) {
        const carryEntry = troop.carrying;
        if (!carryEntry?.name) return false;

        const teamNumber = troop.body.team;
        const team = Teams.teamLists?.[teamNumber];
        if (!team) return false;

        this.pruneTeamDeliveryTasks(teamNumber);

        const result = StorageBuilding.canAcceptItem(carryEntry, teamNumber);
        if (!result) return false;
        const { storage, idx, remaining } = result;

        let task = team.storageDeliveryItems.find(existing =>
            existing.storage === storage && existing.item?.name === carryEntry.name
        );

        if (task) {
            task.index = idx;
            task.remaining = Math.max(task.assigned, task.assigned + Math.max(0, Number(remaining || 0)));
        } else {
            task = {
                type: TILE_TYPES.storage,
                x: storage.x,
                y: storage.y,
                storage,
                item: carryEntry,
                count: 1,
                index: idx,
                assigned: 0,
                remaining: Math.max(1, Number(remaining || 0)),
                taskType: 'storageDelivery'
            };
            team.storageDeliveryItems.push(task);
        }

        return Manager.assignTaskToTroop(troop, task, CONTROL_STATES.SEND_TO_STORAGE);
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
            this.pruneTeamDeliveryTasks(troop.body.team);
            return;
        }

        let success = task.storage.addItem(task.item, 1);
        if (!success) {
            const storages = Teams.teamLists?.[troop.body.team]?.storageList || [];
            for (const storage of storages) {
                if (!storage || storage === task.storage) continue;
                if (!storage.canAcceptItem(task.item, 1)) continue;
                success = storage.addItem(task.item, 1);
                if (success) break;
            }
        }

        if (success) {
            this.removeCarriedItem(troop);
            DailyNeedsTracker.updateUIItems(carried, 1);
        }

        // Clean up task
        task.assigned = Math.max(0, Number(task.assigned || 0) - 1);
        task.remaining = Math.max(0, Number(task.remaining || 0) - (success ? 1 : 0));

        if (task.remaining <= 0 || task.assigned <= 0) {
            Teams.removeFromStateArray(troop.body.team, 'storageDeliveryItems', task);
        }

        troop.task = null;
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        this.pruneTeamDeliveryTasks(troop.body.team);

        if (!success && troop.carrying) {
            this.tryCreateStorageDeliveryTask(troop);
        }
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
            let storageChanged = false;
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
                    storageChanged = true;

                    // Remove slot if empty
                    if (slot.amount <= 0) {
                        storage.storageItems[i] = null;
                    }

                    if (storageChanged) {
                        storage.compactItems?.();
                    }

                    // Early exit if we've consumed enough
                    if (consumed >= count) {
                        StorageUI.refreshMajor?.(storage);
                        StorageUI.refreshMinor?.(storage);
                        this.scene?.events?.emit?.("storage:updated", storage);
                        return consumed;
                    }
                }
            }

            if (storageChanged) {
                storage.compactItems?.();
                StorageUI.refreshMajor?.(storage);
                StorageUI.refreshMinor?.(storage);
                this.scene?.events?.emit?.("storage:updated", storage);
            }
        }

        return consumed;
    }

    static sellFromStorage(storage, slotIndex, amount = 1, scene = this.scene) {
        const slot = storage?.storageItems?.[slotIndex];
        if (!slot?.item) {
            return { sold: 0, revenue: 0, item: null };
        }

        const item = slot.item;
        const sold = storage.removeItemFromSlot?.(slotIndex, amount) ?? 0;
        if (sold <= 0) {
            return { sold: 0, revenue: 0, item };
        }

        DailyNeedsTracker.updateUIItems(item, sold, true);

        const revenue = this.getStorageSellPrice(item) * sold;
        const targetScene = scene || storage?.sprite?.scene || this.scene;
        if (revenue > 0 && typeof targetScene?.updateMoney === "function") {
            targetScene.updateMoney(revenue);
        }

        return { sold, revenue, item };
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
