// parcelController/StageState.js
// Stage/season progression + north-fort win condition (supports multiple towers)

export const StageState = {
  stageIndex: 1,      // 1..STAGES_PER_SEASON within a season
  seasonIndex: 1,
  STAGES_PER_SEASON: 5,

  // Fort towers that exist in the world (registered by TowerBuilding)
  _fortTowers: new Set(),

  // Fort objective state (per season)
  _fortObjective: {
    active: false,
    seasonIndex: 1,
    requiredCount: 0,     // snapshot at arm-time
    destroyedSet: new Set(),
    completed: false,
    meta: null,
  },

  _listeners: {
    seasonAdvanced: new Set(),
    fortDestroyed: new Set(),
  },

  onSeasonAdvanced(fn) {
    if (typeof fn === "function") this._listeners.seasonAdvanced.add(fn);
    return () => this._listeners.seasonAdvanced.delete(fn);
  },

  onFortDestroyed(fn) {
    if (typeof fn === "function") this._listeners.fortDestroyed.add(fn);
    return () => this._listeners.fortDestroyed.delete(fn);
  },

  // Called by TowerBuilding when a fort objective tower is created
  registerFortTower(towerRef) {
    if (towerRef) this._fortTowers.add(towerRef);
  },

  // Called by TowerBuilding when it is destroyed (optional hygiene)
  unregisterFortTower(towerRef) {
    if (towerRef) this._fortTowers.delete(towerRef);
  },

  advanceStage() {
    this.stageIndex += 1;
  },

  advanceSeason(meta = {}) {
    this.seasonIndex += 1;
    this.stageIndex = 1;

    // Reset objective and tower registry for next season (fresh world)
    this._fortTowers.clear();
    this._fortObjective = {
      active: false,
      seasonIndex: this.seasonIndex,
      requiredCount: 0,
      destroyedSet: new Set(),
      completed: false,
      meta: null,
    };

    for (const fn of this._listeners.seasonAdvanced) {
      try { fn({ seasonIndex: this.seasonIndex, stageIndex: this.stageIndex, ...meta }); } catch (_) {}
    }
  },

  // Call AFTER reward selection to move to next stage/season and reset fort objective state.
  completeFortCycle(meta = {}, opts = {}) {
    const stagesPerSeason = Math.max(1, Number(opts.stagesPerSeason ?? this.STAGES_PER_SEASON) || 5);

    if (this.stageIndex >= stagesPerSeason) {
      this.advanceSeason({ reason: "fort_defeated", ...meta });
    } else {
      this.stageIndex += 1;

      this._fortTowers.clear();
      this._fortObjective = {
        active: false,
        seasonIndex: this.seasonIndex,
        requiredCount: 0,
        destroyedSet: new Set(),
        completed: false,
        meta: null,
      };
    }

    return { seasonIndex: this.seasonIndex, stageIndex: this.stageIndex };
  },

  /**
   * Arm the north-fort objective for the CURRENT season.
   * Call after all fort towers are spawned/created.
   */
  setFortObjective(meta = {}) {
    const snapshotCount =
      Number.isFinite(meta.requiredTowerCount) && meta.requiredTowerCount > 0
        ? Math.floor(meta.requiredTowerCount)
        : (this._fortTowers.size > 0 ? this._fortTowers.size : 1);

    this._fortObjective.active = true;
    this._fortObjective.seasonIndex = this.seasonIndex;
    this._fortObjective.requiredCount = snapshotCount;
    this._fortObjective.destroyedSet = new Set();
    this._fortObjective.completed = false;
    this._fortObjective.meta = meta;
  },

  /**
   * Called by TowerBuilding.destroy()
   * Counts down fort towers; only completes when requiredCount reached.
   */
  notifyFortTowerDestroyed(towerRef) {
    const obj = this._fortObjective;
    if (!obj.active) return false;
    if (obj.completed) return false;

    // Only count towers that were registered as fort towers
    if (!this._fortTowers.has(towerRef)) return false;

    // Do not double-count
    if (obj.destroyedSet.has(towerRef)) return false;

    obj.destroyedSet.add(towerRef);

    // Not done yet -> just counted
    if (obj.destroyedSet.size < obj.requiredCount) return true;

    // Completed (reward + progression handled by scene callback)
    obj.completed = true;

    for (const fn of this._listeners.fortDestroyed) {
      try { fn({ seasonIndex: this.seasonIndex, stageIndex: this.stageIndex, meta: obj.meta }); } catch (_) {}
    }
    return true;
  },
};
