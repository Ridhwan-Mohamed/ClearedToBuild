import { UIDEPTH } from '../constants.js';
import { seedManager } from '../Manager/seedManager.js';
import { StorageManager } from '../Manager/StorageManager.js';
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
        if (!this.scene?.topHudElements) return;
        if (decrease) count *= -1;

        const type = item.name || item;
        const s = this.scene;
        const team = Teams.teamLists["1"];
        const troopCount = team?.playerList?.length || 0;

        // Helper for colorized update
        const updateNeedText = (textObj, have, need) => {
            const color = have >= need ? "#00ff00" : "#ff3333";
            textObj.setColor(color);
            textObj.setText(`${have}/${need}`);
        };

        const adjust = (key, delta) => {
            s[key] = (s[key] ?? 0) + delta;
            const textObj = s.topHudElements.find(
                el => el.name === key && el instanceof Phaser.GameObjects.Text
            );
            if (textObj) textObj.setText(`${s[key]}`);
        };

        switch (type) {
            case UI_ITEM_TYPES.clean_water.name: {
                const have = s.cleanWaterAmnt;
                const need = troopCount;
                if (s.waterText) updateNeedText(s.waterText, have, need);
                break;
            }
            case UI_ITEM_TYPES.food.name: {
                const have = s.foodAmnt;
                const need = troopCount;
                if (s.foodText) updateNeedText(s.foodText, have, need);
                break;
            }
            case UI_ITEM_TYPES.wood.name: {
                s.woodAmnt = (s.woodAmnt ?? 0) + count;
                if (s.woodText) {
                    s.woodText.setText(`${s.woodAmnt}`);
                }
                break;
            }
            case UI_ITEM_TYPES.stone.name: {
                s.stoneAmnt = (s.stoneAmnt ?? 0) + count;
                if (s.stoneText) {
                    s.stoneText.setText(`${s.stoneAmnt}`);
                }
                break;
            }
            case UI_ITEM_TYPES.seedCrop.name:
                s.updateSeeds(count);
                break;
            case UI_ITEM_TYPES.seedBerry.name:
                s.updateBerry(count);
                break;
            default:
                break;
        }
    }



    static consumeResources() {
        const team = Teams.teamLists['1'];
        if (!team) return;
        const troopCount = team.playerList.length;

        const foodConsumed = StorageManager.consumeItemFromStorage(1, UI_ITEM_TYPES.food, troopCount);
        const waterConsumed = StorageManager.consumeItemFromStorage(1, UI_ITEM_TYPES.clean_water, troopCount);

        this.scene.foodAmnt = Math.max(0, this.scene.foodAmnt - foodConsumed);
        this.scene.cleanWaterAmnt = Math.max(0, this.scene.cleanWaterAmnt - waterConsumed);

        // 🔄 Update UI incrementally
        this.updateUIItems(UI_ITEM_TYPES.food, foodConsumed, true);
        this.updateUIItems(UI_ITEM_TYPES.clean_water, waterConsumed, true);
    }


    static AddResources(item, amount){
        if(item.food){
            this.scene.foodAmnt += item.foodValue * amount;
        }
    }
}
