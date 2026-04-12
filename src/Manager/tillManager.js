import { BLOCKDEPTH, CONTROL_STATES, MAX_CROP_GROWTH_STAGE, SQUARESIZE, TILE_TYPES } from "../constants";
import { Manager } from "./Manager";
import { StorageManager } from "./StorageManager";
import { Map } from "../map";
import { Player } from "../players/Player";
import { Teams } from "../Teams";
import { UI_ITEM_TYPES } from "../UI/UIConstants";
import { AudioManager } from "./AudioManager";

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

        const reservedDropoff =
            StorageManager.getDeliveryReservation(sprite, UI_ITEM_TYPES.crop) ||
            StorageManager.reserveDeliverySpace(sprite, UI_ITEM_TYPES.crop, 1);

        if (!reservedDropoff) {
            if (typeof sprite.task.assigned === "number" && sprite.task.assigned > 0) {
                sprite.task.assigned -= 1;
            }
            sprite.task = null;
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
            return;
        }

        // Reward and reset
        Teams.resetCrop(cropData);
        this.scene.updateMoney(10);
        StorageManager.addCarriedItem(sprite,UI_ITEM_TYPES.crop);
        AudioManager.playCropHarvest();
        Teams.removeFromStateArray(sprite.body.team, "TeamFarmSpots", sprite.task);
        sprite.task = null;
        if (!StorageManager.tryCreateStorageDeliveryTask(sprite)) {
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        }
    }

    static beginTilling(sprite) {
        const {x, y} = sprite.task;

        if (sprite.isFarmer && sprite.plantPose) {
            Player.setPoseLock(sprite, sprite.plantPose);
        }

        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if (!sprite.active || sprite.state != CONTROL_STATES.FARM_MODE) {
                Player.clearPoseLock(sprite);
                sprite.timer = null;
                return;
            }

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
            this.scene.removeTillPreviewSprite(x, y);
            StorageManager.removeCarriedItem(sprite);
            AudioManager.playPlant();
            Teams.removeFromStateArray(1, "tileList", sprite.task);
            sprite.task = null;
            sprite.timer = null;
            Player.clearPoseLock(sprite, sprite.idle);
        });
    }

    static beginWatering(sprite){
        const x = sprite.task.x;
        const y = sprite.task.y;
        sprite.play('action')
        AudioManager.playWateringStart();
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
            Teams.removeFromStateArray(sprite.body.team, "wateringList", sprite.task);
            sprite.timer = null;
            sprite.task = null;
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        });
    }
}
