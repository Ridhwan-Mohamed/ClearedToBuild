import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES, TILE_MAP, WORLD_DIMENSIONX, WORLD_DIMENSIONY, showAlert, UIDEPTH, clearTaskPlusTimer } from "./constants";
import Phaser from "phaser";
import { Map } from "./map";
import { steer, avoid, calculateSeparationForce } from './steering';
import { tillManager } from "./tillManager";
import { Teams } from "./Teams";
import { buildingManager } from "./buildingManager";
import { weapons } from "./weapons";
import { fightManager } from "./fightManager";
import { seedManager } from "./seedManager";
import { Manager } from "./Manager/Manager";

export class Player {

    static scene;
    static count = 0;
    static troops = [];
    static characters;
    static selected = [];
    static detailsContainer = null;
    static detailsLvlText = null;
    static detailsHealthText = null;
    static detailsWeaponText = null;
    static curPlayerDetails = null;
    static detailsPortrait = null; 

    static init(scene){
        this.scene = scene;
        this.characters = this.scene.physics.add.group({});
        this.createAnim('walk','player',0,2);
        this.createAnim('idle','player',0,0);
        this.createAnim('action','playerAction',0,2,-1,10);
    }
    
    static addPlayer(x,y,team,spriteSheet='player',walk='walk') {
        const newCube = Player.scene.physics.add.sprite(SQUARESIZE *x + SQUARESIZE/2, SQUARESIZE*y + SQUARESIZE/2, spriteSheet);
        newCube.setInteractive();
        newCube.id = this.count;
        this.count += 1;
        newCube.setOrigin(0.5,0.5);
        newCube.setDepth(BLOCKDEPTH+1)
        newCube.roam = false;
        newCube.currentPath = []
        newCube.body.team = team;
        team == 1? newCube.health = 200 : newCube.health = 100;
        this.applyDefaultTint(newCube)
        newCube.body.pushable = false;
        newCube.animState = 'idle'
        newCube.oldState = null;
        Teams.movePlayerState(newCube, CONTROL_STATES.TRACK_MODE)
        newCube.weapon = weapons.hands
        this.characters.add(newCube);
        this.troops.push(newCube);
        this.characters.add(newCube);
        this.configureCubeInteractivity(newCube);
        return newCube;
    }

    static destroyPlayer(player) {
        if(!player || !player.body) return;
        const teamNum = player.body.team;
        const team = Teams.teamLists[`${teamNum}`];
        if (!team) return;
    
        // Remove from the team's playerList
        let idx = team.playerList.indexOf(player);
        if (idx !== -1) {
            team.playerList.splice(idx, 1);
            if(team.playerList.length == 0 && teamNum){
                showAlert(Player.scene, `Team ${teamNum} has been destroyed`, "#ff0000", 3000);
            }
        }
        idx = this.troops.indexOf(player);
        if (idx !== -1) {
            this.troops.splice(idx, 1);
        }
        if(player.task){
            player.task.assigned -= 1;
            player.task = null;
        }
    
        // Finally destroy the Phaser sprite
        player.destroy();
    }    

    static configureCubeInteractivity(cube){
        cube.selected = false; // Add a custom property to track selection state

        // Add a pointerdown event listener to toggle selection
        cube.on('pointerdown', (pointer) => {
            if(Player.scene.berryMode){
                if(!Player.scene.checkSufficientBerries(1)) return;
                Player.scene.updateBerry(-1);
                cube.health += 30;
                this.updateDetailsTab(cube);
                return;
            }
            cube.selected = !cube.selected; // Toggle the selected state
            if (cube.selected) {
                cube.setTint(Phaser.Display.Color.GetColor(50, 50, 50)); // Change to alternate texture
                this.selected.length = 0;
                this.selected.push(cube);
            } else {
                Player.applyDefaultTint(cube);                // Revert to original texture
                const index = this.selected.indexOf(cube);
                if (index > -1) {
                    this.selected.splice(index, 1);
                }
            }
            Player.showDetailsTab(cube);
        });
    
        // Add a pointerover event listener to change texture on hover
        cube.on('pointerover', (pointer) => {
            if (!cube.selected) {
                cube.setTint(Phaser.Display.Color.GetColor(50, 50, 50));
            }
        });
    
        // Add a pointerout event listener to revert texture when not hovered
        cube.on('pointerout', (pointer) => {
            if (!cube.selected) {
                Player.applyDefaultTint(cube);
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

    static findBestStartPos(sprite, sx, sy) {
        // 🧱 3. Search surrounding 8 tiles (including diagonals)
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
    
        for (let [dx, dy] of directions) {
            const nx = sx + dx;
            const ny = sy + dy;
    
            // Skip out-of-bounds
            if (ny < 0 || ny >= Map.navGrid.length || nx < 0 || nx >= Map.navGrid[0].length) {
                continue;
            }
    
            // Check if tile is walkable
            if (Map.navGrid[ny][nx] === 1) {
                // Convert to pixel position
                const px = nx * SQUARESIZE + SQUARESIZE / 2;
                const py = ny * SQUARESIZE + SQUARESIZE / 2;
    
                // Check distance to center of tile
                const dist = Phaser.Math.Distance.Between(sprite.body.x, sprite.body.y, px, py);
                if (dist <= 23) {
                    return [nx, ny];
                }
            }
        }
    
        // 🚫 4. No valid nearby tile
        return [-1, -1];
    }

    static followPath(sprite) {
        if (sprite.currentPath.length === 0) {
            this.setAnimState(sprite, 'idle');
            return;
        }
        if(sprite.state == CONTROL_STATES.BACK_TO_TOWN && !Teams.farFromCenter(sprite)){
            this.setAnimState(sprite, 'idle');
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
            sprite.currentPath = null;
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
        if(sprite.state == CONTROL_STATES.DESTROY_MODE){
            let val = Phaser.Math.Distance.Between(sprite.x, sprite.y, nextPoint.x, nextPoint.y);
            console.log(`sprite: ${sprite.id} this far away: ${val}, currentPath.length: ${sprite.currentPath.length}`)
        }
        //hack fix belowLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL-fds09as
        if (sprite.state == CONTROL_STATES.TRACK_MODE && !sprite.roam && sprite.track && sprite.track[0].gameObject && Phaser.Math.Distance.Between(sprite.x, sprite.y, sprite.track[0].gameObject.x, sprite.track[0].gameObject.y) < sprite.weapon.range) {
            sprite.body.setVelocity(0, 0);
            sprite.currentPath.length = 0;
            Teams.movePlayerState(sprite, CONTROL_STATES.ATTACK_MODE)
            this.doAction(sprite)
        }
        else if (Phaser.Math.Distance.Between(sprite.x, sprite.y, nextPoint.x, nextPoint.y) < 3) {
            sprite.currentPath.shift(); // Remove the reached point from the path
            if (sprite.currentPath.length == 0) {
                if(sprite.roam && !sprite.task){
                    // schedule roam flag reset after 2–4s
                    const roamDuration = Phaser.Math.Between(1000, 1500);
                    sprite.scene.time.delayedCall(roamDuration, () => {
                        sprite.roam = false;
                    });
                }
                sprite.body.setVelocity(0, 0);
                this.doAction(sprite)
            }
        }
    }

    static doAction(sprite){
        if(sprite.state == CONTROL_STATES.FARM_MODE){
            tillManager.beginTilling(sprite);
        }
        else if(sprite.state == CONTROL_STATES.ATTACK_MODE){
            fightManager.attack(sprite)
        }
        else if(sprite.state == CONTROL_STATES.HARVEST_MODE){
            tillManager.harvestCrop(sprite)
        }
        else if(sprite.state == CONTROL_STATES.BUILD_MODE_T){
            buildingManager.beginBuilding(sprite) //test, moved assign one
        }
        else if(sprite.state == CONTROL_STATES.BUILD_MODE_B){
            buildingManager.beginBuildingBlock(sprite)
        }
        else if(sprite.state == CONTROL_STATES.DESTROY_MODE){
            buildingManager.beginDestroyingBlock(sprite)
        }
        else if(sprite.state == CONTROL_STATES.SEED_MODE){
            seedManager.beginSeeding(sprite);
        }
        else if(sprite.state == CONTROL_STATES.R_FARM_MODE){
            tillManager.harvestCrop(sprite)
        }
        else if(sprite.state == CONTROL_STATES.USER_MODE){
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
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
            if (neighbour === troop.body || neighbour.team == troop.body.team || (neighbour.gameObject && !neighbour.gameObject.active) || neighbour.dontTrack) return; // Ignore itself or untrackable neighbors
    
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
            if(Math.abs(troop.track[1].x - mostClosest.gameObject.x) > troop.weapon.range || Math.abs(troop.track[1].y - mostClosest.gameObject.y) > troop.weapon.range){
                troop.track[1].x = mostClosest.gameObject.x;
                troop.track[1].y = mostClosest.gameObject.y;
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

    static createAnim(key, image, start, end, repeat = -1, frameRate = 3){
        this.scene.anims.create({
            key: key,
            frames: this.scene.anims.generateFrameNumbers(image, { start: start, end: end }),
            frameRate: frameRate,
            repeat: repeat
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
                    troop.setTint(0x000000); // Highlight selected troops
                } else {
                    Player.applyDefaultTint(troop); // Clear highlight from non-selected troops
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
          const teamNumber = playerDict[key];
          // create the sprite
          const player = this.addPlayer(x, y, teamNumber);
          // register with Teams (adds to playerList and USER_MODE state)
          Teams.addPlayer(teamNumber, player);
          // remove from the dict
          delete playerDict[key];
        }
      }
      

    static roam(troop) {
        // start roaming
        troop.roam = true;
        let px = troop.x;
        let py = troop.y;
        let troopX = Math.floor(px/SQUARESIZE)
        let troopY = Math.floor(py/SQUARESIZE)
        if(Map.navGrid[troopY][troopX] == 0){
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) {
                console.log("No valid start tile nearby");
                return;
            } else {
                console.log("New valid tile:", newX, newY);
                px = newX*SQUARESIZE+SQUARESIZE/2;
                py = newY*SQUARESIZE+SQUARESIZE/2;
            }
        }

        // four directions at one grid distance (SQUARESIZE px)
        const offsets = [
            { x: px,              y: py - SQUARESIZE }, // above
            { x: px,              y: py + SQUARESIZE }, // below
            { x: px - SQUARESIZE, y: py             }, // left
            { x: px + SQUARESIZE, y: py             }  // right
        ];
    
        const validPositions = [];
        for (const pos of offsets) {
            const gx = Math.floor(pos.x / SQUARESIZE);
            const gy = Math.floor(pos.y / SQUARESIZE);
            if (
                gx >= 0 && gx < WORLD_DIMENSIONX &&
                gy >= 0 && gy < WORLD_DIMENSIONY &&
                ((Map.grid[gy][gx] == 35 && troop.body.team) || !troop.body.team) &&
                Map.navGrid[gy][gx] === 1
            ) {
                validPositions.push(pos);
            }
        }
    
        if (validPositions.length) {
            // pick a random valid direction
            const dest = Phaser.Utils.Array.GetRandom(validPositions);
            const path = Map.navMesh.findPath(
                { x: px, y: py },
                { x: dest.x, y: dest.y }
            );
            Player.moveTo(troop, path);
        }
    }

    static handleStateIntteruptStart(troop){
        if(troop.oldState == undefined || troop.oldState == null){
            troop.oldState = troop.state;
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE)
            if(troop.oldState && troop.task){
                troop.task.assigned -= 1;
                troop.task = null;
            }
        }
        return;
    }

    static handleStateIntteruptComplete(troop){
        if(troop.oldState){
            Teams.movePlayerState(troop, troop.oldState)
            if(troop.oldState == CONTROL_STATES.FARM_MODE){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].tileList, CONTROL_STATES.FARM_MODE)
            }else if(troop.oldState == CONTROL_STATES.SEED_MODE){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].seedList, CONTROL_STATES.SEED_MODE)
            }else if(troop.oldState == CONTROL_STATES.HARVEST_MODE){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].cropList, CONTROL_STATES.HARVEST_MODE)
            }else if(troop.oldState == CONTROL_STATES.BUILD_MODE_T){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].buildingTileStates, CONTROL_STATES.BUILD_MODE_T)
            }else if(troop.oldState == CONTROL_STATES.DESTROY_MODE){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].destroyStates, CONTROL_STATES.BUILD_MODE_T)
            }else if(troop.oldState == CONTROL_STATES.BUILD_MODE_B){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].blockBuildingStates, CONTROL_STATES.BUILD_MODE_T)
            }else if(troop.oldState == CONTROL_STATES.R_FARM_MODE){
                Manager.assignOneTroopToAction(troop, Teams.teamLists[`${troop.body.team}`].TeamFarmSpots, CONTROL_STATES.R_FARM_MODE)
            }
        }
        troop.oldState = null;
        return;
    }

    static update(){
        this.troops.forEach((troop, index) => {
            if(!troop.active){this.troops.splice(index, 1); return}
            const inView = Map.cameraBounds.contains(troop.x, troop.y);
            troop.setVisible(inView); // Will not draw if false
            let neighbours = Player.scene.physics.overlapCirc(troop.x, troop.y, 100)
            let reTrack = this.mostClosestEnemy(troop, neighbours)
            if(reTrack){
                troop.roam = false;
                this.handleStateIntteruptStart(troop)
                let troopX = Math.floor(troop.x/SQUARESIZE)
                let troopY = Math.floor(troop.y/SQUARESIZE)
                if(Map.navGrid[troopY][troopX] == 0){
                    let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                    if (newX === -1) {
                        console.log("No valid start tile nearby");
                    } else {
                        console.log("New valid tile:", newX, newY);
                        troopX = newX;
                        troopY = newY;
                    }
                }    
                Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: troop.track[1].x, y: troop.track[1].y }));
            }
            else if(!troop.task && !troop.track && troop.state == CONTROL_STATES.TRACK_MODE && !troop.roam){
                if(Teams.teamLists['1'].TeamFarmSpots.length && troop.body.team){
                    Manager.assignOneTroopToAction(troop, Teams.teamLists['1'].TeamFarmSpots, CONTROL_STATES.R_FARM_MODE);
                }else if(!troop.task && !troop.track && troop.state == CONTROL_STATES.TRACK_MODE && Teams.farFromCenter(troop)){
                    Teams.sendTroopToTown(troop);
                }else{
                    this.roam(troop);
                }
            }
            else if(troop.state == CONTROL_STATES.R_FARM_MODE && !Teams.teamLists['1'].TeamFarmSpots.length){
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            }
            this.followPath(troop);  
        })
    }

    static playerAvailible(troop){
        if(troop.state == CONTROL_STATES.USER_MODE || troop.state == CONTROL_STATES.R_FARM_MODE 
            || troop.state == CONTROL_STATES.BACK_TO_TOWN
            || (troop.state == CONTROL_STATES.TRACK_MODE && (!troop.track || !troop.track.gameObject))){
            if(troop.state == CONTROL_STATES.R_FARM_MODE && troop.task){
                troop.task.assigned = 0;
                troop.task = null;
            }
            return true;
        }
        return false;
    }

    static showDetailsTab(player) {
        if(player == this.curPlayerDetails) return;
        const scene = Player.scene;
        const cam = scene.cameras.main;
        const width = cam.width;
        const height = cam.height;
        this.curPlayerDetails = player;

        // close existing
        if (Player.detailsContainer) {
            Player.hideDetailsTab()
        }

        // dimensions & padding
        const PANEL_W = 200;
        const PANEL_H = 150;
        const PAD = 10;
        const IMG_W = 60, IMG_H = 50;
      
        // start off-screen (below bottom)
        const container = scene.add
          .container(width - PANEL_W - PAD, height + PANEL_H)
          .setDepth(UIDEPTH)
          .setScrollFactor(0);
        
        // background
        const bg = scene.add.graphics().setDepth(UIDEPTH);
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(0, 0, PANEL_W, PANEL_H, 12);  // 12px corner radius      

        const outlineColor = player.body.team === 1 ? 0x00ff00 : 0xff0000;
        const outline = scene.add.graphics()
          .setDepth(UIDEPTH)
          .setScrollFactor(0);
        outline.lineStyle(2, outlineColor, 1);
        outline.strokeRoundedRect(0, 0, PANEL_W, PANEL_H, 12);
        container.add(outline);

        // placeholder image at top-left of panel
        const portraitKey = player.health > 50 ? 'char' : 'charHurt';

        // create the portrait sprite centered in the 100×100 area
        const portrait = scene.add.sprite(
          PAD + IMG_W / 2,
          PAD + IMG_H / 2,
          portraitKey
        )
        .setOrigin(0.5, 0.5)
        .setDepth(UIDEPTH)
        .setScrollFactor(0);
        
        // if you have a looping animation on 'char' or 'charHurt', play it:
        portrait.play(portraitKey);       
      
        // texts below image, left-aligned
        const textStartY = PAD + IMG_H + 5;
        const lvlText = scene.add
          .text(PAD, textStartY, `Lvl: ${player.level || 1}`, { fontSize: '16px', fill: '#ffffff' })
          .setOrigin(0, 0)
          .setDepth(UIDEPTH);
      
        const healthText = scene.add
          .text(PAD, textStartY + 20, `Health: ${player.health}`, { fontSize: '16px', fill: '#ffffff' })
          .setOrigin(0, 0)
          .setDepth(UIDEPTH);
      
        const weaponText = scene.add
          .text(PAD, textStartY + 40, `Weapon: ${player.weapon?.name || 'None'}`, { fontSize: '16px', fill: '#ffffff' })
          .setOrigin(0, 0)
          .setDepth(UIDEPTH);

        
        const teamText = scene.add.text(
            PAD,
            textStartY + 60,
            `Team: ${player.body.team}`,
            { fontSize: '16px', fill: '#ffffff' }
        )
        .setOrigin(0, 0)
        .setDepth(UIDEPTH);      
        // close button top-right
        const closeBtn = scene.add
          .text(PANEL_W - PAD, PAD, 'x', { fontSize: '18px', fill: '#ffffff' })
          .setOrigin(1, 0)
          .setDepth(UIDEPTH)
          .setInteractive()
          .setScrollFactor(0)
        closeBtn
            .on('pointerover', () => {
            closeBtn.setStyle({ fill: '#ff3333' });  // red on hover
            })
            .on('pointerout', () => {
            closeBtn.setStyle({ fill: '#ffffff' });  // back to white
            });
        
        closeBtn.on('pointerdown', () => {
            Player.scene.tweens.add({
              targets: container,
              y: height + PANEL_H + PAD,
              duration: 300,
              ease: 'Cubic.easeIn',
              onComplete: () => {
                container.destroy();
                if (Player.detailsContainer === container) {
                  Player.detailsContainer = null;
                }
              }
            });
          });

        container.add([bg, lvlText, healthText, weaponText, teamText, closeBtn, portrait, outline]);
        Player.detailsContainer = container;
      
        // animate panel up into bottom-right view
        scene.tweens.add({
          targets: container,
          y: height - PANEL_H - PAD - 50,
          duration: 300,
          ease: 'Cubic.easeOut'
        });

        Player.detailsLvlText    = lvlText;
        Player.detailsHealthText = healthText;
        Player.detailsWeaponText = weaponText;
        Player.detailsPortrait = portrait;
    }

    static hideDetailsTab() {
        if (!Player.detailsContainer) return;
        const scene = Player.scene;
        const container = Player.detailsContainer;
      
        scene.tweens.add({
          targets: container,
          y: scene.cameras.main.height,
          duration: 300,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            if(this.detailsContainer == container) Player.detailsContainer = null;
            container.destroy();
          }
        });
    }

    static updateDetailsTab(player) {
        if (!Player.detailsContainer || player !== Player.curPlayerDetails) return;
        if (player.health <= 0) {
            Player.hideDetailsTab();
            return;
        }
        const container = Player.detailsContainer;

        //portrait update
        const portraitKey = player.health > 50 ? 'char' : 'charHurt';
        if (Player.detailsPortrait.texture.key !== portraitKey) {
        Player.detailsPortrait.setTexture(portraitKey);
        Player.detailsPortrait.play(portraitKey);
        }
        // Health delta
        const prevHealth = parseInt(Player.detailsHealthText.text.split(':')[1].trim(), 10);
        const deltaHealth = player.health - prevHealth;
        if (deltaHealth !== 0) {
            const msg = deltaHealth > 0 ? `+${deltaHealth}` : `${deltaHealth}`;
            const col = deltaHealth > 0 ? '#00ff00' : '#ff3333';
            const worldX = container.x + Player.detailsHealthText.x + 75;
            const worldY = container.y + Player.detailsHealthText.y;
            const ghost = Player.scene.add.text(worldX, worldY, msg, {
                fontSize: '16px', fill: col, stroke: '#000000', strokeThickness: 2
            }).setOrigin(0, 0).setDepth(UIDEPTH).setScrollFactor(0);
            Player.scene.tweens.add({
                targets: ghost,
                y: ghost.y - 20,
                alpha: 0,
                duration: 800,
                ease: 'Cubic.easeOut',
                onComplete: () => ghost.destroy()
            });
        }
        Player.detailsHealthText.setText(`Health:  ${player.health}`);
    
        // Level delta
        const prevLvl = parseInt(Player.detailsLvlText.text.split(':')[1].trim(), 10);
        const deltaLvl = (player.level || 1) - prevLvl;
        if (deltaLvl !== 0) {
            const msg = deltaLvl > 0 ? `+${deltaLvl}` : `${deltaLvl}`;
            const col = deltaLvl > 0 ? '#00ff00' : '#ff3333';
            const worldX = container.x + Player.detailsLvlText.x + 75;
            const worldY = container.y + Player.detailsLvlText.y;
            const ghost = Player.scene.add.text(worldX, worldY, msg, {
                fontSize: '16px', fill: col, stroke: '#000000', strokeThickness: 2
            }).setOrigin(0, 0).setDepth(UIDEPTH).setScrollFactor(0);
            Player.scene.tweens.add({
                targets: ghost,
                y: ghost.y - 20,
                alpha: 0,
                duration: 800,
                ease: 'Cubic.easeOut',
                onComplete: () => ghost.destroy()
            });
        }
        Player.detailsLvlText.setText(`Lvl:     ${player.level || 1}`);
    
        // Weapon (no ghost)
        Player.detailsWeaponText.setText(`Weapon:  ${player.weapon?.name || 'None'}`);
    }
    
    static showDetailGhost(textObj, message, color) {
        const scene = Player.scene;
        const ghost = scene.add.text(
          textObj.x + textObj.width + 5,  // just to the right of the detail text
          textObj.y,
          message,
          { fontSize: '16px', fill: color, stroke: '#000000', strokeThickness: 2 }
        )
        .setOrigin(0, 0)
        .setDepth(UIDEPTH)
        .setScrollFactor(0);
      
        scene.tweens.add({
          targets: ghost,
          y: ghost.y - 20,
          alpha: 0,
          duration: 800,
          ease: 'Cubic.easeOut',
          onComplete: () => ghost.destroy()
        });
    }
      
    static applyDefaultTint(cube) {
        const color = cube.body.team === 1
          ? 0x64ff32   // your green
          : 0xff0000;  // your red for others
        cube.setTint(color);
    }
      
}