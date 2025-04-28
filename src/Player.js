import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES, TILE_MAP } from "./constants";
import Phaser from "phaser";
import { Map } from "./map";
import { steer, avoid, calculateSeparationForce } from './steering';
import { tillManager } from "./tillManager";
import { Teams } from "./Teams";
import { buildingManager } from "./buildingManager";

export class Player {

    static scene;
    static troops = [];
    static characters;
    static selected = [];

    static init(scene){
        this.scene = scene;
        this.characters = this.scene.physics.add.group({});
        this.createAnim('walk','player',0,2);
        this.createAnim('idle','player',0,0);
    }
    
    static addPlayer(x,y,team,spriteSheet='player',walk='walk') {
        const newCube = Player.scene.physics.add.sprite(SQUARESIZE *x + SQUARESIZE/2, SQUARESIZE*y + SQUARESIZE/2, spriteSheet);
        newCube.setInteractive();
        newCube.setOrigin(0.5,0.5);
        newCube.setDepth(BLOCKDEPTH+1)
        newCube.currentPath = []
        newCube.health = 100;
        newCube.body.pushable = false;
        newCube.animState = 'idle'
        newCube.body.team = team;
        newCube.state = CONTROL_STATES.USER_MODE
        this.characters.add(newCube);
        this.troops.push(newCube);
        this.characters.add(newCube)
        this.configureCubeInteractivity(newCube);
        return newCube
    }

    static configureCubeInteractivity(cube){
        cube.selected = false; // Add a custom property to track selection state

        // Add a pointerdown event listener to toggle selection
        cube.on('pointerdown', (pointer) => {
            cube.selected = !cube.selected; // Toggle the selected state
            if (cube.selected) {
                cube.setTint(Phaser.Display.Color.GetColor(200, 49, 19)); // Change to alternate texture
                this.selected.length = 0;
                this.selected.push(cube);
            } else {
                cube.clearTint(); // Revert to original texture
                const index = this.selected.indexOf(cube);
                if (index > -1) {
                    this.selected.splice(index, 1);
                }
            }
        });
    
        // Add a pointerover event listener to change texture on hover
        cube.on('pointerover', (pointer) => {
            if (!cube.selected) {
                cube.setTint(Phaser.Display.Color.GetColor(200, 49, 19));
            }
        });
    
        // Add a pointerout event listener to revert texture when not hovered
        cube.on('pointerout', (pointer) => {
            if (!cube.selected) {
                cube.clearTint();
            }
        });
    }

    static moveTo(troop, path) {
        if (!path || path.length === 0) {
            console.log("No path found or path is empty.");
            return;
        }
        troop.currentPath = path
        troop.finalPos = path[path.length - 1]
        // Remove the starting point as it's the current position of the cube
        troop.currentPath.shift();
    }

    static followPath(sprite) {
        if (sprite.currentPath.length === 0) {
            this.setAnimState(sprite, 'idle')
            return;
        }
        this.setAnimState(sprite, 'walk')
        let nextPoint = sprite.currentPath[0]; // Get the next point in the path
        const desired = new Phaser.Math.Vector2(nextPoint.x - sprite.x, nextPoint.y - sprite.y).setLength(100);
    
        // Calculate new velocity
        let newVelocity = new Phaser.Math.Vector2(
            desired.x,
            desired.y
        );
    
        sprite.body.setVelocity(newVelocity.x, newVelocity.y);
    
        // Rotate the sprite to face the direction of movement
        if (newVelocity.length() > 0) {
            sprite.rotation = Phaser.Math.Angle.Between(0, 0, newVelocity.x, newVelocity.y); // Calculate angle
        }
        
        if (sprite.state == CONTROL_STATES.TRACK_MODE && Phaser.Math.Distance.Between(sprite.x, sprite.y, sprite.track[0].transform.x, sprite.track[0].transform.y) < 30) {
            sprite.body.setVelocity(0, 0);
            sprite.currentPath.length = 0;
            // sprite.state = CONTROL_STATES.ATTACK_MODE
        }
        else if(sprite.state == CONTROL_STATES.BUILD_MODE && Phaser.Math.Distance.Between(sprite.x, sprite.y, sprite.finalPos.x, sprite.finalPos.y) < 50){
            sprite.body.setVelocity(0, 0);
            this.doAction(sprite)
        }
        else if (Phaser.Math.Distance.Between(sprite.x, sprite.y, nextPoint.x, nextPoint.y) < 15) {
            sprite.currentPath.shift(); // Remove the reached point from the path
            if (sprite.currentPath.length == 0) {
                sprite.body.setVelocity(0, 0);
                this.doAction(sprite)
            }
        }
    }

    static doAction(sprite){
        if(sprite.state == CONTROL_STATES.FARM_MODE){
            tillManager.beginTilling(sprite.finalPos.x,sprite.finalPos.y, sprite);
        }
        else if(sprite.state == CONTROL_STATES.HARVEST_MODE){
            tillManager.harvestCrop(sprite.finalPos.x,sprite.finalPos.y)
            tillManager.getNextCropFor(sprite);
        }
        else if(sprite.state == CONTROL_STATES.BUILD_MODE){
            buildingManager.beginBuilding(sprite.finalPos.x,sprite.finalPos.y,sprite.buildType)
            buildingManager.assignTroopToBuild(sprite)
        }
    }

    static mostThreatening(troop, neighbours) {
        let mostThreat = null;
        let shortestDistance = Infinity;

        // Troop position and velocity
        const troopPosition = new Phaser.Math.Vector2(troop.x, troop.y);
        const troopVelocity = new Phaser.Math.Vector2(troop.body.velocity.x, troop.body.velocity.y);

        neighbours.forEach(neighbour => {
            if (neighbour === troop.body || neighbour.dontTrack) return; // Ignore itself
    
            // Neighbor position
            const neighbourPosition = new Phaser.Math.Vector2(neighbour.x, neighbour.y);
    
            // Vector from troop to neighbor
            const toNeighbour = new Phaser.Math.Vector2(
                neighbourPosition.x - troopPosition.x,
                neighbourPosition.y - troopPosition.y
            );
    
            // Check if neighbor is on the trajectory
            const projectedLength = toNeighbour.dot(troopVelocity) / troopVelocity.lengthSq();
    
            if (projectedLength >= 0) {
                // Calculate the closest point on the line
                const closestPoint = new Phaser.Math.Vector2(
                    troopPosition.x + projectedLength * troopVelocity.x,
                    troopPosition.y + projectedLength * troopVelocity.y
                );
    
                // Check the perpendicular distance from the neighbor to the line
                const perpendicularDistance = Phaser.Math.Distance.BetweenPoints(neighbourPosition, closestPoint);
    
                // Threshold for "collision" (adjust this based on hitbox size)
                const collisionThreshold = troop.displayWidth / 2;
    
                if (perpendicularDistance <= collisionThreshold) {
                    // Calculate straight-line distance to neighbor
                    const distance = Phaser.Math.Distance.Between(
                        troopPosition.x, troopPosition.y,
                        neighbourPosition.x, neighbourPosition.y
                    );
                        
                    // Update most threatening if closer
                    if (distance < shortestDistance) {
                        shortestDistance = distance;
                        mostThreat = neighbour;
                    }
                }
            }
        });
    
        return mostThreat;
    }

    static mostClosestEnemy(troop, neighbours) {
        let mostClosest = null;
        let shortestDistance = Infinity;
    
        // Troop position
        const troopPosition = new Phaser.Math.Vector2(troop.x, troop.y);
    
        neighbours.forEach(neighbour => {
            if (neighbour === troop.body || neighbour.team == troop.body.team || neighbour.dontTrack) return; // Ignore itself or untrackable neighbors
    
            // Neighbor position
            const neighbourPosition = new Phaser.Math.Vector2(neighbour.x, neighbour.y);
    
            // Calculate straight-line distance to the neighbor
            const distance = Phaser.Math.Distance.BetweenPoints(troopPosition, neighbourPosition);
    
            // Update most closest if this neighbor is closer
            if (distance < shortestDistance) {
                shortestDistance = distance;
                mostClosest = neighbour;
            }
        });
        
        if(troop.track && troop.track[0] == mostClosest){
            if(Math.abs(troop.track[1].x - mostClosest.transform.x) > 20 || Math.abs(troop.track[1].y - mostClosest.transform.y) > 20){
                troop.track[1].x = mostClosest.transform.x
                troop.track[1].y = mostClosest.transform.y
                return true;
            }
            return false;
        }
        else if(mostClosest){
            troop.track = [null,null]
            troop.track[0] = mostClosest
            troop.track[1] = {x: mostClosest.transform.x, y: mostClosest.transform.y}
            return true;
        }
        return false;
    }
    

    static handleCollision(player, bullet){
        if(bullet.team != player.body.team){
            player.health -= 50;
            bullet.destroy();
            if(player.health <= 0){
                player.destroy();
            }
        }
    }

    static createAnim(key, image, start, end){
        this.scene.anims.create({
            key: key,
            frames: this.scene.anims.generateFrameNumbers(image, { start: start, end: end }),
            frameRate: 3,
            repeat: -1
        });
    }

    static setAnimState(troop, state){
        if(troop.animState != state){
            troop.animState = state
            troop.play(state)
        }
    }

    static handlePlayerSelect(){
        if (this.scene.startCell) {
            const minX = Math.min(this.scene.startCell.x, this.scene.endCell.x)*SQUARESIZE;
            const maxX = Math.max(this.scene.startCell.x, this.scene.endCell.x)*SQUARESIZE;
            const minY = Math.min(this.scene.startCell.y, this.scene.endCell.y)*SQUARESIZE;
            const maxY = Math.max(this.scene.startCell.y, this.scene.endCell.y)*SQUARESIZE;
            const selectionRect = new Phaser.Geom.Rectangle(minX, minY, maxX-minX, maxY-minY);

            // Clear the selection box
            this.selected = [];

            this.troops.forEach(troop => {
                if (Phaser.Geom.Rectangle.Contains(selectionRect, troop.x, troop.y)) {
                    this.selected.push(troop);
                    troop.setTint(0xff0000); // Highlight selected troops
                } else {
                    troop.clearTint(); // Clear highlight from non-selected troops
                }
            });

        }
    }

    static getFormation(centerX, centerY, troopCount) {
        const visited = new Set();
        const queue = [[centerX, centerY]];
        const positions = [];

        const isValid = (x, y) => {
            if (x < 0 || y < 0 || y >= Map.grid.length || x >= Map.grid[0].length) return false;
            const tile = Map.grid[y][x];
            if (Array.isArray(tile)) return false;
            const tileType = TILE_TYPES[TILE_MAP(tile)];
            return tileType && !tileType.block;
        };

        while (queue.length && positions.length < troopCount) {
            const [x, y] = queue.shift();
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (isValid(x, y)) {
                positions.push([
                    x * SQUARESIZE + SQUARESIZE / 2,
                    y * SQUARESIZE + SQUARESIZE / 2
                ]);

                // 🔍 Debug Cube
                // const debugCube = Player.scene.add.rectangle(
                //     x * SQUARESIZE + SQUARESIZE / 2,
                //     y * SQUARESIZE + SQUARESIZE / 2,
                //     SQUARESIZE,
                //     SQUARESIZE,
                //     0xffff00,
                //     0.25
                // );
                // debugCube.setDepth(1000);


                // Enqueue all cardinal directions (can also add diagonals if needed)
                queue.push([x + 1, y]);
                queue.push([x - 1, y]);
                queue.push([x, y + 1]);
                queue.push([x, y - 1]);
            }
        }
        return positions;
    }


    static handlePlayerCollision(player1, player2){
        if (player1 === player2) return; // Prevent self overlap
        if(player1.finalPos?.x == player2.finalPos?.x && player1.finalPos?.y == player2.finalPos?.y){
            if(player1.body.velocity.x == 0 && player1.body.velocity.y == 0 && player2.currentPath.length && !player1.currentPath.length){
                let newVelocity = new Phaser.Math.Vector2(
                    0,
                    0
                );
                player2.body.setVelocity(newVelocity.x, newVelocity.y)
                player2.currentPath.length = 0;
            }
            else if(player2.body.velocity.x == 0 && player2.body.velocity.y == 0 && player1.currentPath.length && !player2.currentPath.length){
                let newVelocity = new Phaser.Math.Vector2(
                    0,
                    0
                );
                player1.body.setVelocity(newVelocity.x, newVelocity.y)
                player1.currentPath.length = 0;
            }
        }
    }

    static drawPlayers(playerDict) {
        for (const key in playerDict) {
            const [x, y] = key.split(',').map(Number);  
            Teams.teamLists[`${playerDict[key]}`].playerList.push(this.addPlayer(x,y,playerDict[key]))
            delete playerDict[key];
        }
    }

    static update(){
        this.troops.forEach((troop, index) => {
            if(!troop.active){this.troops.splice(index, 1); return}
            const inView = Map.cameraBounds.contains(troop.x, troop.y);
            troop.setVisible(inView); // Will not draw if false
            let neighbours = Player.scene.physics.overlapCirc(troop.x, troop.y, 100)
            let reTrack = this.mostClosestEnemy(troop, neighbours)
            if(troop.state == CONTROL_STATES.TRACK_MODE && reTrack){
                Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: troop.track[1].x, y: troop.track[1].y }));
            }
            this.followPath(troop)
        })
    }
}