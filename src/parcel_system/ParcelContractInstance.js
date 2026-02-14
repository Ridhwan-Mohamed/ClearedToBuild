// src/parcel_system/ParcelContractInstance.js
// One active contract instance living in a slot (W/S/E).

import { paintResourceParcel, paintWaterRect } from "./ParcelTerrain.js";
import { createPressureSpawners } from "./PressureSpawner.js";
import { PARCEL_SIZE, RESOURCE_CONTRACT_MS } from "./ParcelConfig.js";
import { Map as GameMap } from "../map.js";
import { TILE_TYPES, TILE_MAP, SQUARESIZE, colorFor, removeFromArray } from "../constants.js";
import { PineTree } from "../buildings/pineTree.js";

function fmtMMSS(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function randInt(rng, a, b) { // inclusive
  return a + Math.floor(rng() * (b - a + 1));
}

export class ParcelContractInstance {
  constructor({
    id,
    type,
    slotId,
    origin,
    scene,
    rng,
    map,          // ✅ Map class
    parcelManager,
    difficulty
  }) {
    this.id = id;
    this.type = type;
    this.slotId = slotId;
    this.origin = origin;
    this.scene = scene;
    this.rng = rng;
    this.placedObjects = [];

    // ✅ default to imported GameMap if not provided
    this.map = map ?? GameMap;

    this.pm = parcelManager;
    this.difficulty = difficulty || 1;

    this.timerEvent = null;
    this.uiTickEvent = null;
    this.expireAt = null;

    this.spawned = 0;
    this.killed = 0;
    this.totalPlannedEnemies = 0;
    this.spawners = [];

    this.timerText = null;
  }

  _ensureTimerText() {
    if (this.timerText) return;

    const cx = (this.origin.x + PARCEL_SIZE / 2) * SQUARESIZE;
    const topY = (this.origin.y - 1) * SQUARESIZE;

    this.timerText = this.scene.add.text(cx, topY, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(9999);
    this.scene.uiCamera.ignore(this.timerText);
  }

  _updateTimerText() {
    if (!this.timerText) return;

    if (this.type === "PRESSURE") {
      this.timerText.setText(`⚔ ${this.killed}/${this.totalPlannedEnemies}`);
      return;
    }

    const remaining = this.expireAt ? (this.expireAt - this.scene.time.now) : 0;
    this.timerText.setText(`${this.type === "FOREST" ? "🌲" : "🪨"} ${fmtMMSS(remaining)}`);
  }

  _startUITick() {
    this._ensureTimerText();
    this._updateTimerText();

    if (this.uiTickEvent) this.uiTickEvent.remove(false);
    this.uiTickEvent = this.scene.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => this._updateTimerText(),
    });
  }

  _stopUITick() {
    if (this.uiTickEvent) {
      this.uiTickEvent.remove(false);
      this.uiTickEvent = null;
    }
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = null;
    }
  }

  /** Place trees or rocks after terrain is painted. */
  _spawnResourceNodes(nodeType /* "pine" | "rock" */, count) {
    const triesMax = Math.max(200, count * 30);
    let placed = 0;
    let tries = 0;

    while (placed < count && tries < triesMax) {
      tries++;
      const gx = this.origin.x + randInt(this.rng, 1, PARCEL_SIZE - 2);
      const gy = this.origin.y + randInt(this.rng, 1, PARCEL_SIZE - 2);

      const cell = GameMap.grid?.[gy]?.[gx];
      if (cell == null) continue;

      // don't place on water
      const top = Array.isArray(cell) ? cell[cell.length - 1] : cell;
      const topName = TILE_MAP(top);
      if (topName === "water") continue;

      // don't double-place onto blocked cells (houses/walls/etc)
      if (GameMap._cellIsBlocking?.(gx, gy)) continue;

      const tileType = nodeType === "pine" ? TILE_TYPES.pine : TILE_TYPES.rock;
      try {
        if(nodeType === "pine") {
          const obj = GameMap.handleLoadNonSpread(gx, gy, TILE_TYPES.pine);
          obj.contractId = this.id;                   // optional: tag for cleanup
          obj.slotId = this.slotId;                   // optional

          GameMap.worldPines.push(obj);               // keep your existing pattern
          this.placedObjects.push(obj);              // track for contract cleanup
          placed++;
        } else { 
          const obj = GameMap.handleLoadNonSpread(gx, gy, tileType);
          if (obj) this.placedObjects.push(obj);
          placed++;
        }
      } catch (e) {
        // ignore failures (rare)
      }
    }
  }

  spawn() {
    const M = this.map; // Map class

    const setGroundRect = M.setGroundRect.bind(M);
    const setWater = M.setWater.bind(M);
    const setWaterRect = M.setWaterRect.bind(M);

    if (this.type === "FOREST" || this.type === "ROCK") {
      paintResourceParcel({
        origin: this.origin,
        size: PARCEL_SIZE,
        rng: this.rng,
        setGroundRect,
        setWater,
        pondTiles: this.type === "FOREST" ? 32 : 26,
        edgeBuffer: 2,
      });

      // Spawn resource nodes *after* terrain.
      if (this.type === "FOREST") {
        this._spawnResourceNodes("pine", 32);
      } else {
        this._spawnResourceNodes("rock", 18);
      }

      const ms = this.type === "FOREST" ? RESOURCE_CONTRACT_MS.FOREST : RESOURCE_CONTRACT_MS.ROCK;
      this.expireAt = this.scene.time.now + ms;

      this._startUITick();
      this.timerEvent = this.scene.time.delayedCall(ms, () => this.complete("timeout"), null, this);
      return;
    }

    if (this.type === "PRESSURE") {
      // Land fill
      setGroundRect(this.origin.x, this.origin.y, PARCEL_SIZE, PARCEL_SIZE);

      const { spawners, totalPlannedEnemies } = createPressureSpawners({
        scene: this.scene,
        origin: this.origin,
        difficulty: this.difficulty,
        contractId: this.id,
        spawnSpawnerBuilding: (args) => this.pm.spawnSpawnerBuilding(args),
      });

      this.spawners = spawners;
      this.totalPlannedEnemies = totalPlannedEnemies;

      this._startUITick();
    }
    GameMap._uiIgnoreWorldLayer();
  }

  onRaiderSpawned() {
    this.spawned++;
    this.pm.onContractProgressChanged?.(this);
  }

  onRaiderKilled() {
    this.killed++;
    this.pm.onContractProgressChanged?.(this);

    if (
      this.type === "PRESSURE" &&
      this.spawned >= this.totalPlannedEnemies &&
      this.killed >= this.totalPlannedEnemies
    ) {
      this.complete("cleared");
    }
  }

  complete(reason) {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }

    this._stopUITick();

    // Sink the parcel back to water.
    paintWaterRect({
      origin: this.origin,
      size: PARCEL_SIZE,
      setWaterRect: this.map.setWaterRect.bind(this.map),
    });

    for (const obj of this.placedObjects) {
      if (!obj) continue;

      // PineTree instance
      if (obj.destroy && obj.basePine !== undefined) {
        obj.destroy(); // PineTree.destroy now unregisters itself
        continue;
      }

      // plain sprite (rock, etc.)
      removeFromArray(GameMap.worldStones, obj);
      obj.destroy?.();
    }
    this.placedObjects = [];

    for (const s of this.spawners) {
      try { s.building?.destroy?.(); } catch {}
    }

    this.spawners = [];
    this.scene.rebuildBothNavMeshes();
    this.scene.zoomMixer.buildOverviewTextureFromGrid(this.map.grid, SQUARESIZE, (cell) => colorFor(cell));
    GameMap._uiIgnoreWorldLayer();
    this.pm.removeContract(this.slotId, this.id, reason);
  }
}
