import Phaser from "phaser";
import { UIDEPTH } from "../constants";
import { DailyNeedsTracker } from "./DailyNeedsTracker";
import { Clock } from "../Controllers/Clock";
import { CreateBottomBar } from "./BottomBar/BottomBar";
import { StageState } from "../parcelController/StageState";
import { ContractHud } from "./ContractHud.js";
import { SelectionCommandBar } from "./SelectionCommandBar.js";
import { Teams } from "../Teams.js";
import { getNextHordeUnlock } from "../parcel_system/HordeUnlockTrack.js";
import { applyPortraitKeyToSprite, getPlayerPortraitKey } from "../players/playerPortraits.js";
import { MainMenu } from "../mainMenu.js";

export class GameUIScene extends Phaser.Scene {
  constructor() {
    super("GameUIScene");
    this.worldScene = null;
    this._bridged = [];
  }

  init(data) {
    this.worldSceneKey = data?.worldSceneKey || "mapView";
    this._resetRuntimeState();
  }

  _resetRuntimeState() {
    this.worldScene = null;
    this._bridged = [];
    this._hudBuilt = false;
    this._sceneShuttingDown = false;

    this.alertHud = null;
    this._activeAlerts = [];
    this.topHud = null;
    this.townXpHud = null;
    this.phaseClock = null;
    this.stageMetaText = null;
    this.zoomControls = null;
    this.raiderEdgeHud = null;
    this.raiderEdgeIndicators = null;
    this.contractHud = null;
    this.selectionCommandBar = null;
    this.uiBottomBar = null;
    this.playerTab = null;
    this.clayTab = null;
    this.storageTab = null;
    this.housesTab = null;
    this.buildTab = null;
    this.cardsTab = null;
    this.functionTab = null;
    this._townLossPresentation = null;
    this._townXpRewardPresentation = null;
    this._townXpHudSignature = null;
    this._townXpLastGainSerial = 0;
    this._scaleResizeHandlers = [];
    this._stageMetaRecompute = null;
    this._stageMetaRefreshTimer = null;
  }

  _teardownStageMetaHud() {
    if (this._stageMetaRecompute && this.worldScene?.events) {
      this.worldScene.events.off("stage:changed", this._stageMetaRecompute);
    }
    this._stageMetaRecompute = null;

    this._stageMetaRefreshTimer?.remove?.(false);
    this._stageMetaRefreshTimer = null;
  }

  _clearWorldEventBridge() {
    if (Array.isArray(this._bridged) && this._bridged.length) {
      const sourceScene = this._bridged[0]?.sourceScene || this.worldScene;
      this._bridged.forEach(({ evt, fn, sourceScene: bridgedScene }) => {
        const emitterOwner = bridgedScene || sourceScene;
        emitterOwner?.events?.off?.(evt, fn);
      });
    }
    this._bridged = [];
  }

  _trackScaleResize(handler) {
    if (!handler) return null;
    this.scale?.on?.("resize", handler);
    this._scaleResizeHandlers.push(handler);
    return handler;
  }

  _clearScaleResizeHandlers() {
    if (!Array.isArray(this._scaleResizeHandlers)) return;
    this._scaleResizeHandlers.forEach((handler) => {
      this.scale?.off?.("resize", handler);
    });
    this._scaleResizeHandlers.length = 0;
  }

  _canMutateText(node) {
    if (!node || node.active === false || node.scene !== this) return false;
    if ("canvas" in node && (!node.canvas || !node.context)) return false;
    if (node.frame?.source && !node.frame.source.image) return false;
    return true;
  }

  _mutateText(node, fn) {
    if (this._sceneShuttingDown || !this._canMutateText(node)) return false;
    try {
      fn(node);
      return true;
    } catch {
      return false;
    }
  }

  create() {
    const world = this.scene.get(this.worldSceneKey);
    if (!world) return;
    this._sceneShuttingDown = false;
    this.bindWorldScene(world);
    this._tryOpenPendingMenu({ allowPausedFallback: true });
    this.events.once("shutdown", () => {
      this._sceneShuttingDown = true;
      this._clearWorldEventBridge();
      if (this.worldScene?.uiScene === this) {
        this.worldScene.uiScene = null;
      }
      this._destroyTownLossPresentation();
      this._destroyGameplayUi();
      this._clearScaleResizeHandlers();
    });
  }

  _destroyGameplayUi() {
    const world = this.worldScene;
    this._teardownStageMetaHud();
    this._destroyTownXpRewardPresentation();
    this.selectionCommandBar?.destroy?.();
    this.selectionCommandBar = null;
    this.contractHud?.destroy?.();
    this.contractHud = null;
    this.uiBottomBar?.destroy?.();
    this.playerTab?.destroy?.();
    this.playerTab = null;
    this.clayTab?.destroy?.();
    this.clayTab = null;
    this.storageTab?.destroy?.();
    this.storageTab = null;
    this.housesTab?.destroy?.();
    this.housesTab = null;
    this.buildTab?.destroy?.();
    this.buildTab?.view?.destroy?.(true);
    this.buildTab = null;
    this.cardsTab?.destroy?.();
    this.cardsTab?.view?.destroy?.(true);
    this.cardsTab = null;
    this.functionTab?.destroy?.();
    this.functionTab?.container?.destroy?.(true);
    this.functionTab = null;
    this.uiBottomBar?.ui?.destroy?.(true);
    this.uiBottomBar = null;
    this.topHud?.destroy?.(true);
    this.topHud = null;
    this.townXpHud?.destroy?.(true);
    this.townXpHud = null;
    this.phaseClock?.destroy?.(true);
    this.phaseClock = null;
    this.stageMetaText?.destroy?.();
    this.stageMetaText = null;
    this.stageMetaSubText?.destroy?.();
    this.stageMetaSubText = null;
    this.zoomControls?.destroy?.(true);
    this.zoomControls = null;
    this.raiderEdgeHud?.destroy?.(true);
    this.raiderEdgeHud = null;
    this.alertHud?.destroy?.(true);
    this.alertHud = null;
    this.moneyText = null;
    this.seedsText = null;
    this.berryText = null;
    this.woodText = null;
    this.stoneText = null;
    this.foodText = null;
    this.waterText = null;
    this.permitText = null;
    this.clockText = null;
    this.phaseClockTimeText = null;
    this.topHudElements = [];
    this.topHudHoverTargets = [];
    this._townXpHudSignature = null;
    this._townXpLastGainSerial = 0;
    this._hudBuilt = false;

    if (world) {
      world.moneyText = null;
      world.seedsText = null;
      world.berryText = null;
      world.woodText = null;
      world.stoneText = null;
      world.foodText = null;
      world.waterText = null;
      world.permitText = null;
      world.clockText = null;
      world.uiBottomBar = null;
      world.setBottomBar = null;
      world.openDetailPage = null;
      world.playerTab = null;
      world.clayTab = null;
      world.storageTab = null;
      world.housesTab = null;
      world.buildTab = null;
      world.cardsTab = null;
    }
  }

  _tryOpenPendingMenu({ allowPausedFallback = false } = {}) {
    const world = this.worldScene;
    if (!world || world.draftMenu) return false;

    const menuNeedsRehost = !!world.menu?.active && world.menu?.scene !== this;
    const shouldOpenMenu =
      !!world._pendingMenuPhase ||
      menuNeedsRehost ||
      (allowPausedFallback && !world.menu?.active && !!world.clock?.paused);

    if (!shouldOpenMenu) return false;
    MainMenu.startMenuPhase();
    return !!world.menu?.active;
  }

  bindWorldScene(world) {
    this._clearWorldEventBridge();
    this.worldScene = world;
    world.uiScene = this;

    this._bridgeWorldEvents();
    this._forwardWorldState();
  }

  _bridgeWorldEvents() {
    this._clearWorldEventBridge();

    const passthrough = [
      "oven:updated",
      "oven:added",
      "oven:removed",
      "storage:added",
      "storage:removed",
      "storage:updated",
      "housing:updated",
      "store:unlock-changed",
      "cards:updated",
      "mode:completed",
    ];

    passthrough.forEach((evt) => {
      const fn = (...args) => this.events.emit(evt, ...args);
      this.worldScene.events.on(evt, fn);
      this._bridged.push({ evt, fn, sourceScene: this.worldScene });
    });
  }

  _forwardWorldState() {
    const fields = [
      "money",
      "seeds",
      "berries",
      "woodAmnt",
      "stoneAmnt",
      "foodAmnt",
      "cleanWaterAmnt",
      "permits",
      "farmMode",
      "seedGridMode",
      "attackMode",
      "stoneWallMode",
      "woodWallMode",
      "destroyWallMode",
      "guardPlacement",
      "wallPlacer",
      "wallDestroyer",
      "uiBottomBar",
    ];

    fields.forEach((k) => {
      if (Object.getOwnPropertyDescriptor(this, k)) return;
      Object.defineProperty(this, k, {
        get: () => this.worldScene?.[k],
        set: (v) => {
          if (this.worldScene) this.worldScene[k] = v;
        },
      });
    });

    const fnNames = [
      "checkSufficientFunds",
      "checkSufficientSeeds",
      "checkSufficientBerries",
      "checkSufficientPermits",
      "updateMoney",
      "updateSeeds",
      "updateBerry",
      "updatePermits",
      "processEnemySelection",
    ];
    fnNames.forEach((k) => {
      if (typeof this[k] === "function") return;
      this[k] = (...args) => this.worldScene?.[k]?.(...args);
    });
  }

  initGameplayUI() {
    if (!this.worldScene) return;
    if (this._hudBuilt) return;

    this._buildAlertHud();
    this._buildTopHud();
    this._buildTownXpHud();
    this._buildPhaseClock();
    this._buildZoomControls();
    this._buildRaiderEdgeHud();
    this._buildContractHud();
    this._buildSelectionCommandBar();
    CreateBottomBar(this);
    this._hudBuilt = true;

    this._syncWorldUiRefs();
    this.worldScene?.setSimulationSpeedReady?.(true);
  }

  _buildAlertHud() {
    if (this.alertHud) return;

    this.alertHud = this.add.container(0, 0).setDepth(UIDEPTH + 28);
    this._activeAlerts = [];

    const relayout = () => {
      const centerX = this.scale.width * 0.5;
      const startY = 50;
      this._activeAlerts.forEach((entry, index) => {
        entry.targetY = startY + index * 46;
        entry.root.x = centerX;
        if (!entry.isEntering) {
          entry.root.y = entry.targetY;
        }
      });
    };

    this.alertHud.relayout = relayout;
    this.scale.on("resize", relayout);
    this.events.once("shutdown", () => {
      this.scale.off("resize", relayout);
    });
  }

  showAlertMessage(message, color = "#ffffff", duration = 1400) {
    if (!message) return null;
    this._buildAlertHud();

    const label = this.add
      .text(0, 0, String(message), {
        fontFamily: "Bungee",
        fontSize: "18px",
        color,
        stroke: "#07111b",
        strokeThickness: 4,
        align: "center",
        wordWrap: { width: Math.max(260, this.scale.width - 220) },
      })
      .setOrigin(0.5);

    const width = Math.max(180, Math.ceil(label.width) + 30);
    const height = Math.max(34, Math.ceil(label.height) + 20);
    const shadow = this.add.rectangle(0, 4, width, height, 0x02060d, 0.34).setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, width, height, 0x10283a, 0.9).setOrigin(0.5).setStrokeStyle(2, 0x89d6ff, 0.28);
    const shine = this.add
      .rectangle(0, -Math.round(height * 0.18), Math.max(48, width - 18), Math.max(10, Math.floor(height * 0.34)), 0xffffff, 0.07)
      .setOrigin(0.5);
    const root = this.add
      .container(this.scale.width * 0.5, 40, [shadow, bg, shine, label])
      .setDepth(UIDEPTH + 28)
      .setAlpha(0)
      .setScale(0.96);

    const entry = { root, isEntering: true, targetY: 50 };
    this.alertHud.add(root);
    this._activeAlerts.push(entry);
    this.alertHud.relayout?.();

    root.y = entry.targetY - 10;
    this.tweens.add({
      targets: root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: entry.targetY,
      duration: 170,
      ease: "Back.Out",
      onComplete: () => {
        entry.isEntering = false;
      },
    });

    this.tweens.add({
      targets: root,
      alpha: 0,
      y: entry.targetY - 10,
      delay: Math.max(150, Number(duration) || 1400),
      duration: 220,
      ease: "Quad.Out",
      onComplete: () => {
        const nextAlerts = (this._activeAlerts || []).filter((candidate) => candidate !== entry);
        this._activeAlerts = nextAlerts;
        root.destroy();
        this.alertHud?.relayout?.();
      },
    });

    return root;
  }

  _syncWorldUiRefs() {
    const w = this.worldScene;
    if (!w) return;

    w.moneyText = this.moneyText;
    w.seedsText = this.seedsText;
    w.berryText = this.berryText;
    w.woodText = this.woodText;
    w.stoneText = this.stoneText;
    w.foodText = this.foodText;
    w.waterText = this.waterText;
    w.permitText = this.permitText;
    w.clockText = this.phaseClockTimeText ?? this.clockText;

    w.uiBottomBar = this.uiBottomBar;
    w.setBottomBar = this.setBottomBar;
    w.openDetailPage = this.openDetailPage;
    w.playerTab = this.playerTab;
    w.clayTab = this.clayTab;
    w.storageTab = this.storageTab;
    w.housesTab = this.housesTab;
    w.buildTab = this.buildTab;
    w.cardsTab = this.cardsTab;
  }

  _buildTopHud() {
    const W = this.scale.width;
    const H = 44;
    const world = this.worldScene;

    const shadow = this.add.graphics();
    const bg = this.add.graphics();
    const inset = this.add.graphics();
    const shine = this.add.graphics();

    const drawBar = (width = this.scale.width) => {
      const outerX = 8;
      const outerY = 4;
      const outerW = Math.max(120, width - 16);
      const outerH = H - 6;
      const radius = 20;

      shadow.clear();
      shadow.fillStyle(0x03101a, 0.30);
      shadow.fillRoundedRect(outerX + 2, outerY + 4, outerW, outerH, radius);

      bg.clear();
      bg.fillStyle(0x123548, 0.96);
      bg.lineStyle(2, 0xb7ecff, 0.20);
      bg.fillRoundedRect(outerX, outerY, outerW, outerH, radius);
      bg.strokeRoundedRect(outerX, outerY, outerW, outerH, radius);

      inset.clear();
      inset.fillStyle(0x0b2232, 0.24);
      inset.fillRoundedRect(outerX + 7, outerY + 7, outerW - 14, outerH - 14, radius - 6);

      shine.clear();
      shine.fillStyle(0xffffff, 0.08);
      shine.fillRoundedRect(outerX + 12, outerY + 6, outerW - 24, 14, 10);
    };
    drawBar(W);
    this._trackScaleResize(({ width }) => drawBar(width));

    const makeIcon = (x, key) =>
      this.add.image(x, H / 2, key).setDisplaySize(20, 20).setOrigin(0, 0.5).setDepth(UIDEPTH);

    const makeText = (x, text, color = "#fff") =>
      this.add
        .text(x, H / 2, text, {
          fontSize: "14px",
          fill: color,
          fontFamily: "Bungee",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setDepth(UIDEPTH);

    const makeEmojiIcon = (x, emoji) =>
      this.add
        .text(x, H / 2, emoji, {
          fontSize: "18px",
          fontFamily: "Arial",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setDepth(UIDEPTH);

    const registerHover = (leftX, rightX, label) => {
      const width = Math.max(22, rightX - leftX);
      const hit = this.add
        .rectangle(leftX + width / 2, H / 2, width, H, 0xffffff, 0.001)
        .setOrigin(0.5, 0.5)
        .setDepth(UIDEPTH + 1)
        .setInteractive({ useHandCursor: true });

      this._bindTopHudHover(hit, label);
      this.topHudElements.push(hit);
      return hit;
    };

    let x = 12;
    const spacing = 8;
    const iconSize = 20;

    const needs = DailyNeedsTracker.getValues();
    this.topHudElements = [];
    this.topHudHoverTargets = [];

    for (const item of needs) {
      const leftX = x;
      const icon = makeIcon(x, item.key);
      x += iconSize + 4;
      const display = item.need ? `${item.have}/${item.need}` : `${item.have}`;
      const color = item.need ? (item.have >= item.need ? "#00ff00" : "#ff3333") : item.have > 0 ? "#00ff00" : "#ff3333";
      const text = makeText(x, display, color);
      x += text.width + spacing;

      if (item.key === "foodIcon") this.foodText = text;
      if (item.key === "waterIcon") this.waterText = text;

      this.topHudElements.push(icon, text);
      this.topHudHoverTargets.push(registerHover(leftX, x - spacing, item.key === "foodIcon" ? "Food" : "Water"));
    }

    const resources = [
      { key: "seeds", value: world.seeds },
      { key: "berry", value: world.berries },
      { key: "woodIcon", value: world.woodAmnt },
      { key: "stoneIcon", value: world.stoneAmnt },
    ];

    for (const r of resources) {
      const leftX = x;
      const icon = makeIcon(x, r.key);
      x += iconSize + 4;
      const text = makeText(x, `${r.value}`);
      x += text.width + spacing;

      switch (r.key) {
        case "seeds":
          this.seedsText = text;
          break;
        case "berry":
          this.berryText = text;
          break;
        case "woodIcon":
          this.woodText = text;
          break;
        case "stoneIcon":
          this.stoneText = text;
          break;
      }

      this.topHudElements.push(icon, text);
      const labelMap = {
        seeds: "Seeds",
        berry: "Berries",
        woodIcon: "Wood",
        stoneIcon: "Stone",
      };
      this.topHudHoverTargets.push(registerHover(leftX, x - spacing, labelMap[r.key] || r.key));
    }

    const permitLeftX = x;
    const permitIcon = makeEmojiIcon(x, "📜");
    x += permitIcon.width + 4;
    this.permitText = makeText(x, `${world.permits ?? 0}`);
    x += this.permitText.width + spacing;
    this.topHudElements.push(permitIcon, this.permitText);
    this.topHudHoverTargets.push(registerHover(permitLeftX, x - spacing, "Growth Permits"));

    const housingLeftX = x;
    const housingIcon = makeEmojiIcon(x, "🏠");
    x += housingIcon.width + 4;
    this.housingText = makeText(x, "0/0");
    x += this.housingText.width + spacing;
    this.topHudElements.push(housingIcon, this.housingText);
    this.topHudHoverTargets.push(registerHover(housingLeftX, x - spacing, () => this._getHousingHoverLabel()));

    const centerX = W / 2;
    const moneyLeftX = centerX - 30;
    const moneyIcon = makeIcon(centerX - 30, "monies");
    this.moneyText = makeText(centerX - 4, `$${world.money}`);
    this.topHudElements.push(moneyIcon, this.moneyText);
    this.topHudHoverTargets.push(registerHover(moneyLeftX, centerX - 4 + this.moneyText.width, "Money"));

    this.topHud = this.add.container(0, 0, [shadow, bg, inset, shine, ...this.topHudElements]).setDepth(UIDEPTH);
    this._refreshTopHudValues(true);
  }

  _getTopHudNeedCount() {
    return Teams.teamLists?.["1"]?.playerList?.length || 0;
  }

  _getHousingHoverLabel() {
    const stats = Teams.getHousingStatus?.("1") ?? {
      playerCount: 0,
      capacity: 0,
      homelessCount: 0,
      descriptor: "Empty",
    };
    if (stats.homelessCount > 0) {
      return `Housing: ${stats.playerCount}/${stats.capacity}\n${stats.homelessCount} homeless`;
    }
    return `Housing: ${stats.playerCount}/${stats.capacity}\n${stats.descriptor}`;
  }

  _refreshTopHudValues(force = false) {
    if (!this.worldScene || this._sceneShuttingDown) return;

    const needCount = this._getTopHudNeedCount();
    const housing = Teams.getHousingStatus?.("1") ?? {
      playerCount: needCount,
      capacity: 0,
      homelessCount: 0,
      descriptor: "Empty",
    };
    const snapshot = {
      food: Number(this.worldScene.foodAmnt ?? 0),
      water: Number(this.worldScene.cleanWaterAmnt ?? 0),
      seeds: Number(this.worldScene.seeds ?? 0),
      berries: Number(this.worldScene.berries ?? 0),
      wood: Number(this.worldScene.woodAmnt ?? 0),
      stone: Number(this.worldScene.stoneAmnt ?? 0),
      permits: Number(this.worldScene.permits ?? 0),
      money: Number(this.worldScene.money ?? 0),
      needCount,
      housingPlayers: Number(housing.playerCount ?? needCount),
      housingCapacity: Number(housing.capacity ?? 0),
      homelessCount: Number(housing.homelessCount ?? 0),
      housingDescriptor: housing.descriptor ?? "Empty",
    };

    const nextSig = JSON.stringify(snapshot);
    if (!force && nextSig === this._topHudValueSignature) return;
    this._topHudValueSignature = nextSig;

    this._mutateText(this.foodText, (node) => {
      node.setText(`${snapshot.food}/${snapshot.needCount}`);
      node.setColor(snapshot.food >= snapshot.needCount ? "#00ff00" : "#ff3333");
    });
    this._mutateText(this.waterText, (node) => {
      node.setText(`${snapshot.water}/${snapshot.needCount}`);
      node.setColor(snapshot.water >= snapshot.needCount ? "#00ff00" : "#ff3333");
    });
    this._mutateText(this.seedsText, (node) => node.setText(`${snapshot.seeds}`));
    this._mutateText(this.berryText, (node) => node.setText(`${snapshot.berries}`));
    this._mutateText(this.woodText, (node) => node.setText(`${snapshot.wood}`));
    this._mutateText(this.stoneText, (node) => node.setText(`${snapshot.stone}`));
    this._mutateText(this.permitText, (node) => node.setText(`${snapshot.permits}`));
    this._mutateText(this.housingText, (node) => {
      node.setText(`${snapshot.housingPlayers}/${snapshot.housingCapacity}`);
      const housingColor =
        snapshot.homelessCount > 0 ? "#ff6666" :
        snapshot.housingCapacity <= 0 ? "#ff8888" :
        snapshot.housingPlayers >= snapshot.housingCapacity ? "#ffd166" :
        snapshot.housingCapacity - snapshot.housingPlayers === 1 ? "#ffe599" :
        "#8ef0b8";
      node.setColor(housingColor);
    });
    this._mutateText(this.moneyText, (node) => node.setText(`$${snapshot.money}`));
  }

  _buildTownXpHud() {
    if (this.townXpHud) return;

    const root = this.add.container(0, 0).setDepth(UIDEPTH + 14);
    const shadow = this.add.graphics();
    const bg = this.add.graphics();
    const shine = this.add.graphics();
    const track = this.add.graphics();
    const fill = this.add.graphics();
    const fillGlow = this.add.graphics().setAlpha(0.26);
    const badgeBg = this.add.graphics();
    const pendingBg = this.add.graphics();
    const levelText = this.add.text(0, -11, "", {
      fontFamily: "Bungee",
      fontSize: "17px",
      color: "#f6fcff",
      stroke: "#07111b",
      strokeThickness: 4,
    }).setOrigin(0.5);
    const detailText = this.add.text(0, 12, "", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#d9f3ff",
      stroke: "#07111b",
      strokeThickness: 3,
    }).setOrigin(0.5);
    const badgeText = this.add.text(0, 0, "XP", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#0c2b3f",
      stroke: "#f8feff",
      strokeThickness: 2,
    }).setOrigin(0.5);
    const pendingText = this.add.text(0, 0, "", {
      fontFamily: "Bungee",
      fontSize: "9px",
      color: "#12324a",
      stroke: "#fffdf4",
      strokeThickness: 2,
    }).setOrigin(0.5);

    root.add([shadow, bg, shine, track, fillGlow, fill, badgeBg, pendingBg, levelText, detailText, badgeText, pendingText]);
    root.shadow = shadow;
    root.bg = bg;
    root.shine = shine;
    root.track = track;
    root.fill = fill;
    root.fillGlow = fillGlow;
    root.badgeBg = badgeBg;
    root.pendingBg = pendingBg;
    root.levelText = levelText;
    root.detailText = detailText;
    root.badgeText = badgeText;
    root.pendingText = pendingText;
    root.panelWidth = 0;
    root.panelHeight = 0;
    root.trackWidth = 0;
    root.progressRatio = 0;

    const layout = () => {
      const width = Math.round(Phaser.Math.Clamp(this.scale.width * 0.23, 250, 360));
      const height = 60;
      root.panelWidth = width;
      root.panelHeight = height;
      root.trackWidth = Math.max(64, width - 186);
      root.trackLeft = -(width / 2) + 82;

      root.setPosition(Math.round((width / 2) + 18), 76);
      badgeText.setPosition(-(width / 2) + 36, 0);
      levelText.setPosition(6, -11);
      detailText.setPosition(6, 12);
      pendingText.setPosition((width / 2) - 54, 0);

      shadow.clear();
      shadow.fillStyle(0x03101a, 0.28);
      shadow.fillRoundedRect(-(width / 2), -(height / 2) + 8, width, height, 24);

      bg.clear();
      bg.fillStyle(0x113048, 0.94);
      bg.lineStyle(2, 0x9edfff, 0.22);
      bg.fillRoundedRect(-(width / 2), -(height / 2), width, height, 24);
      bg.strokeRoundedRect(-(width / 2), -(height / 2), width, height, 24);

      shine.clear();
      shine.fillStyle(0xffffff, 0.08);
      shine.fillRoundedRect(-(width / 2) + 10, -(height / 2) + 8, width - 20, 18, 12);

      badgeBg.clear();
      badgeBg.fillStyle(0xbbefff, 0.98);
      badgeBg.lineStyle(2, 0xffffff, 0.22);
      badgeBg.fillRoundedRect(-(width / 2) + 14, -16, 44, 32, 16);
      badgeBg.strokeRoundedRect(-(width / 2) + 14, -16, 44, 32, 16);

      pendingBg.clear();
      pendingBg.fillStyle(0xffefc2, 0.94);
      pendingBg.lineStyle(2, 0xffffff, 0.20);
      pendingBg.fillRoundedRect((width / 2) - 88, -14, 68, 28, 14);
      pendingBg.strokeRoundedRect((width / 2) - 88, -14, 68, 28, 14);
    };

    root.refresh = (force = false) => {
      const xp = this.worldScene?.getTownXpSnapshot?.();
      if (!xp) return;

      const signature = [
        this.scale.width,
        xp.level,
        xp.xpIntoLevel,
        xp.xpForNextLevel,
        xp.pendingLevelRewards,
        xp.gainSerial,
      ].join("|");
      if (!force && signature === this._townXpHudSignature) return;
      this._townXpHudSignature = signature;

      layout();

      const progress = Math.max(0, Math.min(1, Number(xp.progress || 0)));
      root.progressRatio = progress;
      const width = root.trackWidth;
      const left = Number.isFinite(root.trackLeft) ? root.trackLeft : (-(width / 2) + 72);
      const top = 7;
      const trackHeight = 16;

      track.clear();
      track.fillStyle(0x0a1a27, 0.82);
      track.lineStyle(2, 0xffffff, 0.10);
      track.fillRoundedRect(left, top, width, trackHeight, 8);
      track.strokeRoundedRect(left, top, width, trackHeight, 8);

      const fillWidth = progress <= 0 ? 0 : Math.max(16, Math.round(width * progress));
      fill.clear();
      if (fillWidth > 0) {
        fill.fillStyle(xp.pendingLevelRewards > 0 ? 0xffd785 : 0x78e6ff, 0.96);
        fill.fillRoundedRect(left + 2, top + 2, Math.min(width - 4, fillWidth), trackHeight - 4, 7);
      }

      fillGlow.clear();
      if (fillWidth > 0) {
        fillGlow.fillStyle(xp.pendingLevelRewards > 0 ? 0xfff1b5 : 0xbdefff, xp.pendingLevelRewards > 0 ? 0.28 : 0.18);
        fillGlow.fillRoundedRect(left + Math.max(4, Math.min(width - 20, fillWidth - 18)), top - 3, 20, trackHeight + 6, 9);
      }

      levelText.setText(`Town Lv. ${xp.level}`);
      detailText.setText(
        xp.pendingLevelRewards > 0
          ? `${xp.xpIntoLevel}/${xp.xpForNextLevel} XP  •  reward ready`
          : `${xp.xpIntoLevel}/${xp.xpForNextLevel} XP to next reward`
      );

      pendingBg.setVisible(xp.pendingLevelRewards > 0);
      pendingText.setVisible(xp.pendingLevelRewards > 0);
      pendingText.setText(
        xp.pendingLevelRewards > 1
          ? `${xp.pendingLevelRewards} READY`
          : "READY"
      );

      if (xp.gainSerial !== this._townXpLastGainSerial) {
        if (this._townXpLastGainSerial !== 0) {
          this._playTownXpGainFx(xp);
        }
        this._townXpLastGainSerial = xp.gainSerial;
      }
    };

    this._trackScaleResize(() => root.refresh(true));
    this.townXpHud = root;
    root.refresh(true);
  }

  _playTownXpGainFx(xp) {
    const root = this.townXpHud;
    if (!root || this._sceneShuttingDown) return;

    this.tweens.killTweensOf(root);
    root.setScale(1);
    this.tweens.add({
      targets: root,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 120,
      ease: "Sine.Out",
      yoyo: true,
    });

    const shouldShowLabel =
      Math.max(0, Number(xp?.lastGainAmount || 0)) >= 8
      || Math.max(0, Number(xp?.pendingLevelRewards || 0)) > 0
      || !/raider defeated/i.test(String(xp?.lastGainLabel || ""));
    if (!shouldShowLabel) return;

    const label = this.add.text(root.x - (root.panelWidth / 2) + 18, root.y - 32, `+${Math.max(0, Number(xp?.lastGainAmount || 0))} XP`, {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: xp?.pendingLevelRewards > 0 ? "#fff0c9" : "#8fe7ff",
      stroke: "#07111b",
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth((UIDEPTH ?? 0) + 16);

    this.tweens.add({
      targets: label,
      y: label.y - 18,
      alpha: 0,
      duration: 640,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  _refreshTownXpHud(force = false) {
    this.townXpHud?.refresh?.(force);
  }

  _ensureTopHudHoverBubble() {
    if (this.topHudHoverBubble) return this.topHudHoverBubble;

    const shadow = this.add.graphics().setDepth(UIDEPTH + 22);
    const bg = this.add.graphics().setDepth(UIDEPTH + 23);
    const shine = this.add.graphics().setDepth(UIDEPTH + 24);
    const text = this.add
      .text(0, 0, "", {
        fontFamily: "Bungee",
        fontSize: "14px",
        color: "#eef8ff",
        stroke: "#07111b",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(UIDEPTH + 25);

    const bubble = this.add.container(0, 0, [shadow, bg, shine, text]).setDepth(UIDEPTH + 22).setVisible(false).setAlpha(0);
    bubble.shadow = shadow;
    bubble.bg = bg;
    bubble.shine = shine;
    bubble.label = text;
    bubble.widthPx = 0;
    bubble.heightPx = 0;
    this.topHudHoverBubble = bubble;
    return bubble;
  }

  _layoutTopHudHoverBubble(label) {
    const bubble = this._ensureTopHudHoverBubble();
    const paddingX = 16;
    const paddingY = 10;
    bubble.label.setText(label).setPosition(0, 0);
    const width = Math.max(98, Math.ceil(bubble.label.width) + paddingX * 2);
    const height = Math.max(38, Math.ceil(bubble.label.height) + paddingY * 2);
    const radius = 14;
    bubble.widthPx = width;
    bubble.heightPx = height;

    bubble.shadow.clear();
    bubble.shadow.fillStyle(0x02060d, 0.30);
    bubble.shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, radius);

    bubble.bg.clear();
    bubble.bg.fillStyle(0x16364d, 0.88);
    bubble.bg.lineStyle(2, 0x7ed7ff, 0.35);
    bubble.bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    bubble.bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

    bubble.shine.clear();
    bubble.shine.fillStyle(0xffffff, 0.08);
    bubble.shine.fillRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, Math.max(10, Math.floor(height * 0.42)), Math.max(8, radius - 4));
  }

  _showTopHudHover(label, anchorX, targetY = 56) {
    const bubble = this._ensureTopHudHoverBubble();
    this._layoutTopHudHoverBubble(label);
    this._topHudHoverHideTimer?.remove?.(false);
    this._topHudHoverHideTimer = null;

    const targetX = Phaser.Math.Clamp(anchorX, bubble.widthPx / 2 + 12, this.scale.width - bubble.widthPx / 2 - 12);

    bubble.setVisible(true);
    bubble.setPosition(targetX, targetY + 4);
    bubble.setScale(0.94);
    bubble.setAlpha(0);
    this.tweens.killTweensOf(bubble);
    this.tweens.add({
      targets: bubble,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: targetY,
      duration: 170,
      ease: "Back.Out",
    });
  }

  _hideTopHudHover(immediate = false) {
    const bubble = this.topHudHoverBubble;
    if (!bubble?.visible) return;
    this._topHudHoverHideTimer?.remove?.(false);
    this._topHudHoverHideTimer = null;
    this.tweens.killTweensOf(bubble);

    if (immediate) {
      bubble.setVisible(false).setAlpha(0);
      return;
    }

    this.tweens.add({
      targets: bubble,
      alpha: 0,
      scaleX: 0.97,
      scaleY: 0.97,
      y: bubble.y - 3,
      duration: 120,
      ease: "Quad.Out",
      onComplete: () => bubble.setVisible(false),
    });
  }

  _bindTopHudHover(target, label) {
    target.on("pointerover", () => {
      const anchorX = target.x + (this.topHud?.x ?? 0);
      const resolvedLabel = typeof label === "function" ? label() : label;
      this._showTopHudHover(resolvedLabel, anchorX);
    });
    target.on("pointerout", () => {
      this._topHudHoverHideTimer?.remove?.(false);
      this._topHudHoverHideTimer = this.time.delayedCall(40, () => this._hideTopHudHover());
    });
  }

  _phaseClockAngleForHour(hour) {
    return Phaser.Math.DegToRad(-90 + (hour / 24) * 360);
  }

  _buildPhaseClockHitPolygon(cx, cy, innerRadius, outerRadius, startHour, endHour, steps = 20) {
    const points = [];
    const pushArc = (radius, fromHour, toHour, reverse = false) => {
      const startAngle = this._phaseClockAngleForHour(reverse ? toHour : fromHour);
      const endAngle = this._phaseClockAngleForHour(reverse ? fromHour : toHour);
      const stepCount = Math.max(2, steps);
      for (let i = 0; i <= stepCount; i++) {
        const t = i / stepCount;
        const angle = startAngle + (endAngle - startAngle) * t;
        points.push(new Phaser.Geom.Point(
          cx + Math.cos(angle) * radius,
          cy + Math.sin(angle) * radius
        ));
      }
    };

    if (endHour <= 24) {
      pushArc(outerRadius, startHour, endHour, false);
      pushArc(innerRadius, endHour, startHour, true);
      return new Phaser.Geom.Polygon(points);
    }

    const wrapEnd = endHour - 24;
    pushArc(outerRadius, startHour, 24, false);
    pushArc(outerRadius, 0, wrapEnd, false);
    pushArc(innerRadius, wrapEnd, 0, true);
    pushArc(innerRadius, 24, startHour, true);
    return new Phaser.Geom.Polygon(points);
  }

  _buildPhaseClock() {
    if (this.phaseClock) return;

    const world = this.worldScene;
    if (!world.clock || typeof world.clock.getPhaseInfo !== "function") {
      world.clock = new Clock(world);
    }

    const PANEL_W = 278;
    const PANEL_H = 104;
    const DIAL_CX = -88;
    const DIAL_CY = 0;
    const OUTER_R = 32;
    const INNER_R = 19;
    const RING_W = OUTER_R - INNER_R + 6;

    const root = this.add.container(0, 0).setDepth(UIDEPTH + 16);
    const shadow = this.add.graphics();
    const bg = this.add.graphics();
    const shine = this.add.graphics();
    const dial = this.add.graphics();
    const hand = this.add.graphics();
    const timeText = this.add.text(-28, -26, "", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#edf7ff",
      stroke: "#07111b",
      strokeThickness: 3,
      align: "left",
    }).setOrigin(0, 0.5);
    const phaseText = this.add.text(-28, 0, "", {
      fontFamily: "Bungee",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#07111b",
      strokeThickness: 4,
      align: "left",
    }).setOrigin(0, 0.5);
    const actionText = this.add.text(-28, 22, "", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#dbeafe",
      stroke: "#07111b",
      strokeThickness: 2,
      align: "left",
      wordWrap: { width: 162 },
    }).setOrigin(0, 0.5);
    const countdownText = this.add.text(-28, 40, "", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#fff7d6",
      stroke: "#07111b",
      strokeThickness: 2,
      align: "left",
      wordWrap: { width: 162 },
    }).setOrigin(0, 0.5);
    const dialCore = this.add.circle(DIAL_CX, DIAL_CY, INNER_R - 1, 0x0f172a, 0.98)
      .setStrokeStyle(2, 0xffffff, 0.12);

    root.add([shadow, bg, shine, dial, hand, dialCore, timeText, phaseText, actionText, countdownText]);

    const phaseSegments = [
      {
        key: "dawn",
        help: "Dawn\nTower income, permits, and queued village rewards.\nParcel buying stays open.",
        ranges: [[6, 7]],
        color: 0x7dd3fc,
      },
      {
        key: "day",
        help: "Day\nBuild, gather, and expand.\nParcel buying is open.",
        ranges: [[7, 16]],
        color: 0x4ade80,
      },
      {
        key: "dusk",
        help: "Dusk\nFinal prep before the coastal assault.\nParcel buying stays open.",
        ranges: [[16, 18]],
        color: 0xfb923c,
      },
      {
        key: "night",
        help: "Night\nSurvive the horde until dawn.\nParcels stay usable all night.",
        ranges: [[18, 30]],
        color: 0xf87171,
      },
    ];

    const hoverZones = [];
    for (const segment of phaseSegments) {
      for (const [startHour, endHour] of segment.ranges) {
        const poly = this._buildPhaseClockHitPolygon(DIAL_CX, DIAL_CY, INNER_R - 4, OUTER_R + 8, startHour, endHour);
        const zone = this.add.zone(0, 0, PANEL_W, PANEL_H)
          .setOrigin(0.5)
          .setInteractive(poly, Phaser.Geom.Polygon.Contains);
        zone.on("pointerover", () => {
          this._showTopHudHover(segment.help, root.x + DIAL_CX, root.y + PANEL_H / 2 + 26);
        });
        zone.on("pointerout", () => {
          this._topHudHoverHideTimer?.remove?.(false);
          this._topHudHoverHideTimer = this.time.delayedCall(40, () => this._hideTopHudHover());
        });
        hoverZones.push(zone);
        root.add(zone);
      }
    }

    const drawPanel = () => {
      shadow.clear();
      shadow.fillStyle(0x02060d, 0.34);
      shadow.fillRoundedRect(-PANEL_W / 2 + 3, -PANEL_H / 2 + 5, PANEL_W, PANEL_H, 20);

      bg.clear();
      bg.fillStyle(0x10283a, 0.86);
      bg.lineStyle(2, 0x89d6ff, 0.28);
      bg.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 20);
      bg.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 20);

      shine.clear();
      shine.fillStyle(0xffffff, 0.08);
      shine.fillRoundedRect(-PANEL_W / 2 + 10, -PANEL_H / 2 + 8, PANEL_W - 20, 26, 12);
    };

    const layout = () => {
      root.setPosition(this.scale.width - PANEL_W / 2 - 18, 36 + PANEL_H / 2 + 8);
      this.phaseClockBottomY = root.y + PANEL_H / 2;
      this.zoomControls?.reposition?.();
    };

    root.refresh = (force = false) => {
      const clock = this.worldScene?.clock;
      if (!clock) return;

      const phase = clock.getPhaseInfo?.() || { label: "DAY", actionText: "", textColor: "#ffffff" };
      const signature = [
        clock.day,
        clock.hours,
        clock.minutes,
        phase.key,
        this.scale.width,
      ].join("|");
      if (!force && signature === root._signature) return;
      root._signature = signature;

      drawPanel();

      const minuteDisplay = String(Math.round(clock.minutes)).padStart(2, "0");
      timeText.setText(`DAY ${clock.day}  ${clock.formatClockFaceTime?.() || `${clock.hours}:${minuteDisplay}`}`);
      phaseText.setText(phase.label || "DAY");
      phaseText.setColor(phase.textColor || "#ffffff");
      actionText.setText(phase.actionText || "");
      countdownText.setText(clock.getPhaseCountdownText?.() || "");

      dial.clear();
      dial.lineStyle(4, 0x0b1220, 0.95);
      dial.strokeCircle(DIAL_CX, DIAL_CY, OUTER_R + 4);
      phaseSegments.forEach((segment) => {
        dial.lineStyle(RING_W, segment.color, phase.key === segment.key ? 0.98 : 0.58);
        segment.ranges.forEach(([startHour, endHour]) => {
          if (endHour <= 24) {
            dial.beginPath();
            dial.arc(DIAL_CX, DIAL_CY, (OUTER_R + INNER_R) / 2, this._phaseClockAngleForHour(startHour), this._phaseClockAngleForHour(endHour), false);
            dial.strokePath();
            return;
          }

          dial.beginPath();
          dial.arc(DIAL_CX, DIAL_CY, (OUTER_R + INNER_R) / 2, this._phaseClockAngleForHour(startHour), this._phaseClockAngleForHour(24), false);
          dial.strokePath();
          dial.beginPath();
          dial.arc(DIAL_CX, DIAL_CY, (OUTER_R + INNER_R) / 2, this._phaseClockAngleForHour(0), this._phaseClockAngleForHour(endHour - 24), false);
          dial.strokePath();
        });
      });

      hand.clear();
      const hourFloat = clock.getHourFloat?.() ?? 0;
      const angle = this._phaseClockAngleForHour(hourFloat);
      const handLen = OUTER_R - 7;
      const handX = DIAL_CX + Math.cos(angle) * handLen;
      const handY = DIAL_CY + Math.sin(angle) * handLen;
      hand.lineStyle(4, 0xf8fafc, 0.95);
      hand.beginPath();
      hand.moveTo(DIAL_CX, DIAL_CY);
      hand.lineTo(handX, handY);
      hand.strokePath();
      hand.fillStyle(0xf8fafc, 1);
      hand.fillCircle(handX, handY, 4);
      hand.fillStyle(0x0f172a, 1);
      hand.fillCircle(DIAL_CX, DIAL_CY, 4);

      this.clockText = timeText;
      this.phaseClockTimeText = timeText;
    };

    layout();
    root.refresh(true);
    this.scale.on("resize", layout);
    this.events.once("shutdown", () => {
      this.scale.off("resize", layout);
      hoverZones.forEach((zone) => zone.destroy());
    });

    this.phaseClock = root;
  }

  _refreshPhaseClock(force = false) {
    this.phaseClock?.refresh?.(force);
  }

  _buildStageMetaHud() {
    if (this.stageMetaText) return;
    this._teardownStageMetaHud();

    const panelY = 42;
    const panelX = 12;

    this.stageMetaText = this.add.text(panelX, panelY, "", {
      fontFamily: "Bungee",
      fontSize: "18px",
      color: "#f6f0ff",
      stroke: "#000000",
      strokeThickness: 4,
      align: "left",
    }).setOrigin(0, 0).setDepth(UIDEPTH + 1);

    this.stageMetaSubText = this.add.text(panelX, panelY + 54, "", {
      fontFamily: "Bungee",
      fontSize: "11px",
      color: "#ffe8b8",
      stroke: "#000000",
      strokeThickness: 3,
      align: "left",
    }).setOrigin(0, 0).setDepth(UIDEPTH + 1);

    const recompute = () => {
      if (this._sceneShuttingDown) return;
      const stage = Math.max(1, Number(StageState.stageIndex || 1));
      const nextUnlock = getNextHordeUnlock(stage);
      const preview = this.worldScene?.getUpcomingHordePreviewSummary?.() ?? null;
      const line1 = `\uD83C\uDFF9 Endless Run`;
      const line2 = `\uD83D\uDD25 Horde ${stage}`;
      const didUpdatePrimary = this._mutateText(this.stageMetaText, (node) => {
        node.setText(`${line1}\n${line2}`);
        node.setColor("#f6f0ff");
      });
      if (!didUpdatePrimary) return;
      const nextUnlockText = nextUnlock
        ? `NEXT UNLOCK  H${nextUnlock.hordeIndex}: ${String(nextUnlock.displayLabel || "").toUpperCase()}`
        : "ALL EARLY HORDE UNLOCKS EARNED";
      const previewText = preview
        ? [
            `${String(preview.headline || "COASTAL ASSAULT TONIGHT").toUpperCase()}  H${preview.hordeIndex}`,
            `${Math.max(0, Number(preview.totalEnemies || 0))} ${String(preview.enemyLabel || "RAIDERS").toUpperCase()}${preview.modifierLabel ? `  ${String(preview.modifierLabel).toUpperCase()}` : ""}`,
            preview.countdownText ? String(preview.countdownText).toUpperCase() : null,
          ].filter(Boolean).join("\n")
        : null;
      this._mutateText(this.stageMetaSubText, (node) => {
        node.setText([nextUnlockText, previewText].filter(Boolean).join("\n"));
      });
    };

    this._stageMetaRecompute = recompute;
    recompute();
    this.worldScene?.events?.on?.("stage:changed", this._stageMetaRecompute);

    this._stageMetaRefreshTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: recompute,
    });

    this._trackScaleResize(() => {
      this.stageMetaText?.setPosition(panelX, panelY);
      this.stageMetaSubText?.setPosition(panelX, panelY + 54);
    });
  }

  _buildZoomControls() {
    if (this.zoomControls) return;

    const BTN_SIZE = 48;
    const GAP = 8;
    const RIGHT_MARGIN = 18;
    const ACTIVE_ALPHA = 0.92;
    const IDLE_ALPHA = 0.68;
    const DISABLED_ALPHA = 0.32;

    const root = this.add.container(0, 0).setDepth(UIDEPTH + 12);
    const setButtonAlpha = (btn) => {
      btn.setAlpha(btn.disabled ? DISABLED_ALPHA : btn.active ? ACTIVE_ALPHA : IDLE_ALPHA);
    };

    const makeBtn = (label, { fontSize = "20px" } = {}) => {
      const bg = this.add
        .rectangle(0, 0, BTN_SIZE, BTN_SIZE, 0x0f172a, 0.8)
        .setStrokeStyle(2, 0xe5e7eb, 0.28)
        .setInteractive({ useHandCursor: true });

      const txt = this.add
        .text(0, 0, label, {
          fontFamily: "Bungee",
          fontSize,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      const btn = this.add.container(0, 0, [bg, txt]).setSize(BTN_SIZE, BTN_SIZE).setAlpha(IDLE_ALPHA);
      btn.bg = bg;
      btn.label = txt;
      btn.active = false;
      btn.disabled = false;
      btn.refreshAlpha = () => setButtonAlpha(btn);

      bg.on("pointerover", () => {
        if (btn.disabled) return;
        btn.setAlpha(ACTIVE_ALPHA);
      });
      bg.on("pointerout", () => {
        btn.refreshAlpha?.();
      });

      return btn;
    };

    const applyButtonState = (btn, { disabled = false, active = false, activeLabelColor = "#ffffff" } = {}) => {
      btn.disabled = disabled;
      btn.active = active;

      if (disabled) {
        if (btn._interactiveDisabled !== true) {
          btn.bg.disableInteractive();
          btn._interactiveDisabled = true;
        }
      } else if (btn._interactiveDisabled === true) {
        btn.bg.setInteractive({ useHandCursor: true });
        btn._interactiveDisabled = false;
      }

      const fillColor = disabled ? 0x1f2937 : active ? 0x172554 : 0x0f172a;
      const fillAlpha = disabled ? 0.6 : active ? 0.92 : 0.8;
      const strokeColor = disabled ? 0x9ca3af : active ? 0x93c5fd : 0xe5e7eb;
      const strokeAlpha = disabled ? 0.18 : active ? 0.58 : 0.28;

      btn.bg.setFillStyle(fillColor, fillAlpha);
      btn.bg.setStrokeStyle(2, strokeColor, strokeAlpha);
      btn.label.setAlpha(disabled ? 0.55 : 1);
      btn.label.setColor(disabled ? "#d1d5db" : active ? activeLabelColor : "#ffffff");
      btn.refreshAlpha?.();
    };

    const zoomInBtn = makeBtn("+");
    const zoomOutBtn = makeBtn("-");
    const speedButtons = [
      { label: "1x", speed: 1 },
      { label: "2x", speed: 2 },
      { label: "4x", speed: 4 },
    ].map(({ label, speed }) => {
      const btn = makeBtn(label, { fontSize: "16px" });
      btn.speedMultiplier = speed;
      return btn;
    });

    zoomInBtn.setPosition(0, 0);
    zoomOutBtn.setPosition(0, BTN_SIZE + GAP);
    speedButtons.forEach((btn, index) => {
      btn.setPosition(-(BTN_SIZE + GAP) * (speedButtons.length - index), 0);
    });
    root.add([...speedButtons, zoomInBtn, zoomOutBtn]);

    const positionControls = () => {
      const y = Math.max(104, (this.phaseClockBottomY ?? 104) + 30);
      root.setPosition(this.scale.width - RIGHT_MARGIN - (BTN_SIZE / 2), y);
    };
    positionControls();
    this.scale.on("resize", positionControls);

    const triggerZoom = (targetZoom) => {
      const world = this.worldScene;
      const mixer = world?.zoomMixer;
      if (!mixer) return;
      if (mixer.zoomOutLocked || world?.stageCompleteLock) return;
      mixer.targetZoom = targetZoom;
      mixer.smoothCenterZoomTo(targetZoom);
    };

    zoomInBtn.bg.on("pointerdown", () => triggerZoom(1));
    zoomOutBtn.bg.on("pointerdown", () => triggerZoom(this.worldScene?.zoomMixer?.MIN_ZOOM ?? 0.3));
    speedButtons.forEach((btn) => {
      btn.bg.on("pointerdown", () => {
        this.worldScene?.setSimulationSpeed?.(btn.speedMultiplier);
      });
    });

    root.updateState = () => {
      const world = this.worldScene;
      const zoomDisabled = !!(world?.zoomMixer?.zoomOutLocked || world?.stageCompleteLock);
      const speedDisabled = !!(!world || world.stageCompleteLock);
      const selectedSpeed = world?.getSimulationSpeed?.() ?? 1;

      applyButtonState(zoomInBtn, { disabled: zoomDisabled });
      applyButtonState(zoomOutBtn, { disabled: zoomDisabled });
      speedButtons.forEach((btn) => {
        applyButtonState(btn, {
          disabled: speedDisabled,
          active: selectedSpeed === btn.speedMultiplier,
          activeLabelColor: "#dbeafe",
        });
      });
    };

    root.reposition = positionControls;
    root.updateState();
    this.zoomControls = root;
    this.events.once("shutdown", () => {
      this.scale.off("resize", positionControls);
    });
  }

  _buildRaiderEdgeHud() {
    if (this.raiderEdgeHud) return;
    this.raiderEdgeHud = this.add.container(0, 0).setDepth(UIDEPTH + 30);
    this.raiderEdgeIndicators = new Map();
  }

  _isDetailedMode() {
    return (this.worldScene?.zoomMixer?.mode ?? "detailed") === "detailed";
  }

  _getRaiderIndicatorBounds() {
    const top = Math.max(78, Math.round((this.phaseClockBottomY ?? 106) + 10));
    return {
      left: 48,
      right: Math.max(48, this.scale.width - 48),
      top,
      bottom: Math.max(top + 24, this.scale.height - 104),
    };
  }

  _createRaiderEdgeIndicator(key) {
    const root = this.add.container(0, 0).setDepth(UIDEPTH + 18);
    const shadow = this.add.circle(0, 3, 25, 0x02060d, 0.34);
    const plate = this.add.circle(0, 0, 23, 0x7f1d1d, 0.94)
      .setStrokeStyle(3, 0xfca5a5, 0.9);
    const portrait = this.add.sprite(0, 0, "__WHITE").setOrigin(0.5);
    const arrow = this.add.text(0, 0, "▲", {
      fontFamily: "Bungee",
      fontSize: "16px",
      color: "#fff5f5",
      stroke: "#190505",
      strokeThickness: 4,
    }).setOrigin(0.5);
    arrow.setText("^").setFontSize("20px");
    const badge = this.add.circle(15, 15, 10, 0x111827, 0.96)
      .setStrokeStyle(2, 0xffffff, 0.28);
    const badgeText = this.add.text(15, 15, "1", {
      fontFamily: "Bungee",
      fontSize: "11px",
      color: "#f8fafc",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    root.add([shadow, plate, portrait, arrow, badge, badgeText]);
    root.setVisible(false);

    const indicator = {
      key,
      root,
      shadow,
      plate,
      portrait,
      arrow,
      badge,
      badgeText,
    };

    this.raiderEdgeHud?.add?.(root);
    this.raiderEdgeIndicators.set(key, indicator);
    return indicator;
  }

  _destroyRaiderEdgeIndicator(key) {
    const indicator = this.raiderEdgeIndicators?.get?.(key);
    if (!indicator) return;
    indicator.root?.destroy?.(true);
    this.raiderEdgeIndicators.delete(key);
  }

  _getOffscreenRaiderGroups() {
    const world = this.worldScene;
    const cam = world?.cameras?.main;
    if (!world || !cam || !this._isDetailedMode()) return [];

    const bounds = this._getRaiderIndicatorBounds();
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;
    const enemyTroops = Teams.teamLists?.["0"]?.playerList || [];
    const groups = new Map();

    const projectToEdge = (screenX, screenY) => {
      let dx = screenX - centerX;
      let dy = screenY - centerY;
      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) dy = -1;

      let bestT = Number.POSITIVE_INFINITY;
      let side = "right";

      if (dx > 0.001) {
        const t = (bounds.right - centerX) / dx;
        if (t < bestT) {
          bestT = t;
          side = "right";
        }
      }
      if (dx < -0.001) {
        const t = (bounds.left - centerX) / dx;
        if (t < bestT) {
          bestT = t;
          side = "left";
        }
      }
      if (dy > 0.001) {
        const t = (bounds.bottom - centerY) / dy;
        if (t < bestT) {
          bestT = t;
          side = "bottom";
        }
      }
      if (dy < -0.001) {
        const t = (bounds.top - centerY) / dy;
        if (t < bestT) {
          bestT = t;
          side = "top";
        }
      }

      return {
        x: Phaser.Math.Clamp(centerX + dx * bestT, bounds.left, bounds.right),
        y: Phaser.Math.Clamp(centerY + dy * bestT, bounds.top, bounds.bottom),
        angle: Math.atan2(dy, dx),
        side,
      };
    };

    for (const troop of enemyTroops) {
      if (!troop?.active) continue;
      if (!troop?.isRaider && !troop?.isFortGrunt) continue;

      const screenX = (troop.x - cam.worldView.x) * cam.zoom;
      const screenY = (troop.y - cam.worldView.y) * cam.zoom;
      const inView = screenX >= 0 && screenX <= this.scale.width && screenY >= 0 && screenY <= this.scale.height;
      if (inView) continue;

      const edge = projectToEdge(screenX, screenY);
      const axisValue = (edge.side === "left" || edge.side === "right") ? edge.y : edge.x;
      const bucket = Math.round(axisValue / 68);
      const key = `${edge.side}:${bucket}`;
      const portraitKey = getPlayerPortraitKey(troop);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          side: edge.side,
          x: edge.x,
          y: edge.y,
          angle: edge.angle,
          axisValue,
          count: 0,
          nearestDistSq: Number.POSITIVE_INFINITY,
          portraitKey,
        });
      }

      const group = groups.get(key);
      group.count += 1;
      group.x += edge.x;
      group.y += edge.y;
      group.axisValue += axisValue;

      const distSq = Phaser.Math.Distance.Squared(troop.x, troop.y, cam.midPoint.x, cam.midPoint.y);
      if (distSq < group.nearestDistSq) {
        group.nearestDistSq = distSq;
        group.angle = edge.angle;
        group.portraitKey = portraitKey;
      }
    }

    const results = Array.from(groups.values()).map((group) => ({
      ...group,
      x: group.x / group.count,
      y: group.y / group.count,
      axisValue: group.axisValue / group.count,
    }));

    const minGap = 72;
    const spreadSide = (side, axisMin, axisMax) => {
      const sideGroups = results
        .filter((group) => group.side === side)
        .sort((a, b) => a.axisValue - b.axisValue);

      for (let i = 1; i < sideGroups.length; i++) {
        sideGroups[i].axisValue = Math.max(sideGroups[i].axisValue, sideGroups[i - 1].axisValue + minGap);
      }

      const overflow = sideGroups.length
        ? sideGroups[sideGroups.length - 1].axisValue - axisMax
        : 0;

      if (overflow > 0) {
        for (let i = sideGroups.length - 1; i >= 0; i--) {
          sideGroups[i].axisValue -= overflow;
          if (i > 0 && sideGroups[i].axisValue - sideGroups[i - 1].axisValue < minGap) {
            sideGroups[i - 1].axisValue = sideGroups[i].axisValue - minGap;
          }
        }
      }

      sideGroups.forEach((group) => {
        group.axisValue = Phaser.Math.Clamp(group.axisValue, axisMin, axisMax);
        if (side === "left" || side === "right") group.y = group.axisValue;
        else group.x = group.axisValue;
      });
    };

    spreadSide("left", bounds.top, bounds.bottom);
    spreadSide("right", bounds.top, bounds.bottom);
    spreadSide("top", bounds.left, bounds.right);
    spreadSide("bottom", bounds.left, bounds.right);

    return results;
  }

  _hideAllRaiderEdgeIndicators() {
    this.raiderEdgeIndicators?.forEach((indicator) => {
      indicator.root?.setVisible(false);
    });
  }

  _updateRaiderEdgeHud() {
    if (!this.raiderEdgeHud) return;
    if (!this._isDetailedMode()) {
      this.raiderEdgeHud.setVisible(false);
      this._hideAllRaiderEdgeIndicators();
      return;
    }

    const groups = this._getOffscreenRaiderGroups();
    if (!groups.length) {
      this.raiderEdgeHud.setVisible(false);
      this._hideAllRaiderEdgeIndicators();
      return;
    }

    this.raiderEdgeHud.setVisible(true);
    const seen = new Set();

    groups.forEach((group) => {
      const indicator = this.raiderEdgeIndicators?.get?.(group.key) || this._createRaiderEdgeIndicator(group.key);
      seen.add(group.key);

      applyPortraitKeyToSprite(this, indicator.portrait, group.portraitKey, 42);
      indicator.root.setVisible(true).setAlpha(1).setScale(1);
      indicator.root.setPosition(group.x, group.y);
      indicator.shadow.setScale(1.5).setFillStyle(0x02060d, 0.42);
      indicator.plate.setScale(1.34).setFillStyle(0x09111b, 0.96).setStrokeStyle(4, 0xfca5a5, 1);
      indicator.arrow.setColor("#fff7f7").setFontSize("26px").setStroke("#190505", 5);
      indicator.arrow.setPosition(Math.cos(group.angle) * 42, Math.sin(group.angle) * 42);
      indicator.arrow.setAngle(Phaser.Math.RadToDeg(group.angle) + 90);

      const showBadge = group.count > 1;
      indicator.badge.setVisible(showBadge).setPosition(22, 22).setScale(1.15);
      indicator.badgeText.setVisible(showBadge).setPosition(22, 22).setFontSize("13px");
      if (showBadge) {
        indicator.badgeText.setText(`${group.count}`);
      }
    });

    this.raiderEdgeIndicators?.forEach((indicator, key) => {
      if (seen.has(key)) return;
      indicator.root?.setVisible(false);
    });
  }

  _syncUiAnimationTimeScale() {
    const appliedSpeed = this.worldScene?.getAppliedSimulationSpeed?.() ?? 1;
    if (appliedSpeed <= 1 && this._uiAnimationCompSpeed === appliedSpeed) return;

    const localSpeed = appliedSpeed > 0 ? 1 / appliedSpeed : 1;
    const visit = (node) => {
      if (!node) return;
      if (node.anims) {
        if (typeof node.anims.setTimeScale === "function") node.anims.setTimeScale(localSpeed);
        else if ("timeScale" in node.anims) node.anims.timeScale = localSpeed;
      }
      if (Array.isArray(node.list)) node.list.forEach(visit);
    };

    this.children.list.forEach(visit);
    this._uiAnimationCompSpeed = appliedSpeed;
  }

  _buildContractHud() {
    if (this.contractHud) return;
    this.contractHud = new ContractHud(this);
  }

  _buildSelectionCommandBar() {
    if (this.selectionCommandBar) return;
    this.selectionCommandBar = new SelectionCommandBar(this);
  }
  _ghostAt(targetText, content, color) {
    if (this._sceneShuttingDown || !this._canMutateText(targetText)) return;
    const ghost = this.add
      .text(targetText.x, targetText.y, content, { fontSize: "18px", fill: color })
      .setOrigin(0, 0)
      .setDepth(UIDEPTH);
    this.tweens.add({
      targets: ghost,
      y: ghost.y - 20,
      alpha: 0,
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => ghost.destroy(),
    });
  }

  _drawRoundedPanel(target, width, height, opts = {}) {
    const radius = Math.max(10, Math.round(Number(opts.radius ?? 24) || 24));
    const fillColor = opts.fillColor ?? 0x10263b;
    const fillAlpha = opts.fillAlpha ?? 0.98;
    const strokeColor = opts.strokeColor ?? 0xffffff;
    const strokeAlpha = opts.strokeAlpha ?? 0.18;
    const strokeWidth = Math.max(1, Math.round(Number(opts.strokeWidth ?? 2) || 2));
    const shadowColor = opts.shadowColor ?? 0x04101a;
    const shadowAlpha = opts.shadowAlpha ?? 0.26;
    const shadowOffsetY = Number(opts.shadowOffsetY ?? 10) || 0;

    target.clear();

    if (shadowAlpha > 0) {
      target.fillStyle(shadowColor, shadowAlpha);
      target.fillRoundedRect(-width / 2, (-height / 2) + shadowOffsetY, width, height, radius);
    }

    target.fillStyle(fillColor, fillAlpha);
    target.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

    if (opts.topStripColor != null) {
      const stripHeight = Math.max(8, Math.round(Number(opts.topStripHeight ?? 10) || 10));
      target.fillStyle(opts.topStripColor, opts.topStripAlpha ?? 1);
      target.fillRoundedRect(-width / 2, -height / 2, width, stripHeight, Math.max(6, Math.min(radius, stripHeight)));
    }

    if (strokeAlpha > 0) {
      target.lineStyle(strokeWidth, strokeColor, strokeAlpha);
      target.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    }

    return target;
  }

  _stopRewardChestTimer(sprite) {
    if (!sprite?._frameTimer) return;
    sprite._frameTimer.remove(false);
    sprite._frameTimer = null;
  }

  _animateRewardChest(sprite, toFrame = 0) {
    if (!sprite?.active) return;
    const current = Number(sprite.frame?.name ?? sprite.frame?.textureFrame ?? 0) || 0;
    if (current === toFrame) return;

    this._stopRewardChestTimer(sprite);
    const dir = toFrame > current ? 1 : -1;

    sprite._frameTimer = this.time.addEvent({
      delay: 45,
      loop: true,
      callback: () => {
        if (!sprite?.active) {
          this._stopRewardChestTimer(sprite);
          return;
        }
        const frameNow = Number(sprite.frame?.name ?? sprite.frame?.textureFrame ?? 0) || 0;
        const next = frameNow + dir;
        sprite.setFrame(next);
        if (next === toFrame) {
          this._stopRewardChestTimer(sprite);
        }
      },
    });
  }

  _buildTownXpRewardVisual(option, cardWidth, cardHeight, accent, destroyers = []) {
    const nodes = [];
    const hoverIn = [];
    const hoverOut = [];
    let onSelect = null;
    let selectDelayMs = 0;
    const visualTop = -(cardHeight / 2) + 82;

    if (option?.presentationType === "card") {
      const frameWrap = this.add.container(0, visualTop);
      const hasCardFrame = this.textures.exists("reward_mini_card");
      const plateShadow = this.add.image(4, 8, hasCardFrame ? "reward_mini_card" : "__WHITE")
        .setAlpha(hasCardFrame ? 0.18 : 0.10)
        .setTint(0x04101a);
      const plate = this.add.image(0, 0, hasCardFrame ? "reward_mini_card" : "__WHITE")
        .setTint(accent)
        .setAlpha(hasCardFrame ? 0.98 : 0.18);
      if (hasCardFrame) {
        plateShadow.setDisplaySize(134, 156);
        plate.setDisplaySize(134, 156);
      } else {
        plateShadow.setDisplaySize(130, 154);
        plate.setDisplaySize(130, 154);
      }
      const iconPlate = this.add.circle(0, -30, 28, 0x0f2031, 0.92)
        .setStrokeStyle(2, 0xffffff, 0.18);
      const icon = this.add.image(0, -30, option?.cardImageKey || "__WHITE")
        .setDisplaySize(42, 42);
      const cardName = this.add.text(0, 18, String(option?.title || "Card"), {
        fontFamily: "Bungee",
        fontSize: "10px",
        color: "#fffaf0",
        stroke: "#08131d",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: 106 },
      }).setOrigin(0.5);
      const cardText = this.add.text(0, 62, String(option?.cardText || option?.subtitle || ""), {
        fontFamily: "Bungee",
        fontSize: "8px",
        color: "#dbeeff",
        stroke: "#08131d",
        strokeThickness: 2,
        align: "center",
        wordWrap: { width: 110 },
        lineSpacing: 4,
      }).setOrigin(0.5);
      frameWrap.add([plateShadow, plate, iconPlate, icon, cardName, cardText]);
      nodes.push(frameWrap);

      hoverIn.push(() => {
        this.tweens.add({
          targets: frameWrap,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 140,
          ease: "Quad.Out",
        });
      });
      hoverOut.push(() => {
        this.tweens.add({
          targets: frameWrap,
          scaleX: 1,
          scaleY: 1,
          duration: 140,
          ease: "Quad.Out",
        });
      });
    } else if (option?.presentationType === "recruit") {
      const glow = this.add.circle(0, visualTop + 6, 58, accent, 0.14);
      const plate = this.add.circle(0, visualTop + 6, 48, 0x10263b, 0.96)
        .setStrokeStyle(2, accent, 0.36);
      const portrait = this.add.sprite(0, visualTop + 8, option?.portraitKey || "__WHITE").setOrigin(0.5);
      applyPortraitKeyToSprite(this, portrait, option?.portraitKey, 84);
      const recruitText = this.add.text(0, visualTop + 74, "Free Recruit", {
        fontFamily: "Bungee",
        fontSize: "10px",
        color: "#fff4d6",
        stroke: "#08131d",
        strokeThickness: 3,
        align: "center",
      }).setOrigin(0.5);
      nodes.push(glow, plate, portrait, recruitText);

      hoverIn.push(() => {
        this.tweens.add({
          targets: [glow, portrait],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 140,
          ease: "Quad.Out",
        });
      });
      hoverOut.push(() => {
        this.tweens.add({
          targets: [glow, portrait],
          scaleX: 1,
          scaleY: 1,
          duration: 140,
          ease: "Quad.Out",
        });
      });
    } else if (option?.presentationType === "chest") {
      const glow = this.add.circle(0, visualTop + 6, 62, accent, 0.14);
      const chest = this.add.sprite(0, visualTop + 2, "reward_treasure_chest", 0)
        .setScale(0.94);
      const contents = Array.isArray(option?.chestContents) ? option.chestContents.slice(0, 3) : [];
      const chipGap = 54;
      contents.forEach((entry, index) => {
        const chipX = (index - ((contents.length - 1) / 2)) * chipGap;
        const chipBg = this.add.circle(chipX, visualTop + 72, 16, 0x0d2334, 0.96)
          .setStrokeStyle(2, 0xffffff, 0.12);
        const icon = this.add.image(chipX, visualTop + 72, entry?.key || "__WHITE")
          .setDisplaySize(18, 18);
        const amount = this.add.text(chipX + 16, visualTop + 82, `x${Math.max(0, Number(entry?.amount || 0))}`, {
          fontFamily: "Bungee",
          fontSize: "8px",
          color: "#fff7e6",
          stroke: "#08131d",
          strokeThickness: 2,
        }).setOrigin(0, 0.5);
        nodes.push(chipBg, icon, amount);
      });
      nodes.push(glow, chest);
      destroyers.push(() => this._stopRewardChestTimer(chest));

      hoverIn.push(() => {
        this._animateRewardChest(chest, 4);
        this.tweens.add({
          targets: [glow, chest],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 140,
          ease: "Quad.Out",
        });
      });
      hoverOut.push(() => {
        this._animateRewardChest(chest, 0);
        this.tweens.add({
          targets: [glow, chest],
          scaleX: 1,
          scaleY: 1,
          duration: 140,
          ease: "Quad.Out",
        });
      });
      onSelect = () => {
        this._animateRewardChest(chest, 4);
        this.tweens.add({
          targets: glow,
          alpha: 0.24,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 160,
          ease: "Quad.Out",
        });
      };
      selectDelayMs = 180;
    }

    return { nodes, hoverIn, hoverOut, onSelect, selectDelayMs };
  }

  _destroyTownXpRewardPresentation() {
    if (!this._townXpRewardPresentation) return;
    const { root, destroyers = [] } = this._townXpRewardPresentation;
    destroyers.forEach((fn) => {
      try {
        fn?.();
      } catch {}
    });
    root?.destroy?.(true);
    this._townXpRewardPresentation = null;
  }

  showTownXpRewardPresentation({ level = 1, xpSnapshot = null, options = [], onChoose, onCancel } = {}) {
    this._destroyTownXpRewardPresentation();

    const cam = this.cameras.main;
    const root = this.add.container(0, 0).setDepth((UIDEPTH ?? 2000) + 4200).setScrollFactor(0);
    const destroyers = [];
    let completed = false;

    const cleanup = () => {
      if (!this._townXpRewardPresentation) return;
      destroyers.forEach((fn) => {
        try {
          fn?.();
        } catch {}
      });
      this._townXpRewardPresentation = null;
      root.destroy(true);
    };

    const shade = this.add.rectangle(0, 0, cam.width, cam.height, 0x071726, 0.72)
      .setOrigin(0)
      .setInteractive({ useHandCursor: false })
      .setScrollFactor(0);
    const bloomA = this.add.circle(cam.width * 0.24, cam.height * 0.26, 210, 0x6dd3f5, 0.10).setScrollFactor(0);
    const bloomB = this.add.circle(cam.width * 0.78, cam.height * 0.66, 250, 0xfff0c9, 0.10).setScrollFactor(0);

    const panelWidth = Math.min(1000, cam.width - 110);
    const panelHeight = Math.min(620, cam.height - 90);
    const panel = this.add.container(cam.centerX, cam.centerY + 10).setAlpha(0).setScale(0.94).setScrollFactor(0);
    const panelBg = this.add.graphics();
    this._drawRoundedPanel(panelBg, panelWidth, panelHeight, {
      radius: 34,
      fillColor: 0x113048,
      fillAlpha: 0.97,
      strokeColor: 0xdff7ff,
      strokeAlpha: 0.20,
      shadowColor: 0x04101a,
      shadowAlpha: 0.34,
      shadowOffsetY: 16,
      topStripColor: 0xffffff,
      topStripAlpha: 0.08,
      topStripHeight: 18,
    });
    panel.add(panelBg);

    const badgeBg = this.add.graphics();
    this._drawRoundedPanel(badgeBg, 248, 42, {
      radius: 20,
      fillColor: 0xb7efff,
      fillAlpha: 0.98,
      strokeColor: 0xffffff,
      strokeAlpha: 0.18,
      shadowAlpha: 0.12,
      shadowOffsetY: 6,
    });
    badgeBg.setPosition(0, -(panelHeight / 2) + 50);
    const badgeText = this.add.text(0, badgeBg.y, "TOWN LEVEL REWARD", {
      fontFamily: "Bungee",
      fontSize: "16px",
      color: "#0c2b3f",
      stroke: "#f8feff",
      strokeThickness: 2,
    }).setOrigin(0.5);

    const title = this.add.text(0, -(panelHeight / 2) + 112, `Village Level ${Math.max(1, Number(level || 1))}!`, {
      fontFamily: "Bungee",
      fontSize: "34px",
      color: "#fff7e6",
      stroke: "#08131d",
      strokeThickness: 6,
      align: "center",
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, title.y + 44, "Pick one bright little boost for the next stretch of this run.", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#d8f3ff",
      stroke: "#08131d",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: panelWidth - 160 },
    }).setOrigin(0.5);
    const progressLine = this.add.text(0, subtitle.y + 30, `Current XP: ${Math.max(0, Number(xpSnapshot?.xpIntoLevel || 0))}/${Math.max(1, Number(xpSnapshot?.xpForNextLevel || 1))}`, {
      fontFamily: "Bungee",
      fontSize: "11px",
      color: "#ffe8b8",
      stroke: "#08131d",
      strokeThickness: 3,
      align: "center",
    }).setOrigin(0.5);

    const chooseOption = (option, entry = null) => {
      if (completed) return;
      completed = true;
      optionCards.forEach((candidate) => candidate.hit.disableInteractive());
      entry?.onSelect?.();
      const finishChoice = () => {
        this.tweens.add({
          targets: panel,
          alpha: 0,
          scaleX: 0.96,
          scaleY: 0.96,
          duration: 180,
          ease: "Cubic.easeIn",
          onComplete: () => {
            try {
              onChoose?.(option);
            } finally {
              cleanup();
            }
          },
        });
      };
      const delayMs = Math.max(0, Number(entry?.selectDelayMs || 0));
      if (delayMs > 0) {
        this.time.delayedCall(delayMs, finishChoice);
      } else {
        finishChoice();
      }
    };

    const optionCards = [];
    const cardY = 70;
    const cardSpacing = Math.min(300, Math.floor((panelWidth - 150) / Math.max(1, options.length)));
    const startX = -((Math.max(0, options.length - 1)) * cardSpacing) / 2;
    const cardWidth = Math.min(250, Math.floor((panelWidth - 140) / Math.max(1, options.length)));
    const cardHeight = Math.min(320, panelHeight - 250);

    options.forEach((option, index) => {
      const x = startX + (index * cardSpacing);
      const accent = option?.accentColor ?? 0x8fe7ff;
      const card = this.add.container(x, cardY + 34).setAlpha(0).setScale(0.92);
      const shadow = this.add.graphics();
      const bg = this.add.graphics();
      const glow = this.add.graphics();
      const tagBg = this.add.graphics();
      const selectBg = this.add.graphics();
      const visual = this._buildTownXpRewardVisual(option, cardWidth, cardHeight, accent, destroyers);

      const drawCard = (hovered = false) => {
        this._drawRoundedPanel(bg, cardWidth, cardHeight, {
          radius: 28,
          fillColor: option?.panelColor ?? 0x17334a,
          fillAlpha: hovered ? 0.99 : 0.96,
          strokeColor: accent,
          strokeAlpha: hovered ? 0.44 : 0.22,
          strokeWidth: hovered ? 3 : 2,
          shadowColor: 0x04101a,
          shadowAlpha: hovered ? 0.34 : 0.24,
          shadowOffsetY: hovered ? 14 : 10,
          topStripColor: accent,
          topStripAlpha: hovered ? 0.26 : 0.18,
          topStripHeight: 14,
        });

        glow.clear();
        glow.fillStyle(accent, hovered ? 0.12 : 0.07);
        glow.fillRoundedRect(-(cardWidth / 2) + 14, -(cardHeight / 2) + 52, cardWidth - 28, 74, 20);

        tagBg.clear();
        this._drawRoundedPanel(tagBg, 126, 32, {
          radius: 16,
          fillColor: accent,
          fillAlpha: 0.98,
          strokeColor: 0xffffff,
          strokeAlpha: 0.18,
          shadowAlpha: 0.10,
          shadowOffsetY: 5,
        });
        tagBg.setPosition(0, -(cardHeight / 2) + 34);

        selectBg.clear();
        this._drawRoundedPanel(selectBg, 130, 42, {
          radius: 18,
          fillColor: hovered ? 0xbff4ff : 0x93eaff,
          fillAlpha: 0.98,
          strokeColor: 0xffffff,
          strokeAlpha: hovered ? 0.28 : 0.18,
          shadowColor: accent,
          shadowAlpha: hovered ? 0.18 : 0.10,
          shadowOffsetY: 6,
        });
        selectBg.setPosition(0, (cardHeight / 2) - 38);
      };

      const tagText = this.add.text(0, -(cardHeight / 2) + 34, String(option?.badgeLabel || "REWARD"), {
        fontFamily: "Bungee",
        fontSize: "12px",
        color: "#0c2b3f",
        stroke: "#f8feff",
        strokeThickness: 2,
      }).setOrigin(0.5);
      const titleText = this.add.text(0, 6, String(option?.title || "Reward"), {
        fontFamily: "Bungee",
        fontSize: "18px",
        color: "#fff7e6",
        stroke: "#08131d",
        strokeThickness: 4,
        align: "center",
        wordWrap: { width: cardWidth - 34 },
      }).setOrigin(0.5);
      const subtitleText = this.add.text(0, 54, String(option?.subtitle || ""), {
        fontFamily: "Bungee",
        fontSize: "11px",
        color: "#d7efff",
        stroke: "#08131d",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: cardWidth - 42 },
        lineSpacing: 6,
      }).setOrigin(0.5);
      const hintText = this.add.text(0, 100, String(option?.hint || ""), {
        fontFamily: "Bungee",
        fontSize: "10px",
        color: "#ffe9c7",
        stroke: "#08131d",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: cardWidth - 44 },
        lineSpacing: 6,
      }).setOrigin(0.5);
      const selectText = this.add.text(0, (cardHeight / 2) - 38, "Choose", {
        fontFamily: "Bungee",
        fontSize: "15px",
        color: "#0c2b3f",
        stroke: "#f8feff",
        strokeThickness: 2,
      }).setOrigin(0.5);

      const hit = this.add.rectangle(0, 0, cardWidth, cardHeight, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });

      drawCard(false);
      hit.on("pointerover", () => {
        drawCard(true);
        visual.hoverIn?.forEach((fn) => fn?.());
        this.tweens.add({
          targets: card,
          y: cardY + 22,
          duration: 140,
          ease: "Quad.Out",
        });
      });
      hit.on("pointerout", () => {
        drawCard(false);
        visual.hoverOut?.forEach((fn) => fn?.());
        this.tweens.add({
          targets: card,
          y: cardY + 34,
          duration: 140,
          ease: "Quad.Out",
        });
      });
      const optionEntry = {
        card,
        hit,
        onSelect: visual.onSelect,
        selectDelayMs: visual.selectDelayMs,
      };
      hit.on("pointerdown", () => chooseOption(option, optionEntry));

      card.add([
        shadow,
        bg,
        glow,
        tagBg,
        selectBg,
        ...(visual.nodes || []),
        tagText,
        titleText,
        subtitleText,
        hintText,
        selectText,
        hit,
      ]);
      panel.add(card);
      optionCards.push(optionEntry);

      this.tweens.add({
        targets: card,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        delay: 120 + (index * 90),
        duration: 220,
        ease: "Back.Out",
      });
    });

    const footer = this.add.text(0, (panelHeight / 2) - 44, "Level rewards wait for calmer moments, so night defenses stay smooth.", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#9fc1d2",
      stroke: "#08131d",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: panelWidth - 140 },
    }).setOrigin(0.5);

    panel.add([badgeBg, badgeText, title, subtitle, progressLine, footer]);
    root.add([shade, bloomA, bloomB, panel]);

    this.tweens.add({
      targets: [bloomA, bloomB],
      alpha: { from: 0.06, to: 0.14 },
      scaleX: { from: 0.92, to: 1.1 },
      scaleY: { from: 0.92, to: 1.1 },
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: panel,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: cam.centerY,
      duration: 320,
      ease: "Back.Out",
    });

    destroyers.push(() => shade.removeAllListeners());
    optionCards.forEach((entry) => {
      destroyers.push(() => entry.hit.removeAllListeners());
    });

    this._townXpRewardPresentation = { root, destroyers };
    return {
      root,
      destroy: () => {
        if (completed) return;
        completed = true;
        try {
          onCancel?.();
        } finally {
          cleanup();
        }
      },
    };
  }

  _projectWorldToUiPoint(x, y) {
    const worldCam = this.worldScene?.cameras?.main;
    if (!worldCam || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { x: this.scale.width * 0.5, y: this.scale.height * 0.42 };
    }

    return {
      x: (x - worldCam.worldView.x) * worldCam.zoom,
      y: (y - worldCam.worldView.y) * worldCam.zoom,
    };
  }

  playTownLossCollapseSequence({ towerWorldX, towerWorldY, onComplete } = {}) {
    const depth = (UIDEPTH ?? 2000) + 4300;
    const anchor = this._projectWorldToUiPoint(towerWorldX, towerWorldY);
    const root = this.add.container(0, 0).setDepth(depth).setScrollFactor(0);

    const pulse = this.add.circle(anchor.x, anchor.y, 34, 0xffddb6, 0.18);
    const halo = this.add.circle(anchor.x, anchor.y, 72, 0x8fe7ff, 0.10);
    const sparkle = this.add.star(anchor.x, anchor.y, 6, 18, 34, 0xfff4cf, 0.36);
    root.add([halo, pulse, sparkle]);

    this.tweens.add({
      targets: [pulse, halo],
      scaleX: { from: 0.6, to: 1.9 },
      scaleY: { from: 0.6, to: 1.9 },
      alpha: { from: 0.26, to: 0 },
      duration: 420,
      ease: "Cubic.easeOut",
    });

    this.tweens.add({
      targets: sparkle,
      angle: 100,
      alpha: { from: 0.34, to: 0 },
      scaleX: { from: 0.72, to: 1.5 },
      scaleY: { from: 0.72, to: 1.5 },
      duration: 460,
      ease: "Quad.easeOut",
    });

    const bubbleColors = [0xffc38b, 0x95e7ff, 0xfff2cf, 0xa7f3d0];
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 75, () => {
        const bubble = this.add.circle(
          anchor.x + Phaser.Math.Between(-26, 26),
          anchor.y + Phaser.Math.Between(-22, 22),
          Phaser.Math.Between(10, 22),
          bubbleColors[i % bubbleColors.length],
          0.26
        );
        const dot = this.add.circle(bubble.x - 3, bubble.y - 4, Math.max(3, bubble.radius * 0.18), 0xffffff, 0.18);
        root.add([bubble, dot]);

        this.tweens.add({
          targets: [bubble, dot],
          y: bubble.y + Phaser.Math.Between(-34, -14),
          x: bubble.x + Phaser.Math.Between(-18, 18),
          scaleX: { from: 0.82, to: 1.18 },
          scaleY: { from: 0.82, to: 1.18 },
          alpha: { from: bubble.alpha, to: 0 },
          duration: 380,
          ease: "Cubic.easeOut",
          onComplete: () => {
            bubble.destroy();
            dot.destroy();
          },
        });
      });
    }

    this.cameras.main.shake(220, 0.0022);
    this.time.delayedCall(760, () => {
      root.destroy(true);
      onComplete?.();
    });

    return root;
  }

  _createTownLossStatCard(entry, x, y, width, height, delay = 0) {
    const accent = entry?.accentColor ?? 0x9ee7ff;
    const panelColor = entry?.panelColor ?? 0x143145;
    const valueColor = entry?.valueColor ?? "#fff7dc";
    const labelColor = entry?.labelColor ?? "#d7eef8";
    const hintColor = entry?.hintColor ?? "#9ec6d8";

    const root = this.add.container(x, y);
    const bg = this.add.graphics();
    this._drawRoundedPanel(bg, width, height, {
      radius: 24,
      fillColor: panelColor,
      fillAlpha: 0.96,
      strokeColor: accent,
      strokeAlpha: 0.42,
      topStripColor: accent,
      topStripAlpha: 0.95,
      topStripHeight: 24,
      shadowColor: 0x031018,
      shadowAlpha: 0.22,
      shadowOffsetY: 10,
    });

    const glow = this.add.circle(-width * 0.22, -height * 0.12, Math.max(20, Math.round(width * 0.18)), accent, 0.12);
    const shimmer = this.add.circle(width * 0.18, -height * 0.2, Math.max(12, Math.round(width * 0.08)), 0xffffff, 0.10);
    const textFlagHeight = Math.max(52, Math.round(height * 0.42));
    const textFlagY = (height / 2) - (textFlagHeight / 2) - 10;
    const textFlag = this.add.graphics();
    this._drawRoundedPanel(textFlag, width - 16, textFlagHeight, {
      radius: 18,
      fillColor: 0x0b1926,
      fillAlpha: 0.50,
      strokeColor: accent,
      strokeAlpha: 0.14,
      strokeWidth: 1,
      topStripColor: accent,
      topStripAlpha: 0.12,
      topStripHeight: 12,
      shadowAlpha: 0,
    });
    textFlag.setPosition(0, textFlagY);

    const value = this.add.text(0, -18, `${entry?.value ?? 0}`, {
      fontFamily: "Bungee",
      fontSize: width < 170 ? "24px" : "28px",
      color: valueColor,
      stroke: "#06121b",
      strokeThickness: 4,
      align: "center",
    }).setOrigin(0.5);
    const label = this.add.text(0, textFlagY - 4, entry?.label ?? "", {
      fontFamily: "Bungee",
      fontSize: width < 170 ? "10px" : "11px",
      color: labelColor,
      stroke: "#06121b",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: width - 34 },
      lineSpacing: 2,
    }).setOrigin(0.5, 1);
    const hint = this.add.text(0, textFlagY + 6, entry?.hint ?? "", {
      fontFamily: "Bungee",
      fontSize: width < 170 ? "9px" : "10px",
      color: hintColor,
      stroke: "#06121b",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: width - 34 },
      lineSpacing: 2,
    }).setOrigin(0.5, 0);

    root.add([bg, glow, shimmer, textFlag, value, label, hint]);
    root.setAlpha(0).setScale(0.9);

    this.tweens.add({
      targets: root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: y - 10,
      delay,
      duration: 280,
      ease: "Back.Out",
    });

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.06, to: 0.16 },
      scaleX: { from: 0.94, to: 1.08 },
      scaleY: { from: 0.94, to: 1.08 },
      duration: 1600,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    return root;
  }

  _destroyTownLossPresentation() {
    const presentation = this._townLossPresentation;
    if (!presentation) return;
    this._townLossPresentation = null;
    presentation.destroyers?.forEach((fn) => {
      try { fn?.(); } catch {}
    });
    presentation.destroyers = [];
    presentation.root?.destroy?.(true);
  }

  showTownLossPresentation(summaryData = {}) {
    if (this._townLossPresentation?.root?.active) return this._townLossPresentation.root;
    const worldScene = this.worldScene;
    if (!worldScene) return null;

    const destroyers = [];
    const lockKeyboard = (scene) => {
      if (!scene?.input?.keyboard) return;
      const enabled = scene.input.keyboard.enabled;
      scene.input.keyboard.enabled = false;
      destroyers.push(() => {
        if (scene?.input?.keyboard) scene.input.keyboard.enabled = enabled;
      });
    };
    lockKeyboard(worldScene);
    lockKeyboard(this);

    const cam = this.cameras.main;
    const depth = (UIDEPTH ?? 2000) + 4400;
    const root = this.add.container(0, 0).setDepth(depth).setScrollFactor(0);
    const shade = this.add.rectangle(0, 0, cam.width, cam.height, 0x07131f, 0.78)
      .setOrigin(0)
      .setInteractive({ useHandCursor: false });

    const centerX = cam.centerX;
    const centerY = cam.centerY;
    const panelWidth = Math.min(1120, cam.width - 42);
    const panelHeight = Math.min(760, cam.height - 44);
    const panel = this.add.container(centerX, centerY + 8).setAlpha(0).setScale(0.94);

    const outerGlow = this.add.circle(centerX - (panelWidth * 0.24), centerY - (panelHeight * 0.12), 220, 0x7dd3fc, 0.08);
    const warmGlow = this.add.circle(centerX + (panelWidth * 0.18), centerY + (panelHeight * 0.08), 190, 0xffbf86, 0.08);
    const centerHalo = this.add.circle(centerX, centerY + 18, 280, 0xdbeafe, 0.05);

    root.add([shade, outerGlow, warmGlow, centerHalo, panel]);

    for (let i = 0; i < 8; i++) {
      const bubble = this.add.circle(
        centerX + Phaser.Math.Between(-Math.round(panelWidth * 0.42), Math.round(panelWidth * 0.42)),
        centerY + Phaser.Math.Between(-Math.round(panelHeight * 0.38), Math.round(panelHeight * 0.38)),
        Phaser.Math.Between(18, 42),
        i % 2 === 0 ? 0x8fe7ff : 0xffddb1,
        0.08
      );
      bubble.setScale(0.92 + (i % 3) * 0.08);
      root.add(bubble);
      this.tweens.add({
        targets: bubble,
        y: bubble.y + Phaser.Math.Between(-26, 26),
        x: bubble.x + Phaser.Math.Between(-20, 20),
        duration: 1800 + (i * 110),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    const panelBg = this.add.graphics();
    this._drawRoundedPanel(panelBg, panelWidth, panelHeight, {
      radius: 36,
      fillColor: 0x10263b,
      fillAlpha: 0.985,
      strokeColor: 0xb4ecff,
      strokeAlpha: 0.42,
      strokeWidth: 3,
      topStripColor: 0x7dd3fc,
      topStripAlpha: 0.95,
      topStripHeight: 34,
      shadowColor: 0x031018,
      shadowAlpha: 0.3,
      shadowOffsetY: 16,
    });

    const badgeBg = this.add.graphics();
    this._drawRoundedPanel(badgeBg, 248, 42, {
      radius: 20,
      fillColor: 0xffddb1,
      fillAlpha: 0.96,
      strokeColor: 0xffffff,
      strokeAlpha: 0.14,
      shadowAlpha: 0,
    });
    badgeBg.setPosition(0, -(panelHeight / 2) + 54);

    const badgeText = this.add.text(0, badgeBg.y, summaryData?.badgeLabel || "ENDLESS RUN RECAP", {
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#5b3410",
      stroke: "#fff8e7",
      strokeThickness: 2,
    }).setOrigin(0.5);

    const title = this.add.text(0, -(panelHeight / 2) + 112, summaryData?.title || "Town Tumbled!", {
      fontFamily: "Bungee",
      fontSize: panelWidth < 760 ? "28px" : "34px",
      color: "#fff8ed",
      stroke: "#08131d",
      strokeThickness: 6,
      align: "center",
      wordWrap: { width: panelWidth - 120 },
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, -(panelHeight / 2) + 158, summaryData?.subtitle || "The run is over, but the town still made some noise.", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#d8edf6",
      stroke: "#08131d",
      strokeThickness: 4,
      align: "center",
      wordWrap: { width: panelWidth - 170 },
      lineSpacing: 6,
    }).setOrigin(0.5);

    panel.add([panelBg, badgeBg, badgeText, title, subtitle]);

    const primaryStats = Array.isArray(summaryData?.primaryStats) ? summaryData.primaryStats : [];
    const cols = cam.width >= 1260 ? Math.min(5, Math.max(1, primaryStats.length)) : (cam.width >= 860 ? Math.min(3, Math.max(1, primaryStats.length)) : (cam.width >= 620 ? Math.min(2, Math.max(1, primaryStats.length)) : 1));
    const gapX = cols >= 5 ? 12 : 18;
    const gapY = 16;
    const cardWidth = Math.min(cols >= 5 ? 176 : 224, Math.floor((panelWidth - 120 - (gapX * Math.max(0, cols - 1))) / Math.max(1, cols)));
    const cardHeight = cam.width < 760 ? 124 : 132;
    const gridTop = -(panelHeight / 2) + 270;
    const rows = Math.ceil(primaryStats.length / Math.max(1, cols));
    const gridBottom = gridTop + (rows * cardHeight) + (Math.max(0, rows - 1) * gapY);

    primaryStats.forEach((entry, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const itemsInRow = Math.min(cols, primaryStats.length - (row * cols));
      const rowWidth = (itemsInRow * cardWidth) + ((itemsInRow - 1) * gapX);
      const x = -(rowWidth / 2) + (cardWidth / 2) + (col * (cardWidth + gapX));
      const y = gridTop + (row * (cardHeight + gapY));
      const card = this._createTownLossStatCard(entry, x, y, cardWidth, cardHeight, 140 + (index * 90));
      panel.add(card);
    });

    const unlockLabels = Array.isArray(summaryData?.troopUnlockLabels) ? summaryData.troopUnlockLabels : [];
    const unlockHeaderY = gridBottom + 42;
    const unlockHeaderText = unlockLabels.length
      ? "Run-Earned Troops"
      : "Run-Earned Troops: None This Run";
    const unlockHeader = this.add.text(0, unlockHeaderY, unlockHeaderText, {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: unlockLabels.length ? "#ffe9c7" : "#d7e6ef",
      stroke: "#08131d",
      strokeThickness: 3,
      align: "center",
    }).setOrigin(0.5);
    panel.add(unlockHeader);

    const unlockChipY = unlockHeaderY + 40;

    if (unlockLabels.length) {
      const chipGap = 14;
      const chips = unlockLabels.map((label, index) => {
        const text = this.add.text(0, 0, label, {
          fontFamily: "Bungee",
          fontSize: "12px",
          color: "#0d2334",
          stroke: "#f8feff",
          strokeThickness: 1,
        }).setOrigin(0.5);
        const width = Math.ceil(text.width) + 34;
        const height = 36;
        const bg = this.add.graphics();
        this._drawRoundedPanel(bg, width, height, {
          radius: 18,
          fillColor: index % 2 === 0 ? 0xb6efff : 0xffe1bb,
          fillAlpha: 0.98,
          strokeColor: 0xffffff,
          strokeAlpha: 0.24,
            shadowAlpha: 0.12,
            shadowOffsetY: 6,
        });
        const chip = this.add.container(0, unlockChipY, [bg, text]).setAlpha(0).setScale(0.9);
        return { chip, width };
      });

      const totalWidth = chips.reduce((sum, chip) => sum + chip.width, 0) + (chipGap * Math.max(0, chips.length - 1));
      let cursorX = -(totalWidth / 2);
      chips.forEach(({ chip, width }, index) => {
        cursorX += width / 2;
        chip.x = cursorX;
        panel.add(chip);
        this.tweens.add({
          targets: chip,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          delay: 260 + (index * 90),
          duration: 220,
          ease: "Back.Out",
        });
        this.tweens.add({
          targets: chip,
          y: chip.y - 8,
          duration: 1500 + (index * 90),
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });
        cursorX += (width / 2) + chipGap;
      });
    }

    const unlockContentBottomY = unlockLabels.length ? unlockChipY + 26 : unlockHeaderY + 6;
    const buttonWidth = Math.min(260, panelWidth - 180);
    const buttonHeight = 72;
    const buttonY = (panelHeight / 2) - 60;
    const secondaryY = Math.min(
      buttonY - 78,
      Math.max(unlockContentBottomY + 26, (panelHeight / 2) - 122)
    );
    const secondaryLine = (summaryData?.secondaryStats || [])
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join("   •   ");
    const secondary = this.add.text(0, secondaryY, secondaryLine, {
      fontFamily: "Bungee",
      fontSize: "11px",
      color: "#9fc1d2",
      stroke: "#08131d",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: panelWidth - 140 },
      lineSpacing: 6,
    }).setOrigin(0.5);

    const buttonBg = this.add.graphics();
    const drawButton = (hovered = false) => {
      this._drawRoundedPanel(buttonBg, buttonWidth, buttonHeight, {
        radius: 24,
        fillColor: hovered ? 0x96efff : 0x6dd3f5,
        fillAlpha: 0.98,
        strokeColor: hovered ? 0xffffff : 0xdff9ff,
        strokeAlpha: hovered ? 0.36 : 0.22,
        shadowColor: 0x053245,
        shadowAlpha: 0.26,
        shadowOffsetY: 8,
      });
    };
    drawButton(false);
    buttonBg.setPosition(0, buttonY);
    buttonBg.setInteractive(new Phaser.Geom.Rectangle(-(buttonWidth / 2), -(buttonHeight / 2), buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

    const buttonText = this.add.text(0, buttonBg.y - 10, summaryData?.restartLabel || "Restart Run", {
      fontFamily: "Bungee",
      fontSize: "18px",
      color: "#0b2a3e",
      stroke: "#f8feff",
      strokeThickness: 2,
    }).setOrigin(0.5);
    const buttonHint = this.add.text(0, buttonBg.y + 14, "Fade back to the clouds", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#d8f6ff",
      stroke: "#09445e",
      strokeThickness: 2,
    }).setOrigin(0.5);

    buttonBg.on("pointerover", () => {
      drawButton(true);
      buttonBg.setScale(1.02);
    });
    buttonBg.on("pointerout", () => {
      drawButton(false);
      buttonBg.setScale(1);
    });
    buttonBg.on("pointerdown", () => {
      buttonBg.disableInteractive();
      this.worldScene?.restartToMainMenu?.({ hostScene: this });
    });

    panel.add([secondary, buttonBg, buttonText, buttonHint]);

    this.tweens.add({
      targets: panel,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: title,
      y: title.y - 8,
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this._townLossPresentation = { root, destroyers };
    return root;
  }

  onMoneyChanged(amountDelta) {
    if (!this.moneyText || !this.worldScene) return;
    const isGain = amountDelta > 0;
    const color = isGain ? "#00ff00" : "#ff3333";
    const sign = isGain ? "+" : "-";
    this._mutateText(this.moneyText, (node) => {
      node.setText(`$${this.worldScene.money}`);
      node.setFill(color);
    });
    this._ghostAt(this.moneyText, `${sign}$${Math.abs(amountDelta)}`, color);
    this.time.delayedCall(600, () => this._mutateText(this.moneyText, (node) => node.setFill("#ffffff")));
  }

  onSeedsChanged(amountDelta) {
    if (!this.seedsText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#00ff00" : "#ff3333";
    this._mutateText(this.seedsText, (node) => {
      node.setText(`${this.worldScene.seeds}`);
      node.setFill(color);
    });
    this._ghostAt(this.seedsText, amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`, color);
    this.time.delayedCall(600, () => this._mutateText(this.seedsText, (node) => node.setFill("#ffffff")));
  }

  onBerryChanged(amountDelta) {
    if (!this.berryText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#00ff00" : "#ff3333";
    this._mutateText(this.berryText, (node) => {
      node.setText(`${this.worldScene.berries}`);
      node.setFill(color);
    });
    this._ghostAt(this.berryText, amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`, color);
    this.time.delayedCall(600, () => this._mutateText(this.berryText, (node) => node.setFill("#ffffff")));
  }

  onPermitsChanged(amountDelta) {
    if (!this.permitText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#d8b4fe" : "#fca5a5";
    const sign = amountDelta > 0 ? "+" : "-";
    this._mutateText(this.permitText, (node) => {
      node.setText(`${this.worldScene.permits ?? 0}`);
      node.setFill(color);
    });
    this._ghostAt(this.permitText, `${sign}${Math.abs(amountDelta)}📜`, color);
    this.time.delayedCall(600, () => this._mutateText(this.permitText, (node) => node.setFill("#ffffff")));
  }

  update() {
    if (this._sceneShuttingDown) return;
    // The UI scene should never pan with world interactions.
    this.cameras.main?.setScroll?.(0, 0);
    if (!this.worldScene?.menu?.active) {
      this._tryOpenPendingMenu();
    }
    this._refreshTopHudValues();
    this._refreshTownXpHud();
    this._refreshPhaseClock();
    this.zoomControls?.updateState?.();
    this._updateRaiderEdgeHud();
    this._syncUiAnimationTimeScale();
    this.contractHud?.update?.();
    this.selectionCommandBar?.update?.();
  }
}
