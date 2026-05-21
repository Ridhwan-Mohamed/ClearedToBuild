// === Brawler.js ===
import { BLOCKDEPTH, CONTROL_STATES, SQUARESIZE } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { weapons } from '../weapons.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';
import { Manager } from '../Manager/Manager.js';
import { Scheduler } from '../ai/scheduler/Scheduler.js';
import { attachDirectionalSix } from './PlayerDirectionalAnimator.js';
import brawlerWalkDown from 'url:../assets/players/brawler/brawler_walk_down.png';
import brawlerWalkDownLeft from 'url:../assets/players/brawler/brawler_walk_down_left.png';
import brawlerWalkDownRight from 'url:../assets/players/brawler/brawler_walk_down_right.png';
import brawlerWalkUp from 'url:../assets/players/brawler/brawler_walk_up.png';
import brawlerWalkUpLeft from 'url:../assets/players/brawler/brawler_walk_up_left.png';
import brawlerWalkUpRight from 'url:../assets/players/brawler/brawler_walk_up_right.png';
import boxingGloveFx from 'url:../assets/Players/boxing_glove.png';
import brawlerSwimUp from 'url:../assets/players/brawler/brawler_swim_up.png';
import brawlerSwimDown from 'url:../assets/players/brawler/brawler_swim_down.png';
import brawlerSwimSidewards from 'url:../assets/players/brawler/brawler_swim_sidewards.png';

export class Brawler {

    static speed = 130; // fastest melee unit
    static stamina = 0.01;

    static preload(scene) {
        scene.load.spritesheet('brawler_walk_down', brawlerWalkDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_walk_down_left', brawlerWalkDownLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_walk_down_right', brawlerWalkDownRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_walk_up', brawlerWalkUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_walk_up_left', brawlerWalkUpLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_walk_up_right', brawlerWalkUpRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.image('brawler_boxing_glove_fx', boxingGloveFx);
        scene.load.spritesheet('brawler_swim_up', brawlerSwimUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_swim_down', brawlerSwimDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet('brawler_swim_sidewards', brawlerSwimSidewards, { frameWidth: 32, frameHeight: 32 });
    }

    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'brawler_walk_down',
            1
        );


        sprite.setInteractive();
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.setSize(16, 12).setOffset(8, 20);
        sprite.setCollideWorldBounds(true);
        sprite.unitTint = 0xFFD712;

        sprite.id = Player.count++;
        sprite.body.team = teamNumber;
        sprite.health = 100;
        sprite.maxHealth = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.body.pushable = false;
        sprite.name = NameGenerator.generate();
        sprite.type = Brawler;

        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.swim = 'swim';
        attachDirectionalSix(sprite, {
            animPrefix: 'brawler',
            defaultDirection: 'down',
            walkStateKey: 'walk',
            idleStateKey: 'idle',
            swimStateKey: 'swim',
            idleFrame: 1,
            swimIdleFrame: 1,
            frameRate: 7,
            swimFrameRate: 8,
            directions: {
                down: 'brawler_walk_down',
                down_left: 'brawler_walk_down_left',
                down_right: 'brawler_walk_down_right',
                up: 'brawler_walk_up',
                up_left: 'brawler_walk_up_left',
                up_right: 'brawler_walk_up_right',
            },
            swimDirections: {
                up: 'brawler_swim_up',
                down: 'brawler_swim_down',
                side: 'brawler_swim_sidewards',
            }
        });

        sprite.isBrawler = true;
        sprite.meleeFxKey = 'brawler_boxing_glove_fx';

        sprite.weapon = weapons.boxingGloves;

        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].fighterList.push(sprite);
        sprite.destroySelf = () => Brawler.destroy(sprite);

        return sprite;
    }

    static update(troop) {
        Player.updateTracking(troop);
        if (troop.task || troop.track) return;
        if (Player.tryEnterQueuedSleep?.(troop)) return;
        if (Scheduler.stepUnit(troop)) return;
        if (Player.tryReturnIdleTroopToTown?.(troop, { requireNoActiveEnemies: true })) return;
        if (!troop.task && !troop.track && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam)
            Player.roam(troop);
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];

        Player._destroyMiniBars(troop)

        if (team?.fighterList) {
            const index = team.fighterList.indexOf(troop);
            if (index !== -1) team.fighterList.splice(index, 1);
        }

        const plIndex = team.playerList.indexOf(troop);
        if (plIndex !== -1) team.playerList.splice(plIndex, 1);

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        if (troop.visionId != null) {
            VisibilitySystem.removeVisionBubble(troop.visionId);
            troop.visionId = null;
        }

        Player._releaseTaskAssignment?.(troop);
        if (troop.carrying) troop.carrying = null;

        Player.characters.remove(troop);

        if (troop.body) {
            troop.scene.physics.world.remove(troop.body);
            troop.body.destroy();
        }

        const ind = Player.troops.indexOf(troop);
        if (ind !== -1) Player.troops.splice(ind, 1);

        troop.destroy();
    }
}
