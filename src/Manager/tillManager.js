import { StorageBuilding } from "../buildings/Storage";
import { BLOCKDEPTH, CONTROL_STATES, MAX_CROP_GROWTH_STAGE, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "../constants";
import { Manager } from "./Manager";
import { StorageManager } from "./StorageManager";
import { Map } from "../map";
import { mapView } from "../mapView";
import { Player } from "../players/Player";
import { Farmer } from "../players/Farmer";
import { Teams } from "../Teams";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

export class tillManager {
    static scene;

    static assignTilesToTroops(teamNumber) {
        const tillList = Teams.teamLists['1'].tileList;
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].farmerList;
        Manager.assignTroopsToAction(troops, tillList, CONTROL_STATES.FARM_MODE, force);
    }

    static assignCropsToTroops(teamNumber){
        const cropList = Teams.teamLists['1'].cropList;
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].farmerList;
        Manager.assignTroopsToAction(troops, cropList, CONTROL_STATES.HARVEST_MODE, force);
    }

    static harvestCrop(sprite) {
        if (!sprite.task) return;

        const { x, y } = sprite.task;
        const cropData = Teams.getCropAt(x, y, sprite.body.team); // helper you likely already have

        if (!cropData || cropData.growthStage < MAX_CROP_GROWTH_STAGE) return;

        // Reward and reset
        Teams.resetCrop(cropData);
        this.scene.updateMoney(10);
        StorageManager.addCarriedItem(sprite,UI_ITEM_TYPES.crop);
        Teams.removeFromStateArray(sprite.body.team, "TeamFarmSpots", sprite.task);
        sprite.task = null;
        StorageManager.tryCreateStorageDeliveryTask(sprite);
    }

    static beginTilling(sprite) {
        const x = sprite.task.x;
        const y = sprite.task.y;
        const task = sprite.task;
        if(!this.scene.checkSufficientSeeds(1)) return;
        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if(!this.scene.checkSufficientSeeds(1)) return;
            if(!sprite.active || sprite.state != CONTROL_STATES.FARM_MODE) return;
            Teams.removeFromStateArray(1, "tileList", task);
            if (sprite) {
                this.scene.updateSeeds(-1);
                StorageManager.consumeItemFromStorage(sprite.body.team, UI_ITEM_TYPES.seedCrop);
            }
            Map.grid[y][x] = TILE_TYPES.crops.grid
            Map.drawGridValue(x,y)
            // Map.addSpreadArr(x, y, TILE_TYPES.crops, 0);
            sprite.timer = null;
            sprite.task = null;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[`${sprite.body.team}`].tileList, CONTROL_STATES.FARM_MODE);
        });
    }

    static beginWatering(sprite){
        const x = sprite.task.x;
        const y = sprite.task.y;
        sprite.play('action')
        // === Show sparkle image with fade-out ===
        const sparkle = this.scene.add.image(
            x * SQUARESIZE + SQUARESIZE / 2,
            y * SQUARESIZE + SQUARESIZE / 2,
            'sparkle'
        ).setDepth(BLOCKDEPTH + 1)
         .setScale(1)
         .setAlpha(1);

        this.scene.tweens.add({
            targets: sparkle,
            alpha: 0,
            scale: 1.5,
            duration: 600,
            ease: 'Sine.easeOut',
            onComplete: () => sparkle.destroy()
        });
        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if(!sprite.active || sprite.state != CONTROL_STATES.WATER_CROPS_MODE) return;
            //function needed here for setting dailywatered state to true here
            sprite.waterBucket.count = Math.max(0, sprite.waterBucket.count - 1);
            Teams.markCropWatered(sprite.body.team, x, y)
                // === Sparkle effect at crop location ===
            sprite.timer = null;
            sprite.task = null;
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
            Teams.removeFromStateArray(sprite.body.team, "wateringList", sprite.task);
        });
    }
}
