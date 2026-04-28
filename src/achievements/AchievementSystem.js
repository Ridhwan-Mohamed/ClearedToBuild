import { Teams } from "../Teams.js";
import { SaveManager } from "../save/SaveManager.js";

const TEAM_ID = "1";
const SLOT_ORDER = ["build", "economy", "combat"];

const SLOT_META = Object.freeze({
  build: {
    label: "Town",
    accent: 0x7dd3fc,
    fill: 0x10283a,
    stroke: 0x89d6ff,
  },
  economy: {
    label: "Supply",
    accent: 0xf9c74f,
    fill: 0x3b2a10,
    stroke: 0xf6d281,
  },
  combat: {
    label: "Defense",
    accent: 0xf87171,
    fill: 0x3a1717,
    stroke: 0xf6a3a3,
  },
});

function clonePlain(value, fallback) {
  if (value == null) return fallback;
  try {
    return structuredClone(value);
  } catch {
    return fallback;
  }
}

function asPositiveInt(value, fallback = 0) {
  const normalized = Math.max(0, Math.floor(Number(value) || 0));
  return Number.isFinite(normalized) ? normalized : fallback;
}

function rewardText(reward = {}) {
  const parts = [];
  if ((reward.xp || 0) > 0) parts.push(`+${reward.xp} XP`);
  if ((reward.money || 0) > 0) parts.push(`+$${reward.money}`);
  if ((reward.permits || 0) > 0) parts.push(`+${reward.permits} permit${reward.permits === 1 ? "" : "s"}`);
  if ((reward.seeds || 0) > 0) parts.push(`+${reward.seeds} seeds`);
  if ((reward.wood || 0) > 0) parts.push(`+${reward.wood} wood`);
  if ((reward.stone || 0) > 0) parts.push(`+${reward.stone} stone`);
  if ((reward.food || 0) > 0) parts.push(`+${reward.food} food`);
  if ((reward.cleanWater || 0) > 0) parts.push(`+${reward.cleanWater} water`);
  return parts.join("  ");
}

export class AchievementSystem {
  constructor(scene) {
    this.scene = scene;
    this.stats = this.createDefaultStats();
    this.state = this.createDefaultState();
    this._lastBoardSignature = "";
  }

  createDefaultStats() {
    return {
      cropsHarvested: 0,
      raidersKilled: 0,
    };
  }

  createDefaultState() {
    return {
      serial: 0,
      nextInstanceId: 1,
      activeGoals: [],
      completedKeys: [],
    };
  }

  getSlotMeta(slot) {
    return SLOT_META[slot] || SLOT_META.build;
  }

  getSaveSnapshot() {
    return {
      stats: clonePlain(this.stats, this.createDefaultStats()),
      state: {
        serial: asPositiveInt(this.state?.serial, 0),
        nextInstanceId: Math.max(1, asPositiveInt(this.state?.nextInstanceId, 1)),
        activeGoals: clonePlain(this.state?.activeGoals, []),
        completedKeys: Array.from(this.state?.completedKeys || []),
      },
    };
  }

  restoreSnapshot(snapshot = null) {
    const defaults = this.createDefaultState();
    this.stats = {
      ...this.createDefaultStats(),
      ...(clonePlain(snapshot?.stats, {}) || {}),
    };

    const savedState = clonePlain(snapshot?.state, {}) || {};
    this.state = {
      ...defaults,
      ...savedState,
      serial: asPositiveInt(savedState.serial, defaults.serial),
      nextInstanceId: Math.max(1, asPositiveInt(savedState.nextInstanceId, defaults.nextInstanceId)),
      activeGoals: Array.isArray(savedState.activeGoals) ? savedState.activeGoals : [],
      completedKeys: Array.isArray(savedState.completedKeys) ? savedState.completedKeys : [],
    };

    this._lastBoardSignature = "";
    this.update(true);
  }

  addStat(key, amount = 1) {
    if (!key) return 0;
    const normalized = asPositiveInt(amount, 0);
    if (!(normalized > 0)) return this.stats?.[key] || 0;
    this.stats[key] = asPositiveInt(this.stats?.[key], 0) + normalized;
    return this.stats[key];
  }

  getMetricValue(metric) {
    const team = Teams.teamLists?.[TEAM_ID] || {};
    const activeCount = (list) => (Array.isArray(list) ? list.filter((entry) => entry?.active !== false && entry?.sprite?.active !== false).length : 0);

    switch (metric) {
      case "houses":
        return activeCount(team.houseList);
      case "storages":
        return activeCount(team.storageList);
      case "ovens":
        return activeCount(team.ovenList);
      case "fighters":
        return activeCount(team.fighterList);
      case "players":
        return activeCount(team.playerList);
      case "homeless":
        return Math.max(0, Number(Teams.getHousingStatus?.(TEAM_ID)?.homelessCount || 0));
      case "wood":
        return Math.max(0, Number(this.scene?.woodAmnt || 0));
      case "stone":
        return Math.max(0, Number(this.scene?.stoneAmnt || 0));
      case "seeds":
        return Math.max(0, Number(this.scene?.seeds || 0));
      case "cropsHarvested":
        return asPositiveInt(this.stats?.cropsHarvested, 0);
      case "raidersKilled":
        return asPositiveInt(this.stats?.raidersKilled, 0);
      case "parcelsClaimed":
        return asPositiveInt(this.scene?._runStats?.parcelsClaimed, 0);
      case "nightsSurvived":
        return asPositiveInt(this.scene?._runStats?.nightsSurvived, 0);
      default:
        return 0;
    }
  }

  getProgress(goal) {
    if (!goal) return { value: 0, target: 1, ratio: 0, done: false };

    const currentValue = this.getMetricValue(goal.metric);
    const baseline = asPositiveInt(goal.baseline, 0);
    const target = Math.max(1, asPositiveInt(goal.target, 1));
    const value = goal.mode === "delta"
      ? Math.max(0, currentValue - baseline)
      : Math.max(0, currentValue);
    const ratio = Math.max(0, Math.min(1, value / target));
    return {
      value,
      target,
      ratio,
      done: value >= target,
    };
  }

  _snapshotGoal(goal) {
    if (!goal) return null;
    const progress = this.getProgress(goal);
    const slotMeta = this.getSlotMeta(goal.slot);
    return {
      ...clonePlain(goal, goal),
      progressValue: progress.value,
      progressTarget: progress.target,
      progressRatio: progress.ratio,
      complete: progress.done,
      rewardText: rewardText(goal.reward),
      slotLabel: slotMeta.label,
      accent: slotMeta.accent,
      fill: slotMeta.fill,
      stroke: slotMeta.stroke,
    };
  }

  getBoardSnapshot() {
    const activeGoals = SLOT_ORDER
      .map((slot) => {
        const goal = (this.state?.activeGoals || []).find((entry) => entry?.slot === slot) || null;
        return this._snapshotGoal(goal);
      })
      .filter(Boolean);

    return {
      serial: asPositiveInt(this.state?.serial, 0),
      totalCompleted: Array.isArray(this.state?.completedKeys) ? this.state.completedKeys.length : 0,
      activeGoals,
    };
  }

  _buildBoardSignature() {
    const snapshot = this.getBoardSnapshot();
    return JSON.stringify({
      serial: snapshot.serial,
      completed: snapshot.totalCompleted,
      goals: snapshot.activeGoals.map((goal) => ({
        id: goal.instanceId,
        value: goal.progressValue,
        target: goal.progressTarget,
        complete: goal.complete,
      })),
    });
  }

  _emitChanged(force = false) {
    const signature = this._buildBoardSignature();
    if (!force && signature === this._lastBoardSignature) return false;
    this._lastBoardSignature = signature;
    this.scene?.events?.emit?.("achievements:changed", this.getBoardSnapshot());
    return true;
  }

  _markCompleted(goal) {
    if (!goal?.uniqueKey || goal.repeatable) return;
    const completed = Array.isArray(this.state.completedKeys) ? this.state.completedKeys : (this.state.completedKeys = []);
    if (!completed.includes(goal.uniqueKey)) {
      completed.push(goal.uniqueKey);
    }
  }

  _rewardGoal(goal) {
    const reward = goal?.reward || {};
    if ((reward.xp || 0) > 0) {
      this.scene?.addTownXp?.(reward.xp, goal.title);
    }

    const resourceBundle = {
      money: asPositiveInt(reward.money, 0),
      permits: asPositiveInt(reward.permits, 0),
      seeds: asPositiveInt(reward.seeds, 0),
      wood: asPositiveInt(reward.wood, 0),
      stone: asPositiveInt(reward.stone, 0),
      food: asPositiveInt(reward.food, 0),
      cleanWater: asPositiveInt(reward.cleanWater, 0),
    };

    const hasBundle = Object.values(resourceBundle).some((value) => value > 0);
    if (hasBundle) {
      this.scene?._grantTownXpResources?.(resourceBundle);
    }
  }

  _buildGoal(slot, config = {}) {
    const id = Math.max(1, asPositiveInt(this.state?.nextInstanceId, 1));
    this.state.nextInstanceId = id + 1;
    return {
      instanceId: `achv_${id}`,
      slot,
      uniqueKey: config.uniqueKey || `${slot}_${id}`,
      repeatable: !!config.repeatable,
      title: String(config.title || "Town Goal"),
      description: String(config.description || ""),
      metric: String(config.metric || "houses"),
      mode: config.mode === "delta" ? "delta" : "threshold",
      target: Math.max(1, asPositiveInt(config.target, 1)),
      baseline: Math.max(0, asPositiveInt(config.baseline, 0)),
      reward: clonePlain(config.reward, {}) || {},
    };
  }

  _isGoalUnavailable(candidate) {
    if (!candidate) return true;
    const activeGoals = Array.isArray(this.state?.activeGoals) ? this.state.activeGoals : [];
    if (activeGoals.some((goal) => goal?.uniqueKey === candidate.uniqueKey)) return true;
    if (!candidate.repeatable && Array.isArray(this.state?.completedKeys) && this.state.completedKeys.includes(candidate.uniqueKey)) {
      return true;
    }
    return false;
  }

  _getBuildCandidates() {
    const houses = this.getMetricValue("houses");
    const storages = this.getMetricValue("storages");
    const ovens = this.getMetricValue("ovens");
    const fighters = this.getMetricValue("fighters");
    const candidates = [];

    if (houses < 1) {
      candidates.push(this._buildGoal("build", {
        uniqueKey: "build_house_total_1",
        title: "Raise Shelter",
        description: "Build a house for the town.",
        metric: "houses",
        target: 1,
        reward: { xp: 12, money: 40 },
      }));
    }
    if (storages < 1) {
      candidates.push(this._buildGoal("build", {
        uniqueKey: "build_storage_total_1",
        title: "Lay In Supplies",
        description: "Build a storage so workers can stash goods.",
        metric: "storages",
        target: 1,
        reward: { xp: 12, money: 35 },
      }));
    }
    if (ovens < 1) {
      candidates.push(this._buildGoal("build", {
        uniqueKey: "build_oven_total_1",
        title: "Fire It Up",
        description: "Build a clay oven for cooked food.",
        metric: "ovens",
        target: 1,
        reward: { xp: 14, money: 50 },
      }));
    }
    if (fighters < 1) {
      candidates.push(this._buildGoal("build", {
        uniqueKey: "build_fighter_total_1",
        title: "Train A Defender",
        description: "Have 1 fighter standing guard.",
        metric: "fighters",
        target: 1,
        reward: { xp: 16, money: 50 },
      }));
    }
    if (houses < 3) {
      candidates.push(this._buildGoal("build", {
        uniqueKey: "build_house_total_3",
        title: "Growing Village",
        description: "Reach 3 houses in town.",
        metric: "houses",
        target: 3,
        reward: { xp: 24, permits: 1 },
      }));
    }
    if (fighters < 3) {
      candidates.push(this._buildGoal("build", {
        uniqueKey: "build_fighter_total_3",
        title: "Standing Army",
        description: "Have 3 fighters ready at once.",
        metric: "fighters",
        target: 3,
        reward: { xp: 30, money: 90 },
      }));
    }
    const fallbackHouseTarget = houses + 1;
    candidates.push(this._buildGoal("build", {
      uniqueKey: `build_house_total_dynamic_${fallbackHouseTarget}`,
      title: "Raise Another Roof",
      description: `Reach ${fallbackHouseTarget} houses in town.`,
      metric: "houses",
      target: fallbackHouseTarget,
      reward: { xp: 18, money: 55 },
      repeatable: true,
    }));

    return candidates;
  }

  _getEconomyCandidates() {
    const cropsHarvested = this.getMetricValue("cropsHarvested");
    const wood = this.getMetricValue("wood");
    const stone = this.getMetricValue("stone");
    const seeds = this.getMetricValue("seeds");

    const candidates = [];

    if (cropsHarvested < 8) {
      candidates.push(this._buildGoal("economy", {
        uniqueKey: "econ_harvest_delta_8",
        title: "First Yield",
        description: "Harvest 8 crops after this goal appears.",
        metric: "cropsHarvested",
        mode: "delta",
        baseline: cropsHarvested,
        target: 8,
        reward: { xp: 10, seeds: 4 },
      }));
    }
    if (cropsHarvested < 24) {
      candidates.push(this._buildGoal("economy", {
        uniqueKey: "econ_harvest_delta_16",
        title: "Fieldwork",
        description: "Harvest 16 crops after this goal appears.",
        metric: "cropsHarvested",
        mode: "delta",
        baseline: cropsHarvested,
        target: 16,
        reward: { xp: 18, seeds: 6, money: 40 },
      }));
    }
    if (wood < 12) {
      candidates.push(this._buildGoal("economy", {
        uniqueKey: "econ_stock_wood_12",
        title: "Stock The Yard",
        description: "Reach 12 wood in storage or hand.",
        metric: "wood",
        target: 12,
        reward: { xp: 14, money: 35 },
      }));
    }
    if (stone < 10) {
      candidates.push(this._buildGoal("economy", {
        uniqueKey: "econ_stock_stone_10",
        title: "Stone Reserve",
        description: "Reach 10 stone for future builds.",
        metric: "stone",
        target: 10,
        reward: { xp: 14, money: 35 },
      }));
    }
    if (seeds < 18) {
      candidates.push(this._buildGoal("economy", {
        uniqueKey: "econ_stock_seeds_18",
        title: "Seed Basket",
        description: "Reach 18 seeds to keep fields moving.",
        metric: "seeds",
        target: 18,
        reward: { xp: 12, money: 25 },
      }));
    }

    candidates.push(this._buildGoal("economy", {
      uniqueKey: `econ_harvest_delta_repeat_${cropsHarvested}`,
      title: "Bushel Run",
      description: "Harvest 12 crops after this goal appears.",
      metric: "cropsHarvested",
      mode: "delta",
      baseline: cropsHarvested,
      target: 12,
      reward: { xp: 16, seeds: 5, money: 30 },
      repeatable: true,
    }));

    return candidates;
  }

  _getCombatCandidates() {
    const parcelsClaimed = this.getMetricValue("parcelsClaimed");
    const raidersKilled = this.getMetricValue("raidersKilled");
    const nightsSurvived = this.getMetricValue("nightsSurvived");

    const candidates = [];

    if (parcelsClaimed < 1) {
      candidates.push(this._buildGoal("combat", {
        uniqueKey: "combat_parcels_delta_1",
        title: "Open New Ground",
        description: "Claim 1 parcel after this goal appears.",
        metric: "parcelsClaimed",
        mode: "delta",
        baseline: parcelsClaimed,
        target: 1,
        reward: { xp: 20, money: 60 },
      }));
    }
    if (raidersKilled < 5) {
      candidates.push(this._buildGoal("combat", {
        uniqueKey: "combat_raiders_delta_5",
        title: "Thin The Raiders",
        description: "Defeat 5 raiders after this goal appears.",
        metric: "raidersKilled",
        mode: "delta",
        baseline: raidersKilled,
        target: 5,
        reward: { xp: 20, money: 70 },
      }));
    }
    if (parcelsClaimed < 3) {
      candidates.push(this._buildGoal("combat", {
        uniqueKey: "combat_parcels_delta_2",
        title: "Push The Frontier",
        description: "Claim 2 more parcels after this goal appears.",
        metric: "parcelsClaimed",
        mode: "delta",
        baseline: parcelsClaimed,
        target: 2,
        reward: { xp: 26, permits: 1 },
      }));
    }
    if (nightsSurvived < 1) {
      candidates.push(this._buildGoal("combat", {
        uniqueKey: "combat_horde_delta_1",
        title: "Hold Through Nightfall",
        description: "Survive the next horde.",
        metric: "nightsSurvived",
        mode: "delta",
        baseline: nightsSurvived,
        target: 1,
        reward: { xp: 32, money: 90 },
      }));
    }

    candidates.push(this._buildGoal("combat", {
      uniqueKey: `combat_raiders_delta_repeat_${raidersKilled}`,
      title: "Keep The Coast Clear",
      description: "Defeat 6 raiders after this goal appears.",
      metric: "raidersKilled",
      mode: "delta",
      baseline: raidersKilled,
      target: 6,
      reward: { xp: 18, money: 60 },
      repeatable: true,
    }));

    candidates.push(this._buildGoal("combat", {
      uniqueKey: `combat_parcels_delta_repeat_${parcelsClaimed}`,
      title: "Claim Another Parcel",
      description: "Claim 1 parcel after this goal appears.",
      metric: "parcelsClaimed",
      mode: "delta",
      baseline: parcelsClaimed,
      target: 1,
      reward: { xp: 18, money: 55 },
      repeatable: true,
    }));

    return candidates;
  }

  _getCandidatesForSlot(slot) {
    if (slot === "build") return this._getBuildCandidates();
    if (slot === "economy") return this._getEconomyCandidates();
    return this._getCombatCandidates();
  }

  _selectGoalForSlot(slot) {
    const candidates = this._getCandidatesForSlot(slot);
    for (const candidate of candidates) {
      if (this._isGoalUnavailable(candidate)) continue;
      return candidate;
    }
    return null;
  }

  _ensureActiveSlots() {
    let changed = false;
    if (!Array.isArray(this.state.activeGoals)) {
      this.state.activeGoals = [];
      changed = true;
    }

    for (const slot of SLOT_ORDER) {
      const alreadyActive = this.state.activeGoals.find((goal) => goal?.slot === slot);
      if (alreadyActive) continue;
      const nextGoal = this._selectGoalForSlot(slot);
      if (!nextGoal) continue;
      this.state.activeGoals.push(nextGoal);
      changed = true;
    }

    return changed;
  }

  _isGoalComplete(goal) {
    if (!goal) return false;
    return this.getProgress(goal).done;
  }

  _completeGoal(goal) {
    if (!goal) return false;
    const completedSnapshot = this._snapshotGoal(goal);
    this._markCompleted(goal);
    this._rewardGoal(goal);
    this.state.serial = asPositiveInt(this.state?.serial, 0) + 1;
    this.state.activeGoals = (this.state.activeGoals || []).filter((entry) => entry !== goal);

    const replacement = this._selectGoalForSlot(goal.slot);
    if (replacement) {
      this.state.activeGoals.push(replacement);
    }

    this.scene?.events?.emit?.("achievement:completed", {
      completed: completedSnapshot,
      replacement: this._snapshotGoal(replacement),
    });

    SaveManager.queueAutosave("achievement_complete");
    return true;
  }

  update(force = false) {
    let changed = this._ensureActiveSlots();
    let safety = 0;

    while (safety < 9) {
      const nextCompleted = (this.state.activeGoals || []).find((goal) => this._isGoalComplete(goal));
      if (!nextCompleted) break;
      this._completeGoal(nextCompleted);
      changed = true;
      safety += 1;
    }

    return this._emitChanged(force || changed) || changed;
  }
}
