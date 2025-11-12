import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES, TILE_MAP, WORLD_DIMENSIONX, WORLD_DIMENSIONY, showAlert, UIDEPTH, clearTaskPlusTimer } from "../constants";
import Phaser from "phaser";
import { Map } from "../map";
import { tillManager } from "../Manager/tillManager";
import { Teams } from "../Teams";
import { buildingManager } from "../Manager/buildingManager";
import { weapons } from "../weapons";
import { fightManager } from "../Manager/fightManager";
import { seedManager } from "../Manager/seedManager";
import { Manager } from "../Manager/Manager";
import { Projectile } from "../Projectile";
import { Farmer } from "./Farmer";
import { Forager } from "./Forager";
import { Fireman } from "./Fireman";
import { Gunslinger } from "./Gunslinger";
import { StorageManager } from "../Manager/StorageManager";
import { Builder } from "./Builder";
import { UI_ITEM_TYPES } from "../UI/UIConstants";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { StaminaManager } from "../Manager/staminaManager";
import { VisibilitySystem } from "../UI/VisibilitySystem";

export class Player {

    static scene;
    static count = 0;
    static troops = [];
    static characters;
    static selected = [];

    static init(scene){
        this.scene = scene;
        this.characters = this.scene.physics.add.group({});
        this.createAnim('walk','player',0,2);
        this.createAnim('idle','player',0,0);
        this.createAnim('gun1Walk', 'gun1',0,2);
        this.createAnim('gun1Idle', 'gun1',0,0);
        this.createAnim('action','playerAction',0,2,-1,10);
        this.createAnim('carryWalk', 'playerCarry', 0, 2)
        this.createAnim('carryIdle', 'playerCarry', 0, 0)
        this.setUpBackToTown()
    }

    static addPlayer(x,y,team,spriteSheet='player',walk='walk',idle='idle',action='action', weapon=weapons.hands) {
        const newCube = Player.scene.physics.add.sprite(SQUARESIZE *x + SQUARESIZE/2, SQUARESIZE*y + SQUARESIZE/2, spriteSheet);
        newCube.setInteractive();
        newCube.id = this.count;
        this.count += 1;
        newCube.setOrigin(0.5,0.5);
        newCube.setDepth(BLOCKDEPTH+1)
        newCube.roam = false;
        newCube.currentPath = []
        newCube.body.team = team;
        team == 1 ? newCube.health = 200 : newCube.health = 100;
        team == 1 ? newCube.speed = 100 : newCube.speed = 50;
        this.applyDefaultTint(newCube);
        newCube.body.pushable = false;
        newCube.animState = idle;
        newCube.walk = walk;
        newCube.idle = idle;
        newCube.action = action;
        newCube.oldState = null;
        Teams.movePlayerState(newCube, CONTROL_STATES.TRACK_MODE);
        newCube.weapon = weapon;
        this.characters.add(newCube);
        this.troops.push(newCube);
        this.configureCubeInteractivity(newCube);
        Teams.addPlayer(team, newCube);
        return newCube;
    }

    static destroyPlayer(player) {
        if(!player || !player.body) return;
        // Call the troop-specific destroy logic if defined
        if (typeof player.destroySelf === 'function') {
            player.destroySelf();
        }

        this.characters.remove(player);
        const index = Player.troops.indexOf(player);
        if (index !== -1) Player.troops.splice(index, 1);

        const teamNum = player.body.team;
        const team = Teams.teamLists[`${teamNum}`];
        if (!team) return;
        Teams.removePlayerFromState(player.body.team, player, player.state);
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

    static _updateVisibilityForTroop(troop) {
        const gx = Math.floor(troop.x / SQUARESIZE);
        const gy = Math.floor(troop.y / SQUARESIZE);

        if (gx !== troop.gridX || gy !== troop.gridY) {
            // Move the troop’s vision bubble (VisibilitySystem will decide if it should repaint)
            if (troop.visionId != null) {
                VisibilitySystem.moveVisionBubble(troop.visionId, gx, gy, troop.visionRadius);
            } else {
                // Fallback if somehow missing id
                troop.visionId = VisibilitySystem.addVisionBubble({ x: gx, y: gy, r: troop.visionRadius, boost: 0.1 });
            }
            troop.gridX = gx;
            troop.gridY = gy;
        }
    }

    static refreshAllFoW(allVisibile=false) {
       for (const t of this.troops) VisibilitySystem.applyFoWToSprite(t, allVisibile);
    }

    static configureCubeInteractivity(cube){
        cube.selected = false; // Add a custom property to track selection state

        // Track last-known grid tile for visibility updates
        cube.gridX = Math.floor(cube.x / SQUARESIZE);
        cube.gridY = Math.floor(cube.y / SQUARESIZE);

        // give the player its own vision bubble (centered on grid)
        if (cube.body.team === 1) {
            cube.visionRadius = cube.visionRadius ?? 6;
            cube.visionId = VisibilitySystem.addVisionBubble({
                x: cube.gridX, y: cube.gridY, r: cube.visionRadius, boost: 0.1
            }, /*noRepaint=*/false);
        }

        // Default per-unit vision radius in tiles (tweak as you like)
        cube.visionRadius = cube.visionRadius ?? 6;

        // Add a pointerdown event listener to toggle selection
        cube.on('pointerdown', (pointer) => {
            if(Player.scene.berryMode){
                if(!Player.scene.checkSufficientBerries(1)) return;
                Player.scene.updateBerry(-1);
                StorageManager.consumeItemFromStorage(cube.body.team, UI_ITEM_TYPES.seedBerry);
                cube.health += 30;
                return;
            }
            if(Player.selected.length && !cube.body.team){
                Teams.addTroopsToFight(1, cube);
                fightManager.sendToAttack()
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
            Player.scene.openDetailPage('players', tab => tab.select(cube));
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
            if(troop.task){
                troop.task.assigned -= 1;
                troop.task = null;
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            }
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

    static pathTo(troop, fx, fy, gridSpot = true){
        let troopX = Math.floor(troop.x/SQUARESIZE);
        let troopY = Math.floor(troop.y/SQUARESIZE);
        let startX = troop.x;
        let startY = troop.y;
        if(!Map.navGrid[troopX][troopY]){
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) {
                console.log("No valid start tile nearby");
                return null;
            } else {
                startX = newX * SQUARESIZE + SQUARESIZE/2;
                startY = newY * SQUARESIZE + SQUARESIZE/2;
                console.log("New valid tile:", newX, newY);
            }
        }

        // Convert that center tile into world‐pixel coordinates
        let destX = fx, destY = fy;
        if(gridSpot){
            destX = fx * SQUARESIZE + SQUARESIZE / 2;
            destY = fy * SQUARESIZE + SQUARESIZE / 2;
        }
        
        // Ask the navmesh to build a path back to town center
        const path = Map.navMesh.findPath(
          { x: startX, y: startY },
          { x: destX,   y: destY   }
        );
      
        if (!path || path.length === 0) {
          console.warn(
            `Troop (team ${troop.body.team}) could not find a path to (${fx},${fy}).`
          );
          return null;
        }

        return path
    }

    static handleReMap(sprite){
    // Attempt to re‐path from the sprite’s current world‐position to its final destination
        const start = { x: sprite.x, y: sprite.y };
        const end   = sprite.finalPos; // assigned earlier in Player.moveTo()
        const newPath = Map.navMesh.findPath(start, end);
        if (newPath && newPath.length > 0) {
            console.log("New path found")
            this.moveTo(sprite, newPath)
        } else {
            // No valid path found → abort movement
            console.warn("No valid path found, now in trackMode")
            sprite.currentPath = [];
            this.setAnimState(sprite, 'idle');
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
            return false;
        }
        return true; // skip the rest of this frame so we don’t walk into a blocked tile
    }

    static followPath(sprite) {
        Manager.handleDurationCheck(sprite)
        if (sprite.currentPath.length === 0) {
            this.setAnimState(sprite, sprite.idle);
            return;
        }
        this.setAnimState(sprite, sprite.walk)
        let nextPoint = sprite.currentPath[0]; // Get the next point in the path

        // Scale speed by stamina ratio
        const staminaFactor = Math.max(0.2, sprite.stamina / sprite.maxStamina); 
        const currentSpeed = sprite.baseSpeed * staminaFactor;
        if(!sprite.roam && sprite.stamina > 0) {sprite.stamina = Math.max(0, sprite.stamina - 0.02);}
        
        if(sprite.body.team == 1){
            this._updateVisibilityForTroop(sprite);
            VisibilitySystem.applyFoWToSprite(sprite);
        }

        const desired = new Phaser.Math.Vector2(nextPoint.x - sprite.x, nextPoint.y - sprite.y)
            .setLength(currentSpeed);
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
        if ((sprite.state == CONTROL_STATES.TRACK_MODE || sprite.state == CONTROL_STATES.TRACK_TARGET) && !sprite.roam && sprite.track && sprite.track[0].gameObject && Phaser.Math.Distance.Between(sprite.x, sprite.y, sprite.track[0].gameObject.x, sprite.track[0].gameObject.y) < sprite.weapon.range && (!sprite.weapon.projectile || Projectile.hasLineOfSight(sprite, sprite.track[0].gameObject))) {
            sprite.body.setVelocity(0, 0);
            sprite.currentPath.length = 0;
            if(sprite.state == CONTROL_STATES.TRACK_TARGET) sprite.oldState = CONTROL_STATES.TRACK_TARGET;
            Teams.movePlayerState(sprite, CONTROL_STATES.ATTACK_MODE);
            this.doAction(sprite);
        }
        else if (Phaser.Math.Distance.Between(sprite.x, sprite.y, nextPoint.x, nextPoint.y) < 3) {
            sprite.currentPath.shift(); // Remove the reached point from the path
            if (sprite.currentPath.length == 0) {
                if(sprite.roam && !sprite.task){
                    // schedule roam flag reset after 2–4s
                    const roamDuration = Phaser.Math.Between(1000, 4000);
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
        else if(sprite.state == CONTROL_STATES.WATER_CROPS_MODE){
            tillManager.beginWatering(sprite);
        }
        else if(sprite.state == CONTROL_STATES.USER_MODE){
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        }
        else if(sprite.state == CONTROL_STATES.BACK_TO_TOWN){
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
        }
        else if (sprite.state === CONTROL_STATES.GET_WATER_MODE) {
            if(sprite.isFireman) Fireman.firemanCompleteWaterPickup(sprite)
            else Farmer.giveTroopWater(sprite)
        }
        else if(sprite.state === CONTROL_STATES.GET_FROM_STORAGE){
            StorageManager.tryPickupFromStorage(sprite);
        }
        else if (sprite.state === CONTROL_STATES.SEND_TO_STORAGE){
            StorageManager.handleStorageDropoff(sprite)
        }
        else if(sprite.state == CONTROL_STATES.SEND_TO_OVEN){
            if (sprite.task?.taskType === 'ovenFuelDelivery') {
                Fireman.deliverFuelToOven(sprite);
            }else{
                Fireman.deliverToOven(sprite)
            }
        }
        else if(sprite.state == CONTROL_STATES.GET_FROM_OVEN){
            Fireman.handleOvenPickupComplete(sprite);
        }
        else if(sprite.state == CONTROL_STATES.GET_BLOCK_RESOURCE){
            blockResourceManager.beginFarmingBlockResource(sprite);
        }
        else if (sprite.state == CONTROL_STATES.GO_HOME_MODE) {
            if (sprite.home) {
                StaminaManager.arriveAtHome(sprite);
            }
        }
        else if (sprite.state == CONTROL_STATES.SLEEP_MODE) {
            // do nothing, stamina regen handled in StaminaManager.updateTroop
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
        let search;
        troop.state == CONTROL_STATES.TRACK_TARGET ? search = false : search = true;
        if(search){
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
        }
        
        if(troop.track && (troop.track[0] == mostClosest || troop.state == CONTROL_STATES.TRACK_TARGET)){
            if(Math.abs(troop.track[1].x - troop.track[0].gameObject.x) > troop.weapon.range || Math.abs(troop.track[1].y - troop.track[0].gameObject.y) > troop.weapon.range){
                troop.track[1].x = troop.track[0].gameObject.x;
                troop.track[1].y = troop.track[0].gameObject.y;
                return true;
            }
            return false;
        }
        else if(mostClosest){
            troop.track = [null,null]
            troop.track[0] = mostClosest
            troop.track[1] = {x: mostClosest.gameObject.x, y: mostClosest.gameObject.y}
            return true;
        }
        return false;
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
          if(teamNumber){
            this.addPlayer(x, y, teamNumber);
          }
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
                (((Map._hasTypeAt(gx, gy, 'road') || Map.grid[gy][gx] == TILE_TYPES.crops.grid) && troop.body.team) || !troop.body.team) &&
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
        if(troop.state == CONTROL_STATES.TRACK_TARGET) {return;};
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

    static updateTracking(troop){
        let neighbours = Player.scene.physics.overlapCirc(troop.x, troop.y, 100);
        let reTrack = this.mostClosestEnemy(troop, neighbours);
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
    }

    static update(){
        this.troops.forEach( troop => {
            if(Player.scene.clock.paused){
                troop.body.setVelocity(0, 0);
                return;        
            }
            if(troop.isGunslinger) { Gunslinger.update(troop) }
            else if(troop.isFarmer) { Farmer.update(troop) }
            else if(troop.isForager) { Forager.update(troop) }
            else if (troop.isFireman) { Fireman.update(troop) }
            else if (troop.isBuilder) { Builder.update(troop) }
            else{ this.updateTracking(troop) } // for enemies
            StaminaManager.updateTroop(troop);
            if (troop.state != CONTROL_STATES.SLEEP_MODE) this.followPath(troop);
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

    static applyDefaultTint(cube) {
        let tint;

        switch (true) {
            case cube.isFarmer:
                tint = 0x8B5A2B; // Brown for farmers
                break;
            case cube.isForager:
                tint = 0x228B22;
                break;
            case cube.isFireman:
                tint = 0xff9933;
                break;
            case cube.isGunslinger:
                tint = 0x9999ff;
                break;
            case cube.isBuilder:
                tint = 0x4433ff;
                break;
            case cube.body.team === 1:
                tint = 0x64ff32; // Green for your team
                break;
            default:
                tint = 0xff0000; // Red for others
                break;
        }

        cube.setTint(tint);
    }


    static setUpBackToTown(){
        this.scene.input.keyboard.on('keydown-B', () => {
            this.selected.forEach(troop => {
                Teams.sendTroopToTown(troop);
            })
        });
    }
      
}