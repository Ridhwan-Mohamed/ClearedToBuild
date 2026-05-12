// === Builder.js ===
import { BLOCKDEPTH, CONTROL_STATES, SQUARESIZE } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { Manager } from '../Manager/Manager.js';
import { UI_ITEM_TYPES } from '../UI/UIConstants.js';
import { StorageBuilding } from '../buildings/Storage.js';
import { Wall } from '../buildings/Wall.js';
import { buildingManager } from '../Manager/buildingManager.js';
import { Scheduler } from '../ai/scheduler/Scheduler.js';
import { attachDirectionalSix } from './PlayerDirectionalAnimator.js';
import builderWalkDown from 'url:../assets/players/builder/builder_walk_down.png';
import builderWalkDownLeft from 'url:../assets/players/builder/builder_walk_down_left.png';
import builderWalkDownRight from 'url:../assets/players/builder/builder_walk_down_right.png';
import builderWalkUp from 'url:../assets/players/builder/builder_walk_up.png';
import builderWalkUpLeft from 'url:../assets/players/builder/builder_walk_up_left.png';
import builderWalkUpRight from 'url:../assets/players/builder/builder_walk_up_right.png';
import builderSwimUp from 'url:../assets/players/builder/builder_swim_up.png';
import builderSwimDown from 'url:../assets/players/builder/builder_swim_down.png';
import builderSwimSidewards from 'url:../assets/players/builder/builder_swim_sidewards.png';

export class Builder {

    static speed = 85;
    static stamina = 0.01;

    static preload(scene) {
        scene.load.spritesheet('builder_walk_down', builderWalkDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_walk_down_left', builderWalkDownLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_walk_down_right', builderWalkDownRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_walk_up', builderWalkUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_walk_up_left', builderWalkUpLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_walk_up_right', builderWalkUpRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_swim_up', builderSwimUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_swim_down', builderSwimDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('builder_swim_sidewards', builderSwimSidewards, { frameWidth: 32, frameHeight: 32 });
    }

    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'builder_walk_down',
            1
        );


        sprite.setInteractive();
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.setSize(16, 12).setOffset(8, 20);
        sprite.setCollideWorldBounds(true);
        sprite.unitTint = 0x4433ff;
        sprite.name = NameGenerator.generate();

        sprite.id = Player.count++;
        sprite.body.team = teamNumber;
        sprite.health = 100;
        sprite.maxHealth = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.body.pushable = false;
        sprite.type = Builder

        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.swim = 'swim';
        sprite.carry = 'carry';
        attachDirectionalSix(sprite, {
            animPrefix: 'builder',
            defaultDirection: 'down',
            walkStateKey: 'walk',
            idleStateKey: 'idle',
            swimStateKey: 'swim',
            idleFrame: 1,
            swimIdleFrame: 1,
            frameRate: 7,
            swimFrameRate: 8,
            directions: {
                down: 'builder_walk_down',
                down_left: 'builder_walk_down_left',
                down_right: 'builder_walk_down_right',
                up: 'builder_walk_up',
                up_left: 'builder_walk_up_left',
                up_right: 'builder_walk_up_right',
            },
            swimDirections: {
                up: 'builder_swim_up',
                down: 'builder_swim_down',
                side: 'builder_swim_sidewards',
            }
        });

        sprite.isBuilder = true;

        // === Register with systems ===
        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].builderList.push(sprite);
        sprite.destroySelf = () => Builder.destroy(sprite);
        return sprite
    }
 
    static update(troop) {
        // If currently fleeing, only maintain flee behaviour.
        if (troop.state === CONTROL_STATES.FLEE_MODE) {
            Player.updateTracking(troop);   // may keep fleeing or drop back to TRACK_MODE when safe
            return;
        }

        // Always check for nearby enemies first (can flip into FLEE_MODE and drop tasks).
        Player.updateTracking(troop);
        if (troop.state === CONTROL_STATES.FLEE_MODE) {
            // Just started fleeing this tick; do not do builder logic.
            return;
        }

        if (
            troop.task &&
            troop.state === CONTROL_STATES.FIX_BUILDING &&
            Scheduler.hasAvailableBuilderBuildWork?.(troop)
        ) {
            buildingManager.interruptBuilderFixForQueuedBuild?.(troop);
        }

        // If we still have a task after tracking (i.e., not dropped by flee), just work it.
        if (troop.task) return;

        if (Player.tryEnterQueuedSleep?.(troop)) return;
        if (Scheduler.stepUnit(troop)) return;
        if (Player.tryReturnIdleTroopToTown?.(troop)) return;
        if (!troop.task && !troop.track && troop.state === CONTROL_STATES.TRACK_MODE && !troop.roam) {
            Player.roam(troop);
        }
    }

    static onWallDestroyed(troop, task) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];
        if (!team || !task) return;

        // 1) Remove from team queue (encapsulated here)
        Teams.removeFromStateArray(teamNumber, "destroyTileStates", task);

        // 2) Refund / auto-consume using originalGridVal from the task
        const refundBundle = task.refundCost ?? task.type?.cost ?? task.type?.price ?? null;
        if (refundBundle && typeof refundBundle === "object") {
            for (const [resourceKey, rawAmount] of Object.entries(refundBundle)) {
                const amount = Math.max(0, Number(rawAmount) || 0);
                if (!(amount > 0)) continue;
                const refundItem = UI_ITEM_TYPES[resourceKey];
                if (!refundItem) continue;
                for (let count = 0; count < amount; count += 1) {
                    this._storeRefund(team, refundItem);
                }
            }
        }

        // 3) Clear troop task + timer, reset state (NO reassignment here)
        troop.task = null;
        if (troop.timer) { troop.timer.remove(false); troop.timer = null; }
        troop.play(troop.idle);
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }

    static _matchesWallBuildType(buildTypeName, kind) {
        // Doors:
        if (kind.isDoor) {
            if (kind.material === "stone") return buildTypeName === "wall_door";
            return buildTypeName === "woodWall_door";
        }
        // Non-doors:
        if (kind.material === "stone") return buildTypeName === "wall";
        return buildTypeName === "woodWall";
    }

    static _storeRefund(team, refundItem) {
        const storages = team.storageList;
        if (Array.isArray(storages) && storages.length) {
            // Put into first storage that accepts it
            for (const s of storages) {
                if (s?.addItem?.(refundItem, 1)) return;
            }
        }

        // No storage or no capacity: buffer on team for later reconciliation
        if (!Array.isArray(team.pendingRefunds)) team.pendingRefunds = [];
        team.pendingRefunds.push({ item: refundItem, count: 1 });
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];

        Player._destroyMiniBars(troop);

        if (team?.builderList) {
            const index = team.builderList.indexOf(troop);
            if (index !== -1) {
                team.builderList.splice(index, 1);
            }
        }

        let plIndex = team.playerList.indexOf(troop)
        if (plIndex !== -1) {
            team.playerList.splice(plIndex, 1);
        }
        const scene = troop.scene;
        if (scene?.playerTab?.onPlayerDestroyed) {
            scene.playerTab.onPlayerDestroyed(troop);
        }

        // Clear references
        if (troop.task) {troop.task.assigned--; troop.task = null;}
        if (troop.carrying) troop.carrying = null;

        if (troop.visionId != null) {
            VisibilitySystem.removeVisionBubble(troop.visionId);
            troop.visionId = null;
        }
        
        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        if (troop.buildSwingTween) {
            troop.buildSwingTween.remove();
            troop.buildSwingTween = null;
        }

        if (troop.buildSwingFx) {
            troop.buildSwingFx.destroy();
            troop.buildSwingFx = null;
        }

        // ❗ Remove from Player.characters group
        Player.characters.remove(troop);

        // 💥 CRITICAL FIX: remove from physics world
        if (troop.body) {
            troop.scene.physics.world.remove(troop.body);
            troop.body.destroy();
        }

        const ind = Player.troops.indexOf(troop);
        if (ind !== -1) Player.troops.splice(ind, 1);

        // Now safe to destroy the sprite
        troop.destroy();
    }
}
