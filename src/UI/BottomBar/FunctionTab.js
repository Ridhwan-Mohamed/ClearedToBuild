import Phaser from "phaser";
import { CONTROL_STATES, showAlert } from "../../constants";
import { Teams } from "../../Teams";
import { StorageManager } from "../../Manager/StorageManager";
import { OrderRunner } from "../../orders/OrderRunner";
import { ORDER_KINDS } from "../../orders/OrderTypes";
import { InterruptController } from "../../ai/scheduler/InterruptController";
import { AudioManager } from "../../Manager/AudioManager.js";
import { BOTTOM_BAR_THEME, mixColor } from "./BottomBarTheme";

const FUNCTION_TAB_SOURCE = "function_tab";
const CONTENT_PADDING_X = 14;
const CONTENT_PADDING_TOP = 0;
const CONTENT_PADDING_BOTTOM = 0;
const MAIN_BUTTON_GAP = 8;
const CARD_GAP = 8;
const MAIN_BUTTON_HEIGHT = 44;
const GATHER_CARD_HEIGHT = 58;
const MINI_BUTTON_SIZE = 22;
const GATHER_MAX_TARGET = 9;
const REST_BUTTON_GAP = 8;
const REST_BUTTON_HEIGHT = 34;

const REST_GROUPS = [
  { key: "workers", label: "WORKERS", color: 0x5b21b6 },
  { key: "fighters", label: "FIGHTERS", color: 0x7c2d12 },
  { key: "idle", label: "IDLE", color: 0x4338ca },
  { key: "all", label: "ALL TROOPS", color: 0x581c87 },
];

const MODE_KEYS = ["Farm", "Attack", "Destroy"];
const MODE_COLORS = {
  Farm: 0xd28d58,
  Attack: 0xff8a7d,
  Destroy: 0xff6a87,
};

const TOGGLE_COLORS = {
  water: 0x74cbff,
  gather: 0xffcb79,
};

const GATHER_RESOURCES = [
  { key: "wood", label: "WOOD", color: 0x166534, text: "#86efac" },
  { key: "stone", label: "STONE", color: 0x475569, text: "#cbd5e1" },
  { key: "seed", label: "SEEDS", color: 0x92400e, text: "#fde68a" },
  { key: "berry", label: "BERRIES", color: 0x7c3aed, text: "#e9d5ff" },
];

export default class FunctionTab {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    this.teamNumber = 1;
    this.width = width;
    this.height = height;
    this.activeMode = null;
    this._syncIntervalMs = 140;
    this._lastAutomationSyncAt = 0;

    this._onModeCompleted = (mode) => {
      if (!mode) return;

      if (mode === "Farm") this.scene.farmMode = false;
      if (mode === "Attack") this.scene.attackMode = false;
      if (mode === "Destroy") {
        this.scene.destroyWallMode = false;
        this.scene.wallDestroyer?.stop?.();
        this.scene.input.setDefaultCursor("default");
      }

      this.activeMode = this._getSceneActiveMode();
      this.updateVisuals();
    };

    this._onKeyFarm = () => this.toggleMode("Farm");
    this._onKeyAttack = () => this.toggleMode("Attack");
    this._onResize = (gameSize) => {
      this.width = Number(gameSize?.width || this.scene.scale.width || this.width);
      this.relayout();
      this.updateVisuals();
    };

    this.view = scene.add.container(0, 0).setSize(width, height);
    this.container = this.view;

    this.mainButtons = {};
    this.mainButtonOrder = [];
    this.gatherCards = {};
    this.restButtons = {};
    this.restButtonOrder = [];

    this._createUi();
    this.registerHotkeys();

    this.scene.events.on("mode:completed", this._onModeCompleted);
    this.scene.scale.on("resize", this._onResize);

    Teams.ensureTownAutomation(this.teamNumber);
    this.relayout();
    this.updateVisuals();

    scene.functionTab = this;
  }

  _createUi() {
    MODE_KEYS.forEach((mode) => {
      const button = this._createMainButton(mode, MODE_COLORS[mode], () => this.toggleMode(mode));
      this.mainButtons[mode] = button;
      this.mainButtonOrder.push(button);
    });

    this.mainButtons.water = this._createMainButton("water", TOGGLE_COLORS.water, () => this.toggleWaterAutomation());
    this.mainButtons.gatherToggle = this._createMainButton("gatherToggle", TOGGLE_COLORS.gather, () => this.toggleGatherAutomation());
    this.mainButtonOrder.push(this.mainButtons.water, this.mainButtons.gatherToggle);

    GATHER_RESOURCES.forEach((resource) => {
      this.gatherCards[resource.key] = this._createGatherCard(resource);
    });

    REST_GROUPS.forEach((cfg) => {
      const button = this._createMainButton(cfg.key, cfg.color, () => this._runRestAction(cfg.key, this._getRestButtonMode(cfg.key)));
      button.height = REST_BUTTON_HEIGHT;
      this.restButtons[cfg.key] = button;
      this.restButtonOrder.push(button);
    });
  }

  _createMainButton(key, accentColor, onClick) {
    const root = this.scene.add.container(0, 0);
    const bg = this.scene.add.graphics();
    const text = this.scene.add.text(0, 0, "", {
      fontFamily: "Bungee",
      fontSize: "14px",
      fontStyle: "bold",
      align: "center",
      color: "#ffffff",
      stroke: "#081621",
      strokeThickness: 3,
    }).setOrigin(0.5);
    text.setLineSpacing(-4);

    const hit = this.scene.add.zone(0, 0, 10, 10)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const button = {
      key,
      accentColor,
      onClick,
      root,
      bg,
      text,
      hit,
      width: 0,
      height: MAIN_BUTTON_HEIGHT,
      hovered: false,
      pressed: false,
      active: false,
      label: "",
    };

    hit.on("pointerover", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      button.hovered = true;
      this._drawMainButton(button, button.active);
    });
    hit.on("pointerout", (_pointer, event) => {
      event?.stopPropagation?.();
      button.hovered = false;
      button.pressed = false;
      this._drawMainButton(button, button.active);
    });
    hit.on("pointerdown", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      button.pressed = true;
      this._drawMainButton(button, button.active);
    });
    hit.on("pointerup", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      button.pressed = false;
      this._drawMainButton(button, button.active);
      AudioManager.playBottomBarClick();
      button.onClick?.();
    });

    root.add([bg, text, hit]);
    this.view.add(root);
    return button;
  }

  _createMiniButton(label, accentColor, onClick) {
    const root = this.scene.add.container(0, 0);
    const bg = this.scene.add.graphics();
    const text = this.scene.add.text(0, 0, label, {
      fontFamily: "Bungee",
      fontSize: "15px",
      fontStyle: "bold",
      align: "center",
      color: "#f8fafc",
      stroke: "#081621",
      strokeThickness: 3,
    }).setOrigin(0.5);
    const hit = this.scene.add.zone(0, 0, MINI_BUTTON_SIZE, MINI_BUTTON_SIZE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const button = {
      label,
      accentColor,
      onClick,
      root,
      bg,
      text,
      hit,
      size: MINI_BUTTON_SIZE,
      hovered: false,
      pressed: false,
      disabled: false,
    };

    hit.on("pointerover", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      if (button.disabled) return;
      button.hovered = true;
      this._drawMiniButton(button);
    });
    hit.on("pointerout", (_pointer, event) => {
      event?.stopPropagation?.();
      button.hovered = false;
      button.pressed = false;
      this._drawMiniButton(button);
    });
    hit.on("pointerdown", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      if (button.disabled) return;
      button.pressed = true;
      this._drawMiniButton(button);
    });
    hit.on("pointerup", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      if (button.disabled) return;
      button.pressed = false;
      this._drawMiniButton(button);
      AudioManager.playBottomBarClick();
      button.onClick?.();
    });

    root.add([bg, text, hit]);
    return button;
  }

  _createGatherCard(resource) {
    const root = this.scene.add.container(0, 0);
    const bg = this.scene.add.graphics();
    const title = this.scene.add.text(0, -18, resource.label, {
      fontFamily: "Bungee",
      fontSize: "13px",
      fontStyle: "bold",
      color: resource.text,
      stroke: "#081621",
      strokeThickness: 3,
    }).setOrigin(0.5);
    const status = this.scene.add.text(0, 0, "0 / 0", {
      fontFamily: "Bungee",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f8fafc",
      stroke: "#081621",
      strokeThickness: 3,
    }).setOrigin(0.5);

    const minus = this._createMiniButton("-", resource.color, () => this.adjustGatherTarget(resource.key, -1));
    const plus = this._createMiniButton("+", resource.color, () => this.adjustGatherTarget(resource.key, 1));

    root.add([bg, title, status, minus.root, plus.root]);
    this.view.add(root);

    return {
      key: resource.key,
      resource,
      root,
      bg,
      title,
      status,
      minus,
      plus,
      width: 0,
      height: GATHER_CARD_HEIGHT,
    };
  }

  relayout() {
    const liveWidth = Math.max(
      this.width,
      Number(this.view?.width || 0),
      Number(this.view?.displayWidth || 0),
      Number(this.view?.getBounds?.()?.width || 0),
      Number(this.scene.uiBottomBar?.pages?.width || 0),
      Number(this.scene.scale.width || 0),
    );
    const liveHeight = Math.max(
      this.height,
      Number(this.view?.height || 0),
      Number(this.view?.displayHeight || 0),
      Number(this.view?.getBounds?.()?.height || 0),
      Number(this.scene.uiBottomBar?.pages?.height || 0),
    );

    this.width = liveWidth;
    this.height = liveHeight;

    this.view.setSize(this.width, this.height);

    const availableHeight = Math.max(90, this.height - CONTENT_PADDING_TOP - CONTENT_PADDING_BOTTOM);
    const rowGapA = 4;
    const rowGapB = 4;
    const usableHeight = availableHeight - rowGapA - rowGapB;

    const topRowHeight = Math.max(MAIN_BUTTON_HEIGHT, Math.floor(usableHeight * 0.34));
    const middleRowHeight = Math.max(GATHER_CARD_HEIGHT, Math.floor(usableHeight * 0.4));
    const bottomRowHeight = Math.max(REST_BUTTON_HEIGHT, usableHeight - topRowHeight - middleRowHeight);

    const top = -this.height / 2 + CONTENT_PADDING_TOP;
    const row1Y = top + topRowHeight / 2;
    const row2Y = top + topRowHeight + rowGapA + middleRowHeight / 2;
    const restRowY = top + topRowHeight + rowGapA + middleRowHeight + rowGapB + bottomRowHeight / 2;

    const usableWidth = Math.max(360, this.width - CONTENT_PADDING_X * 2);

    const mainButtonWidth = Math.max(
      92,
      Math.floor((usableWidth - MAIN_BUTTON_GAP * (this.mainButtonOrder.length - 1)) / this.mainButtonOrder.length)
    );
    const mainStartX = -((mainButtonWidth * this.mainButtonOrder.length) + (MAIN_BUTTON_GAP * (this.mainButtonOrder.length - 1))) / 2 + mainButtonWidth / 2;

    this.mainButtonOrder.forEach((button, index) => {
      button.width = mainButtonWidth;
      button.height = topRowHeight;
      button.root.setPosition(mainStartX + index * (mainButtonWidth + MAIN_BUTTON_GAP), row1Y);
      button.hit.setSize(button.width, button.height);
      button.text.setPosition(0, 0);
      button.text.setFixedSize(button.width - 14, button.height - 10);
      button.text.setOrigin(0.5);
    });

    const gatherCards = Object.values(this.gatherCards);
    const cardWidth = Math.max(
      104,
      Math.floor((usableWidth - CARD_GAP * (gatherCards.length - 1)) / gatherCards.length)
    );
    const cardStartX = -((cardWidth * gatherCards.length) + (CARD_GAP * (gatherCards.length - 1))) / 2 + cardWidth / 2;

    gatherCards.forEach((card, index) => {
      card.width = cardWidth;
      card.height = middleRowHeight;
      card.root.setPosition(cardStartX + index * (cardWidth + CARD_GAP), row2Y);
      card.title.setPosition(0, -Math.floor(card.height * 0.24));
      card.status.setPosition(0, 0);
      const miniY = Math.floor(card.height * 0.28);
      card.minus.root.setPosition(-card.width / 2 + 18, miniY);
      card.plus.root.setPosition(card.width / 2 - 18, miniY);
      card.minus.hit.setSize(MINI_BUTTON_SIZE, MINI_BUTTON_SIZE);
      card.plus.hit.setSize(MINI_BUTTON_SIZE, MINI_BUTTON_SIZE);
      this._drawMiniButton(card.minus);
      this._drawMiniButton(card.plus);
    });

    const restButtons = this.restButtonOrder;
    const restButtonWidth = Math.max(
      110,
      Math.floor((usableWidth - REST_BUTTON_GAP * (restButtons.length - 1)) / restButtons.length)
    );
    const restStartX = -((restButtonWidth * restButtons.length) + (REST_BUTTON_GAP * (restButtons.length - 1))) / 2 + restButtonWidth / 2;

    restButtons.forEach((button, index) => {
      button.width = restButtonWidth;
      button.height = bottomRowHeight;
      button.root.setPosition(restStartX + index * (restButtonWidth + REST_BUTTON_GAP), restRowY);
      button.hit.setSize(button.width, button.height);
      button.text.setPosition(0, 0);
      button.text.setFixedSize(button.width - 12, button.height - 8);
      button.text.setOrigin(0.5);
    });
  }

  _getSceneActiveMode() {
    if (this.scene.destroyWallMode) return "Destroy";
    if (this.scene.attackMode) return "Attack";
    if (this.scene.farmMode) return "Farm";
    return null;
  }

  toggleMode(mode) {
    const currentMode = this._getSceneActiveMode();
    const turningOn = currentMode !== mode;

    this.scene.farmMode = false;
    this.scene.seedGridMode = false;
    this.scene.attackMode = false;
    this.scene.stoneWallMode = false;
    this.scene.woodWallMode = false;
    this.scene.destroyWallMode = false;

    if (currentMode === "Destroy" && mode !== "Destroy") {
      this.scene.wallDestroyer?.stop?.();
      this.scene.input.setDefaultCursor("default");
    }

    if (turningOn) {
      if (mode === "Farm") this.scene.farmMode = true;
      if (mode === "Attack") this.scene.attackMode = true;
      if (mode === "Destroy") {
        this.scene.destroyWallMode = true;
        this.scene.wallDestroyer?.start?.();
      }
    } else if (mode === "Destroy") {
      this.scene.wallDestroyer?.stop?.();
      this.scene.input.setDefaultCursor("default");
    }

    this.activeMode = this._getSceneActiveMode();
    this.updateVisuals();
  }

  toggleWaterAutomation() {
    const automation = this._getAutomation();
    if (!automation) return;

    automation.waterEnabled = !automation.waterEnabled;
    this._reconcileTownAutomation(true);
    this.updateVisuals();

    showAlert(
      this.scene,
      automation.waterEnabled ? "Water production enabled for all firemen" : "Water production winding down",
      "#93c5fd"
    );
  }

  toggleGatherAutomation() {
    const automation = this._getAutomation();
    if (!automation) return;

    const totalTarget = this._sumGatherTargets(automation.gatherTargets);
    if (!automation.gatherEnabled && totalTarget <= 0) {
      automation.gatherTargets.wood = 1;
    }

    automation.gatherEnabled = !automation.gatherEnabled;
    if (this._sumGatherTargets(automation.gatherTargets) <= 0) {
      automation.gatherEnabled = false;
    }

    this._reconcileTownAutomation(true);
    this.updateVisuals();

    showAlert(
      this.scene,
      automation.gatherEnabled ? "Town gather staffing enabled" : "Town gather staffing winding down",
      "#fde68a"
    );
  }

  adjustGatherTarget(resourceKey, delta) {
    const automation = this._getAutomation();
    if (!automation || !Object.prototype.hasOwnProperty.call(automation.gatherTargets, resourceKey)) return;

    const current = Number(automation.gatherTargets[resourceKey] || 0);
    const next = Phaser.Math.Clamp(current + delta, 0, GATHER_MAX_TARGET);
    if (next === current) return;

    automation.gatherTargets[resourceKey] = next;
    if (delta > 0) automation.gatherEnabled = true;
    if (this._sumGatherTargets(automation.gatherTargets) <= 0) {
      automation.gatherEnabled = false;
    }

    this._reconcileTownAutomation(true);
    this.updateVisuals();
  }

  _getAutomation() {
    return Teams.ensureTownAutomation(this.teamNumber);
  }

  _sumGatherTargets(gatherTargets = {}) {
    return GATHER_RESOURCES.reduce((sum, resource) => sum + Math.max(0, Number(gatherTargets?.[resource.key] || 0)), 0);
  }

  _getTeamTroops(list) {
    return (list || []).filter((troop) => troop?.active);
  }

  _isManagedOrder(order, kind = null) {
    if (!order || order.status !== "active") return false;
    if (order.source !== FUNCTION_TAB_SOURCE) return false;
    if (kind && order.kind !== kind) return false;
    return true;
  }

  _isSleepLike(troop) {
    return troop?.state === CONTROL_STATES.SLEEP_MODE || troop?.state === CONTROL_STATES.GO_HOME_MODE;
  }

  _isBusy(troop) {
    return !!(
      troop?._sleepQueued === true ||
      troop?.task ||
      troop?.timer ||
      troop?._returnSwimActive === true ||
      troop?.currentPath?.length ||
      StorageManager.isCarrying(troop)
    );
  }

  _canAssignNow(troop) {
    return !!(troop?.active && !this._isSleepLike(troop) && !this._isBusy(troop));
  }

  _markOrderShuttingDown(troop) {
    const order = troop?.currentOrder;
    if (!order || order.shuttingDown) return;
    order.shuttingDown = true;
    OrderRunner.stepUnit(troop);
  }

  _managedGatherTroops(foragers, resourceKey) {
    return foragers.filter((troop) => {
      const order = troop?.currentOrder;
      return this._isManagedOrder(order, ORDER_KINDS.GATHER_TYPE) && order.resourceType === resourceKey;
    });
  }

  _managedWaterTroops(firemen) {
    return firemen.filter((troop) => this._isManagedOrder(troop?.currentOrder, ORDER_KINDS.MAKE_WATER));
  }

  _releasePriority(troop) {
    return [
      this._isBusy(troop) ? 1 : 0,
      StorageManager.isCarrying(troop) ? 1 : 0,
      Number(troop?.id || 0),
    ];
  }

  _comparePriority(a, b) {
    for (let index = 0; index < a.length; index += 1) {
      if (a[index] === b[index]) continue;
      return a[index] - b[index];
    }
    return 0;
  }

  _assignManagedWaterOrder(troop, orderId) {
    OrderRunner._replaceTroopOrder(troop, {
      id: orderId,
      kind: ORDER_KINDS.MAKE_WATER,
      status: "active",
      source: FUNCTION_TAB_SOURCE,
      persistent: true,
    });
    OrderRunner.stepUnit(troop);
  }

  _assignManagedGatherOrder(troop, resourceType, orderId) {
    OrderRunner._replaceTroopOrder(troop, {
      id: orderId,
      kind: ORDER_KINDS.GATHER_TYPE,
      status: "active",
      source: FUNCTION_TAB_SOURCE,
      resourceType,
      persistent: true,
    });
    OrderRunner.stepUnit(troop);
  }

  _reconcileTownAutomation(force = false) {
    const now = this.scene.time?.now ?? 0;
    if (!force && now - this._lastAutomationSyncAt < this._syncIntervalMs) return;

    const team = Teams.getTeam(this.teamNumber);
    const automation = this._getAutomation();
    if (!team || !automation) return;

    this._reconcileWaterAutomation(team, automation);
    this._reconcileGatherAutomation(team, automation);
    this._lastAutomationSyncAt = now;
  }

  _reconcileWaterAutomation(team, automation) {
    const firemen = this._getTeamTroops(team.firemanList);

    this._managedWaterTroops(firemen)
      .filter((troop) => troop?.currentOrder?.shuttingDown)
      .forEach((troop) => {
        OrderRunner.stepUnit(troop);
      });

    if (!automation.waterEnabled) {
      this._managedWaterTroops(firemen).forEach((troop) => {
        this._markOrderShuttingDown(troop);
      });
      return;
    }

    if (!automation.waterOrderId) {
      automation.waterOrderId = OrderRunner._nextId();
    }

    firemen.forEach((troop) => {
      const order = troop?.currentOrder;
      if (this._isManagedOrder(order, ORDER_KINDS.MAKE_WATER) && !order.shuttingDown) return;
      if (!this._canAssignNow(troop)) return;
      if (order && order.source && order.source !== FUNCTION_TAB_SOURCE) return;
      this._assignManagedWaterOrder(troop, automation.waterOrderId);
    });
  }

  _reconcileGatherAutomation(team, automation) {
    const foragers = this._getTeamTroops(team.foragerList);
    if (this._sumGatherTargets(automation.gatherTargets) <= 0) {
      automation.gatherEnabled = false;
    }

    foragers.forEach((troop) => {
      if (this._isManagedOrder(troop?.currentOrder, ORDER_KINDS.GATHER_TYPE) && troop.currentOrder?.shuttingDown) {
        OrderRunner.stepUnit(troop);
      }
    });

    GATHER_RESOURCES.forEach((resource) => {
      const desired = automation.gatherEnabled ? Math.max(0, Number(automation.gatherTargets?.[resource.key] || 0)) : 0;
      const assigned = this._managedGatherTroops(foragers, resource.key).filter((troop) => !troop?.currentOrder?.shuttingDown);
      const overflow = Math.max(0, assigned.length - desired);
      if (overflow <= 0) return;

      assigned
        .sort((a, b) => this._comparePriority(this._releasePriority(a), this._releasePriority(b)))
        .slice(0, overflow)
        .forEach((troop) => this._markOrderShuttingDown(troop));
    });

    GATHER_RESOURCES.forEach((resource) => {
      const desired = automation.gatherEnabled ? Math.max(0, Number(automation.gatherTargets?.[resource.key] || 0)) : 0;
      if (desired <= 0) return;

      const assignedCount = this._managedGatherTroops(foragers, resource.key)
        .filter((troop) => !troop?.currentOrder?.shuttingDown)
        .length;
      let needed = desired - assignedCount;
      if (needed <= 0) return;

      if (!automation.gatherOrderIds?.[resource.key]) {
        automation.gatherOrderIds[resource.key] = OrderRunner._nextId();
      }

      const candidates = foragers
        .filter((troop) => {
          if (!this._canAssignNow(troop)) return false;
          const order = troop?.currentOrder;
          if (!order) return true;
          if (order.source !== FUNCTION_TAB_SOURCE) return false;
          if (order.kind !== ORDER_KINDS.GATHER_TYPE) return false;
          if (!order.shuttingDown) return false;
          return true;
        })
        .sort((a, b) => this._comparePriority(
          [a?.currentOrder ? 0 : 1, Number(a?.id || 0)],
          [b?.currentOrder ? 0 : 1, Number(b?.id || 0)]
        ));

      for (const troop of candidates) {
        if (needed <= 0) break;
        this._assignManagedGatherOrder(troop, resource.key, automation.gatherOrderIds[resource.key]);
        needed -= 1;
      }
    });
  }

  _getRestTroops(groupKey, team) {
    const all = this._getTeamTroops(team?.playerList);
    const workers = this._getTeamTroops([
      ...(team?.builderList || []),
      ...(team?.foragerList || []),
      ...(team?.farmerList || []),
      ...(team?.firemanList || []),
    ]);
    const fighters = this._getTeamTroops(team?.fighterList);
    const idle = all.filter((troop) => (
      troop?.active &&
      !this._isSleepLike(troop) &&
      !troop?._sleepQueued &&
      !troop?.task &&
      !troop?.timer &&
      !troop?.track &&
      !troop?.currentPath?.length &&
      !StorageManager.isCarrying(troop)
    ));

    switch (groupKey) {
      case "workers":
        return workers;
      case "fighters":
        return fighters;
      case "idle":
        return idle;
      case "all":
      default:
        return all;
    }
  }

  _isDeliveryPhaseTroop(troop) {
    if (!troop?.active) return false;

    return !!(
      StorageManager.isCarrying(troop) ||
      troop?.state === CONTROL_STATES.SEND_TO_STORAGE ||
      troop?.state === CONTROL_STATES.SEND_TO_OVEN ||
      troop?.state === CONTROL_STATES.GET_FROM_OVEN ||
      troop?.pendingFuelJob ||
      troop?.pendingOvenJob
    );
  }

  _markOrderShuttingDownForSleep(troop) {
    const order = troop?.currentOrder;
    if (!order) return;
    if (order.source !== FUNCTION_TAB_SOURCE) return;
    if (order.shuttingDown) return;

    order.shuttingDown = true;
    OrderRunner.stepUnit?.(troop);
  }

  _queueSleepAfterCurrentDelivery(troop) {
    if (!troop?.active) return false;
    troop._sleepQueued = true;
    troop._sleepQueuedAt = this.scene.time?.now ?? Date.now();
    this._markOrderShuttingDownForSleep(troop);
    return true;
  }

  _sleepTroopNow(troop) {
    if (!troop?.active) return false;

    this._markOrderShuttingDownForSleep(troop);

    InterruptController.interruptTroop(
      troop,
      "function_tab_sleep_now",
      CONTROL_STATES.TRACK_MODE
    );

    const result = OrderRunner.toggleSleepTroops?.([troop]);
    if (result?.ok) {
      troop._sleepQueued = false;
      troop._sleepQueuedAt = 0;
      return true;
    }
    return false;
  }

  _wakeTroopNow(troop) {
    if (!troop?.active) return false;

    const hadQueuedSleep = !!troop._sleepQueued;
    troop._sleepQueued = false;
    troop._sleepQueuedAt = 0;

    if (this._isSleepLike(troop)) {
      const result = OrderRunner.toggleSleepTroops?.([troop]);
      return !!result?.ok;
    }

    return hadQueuedSleep;
  }

  _getRestGroupState(groupKey) {
    const team = Teams.getTeam(this.teamNumber);
    const troops = this._getRestTroops(groupKey, team);

    let awake = 0;
    let sleeping = 0;
    let queued = 0;

    troops.forEach((troop) => {
      if (!troop?.active) return;
      if (troop?._sleepQueued) {
        queued += 1;
        return;
      }
      if (this._isSleepLike(troop)) {
        sleeping += 1;
        return;
      }
      awake += 1;
    });

    return {
      troops,
      awake,
      sleeping,
      queued,
      total: awake + sleeping + queued,
    };
  }

  _getRestButtonMode(groupKey) {
    const state = this._getRestGroupState(groupKey);
    if (state.total <= 0) return "none";
    return state.awake > 0 ? "sleep" : "wake";
  }

  _getRestButtonLabel(groupKey) {
    const cfg = REST_GROUPS.find((g) => g.key === groupKey);
    const state = this._getRestGroupState(groupKey);
    if (state.total <= 0) return `NO\n${cfg?.label || groupKey.toUpperCase()}`;
    const action = state.awake > 0 ? "SLEEP" : "WAKE";
    return `${action}\n${cfg?.label || groupKey.toUpperCase()}`;
  }

  _runRestAction(groupKey, mode) {
    const team = Teams.getTeam(this.teamNumber);
    if (!team) return;

    const troops = this._getRestTroops(groupKey, team);
    if (!troops.length) {
      const label = REST_GROUPS.find((g) => g.key === groupKey)?.label?.toLowerCase() || "troops";
      showAlert(this.scene, `No ${label} available`, "#fecaca");
      return;
    }

    let changed = 0;
    let queued = 0;
    let skipped = 0;

    troops.forEach((troop) => {
      if (!troop?.active) {
        skipped += 1;
        return;
      }

      if (mode === "wake") {
        if (this._wakeTroopNow(troop)) changed += 1;
        else skipped += 1;
        return;
      }

      if (this._isSleepLike(troop)) {
        skipped += 1;
        return;
      }

      if (this._isDeliveryPhaseTroop(troop)) {
        if (this._queueSleepAfterCurrentDelivery(troop)) queued += 1;
        else skipped += 1;
        return;
      }

      if (this._sleepTroopNow(troop)) changed += 1;
      else skipped += 1;
    });

    this.updateVisuals();

    if (mode === "wake") {
      showAlert(
        this.scene,
        `Woke ${changed} troop${changed === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}`,
        changed > 0 ? "#a7f3d0" : "#fecaca"
      );
      return;
    }

    showAlert(
      this.scene,
      `Sleeping now: ${changed}${queued ? ` | after dropoff: ${queued}` : ""}${skipped ? ` | skipped: ${skipped}` : ""}`,
      (changed + queued) > 0 ? "#c4b5fd" : "#fecaca"
    );
  }

  _getWaterSummary(automation, firemen) {
    const managed = this._managedWaterTroops(firemen);
    const active = managed.filter((troop) => !troop?.currentOrder?.shuttingDown).length;
    const finishing = managed.length - active;

    if (automation.waterEnabled) {
      return `WATER ON\n${active} firemen`;
    }
    if (finishing > 0) {
      return `WATER OFF\n${finishing} finishing`;
    }
    return "WATER OFF\nStandby";
  }

  _getGatherSummary(automation, foragers) {
    const planned = this._sumGatherTargets(automation.gatherTargets);
    const staffed = GATHER_RESOURCES.reduce((sum, resource) => {
      const active = this._managedGatherTroops(foragers, resource.key)
        .filter((troop) => !troop?.currentOrder?.shuttingDown)
        .length;
      return sum + active;
    }, 0);

    if (automation.gatherEnabled) {
      return `GATHER ON\n${staffed} / ${planned} staffed`;
    }
    if (planned > 0) {
      return `GATHER OFF\n${planned} planned`;
    }
    return "GATHER OFF\nNo staffing";
  }

  _setMainButtonLabel(button, label) {
    if (!button || button.label === label) return;
    button.label = label;
    button.text.setText(label);
  }

  _drawMainButton(button, active) {
    button.active = active;
    const x = -button.width / 2;
    const y = -button.height / 2;
    const fillColor = mixColor(BOTTOM_BAR_THEME.panelFill, button.accentColor, active ? 0.26 : button.hovered ? 0.16 : 0.08);
    const fillAlpha = active ? 0.96 : button.pressed ? 0.9 : button.hovered ? 0.86 : 0.8;
    const strokeColor = active ? button.accentColor : mixColor(button.accentColor, 0x98e7ff, 0.35);
    const strokeAlpha = active ? 0.64 : button.hovered ? 0.28 : 0.14;

    button.bg.clear();
    button.bg.fillStyle(0x031019, 0.16);
    button.bg.fillRoundedRect(x, y + 3, button.width, button.height, 14);
    button.bg.fillStyle(fillColor, fillAlpha);
    button.bg.fillRoundedRect(x, y, button.width, button.height, 14);
    button.bg.fillStyle(0xffffff, active ? 0.14 : 0.08);
    button.bg.fillRoundedRect(x + 8, y + 5, Math.max(18, button.width - 16), Math.max(10, Math.floor(button.height * 0.34)), 10);
    button.bg.lineStyle(active ? 2 : 1.5, strokeColor, strokeAlpha);
    button.bg.strokeRoundedRect(x, y, button.width, button.height, 14);
    button.bg.lineStyle(1, 0xffffff, active ? 0.18 : 0.08);
    button.bg.strokeRoundedRect(x + 1, y + 1, button.width - 2, button.height - 2, 13);

    button.text.setColor(active ? "#fffaf0" : Phaser.Display.Color.IntegerToColor(button.accentColor).rgba);
    button.root.setScale(button.pressed ? 0.99 : active ? 1.015 : button.hovered ? 1.01 : 1);
  }

  _drawMiniButton(button) {
    const size = button.size;
    const x = -size / 2;
    const y = -size / 2;
    const fillAlpha = button.disabled
      ? 0.12
      : button.pressed ? 0.92 : button.hovered ? 0.86 : 0.78;
    const strokeAlpha = button.disabled ? 0.08 : button.hovered ? 0.32 : 0.18;
    const fillColor = mixColor(BOTTOM_BAR_THEME.panelFill, button.accentColor, button.hovered ? 0.3 : 0.2);

    button.bg.clear();
    button.bg.fillStyle(0x031019, 0.16);
    button.bg.fillRoundedRect(x, y + 2, size, size, 9);
    button.bg.fillStyle(fillColor, fillAlpha);
    button.bg.fillRoundedRect(x, y, size, size, 9);
    button.bg.fillStyle(0xffffff, button.disabled ? 0.02 : 0.08);
    button.bg.fillRoundedRect(x + 4, y + 3, Math.max(8, size - 8), 7, 6);
    button.bg.lineStyle(1.5, button.accentColor, strokeAlpha);
    button.bg.strokeRoundedRect(x, y, size, size, 9);
    button.text.setAlpha(button.disabled ? 0.35 : 1);
    button.root.setScale(button.disabled ? 1 : button.pressed ? 0.96 : button.hovered ? 1.04 : 1);
  }

  _drawGatherCard(card, automation, activeCount, targetCount) {
    const available = OrderRunner.isGatherCommandAvailable(card.key, this.scene);
    const paused = !automation.gatherEnabled && targetCount > 0;
    const hasTarget = targetCount > 0;
    const blocked = hasTarget && automation.gatherEnabled && !available;
    const full = hasTarget && activeCount >= targetCount && !blocked;
    const accentColor = hasTarget && !available ? 0xf59e0b : card.resource.color;
    const fillAlpha = hasTarget
      ? full ? 0.94 : blocked ? 0.86 : paused ? 0.82 : 0.88
      : 0.74;
    const strokeAlpha = hasTarget
      ? full ? 0.34 : blocked ? 0.28 : paused ? 0.18 : 0.24
      : 0.12;

    card.bg.clear();
    card.bg.fillStyle(0x031019, 0.14);
    card.bg.fillRoundedRect(-card.width / 2, -card.height / 2 + 3, card.width, card.height, 14);
    card.bg.fillStyle(mixColor(BOTTOM_BAR_THEME.panelFill, accentColor, hasTarget ? 0.18 : 0.08), fillAlpha);
    card.bg.fillRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, 12);
    card.bg.fillStyle(0xffffff, hasTarget ? 0.08 : 0.05);
    card.bg.fillRoundedRect(-card.width / 2 + 8, -card.height / 2 + 6, Math.max(16, card.width - 16), 14, 9);
    card.bg.lineStyle(2, mixColor(accentColor, 0xffffff, 0.14), strokeAlpha);
    card.bg.strokeRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, 12);
    card.bg.lineStyle(1, 0xffffff, hasTarget ? 0.12 : 0.06);
    card.bg.strokeRoundedRect(-card.width / 2 + 1, -card.height / 2 + 1, card.width - 2, card.height - 2, 11);

    card.status.setText(`${activeCount} / ${targetCount}`);
    card.status.setColor(
      !hasTarget
        ? "#94a3b8"
        : blocked
          ? "#fde68a"
          : full
          ? "#f8fafc"
          : paused
            ? "#cbd5e1"
            : "#e2e8f0"
    );
    card.title.setAlpha(hasTarget ? 1 : 0.78);

    card.minus.disabled = targetCount <= 0;
    card.plus.disabled = targetCount >= GATHER_MAX_TARGET;
    this._drawMiniButton(card.minus);
    this._drawMiniButton(card.plus);
  }

  updateVisuals() {
    const automation = this._getAutomation() || Teams.createTownAutomationState();
    const team = Teams.getTeam(this.teamNumber) || {
      playerList: [],
      fighterList: [],
      builderList: [],
      foragerList: [],
      farmerList: [],
      firemanList: [],
    };

    const foragers = this._getTeamTroops(team?.foragerList);
    const firemen = this._getTeamTroops(team?.firemanList);

    this.activeMode = this._getSceneActiveMode();

    MODE_KEYS.forEach((mode) => {
      this._setMainButtonLabel(this.mainButtons[mode], mode);
      this._drawMainButton(this.mainButtons[mode], this.activeMode === mode);
    });

    this._setMainButtonLabel(this.mainButtons.water, this._getWaterSummary(automation, firemen));
    this._drawMainButton(this.mainButtons.water, !!automation?.waterEnabled);

    this._setMainButtonLabel(this.mainButtons.gatherToggle, this._getGatherSummary(automation, foragers));
    this._drawMainButton(
      this.mainButtons.gatherToggle,
      !!automation?.gatherEnabled && this._sumGatherTargets(automation?.gatherTargets) > 0
    );

    GATHER_RESOURCES.forEach((resource) => {
      const card = this.gatherCards[resource.key];
      const target = Math.max(0, Number(automation?.gatherTargets?.[resource.key] || 0));
      const active = this._managedGatherTroops(foragers, resource.key)
        .filter((troop) => !troop?.currentOrder?.shuttingDown)
        .length;
      this._drawGatherCard(card, automation, active, target);
    });

    REST_GROUPS.forEach((cfg) => {
      const button = this.restButtons[cfg.key];
      this._setMainButtonLabel(button, this._getRestButtonLabel(cfg.key));
      this._drawMainButton(button, false);
    });
  }

  update() {
    const now = this.scene.time?.now ?? 0;
    const shouldRefresh = now - this._lastAutomationSyncAt >= this._syncIntervalMs;
    this._reconcileTownAutomation();
    if (shouldRefresh || this.activeMode !== this._getSceneActiveMode()) {
      this.updateVisuals();
    }
  }

  onShow() {
    this.scene.time?.delayedCall?.(0, () => {
      this.relayout();
      this.updateVisuals();
    });
  }

  registerHotkeys() {
    this.scene.input.keyboard.on("keydown-F", this._onKeyFarm);
    this.scene.input.keyboard.on("keydown-K", this._onKeyAttack);
  }

  getContainer() {
    return this.container;
  }

  destroy() {
    this.scene.events.off("mode:completed", this._onModeCompleted);
    this.scene.input.keyboard.off("keydown-F", this._onKeyFarm);
    this.scene.input.keyboard.off("keydown-K", this._onKeyAttack);
    this.scene.scale.off("resize", this._onResize);
    this.container?.destroy?.(true);
    this.view = null;
    this.mainButtons = {};
    this.mainButtonOrder = [];
    this.gatherCards = {};
    this.restButtons = {};
    this.restButtonOrder = [];
  }
}
