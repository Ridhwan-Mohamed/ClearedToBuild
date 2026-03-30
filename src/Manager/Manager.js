import { buildingManager } from "./buildingManager";
import { CONTROL_STATES, SQUARESIZE } from "../constants";
import { Player } from "../players/Player";
import { Teams } from "../Teams";

export class Manager {
    static scene;

    static _troopEligibleForTask(troop, task, state) {
        if (!troop || !task) return false;
        if (Array.isArray(task.eligibleTroopIds) && task.eligibleTroopIds.length) {
            return task.eligibleTroopIds.includes(troop.id);
        }
        return true;
    }

    static assignTroopsToAction(troopList, taskList, state, force = false){
        if (taskList.length <= 0) return;
        for(let troop of troopList){
            const {navMesh, navGrid} = Player._getNavForTroop(troop);
            const arrayKey = this._resolveArrayKeyFromList(troop.body.team, taskList);
            if(!force && !Player.playerAvailible(troop)) continue;
            for(let task of taskList){
                if (state === CONTROL_STATES.BUILD_MODE_T && !task?.type && task?.buildType) {
                    task.type = task.buildType;
                }
                if ((state === CONTROL_STATES.DESTROY_MODE || state === CONTROL_STATES.FIX_BUILDING) && !task?.type) {
                    task.type = task?.value?.buildType || task?.value?.type || null;
                    if (!task.type) continue;
                }
                if(task.forageType == 'seed') state = CONTROL_STATES.SEED_MODE
                else if(task.forageType == 'block') state = CONTROL_STATES.GET_BLOCK_RESOURCE
                if (!this._troopEligibleForTask(troop, task, state)) continue;
                if(this.buildType(state)){
                    if(this.tooManyAssigned(task, state)) continue;
                    if((state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE) && task.item.name != troop.carrying.name) continue; 
                    let approachTile;
                    if(state == CONTROL_STATES.BUILD_MODE_T || state == CONTROL_STATES.DESTROY_MODE_T){
                        approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
                    }else if(this.blockType(state)){
                        if (
                            state === CONTROL_STATES.DESTROY_MODE ||
                            state === CONTROL_STATES.FIX_BUILDING ||
                            state === CONTROL_STATES.GET_BLOCK_RESOURCE
                        ) {
                            approachTile = buildingManager.findApproachAnyPerimeter(task.x, task.y, task.type, troop, null, null, task);
                        } else {
                            approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                        }
                    }
                    if(approachTile){
                        troop.roam = false;
                        if(force) Player.handleStateIntteruptStart(troop)
                        Teams.movePlayerState(troop, state)
                        if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type
                        troop.task = task;
                        troop.task.assigned += 1;
                        troop.destX = approachTile.tx;
                        troop.destY = approachTile.ty;
                        this._setTaskMeta(troop, task, state, arrayKey);
                        Player.moveTo(troop, approachTile.path)
                        break;
                    }
                }else if (state == CONTROL_STATES.TRACK_TARGET){
                    troop.roam = false;
                    troop.track = [task.body, { x: task.x, y: task.y }];
                    if (task.target) troop.forcedTarget = task.target;
                    if (force) Player.handleStateIntteruptStart(troop);
                    Teams.movePlayerState(troop, state);
                    const path = Player.pathTo(troop, task.x, task.y, false);
                    if (path) {
                        Player.moveTo(troop, path);
                    } else {
                        troop.currentPath = [];
                        troop.body?.setVelocity?.(0, 0);
                    }
                    break;
                }else {
                    if(this.tooManyAssigned(task, state)) continue;
                    if(force) Player.handleStateIntteruptStart(troop)
                    Teams.movePlayerState(troop, state)
                    troop.roam = false;
                    task.assigned += 1;
                    troop.task = task
                    this._setTaskMeta(troop, task, state, arrayKey);
                    let troopX = Math.floor(troop.body.x/SQUARESIZE);
                    let troopY = Math.floor(troop.body.y/SQUARESIZE);
                    if(!navGrid[troopX][troopY]){
                        let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                        if (newX === -1) {
                            console.log("No valid start tile nearby");
                        } else {
                            troopX = newX;
                            troopY = newY;
                            console.log("New valid tile:", newX, newY);
                        }
                    }
                    Player.moveTo(troop, navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: task.x*SQUARESIZE+SQUARESIZE/2, y: task.y*SQUARESIZE+SQUARESIZE/2 }));
                    break;
                }
            }
        }
    }

    static assignOneTroopToAction(troop, taskList, state){
        const {navMesh, navGrid} = Player._getNavForTroop(troop);
        const arrayKey = this._resolveArrayKeyFromList(troop.body.team, taskList);
        for(let task of taskList){
            if (state === CONTROL_STATES.BUILD_MODE_T && !task?.type && task?.buildType) {
                task.type = task.buildType;
            }
            if ((state === CONTROL_STATES.DESTROY_MODE || state === CONTROL_STATES.FIX_BUILDING) && !task?.type) {
                task.type = task?.value?.buildType || task?.value?.type || null;
                if (!task.type) continue;
            }
            if(task.forageType == 'seed') state = CONTROL_STATES.SEED_MODE
            else if(task.forageType == 'block') state = CONTROL_STATES.GET_BLOCK_RESOURCE
            if (!this._troopEligibleForTask(troop, task, state)) continue;
            if(this.buildType(state)){
                if(this.tooManyAssigned(task, state)) continue;
                if((state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE) && task.item.name != troop.carrying.name) continue; 
                let approachTile;
                if(state == CONTROL_STATES.BUILD_MODE_T || state == CONTROL_STATES.DESTROY_MODE_T){
                    approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
                }else if(this.blockType(state)){
                    if (
                        state === CONTROL_STATES.DESTROY_MODE ||
                        state === CONTROL_STATES.FIX_BUILDING ||
                        state === CONTROL_STATES.GET_BLOCK_RESOURCE
                    ) {
                        approachTile = buildingManager.findApproachAnyPerimeter(task.x, task.y, task.type, troop, null, null, task);
                    } else {
                        approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                    }
                }
                if(approachTile){
                    troop.roam = false;
                    Teams.movePlayerState(troop, state)
                    if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type;
                    troop.task = task;
                    troop.task.assigned += 1;
                    troop.destX = approachTile.tx;
                    troop.destY = approachTile.ty;
                    this._setTaskMeta(troop, task, state, arrayKey);
                    Player.moveTo(troop, approachTile.path)
                    return true;
                }
            }else if (state == CONTROL_STATES.TRACK_TARGET){
                troop.roam = false;
                troop.track = [task.body, { x: task.x, y: task.y }];
                if (task.target) troop.forcedTarget = task.target;
                Teams.movePlayerState(troop, state);
                const path = Player.pathTo(troop, task.x, task.y, false);
                if(path){
                    Player.moveTo(troop, path);
                } else {
                    troop.currentPath = [];
                    troop.body?.setVelocity?.(0, 0);
                }
                return true;
            }else{
                if(this.tooManyAssigned(task, state)) continue;
                Teams.movePlayerState(troop, state)
                troop.roam = false;
                task.assigned += 1;
                troop.task = task
                this._setTaskMeta(troop, task, state, arrayKey);
                let troopX = Math.floor(troop.body.x/SQUARESIZE);
                let troopY = Math.floor(troop.body.y/SQUARESIZE);
                if(!navGrid[troopX][troopY]){
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
                Player.moveTo(troop, navMesh.findPath({ x: troopX, y: troopY }, { x: task.x*SQUARESIZE+SQUARESIZE/2, y: task.y*SQUARESIZE+SQUARESIZE/2 }));
                return true;
            }
        }
        if(!Player.playerAvailible(troop)) Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play('idle');
        troop.task = null;
        return false;
    }

    static assignTaskToTroop(troop, task, state){
        const {navMesh, navGrid} = Player._getNavForTroop(troop);
        if (state === CONTROL_STATES.BUILD_MODE_T && !task?.type && task?.buildType) {
            task.type = task.buildType;
        }
        if ((state === CONTROL_STATES.DESTROY_MODE || state === CONTROL_STATES.FIX_BUILDING) && !task?.type) {
            task.type = task?.value?.buildType || task?.value?.type || null;
            if (!task.type) return false;
        }
        if(task.forageType == 'seed') state = CONTROL_STATES.SEED_MODE
        else if(task.forageType == 'block') state = CONTROL_STATES.GET_BLOCK_RESOURCE
        if (!this._troopEligibleForTask(troop, task, state)) return false;
        if(this.buildType(state)){
            if(this.tooManyAssigned(task, state)) return;
            if((state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE) && task.item.name != troop.carrying.name) return; 
            let approachTile;
            if(state == CONTROL_STATES.BUILD_MODE_T || state == CONTROL_STATES.DESTROY_MODE_T){
                approachTile = buildingManager.findBuildApproachTile(task.x, task.y, troop)
            }else if(this.blockType(state)){
                if (
                    state === CONTROL_STATES.DESTROY_MODE ||
                    state === CONTROL_STATES.FIX_BUILDING ||
                    state === CONTROL_STATES.GET_BLOCK_RESOURCE
                ) {
                    approachTile = buildingManager.findApproachAnyPerimeter(task.x, task.y, task.type, troop, null, null, task);
                } else {
                    approachTile = buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop)
                }
            }
            if(approachTile){
                troop.roam = false;
                Teams.movePlayerState(troop, state)
                if(state == CONTROL_STATES.BUILD_MODE_T) troop.buildType = task.type;
                troop.task = task;
                troop.task.assigned += 1;
                troop.destX = approachTile.tx;
                troop.destY = approachTile.ty;
                this._setTaskMeta(troop, task, state, null);
                Player.moveTo(troop, approachTile.path)
                return true;
            }
        }else if (state == CONTROL_STATES.TRACK_TARGET){
            troop.roam = false;
            troop.track = [task.body, { x: task.x, y: task.y }];
            if (task.target) troop.forcedTarget = task.target;
            Teams.movePlayerState(troop, state);
            const path = Player.pathTo(troop, task.x, task.y, false);
            if(path){
                Player.moveTo(troop, path);
            } else {
                troop.currentPath = [];
                troop.body?.setVelocity?.(0, 0);
            }
            return true;
        }else{
            if(this.tooManyAssigned(task, state)) return;
            Teams.movePlayerState(troop, state)
            troop.roam = false;
            task.assigned += 1;
            troop.task = task
            this._setTaskMeta(troop, task, state, null);
            let troopX = Math.floor(troop.body.x/SQUARESIZE);
            let troopY = Math.floor(troop.body.y/SQUARESIZE);
            if(!navGrid[troopX][troopY]){
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
            Player.moveTo(troop, navMesh.findPath({ x: troopX, y: troopY }, { x: task.x*SQUARESIZE+SQUARESIZE/2, y: task.y*SQUARESIZE+SQUARESIZE/2 }));
            return true;
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
            state == CONTROL_STATES.DESTROY_MODE_T ||
            state == CONTROL_STATES.GET_FROM_OVEN ||
            state == CONTROL_STATES.SEND_TO_OVEN ||
            state == CONTROL_STATES.GET_FROM_STORAGE ||
            state == CONTROL_STATES.SEND_TO_STORAGE ||
            state == CONTROL_STATES.GET_BLOCK_RESOURCE ||
            state == CONTROL_STATES.FIX_BUILDING;
    }

    static blockType(state){
        return state == CONTROL_STATES.BUILD_MODE_B ||
            state == CONTROL_STATES.DESTROY_MODE ||
            state == CONTROL_STATES.DESTROY_MODE_T ||
            state == CONTROL_STATES.GET_FROM_OVEN ||
            state == CONTROL_STATES.SEND_TO_OVEN ||
            state == CONTROL_STATES.GET_FROM_STORAGE ||
            state == CONTROL_STATES.SEND_TO_STORAGE ||
            state == CONTROL_STATES.GET_BLOCK_RESOURCE ||
            state == CONTROL_STATES.FIX_BUILDING;
    }

    static tooManyAssigned(task, state) {
        if (state === CONTROL_STATES.GET_FROM_OVEN || state === CONTROL_STATES.GET_FROM_STORAGE) {
            return task.assigned >= task.amount;
        }

        if (state == CONTROL_STATES.GET_BLOCK_RESOURCE) {
            const capacity = typeof task.workerCapacity === "number"
                ? Math.max(1, task.workerCapacity)
                : Math.max(1, task.remaining ?? 1);
            return task.assigned >= capacity;
        }

        if(state === CONTROL_STATES.SEND_TO_OVEN || state === CONTROL_STATES.SEND_TO_STORAGE){
            return task.remaining <= task.assigned;
        }

        // Allow many for build/destroy
        if (state === CONTROL_STATES.BUILD_MODE_B || state === CONTROL_STATES.DESTROY_MODE) {
            return task.assigned > 5;
        }

        if(state === CONTROL_STATES.DESTROY_MODE_T){
            return task.assigned > 0;
        }

        // All other tasks: only 1 assignment allowed
        return task.assigned > 0;
    }

    static _setTaskMeta(troop, task, state, arrayKey) {
        troop.taskMeta = {
            state,
            team: troop.body.team,
            arrayKey,
            phase: troop.carrying ? "post_pickup" : "pre_pickup",
            kind: task?.taskType || task?.forageType || task?.type?.name || "generic",
            taskId: `${task?.x ?? task?.tx ?? "?"},${task?.y ?? task?.ty ?? "?"}:${task?.type?.name ?? task?.taskType ?? "?"}`,
        };
    }

    static _resolveArrayKeyFromList(teamNumber, listRef) {
        const team = Teams.teamLists[teamNumber];
        if (!team || !listRef) return null;
        for (const key of Object.keys(team)) {
            if (team[key] === listRef) return key;
        }
        return null;
    }

}
