// pineTree.js  (add these imports at top)
import { BLOCKDEPTH, SQUARESIZE, TILE_TYPES, CHUNK_SIZE, UIDEPTH, showAlert, removeFromArray } from "../constants";
import { Teams } from "../Teams";
import { Map as GameMap } from "../map";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { buildingManager } from "../Manager/buildingManager";
import { VisibilitySystem } from "../UI/VisibilitySystem";
import { OrderRunner } from "../orders/OrderRunner";

export class PineTree {
  static scene;
  static list = [];

  // spatial index
  static buckets = new Map();   // key: "cx,cy" -> Set<PineTree>
  static visible = new Set();   // Set<PineTree> built on Map.reDraw()
  static STRIDE = 4;            // update 1/4 of visible trees per frame
  static _tick = 0;

  static init(scene) { PineTree.scene = scene; }

  // gridX, gridY are TOP-LEFT of the blocked footprint
  constructor(gridX, gridY, level = 1) {
    const scene = PineTree.scene;
    this.level = level;
    this.gridX = gridX;
    this.gridY = gridY;
    this.resourceTileType = TILE_TYPES.pine;
    this.resourceKind = "wood";
    this.footprintW = this.resourceTileType.lenX ?? 1;
    this.footprintH = this.resourceTileType.lenY ?? 1;

    const cx = (gridX + this.footprintW / 2) * SQUARESIZE;
    const cy = (gridY + this.footprintH / 2) * SQUARESIZE;
    this.container = scene.add.container(cx, cy).setDepth(TILE_TYPES.pine.depth);
    GameMap.addToWorldStatic(this.container);
    this.collider = GameMap.addStructureBarrier(
      cx,
      cy,
      this.footprintW * SQUARESIZE,
      this.footprintH * SQUARESIZE,
      {
        structureOwner: this,
      }
    );

    // all layers are 64x64 → exact overlap
    this.base = scene.add.image(0, 0, "fullBasePine").setOrigin(0.5).setDepth(BLOCKDEPTH);
    this.mid  = scene.add.image(0, 0, "fullMiddlePine").setOrigin(0.5).setDepth(BLOCKDEPTH);
    this.top  = scene.add.image(0, 0, "fullTopPine").setOrigin(0.5).setDepth(BLOCKDEPTH);
    this.container.add([this.base, this.mid, this.top]);
    //setup hitup
    this.setUpHitDetection();

    // cheap sway params
    this.phase = Math.random() * Math.PI * 2;
    this.windSpeed = 0.0015 + Math.random() * 0.001;
    this.ampBase = 1.5 + Math.random() * 0.8;
    this.ampMid  = this.ampBase * 1.2;
    this.ampTop  = this.ampBase * 1.5;

    // stagger updates across frames
    this.updateSlot = ((gridX + gridY) % PineTree.STRIDE);

    this.setLevel(level);
    this.lightId = VisibilitySystem.addLightSource({
      x: gridX + this.footprintW / 2,
      y: gridY + this.footprintH / 2,
      r: 4.0,
      brightness: 1.0,
    });
    PineTree.list.push(this);
    PineTree._register(this);
  }

  setLevel(level) {
    this.level = level;
    if (level === 1) {
      this.base.setTexture("fullBasePine");
      this.mid.setTexture("fullMiddlePine");
      this.top.setTexture("fullTopPine");
    } else if (level === 2) {
      this.base.setTexture("mediumBasePine");
      this.mid.setTexture("mediumMiddlePine");
      this.top.setTexture("fullTopPine");
    } else {
      this.base.setTexture("mediumBasePine");
      this.mid.setTexture("mediumMiddlePine");
      this.top.setTexture("mediumTopPine");
    }
  }

  update(now) {
    const t = this.phase + now * this.windSpeed;
    this.base.setAngle(Math.sin(t)        * this.ampBase);
    this.mid .setAngle(Math.sin(t + 0.25) * this.ampMid);
    this.top .setAngle(Math.sin(t + 0.50) * this.ampTop);
    this.top.x = Math.sin(t + 0.8) * 1.5; // slight crown sway
  }

  destroy() {
    this.active = false;
    PineTree.scene?.setForagerRouteHover?.(this, this.resourceKind, false);
    this.stopFlash?.();
    if (this.lightId != null) {
      VisibilitySystem.removeLightById(this.lightId);
      this.lightId = null;
    }
    GameMap.removeStructureBarrier(this.collider);
    this.collider = null;
    if (this.task?.value === this) this.task.value = null;
    this.task = null;
    this.container.destroy(true);
    removeFromArray(GameMap.worldPines, this);
    const i = PineTree.list.indexOf(this);
    if (i >= 0) PineTree.list.splice(i, 1);
    PineTree._unregister(this);
  }

  // -------- spatial indexing --------
  static _chunkKeyForGrid(gx, gy) {
    const cx = Math.floor(gx / CHUNK_SIZE);
    const cy = Math.floor(gy / CHUNK_SIZE);
    return `${cx},${cy}`;
  }

  static _register(p) {
    const key = PineTree._chunkKeyForGrid(p.gridX, p.gridY);
    let set = PineTree.buckets.get(key);
    if (!set) { set = new Set(); PineTree.buckets.set(key, set); }
    set.add(p);
  }

  static _unregister(p) {
    const key = PineTree._chunkKeyForGrid(p.gridX, p.gridY);
    const set = PineTree.buckets.get(key);
    if (set) set.delete(p);
  }

  // Build visible set from a grid rect (inclusive-exclusive)
  static rebuildVisibleForGridRange(gx0, gy0, gx1, gy1) {
    PineTree.visible.clear();

    // bucket span we need to scan
    const c0x = Math.floor(gx0 / CHUNK_SIZE);
    const c0y = Math.floor(gy0 / CHUNK_SIZE);
    const c1x = Math.floor((gx1 - 1) / CHUNK_SIZE);
    const c1y = Math.floor((gy1 - 1) / CHUNK_SIZE);

    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const set = PineTree.buckets.get(`${cx},${cy}`);
        if (!set) continue;

        for (const p of set) {
          const px0 = p.gridX;
          const py0 = p.gridY;
          const px1 = px0 + (p.footprintW ?? p.resourceTileType?.lenX ?? 1); // exclusive
          const py1 = py0 + (p.footprintH ?? p.resourceTileType?.lenY ?? 1); // exclusive

          // AABB overlap test in GRID SPACE:
          // include only if pine footprint intersects redraw rect
          if (px1 <= gx0 || px0 >= gx1 || py1 <= gy0 || py0 >= gy1) {
            continue; // no overlap
          }
          PineTree.visible.add(p);
        }
      }
    }
  }

  // -------- fast global update --------
  static updateAll(now) {
    const scene = PineTree.scene;
    if (!scene) return;

    // animate everything, always
    for (const p of PineTree.list) p.update(now);
  }

  setUpHitDetection(){
    // Match the interactive footprint to the blocked footprint.
    const scene = PineTree.scene;
    this.hit = scene.add.zone(0, 0, SQUARESIZE * this.footprintW, SQUARESIZE * this.footprintH)
      .setOrigin(0.5)
      .setInteractive({ cursor: 'pointer' });
    this.container.add(this.hit);

    // optional: store health like the old sprite path
    this.health = 3;

    // hover: darken the 3 layers
    this.hit.on('pointerover', (pointer) => {
      scene.setForagerRouteHover?.(this, "wood", true, pointer);
      // only show hover when not placing/breaking builds unless you want both
      if (!scene.breakItems || scene.breakItems.text !== "Place") {
        this.base.setTint(0xaaaaaa);
        this.mid.setTint(0xaaaaaa);
        this.top.setTint(0xaaaaaa);
      } else {
        // in break mode we still want a hand + darken feedback
        this.base.setTint(0x888888);
        this.mid.setTint(0x888888);
        this.top.setTint(0x888888);
      }
    });

    this.hit.on('pointerout', (pointer) => {
      scene.setForagerRouteHover?.(this, "wood", false, pointer);
      this.base?.clearTint?.();
      this.mid?.clearTint?.();
      this.top?.clearTint?.();
    });

    // click: either queue block-resource job OR create destroy job
    this.hit.on('pointerdown', () => {
      const scene = PineTree.scene;
      const team = Teams.teamLists['1'];
      if (!team) return;
      const selection = OrderRunner.getSelectionProfile();

      if (scene.tryIssueForagerRouteToNode?.(this, "wood")) {
        return;
      }

      // --- double click detect ---
      const now = scene.time.now;
      if (this._lastClickTime && (now - this._lastClickTime) < 300) {
        blockResourceManager.cancelManualClickTasksForNode(1, this);
        return;
      }
      this._lastClickTime = now;

      if (!buildingManager.isBlockAccessible(this.gridX, this.gridY, TILE_TYPES.pine)) {
        showAlert(scene, "Can't reach that tree");
        return;
      }

      if (selection.allForagers && OrderRunner.hasPendingGatherPlacement()) {
        OrderRunner.issuePendingGatherPlacement(selection.troops, this.container.x, this.container.y);
        return;
      }

      blockResourceManager.queueManualClickTask(this, {
        teamNumber: 1,
        eligibleTroopIds: selection.allForagers ? selection.troops.map(troop => troop.id) : null,
      });
    });

  }

  startFlash() {
    const scene = PineTree.scene;
    if (!scene) return;

    // already flashing
    if (this.flashTween) return;

    // flash by toggling tintFill on/off (reads as “brighter”)
    this.flashTween = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 350,
      yoyo: true,
      repeat: -1,
      onUpdate: (tw) => {
        const v = tw.getValue();
        const on = v > 0.5;
        const layers = [this.base, this.mid, this.top];

        for (const s of layers) {
          if (!s?.active) continue;
          if (on) s.setTint(0x636363);
          else s.clearTint();
        }
      }
    });
  }

  stopFlash() {
    if (this.flashTween) {
      this.flashTween.stop();
      this.flashTween.remove();
      this.flashTween = null;
    }
    this.base?.clearTint?.();
    this.mid?.clearTint?.();
    this.top?.clearTint?.();
  }

  applyBlockDamage(remaining) {
    this.health = remaining;

    // Map remaining → layered visual "level"
    // 3 → full/full/full (level 1)
    // 2 → medium/medium/full (level 2)
    // 1 → medium/medium/medium (level 3)
    if (remaining >= 3) {
      this.setLevel(1);
    } else if (remaining === 2) {
      this.setLevel(2);
    } else if (remaining === 1) {
      this.setLevel(3);
    } else {
      // destroyed
      this.stopFlash();
      this.destroy();
    }
  }
}
