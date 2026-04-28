import { Player } from "../players/Player"
import { Teams } from "../Teams"
import { Map } from "../map"
import { BLOCKDEPTH, colorFor, CONTROL_STATES, removeFromArray, showAlert, showGhostText, SQUARESIZE, TILE_MAP, TILE_TYPES, UIDEPTH } from "../constants"
import { Manager } from "./Manager"
import { buildingArray } from "../town"
import { ClayOven } from "../buildings/ClayOven"
import { StorageBuilding } from "../buildings/Storage"
import { House } from "../buildings/House"
import { Turret } from "../buildings/Turret"
import { Catapult } from "../buildings/Catapult"
import { TowerBuilding } from "../buildings/Tower"
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker"
import { UI_ITEM_TYPES } from "../UI/UIConstants"
import { AudioManager } from "./AudioManager"
import { StorageManager } from "./StorageManager"
import { PathRegistry } from "../lib/navmesh/PathRegistry"
import { PathRepair } from "../lib/navmesh/PathRepair"
import { Wall } from "../buildings/Wall"
import { Builder } from "../players/Builder"
import { Raider } from "../players/Raider"
import { Brawler } from "../players/Brawler"
import { Blademaster } from "../players/Blademaster"
import { Gunslinger } from "../players/Gunslinger"
import { Projectile } from "../Projectile"
import { Scheduler } from "../ai/scheduler/Scheduler"
import { updateDirectionalAnimationFromVelocity } from "../players/PlayerDirectionalAnimator"
import { fightManager } from "./fightManager"

export class buildingManager{

    static NavMeshUpdater;
    static EnemyNavMeshUpdater;
    static scene;
    static blockBuildingDuration = 250;
    static tileBuildingDuration = 1000;
    static _selectedWallJobId = null;
    static _selectedWallJobTeamNumber = 1;
    static _hoveredWallJobId = null;
    static _hoveredWallJobTeamNumber = 1;
    static _selectedConstructionTask = null;
    static _selectedConstructionTeamNumber = 1;
    static _wallJobSeed = 1;

    static createBuildTileStateArray(tiles, teamNumber, buildTypeName = null) {
        const team = Teams.teamLists[teamNumber];
        if (!Array.isArray(team.buildingTileStates)) team.buildingTileStates = [];

        tiles.forEach(tile => {
            const typeName = tile.buildTypeName ?? buildTypeName ?? "wall";
            const buildType = TILE_TYPES[typeName] ?? TILE_TYPES.wall;

            const task = {
            x: tile.x,
            y: tile.y,
            assigned: 0,
            type: buildType,
            buildType,
            buildTypeName: typeName,
            teamNumber: Number(teamNumber),
            refundCost: tile.refundCost ?? buildType.cost ?? buildType.price ?? null,
            prepaid: !!tile.prepaid,
            wallJobId: tile.wallJobId ?? null,
            queueKey: "buildingTileStates",
            };
            team.buildingTileStates.push(task);
        });

        this.refreshQueuedTileBuildGhosts(teamNumber);
    }

    static createWallJobId(teamNumber = 1) {
        const seed = this._wallJobSeed++;
        return `wall-job-${Number(teamNumber) || 1}-${seed}`;
    }

    static getSelectedBuilders(teamNumber = 1) {
        const normalizedTeam = Number(teamNumber);
        return Player.selected
            .filter(troop => troop?.active && troop.isBuilder && troop.body?.team === normalizedTeam);
    }

    static _taskCenterWorld(task) {
        if (task?.value?.sprite?.getBounds) {
            const bounds = task.value.sprite.getBounds();
            return {
                x: bounds.centerX,
                y: bounds.centerY,
            };
        }
        const lenX = task?.type?.lenX ?? task?.buildType?.lenX ?? 1;
        const lenY = task?.type?.lenY ?? task?.buildType?.lenY ?? 1;
        return {
            x: (task.x + lenX / 2) * SQUARESIZE,
            y: (task.y + lenY / 2) * SQUARESIZE,
        };
    }

    static _sortedBuildersForTask(builders, task) {
        const center = this._taskCenterWorld(task);
        return [...builders].sort((a, b) =>
            Phaser.Math.Distance.Between(a.x, a.y, center.x, center.y) -
            Phaser.Math.Distance.Between(b.x, b.y, center.x, center.y)
        );
    }

    static _releaseBuildersOnTask(task, keepIds = new Set()) {
        if (!task) return;
        const teamNumber = task?.value?.teamNumber ?? task?.value?.team ?? 1;
        const team = Teams.teamLists[teamNumber];
        const builders = team?.builderList || [];

        for (const troop of builders) {
            if (!troop?.active || troop.task !== task) continue;
            if (keepIds.has(troop.id)) continue;
            Player.handleStateIntteruptStart(troop, CONTROL_STATES.TRACK_MODE);
            troop.play?.(troop.idle);
            Scheduler.stepUnit(troop);
        }
    }

    static _sameQueuedBuildTask(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        const aType = a.buildType?.name ?? a.type?.name ?? a.buildTypeName ?? null;
        const bType = b.buildType?.name ?? b.type?.name ?? b.buildTypeName ?? null;
        return a.x === b.x && a.y === b.y && aType === bType;
    }

    static _clearBuilderQueuedBuildState(troop, {
        queueKey = null,
        removeQueueTask = false,
        assignNext = true,
        clearGhost = false,
    } = {}) {
        if (!troop?.active || !troop?.body) return;

        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];
        const task = troop.task;
        const resolvedQueueKey = queueKey ?? troop.taskMeta?.arrayKey ?? task?.queueKey ?? null;
        const nextQueue = resolvedQueueKey ? team?.[resolvedQueueKey] : null;
        const nextState =
            resolvedQueueKey === "blockBuildingStates" ? CONTROL_STATES.BUILD_MODE_B
            : resolvedQueueKey === "buildingTileStates" ? CONTROL_STATES.BUILD_MODE_T
            : null;

        if (task && typeof task.assigned === "number" && task.assigned > 0) {
            task.assigned -= 1;
        }
        if (removeQueueTask && resolvedQueueKey && task) {
            Teams.removeFromStateArray(teamNumber, resolvedQueueKey, task);
        }
        if (task && resolvedQueueKey === "buildingTileStates" && !removeQueueTask) {
            task._constructionStarted = false;
            task._buildStartedAt = null;
            this._stopConstructionTaskUiTicker(task);
            this.updateConstructionHoverText(task);
        }
        if (clearGhost && task) {
            if (resolvedQueueKey === "blockBuildingStates") this.clearQueuedBlockBuildGhost(task);
            else this.clearQueuedTileBuildGhost(task);
        }

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        this._clearBuilderBuildPresentation(troop);

        AudioManager.setConstructionActive(troop, false);
        troop.task = null;
        troop.taskMeta = null;
        troop.buildType = null;
        troop.destX = null;
        troop.destY = null;
        troop.currentPath?.splice?.(0);
        troop.body?.setVelocity?.(0, 0);
        troop.play?.(troop.idle);
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);

        if (assignNext && nextState != null && Array.isArray(nextQueue) && nextQueue.length) {
            Manager.assignOneTroopToAction(troop, nextQueue, nextState);
        }
    }

    static _releaseOtherBuildersForQueuedBuild(task, teamNumber, keepTroop = null, queueKey = null) {
        const team = Teams.teamLists[teamNumber];
        const builders = team?.builderList || [];
        for (const troop of builders) {
            if (!troop?.active || troop === keepTroop || !troop.task) continue;
            if (!this._sameQueuedBuildTask(troop.task, task)) continue;
            this._clearBuilderQueuedBuildState(troop, {
                queueKey,
                removeQueueTask: false,
                assignNext: true,
                clearGhost: false,
            });
        }
    }

    static assignSelectedBuildersToTask(task, state, selectedBuilders = this.getSelectedBuilders()) {
        if (!task || !selectedBuilders.length) return false;
        const keepIds = new Set(selectedBuilders.map(troop => troop.id));
        this._releaseBuildersOnTask(task, keepIds);

        let assigned = false;
        for (const troop of this._sortedBuildersForTask(selectedBuilders, task)) {
            if (!troop?.active) continue;
            if (troop.task === task) return true;
            Player.handleStateIntteruptStart(troop, CONTROL_STATES.TRACK_MODE);
            if (Manager.assignTaskToTroop(troop, task, state)) {
                assigned = true;
                if (Manager.tooManyAssigned(task, state)) break;
            }
        }
        return assigned;
    }

    static ensureFixTask(building, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        if (!building) return null;
        const team = Teams.teamLists[teamNumber];
        if (!team) return null;
        if (!Array.isArray(team.buildingFixTasks)) team.buildingFixTasks = [];
        const taskType = building.buildType ?? building.type ?? building.tileType ?? TILE_TYPES.house1;

        let task = team.buildingFixTasks.find(existing =>
            existing?.value === building ||
            (existing?.x === (building.gridX ?? building.x) &&
             existing?.y === (building.gridY ?? building.y))
        );

        if (!task) {
            task = {
                x: building.gridX ?? building.x,
                y: building.gridY ?? building.y,
                type: taskType,
                value: building,
                assigned: 0,
                queueKey: "buildingFixTasks",
            };
            team.buildingFixTasks.push(task);
        }

        task.x = building.gridX ?? building.x;
        task.y = building.gridY ?? building.y;
        task.type = taskType;

        this.ensureFixTaskVisual(task);
        return task;
    }

    static queueAutoFixForBuilding(building, teamNumber = building?.teamNumber ?? building?.team ?? building?.body?.team ?? 1) {
        if (!building || building._destroyed || building.sprite?._destroyed) return null;

        teamNumber = Number(teamNumber);
        const team = Teams.teamLists[teamNumber];
        if (!team) return null;
        if (teamNumber !== 1 && !team.builderList?.some(builder => builder?.active !== false)) return null;

        const maxHp = Number(building.maxHealth ?? 0);
        const hp = Number(building.health ?? building.hp ?? maxHp);
        if (!Number.isFinite(maxHp) || maxHp <= 0) return null;
        if (!Number.isFinite(hp) || hp <= 0 || hp >= maxHp) return null;

        return this.ensureFixTask(building, teamNumber);
    }

    static requestBuildingFix(building, teamNumber = 1, selectedBuilders = this.getSelectedBuilders(teamNumber)) {
        teamNumber = Number(teamNumber);
        if (!building) return { ok: false, reason: "missing" };
        const maxHp = (building.maxHealth ?? 100);
        const hp = (building.health ?? building.hp ?? 0);
        if (hp >= maxHp) {
            showAlert(this.scene, "No repair needed", "#a7f3d0");
            return { ok: false, reason: "full" };
        }

        const task = this.ensureFixTask(building, teamNumber);
        if (!task) return { ok: false, reason: "task" };

        if (selectedBuilders.length) {
            const assigned = this.assignSelectedBuildersToTask(task, CONTROL_STATES.FIX_BUILDING, selectedBuilders);
            return { ok: assigned, reason: assigned ? "assigned" : "unreachable", task };
        }

        return { ok: true, reason: "queued", task };
    }

    static handleBuildingClickForBuilders(building, openFallback, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        const selectedBuilders = this.getSelectedBuilders(teamNumber);
        if (!selectedBuilders.length) {
            openFallback?.();
            return false;
        }

        this.requestBuildingFix(building, teamNumber, selectedBuilders);
        return true;
    }

    static _wallFamilyForTypeName(typeName) {
        if (typeName === "wall" || typeName === "wall_door") return "stone";
        if (typeName === "woodWall" || typeName === "woodWall_door") return "wood";
        return null;
    }

    static _isQueuedWallTask(task) {
        const typeName = task?.buildTypeName ?? task?.buildType?.name ?? task?.type?.name ?? null;
        return this._wallFamilyForTypeName(typeName) != null;
    }

    static _queuedWallPieceAngle(gridVal, family) {
        const def = family === "wood" ? TILE_TYPES.woodWall : TILE_TYPES.wall;
        if (gridVal === def.interior) return 0;
        if (gridVal === def.sides.up) return 0;
        if (gridVal === def.sides.right) return 90;
        if (gridVal === def.sides.down) return 180;
        if (gridVal === def.sides.left) return 270;
        if (gridVal === def.corners.topLeft) return 0;
        if (gridVal === def.corners.topRight) return 90;
        if (gridVal === def.corners.bottomRight) return 180;
        if (gridVal === def.corners.bottomLeft) return 270;
        return 0;
    }

    static _queuedWallDisplayInfo(task, queueTasks = []) {
        const typeName = task?.buildTypeName ?? task?.buildType?.name ?? task?.type?.name ?? null;
        const family = this._wallFamilyForTypeName(typeName);
        if (!family) return null;

        const isDoor = typeName === "wall_door" || typeName === "woodWall_door";
        const queueMap = new globalThis.Map();
        for (const queuedTask of queueTasks) {
            const queuedTypeName = queuedTask?.buildTypeName ?? queuedTask?.buildType?.name ?? queuedTask?.type?.name ?? null;
            if (this._wallFamilyForTypeName(queuedTypeName) !== family) continue;
            queueMap.set(`${queuedTask.x},${queuedTask.y}`, queuedTypeName);
        }

        const placedMatchesFamily = (x, y) => {
            const info = Map._wallStructureInfoAt?.(x, y) || null;
            return this._wallFamilyForTypeName(info?.name) === family;
        };
        const solidAt = (x, y) => queueMap.has(`${x},${y}`) || placedMatchesFamily(x, y);

        const up = solidAt(task.x, task.y - 1);
        const down = solidAt(task.x, task.y + 1);
        const left = solidAt(task.x - 1, task.y);
        const right = solidAt(task.x + 1, task.y);
        const count = (up ? 1 : 0) + (down ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);

        if (isDoor) {
            const angle = up && down ? 90 : (left && right ? 0 : ((up || down) ? 90 : 0));
            return { key: typeName, angle, alpha: 0.72 };
        }

        const def = family === "wood" ? TILE_TYPES.woodWall : TILE_TYPES.wall;
        let gridVal = def.interior;

        if (count === 1) {
            if (up) gridVal = def.sides.right;
            else if (right) gridVal = def.sides.up;
            else if (down) gridVal = def.sides.left;
            else gridVal = def.sides.down;
        } else if (count === 2) {
            if (up && down && !left && !right) gridVal = def.sides.right;
            else if (left && right && !up && !down) gridVal = def.sides.up;
            else if (up && left && !right && !down) gridVal = def.corners.bottomRight;
            else if (up && right && !left && !down) gridVal = def.corners.bottomLeft;
            else if (down && left && !right && !up) gridVal = def.corners.topRight;
            else if (down && right && !left && !up) gridVal = def.corners.topLeft;
        }

        const key = family === "wood"
            ? (gridVal === def.interior ? "woodWall_interior" : Object.values(def.sides).includes(gridVal) ? "woodWall_edge" : "woodWall_corner")
            : (gridVal === def.interior ? "wall_interior" : Object.values(def.sides).includes(gridVal) ? "wall_edge" : "wall_corner");

        return {
            key,
            angle: this._queuedWallPieceAngle(gridVal, family),
            alpha: 0.68,
        };
    }

    static _bindQueuedTileGhostInteractions(task, sprite, teamNumber = 1) {
        sprite.removeAllListeners?.();
        const isWallJobTask = this._isQueuedWallTask(task) && !!task?.wallJobId;

        sprite.on("pointerover", () => {
            sprite.setAlpha(Math.max(Number(task._ghostBaseAlpha || sprite.alpha || 0.68), 0.68) + 0.17);
            if (isWallJobTask) this.setQueuedWallJobHover(task.wallJobId, teamNumber);
        });

        sprite.on("pointerout", () => {
            sprite.setAlpha(Number(task._ghostBaseAlpha || 0.68));
            if (isWallJobTask && this._hoveredWallJobId === task.wallJobId) this.setQueuedWallJobHover(null, teamNumber);
        });

        sprite.on("pointerdown", () => {
            if (isWallJobTask) {
                const selectedBuilders = this.getSelectedBuilders(teamNumber);
                if (!selectedBuilders.length) {
                    this.selectQueuedWallJob(task.wallJobId, teamNumber);
                    return;
                }
            }
            const selectedBuilders = this.getSelectedBuilders(teamNumber);
            if (selectedBuilders.length) {
                this.assignSelectedBuildersToTask(task, CONTROL_STATES.BUILD_MODE_T, selectedBuilders);
                return;
            }
            this.selectQueuedConstructionTask(task, teamNumber);
        });
    }

    static _resolveQueuedBuildTeamNumber(task, fallback = 1) {
        return Number(task?.teamNumber ?? task?.value?.teamNumber ?? task?.value?.team ?? fallback ?? 1) || 1;
    }

    static _getTaskDisplayName(task) {
        const type = task?.type ?? task?.buildType ?? null;
        const raw = type?.displayName || type?.name || task?.buildTypeName || "Building";
        if (raw === "woodWall") return "Wood Wall";
        if (raw === "wall") return "Stone Wall";
        if (raw === "wall_door") return "Stone Door";
        if (raw === "woodWall_door") return "Wood Door";
        return String(raw)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (m) => m.toUpperCase());
    }

    static _currentConstructionPercent(task) {
        if (!task) return 0;
        if (task.queueKey === "buildingTileStates" && task._constructionStarted) {
            const total = Math.max(1, Number(task.totalDuration || this.tileBuildingDuration || 1));
            const startedAt = Number(task._buildStartedAt || 0);
            if (startedAt > 0 && this.scene?.time) {
                const elapsed = Math.max(0, Number(this.scene.time.now || 0) - startedAt);
                return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
            }
        }

        const total = Math.max(1, Number(task.totalDuration || task.duration || 1));
        const done = total - Number(task.duration ?? total);
        return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    }

    static _ensureConstructionTaskUi(task) {
        const scene = this.scene;
        if (!scene?.add || !task?.constructionSprite) return;

        if (this._isQueuedWallTask(task)) {
            task.labelBg?.destroy?.();
            task.labelBg = null;
            task.labelText?.destroy?.();
            task.labelText = null;
            return;
        }

        if (task.labelBg?.active) {
            task.labelBg.destroy();
        }
        task.labelBg = null;

        if (!task.labelText?.active) {
            task.labelText = scene.add.text(0, 0, "", {
                fontSize: "11px",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
                align: "center",
                fontFamily: "Bungee",
            })
                .setOrigin(0.5, 0.5)
                .setDepth(UIDEPTH + 6)
                .setScrollFactor(1);
        }
    }

    static _clearConstructionTaskUi(task) {
        if (!task) return;
        task._uiTicker?.remove?.(false);
        task._uiTicker = null;
        task.labelText?.destroy?.();
        task.labelText = null;
        if (this._selectedConstructionTask === task) {
            this.clearQueuedConstructionSelection(this._selectedConstructionTeamNumber);
        }
    }

    static _queuedWallJobTasks(wallJobId, teamNumber = 1) {
        if (!wallJobId) return [];
        const team = Teams.teamLists?.[teamNumber] ?? Teams.teamLists?.[`${teamNumber}`];
        const queueTasks = Array.isArray(team?.buildingTileStates) ? team.buildingTileStates : [];
        return queueTasks.filter((task) => task?.wallJobId === wallJobId && this._isQueuedWallTask(task));
    }

    static _commandBar() {
        return this.scene?.uiScene?.selectionCommandBar ?? null;
    }

    static _formatCommandRefund(costObj = null) {
        if (!costObj || typeof costObj !== "object") return "no refund";
        const parts = [];
        for (const [key, rawAmount] of Object.entries(costObj)) {
            const amount = Math.max(0, Number(rawAmount) || 0);
            if (!(amount > 0)) continue;
            if (key === "money") parts.push(`$${amount}`);
            else if (key === "permits") parts.push(`${amount} permit${amount === 1 ? "" : "s"}`);
            else parts.push(`${amount} ${String(key).replace(/_/g, " ")}`);
        }
        return parts.join(" | ") || "no refund";
    }

    static _sumTaskRefunds(tasks = []) {
        const bundle = {};
        for (const task of tasks) {
            const cost = task?.refundCost ?? task?.type?.cost ?? task?.buildType?.cost ?? task?.type?.price ?? task?.buildType?.price ?? null;
            if (!cost || typeof cost !== "object") continue;
            for (const [key, rawAmount] of Object.entries(cost)) {
                const amount = Math.max(0, Number(rawAmount) || 0);
                if (!(amount > 0)) continue;
                bundle[key] = Math.max(0, Number(bundle[key] || 0)) + amount;
            }
        }
        return bundle;
    }

    static _isQueuedConstructionTaskLive(task, teamNumber = 1) {
        if (!task) return false;
        const normalizedTeam = Number(teamNumber || this._resolveQueuedBuildTeamNumber(task, 1));
        const queueKey = task.queueKey ?? task.taskMeta?.arrayKey ?? null;
        const team = Teams.teamLists?.[normalizedTeam] ?? Teams.teamLists?.[`${normalizedTeam}`];
        const queue = Array.isArray(team?.[queueKey]) ? team[queueKey] : [];
        return queue.some((queuedTask) => this._sameQueuedBuildTask(queuedTask, task));
    }

    static _syncBuildQueueCommandBar() {
        const bar = this._commandBar();
        if (!bar) return;
        if (this.scene?.destroyWallMode) {
            bar.clearContext?.("build-queue");
            return;
        }

        const wallTasks = this._queuedWallJobTasks(this._selectedWallJobId, this._selectedWallJobTeamNumber);
        if (wallTasks.length) {
            bar.setContext("build-queue", {
                helperText: () => {
                    const refundText = this._formatCommandRefund(this._sumTaskRefunds(wallTasks));
                    return `WALL QUEUE | ${wallTasks.length} tiles | Refund ${refundText}`;
                },
                buttons: () => [
                    {
                        id: "cancel-wall-queue",
                        label: "CANCEL WALL QUEUE",
                        styleKey: "cancel",
                        onClick: () => this.cancelQueuedWallJob(this._selectedWallJobId, this._selectedWallJobTeamNumber),
                    },
                    {
                        id: "close-wall-queue",
                        label: "CLOSE",
                        styleKey: "neutral",
                        onClick: () => this.clearQueuedWallJobSelection(this._selectedWallJobTeamNumber),
                    },
                ],
            });
            return;
        }

        if (this._selectedConstructionTask && this._isQueuedConstructionTaskLive(this._selectedConstructionTask, this._selectedConstructionTeamNumber)) {
            const task = this._selectedConstructionTask;
            const teamNumber = this._selectedConstructionTeamNumber;
            bar.setContext("build-queue", {
                helperText: () => {
                    const pct = this._currentConstructionPercent(task);
                    const refundText = this._formatCommandRefund(this._sumTaskRefunds([task]));
                    return `${this._getTaskDisplayName(task)} ${pct}% | Refund ${refundText}`;
                },
                buttons: () => [
                    {
                        id: "cancel-build",
                        label: "CANCEL BUILD",
                        styleKey: "cancel",
                        onClick: () => this.cancelConstructionTask(task, teamNumber),
                    },
                    {
                        id: "close-build",
                        label: "CLOSE",
                        styleKey: "neutral",
                        onClick: () => this.clearQueuedConstructionSelection(teamNumber),
                    },
                ],
            });
            return;
        }

        bar.clearContext?.("build-queue");
    }

    static setQueuedWallJobHover(wallJobId = null, teamNumber = 1) {
        const normalizedTeam = Number(teamNumber || 1);
        if (this._hoveredWallJobId === wallJobId && this._hoveredWallJobTeamNumber === normalizedTeam) return;
        this._hoveredWallJobId = wallJobId;
        this._hoveredWallJobTeamNumber = normalizedTeam;
        this.refreshQueuedTileBuildGhosts(normalizedTeam);
    }

    static clearQueuedWallJobSelection(teamNumber = this._selectedWallJobTeamNumber || 1) {
        const normalizedTeam = Number(teamNumber || 1);
        this._selectedWallJobId = null;
        this._selectedWallJobTeamNumber = normalizedTeam;
        this.refreshQueuedTileBuildGhosts(normalizedTeam);
        this._syncBuildQueueCommandBar();
    }

    static selectQueuedWallJob(wallJobId, teamNumber = 1) {
        const normalizedTeam = Number(teamNumber || 1);
        this._selectedWallJobId = wallJobId;
        this._selectedWallJobTeamNumber = normalizedTeam;
        this._selectedConstructionTask = null;
        this.refreshQueuedTileBuildGhosts(normalizedTeam);
        this._syncBuildQueueCommandBar();
    }

    static clearQueuedConstructionSelection(teamNumber = this._selectedConstructionTeamNumber || 1) {
        this._selectedConstructionTask = null;
        this._selectedConstructionTeamNumber = Number(teamNumber || 1);
        this._syncBuildQueueCommandBar();
    }

    static selectQueuedConstructionTask(task, teamNumber = 1) {
        if (!task) return;
        const previousWallJobId = this._selectedWallJobId;
        const previousWallTeamNumber = this._selectedWallJobTeamNumber;
        this._selectedConstructionTask = task;
        this._selectedConstructionTeamNumber = Number(teamNumber || this._resolveQueuedBuildTeamNumber(task, 1));
        this._selectedWallJobId = null;
        if (previousWallJobId) {
            this.refreshQueuedTileBuildGhosts(previousWallTeamNumber);
        }
        this._syncBuildQueueCommandBar();
    }

    static _startConstructionTaskUiTicker(task) {
        if (!task || task._uiTicker || !this.scene?.time) return;
        task._uiTicker = this.scene.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (!task?.constructionSprite?.active) {
                    task._uiTicker?.remove?.(false);
                    task._uiTicker = null;
                    return;
                }
                this.updateConstructionHoverText(task);
            },
        });
    }

    static _stopConstructionTaskUiTicker(task) {
        task?._uiTicker?.remove?.(false);
        if (task) task._uiTicker = null;
    }

    static _refundQueuedBuildCost(task, teamNumber = 1) {
        if (!task?.prepaid) return false;

        const cost = task.refundCost
            ?? task.type?.cost
            ?? task.buildType?.cost
            ?? task.type?.price
            ?? task.buildType?.price
            ?? null;
        if (!cost || typeof cost !== "object") return false;

        const scene = this.scene;
        for (const [resourceKey, rawAmount] of Object.entries(cost)) {
            const amount = Math.max(0, Number(rawAmount) || 0);
            if (!(amount > 0)) continue;

            if (resourceKey === "money") {
                scene?.updateMoney?.(amount);
                continue;
            }
            if (resourceKey === "permits") {
                scene?.updatePermits?.(amount);
                continue;
            }

            const itemDef = UI_ITEM_TYPES[resourceKey];
            if (!itemDef) continue;

            const added = StorageManager.grantItemToTeam(String(teamNumber), itemDef, amount, scene);
            const overflow = Math.max(0, amount - added);
            if (overflow > 0) {
                const sellPrice = Math.max(0, Number(StorageManager.getStorageSellPrice(itemDef) || 0));
                if (sellPrice > 0) {
                    scene?.updateMoney?.(sellPrice * overflow);
                }
            }
        }

        task.prepaid = false;
        return true;
    }

    static _unblockQueuedBlockTaskArea(task) {
        if (!task?._navBlocked) return;

        const blockTiles = this._blockBuildTiles(task);
        for (const tile of blockTiles) {
            if (Map.navGrid?.[tile.y]) Map.navGrid[tile.y][tile.x] = 1;
            if (Map.enemyNavGrid?.[tile.y]) Map.enemyNavGrid[tile.y][tile.x] = 1;
        }

        try {
            this.NavMeshUpdater?.blockTiles?.(blockTiles, true);
            this.EnemyNavMeshUpdater?.blockTiles?.(blockTiles, true);
        } catch (e) {
            console.warn("queued block build nav restore skipped", e);
        }

        task._navBlocked = false;
        this._markQueuedBlockBuildAreaDirty();
    }

    static refreshQueuedTileBuildGhosts(teamNumber = 1) {
        teamNumber = Number(teamNumber);
        const team = Teams.teamLists?.[teamNumber] ?? Teams.teamLists?.[`${teamNumber}`];
        const queueTasks = Array.isArray(team?.buildingTileStates) ? team.buildingTileStates : [];
        if (this._selectedWallJobTeamNumber === teamNumber && this._selectedWallJobId) {
            const stillExists = queueTasks.some((task) => task?.wallJobId === this._selectedWallJobId && this._isQueuedWallTask(task));
            if (!stillExists) this._selectedWallJobId = null;
        }
        if (this._hoveredWallJobTeamNumber === teamNumber && this._hoveredWallJobId) {
            const stillHovered = queueTasks.some((task) => task?.wallJobId === this._hoveredWallJobId && this._isQueuedWallTask(task));
            if (!stillHovered) this._hoveredWallJobId = null;
        }
        for (const task of queueTasks) {
            this.ensureQueuedTileBuildGhost(task, teamNumber, queueTasks);
        }
        this._syncBuildQueueCommandBar();
    }

    static ensureQueuedTileBuildGhost(task, teamNumber = 1, queueTasks = null) {
        teamNumber = Number(teamNumber);
        if (!task || !this.scene?.add) return task?.constructionSprite ?? null;

        task.queueKey = task.queueKey ?? "buildingTileStates";
        const spriteX = task.x * SQUARESIZE + SQUARESIZE / 2;
        const spriteY = task.y * SQUARESIZE + SQUARESIZE / 2;
        const allQueueTasks = queueTasks || Teams.teamLists?.[teamNumber]?.buildingTileStates || Teams.teamLists?.[`${teamNumber}`]?.buildingTileStates || [];

        if (this._isQueuedWallTask(task)) {
            const display = this._queuedWallDisplayInfo(task, allQueueTasks);
            if (!display) return task?.constructionSprite ?? null;
            const isSelectedJob =
                !!task.wallJobId &&
                task.wallJobId === this._selectedWallJobId &&
                Number(teamNumber) === Number(this._selectedWallJobTeamNumber || 1);
            const isHoveredJob =
                !!task.wallJobId &&
                task.wallJobId === this._hoveredWallJobId &&
                Number(teamNumber) === Number(this._hoveredWallJobTeamNumber || 1);

            let sprite = task.constructionSprite;
            if (!sprite || !sprite.active) {
                sprite = this.scene.add.sprite(spriteX, spriteY, display.key, 0)
                    .setDisplaySize(SQUARESIZE, SQUARESIZE)
                    .setDepth(BLOCKDEPTH + 0.15)
                    .setInteractive({ useHandCursor: true });
                task.constructionSprite = sprite;
                this._bindQueuedTileGhostInteractions(task, sprite, teamNumber);
            } else {
                sprite.setPosition(spriteX, spriteY);
                sprite.setTexture(display.key, 0);
                sprite.setDisplaySize(SQUARESIZE, SQUARESIZE);
            }

            task._ghostBaseAlpha = display.alpha;
            sprite.setAngle(display.angle || 0);
            sprite.clearTint();
            if (isSelectedJob) sprite.setTintFill(0xffe7a1);
            else if (isHoveredJob) sprite.setTintFill(0xfff2bf);

            const resolvedAlpha = isSelectedJob
                ? 1
                : isHoveredJob
                    ? Math.max(display.alpha + 0.28, 0.98)
                    : display.alpha;
            sprite.setAlpha(resolvedAlpha);
            sprite.setDepth(BLOCKDEPTH + (isSelectedJob ? 0.32 : isHoveredJob ? 0.24 : 0.15));
            this._ensureConstructionTaskUi(task);
            this.updateConstructionHoverText(task);
            this._syncBuildQueueCommandBar();
            return sprite;
        }

        if (!task.constructionSprite || !task.constructionSprite.active) {
            const sprite = this.scene.add.image(spriteX, spriteY, "construction")
                .setDisplaySize(SQUARESIZE, SQUARESIZE)
                .setDepth(BLOCKDEPTH + 0.15)
                .setInteractive({ useHandCursor: true });
            task.constructionSprite = sprite;
            this._bindQueuedTileGhostInteractions(task, sprite, teamNumber);
        } else {
            task.constructionSprite.setPosition(spriteX, spriteY);
            task.constructionSprite.setTexture("construction");
            task.constructionSprite.setDisplaySize(SQUARESIZE, SQUARESIZE);
            task.constructionSprite.setAngle(0);
        }

        task._ghostBaseAlpha = 0.68;
        task.constructionSprite.setAlpha(0.68);
        this._ensureConstructionTaskUi(task);
        this.updateConstructionHoverText(task);
        return task.constructionSprite;
    }

    static clearQueuedTileBuildGhost(task) {
        if (!task) return;
        this._stopConstructionTaskUiTicker(task);
        this._clearConstructionTaskUi(task);
        task.constructionSprite?.destroy?.();
        task.constructionSprite = null;
    }

    static cancelQueuedTileBuild(task, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        if (!task) return false;
        const team = Teams.teamLists?.[teamNumber] ?? Teams.teamLists?.[`${teamNumber}`];
        const builders = (team?.builderList || []).filter((troop) =>
            troop?.active && troop.task && this._sameQueuedBuildTask(troop.task, task)
        );

        Teams.removeFromStateArray(teamNumber, task.queueKey ?? "buildingTileStates", task);
        for (const troop of builders) {
            this._clearBuilderQueuedBuildState(troop, {
                queueKey: "buildingTileStates",
                removeQueueTask: false,
                assignNext: false,
                clearGhost: false,
            });
        }
        this._refundQueuedBuildCost(task, teamNumber);
        this.clearQueuedTileBuildGhost(task);
        this.refreshQueuedTileBuildGhosts(teamNumber);
        const remainingQueue = team?.buildingTileStates || [];
        for (const troop of builders) {
            if (!troop?.active) continue;
            Manager.assignOneTroopToAction(troop, remainingQueue, CONTROL_STATES.BUILD_MODE_T);
        }
        return true;
    }

    static cancelQueuedWallJob(wallJobId, teamNumber = 1) {
        teamNumber = Number(teamNumber || 1);
        if (!wallJobId) return false;
        const team = Teams.teamLists?.[teamNumber] ?? Teams.teamLists?.[`${teamNumber}`];
        const queue = Array.isArray(team?.buildingTileStates) ? team.buildingTileStates : [];
        const tasks = queue.filter((task) => task?.wallJobId === wallJobId && this._isQueuedWallTask(task));
        if (!tasks.length) return false;

        const builders = team?.builderList || [];
        for (const troop of builders) {
            if (!troop?.active || !troop.task || troop.task.wallJobId !== wallJobId) continue;
            this._clearBuilderQueuedBuildState(troop, {
                queueKey: "buildingTileStates",
                removeQueueTask: false,
                assignNext: false,
                clearGhost: false,
            });
        }

        for (const task of tasks) {
            Teams.removeFromStateArray(teamNumber, "buildingTileStates", task);
            this._refundQueuedBuildCost(task, teamNumber);
            this.clearQueuedTileBuildGhost(task);
        }

        if (this._selectedWallJobId === wallJobId && this._selectedWallJobTeamNumber === teamNumber) {
            this._selectedWallJobId = null;
        }
        if (this._hoveredWallJobId === wallJobId && this._hoveredWallJobTeamNumber === teamNumber) {
            this._hoveredWallJobId = null;
        }
        this.refreshQueuedTileBuildGhosts(teamNumber);
        this._syncBuildQueueCommandBar();
        return true;
    }

    static cancelConstructionTask(task, teamNumber = 1) {
        if (!task) return false;
        const queueKey = task.queueKey ?? task.taskMeta?.arrayKey ?? null;
        if (queueKey === "buildingTileStates") {
            return this.cancelQueuedTileBuild(task, teamNumber);
        }
        if (queueKey === "blockBuildingStates") {
            return this.cancelQueuedBlockBuild(task, teamNumber);
        }
        return false;
    }

    static _ensureConstructionHoverUi() {
        const scene = this.scene;
        if (!scene?.add) return;

        if (!scene.constructionHoverText) {
            scene.constructionHoverText = scene.add
                .text(0, 0, "", {
                    fontSize: "12px",
                    fill: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 3,
                    align: "center",
                })
                .setOrigin(0.5, 1)
                .setDepth(UIDEPTH + 6)
                .setScrollFactor(1)
                .setVisible(false);

            scene.constructionHoverBg = scene.add
                .rectangle(0, 0, 10, 10, 0x000000, 0.6)
                .setStrokeStyle(1, 0xffffff, 0.4)
                .setOrigin(0.5, 1)
                .setDepth(UIDEPTH + 5)
                .setScrollFactor(1)
                .setVisible(false);
        }
    }

    static _normalizeBlockBuildTask(task, teamNumber = 1) {
        if (!task) return null;

        const typeName = task.type?.name ?? task.buildType?.name ?? task.buildTypeName ?? task.type ?? task.buildType;
        const type = TILE_TYPES[typeName] ?? task.type ?? task.buildType ?? null;
        if (!type) return null;

        task.type = type;
        task.buildType = type;
        task.buildTypeName = type.name;
        task.queueKey = "blockBuildingStates";
        task.assigned = Number(task.assigned || 0);
        task.teamNumber = Number(task.teamNumber ?? teamNumber ?? 1);
        task.refundCost = task.refundCost ?? type.cost ?? type.price ?? null;
        task.duration = Math.max(1, Number(task.duration || 100));
        task.totalDuration = Math.max(task.duration, Number(task.totalDuration || task.duration || 100));
        return task;
    }

    static _blockBuildTiles(task) {
        const tiles = [];
        const lenX = Math.max(1, Number(task?.type?.lenX ?? 1));
        const lenY = Math.max(1, Number(task?.type?.lenY ?? 1));
        const startX = Number(task?.x ?? 0);
        const startY = Number(task?.y ?? 0);

        for (let y = startY; y < startY + lenY; y++) {
            for (let x = startX; x < startX + lenX; x++) {
                tiles.push({ x, y });
            }
        }

        return tiles;
    }

    static _markQueuedBlockBuildAreaDirty() {
        Map.regionSystem?.markDirty?.();
        Map.regionDrawer?.markDirty?.();
        Map.enemyRegionSystem?.markDirty?.();
        Map.enemyRegionDrawer?.markDirty?.();
    }

    static _blockNavForQueuedBlockTask(task) {
        if (!task || task._navBlocked) return;

        const blockTiles = this._blockBuildTiles(task);
        if (!blockTiles.length) return;

        for (const tile of blockTiles) {
            if (Map.navGrid?.[tile.y]) Map.navGrid[tile.y][tile.x] = 0;
            if (Map.enemyNavGrid?.[tile.y]) Map.enemyNavGrid[tile.y][tile.x] = 0;
        }

        try {
            const change = this.NavMeshUpdater?.blockTiles?.(blockTiles);
            if (change?.removedPolyIds) {
                const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, change.removedPolyIds, change.addedPolyIds);
                if (impacted) {
                    for (const unit of impacted) {
                        PathRepair.repairUnitPath(unit, change.removedPolyIds, Map.navMesh);
                    }
                }
            }

            const enemyChange = this.EnemyNavMeshUpdater?.blockTiles?.(blockTiles);
            if (enemyChange?.removedPolyIds) {
                const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                if (impacted) {
                    for (const unit of impacted) {
                        PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
                    }
                }
            }
        } catch (e) {
            console.warn("queued block build nav update skipped", e);
        }

        task._navBlocked = true;
        this._markQueuedBlockBuildAreaDirty();
    }

    static _startQueuedBlockConstruction(task) {
        if (!task) return;
        task.totalDuration = Math.max(task.duration || 1, Number(task.totalDuration || task.duration || 1));
        task._constructionStarted = true;
        this._blockNavForQueuedBlockTask(task);
        this.updateConstructionHoverText(task);
    }

    static ensureQueuedBlockBuildGhost(task, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        task = this._normalizeBlockBuildTask(task, teamNumber);
        if (!task || task.constructionSprite || !this.scene?.add) return task?.constructionSprite ?? null;

        const sprite = Map.scene.add.image(
            task.x * SQUARESIZE + (task.type.lenX * SQUARESIZE) / 2,
            task.y * SQUARESIZE + (task.type.lenY * SQUARESIZE) / 2,
            "construction"
        )
            .setDepth(BLOCKDEPTH)
            .setDisplaySize(task.type.lenX * SQUARESIZE, task.type.lenY * SQUARESIZE)
            .setAlpha(task._constructionStarted ? 0.78 : 0.62)
            .setInteractive({ useHandCursor: true });

        task.constructionSprite = sprite;

        sprite.on("pointerover", () => {
            sprite.setAlpha(task._constructionStarted ? 0.9 : 0.76);
        });

        sprite.on("pointerout", () => {
            sprite.setAlpha(task._constructionStarted ? 0.78 : 0.62);
        });

        sprite.on("pointerdown", () => {
            const selectedBuilders = this.getSelectedBuilders(teamNumber);
            if (selectedBuilders.length) {
                this.assignSelectedBuildersToTask(task, CONTROL_STATES.BUILD_MODE_B, selectedBuilders);
                return;
            }
            this.selectQueuedConstructionTask(task, teamNumber);
        });

        this._ensureConstructionTaskUi(task);
        this.updateConstructionHoverText(task);

        return sprite;
    }

    static clearQueuedBlockBuildGhost(task) {
        if (!task) return;
        this._stopConstructionTaskUiTicker(task);
        this._clearConstructionTaskUi(task);
        task.constructionSprite?.destroy?.();
        task.constructionSprite = null;
    }

    static cancelQueuedBlockBuild(task, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        task = this._normalizeBlockBuildTask(task, teamNumber);
        if (!task) return false;

        const team = Teams.teamLists?.[teamNumber] ?? Teams.teamLists?.[`${teamNumber}`];
        const builders = (team?.builderList || []).filter((troop) =>
            troop?.active && troop.task && this._sameQueuedBuildTask(troop.task, task)
        );

        Teams.removeFromStateArray(teamNumber, "blockBuildingStates", task);
        for (const troop of builders) {
            this._clearBuilderQueuedBuildState(troop, {
                queueKey: "blockBuildingStates",
                removeQueueTask: false,
                assignNext: false,
                clearGhost: false,
            });
        }
        this._unblockQueuedBlockTaskArea(task);
        this._refundQueuedBuildCost(task, teamNumber);
        this.clearQueuedBlockBuildGhost(task);
        const remainingQueue = team?.blockBuildingStates || [];
        for (const troop of builders) {
            if (!troop?.active) continue;
            Manager.assignOneTroopToAction(troop, remainingQueue, CONTROL_STATES.BUILD_MODE_B);
        }
        return true;
    }

    static restoreQueuedBlockBuildTask(task, teamNumber = 1) {
        task = this._normalizeBlockBuildTask(task, teamNumber);
        if (!task) return null;
        task._navBlocked = false;
        this.ensureQueuedBlockBuildGhost(task, teamNumber);
        if (task._constructionStarted) {
            this._blockNavForQueuedBlockTask(task);
        }
        return task;
    }

    static queueBlockBuildTask(task, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        const team = Teams.teamLists?.[`${teamNumber}`] ?? Teams.teamLists?.[teamNumber];
        if (!team) return null;
        if (!Array.isArray(team.blockBuildingStates)) team.blockBuildingStates = [];

        const normalized = this._normalizeBlockBuildTask(task, teamNumber);
        if (!normalized) return null;
        normalized.refundCost = normalized.refundCost ?? normalized.type?.cost ?? normalized.buildType?.cost ?? null;

        team.blockBuildingStates.push(normalized);
        this.ensureQueuedBlockBuildGhost(normalized, teamNumber);
        this.assignTroopToBuildBlock(teamNumber);
        return normalized;
    }

    static ensureFixTaskVisual(task) {
        if (!task?.value?.sprite?.active || !this.scene?.add) return null;
        if (task.fixIndicator?.active) return task.fixIndicator;

        const bounds = task.value.sprite.getBounds();
        const icon = this.scene.add.image(bounds.centerX, bounds.centerY, "hammer")
            .setDepth((task.value.sprite.depth ?? BLOCKDEPTH) + 2)
            .setDisplaySize(18, 18)
            .setAlpha(0.95);

        task.fixIndicator = icon;
        task.fixIndicatorTween = this.scene.tweens.add({
            targets: icon,
            angle: { from: -22, to: 22 },
            duration: 280,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        task.value.sprite.once?.("destroy", () => this.clearFixTaskVisual(task));
        return icon;
    }

    static clearFixTaskVisual(task) {
        if (!task) return;
        task.fixIndicatorTween?.remove?.();
        task.fixIndicatorTween = null;
        task.fixIndicator?.destroy?.();
        task.fixIndicator = null;
    }

    static _getBuildTaskTargetWorld(task) {
        const lenX = task?.type?.lenX ?? task?.buildType?.lenX ?? 1;
        const lenY = task?.type?.lenY ?? task?.buildType?.lenY ?? 1;

        return {
            x: (task.x + lenX / 2) * SQUARESIZE,
            y: (task.y + lenY / 2) * SQUARESIZE,
        };
    }

    static _clearBuilderBuildPresentation(sprite) {
        if (!sprite) return;

        if (sprite.buildSwingTween) {
            sprite.buildSwingTween.remove();
            sprite.buildSwingTween = null;
        }

        if (sprite.buildSwingFx) {
            sprite.buildSwingFx.destroy();
            sprite.buildSwingFx = null;
        }
    }

    static _startBuilderBuildPresentation(sprite, task, duration = this.tileBuildingDuration) {
        if (!sprite?.active || !task || !sprite.scene) return;

        task._constructionStarted = true;
        task.totalDuration = Math.max(1, Number(task.totalDuration || duration || this.tileBuildingDuration || 1));
        task._buildStartedAt = Number(this.scene?.time?.now || 0);
        this._startConstructionTaskUiTicker(task);
        this.updateConstructionHoverText(task);

        const target = this._getBuildTaskTargetWorld(task);
        const aim = Math.atan2(target.y - sprite.y, target.x - sprite.x);
        const swingArc = Math.PI * 0.72;
        const handleOffset = 12;

        updateDirectionalAnimationFromVelocity(
            sprite,
            target.x - sprite.x,
            target.y - sprite.y,
            true
        );

        sprite.play?.(sprite.idle);

        this._clearBuilderBuildPresentation(sprite);

        const fx = sprite.scene.add.image(
            sprite.x + Math.cos(aim) * handleOffset,
            sprite.y - 5 + Math.sin(aim) * (handleOffset * 0.42),
            "hammer"
        )
            .setDepth((sprite.depth ?? 0) + 2)
            .setOrigin(0.18, 0.82)
            .setDisplaySize(30, 30)
            .setRotation(aim - swingArc / 2);

        const tween = sprite.scene.tweens.add({
            targets: fx,
            rotation: aim + swingArc / 2,
            duration: Math.max(160, Math.floor(duration / 2)),
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
                if (sprite.buildSwingFx === fx) sprite.buildSwingFx = null;
                if (sprite.buildSwingTween === tween) sprite.buildSwingTween = null;
                fx.destroy();
            }
        });

        sprite.buildSwingFx = fx;
        sprite.buildSwingTween = tween;
    }

    static createDestroyTileStateArray(tiles, teamNumber) {
        const team = Teams.teamLists[teamNumber];
        if (!Array.isArray(team.destroyTileStates)) team.destroyTileStates = [];

        tiles.forEach(t => {
            team.destroyTileStates.push({
            x: t.x,
            y: t.y,
            assigned: 0,
            type: t.type,
            refundCost: t.refundCost ?? t.type?.cost ?? t.type?.price ?? null,
            // ✅ store what the tile WAS so Builder.js can refund correctly
            originalGridVal: t.originalGridVal,

            // ✅ drive wall HP / time pacing (beginDestroyingTile already uses wall.hp)
            duration: 9999, // any >0; beginDestroyingTile re-ticks off wall.hp anyway
            });
        });
    }

    static createDestroyStateArray(tasks, teamNumber) {
        const team = Teams.teamLists[teamNumber];
        if (!Array.isArray(team.destroyStates)) team.destroyStates = [];

        tasks.forEach((task) => {
            if (!task?.type || task?.value == null) return;
            team.destroyStates.push({
                x: task.x,
                y: task.y,
                assigned: 0,
                type: task.type,
                value: task.value,
                duration: Math.max(1, Number(task.duration || task.totalDuration || task.value?.health || task.value?.hp || 100)),
                totalDuration: Math.max(1, Number(task.totalDuration || task.duration || task.value?.maxHealth || task.value?.maxHp || 100)),
                refundCost: task.refundCost ?? task.type?.cost ?? task.type?.price ?? null,
            });
        });
    }

    static assingTroopsToBuildTile(teamNumber){
        let buildList = Teams.teamLists[`${teamNumber}`].buildingTileStates
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].builderList ;
        Manager.assignTroopsToAction(troops, buildList, CONTROL_STATES.BUILD_MODE_T, force);
    }

    static findBuildApproachTile(buildX, buildY, troop) {
        // Adjacent tiles only. No 2-tile stand-off positions.
        const directions = [
            [0, -1], [0, 1], [1, 0], [-1, 0],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
        ];

        const { navGrid } = Player._getNavForTroop(troop);

        const candidates = [];
        for (const [dx, dy] of directions) {
            const tx = buildX + dx;
            const ty = buildY + dy;

            if (tx < 0 || ty < 0 || ty >= navGrid.length || tx >= navGrid[0].length) continue;
            if (!navGrid[ty][tx]) continue;

            const worldX = tx * SQUARESIZE + SQUARESIZE / 2;
            const worldY = ty * SQUARESIZE + SQUARESIZE / 2;
            const dist = Phaser.Math.Distance.Between(troop.x, troop.y, worldX, worldY);
            candidates.push({ tx, ty, dist });
        }

        candidates.sort((a, b) => a.dist - b.dist);

        for (const c of candidates) {
            const path = Player.pathTo(troop, c.tx, c.ty, true);
            if (path && path.length > 0) {
                return { tx: c.tx, ty: c.ty, path };
            }
        }

        return null;
    }

    static beginBuilding(troop) {
        const task = troop.task;

        if (!task?.buildType) {
            this._clearBuilderQueuedBuildState(troop, {
                queueKey: "buildingTileStates",
                removeQueueTask: false,
                assignNext: true,
                clearGhost: false,
            });
            return;
        }

        // Prevent instant completion / repeated scheduling every frame.
        if (troop.timer) return;

        AudioManager.setConstructionActive(troop, true);
        this._startBuilderBuildPresentation(troop, task, this.tileBuildingDuration);

        troop.timer = this.scene.time.delayedCall(this.tileBuildingDuration, () => {
            if (!troop.active || troop.state !== CONTROL_STATES.BUILD_MODE_T) {
                this._clearBuilderBuildPresentation(troop);
                AudioManager.setConstructionActive(troop, false);
                troop.timer = null;
                return;
            }

            this._clearBuilderBuildPresentation(troop);
            AudioManager.setConstructionActive(troop, false);
            troop.timer = null;

            const teamNumber = troop.body.team ?? 1;
            const liveTask = troop.task;

            if (!liveTask?.buildType) {
                this._clearBuilderQueuedBuildState(troop, {
                    queueKey: "buildingTileStates",
                    removeQueueTask: false,
                    assignNext: true,
                    clearGhost: false,
                });
                return;
            }

            const x = liveTask.x;
            const y = liveTask.y;
            const buildTypeName = liveTask.buildType?.name;
            const isDoor = (buildTypeName === "wall_door" || buildTypeName === "woodWall_door");
            const queuedTasks = Teams.teamLists?.[teamNumber]?.buildingTileStates ?? [];
            const taskStillQueued = queuedTasks.some((queuedTask) => this._sameQueuedBuildTask(queuedTask, liveTask));
            const currentCell = Map.grid?.[y]?.[x];
            const currentNames = Array.isArray(currentCell)
                ? currentCell.map((val) => TILE_MAP(val))
                : [TILE_MAP(currentCell)];
            const tileAlreadyBuilt = currentNames.includes(buildTypeName);

            if (!taskStillQueued || tileAlreadyBuilt) {
                if (tileAlreadyBuilt) {
                    this.clearQueuedTileBuildGhost(liveTask);
                    Teams.removeFromStateArray(teamNumber, "buildingTileStates", liveTask);
                    this.refreshQueuedTileBuildGhosts(teamNumber);
                }
                this._clearBuilderQueuedBuildState(troop, {
                    queueKey: "buildingTileStates",
                    removeQueueTask: false,
                    assignNext: true,
                    clearGhost: false,
                });
                return;
            }

            if (liveTask.buildType.block) {
                Map.navGrid[y][x] = 0;
                Map.enemyNavGrid[y][x] = 0;

                const change = this.NavMeshUpdater.blockTile(x, y);
                if (change && change.removedPolyIds) {
                    const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, change.removedPolyIds, change.addedPolyIds);
                    for (const unit of impacted) {
                        PathRepair.repairUnitPath(unit, change.removedPolyIds, Map.navMesh);
                    }
                }

                const enemyChange = this.EnemyNavMeshUpdater.blockTile(x, y);
                if (enemyChange && enemyChange.removedPolyIds) {
                    const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                    for (const unit of impacted) {
                        PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
                    }
                }

                Map.placeTile(x, y, liveTask.buildType.name);

                if (buildTypeName === "wall" || buildTypeName === "woodWall") {
                    Wall.ensureAt(this.scene, x, y, teamNumber);
                    Map.refreshWallShapesAround?.(x, y);
                }
            } else {
                Map.handleGridDelete(null, liveTask.buildType, x, y);
                Map.grid[y][x] = [Map.grid[y][x], liveTask.buildType.grid];

                if (isDoor) {
                    const blocksPlayer = teamNumber === 0;
                    const blocksEnemy = teamNumber !== 0;

                    Map.navGrid[y][x] = blocksPlayer ? 0 : 1;
                    Map.enemyNavGrid[y][x] = blocksEnemy ? 0 : 1;

                    if (blocksPlayer) {
                        const playerChange = this.NavMeshUpdater.blockTile(x, y);
                        if (playerChange && playerChange.removedPolyIds) {
                            const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, playerChange.removedPolyIds, playerChange.addedPolyIds);
                            for (const unit of impacted) {
                                PathRepair.repairUnitPath(unit, playerChange.removedPolyIds, Map.navMesh);
                            }
                        }
                    }

                    if (blocksEnemy) {
                        const enemyChange = this.EnemyNavMeshUpdater.blockTile(x, y);
                        if (enemyChange && enemyChange.removedPolyIds) {
                            const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                            for (const unit of impacted) {
                                PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
                            }
                        }
                    } else {
                        const enemyChange = this.EnemyNavMeshUpdater.blockTiles([{ x, y }], true);
                        if (enemyChange && enemyChange.removedPolyIds) {
                            const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                            for (const unit of impacted) {
                                PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
                            }
                        }
                    }
                } else {
                    Map.navGrid[y][x] = 1;
                    Map.enemyNavGrid[y][x] = 1;
                }

                Map.drawGridValue(x, y, 1);

                if (isDoor) {
                    Wall.ensureAt(this.scene, x, y, teamNumber);
                    Map.refreshWallShapesAround?.(x, y);
                }
            }

            this.scene.zoomMixer.updateOverviewCell(x, y, Map.grid);
            Map.regionSystem?.markDirty?.();
            Map.regionDrawer?.markDirty?.();
            Map.enemyRegionSystem?.markDirty?.();
            Map.enemyRegionDrawer?.markDirty?.();
            Map.enemyRegionSystem?.ensureUpToDate?.();

            AudioManager.playSound("sfx_building_complete", { volume: 0.2 });

            const completedTask = liveTask;
            this._clearBuilderQueuedBuildState(troop, {
                queueKey: "buildingTileStates",
                removeQueueTask: true,
                assignNext: true,
                clearGhost: true,
            });
            this.refreshQueuedTileBuildGhosts(teamNumber);
            this._releaseOtherBuildersForQueuedBuild(completedTask, teamNumber, troop, "buildingTileStates");
        });
    }

    static makeWallNoBuild(x, y, gridValueOrCell = null) {
    const cell = (gridValueOrCell == null) ? Map.grid?.[y]?.[x] : gridValueOrCell;

    // overlay is either scalar, or [floor, overlay]
    const overlayVal = Array.isArray(cell) ? cell[1] : cell;
    if (overlayVal == null) return;

    const typeName = TILE_MAP(overlayVal);
    const buildType = TILE_TYPES[typeName];
    if (!buildType) return;

    // doors are non-block in TILE_TYPES; ownership decides which side is blocked
    const isDoor = (buildType.name === "wall_door" || buildType.name === "woodWall_door");
    const ownerWall = Wall.getAt(x, y);
    const inferredOwnerTeam =
        (Map.navGrid?.[y]?.[x] === 0 && Map.enemyNavGrid?.[y]?.[x] === 1) ? 0 :
        (Map.navGrid?.[y]?.[x] === 1 && Map.enemyNavGrid?.[y]?.[x] === 0) ? 1 :
        1;
    const ownerTeam = ownerWall?.team ?? inferredOwnerTeam;

    // --- ensure Map.grid has correct layered form for doors/walls ---
    // (important if caller passed scalar)
    if (!Array.isArray(Map.grid?.[y]?.[x])) {
        Map.grid[y][x] = [Map.grid[y][x], overlayVal];
    } else {
        Map.grid[y][x][1] = overlayVal;
    }

    // --- NAV GRIDS ---
    const hasPlayerNav = Array.isArray(Map.navGrid) && Array.isArray(Map.navGrid[y]);
    const hasEnemyNav  = Array.isArray(Map.enemyNavGrid) && Array.isArray(Map.enemyNavGrid[y]);

    // walls block both; doors block only the opposing side of the owner
    if (buildType.block && !isDoor) {
        if (hasPlayerNav) Map.navGrid[y][x] = 0;
        if (hasEnemyNav)  Map.enemyNavGrid[y][x] = 0;
    } else if (isDoor) {
        const blocksPlayer = ownerTeam === 0;
        const blocksEnemy = ownerTeam !== 0;
        if (hasPlayerNav) Map.navGrid[y][x] = blocksPlayer ? 0 : 1;
        if (hasEnemyNav)  Map.enemyNavGrid[y][x] = blocksEnemy ? 0 : 1;
    }

    // --- NAV MESH (ONLY if nav grids exist; otherwise redraw/menu will explode) ---
    // IMPORTANT: never attempt to rebuild polygons if grids aren’t ready yet.
    try {
        if (buildType.block && !isDoor) {
        if (hasPlayerNav && this.NavMeshUpdater?.blockTile && Map.navMesh) {
            const change = this.NavMeshUpdater.blockTile(x, y);
            if (change?.removedPolyIds) {
            const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, change.removedPolyIds, change.addedPolyIds);
            for (const unit of impacted) PathRepair.repairUnitPath(unit, change.removedPolyIds, Map.navMesh);
            }
        }
        if (hasEnemyNav && this.EnemyNavMeshUpdater?.blockTile && Map.enemyNavMesh) {
            const enemyChange = this.EnemyNavMeshUpdater.blockTile(x, y);
            if (enemyChange?.removedPolyIds) {
            const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
            for (const unit of impacted) PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
            }
        }
        } else if (isDoor) {
        const blocksPlayer = ownerTeam === 0;
        const blocksEnemy = ownerTeam !== 0;

        if (hasPlayerNav && this.NavMeshUpdater && Map.navMesh) {
            const playerChange = blocksPlayer
                ? this.NavMeshUpdater.blockTile(x, y)
                : this.NavMeshUpdater.blockTiles([{ x, y }], true);
            if (playerChange?.removedPolyIds) {
                const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, playerChange.removedPolyIds, playerChange.addedPolyIds);
                for (const unit of impacted) PathRepair.repairUnitPath(unit, playerChange.removedPolyIds, Map.navMesh);
            }
        }

        if (hasEnemyNav && this.EnemyNavMeshUpdater && Map.enemyNavMesh) {
            const enemyChange = blocksEnemy
                ? this.EnemyNavMeshUpdater.blockTile(x, y)
                : this.EnemyNavMeshUpdater.blockTiles([{ x, y }], true);
            if (enemyChange?.removedPolyIds) {
                const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                for (const unit of impacted) PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
            }
        }
        }
    } catch (e) {
        // swallow during menu/redraw phase; navmesh can be rebuilt once the world is fully initialized
        console.warn("makeWallNoBuild: skipped navmesh update (nav not ready yet)", e);
    }

    // --- VISUALS ---
    // Put the actual tile art down. For doors, you want layer-1 to exist so map.js change (above) shows it.
    Map.drawGridValue(x, y, 1);
    Wall.ensureAt(this.scene, x, y, ownerTeam);
    Map.refreshWallShapesAround?.(x, y);

    // --- REGION / OVERVIEW ---
    this.scene?.zoomMixer?.updateOverviewCell?.(x, y, Map.grid);
    Map.regionSystem?.markDirty?.();
    Map.regionDrawer?.markDirty?.();
    Map.enemyRegionSystem?.markDirty?.();
    Map.enemyRegionDrawer?.markDirty?.();
    }

    static assignTroopToBuildBlock(teamNumber){
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].builderList;
        let blockList = Teams.teamLists[`${teamNumber}`].blockBuildingStates
        Manager.assignTroopsToAction(troops, blockList, CONTROL_STATES.BUILD_MODE_B, force);
        if(Map.isPlacing){
            Map.isPlacing = false; // Exit placing mode
            Map.placingItem.destroy(); // Clear placing item
            Map.placingItem = null;
        }
    }

    // Is there at least one walkable perimeter tile around the block footprint?
    static isBlockAccessible(x, y, type) {
        // perimeter around [x..x+lenX-1] × [y..y+lenY-1]
        for (let dy = -1; dy <= type.lenY; dy++) {
            for (let dx = -1; dx <= type.lenX; dx++) {
            const tx = x + dx;
            const ty = y + dy;

            const inside = (dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY);
            if (inside) continue;

            if (ty < 0 || tx < 0 || ty >= Map.navGrid.length || tx >= Map.navGrid[0].length) continue;
                if (Map.navGrid[ty][tx]) {
                    // found at least one walkable tile adjacent to the block
                    return true;
                }
            }
        }
        return false;
    }

    static findBuildApproachBlock(x, y, type, troop, tStartX = null, tStartY = null, task = null) {
        // Construction should be reachable from any valid neighboring perimeter tile,
        // not a house-style "door" anchor on the bottom edge.
        return this.findApproachAnyPerimeter(x, y, type, troop, tStartX, tStartY, task);
    }

    static usesFrontDoorApproach(type) {
        const typeName = type?.name ?? type?.value ?? type;
        return (
            typeName === TILE_TYPES.house1.name ||
            typeName === TILE_TYPES.house2.name ||
            typeName === TILE_TYPES.storage.name ||
            typeName === TILE_TYPES.clayOven.name
        );
    }

    static findInteractionApproachBlock(x, y, type, troop, tStartX = null, tStartY = null, task = null) {
        if (this.usesFrontDoorApproach(type)) {
            return this.findFrontDoorApproachBlock(x, y, type, troop)
                ?? this.findApproachAnyPerimeter(x, y, type, troop, tStartX, tStartY, task);
        }
        return this.findBuildApproachBlock(x, y, type, troop, tStartX, tStartY, task);
    }

    static findFrontDoorApproachBlock(x, y, type, troop) {
        if (!type || !troop) return null;

        const lenX = type.lenX || 1;
        const ty = y + (type.lenY || 1);
        const { navGrid } = Player._getNavForTroop(troop);
        const candidateXs = [...new Set([
            x + Math.floor((lenX - 1) / 2),
            x + Math.floor(lenX / 2),
        ])];
        let best = null;

        for (const tx of candidateXs) {
            if (tx < 0 || ty < 0 || ty >= navGrid.length || tx >= navGrid[0].length) {
                continue;
            }
            if (!navGrid[ty]?.[tx]) {
                continue;
            }

            const path = Player.pathTo(troop, tx, ty, true);
            if (!path?.length) continue;

            if (!best || path.length < best.path.length) {
                best = { tx, ty, path };
            }
        }

        return best;
    }

    static _assignedPerimeterDestKeys(task, troop) {
        if (!task || !troop) return new Set();

        const used = new Set();
        for (const other of Player.troops) {
            if (!other || other === troop || !other.active) continue;
            if (other.body?.team !== troop.body?.team) continue;
            if (other.task !== task) continue;
            if (!Number.isFinite(other.destX) || !Number.isFinite(other.destY)) continue;
            used.add(`${other.destX},${other.destY}`);
        }
        return used;
    }

    static findApproachAnyPerimeter(x, y, type, troop, tStartX = null, tStartY = null, task = null) {
        const candidates = [];
        const startX = x;
        const startY = y;

        const { navMesh, navGrid } = Player._getNavForTroop(troop)

        // 1) Collect all walkable perimeter tiles around footprint
        for (let dy = -1; dy <= type.lenY; dy++) {
            for (let dx = -1; dx <= type.lenX; dx++) {
            const tx = startX + dx;
            const ty = startY + dy;

            const inside = dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY;
            if (inside) continue;

            if (tx < 0 || ty < 0 || ty >= navGrid.length || tx >= navGrid[0].length) continue;
            if (!navGrid[ty][tx]) continue;

            const worldX = tx * SQUARESIZE + SQUARESIZE / 2;
            const worldY = ty * SQUARESIZE + SQUARESIZE / 2;

            let dist;
            if (troop) {
                dist = Phaser.Math.Distance.Between(troop.x, troop.y, worldX, worldY);
            } else {
                dist = Phaser.Math.Distance.Between(
                    tStartX * SQUARESIZE + SQUARESIZE / 2,
                    tStartY * SQUARESIZE + SQUARESIZE / 2,
                    worldX,
                    worldY
                );
            }

            candidates.push({ tx, ty, dist });
            }
        }

        // 2) Resolve start world pos
        if (tStartX == null || tStartY == null) {
            let troopX = Math.floor(troop.x / SQUARESIZE);
            let troopY = Math.floor(troop.y / SQUARESIZE);
            tStartX = troop.x;
            tStartY = troop.y;

            if (!navGrid[troopY]?.[troopX]) {
                const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                if (newX === -1) return null;
                tStartX = newX * SQUARESIZE + SQUARESIZE / 2;
                tStartY = newY * SQUARESIZE + SQUARESIZE / 2;
            }
        } else {
            tStartX = tStartX * SQUARESIZE + SQUARESIZE / 2;
            tStartY = tStartY * SQUARESIZE + SQUARESIZE / 2;
        }

        // 3) Prefer open perimeter tiles already not claimed by other troops on the same task.
        candidates.sort((a, b) => a.dist - b.dist);
        const occupied = this._assignedPerimeterDestKeys(task, troop);
        const ordered = [
            ...candidates.filter(c => !occupied.has(`${c.tx},${c.ty}`)),
            ...candidates.filter(c => occupied.has(`${c.tx},${c.ty}`)),
        ];

        for (const c of ordered) {
            const path = navMesh.findPath(
            { x: tStartX, y: tStartY },
            { x: c.tx * SQUARESIZE + SQUARESIZE / 2, y: c.ty * SQUARESIZE + SQUARESIZE / 2 }
            );
            if (path && path.length > 0) return { tx: c.tx, ty: c.ty, path };
        }

        return null;
    }

    static beginBuildingBlock(sprite) {
        let task = sprite.task;

        if (!task || task.duration <= 0) {
            this._clearBuilderQueuedBuildState(sprite, {
                queueKey: "blockBuildingStates",
                removeQueueTask: false,
                assignNext: true,
                clearGhost: false,
            });
            return;
        }

        this.ensureQueuedBlockBuildGhost(task, sprite.body.team);
        this._startQueuedBlockConstruction(task);
        task.constructionSprite?.setAlpha?.(0.78);

        AudioManager.setConstructionActive(sprite, true);

        if (!sprite.timer) {
            this._startBuilderBuildPresentation(sprite, task, this.blockBuildingDuration);

            sprite.timer = this.scene.time.delayedCall(this.blockBuildingDuration, () => {
                if (!sprite.active || sprite.state != CONTROL_STATES.BUILD_MODE_B) {
                    this._clearBuilderBuildPresentation(sprite);
                    AudioManager.setConstructionActive(sprite, false);
                    sprite.timer = null;
                    return;
                }

                let teamNumber = sprite.body.team;
                task = sprite.task;

                if (!task || task.duration <= 0) {
                    this._clearBuilderBuildPresentation(sprite);
                    AudioManager.setConstructionActive(sprite, false);
                    this._clearBuilderQueuedBuildState(sprite, {
                        queueKey: "blockBuildingStates",
                        removeQueueTask: false,
                        assignNext: true,
                        clearGhost: false,
                    });
                    return;
                }

                const target = this._getBuildTaskTargetWorld(task);
                updateDirectionalAnimationFromVelocity(
                    sprite,
                    target.x - sprite.x,
                    target.y - sprite.y,
                    true
                );
                sprite.play?.(sprite.idle);

                task.duration -= 2;
                sprite.stamina = Math.max(0, sprite.stamina - 0.2);

                buildingManager.updateConstructionHoverText(task);

                if (task.duration <= 0) {
                    this._clearBuilderBuildPresentation(sprite);
                    AudioManager.setConstructionActive(sprite, false);
                    sprite.timer = null;

                    const cost = task.type.cost;
                    if (cost && !task.prepaid && !this.hasRequiredMaterials(cost, teamNumber)) {
                        this._clearBuilderQueuedBuildState(sprite, {
                            queueKey: "blockBuildingStates",
                            removeQueueTask: false,
                            assignNext: true,
                            clearGhost: false,
                        });
                        return;
                    }

                    if (cost && !task.prepaid) {
                        this.consumeRequiredMaterials(cost, teamNumber);
                    }

                    AudioManager.playSound("sfx_building_complete");

                    this.clearQueuedBlockBuildGhost(task);

                    this.handlePlacement(task, teamNumber);

                    this.scene.zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => colorFor(cell));

                    Map.regionSystem?.markDirty?.();
                    Map.regionDrawer?.markDirty?.();
                    Map.enemyRegionSystem?.markDirty?.();
                    Map.enemyRegionSystem?.ensureUpToDate?.();
                    Map.enemyRegionDrawer?.markDirty?.();

                    Teams.removeFromStateArray(teamNumber, "blockBuildingStates", task);
                    this._releaseOtherBuildersForQueuedBuild(task, teamNumber, sprite, "blockBuildingStates");
                    this._clearBuilderQueuedBuildState(sprite, {
                        queueKey: "blockBuildingStates",
                        removeQueueTask: false,
                        assignNext: true,
                        clearGhost: false,
                    });
                } else {
                    this._clearBuilderBuildPresentation(sprite);
                    sprite.timer = null;
                    this.beginBuildingBlock(sprite);
                }
            });
        }
    }

    static handlePlacement(task, teamNumber = 1){
        const ownerTeam = Number(teamNumber ?? task?.teamNumber ?? 1) || 1;
        if(task.type == TILE_TYPES.clayOven){
            new ClayOven(task.x, task.y, ownerTeam);
        }else if(task.type == TILE_TYPES.storage){
            new StorageBuilding(task.x, task.y, ownerTeam);
        }else if(task.type == TILE_TYPES.house1 || task.type == TILE_TYPES.house2){
            new House(task.x, task.y, task.type, ownerTeam);
        }else if(task.type == TILE_TYPES.tower){
            new TowerBuilding(task.x, task.y, ownerTeam, {
                isTownTower: ownerTeam === 1,
                isStarterTownTower: false,
                isFortObjective: ownerTeam !== 1,
                grantBuildPermit: ownerTeam === 1,
            });
        }else if(task.type == TILE_TYPES.turret){
            new Turret(task.x, task.y, ownerTeam);
        }else if(task.type == TILE_TYPES.catapult){
            new Catapult(task.x, task.y, ownerTeam);
        }else{
            Map.handleMapClick(task.x*SQUARESIZE, task.y*SQUARESIZE, task.type);
        }
    }

    static assingTroopsToDestroy(teamNumber){
        let destroyList = Teams.teamLists[`${teamNumber}`].destroyStates;
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].builderList;
        Manager.assignTroopsToAction(troops, destroyList, CONTROL_STATES.DESTROY_MODE, force);
    }

    static assignTroopsToDestroyTile(teamNumber){
        const destroyList = Teams.teamLists[`${teamNumber}`].destroyTileStates;
        const force = Player.selected.length ? true : false;
        const troops = Player.selected.length ? Player.selected : Teams.teamLists[`${teamNumber}`].builderList;
        Manager.assignTroopsToAction(troops, destroyList, CONTROL_STATES.DESTROY_MODE_T, force);
    }

    static beginDestroyingBlock(sprite) {
        let task = sprite.task;
        if (!task || task.duration <= 0) {
            console.log(`sprite: ${sprite.id} delete mode outside of timer with duration: ${task.duration}`)
            if (task) {
                Teams.removeFromStateArray(sprite.body.team, "destroyStates", sprite.task);
            }
            sprite.task = null
            sprite.timer = null; 
            let teamNumber = sprite.body.team;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
            sprite.play(sprite.idle);
            return;
        }

        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if(!sprite.active || sprite.state != CONTROL_STATES.DESTROY_MODE) return;
            let teamNumber = sprite.body.team;
            if (!task || task.duration <= 0){
                console.log(`sprite: ${sprite.id} delete mode within timer `)
                sprite.task = null;
                if(sprite.timer){
                    sprite.timer.remove(false);
                    sprite.timer = null;
                }
                Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
                return;
            }

            // Ensure totalDuration snapshot exists (you already do this)
            if (!task.totalDuration) task.totalDuration = task.duration;

            // ✅ Gunslinger: fire projectile; projectile applies damage to *task.duration* via callback
            if (sprite.isGunslinger && sprite.weapon?.projectile) {
                // range+LOS gate (you already added these helpers in Gunslinger)
                if (!sprite._canShootDestroyTarget?.()) {
                    if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }
                    sprite._ensureShootPositionOrRepath?.();
                    return;
                }

                const targetSprite = sprite._getDestroyTarget?.();
                if (!targetSprite || !targetSprite.active) return;

                fightManager.playAttackPresentation(sprite, targetSprite, { playAudio: false });
                const ang = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetSprite.x, targetSprite.y);

                const proj = new Projectile(
                    sprite.x, sprite.y, ang,
                    sprite.body.team,
                    sprite.weapon,
                    sprite,
                    true
                );

                // cadence: schedule next shot if task still alive
                if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }
                sprite.timer = this.scene.time.delayedCall(sprite.weapon.duration, () => {
                    if (!sprite.task) return;
                    this.beginDestroyingBlock(sprite);
                });

                return;
            }
            else{
                // --- non-gunslinger path (existing melee/chip) stays the same ---
                let damage;
                if (!sprite.body.team || (sprite.type == Brawler || sprite.type == Blademaster || sprite.type == Gunslinger)) {
                    // Raiders / enemies: use their weapon to damage buildings
                    damage = sprite.weapon?.baseDmg || 5;
                } else {
                    // Player-side "demolition" – slow chip damage
                    damage = 2;
                }

                // Apply damage to the task duration
                task.duration = Math.max(0, task.duration - damage);

                // Resolve building instance: prefer value.buildingRef, fall back to value
                const targetObj = task.value?.buildingRef || task.value;
                if (!sprite.body.team || (sprite.type == Brawler || sprite.type == Blademaster || sprite.type == Gunslinger)) {
                    fightManager.playAttackPresentation(sprite, targetObj?.sprite || targetObj);
                }

                if (targetObj && typeof targetObj.onDamaged === "function") {
                    targetObj.onDamaged(damage, task.duration, task.totalDuration);
                }
            }

            if (task.duration <= 0) {
                if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }
                console.log("Done Destroying.");
                AudioManager.playSound("sfx_building_collapse");
                this._completeDestroyBlock(sprite, task);   // ✅ single source of truth
                return;
            }
            else {
                console.log(`sprite: ${sprite.id} continue building with new duration ${task.duration}`)
                sprite.timer.remove(false);
                sprite.timer = null;
                AudioManager.playSound("sfx_building_damage");
                // 🔥 Restart another delayed call if still destroying
                this.beginDestroyingBlock(sprite);
            }

        });
    
    }

    // buildingManager.js
    static beginDestroyingTile(sprite) {
        const task = sprite.task;
        if (!task) return;

        // If task somehow invalid, bail cleanly
        if (task.duration == null || task.duration <= 0) {
            sprite.task = null;
            if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }
            return;
        }

        // --- HP-based wall/door destruction ---
        // Ensure there is a Wall instance for visuals/HP tracking
        const tx = task.tx || task.x;
        const ty = task.ty || task.y;

        const wall = Wall.getAt(tx, ty);

        // If the target tile isn't a wall/door anymore, just cleanly finish this task.
        if (!wall || !wall.active) {
            sprite.task = null;
            sprite.play(sprite.idle);
            return;
        }

        // ✅ Gunslinger fires a projectile at the wall; projectile schedules impact
        let destroyed = false; // ✅ must exist for both paths

        // ✅ Gunslinger fires a projectile at the wall; projectile drives wall.hp
        if (sprite.isGunslinger && sprite.weapon?.projectile) {
            // Range+LOS gate
            if (!sprite._canShootDestroyTarget?.()) {
                sprite._ensureShootPositionOrRepath?.();
                return;
            }

            const targetSprite = wall.sprite;
            fightManager.playAttackPresentation(sprite, targetSprite, { playAudio: false });
            const ang = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetSprite.x, targetSprite.y);

            const proj = new Projectile(
                sprite.x, sprite.y, ang,
                sprite.body.team,
                sprite.weapon,
                sprite,
                true            
            );


            // cadence: keep shooting until destroyed (don’t rely on `destroyed` here)
            if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }
            sprite.timer = this.scene.time.delayedCall(sprite.weapon.duration, () => {
                if (!sprite.task) return;
                this.beginDestroyingTile(sprite);
            });

            return; // ✅ IMPORTANT: prevent falling through to melee path
        }
        else{
            // Damage amount (raiders use weapon, players use chip)
            const damage = (!sprite.body.team || (sprite.type == Brawler || sprite.type == Blademaster || sprite.type == Gunslinger))
            ? (sprite.weapon?.baseDmg || 5)
            : 2;

            fightManager.playAttackPresentation(sprite, wall.sprite);

            // Apply damage to the wall itself (this drives phase/frame changes)
            destroyed = wall.damage(damage);
        }

        // OPTIONAL: expose hp for debug UI / bars
        task.totalHp = wall.maxHp;
        task.hp = wall.hp;

        // If not destroyed yet, keep ticking
        if (!destroyed) {
        if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }
            sprite.timer = this.scene.time.delayedCall(sprite.weapon.duration, () => {
                if (!sprite.task) return;
                this.beginDestroyingTile(sprite);
            });
            return;
        }
        // ===== DESTROY COMPLETE =====
        this._completeDestroyTile(sprite, task, tx, ty);
        return true;
    }

    static _completeDestroyBlock(sprite, task) {
        const teamNumber = sprite.body.team;

        // stop repeating
        if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }

        sprite.play(sprite.idle);

        // destroy the building object/sprite
        const targetObj = task.value?.buildingRef || task.value;

        if (targetObj && typeof targetObj.destroy === "function") {
            targetObj.destroy(); // calls ClayOven/House/StorageBuilding.destroy
            if (task.type == TILE_TYPES.pine) {
                removeFromArray(Map.worldPines, targetObj);
            }
        } else if (task.value && typeof task.value.destroy === "function") {
            removeFromArray(Map.worldStones, task.value);
            task.value.destroy(); // fallback: just sprite
        }

        if(task.type.block || task.type.stayBlocked){
            // unblock tiles under footprint
            const blockTiles = [];
            for (let i = task.y; i < task.type.lenY + task.y; i++) {
                for (let j = task.x; j < task.type.lenX + task.x; j++) {
                    blockTiles.push({ x: j, y: i });

                    if (Array.isArray(Map.grid[i][j])) Map.grid[i][j] = Map.grid[i][j][0];

                    // unblocked for BOTH teams
                    Map.navGrid[i][j] = 1;
                    Map.enemyNavGrid[i][j] = 1;

                    Map.enemyRegionSystem?.markDirty?.();
                    Map.enemyRegionSystem?.ensureUpToDate?.();
                }
            }

            // refresh overview
            this.scene.zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => colorFor(cell));

            // unblock normal navmesh
            const change = this.NavMeshUpdater.blockTiles(blockTiles, true);
            if (change && change.removedPolyIds) {
                PathRegistry.handlePolysRemoved(Map.navMesh, change.removedPolyIds, change.addedPolyIds);
            }

            // unblock enemy navmesh
            const enemyChange = this.EnemyNavMeshUpdater.blockTiles(blockTiles, true);
            if (enemyChange && enemyChange.removedPolyIds) {
                PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
            }

            // mark dirty regions/drawers
            Map.regionSystem?.markDirty?.();
            Map.regionDrawer?.markDirty?.();
            Map.enemyRegionSystem?.markDirty?.();
            Map.enemyRegionDrawer?.markDirty?.();
        }

        // per-unit callbacks (kept from your completion block)
        if (sprite.type == Brawler || sprite.type == Blademaster || sprite.type == Gunslinger) {
            Player.onBlockDestroyed(sprite, task);
        } else if (teamNumber) {
            this._refundQueuedBuildCost({
                prepaid: true,
                refundCost: task.refundCost ?? task.type?.cost ?? task.type?.price ?? null,
            }, teamNumber);
        }

        // ✅ remove the shared task from the team queue
        Teams.removeFromStateArray(teamNumber, "destroyStates", task);

        // ✅ remove building record + clear task from the killer
        this.removeBuildingFromArray(task.x, task.y);
        sprite.task = null;

        // ✅ reassign the killer
        Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
    }


    static _completeDestroyTile(sprite, task, tx, ty) {
        const wall = Wall.getAt(tx, ty);
        const ownerTeam = wall?.team ?? 1;

        // stop repeating
        if (sprite.timer) { sprite.timer.remove(false); sprite.timer = null; }

        // update overview + visuals
        this.scene.zoomMixer.updateOverviewCell(tx, ty, Map.grid);

        // remove wall sprite + clear grid overlay
        Wall.destroyAt(tx, ty);

        // walkable for BOTH teams now (door logic handled below)
        Map.navGrid[ty][tx] = 1;
        Map.enemyNavGrid[ty][tx] = 1;

        // minimap/overview refresh
        this.scene.zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => colorFor(cell));

        // --- navmesh unblock rules ---
        // Walls (woodWall/wall) unblock BOTH meshes.
        // Doors: you were treating doors as "enemy-block" only when placed; once destroyed, unblock enemy mesh, and player mesh is already unblocked.
        const typeName = task?.type?.name;

        const isDoor = (typeName === "wall_door" || typeName === "woodWall_door");
        const unblockPlayer = !isDoor || ownerTeam === 0;
        const unblockEnemy = !isDoor || ownerTeam !== 0;

        if (unblockPlayer) {
            const changed = this.NavMeshUpdater.blockTiles([{ x: tx, y: ty }], true);
            if (changed?.removedPolyIds) {
            PathRegistry.handlePolysRemoved(Map.navMesh, changed.removedPolyIds, changed.addedPolyIds);
            }
        }

        if (unblockEnemy) {
            const enemyChanged = this.EnemyNavMeshUpdater.blockTiles([{ x: tx, y: ty }], true);
            if (enemyChanged?.removedPolyIds) {
                PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChanged.removedPolyIds, enemyChanged.addedPolyIds);
            }
        }

        // region/border maintenance (siege)
        Map.enemyRegionSystem?.removeWallFromBorderIndex?.(tx, ty);
        Map.enemyRegionSystem?.markDirty?.();
        Map.enemyRegionDrawer?.markDirty?.();

        Map.regionSystem?.markDirty?.();
        Map.regionDrawer?.markDirty?.();

        Map.enemyRegionSystem?.ensureUpToDate?.();

        // task cleanup + troop cleanup
        if (sprite.body.team) {
            // player units
            if (sprite.type === Brawler || sprite.type === Blademaster || sprite.type === Gunslinger) {
            Player.onWallDestroyed?.(sprite, task);
            } else {
            Builder.onWallDestroyed?.(sprite, task);
            }
        } else {
            // raiders
            Raider.siegeComplete?.(sprite);
        }

        // remove task from appropriate queue
        // For player demolition: destroyTileStates
        // For enemy-destroy commands: enemyDestroyTileStates (if you’re using that)
        const teamList = Teams.teamLists[sprite.body.team];
        if (teamList?.destroyTileStates) Teams.removeFromStateArray(sprite.body.team, "destroyTileStates", task);
        if (teamList?.enemyDestroyTileStates) Teams.removeFromStateArray(sprite.body.team, "enemyDestroyTileStates", task);

        sprite.task = null;
        sprite.play(sprite.idle);

        // reassign next (prefer enemy wall queue when present)
        const nextDestroyQueue = (teamList?.enemyDestroyTileStates?.length ?? 0) > 0
            ? teamList.enemyDestroyTileStates
            : (teamList?.destroyTileStates ?? []);
        Manager.assignOneTroopToAction(sprite, nextDestroyQueue, CONTROL_STATES.DESTROY_MODE_T);
    }



    static removeBuildingFromArray(x, y) { //problematic, hard looping as we dont know who destroying and why
        // 1) Remove from global town.buildingArray
        for (let i = 0; i < buildingArray.length; i++) {
            const [bx, by] = buildingArray[i];
            if (bx === x && by === y) {
                console.log(`REMOVED BUILDING (global) at ${bx},${by}`);
                buildingArray.splice(i, 1);
                break;
            }
        }

        // 2) Remove from each team’s buildings list and clean matching destroy tasks
        for (const teamKey in Teams.teamLists) {
            const team = Teams.teamLists[teamKey];
            if (!team) continue;

            if (Array.isArray(team.buildings)) {
                const before = team.buildings.length;

                team.buildings = team.buildings.filter(([bx, by, type, building]) => {
                    return !(bx === x && by === y);
                });

                // If we actually removed something from this team, also clear destroy tasks at that tile
                if (team.buildings.length !== before && Array.isArray(team.destroyStates)) {
                    team.destroyStates = team.destroyStates.filter(t => t.x !== x || t.y !== y);
                }
            }
        }

        return true;
    }

    static beginFixingBuilding(sprite) {
        const task = sprite.task;

        if (!task || !task.value) {
            this.clearFixTaskVisual(task);
            sprite.task = null;
            sprite.timer = null;
            sprite.play(sprite.idle);
            return;
        }

        const b = task.value; // the building instance you stored
        const maxHp = (b.maxHealth ?? 100);
        const hpKey = ("health" in b) ? "health" : (("hp" in b) ? "hp" : "health");
        const buildingHp = (b[hpKey] ?? 0);

        if (b._destroyed || b.sprite?._destroyed || b.sprite?.active === false || buildingHp <= 0) {
            this.clearFixTaskVisual(task);
            Teams.removeFromStateArray(sprite.body.team, "buildingFixTasks", task);
            sprite.task = null;
            sprite.timer = null;
            sprite.play(sprite.idle);
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[sprite.body.team].buildingFixTasks, CONTROL_STATES.FIX_BUILDING);
            return;
        }

        if (buildingHp >= maxHp) {
            // already fixed
            this.clearFixTaskVisual(task);
            Teams.removeFromStateArray(sprite.body.team, "buildingFixTasks", task);
            sprite.task = null;
            sprite.timer = null;
            sprite.play(sprite.idle);
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[sprite.body.team].buildingFixTasks, CONTROL_STATES.FIX_BUILDING);
            return;
        }

        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
            if (!sprite.active || sprite.state !== CONTROL_STATES.FIX_BUILDING) return;

            // building might have been destroyed mid-task
            if (!sprite.task || !sprite.task.value) {
                this.clearFixTaskVisual(sprite.task);
                sprite.task = null;
                sprite.timer = null;
                sprite.play(sprite.idle);
                return;
            }

            const building = sprite.task.value;
            const maxHealth = (building.maxHealth ?? 100);
            const key = ("health" in building) ? "health" : (("hp" in building) ? "hp" : "health");

            const before = (building[key] ?? 0);
            const healed = Math.min(5, maxHealth - before);
            building[key] = Math.min(maxHealth, before + healed);

            // green flash + shake
            if (building.sprite) {
                building.sprite.setTint(0x44ff44);
                this.scene.tweens.add({
                targets: building.sprite,
                x: building.sprite.x + 2,
                yoyo: true,
                repeat: 2,
                duration: 60,
                onComplete: () => building.sprite.clearTint()
                });
            }


            showGhostText(this.scene, building.x, building.y - 20, `+${healed} 💚`, 0x44ff44);
            

            sprite.play(sprite.action);

            // finished?
            if (building[key] >= maxHealth) {
                this.clearFixTaskVisual(sprite.task);
                Teams.removeFromStateArray(sprite.body.team, "buildingFixTasks", sprite.task);
                sprite.task = null;

                if (sprite.timer) {
                sprite.timer.remove(false);
                sprite.timer = null;
                }

                sprite.play(sprite.idle);
                return;
            }

            // continue ticking
            sprite.timer.remove(false);
            sprite.timer = null;
            this.beginFixingBuilding(sprite);
            });
        }
    }

    static hasRequiredMaterials(costObj, teamNumber) {
        for (const [res, count] of Object.entries(costObj)) {
            const amount = Math.max(0, Number(count) || 0);
            if (!(amount > 0)) continue;
            if (res === "money") {
                if ((this.scene?.money ?? 0) < amount) return false;
                continue;
            }
            if (res === "permits") {
                if ((this.scene?.permits ?? 0) < amount) return false;
                continue;
            }

            const itemDef = UI_ITEM_TYPES[res];
            if (!itemDef) continue;
            const storages = Teams.teamLists?.[teamNumber]?.storageList ?? Teams.teamLists?.[`${teamNumber}`]?.storageList ?? [];
            const available = storages.reduce((sum, storage) => sum + Math.max(0, Number(storage?.getItemCount?.(itemDef) || 0)), 0);
            if (available < amount) return false;
        }
        return true;
    }

    static consumeRequiredMaterials(costObj, teamNumber) {
        for (const [res, count] of Object.entries(costObj)) {
            const amount = Math.max(0, Number(count) || 0);
            if (!(amount > 0)) continue;
            if (res === "money") {
                this.scene?.updateMoney?.(-amount);
                continue;
            }
            if (res === "permits") {
                this.scene?.updatePermits?.(-amount);
                continue;
            }

            const itemDef = UI_ITEM_TYPES[res];
            if (!itemDef) continue;
            let remaining = amount;
            const storages = Teams.teamLists?.[teamNumber]?.storageList ?? Teams.teamLists?.[`${teamNumber}`]?.storageList ?? [];
            for (const storage of storages) {
                if (!(remaining > 0) || !storage?.removeItem) break;
                const before = Math.max(0, Number(storage.getItemCount?.(itemDef) || 0));
                storage.removeItem(itemDef.name, remaining);
                const after = Math.max(0, Number(storage.getItemCount?.(itemDef) || 0));
                remaining -= Math.max(0, before - after);
            }
            const consumed = amount - remaining;
            if (consumed > 0) {
                DailyNeedsTracker.updateUIItems(itemDef, consumed, true);
            }
        }
    }

    static updateConstructionHoverText(task) {
        const scene = buildingManager.scene;
        if (!scene || !task || !task.constructionSprite) return;
        if (this._isQueuedWallTask(task)) return;
        this._ensureConstructionTaskUi(task);

        const label = task.labelText;
        if (!label) return;

        const pct = this._currentConstructionPercent(task);
        const name = this._getTaskDisplayName(task);
        label.setText(`${name}\n${pct}%`);

        const sprite = task.constructionSprite;
        const x = sprite.x;
        const y = sprite.y;

        label.setPosition(x, y);
        label.setVisible(true);
    }

}

