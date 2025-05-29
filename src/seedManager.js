import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, UIDEPTH, WORLD_DIMENSIONX } from "./constants";
import { Manager } from "./Manager/Manager";
import { Map } from "./map";
import { mapView } from "./mapView";
import { Player } from "./Player";
import { Teams } from "./Teams";

export class seedManager {
    static scene;

    static assignSeedsToTroops(teamNumber) {
        const troops = Teams.teamLists[`${teamNumber}`].playerList;
        const seedList = Teams.teamLists[`${teamNumber}`].seedList;
        Manager.assignTroopsToAction(troops, seedList, CONTROL_STATES.SEED_MODE);
    }

    static beginSeeding(sprite) {
        let task = sprite.task;
        if(!task || !sprite.active){
            sprite.task = null;
            return;
        }
        let x = task.x;
        let y = task.y;
        sprite.play('action')
        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if(sprite.state != CONTROL_STATES.SEED_MODE){return;}
            Teams.removeFromStateArray(1, "seedList", task);
            if (sprite) {
                this.onSeedingDone(sprite);
            }
            sprite.timer = null;
        });
    }    

    static onSeedingDone(sprite) {
        let x = sprite.task.x;
        let y = sprite.task.y;
        if(Map.grid[y][x] == TILE_TYPES.grassCrop.grid){
            seedManager.scene.updateSeeds(1);
        }else if(Map.grid[y][x] == TILE_TYPES.grassBerry.grid){
            seedManager.scene.updateBerry(1);
        }
        Map.grid[y][x] = 1;
        if(Map.cameraBounds.contains(sprite.task.x*SQUARESIZE,sprite.task.y*SQUARESIZE)){
            Map.drawGridValue(x,y);
        }
        sprite.task = null;
        let seedList = Teams.teamLists[`${sprite.body.team}`].seedList;
        const nextTile = Manager.assignOneTroopToAction(sprite, seedList, CONTROL_STATES.SEED_MODE);
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
            Teams.addSeedSpots(1, x, y);
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