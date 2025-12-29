// pineTree.js  (add these imports at top)
import { BLOCKDEPTH, SQUARESIZE, TILE_TYPES, CHUNK_SIZE, UIDEPTH, showAlert } from "../constants";
import { Teams } from "../Teams";
import { Map as GameMap } from "../map";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { buildingManager } from "../Manager/buildingManager";

export class PineTree {
  static scene;
  static list = [];

  // spatial index
  static buckets = new Map();   // key: "cx,cy" -> Set<PineTree>
  static visible = new Set();   // Set<PineTree> built on Map.reDraw()
  static STRIDE = 4;            // update 1/4 of visible trees per frame
  static _tick = 0;

  static init(scene) { PineTree.scene = scene; }

  // gridX, gridY are TOP-LEFT of the 3x3 footprint
  constructor(gridX, gridY, level = 1) {
    const scene = PineTree.scene;
    this.level = level;
    this.gridX = gridX;
    this.gridY = gridY;

    // center of 3x3 footprint (matches old non-spread placement)
    const cx = (gridX + 1.5) * SQUARESIZE;
    const cy = (gridY + 1.5) * SQUARESIZE;
    this.container = scene.add.container(cx, cy).setDepth(TILE_TYPES.pine.depth);
    GameMap.addToWorldStatic(this.container);

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
    this.container.destroy(true);
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

    // pine footprint in grid cells
    const FOOT = 3; // 3x3

    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const set = PineTree.buckets.get(`${cx},${cy}`);
        if (!set) continue;

        for (const p of set) {
          // p.gridX, p.gridY = top-left of 3x3
          const px0 = p.gridX;
          const py0 = p.gridY;
          const px1 = px0 + FOOT; // exclusive
          const py1 = py0 + FOOT; // exclusive

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

    // only in detailed mode
    const mode = scene.zoomMixer?.mode || 'detailed';
    if (mode !== 'detailed') return;

    PineTree._tick++;

    // only iterate already-computed visible pines (no per-frame culling)
    const strideMask = PineTree._tick % PineTree.STRIDE;
    for (const p of PineTree.visible) {
      if (p.updateSlot === strideMask) p.update(now);
    }
  }

  setUpHitDetection(){
    // === interactive hit area covering the 3x3 footprint ===
    const scene = PineTree.scene;
    this.hit = scene.add.zone(0, 0, SQUARESIZE * 3, SQUARESIZE * 3)
      .setOrigin(0.5)
      .setInteractive({ cursor: 'pointer' });
    this.container.add(this.hit);

    // optional: store health like the old sprite path
    this.health = 3;

    // hover: darken the 3 layers
    this.hit.on('pointerover', () => {
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

    this.hit.on('pointerout', () => {
      this.base.clearTint();
      this.mid.clearTint();
      this.top.clearTint();
    });

    // click: either queue block-resource job OR create destroy job
    this.hit.on('pointerdown', () => {
      const team = Teams.teamLists['1'];
      if (!team) return;

      // queue block resource gather job (like the previous sprite logic)
      const teamList = team.blockResourceList;
      const foragerQueue = team.foragerQueue;

      if (!buildingManager.isBlockAccessible(this.gridX, this.gridY, TILE_TYPES.pine)) {
        showAlert(scene, "Can't reach that tree");  // or console.warn
        return;
      }

      if (!this.task) {
        // draw yellow “queued” outline once
        if (!this.queuedOutline) {
          this.queuedOutline = GameMap.scene.add.graphics();
          this.queuedOutline.setDepth(UIDEPTH);
          this.queuedOutline.lineStyle(2, 0xffff00, 1);
          const xStart = this.container.x - (SQUARESIZE * 3) / 2;
          const yStart = this.container.y - (SQUARESIZE * 3) / 2;
          this.queuedOutline.strokeRect(xStart, yStart, SQUARESIZE * 3, SQUARESIZE * 3);
        }

        const task = {
          x: this.gridX,
          y: this.gridY,
          type: TILE_TYPES.pine,
          resource: TILE_TYPES.pine.resource,  // same as before
          value: this,                         // << layered pine instance
          assigned: 0,
          remaining: this.health,
          forageType: 'block'
        };
        this.task = task;
        foragerQueue.push(task);
      } else {
        // ensure still in block list
        const stillInList = teamList.includes(this.task);
        if (!stillInList) teamList.push(this.task);
      }
    });

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
      if (this.queuedOutline) { this.queuedOutline.destroy(); this.queuedOutline = null; }
      this.destroy();
    }
  }
}
