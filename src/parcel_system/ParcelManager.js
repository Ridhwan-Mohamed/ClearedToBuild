// parcelSystem/ParcelManager.js
import { SpawnerBuilding } from "../buildings/SpawnerBuilding.js";
import { calcPressureBonus, colorFor, getContractStage, SQUARESIZE, TILE_TYPES } from "../constants.js";
import { PARCEL_SIZE, CONTRACT_SLOTS } from "./ParcelConfig.js";
import { ParcelContractInstance } from "./ParcelContractInstance.js";
import { Player } from "../players/Player.js";
import { SaveManager } from "../save/SaveManager.js";
import {
  SLOT_FAVOR_MAX_ACTIVE,
  SLOT_FAVOR_THRESHOLD,
  cloneSlotFavor,
  getEffectiveContractDurationMs,
  getEffectiveContractMoneyCost,
  getSlotFavorCompletionBonusMoney,
  isSlotFavorEligibleContractType,
  pickRandomSlotFavor,
} from "./SlotFavorSystem.js";

export class ParcelManager {
  constructor({ scene, opts }) {
    this.scene = scene;

    // ✅ rng should be a function, not Math.random()
    this.rng = opts.rng ?? Math.random;

    // ✅ store the real Map class (static API)
    this.map = opts.map;


    this.mainIslandOrigin = opts.mainIslandOrigin;

    this.contractsById = new Map();

    // ✅ keys must match ParcelConfig CONTRACT_SLOTS
    this.slotToContractId = { N: null, W: null, S: null, E: null };
    this.slotFavorState = this._createEmptySlotFavorState();

    this.onContractProgressChanged = null;
  }

  _createEmptySlotFavorState() {
    return Object.fromEntries(
      Object.keys(CONTRACT_SLOTS).map((slotId) => [slotId, {
        completedElsewhere: 0,
        favor: null,
        appliedContractId: null,
      }])
    );
  }

  _getSlotFavorState(slotId) {
    if (!slotId) return null;
    if (!this.slotFavorState?.[slotId]) {
      this.slotFavorState[slotId] = {
        completedElsewhere: 0,
        favor: null,
        appliedContractId: null,
      };
    }
    return this.slotFavorState[slotId];
  }

  getSlotFavor(slotId) {
    return cloneSlotFavor(this._getSlotFavorState(slotId)?.favor);
  }

  getContractPurchaseContext(slotId, type, difficulty = 1) {
    const favor = isSlotFavorEligibleContractType(type) ? this.getSlotFavor(slotId) : null;
    const baseMoneyCost = getEffectiveContractMoneyCost(this.scene, type, difficulty, favor);
    const discount = Math.max(0, Number(this.scene?.getNextParcelDiscount?.() || 0));
    return {
      favor,
      moneyCost: Math.max(0, Math.round(baseMoneyCost * Math.max(0, 1 - discount))),
      durationMs: getEffectiveContractDurationMs(type, favor),
      completionBonusMoney: getSlotFavorCompletionBonusMoney(this.scene, type, difficulty, favor),
    };
  }

  hasActiveContractType(type) {
    const normalized = String(type || "").toUpperCase();
    if (!normalized) return false;
    if (normalized === "PRESSURE") return false;
    for (const inst of this.contractsById.values()) {
      if (String(inst?.type || "").toUpperCase() === normalized) return true;
    }
    return false;
  }

  _consumeParcelCouponIfNeeded(type) {
    if (!String(type || "").trim()) return 0;
    return Math.max(0, Number(this.scene?.consumeParcelCoupon?.() || 0));
  }

  _countActiveSlotFavors() {
    return Object.values(this.slotFavorState || {}).reduce(
      (sum, state) => sum + (state?.favor ? 1 : 0),
      0
    );
  }

  _canSlotReceiveFavor(slotId) {
    if (!slotId) return false;
    if (this.slotToContractId?.[slotId]) return false;
    if (this.scene?.towerPressureController?.isSlotUnderTowerPressure?.(slotId)) return false;
    return true;
  }

  _assignPendingSlotFavors() {
    let available = SLOT_FAVOR_MAX_ACTIVE - this._countActiveSlotFavors();
    if (available <= 0) return false;

    const candidates = Object.keys(CONTRACT_SLOTS)
      .map((slotId) => ({ slotId, state: this._getSlotFavorState(slotId) }))
      .filter(({ slotId, state }) => (
        this._canSlotReceiveFavor(slotId)
        && !state?.favor
        && !state?.appliedContractId
        && Number(state?.completedElsewhere || 0) >= SLOT_FAVOR_THRESHOLD
      ))
      .sort((a, b) => (
        Number(b.state?.completedElsewhere || 0) - Number(a.state?.completedElsewhere || 0)
      ));

    let changed = false;
    for (const entry of candidates) {
      if (available <= 0) break;
      entry.state.favor = pickRandomSlotFavor(this.rng);
      entry.state.appliedContractId = null;
      changed = true;
      available -= 1;
    }
    return changed;
  }

  _markSlotChosen(slotId, contractId, type) {
    const state = this._getSlotFavorState(slotId);
    if (!state) return;
    state.completedElsewhere = 0;
    state.appliedContractId = state.favor && isSlotFavorEligibleContractType(type)
      ? contractId
      : null;
  }

  _advanceSlotFavorsAfterCompletion(inst) {
    if (!inst) return false;
    if (inst.type === "PRESSURE" && inst.pressureSource === "tower") return false;

    let changed = false;
    const finishedState = this._getSlotFavorState(inst.slotId);
    if (finishedState) {
      finishedState.completedElsewhere = 0;
      if (finishedState.appliedContractId === inst.id || finishedState.favor) {
        finishedState.favor = null;
        finishedState.appliedContractId = null;
        changed = true;
      }
    }

    for (const slotId of Object.keys(CONTRACT_SLOTS)) {
      if (slotId === inst.slotId) continue;
      const state = this._getSlotFavorState(slotId);
      if (!state || state.favor || state.appliedContractId || !this._canSlotReceiveFavor(slotId)) {
        continue;
      }
      state.completedElsewhere = Math.max(0, Number(state.completedElsewhere || 0) + 1);
      changed = true;
    }

    return this._assignPendingSlotFavors() || changed;
  }

  refreshSlotFavorUi() {
    for (const slot of this.scene?.parcelSpawnUI?.slots?.values?.() || []) {
      slot?.refreshDisplayState?.();
    }
    this.scene?.uiScene?.contractHud?.refreshForParcelStateChange?.();
  }

  getSlotOrigin(slotId) {
    const slot = CONTRACT_SLOTS[slotId];
    return {
      x: this.mainIslandOrigin.x + slot.dx,
      y: this.mainIslandOrigin.y + slot.dy,
    };
  }

  _notifyExpansionParcelClaimed(type, slotId, id) {
    const normalized = String(type || "").toUpperCase();
    if (!normalized || normalized === "PRESSURE" || normalized === "MILITIA") return;
    this.scene?.registerRunParcelClaim?.(normalized, { slotId, contractId: id });
  }

  startForest(slotId)  { return this._startResource(slotId, "FOREST"); }
  startRock(slotId)    { return this._startResource(slotId, "ROCK"); }
  startPressure(slotId, difficulty = 1, opts = {}) { return this._startPressure(slotId, difficulty, opts); }
  startFarm(slotId) { return this._startResource(slotId, "FARM"); }

  _refreshAfterParcelPaint(bounds = null, opts = {}) {
    const isOverview = this.scene?.zoomMixer?.mode === "overview";
    if (!isOverview) {
      this.map.setDetailedWorldVisible?.(true);
    } else {
      this.map.setDetailedWorldVisible?.(false);
    }

    if (bounds && this.scene?.refreshParcelArea) {
      this.scene.refreshParcelArea(bounds, opts);
    } else {
      if (!isOverview) {
        this.map.reDraw?.();
      }
      this.scene.rebuildBothNavMeshes?.();
      this.scene.zoomMixer?.buildOverviewTextureFromGrid?.(
        this.map.grid,
        SQUARESIZE,
        (cell) => colorFor(cell)
      );
    }
    this.map._uiIgnoreWorldLayer();
    this.scene?.parcelSpawnUI?.setMode?.(this.scene?.zoomMixer?.mode || "detailed");
  }

  startMilitia(slotId, opts = {}) {
    if (this.slotToContractId[slotId] || this.hasActiveContractType("MILITIA")) return null;

    const id = `MILITIA_${slotId}_${Date.now()}`;
    const origin = this.getSlotOrigin(slotId);

    const inst = new ParcelContractInstance({
      id,
      type: "MILITIA",
      slotId,
      origin,
      scene: this.scene,
      rng: this.rng,
      map: this.map,
      parcelManager: this,
      militiaConfig: opts.militiaConfig ?? null,
    });

    inst.moneyCost = Math.max(0, Number(opts.moneyCost ?? 0));

    this._markSlotChosen(slotId, id, "MILITIA");
    this.slotToContractId[slotId] = id;
    this.contractsById.set(id, inst);

    inst.spawn();
    this._consumeParcelCouponIfNeeded("MILITIA");
    this._refreshAfterParcelPaint(inst.getParcelBounds?.());

    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    slotPanel?.clearPressureState?.();
    slotPanel?.resetUiState?.();
    slotPanel?.setVisible?.(true);

    return id;
  }

  startMarket(slotId) {
    if (this.slotToContractId[slotId] || this.hasActiveContractType("MARKET")) return null;

    const id = `MARKET_${slotId}_${Date.now()}`;
    const origin = this.getSlotOrigin(slotId);
    const purchase = this.getContractPurchaseContext(slotId, "MARKET", 1);

    const inst = new ParcelContractInstance({
      id,
      type: "MARKET",
      slotId,
      origin,
      scene: this.scene,
      rng: this.rng,
      map: this.map,
      parcelManager: this,
      slotFavor: purchase.favor,
      contractDurationMs: purchase.durationMs,
      completionBonusMoney: purchase.completionBonusMoney,
    });
    inst.moneyCost = Math.max(0, Number(purchase.moneyCost ?? 0));

    this._markSlotChosen(slotId, id, "MARKET");
    this.slotToContractId[slotId] = id;
    this.contractsById.set(id, inst);

    inst.spawn();
    this._consumeParcelCouponIfNeeded("MARKET");
    this._refreshAfterParcelPaint(inst.getParcelBounds?.());
    this._notifyExpansionParcelClaimed("MARKET", slotId, id);
    SaveManager.queueAutosave("parcel_market_start");

    // hide slot UI while active
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    slotPanel?.resetUiState?.();
    slotPanel?.setVisible?.(true);

    return id;
  }


  _startResource(slotId, type) {
    if (this.slotToContractId[slotId] || this.hasActiveContractType(type)) return null;

    const id = `${type}_${slotId}_${Date.now()}`;
    const origin = this.getSlotOrigin(slotId);
    const purchase = this.getContractPurchaseContext(slotId, type, 1);

    const inst = new ParcelContractInstance({
      id, type, slotId, origin,
      scene: this.scene,

      // ✅ use manager rng
      rng: this.rng,

      // ✅ pass Map class
      map: this.map,

      parcelManager: this,
      slotFavor: purchase.favor,
      contractDurationMs: purchase.durationMs,
      completionBonusMoney: purchase.completionBonusMoney,
    });
    inst.moneyCost = Math.max(0, Number(purchase.moneyCost ?? 0));

    this._markSlotChosen(slotId, id, type);
    this.slotToContractId[slotId] = id;
    this.contractsById.set(id, inst);

    // Hide the slot UI while a contract is active (no outline during play)
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    slotPanel?.clearPressureState?.();
    slotPanel?.resetUiState?.();
    slotPanel?.setVisible?.(true);

    const afterSpawn = (result = {}) => {
      if (!result?.refreshHandled) {
        this._refreshAfterParcelPaint(inst.getParcelBounds?.(), {
          waterSourceUpdate: {
            slotId,
            landParcel: true,
          },
        });
      } else {
        this.map._uiIgnoreWorldLayer?.();
        this.scene?.parcelSpawnUI?.setMode?.(this.scene?.zoomMixer?.mode || "detailed");
      }

      this._notifyExpansionParcelClaimed(type, slotId, id);
      SaveManager.queueAutosave(`parcel_${String(type || "").toLowerCase()}_start`);
    };

    const spawnResult = inst.spawn({ animateParcelAdd: true });
    this._consumeParcelCouponIfNeeded(type);
    if (spawnResult && typeof spawnResult.then === "function") {
      spawnResult
        .then(afterSpawn)
        .catch((err) => {
          console.error("Animated parcel spawn failed; falling back to immediate spawn.", err);
          if (!inst._spawnCommitted && !inst._completed) {
            const fallbackResult = inst.spawn({ skipAnimation: true });
            afterSpawn(fallbackResult);
          } else if (inst._spawnCommitted && !inst._completed) {
            afterSpawn({ refreshHandled: true });
          }
        });
    } else {
      afterSpawn(spawnResult);
    }

    return id;
  }

  _startPressure(slotId, difficulty, opts = {}) {
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
      pressureSource: opts.source ?? "manual",
      pressureOwnerTower: opts.ownerTower ?? null,
      pressureModifierKey: opts.modifierKey ?? opts.modifier?.key ?? null,
      pressureModifier: opts.modifier ?? null,
      pressureHordeIndex: opts.hordeIndex ?? null,
    });

    this._markSlotChosen(slotId, id, "PRESSURE");
    this.slotToContractId[slotId] = id;
    this.contractsById.set(id, inst);

    // Hide the slot UI while a pressure contract is active or being revealed.
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    slotPanel?.clearPressureState?.();
    slotPanel?.resetUiState?.();
    slotPanel?.setVisible?.(true);

    const afterSpawn = (result = {}) => {
      if (!result?.refreshHandled) {
        this._refreshAfterParcelPaint(inst.getParcelBounds?.(), {
          waterSourceUpdate: {
            slotId,
            landParcel: true,
          },
        });
      } else {
        this.map._uiIgnoreWorldLayer?.();
        this.scene?.parcelSpawnUI?.setMode?.(this.scene?.zoomMixer?.mode || "detailed");
      }

      SaveManager.queueAutosave("parcel_pressure_start");
    };

    const spawnResult = inst.spawn({ animateParcelAdd: true });
    this._consumeParcelCouponIfNeeded("PRESSURE");
    if (spawnResult && typeof spawnResult.then === "function") {
      spawnResult
        .then(afterSpawn)
        .catch((err) => {
          console.error("Animated pressure parcel spawn failed; falling back to immediate spawn.", err);
          if (!inst._spawnCommitted && !inst._completed) {
            const fallbackResult = inst.spawn({ skipAnimation: true });
            afterSpawn(fallbackResult);
          } else if (inst._spawnCommitted && !inst._completed) {
            afterSpawn({ refreshHandled: true });
          }
        });
    } else {
      afterSpawn(spawnResult);
    }

    return id;
  }

  removeContract(slotId, id, reason) {
    const inst = this.contractsById.get(id);
    const slotFavorChanged = this._advanceSlotFavorsAfterCompletion(inst);

    if (this.slotToContractId[slotId] === id) this.slotToContractId[slotId] = null;
    this.contractsById.delete(id);

    if (inst && inst.type === "PRESSURE" && reason === "cleared") {
      const diff = inst.difficulty ?? 1;
      const bonus = calcPressureBonus(this.scene, diff);
      this.scene.updateMoney(+bonus);
    }

    // If this slot is owned by a standing tower, let the tower controller
    // immediately restart the countdown UI.
    const tpc = this.scene.towerPressureController;
    const ownedByTower = !!tpc?.isSlotUnderTowerPressure?.(slotId);

    if (ownedByTower) {
      // Tower owns this slot: tower controller will re-show the slot + countdown.
      tpc?.handleSlotFreed?.(slotId);
    } else {
      // Normal slot: re-show the regular contract UI panel.
      this.scene.parcelSpawnUI.showSlot(slotId);
    }
    if (slotFavorChanged) {
      this.refreshSlotFavorUi();
    }
    SaveManager.queueAutosave(`parcel_remove_${reason || "unknown"}`);
  }

  markContractPermitCost(id, permitCost) {
    const inst = this.contractsById.get(id);
    if (!inst) return;
    inst.permitCost = Math.max(0, Number(permitCost) || 0);
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

  notifySpawnerDestroyed(contractId, unspawnedCount) {
    if (!contractId) return;
    const inst = this.contractsById.get(contractId);
    if (inst) inst.onSpawnerDestroyed?.(unspawnedCount);
  }

  getSnapshot() {
    return {
      mainIslandOrigin: this.mainIslandOrigin ? { ...this.mainIslandOrigin } : null,
      slotToContractId: { ...this.slotToContractId },
      slotFavorState: Object.fromEntries(
        Object.entries(this.slotFavorState || {}).map(([slotId, state]) => [slotId, {
          completedElsewhere: Math.max(0, Number(state?.completedElsewhere || 0)),
          favor: cloneSlotFavor(state?.favor),
          appliedContractId: state?.appliedContractId ?? null,
        }])
      ),
      contracts: Array.from(this.contractsById.values()).map((inst) => inst.getSnapshot?.()).filter(Boolean),
    };
  }

  restoreSnapshot(saved = null) {
    if (!saved) return;
    this.mainIslandOrigin = saved.mainIslandOrigin ? { ...saved.mainIslandOrigin } : this.mainIslandOrigin;
    this.contractsById.clear();
    this.slotToContractId = { N: null, W: null, S: null, E: null };
    this.slotFavorState = this._createEmptySlotFavorState();

    for (const slotId of Object.keys(CONTRACT_SLOTS)) {
      const nextState = saved?.slotFavorState?.[slotId];
      if (!nextState) continue;
      this.slotFavorState[slotId] = {
        completedElsewhere: Math.max(0, Number(nextState.completedElsewhere || 0)),
        favor: cloneSlotFavor(nextState.favor),
        appliedContractId: nextState.appliedContractId ?? null,
      };
    }

    const contracts = Array.isArray(saved.contracts) ? saved.contracts : [];
    for (const entry of contracts) {
      if (!entry?.id || !entry?.slotId || !entry?.type) continue;
      const inst = new ParcelContractInstance({
        id: entry.id,
        type: entry.type,
        slotId: entry.slotId,
        origin: entry.origin || this.getSlotOrigin(entry.slotId),
        scene: this.scene,
        rng: this.rng,
        map: this.map,
        parcelManager: this,
        difficulty: entry.difficulty ?? 1,
        pressureSource: entry.pressureSource ?? "manual",
        pressureOwnerTower: entry.pressureOwnerTower ?? null,
        pressureModifierKey: entry.pressureModifierKey ?? null,
        pressureModifier: entry.pressureModifier ?? null,
        pressureHordeIndex: entry.pressureHordeIndex ?? null,
        militiaConfig: entry.militiaConfig ?? null,
        slotFavor: cloneSlotFavor(entry.slotFavor),
        contractDurationMs: Number(entry.contractDurationMs ?? 0) || null,
        completionBonusMoney: Number(entry.completionBonusMoney ?? 0),
      });
      this.slotToContractId[entry.slotId] = entry.id;
      this.contractsById.set(entry.id, inst);
      inst.restoreSnapshot?.(entry);

      const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(entry.slotId);
      slotPanel?.clearPressureState?.();
      slotPanel?.resetUiState?.();
      slotPanel?.setVisible?.(true);
    }

    if (contracts.length) {
      for (const inst of this.contractsById.values()) {
        this._refreshAfterParcelPaint(inst.getParcelBounds?.(), {
          waterSourceUpdate: {
            slotId: inst.slotId,
            landParcel: inst.type === "FOREST" || inst.type === "ROCK" || inst.type === "FARM" || inst.type === "PRESSURE",
          },
        });
      }
    }
    this.refreshSlotFavorUi();
  }

  forceClearContracts(reason = "external_cleanup", opts = {}) {
    const entries = [];
    const types = Array.isArray(opts.types) ? new Set(opts.types.map((v) => String(v).toUpperCase())) : null;
    const excludeTypes = Array.isArray(opts.excludeTypes) ? new Set(opts.excludeTypes.map((v) => String(v).toUpperCase())) : null;
    const sources = Array.isArray(opts.sources)
      ? new Set(opts.sources.map((v) => String(v)))
      : (opts.source != null ? new Set([String(opts.source)]) : null);

    for (const [id, inst] of this.contractsById.entries()) {
      const type = String(inst?.type || "").toUpperCase();
      const source = inst?.pressureSource != null ? String(inst.pressureSource) : null;
      if (types && !types.has(type)) continue;
      if (excludeTypes && excludeTypes.has(type)) continue;
      if (opts.onlyTowerSpawned && source !== "tower") continue;
      if (sources && !sources.has(source)) continue;
      entries.push([id, inst]);
    }
    if (!entries.length) return 0;

    const pressureIds = new Set(
      entries
        .filter(([, inst]) => inst?.type === "PRESSURE")
        .map(([id]) => id)
    );

    if (pressureIds.size) {
      const troops = (Player.troops || []).slice();
      for (const troop of troops) {
        if (!troop?.active || (!troop?.isRaider && !troop?.isFortGrunt)) continue;
        if (!pressureIds.has(troop.contractId)) continue;
        troop.contractId = null;
        troop.spawner = null;
        try { troop.destroySelf?.({ silentStageCleanup: true }); } catch {}
      }
    }

    for (const [, inst] of entries) {
      try {
        inst.complete?.(reason);
      } catch {}
    }

    return entries.length;
  }

  forceClearPressureContracts(reason = "stage_end_cleanup", opts = {}) {
    return this.forceClearContracts(reason, {
      ...opts,
      types: ["PRESSURE"],
    });
  }

  stopTowerPressureForStageEnd() {
    const entries = [];
    for (const [, inst] of this.contractsById.entries()) {
      if (inst?.type !== "PRESSURE") continue;
      if (inst?.pressureSource !== "tower") continue;
      entries.push(inst);
    }
    if (!entries.length) return 0;

    const pressureIds = new Set(entries.map((inst) => inst.id));

    // Freeze tower-spawned pressure so stage-end cinematics/rewards cannot
    // keep emitting new raiders while the contracts are waiting to be removed.
    for (const inst of entries) {
      for (const spawner of inst.spawners || []) {
        const building = spawner?.building;
        if (!building) continue;
        if (building.timer) {
          building.timer.remove(false);
          building.timer = null;
        }
      }
    }

    // Remove any currently alive raiders from those tower-pressure parcels
    // without crediting kills or mutating contract progress.
    const troops = (Player.troops || []).slice();
    let removed = 0;
    for (const troop of troops) {
      if (!troop?.active || (!troop?.isRaider && !troop?.isFortGrunt)) continue;
      if (!pressureIds.has(troop.contractId)) continue;
      try {
        troop.destroySelf?.({ silentStageCleanup: true });
        removed++;
      } catch {}
    }

    return removed;
  }

  clearAllFortGrunts() {
    const troops = (Player.troops || []).slice();
    let removed = 0;
    for (const troop of troops) {
      if (!troop?.active || !troop?.isFortGrunt) continue;
      try { troop.destroySelf?.({ silentStageCleanup: true }); } catch {}
      removed++;
    }
    return removed;
  }

  spawnSpawnerBuilding(args = {}) {
    const {
      gx,
      gy,
      contractId,
      plannedEnemies,
      spawnIntervalMs,
      enemyType = "raider",
      enemyMods = null,
      enemyTypeLabel = null,
      modifierKey = null,
      modifierLabel = null,
    } = args;

    const sp = new SpawnerBuilding(this.scene, gx, gy, {
      quota: plannedEnemies,
      intervalMs: spawnIntervalMs,
      textureKey: TILE_TYPES.spawn.value,
      contractId,
      enemyType,
      enemyMods,
      enemyTypeLabel,
      modifierKey,
      modifierLabel,
    });
    return sp;
  }
}
