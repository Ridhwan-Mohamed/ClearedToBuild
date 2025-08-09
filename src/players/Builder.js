// === Builder.js ===

import { BLOCKDEPTH, CONTROL_STATES, SQUARESIZE } from '../constants.js';
import { Player } from './Player.js';
import { Teams } from '../Teams.js';
import { buildingManager } from '../Manager/buildingManager.js';
import { NameGenerator } from './NameGenerator.js';

export class Builder {
    constructor(x, y, teamNumber) {
        const sprite = Player.scene.physics.add.sprite(
            SQUARESIZE * x + SQUARESIZE / 2,
            SQUARESIZE * y + SQUARESIZE / 2,
            'player'
        );

        sprite.setInteractive();
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(BLOCKDEPTH + 1);
        sprite.setSize(16, 12).setOffset(8, 20);
        sprite.setCollideWorldBounds(true);
        sprite.setTint(0x4433ff); // PURPLE TINT
        sprite.unitTint = 0x4433ff;
        sprite.name = NameGenerator.generate();

        sprite.id = Player.count++;
        sprite.body.team = teamNumber;
        sprite.health = 100;
        sprite.speed = 80;
        sprite.body.pushable = false;

        sprite.animState = 'idle';
        sprite.walk = 'walk';
        sprite.idle = 'idle';
        sprite.action = 'action';
        sprite.carry = 'carry';

        sprite.isBuilder = true;

        // === Register with systems ===
        Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        Player.characters.add(sprite);
        Player.troops.push(sprite);
        Player.configureCubeInteractivity(sprite);
        Teams.addPlayer(teamNumber, sprite);
        Teams.teamLists[teamNumber].builderList.push(sprite);
        return sprite
    }

    static update(troop) {
        Player.updateTracking(troop);

        if (troop.task || troop.track) return;

        const team = Teams.teamLists[troop.body.team];

        if (team.destroyStates?.length) {
            buildingManager.assingTroopsToDestroy(troop.body.team);
        } else if (team.blockBuildingStates?.length) {
            buildingManager.assignTroopToBuildBlock(troop.body.team);
        } else if (team.buildingTileStates?.length) {
            buildingManager.assingTroopsToBuildTile(troop.body.team);
        } else if (!troop.task && !troop.track && troop.state === CONTROL_STATES.TRACK_MODE && !troop.roam) {
            Player.roam(troop);
        }
    }

    static destroy(troop) {
        const teamNumber = troop.body.team;
        const team = Teams.teamLists[teamNumber];

        Player.destroyPlayer(troop);

        if (team?.builderList) {
            const index = team.builderList.indexOf(troop);
            if (index !== -1) {
                team.builderList.splice(index, 1);
            }
        }

        troop.task = null;
        troop.carrying = [];
        troop.body.sprite?.destroy();
    }
}
