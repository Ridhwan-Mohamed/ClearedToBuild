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

    static render() {
        this.clearUI();

        const troopCount = Teams.teamLists['1'].playerList.length;
        const foodNeeded = troopCount;
        const waterNeeded = troopCount;

        const foodHave = this.scene.foodAmnt;
        const waterHave = this.scene.cleanWaterAmnt;
        const woodHave = this.scene.woodAmnt;
        const stoneHave = this.scene.stoneAmnt;

        const iconSize = 40;
        const iconSpacing = 10; // space between rows
        const rowHeight = iconSize + iconSpacing;

        const startX = 30;
        const startY = 70;

        const data = [
            {
                icon: 'foodIcon',
                amount: foodNeeded,
                have: foodHave,
                showNeed: true
            },
            {
                icon: 'waterIcon',
                amount: waterNeeded,
                have: waterHave,
                showNeed: true
            },
            {
                icon: 'woodIcon',
                amount: null,
                have: woodHave,
                showNeed: false
            },
            {
                icon: 'stoneIcon',
                amount: null,
                have: stoneHave,
                showNeed: false
            }
        ];

        data.forEach((entry, i) => {
            const iconY = startY + i * rowHeight;

            const icon = this.scene.add.image(startX, iconY, entry.icon)
                .setDisplaySize(iconSize, iconSize)
                .setScrollFactor(0)
                .setDepth(UIDEPTH);

            const displayText = entry.showNeed
                ? `${entry.have}/${entry.amount}`
                : `${entry.have}`;

            const textColor = entry.showNeed
                ? (entry.have >= entry.amount ? '#00ff00' : '#ff4444')
                : (entry.have > 0 ? '#00ff00' : '#ff4444');

            const text = this.scene.add.text(
                startX + iconSize + 8, // icon + margin
                iconY,
                displayText,
                {
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    fill: textColor,
                    stroke: '#000000',
                    strokeThickness: 2
                }
            )
            .setOrigin(0, 0.5) // vertically center the text relative to icon
            .setScrollFactor(0)
            .setDepth(UIDEPTH);

            this.uiElements.push(icon, text );
            this.scene.cameras.main.ignore(this.uiElements)
        });
    }

    static clearUI() {
        if (this.uiElements) {
            this.uiElements.forEach(el => el.destroy());
        }
        this.uiElements = [];
    }

    static updateUIItems(item, count, decrease=false){
        if(decrease) count *= -1;
        if (item == UI_ITEM_TYPES.seedCrop) {
            seedManager.scene.updateSeeds(count);
        }
        else if(item == UI_ITEM_TYPES.seedBerry){
            seedManager.scene.updateBerry(count);
        }
        else if(item == UI_ITEM_TYPES.clean_water){
            this.scene.cleanWaterAmnt += count;
            this.render();
        }
        else if(item == UI_ITEM_TYPES.wood){
            this.scene.woodAmnt += count;
            this.render();
        }
        else if(item == UI_ITEM_TYPES.stone){
            this.scene.stoneAmnt += count;
            this.render();
        }
    }

    static consumeResources() {
        const troopCount = Teams.teamLists['1'].playerList.length;
        const foodConsumed = StorageManager.consumeItemFromStorage(1, UI_ITEM_TYPES.food, troopCount);
        const waterConsumed = StorageManager.consumeItemFromStorage(1, UI_ITEM_TYPES.clean_water, troopCount);
        // Update global amounts (if they exist for UI or logic tracking)
        this.scene.foodAmnt = Math.max(0, this.scene.foodAmnt - foodConsumed);
        this.scene.cleanWaterAmnt = Math.max(0, this.scene.cleanWaterAmnt - waterConsumed);
        this.render(); // re-render UI to reflect changes
    }

    static AddResources(item, amount){
        if(item.food){
            this.scene.foodAmnt += item.foodValue * amount;
        }
        this.render();
    }
}
