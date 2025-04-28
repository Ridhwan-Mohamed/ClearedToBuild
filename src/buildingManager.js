import { Player } from "./Player"
import { Teams } from "./Teams"
import { Map } from "./map"
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES } from "./constants"
import { NavMesh } from "./lib/navmesh/navmesh"
import { buildPolysFromGridMap } from "./lib/navmesh/map-parsers/build-polys-from-grid-map"
export class buildingManager{

    static NavMeshUpdater;

    static assingTroopsToBuild(teamNumber, type){
        let buildList = Teams.teamLists[`${teamNumber}`].buildList
        let troops = Teams.teamLists[`${teamNumber}`].playerList
        if (buildList.length > 0) {
            // Process the tiles
            troops.forEach(troop => {
                if(troop.state != CONTROL_STATES.USER_MODE) return
                let tile = buildList.shift()
                if(tile){
                    let approachTile = this.findBuildApproachTile(tile.x, tile.y, troop)
                    if(approachTile){
                        troop.state = CONTROL_STATES.BUILD_MODE
                        troop.buildType = type
                        Player.moveTo(troop, approachTile.path)
                        troop.finalPos = {x: tile.x*SQUARESIZE, y: tile.y*SQUARESIZE}
                    }
                }
            })
        }
    }

    static findBuildApproachTile(buildX, buildY, troop) {
        const directions = [
            [0, -1], [0, 1], [1, 0], [-1, 0],         // Cardinal (1 away)
            [-1, -1], [1, -1], [-1, 1], [1, 1],       // Diagonal (1 away)
            [0, -2], [0, 2], [2, 0], [-2, 0],         // Cardinal (2 away)
            [-2, -1], [-2, 1], [2, -1], [2, 1],       // Extended Diagonal (2 away)
            [-1, -2], [1, -2], [-1, 2], [1, 2],
        ];
    
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
                { x: troop.x, y: troop.y },
                { x: candidate.tx * SQUARESIZE + SQUARESIZE / 2, y: candidate.ty * SQUARESIZE + SQUARESIZE / 2 }
            );
    
            if (path && path.length > 0) {
                return { tx: candidate.tx, ty: candidate.ty, path };
            }
            // else try next one
        }
    
        return null; // ❌ No valid approach found
    }
    

    static beginBuilding(x,y,type){
        x = Math.floor(x/SQUARESIZE);
        y = Math.floor(y/SQUARESIZE);
        Map.navGrid[y][x] = 0;
        // Map.navMesh = new NavMesh(buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0));
        this.NavMeshUpdater.blockTile(x,y);
        Map.placeTile(x,y,type.name);
    }

    static assignTroopToBuild(troop){
        let buildList = Teams.teamLists[`${troop.body.team}`].buildList
        if (buildList.length > 0) {
            let tile = buildList.shift()
            if(tile){
                let approachTile = this.findBuildApproachTile(tile.x, tile.y, troop)
                if(approachTile){
                    troop.state = CONTROL_STATES.BUILD_MODE
                    troop.buildType = TILE_TYPES.wall
                    Player.moveTo(troop, approachTile.path)
                    troop.finalPos = {x: tile.x*SQUARESIZE, y: tile.y*SQUARESIZE}
                }
            }
        }
        else{troop.state = CONTROL_STATES.USER_MODE}
    }

}