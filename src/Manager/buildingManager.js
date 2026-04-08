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

export class buildingManager{

    static NavMeshUpdater;
    static EnemyNavMeshUpdater;
    static scene;
    static blockBuildingDuration = 250;

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
            queueKey: "buildingTileStates",
            };
            team.buildingTileStates.push(task);
            this.ensureQueuedTileBuildGhost(task, teamNumber);
        });
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
        if (clearGhost && task) {
            this.clearQueuedTileBuildGhost(task);
        }

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

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

        let task = team.buildingFixTasks.find(existing =>
            existing?.value === building ||
            (existing?.x === (building.gridX ?? building.x) &&
             existing?.y === (building.gridY ?? building.y))
        );

        if (!task) {
            task = {
                x: building.gridX ?? building.x,
                y: building.gridY ?? building.y,
                type: building.buildType ?? building.type ?? TILE_TYPES.house1,
                value: building,
                assigned: 0,
                queueKey: "buildingFixTasks",
            };
            team.buildingFixTasks.push(task);
        }

        this.ensureFixTaskVisual(task);
        return task;
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

    static ensureQueuedTileBuildGhost(task, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        if (!task || task.constructionSprite || !this.scene?.add) return task?.constructionSprite ?? null;

        const sprite = this.scene.add.image(
            task.x * SQUARESIZE + SQUARESIZE / 2,
            task.y * SQUARESIZE + SQUARESIZE / 2,
            "construction"
        )
            .setDisplaySize(SQUARESIZE, SQUARESIZE)
            .setDepth(BLOCKDEPTH + 0.15)
            .setAlpha(0.68)
            .setInteractive({ useHandCursor: true });

        task.constructionSprite = sprite;
        task.queueKey = task.queueKey ?? "buildingTileStates";
        task._hovering = false;

        sprite.on("pointerover", () => {
            task._hovering = true;
            sprite.setAlpha(0.85);
        });

        sprite.on("pointerout", () => {
            task._hovering = false;
            sprite.setAlpha(0.68);
        });

        sprite.on("pointerdown", () => {
            const selectedBuilders = this.getSelectedBuilders(teamNumber);
            if (selectedBuilders.length) {
                this.assignSelectedBuildersToTask(task, CONTROL_STATES.BUILD_MODE_T, selectedBuilders);
                return;
            }
            this.cancelQueuedTileBuild(task, teamNumber);
        });

        return sprite;
    }

    static clearQueuedTileBuildGhost(task) {
        if (!task) return;
        task.constructionSprite?.destroy?.();
        task.constructionSprite = null;
    }

    static cancelQueuedTileBuild(task, teamNumber = 1) {
        teamNumber = Number(teamNumber);
        if (!task) return false;
        this._releaseBuildersOnTask(task);
        Teams.removeFromStateArray(teamNumber, task.queueKey ?? "buildingTileStates", task);
        this.clearQueuedTileBuildGhost(task);
        return true;
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

    static createDestroyTileStateArray(tiles, teamNumber) {
        const team = Teams.teamLists[teamNumber];
        if (!Array.isArray(team.destroyTileStates)) team.destroyTileStates = [];

        tiles.forEach(t => {
            team.destroyTileStates.push({
            x: t.x,
            y: t.y,
            assigned: 0,
            type: t.type,
            // ✅ store what the tile WAS so Builder.js can refund correctly
            originalGridVal: t.originalGridVal,

            // ✅ drive wall HP / time pacing (beginDestroyingTile already uses wall.hp)
            duration: 9999, // any >0; beginDestroyingTile re-ticks off wall.hp anyway
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
        const directions = [
            [0, -1], [0, 1], [1, 0], [-1, 0],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
            [0, -2], [0, 2], [2, 0], [-2, 0],
            [-2, -1], [-2, 1], [2, -1], [2, 1],
            [-1, -2], [1, -2], [-1, 2], [1, 2],
        ];

        const { navMesh, navGrid } = Player._getNavForTroop(troop)

        // 1) candidate tiles
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

        // 2) try candidates using the SAME path pipeline as normal movement
        for (const c of candidates) {
            const path = Player.pathTo(troop, c.tx, c.ty, true); // ✅ sets troop.__pendingPolyIds
            if (path && path.length > 0) {
                return { tx: c.tx, ty: c.ty, path };
            }
        }

        return null;
    }

    static beginBuilding(troop){
        const teamNumber = troop.body.team ?? 1;
        // if(!buildingManager.hasRequiredMaterials(troop.task.buildType.price, teamNumber)){return}

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

        const x = task.x;
        const y = task.y;
        const buildTypeName = task.buildType?.name;
        const isDoor = (buildTypeName === "wall_door" || buildTypeName === "woodWall_door");
        const queuedTasks = Teams.teamLists?.[teamNumber]?.buildingTileStates ?? [];
        const taskStillQueued = queuedTasks.some((queuedTask) => this._sameQueuedBuildTask(queuedTask, task));
        const currentCell = Map.grid?.[y]?.[x];
        const currentNames = Array.isArray(currentCell)
            ? currentCell.map((val) => TILE_MAP(val))
            : [TILE_MAP(currentCell)];
        const tileAlreadyBuilt = currentNames.includes(buildTypeName);

        if (!taskStillQueued || tileAlreadyBuilt) {
            if (tileAlreadyBuilt) {
                this.clearQueuedTileBuildGhost(task);
                Teams.removeFromStateArray(teamNumber, "buildingTileStates", task);
            }
            this._clearBuilderQueuedBuildState(troop, {
                queueKey: "buildingTileStates",
                removeQueueTask: false,
                assignNext: true,
                clearGhost: false,
            });
            return;
        }
        // Map.grid[y][x] = [Map.grid[y][x], troop.task.buildType.grid];

        // ✅ Only block nav / navmesh if the tile is blocking
        if (task.buildType.block) {
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
            if(enemyChange && enemyChange.removedPolyIds){
                const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                for (const unit of impacted) {
                    PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
                }
            }
            Map.placeTile(x,y,task.buildType.name);
            if (buildTypeName === "wall" || buildTypeName === "woodWall") {
                Wall.ensureAt(this.scene, x, y, teamNumber);
                Map.refreshWallShapesAround?.(x, y);
            }
        } else {
            Map.handleGridDelete(null, task.buildType, x, y);
            Map.grid[y][x] = [Map.grid[y][x], task.buildType.grid];
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
                // else {
                //     const playerChange = this.NavMeshUpdater.blockTiles([{ x, y }], true);
                //     if (playerChange && playerChange.removedPolyIds) {
                //         const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, playerChange.removedPolyIds, playerChange.addedPolyIds);
                //         for (const unit of impacted) {
                //             PathRepair.repairUnitPath(unit, playerChange.removedPolyIds, Map.navMesh);
                //         }
                //     }
                // }

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
            Map.drawGridValue(x,y,1);
            if (isDoor) {
                Wall.ensureAt(this.scene, x, y, teamNumber);
                Map.refreshWallShapesAround?.(x, y);
            }
            // IMPORTANT: do NOT call blockTile for doors
        }

        // mark dirty changes to refgions and drawers
        this.scene.zoomMixer.updateOverviewCell(x, y, Map.grid);
        Map.regionSystem?.markDirty?.();
        Map.regionDrawer?.markDirty?.();
        Map.enemyRegionSystem?.markDirty?.();
        Map.enemyRegionDrawer?.markDirty?.();
        Map.enemyRegionSystem?.ensureUpToDate?.(); // forces recompute once (your current RegionSystem supports this)

        AudioManager.playSound("sfx_building_complete", { volume: 0.2 });
        const completedTask = task;
        this._clearBuilderQueuedBuildState(troop, {
            queueKey: "buildingTileStates",
            removeQueueTask: true,
            assignNext: true,
            clearGhost: true,
        });
        this._releaseOtherBuildersForQueuedBuild(completedTask, teamNumber, troop, "buildingTileStates");
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

    static findBuildApproachBlock(x, y, type, troop, tStartX = null, tStartY = null) {
        const candidates = [];

        // Top-left of block footprint
        const startX = x;
        const startY = y;

        const { navMesh, navGrid } = Player._getNavForTroop(troop)

        // 1) Collect all walkable perimeter tiles (as before)
        for (let dy = -1; dy <= type.lenY; dy++) {
            for (let dx = -1; dx <= type.lenX; dx++) {
                const tx = startX + dx;
                const ty = startY + dy;

                const isInsideBlock = dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY;
                if (isInsideBlock) continue;

                if (tx < 0 || ty < 0 || ty >= navGrid.length || tx >= navGrid[0].length) continue;
                if (!navGrid[ty][tx]) continue; // Not walkable

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

        // 2) Resolve starting world position (troop or explicit)
        if (tStartX == null || tStartY == null) {
            let troopX = Math.floor(troop.body.x / SQUARESIZE);
            let troopY = Math.floor(troop.body.y / SQUARESIZE);
            tStartX = troop.body.x;
            tStartY = troop.body.y;

            if (!navGrid[troopY]?.[troopX]) {
                const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                if (newX === -1) {
                    console.log("No valid start tile nearby");
                    return null;
                } else {
                    tStartX = newX * SQUARESIZE + SQUARESIZE / 2;
                    tStartY = newY * SQUARESIZE + SQUARESIZE / 2;
                    console.log("New valid tile:", newX, newY);
                }
            }
        } else {
            tStartX = tStartX * SQUARESIZE + SQUARESIZE / 2;
            tStartY = tStartY * SQUARESIZE + SQUARESIZE / 2;
        }

        // 🔥 3) Prefer "door" tile: bottom-center of the block
        //    Imagine door on bottom edge in y, centered in x.
        const doorDx = Math.floor(type.lenX / 2);          // center in X
        const doorTx = startX + doorDx;
        const doorTy = startY + type.lenY;                 // just below bottom edge

        if (
            doorTx >= 0 && doorTy >= 0 &&
            doorTy < navGrid.length &&
            doorTx < navGrid[0].length &&
            navGrid[doorTy][doorTx]            // must be walkable
        ) {
            const doorWorldX = doorTx * SQUARESIZE + SQUARESIZE / 2;
            const doorWorldY = doorTy * SQUARESIZE + SQUARESIZE / 2;

            // inside findBuildApproachBlock, where you compute doorTx/doorTy
            const doorPath = Player.pathTo(troop, doorTx, doorTy, true);
            if (doorPath && doorPath.length > 0) {
                return { tx: doorTx, ty: doorTy, path: doorPath };
            }

        }

        // 4) Fallback: previous behaviour, closest perimeter candidate
        candidates.sort((a, b) => a.dist - b.dist);

        for (const candidate of candidates) {
            const path = Player.pathTo(troop, candidate.tx, candidate.ty, true);
            if (path && path.length > 0) {
                return { tx: candidate.tx, ty: candidate.ty, path };
            }
        }


        return null; // ❌ No valid path found
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
            let troopX = Math.floor(troop.body.x / SQUARESIZE);
            let troopY = Math.floor(troop.body.y / SQUARESIZE);
            tStartX = troop.body.x;
            tStartY = troop.body.y;

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
            console.log(`sprite: ${sprite.id} delete mode outside of timer with duration: ${task?.duration}`)
            this._clearBuilderQueuedBuildState(sprite, {
                queueKey: "blockBuildingStates",
                removeQueueTask: false,
                assignNext: true,
                clearGhost: false,
            });
            return;
        }

        if (!task.constructionSprite) {
            task.constructionSprite = Map.scene.add.image(
                task.x * SQUARESIZE + (task.type.lenX * SQUARESIZE) / 2,
                task.y * SQUARESIZE + (task.type.lenY * SQUARESIZE) / 2,
                'construction'
            ).setDepth(BLOCKDEPTH);

            task.constructionSprite.setDisplaySize(
                task.type.lenX * SQUARESIZE,
                task.type.lenY * SQUARESIZE
            );

            // Snapshot starting duration so we can compute %
            task.totalDuration = task.duration;
            task._hovering = false;

            const scene = this.scene;

            // Create shared hover UI once (bg + text)
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
                    .rectangle(0, 0, 10, 10, 0x000000, 0.6)  // similar to house hover
                    .setStrokeStyle(1, 0xffffff, 0.4)
                    .setOrigin(0.5, 1)
                    .setDepth(UIDEPTH + 5)
                    .setScrollFactor(1)
                    .setVisible(false);
            }

            task.constructionSprite.setInteractive({ useHandCursor: true });

            task.constructionSprite.on("pointerover", () => {
                task._hovering = true;
                scene.constructionHoverBg.setVisible(true);
                scene.constructionHoverText.setVisible(true);
                buildingManager.updateConstructionHoverText(task);
            });

            task.constructionSprite.on("pointerout", () => {
                task._hovering = false;
                scene.constructionHoverBg.setVisible(false);
                scene.constructionHoverText.setVisible(false);
            });

            task.constructionSprite.on("pointerdown", () => {
                const selectedBuilders = this.getSelectedBuilders(sprite.body.team);
                if (!selectedBuilders.length) return;
                this.assignSelectedBuildersToTask(task, CONTROL_STATES.BUILD_MODE_B, selectedBuilders);
            });
        }

        // Mark this builder as actively constructing (starts/keeps the construction loop)
        AudioManager.setConstructionActive(sprite, true);

        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(this.blockBuildingDuration, () => {
                console.log(`sprite: ${sprite.id} starting timer, duration: ${task.duration}`)
                if (!sprite.active || sprite.state != CONTROL_STATES.BUILD_MODE_B) {
                    AudioManager.setConstructionActive(sprite, false);
                    sprite.timer = null; // avoid “stuck timer” pointers
                    return;
                }
                let teamNumber = sprite.body.team;
                if (!task || task.duration <= 0){
                    console.log(`sprite: ${sprite.id} delete mode within timer `)
                    this._clearBuilderQueuedBuildState(sprite, {
                        queueKey: "blockBuildingStates",
                        removeQueueTask: false,
                        assignNext: true,
                        clearGhost: false,
                    });
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
                task.duration -= 2;
                sprite.stamina = Math.max(0, sprite.stamina - 0.2);
                if (task._hovering) {
                    buildingManager.updateConstructionHoverText(task);
                }
    
                if (task.duration <= 0) {
                    // if(!buildingManager.scene.checkSufficientFunds(task.type.price)) return;
                    // buildingManager.scene.updateMoney(-1*task.type.price);
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
                    sprite.play(sprite.idle);
                    sprite.timer = null;
                    console.log("Done building.");
                    const cost = task.type.cost;
                    AudioManager.setConstructionActive(sprite, false);
                    if (cost && !task.prepaid && !this.hasRequiredMaterials(cost, teamNumber)) {
                        console.log("Not enough resources to build!");
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
                    if (task.constructionSprite) {
                        task.constructionSprite.destroy();
                        task.constructionSprite = null;
                    }
                    const scene = buildingManager.scene;
                    if (scene) {
                        if (scene.constructionHoverText) {
                            scene.constructionHoverText.setVisible(false);
                        }
                        if (scene.constructionHoverBg) {
                            scene.constructionHoverBg.setVisible(false);
                        }
                    }
                    task._hovering = false;
                    this.handlePlacement(task, teamNumber);

                    let blockTiles = [];
                    let startY = task.y;
                    let startX = task.x;

                    for (let i = startY; i < task.type.lenY + startY; i++) {
                        for (let j = startX; j < task.type.lenX + startX; j++) {
                            blockTiles.push({ x: j, y: i });

                            // buildings block BOTH teams (doors are handled elsewhere)
                            Map.navGrid[i][j] = 0;
                            Map.enemyNavGrid[i][j] = 0;
                            Map.enemyRegionSystem?.markDirty?.();
                            Map.enemyRegionSystem?.ensureUpToDate?.(); // forces recompute once (your current RegionSystem supports this)
                        }
                    }

                    this.scene.zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => colorFor(cell));

                    // Update normal mesh
                    const change = this.NavMeshUpdater.blockTiles(blockTiles);
                    if (change && change.removedPolyIds) {
                        const impacted = PathRegistry.handlePolysRemoved(Map.navMesh, change.removedPolyIds, change.addedPolyIds);
                        if(impacted){
                            for (const unit of impacted) {
                                PathRepair.repairUnitPath(unit, change.removedPolyIds, Map.navMesh);
                            }
                        }
                    }

                    // Update enemy mesh
                    const enemyChange = this.EnemyNavMeshUpdater.blockTiles(blockTiles);
                    if (enemyChange && enemyChange.removedPolyIds) {
                        const impacted = PathRegistry.handlePolysRemoved(Map.enemyNavMesh, enemyChange.removedPolyIds, enemyChange.addedPolyIds);
                        if(impacted){
                            for (const unit of impacted) {
                                PathRepair.repairUnitPath(unit, enemyChange.removedPolyIds, Map.enemyNavMesh);
                            }
                        }
                    }

                    // mark dirty changes to refgions and drawers
                    Map.regionSystem?.markDirty?.();
                    Map.regionDrawer?.markDirty?.();
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
                    console.log(`sprite: ${sprite.id} continue building with new duration ${task.duration}`)
                    sprite.timer = null;
                    // 🔥 Restart another delayed call if still building
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

                const ang = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetSprite.x, targetSprite.y);

                const proj = new Projectile(
                    sprite.x, sprite.y, ang,
                    sprite.body.team,
                    sprite.weapon,
                    sprite,
                    true
                );

                sprite.play(sprite.action);

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
                    AudioManager.playWeaponAttack(sprite, sprite.weapon);
                } else {
                    // Player-side "demolition" – slow chip damage
                    damage = 2;
                }

                // Apply damage to the task duration
                task.duration = Math.max(0, task.duration - damage);

                // Resolve building instance: prefer value.buildingRef, fall back to value
                const targetObj = task.value?.buildingRef || task.value;

                if (targetObj && typeof targetObj.onDamaged === "function") {
                    targetObj.onDamaged(damage, task.duration, task.totalDuration);
                }
            }

            sprite.play(sprite.action);
            
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
            const ang = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetSprite.x, targetSprite.y);

            const proj = new Projectile(
                sprite.x, sprite.y, ang,
                sprite.body.team,
                sprite.weapon,
                sprite,
                true            
            );

            sprite.play(sprite.action);

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

            AudioManager.playWeaponAttack(sprite, sprite.weapon);


            // Apply damage to the wall itself (this drives phase/frame changes)
            destroyed = wall.damage(damage);
        }

        // OPTIONAL: expose hp for debug UI / bars
        task.totalHp = wall.maxHp;
        task.hp = wall.hp;

        sprite.play(sprite.action);

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

        if ((b[hpKey] ?? 0) >= maxHp) {
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
            if (!StorageBuilding.hasTeamMaterials(res, count, teamNumber)) {
                return false;
            }
        }
        return true;
    }

    static consumeRequiredMaterials(costObj, teamNumber) {
        for (const [res, count] of Object.entries(costObj)) {
            StorageBuilding.removeTeamMaterials(res, count, teamNumber);
            DailyNeedsTracker.updateUIItems(UI_ITEM_TYPES[res], count, true);
        }
    }

    static updateConstructionHoverText(task) {
        const scene = buildingManager.scene;
        if (!scene || !task || !task.constructionSprite) return;

        const label = scene.constructionHoverText;
        const bg    = scene.constructionHoverBg;
        if (!label || !bg) return;

        const total = task.totalDuration || task.duration || 1;
        const done  = total - task.duration;
        const pct   = Math.max(
            0,
            Math.min(100, Math.round((done / total) * 100))
        );

        const name =
            (task.type && (task.type.displayName || task.type.name)) ||
            "Building";

        label.setText(`${name}\n${pct}%`);

        // Position above the construction sprite
        const x = task.constructionSprite.x;
        const y =
            task.constructionSprite.y -
            task.constructionSprite.displayHeight / 2 -
            4;

        label.setPosition(x, y);

        // Size bg to text, with padding
        const pad = 4;
        const w = label.width + pad * 2;
        const h = label.height + pad * 2;
        bg.setSize(w, h);
        bg.setPosition(x, y);
    }

}

