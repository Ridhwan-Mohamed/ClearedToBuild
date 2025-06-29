import { buildingManager } from "./buildingManager";
import { CONTROL_STATES } from "./constants";
import { Manager } from "./Manager/Manager";
import { Player } from "./Player";
import { Teams } from "./Teams";
import { buildingArray, spawnPoints } from "./town";
import { Map } from "./map";

export function recalculateDestroyTasksFromPoint(x = null, y = null, teamNumber = '0') {
    const targetsAdded = new Set();

    const pointsToCheck = (x !== null && y !== null) ? [[x, y]] : spawnPoints;

    for (const [px, py] of pointsToCheck) {
        const playerMock = { x: px, y: py };

        for (let [bx, by, type, building] of buildingArray) {
            const key = `${bx},${by}`;

            const alreadyInState = Teams.teamLists[teamNumber].destroyStates.some(
                t => t.x === bx && t.y === by
            );

            if (alreadyInState || targetsAdded.has(key)) continue;

            const pathData = buildingManager.findBuildApproachBlock(bx, by, type, playerMock);
            if (pathData) {
                const task = {
                    type,
                    value: building,
                    x: bx,
                    y: by,
                    duration: 100,
                    assigned: 0
                };
                Teams.addToStateArrayIfNotExists(teamNumber, 'destroyStates', task);
                targetsAdded.add(key);
            }
        }
    }
}

export function spawnAndSend() {
    const [x, y] = Phaser.Utils.Array.GetRandom(spawnPoints);
    const player = Player.addPlayer(x, y, 0);

    Manager.assignOneTroopToAction(
        player,
        Teams.teamLists['0'].destroyStates,
        CONTROL_STATES.DESTROY_MODE
    );
}
