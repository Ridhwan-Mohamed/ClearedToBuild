import { BLOCKDEPTH, SQUARESIZE, CONTROL_STATES, TILE_TYPES, TILE_MAP, WORLD_DIMENSIONX, WORLD_DIMENSIONY, showAlert, UIDEPTH } from "../constants";
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
import { FortGrunt } from "./FortGrunt";
import { AudioManager } from "../Manager/AudioManager";
import { PathRegistry } from "../lib/navmesh/PathRegistry";
import { PathDebugDrawer } from "../lib/navmesh/PathDebugDrawer";
import { InterruptController } from "../ai/scheduler/InterruptController";
import { SiegePlanner } from "../lib/navmesh/SiegePlanner";
import {
    shouldUseDirectionalFacing,
    syncDirectionalAnimationState,
    updateDirectionalAnimationFromVelocity
} from "./PlayerDirectionalAnimator";

export class Player {

    static scene;
    static count = 0;
    static troops = [];
    static characters;
    static selected = [];
    // mini health/stamina bars config (segmented)
    static MINI_BAR_HEIGHT     = 5;
    static MINI_BAR_OFFSET_Y   = 8;      // below the feet
    static MINI_BAR_HIT_MS     = 2000;   // show for 2s after hit

    // Segmentation: each sub-rect represents this many points.
    // Last segment is truncated when max isn't divisible by this unit.
    static MINI_BAR_SEG_UNIT   = 20;
    static MINI_BAR_GAP        = 1;
    static MINI_BAR_PAD        = 1;
    static MINI_BAR_MAX_W      = 110;    // clamps on-screen width
    static MINI_BAR_BASE_SEG_W = 4;      // pre-scale width per segment before clamping
    static CARRY_ICON_OFFSET_Y = 28;
    static CARRY_ICON_SIZE     = 18;
    
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
        this.createAnim('swim', 'playerSwim', 0, 2, -1, 8);
        this.setUpBackToTown()
        PathDebugDrawer.init(scene);
    }

    static addPlayer(x,y,team,spriteSheet='player',walk='walk',idle='idle',action='action', weapon=weapons.hands, swim='swim') {
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
        // this.applyDefaultTint(newCube);
        newCube.body.pushable = false;
        newCube.animState = idle;
        newCube.walk = walk;
        newCube.idle = idle;
        newCube.action = action;
        newCube.swim = swim;
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

    static _resolveCarryVisual(troop) {
        const carryEntry = troop?.carrying;
        if (carryEntry) {
            const item = carryEntry.item || carryEntry;
            const count = Number.isFinite(carryEntry.count) ? carryEntry.count : 1;
            const iconKey = item?.icon;
            if (iconKey) {
                return {
                    iconKey,
                    count,
                    showCount: count > 1,
                };
            }
        }

        if (troop?.isFarmer && Number(troop?.waterBucket?.count) > 0) {
            return {
                iconKey: UI_ITEM_TYPES.unclean_water.icon,
                count: troop.waterBucket.count,
                showCount: true,
            };
        }

        return null;
    }

    static _ensureCarryIndicator(troop) {
        if (troop._carryIndicator || !this.scene) return troop._carryIndicator;

        const icon = this.scene.add.image(0, 0, UI_ITEM_TYPES.food.icon)
            .setDisplaySize(this.CARRY_ICON_SIZE, this.CARRY_ICON_SIZE)
            .setOrigin(0.5);

        const badgeBg = this.scene.add.circle(7, 7, 7, 0x000000, 0.82)
            .setStrokeStyle(1, 0xffffff, 0.55);

        const countText = this.scene.add.text(7, 7, "1", {
            fontFamily: "Bungee",
            fontSize: "10px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);

        const container = this.scene.add.container(troop.x, troop.y, [icon, badgeBg, countText])
            .setDepth((troop.depth ?? (BLOCKDEPTH + 1)) + 3)
            .setVisible(false);

        container.icon = icon;
        container.badgeBg = badgeBg;
        container.countText = countText;

        troop._carryIndicator = container;
        troop.once?.("destroy", () => {
            troop._carryIndicator = null;
            container.destroy();
        });

        return container;
    }

    static _updateCarryIndicator(troop) {
        const indicator = troop?._carryIndicator;
        if (!troop?.active || !troop?.scene) {
            indicator?.destroy?.();
            troop._carryIndicator = null;
            return;
        }

        const visual = this._resolveCarryVisual(troop);
        if (!visual) {
            indicator?.setVisible(false);
            return;
        }

        const container = this._ensureCarryIndicator(troop);
        const yOffset = (troop.displayHeight || SQUARESIZE) / 2 + this.CARRY_ICON_OFFSET_Y;

        container.setPosition(troop.x, troop.y - yOffset);
        container.setDepth((troop.depth ?? (BLOCKDEPTH + 1)) + 3);
        container.icon.setTexture(visual.iconKey);
        container.setVisible(true);

        container.badgeBg.setVisible(visual.showCount);
        container.countText.setVisible(visual.showCount);

        if (visual.showCount) {
            container.countText.setText(`${visual.count}`);
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
                cube.health = Math.min(cube.maxHealth, cube.health + 30);
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
                cube.clearTint();
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
        });

        // Add a pointerout event listener to revert texture when not hovered
        cube.on('pointerout', (pointer) => {
            Player.setMiniBarHover(cube, false);
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
            if (sprite.poseLock?.textureKey) {
                sprite.body.setVelocity(0, 0);
                sprite.rotation = 0;
                sprite.anims?.stop?.();
                if (sprite.texture?.key !== sprite.poseLock.textureKey) {
                    sprite.setTexture(sprite.poseLock.textureKey);
                }
                if (Number.isInteger(sprite.poseLock.frame)) {
                    sprite.setFrame(sprite.poseLock.frame);
                }
                PathDebugDrawer.onPathEnd(sprite);
                return;
            }
            this.setAnimState(sprite, sprite.idle);
            updateDirectionalAnimationFromVelocity(sprite, 0, 0, false);
            PathDebugDrawer.onPathEnd(sprite); // optional cleanup
            return;
        }
        
        // ✅ Gunslinger: if we're in destroy mode and we already have range + LOS, stop pathing and start firing
        if (
        sprite?.active &&
        sprite.isGunslinger &&
        sprite.task &&
        (sprite.state === CONTROL_STATES.DESTROY_MODE || sprite.state === CONTROL_STATES.DESTROY_MODE_T)
        ) {
            const ok = sprite._canShootDestroyTarget?.();
            if (ok) {
                sprite.body.setVelocity(0, 0);
                sprite.currentPath.length = 0; // stop pathing but keep the path data for now (so we can resume if LOS breaks)
                // keep path intact (so if LOS breaks we can resume), but start action now
                this.doAction(sprite);
                return;
            }
        }

        // 3) Normal movement logic
        // Player.js - inside followPath(), in the "Normal movement logic" section
        PathRegistry.updateUnitProgress(sprite.body.team ? Map.navMesh : Map.enemyNavMesh, sprite, new Phaser.Math.Vector2(sprite.x, sprite.y));
        // after movement update, each tick while walking
        PathDebugDrawer.tickUnit(sprite, this.scene.time.now);
        this.setAnimState(sprite, sprite.walk);
        let nextPoint = sprite.currentPath[0];
        // Team 0 units (raiders/grunts) do not use stamina for movement.
        const baseSpeed = sprite?.type?.speed ?? sprite.speed ?? 0;
        let currentSpeed = baseSpeed;
        if (sprite.body.team === 1) {
            const maxStamina = Number(sprite.maxStamina) > 0 ? Number(sprite.maxStamina) : 100;
            const stamina = Number.isFinite(Number(sprite.stamina)) ? Number(sprite.stamina) : maxStamina;
            const staminaFactor = Math.max(0.2, stamina / maxStamina);
            currentSpeed = baseSpeed * staminaFactor;

            if (!sprite.roam && stamina > 0) {
                const drain = Number(sprite?.type?.stamina) || 0;
                sprite.stamina = Math.max(0, stamina - drain);
            }
        }

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
        updateDirectionalAnimationFromVelocity(sprite, newVelocity.x, newVelocity.y, true);
        AudioManager.tryPlayStep(sprite);
        // Rotate the sprite to face the direction of movement
        if (newVelocity.length() > 0 && !shouldUseDirectionalFacing(sprite)) {
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

        // Release any currently claimed job through the centralized task interrupt flow.
        // This keeps TaskBoard/assigned counters consistent with the new system.
        InterruptController.interruptTroop(chosen, "manual_attack_assignment", CONTROL_STATES.TRACK_MODE);

        // 🔒 Mark this as a “hard assignment” target
        chosen.forcedTarget = targetSprite;
        const playerTeam = Teams.teamLists["1"];
        if (playerTeam?.fightingList) {
            const exists = playerTeam.fightingList.some(t => {
                const tgt = t?.target || t;
                return tgt === targetSprite;
            });
            if (!exists) {
                playerTeam.fightingList.push({
                    x: targetSprite.x,
                    y: targetSprite.y,
                    body: targetSprite.body,
                    target: targetSprite,
                    assigned: 0,
                    forced: true,
                });
            }
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
        const regionSystem = troop.body.team === 0 ? Map.enemyRegionSystem : Map.regionSystem;
        const canReachTarget = (body) => {
            if (!body) return false;
            if (!regionSystem?.canReachWorldToWorld) return true;
            return regionSystem.canReachWorldToWorld(troop.x, troop.y, body.x, body.y);
        };
        // troop.state == CONTROL_STATES.TRACK_TARGET ? search = false : search = true;
        if(search){
            // Troop position
            const troopPosition = new Phaser.Math.Vector2(troop.x, troop.y);

            neighbours.forEach(neighbour => {
                if (neighbour === troop.body || neighbour.team == troop.body.team || (neighbour.gameObject && !neighbour.gameObject.active) || neighbour.dontTrack) return; // Ignore itself or untrackable neighbors
                if (!canReachTarget(neighbour)) return;

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
            const trackedBody = (troop.track[0] === mostClosest) ? mostClosest : troop.track[0];
            if (!canReachTarget(trackedBody)) {
                troop.track = null;
                return false;
            }

            const go = trackedBody?.gameObject;
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
            if (!canReachTarget(mostClosest)) return false;
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
        const changed = troop.animState != state;
        troop.animState = state;

        if (syncDirectionalAnimationState(troop, state)) {
            return;
        }

        if (changed) {
            troop.play(state)
        }
    }

    static setPoseLock(troop, textureKey, frame = null) {
        if (!troop || !textureKey) return;
        troop.poseLock = { textureKey, frame };
        troop.rotation = 0;
        troop.anims?.stop?.();
        troop.setTexture(textureKey);
        if (Number.isInteger(frame)) {
            troop.setFrame(frame);
        }
    }

    static clearPoseLock(troop, fallbackState = null) {
        if (!troop) return;
        troop.poseLock = null;
        if (fallbackState && troop.active) {
            this.setAnimState(troop, fallbackState);
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
                    troop.clearTint();
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
        if (troop.state === targetState) return;
        InterruptController.interruptTroop(troop, "state_interrupt", targetState);
    }

    static _isFighterUnit(troop) {
        return !!(troop?.isBrawler || troop?.isBlademaster || troop?.isGunslinger || troop?.isFortGrunt);
    }

    static _cleanupCombatTicketForTarget(teamNumber, target) {
        const list = Teams.teamLists?.[`${teamNumber}`]?.fightingList;
        if (!Array.isArray(list) || !target) return;
        for (let i = list.length - 1; i >= 0; i--) {
            const t = list[i];
            const tgt = t?.target || t;
            if (!tgt?.active || tgt === target) list.splice(i, 1);
        }
    }

    static _clearInvalidForcedTarget(troop) {
        const target = troop.forcedTarget;
        if (!target) return false;
        if (target?.active && target?.body) return false;
        if (target) this._cleanupCombatTicketForTarget(troop.body.team, target);
        troop.forcedTarget = null;
        if (troop.track && troop.state === CONTROL_STATES.TRACK_TARGET) {
            troop.track = null;
            troop.currentPath?.splice?.(0);
            troop.body?.setVelocity?.(0, 0);
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        }
        return true;
    }

    static _isAttackReady(troop, target) {
        if (!troop?.weapon || !target?.active) return false;
        const inRange = Phaser.Math.Distance.Between(troop.x, troop.y, target.x, target.y) <= troop.weapon.range;
        if (!inRange) return false;
        if (troop.weapon.projectile && !Projectile.hasLineOfSight(troop, target)) return false;
        return true;
    }

    static _syncTrackToTarget(troop, target) {
        let movedTile = true;
        if (!troop.track || troop.track[0] !== target.body) {
            troop.track = [target.body, { x: target.x, y: target.y }];
            movedTile = true;
        } else {
            const lastTileX = Math.floor(troop.track[1].x / SQUARESIZE);
            const lastTileY = Math.floor(troop.track[1].y / SQUARESIZE);
            const curTileX = Math.floor(target.x / SQUARESIZE);
            const curTileY = Math.floor(target.y / SQUARESIZE);
            movedTile = lastTileX !== curTileX || lastTileY !== curTileY;
            troop.track[1].x = target.x;
            troop.track[1].y = target.y;
        }
        return movedTile;
    }

    static _computeTargetFootprint(target) {
        const b = target?.buildingRef;
        if (b && Number.isFinite(b.x) && Number.isFinite(b.y)) {
            const lenX = Number(b.tileType?.lenX ?? b.lenX ?? 1);
            const lenY = Number(b.tileType?.lenY ?? b.lenY ?? 1);
            return { x: b.x, y: b.y, w: lenX, h: lenY };
        }

        // Scheduler can pass the building object directly (not the sprite).
        // Those x/y values are tile coordinates, not world pixels.
        if (
            Number.isFinite(target?.x) &&
            Number.isFinite(target?.y) &&
            !target?.body &&
            (
                Number.isFinite(target?.tileType?.lenX) ||
                Number.isFinite(target?.lenX) ||
                typeof target?.onDamaged === "function"
            )
        ) {
            const lenX = Number(target.tileType?.lenX ?? target.lenX ?? 1);
            const lenY = Number(target.tileType?.lenY ?? target.lenY ?? 1);
            return { x: target.x, y: target.y, w: lenX, h: lenY };
        }

        if (target?.tilePos && Number.isFinite(target.tilePos.tileX) && Number.isFinite(target.tilePos.tileY)) {
            return { x: target.tilePos.tileX, y: target.tilePos.tileY, w: 1, h: 1 };
        }

        if (Number.isFinite(target?.sx) && Number.isFinite(target?.sy)) {
            return { x: target.sx, y: target.sy, w: Number(target.lenX ?? 1), h: Number(target.lenY ?? 1) };
        }

        const tx = Math.floor((target?.x ?? 0) / SQUARESIZE);
        const ty = Math.floor((target?.y ?? 0) / SQUARESIZE);
        return { x: tx, y: ty, w: 1, h: 1 };
    }

    static _ensureFriendlySiegePlanner() {
        if (!Map.playerSiegePlanner) {
            Map.playerSiegePlanner = new SiegePlanner({
                squareSize: SQUARESIZE,
                enemyNavGrid: Map.navGrid,
                isBreachableTile: (tx, ty) => {
                    const cell = Map.grid?.[ty]?.[tx];
                    if (!cell) return false;
                    const top = Array.isArray(cell) ? cell[1] : cell;
                    const name = TILE_MAP(top);
                    return name === "woodWall" || name === "woodWall_door" || name === "wall" || name === "wall_door";
                },
                isHardBlockedTile: () => false,
                regionSystem: Map.regionSystem
            });
        }
        return Map.playerSiegePlanner;
    }

    static _planBreachTicketsForTarget(troop, target) {
        if (!troop?.active || troop.body?.team !== 1 || !this._isFighterUnit(troop)) return false;
        const now = troop.scene?.time?.now ?? 0;
        if (troop._nextBreachPlanAt && now < troop._nextBreachPlanAt) return false;
        troop._nextBreachPlanAt = now + 500;

        const fp = this._computeTargetFootprint(target);
        const gridH = Map.navGrid?.length ?? 0;
        const gridW = gridH ? (Map.navGrid[0]?.length ?? 0) : 0;
        if (!gridW || !gridH) return false;

        const perimeter = SiegePlanner.buildPerimeterTargets(fp.x, fp.y, fp.w, fp.h, gridW, gridH);
        const planner = this._ensureFriendlySiegePlanner();
        const breachTiles = planner?.planBreach?.(troop.x, troop.y, perimeter);
        if (!breachTiles?.length) return false;

        const team = Teams.teamLists["1"];
        if (!team?.enemyDestroyTileStates) return false;
        if (!team._breachSeen) team._breachSeen = new Set();

        let added = 0;
        for (const t of breachTiles) {
            const cell = Map.grid?.[t.y]?.[t.x];
            if (cell == null) continue;
            const top = Array.isArray(cell) ? cell[1] : cell;
            const typeName = TILE_MAP(top);
            if (typeName !== "wall" && typeName !== "woodWall" && typeName !== "wall_door" && typeName !== "woodWall_door") continue;

            const key = `${t.x},${t.y}`;
            if (team._breachSeen.has(key)) continue;
            team._breachSeen.add(key);

            team.enemyDestroyTileStates.push({
                x: t.x,
                y: t.y,
                duration: 400,
                assigned: 0,
                forced: !!troop.forcedTarget,
                type: TILE_TYPES[typeName],
            });
            added++;
        }

        if (!added) return false;
        if (!troop.task) {
            Manager.assignOneTroopToAction(troop, team.enemyDestroyTileStates, CONTROL_STATES.DESTROY_MODE_T);
        }
        return true;
    }

    static _chaseOrBreachTarget(troop, target, shouldRepath = true) {
        if (!target?.active || !target?.body) return false;
        if (!shouldRepath && troop.currentPath?.length) return false;

        const path = Player.pathTo(troop, target.x, target.y, false);
        if (path?.length) {
            Player.moveTo(troop, path);
            return true;
        }

        troop.currentPath = [];
        troop.body?.setVelocity?.(0, 0);
        this._planBreachTicketsForTarget(troop, target);
        return false;
    }

    static updateTracking(troop){
        const fallbackDist = troop.body.team ? 100 : 20;
        const awareness = troop?.awareness ?? troop?.type?.awareness;
        const overlapDist = Number.isFinite(awareness) ? awareness : fallbackDist;
        const neighbours = Player.scene.physics.overlapCirc(troop.x, troop.y, overlapDist);
        const hasWeapon = !!troop.weapon;

        const isObjectiveTaskState =
            troop.state === CONTROL_STATES.DESTROY_MODE ||
            troop.state === CONTROL_STATES.DESTROY_MODE_T ||
            troop.state === CONTROL_STATES.SIEGE_MODE ||
            troop.state === CONTROL_STATES.FIX_BUILDING;

        if (troop.task && isObjectiveTaskState) {
            const isPlayerFighter = troop.body?.team === 1 && this._isFighterUnit(troop) && hasWeapon;
            if (!isPlayerFighter) return;

            // Player fighters should defend themselves first, then resume objective work via scheduler.
            const immediateThreat = this.findClosestEnemyBody(troop, neighbours);
            if (!immediateThreat) return;

            Player.handleStateIntteruptStart(troop, CONTROL_STATES.TRACK_TARGET);
            troop.track = [
                immediateThreat,
                { x: immediateThreat.x, y: immediateThreat.y }
            ];
            troop.roam = false;
        }

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

        if (this._clearInvalidForcedTarget(troop)) return;

        if (troop.forcedTarget) {
            const target = troop.forcedTarget;
            const movedTile = this._syncTrackToTarget(troop, target);
            troop.roam = false;
            if (troop.state !== CONTROL_STATES.ATTACK_MODE) {
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_TARGET);
            }

            if (this._isAttackReady(troop, target)) {
                troop.currentPath?.splice?.(0);
                troop.body?.setVelocity?.(0, 0);
                return;
            }

            if (troop.isGunslinger) {
                const kiteDest = this.computeKiteDestination(troop, target, troop.weapon);
                if (kiteDest) {
                    const path = Player.pathTo(troop, kiteDest.x, kiteDest.y, false);
                    if (path?.length) {
                        Player.moveTo(troop, path);
                        return;
                    }
                }
            }

            this._chaseOrBreachTarget(troop, target, movedTile || !troop.currentPath?.length);
            return;
        }

        const hasTrackedEnemy = this.mostClosestEnemy(troop, neighbours);
        const trackedGO = troop.track?.[0]?.gameObject;
        if (!trackedGO?.active) {
            troop.track = null;
            if (troop.state === CONTROL_STATES.TRACK_TARGET) {
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            }
            return;
        }
        if (!hasTrackedEnemy && troop.state === CONTROL_STATES.TRACK_TARGET && !troop.track) {
            troop.currentPath?.splice?.(0);
            troop.body?.setVelocity?.(0, 0);
            Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
            return;
        }

        troop.roam = false;
        if (this._isAttackReady(troop, trackedGO)) {
            troop.currentPath?.splice?.(0);
            troop.body?.setVelocity?.(0, 0);
            return;
        }

        if (troop.isGunslinger) {
            const kiteDest = this.computeKiteDestination(troop, trackedGO, troop.weapon);
            if (kiteDest) {
                const path = Player.pathTo(troop, kiteDest.x, kiteDest.y, false);
                if (path?.length) {
                    Player.moveTo(troop, path);
                    return;
                }
            }
        }

        this._chaseOrBreachTarget(troop, trackedGO, hasTrackedEnemy || !troop.currentPath?.length);
    }

    static _tileTypeAtWorld(x, y) {
        const gx = Math.floor(x / SQUARESIZE);
        const gy = Math.floor(y / SQUARESIZE);
        const row = Map.grid?.[gy];
        if (!row) return null;
        const cell = row[gx];
        if (cell == null) return null;
        if (Array.isArray(cell)) {
            const top = cell[1];
            if (top != null) return TILE_MAP(top);
            return TILE_MAP(cell[0]);
        }
        return TILE_MAP(cell);
    }

    static _isOnWater(troop) {
        return this._tileTypeAtWorld(troop.x, troop.y) === "water";
    }

    static _nearestWalkableWorld(troop, maxRadius = 80) {
        const gx0 = Math.floor(troop.x / SQUARESIZE);
        const gy0 = Math.floor(troop.y / SQUARESIZE);
        const { navGrid } = this._getNavForTroop(troop);
        if (!navGrid?.length) return null;

        const h = navGrid.length;
        const w = navGrid[0]?.length || 0;
        let best = null;
        let bestD2 = Infinity;
        const pushIfWalkable = (gx, gy) => {
            if (gx < 0 || gy < 0 || gx >= w || gy >= h) return;
            if (navGrid[gy][gx] !== 1) return;
            const wx = gx * SQUARESIZE + SQUARESIZE / 2;
            const wy = gy * SQUARESIZE + SQUARESIZE / 2;
            const dx = wx - troop.x;
            const dy = wy - troop.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                best = { x: wx, y: wy };
            }
        };

        for (let r = 1; r <= maxRadius; r++) {
            const minx = gx0 - r;
            const maxx = gx0 + r;
            const miny = gy0 - r;
            const maxy = gy0 + r;
            for (let gx = minx; gx <= maxx; gx++) {
                pushIfWalkable(gx, miny);
                pushIfWalkable(gx, maxy);
            }
            for (let gy = miny + 1; gy <= maxy - 1; gy++) {
                pushIfWalkable(minx, gy);
                pushIfWalkable(maxx, gy);
            }
            if (best) return best;
        }
        return null;
    }

    static _resumeAfterWaterInterrupt(troop, resume) {
        if (!troop?.active || !troop?.body) return;

        if (resume?.state != null) {
            Teams.movePlayerState(troop, resume.state);
        }

        // Prefer original final world goal.
        if (resume?.finalPos?.x != null && resume?.finalPos?.y != null) {
            const path = this.pathTo(troop, resume.finalPos.x, resume.finalPos.y, false);
            if (path?.length) {
                this.moveTo(troop, path);
                return;
            }
        }

        // Fallbacks by intent.
        if (troop.state === CONTROL_STATES.BACK_TO_TOWN) {
            Teams.sendTroopToTown(troop);
            return;
        }

        if (troop.forcedTarget?.active) {
            const path = this.pathTo(troop, troop.forcedTarget.x, troop.forcedTarget.y, false);
            if (path?.length) this.moveTo(troop, path);
            return;
        }

        const tracked = troop.track?.[0]?.gameObject;
        if (tracked?.active) {
            const path = this.pathTo(troop, tracked.x, tracked.y, false);
            if (path?.length) this.moveTo(troop, path);
            return;
        }

        if (troop.task && Number.isFinite(troop.task.x) && Number.isFinite(troop.task.y)) {
            const path = this.pathTo(troop, troop.task.x, troop.task.y, true);
            if (path?.length) this.moveTo(troop, path);
        }
    }

    static _handleWaterReturnSwim(troop) {
        if (!troop?.active || !troop?.body) return false;
        if (troop.body.team !== 1) return false;

        const onWater = this._isOnWater(troop);
        const swimming = troop._returnSwimActive === true;
        if (!onWater && !swimming) return false;

        if (onWater && !swimming) {
            troop._returnSwimResume = {
                state: troop.state,
                finalPos: troop.finalPos ? { x: troop.finalPos.x, y: troop.finalPos.y } : null,
            };
            troop._returnSwimActive = true;
            troop._returnSwimTarget = this._nearestWalkableWorld(troop);
            troop.currentPath?.splice?.(0);
            troop.body.setVelocity(0, 0);
        }

        if (!troop._returnSwimTarget) {
            troop._returnSwimTarget = this._nearestWalkableWorld(troop);
        }
        const target = troop._returnSwimTarget;
        if (!target) {
            this.setAnimState(troop, troop.idle);
            troop.body.setVelocity(0, 0);
            return true;
        }

        const dx = target.x - troop.x;
        const dy = target.y - troop.y;
        const dist = Math.hypot(dx, dy);

        if (!onWater) {
            const resume = troop._returnSwimResume || null;
            troop._returnSwimActive = false;
            troop._returnSwimTarget = null;
            troop._returnSwimResume = null;
            troop.body.setVelocity(0, 0);
            this._resumeAfterWaterInterrupt(troop, resume);
            return true;
        }

        const speedBase = troop?.type?.speed ?? troop.speed ?? 90;
        const swimSpeed = Math.max(60, speedBase * 0.85);
        const inv = dist > 0.001 ? 1 / dist : 0;
        const vx = dx * inv * swimSpeed;
        const vy = dy * inv * swimSpeed;

        this.setAnimState(troop, troop.swim || troop.idle);
        troop.body.setVelocity(vx, vy);
        if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
            troop.rotation = Phaser.Math.Angle.Between(0, 0, vx, vy);
        }
        return true;
    }

    static update(){
        this.troops.forEach( troop => {
            if (Player.scene.clock.paused) {
                troop.body.setVelocity(0, 0);
                this._updateCarryIndicator(troop);
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
            else if (troop.isFortGrunt) {
                FortGrunt.update(troop);
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

            if (this._handleWaterReturnSwim(troop)) {
                this._updateMiniBars(troop);
                this._updateCarryIndicator(troop);
                return;
            }

            StaminaManager.updateTroop(troop);
            if (troop.state != CONTROL_STATES.SLEEP_MODE) {
                this.followPath(troop);
            }

            // 🔥 update world mini HP/ST bars
            this._updateMiniBars(troop);
            this._updateCarryIndicator(troop);
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

    static getRoleTint(cube) {
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
            case cube.isFortGrunt:
                tint = 0x8b0000;
                break;
            case cube.body.team === 1:
                tint = 0x64ff32; // Green for your team
                break;
            default:
                tint = 0xff0000; // Red for others
                break;
        }

        return tint;
    }

    static applyRoleTint(cube) {
        const tint = this.getRoleTint(cube);
        if (cube?.setTint && tint != null) {
            cube.setTint(tint);
        }
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

    troop._hpSegBg = [];
    troop._hpSegFill = [];
    troop._stSegBg = [];
    troop._stSegFill = [];

    troop._miniBarsSegCap = 0;
    troop._miniBarsInit = true;
    }

    static _rebuildMiniBarSegments(troop, segCap) {
    const scene = this.scene;
    const H = this.MINI_BAR_HEIGHT;
    const pad = this.MINI_BAR_PAD;

    const isEnemy = troop.body?.team === 0;
    const hpFillColor = isEnemy ? 0xff3333 : 0x00ff00;
    const stFillColor = 0x0088ff;

    const mkBg = () => scene.add.rectangle(0, 0, 1, H, 0x000000, 0.75)
        .setOrigin(0, 0.5)
        .setDepth(BLOCKDEPTH + 2)
        .setStrokeStyle(1, 0xffffff, 0.25);

    const mkFill = (fillColor) => scene.add.rectangle(0, 0, 1, H - pad, fillColor, 1)
        .setOrigin(0, 0.5)
        .setDepth(BLOCKDEPTH + 3);

    while ((troop._miniBarsSegCap || 0) < segCap) {
        const hpBg = mkBg();
        const hpFill = mkFill(hpFillColor);
        troop._hpSegBg.push(hpBg);
        troop._hpSegFill.push(hpFill);

        // stamina only for friendlies (reduces clutter)
        if (!isEnemy) {
        const stBg = mkBg();
        const stFill = mkFill(stFillColor);
        troop._stSegBg.push(stBg);
        troop._stSegFill.push(stFill);
        }

        troop._miniBarsSegCap++;
    }

    for (let i = 0; i < troop._miniBarsSegCap; i++) {
        troop._hpSegBg[i]?.setVisible(false);
        troop._hpSegFill[i]?.setVisible(false);
        troop._stSegBg[i]?.setVisible(false);
        troop._stSegFill[i]?.setVisible(false);
    }
    }

    static _destroyMiniBars(troop) {
    const kill = (arr) => {
        if (!arr) return;
        for (const o of arr) o?.destroy?.();
    };

    kill(troop._hpSegBg);
    kill(troop._hpSegFill);
    kill(troop._stSegBg);
    kill(troop._stSegFill);

    troop._hpSegBg = null;
    troop._hpSegFill = null;
    troop._stSegBg = null;
    troop._stSegFill = null;

    troop._miniBarsSegCap = 0;
    troop._miniBarsInit = false;
    }

    static _layoutSegmentBar({ bgArr, fillArr, xLeft, y, totalW, cur, max, segUnit, gap, pad, segCap }) {
    const safeMax = Math.max(0.0001, Number(max) || 0);
    const safeCur = Phaser.Math.Clamp(Number(cur) || 0, 0, safeMax);

    const segCount = Math.max(1, Math.ceil(safeMax / segUnit));
    const lastFrac = Phaser.Math.Clamp((safeMax % segUnit) / segUnit || 1, 0.05, 1);

    const innerW = Math.max(1, totalW - pad * 2);
    const baseSegW = (innerW - (segCount - 1) * gap) / segCount;

    // drain capacity so the last segment truncation behaves naturally
    let remaining = safeCur;

    for (let i = 0; i < segCap; i++) {
        const show = i < segCount;
        const bg = bgArr?.[i];
        const fill = fillArr?.[i];
        if (!bg || !fill) continue;

        if (!show) {
        bg.setVisible(false);
        fill.setVisible(false);
        continue;
        }

        const isLast = i === segCount - 1;
        const segW = baseSegW * (isLast ? lastFrac : 1);
        const segX = xLeft + pad + i * (baseSegW + gap);

        bg.setPosition(segX, y);
        bg.width = segW;
        bg.setVisible(true);

        const segCapVal = segUnit * (isLast ? lastFrac : 1);
        const ratio = Phaser.Math.Clamp(remaining / segCapVal, 0, 1);
        const fillW = segW * ratio;

        fill.setPosition(segX, y);
        fill.width = fillW;
        fill.setVisible(fillW > 0.25);

        remaining -= segCapVal;
    }
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
        for (let i = 0; i < (troop._miniBarsSegCap || 0); i++) {
            troop._hpSegBg?.[i]?.setVisible(false);
            troop._hpSegFill?.[i]?.setVisible(false);
            troop._stSegBg?.[i]?.setVisible(false);
            troop._stSegFill?.[i]?.setVisible(false);
        }
        }
        return;
    }

    this._ensureMiniBars(troop);

    const H = this.MINI_BAR_HEIGHT;
    const segUnit = this.MINI_BAR_SEG_UNIT;
    const gap = this.MINI_BAR_GAP;
    const pad = this.MINI_BAR_PAD;

    const isEnemy = troop.body?.team === 0;

    // type caps
    const maxHP = troop.maxHealth ?? (troop.body?.team === 1 ? 200 : 100);
    const maxST = troop.maxStamina ?? troop.maxStaminaValue ?? 100;

    // bar length scales by the *larger* of HP/ST, so both bars match length
    const maxForSize = isEnemy ? maxHP : Math.max(maxHP, maxST);

    const sizeSegCount = Math.max(1, Math.ceil(maxForSize / segUnit));
    let totalW = sizeSegCount * this.MINI_BAR_BASE_SEG_W + (sizeSegCount - 1) * gap + pad * 2;
    if (totalW > this.MINI_BAR_MAX_W) totalW = this.MINI_BAR_MAX_W;

    if ((troop._miniBarsSegCap || 0) < sizeSegCount) {
        this._rebuildMiniBarSegments(troop, sizeSegCount);
    }

    const baseX = troop.x;
    const baseY = troop.y + (troop.displayHeight || SQUARESIZE) / 2 + this.MINI_BAR_OFFSET_Y;
    const xLeft = baseX - totalW / 2;

    // HP: always visible when shouldShow
    this._layoutSegmentBar({
        bgArr: troop._hpSegBg,
        fillArr: troop._hpSegFill,
        xLeft,
        y: baseY,
        totalW,
        cur: troop.health ?? 0,
        max: maxHP,
        segUnit,
        gap,
        pad,
        segCap: troop._miniBarsSegCap || 0
    });

    // Stamina: friendlies only
    if (!isEnemy) {
        this._layoutSegmentBar({
        bgArr: troop._stSegBg,
        fillArr: troop._stSegFill,
        xLeft,
        y: baseY + H + 2,
        totalW,
        cur: troop.stamina ?? 0,
        max: maxST,
        segUnit,
        gap,
        pad,
        segCap: troop._miniBarsSegCap || 0
        });
    } else {
        for (let i = 0; i < (troop._miniBarsSegCap || 0); i++) {
        troop._stSegBg?.[i]?.setVisible(false);
        troop._stSegFill?.[i]?.setVisible(false);
        }
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

static onWallDestroyed(troop, task) {
  const teamNumber = troop.body.team;
  Teams.removeFromStateArray(teamNumber, "enemyDestroyTileStates", task);

  troop.task = null;
  if (troop.timer) { troop.timer.remove(false); troop.timer = null; }
  troop.play(troop.idle);
  Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
}

static onBlockDestroyed(troop, task) {
  const teamNumber = troop.body.team;
  Teams.removeFromStateArray(teamNumber, "enemyDestroyStates", task);

  troop.task = null;
  if (troop.timer) { troop.timer.remove(false); troop.timer = null; }
  troop.play(troop.idle);
  Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
}

      
}
