// === Brawler.js ===
import { BLOCKDEPTH, CONTROL_STATES, SQUARESIZE } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { weapons } from '../weapons.js';
import { NameGenerator } from './NameGenerator.js';
import { ZoomMixer } from '../UI/ZoomMixer.js';
import { VisibilitySystem } from '../UI/VisibilitySystem.js';

export class Brawler {

    static speed = 130; // fastest melee unit
    static stamina = 0.025;

    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'player'
        );

        sprite.setInteractive();
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.setSize(16, 12).setOffset(8, 20);
        sprite.setCollideWorldBounds(true);
        sprite.setTint(0xFFD712); // unique golden tint
        sprite.unitTint = 0xFFD712;

        sprite.id = Player.count++;
        sprite.body.team = teamNumber;
        sprite.health = 160; // cheap + fragile
        sprite.maxHealth = 160;
        sprite.stamina = 100;
        sprite.maxStamina = 100;
        sprite.body.pushable = false;
        sprite.name = NameGenerator.generate();
        sprite.type = Brawler;

        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';

        sprite.isBrawler = true;

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

        if (troop.task) { troop.task.assigned--; troop.task = null; }
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
