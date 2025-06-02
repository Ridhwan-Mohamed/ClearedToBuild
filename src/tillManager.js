import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "./constants";
import { Manager } from "./Manager/Manager";
import { Map } from "./map";
import { mapView } from "./mapView";
import { Player } from "./Player";
import { Teams } from "./Teams";

export class tillManager {
    static scene;

    static assignTilesToTroops(troops, tileList) {
        Manager.assignTroopsToAction(troops, tileList, CONTROL_STATES.FARM_MODE);
    }

    static assignCropsToTroops(troops, cropList){
        Manager.assignTroopsToAction(troops, cropList, CONTROL_STATES.HARVEST_MODE);
    }

    static harvestCrop(sprite){
        if(!sprite.task) return;
        const x = sprite.task.x;
        const y = sprite.task.y;
        let cropTile;
        const key = `${x},${y}`
        const block = Map.cropDict[key];
        if (Array.isArray(block)) {
            cropTile = block[0];
        } else {
            cropTile = block;
        }
        if (cropTile && cropTile.anims.currentFrame.index == 3) {
            this.scene.updateMoney(10);
            cropTile.setFrame(1);           // ✅ Reset to first frame
            cropTile.anims.play('crops');   // ✅ Play the crop animation
        }

        if(sprite.state == CONTROL_STATES.R_FARM_MODE){
            Teams.removeFromStateArray(1, "TeamFarmSpots", sprite.task);
            sprite.task = null;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[`${sprite.body.team}`].TeamFarmSpots, CONTROL_STATES.R_FARM_MODE);
        }else{
            Teams.removeFromStateArray(1, "cropList", sprite.task);
            sprite.task = null;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[`${sprite.body.team}`].cropList, CONTROL_STATES.HARVEST_MODE);
        }
    }

    static beginTilling(sprite) {
        const x = sprite.task.x;
        const y = sprite.task.y;
        const task = sprite.task;
        if(!this.scene.checkSufficientSeeds(1)) return;
        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if(!this.scene.checkSufficientSeeds(1)) return;
            if(sprite.state != CONTROL_STATES.FARM_MODE) return;
            Teams.removeFromStateArray(1, "tileList", task);
            if (sprite) {
                this.scene.updateSeeds(-1);
            }
            Map.grid[y][x] = TILE_TYPES.crops.grid
            Map.drawGridValue(x,y)
            // Map.addSpreadArr(x, y, TILE_TYPES.crops, 0);
            sprite.timer = null;
            sprite.task = null;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[`${sprite.body.team}`].tileList, CONTROL_STATES.FARM_MODE);
        });
    }
}
