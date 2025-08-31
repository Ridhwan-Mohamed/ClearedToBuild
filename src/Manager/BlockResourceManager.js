import { Player } from "../players/Player"
import { Teams } from "../Teams"
import { Map } from "../map"
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES } from "../constants"
import { Manager } from "./Manager"
import { buildingArray } from "../town"
import { ClayOven } from "../buildings/ClayOven"
import { StorageBuilding } from "../buildings/Storage"
import { House } from "../buildings/House"
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker"
import { buildingManager } from "./buildingManager"
import { StorageManager } from "./StorageManager"
export class blockResourceManager{

    static NavMeshUpdater;
    static scene;

    static assingTroopsToGetBlockResources(teamNumber){
        let blockList = Teams.teamLists[`${teamNumber}`].blockResourceList
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].foragerList ;
        Manager.assignTroopsToAction(troops, blockList, CONTROL_STATES.GET_BLOCK_RESOURCE, force);
    }

    static beginFarmingBlockResource(sprite) {
        let task = sprite.task;

        if (!task) {
            sprite.task = null
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE)
            let teamNumber = sprite.body.team;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].blockResourceList, CONTROL_STATES.GET_BLOCK_RESOURCE);
            sprite.play(sprite.idle);
            return;
        }

        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
                if(!sprite.active || sprite.state != CONTROL_STATES.GET_BLOCK_RESOURCE) return;
                let teamNumber = sprite.body.team;
                const dx = sprite.x - sprite.task.x*SQUARESIZE;
                const dy = sprite.y - sprite.task.y*SQUARESIZE;

                if (Math.abs(dx) > Math.abs(dy)) {
                    sprite.flipX = dx < 0; // Face left if dx is negative
                    sprite.direction = dx > 0 ? 'right' : 'left';
                } else {
                    sprite.direction = dy > 0 ? 'down' : 'up';
                }
                
                sprite.play(sprite.action);
                task.remaining--;
                task.value.health = task.remaining;  // keep sprite.health updated
                task.assigned--;
                const frames = task.type.images;
                if (task.remaining > 0) {
                    const idx = Math.max(0, task.remaining - 1);
                    task.value.setTexture(frames[idx]);
                } else {
                    task.value.destroy();
                    let blockTiles = [];
                    for(let i = task.y; i < task.type.lenY + task.y; i++){
                        for(let j = task.x; j < task.type.lenX + task.x; j++){
                            blockTiles.push({x: j, y: i});
                        }
                    }
                    this.NavMeshUpdater.blockTiles(blockTiles, true);
                    buildingManager.removeBuildingFromArray(task.x, task.y);
                }
                StorageManager.addCarriedItem(sprite, task.resource);
                Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
                sprite.play(sprite.idle);
                sprite.timer = null;
                if(task.assigned <= 0 || task.remaining < 0){
                    Teams.removeFromStateArray(1, "blockResourceList", sprite.task);
                }
                sprite.task = null;
            });
        }
    }
}