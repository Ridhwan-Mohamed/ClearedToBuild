// src/parcel_system/ParcelContractInstance.js
// One active contract instance living in a slot (W/S/E).

import { paintResourceParcel, paintWaterRect } from "./ParcelTerrain.js";
import { createPressureSpawners } from "./PressureSpawner.js";
import { PARCEL_SIZE, RESOURCE_CONTRACT_MS } from "./ParcelConfig.js";
import { Map as GameMap } from "../map.js";
import { TILE_TYPES, TILE_MAP, SQUARESIZE, colorFor, removeFromArray } from "../constants.js";
import { spawnMarketShip, DEFAULT_SUPPLY_PRICES } from "../UI/ShipMarket";
import { DraftStartState } from "../UI/DraftUI/DraftStartState"; // adjust path to your real location

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
    difficulty,
    pressureSource = "manual",
    pressureOwnerTower = null,
  }) {
    this.id = id;
    this.type = type;
    this.slotId = slotId;
    this.origin = origin;
    this.scene = scene;
    this.rng = rng;
    this.placedObjects = [];
    this._completed = false;

    // ✅ default to imported GameMap if not provided
    this.map = map ?? GameMap;

    this.pm = parcelManager;
    this.difficulty = difficulty || 1;
    this.pressureSource = pressureSource;
    this.pressureOwnerTower = pressureOwnerTower;

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
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(9999);
  }

  _updateTimerText() {
    if (!this.timerText) return;

    if (this.type === "PRESSURE") {
      this.timerText.setText(`⚔ ${this.killed}/${this.totalPlannedEnemies}`);
      return;
    }
    if (this.type === "MARKET") {
      const remaining = this.expireAt ? (this.expireAt - this.scene.time.now) : 0;
      this.timerText.setText(`🛒 ${fmtMMSS(remaining)}`);
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

  _footprintTouchesWater(gx, gy, lenX, lenY, pad = 1) {
    const minY = gy - pad;
    const maxY = gy + lenY - 1 + pad;
    const minX = gx - pad;
    const maxX = gx + lenX - 1 + pad;

    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const cell = GameMap.grid?.[yy]?.[xx];
        if (cell == null) continue;

        if (Array.isArray(cell)) {
          if (cell.some((val) => TILE_MAP(val) === "water")) return true;
          continue;
        }

        if (TILE_MAP(cell) === "water") return true;
      }
    }

    return false;
  }

  /** Place trees or rocks after terrain is painted. */
  _spawnResourceNodes(nodeType /* "pine" | "rock" */, count) {
    const triesMax = Math.max(200, count * 30);
    let placed = 0;
    let tries = 0;

    const tileType = nodeType === "pine" ? TILE_TYPES.pine : TILE_TYPES.rock;

    // pick anchors so the whole footprint stays inside the parcel
    const minX = this.origin.x + 1;
    const minY = this.origin.y + 1;
    const maxX = this.origin.x + (PARCEL_SIZE - 1) - tileType.lenX;
    const maxY = this.origin.y + (PARCEL_SIZE - 1) - tileType.lenY;

    while (placed < count && tries < triesMax) {
      tries++;

      const gx = randInt(this.rng, minX, maxX);
      const gy = randInt(this.rng, minY, maxY);

      const cell = GameMap.grid?.[gy]?.[gx];
      if (cell == null) continue;

      // don't place on water
      const top = Array.isArray(cell) ? cell[cell.length - 1] : cell;
      const topName = TILE_MAP(top);
      if (topName === "water") continue;

      // Keep a one-tile shoreline buffer so 2x2 resource footprints don't
      // sit directly against pond edges and create awkward shoreline reads.
      if (this._footprintTouchesWater(gx, gy, tileType.lenX, tileType.lenY, 1)) continue;

      // IMPORTANT: reject if ANY tile in the footprint is blocked
      if (GameMap.checkBlockPositionGen(gx, gy, tileType.lenX, tileType.lenY)) continue;

      try {
        const obj = GameMap.handleLoadNonSpread(gx, gy, tileType);
        if (!obj) continue;

        obj.contractId = this.id;
        obj.slotId = this.slotId;

        if (nodeType === "pine") GameMap.worldPines.push(obj);
        else GameMap.worldStones.push(obj);

        this.placedObjects.push(obj);
        placed++;
      } catch (e) {
        // ignore failures
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
    else if (this.type === "PRESSURE") {
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
    else if (this.type === "MARKET") {
      // paint ground or do nothing — market doesn’t need terrain changes

      const ms = 60_000; // 1 minute (changeable)
      this.expireAt = this.scene.time.now + ms;

      // Timer UI tick reuse
      this._startUITick();

      // Parcel center in WORLD coordinates
      const cx = (this.origin.x + PARCEL_SIZE / 2) * SQUARESIZE;
      const cy = (this.origin.y + PARCEL_SIZE / 2) * SQUARESIZE;

      // Pull prices from DraftStartState (single source of truth)
      // If you already have a live DraftStartState instance stored somewhere, use that instead.
      const prices = new DraftStartState().prices.supplies; // :contentReference[oaicite:3]{index=3}

      // Spawn ship docked near this parcel
      this._marketShipHandle = spawnMarketShip(this.scene, {
        parcelCenterWorld: { x: cx, y: cy },
        slotId: this.slotId,
        teamNumber: 1,
        durationMs: ms,
        prices
      });

      // Contract completion
      this.timerEvent = this.scene.time.delayedCall(ms, () => {
        // IMPORTANT: don't show contract UI until the ship fully leaves
        const h = this._marketShipHandle;
        if (h?.depart) h.depart(() => this.complete("timeout"));
        else this.complete("timeout");
      }, null, this);
      return;
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

  onSpawnerDestroyed(unspawnedCount) {
    if (this._completed) return;
    if (this.type !== "PRESSURE") return;

    const n = Math.max(0, unspawnedCount | 0);

    // ✅ “add the spawner’s enemies that were destroyed” to contract progress
    // We bump BOTH spawned and killed so your existing completion math stays consistent.
    this.spawned += n;
    this.killed += n;

    this.pm.onContractProgressChanged?.(this);

    // ✅ if ALL pressure spawner buildings are destroyed, kill the contract now
    const allDead = this.spawners?.length
      ? this.spawners.every(s => !s?.building || s.building._destroyed === true)
      : true;

    if (allDead) {
      this.complete("spawners_destroyed");
    }
  }

  complete(reason) {
    if (this._completed) return;
    this._completed = true;
     
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

    if(this.type === "MARKET") {
      this._marketShipHandle?.destroy?.();
      this._marketShipHandle = null;
    }

    for (const s of this.spawners) {
      try { s.building?.destroy?.(); } catch {}
    }

    this.spawners = [];
    if (this.scene?.zoomMixer?.mode !== "overview") {
      this.map.reDraw?.();
    }
    this.scene.rebuildBothNavMeshes();
    this.scene.zoomMixer.buildOverviewTextureFromGrid(this.map.grid, SQUARESIZE, (cell) => colorFor(cell));
    GameMap._uiIgnoreWorldLayer();
    this.pm.removeContract(this.slotId, this.id, reason);
  }
}
