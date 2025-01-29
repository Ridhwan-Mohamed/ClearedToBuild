import Phaser from "phaser";
import { TILE_TYPES } from "./constants";

export class Projectile {
    static scene;
    static projectileGroup;

    static init(scene) {
        this.scene = scene;
        this.projectileGroup = this.scene.physics.add.group();
    }

    constructor(x, y, angle, speed = 500) {
        // Offset the starting position by 25 units in the direction of the angle
        const offsetX = Math.cos(angle) * 25;
        const offsetY = Math.sin(angle) * 25;
        const startX = x + offsetX;
        const startY = y + offsetY;

        // Create a graphics object for the rectangle
        const newCube = Projectile.scene.physics.add.sprite(startX, startY, 'cube');
        Projectile.projectileGroup.add(newCube);

        // Enable physics for the graphics object
        newCube.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        newCube.setDepth(TILE_TYPES.turret.depth);
        newCube.body.dontTrack = true;
        // Add the projectile to the group
    }


    handleCollision(projectile, target) {
        console.log('Projectile hit:', target);
        projectile.destroy();
    }
}
