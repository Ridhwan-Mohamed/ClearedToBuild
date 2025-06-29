import Phaser from "phaser";
import { CONTROL_STATES, SQUARESIZE, TILE_MAP, TILE_TYPES } from "./constants";
import { Map } from "./map";
import { weapons } from "./weapons";
import { fightManager } from "./fightManager";
import { Player } from "./Player";
import { Teams } from "./Teams";

export class Projectile {
    static scene;
    static projectileGroup;

    static init(scene) {
        this.scene = scene;
        this.projectileGroup = this.scene.physics.add.group();
    }

    constructor(x, y, angle, teamNumber, weapon, player = null, offset = false) {
        // Offset the starting position by 25 units in the direction of the angle
        const speed = weapon.speed;
        let offsetX = 5, offsetY = 5;
        if(offset){
            offsetX = Math.cos(angle) * 25;
            offsetY = Math.sin(angle) * 25;
        }
        const startX = x + offsetX;
        const startY = y + offsetY;

        // Create a graphics object for the rectangle
        const newCube = Projectile.scene.physics.add.sprite(startX, startY, 'cube');
        Projectile.projectileGroup.add(newCube);
        newCube.body.dontTrack = true;

        // Enable physics for the graphics object
        newCube.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        newCube.team = teamNumber;
        newCube.setDepth(TILE_TYPES.turret.depth);
        newCube.body.dontTrack = true;

        newCube.weapon = weapon;
        if(player) newCube.player = player;
    }

    static leadAndAngle(attacker, target, projectileSpeed) {
        if (!target.body) return { x: target.x, y: target.y };

        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const time = distance / projectileSpeed;

        return {
            x: target.x + target.body.velocity.x * time,
            y: target.y + target.body.velocity.y * time
        };
    }

    static hasLineOfSight(shooter, target) {
        const x0 = Math.floor(shooter.x / SQUARESIZE);
        const y0 = Math.floor(shooter.y / SQUARESIZE);
        const x1 = Math.floor(target.x / SQUARESIZE);
        const y1 = Math.floor(target.y / SQUARESIZE);

        const points = Phaser.Geom.Line.BresenhamPoints(new Phaser.Geom.Line(x0, y0, x1, y1));

        for (const point of points) {
            const cell = Map.grid[point.y]?.[point.x];
            if (Array.isArray(cell) && TILE_TYPES[TILE_MAP(cell[1])].block) return false; // It's blocked by building or structure
        }

        return true; // clear shot
    }


    static handleCollision(target, projectile) {
        const result = fightManager.calculateHitResultFromWeapon(projectile.weapon);
        if (result.hit) {
            target.health = Math.max(0, target.health - result.damage);
            if(target.health <= 0){
                fightManager.checkForKillReward(projectile.team, target);
                Player.destroyPlayer(target);
                Teams.movePlayerState(projectile.player, CONTROL_STATES.TRACK_MODE)
                Teams.removeFromStateArray(1, "fightingList", target);
                projectile.player.track = null;
                Player.handleStateIntteruptComplete(projectile.player);
                projectile.player.timer.remove(false);
                projectile.player.timer = null;
                Player.setAnimState(projectile.player, projectile.player.idle);
            }
            fightManager.showGhostText(
                Projectile.scene,
                target.x,
                target.y - 10,
                `${result.isCrit ? 'CRIT ' : ''}${result.damage}`,
                projectile.team, // ✅ shooter team
                result.isCrit           // ✅ crit flag
            );
        } else {
            fightManager.showGhostText(
                Projectile.scene,
                target.x,
                target.y - 10,
                'MISS',
                projectile.team, // ✅ still shooter
                false,
                true                  // ✅ miss flag
            );
        }

        projectile.destroy();
    }
}
