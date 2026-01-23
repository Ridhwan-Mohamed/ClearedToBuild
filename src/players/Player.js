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
import { Raider } from "./Raider";
import { Blademaster } from "./Blademaster";
import { Brawler } from "./Brawler";
import { AudioManager } from "../Manager/AudioManager";
import { PathRegistry } from "../lib/navmesh/PathRegistry";
import { PathDebugDrawer } from "../lib/navmesh/PathDebugDrawer";

export class Player {

    static scene;
    static count = 0;
    static troops = [];
    static characters;
    static selected = [];
    // mini health/stamina bars config
    static MINI_BAR_WIDTH      = 26;
    static MINI_BAR_HEIGHT     = 3;
    static MINI_BAR_OFFSET_Y   = 6;      // below the feet
    static MINI_BAR_HIT_MS     = 2000;   // show for 2s after hit


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
        PathDebugDrawer.init(scene);
    }

    static addPlayer(x,y,team,spriteSheet='player',walk='walk',idle='idle',action='action', weapon=weapons.hands) {
        const newCube = Player.scene.physics.add.sprite(SQUARESIZE *x + SQUARESIZE/2, SQUARESIZE*y + SQUARESIZE/2, spriteSheet);
        Player.scene.uiCamera.ignore(newCube);
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

        // kill mini bars first
        this._destroyMiniBars(player)

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
            // Clicked an enemy (team 0) → pick a fighter and send it after this target
            if (cube.body.team === 0) {
                Player.assignFighterToTarget(cube);
                // Optional: don't select enemies when you click them
                // return;
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
            Player.setMiniBarHover(cube, true);
            if (!cube.selected) {
                cube.setTint(Phaser.Display.Color.GetColor(50, 50, 50));
            }
        });

        // Add a pointerout event listener to revert texture when not hovered
        cube.on('pointerout', (pointer) => {
            Player.setMiniBarHover(cube, false);
            if (!cube.selected) {
                Player.applyDefaultTint(cube);
            }
        });

    }

    static moveTo(troop, path) {
        const {navMesh, navGrid} = this._getNavForTroop(troop);
        if (!path || path.length === 0) {
            // Raiders: if a POI is blocked, convert to siege instead of clearing task.
            if (troop.body?.team === 0 && typeof troop.tryBeginSiege === "function") {
                const didSiege = troop.tryBeginSiege();
                if (didSiege) return true;
            }

            console.log("No path found or path is empty.");
            if (troop.task) {
                troop.task.assigned -= 1;
                troop.task = null;
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
                PathRegistry.unregisterUnit(navMesh, troop);
            }
            return false;
        }

        troop.currentPath = path;
        troop.finalPos = path[path.length - 1];
        troop.currentPath.shift();

        PathDebugDrawer.onNewPath(troop);

        if (troop.__pendingPolyIds && troop.__pendingPolyIds.length) {
            PathRegistry.registerUnitPath(navMesh, troop, troop.__pendingPolyIds);
            troop.__pendingPolyIds = [];
        }
        return true;
    }


    static findBestStartPos(sprite, sx, sy) {
        // 🧱 3. Search surrounding 8 tiles (including diagonals)
        const { navMesh, navGrid } = Player._getNavForTroop(sprite);

        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
    
        for (let [dx, dy] of directions) {
            const nx = sx + dx;
            const ny = sy + dy;
    
            // Skip out-of-bounds
            if (ny < 0 || ny >= navGrid.length || nx < 0 || nx >= navGrid[0].length) {
                continue;
            }
    
            // Check if tile is walkable
            if (navGrid[ny][nx] === 1) {
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

    // Player.js
    static pathTo(troop, fx, fy, gridSpot = true){
        const { navMesh, navGrid } = Player._getNavForTroop(troop);

        let troopX = Math.floor(troop.x / SQUARESIZE);
        let troopY = Math.floor(troop.y / SQUARESIZE);

        let startX = troop.x;
        let startY = troop.y;

        // IMPORTANT: use navGrid for the team, not Map.navGrid
        if (!navGrid[troopY] || navGrid[troopY][troopX] !== 1) {
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY); 
            // ^ if findBestStartPos uses Map.navGrid internally, see note below

            if (newX === -1) {
            console.log("No valid start tile nearby");
            return null;
            } else {
            startX = newX * SQUARESIZE + SQUARESIZE/2;
            startY = newY * SQUARESIZE + SQUARESIZE/2;
            console.log("New valid tile:", newX, newY);
            }
        }

        let destX = fx, destY = fy;
        if (gridSpot) {
            destX = fx * SQUARESIZE + SQUARESIZE / 2;
            destY = fy * SQUARESIZE + SQUARESIZE / 2;
        }

        // IMPORTANT: use navMesh for the team
        const result = navMesh.findPathDetailed(
            { x: startX, y: startY },
            { x: destX, y: destY },
            { includePolys: true }
        );

        if (!result || !result.points || result.points.length === 0) {
            console.warn(`Troop (team ${troop.body.team}) could not find a path to (${fx},${fy}).`);
            return null;
        }

        troop.__pendingPolyIds = result.polyIds || [];
        return result.points;
    }

    // Player.js
    static getValidStartWorld(troop){
        const troopX = Math.floor(troop.x / SQUARESIZE);
        const troopY = Math.floor(troop.y / SQUARESIZE);

        // already on walkable tile
        if (Map.navGrid?.[troopY]?.[troopX]) {
            return { x: troop.x, y: troop.y };
        }

        const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
        if (newX === -1) return null;

        return {
            x: newX * SQUARESIZE + SQUARESIZE/2,
            y: newY * SQUARESIZE + SQUARESIZE/2,
        };
    }

    // static handleReMap(sprite){
    // // Attempt to re‐path from the sprite’s current world‐position to its final destination
    //     const start = { x: sprite.x, y: sprite.y };
    //     const end   = sprite.finalPos; // assigned earlier in Player.moveTo()
    //     const newPath = Map.navMesh.findPath(start, end);
    //     if (newPath && newPath.length > 0) {
    //         console.log("New path found")
    //         this.moveTo(sprite, newPath)
    //     } else {
    //         // No valid path found → abort movement
    //         console.warn("No valid path found, now in trackMode")
    //         sprite.currentPath = [];
    //         this.setAnimState(sprite, 'idle');
    //         Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
    //         return false;
    //     }
    //     return true; // skip the rest of this frame so we don’t walk into a blocked tile
    // }

    static followPath(sprite) {
        Manager.handleDurationCheck(sprite);

        // 🔥 1) FIRST: if we're tracking a target and already in range,
        // go straight into ATTACK_MODE – even if there is no path.
        if (
            (sprite.state === CONTROL_STATES.TRACK_MODE ||
            sprite.state === CONTROL_STATES.TRACK_TARGET) &&
            sprite.weapon &&
            sprite.track &&
            sprite.track[0] &&
            sprite.track[0].gameObject
        ) {
            const targetGO = sprite.track[0].gameObject;

            const inRange =
                Phaser.Math.Distance.Between(sprite.x, sprite.y, targetGO.x, targetGO.y) <
                sprite.weapon.range;

            // Only gunslinger needs LoS gating (projectile weapon behavior)
            const hasLoS = !sprite.isGunslinger || Projectile.hasLineOfSight(sprite, targetGO);

            if (inRange && hasLoS) {
                sprite.body.setVelocity(0, 0);
                if (sprite.currentPath && sprite.currentPath.length) sprite.currentPath.length = 0;
                Teams.movePlayerState(sprite, CONTROL_STATES.ATTACK_MODE);
                this.doAction(sprite);
                return;
            }

        }

        // 2) If we aren't walking anywhere, just idle.
        if (!sprite.currentPath || sprite.currentPath.length === 0) {
            this.setAnimState(sprite, sprite.idle);
            PathDebugDrawer.onPathEnd(sprite); // optional cleanup
            return;
        } 

        // 3) Normal movement logic
        // Player.js - inside followPath(), in the "Normal movement logic" section
        PathRegistry.updateUnitProgress(sprite.body.team ? Map.navMesh : Map.enemyNavMesh, sprite, new Phaser.Math.Vector2(sprite.x, sprite.y));
        // after movement update, each tick while walking
        PathDebugDrawer.tickUnit(sprite, this.scene.time.now);
        this.setAnimState(sprite, sprite.walk);
        let nextPoint = sprite.currentPath[0];
        // Scale speed by stamina ratio
        const staminaFactor = Math.max(0.2, sprite.stamina / sprite.maxStamina);
        const currentSpeed = sprite.type.speed * staminaFactor;
        if(!sprite.roam && sprite.stamina > 0) {sprite.stamina = Math.max(0, sprite.stamina - sprite.type.stamina);}

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
        AudioManager.tryPlayStep(sprite);
        // Rotate the sprite to face the direction of movement
        if (newVelocity.length() > 0) {
            sprite.rotation = Phaser.Math.Angle.Between(0, 0, newVelocity.x, newVelocity.y); // Calculate angle
        }
        // shift to next point in pathing
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, nextPoint.x, nextPoint.y) < 3) {
            sprite.currentPath.shift(); // Remove the reached point from the path
            PathDebugDrawer.onWaypointAdvanced(sprite);
            if (sprite.currentPath.length == 0) {
                // 🟡 FLEEING: when we reach this hop, re-evaluate threat & maybe choose next hop
                if (sprite.state === CONTROL_STATES.FLEE_MODE) {
                    sprite.body.setVelocity(0, 0);
                    this.updateTracking(sprite);   // either pick a new flee direction or drop back to TRACK_MODE
                    return;
                }
                if (sprite.roam && !sprite.task) {
                    const roamDuration = Phaser.Math.Between(1000, 4000);
                    sprite.scene.time.delayedCall(roamDuration, () => {
                        sprite.roam = false;
                    });
                }
                sprite.body.setVelocity(0, 0);
                this.doAction(sprite);
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
        else if(sprite.state == CONTROL_STATES.FIX_BUILDING){
            buildingManager.beginFixingBuilding(sprite);
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
        else if (sprite.state == CONTROL_STATES.HEADING_TO_GUARD) {
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE)
            sprite.roam = false;
            this.roam(sprite);
        }
        else if (
            sprite.state === CONTROL_STATES.SIEGE_MODE ||
            sprite.state === CONTROL_STATES.DESTROY_MODE_T
        ) {
            buildingManager.beginDestroyingTile(sprite);
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

    static assignFighterToTarget(targetSprite) {
        if (!targetSprite || !targetSprite.body) return;

        const team = Teams.teamLists["1"];
        if (!team || !team.fighterList || !team.fighterList.length) return;

        const fighters = team.fighterList;

        let closestFree = null;
        let closestFreeDist = Infinity;
        let closestBusy = null;
        let closestBusyDist = Infinity;

        const tx = targetSprite.x;
        const ty = targetSprite.y;

        for (const f of fighters) {
            if (!f || !f.body || !f.active) continue;
            if (f.health !== undefined && f.health <= 0) continue;

            const dx = f.x - tx;
            const dy = f.y - ty;
            const d2 = dx * dx + dy * dy;

            // "Free" = not currently tracking a target
            const isFree =
                !f.track ||
                !f.track[0] ||
                f.state !== CONTROL_STATES.TRACK_TARGET;

            if (isFree) {
                if (d2 < closestFreeDist) {
                    closestFreeDist = d2;
                    closestFree = f;
                }
            } else {
                if (d2 < closestBusyDist) {
                    closestBusyDist = d2;
                    closestBusy = f;
                }
            }
        }

        const chosen = closestFree || closestBusy;
        if (!chosen) return;

        // 🔒 Mark this as a “hard assignment” target
        chosen.forcedTarget = targetSprite;

        // Kill any job/timer so they don’t sit on reserved tasks
        if (chosen.task) {
            if (typeof chosen.task.assigned === "number" && chosen.task.assigned > 0) {
                chosen.task.assigned -= 1;
            }
            chosen.task = null;
        }
        if (chosen.timer) {
            chosen.timer.remove(false);
            chosen.timer = null;
        }

        chosen.roam = false;

        chosen.track = [
            targetSprite.body,
            { x: targetSprite.x, y: targetSprite.y }
        ];

        // Go into chase mode
        Teams.movePlayerState(chosen, CONTROL_STATES.TRACK_TARGET);

        // Kick their AI once so they immediately start pathing
        Player.updateTracking(chosen);
    }

    static mostClosestEnemy(troop, neighbours) {
        let mostClosest = null;
        let shortestDistance = Infinity;
        let search = !troop.forcedTarget; //always check for optimal enemy
        // troop.state == CONTROL_STATES.TRACK_TARGET ? search = false : search = true;
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

        // We found a closest enemy body (mostClosest)
        // Use tile change on SQUARESIZE grid to decide if we need a new path.
        if (troop.track && (troop.track[0] === mostClosest || troop.state === CONTROL_STATES.TRACK_TARGET)) {
            const go = mostClosest.gameObject;
            if (!go) return false;

            const lastTileX = Math.floor(troop.track[1].x / SQUARESIZE);
            const lastTileY = Math.floor(troop.track[1].y / SQUARESIZE);
            const curTileX  = Math.floor(go.x / SQUARESIZE);
            const curTileY  = Math.floor(go.y / SQUARESIZE);

            // Same tile as last time → no repath
            if (lastTileX === curTileX && lastTileY === curTileY) {
                return false;
            }

            // Tile changed → update stored target pos, tell caller to repath
            troop.track[1].x = go.x;
            troop.track[1].y = go.y;
            return true;
        }
        else if (mostClosest) {
            // New target acquired
            const go = mostClosest.gameObject;
            if (!go) return false;

            troop.track = [
                mostClosest,
                {
                    x: go.x,
                    y: go.y
                }
            ];

            return true;
        }

        return false;
    }

    static findClosestEnemyBody(troop, neighbours) {
        let closest = null;
        let bestDistSq = Infinity;
        const tx = troop.x;
        const ty = troop.y;

        neighbours.forEach(body => {
            if (!body || body === troop.body) return;
            if (body.dontTrack) return;
            if (body.team == null || body.team === troop.body.team) return;

            const go = body.gameObject;
            if (go && !go.active) return;

            const dx = body.x - tx;
            const dy = body.y - ty;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDistSq) {
                bestDistSq = d2;
                closest = body;
            }
        });

        return closest;
    }

    static computeFleeDestination(troop, threatBody) {
        const gx = Math.floor(troop.x / SQUARESIZE);
        const gy = Math.floor(troop.y / SQUARESIZE);

        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];

        let best = null;
        let bestScore = -Infinity;

        for (const [dx, dy] of directions) {
            const nx = gx + dx;
            const ny = gy + dy;

            if (ny < 0 || ny >= Map.navGrid.length) continue;
            if (nx < 0 || nx >= Map.navGrid[0].length) continue;
            if (Map.navGrid[ny][nx] !== 1) continue; // must be walkable

            const wx = nx * SQUARESIZE + SQUARESIZE / 2;
            const wy = ny * SQUARESIZE + SQUARESIZE / 2;

            const dist = Phaser.Math.Distance.Between(wx, wy, threatBody.x, threatBody.y);
            if (dist > bestScore) {
                bestScore = dist;
                best = { x: wx, y: wy };
            }
        }

        return best;
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

    static _getNavForTroop(troop) {
        // default: player nav
        const useEnemy = troop?.body?.team === 0;

        const navMesh = (useEnemy && Map.enemyNavMesh) ? Map.enemyNavMesh : Map.navMesh;
        const navGrid = (useEnemy && Map.enemyNavGrid) ? Map.enemyNavGrid : Map.navGrid;

        return { navMesh, navGrid };
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
        const { navMesh, navGrid } = Player._getNavForTroop(troop);
        let px = troop.x;
        let py = troop.y;
        // If this unit has a guard point, use that as the roam center
        if (troop.guardCenter) {
            px = troop.guardCenter.x;
            py = troop.guardCenter.y;
        }
        let troopX = Math.floor(px/SQUARESIZE)
        let troopY = Math.floor(py/SQUARESIZE)
        if(navGrid[troopY][troopX] == 0){
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

            if (gx < 0 || gx >= WORLD_DIMENSIONX || gy < 0 || gy >= WORLD_DIMENSIONY)
                continue;

            let tileOK = false;

            if (troop.guardCenter) {
                // --- guard mode radius check ---
                const cx = Math.floor(troop.guardCenter.x / SQUARESIZE);
                const cy = Math.floor(troop.guardCenter.y / SQUARESIZE);

                const dx = gx - cx;
                const dy = gy - cy;

                if (dx*dx + dy*dy <= 3*3) {   // radius 3 in tiles
                    tileOK = true;
                }
            } else {
                // --- normal mode (your original logic) ---
                const roadOrCrop =
                    Map._hasTypeAt(gx, gy, 'road') ||
                    Map.grid[gy][gx] == TILE_TYPES.crops.grid;

                tileOK =
                    ((roadOrCrop && troop.body.team) || !troop.body.team);
            }

            // final navGrid check
            if (tileOK && Map.navGrid[gy][gx] === 1) {
                validPositions.push(pos);
            }
        }

    
        if (validPositions.length) {
            // pick a random valid direction
            const dest = Phaser.Utils.Array.GetRandom(validPositions);
            const path = navMesh.findPath(
                { x: px, y: py },
                { x: dest.x, y: dest.y }
            );
            Player.moveTo(troop, path);
        }
    }

    // Keep ranged units at comfortable distance (max range) while still in line of sight.
    static computeKiteDestination(troop, target, weapon) {
        if (!target) return null;
        const range = weapon.range || 150;

        const desiredDist = range * 0.9;   // sit near outer edge
        const minDist     = range * 0.6;   // don't bother moving if already "safe"

        const dx = troop.x - target.x;
        const dy = troop.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        // If we're already in a comfortable band, no need to move.
        if (dist >= minDist && dist <= range) {
            return null;
        }

        // Unit vector from target → troop
        const ux = dx / dist;
        const uy = dy / dist;

        // Where we *want* to stand: just inside max range, on the far side
        const destX = target.x + ux * desiredDist;
        const destY = target.y + uy * desiredDist;

        return { x: destX, y: destY };
    }

    static handleStateIntteruptStart(troop, targetState) {
        // If we're already in the desired state (TRACK_TARGET or FLEE_MODE),
        // nothing to do – this interrupt was already handled.
        if (troop.state === targetState) return;

        // Drop any active task + timer via helper if available
        if (typeof clearTaskPlusTimer === 'function') {
            clearTaskPlusTimer(troop);
        } else {
            if (troop.task) {
                if (typeof troop.task.assigned === 'number' && troop.task.assigned > 0) {
                    troop.task.assigned -= 1;
                }
                troop.task = null;
            }
            if (troop.timer) {
                troop.timer.remove(false);
                troop.timer = null;
            }
        }

        // Stop current movement / roaming
        troop.roam = false;
        if (troop.currentPath && troop.currentPath.length) {
            troop.currentPath.length = 0;
        }
        if (troop.body && troop.body.setVelocity) {
            troop.body.setVelocity(0, 0);
        }

        // Actually switch state (TRACK_TARGET or FLEE_MODE)
        Teams.movePlayerState(troop, targetState);
    }


    static updateTracking(troop){
        const overlapDist = troop.body.team ? 100 : 20;
        const neighbours = Player.scene.physics.overlapCirc(troop.x, troop.y, overlapDist);
        const hasWeapon = !!troop.weapon;

        // 🟡 NON-COMBATANTS (no weapon) → FLEE
        if (!hasWeapon) {
            const closest = this.findClosestEnemyBody(troop, neighbours);

            // No threat nearby → drop out of flee if we were fleeing
            if (!closest) {
                if (troop.state === CONTROL_STATES.FLEE_MODE) {
                    Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
                }
                return;
            }

            // Interrupt whatever we were doing and enter FLEE_MODE (once)
            Player.handleStateIntteruptStart(troop, CONTROL_STATES.FLEE_MODE);

            troop.track = null;

            const fleeDest = this.computeFleeDestination(troop, closest);
            if (!fleeDest) return;

            const path = Map.navMesh.findPath(
                { x: troop.x, y: troop.y },
                fleeDest
            );
            if (path && path.length) {
                this.moveTo(troop, path);
            }
            return;
        }

        // 🔵 COMBATANTS (have a real weapon) → chase targets as before
        // If we were explicitly tracking a target but now *nothing* is in range,
        // drop the target and go back to generic TRACK_MODE.
        if (troop.state === CONTROL_STATES.TRACK_TARGET && neighbours.length === 1 && !troop.forcedTarget) {
            troop.track = null;
            troop.currentPath.length = 0;
            troop.body.setVelocity(0, 0);
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        // 🔵 COMBATANTS (have a real weapon)
        if (hasWeapon) {

            // 1) If we have a forced target and it’s still alive, always chase it
            if (troop.forcedTarget && troop.forcedTarget.active && troop.forcedTarget.body) {
                const target = troop.forcedTarget;

                let targetMovedTile = true;

                if (!troop.track || troop.track[0] !== target.body) {
                    // First time forcing this target
                    troop.track = [
                        target.body,
                        { x: target.x, y: target.y }
                    ];
                    Teams.movePlayerState(troop, CONTROL_STATES.TRACK_TARGET);
                    targetMovedTile = true;
                } else {
                    // Same forced target → only update when it changes grid tile
                    const lastTileX = Math.floor(troop.track[1].x / SQUARESIZE);
                    const lastTileY = Math.floor(troop.track[1].y / SQUARESIZE);
                    const curTileX  = Math.floor(target.x / SQUARESIZE);
                    const curTileY  = Math.floor(target.y / SQUARESIZE);

                    if (lastTileX === curTileX && lastTileY === curTileY) {
                        targetMovedTile = false;
                    } else {
                        troop.track[1].x = target.x;
                        troop.track[1].y = target.y;
                        targetMovedTile = true;
                    }
                }

                troop.roam = false;

                // 🔫 gunslinger in-range / LoS check is still fine here…

                // 🔥 Gunslinger: kite instead of closing straight in
                if (troop.isGunslinger) {
                    const kiteDest = this.computeKiteDestination(troop, target, troop.weapon);
                    if (!kiteDest) {
                        // already at good distance; don't path
                        return;
                    }

                    // ✅ Only build a new kite path when target moved tile OR we have no path
                    if (!targetMovedTile && troop.currentPath && troop.currentPath.length > 0) {
                        return;
                    }

                    const path = Player.pathTo(troop, kiteDest.x, kiteDest.y, false);
                    if (path && path.length) {
                        Player.moveTo(troop, path);
                    }
                    return;
                }

                // 🔥 Non-gunslingers: only repath when targetMovedTile OR no existing path.
                if (targetMovedTile || !troop.currentPath || troop.currentPath.length <= 0) {
                    // (Re)compute a path toward the latest forced-target position
                    let troopX = Math.floor(troop.x / SQUARESIZE);
                    let troopY = Math.floor(troop.y / SQUARESIZE);

                    // If we’re standing on a non-walkable tile, try to nudge start to a valid neighbour
                    if (Map.navGrid[troopY]?.[troopX] === 0) {
                        const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                        if (newX === -1) {
                            console.log("No valid start tile nearby for forced target");
                            troop.currentPath.length = 0;
                            troop.body.setVelocity(0, 0);
                            return;
                        } else {
                            troopX = newX;
                            troopY = newY;
                        }
                    }

                    const path = Map.navMesh.findPath(
                        { x: troopX * SQUARESIZE, y: troopY * SQUARESIZE },
                        { x: troop.track[1].x,   y: troop.track[1].y   }
                    );

                    if (path && path.length) {
                        Player.moveTo(troop, path);
                    } else {
                        // No path found → stop any existing movement
                        troop.currentPath.length = 0;
                        troop.body.setVelocity(0, 0);
                    }
                }

                return;

                // ... existing navGrid check + Map.navMesh.findPath to troop.track[1] ...
            }

            // Target died / disappeared → clear forced flag and fall back to normal auto-combat
            if (troop.forcedTarget && (!troop.forcedTarget.active || !troop.forcedTarget.body)) {
                troop.forcedTarget = null;
            }

            // 2) Normal autonomous targeting (closest enemy)
            const reTrack = this.mostClosestEnemy(troop, neighbours);
            if (reTrack && troop.track && troop.track[1]) {
                troop.roam = false;

                const body = troop.track[0];
                const go = body?.gameObject;
                if (go) {
                    const distToTracked = Phaser.Math.Distance.Between(troop.x, troop.y, go.x, go.y);
                    const inRangeTracked = distToTracked <= troop.weapon.range;
                    const hasLoSTracked =
                        !troop.weapon.projectile ||
                        Projectile.hasLineOfSight(troop, go);

                    // 🔥 Already in range of the auto-selected target – don't path.
                    if (inRangeTracked && hasLoSTracked) {
                        if (troop.currentPath && troop.currentPath.length) {
                            troop.currentPath.length = 0;
                        }
                        troop.body.setVelocity(0, 0);
                        // followPath will handle ATTACK_MODE
                        return;
                    }

                    // 🔫 2) Gunslinger: compute kite destination instead of walking straight in
                    if (troop.isGunslinger) {
                        const kiteDest = this.computeKiteDestination(troop, go, troop.weapon);
                        if (!kiteDest) {
                            // Either already good distance or can't improve; don't path further.
                            return;
                        }

                        const path = Player.pathTo(troop, kiteDest.x, kiteDest.y, false);
                        if (path && path.length) {
                            Player.moveTo(troop, path);
                        }
                        return;
                    }
                }

                // ⬇ only path if not in range
                let troopX = Math.floor(troop.x / SQUARESIZE);
                let troopY = Math.floor(troop.y / SQUARESIZE);
                if (Map.navGrid[troopY]?.[troopX] === 0) {
                    const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                    if (newX === -1) {
                        console.log("No valid start tile nearby");
                        return;
                    } else {
                        troopX = newX;
                        troopY = newY;
                    }
                }

                const path = Map.navMesh.findPath(
                    { x: troopX * SQUARESIZE, y: troopY * SQUARESIZE },
                    { x: troop.track[1].x,   y: troop.track[1].y   }
                );
                if (path && path.length) {
                    Player.moveTo(troop, path);
                }
            }
            return;
        }
    }

    static update(){
        this.troops.forEach( troop => {
            if (Player.scene.clock.paused) {
                troop.body.setVelocity(0, 0);
                return;
            }

            let skipTail = false;

            // Raiders get their own AI
            if (troop.isRaider) {
                skipTail = Raider.update(troop) === true;
            }
            else if (troop.isGunslinger) {
                Gunslinger.update(troop);
            }
            else if (troop.isBlademaster) {
                Blademaster.update(troop);
            }
            else if (troop.isBrawler) {
                Brawler.update(troop);
            }
            else if (troop.isFarmer) {
                Farmer.update(troop);
            }
            else if (troop.isForager) {
                Forager.update(troop);
            }
            else if (troop.isFireman) {
                Fireman.update(troop);
            }
            else if (troop.isBuilder) {
                Builder.update(troop);
            }
            else {
                // generic enemy / non-class AI
                this.updateTracking(troop);
            }

            // Swimming raiders drive their own velocity, so skip stamina+path
            if (skipTail) return;

            StaminaManager.updateTroop(troop);
            if (troop.state != CONTROL_STATES.SLEEP_MODE) {
                this.followPath(troop);
            }

            // 🔥 update world mini HP/ST bars
            this._updateMiniBars(troop);
        });
    }

    static sendGuardOrder(troops, worldX, worldY, radius = SQUARESIZE * 3) {
        if (!troops) return;

        troops.forEach(troop => {
            if (!troop || !troop.active) return;

            // Remember the guard point and radius
            troop.guardCenter = { x: worldX, y: worldY };
            troop.guardRadius = radius;

            // Clear any existing job/target
            troop.roam = false;
            troop.track = null;
            troop.task = null;

            // Path to the guard point
            const path = Map.navMesh.findPath(
                { x: troop.x, y: troop.y },
                { x: worldX, y: worldY }
            );

            if (path && path.length) {
                Player.moveTo(troop, path);
                // TRACK_MODE makes their update() call Player.roam(...) when idle
                Teams.movePlayerState(troop, CONTROL_STATES.HEADING_TO_GUARD);
            } else {
                console.log("No path found for guard order");
                // If no path, at least let them roam from where they are
                troop.roam = true;
            }
        });
    }

    // Player.js
    static setGuardPost(troop, worldX, worldY, radius = SQUARESIZE * 3) {
        if (!troop || !troop.active) return;

        // store the guard post
        troop.guardCenter = { x: worldX, y: worldY };
        troop.guardRadius = radius;

        // Set state + path to guard post
        Teams.movePlayerState(troop, CONTROL_STATES.HEADING_TO_GUARD);

        const path = Map.navMesh.findPath(
            { x: troop.x, y: troop.y },
            { x: troop.guardCenter.x, y: troop.guardCenter.y }
        );

        if (path && path.length) {
            Player.moveTo(troop, path);
        }

        troop.roam = false;
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
            case cube.isBlademaster:
                tint = 0xAA33EE;
                break;
            case cube.isBrawler:
                tint = 0xFFD712;
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

    //------------------------------MINI BAR LOGIC---------------------------

    static _ensureMiniBars(troop) {
        if (troop._miniBarsInit || !this.scene || !troop) return;
        const scene = this.scene;

        const W = this.MINI_BAR_WIDTH;
        const H = this.MINI_BAR_HEIGHT;

        const isEnemy = troop.body?.team === 0;

        // HP bg + fill
        const hpBg = scene.add.rectangle(0, 0, W, H, 0x000000, 0.7)
            .setOrigin(0.5, 0.5)
            .setDepth(BLOCKDEPTH + 2);

        const hpFillColor = isEnemy ? 0xff3333 : 0x00ff00;

        const hpFill = scene.add.rectangle(0, 0, W, H, hpFillColor)
            .setOrigin(0, 0.5) // left-anchored
            .setDepth(BLOCKDEPTH + 3);

        troop._hpBarBg = hpBg;
        troop._hpBarFill = hpFill;

        // Only create stamina bars for non-enemies
        if (!isEnemy) {
            const stBg = scene.add.rectangle(0, 0, W, H, 0x000000, 0.7)
            .setOrigin(0.5, 0.5)
            .setDepth(BLOCKDEPTH + 2);

            const stFill = scene.add.rectangle(0, 0, W, H, 0x0088ff)
            .setOrigin(0, 0.5) // left-anchored
            .setDepth(BLOCKDEPTH + 3);

            troop._stBarBg = stBg;
            troop._stBarFill = stFill;

            stBg.setVisible(false);
            stFill.setVisible(false);
        } else {
            troop._stBarBg = null;
            troop._stBarFill = null;
        }

        troop._miniBarsInit = true;

        hpBg.setVisible(false);
        hpFill.setVisible(false);
    }

    static _destroyMiniBars(troop) {
        const keys = ['_hpBarBg', '_hpBarFill', '_stBarBg', '_stBarFill'];
        keys.forEach(k => {
            if (troop[k]) {
            troop[k].destroy();
            troop[k] = null;
            }
        });
        troop._miniBarsInit = false;
    }

    static _updateMiniBars(troop) {
        if (!this.scene || !troop || !troop.active) return;

        const scene = this.scene;

        const now = scene.time.now || 0;
        const fromHit   = troop._miniBarLastHit && (now - troop._miniBarLastHit < this.MINI_BAR_HIT_MS);
        const fromHover = !!troop._miniBarHover;
        const fromTab   = !!troop._miniBarSelectedFromTab;
        const shouldShow = fromHit || fromHover || fromTab;

        if (!shouldShow) {
            if (troop._miniBarsInit) {
            troop._hpBarBg?.setVisible(false);
            troop._hpBarFill?.setVisible(false);
            troop._stBarBg?.setVisible(false);
            troop._stBarFill?.setVisible(false);
            }
            return;
        }

        this._ensureMiniBars(troop);

        const W = this.MINI_BAR_WIDTH;
        const H = this.MINI_BAR_HEIGHT;

        const isEnemy = troop.body?.team === 0;

        const baseX = troop.x;
        const baseY = troop.y + (troop.displayHeight || SQUARESIZE) / 2 + this.MINI_BAR_OFFSET_Y;

        // HP bg centered
        troop._hpBarBg.setPosition(baseX, baseY);

        // HP fill left-anchored
        const leftX = baseX - W / 2;
        troop._hpBarFill.setPosition(leftX, baseY);

        const maxHP = troop.maxHealth || (troop.body?.team === 1 ? 200 : 100);
        const hpPct = Phaser.Math.Clamp((troop.health ?? 0) / maxHP, 0, 1);

        troop._hpBarFill.width = W * hpPct;
        troop._hpBarFill.height = H;

        troop._hpBarBg.setVisible(true);
        troop._hpBarFill.setVisible(true);

        // No stamina bar for enemies
        if (!isEnemy && troop._stBarBg && troop._stBarFill) {
            troop._stBarBg.setPosition(baseX, baseY + H + 2);
            troop._stBarFill.setPosition(leftX, baseY + H + 2);

            const maxST = troop.maxStamina || troop.maxStaminaValue || 100;
            const stPct = Phaser.Math.Clamp((troop.stamina ?? 0) / maxST, 0, 1);

            troop._stBarFill.width = W * stPct;
            troop._stBarFill.height = H;

            troop._stBarBg.setVisible(true);
            troop._stBarFill.setVisible(true);
        } else {
            troop._stBarBg?.setVisible(false);
            troop._stBarFill?.setVisible(false);
        }
    }

    // called by hover in configureCubeInteractivity
    static setMiniBarHover(troop, on) {
        if (!troop) return;
        troop._miniBarHover = !!on;
    }

    // called by fightManager when target gets hit
    static showMiniBarsOnHit(troop) {
        if (!this.scene || !troop) return;
        troop._miniBarLastHit = this.scene.time.now;
    }

    // called by PlayerTab when row selection changes
    static setMiniBarSelectedFromTab(selectedTroop) {
        if (!this.troops) return;
        this.troops.forEach(t => {
            t._miniBarSelectedFromTab = (t === selectedTroop);
        });
    }
      
}