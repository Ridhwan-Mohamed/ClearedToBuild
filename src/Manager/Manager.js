import { buildingManager } from "../buildingManager";
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "../constants";
import { Map } from "../map";
import { mapView } from "../mapView";
import { Player } from "../Player";
import { Teams } from "../Teams";

export class Manager {
    static scene;

    static assignTroopsToAction(troopList, taskList, state){
        if (taskList.length <= 0) return;
        for(let troop of troopList){
            if(!Player.playerAvailible(troop)) continue;
            for(let task of taskList){
                if(this.buildType(state)){
                    if(this.tooManyAssigned(task, state)) continue;
                    let approachTile;
                    if(state == CONTROL_STATES.BUILD_MODE_T){
                        approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
                    }else if(state == CONTROL_STATES.BUILD_MODE_B || state == CONTROL_STATES.DESTROY_MODE){
                        approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                    }
                    if(approachTile){
                        troop.roam = false;
                        Teams.movePlayerState(troop, state)
                        if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type
                        troop.task = task;
                        troop.task.assigned += 1;
                        Player.moveTo(troop, approachTile.path)
                        break;
                    }
                }else{
                    if(this.tooManyAssigned(task, state)) continue;
                    Teams.movePlayerState(troop, state)
                    troop.roam = false;
                    task.assigned += 1;
                    troop.task = task
                    let troopX = Math.floor(troop.body.x/SQUARESIZE);
                    let troopY = Math.floor(troop.body.y/SQUARESIZE);
                    if(!Map.navGrid[troopX][troopY]){
                        let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                        if (newX === -1) {
                            console.log("No valid start tile nearby");
                        } else {
                            troopX = newX;
                            troopY = newY;
                            console.log("New valid tile:", newX, newY);
                        }
                    }
                    Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: task.x*SQUARESIZE+SQUARESIZE/2, y: task.y*SQUARESIZE+SQUARESIZE/2 }));
                    break;
                }
            }
        }
    }

    static assignOneTroopToAction(troop, taskList, state){
        for(let task of taskList){
            if(this.buildType(state)){
                if(this.tooManyAssigned(task, state)) continue;
                let approachTile;
                if(state == CONTROL_STATES.BUILD_MODE_T){
                    approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
                }else if(state == CONTROL_STATES.BUILD_MODE_B || state == CONTROL_STATES.DESTROY_MODE){
                    approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                }
                if(approachTile){
                    troop.roam = false;
                    Teams.movePlayerState(troop, state)
                    if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type
                    troop.task = task;
                    troop.task.assigned += 1;
                    Player.moveTo(troop, approachTile.path)
                    return true;
                }
            }else{
                if(this.tooManyAssigned(task, state)) continue;
                Teams.movePlayerState(troop, state)
                troop.roam = false;
                task.assigned += 1;
                troop.task = task
                let troopX = Math.floor(troop.body.x/SQUARESIZE);
                let troopY = Math.floor(troop.body.y/SQUARESIZE);
                if(!Map.navGrid[troopX][troopY]){
                    let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                    if (newX === -1) {
                        console.log("No valid start tile nearby");
                    } else {
                        troopX = newX;
                        troopY = newY;
                        console.log("New valid tile:", newX, newY);
                    }
                }
                Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: task.x*SQUARESIZE+SQUARESIZE/2, y: task.y*SQUARESIZE+SQUARESIZE/2 }));
                return true;
            }
        }
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play('idle');
        return false;
    }

    static buildType(state){
        return state == CONTROL_STATES.BUILD_MODE_B ||
            state == CONTROL_STATES.BUILD_MODE_T || 
            state == CONTROL_STATES.DESTROY_MODE;
    }

    static tooManyAssigned(task, state){
        return (task.assigned > 0 && (state != CONTROL_STATES.BUILD_MODE_B && state != CONTROL_STATES.DESTROY_MODE)) || 
            (task.assigned > 1 && (state == CONTROL_STATES.BUILD_MODE_B || state == CONTROL_STATES.DESTROY_MODE))
    }
}