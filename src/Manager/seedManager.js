import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, UIDEPTH, colorFor } from "../constants";
import { Manager } from "./Manager";
import { StorageManager } from "./StorageManager";
import { Map } from "../map";
import { Player } from "../players/Player";
import { Teams } from "../Teams";
import { UI_ITEM_TYPES } from "../UI/UIConstants";
import { AudioManager } from "./AudioManager";


export class seedManager {
    static scene;

    static assignSeedsToTroops(teamNumber) {
        const force = Player.selected.length? true : false;
        const troops = Player.selected.length? Player.selected : Teams.teamLists[`${teamNumber}`].foragerList;
        const seedList = Teams.teamLists[`${teamNumber}`].seedList;
        Manager.assignTroopsToAction(troops, seedList, CONTROL_STATES.SEED_MODE, force);
    }

    static beginSeeding(sprite) {
        let task = sprite.task;
        if(!task || !sprite.active){
            sprite.task = null;
            return;
        }
        sprite.play('action')
        sprite.timer = this.scene.time.delayedCall(1000, () => {
            if(!sprite.active || sprite.state != CONTROL_STATES.SEED_MODE) return;
            Teams.removeFromStateArray(1, "foragerQueue", sprite.task);
            if (sprite) {
                this.onSeedingDone(sprite);
            }
            sprite.timer = null;
        });
    }    

    static onSeedingDone(sprite) {
        let x = sprite.task.x;
        let y = sprite.task.y;
        // Determine item type
        let itemType = null;
        if (Map.grid[y][x] == TILE_TYPES.grassCrop.grid) {
            itemType = UI_ITEM_TYPES.seedCrop;
        } else if (Map.grid[y][x] == TILE_TYPES.grassBerry.grid) {
            itemType = UI_ITEM_TYPES.seedBerry;
        } else if (Map.grid[y][x] == TILE_TYPES.grassWood.grid){
            itemType = UI_ITEM_TYPES.wood;
        } else if (Map.grid[y][x] == TILE_TYPES.grassRock.grid){
            itemType = UI_ITEM_TYPES.stone;
        }
        const added = StorageManager.addCarriedItem(sprite, itemType)
        if (sprite.task && sprite.task.block && sprite.task.block.queuedOutline) {
            sprite.task.block.queuedOutline.destroy();
            sprite.task.block.queuedOutline = null;
        }
        Map.grid[y][x] = 1;

        const isSeedPickup =
            itemType === UI_ITEM_TYPES.seedCrop ||
            itemType === UI_ITEM_TYPES.seedBerry;

        if (isSeedPickup) {
            AudioManager.playPickup();
        }

        // Update detailed view if tile is on-screen
        if (Map.cameraBounds.contains(sprite.task.x * SQUARESIZE, sprite.task.y * SQUARESIZE)) {
            Map.drawGridValue(x, y);
        }

        sprite.task = null;
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
            Teams.teamLists['1'].foragerQueue.push({ x, y, block, forageType: 'seed', assigned: 0 })

            // 🟡 outline persists until picked up
            if (!block.queuedOutline) {
                const size = SQUARESIZE;
                block.queuedOutline = scene.add.graphics();
                block.queuedOutline.setDepth(UIDEPTH);
                block.queuedOutline.lineStyle(2, 0xffff00, 1);
                block.queuedOutline.strokeRect(x * size, y * size, size, size);
            }
        });
  
        block.on('pointerout', () => {
          // remove the outline when the pointer leaves
          if (outline) {
            outline.destroy();
            outline = null;
          }
        });
    }      
}