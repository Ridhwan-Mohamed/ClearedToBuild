import { Player } from "../players/Player"
import { Teams } from "../Teams"
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, colorFor } from "../constants"
import { Manager } from "./Manager"
import { buildingManager } from "./buildingManager"
import { StorageManager } from "./StorageManager"
import { VisibilitySystem } from "../UI/VisibilitySystem"
import { Map } from "../map"
import { AudioManager } from "./AudioManager"

export class blockResourceManager{

    static NavMeshUpdater;
    static scene;
    static woodBreakDuration = 1500;
    static rockBreakDuration = 2500

    static assingTroopsToGetBlockResources(teamNumber){
        let blockList = Teams.teamLists[`${teamNumber}`].blockResourceList
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].foragerList ;
        Manager.assignTroopsToAction(troops, blockList, CONTROL_STATES.GET_BLOCK_RESOURCE, force);
    }

    static assignTroopToGetBlockResource(troop, task){
        Manager.assignOneTroopToAction(troop, task, CONTROL_STATES.GET_BLOCK_RESOURCE);
    }

    static beginFarmingBlockResource(sprite) {
        let task = sprite.task;

        if (!task) {
            sprite.task = null
            AudioManager.setHarvestActive(sprite, "wood", false);
            AudioManager.setHarvestActive(sprite, "rock", false);
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE)
            let teamNumber = sprite.body.team;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].blockResourceList, CONTROL_STATES.GET_BLOCK_RESOURCE);
            sprite.play(sprite.idle);
            return;
        }

        if (!sprite.timer) {
            const isWoodJob = sprite.task.type == TILE_TYPES.pine;
            AudioManager.setHarvestActive(sprite, isWoodJob ? "wood" : "rock", true);
            const duration = sprite.task.type == TILE_TYPES.pine ? this.woodBreakDuration : this.rockBreakDuration;
            sprite.timer = this.scene.time.delayedCall(duration, () => {
                if (!sprite.active || sprite.state != CONTROL_STATES.GET_BLOCK_RESOURCE) {
                    // job interrupted
                    const isWoodJob = sprite.task?.type == TILE_TYPES.pine;
                    AudioManager.setHarvestActive(sprite, isWoodJob ? "wood" : "rock", false);
                    sprite.timer = null;
                    return;
                }
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
                // If this is a layered/complex resource (like PineTree), use its adapter.
                // Else fall back to the old single-sprite frames logic.
                if (task.remaining > 0) {
                    if (typeof task.value?.applyBlockDamage === 'function') {
                        task.value.applyBlockDamage(task.remaining);
                    } else {
                        const frames = task.type.images;
                        const idx = Math.max(0, task.remaining - 1);
                        task.value.setTexture(frames[idx]);
                    }
                } else {
                    if (typeof task.value?.applyBlockDamage === 'function') {
                        task.value.applyBlockDamage(0); // will self-destroy + clean the outline
                    } else {
                        if (task.value.queuedOutline) {
                            task.value.queuedOutline.destroy();
                            task.value.queuedOutline = null;
                        }
                        task.value.destroy();
                    }
                    let blockTiles = [];
                    for(let i = task.y; i < task.type.lenY + task.y; i++){
                        for(let j = task.x; j < task.type.lenX + task.x; j++){
                            blockTiles.push({x: j, y: i});
                        }
                    }
                    // 🔵 overview: reflect cleared resource tiles
                    if (this.scene?.zoomMixer) {
                        for (const t of blockTiles) {
                            this.scene.zoomMixer.updateOverviewCell(
                                t.x,
                                t.y,
                                Map.grid,
                                task.type.lenX,
                                task.type.lenY
                            );
                        }
                    }
                    
                    this.NavMeshUpdater.blockTiles(blockTiles, true);
                    buildingManager.removeBuildingFromArray(task.x, task.y);
                    VisibilitySystem.onOccluderChangedRect(task.x, task.y, task.type.lenX, task.type.lenY, /*isBlock=*/false);
                }
                AudioManager.playBlockBreak(isWoodJob ? "wood" : "rock");
                StorageManager.addCarriedItem(sprite, task.resource);
                Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
                sprite.play(sprite.idle);
                sprite.timer = null;
                if(task.remaining < 0){
                    Teams.removeFromStateArray(1, "foragerQueue", sprite.task);
                    task.value.queuedOutline.destroy();
                    value.queuedOutline = null;
                }
                const finishedWoodJob = sprite.task?.type == TILE_TYPES.pine;
                AudioManager.setHarvestActive(sprite, finishedWoodJob ? "wood" : "rock", false);
                sprite.task = null;
            });
        }
    }
}