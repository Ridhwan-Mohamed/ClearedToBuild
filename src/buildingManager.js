import { Player } from "./Player"
import { Teams } from "./Teams"
import { Map } from "./map"
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES } from "./constants"
import { NavMesh } from "./lib/navmesh/navmesh"
import { buildPolysFromGridMap } from "./lib/navmesh/map-parsers/build-polys-from-grid-map"
export class buildingManager{

    static NavMeshUpdater;
    static scene;

    static getTileKey(x, y) {
        return `${x},${y}`;
    }

    static getTileState(x, y, teamNumber) {
        const key = this.getTileKey(x, y);
        const tileStates = Teams.teamLists[`${teamNumber}`].blockBuildingState;
        if (!tileStates[key]) {
            return null;
        }
        return tileStates[key];
    }

    static getDestroyState(x, y, teamNumber) {
        const key = this.getTileKey(x, y);
        const tileStates = Teams.teamLists[`${teamNumber}`].destroyState;
        if (!tileStates[key]) {
            return null;
        }
        return tileStates[key];
    }

    static assingTroopsToBuildTile(teamNumber, type){
        let buildList = Teams.teamLists[`${teamNumber}`].buildTileList
        let troops = Teams.teamLists[`${teamNumber}`].playerList
        if (buildList.length > 0) {
            // Process the tiles
            troops.forEach(troop => {
                if(!Player.playerAvailible(troop)) return;
                let tile = buildList[0]
                if(tile){
                    let approachTile = this.findBuildApproachTile(tile.x, tile.y, troop)                        
                    if(approachTile){
                        buildList.shift()
                        troop.state = CONTROL_STATES.BUILD_MODE_T
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
        if(buildingManager.scene.checkSufficientFunds(type.price)){return;}
        buildingManager.scene.updateMoney(-1*type.price);
        x = Math.floor(x/SQUARESIZE);
        y = Math.floor(y/SQUARESIZE);
        Map.navGrid[y][x] = 0;
        // Map.navMesh = new NavMesh(buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0));
        this.NavMeshUpdater.blockTile(x,y);
        Map.placeTile(x,y,type.name);
    }

    static assignTroopToBuild(troop){
        let buildList = Teams.teamLists[`${troop.body.team}`].buildTileList
        if (buildList.length > 0) {
            let tile = buildList.shift()
            if(tile){
                let approachTile = this.findBuildApproachTile(tile.x, tile.y, troop)
                if(approachTile){
                    troop.state = CONTROL_STATES.BUILD_MODE_T
                    troop.buildType = TILE_TYPES.wall
                    Player.moveTo(troop, approachTile.path)
                    troop.finalPos = {x: tile.x*SQUARESIZE, y: tile.y*SQUARESIZE}
                }
            }
        }
        else{troop.state = CONTROL_STATES.USER_MODE}
    }

    static assignTroopToBuildBlock(teamNumber){
        let troops = Teams.teamLists[`${teamNumber}`].playerList
        let blockList = Teams.teamLists[`${teamNumber}`].buildingBlockList
        troops.forEach(troop => {
            if(!Player.playerAvailible(troop)) return;
            let tile = blockList[0]
            if(tile){
                tile = this.getTileState(tile[0],tile[1],1);
                let approachTile = this.findBuildApproachBlock(tile.x, tile.y, tile.type, troop)
                if(approachTile){
                    blockList.shift()
                    troop.state = CONTROL_STATES.BUILD_MODE_B
                    Player.moveTo(troop, approachTile.path)
                    troop.finalPos = {x: tile.x, y: tile.y}
                }
            }
        })
    }

    static findBuildApproachBlock(x, y, type, troop) {
        const troopPos = new Phaser.Math.Vector2(troop.x, troop.y);
        const candidates = [];
    
        // Compute top-left corner of the block
        const startX = x - Math.floor(type.lenX / 2);
        const startY = y - Math.floor(type.lenY / 2);

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

    static beginBuildingBlock(x, y, sprite) {
        const key = this.getTileKey(x, y);
        const tile = this.getTileState(x, y, sprite.body.team);
    
        if (!tile || tile.duration <= 0) {
            if (tile) {
                delete Teams.teamLists[`${sprite.body.team}`].blockBuildingState[key];
            }
            sprite.state = CONTROL_STATES.USER_MODE;
            sprite.play('idle');
            return;
        }
    
        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
                const key = this.getTileKey(x, y);
                const tile = this.getTileState(x, y, sprite.body.team);
    
                if (!tile) return;

                const dx = x - sprite.body.tileX;
                const dy = y - sprite.body.tileY;

                if (Math.abs(dx) > Math.abs(dy)) {
                    sprite.flipX = dx < 0; // Face left if dx is negative
                    sprite.direction = dx > 0 ? 'right' : 'left';
                } else {
                    sprite.direction = dy > 0 ? 'down' : 'up';
                }
                
                sprite.play('action');
                tile.duration -= 50;
    
                if (tile.duration <= 0) {
                    sprite.state = CONTROL_STATES.USER_MODE;
                    sprite.play('idle');
                    sprite.timer = null;
                    console.log("Done building.");
                    Map.handleMapClick(x*SQUARESIZE, y*SQUARESIZE, tile.type)
                    if(!Map.placingItem.blocked){
                        Map.placeItem(tile.type)
                    }
                    let blockTiles = []
                    for(let i = Math.floor(tile.y - (tile.type.lenY/2)); i < tile.type.lenY + Math.floor(tile.y - (tile.type.lenY/2)); i++){
                        for(let j = Math.floor(tile.x - (tile.type.lenX/2)); j < tile.type.lenX + Math.floor(tile.x - (tile.type.lenX/2)); j++){
                            blockTiles.push({x: j, y: i})
                        }
                    }
                    this.NavMeshUpdater.blockTiles(blockTiles)
                    delete Teams.teamLists[`${sprite.body.team}`].blockBuildingState[key];
                } else {
                    console.log(`Continuing build: ${tile.duration} left`);
                    sprite.timer = null;
                    // 🔥 Restart another delayed call if still building
                    this.beginBuildingBlock(x, y, sprite);
                }
            });
        }
    }

    static assingTroopsToDestroy(teamNumber){
        let destroyList = Teams.teamLists[`${teamNumber}`].destroyList
        let troops = Teams.teamLists[`${teamNumber}`].playerList
        if (destroyList.length > 0) {
            troops.forEach(troop => {
                if(!Player.playerAvailible(troop)) return;
                let tile = destroyList[0]
                if(tile){
                    tile = this.getDestroyState(tile[0],tile[1],1);
                    let approachTile = this.findBuildApproachTile(tile.x, tile.y, troop)                        
                    if(approachTile){
                        destroyList.shift();
                        troop.state = CONTROL_STATES.DESTROY_MODE
                        Player.moveTo(troop, approachTile.path)
                        troop.finalPos = {x: tile.x, y: tile.y}
                    }
                }
            })
        }
    }

    static beginDestroyingBlock(x, y, sprite) {
        const key = this.getTileKey(x, y);
        const tile = this.getDestroyState(x, y, sprite.body.team);
    
        if (!tile || tile.duration <= 0) {
            if (tile) {
                delete Teams.teamLists[`${sprite.body.team}`].destroyState[key];
            }
            sprite.play('idle')
            sprite.state = CONTROL_STATES.USER_MODE;
            return;
        }
    
        if (!sprite.timer) {
            sprite.timer = this.scene.time.delayedCall(1000, () => {
                const key = this.getTileKey(x, y);
                const tile = this.getDestroyState(x, y, sprite.body.team);
    
                if (!tile) return;
    
                tile.duration -= 50;
                sprite.play('action')

                if (tile.duration <= 0) {
                    sprite.state = CONTROL_STATES.USER_MODE;
                    sprite.timer = null;
                    console.log("Done building.");
                    sprite.play('idle')
                    tile.value.destroy()
                    let blockTiles = []
                    for(let i = Math.floor(tile.y - (tile.type.lenY/2)); i < tile.type.lenY + Math.floor(tile.y - (tile.type.lenY/2)); i++){
                        for(let j = Math.floor(tile.x - (tile.type.lenX/2)); j < tile.type.lenX + Math.floor(tile.x - (tile.type.lenX/2)); j++){
                            blockTiles.push({x: j, y: i})
                        }
                    }
                    this.NavMeshUpdater.blockTiles(blockTiles, true)
                    delete Teams.teamLists[`${sprite.body.team}`].destroyState[key];
                } else {
                    console.log(`Continuing destroying: ${tile.duration} left`);
                    sprite.timer = null;
                    // 🔥 Restart another delayed call if still building
                    this.beginDestroyingBlock(x, y, sprite);
                }
            });
        }
    }

}