import { House } from "../buildings/House";
import { Builder } from "../players/Builder";
import { Farmer } from "../players/Farmer";
import { Fireman } from "../players/Fireman";
import { Forager } from "../players/Forager";
import { Teams } from "../Teams";
import { townRoads } from "../town";

export class GameStart {
    static placePlayers() {
        const playerArray = [];
        const teamNumber = 1;    // ✅ ALWAYS team 1 is the player
        const roads = townRoads[`${teamNumber}`];
        if (!roads || roads.length < 4) {
            console.warn("Not enough roads to spawn players.");
            return;
        }
        const roadSpawns = Phaser.Utils.Array.Shuffle(roads).slice(0, 4);
        playerArray.push(new Farmer(roadSpawns[0][0], roadSpawns[0][1], teamNumber));
        playerArray.push(new Forager(roadSpawns[1][0], roadSpawns[1][1], teamNumber));
        playerArray.push(new Fireman(roadSpawns[2][0], roadSpawns[2][1], teamNumber));
        playerArray.push(new Builder(roadSpawns[3][0], roadSpawns[3][1], teamNumber));
        playerArray.forEach(player => House.assignPlayerToHouse(player, teamNumber));
    }
}
