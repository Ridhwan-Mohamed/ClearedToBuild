import { StorageBuilding } from "../buildings/Storage";
import { BLOCKDEPTH, colorFor, CONTROL_STATES, MAX_CROP_GROWTH_STAGE, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "../constants";
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
        const {x, y} = sprite.task;
        if (!this.scene.checkSufficientSeeds(1)) return;

        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if (!sprite.active || sprite.state != CONTROL_STATES.FARM_MODE) return;

            const existingCrop = Teams.getCropAt(x, y, sprite.body.team);

            if (existingCrop) {
                // reseed existing crop
                existingCrop.hasSeed = true;
                existingCrop.growthStage = 0;
                existingCrop.dailyWatered = false;
                existingCrop.sprite.setFrame(1); // seeded soil
                Teams.setCropForWatering(existingCrop);
            } else {
                // plant new crop
                Map.grid[y][x] = TILE_TYPES.crops.grid;
                Map.drawGridValue(x,y);

                // Update overview image in real time
                if (this.scene?.zoomMixer) {
                    this.scene.zoomMixer.updateOverviewCell(
                        x,
                        y,
                        Map.grid
                    );
                }
                // add to Teams.teamLists[team].crops as usual, with sprite frame 1
            }

            StorageManager.removeCarriedItem(sprite);
            Teams.removeFromStateArray(1, "tileList", sprite.task);
            sprite.task = null;
            sprite.timer = null;
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
