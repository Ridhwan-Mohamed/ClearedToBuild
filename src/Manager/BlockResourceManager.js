import { Player } from "../players/Player"
import { Teams } from "../Teams"
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, colorFor } from "../constants"
import { Manager } from "./Manager"
import { buildingManager } from "./buildingManager"
import { StorageManager } from "./StorageManager"
import { VisibilitySystem } from "../UI/VisibilitySystem"
import { Map } from "../map"
import { AudioManager } from "./AudioManager"
import { updateDirectionalAnimationFromVelocity } from "../players/PlayerDirectionalAnimator"
import { ORDER_KINDS } from "../orders/OrderTypes"
import { OrderRunner } from "../orders/OrderRunner"

export class blockResourceManager{

    static NavMeshUpdater;
    static EnemyNavMeshUpdater;
    static scene;
    static woodBreakDuration = 1500;
    static rockBreakDuration = 2500

    static _hasFastGatherCard(teamNumber) {
        const hand = Teams.teamLists?.[`${teamNumber}`]?.cardHand;
        return Array.isArray(hand) && hand.some(card => card?.id === "gather_speed_wood_stone");
    }

    static _getTaskTargetWorld(task) {
        const lenX = task?.type?.lenX ?? 1;
        const lenY = task?.type?.lenY ?? 1;
        return {
            x: (task.x + lenX / 2) * SQUARESIZE,
            y: (task.y + lenY / 2) * SQUARESIZE,
        };
    }

    static _clearGatherSwing(sprite) {
        if (!sprite) return;
        if (sprite.gatherSwingTween) {
            sprite.gatherSwingTween.remove();
            sprite.gatherSwingTween = null;
        }
        if (sprite.gatherSwingFx) {
            sprite.gatherSwingFx.destroy();
            sprite.gatherSwingFx = null;
        }
    }

    static _playGatherSwing(sprite, task, duration) {
        if (!sprite?.active || !task || !sprite.scene) return;

        const isWoodJob = task.type == TILE_TYPES.pine;
        const boosted = this._hasFastGatherCard(sprite.body?.team);
        const keySet = sprite.gatherSwingFxKeys?.[isWoodJob ? "wood" : "rock"];
        const textureKey = boosted ? keySet?.boosted : keySet?.normal;
        if (!textureKey) return;

        const target = this._getTaskTargetWorld(task);
        const aim = Math.atan2(target.y - sprite.y, target.x - sprite.x);
        const swingArc = boosted ? (Math.PI * 0.9) : (Math.PI * 0.68);
        const handleOffset = boosted ? 13 : 11;
        const handX = sprite.x + Math.cos(aim) * handleOffset;
        const handY = sprite.y - 5 + Math.sin(aim) * (handleOffset * 0.42);

        updateDirectionalAnimationFromVelocity(
            sprite,
            target.x - sprite.x,
            target.y - sprite.y,
            true
        );
        sprite.play(sprite.idle);

        this._clearGatherSwing(sprite);

        const fx = sprite.scene.add.image(handX, handY, textureKey)
            .setDepth((sprite.depth ?? 0) + 2)
            .setOrigin(0.18, 0.82)
            .setDisplaySize(boosted ? 34 : 30, boosted ? 34 : 30)
            .setRotation(aim - swingArc / 2);

        const tween = sprite.scene.tweens.add({
            targets: fx,
            rotation: aim + swingArc / 2,
            duration: Math.max(120, Math.floor(duration / 2)),
            yoyo: true,
            ease: "Sine.easeInOut",
            onUpdate: () => {
                if (!sprite.active || !fx.active) return;
                fx.setPosition(
                    sprite.x + Math.cos(aim) * handleOffset,
                    sprite.y - 5 + Math.sin(aim) * (handleOffset * 0.42)
                );
            },
            onComplete: () => {
                if (sprite.gatherSwingFx === fx) sprite.gatherSwingFx = null;
                if (sprite.gatherSwingTween === tween) sprite.gatherSwingTween = null;
                fx.destroy();
            }
        });

        sprite.gatherSwingFx = fx;
        sprite.gatherSwingTween = tween;
    }

    static ensureTaskForNode(nodeOrTask, { teamNumber = 1, queue = false, directOrderId = undefined } = {}) {
        if (!nodeOrTask) return null;

        let task = nodeOrTask?.forageType === "block" ? nodeOrTask : nodeOrTask.task;
        const node = task?.value || nodeOrTask;
        const tileType = node?.resourceTileType || task?.type;
        if (!tileType) return null;

        if (!task) {
            task = {
                x: node.gridX ?? 0,
                y: node.gridY ?? 0,
                type: tileType,
                resource: tileType.resource,
                value: node,
                assigned: 0,
                remaining: Number(node.health ?? 1),
                forageType: "block",
                workerCapacity: 1,
            };
            node.task = task;
        }

        task.type = tileType;
        task.resource = task.resource || tileType.resource;
        task.value = node;
        task.forageType = "block";
        task.workerCapacity = Math.max(1, Number(task.workerCapacity || 1));
        task.remaining = Number(node.health ?? task.remaining ?? 1);

        if (directOrderId !== undefined) {
            task.directOrderId = directOrderId;
            if (directOrderId) {
                task._ephemeralDirect = queue ? false : !((Teams.teamLists?.[`${teamNumber}`]?.foragerQueue || []).includes(task));
            }
        }

        if (queue) {
            const list = Teams.teamLists?.[`${teamNumber}`]?.foragerQueue;
            if (Array.isArray(list) && !list.includes(task)) {
                list.push(task);
            }
            task._ephemeralDirect = false;
        }

        node.startFlash?.();
        return task;
    }

    static _normalizeEligibleTroopIds(eligibleTroopIds) {
        if (!Array.isArray(eligibleTroopIds)) return null;
        const ids = [...new Set(eligibleTroopIds.filter(id => id != null))];
        return ids.length ? ids : null;
    }

    static _nodeForTaskOrValue(taskOrValue) {
        return taskOrValue?.value || taskOrValue?.task?.value || taskOrValue || null;
    }

    static _taskMatchesNode(task, node) {
        return !!(task && node && task.forageType === "block" && task.value === node);
    }

    static _isGatherOrder(order) {
        return !!(
            order &&
            order.status === "active" &&
            (
                order.kind === ORDER_KINDS.GATHER_TYPE ||
                order.kind === ORDER_KINDS.GATHER_AREA ||
                order.kind === ORDER_KINDS.GATHER_SET
            )
        );
    }

    static _isBlockTaskUsable(task) {
        if (!task || task.forageType !== "block") return false;
        const node = task.value;
        if (!node) return false;
        const nodeActive = !!(
            node.active !== false &&
            node.sprite?.active !== false &&
            node.container?.active !== false
        );
        if (!nodeActive) return false;
        return Math.max(0, Number(node.health ?? task.remaining ?? 0)) > 0;
    }

    static _queuedAssignableBlockTasksForTroop(troop) {
        const teamNumber = troop?.body?.team;
        return (Teams.teamLists?.[`${teamNumber}`]?.foragerQueue || []).filter(task =>
            task?.forageType === "block" &&
            !task.directOrderId &&
            this._isBlockTaskUsable(task) &&
            Manager._troopEligibleForTask(troop, task, CONTROL_STATES.GET_BLOCK_RESOURCE)
        );
    }

    static _shouldReturnTroopToTown(troop) {
        if (!troop?.active) return false;
        return !!(Player._isOnWater?.(troop) || Teams.farFromCenter?.(troop));
    }

    static _sendTroopBackToTown(troop) {
        if (!troop?.active || !troop?.body) return false;

        troop.roam = false;
        troop.track = null;
        troop.currentPath?.splice?.(0);
        troop.finalPos = null;
        troop.body?.setVelocity?.(0, 0);

        const path = Teams.sendTroopToTown(troop);
        if (path?.length) return true;

        Teams.movePlayerState(troop, CONTROL_STATES.BACK_TO_TOWN);
        troop.play?.(troop.idle);
        return false;
    }

    static _clearTroopBlockTask(troop, task = troop?.task, {
        removeFromQueue = false,
        clearNodeTask = false,
        adjustAssigned = true,
    } = {}) {
        if (!troop?.active) return;

        const activeTask = task ?? troop.task ?? null;

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        this._clearGatherSwing(troop);
        if (activeTask?.type === TILE_TYPES.pine) {
            AudioManager.setHarvestActive(troop, "wood", false);
        } else if (activeTask?.type === TILE_TYPES.rock) {
            AudioManager.setHarvestActive(troop, "rock", false);
        } else {
            AudioManager.setHarvestActive(troop, "wood", false);
            AudioManager.setHarvestActive(troop, "rock", false);
        }

        if (removeFromQueue && activeTask) {
            Teams.removeFromStateArray(troop.body.team, "foragerQueue", activeTask);
        }
        if (clearNodeTask && activeTask?.value?.task === activeTask) {
            activeTask.value.task = null;
        }

        if (adjustAssigned && activeTask && troop.task === activeTask) {
            activeTask.assigned = Math.max(0, Number(activeTask.assigned || 0) - 1);
        }

        troop.task = null;
        troop.currentPath?.splice?.(0);
        troop.finalPos = null;
        troop.body?.setVelocity?.(0, 0);
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play?.(troop.idle);
    }

    static _postBlockTaskCleanup(troop) {
        if (!troop?.active) return false;

        troop.roam = false;

        if (StorageManager.isCarrying(troop) && StorageManager.tryCreateStorageDeliveryTask(troop)) {
            return true;
        }

        if (this._isGatherOrder(troop.currentOrder)) {
            const handled = OrderRunner.stepUnit(troop);
            if (handled) {
                if (!troop.task && !troop.timer && !troop.currentPath?.length && this._shouldReturnTroopToTown(troop)) {
                    this._sendTroopBackToTown(troop);
                }
                return true;
            }
        }

        const queued = this._queuedAssignableBlockTasksForTroop(troop);
        if (queued.length && Manager.assignOneTroopToAction(troop, queued, CONTROL_STATES.GET_BLOCK_RESOURCE)) {
            return true;
        }

        if (this._shouldReturnTroopToTown(troop)) {
            this._sendTroopBackToTown(troop);
            return true;
        }

        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play?.(troop.idle);
        return false;
    }

    static _queuedBlockTasks(teamNumber) {
        return (Teams.teamLists?.[`${teamNumber}`]?.foragerQueue || []).filter(task => task?.forageType === "block");
    }

    static countOutstandingManualClickTasks(teamNumber, taskOrValue) {
        const node = this._nodeForTaskOrValue(taskOrValue);
        if (!node) return 0;

        const tasks = new Set();
        for (const task of this._queuedBlockTasks(teamNumber)) {
            if (task?.manualClick && this._taskMatchesNode(task, node)) tasks.add(task);
        }

        const foragers = Teams.teamLists?.[`${teamNumber}`]?.foragerList || [];
        for (const troop of foragers) {
            if (troop?.active && troop.task?.manualClick && this._taskMatchesNode(troop.task, node)) {
                tasks.add(troop.task);
            }
        }
        return tasks.size;
    }

    static _hasAnyBlockWorkForNode(teamNumber, taskOrValue) {
        const node = this._nodeForTaskOrValue(taskOrValue);
        if (!node) return false;

        if (node.task && node.task.forageType === "block" && !node.task.manualClick) {
            return true;
        }

        if (this._queuedBlockTasks(teamNumber).some(task => this._taskMatchesNode(task, node))) {
            return true;
        }

        const foragers = Teams.teamLists?.[`${teamNumber}`]?.foragerList || [];
        return foragers.some(troop => troop?.active && this._taskMatchesNode(troop.task, node));
    }

    static syncNodeFlash(teamNumber, taskOrValue) {
        const node = this._nodeForTaskOrValue(taskOrValue);
        if (!node) return;
        if (this._hasAnyBlockWorkForNode(teamNumber, node)) node.startFlash?.();
        else node.stopFlash?.();
    }

    static queueManualClickTask(nodeOrTask, { teamNumber = 1, eligibleTroopIds = null } = {}) {
        const node = this._nodeForTaskOrValue(nodeOrTask);
        if (!node) return null;

        const tileType = node?.resourceTileType || nodeOrTask?.type;
        if (!tileType) return null;

        const remaining = Math.max(0, Number(node.health ?? 0));
        const outstanding = this.countOutstandingManualClickTasks(teamNumber, node);
        if (remaining <= 0 || outstanding >= remaining) return null;

        const task = {
            x: node.gridX ?? nodeOrTask?.x ?? 0,
            y: node.gridY ?? nodeOrTask?.y ?? 0,
            type: tileType,
            resource: tileType.resource,
            value: node,
            assigned: 0,
            remaining: 1,
            forageType: "block",
            workerCapacity: 1,
            manualClick: true,
            eligibleTroopIds: this._normalizeEligibleTroopIds(eligibleTroopIds),
        };

        Teams.teamLists?.[`${teamNumber}`]?.foragerQueue?.push(task);
        node.startFlash?.();
        return task;
    }

    static cancelManualClickTasksForNode(teamNumber, nodeOrTask) {
        const team = Teams.teamLists?.[`${teamNumber}`];
        const node = this._nodeForTaskOrValue(nodeOrTask);
        if (!team || !node) return;

        const tasks = new Set();
        for (const queued of this._queuedBlockTasks(teamNumber)) {
            if (queued?.manualClick && this._taskMatchesNode(queued, node)) {
                tasks.add(queued);
            }
        }

        const foragers = team.foragerList || [];
        for (const troop of foragers) {
            if (troop?.task?.manualClick && this._taskMatchesNode(troop.task, node)) {
                tasks.add(troop.task);
            }
        }

        for (const task of tasks) {
            Teams.removeFromStateArray(teamNumber, "foragerQueue", task);

            for (const troop of foragers) {
                if (troop?.task !== task) continue;
                if (troop.timer) {
                    troop.timer.remove(false);
                    troop.timer = null;
                }
                this._clearGatherSwing(troop);
                const isWoodJob = task.type === TILE_TYPES.pine;
                AudioManager.setHarvestActive(troop, isWoodJob ? "wood" : "rock", false);
                task.assigned = Math.max(0, Number(task.assigned || 0) - 1);
                troop.task = null;
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
                troop.play?.(troop.idle);
            }
        }

        this.syncNodeFlash(teamNumber, node);
    }

    static assingTroopsToGetBlockResources(teamNumber){
        let blockList = (Teams.teamLists[`${teamNumber}`].foragerQueue || [])
            .filter(task => task?.forageType === 'block' && !task.directOrderId);
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length
            ? Player.selected.filter(troop => troop?.isForager)
            : Teams.teamLists[`${teamNumber}`].foragerList ;
        Manager.assignTroopsToAction(troops, blockList, CONTROL_STATES.GET_BLOCK_RESOURCE, force);
    }

    static assignTroopToGetBlockResource(troop, task){
        Manager.assignOneTroopToAction(troop, task, CONTROL_STATES.GET_BLOCK_RESOURCE);
    }

    static beginFarmingBlockResource(sprite) {
        let task = sprite.task;

        if (!task) {
            this._clearTroopBlockTask(sprite, null, { adjustAssigned: false });
            this._postBlockTaskCleanup(sprite);
            return;
        }

        if (!this._isBlockTaskUsable(task)) {
            this._clearTroopBlockTask(sprite, task, {
                removeFromQueue: true,
                clearNodeTask: true,
            });
            this._postBlockTaskCleanup(sprite);
            return;
        }

        if (!sprite.timer) {
            const isWoodJob = sprite.task.type == TILE_TYPES.pine;
            AudioManager.setHarvestActive(sprite, isWoodJob ? "wood" : "rock", true);
            const duration = sprite.task.type == TILE_TYPES.pine ? this.woodBreakDuration : this.rockBreakDuration;
            this._playGatherSwing(sprite, sprite.task, duration);
            sprite.timer = this.scene.time.delayedCall(duration, () => {
                if (!sprite.active || sprite.state != CONTROL_STATES.GET_BLOCK_RESOURCE) {
                    // job interrupted
                    const isWoodJob = sprite.task?.type == TILE_TYPES.pine;
                    this._clearGatherSwing(sprite);
                    AudioManager.setHarvestActive(sprite, isWoodJob ? "wood" : "rock", false);
                    sprite.timer = null;
                    return;
                }

                if (!this._isBlockTaskUsable(task)) {
                    sprite.timer = null;
                    this._clearTroopBlockTask(sprite, task, {
                        removeFromQueue: true,
                        clearNodeTask: true,
                    });
                    this._postBlockTaskCleanup(sprite);
                    return;
                }

                this._clearGatherSwing(sprite);
                const node = task.value;
                const isManualClick = !!task.manualClick;
                const nextHealth = Math.max(0, Number(node?.health ?? task.remaining ?? 1) - 1);
                if (node) node.health = nextHealth;
                if (isManualClick) {
                    task.remaining = Math.max(0, Number(task.remaining ?? 1) - 1);
                } else {
                    task.remaining = nextHealth;
                }
                task.assigned = Math.max(0, Number(task.assigned || 0) - 1);
                // If this is a layered/complex resource (like PineTree), use its adapter.
                // Else fall back to the old single-sprite frames logic.
                if (nextHealth > 0) {
                    if (typeof task.value?.applyBlockDamage === 'function') {
                        task.value.applyBlockDamage(nextHealth);
                    } else {
                        const frames = task.type.images;
                        const idx = Math.max(0, nextHealth - 1);
                        task.value.setTexture(frames[idx]);
                    }
                } else {
                    if (typeof task.value?.stopFlash === "function") {
                        task.value.stopFlash();
                    }
                    if (typeof task.value?.applyBlockDamage === 'function') {
                        task.value.applyBlockDamage(0); // will self-destroy
                    } else {
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
                    this.EnemyNavMeshUpdater.blockTiles(blockTiles, true);
                    buildingManager.removeBuildingFromArray(task.x, task.y);
                    VisibilitySystem.onOccluderChangedRect(task.x, task.y, task.type.lenX, task.type.lenY, /*isBlock=*/false);
                }
                AudioManager.playBlockBreak(isWoodJob ? "wood" : "rock");
                StorageManager.addCarriedItem(sprite, task.resource);
                sprite.timer = null;
                if (isManualClick || task.remaining <= 0) {
                    Teams.removeFromStateArray(sprite.body.team, "foragerQueue", sprite.task);
                    if (task.value?.task === task) {
                        task.value.task = null;
                    }
                }
                const finishedWoodJob = task.type == TILE_TYPES.pine;
                AudioManager.setHarvestActive(sprite, finishedWoodJob ? "wood" : "rock", false);
                this.syncNodeFlash(sprite.body.team, task.value);
                this._clearTroopBlockTask(sprite, task, {
                    removeFromQueue: false,
                    clearNodeTask: false,
                    adjustAssigned: false,
                });
                this._postBlockTaskCleanup(sprite);
            });
        }
    }

    static abortParcelResourceWork({
        teamNumber = 1,
        contractId = null,
        slotId = null,
        origin = null,
        size = 0,
    } = {}) {
        const team = Teams.teamLists?.[`${teamNumber}`];
        if (!team) return;

        const matchesNode = (node) => {
            if (!node) return false;
            if (contractId && node.contractId === contractId) return true;
            if (slotId && node.slotId === slotId) return true;
            return false;
        };

        const isInsideParcel = (troop) => {
            if (!troop?.active || !origin || !(size > 0)) return false;
            const gx = Math.floor(troop.x / SQUARESIZE);
            const gy = Math.floor(troop.y / SQUARESIZE);
            return (
                gx >= origin.x &&
                gx < origin.x + size &&
                gy >= origin.y &&
                gy < origin.y + size
            );
        };

        const parcelTasks = new Set();
        for (const task of team.foragerQueue || []) {
            if (task?.forageType !== "block") continue;
            if (!matchesNode(task.value)) continue;
            parcelTasks.add(task);
        }

        const affectedTroops = new Set();
        for (const troop of team.foragerList || []) {
            if (!troop?.active) continue;
            const troopTask = troop.task?.forageType === "block" ? troop.task : null;
            if (troopTask && (parcelTasks.has(troopTask) || matchesNode(troopTask.value))) {
                parcelTasks.add(troopTask);
                affectedTroops.add(troop);
                continue;
            }

            if (isInsideParcel(troop)) {
                affectedTroops.add(troop);
            }
        }

        for (const task of parcelTasks) {
            Teams.removeFromStateArray(teamNumber, "foragerQueue", task);
            task.assigned = 0;
            task.value?.stopFlash?.();
            if (task.value?.task === task) {
                task.value.task = null;
            }
        }

        for (const troop of affectedTroops) {
            const task = troop.task?.forageType === "block" ? troop.task : null;
            this._clearTroopBlockTask(troop, task, {
                removeFromQueue: true,
                clearNodeTask: true,
                adjustAssigned: true,
            });
            this._postBlockTaskCleanup(troop);
        }
    }

    static cancelBlockResourceTask(teamNumber, taskOrValue) {
        const team = Teams.teamLists[`${teamNumber}`];
        if (!team) return;

        // Accept either a task object or a sprite/value that has .task
        const task = taskOrValue?.forageType === 'block'
            ? taskOrValue
            : (taskOrValue?.task || null);

        if (!task) return;

        // Remove from queues (both places, because your code uses both)
        Teams.removeFromStateArray(teamNumber, "foragerQueue", task);

        if (typeof task.value?.stopFlash === "function") {
            task.value.stopFlash();
        }

        // Stop any foragers currently working THIS task
        const foragers = team.foragerList || [];
        for (const f of foragers) {
            if (f?.task !== task) continue;
            this._clearTroopBlockTask(f, task, {
                removeFromQueue: false,
                clearNodeTask: false,
            });
            this._postBlockTaskCleanup(f);
        }

        // Clear task on the resource itself (prevents “stuck flashing”)
        if (task.value?.task === task) {
            task.value.task = null;
        }
    }

}
