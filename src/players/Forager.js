import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { Manager } from '../Manager/Manager.js';
import { StorageManager } from '../Manager/StorageManager.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { Scheduler } from '../ai/scheduler/Scheduler.js';
import { attachDirectionalSix } from './PlayerDirectionalAnimator.js';
import { OrderRunner } from '../orders/OrderRunner.js';
import foragerWalkDown from 'url:../assets/players/forager/forager_walk_down.png';
import foragerWalkDownLeft from 'url:../assets/players/forager/forager_walk_down_left.png';
import foragerWalkDownRight from 'url:../assets/players/forager/forager_walk_down_right.png';
import foragerWalkUp from 'url:../assets/players/forager/forager_walk_up.png';
import foragerWalkUpLeft from 'url:../assets/players/forager/forager_walk_up_left.png';
import foragerWalkUpRight from 'url:../assets/players/forager/forager_walk_up_right.png';
import foragerPickup from 'url:../assets/players/forager/forager_pickup.png';
import stoneAxe from 'url:../assets/players/forager/stone_axe.png';
import stonePickaxe from 'url:../assets/players/forager/stone_pickaxe.png';
import goldAxe from 'url:../assets/players/forager/gold_axe.png';
import goldPickaxe from 'url:../assets/players/forager/gold_pickaxe.png';
import foragerSwimUp from 'url:../assets/players/forager/forager_swim_up.png';
import foragerSwimDown from 'url:../assets/players/forager/forager_swim_down.png';
import foragerSwimSidewards from 'url:../assets/players/forager/forager_swim_sidewards.png';
 
export class Forager {

    static speed = 120;
    static stamina = 0.001;

    static preload(scene) {
        scene.load.spritesheet('forager_walk_down', foragerWalkDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_walk_down_left', foragerWalkDownLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_walk_down_right', foragerWalkDownRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_walk_up', foragerWalkUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_walk_up_left', foragerWalkUpLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_walk_up_right', foragerWalkUpRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.image('forager_pickup', foragerPickup);
        scene.load.image('forager_stone_axe', stoneAxe);
        scene.load.image('forager_stone_pickaxe', stonePickaxe);
        scene.load.image('forager_gold_axe', goldAxe);
        scene.load.image('forager_gold_pickaxe', goldPickaxe);
        scene.load.spritesheet('forager_swim_up', foragerSwimUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_swim_down', foragerSwimDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('forager_swim_sidewards', foragerSwimSidewards, { frameWidth: 32, frameHeight: 32 });
    }

    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'forager_walk_down',
            1
        );
        sprite.setInteractive();
        sprite.id = Player.count++;
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.roam = false;
        sprite.currentPath = [];
        sprite.body.team = teamNumber;
        sprite.health = 100;
        sprite.maxHealth = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.unitTint = 0x228B22;
        sprite.body.pushable = false;
        sprite.animState = 'idle';
        sprite.type = Forager;
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.swim = 'swim';
        sprite.pickupPose = 'forager_pickup';
        attachDirectionalSix(sprite, {
            animPrefix: 'forager',
            defaultDirection: 'down',
            walkStateKey: 'walk',
            idleStateKey: 'idle',
            swimStateKey: 'swim',
            idleFrame: 1,
            swimIdleFrame: 1,
            frameRate: 7,
            swimFrameRate: 8,
            directions: {
                down: 'forager_walk_down',
                down_left: 'forager_walk_down_left',
                down_right: 'forager_walk_down_right',
                up: 'forager_walk_up',
                up_left: 'forager_walk_up_left',
                up_right: 'forager_walk_up_right',
            },
            swimDirections: {
                up: 'forager_swim_up',
                down: 'forager_swim_down',
                side: 'forager_swim_sidewards',
            }
        });
        sprite.name = NameGenerator.generate();
        sprite.carrying = null;
        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        sprite.isForager = true;
        sprite.gatherSwingFxKeys = {
            wood: {
                normal: 'forager_stone_axe',
                boosted: 'forager_gold_axe',
            },
            rock: {
                normal: 'forager_stone_pickaxe',
                boosted: 'forager_gold_pickaxe',
            }
        };
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].foragerList.push(sprite);
        sprite.destroySelf = () => Forager.destroy(sprite);
        return sprite;
    }

    static update(forager){
        // If currently fleeing, only maintain flee behaviour.
        if (forager.state === CONTROL_STATES.FLEE_MODE) {
            Player.updateTracking(forager);   // may keep fleeing or drop back to TRACK_MODE when safe
            return;
        }

        // Always check for nearby enemies first (can flip into FLEE_MODE and drop tasks).
        Player.updateTracking(forager);
        if (forager.state === CONTROL_STATES.FLEE_MODE) {
            // Just started fleeing this tick; do not do forager logic.
            return;
        }

        if (OrderRunner.stepUnit(forager)) return;
        if (forager.task) return;

        if (Player.tryEnterQueuedSleep?.(forager)) return;
        if (Player.tryReturnIdleTroopToTown?.(forager)) return;
        // if (Scheduler.stepUnit(forager)) return;
        
        if (!forager.task && forager.state === CONTROL_STATES.TRACK_MODE && !forager.roam) {
            Player.roam(forager);
        }
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];
        if (!team?.foragerList) return;

        OrderRunner.handleTroopDestroyed(troop);

        Player._destroyMiniBars(troop)

        let plIndex = team.playerList.indexOf(troop)
        if (plIndex !== -1) {
            team.playerList.splice(plIndex, 1);
        }
        const scene = troop.scene;
        if (scene?.playerTab?.onPlayerDestroyed) {
            scene.playerTab.onPlayerDestroyed(troop);
        }

        const index = team.foragerList.indexOf(troop);
        if (index !== -1) {
            team.foragerList.splice(index, 1);
        }

        // Kill timers
        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }
        if (troop.gatherSwingTween) {
            troop.gatherSwingTween.remove();
            troop.gatherSwingTween = null;
        }
        if (troop.gatherSwingFx) {
            troop.gatherSwingFx.destroy();
            troop.gatherSwingFx = null;
        }

        // Remove FoW bubble
        if (troop.visionId != null) {
            VisibilitySystem.removeVisionBubble(troop.visionId);
            troop.visionId = null;
        }

        // Clear tasks
        if (troop.task) { troop.task.assigned--; troop.task = null; }
        troop.carrying = null;

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
