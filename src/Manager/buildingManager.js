import { Player } from "../players/Player"
import { Teams } from "../Teams"
import { Map } from "../map"
import { BLOCKDEPTH, colorFor, CONTROL_STATES, showGhostText, SQUARESIZE, TILE_TYPES, UIDEPTH } from "../constants"
import { Manager } from "./Manager"
import { buildingArray } from "../town"
import { ClayOven } from "../buildings/ClayOven"
import { StorageBuilding } from "../buildings/Storage"
import { House } from "../buildings/House"
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker"
import { UI_ITEM_TYPES } from "../UI/UIConstants"

export class buildingManager{

    static NavMeshUpdater;
    static scene;
    static blockBuildingDuration = 250;

    static createBuildTileStateArray(tiles, teamNumber) {
        const team = Teams.teamLists[teamNumber];
        // make sure buildingTileStates is an array
        if (!Array.isArray(team.buildingTileStates)) {
          team.buildingTileStates = [];
        }
      
        tiles.forEach(tile => {
          team.buildingTileStates.push({
            x: tile.x,
            y: tile.y,
            assigned: 0,
            buildType: TILE_TYPES.wall
          });
        });
    }

    static assingTroopsToBuildTile(teamNumber){
        let buildList = Teams.teamLists[`${teamNumber}`].buildingTileStates
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].builderList ;
        Manager.assignTroopsToAction(troops, buildList, CONTROL_STATES.BUILD_MODE_T, force);
    }

    static findBuildApproachTile(buildX, buildY, troop) {
        const directions = [
            [0, -1], [0, 1], [1, 0], [-1, 0],         // Cardinal (1 away)
            [-1, -1], [1, -1], [-1, 1], [1, 1],       // Diagonal (1 away)
            [0, -2], [0, 2], [2, 0], [-2, 0],         // Cardinal (2 away)
            [-2, -1], [-2, 1], [2, -1], [2, 1],       // Extended Diagonal (2 away)
            [-1, -2], [1, -2], [-1, 2], [1, 2],
        ];

        let troopX = Math.floor(troop.x/SQUARESIZE)
        let troopY = Math.floor(troop.y/SQUARESIZE)
        if(!Map.navGrid[troopX][troopY]){
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) {
                console.log("No valid start tile nearby");
            } else {
                troopX = newX;
                troopY = newY;
                console.log("New valid tile:", newX, newY);
            }
        }
    
    
        // 1. Build list of candidate tiles with distances
        let candidates = [];
        for (const [dx, dy] of directions) {
            const tx = buildX + dx;
            const ty = buildY + dy;
    
            if (tx < 0 || ty < 0 || ty >= Map.navGrid.length || tx >= Map.navGrid[0].length) continue;
            if (!Map.navGrid[ty][tx]) continue; // Not walkable
    
            const worldX = tx * SQUARESIZE + SQUARESIZE / 2;
            const worldY = ty * SQUARESIZE + SQUARESIZE / 2;
            const dist = Phaser.Math.Distance.Between(troop.x, troop.y, worldX, worldY);
    
            candidates.push({ tx, ty, dist });
        }
    
        // 2. Sort candidates by distance ascending
        candidates.sort((a, b) => a.dist - b.dist);
    
        // 3. Try candidates one by one
        for (const candidate of candidates) {
            const path = Map.navMesh.findPath(
                { x: troopX*SQUARESIZE, y: troopY*SQUARESIZE },
                { x: candidate.tx * SQUARESIZE + SQUARESIZE / 2, y: candidate.ty * SQUARESIZE + SQUARESIZE / 2 }
            );
    
            if (path && path.length > 0) {
                return { tx: candidate.tx, ty: candidate.ty, path };
            }
            // else try next one
        }
    
        return null; // ❌ No valid approach found
    }

    static beginBuilding(troop){
        if(!buildingManager.scene.checkSufficientFunds(troop.task.buildType.price)){return}
        buildingManager.scene.updateMoney(-1*troop.task.buildType.price);
        const x = troop.task.x;
        const y = troop.task.y;
        Map.navGrid[y][x] = 0;
        this.NavMeshUpdater.blockTile(x,y);
        Map.placeTile(x,y,troop.task.buildType.name);
        Teams.removeFromStateArray(1, "buildingTileStates", troop.task);
        troop.task = null;
        Manager.assignOneTroopToAction(troop, Teams.teamLists[1].buildingTileStates, CONTROL_STATES.BUILD_MODE_T);
    }

    static assignTroopToBuildBlock(teamNumber){
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].builderList;
        let blockList = Teams.teamLists[`${teamNumber}`].blockBuildingStates
        Manager.assignTroopsToAction(troops, blockList, CONTROL_STATES.BUILD_MODE_B, force);
        if(Map.isPlacing){
            Map.isPlacing = false; // Exit placing mode
            Map.placingItem.destroy(); // Clear placing item
            Map.placingItem = null;
        }
    }

    // Is there at least one walkable perimeter tile around the block footprint?
    static isBlockAccessible(x, y, type) {
        // perimeter around [x..x+lenX-1] × [y..y+lenY-1]
        for (let dy = -1; dy <= type.lenY; dy++) {
            for (let dx = -1; dx <= type.lenX; dx++) {
            const tx = x + dx;
            const ty = y + dy;

            const inside = (dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY);
            if (inside) continue;

            if (ty < 0 || tx < 0 || ty >= Map.navGrid.length || tx >= Map.navGrid[0].length) continue;
                if (Map.navGrid[ty][tx]) {
                    // found at least one walkable tile adjacent to the block
                    return true;
                }
            }
        }
        return false;
    }

    static findBuildApproachBlock(x, y, type, troop, tStartX = null, tStartY = null) {
        const candidates = [];

        // Top-left of block footprint
        const startX = x;
        const startY = y;

        // 1) Collect all walkable perimeter tiles (as before)
        for (let dy = -1; dy <= type.lenY; dy++) {
            for (let dx = -1; dx <= type.lenX; dx++) {
                const tx = startX + dx;
                const ty = startY + dy;

                const isInsideBlock = dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY;
                if (isInsideBlock) continue;

                if (tx < 0 || ty < 0 || ty >= Map.navGrid.length || tx >= Map.navGrid[0].length) continue;
                if (!Map.navGrid[ty][tx]) continue; // Not walkable

                const worldX = tx * SQUARESIZE + SQUARESIZE / 2;
                const worldY = ty * SQUARESIZE + SQUARESIZE / 2;
                let dist;
                if (troop) {
                    dist = Phaser.Math.Distance.Between(troop.x, troop.y, worldX, worldY);
                } else {
                    dist = Phaser.Math.Distance.Between(
                        tStartX * SQUARESIZE + SQUARESIZE / 2,
                        tStartY * SQUARESIZE + SQUARESIZE / 2,
                        worldX,
                        worldY
                    );
                }
                candidates.push({ tx, ty, dist });
            }
        }

        // 2) Resolve starting world position (troop or explicit)
        if (tStartX == null || tStartY == null) {
            let troopX = Math.floor(troop.body.x / SQUARESIZE);
            let troopY = Math.floor(troop.body.y / SQUARESIZE);
            tStartX = troop.body.x;
            tStartY = troop.body.y;

            if (!Map.navGrid[troopY]?.[troopX]) {
                const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                if (newX === -1) {
                    console.log("No valid start tile nearby");
                    return null;
                } else {
                    tStartX = newX * SQUARESIZE + SQUARESIZE / 2;
                    tStartY = newY * SQUARESIZE + SQUARESIZE / 2;
                    console.log("New valid tile:", newX, newY);
                }
            }
        } else {
            tStartX = tStartX * SQUARESIZE + SQUARESIZE / 2;
            tStartY = tStartY * SQUARESIZE + SQUARESIZE / 2;
        }

        // 🔥 3) Prefer "door" tile: bottom-center of the block
        //    Imagine door on bottom edge in y, centered in x.
        const doorDx = Math.floor(type.lenX / 2);          // center in X
        const doorTx = startX + doorDx;
        const doorTy = startY + type.lenY;                 // just below bottom edge

        if (
            doorTx >= 0 && doorTy >= 0 &&
            doorTy < Map.navGrid.length &&
            doorTx < Map.navGrid[0].length &&
            Map.navGrid[doorTy][doorTx]            // must be walkable
        ) {
            const doorWorldX = doorTx * SQUARESIZE + SQUARESIZE / 2;
            const doorWorldY = doorTy * SQUARESIZE + SQUARESIZE / 2;

            const doorPath = Map.navMesh.findPath(
                { x: tStartX, y: tStartY },
                { x: doorWorldX, y: doorWorldY }
            );

            if (doorPath && doorPath.length > 0) {
                // ✅ Path straight to the "door"
                return { tx: doorTx, ty: doorTy, path: doorPath };
            }
        }

        // 4) Fallback: previous behaviour, closest perimeter candidate
        candidates.sort((a, b) => a.dist - b.dist);

        for (const candidate of candidates) {
            const path = Map.navMesh.findPath(
                { x: tStartX, y: tStartY },
                {
                    x: candidate.tx * SQUARESIZE + SQUARESIZE / 2,
                    y: candidate.ty * SQUARESIZE + SQUARESIZE / 2
                }
            );

            if (path && path.length > 0) {
                return { tx: candidate.tx, ty: candidate.ty, path };
            }
        }

        return null; // ❌ No valid path found
    }

    static findApproachAnyPerimeter(x, y, type, troop, tStartX = null, tStartY = null) {
        const candidates = [];
        const startX = x;
        const startY = y;

        // 1) Collect all walkable perimeter tiles around footprint
        for (let dy = -1; dy <= type.lenY; dy++) {
            for (let dx = -1; dx <= type.lenX; dx++) {
            const tx = startX + dx;
            const ty = startY + dy;

            const inside = dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY;
            if (inside) continue;

            if (tx < 0 || ty < 0 || ty >= Map.navGrid.length || tx >= Map.navGrid[0].length) continue;
            if (!Map.navGrid[ty][tx]) continue;

            const worldX = tx * SQUARESIZE + SQUARESIZE / 2;
            const worldY = ty * SQUARESIZE + SQUARESIZE / 2;

            let dist;
            if (troop) {
                dist = Phaser.Math.Distance.Between(troop.x, troop.y, worldX, worldY);
            } else {
                dist = Phaser.Math.Distance.Between(
                tStartX * SQUARESIZE + SQUARESIZE / 2,
                tStartY * SQUARESIZE + SQUARESIZE / 2,
                worldX,
                worldY
                );
            }

            candidates.push({ tx, ty, dist });
            }
        }

        // 2) Resolve start world pos
        if (tStartX == null || tStartY == null) {
            let troopX = Math.floor(troop.body.x / SQUARESIZE);
            let troopY = Math.floor(troop.body.y / SQUARESIZE);
            tStartX = troop.body.x;
            tStartY = troop.body.y;

            if (!Map.navGrid[troopY]?.[troopX]) {
            const [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) return null;
            tStartX = newX * SQUARESIZE + SQUARESIZE / 2;
            tStartY = newY * SQUARESIZE + SQUARESIZE / 2;
            }
        } else {
            tStartX = tStartX * SQUARESIZE + SQUARESIZE / 2;
            tStartY = tStartY * SQUARESIZE + SQUARESIZE / 2;
        }

        // 3) Closest perimeter tile that actually has a path
        candidates.sort((a, b) => a.dist - b.dist);

        for (const c of candidates) {
            const path = Map.navMesh.findPath(
            { x: tStartX, y: tStartY },
            { x: c.tx * SQUARESIZE + SQUARESIZE / 2, y: c.ty * SQUARESIZE + SQUARESIZE / 2 }
            );
            if (path && path.length > 0) return { tx: c.tx, ty: c.ty, path };
        }

        return null;
    }

    static beginBuildingBlock(sprite) {
        let task = sprite.task;

        if (!task || task.duration <= 0) {
            console.log(`sprite: ${sprite.id} delete mode outside of timer with duration: ${task.duration}`)
            if (task) {
                Teams.removeFromStateArray(1, "blockBuildingStates", sprite.task);
            }
            sprite.task = null
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE)
            let teamNumber = sprite.body.team;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].blockBuildingStates, CONTROL_STATES.BUILD_MODE_B);
            sprite.play(sprite.idle);
            return;
        }

        if (!task.constructionSprite) {
            task.constructionSprite = Map.scene.add.image(
                task.x * SQUARESIZE + (task.type.lenX * SQUARESIZE) / 2,
                task.y * SQUARESIZE + (task.type.lenY * SQUARESIZE) / 2,
                'construction'
            ).setDepth(BLOCKDEPTH);

            task.constructionSprite.setDisplaySize(
                task.type.lenX * SQUARESIZE,
                task.type.lenY * SQUARESIZE
            );

            // Snapshot starting duration so we can compute %
            task.totalDuration = task.duration;
            task._hovering = false;

            const scene = this.scene;

            // Create shared hover UI once (bg + text)
            if (!scene.constructionHoverText) {
                scene.constructionHoverText = scene.add
                    .text(0, 0, "", {
                        fontSize: "12px",
                        fill: "#ffffff",
                        stroke: "#000000",
                        strokeThickness: 3,
                        align: "center",
                    })
                    .setOrigin(0.5, 1)
                    .setDepth(UIDEPTH + 6)
                    .setScrollFactor(1)
                    .setVisible(false);

                scene.constructionHoverBg = scene.add
                    .rectangle(0, 0, 10, 10, 0x000000, 0.6)  // similar to house hover
                    .setStrokeStyle(1, 0xffffff, 0.4)
                    .setOrigin(0.5, 1)
                    .setDepth(UIDEPTH + 5)
                    .setScrollFactor(1)
                    .setVisible(false);
            }

            task.constructionSprite.setInteractive({ useHandCursor: true });

            task.constructionSprite.on("pointerover", () => {
                task._hovering = true;
                scene.constructionHoverBg.setVisible(true);
                scene.constructionHoverText.setVisible(true);
                buildingManager.updateConstructionHoverText(task);
            });

            task.constructionSprite.on("pointerout", () => {
                task._hovering = false;
                scene.constructionHoverBg.setVisible(false);
                scene.constructionHoverText.setVisible(false);
            });
        }


        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(this.blockBuildingDuration, () => {
                console.log(`sprite: ${sprite.id} starting timer, duration: ${task.duration}`)
                if(!sprite.active || sprite.state != CONTROL_STATES.BUILD_MODE_B) return;
                let teamNumber = sprite.body.team;
                if (!task || task.duration <= 0){
                    console.log(`sprite: ${sprite.id} delete mode within timer `)
                    Teams.removeFromStateArray(1, "blockBuildingStates", sprite.task);
                    sprite.task = null;
                    sprite.timer = null; 
                    sprite.play(sprite.idle);
                    Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].blockBuildingStates, CONTROL_STATES.BUILD_MODE_B);
                    return;
                }
                const dx = sprite.x - sprite.task.x*SQUARESIZE;
                const dy = sprite.y - sprite.task.y*SQUARESIZE;

                if (Math.abs(dx) > Math.abs(dy)) {
                    sprite.flipX = dx < 0; // Face left if dx is negative
                    sprite.direction = dx > 0 ? 'right' : 'left';
                } else {
                    sprite.direction = dy > 0 ? 'down' : 'up';
                }
                
                sprite.play(sprite.action);
                task.duration -= 2;
                sprite.stamina = Math.max(0, sprite.stamina - 0.2);
                if (task._hovering) {
                    buildingManager.updateConstructionHoverText(task);
                }
    
                if (task.duration <= 0) {
                    // if(!buildingManager.scene.checkSufficientFunds(task.type.price)) return;
                    // buildingManager.scene.updateMoney(-1*task.type.price);
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
                    sprite.play(sprite.idle);
                    sprite.timer = null;
                    console.log("Done building.");
                    const cost = task.type.cost;
                    if (cost && !this.hasRequiredMaterials(cost, teamNumber)) {
                        console.log("Not enough resources to build!");
                        sprite.play(sprite.idle);
                        sprite.timer = null;
                        sprite.task = null;
                        return;
                    }
                    this.consumeRequiredMaterials(cost, teamNumber);
                    if (task.constructionSprite) {
                        task.constructionSprite.destroy();
                        task.constructionSprite = null;
                    }
                    const scene = buildingManager.scene;
                    if (scene) {
                        if (scene.constructionHoverText) {
                            scene.constructionHoverText.setVisible(false);
                        }
                        if (scene.constructionHoverBg) {
                            scene.constructionHoverBg.setVisible(false);
                        }
                    }
                    task._hovering = false;
                    this.handlePlacement(task);
                    let blockTiles = []
                    let startY = task.y
                    let startX = task.x
                    for(let i =  startY; i < task.type.lenY + startY; i++){
                        for(let j = startX; j < task.type.lenX + startX; j++){
                            blockTiles.push({x: j, y: i})
                        }
                    }
                    this.scene.zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => {
                        return colorFor(cell); // or however you resolve colors
                    });
                    this.NavMeshUpdater.blockTiles(blockTiles)
                    Teams.removeFromStateArray(1, "blockBuildingStates", sprite.task);
                    sprite.task = null;
                    Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].blockBuildingStates, CONTROL_STATES.BUILD_MODE_B);
                } else {
                    console.log(`sprite: ${sprite.id} continue building with new duration ${task.duration}`)
                    sprite.timer = null;
                    // 🔥 Restart another delayed call if still building
                    this.beginBuildingBlock(sprite);
                }
            });
        }
    }

    static handlePlacement(task){
        if(task.type == TILE_TYPES.clayOven){
            new ClayOven(task.x, task.y, 1);
        }else if(task.type == TILE_TYPES.storage){
            new StorageBuilding(task.x, task.y, 1);
        }else if(task.type == TILE_TYPES.house1 || task.type == TILE_TYPES.house2){
            new House(task.x, task.y, task.type, 1);
        }else{
            Map.handleMapClick(task.x*SQUARESIZE, task.y*SQUARESIZE, task.type);
        }
    }

    static assingTroopsToDestroy(teamNumber){
        let destroyList = Teams.teamLists[`${teamNumber}`].destroyStates;
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].builderList;
        Manager.assignTroopsToAction(troops, destroyList, CONTROL_STATES.DESTROY_MODE, force);
    }

    static beginDestroyingBlock(sprite) {
        let task = sprite.task;
        if (!task || task.duration <= 0) {
            console.log(`sprite: ${sprite.id} delete mode outside of timer with duration: ${task.duration}`)
            if (task) {
                Teams.removeFromStateArray(sprite.body.team, "destroyStates", sprite.task);
            }
            sprite.task = null
            sprite.timer = null; 
            let teamNumber = sprite.body.team;
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
            sprite.play(sprite.idle);
            return;
        }
    
        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
                if(!sprite.active || sprite.state != CONTROL_STATES.DESTROY_MODE) return;
                let teamNumber = sprite.body.team;
                if (!task || task.duration <= 0){
                    console.log(`sprite: ${sprite.id} delete mode within timer `)
                    sprite.task = null;
                    if(sprite.timer){
                        sprite.timer.remove(false);
                        sprite.timer = null;
                    }
                    Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
                    return;
                }

                // Initialize max health snapshot for this destroy job
                if (!task.totalDuration) {
                    task.totalDuration = task.duration;
                }

                // Compute damage for this tick
                let damage;
                if (!sprite.body.team) {
                    // Raiders / enemies: use their weapon to damage buildings
                    damage = sprite.weapon?.baseDmg || 5;
                } else {
                    // Player-side "demolition" – slow chip damage
                    damage = 2;
                }

                // Apply damage to the task duration
                task.duration = Math.max(0, task.duration - damage);

                // Resolve building instance: prefer value.buildingRef, fall back to value
                const targetObj = task.value?.buildingRef || task.value;

                if (targetObj && typeof targetObj.onDamaged === "function") {
                    targetObj.onDamaged(damage, task.duration, task.totalDuration);
                }


                sprite.play(sprite.action);
                
                if (task.duration <= 0) {
                    sprite.timer.remove(false);
                    sprite.timer = null;
                    console.log("Done Destroying.");
                    sprite.play(sprite.idle);
                    const targetObj = task.value?.buildingRef || task.value;
                    if (targetObj && typeof targetObj.destroy === "function") {
                        targetObj.destroy();       // calls ClayOven/House/StorageBuilding.destroy
                    } else if (task.value && typeof task.value.destroy === "function") {
                        task.value.destroy();      // fallback: just sprite
                    }
                    let blockTiles = []
                    for(let i =  task.y; i < task.type.lenY + task.y; i++){
                        for(let j = task.x; j < task.type.lenX + task.x; j++){
                            blockTiles.push({x: j, y: i})
                            if(Array.isArray(Map.grid[i][j])) Map.grid[i][j] = Map.grid[i][j][0]
                            Map.navGrid[i][j] = 1;
                        }
                    }
                    this.scene.zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => {
                        return colorFor(cell); // or however you resolve colors
                    });
                    this.NavMeshUpdater.blockTiles(blockTiles, true)
                    Teams.removeFromStateArray(teamNumber, "destroyStates", sprite.task);
                    sprite.task = null;
                    this.removeBuildingFromArray(task.x, task.y);
                    Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
                } else {
                    console.log(`sprite: ${sprite.id} continue building with new duration ${task.duration}`)
                    sprite.timer.remove(false);
                    sprite.timer = null;
                    // 🔥 Restart another delayed call if still destroying
                    this.beginDestroyingBlock(sprite);
                }

            });
        }
    }

    static removeBuildingFromArray(x, y) { //problematic, hard looping as we dont know who destroying and why
        // 1) Remove from global town.buildingArray
        for (let i = 0; i < buildingArray.length; i++) {
            const [bx, by] = buildingArray[i];
            if (bx === x && by === y) {
                console.log(`REMOVED BUILDING (global) at ${bx},${by}`);
                buildingArray.splice(i, 1);
                break;
            }
        }

        // 2) Remove from each team’s buildings list and clean matching destroy tasks
        for (const teamKey in Teams.teamLists) {
            const team = Teams.teamLists[teamKey];
            if (!team) continue;

            if (Array.isArray(team.buildings)) {
                const before = team.buildings.length;

                team.buildings = team.buildings.filter(([bx, by, type, building]) => {
                    return !(bx === x && by === y);
                });

                // If we actually removed something from this team, also clear destroy tasks at that tile
                if (team.buildings.length !== before && Array.isArray(team.destroyStates)) {
                    team.destroyStates = team.destroyStates.filter(t => t.x !== x || t.y !== y);
                }
            }
        }

        return true;
    }

    static beginFixingBuilding(sprite) {
        const task = sprite.task;

        if (!task || !task.value) {
            sprite.task = null;
            sprite.timer = null;
            sprite.play(sprite.idle);
            return;
        }

        const b = task.value; // the building instance you stored
        const maxHp = (b.maxHealth ?? 100);
        const hpKey = ("health" in b) ? "health" : (("hp" in b) ? "hp" : "health");

        if ((b[hpKey] ?? 0) >= maxHp) {
            // already fixed
            Teams.removeFromStateArray(sprite.body.team, "buildingFixTasks", task);
            sprite.task = null;
            sprite.timer = null;
            sprite.play(sprite.idle);
            Manager.assignOneTroopToAction(sprite, Teams.teamLists[sprite.body.team].buildingFixTasks, CONTROL_STATES.FIX_BUILDING);
            return;
        }

        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
            if (!sprite.active || sprite.state !== CONTROL_STATES.FIX_BUILDING) return;

            // building might have been destroyed mid-task
            if (!sprite.task || !sprite.task.value) {
                sprite.task = null;
                sprite.timer = null;
                sprite.play(sprite.idle);
                return;
            }

            const building = sprite.task.value;
            const maxHealth = (building.maxHealth ?? 100);
            const key = ("health" in building) ? "health" : (("hp" in building) ? "hp" : "health");

            const before = (building[key] ?? 0);
            const healed = Math.min(5, maxHealth - before);
            building[key] = Math.min(maxHealth, before + healed);

            // green flash + shake
            if (building.sprite) {
                building.sprite.setTint(0x44ff44);
                this.scene.tweens.add({
                targets: building.sprite,
                x: building.sprite.x + 2,
                yoyo: true,
                repeat: 2,
                duration: 60,
                onComplete: () => building.sprite.clearTint()
                });
            }


            showGhostText(this.scene, building.x, building.y - 20, `+${healed} 💚`, 0x44ff44);
            

            sprite.play(sprite.action);

            // finished?
            if (building[key] >= maxHealth) {
                Teams.removeFromStateArray(sprite.body.team, "buildingFixTasks", sprite.task);
                sprite.task = null;

                if (sprite.timer) {
                sprite.timer.remove(false);
                sprite.timer = null;
                }

                sprite.play(sprite.idle);
                return;
            }

            // continue ticking
            sprite.timer.remove(false);
            sprite.timer = null;
            this.beginFixingBuilding(sprite);
            });
        }
    }

    static hasRequiredMaterials(costObj, teamNumber) {
        for (const [res, count] of Object.entries(costObj)) {
            if (!StorageBuilding.hasTeamMaterials(res, count, teamNumber)) {
                return false;
            }
        }
        return true;
    }

    static consumeRequiredMaterials(costObj, teamNumber) {
        for (const [res, count] of Object.entries(costObj)) {
            StorageBuilding.removeTeamMaterials(res, count, teamNumber);
            DailyNeedsTracker.updateUIItems(UI_ITEM_TYPES[res], count, true);
        }
    }

    static updateConstructionHoverText(task) {
        const scene = buildingManager.scene;
        if (!scene || !task || !task.constructionSprite) return;

        const label = scene.constructionHoverText;
        const bg    = scene.constructionHoverBg;
        if (!label || !bg) return;

        const total = task.totalDuration || task.duration || 1;
        const done  = total - task.duration;
        const pct   = Math.max(
            0,
            Math.min(100, Math.round((done / total) * 100))
        );

        const name =
            (task.type && (task.type.displayName || task.type.name)) ||
            "Building";

        label.setText(`${name}\n${pct}%`);

        // Position above the construction sprite
        const x = task.constructionSprite.x;
        const y =
            task.constructionSprite.y -
            task.constructionSprite.displayHeight / 2 -
            4;

        label.setPosition(x, y);

        // Size bg to text, with padding
        const pad = 4;
        const w = label.width + pad * 2;
        const h = label.height + pad * 2;
        bg.setSize(w, h);
        bg.setPosition(x, y);
    }

}