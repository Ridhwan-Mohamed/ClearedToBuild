import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, UIDEPTH, WORLD_DIMENSIONX } from "./constants";
import { Map } from "./map";
import { mapView } from "./mapView";
import { Player } from "./Player";
import { Teams } from "./Teams";

export class seedManager {
    static scene;

    static getTileKey(x, y) {
        return `${x},${y}`;
    }

    static getTileState(x, y, teamNumber) {
        const key = this.getTileKey(x, y);
        const seedStates = Teams.teamLists[`${teamNumber}`].seedStates;
        // Only initialize if it doesn't exist
        if (!seedStates[key]) {
            seedStates[key] = {
                state: 'untouched',  // Options: untouched, tilling, tilled
                assigned: 0,
                timer: null
            };
        }
        return seedStates[key];
    }

    static assignSeedsToTroops(teamNumber) {
        const troops = Teams.teamLists[`${teamNumber}`].playerList;
        const seedList = Teams.teamLists[`${teamNumber}`].seedList;
        for (let troop of troops) {
            if(!Player.playerAvailible(troop)) continue
            let best = null;
            let fewestAssigned = Infinity;

            for (let tile of seedList) {
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
                troop.state = CONTROL_STATES.SEED_MODE;
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

    static beginSeeding(x, y, sprite) {
        x = Math.floor(x/SQUARESIZE);
        y = Math.floor(y/SQUARESIZE);
        const key = this.getTileKey(x, y);
        const tile = this.getTileState(x, y, sprite.body.team);
        if (tile.state === 'tilled') return;
        tile.assigned = (tile.assigned || 0) + 1;
        tile.state = 'tilling';
        sprite.play('action')
        tile.timer = this.scene.time.delayedCall(1000, () => {
            if(sprite.state != CONTROL_STATES.SEED_MODE){return;}
            tile.state = 'tilled';
            const key = this.getTileKey(x, y);
            const teamData = Teams.teamLists[`${sprite.body.team}`];
            if (teamData) {
                delete teamData.seedStates[key];
                teamData.seedList = teamData.seedList.filter(([tx, ty]) => tx !== x || ty !== y);
            }
            if (sprite) {
                this.onSeedingDone(sprite);
            }
            tile.timer = null;
        });
    }    

    static getNextTileFor(troop) {
        let best = null;
        let fewestAssigned = Infinity;
        let seedList = Teams.teamLists[`${troop.body.team}`].seedList

        for (let tile of seedList) {
            const key = this.getTileKey(tile[0], tile[1]);
            const state = this.getTileState(tile[0], tile[1], troop.body.team);
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
            const state = this.getTileState(tx, ty, troop.body.team);
            state.assigned += 1;
            troop.tillTile = state;
            troop.state = CONTROL_STATES.SEED_MODE
            let troopX = Math.floor(troop.body.x/SQUARESIZE)
            let troopY = Math.floor(troop.body.y/SQUARESIZE)
            let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
            if (newX === -1) {
                console.log("No valid start tile nearby");
            } else {
                console.log("New valid tile:", newX, newY);
            }
            Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: tx*SQUARESIZE+SQUARESIZE/2, y: ty*SQUARESIZE+SQUARESIZE/2 }));
        }
    
        return best;
    }

    static onSeedingDone(sprite) {
        seedManager.scene.updateSeeds(1);
        let x = Math.floor(sprite.finalPos.x/SQUARESIZE);
        let y = Math.floor(sprite.finalPos.y/SQUARESIZE);
        Map.grid[y][x] = 1;
        if(Map.cameraBounds.contains(sprite.finalPos.x,sprite.finalPos.y)){
            Map.drawGridValue(x,y);
        }
        const nextTile = seedManager.getNextTileFor(sprite);
        if (!nextTile) {
            sprite.state = CONTROL_STATES.TRACK_MODE;
        }
    }

    static makeClickable(x, y, block) {
        const scene = block.scene;
        const size = SQUARESIZE;
        let outline;
      
        // enable input on the block
        block.setInteractive();
      
        block.on('pointerover', () => {
          // draw a yellow 1px outline around the tile
          outline = scene.add.graphics();
          outline.setDepth(UIDEPTH)
          outline.lineStyle(2, 0x000000, 1);
          outline.strokeRect(x * size, y * size, size, size);
        });

        block.on('pointerdown', () => {
            Teams.addSeedSpots(1, [x,y]);
            seedManager.assignSeedsToTroops(1);
        })
      
        block.on('pointerout', () => {
          // remove the outline when the pointer leaves
          if (outline) {
            outline.destroy();
            outline = null;
          }
        });
    }      
}