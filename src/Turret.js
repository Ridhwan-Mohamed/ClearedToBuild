import { SQUARESIZE, TILE_TYPES, TILE_MAP, handleGridXY, WORLD_DIMENSION } from "./constants";
import { Map } from "./map";
import { Projectile } from "./Projectile";
import Phaser from "phaser";

export class Turret{

    static baseItem = null; // The current item being placed
    static topItem = null;
    static isPlacing = false; // Flag to indicate placement mode
    static scene;
    static guns = [];

    static placeItem(item){
        this.baseItem = this.scene.add.sprite(0, 0, item.value[0])
            .setAlpha(0.5) // Make it semi-transparent
            .setDepth(item.depth) 
            .setInteractive()
        this.baseItem.blocked = false;
        this.topItem = this.scene.add.sprite(0, 0, item.value[1])
            .setAlpha(0.5) // Make it semi-transparent
            .setDepth(item.depth+1) // Ensure it's above base
            .setInteractive()
        // Enable mouse-following behavior
        this.isPlacing = true;
        this.scene.input.on('pointermove', (pointer) => {
            if (this.baseItem && this.isPlacing && pointer.x>0 && pointer.x<SQUARESIZE*WORLD_DIMENSION && pointer.y>0 && pointer.y<SQUARESIZE*WORLD_DIMENSION) {
                let [x,y] = handleGridXY(pointer.x,pointer.y,item.lenX,item.lenY)
                this.baseItem.setPosition(x, y);
                this.topItem.setPosition(x, y);
                let col = Map.checkBlockPosition(Math.floor((x-item.lenX/2*SQUARESIZE)/SQUARESIZE),Math.floor((y-item.lenY/2*SQUARESIZE)/SQUARESIZE),item.lenX, item.lenY,1)
                this.topItem.setTint(col)
                this.baseItem.setTint(col)
            }
        });
    }

    static checkBlockPosition(posX, posY, lenX, lenY){
        for (let y = posY; y < posY + lenY + 1; y++) {
            for (let x = posX; x < posX + lenX + 1; x++) {
                if(TILE_TYPES[TILE_MAP(Map.grid[y][x])]?.block){
                    this.topItem.blocked = true;
                    return Phaser.Display.Color.GetColor(200, 49, 19);
                }
            }
        }
        this.topItem.blocked = false;
        return Phaser.Display.Color.GetColor(14, 209, 69);
    }

    static handleMapClick(pointer, item) {
        // If we're in placing mode, finalize the placement
        if (this.isPlacing && this.topItem && !this.topItem.blocked) {
            // this.setPlaceAndInteractive(this.topItem, pointer, item)
            this.baseItem.setAlpha(1);
            this.baseItem.clearTint();
            this.setPlaceAndInteractive(this.topItem, pointer, item)
            this.guns.push(this.topItem)
            this.topItem.delta = 1
        }
    }

    static setPlaceAndInteractive(image, pointer, item){
        let [x,y] = handleGridXY(pointer.x,pointer.y,item.lenX,item.lenY)
        image.clearTint()
        image.setAlpha(1); // Set full visibility
        this.isPlacing = false;
        Map.addBlockItem(Math.floor((x-item.lenX/2*SQUARESIZE)/SQUARESIZE),Math.floor((y-item.lenY/2*SQUARESIZE)/SQUARESIZE),item)
        const itemToPlace = image;
        const bottom = this.baseItem
        itemToPlace.setInteractive();
        itemToPlace.sx = Math.floor(x/SQUARESIZE)
        itemToPlace.sy = Math.floor(y/SQUARESIZE)
        itemToPlace.lenX = item.lenX
        itemToPlace.lenY = item.lenY
        itemToPlace.on('pointerover', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                itemToPlace.setTint(0xaaaaaa); // Darken slightly on hover
            }
        });
        itemToPlace.on('pointerout', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                itemToPlace.clearTint(); // Restore original color
            }
        });
        itemToPlace.on('pointerdown', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                console.log('Destroying item...');
                itemToPlace.destroy(); // Destroy the specific item
                bottom.destroy()
                // this.removeTile(itemToPlace.sx, itemToPlace.sy, itemToPlace.lenX, itemToPlace.lenY)
            }
        });
    }

    static update(){
        this.guns.forEach((gun, index) => {
            if(!gun.active){this.guns.splice(index, 1); return}
            let neighbours = this.scene.physics.overlapCirc(gun.x, gun.y, 500, true, false)
            let nearest = null;
            let shortestDistance = Infinity;

            neighbours.forEach(neighbour => {
                if (neighbour.dontTrack == true) return; // Ignore itself
                const distance = Phaser.Math.Distance.Between(gun.x, gun.y, neighbour.x, neighbour.y);
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearest = neighbour;
                }
            });

            // If a nearest neighbor exists, calculate the angle and rotate the gun
            if (nearest) {
                const targetAngle = Phaser.Math.Angle.Between(gun.x, gun.y, nearest.x, nearest.y);

                // Smoothly rotate the gun towards the target angle
                const rotationSpeed = 0.1; // Adjust speed (lower is slower)
                gun.rotation = Phaser.Math.Angle.RotateTo(gun.rotation, targetAngle, rotationSpeed);

                const rotationTolerance = 0.01; // Allowable difference to consider as "complete"

                // Check if the gun is rotated toward the target and not on cooldown
                if (Phaser.Math.Within(gun.rotation, targetAngle, rotationTolerance)) {
                    if (!gun.cooldown || gun.cooldown <= 0) {
                        new Projectile(gun.x, gun.y, gun.rotation);
                        gun.cooldown = 100; // Cooldown time in milliseconds

                        // Calculate recoil offset
                        const recoilDistance = 10; // Adjust the distance of recoil
                        const offsetX = Math.cos(gun.rotation) * -recoilDistance; // Negative for opposite direction
                        const offsetY = Math.sin(gun.rotation) * -recoilDistance;

                        // Use a tween to move the gun backward
                        this.scene.tweens.add({
                            targets: gun,
                            x: gun.x + offsetX,
                            y: gun.y + offsetY,
                            duration: 250, // Time for the recoil animation
                            yoyo: true, // Bring the gun back to its original position
                            ease: 'Cubic.easeOut',
                        });
                    }
                }
            }

            // Reduce the cooldown timer
            if (gun.cooldown > 0) {
                gun.cooldown -= gun.delta; // Reduce cooldown based on delta time
            }
            
        });
    }


}