import { buildingManager } from "./buildingManager";
import { CONTROL_STATES, SQUARESIZE } from "../constants";
import { Player } from "../players/Player";
import { Teams } from "../Teams";
import { CombatSpacingCoordinator } from "../ai/CombatSpacingCoordinator";

export class Manager {
    static scene;

    static _taskCenterWorld(task) {
        if (!task) return null;
        const width = Math.max(1, Number(task?.type?.lenX ?? task?.w ?? 1));
        const height = Math.max(1, Number(task?.type?.lenY ?? task?.h ?? 1));
        const x = Number(task?.x ?? task?.tx);
        const y = Number(task?.y ?? task?.ty);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return {
            x: (x + (width / 2)) * SQUARESIZE,
            y: (y + (height / 2)) * SQUARESIZE,
        };
    }

    static _orderedTasksForTroop(troop, taskList, state) {
        if (!Array.isArray(taskList) || taskList.length <= 1) return taskList;
        if (state !== CONTROL_STATES.BUILD_MODE_T) return taskList;

        const originX = Number(troop?.body?.x ?? troop?.x);
        const originY = Number(troop?.body?.y ?? troop?.y);
        if (!Number.isFinite(originX) || !Number.isFinite(originY)) return taskList;

        return [...taskList].sort((a, b) => {
            const aCenter = this._taskCenterWorld(a);
            const bCenter = this._taskCenterWorld(b);
            if (!aCenter && !bCenter) return 0;
            if (!aCenter) return 1;
            if (!bCenter) return -1;

            const aDx = aCenter.x - originX;
            const aDy = aCenter.y - originY;
            const bDx = bCenter.x - originX;
            const bDy = bCenter.y - originY;
            return (aDx * aDx + aDy * aDy) - (bDx * bDx + bDy * bDy);
        });
    }

    static _troopEligibleForState(troop, state) {
        if (!troop) return false;

        switch (state) {
            case CONTROL_STATES.BUILD_MODE_T:
            case CONTROL_STATES.BUILD_MODE_B:
            case CONTROL_STATES.FIX_BUILDING:
                return !!troop.isBuilder;
            default:
                return true;
        }
    }

    static _troopEligibleForTask(troop, task, state) {
        if (!troop || !task) return false;
        if (!this._troopEligibleForState(troop, state)) return false;
        if (Array.isArray(task.eligibleTroopIds) && task.eligibleTroopIds.length) {
            return task.eligibleTroopIds.includes(troop.id);
        }
        return true;
    }

    static _assignTrackTargetTask(troop, taskList, force = false) {
        const chosenTask = CombatSpacingCoordinator.pickBestCombatTask(troop, taskList)
            || taskList.find(task => CombatSpacingCoordinator.getTaskTarget(task)?.active);
        if (!chosenTask) return false;

        const target = CombatSpacingCoordinator.getTaskTarget(chosenTask);
        if (!target?.active || !target?.body) return false;

        troop.roam = false;
        troop._combatRoamDest = null;
        CombatSpacingCoordinator.clearRoamReservation(troop);

        if (force) Player.handleStateIntteruptStart(troop);

        troop.track = [target.body, { x: target.x, y: target.y }];
        troop.forcedTarget = chosenTask.forced || chosenTask.target ? target : null;
        CombatSpacingCoordinator.setTroopFocusTarget(troop, target, { forced: !!troop.forcedTarget });
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_TARGET);

        troop.task = chosenTask;
        chosenTask.assigned = Math.max(0, Number(chosenTask.assigned || 0)) + 1;
        this._setTaskMeta(troop, chosenTask, CONTROL_STATES.TRACK_TARGET, null);

        const approach = CombatSpacingCoordinator.getCombatApproach(troop, target);
        const dest = approach?.destination ?? { x: target.x, y: target.y };
        const path = Player.pathTo(troop, dest.x, dest.y, false);
        if (path?.length) {
            Player.moveTo(troop, path);
        } else {
            troop.currentPath = [];
            troop.body?.setVelocity?.(0, 0);
        }

        return true;
    }

    static _resolveApproachTileForTask(troop, task, state) {
        if (state == CONTROL_STATES.BUILD_MODE_T || state == CONTROL_STATES.DESTROY_MODE_T) {
            return buildingManager.findBuildApproachTile(task.x, task.y, troop);
        }
        if (!this.blockType(state)) {
            return null;
        }
        if (
            state === CONTROL_STATES.GET_FROM_STORAGE ||
            state === CONTROL_STATES.SEND_TO_STORAGE ||
            state === CONTROL_STATES.GET_FROM_OVEN ||
            state === CONTROL_STATES.SEND_TO_OVEN
        ) {
            return buildingManager.findInteractionApproachBlock(task.x, task.y, task.type, troop, null, null, task);
        }
        if (
            state === CONTROL_STATES.BUILD_MODE_B ||
            state === CONTROL_STATES.DESTROY_MODE ||
            state === CONTROL_STATES.FIX_BUILDING ||
            state === CONTROL_STATES.GET_BLOCK_RESOURCE
        ) {
            return buildingManager.findApproachAnyPerimeter(task.x, task.y, task.type, troop, null, null, task);
        }
        return buildingManager.findBuildApproachBlock(task.x, task.y, task.type, troop, null, null, task);
    }

    static assignTroopsToAction(troopList, taskList, state, force = false){
        if (taskList.length <= 0) return;
        for(let troop of troopList){
            const {navMesh, navGrid} = Player._getNavForTroop(troop);
            const arrayKey = this._resolveArrayKeyFromList(troop.body.team, taskList);
            const orderedTasks = this._orderedTasksForTroop(troop, taskList, state);
            if(!force && !Player.playerAvailible(troop)) continue;
            for(let task of orderedTasks){
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
                    const approachTile = this._resolveApproachTileForTask(troop, task, state);
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
                    if (this._assignTrackTargetTask(troop, taskList, force)) {
                        break;
                    }
                    continue;
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
        const orderedTasks = this._orderedTasksForTroop(troop, taskList, state);
        for(let task of orderedTasks){
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
                const approachTile = this._resolveApproachTileForTask(troop, task, state);
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
                return this._assignTrackTargetTask(troop, taskList, false);
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
            const approachTile = this._resolveApproachTileForTask(troop, task, state);
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
            return this._assignTrackTargetTask(troop, [task], false);
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
