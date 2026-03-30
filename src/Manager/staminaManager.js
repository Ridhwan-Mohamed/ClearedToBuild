import { CONTROL_STATES, TILE_TYPES } from "../constants";
import { Teams } from "../Teams";
import { Player } from "../players/Player";
import { buildingManager } from "./buildingManager";

export class StaminaManager {
    static scene;
    static staminaIncreaseAmnt = 0.01

    static updateTroop(troop) {
        // If stamina is empty → go home
        if (troop.stamina <= 0 && troop.state == CONTROL_STATES.TRACK_MODE && troop.state !== CONTROL_STATES.GO_HOME_MODE) {
            this.sendTroopHome(troop);
        }
        // If sleeping → regen stamina
        if (troop.state === CONTROL_STATES.SLEEP_MODE) {
            troop.stamina = Math.min(troop.maxStamina, troop.stamina + this.staminaIncreaseAmnt); // regen rate
            if (troop.stamina >= troop.maxStamina) {
                this.wakeUp(troop);
            }
        }
    }

    static sendTroopHome(troop) {
        if (!troop.home) return;
        const { x, y } = troop.home;
        const approach = buildingManager.findBuildApproachBlock(x, y, TILE_TYPES.house1, troop);
        if (!approach) return;
        troop.task = true;
        troop.roam = false;
        const path = approach.path;
        if (path) {
            Player.moveTo(troop, path);
            Teams.movePlayerState(troop, CONTROL_STATES.GO_HOME_MODE);
        }
    }

    static arriveAtHome(troop) {
        troop.setVisible(false);
        troop.body.setEnable(false);
        Teams.movePlayerState(troop, CONTROL_STATES.SLEEP_MODE);

        if (troop.home && troop.icon) {
            const house = troop.home;
            const idx = house.occupants.indexOf(troop);

            // offsets for left/right positions
            const offsetX = idx === 0 ? -12 : 12;
            const offsetY = -20;

            troop.icon.setPosition(house.sprite.x + offsetX, house.sprite.y + offsetY);

            // stop following troop.x/troop.y
            troop.icon.followingHouse = true;
        }
    }


    static wakeUp(troop) {
        troop.task = null;
        troop.setVisible(true);
        troop.body.setEnable(true);
        Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);

        if (troop.icon) {
            troop.icon.followingHouse = false;
        }
    }

}
