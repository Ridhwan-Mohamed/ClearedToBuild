import { SQUARESIZE, TILE_TYPES, removeFromArray, showAlert } from "../constants";
import { Teams } from "../Teams";
import { Map as GameMap } from "../map";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { buildingManager } from "../Manager/buildingManager";
import { VisibilitySystem } from "../UI/VisibilitySystem";
import { OrderRunner } from "../orders/OrderRunner";

export class RockNode {
  static scene;

  static init(scene) {
    RockNode.scene = scene;
  }

  // gridX, gridY are TOP-LEFT of the blocked footprint
  constructor(gridX, gridY, level = 1) {
    const scene = RockNode.scene;
    this.gridX = gridX;
    this.gridY = gridY;
    this.resourceTileType = TILE_TYPES.rock;
    this.resourceKind = "stone";
    this.footprintW = this.resourceTileType.lenX ?? 1;
    this.footprintH = this.resourceTileType.lenY ?? 1;
    this.health = 3;
    this.task = null;
    this._lastClickTime = 0;
    this.flashTween = null;

    const cx = (gridX + this.footprintW / 2) * SQUARESIZE;
    const cy = (gridY + this.footprintH / 2) * SQUARESIZE;
    this.sprite = scene.add
      .sprite(cx, cy, "rock3")
      .setDepth(TILE_TYPES.rock.depth)
      .setInteractive({ cursor: "pointer" });

    this.sprite.ownerNode = this;
    GameMap.addToWorldStatic(this.sprite);
    this.lightId = VisibilitySystem.addLightSource({
      x: gridX + this.footprintW / 2,
      y: gridY + this.footprintH / 2,
      r: 3.3,
      brightness: 0.95,
    });

    this.setLevel(level);
    this.setUpHitDetection();
  }

  setLevel(level) {
    this.level = level;
    if (level <= 1) this.sprite.setTexture("rock3");
    else if (level === 2) this.sprite.setTexture("rock2");
    else this.sprite.setTexture("rock1");
  }

  setUpHitDetection() {
    this.sprite.on("pointerover", () => {
      const inPlaceMode = RockNode.scene.breakItems && RockNode.scene.breakItems.text === "Place";
      if (inPlaceMode) this.sprite.setTint(0x888888);
      else this.sprite.setTint(0xaaaaaa);
    });

    this.sprite.on("pointerout", () => {
      if (!this.flashTween) this.sprite.clearTint();
    });

    this.sprite.on("pointerdown", () => {
      const team = Teams.teamLists["1"];
      if (!team) return;
      const selection = OrderRunner.getSelectionProfile();

      const now = RockNode.scene.time.now;
      if (this._lastClickTime && now - this._lastClickTime < 300) {
        blockResourceManager.cancelManualClickTasksForNode(1, this);
        return;
      }
      this._lastClickTime = now;

      if (!buildingManager.isBlockAccessible(this.gridX, this.gridY, TILE_TYPES.rock)) {
        showAlert(RockNode.scene, "Can't reach that resource");
        return;
      }

      if (selection.allForagers && OrderRunner.hasPendingGatherPlacement()) {
        OrderRunner.issuePendingGatherPlacement(selection.troops, this.sprite.x, this.sprite.y);
        return;
      }

      blockResourceManager.queueManualClickTask(this, {
        teamNumber: 1,
        eligibleTroopIds: selection.allForagers ? selection.troops.map(troop => troop.id) : null,
      });
    });
  }

  startFlash() {
    if (this.flashTween) return;
    this.flashTween = RockNode.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 350,
      yoyo: true,
      repeat: -1,
      onUpdate: (tw) => {
        const on = tw.getValue() > 0.5;
        if (on) this.sprite.setTint(0x636363);
        else this.sprite.clearTint();
      },
    });
  }

  stopFlash() {
    if (this.flashTween) {
      this.flashTween.stop();
      this.flashTween.remove();
      this.flashTween = null;
    }
    this.sprite.clearTint();
  }

  applyBlockDamage(remaining) {
    this.health = remaining;
    if (remaining >= 3) this.setLevel(1);
    else if (remaining === 2) this.setLevel(2);
    else if (remaining === 1) this.setLevel(3);
    else {
      this.stopFlash();
      this.destroy();
    }
  }

  destroy() {
    if (!this.sprite) return;
    this.stopFlash();
    if (this.lightId != null) {
      VisibilitySystem.removeLightById(this.lightId);
      this.lightId = null;
    }
    if (this.task?.value === this) this.task.value = null;
    this.task = null;
    removeFromArray(GameMap.worldStones, this);
    GameMap.removeFromWorldStatic(this.sprite, true);
    this.sprite = null;
  }
}
