import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX } from "./constants";
import { Map } from "./map";
import { mapView } from "./mapView";
import { Player } from "./Player";
import { Teams } from "./Teams";

export class tillManager {
    static scene;

    static getTileKey(x, y) {
        return `${x},${y}`;
    }

    static getTileState(x, y, teamNumber) {
        const key = this.getTileKey(x, y);
        const tileStates = Teams.teamLists[`${teamNumber}`].tileStates;
        // Only initialize if it doesn't exist
        if (!tileStates[key]) {
            tileStates[key] = {
                state: 'untouched',  // Options: untouched, tilling, tilled
                assigned: 0,
                timer: null
            };
        }
        return tileStates[key];
    }

    static assignTilesToTroops(teamNumber, troops, tileList) {
        for (let troop of troops) {
            if(troop.state != CONTROL_STATES.USER_MODE) continue
            let best = null;
            let fewestAssigned = Infinity;

            for (let tile of tileList) {
                const key = this.getTileKey(tile[0], tile[1]);
                const state = this.getTileState(tile[0], tile[1], teamNumber);
                if (state.state === 'tilled') continue;
                if (state.assigned < fewestAssigned) {
                    best = tile;
                    fewestAssigned = state.assigned;
                }
                if(fewestAssigned == 0){break;}
            }

            if (best) {
                const [tx, ty] = best;
                const key = this.getTileKey(tx, ty);
                const state = this.getTileState(tx, ty, teamNumber);
                state.assigned += 1;
                troop.state = CONTROL_STATES.FARM_MODE
                Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: tx*SQUARESIZE, y: ty*SQUARESIZE }));
            }
        }
    }

    static assignCropsToTroops(teamNumber, troops, cropList){
        for (let troop of troops) {
            if(troop.state == CONTROL_STATES.USER_MODE){
                if(cropList.length){
                    troop.state = CONTROL_STATES.HARVEST_MODE
                    let tile = cropList.shift()
                    Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: tile[0]*SQUARESIZE, y: tile[1]*SQUARESIZE }));
                }
            }
        }
    }

    static harvestCrop(x,y){
        x = Math.floor(x/SQUARESIZE);
        y = Math.floor(y/SQUARESIZE);
        let cropTile;
        const block = Map.blocks[y * WORLD_DIMENSIONX + x];
        if (Array.isArray(block)) {
            cropTile = block[0];
        } else {
            cropTile = block;
        }
        if (cropTile && cropTile.anims.currentFrame.index == 3) {
            this.scene.updateMoney(10)
            cropTile.setFrame(1);           // ✅ Reset to first frame
            cropTile.anims.play('crops');   // ✅ Play the crop animation
        }
    }

    static beginTilling(x, y, sprite) {
        x = Math.floor(x/SQUARESIZE);
        y = Math.floor(y/SQUARESIZE);
        const key = this.getTileKey(x, y);
        const tile = this.getTileState(x, y, sprite.body.team);
    
        if (tile.state === 'tilled') return;
    
        tile.assigned = (tile.assigned || 0) + 1;
    
        // If already tilling, halve the remaining time
        if (tile.timer) {
            const remaining = tile.timer.delay - tile.timer.getProgress() * tile.timer.delay;
            tile.timer.remove(false); // Cancel old timer
    
            tile.timer = this.scene.time.delayedCall(remaining / 2, () => {
                tile.state = 'tilled';
                // ✅ Remove from tileStates and tileList
                const key = this.getTileKey(x, y);
                const teamData = Teams.teamLists[`${sprite.teamNumber}`];
                if (teamData) {
                    delete teamData.tileStates[key];
                    teamData.tileList = teamData.tileList.filter(([tx, ty]) => tx !== x || ty !== y);
                }
                if (sprite) {
                    this.onTillingDone(sprite);
                }
                Map.grid[y][x] = TILE_TYPES.crops.grid
                Map.drawGridValue(x,y)
                // Map.addSpreadArr(x, y, TILE_TYPES.crops, 0);
                tile.timer = null;
            });
            
        } else {
            tile.state = 'tilling';
            tile.timer = this.scene.time.delayedCall(1000, () => {
                tile.state = 'tilled';
                const key = this.getTileKey(x, y);
                const teamData = Teams.teamLists[`${sprite.teamNumber}`];
                if (teamData) {
                    delete teamData.tileStates[key];
                    teamData.tileList = teamData.tileList.filter(([tx, ty]) => tx !== x || ty !== y);
                }
                if (sprite) {
                    this.onTillingDone(sprite);
                }
                Map.grid[y][x] = TILE_TYPES.crops.grid
                Map.drawGridValue(x,y)
                // Map.addSpreadArr(x, y, TILE_TYPES.crops, 0);
                tile.timer = null;
            });
        }
    }    

    static getNextTileFor(troop) {
        let best = null;
        let fewestAssigned = Infinity;
        let tileStates = Teams.teamLists[`${troop.body.team}`].tileStates
    
        for (const key in tileStates) {
            const [x, y] = key.split(',').map(Number);
            const tile = tileStates[key];
            if(tile == null) break;
    
            if (tile.state === 'tilled') continue;
            if (tile.assigned < fewestAssigned) {
                best = [x, y];
                fewestAssigned = tile.assigned;
            }
            if (fewestAssigned === 0) break;
        }

        if (best) {
            const [tx, ty] = best;
            const key = this.getTileKey(tx, ty);
            const state = this.getTileState(tx, ty, troop.body.team);
            state.assigned += 1;
            troop.state = CONTROL_STATES.FARM_MODE
            Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: tx*SQUARESIZE, y: ty*SQUARESIZE }));
        }else{
            troop.state = CONTROL_STATES.USER_MODE
        }
    
        return best;
    }

    static getNextCropFor(troop) {
        let cropList = Teams.teamLists[`${troop.body.team}`].cropList
        if(Teams.teamLists[`${troop.body.team}`].cropList.length){
            let tile = cropList.shift()
            Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: tile[0]*SQUARESIZE, y: tile[1]*SQUARESIZE }));
        }else{
            troop.state = CONTROL_STATES.USER_MODE
        }
    }

    static onTillingDone(sprite) {
        const nextTile = tillManager.getNextTileFor(sprite);
        if (nextTile) {
            const [nx, ny] = nextTile;
            const state = tillManager.getTileState(nx, ny, sprite.body.team);
            state.assigned += 1;
            
            Player.moveTo(sprite, Map.navMesh.findPath({ x: sprite.body.x, y: sprite.body.y }, { x: nx*SQUARESIZE, y: ny*SQUARESIZE }));
        } else {
            sprite.state = CONTROL_STATES.TRACK_MODE;
        }
    }    

    static isTilled(x, y) {
        const tile = this.getTileState(x, y);
        return tile.state === 'tilled';
    }
}
