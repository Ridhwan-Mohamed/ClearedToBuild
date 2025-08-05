import { buildingManager } from "./buildingManager";
import { CONTROL_STATES, SQUARESIZE } from "../constants";
import { Map } from "../map";
import { Player } from "../players/Player";
import { Teams } from "../Teams";

export class Manager {
    static scene;

    static assignTroopsToAction(troopList, taskList, state, force = false){
        if (taskList.length <= 0) return;
        for(let troop of troopList){
            if(!force && !Player.playerAvailible(troop)) continue;
            for(let task of taskList){
                if(this.buildType(state)){
                    if(this.tooManyAssigned(task, state)) continue;
                    if((state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE) && task.item.name != troop.carrying.name) continue; 
                    let approachTile;
                    if(state == CONTROL_STATES.BUILD_MODE_T){
                        approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
                    }else if(this.blockType(state)){
                        approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                    }
                    if(approachTile){
                        troop.roam = false;
                        if(force) Player.handleStateIntteruptStart(troop)
                        Teams.movePlayerState(troop, state)
                        if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type
                        troop.task = task;
                        troop.task.assigned += 1;
                        Player.moveTo(troop, approachTile.path)
                        break;
                    }
                }else if (state == CONTROL_STATES.TRACK_TARGET){
                    //add the logic for tracking the dipshit
                    const path = Player.pathTo(troop, task.x, task.y, false); 
                    if(path){
                        troop.roam = false;
                        troop.track = [null,null];
                        troop.track[0] = task.body;
                        troop.track[1] = {x: task.x, y: task.y};
                        Player.moveTo(troop, path);
                        if(force) Player.handleStateIntteruptStart(troop)
                        Teams.movePlayerState(troop, state);
                        break;
                    }
                }else {
                    if(this.tooManyAssigned(task, state)) continue;
                    if(force) Player.handleStateIntteruptStart(troop)
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
                if((state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE) && task.item.name != troop.carrying.name) continue; 
                let approachTile;
                if(state == CONTROL_STATES.BUILD_MODE_T){
                    approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
                }else if(this.blockType(state)){
                    approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                }
                if(approachTile){
                    troop.roam = false;
                    Teams.movePlayerState(troop, state)
                    if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type;
                    troop.task = task;
                    troop.task.assigned += 1;
                    Player.moveTo(troop, approachTile.path)
                    return true;
                }
            }else if (state == CONTROL_STATES.TRACK_TARGET){
                //add the logic for tracking the dipshit
                const path = Player.pathTo(troop, task.x, task.y, false);
                if(path){
                    troop.roam = false;
                    troop.track = [null,null];
                    troop.track[0] = task.body;
                    troop.track[1] = {x: task.x, y: task.y};
                    Player.moveTo(troop, path);
                    Teams.movePlayerState(troop, state);
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
                        return false;
                    } else {
                        troopX = newX*SQUARESIZE+SQUARESIZE/2;
                        troopY = newY*SQUARESIZE+SQUARESIZE/2;
                        console.log("New valid tile:", newX, newY);
                    }
                }else{
                    troopX = troop.x;
                    troopY = troop.y
                }
                Player.moveTo(troop, Map.navMesh.findPath({ x: troopX, y: troopY }, { x: task.x*SQUARESIZE+SQUARESIZE/2, y: task.y*SQUARESIZE+SQUARESIZE/2 }));
                return true;
            }
        }
        if(!Player.playerAvailible(troop)) Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play('idle');
        troop.task = null;
        return false;
    }

    static handleDurationCheck(troop){
        if(troop.task && troop.task.hasOwnProperty('duration') && troop.task.duration <= 0){
            switch (troop.state) {
                case CONTROL_STATES.BUILD_MODE_B:
                    Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].blockBuildingStates, CONTROL_STATES.BUILD_MODE_B)
                    break;
                case CONTROL_STATES.DESTROY_MODE:
                    Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].destroyStates, CONTROL_STATES.DESTROY_MODE)
                    break;
                default:
                    break;
            }
        }
    }

    static buildType(state){
        return state == CONTROL_STATES.BUILD_MODE_B ||
            state == CONTROL_STATES.BUILD_MODE_T || 
            state == CONTROL_STATES.DESTROY_MODE ||
            state == CONTROL_STATES.GET_FROM_OVEN ||
            state == CONTROL_STATES.SEND_TO_OVEN ||
            state == CONTROL_STATES.GET_FROM_STORAGE ||
            state == CONTROL_STATES.SEND_TO_STORAGE;
    }

    static blockType(state){
        return state == CONTROL_STATES.BUILD_MODE_B ||
            state == CONTROL_STATES.DESTROY_MODE ||
            state == CONTROL_STATES.GET_FROM_OVEN ||
            state == CONTROL_STATES.SEND_TO_OVEN ||
            state == CONTROL_STATES.GET_FROM_STORAGE ||
            state == CONTROL_STATES.SEND_TO_STORAGE;
    }

    static tooManyAssigned(task, state) {
        if (state === CONTROL_STATES.GET_FROM_OVEN || state === CONTROL_STATES.GET_FROM_STORAGE) {
            return task.assigned >= task.amount;
        }

        if(state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE){
            return task.remaining <= task.assigned;
        }

        // Allow many for build/destroy
        if (state === CONTROL_STATES.BUILD_MODE_B || state === CONTROL_STATES.DESTROY_MODE) {
            return task.assigned > 5;
        }

        // All other tasks: only 1 assignment allowed
        return task.assigned > 0;
    }

}