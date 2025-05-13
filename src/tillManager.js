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
            if(!Player.playerAvailible(troop)) continue
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
            if(fewestAssigned>0){//all tiles have been taken by atleast 1 troop
                break; //no need to bother anymore
            }
            let troopX, troopY;
            if (best) {
                const [tx, ty] = best;
                const key = this.getTileKey(tx, ty);
                const state = this.getTileState(tx, ty, teamNumber);
                state.assigned += 1;
                troop.state = CONTROL_STATES.FARM_MODE;
                troopX = Math.floor(troop.body.x/SQUARESIZE);
                troopY = Math.floor(troop.body.y/SQUARESIZE);
                let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                if (newX === -1) {
                    console.log("No valid start tile nearby");
                } else {
                    troopX = newX;
                    troopY = newY;
                    console.log("New valid tile:", newX, newY);
                }
                Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: tx*SQUARESIZE+SQUARESIZE/2, y: ty*SQUARESIZE+SQUARESIZE/2 }));
            }    
        }
    }

    static assignCropsToTroops(teamNumber, troops, cropList){
        for (let troop of troops) {
            if(Player.playerAvailible(troop)){
                if(cropList.length){
                    troop.state = CONTROL_STATES.HARVEST_MODE
                    let tile = cropList.shift()
                    Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: tile[0]*SQUARESIZE+SQUARESIZE/2, y: tile[1]*SQUARESIZE+SQUARESIZE/2 }));
                }
            }
        }
    }

    static harvestCrop(x,y){
        x = Math.floor(x/SQUARESIZE);
        y = Math.floor(y/SQUARESIZE);
        let cropTile;
        const key = `${x},${y}`
        const block = Map.cropDict[key];
        if (Array.isArray(block)) {
            cropTile = block[0];
        } else {
            cropTile = block;
        }
        if (cropTile && cropTile.anims.currentFrame.index == 3) {
            this.scene.updateMoney(10);
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
    
        tile.state = 'tilling';
        if(!this.scene.checkSufficientSeeds(1)) return;
        tile.timer = this.scene.time.delayedCall(1000, () => {
            if(!this.scene.checkSufficientSeeds(1)) return;
            if(sprite.state != CONTROL_STATES.FARM_MODE){return;}
            tile.state = 'tilled';
            const key = this.getTileKey(x, y);
            const teamData = Teams.teamLists[`${sprite.body.team}`];
            if (teamData) {
                delete teamData.tileStates[key];
                teamData.tileList = teamData.tileList.filter(([tx, ty]) => tx !== x || ty !== y);
            }
            if (sprite) {
                this.scene.updateSeeds(-1);
                this.onTillingDone(sprite);
            }
            Map.grid[y][x] = TILE_TYPES.crops.grid
            Map.drawGridValue(x,y)
            // Map.addSpreadArr(x, y, TILE_TYPES.crops, 0);
            tile.timer = null;
        });
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
            troop.tillTile = state;
            troop.state = CONTROL_STATES.FARM_MODE
            let troopX = Math.floor(troop.body.x/SQUARESIZE)
            let troopY = Math.floor(troop.body.y/SQUARESIZE)
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) {
                console.log("No valid start tile nearby");
            } else {
                console.log("New valid tile:", newX, newY);
            }
            Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: tx*SQUARESIZE+SQUARESIZE/2, y: ty*SQUARESIZE+SQUARESIZE/2 }));
        }else{
            troop.state = CONTROL_STATES.USER_MODE
        }
    
        return best;
    }

    static getNextCropFor(troop) {
        let cropList = Teams.teamLists[`${troop.body.team}`].cropList
        if(Teams.teamLists[`${troop.body.team}`].cropList.length){
            let tile = cropList.shift()
            let troopX = Math.floor(troop.body.x/SQUARESIZE)
            let troopY = Math.floor(troop.body.y/SQUARESIZE)
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) {
                console.log("No valid start tile nearby");
            } else {
                console.log("New valid tile:", newX, newY);
            }
            Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: tile[0]*SQUARESIZE+SQUARESIZE/2, y: tile[1]*SQUARESIZE+SQUARESIZE/2 }));
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
            
            Player.moveTo(sprite, Map.navMesh.findPath({ x: sprite.body.x, y: sprite.body.y }, { x: nx*SQUARESIZE+SQUARESIZE/2, y: ny*SQUARESIZE+SQUARESIZE/2 }));
        } else {
            sprite.state = CONTROL_STATES.TRACK_MODE;
        }
    }

    static isTilled(x, y) {
        const tile = this.getTileState(x, y);
        return tile.state === 'tilled';
    }
}
