// parcelController/StageState.js
// Stage/season progression + north-fort win condition (supports multiple towers)

export const StageState = {
  stageIndex: 1,      // 1..STAGES_PER_SEASON within a season
  seasonIndex: 1,
  startDay: 1,
  STAGES_PER_SEASON: 5,
  endlessMode: true,
  fortObjectiveEnabled: false,
  START_OVERRIDE: {
    // Debug boss-test start point. Set `day` back to `1` and `stageIndex` back to `1`
    // when you want the normal run start again.
    seasonIndex: 1,
    stageIndex: 1,
    day: 1,
  },

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

  resetFortState() {
    this._fortTowers.clear();
    this._fortObjective = {
      active: false,
      seasonIndex: this.seasonIndex,
      requiredCount: 0,
      destroyedSet: new Set(),
      completed: false,
      meta: null,
    };
  },

  getConfiguredStartDay(override = null) {
    const src = override ?? this.START_OVERRIDE ?? {};
    const explicitDay = Math.floor(Number(src.day ?? src.dayIndex) || 0);
    if (explicitDay >= 1) return explicitDay;

    const stage = Math.max(1, Math.floor(Number(src.stageIndex ?? this.stageIndex ?? 1) || 1));
    return stage <= 1 ? 1 : stage + 1;
  },

  getCompletedHordesForStart(override = null) {
    return Math.max(0, this.getConfiguredStartDay(override) - 2);
  },

  startEndlessRun(override = null) {
    const src = override ?? this.START_OVERRIDE ?? {};
    this.endlessMode = true;
    this.fortObjectiveEnabled = false;
    this.seasonIndex = Math.max(1, Math.floor(Number(src.seasonIndex ?? 1) || 1));
    this.stageIndex = Math.max(1, Math.floor(Number(src.stageIndex ?? 1) || 1));
    this.startDay = this.getConfiguredStartDay(src);
    this.resetFortState();
    return {
      seasonIndex: this.seasonIndex,
      stageIndex: this.stageIndex,
      day: this.startDay,
      completedHordes: this.getCompletedHordesForStart(src),
    };
  },

  resetForMenu() {
    this.endlessMode = true;
    this.fortObjectiveEnabled = false;
    this.seasonIndex = 1;
    this.stageIndex = 1;
    this.startDay = 1;
    this.resetFortState();
  },

  advanceHorde(meta = {}) {
    this.stageIndex = Math.max(1, Number(this.stageIndex || 1)) + 1;
    for (const fn of this._listeners.seasonAdvanced) {
      try { fn({ seasonIndex: this.seasonIndex, stageIndex: this.stageIndex, ...meta }); } catch (_) {}
    }
    return { seasonIndex: this.seasonIndex, stageIndex: this.stageIndex };
  },

  advanceStage() {
    this.stageIndex += 1;
  },

  isBossStage(stageIndex = this.stageIndex, opts = {}) {
    const stagesPerSeason = Math.max(1, Number(opts.stagesPerSeason ?? this.STAGES_PER_SEASON) || 5);
    const stage = Math.max(1, Number(stageIndex ?? this.stageIndex) || 1);
    return stage >= stagesPerSeason;
  },

  applyStartOverride(override = null) {
    const src = override ?? this.START_OVERRIDE ?? {};
    const season = Math.max(1, Math.floor(Number(src.seasonIndex ?? 1) || 1));
    const stage = Math.max(
      1,
      Math.min(this.STAGES_PER_SEASON, Math.floor(Number(src.stageIndex ?? 1) || 1))
    );

    this.seasonIndex = season;
    this.stageIndex = stage;
    this.startDay = this.getConfiguredStartDay(src);

    // Fresh objective state for forced start points.
    this.resetFortState();
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

    if (this.isBossStage(this.stageIndex, { stagesPerSeason })) {
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
    if (!this.fortObjectiveEnabled) return;
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
    if (!this.fortObjectiveEnabled) return false;
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
