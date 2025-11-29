import { BLOCKDEPTH, SQUARESIZE, TILE_TYPES, showGhostText, GHOST_ITEM_ICONS } from '../constants.js';
import { Map } from '../map.js';
import { Teams } from '../Teams.js';
import { DailyNeedsTracker } from '../UI/DailyNeedsTracker.js';
import { StorageUI } from '../UI/StorageUI.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';

export class StorageBuilding {
    static scene;

    constructor(x, y, teamNumber) {
        this.teamNumber = teamNumber;

        const item = TILE_TYPES.storage;
        this.sprite = StorageBuilding.scene.add.sprite((x+ Math.floor(item.lenX/2))*SQUARESIZE, (y + Math.floor(item.lenY/2))*SQUARESIZE, 'storage')
            .setDepth(BLOCKDEPTH);
        Map.drawRoadAround(x,y,item,teamNumber)
        Map.addBlockItem(x,y,item)

        if(teamNumber == 1){
            const cx = x + Math.floor(item.lenX/2);
            const cy = y + Math.floor(item.lenY/2);
            // Vision bubble: keep storage area slightly visible
            this.visionId = VisibilitySystem.addVisionBubble({ x: cx, y: cy, r: 6, boost: 0.10 });
            // Utility light: a bit dimmer than oven
            this.lightId  = VisibilitySystem.addLightSource({ x: cx, y: cy, r: 5, brightness: 2 });
        }

        this.x = x;
        this.y = y;

        // 🔹 NEW: per-item pickup reservations (itemName -> reserved count)
        this.reservedPickup = {};

        // Store item counts (max 10 total)
        this.capacity = 16;
        this.storageItems = Array(16).fill(null);
        this.addItem(UI_ITEM_TYPES.clean_water, 15);
        this.addItem(UI_ITEM_TYPES.food, 15);
        this.addItem(UI_ITEM_TYPES.wood, 4);
        this.addItem(UI_ITEM_TYPES.stone, 10);
        this.addItem(UI_ITEM_TYPES.seedCrop, 10);

        // Register into the team
        Teams.teamLists[teamNumber].storageList.push(this);
        Teams.teamLists[teamNumber].buildings.push([x, y, TILE_TYPES.storage, this.sprite])
        //setup UI listeners
        this.sprite.setInteractive({ useHandCursor: true });
        this.sprite.on('pointerover', () => StorageUI.showMinor(this));
        this.sprite.on('pointerout', () => StorageUI.hideMinor(this));
        this.sprite.on('pointerdown', () => {
            StorageBuilding.scene.openDetailPage('storage', tab => tab.selectFromWorld(this));
        });
    }

    get totalStored() {
        return this.storageItems.filter(slot => slot && slot.item && slot.item.name !== 'empty').length;
    }

    addItem(itemType, amount) {
        const itemDef = itemType;
        const OGAmnt = amount;
        if (!itemDef) return false;

        const maxStack = itemDef.stacks;
        let changed = false;

        // 1. Stack into existing slots
        for (let i = 0; i < this.storageItems.length; i++) {
            const slot = this.storageItems[i];
            if (slot && slot.item === itemType && slot.amount < maxStack) {
                const toAdd = Math.min(maxStack - slot.amount, amount);
                slot.amount += toAdd;
                amount -= toAdd;
                changed = true;
                if (amount <= 0) break;
            }
        }

        // 2. Fill new slots
        for (let i = 0; i < this.storageItems.length && amount > 0; i++) {
            if (!this.storageItems[i]) {
                const toAdd = Math.min(maxStack, amount);
                this.storageItems[i] = { item: itemDef, amount: toAdd };
                amount -= toAdd;
                changed = true;
            }
        }

        // 3. Refresh UI if needed
        if (changed) {
            const scene = StorageBuilding.scene;
            StorageUI.refreshMinor?.(this);

            const added = OGAmnt - amount;
            if (added > 0) {
                const icon = GHOST_ITEM_ICONS[itemType.name];
                const text = `+${added} ${icon}`;
                // teamNumber 0 ⇒ green in showGhostText
                showGhostText(scene, this.sprite.x, this.sprite.y - 12, text, 0, 0, 0, '#00ff00');
            }

            DailyNeedsTracker.AddResources(itemDef, added);
            scene.events.emit("storage:updated", this);
        }

        return amount <= 0;  // True if all items were added
    }

    removeItem(itemName, amount) {
        if (!itemName || amount <= 0) return false;
        let remaining = amount;
        let changed = false;

        // 1. Loop through all slots and subtract from matching ones
        for (let i = 0; i < this.storageItems.length; i++) {
            const slot = this.storageItems[i];
            if (!slot || slot.item.name !== itemName) continue;
            if (slot.amount > remaining) {
                slot.amount -= remaining;
                remaining = 0;
                changed = true;
                break;
            } else {
                remaining -= slot.amount;
                this.storageItems[i] = null;
                changed = true;
            }
            if (remaining <= 0) break;
        }

        // 2. Refresh UI if any slot changed
        if (changed) {
            const icon = GHOST_ITEM_ICONS[itemName];
            const text = `-${Math.abs(amount-remaining)} ${icon}`;
            // teamNumber 0 ⇒ green in showGhostText
            showGhostText(StorageBuilding.scene, this.sprite.x, this.sprite.y - 12, text, 0, 1, 0, '#ff0000');
            StorageUI.refreshMinor?.(this);
            const scene = StorageBuilding.scene;
            scene.events.emit("storage:updated", this);
        }
        return remaining <= 0; // true if full amount was removed
    }

    canAcceptItem(itemType, amount) {
        const itemDef = itemType;
        if (!itemDef) return false;

        const maxStack = itemDef.stacks;
        let needed = amount;

        for (let i = 0; i < this.storageItems.length; i++) {
            const slot = this.storageItems[i];

            if (!slot) {
                needed -= Math.min(maxStack, needed);
            } else if (slot.item.name === itemType && slot.amount < maxStack) {
                const spaceLeft = maxStack - slot.amount;
                needed -= Math.min(spaceLeft, needed);
            }

            if (needed <= 0) return true;
        }

        return false;
    }

    getItemCount(itemType) {
        return this.storageItems
            .filter(slot => slot && slot.item === itemType)
            .reduce((sum, slot) => sum + slot.amount, 0);
    }

    static canAcceptItem(itemType, team) {
        const itemDef = itemType;
        if (!itemDef) return null;

        const maxStack = itemDef.stacks;
        const storages = Teams.teamLists[team].storageList;
        const storageDeliveryItems = Teams.teamLists[team].storageDeliveryItems;

        for (const storage of storages) {
            let emptyCandidate = null;

            for (let i = 0; i < storage.storageItems.length; i++) {
                const slot = storage.storageItems[i];
                const existingTask = storageDeliveryItems.find(task =>
                    task.storage === storage && task.index === i
                );

                // Prefer stacking on existing matching items with room
                if (slot && slot.item === itemDef && slot.amount < maxStack) {
                    if (existingTask &&
                        (existingTask.item.name !== itemType.name ||
                        existingTask.remaining <= existingTask.assigned)) {
                        continue;
                    }
                    const room = maxStack - slot.amount;
                    return { storage, idx: i, remaining: room };
                }

                // Save empty slot as fallback, but don’t return yet
                if (!slot && !emptyCandidate) {
                    if (existingTask &&
                        (existingTask.item.name !== itemType.name ||
                        existingTask.remaining <= existingTask.assigned)) {
                        continue;
                    }
                    emptyCandidate = { storage, idx: i, remaining: maxStack };
                }
            }

            // If no stacking possible, return empty slot in the same building
            if (emptyCandidate) return emptyCandidate;
        }

        return null; // ❌ No space found
    }

    getReservedPickup(itemOrName) {
        const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
        return this.reservedPickup[name] || 0;
    }

    reservePickup(itemOrName, amount = 1) {
        const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;

        // 🔒 Only reserve if there is enough unreserved stock
        if (this.getAvailableForPickup(name) < amount) {
            return false;
        }

        this.reservedPickup[name] = (this.reservedPickup[name] || 0) + amount;
        return true;
    }

    releasePickup(itemOrName, amount = 1) {
        const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
        const cur = this.reservedPickup[name] || 0;
        const next = Math.max(0, cur - amount);
        if (next === 0) {
            delete this.reservedPickup[name];
        } else {
            this.reservedPickup[name] = next;
        }
    }

    getAvailableForPickup(itemOrName) {
        const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
        const itemType = UI_ITEM_TYPES[name];
        if (!itemType) return 0;

        const total = this.getItemCount(itemType);
        const reserved = this.getReservedPickup(name);
        return Math.max(0, total - reserved);
    }

    static hasTeamMaterials(itemName, amount, teamNumber) {
        const itemDef = UI_ITEM_TYPES[itemName];
        if (!itemDef) return false;

        let total = 0;
        const storages = Teams.teamLists[teamNumber].storageList;
        for (const storage of storages) {
            total += storage.getItemCount(itemDef);
            if (total >= amount) return true;
        }
        return false;
    }

    static removeTeamMaterials(itemName, amount, teamNumber) {
        const storages = Teams.teamLists[teamNumber].storageList;
        let remaining = amount;

        for (const storage of storages) {
            if (remaining <= 0) break;
            const removed = storage.removeItem(itemName, remaining);
            if (removed) remaining -= amount;
        }

        return remaining <= 0; // ✅ True if all removed
    }

    destroy() {
        this.sprite?.destroy();
        if (this.visionId) VisibilitySystem.removeVisionBubble(this.visionId);
        if (this.lightId)  VisibilitySystem.removeLightById(this.lightId);
        Teams.removeFromStateArray(this.teamNumber, 'storageList', this);
    }
}
