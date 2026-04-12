// src/parcel_system/ParcelContractInstance.js
// One active contract instance living in a slot (W/S/E).

import { paintResourceParcel, paintWaterRect } from "./ParcelTerrain.js";
import { createPressureSpawners } from "./PressureSpawner.js";
import { PARCEL_SIZE, RESOURCE_CONTRACT_MS } from "./ParcelConfig.js";
import { Map as GameMap } from "../map.js";
import { TILE_TYPES, TILE_MAP, SQUARESIZE, colorFor, removeFromArray } from "../constants.js";
import { spawnMarketShip, DEFAULT_SUPPLY_PRICES } from "../UI/ShipMarket";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { FarmBushNode } from "../buildings/FarmBushNode";

function fmtMMSS(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function randInt(rng, a, b) {
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
    map,
    parcelManager,
    difficulty,
    pressureSource = "manual",
    pressureOwnerTower = null,
    pressureModifierKey = null,
    pressureModifier = null,
    pressureHordeIndex = null,
  }) {
    this.id = id;
    this.type = type;
    this.slotId = slotId;
    this.origin = origin;
    this.scene = scene;
    this.rng = rng;
    this.placedObjects = [];
    this._completed = false;

    this.map = map ?? GameMap;

    this.pm = parcelManager;
    this.difficulty = difficulty || 1;
    this.pressureSource = pressureSource;
    this.pressureOwnerTower = pressureOwnerTower;
    this.pressureModifierKey = pressureModifierKey;
    this.pressureModifier = pressureModifier ? { ...pressureModifier } : null;
    this.pressureHordeIndex = pressureHordeIndex;

    this.timerEvent = null;
    this.uiTickEvent = null;
    this.expireAt = null;

    this.spawned = 0;
    this.killed = 0;
    this.totalPlannedEnemies = 0;
    this.spawners = [];
    this.enemyType = "raider";
    this.enemyTypeLabel = "Raiders";
    this.spawnerCount = 0;

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

  _getSimulationNowMs() {
    return Number(this.scene?.getSimulationNow?.() ?? this.scene?.simNowMs ?? 0);
  }

  _updateTimerText() {
    if (!this.timerText) return;

    if (this.type === "PRESSURE") {
      this.timerText.setText(`FIGHT ${this.killed}/${this.totalPlannedEnemies}`);
      return;
    }
    if (this.type === "MARKET") {
      const remaining = this.expireAt ? (this.expireAt - this._getSimulationNowMs()) : 0;
      this.timerText.setText(`MARKET ${fmtMMSS(remaining)}`);
      return;
    }

    const remaining = this.expireAt ? (this.expireAt - this._getSimulationNowMs()) : 0;
    this.timerText.setText(`${this.type} ${fmtMMSS(remaining)}`);
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

  _spawnResourceNodes(nodeType, count) {
    const triesMax = Math.max(200, count * 30);
    let placed = 0;
    let tries = 0;

    const tileType = nodeType === "pine" ? TILE_TYPES.pine : TILE_TYPES.rock;

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

      const top = Array.isArray(cell) ? cell[cell.length - 1] : cell;
      if (TILE_MAP(top) === "water") continue;
      if (this._footprintTouchesWater(gx, gy, tileType.lenX, tileType.lenY, 1)) continue;
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
        // Ignore placement failures and keep filling the parcel.
      }
    }
  }

  _spawnFarmBushes() {
    FarmBushNode.init(this.scene);

    const layout = {
      seed: [
        [4, 5], [7, 5], [10, 6], [5, 8],
        [8, 8], [11, 10], [6, 12], [9, 13],
      ],
      berry: [
        [14, 5], [17, 5], [20, 6], [15, 8],
        [18, 8], [21, 10], [16, 12], [19, 13],
      ],
    };

    for (const [kind, offsets] of Object.entries(layout)) {
      for (const [ox, oy] of offsets) {
        const gx = this.origin.x + ox;
        const gy = this.origin.y + oy;
        const cell = GameMap.grid?.[gy]?.[gx];
        if (cell == null) continue;

        const top = Array.isArray(cell) ? cell[cell.length - 1] : cell;
        if (TILE_MAP(top) === "water") continue;

        try {
          const obj = new FarmBushNode(gx, gy, kind);
          obj.contractId = this.id;
          obj.slotId = this.slotId;
          this.placedObjects.push(obj);
        } catch (e) {
          // Ignore a bad bush spawn and keep laying out the parcel.
        }
      }
    }
  }

  spawn() {
    const M = this.map;

    const setGroundRect = M.setGroundRect.bind(M);
    const setWater = M.setWater.bind(M);

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

      if (this.type === "FOREST") {
        this._spawnResourceNodes("pine", 32);
      } else {
        this._spawnResourceNodes("rock", 18);
      }

      const ms = this.type === "FOREST" ? RESOURCE_CONTRACT_MS.FOREST : RESOURCE_CONTRACT_MS.ROCK;
      this.expireAt = this._getSimulationNowMs() + ms;

      this._startUITick();
      this.timerEvent = this.scene.time.delayedCall(ms, () => this.complete("timeout"), null, this);
      return;
    }

    if (this.type === "FARM") {
      setGroundRect(this.origin.x, this.origin.y, PARCEL_SIZE, PARCEL_SIZE, "grass");
      this._spawnFarmBushes();

      const ms = RESOURCE_CONTRACT_MS.FARM ?? RESOURCE_CONTRACT_MS.FOREST;
      this.expireAt = this._getSimulationNowMs() + ms;

      this._startUITick();
      this.timerEvent = this.scene.time.delayedCall(ms, () => this.complete("timeout"), null, this);
      return;
    }

    if (this.type === "PRESSURE") {
      setGroundRect(this.origin.x, this.origin.y, PARCEL_SIZE, PARCEL_SIZE);

      const pressureData = createPressureSpawners({
        scene: this.scene,
        origin: this.origin,
        difficulty: this.difficulty,
        contractId: this.id,
        spawnSpawnerBuilding: (args) => this.pm.spawnSpawnerBuilding(args),
        modifier: this.pressureModifier,
      });

      this.spawners = pressureData.spawners;
      this.totalPlannedEnemies = pressureData.totalPlannedEnemies;
      this.enemyType = pressureData.enemyType;
      this.enemyTypeLabel = pressureData.enemyTypeLabel;
      this.spawnerCount = pressureData.spawnerCount;

      this._startUITick();
      return;
    }

    if (this.type === "MARKET") {
      const ms = 60_000;
      this.expireAt = this._getSimulationNowMs() + ms;

      this._startUITick();

      const cx = (this.origin.x + PARCEL_SIZE / 2) * SQUARESIZE;
      const cy = (this.origin.y + PARCEL_SIZE / 2) * SQUARESIZE;
      const prices = { ...DEFAULT_SUPPLY_PRICES };

      this._marketShipHandle = spawnMarketShip(this.scene, {
        parcelCenterWorld: { x: cx, y: cy },
        slotId: this.slotId,
        teamNumber: 1,
        durationMs: ms,
        prices,
      });

      this.timerEvent = this.scene.time.delayedCall(ms, () => {
        const handle = this._marketShipHandle;
        if (handle?.depart) handle.depart(() => this.complete("timeout"));
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

    this.spawned += n;
    this.killed += n;

    this.pm.onContractProgressChanged?.(this);

    const allDead = this.spawners?.length
      ? this.spawners.every((s) => !s?.building || s.building._destroyed === true)
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

    if (this.type === "FOREST" || this.type === "ROCK" || this.type === "FARM") {
      blockResourceManager.abortParcelResourceWork({
        teamNumber: 1,
        contractId: this.id,
        slotId: this.slotId,
        origin: this.origin,
        size: PARCEL_SIZE,
      });
    }

    paintWaterRect({
      origin: this.origin,
      size: PARCEL_SIZE,
      setWaterRect: this.map.setWaterRect.bind(this.map),
    });

    for (const obj of this.placedObjects) {
      if (!obj) continue;

      if (typeof obj.destroy === "function" && (obj.resourceKind || obj.sprite || obj.container)) {
        obj.destroy();
        continue;
      }

      removeFromArray(GameMap.worldPines, obj);
      removeFromArray(GameMap.worldStones, obj);
      removeFromArray(GameMap.worldSeedBushes, obj);
      removeFromArray(GameMap.worldBerryBushes, obj);
      obj.destroy?.();
    }
    this.placedObjects = [];

    if (this.type === "MARKET") {
      this._marketShipHandle?.destroy?.();
      this._marketShipHandle = null;
    }

    for (const spawner of this.spawners) {
      try {
        spawner.building?.destroy?.();
      } catch {}
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
