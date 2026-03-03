import { CONTROL_STATES, SQUARESIZE } from "../constants";
import Phaser from "phaser";
import { Player } from "./Player";
import { Teams } from "../Teams";
import { weapons } from "../weapons";

export class FortGrunt {
    static speed = 130;      // near brawler speed
    static stamina = 0.025;  // near brawler stamina drain
    static awareness = 100;  // tracking radius in Player.updateTracking
    static maxHealth = 130;  // tougher than raider(100)
    static tint = 0x8b0000;  // darker red than default enemy tint

    constructor(x, y, teamNumber = 0) {
        const grunt = Player.addPlayer(
            x,
            y,
            teamNumber,
            "player",
            "walk",
            "idle",
            "action",
            weapons.boxingGloves
        );

        grunt.type = FortGrunt;
        grunt.isFortGrunt = true;
        grunt.isRaider = false;
        grunt.roam = false;
        grunt.maxHealth = FortGrunt.maxHealth;
        grunt.health = FortGrunt.maxHealth;
        grunt.killReward = 50;
        grunt.weapon = weapons.boxingGloves;
        grunt.setTint(FortGrunt.tint);
        grunt.unitTint = FortGrunt.tint;
        grunt.awareness = FortGrunt.awareness;
        grunt.destroySelf = () => FortGrunt.destroy(grunt);

        return grunt;
    }

    static _isInsideFort(troop) {
        const b = troop?.fortBounds;
        if (!b) return false;
        const gx = Math.floor(troop.x / SQUARESIZE);
        const gy = Math.floor(troop.y / SQUARESIZE);
        return gx >= b.minx && gx <= b.maxx && gy >= b.miny && gy <= b.maxy;
    }

    static _targetInsideFort(troop) {
        const b = troop?.fortBounds;
        const body = troop?.track?.[0];
        const target = body?.gameObject;
        if (!b || !target?.active) return false;
        const gx = Math.floor(target.x / SQUARESIZE);
        const gy = Math.floor(target.y / SQUARESIZE);
        return gx >= b.minx && gx <= b.maxx && gy >= b.miny && gy <= b.maxy;
    }

    static _roamFortRoads(troop) {
        const roads = troop?.fortRoads;
        if (!Array.isArray(roads) || roads.length === 0) return;
        if (troop.currentPath?.length) return;
        if (troop.track?.[0]) return;

        const [gx, gy] = Phaser.Utils.Array.GetRandom(roads);
        const path = Player.pathTo(troop, gx, gy, true);
        if (path?.length) {
            // Reuse Player.followPath roam-cooldown behavior (same as team 1 roam pacing).
            troop.roam = true;
            Player.moveTo(troop, path);
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        }
    }

    static _returnToFort(troop) {
        if (troop.currentPath?.length) return;
        Teams.sendTroopToRoadPool(troop, troop?.fortRoads, CONTROL_STATES.BACK_TO_TOWN);
    }

    static update(troop) {
        Player.updateTracking(troop);

        // Never chase targets outside fort bounds.
        if (troop.track?.[0] && !FortGrunt._targetInsideFort(troop)) {
            troop.track = null;
            if (troop.currentPath) troop.currentPath.length = 0;
            troop.body?.setVelocity?.(0, 0);
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        }

        // If not actively pursuing, force return when outside fort.
        const pursuing = !!troop.track?.[0];
        if (!pursuing && !FortGrunt._isInsideFort(troop)) {
            FortGrunt._returnToFort(troop);
            return;
        }

        // Idle patrol on fort roads.
        if (!troop.task && !pursuing && troop.state === CONTROL_STATES.TRACK_MODE && !troop.roam) {
            FortGrunt._roamFortRoads(troop);
        }
    }

    static destroy(troop) {
        if (!troop || !troop.body) return;
        const scene = troop.scene;

        Player._destroyMiniBars(troop);

        const team = Teams.teamLists["0"];
        if (team) {
            if (team.fighterList) {
                const fidx = team.fighterList.indexOf(troop);
                if (fidx !== -1) team.fighterList.splice(fidx, 1);
            }
            const pidx = team.playerList.indexOf(troop);
            if (pidx !== -1) team.playerList.splice(pidx, 1);
        }

        if (troop.timer) {
            troop.timer.remove(false);
            troop.timer = null;
        }

        if (troop.task) {
            if (typeof troop.task.assigned === "number") troop.task.assigned--;
            troop.task = null;
        }

        troop.track = null;
        troop.forcedTarget = null;

        if (troop.body) {
            try { scene.physics.world.remove(troop.body); } catch {}
            try { troop.body.destroy(); } catch {}
        }

        const idx = Player.troops.indexOf(troop);
        if (idx !== -1) Player.troops.splice(idx, 1);

        Player.characters.remove(troop);
        troop.destroy();
    }
}
