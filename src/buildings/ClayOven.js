// === ClayOven.js ===

import { BLOCKDEPTH, SQUARESIZE, TILE_TYPES } from "../constants";
import { Map } from "../map";
import { Teams } from "../Teams";
import { buildingManager } from "../Manager/buildingManager";
import { ClayOvenUI } from "../UI/ClayOvenUI";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

export class ClayOven {

    static scene;

    constructor(x, y, teamNumber) {
        this.teamNumber = teamNumber;
        const item = TILE_TYPES.clayOven
        this.sprite = ClayOven.scene.add.sprite((x+ Math.floor(item.lenX/2))*SQUARESIZE, (y + Math.floor(item.lenY/2))*SQUARESIZE, 'clayOven')
            .setDepth(BLOCKDEPTH);
        Map.drawRoadAround(x,y,item,teamNumber)
        Map.addBlockItem(x,y,item)

        this.sprite.anims.play('oven_idle');
        this.x = x;
        this.y = y;
        this.cooking = false;

        Teams.teamLists[teamNumber].ovenList.push(this);

        this.cookingSlots = [null, null, null];     // { item: UI_ITEM_TYPES.*, amount: number }
        this.outputSlots = [null, null, null];      // same structure
        this.cookTimers = [0, 0, 0];                // track elapsed time
        this.cookDurations = [0, 0, 0];             // required time
        this.fuel = 0;

        this.sprite.setInteractive();

        this.sprite.on('pointerover', () => ClayOvenUI.showMinor(this));
        this.sprite.on('pointerout', () => ClayOvenUI.hideMinor(this));
        this.sprite.on('pointerdown', () => ClayOvenUI.toggleMajor(this));

        ClayOven.scene.events.emit('oven:added', this);
    }

    hasFreeSlotForItem(itemType, amount) {
        for (let i = 0; i < 3; i++) {
            const slot = this.cookingSlots[i];
            if (!slot) {
                return { idx: i, remaining: itemType.stacks };
            } else if (slot.item === itemType) {
                const spotsLeft = itemType.stacks - slot.amount;
                if (spotsLeft > 0) {
                    return { idx: i, remaining: Math.min(spotsLeft, amount) };
                }
            }
        }
        return null;
    }

    static getOvensNeedingStorage() {
        return Teams.getOvens(1).filter(oven => {
            return oven.outputSlots.some(slot => 
                slot && (slot.amount >= 10 || slot.forceStore)
            );
        });
    }

    static isOpenOven() {
        const ovens = Teams.getOvens(1);
        for (const oven of ovens) {
            for (let i = 0; i < oven.cookingSlots.length; i++) {
                const slot = oven.cookingSlots[i];
                if (!slot || (slot.item && slot.amount < UI_ITEM_TYPES[slot.item.name].stacks)) {
                    return { oven, idx: i };
                }
            }
        }
        return null;
    }

    static findFreeCookingSlot(itemType, teamNumber) {
        const ovens = Teams.teamLists[teamNumber]?.ovenList || [];
        const ovenDeliveryItems = Teams.teamLists[teamNumber].ovenDeliveryItems;
        for (const oven of ovens) {
            let emptyCandidate = null;
            for (let i = 0; i < oven.cookingSlots.length; i++) {
                const slot = oven.cookingSlots[i];
                const existingTask = ovenDeliveryItems.find(task =>
                    task.oven === oven && task.inputidx === i
                );
                if (slot && slot.item === itemType) {
                    if (existingTask &&
                        (existingTask.item.name !== itemType.name ||
                        existingTask.remaining <= existingTask.assigned)) {
                        continue;
                    }
                    const spotsLeft = itemType.stacks - slot.amount;
                    if (spotsLeft > 0) {
                        return { oven, idx: i, remaining: spotsLeft };
                    }
                }
                if (!slot && !emptyCandidate) {
                    if (existingTask &&
                        (existingTask.item.name !== itemType.name ||
                        existingTask.remaining <= existingTask.assigned)) {
                        continue;
                    }
                    emptyCandidate = { oven, idx: i, remaining: itemType.stacks };
                }
            }
            if (emptyCandidate) return emptyCandidate;
        }
        return null;
    }

    addItemToCook(itemType, count) {
        const cooksTo = itemType.cooksTo;
        if (!cooksTo || count <= 0) return false;   // allow queuing with 0 fuel

        const maxPerSlot = itemType.stacks || 1;
        let inserted = 0;

        for (let i = 0; i < 3 && count > 0; i++) {
            const slot = this.cookingSlots[i];

            // Empty slot
            if (!slot) {
                const toAdd = Math.min(count, maxPerSlot);
                this.cookingSlots[i] = { item: itemType, amount: toAdd };
                this.cookTimers[i] = 0;
                this.cookDurations[i] = 100; // configurable later
                inserted += toAdd;
                count -= toAdd;
            }

            // Matching item slot with room
            else if (slot.item.name === itemType.name && slot.amount < maxPerSlot) {
                const space = maxPerSlot - slot.amount;
                const toAdd = Math.min(space, count);
                slot.amount += toAdd;
                inserted += toAdd;
                count -= toAdd;
            }
        }

        if (inserted > 0) {
            ClayOven.scene.events.emit('oven:updated', this);
        }
        return inserted > 0 ? inserted : false;
    }

    removeItemFromSlot(index, fromOutput = true) {
        const slots = fromOutput ? this.outputSlots : this.cookingSlots;
        if (index < 0 || index >= slots.length) return null;

        const slot = slots[index];
        if (!slot || slot.amount <= 0) return null;

        slot.amount--;

        // If emptied, clear the slot
        if (slot.amount === 0) {
            slots[index] = null;
        }

        ClayOven.scene.events.emit('oven:updated', this);
        return slot.item;
    }


    startCooking(slotIndex, duration = 3000) {
        if (this.isCooking[slotIndex]) return;

        this.isCooking[slotIndex] = true;
        this.updateAnimation();

        this.cookTimers[slotIndex] = ClayOven.scene.time.delayedCall(duration, () => {
            this.isCooking[slotIndex] = false;
            this.updateAnimation();
            // Add output handling logic here if needed
        });
    }

    updateAnimation() {
        const anyCooking = this.cookingSlots.some(state => state);
        if (anyCooking) {
            this.sprite.anims.play('oven_cooking', true);
        } else {
            this.sprite.anims.play('oven_idle');
        }
    }

    stopAllCooking() {
        for (let i = 0; i < 3; i++) {
            if (this.cookTimers[i]) {
                this.cookTimers[i].remove();
                this.cookTimers[i] = null;
            }
            this.isCooking[i] = false;
        }
        this.updateAnimation();
    }

    static beginPlacing() {
        const ghost = ClayOven.scene.add.sprite(0, 0, 'clayOven', 0)
            .setAlpha(0.5)
            .setDepth(TILE_TYPES.clayOven.depth)
            .setInteractive();

        const lenX = 4;
        const lenY = 4;

        // Track pointer position for placement
        let lastValidPos = null;

        const pointerMoveHandler = (pointer) => {
            if (pointer.x < 0 || pointer.y < 0) return;

            let x = Math.floor(pointer.worldX / SQUARESIZE) * SQUARESIZE;
            let y = Math.floor(pointer.worldY / SQUARESIZE) * SQUARESIZE;

            const gridX = Math.floor(x / SQUARESIZE) - Math.floor(lenX / 2);
            const gridY = Math.floor(y / SQUARESIZE) - Math.floor(lenY / 2);

            const isBlocked = Map.checkBlockPositionGen(gridX, gridY, lenX, lenY);

            ghost.setTint(isBlocked ? 0xff4444 : 0x44ff44);
            ghost.setPosition(
                x + (lenX % 2 ? SQUARESIZE / 2 : 0),
                y + (lenY % 2 ? SQUARESIZE / 2 : 0)
            );

            if (!isBlocked) {
                lastValidPos = { x, y, gridX, gridY };
            } else {
                lastValidPos = null;
            }
        };

        const pointerUpHandler = () => {
            if (lastValidPos) {
                const items = TILE_TYPES.clayOven
                Teams.teamLists['1'].blockBuildingStates.push({
                    type: items,
                    x: lastValidPos.gridX,
                    y: lastValidPos.gridY, 
                    duration: 100,
                    assigned: 0
                });
                buildingManager.assignTroopToBuildBlock(1);
                ghost.destroy();
                ClayOven.scene.input.off('pointermove', pointerMoveHandler);
                ClayOven.scene.input.off('pointerup', pointerUpHandler);
            }
        };

        ClayOven.scene.input.on('pointermove', pointerMoveHandler);
        ClayOven.scene.input.once('pointerup', pointerUpHandler);
    }

    updateCooking(delta) {
        let anyCooking = false;
        let changed = false;

        for (let i = 0; i < 3; i++) {
            const slot = this.cookingSlots[i];
            if (!slot) continue;

            // Need a duration to cook this slot (set when items were added)
            const dur = this.cookDurations[i] || 0;
            if (dur <= 0) continue;

            // If this cook cycle is just starting (timer==0), consume 1 fuel.
            if (this.cookTimers[i] === 0) {
                if (this.fuel > 0) {
                this.fuel -= 1;         // 🔥 consume wood
                changed = true;         // fuel changed → UI update
                this.cookTimers[i] += delta;   // now we can begin progressing
                anyCooking = true;
                } else {
                // No fuel: do not progress this timer.
                continue;
                }
            } else {
                // Already in-flight this cycle: keep progressing
                this.cookTimers[i] += delta;
                anyCooking = true;
            }

            if (this.cookTimers[i] >= this.cookDurations[i]) {
                changed = true;
                const cookedName = UI_ITEM_TYPES[slot.item.name].cooksTo;
                const cookedItem = UI_ITEM_TYPES[cookedName];

                const outSlot = this.outputSlots[i];
                if (!outSlot) {
                    this.outputSlots[i] = { item: cookedItem, amount: 1 };
                } else if (outSlot.item.name === cookedItem.name) {
                    outSlot.amount += 1;
                }

                slot.amount -= 1;
                this.cookTimers[i] = 0;
                this.cookDurations[i] = 500;

                if (slot.amount <= 0) {
                    this.cookingSlots[i] = null;
                    this.cookTimers[i] = 0;
                    this.cookDurations[i] = 0;
                }
                const slotOut = this.outputSlots[i];
                if (slotOut?.amount >= 5 || slotOut?.forceStore) {
                    const teamList = Teams.teamLists['1'].ovenPickupItems;
                    
                    // Check if a task already exists for this oven/output slot
                    let task = teamList.find(t => t.oven === this && t.outputidx === i);

                    if (task) {
                        // Add to the tracked amount
                        task.amount += 1;
                    } else {
                        // Create a new task for pickup
                        teamList.push({
                            oven: this,
                            outputidx: i,
                            x: this.x,
                            y: this.y,
                            type: TILE_TYPES.clayOven,
                            assigned: 0,
                            amount: slotOut.amount,
                            taskType: 'ovenPickup'
                        });
                    }
                }
            }
        }

        if (changed) {
           ClayOven.scene.events.emit('oven:updated', this);
        }

        // Only switch animation if needed
        if (this.cooking !== anyCooking) {
            this.cooking = anyCooking;
            this.sprite.anims.play(this.cooking ? 'oven_cooking' : 'oven_idle', true);
        }
    }

    addFuel(amount = 1) {
        this.fuel = Math.min(this.maxFuel || 100, this.fuel + amount);
        ClayOven.scene.events.emit('oven:updated', this);
        return true;
    }

    destroy() {
        this.stopAllCooking();
        ClayOven.scene.events.emit('oven:removed', this);
        if (this.sprite) this.sprite.destroy();
    }
}
