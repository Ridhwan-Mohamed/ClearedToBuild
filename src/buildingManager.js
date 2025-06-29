import { Player } from "./Player"
import { Teams } from "./Teams"
import { Map } from "./map"
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES } from "./constants"
import { NavMesh } from "./lib/navmesh/navmesh"
import { buildPolysFromGridMap } from "./lib/navmesh/map-parsers/build-polys-from-grid-map"
import { Manager } from "./Manager/Manager"
import { buildingArray } from "./town"
export class buildingManager{

    static NavMeshUpdater;
    static scene;

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
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].playerList;
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

        let troopX = Math.floor(troop.body.x/SQUARESIZE)
        let troopY = Math.floor(troop.body.y/SQUARESIZE)
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
    
        const troopPos = new Phaser.Math.Vector2(troop.x, troop.y);
    
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
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].playerList;
        let blockList = Teams.teamLists[`${teamNumber}`].blockBuildingStates
        Manager.assignTroopsToAction(troops, blockList, CONTROL_STATES.BUILD_MODE_B, force);
    }

    static findBuildApproachBlock(x, y, type, troop) {
        const troopPos = new Phaser.Math.Vector2(troop.x, troop.y);
        const candidates = [];
    
        // Compute top-left corner of the block
        const startX = x;
        const startY = y;

        // Search one tile around the perimeter of the block
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
                const dist = Phaser.Math.Distance.Between(troop.x, troop.y, worldX, worldY);

                candidates.push({ tx, ty, dist });
            }
        }

    
        // Sort candidates by distance
        candidates.sort((a, b) => a.dist - b.dist);
    
        // Try each candidate
        for (const candidate of candidates) {
            const path = Map.navMesh.findPath(
                { x: troop.x, y: troop.y },
                { x: candidate.tx * SQUARESIZE + SQUARESIZE / 2, y: candidate.ty * SQUARESIZE + SQUARESIZE / 2 }
            );
    
            if (path && path.length > 0) {
                return { tx: candidate.tx, ty: candidate.ty, path };
            }
        }
    
        return null; // ❌ No valid path found
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
            sprite.play('idle');
            return;
        }

        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
                console.log(`sprite: ${sprite.id} starting timer, duration: ${task.duration}`)
                if(!sprite.active || sprite.state != CONTROL_STATES.BUILD_MODE_B) return;
                let teamNumber = sprite.body.team;
                if (!task || task.duration <= 0){
                    console.log(`sprite: ${sprite.id} delete mode within timer `)
                    Teams.removeFromStateArray(1, "blockBuildingStates", sprite.task);
                    sprite.task = null;
                    sprite.timer = null; 
                    sprite.play('idle');
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
                
                sprite.play('action');
                task.duration -= 50;
    
                if (task.duration <= 0) {
                    if(!buildingManager.scene.checkSufficientFunds(task.type.price)) return;
                    buildingManager.scene.updateMoney(-1*task.type.price);
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE)
                    sprite.play('idle');
                    sprite.timer = null;
                    console.log("Done building.");
                    Map.handleMapClick(task.x*SQUARESIZE, task.y*SQUARESIZE, task.type)
                    let blockTiles = []
                    let startY = task.y
                    let startX = task.x
                    for(let i =  startY; i < task.type.lenY + startY; i++){
                        for(let j = startX; j < task.type.lenX + startX; j++){
                            blockTiles.push({x: j, y: i})
                        }
                    }
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

    static assingTroopsToDestroy(teamNumber){
        let destroyList = Teams.teamLists[`${teamNumber}`].destroyStates;
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].playerList;
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
            sprite.play('idle');
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

                task.duration -= 50;
                sprite.play('action');
                
                if (task.duration <= 0) {
                    sprite.timer.remove(false);
                    sprite.timer = null;
                    console.log("Done Destroying.");
                    sprite.play('idle')
                    task.value.destroy()
                    let blockTiles = []
                    for(let i =  task.y; i < task.type.lenY + task.y; i++){
                        for(let j = task.x; j < task.type.lenX + task.x; j++){
                            blockTiles.push({x: j, y: i})
                            if(Array.isArray(Map.grid[i][j])) Map.grid[i][j] = Map.grid[i][j][0]
                            Map.navGrid[i][j] = 1;
                        }
                    }
                    this.NavMeshUpdater.blockTiles(blockTiles, true)
                    Teams.removeFromStateArray(teamNumber, "destroyStates", sprite.task);
                    sprite.task = null;
                    this.removeBuildingFromArray(task.x, task.y);
                    Manager.assignOneTroopToAction(sprite, Teams.teamLists[teamNumber].destroyStates, CONTROL_STATES.DESTROY_MODE);
                } else {
                    console.log(`sprite: ${sprite.id} continue building with new duration ${task.duration}`)
                    sprite.timer.remove(false);
                    sprite.timer = null;
                    // 🔥 Restart another delayed call if still building
                    this.beginDestroyingBlock(sprite);
                }
            });
        }
    }

    static removeBuildingFromArray(x, y) {
    for (let i = 0; i < buildingArray.length; i++) {
        const [bx, by] = buildingArray[i];
        if (bx === x && by === y) {
            console.log(`REMOVED BUILDING at ${bx},${by}`)
            buildingArray.splice(i, 1);
            return true;
        }
    }
    return false;
}

}