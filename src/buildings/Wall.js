// Wall.js
import { Map as GameMap } from "../map";
import { TILE_MAP, TILE_TYPES, SQUARESIZE } from "../constants";
import { WallPlacementController } from "../Controllers/WallPlacementController";

export class Wall {
  // registry by "x,y"
  static byCell = new Map();

  // tune health here
  static HP = {
    stoneWall: 180,
    woodWall: 90,
    stoneDoor: 140,
    woodDoor: 70,
  };

  static keyFor(x, y) { return `${x},${y}`; }

  static isWallOrDoorCell(cell) {
    const v = Array.isArray(cell) ? cell[1] : cell;
    // wall pieces: 2..10, wood wall pieces: 57..65, doors: 66/67
    return (v >= 2 && v <= 10) || (v >= 57 && v <= 65) || v === 66 || v === 67;
  }

  // Returns material/isDoor + *baseKey* that encodes edge/corner/interior naming.
  static kindFromGridVal(v) {
    // doors
    if (v === TILE_TYPES.wall_door.grid) {
      return { material: "stone", isDoor: true, doorKey: "wall_door", baseKey: null };
    }
    if (v === TILE_TYPES.woodWall_door.grid) {
      return { material: "wood", isDoor: true, doorKey: "woodWall_door", baseKey: null };
    }

    // stone wall pieces: 2..10
    if (v >= 2 && v <= 10) {
      const t = TILE_TYPES.wall;
      // interior
      if (v === t.interior) return { material: "stone", isDoor: false, baseKey: "wall_interior" };
      // any side code -> edge
      if (Object.values(t.sides).includes(v)) return { material: "stone", isDoor: false, baseKey: "wall_edge" };
      // any corner code -> corner
      if (Object.values(t.corners).includes(v)) return { material: "stone", isDoor: false, baseKey: "wall_corner" };
      // fallback
      return { material: "stone", isDoor: false, baseKey: "wall_interior" };
    }

    // wood wall pieces: 57..65
    if (v >= 57 && v <= 65) {
      const t = TILE_TYPES.woodWall;
      if (v === t.interior) return { material: "wood", isDoor: false, baseKey: "woodWall_interior" };
      if (Object.values(t.sides).includes(v)) return { material: "wood", isDoor: false, baseKey: "woodWall_edge" };
      if (Object.values(t.corners).includes(v)) return { material: "wood", isDoor: false, baseKey: "woodWall_corner" };
      return { material: "wood", isDoor: false, baseKey: "woodWall_interior" };
    }

    return null;
  }

  // ---- creation / ensure
  static ensureAt(scene, x, y) {
    const cell = GameMap.grid?.[y]?.[x];
    if (cell == null) return null;
    if (!this.isWallOrDoorCell(cell)) return null;

    const v = Array.isArray(cell) ? cell[1] : cell;
    const kind = Wall.kindFromGridVal(v);
    if (!kind) return null;

    const k = this.keyFor(x, y);
    let w = this.byCell.get(k);

    // If none exists (or it was deactivated), create fresh.
    if (!w || !w.active) {
      w = new Wall(scene, x, y, v);
      this.byCell.set(k, w);
      return w;
    }

    // ---- Refresh path: keep existing HP/phase/open state, but allow sprite swap/rotation ----
    const nextIsDoor = kind.isDoor;
    const nextDoorKey = kind.doorKey || null;
    const nextBaseKey = kind.baseKey || null;

    const spriteMissing = !w.sprite || !w.sprite.active;

    const needRebuild =
      spriteMissing ||
      w.isDoor !== nextIsDoor ||
      (nextIsDoor
        ? (w.doorKey !== nextDoorKey)
        : (w.baseKey !== nextBaseKey));

    // Update logical kind (so future calls are consistent)
    w.isDoor = nextIsDoor;
    w.material = kind.material;
    w.baseKey = nextBaseKey;
    w.doorKey = nextDoorKey;

    if (needRebuild) {
      // preserve state
      const hp = w.hp;
      const maxHp = w.maxHp;
      const phase = w.phase;
      const open = w.isOpen;

      // kill old sprite
      if (w.sprite) {
        w.sprite.destroy();
        w.sprite = null;
      }

      const cx = x * SQUARESIZE + SQUARESIZE / 2;
      const cy = y * SQUARESIZE + SQUARESIZE / 2;

      if (w.isDoor) {
        w.sprite = scene.add.sprite(cx, cy, w.doorKey, 0);
        w.sprite.setAngle(WallPlacementController.doorAngleForCell(GameMap.grid, x, y, w.doorKey));
        WallPlacementController.bindDoorSprite(scene, w.sprite);
      } else {
        w.sprite = scene.add.sprite(cx, cy, w.baseKey, 0);

        // angle depends on numeric grid val (edge/corner)
        const ang = WallPlacementController._angleForWallPiece(v);
        w.sprite.setAngle(ang);
      }

      const def = w.isDoor
        ? TILE_TYPES[w.doorKey]
        : (w.material === "stone" ? TILE_TYPES.wall : TILE_TYPES.woodWall);

      w.sprite.setDepth(def?.depth ?? 10);
      w.sprite.setDisplaySize(SQUARESIZE, SQUARESIZE);

      // ensure on static layer (safe even if already there)
      GameMap.worldStaticLayer.add(w.sprite);

      // restore state
      w.hp = hp;
      w.maxHp = maxHp;
      w.phase = phase;
      w.isOpen = open;

      // force visuals to match current phase/open state
      // (this will set the correct frame)
      if (w.isDoor) {
        w.sprite.setFrame(w._doorFrameFor(w.phase, w.isOpen));
      } else {
        w.sprite.setFrame(w.phase);
      }

      return w;
    }

    // If no rebuild, still update rotation in case neighbor placement changed corner/edge direction
    if (!w.isDoor && w.sprite?.active) {
      const ang = WallPlacementController._angleForWallPiece(v);
      w.sprite.setAngle(ang);
    } else if (w.isDoor && w.sprite?.active) {
      w.sprite.setAngle(WallPlacementController.doorAngleForCell(GameMap.grid, x, y, w.doorKey));
    }

    // Make sure current visuals reflect current HP (phase may change over time)
    w._applyVisuals();

    return w;
  }


  static getAt(x, y) {
    return this.byCell.get(this.keyFor(x, y)) || null;
  }

  // ---- destruction entrypoint
  static destroyAt(x, y) {
    const w = this.getAt(x, y);
    if (w) w.destroy();

    // Replace grid tile to grass WITHOUT going through Map.drawGridValue
    // (we don't want redraw to own these)
    GameMap.grid[y][x] = TILE_TYPES.grass.grid;

    return true;
  }

  constructor(scene, x, y, gridVal) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    const kind = Wall.kindFromGridVal(gridVal);
    if (!kind) {
      this.active = false;
      return;
    }

    this.material = kind.material;
    this.isDoor = kind.isDoor;
    this.baseKey = kind.baseKey;  // e.g. wall_edge / wall_corner / wall_interior / woodWall_edge...
    this.doorKey = kind.doorKey;  // e.g. wall_door / woodWall_door

    const hpKey =
      this.material === "stone"
        ? (this.isDoor ? "stoneDoor" : "stoneWall")
        : (this.isDoor ? "woodDoor" : "woodWall");

    this.maxHp = Wall.HP[hpKey];
    this.hp = this.maxHp;

    this.phase = 0;
    this.isOpen = false;

    const cx = x * SQUARESIZE + SQUARESIZE / 2;
    const cy = y * SQUARESIZE + SQUARESIZE / 2;

    if (this.isDoor) {
      this.sprite = scene.add.sprite(cx, cy, this.doorKey, 0);
      this.sprite.setAngle(WallPlacementController.doorAngleForCell(GameMap.grid, x, y, this.doorKey));
      WallPlacementController.bindDoorSprite(scene, this.sprite);
    } else {
      // wall pieces are spritesheets: frame 0=phase1 (max), 1=phase2 (mid), 2=phase3 (low)
      this.sprite = scene.add.sprite(cx, cy, this.baseKey, 0);

      // Rotate edge/corner based on grid numeric code
      const ang = WallPlacementController._angleForWallPiece(gridVal);
      this.sprite.setAngle(ang);
    }

    // depth: use the underlying type for depth
    const def = this.isDoor
      ? TILE_TYPES[this.doorKey]
      : (this.material === "stone" ? TILE_TYPES.wall : TILE_TYPES.woodWall);

    this.sprite.setDepth(def?.depth ?? 10);
    this.sprite.setDisplaySize(SQUARESIZE, SQUARESIZE);

    GameMap.worldStaticLayer.add(this.sprite);

    this.active = true;
    this._applyVisuals(); // init phase visuals
  }

  _doorFrameFor(phaseIdx, open) {
    // doors: (phase0: frames 0 closed,1 open), (phase1: 2,3), (phase2: 4,5)
    const base = phaseIdx * 2;
    return base + (open ? 1 : 0);
  }

  _phaseFromHp() {
    const r = this.hp / this.maxHp;
    if (r > 0.66) return 0;      // healthy
    if (r > 0.33) return 1;      // mid
    return 2;                    // low
  }

  _doorFrameFor(phaseIdx, open) {
    // phase0 => 0/1, phase1 => 2/3, phase2 => 4/5
    const base = phaseIdx * 2;
    return base + (open ? 1 : 0);
  }

  _applyVisuals() {
    const newPhase = this._phaseFromHp();
    if (newPhase === this.phase) return;
    this.phase = newPhase;

    if (!this.sprite || !this.sprite.active) return;

    if (this.isDoor) {
      this.sprite.setFrame(this._doorFrameFor(this.phase, this.isOpen));
    } else {
      // IMPORTANT: walls are spritesheets with 3 frames
      this.sprite.setFrame(this.phase); // 0,1,2
    }
  }

  // optional external open/close control if you later want it:
  setOpen(open) {
    if (!this.isDoor || !this.sprite) return;
    this.isOpen = !!open;
    this.sprite.setFrame(this._doorFrameFor(this.phase, this.isOpen));
  }


  damage(amount) {
    if (!this.active) return false;

    const dmg = Math.max(0, amount);
    if (dmg <= 0) return false;

    this.hp = Math.max(0, this.hp - dmg);

    // ✅ feedback on hit
    this._shakeAndFlash();

    this._applyVisuals();
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }
    return false;
  }

  _shakeAndFlash() {
    if (!this.scene || !this.sprite || !this.sprite.active) return;

    // shake
    this.scene.tweens.add({
      targets: this.sprite,
      x: "+=2",
      yoyo: true,
      duration: 35,
      repeat: 2
    });

    // flash red
    this.sprite.setTint(0xff5555);
    this.scene.time.delayedCall(110, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });
  }


  destroy() {
    if (!this.active) return;
    this.active = false;

    // remove sprite
    if (this.sprite) {
      // doorGroup has dead children sometimes; Phaser tolerates destroy()
      this.sprite.destroy();
      this.sprite = null;
    }

    // remove registry
    Wall.byCell.delete(Wall.keyFor(this.x, this.y));
  }
}
