import { BLOCKDEPTH, SQUARESIZE, removeFromArray, showAlert } from "../constants";
import { Teams } from "../Teams";
import { Map as GameMap } from "../map";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { buildingManager } from "../Manager/buildingManager";
import { OrderRunner } from "../orders/OrderRunner";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

export const FARM_BUSH_TYPES = Object.freeze({
  seed: {
    name: "seedBush",
    textureKey: "seedBush",
    label: "seed bush",
    block: false,
    resourceKind: "seed",
    resource: UI_ITEM_TYPES.seedCrop,
    lenX: 1,
    lenY: 1,
    depth: BLOCKDEPTH + 0.25,
    gatherMode: "pickup",
    gatherDuration: 850,
    worldListKey: "worldSeedBushes",
  },
  berry: {
    name: "berryBush",
    textureKey: "berryBush",
    label: "berry bush",
    block: false,
    resourceKind: "berry",
    resource: UI_ITEM_TYPES.seedBerry,
    lenX: 1,
    lenY: 1,
    depth: BLOCKDEPTH + 0.25,
    gatherMode: "pickup",
    gatherDuration: 850,
    worldListKey: "worldBerryBushes",
  },
});

export class FarmBushNode {
  static scene;

  static init(scene) {
    FarmBushNode.scene = scene;
  }

  constructor(gridX, gridY, kind = "seed") {
    const scene = FarmBushNode.scene;
    const type = FARM_BUSH_TYPES[kind] || FARM_BUSH_TYPES.seed;
    if (!scene) {
      throw new Error("FarmBushNode.init(scene) must be called before creating bushes");
    }

    this.gridX = gridX;
    this.gridY = gridY;
    this.resourceTileType = type;
    this.resourceKind = type.resourceKind;
    this.footprintW = type.lenX ?? 1;
    this.footprintH = type.lenY ?? 1;
    this.health = 1;
    this.task = null;
    this.flashTween = null;
    this._lastClickTime = 0;
    this.active = true;

    const worldX = (gridX + 0.5) * SQUARESIZE;
    const worldY = (gridY + 1) * SQUARESIZE - 2;
    this.sprite = scene.add
      .image(worldX, worldY, type.textureKey)
      .setOrigin(0.5, 1)
      .setDepth(type.depth)
      .setInteractive({ cursor: "pointer" });

    this.x = worldX;
    this.y = worldY;
    this.sprite.ownerNode = this;
    GameMap.addToWorldStatic(this.sprite);
    GameMap[type.worldListKey]?.push?.(this);

    this.setUpHitDetection();
  }

  setUpHitDetection() {
    this.sprite.on("pointerover", () => {
      const inPlaceMode = FarmBushNode.scene.breakItems && FarmBushNode.scene.breakItems.text === "Place";
      this.sprite.setTint(inPlaceMode ? 0x888888 : 0xaaaaaa);
    });

    this.sprite.on("pointerout", () => {
      if (!this.flashTween) this.sprite.clearTint();
    });

    this.sprite.on("pointerdown", () => {
      const team = Teams.teamLists["1"];
      if (!team) return;
      const selection = OrderRunner.getSelectionProfile();

      const now = FarmBushNode.scene.time.now;
      if (this._lastClickTime && now - this._lastClickTime < 300) {
        blockResourceManager.cancelManualClickTasksForNode(1, this);
        return;
      }
      this._lastClickTime = now;

      if (!buildingManager.isBlockAccessible(this.gridX, this.gridY, this.resourceTileType)) {
        showAlert(FarmBushNode.scene, `Can't reach that ${this.resourceTileType.label}`);
        return;
      }

      if (selection.allForagers && OrderRunner.hasPendingGatherPlacement()) {
        OrderRunner.issuePendingGatherPlacement(selection.troops, this.sprite.x, this.sprite.y);
        return;
      }

      blockResourceManager.queueManualClickTask(this, {
        teamNumber: 1,
        eligibleTroopIds: selection.allForagers ? selection.troops.map((troop) => troop.id) : null,
      });
    });
  }

  startFlash() {
    if (this.flashTween) return;
    this.flashTween = FarmBushNode.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 350,
      yoyo: true,
      repeat: -1,
      onUpdate: (tw) => {
        if (!this.sprite?.active) return;
        if (tw.getValue() > 0.5) this.sprite.setTint(0x636363);
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
    this.sprite?.clearTint?.();
  }

  applyBlockDamage(remaining) {
    this.health = remaining;
    if (remaining <= 0) {
      this.stopFlash();
      this.destroy();
    }
  }

  destroy() {
    if (!this.active) return;
    this.active = false;
    this.stopFlash();
    if (this.task?.value === this) this.task.value = null;
    this.task = null;
    removeFromArray(GameMap[this.resourceTileType.worldListKey], this);
    GameMap.removeFromWorldStatic(this.sprite, true);
    this.sprite = null;
  }
}
