import { createBubbleText, showAlert } from '../constants.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { Player } from '../players/Player.js';
import { Teams } from '../Teams.js';
import { UI_ITEM_TYPES } from './UIConstants.js';

export class DailyNeedsTracker {
    static scene = null;

    static init(scene) {
        this.scene = scene;
        this.uiElements = [];
    }

    static getValues() {
        const team = Teams.teamLists["1"];
        const troopCount = team?.playerList?.length || 0;
        return [
            { key: 'foodIcon', have: this.scene.foodAmnt, need: troopCount },
            { key: 'waterIcon', have: this.scene.cleanWaterAmnt, need: troopCount },
        ];
    }

    static clearUI() {
        if (this.uiElements) {
            this.uiElements.forEach(el => el.destroy());
        }
        this.uiElements = [];
    }

    static updateUIItems(item, count, decrease = false) {
        if (!this.scene) return;

        const s = this.scene;
        const team = Teams.teamLists["1"];
        const troopCount = team?.playerList?.length || 0;

        // signed delta (positive for gain, negative for loss)
        const delta = decrease ? -count : count;

        const type = item.name || item;

        // Helper for colorized food/water text
        const updateNeedText = (textObj, have, need) => {
            const color = have >= need ? "#00ff00" : "#ff3333";
            textObj.setColor(color);
            textObj.setText(`${have}/${need}`);
        };

        switch (type) {
            case UI_ITEM_TYPES.clean_water.name: {
                s.cleanWaterAmnt = Math.max(0, (s.cleanWaterAmnt ?? 0) + delta);
                if (s.waterText) {
                    updateNeedText(s.waterText, s.cleanWaterAmnt, troopCount);
                }
                break;
            }

            case UI_ITEM_TYPES.food.name: {
                s.foodAmnt = Math.max(0, (s.foodAmnt ?? 0) + delta);
                if (s.foodText) {
                    updateNeedText(s.foodText, s.foodAmnt, troopCount);
                }
                break;
            }

            case UI_ITEM_TYPES.wood.name: {
                s.woodAmnt = Math.max(0, (s.woodAmnt ?? 0) + delta);
                if (s.woodText) {
                    s.woodText.setText(`${s.woodAmnt}`);
                }
                break;
            }

            case UI_ITEM_TYPES.stone.name: {
                s.stoneAmnt = Math.max(0, (s.stoneAmnt ?? 0) + delta);
                if (s.stoneText) {
                    s.stoneText.setText(`${s.stoneAmnt}`);
                }
                break;
            }

            case UI_ITEM_TYPES.seedCrop.name: {
                // scene helpers already know how to adjust seed counts
                if (typeof s.updateSeeds === "function") {
                    s.updateSeeds(delta);
                }
                break;
            }

            case UI_ITEM_TYPES.seedBerry.name: {
                if (typeof s.updateBerry === "function") {
                    s.updateBerry(delta);
                }
                break;
            }

            default:
                break;
        }
    }

    static consumeResources() { 
        const team = Teams.teamLists['1'];
        if (!team) return;

        const players = team.playerList;
        if (!players.length) return;

        // How many rations we can actually pull
        const troopCount = players.length;
        const totalFoodEaten  = StorageManager.consumeItemFromStorage(1, UI_ITEM_TYPES.food, troopCount);
        const totalWaterDrank = StorageManager.consumeItemFromStorage(1, UI_ITEM_TYPES.clean_water, troopCount);

        // Update stock + HUD
        this.updateUIItems(UI_ITEM_TYPES.food, totalFoodEaten, true);
        this.updateUIItems(UI_ITEM_TYPES.clean_water, totalWaterDrank, true);

        const scene = this.scene;
        const cam   = scene.cameras.main;
        const view  = cam.worldView;

        // PRIORITIZE: lowest health gets food/water first
        const sortedByHealth = [...players].sort((a, b) => a.health - b.health);

        let remainingFood  = totalFoodEaten;
        let remainingWater = totalWaterDrank;

        // --- Apply starvation / partial / full effects per player ---
        for (const p of sortedByHealth) {
            // Assign *this player's* rations
            const ate   = remainingFood  > 0;
            const drank = remainingWater > 0;

            if (ate)   remainingFood--;
            if (drank) remainingWater--;

            // FULL: ate + drank -> buff stamina
            if (ate && drank) {
                p.stamina = Math.min(p.maxStamina, p.stamina + 10);

                if (view.contains(p.x, p.y)) {
                    createBubbleText({
                        scene,
                        target: p,
                        text: "🍗💧 +10 STA",
                        textColor: "#66ff66",
                        bgColor: "rgba(0,0,0,0.20)",
                        fontSize: 10,
                        duration: 1200
                    });
                }
                continue;
            }

            // PARTIAL: got at least one -> small penalty
            if (ate || drank) {
                p.health  = Math.max(0, p.health - 20);
                if(p.health <= 0){
                    showAlert(scene, "Player " + p.name + " has died", "#ff0000", 5000)
                    Player.destroyPlayer(p)
                }
                p.stamina = Math.max(0, p.stamina - 20);

                if (view.contains(p.x, p.y)) {
                    createBubbleText({
                        scene,
                        target: p,
                        text: "😐 -20 HP/STA",
                        textColor: "#ffcc00",
                        bgColor: "rgba(40,20,0,0.20)",
                        fontSize: 10,
                        duration: 1200
                    });
                }
                continue;
            }

            // NONE: no food, no water -> big penalty
            p.health  = Math.max(0, p.health - 35);
            if(p.health <= 0){
                showAlert(scene, "Player " + p.name + " has died", "#ff0000", 5000)
                Player.destroyPlayer(p)
            }
            p.stamina = Math.max(0, p.stamina - 35);

            if (view.contains(p.x, p.y)) {
                createBubbleText({
                    scene,
                    target: p,
                    text: "😡 -35 HP/STA",
                    textColor: "#ff4444",
                    bgColor: "rgba(50,0,0,0.30)",
                    fontSize: 10,
                    duration: 1500
                });
            }
        }

    }

    static AddResources(item, amount) {
        if (!item?.food || !amount) return;

        const delta = item.foodValue * amount;
        // Reuse the same path as everything else so UI stays in sync
        this.updateUIItems(item, delta, false);
    }
}
