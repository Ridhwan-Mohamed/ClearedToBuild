// === Gunslinger.js ===

import { BLOCKDEPTH, CONTROL_STATES, SQUARESIZE } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { weapons } from '../weapons.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';

export class Gunslinger {
    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'gun1'
        );

        sprite.setInteractive();
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.setSize(16, 12).setOffset(8, 20);
        sprite.setCollideWorldBounds(true);
        sprite.setTint(0x9999ff); // bluish tint
        sprite.unitTint = 0x9999ff;

        sprite.id = Player.count++;
        sprite.body.team = teamNumber;
        sprite.health = 200;
        sprite.speed = 100;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.baseSpeed = sprite.speed;
        sprite.body.pushable = false;
        sprite.name = NameGenerator.generate();

        sprite.animState = 'gun1Idle';
        sprite.walk = 'gun1Walk';
        sprite.idle = 'gun1Idle';
        sprite.action = 'action';

        sprite.isGunslinger = true;

        // === Equip pistol ===
        const pistol = weapons.pistol;
        sprite.weapon = pistol;

        // === Register with systems ===
        ZoomMixer.createPlayerMoniker(sprite);
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].fighterList.push(sprite);
        sprite.destroySelf = () => Gunslinger.destroy(sprite);

        return sprite;
    }

    static update(troop) {
        Player.updateTracking(troop);

        if(troop.task || troop.track) {return;}
        else if(!troop.task && !troop.track && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam){
            Player.roam(troop);
        }
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];

        if (team?.fighterList) {
            const index = team.fighterList.indexOf(troop);
            if (index !== -1) {
                team.fighterList.splice(index, 1);
            }
        }

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        // Clear references
        if (troop.task) {troop.task.assigned--; troop.task = null;}
        if (troop.carrying) troop.carrying = null;
    }
}
