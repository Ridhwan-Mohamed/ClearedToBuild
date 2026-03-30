import { CONTROL_STATES, PARCEL, SQUARESIZE, showAlert } from "../constants";
import { Teams } from "../Teams";
import { Player } from "../players/Player";
import { StorageManager } from "../Manager/StorageManager";
import { Manager } from "../Manager/Manager";
import { Scheduler } from "../ai/scheduler/Scheduler";
import { InterruptController } from "../ai/scheduler/InterruptController";
import { Map } from "../map";
import { blockResourceManager } from "../Manager/BlockResourceManager";
import { ORDER_KINDS, isGatherOrder } from "./OrderTypes";
import { StaminaManager } from "../Manager/staminaManager";
import { StageState } from "../parcelController/StageState";
import { buildingManager } from "../Manager/buildingManager";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

export class OrderRunner {
  static nextOrderId = 1;
  static DEFAULT_AREA_RADIUS_TILES = 12;
  static DEFEND_TOWN_RADIUS_TILES = 6;
  static HOLD_RADIUS_TILES = 1;
  static BERRY_HEAL_AMOUNT = 30;
  static SELL_PRICE = {
    Farmer: 50,
    Forager: 45,
    Fireman: 55,
    Builder: 70,
    Gunslinger: 120,
    Blademaster: 130,
    Brawler: 110,
    Default: 30,
  };

  static getSelectionProfile(selection = Player.selected) {
    const troops = (selection || []).filter(troop => troop?.active && troop.body?.team === 1);
    const allForagers = troops.length > 0 && troops.every(troop => troop.isForager);
    const anyForagers = troops.some(troop => troop.isForager);
    const allCombatants = troops.length > 0 && troops.every(troop => this._isCombatTroop(troop));
    const allGunslingers = troops.length > 0 && troops.every(troop => troop?.isGunslinger);
    const allSleepingLike = troops.length > 0 && troops.every(troop =>
      troop?.state === CONTROL_STATES.SLEEP_MODE || troop?.state === CONTROL_STATES.GO_HOME_MODE
    );
    const sellValue = troops.reduce((sum, troop) => sum + this.getTroopSellValue(troop), 0);
    return {
      troops,
      count: troops.length,
      hasSelection: troops.length > 0,
      allForagers,
      anyForagers,
      allCombatants,
      allGunslingers,
      allSleepingLike,
      sellValue,
      hasMixedRoles: troops.length > 0 && !troops.every(troop => troop.isForager === troops[0].isForager),
    };
  }

  static hasPendingGatherPlacement() {
    return false;
  }

  static toggleGatherPlacement(resourceType) {
    return this.issueGatherTypeOrder(Player.selected, resourceType);
  }

  static clearPendingGatherPlacement() {}

  static issuePendingGatherPlacement(troops, worldX, worldY) {
    return false;
  }

  static getGatherContractType(resourceType) {
    if (resourceType === "wood") return "FOREST";
    if (resourceType === "stone") return "ROCK";
    return null;
  }

  static hasActiveGatherParcel(resourceType, scene = Player.scene) {
    const contractType = this.getGatherContractType(resourceType);
    if (!contractType) return false;

    const worldScene = scene?.worldScene ?? scene ?? Player.scene;
    const contracts = worldScene?.parcelManager?.contractsById;
    if (!contracts?.values) return false;

    for (const contract of contracts.values()) {
      if (contract?.type === contractType) return true;
    }
    return false;
  }

  static getGatherParcelMissingMessage(resourceType) {
    if (resourceType === "wood") {
      return "No active forest parcel. Buy a forest parcel first.";
    }
    if (resourceType === "stone") {
      return "No active rock parcel. Buy a rock parcel first.";
    }
    return "No matching resource parcel is active.";
  }

  static issueGatherTypeOrder(troops, resourceType, scene = Player.scene) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.allForagers) return false;
    if (!this.hasActiveGatherParcel(resourceType, scene)) return false;

    const orderId = this._nextId();
    for (const troop of selection.troops) {
      this._replaceTroopOrder(troop, {
        id: orderId,
        kind: ORDER_KINDS.GATHER_TYPE,
        status: "active",
        source: "player",
        resourceType,
        persistent: true,
      });
    }

    for (const troop of selection.troops) {
      this.stepUnit(troop);
    }
    return true;
  }

  static issueGatherAreaOrder(troops, worldX, worldY, resourceType, opts = {}) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.allForagers) return false;

    const orderId = this._nextId();
    for (const troop of selection.troops) {
      this._replaceTroopOrder(troop, {
        id: orderId,
        kind: ORDER_KINDS.GATHER_AREA,
        status: "active",
        source: "player",
        resourceType,
        center: { x: worldX, y: worldY },
        radiusTiles: opts.radiusTiles ?? this.DEFAULT_AREA_RADIUS_TILES,
        persistent: true,
      });
    }

    for (const troop of selection.troops) {
      this.stepUnit(troop);
    }
    return true;
  }

  static issueGatherSetOrder(troops, tasksOrNodes = []) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.allForagers || !tasksOrNodes.length) return false;

    const nodeKeys = [];
    const unique = new Set();
    for (const entry of tasksOrNodes) {
      const task = blockResourceManager.ensureTaskForNode(entry, {
        queue: false,
        teamNumber: 1,
      });
      const key = this._taskKey(task);
      if (!task || !key || unique.has(key)) continue;
      unique.add(key);
      nodeKeys.push(key);
    }
    if (!nodeKeys.length) return false;

    const orderId = this._nextId();
    for (const troop of selection.troops) {
      this._replaceTroopOrder(troop, {
        id: orderId,
        kind: ORDER_KINDS.GATHER_SET,
        status: "active",
        source: "player",
        nodeKeys: [...nodeKeys],
        persistent: true,
      });
    }

    const tasks = this._collectTasksFromKeys(nodeKeys, 1);
    for (const task of tasks) {
      task.directOrderId = orderId;
      task.workerCapacity = task.workerCapacity ?? 1;
    }

    for (const troop of selection.troops) {
      this.stepUnit(troop);
    }
    return true;
  }

  static issueWorkQueuedOrder(troops, teamNumber = 1) {
    const queued = (Teams.teamLists?.[`${teamNumber}`]?.foragerQueue || [])
      .filter(task => task?.forageType === "block" && !task.directOrderId);
    if (!queued.length) return false;
    return this.issueGatherSetOrder(troops, queued);
  }

  static sendTroopsToTown(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.hasSelection) return false;
    this.clearPendingGatherPlacement();

    for (const troop of selection.troops) {
      this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
      Teams.sendTroopToTown(troop);
    }
    return true;
  }

  static cancelOrders(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.hasSelection) return false;
    this.clearPendingGatherPlacement();

    for (const troop of selection.troops) {
      this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
    }
    return true;
  }

  static resumeAuto(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.hasSelection) return false;
    this.clearPendingGatherPlacement();

    for (const troop of selection.troops) {
      this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
      Scheduler.stepUnit(troop);
    }
    return true;
  }

  static toggleSleepTroops(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.hasSelection) return { ok: false, mode: "sleep", changed: 0, failed: 0 };
    this.clearPendingGatherPlacement();

    if (selection.allSleepingLike) {
      let changed = 0;
      for (const troop of selection.troops) {
        this._clearTroopOrder(troop, { interrupt: false, targetState: CONTROL_STATES.TRACK_MODE });
        if (troop.state === CONTROL_STATES.SLEEP_MODE) {
          StaminaManager.wakeUp(troop);
          changed += 1;
          continue;
        }
        if (troop.state === CONTROL_STATES.GO_HOME_MODE) {
          troop.task = null;
          troop.currentPath = [];
          troop.body?.setVelocity?.(0, 0);
          Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
          changed += 1;
        }
      }
      return { ok: changed > 0, mode: "wake", changed, failed: 0 };
    }

    let changed = 0;
    let failed = 0;
    for (const troop of selection.troops) {
      this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
      StaminaManager.sendTroopHome(troop);
      if (troop.state === CONTROL_STATES.GO_HOME_MODE) changed += 1;
      else failed += 1;
    }
    return { ok: changed > 0, mode: "sleep", changed, failed };
  }

  static sellTroops(troops, scene = null) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.hasSelection) return { ok: false, sold: 0, money: 0 };

    const toSell = [...selection.troops];
    const money = toSell.reduce((sum, troop) => sum + this.getTroopSellValue(troop), 0);
    const uiScene = scene ?? Player.scene?.uiScene ?? Player.scene;

    Player.clearSelection?.();
    if (money > 0 && typeof uiScene?.updateMoney === "function") {
      uiScene.updateMoney(money);
    }

    for (const troop of toSell) {
      this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
      Player.destroyPlayer(troop);
    }

    uiScene?.playerTab?.clearDetails?.();
    uiScene?.playerTab?.rebuildList?.();
    return { ok: true, sold: toSell.length, money };
  }

  static disperseBerries(troops, scene = null) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.hasSelection) {
      return { ok: false, reason: "no_selection", required: 0, available: 0 };
    }

    const uiScene = scene ?? Player.scene?.uiScene ?? Player.scene;
    const required = selection.count;
    const available = Number(uiScene?.berries ?? 0);
    if (available < required) {
      return { ok: false, reason: "insufficient", required, available };
    }

    const teamNumber = selection.troops[0]?.body?.team ?? 1;
    const consumed = StorageManager.consumeItemFromStorage(teamNumber, UI_ITEM_TYPES.seedBerry, required);
    if (consumed < required) {
      if (consumed > 0) {
        uiScene?.updateBerry?.(-consumed);
      }
      return {
        ok: false,
        reason: "insufficient",
        required,
        available: Math.max(0, available - consumed),
      };
    }

    uiScene?.updateBerry?.(-consumed);

    for (const troop of selection.troops) {
      troop.health = Math.min(troop.maxHealth ?? troop.health, troop.health + this.BERRY_HEAL_AMOUNT);
      Player.showMiniBarsOnHit?.(troop);
    }

    return {
      ok: true,
      fed: consumed,
      healAmount: this.BERRY_HEAL_AMOUNT,
      required,
      available: Math.max(0, available - consumed),
    };
  }

  static issueDefendTownOrder(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.allCombatants) return false;

    const townCenter = this._getTownCenterWorld(selection.troops[0]?.body?.team ?? 1);
    if (!townCenter) return false;

    const orderId = this._nextId();
    for (const troop of selection.troops) {
      this._replaceTroopOrder(troop, {
        id: orderId,
        kind: ORDER_KINDS.DEFEND_TOWN,
        status: "active",
        source: "player",
        persistent: true,
        anchor: { ...townCenter },
      });
    }

    Player.sendGuardOrder(
      selection.troops,
      townCenter.x,
      townCenter.y,
      this.DEFEND_TOWN_RADIUS_TILES * SQUARESIZE
    );
    return true;
  }

  static issueHoldOrder(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.allGunslingers) return false;

    const orderId = this._nextId();
    for (const troop of selection.troops) {
      this._replaceTroopOrder(troop, {
        id: orderId,
        kind: ORDER_KINDS.HOLD_POSITION,
        status: "active",
        source: "player",
        persistent: true,
        anchor: { x: troop.x, y: troop.y },
      });
      Player.setGuardPost(
        troop,
        troop.x,
        troop.y,
        this.HOLD_RADIUS_TILES * SQUARESIZE
      );
    }
    return true;
  }

  static issueAttackFortOrder(troops) {
    const selection = this.getSelectionProfile(troops);
    if (!selection.allCombatants) return false;

    const teamNumber = selection.troops[0]?.body?.team ?? 1;
    const team = Teams.teamLists?.[`${teamNumber}`];
    if (!team) return false;
    if (!Array.isArray(team.destroyStates)) team.destroyStates = [];

    const eligibleTroopIds = selection.troops.map(troop => troop.id);
    const fortTasks = this._queueFortDestroyTasks(teamNumber, eligibleTroopIds);
    if (!fortTasks.length) return false;

    for (const troop of selection.troops) {
      this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
    }

    buildingManager.assingTroopsToDestroy(teamNumber);
    return true;
  }

  static handleTroopDestroyed(troop) {
    const orderId = troop?.currentOrder?.id;
    if (!orderId) return;
    troop.currentOrder = null;
    this._cleanupOrderReservations(orderId);
  }

  static stepUnit(troop) {
    const order = troop?.currentOrder;
    if (!troop?.active || !order || order.status !== "active") return false;

    if (order.kind === ORDER_KINDS.DEFEND_TOWN) {
      return this._stepDefendTownOrder(troop, order);
    }

    if (order.kind === ORDER_KINDS.HOLD_POSITION) {
      return this._stepHoldOrder(troop, order);
    }

    if (!isGatherOrder(order) || !troop.isForager) return false;

    if (troop.task || troop.timer) return true;

    if (
      troop.state === CONTROL_STATES.GET_BLOCK_RESOURCE ||
      troop.state === CONTROL_STATES.SEND_TO_STORAGE ||
      troop.state === CONTROL_STATES.GET_FROM_STORAGE
    ) {
      return true;
    }

    if (StorageManager.isCarrying(troop)) {
      StorageManager.tryCreateStorageDeliveryTask(troop);
      return true;
    }

    const candidates = this._resolveGatherCandidates(order, troop.body.team);
    if (!candidates.length) {
      if (order.kind === ORDER_KINDS.GATHER_TYPE) {
        if (troop?.active) Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play?.(troop.idle);
        return true;
      }
      this._finishGatherOrder(troop);
      return false;
    }

    const available = candidates
      .filter(task => this._taskAssignedCount(task) < this._taskWorkerCapacity(task))
      .sort((a, b) => {
        const townDelta = this._taskTownPriority(a, troop.body.team) - this._taskTownPriority(b, troop.body.team);
        if (townDelta !== 0) return townDelta;
        return this._taskDistanceToTroop(troop, a) - this._taskDistanceToTroop(troop, b);
      });

    if (!available.length) {
      if (order.kind === ORDER_KINDS.GATHER_TYPE) {
        if (troop?.active) Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
        troop.play?.(troop.idle);
        return true;
      }
      if (this._orderHasBusyTroops(order.id, troop.id)) return true;
      this._finishGatherOrder(troop);
      return false;
    }

    for (const task of available) {
      task.directOrderId = order.id;
      task.workerCapacity = task.workerCapacity ?? 1;
      const assigned = Manager.assignTaskToTroop(troop, task, CONTROL_STATES.GET_BLOCK_RESOURCE);
      if (assigned) return true;
    }

    if (this._orderHasBusyTroops(order.id, troop.id)) return true;
    this._finishGatherOrder(troop);
    return false;
  }

  static _replaceTroopOrder(troop, order) {
    this._clearTroopOrder(troop, { interrupt: true, targetState: CONTROL_STATES.TRACK_MODE });
    troop.currentOrder = order;
    troop.roam = false;
  }

  static getTroopSellValue(troop) {
    const type = this._troopTypeLabel(troop);
    return this.SELL_PRICE[type] ?? this.SELL_PRICE.Default;
  }

  static _clearTroopOrder(troop, { interrupt = false, targetState = CONTROL_STATES.TRACK_MODE } = {}) {
    if (!troop?.active) return;
    const oldOrder = troop.currentOrder;
    const orderId = oldOrder?.id;
    if (interrupt && (troop.task || troop.currentPath?.length || troop.timer || StorageManager.isCarrying(troop))) {
      InterruptController.interruptTroop(troop, "direct_order_clear", targetState);
    }
    troop.currentOrder = null;
    if (oldOrder?.kind === ORDER_KINDS.DEFEND_TOWN || oldOrder?.kind === ORDER_KINDS.HOLD_POSITION) {
      troop.guardCenter = null;
      troop.guardRadius = null;
      troop.forcedTarget = null;
      troop.track = null;
      if (troop.currentPath) troop.currentPath.length = 0;
      troop.body?.setVelocity?.(0, 0);
    }
    if (orderId) this._cleanupOrderReservations(orderId);
  }

  static _finishGatherOrder(troop) {
    const orderId = troop?.currentOrder?.id;
    troop.currentOrder = null;
    troop.roam = false;
    if (troop?.active) {
      Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }
    if (orderId) this._cleanupOrderReservations(orderId);
  }

  static _cleanupOrderReservations(orderId) {
    if (!orderId) return;
    const stillInUse = Player.troops.some(
      troop => troop?.active && troop.currentOrder?.id === orderId
    );
    if (stillInUse) return;

    for (const task of this._allKnownResourceTasks(1)) {
      if (task?.directOrderId !== orderId) continue;
      task.directOrderId = null;

      if (task._ephemeralDirect && this._taskAssignedCount(task) <= 0) {
        task.value?.stopFlash?.();
        if (task.value?.task === task) {
          task.value.task = null;
        }
      }
    }
  }

  static _getTownCenterWorld(teamNumber = 1) {
    const center = Teams.teamLists?.[`${teamNumber}`]?.center;
    if (Array.isArray(center) && center.length >= 2) {
      return {
        x: center[0] * SQUARESIZE + SQUARESIZE / 2,
        y: center[1] * SQUARESIZE + SQUARESIZE / 2,
      };
    }

    const roads = Teams.teamLists?.[`${teamNumber}`]?.roads || [];
    if (roads.length) {
      const [x, y] = roads[0];
      return {
        x: x * SQUARESIZE + SQUARESIZE / 2,
        y: y * SQUARESIZE + SQUARESIZE / 2,
      };
    }
    return null;
  }

  static _stepDefendTownOrder(troop, order) {
    const townCenter = order.anchor || this._getTownCenterWorld(troop.body?.team ?? 1);
    if (!townCenter) return false;

    const threat = this._findDefendTownThreat(troop, townCenter);
    if (threat) {
      return this._trackCombatTarget(troop, threat);
    }

    this._clearCombatTargeting(troop);
    if (!troop.guardCenter) {
      Player.setGuardPost(
        troop,
        townCenter.x,
        townCenter.y,
        this.DEFEND_TOWN_RADIUS_TILES * SQUARESIZE
      );
      return true;
    }

    if (!troop.task && !troop.track && troop.state === CONTROL_STATES.TRACK_MODE && !troop.roam) {
      Player.roam(troop);
    }
    return true;
  }

  static _stepHoldOrder(troop, order) {
    const anchor = order.anchor || troop.guardCenter || { x: troop.x, y: troop.y };
    const threat = this._findHoldThreat(troop, anchor);
    if (threat) {
      return this._trackCombatTarget(troop, threat);
    }

    this._clearCombatTargeting(troop);
    if (!troop.guardCenter) {
      Player.setGuardPost(
        troop,
        anchor.x,
        anchor.y,
        this.HOLD_RADIUS_TILES * SQUARESIZE
      );
      return true;
    }

    if (!troop.task && !troop.track && troop.state === CONTROL_STATES.TRACK_MODE && !troop.roam) {
      Player.roam(troop);
    }
    return true;
  }

  static _findDefendTownThreat(troop, townCenter) {
    const regionSystem = Map.regionSystem;
    const enemies = Teams.teamLists?.["0"]?.playerList || [];
    const mainIsland = {
      minx: PARCEL.MAIN_ORIGIN.x,
      miny: PARCEL.MAIN_ORIGIN.y,
      maxx: PARCEL.MAIN_ORIGIN.x + PARCEL.SIZE - 1,
      maxy: PARCEL.MAIN_ORIGIN.y + PARCEL.SIZE - 1,
    };
    const isOnPlayerIsland = (enemy) => {
      if (!enemy?.active) return false;
      const gx = Math.floor(enemy.x / SQUARESIZE);
      const gy = Math.floor(enemy.y / SQUARESIZE);
      return (
        gx >= mainIsland.minx &&
        gx <= mainIsland.maxx &&
        gy >= mainIsland.miny &&
        gy <= mainIsland.maxy
      );
    };
    const canReachTown = (enemy) => {
      if (!enemy?.active) return false;
      if (!enemy.body || enemy.body.team === troop.body?.team) return false;
      if (!regionSystem?.canReachWorldToWorld) return true;
      return regionSystem.canReachWorldToWorld(townCenter.x, townCenter.y, enemy.x, enemy.y);
    };

    return enemies
      .filter(enemy => isOnPlayerIsland(enemy) && canReachTown(enemy))
      .sort((a, b) => {
        const priorityDelta = this._combatThreatPriority(a) - this._combatThreatPriority(b);
        if (priorityDelta !== 0) return priorityDelta;
        const townDistA = Phaser.Math.Distance.Between(townCenter.x, townCenter.y, a.x, a.y);
        const townDistB = Phaser.Math.Distance.Between(townCenter.x, townCenter.y, b.x, b.y);
        if (townDistA !== townDistB) return townDistA - townDistB;
        return Phaser.Math.Distance.Between(troop.x, troop.y, a.x, a.y) -
          Phaser.Math.Distance.Between(troop.x, troop.y, b.x, b.y);
      })[0] ?? null;
  }

  static _findHoldThreat(troop, anchor) {
    const maxRange = Math.max(
      Number(troop?.weapon?.range || 0),
      this.HOLD_RADIUS_TILES * SQUARESIZE * 2
    );
    const enemies = Teams.teamLists?.["0"]?.playerList || [];
    return enemies
      .filter(enemy => enemy?.active)
      .filter(enemy => Phaser.Math.Distance.Between(anchor.x, anchor.y, enemy.x, enemy.y) <= maxRange)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(anchor.x, anchor.y, a.x, a.y) -
        Phaser.Math.Distance.Between(anchor.x, anchor.y, b.x, b.y)
      )[0] ?? null;
  }

  static _combatThreatPriority(enemy) {
    const breakingTown =
      enemy?.state === CONTROL_STATES.DESTROY_MODE ||
      enemy?.state === CONTROL_STATES.DESTROY_MODE_T ||
      enemy?.state === CONTROL_STATES.SIEGE_MODE;
    return breakingTown ? 0 : 1;
  }

  static _trackCombatTarget(troop, target) {
    if (!troop?.active || !target?.active) return false;
    const targetBody = target.body;
    if (!targetBody) return false;

    troop.forcedTarget = target;
    troop.roam = false;

    const movedTile = Player._syncTrackToTarget(troop, target);
    if (troop.state !== CONTROL_STATES.ATTACK_MODE) {
      Teams.movePlayerState(troop, CONTROL_STATES.TRACK_TARGET);
    }

    if (Player._isAttackReady?.(troop, target)) {
      troop.currentPath?.splice?.(0);
      troop.body?.setVelocity?.(0, 0);
      return true;
    }

    if (troop.isGunslinger) {
      const kiteDest = Player.computeKiteDestination?.(troop, target, troop.weapon);
      if (kiteDest) {
        const kitePath = Player.pathTo(troop, kiteDest.x, kiteDest.y, false);
        if (kitePath?.length) {
          Player.moveTo(troop, kitePath);
          return true;
        }
      }
    }

    Player._chaseOrBreachTarget?.(troop, target, movedTile || !troop.currentPath?.length);
    return true;
  }

  static _clearCombatTargeting(troop) {
    troop.forcedTarget = null;
    troop.track = null;
    if (troop.currentPath) troop.currentPath.length = 0;
    troop.body?.setVelocity?.(0, 0);
    if (troop.state === CONTROL_STATES.TRACK_TARGET) {
      Teams.movePlayerState(troop, CONTROL_STATES.TRACK_MODE);
    }
  }

  static _queueFortDestroyTasks(teamNumber, eligibleTroopIds = []) {
    const towers = [...(StageState?._fortTowers || [])]
      .filter(tower => tower?.sprite?.active && !tower?.sprite?._destroyed);
    const queued = [];

    for (const tower of towers) {
      const existing = Teams.teamLists?.[`${teamNumber}`]?.destroyStates?.find(task =>
        task?.x === tower.x &&
        task?.y === tower.y &&
        task?.value === tower.sprite
      );

      if (existing) {
        if (eligibleTroopIds.length) {
          existing.eligibleTroopIds = [...new Set([...(existing.eligibleTroopIds || []), ...eligibleTroopIds])];
        }
        queued.push(existing);
        continue;
      }

      const task = {
        x: tower.x,
        y: tower.y,
        duration: tower.health ?? tower.maxHealth ?? 600,
        totalDuration: tower.maxHealth ?? tower.health ?? 600,
        type: tower.tileType,
        value: tower.sprite,
        assigned: 0,
        eligibleTroopIds: [...eligibleTroopIds],
      };
      Teams.addToStateArrayIfNotExists(teamNumber, "destroyStates", task);
      queued.push(task);
    }

    return queued;
  }

  static _resolveGatherCandidates(order, teamNumber) {
    if (!isGatherOrder(order)) return [];

    if (order.kind === ORDER_KINDS.GATHER_TYPE) {
      return this._collectTasksForResourceType(order.resourceType, teamNumber).filter(task => this._taskUsable(task));
    }

    if (order.kind === ORDER_KINDS.GATHER_SET) {
      return this._collectTasksFromKeys(order.nodeKeys || [], teamNumber).filter(task => this._taskUsable(task));
    }

    const nodes = this._nodesForArea(order);
    const tasks = [];
    for (const node of nodes) {
      const task = blockResourceManager.ensureTaskForNode(node, {
        queue: false,
        teamNumber,
        directOrderId: order.id,
      });
      if (!task) continue;
      tasks.push(task);
    }
    return tasks.filter(task => this._taskUsable(task));
  }

  static _collectTasksForResourceType(resourceType, teamNumber) {
    const nodes = resourceType === "wood" ? (Map.worldPines || []) : (Map.worldStones || []);
    const tasks = [];
    for (const node of nodes) {
      if (!this._nodeActive(node)) continue;
      if (resourceType && this._nodeResourceKind(node) !== resourceType) continue;
      const task = blockResourceManager.ensureTaskForNode(node, {
        queue: false,
        teamNumber,
      });
      if (task) tasks.push(task);
    }
    return tasks;
  }

  static _collectTasksFromKeys(nodeKeys, teamNumber) {
    const desired = new Set(nodeKeys);
    const tasks = [];
    for (const task of this._allKnownResourceTasks(teamNumber)) {
      const key = this._taskKey(task);
      if (!desired.has(key)) continue;
      tasks.push(task);
    }

    if (tasks.length === desired.size) return tasks;

    const nodes = this._allResourceNodes();
    for (const node of nodes) {
      const key = this._nodeKey(node);
      if (!desired.has(key)) continue;
      const task = blockResourceManager.ensureTaskForNode(node, {
        queue: false,
        teamNumber,
      });
      if (task && !tasks.includes(task)) tasks.push(task);
    }
    return tasks;
  }

  static _nodesForArea(order) {
    const nodes = order.resourceType === "wood" ? (Map.worldPines || []) : (Map.worldStones || []);
    const radiusPx = (order.radiusTiles ?? this.DEFAULT_AREA_RADIUS_TILES) * SQUARESIZE;
    const radiusSq = radiusPx * radiusPx;
    const center = order.center || { x: 0, y: 0 };

    return nodes.filter(node => {
      if (!this._nodeActive(node)) return false;
      if (order.resourceType && this._nodeResourceKind(node) !== order.resourceType) return false;
      const { x, y } = this._nodeWorldCenter(node);
      const dx = x - center.x;
      const dy = y - center.y;
      return (dx * dx + dy * dy) <= radiusSq;
    });
  }

  static _allKnownResourceTasks(teamNumber) {
    const tasks = [];
    const seen = new Set();

    for (const queued of Teams.teamLists?.[`${teamNumber}`]?.foragerQueue || []) {
      if (queued?.forageType !== "block") continue;
      if (seen.has(queued)) continue;
      seen.add(queued);
      tasks.push(queued);
    }

    for (const node of this._allResourceNodes()) {
      const task = node?.task;
      if (!task || seen.has(task)) continue;
      seen.add(task);
      tasks.push(task);
    }

    return tasks;
  }

  static _allResourceNodes() {
    return [...(Map.worldPines || []), ...(Map.worldStones || [])];
  }

  static _orderHasBusyTroops(orderId, excludeTroopId = null) {
    return Player.troops.some(troop => {
      if (!troop?.active || troop.id === excludeTroopId) return false;
      if (troop.currentOrder?.id !== orderId) return false;
      return !!(
        troop.task ||
        troop.timer ||
        StorageManager.isCarrying(troop) ||
        troop.currentPath?.length ||
        troop.state === CONTROL_STATES.GET_BLOCK_RESOURCE ||
        troop.state === CONTROL_STATES.SEND_TO_STORAGE ||
        troop.state === CONTROL_STATES.GET_FROM_STORAGE
      );
    });
  }

  static _taskUsable(task) {
    if (!task || task.forageType !== "block") return false;
    if (!task.value) return false;
    if (typeof task.remaining === "number" && task.remaining <= 0) return false;
    if (!this._nodeActive(task.value)) return false;
    return true;
  }

  static _taskDistanceToTroop(troop, task) {
    const { x, y } = this._taskWorldCenter(task);
    return Math.hypot(troop.x - x, troop.y - y);
  }

  static _taskTownPriority(task, teamNumber) {
    const team = Teams.teamLists?.[`${teamNumber}`];
    const center = team?.center;
    if (!Array.isArray(center) || center.length < 2) return 0;
    return Math.hypot((task.x ?? 0) - center[0], (task.y ?? 0) - center[1]);
  }

  static _taskWorldCenter(task) {
    if (task?.value) return this._nodeWorldCenter(task.value);
    return {
      x: (task.x + 0.5) * SQUARESIZE,
      y: (task.y + 0.5) * SQUARESIZE,
    };
  }

  static _taskAssignedCount(task) {
    return Number(task?.assigned || 0);
  }

  static _taskWorkerCapacity(task) {
    return Math.max(1, Number(task?.workerCapacity || 1));
  }

  static _isCombatTroop(troop) {
    return !!(troop?.isBrawler || troop?.isBlademaster || troop?.isGunslinger);
  }

  static _troopTypeLabel(troop) {
    if (troop?.isFarmer) return "Farmer";
    if (troop?.isForager) return "Forager";
    if (troop?.isFireman) return "Fireman";
    if (troop?.isBuilder) return "Builder";
    if (troop?.isGunslinger) return "Gunslinger";
    if (troop?.isBlademaster) return "Blademaster";
    if (troop?.isBrawler) return "Brawler";
    return "Default";
  }

  static _nodeActive(node) {
    if (!node) return false;
    if (node.active === false) return false;
    if (node.sprite && node.sprite.active === false) return false;
    if (node.container && node.container.active === false) return false;
    return true;
  }

  static _nodeWorldCenter(node) {
    if (Number.isFinite(node?.x) && Number.isFinite(node?.y)) {
      return { x: node.x, y: node.y };
    }
    if (Number.isFinite(node?.sprite?.x) && Number.isFinite(node?.sprite?.y)) {
      return { x: node.sprite.x, y: node.sprite.y };
    }
    if (Number.isFinite(node?.container?.x) && Number.isFinite(node?.container?.y)) {
      return { x: node.container.x, y: node.container.y };
    }
    const gx = Number(node?.gridX ?? node?.x ?? 0);
    const gy = Number(node?.gridY ?? node?.y ?? 0);
    const lenX = Number(node?.lenX ?? 1);
    const lenY = Number(node?.lenY ?? 1);
    return {
      x: (gx + lenX / 2) * SQUARESIZE,
      y: (gy + lenY / 2) * SQUARESIZE,
    };
  }

  static _nodeResourceKind(node) {
    if (node?.resourceKind) return node.resourceKind;
    if (node?.resourceTileType?.name === "pine") return "wood";
    if (node?.resourceTileType?.name === "rock") return "stone";
    if (node?.task?.type?.name === "pine") return "wood";
    if (node?.task?.type?.name === "rock") return "stone";
    return null;
  }

  static _taskKey(task) {
    if (!task) return null;
    const kind = task.type?.name === "pine" ? "wood" : task.type?.name === "rock" ? "stone" : this._nodeResourceKind(task.value);
    return `${kind || "resource"}:${task.x},${task.y}`;
  }

  static _nodeKey(node) {
    if (!node) return null;
    const gx = node.gridX ?? node.x ?? node.task?.x;
    const gy = node.gridY ?? node.y ?? node.task?.y;
    const kind = this._nodeResourceKind(node);
    if (!Number.isFinite(gx) || !Number.isFinite(gy) || !kind) return null;
    return `${kind}:${gx},${gy}`;
  }

  static _nextId() {
    return `gather_${this.nextOrderId++}`;
  }
}
