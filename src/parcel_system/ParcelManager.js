// parcelSystem/ParcelManager.js
import { SpawnerBuilding } from "../buildings/SpawnerBuilding.js";
import { calcPressureBonus, colorFor, getContractStage, SQUARESIZE, TILE_TYPES } from "../constants.js";
import { PARCEL_SIZE, CONTRACT_SLOTS } from "./ParcelConfig.js";
import { ParcelContractInstance } from "./ParcelContractInstance.js";

export class ParcelManager {
  constructor({ scene, opts }) {
    this.scene = scene;

    // ✅ rng should be a function, not Math.random()
    this.rng = opts.rng ?? Math.random;

    // ✅ store the real Map class (static API)
    this.map = opts.map;


    this.mainIslandOrigin = opts.mainIslandOrigin;

    this.contractsById = new Map();

    // ✅ keys must match ParcelConfig CONTRACT_SLOTS: W/S/E
    this.slotToContractId = { W: null, S: null, E: null };

    this.onContractProgressChanged = null;
  }

  getSlotOrigin(slotId) {
    const slot = CONTRACT_SLOTS[slotId];
    return {
      x: this.mainIslandOrigin.x + slot.dx,
      y: this.mainIslandOrigin.y + slot.dy,
    };
  }

  startForest(slotId)  { return this._startResource(slotId, "FOREST"); }
  startRock(slotId)    { return this._startResource(slotId, "ROCK"); }
  startPressure(slotId, difficulty = 1) { return this._startPressure(slotId, difficulty); }
  startFarm(slotId) { return this._startResource(slotId, "FARM"); }
  startMilitia(slotId) {
    if (this.slotToContractId[slotId]) return null;

    const id = `MILITIA_${slotId}_${Date.now()}`;
    this.slotToContractId[slotId] = id;

    // If you want it tracked like other contracts (optional):
    this.contractsById.set(id, {
      id, type: "MILITIA", slotId,
      difficulty: 1,
    });

    // TODO later: spawn militia units + expiry timer
    // For now, just immediately free the slot or keep it "occupied" by design.
    // If you want it to end immediately:
    // this.removeContract(slotId, id, "complete");

    return id;
  }


  _startResource(slotId, type) {
    if (this.slotToContractId[slotId]) return null;

    const id = `${type}_${slotId}_${Date.now()}`;
    const origin = this.getSlotOrigin(slotId);

    const inst = new ParcelContractInstance({
      id, type, slotId, origin,
      scene: this.scene,

      // ✅ use manager rng
      rng: this.rng,

      // ✅ pass Map class
      map: this.map,

      parcelManager: this,
    });

    this.slotToContractId[slotId] = id;
    this.contractsById.set(id, inst);
    inst.spawn();
    this.scene.rebuildBothNavMeshes();
    this.scene.zoomMixer.buildOverviewTextureFromGrid(this.map.grid, SQUARESIZE, (cell) => colorFor(cell));
    this.map._uiIgnoreWorldLayer();
    return id;
  }

  _startPressure(slotId, difficulty) {
    if (this.slotToContractId[slotId]) return null;

    const id = `PRESSURE_${slotId}_${Date.now()}`;
    const origin = this.getSlotOrigin(slotId);

    const inst = new ParcelContractInstance({
      id,
      type: "PRESSURE",
      slotId,
      origin,
      scene: this.scene,

      rng: this.rng,
      map: this.map,

      parcelManager: this,
      difficulty,
    });


    this.slotToContractId[slotId] = id;
    this.contractsById.set(id, inst);
    inst.spawn();
    this.scene.rebuildBothNavMeshes();
    this.scene.zoomMixer.buildOverviewTextureFromGrid(this.map.grid, SQUARESIZE, (cell) => colorFor(cell));
    this.map._uiIgnoreWorldLayer();
    return id;
  }

  removeContract(slotId, id, reason) {
    const inst = this.contractsById.get(id);

    if (this.slotToContractId[slotId] === id) this.slotToContractId[slotId] = null;
    this.contractsById.delete(id);

    if (inst && inst.type === "PRESSURE" && reason === "cleared") {
      const diff = inst.difficulty ?? 1;
      const bonus = calcPressureBonus(this.scene, diff);
      this.scene.updateMoney(+bonus);
    }

    // ✅ re-show the contract UI panel for that slot
    this.scene.parcelSpawnUI.showSlot(slotId);

  }

  notifyRaiderKilled(contractId) {
    if (!contractId) return;
    const inst = this.contractsById.get(contractId);
    if (inst) inst.onRaiderKilled();
  }

  notifyRaiderSpawned(contractId) {
    if (!contractId) return;
    const inst = this.contractsById.get(contractId);
    if (inst) inst.onRaiderSpawned();
  }

  spawnSpawnerBuilding({ gx, gy, contractId, plannedEnemies, spawnIntervalMs }) {
    // ✅ SpawnerBuilding handles map write + blocking internally now
    const sp = new SpawnerBuilding(this.scene, gx, gy, {
      quota: plannedEnemies,
      intervalMs: spawnIntervalMs,
      textureKey: TILE_TYPES.spawn.value,
      // contractId (optional) if you later want to tag kills/spawns
      contractId,
    });
    return sp;
  }
}
