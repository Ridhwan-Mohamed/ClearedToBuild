 // src/parcel_system/TowerPressureController.js
// Drives "pressure parcel" waves spawned by enemy towers.
//
// Behaviour:
// - Each registered tower repeatedly:
//     1) chooses a random contract slot (W/E/S)
//     2) shows a world-space countdown UI on that slot panel
//     3) when countdown hits 0, spawns a PRESSURE parcel in that slot
//     4) when the parcel ends (cleared or spawners destroyed), restart the countdown
// - Destroying the tower immediately frees the slot back to normal contract UI.
//
// Expected scene wiring:
//   scene.parcelManager (ParcelManager)
//   scene.parcelSpawnUI (ParcelSpawnController)
//   scene.towerPressureController (this)

import { StageState } from "../parcelController/StageState.js";
import { PRESSURE } from "./ParcelConfig.js";

const SLOT_IDS = ["W", "E", "S"];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function fmtMMSS(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export class TowerPressureController {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} [opts]
   * @param {number} [opts.countdownMs] base time between waves per tower
   * @param {number} [opts.maxDifficulty] caps spawner count
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.countdownMs = opts.countdownMs ?? 45_000;
    this.maxDifficulty = opts.maxDifficulty ?? PRESSURE.maxDifficulty ?? 3;

    // tower -> state
    this._towerState = new Map();

    // slotId -> tower (the tower currently "locking" that slot)
    this._slotLocks = new Map();
  }

  /** Register a tower to start spawning pressure waves. */
  registerTower(tower, preferredSlotId = null) {
    if (!tower || this._towerState.has(tower)) return;

    const normalizedPreferred = SLOT_IDS.includes(preferredSlotId)
      ? preferredSlotId
      : (SLOT_IDS.includes(tower?.pressureSlotId) ? tower.pressureSlotId : null);

    const st = {
      tower,
      currentSlotId: null,
      preferredSlotId: normalizedPreferred,
      countdownEvent: null,
      uiTickEvent: null,
      countdownEndsAt: 0,
      waitingForContractToEnd: false,
    };
    this._towerState.set(tower, st);

    // start immediately
    this._beginCountdown(st);
  }

  /** Unregister a tower and release any locked slot UI. */
  unregisterTower(tower) {
    const st = this._towerState.get(tower);
    if (!st) return;

    this._cancelTimers(st);

    if (st.currentSlotId && this._slotLocks.get(st.currentSlotId) === tower) {
      this._slotLocks.delete(st.currentSlotId);
      this._restoreNormalSlotUI(st.currentSlotId);
    }

    this._towerState.delete(tower);
  }

  /** Called by ParcelManager when a contract ends; returns true if handled. */
  handleSlotFreed(slotId) {
    const tower = this._slotLocks.get(slotId);
    if (!tower) return false;

    const st = this._towerState.get(tower);
    if (!st) return false;

    // If a wave ended, we immediately schedule the next countdown.
    st.waitingForContractToEnd = false;
    this._beginCountdown(st);
    return true;
  }

  isSlotLocked(slotId) {
    return this._slotLocks.has(slotId);
  }

  // Back-compat for ParcelManager UI logic
  isSlotUnderTowerPressure(slotId) {
    return this.isSlotLocked(slotId);
  }

  getTowerSlotId(tower) {
    const st = this._towerState?.get?.(tower);
    return st?.currentSlotId ?? null;
  }

  getTowerPressureInfo(tower) {
    const st = this._towerState?.get?.(tower);
    if (!st) return null;

    const slotId = st.currentSlotId ?? null;
    const now = this.scene?.time?.now ?? 0;
    const remainingMs = Math.max(0, (st.countdownEndsAt ?? 0) - now);
    const hasActiveRaid = !!(slotId && this.scene?.parcelManager?.slotToContractId?.[slotId]);

    let phase = "arming";
    if (hasActiveRaid) phase = "raid_live";
    else if (remainingMs > 0) phase = "countdown";
    else if (st.waitingForContractToEnd) phase = "waiting_slot";

    return {
      slotId,
      phase,
      remainingMs,
      remainingText: fmtMMSS(remainingMs),
    };
  }

  getSlotPressureInfo(slotId) {
    if (!slotId) return null;
    const tower = this._slotLocks.get(slotId);
    if (!tower) return null;

    const st = this._towerState?.get?.(tower);
    if (!st) return null;

    const now = this.scene?.time?.now ?? 0;
    const remainingMs = Math.max(0, (st.countdownEndsAt ?? 0) - now);
    const hasActiveRaid = !!(slotId && this.scene?.parcelManager?.slotToContractId?.[slotId]);
    const difficulty = this._difficultyForCurrentStage();
    const spawners = difficulty;
    const enemies = spawners * (PRESSURE.baseEnemiesPerSpawner ?? 3);

    let phase = "arming";
    if (hasActiveRaid) phase = "raid_live";
    else if (remainingMs > 0) phase = "countdown";
    else if (st.waitingForContractToEnd) phase = "waiting_slot";

    return {
      slotId,
      phase,
      remainingMs,
      remainingText: fmtMMSS(remainingMs),
      difficulty,
      spawners,
      enemies,
    };
  }

  // ─────────────────────────────────────────────────────────────

  _cancelTimers(st) {
    st.countdownEvent?.remove(false);
    st.uiTickEvent?.remove(false);
    st.countdownEvent = null;
    st.uiTickEvent = null;
  }

  _difficultyForCurrentStage() {
    // stageIndex starts at 1; we map stage -> spawner count, capped.
    return clamp(StageState.stageIndex | 0, 1, this.maxDifficulty);
  }

  _pickRandomSlotId(exclude = null) {
    const rng = this.scene?.rng ?? Math.random;
    const pool = exclude ? SLOT_IDS.filter(s => s !== exclude) : SLOT_IDS.slice();
    if (pool.length === 0) return exclude ?? SLOT_IDS[0];
    return pool[Math.floor(rng() * pool.length)];
  }

  _isSlotFree(slotId) {
    const pm = this.scene?.parcelManager;
    if (!pm) return false;
    return !pm.slotToContractId?.[slotId];
  }

  _pickCountdownSlot(st) {
    const pm = this.scene?.parcelManager;
    if (!pm) return null;

    // candidate slots must be: free + not locked by another tower
    const candidates = ["W", "E", "S"].filter(s => {
      if (pm.slotToContractId?.[s]) return false;
      const lockOwner = this._slotLocks.get(s);
      return !lockOwner || lockOwner === st.tower;
    });

    // Prefer strict ownership when the tower has an assigned lane.
    if (st.preferredSlotId) {
      return candidates.includes(st.preferredSlotId) ? st.preferredSlotId : null;
    }

    // safest bet: stay on current if it's free
    if (st.currentSlotId && candidates.includes(st.currentSlotId)) return st.currentSlotId;

    // otherwise roam among free slots
    if (candidates.length === 0) return null;

    const rng = this.scene?.rng ?? Math.random;
    return candidates[Math.floor(rng() * candidates.length)];
  }

  _beginCountdown(st) {
    if (!st || !st.tower || st.tower._destroyed) return;

    // release previous lock
    if (st.currentSlotId && this._slotLocks.get(st.currentSlotId) === st.tower) {
      this._slotLocks.delete(st.currentSlotId);
      this._restoreNormalSlotUI(st.currentSlotId);
    }

    // pick a new direction
    // pick a FREE slot for countdown placement (prefer staying put if free)
    const slotId = this._pickCountdownSlot(st);

    // If nothing is free (player has all slots busy), don't show countdown on an active slot.
    // Just retry soon.
    if (!slotId) {
      st.waitingForContractToEnd = true;
      this._cancelTimers(st);
      st.countdownEvent = this.scene.time.delayedCall(1000, () => this._beginCountdown(st));
      return;
    }

    st.currentSlotId = slotId;
    st.tower.pressureSlotId = slotId; // for hover UI on the tower

    // lock the slot for this tower
    this._slotLocks.set(slotId, st.tower);

    // ensure the slot panel is visible
    this.scene?.parcelSpawnUI?.showSlot?.(slotId);

    // If the player left this slot on a sub-page (Forest/Rock/etc), exit it so countdown is visible.
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    if (slotPanel?._state === "PAGE") slotPanel.back?.();

    st.countdownEndsAt = this.scene.time.now + this.countdownMs;

    // draw countdown immediately
    this._showCountdownUI(slotId, st);
    // tick UI frequently
    st.uiTickEvent?.remove(false);
    st.uiTickEvent = this.scene.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (!this._towerState.has(st.tower)) return;
        this._showCountdownUI(slotId, st);
      },
    });

    // on expiry spawn wave
    st.countdownEvent?.remove(false);
    st.countdownEvent = this.scene.time.delayedCall(this.countdownMs, () => {
      this._spawnWave(st);
    });
  }

  _showCountdownUI(slotId, st) {
    const remaining = Math.max(0, st.countdownEndsAt - this.scene.time.now);
    const diff = this._difficultyForCurrentStage();
    const spawners = diff;
    const enemies = spawners * (PRESSURE.baseEnemiesPerSpawner ?? 3);

    // We display on the SlotPanel itself (world-space) via a helper on SlotPanel.
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    if (slotPanel?.setPressureCountdown) {
      if (slotPanel?._state === "PAGE") slotPanel.back?.();
      slotPanel.setPressureCountdown({
        slotId,
        remainingMs: remaining,
        remainingText: fmtMMSS(remaining),
        spawners,
        enemies,
        enemyType: "Raider",
      });
    }
  }

  _spawnWave(st) {
    if (!st || !st.tower || st.tower._destroyed) return;

    const slotId = st.currentSlotId;
    const pm = this.scene?.parcelManager;
    if (!pm || !slotId) {
      this._beginCountdown(st);
      return;
    }

    // If slot is already occupied (player contract still active), try again soon.
    if (pm.slotToContractId?.[slotId]) {
      st.countdownEndsAt = this.scene.time.now + 3_000;
      st.countdownEvent = this.scene.time.delayedCall(3_000, () => this._spawnWave(st));
      return;
    }

    const difficulty = this._difficultyForCurrentStage();

    // Spawn the negative parcel.
    pm.startPressure(slotId, difficulty, { source: "tower", ownerTower: st.tower });

    // Slot is now occupied; we wait for ParcelManager.removeContract to call handleSlotFreed().
    st.waitingForContractToEnd = true;

    // While occupied, show a "LIVE" status instead of countdown.
    // Slot is now occupied; hide/clear the countdown UI while the contract runs.
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    slotPanel?.clearPressureState?.();
    // Hide the panel entirely so no outline remains while the raid is active.
    if (slotPanel?.setVisible) slotPanel.setVisible(false);

    // stop countdown timers; we'll resume when ParcelManager notifies us via handleSlotFreed()
    st.countdownEvent?.remove(false);
    st.uiTickEvent?.remove(false);
    st.countdownEvent = null;
    st.uiTickEvent = null;
  }

  _restoreNormalSlotUI(slotId) {
    // put the slot back to the normal contract panel
    const slotPanel = this.scene?.parcelSpawnUI?.slots?.get?.(slotId);
    slotPanel?.clearPressureState?.();

    this.scene?.parcelSpawnUI?.showSlot?.(slotId);
  }
}
