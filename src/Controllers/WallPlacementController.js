// WallPlacementController.js
import Phaser from "phaser";
import { SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, UIDEPTH } from "../constants";
import { Map } from "../map";
import { buildingManager } from "../Manager/buildingManager";
import { Player } from "../players/Player";
import { TILE_ARR, TILE_MAP } from "../constants";
import wall_interior from "url:../assets/wall/stone_interior.png";
import wall_edge from "url:../assets/wall/stone_edge.png";
import wall_corner from "url:../assets/wall/stone_corner.png";
import woodWall_interior from "url:../assets/wall/woodWall_interior.png";
import woodWall_edge from "url:../assets/wall/woodWall_edge.png";
import woodWall_corner from "url:../assets/wall/woodWall_corner.png";
import stone_door from "url:../assets/wall/stone_door.png";
import wood_door from "url:../assets/wall/woodWall_door.png";
import { AudioManager } from "../Manager/AudioManager";
import { VisibilitySystem } from "../UI/VisibilitySystem";
import { Map as GameMap } from "../map";

export class WallPlacementController {
  constructor(scene) {
    this.scene = scene;

    this.segments = []; 
    // each: { start:{x,y}, end:{x,y}, cells:[{x,y}...] } (cells excludes start if you want)
    this.segmentStart = null; // {x,y} when phase === 1

    this.active = false;
    this.wallTypeName = "wall";   // "wall" or "woodWall"
    this.consumeNextClick = false; // <--- ADD

    this.pivots = [];             // [{x,y}]
    this.committedCells = [];     // cells locked in by prior clicks (all segments except current preview)
    this.previewCells = [];       // live segment cells under mouse

    this.previewSprites = [];     // pooled sprites for ghost
    this.previewContainer = null;

    this.ui = null;               // container for phase text + finalize button
    this.phase = 0;               // 0 = not started, 1 = have start pivot

    this.lastAxis = null;         // "x" or "y" (for “best linear” preference)
    this._initDoorPhysicsOnce(); // ✅ only needs to happen once per scene
  }

_initDoorPhysicsOnce() {
  const scene = this.scene;

  if (scene.__doorsPhysicsInited) return;
  if (scene.__doorPostUpdateHandler) {
    scene.events.off("postupdate", scene.__doorPostUpdateHandler);
    scene.__doorPostUpdateHandler = null;
  }
  scene.doorGroup?.destroy?.(true);
  scene.__doorsPhysicsInited = true;

  // ✅ one static group for all doors
  scene.doorGroup = scene.physics.add.staticGroup();

  // ✅ one overlap callback for all characters vs all doors
  // NOTE: Player.characters must be a physics group (Arcade).
  scene.physics.add.overlap(
    Player.characters,
    scene.doorGroup,
    (_character, doorSprite) => {
      // mark touched this frame (for open)
      doorSprite.__touchedThisFrame = true;
    },
    null,
    scene
  );

  const iterateDoors = (callback) => {
    const children = scene.doorGroup?.children;
    if (!children) return;

    if (typeof children.iterate === "function") {
      children.iterate(callback);
      return;
    }

    if (typeof children.getArray === "function") {
      children.getArray().forEach(callback);
      return;
    }

    if (Array.isArray(children.entries)) {
      children.entries.forEach(callback);
    }
  };

  // ✅ postupdate: open if touched, else close
  scene.__doorPostUpdateHandler = () => {
    if (!scene.doorGroup) return;

    iterateDoors((door) => {
      if (!door || !door.active) return;

      const shouldOpen = !!door.__touchedThisFrame;
      const wasOpen = !!door.__isOpen;

      // only do work if state changes
      if (shouldOpen !== wasOpen) {
        door.__isOpen = shouldOpen;

        // swap frame: 0 closed, 1 open
        door.setFrame(shouldOpen ? 1 : 0);

        // throttle per-door to avoid spam on jittery overlaps
        const now = scene.time.now;
        if (door.__nextDoorSfxAt == null) door.__nextDoorSfxAt = 0;

        if (now >= door.__nextDoorSfxAt) {
          if (shouldOpen) AudioManager.playSound("sfx_door_open", { volume: 0.26 });
          else AudioManager.playSound("sfx_door_close", { volume: 0.26 });

          door.__nextDoorSfxAt = now + 140; // ms; tune
        }
      }

      door.__touchedThisFrame = false;
    });
  };

  scene.events.on("postupdate", scene.__doorPostUpdateHandler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (scene.__doorPostUpdateHandler) {
      scene.events.off("postupdate", scene.__doorPostUpdateHandler);
      scene.__doorPostUpdateHandler = null;
    }
    scene.doorGroup?.destroy?.(true);
    scene.doorGroup = null;
    scene.__doorsPhysicsInited = false;
  });
}

  start(wallTypeName) {
    this.segments = [];
    this.segmentStart = null;
    this.active = true;
    this.wallTypeName = wallTypeName; // "wall" or "woodWall"
    this.committedDoors = [];
      this.orderedBuildTiles = []; // ✅ walls + doors in the order you want built

    this.consumeNextClick = true; // <--- ADD (eat the UI click)
    this.pivots = [];
    this.committedCells = [];
    this.previewCells = [];
    this.phase = 0;
    this.lastAxis = null;

    if (!this.previewContainer) {
      this.previewContainer = this.scene.add.container(0, 0).setDepth(9999);
    } else {
      this.previewContainer.removeAll(true);
    }
    this.previewSprites = [];

    this._ensureUI();
    this._setPhase1Text(true, 0);
    this._updateFinalizeEnabled(false);
  }

  static preload(scene){
    // Preload any assets needed for wall preview ghosts
    this.scene = scene;
    scene.load.spritesheet('wall_interior', wall_interior, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('wall_edge', wall_edge, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('wall_corner', wall_corner, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('wall_door', stone_door, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('woodWall_interior', woodWall_interior, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('woodWall_edge', woodWall_edge, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('woodWall_corner', woodWall_corner, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
    scene.load.spritesheet('woodWall_door', wood_door, { frameWidth: SQUARESIZE, frameHeight: SQUARESIZE });
  }

  stop() {
    this.segmentStart = null;
    this.committedDoors = [];
    this.orderedBuildTiles = [];
    this.active = false;
    this.phase = 0;
    this.pivots = [];
    this.committedCells = [];
    this.previewCells = [];
    this.lastAxis = null;

    if (this.previewContainer) this.previewContainer.removeAll(true);
    this.previewSprites = [];

    if (this.ui) this.ui.setVisible(false);
  }

  // ESC behavior:
  // - if we have >=2 pivots: remove last segment (go back one pivot)
  // - else: exit mode completely
  onEsc() {
    if (!this.active) return;

    // If we are mid-segment (picked a start but haven't ended it), cancel that start
    if (this.phase === 1) {
        this.segmentStart = null;
        this.phase = 0;
        this.previewCells = [];
        this._setPhase1Text(true, this._queuedCount());
        this._redrawGhost(true);
        return;
    }

    // Otherwise, remove last completed segment if any
    if (this.segments.length > 0) {
        const last = this.segments.pop();

        const killWalls = new Set(last.walls.map(c => `${c.x},${c.y}`));
        this.committedCells = this.committedCells.filter(c => !killWalls.has(`${c.x},${c.y}`));

        const killDoors = new Set(last.doors.map(c => `${c.x},${c.y}`));
        this.committedDoors = (this.committedDoors || []).filter(c => !killDoors.has(`${c.x},${c.y}`));

        if (this.orderedBuildTiles?.length) {
          const kill = new Set([
            ...last.walls.map(c => `${c.x},${c.y}`),
            ...last.doors.map(c => `${c.x},${c.y}`),
          ]);

          // remove ONLY tiles that belong to that segment
          this.orderedBuildTiles = this.orderedBuildTiles.filter(t => !kill.has(`${t.x},${t.y}`));
        }

        this._updateFinalizeEnabled(this._queuedCount() > 0);
        this._setPhase1Text(true, this._queuedCount());
        this._redrawGhost(true);
        return;
    }

    // nothing to undo → exit mode
    this.stop();
  }

  onPointerMove(pointer) {
    if (!this.active) return;

    const g = this._pointerToGrid(pointer);
    if (!g) return;

    // Phase 0: hover a single potential START tile
    if (this.phase === 0) {
        const ok = this._canPlaceCell(g.x, g.y);
        this._setPhase1Text(ok, this._queuedCount());
        this.previewCells = [{ x: g.x, y: g.y }];
        this._redrawGhost(ok);
        return;
    }

    // Phase 1: preview segment from segmentStart -> mouse
    const seg = this._strictLineSegment(this.segmentStart, g);
    if (!seg) {
        // show invalid preview (single tile or nothing)
        this.previewCells = [];
        this._setPhase2Text(false, this._queuedCount([]));
        this._redrawGhost(false);
        return;
    }
    const longEnough = seg.length >= 1;
    const ok = longEnough && this._canPlaceCells(seg, true);
    const midIdx = Math.floor(seg.length / 2);  // works for 3+ length
    this.previewCells = seg;
    this._setPhase2Text(ok, this._queuedCount(seg));
    this._redrawGhost(ok);
}

  onClick(pointer) {
    if (!this.active) return;

    if (this.consumeNextClick) {
        this.consumeNextClick = false;
        return;
    }

    if (this.finalBtn?.visible) {
      const bounds = this.finalBtn.getBounds?.();
      if (bounds && Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y)) {
        this.finalize();
        return;
      }
    }

    const g = this._pointerToGrid(pointer);
    if (!g) return;

    // Phase 0: pick START of a new segment
    if (this.phase === 0) {
        if (!this._canPlaceCell(g.x, g.y)) return;

        this.segmentStart = { x: g.x, y: g.y };
        this.phase = 1;

        // show phase 2 prompt; preview will update on move
        this._setPhase2Text(true, this._queuedCount([]));
        this._updateFinalizeEnabled(this._queuedCount() > 0);
        return;
    }

    // Phase 1: click ends current segment (commit it)
// Phase 1: click ends current segment (commit it)
const seg = this._strictLineSegment(this.segmentStart, g);
if (!seg || seg.length < 1) return;
if (!this._canPlaceCells(seg, true)) return;

const hasDoor = seg.length >= 3;
const midIdx = hasDoor ? Math.floor(seg.length / 2) : -1;

let doorCell = null;
let wallCells = seg;
let doorsForSegment = [];

const doorTypeName =
  (this.wallTypeName === "woodWall") ? "woodWall_door" : "wall_door";

if (hasDoor) {
  doorCell = seg[midIdx];
  doorsForSegment = [doorCell];
  wallCells = seg.filter((_, i) => i !== midIdx);

  this.committedDoors = this.committedDoors || [];
  const isVertical = seg[0].x === seg[seg.length - 1].x;
  const angle = isVertical ? 90 : 0;
  this.committedDoors.push({ x: doorCell.x, y: doorCell.y, angle });
}

this.committedCells.push(...wallCells);

// enqueue IN ORDER (door interleaved)
for (let i = 0; i < seg.length; i++) {
  const c = seg[i];
  const isDoorHere = hasDoor && (i === midIdx);
  this.orderedBuildTiles.push({
    x: c.x,
    y: c.y,
    buildTypeName: isDoorHere ? doorTypeName : this.wallTypeName,
  });
}


    // record segment so ESC can pop exactly this segment
    this.segments.push({
      start: { ...this.segmentStart },
      end: { x: g.x, y: g.y },
      walls: wallCells,
      doors: doorsForSegment,
    });

    // IMPORTANT: end segment AND return to phase 0 (next click starts a new segment anywhere)
    this.segmentStart = null;
    this.phase = 0;
    this.previewCells = [];

    this._updateFinalizeEnabled(this._queuedCount() > 0);
    this._setPhase1Text(true, this._queuedCount());
    this._redrawGhost(true);
    }

finalize() {
  if (!this.active) return;
  if (!this.orderedBuildTiles?.length) return;

  // stable de-dupe while keeping first occurrence (preserves your segment build order)
  const seen = new Set();
  const ordered = [];
  for (const t of this.orderedBuildTiles) {
    const k = `${t.x},${t.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    ordered.push(t);
  }

  // Enqueue mixed build types and let the builder scheduler delegate them.
  buildingManager.createBuildTileStateArray(ordered, "1");
  this.stop();
}

  // ---------- internals ----------

  _pointerToGrid(pointer) {
    if (pointer.worldX < 0 || pointer.worldY < 0) return null;
    const gx = Math.floor(pointer.worldX / SQUARESIZE);
    const gy = Math.floor(pointer.worldY / SQUARESIZE);
    if (gx < 0 || gy < 0 || gx >= WORLD_DIMENSIONX || gy >= WORLD_DIMENSIONY) return null;
    return { x: gx, y: gy };
  }

    _strictLineSegment(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;

        // must be same row or same col
        if (dx !== 0 && dy !== 0) return null;

        return this._lineCells(a, b);
    }

  _lineCells(a, b) {
    const cells = [];
    const sx = Math.sign(b.x - a.x);
    const sy = Math.sign(b.y - a.y);

    let x = a.x, y = a.y;
    cells.push({ x, y });

    while (x !== b.x || y !== b.y) {
      if (x !== b.x) x += sx;
      else if (y !== b.y) y += sy;
      cells.push({ x, y });
    }
    return cells;
  }

  _canPlaceCell(x, y) {
    // don’t allow placing onto blocked nav, or onto an existing wall layer
    // (tighten later if you want “replace fences”, etc.)
    if (!Map.navGrid[y]?.[x]) return false;

    const cell = Map.grid[y]?.[x];
    const wallName = this.wallTypeName;

    // if cell is paired [floor, block], ensure block slot is empty or not a wall
    if (Array.isArray(cell)) {
      const top = cell[1];
      // if top already maps to wall/woodWall, block
      const topName = top ? (typeof top === "number" ? this._tileNameFromNumber(top) : null) : null;
      if (topName === "wall" || topName === "woodWall") return false;
    } else {
      // scalar: could already be wall numeric
      const name = typeof cell === "number" ? this._tileNameFromNumber(cell) : null;
      if (name === "wall" || name === "woodWall") return false;
    }

    // also don’t collide with our own committed
    if (this._isInCommitted(x, y)) return false;

    return true;
  }

  _canPlaceCells(cells, allowStart = false) {
    for (let i = 0; i < cells.length; i++) {
        const c = cells[i];

        if (allowStart && i === 0) {
        // allow start tile even if it is “occupied” by being the chosen start
        // BUT still block if it already has a wall on map/grid (you decide).
        // Usually: allow start only if _canPlaceCell allows it, so simplest is:
        if (!this._canPlaceCell(c.x, c.y)) return false;
        continue;
        }

        if (!this._canPlaceCell(c.x, c.y)) return false;
    }
    return true;
  }

  _isInCommitted(x, y) {
    // small lists → linear scan is fine
    return this.committedCells.some(c => c.x === x && c.y === y);
  }

  _tileNameFromNumber(n) {
    // fast check for our two wall ranges
    if (n >= 2 && n <= 10) return "wall";
    if (n >= 57 && n <= 65) return "woodWall";
    return null;
  }

  _rebuildCommittedFromPivots() {
    this.committedCells = [];
    for (let i = 1; i < this.pivots.length; i++) {
      const a = this.pivots[i - 1];
      const b = this.pivots[i];
      const seg = this._strictLineSegment(a, b);
      if (!seg) continue;
      const toCommit = seg;
      this.committedCells.push(...toCommit);
    }
  }

  _totalCostCount(committed, preview) {
    const set = new Set();
    for (const c of committed) set.add(`${c.x},${c.y}`);
    for (const c of preview) set.add(`${c.x},${c.y}`);
    return set.size;
  }

  _queuedCount(preview = []) {
    const set = new Set();
    for (const t of this.orderedBuildTiles || []) set.add(`${t.x},${t.y}`);
    for (const c of preview || []) set.add(`${c.x},${c.y}`);
    return set.size;
  }

  _wallLabel() {
    return this.wallTypeName === "woodWall" ? "Wood Walls" : "Stone Walls";
  }

  _ensureUI() {
    if (!this.ui) {
        const y = 60; // ✅ below top bar (farm uses y=40)
        const x = this.scene.scale.width / 2;

        this.ui = this.scene.add.container(x, y)
        .setScrollFactor(0)
        .setDepth(UIDEPTH + 10)
        .setVisible(true);

        // background "pill"
        this.uiBg = this.scene.add.rectangle(0, 0, 10, 26, 0x222222, 0.75)
        .setOrigin(0.5, 0.5);

        this.uiText = this.scene.add.text(0, 0, "", {
        fontSize: "16px",
        fontFamily: "Bungee",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
        }).setOrigin(0.5, 0.5);

        // keep finalize as a separate button to the right of the banner (still under top bar)
        this.finalBtn = this.scene.add.text(0, 0, "✔ Finalize", {
        fontSize: "14px",
        fontFamily: "Bungee",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
        }).setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

        this.finalBtn.on("pointerdown", () => this.finalize());

        this.ui.add([this.uiBg, this.uiText, this.finalBtn]);

        // ignore by main camera like other UI (optional, but consistent with your top HUD)
        this.scene.cameras.main.ignore(this.ui);

        // keep centered on resize
        this.scene.scale.on("resize", ({ width }) => {
        this.ui.setX(width / 2);
        this._layoutUI();
        });
    }

    this.ui.setVisible(true);
    this._layoutUI();
  }

  _layoutUI() {
    if (!this.ui || !this.uiText || !this.uiBg || !this.finalBtn) return;

    const padX = 18;
    const padY = 10;
    const spacing = 16;

    // background sized to text only (like a banner)
    const w = this.uiText.width + padX * 2;
    const h = this.uiText.height + padY;

    this.uiBg.setSize(w, Math.max(26, h));
    this.uiBg.setPosition(0, 0);

    this.uiText.setPosition(0, 0);

    // finalize button sits to the right of the banner
    const btnX = (w / 2) + spacing + (this.finalBtn.width / 2);
    this.finalBtn.setPosition(btnX, 0);
  }

  _updateFinalizeEnabled(enabled) {
    if (!this.finalBtn) return;
    this.finalBtn.setAlpha(enabled ? 1 : 0.35);
    this.finalBtn.disableInteractive();
    if (enabled) this.finalBtn.setInteractive({ useHandCursor: true });
  }

  _setPhase1Text(valid = true) {
    // “Click to start placement | esc to end” (+ color cue)
    this.uiText.setText(`Click to start placement | esc to end`);
    this.uiText.setColor(valid ? "#66ff66" : "#ff6666");
    this._layoutUI();
  }

  _setPhase2Text(valid = true, count = 0) {
    const typeIcon = this.wallTypeName === "woodWall" ? "🪵" : "🪨";
    // “click to end segment | x#<<typeIcon>> | esc to go back | Click here to finalize”
    this.uiText.setText(`click to end segment | x${count}${typeIcon} | esc to go back | Click ✔ Finalize`);
    this.uiText.setColor(valid ? "#66ff66" : "#ff6666");
    this._layoutUI();
  }

// WallPlacementController.js
  _ensureUI() {
    if (!this.ui) {
      const y = 60;
      const x = this.scene.scale.width / 2;

      this.ui = this.scene.add.container(x, y)
        .setScrollFactor(0)
        .setDepth(UIDEPTH + 10)
        .setVisible(true);

      this.uiBg = this.scene.add.rectangle(0, 0, 10, 26, 0x222222, 0.75)
        .setOrigin(0.5, 0.5);

      this.uiText = this.scene.add.text(0, 0, "", {
        fontSize: "16px",
        fontFamily: "Bungee",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5);

      this.finalBtn = this.scene.add.text(0, 0, "✔", {
        fontSize: "14px",
        fontFamily: "Bungee",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { left: 14, right: 14, top: 6, bottom: 6 },
      }).setOrigin(0.5, 0.5);

      this.finalBtn.on("pointerdown", () => this.finalize());
      this.ui.add([this.uiBg, this.uiText, this.finalBtn]);

      this.scene.scale.on("resize", ({ width }) => {
        this.ui.setX(width / 2);
        this._layoutUI();
      });
    }

    this.ui.setVisible(true);
    this._layoutUI();
  }

  _layoutUI() {
    if (!this.ui || !this.uiText || !this.uiBg || !this.finalBtn) return;

    const padX = 18;
    const padY = 10;
    const spacingY = 10;
    const w = this.uiText.width + padX * 2;
    const h = this.uiText.height + padY;

    this.uiBg.setSize(w, Math.max(26, h));
    this.uiBg.setPosition(0, 0);
    this.uiText.setPosition(0, 0);

    const btnY = this.uiBg.height / 2 + spacingY + this.finalBtn.height / 2;
    this.finalBtn.setPosition(0, btnY);
  }

  _updateFinalizeEnabled(enabled) {
    if (!this.finalBtn) return;
    this.finalBtn.setVisible(enabled);
    this.finalBtn.disableInteractive();
    if (enabled) this.finalBtn.setInteractive({ useHandCursor: true });
  }

  _setPhase1Text(valid = true, count = this._queuedCount()) {
    const action = count > 0 ? "click to start next segment" : "click to start placement";
    this.uiText.setText(`Placing ${this._wallLabel()} | ${count} queued | ${action} | esc to cancel`);
    this.uiText.setColor(valid ? "#66ff66" : "#ff6666");
    this._layoutUI();
  }

  _setPhase2Text(valid = true, count = this._queuedCount(this.previewCells)) {
    this.uiText.setText(`Placing ${this._wallLabel()} | ${count} queued | click to end segment | esc to undo`);
    this.uiText.setColor(valid ? "#66ff66" : "#ff6666");
    this._layoutUI();
  }

_redrawGhost(isValid = true) {
  const def = TILE_TYPES[this.wallTypeName];

  // For preview, use interior ghost images you preload
  const ghostKey = (this.wallTypeName === "woodWall") ? "woodWall_interior" : "wall_interior";
  const doorKey  = (this.wallTypeName === "woodWall") ? "woodWall_door" : "wall_door";

  if (!this.previewContainer) return;

  this.previewContainer.removeAll(true);
  this.previewSprites = [];

  const tint = isValid ? 0x33ff33 : 0xff3333;
  const alphaWall = 0.55;
  const alphaDoor = 0.75;

  const drawWallCell = (c, a = alphaWall) => {
    const spr = this.scene.add.image(
      c.x * SQUARESIZE + SQUARESIZE / 2,
      c.y * SQUARESIZE + SQUARESIZE / 2,
      ghostKey
    );
    spr.setAlpha(a);
    spr.setTintFill(tint);
    spr.setBlendMode(Phaser.BlendModes.ADD);
    this.previewContainer.add(spr);
    this.previewSprites.push(spr);
  };

  const drawDoorCell = (c, angleDeg = 0, a = alphaDoor) => {
    const spr = this.scene.add.sprite(
      c.x * SQUARESIZE + SQUARESIZE / 2,
      c.y * SQUARESIZE + SQUARESIZE / 2,
      doorKey,
      0
    );
    spr.setAngle(angleDeg);
    spr.setAlpha(a);
    spr.setTintFill(tint);
    spr.setBlendMode(Phaser.BlendModes.ADD);
    this.previewContainer.add(spr);
    this.previewSprites.push(spr);
  };

  // --- 1) committed walls
  for (const c of this.committedCells) drawWallCell(c);

  // --- 2) committed doors (stay visible after segment ends)
  for (const d of (this.committedDoors || [])) {
    // rotation based on existing committed neighbors in Map.grid
    drawDoorCell(d, d.angle ?? 0);
  }

  // --- 3) LIVE preview segment (during creation)
  if (!this.previewCells || this.previewCells.length === 0) return;

  // door exists only when preview segment is long enough
  let previewDoor = null;
  let previewDoorAngle = 0;

  if (this.previewCells.length >= 3) {
    const midIdx = Math.floor(this.previewCells.length / 2);
    previewDoor = this.previewCells[midIdx];

    const isVertical =
      this.previewCells[0].x === this.previewCells[this.previewCells.length - 1].x;
    previewDoorAngle = isVertical ? 90 : 0;
  }

  // draw preview walls (exclude preview door cell so it doesn't get covered)
  for (const c of this.previewCells) {
    if (previewDoor && c.x === previewDoor.x && c.y === previewDoor.y) continue;
    drawWallCell(c, alphaWall);
  }

  // draw preview door on top
  if (previewDoor) drawDoorCell(previewDoor, previewDoorAngle, alphaDoor);
}

static isDoorTileNumber(n) {
  const arr = TILE_ARR[n];
  if (arr === "wall_door" || arr === "woodWall_door") return true;

  const mapped = TILE_MAP(n);
  return mapped === "wall_door" || mapped === "woodWall_door";
}

// WallPlacementController.js
static bindDoorSprite(scene, doorSprite) {
  if (!doorSprite || doorSprite.__doorBound) return;
  doorSprite.__doorBound = true;

  // default closed
  if (doorSprite.setFrame) doorSprite.setFrame(0);

  // Ensure the door has an Arcade STATIC body (overlap needs bodies)
  if (!doorSprite.body) {
    scene.physics.add.existing(doorSprite, true); // static body
  }

  // Ensure doorGroup exists + is static
  if (!scene.doorGroup) scene.doorGroup = scene.physics.add.staticGroup();

  // Add to the staticGroup so overlap(Player.characters, doorGroup) can hit it
  scene.doorGroup.add(doorSprite);
}

static _cellHasType(gridCell, typeName) {
  if (gridCell == null) return false;
  if (Array.isArray(gridCell)) {
    // your grid uses [floor, block] sometimes
    return TILE_MAP(gridCell[0]) === typeName || TILE_MAP(gridCell[1]) === typeName;
  }
  return TILE_MAP(gridCell) === typeName;
}

static _wallFamilyAt(mapGrid, x, y, family) {
  const row = mapGrid?.[y];
  if (!row) return false;

  const cell = row[x];
  if (cell == null) return false;

  if (family === "stone") {
    return (
      WallPlacementController._cellHasType(cell, "wall") ||
      WallPlacementController._cellHasType(cell, "wall_door")
    );
  }

  // wood
  return (
    WallPlacementController._cellHasType(cell, "woodWall") ||
    WallPlacementController._cellHasType(cell, "woodWall_door")
  );
}

static doorAngleForCell(_gridIgnored, x, y, doorTypeName) {
  // Treat BOTH the wall and the door as “structure neighbors”
  // so orientation stays stable no matter which layer holds it.
  const wallTypeName =
    (doorTypeName === "woodWall_door") ? "woodWall" : "wall";

  // Consider a neighbor “solid” if it has a wall or a door.
  const hasSolid = (nx, ny) =>
    GameMap._hasTypeAt(nx, ny, wallTypeName) ||
    GameMap._hasTypeAt(nx, ny, doorTypeName);

  const up    = hasSolid(x, y - 1);
  const down  = hasSolid(x, y + 1);
  const left  = hasSolid(x - 1, y);
  const right = hasSolid(x + 1, y);

  // If we're connecting vertically (walls up+down), door spans horizontally => angle 90
  if (up && down) return 90;

  // If we're connecting horizontally (walls left+right), door spans vertically => angle 0
  if (left && right) return 0;

  // Fallbacks: bias toward whichever axis has at least one neighbor
  if (up || down) return 90;
  return 0;
}


static _angleForWallPiece(gridVal) {
  // Determine whether this numeric gridVal is a side/corner, and rotate accordingly.
  // Assumes:
  //  - edge art is "top edge" at 0 degrees
  //  - corner art is "top-left corner" at 0 degrees
  const stone = TILE_TYPES.wall;
  const wood  = TILE_TYPES.woodWall;

  const isStone = (gridVal >= 2 && gridVal <= 10);
  const isWood  = (gridVal >= 57 && gridVal <= 65);

  const t = isWood ? wood : stone;

  // interior: no rotation
  if (gridVal === t.interior) return 0;

  // edges: authored as "up"
  if (gridVal === t.sides.up)    return 0;
  if (gridVal === t.sides.right) return 90;
  if (gridVal === t.sides.down)  return 180;
  if (gridVal === t.sides.left)  return 270;

  // corners: authored as "topLeft"
  if (gridVal === t.corners.topLeft)     return 0;
  if (gridVal === t.corners.topRight)    return 90;
  if (gridVal === t.corners.bottomRight) return 180;
  if (gridVal === t.corners.bottomLeft)  return 270;

  return 0;
}

static _removeStructureSourcesOn(node) {
  if (!node) return;

  const scene = node.scene;
  if (!scene) return;

  const visionSet = scene.__structureVisionIds || (scene.__structureVisionIds = new Set());
  const lightSet  = scene.__structureLightIds  || (scene.__structureLightIds  = new Set());

  if (node.__visionId != null) {
    VisibilitySystem.removeVisionBubble(node.__visionId);
    visionSet.delete(node.__visionId);
    node.__visionId = null;
  }

  if (node.__lightId != null) {
    VisibilitySystem.removeLightById(node.__lightId);
    lightSet.delete(node.__lightId);
    node.__lightId = null;
  }
}

static doorAngleForCell(_gridIgnored, x, y, doorTypeName) {
  const wallTypeName =
    (doorTypeName === "woodWall_door") ? "woodWall" : "wall";
  const ownerTeam = GameMap._wallTeamAt?.(x, y);

  const hasSolid = (nx, ny) => {
    if (ownerTeam != null && GameMap._hasSameTeamWallAt?.(nx, ny, ownerTeam)) {
      return true;
    }

    return (
      GameMap._hasTypeAt(nx, ny, wallTypeName) ||
      GameMap._hasTypeAt(nx, ny, doorTypeName)
    );
  };

  const up    = hasSolid(x, y - 1);
  const down  = hasSolid(x, y + 1);
  const left  = hasSolid(x - 1, y);
  const right = hasSolid(x + 1, y);

  if (up && down) return 90;
  if (left && right) return 0;
  if (up || down) return 90;
  return 0;
}

/**
 * Adds BOTH a light + vision bubble for any player-built structure sprite.
 * Call with noRepaint=true, and let Map/doBuildings do the single rebuild.
 */
static bindStructureLightAndVision(node, gx, gy, opts = {}) {
  if (!node) return;

  const scene = node.scene;
  if (!scene) return;

  const visionSet = scene.__structureVisionIds || (scene.__structureVisionIds = new Set());
  const lightSet  = scene.__structureLightIds  || (scene.__structureLightIds  = new Set());

  const r = opts.r ?? 6;
  const boost = opts.boost ?? 0.1;
  const intensity = opts.intensity ?? 1.0;

  const cx = gx + 0.5;
  const cy = gy + 0.5;

  // clear old ids if re-binding
  WallPlacementController._removeStructureSourcesOn(node);

  node.__lightId = VisibilitySystem.addLightSource(
    { x: cx, y: cy, r, intensity },
    true // noRepaint
  );
  lightSet.add(node.__lightId);

  node.__visionId = VisibilitySystem.addVisionBubble(
    { x: cx, y: cy, r, boost },
    true // noRepaint
  );
  visionSet.add(node.__visionId);

  node.once?.("destroy", () => WallPlacementController._removeStructureSourcesOn(node));
}

/**
 * Optional: call this if you ever need to hard-reset all structure sources.
 * DO NOT call every frame; only when you know you’re rebuilding everything.
 */
static clearAllStructureSources(scene) {
  if (!scene) return;

  const visionSet = scene.__structureVisionIds;
  const lightSet  = scene.__structureLightIds;

  if (visionSet) {
    for (const id of visionSet) VisibilitySystem.removeVisionBubble(id);
    visionSet.clear();
  }

  if (lightSet) {
    for (const id of lightSet) VisibilitySystem.removeLightById(id);
    lightSet.clear();
  }
}

}

