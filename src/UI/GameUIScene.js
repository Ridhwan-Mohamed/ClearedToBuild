import Phaser from "phaser";
import { UIDEPTH } from "../constants";
import { DailyNeedsTracker } from "./DailyNeedsTracker";
import { Clock } from "../Controllers/Clock";
import { CreateBottomBar } from "./BottomBar/BottomBar";
import { StageState } from "../parcelController/StageState";
import { ContractHud } from "./ContractHud.js";
import { SelectionCommandBar } from "./SelectionCommandBar.js";
import { Teams } from "../Teams.js";

export class GameUIScene extends Phaser.Scene {
  constructor() {
    super("GameUIScene");
    this.worldScene = null;
    this._bridged = [];
  }

  init(data) {
    this.worldSceneKey = data?.worldSceneKey || "mapView";
  }

  create() {
    const world = this.scene.get(this.worldSceneKey);
    if (!world) return;
    this.bindWorldScene(world);
  }

  bindWorldScene(world) {
    this.worldScene = world;
    world.uiScene = this;

    this._bridgeWorldEvents();
    this._forwardWorldState();
  }

  _bridgeWorldEvents() {
    this._bridged.forEach(({ evt, fn }) => this.worldScene?.events?.off(evt, fn));
    this._bridged = [];

    const passthrough = [
      "oven:updated",
      "oven:added",
      "oven:removed",
      "storage:added",
      "storage:removed",
      "storage:updated",
      "store:unlock-changed",
      "cards:updated",
      "mode:completed",
    ];

    passthrough.forEach((evt) => {
      const fn = (...args) => this.events.emit(evt, ...args);
      this.worldScene.events.on(evt, fn);
      this._bridged.push({ evt, fn });
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

    this._buildTopHud();
    this._buildStageMetaHud();
    this._buildZoomControls();
    this._buildContractHud();
    this._buildSelectionCommandBar();
    CreateBottomBar(this);
    this._hudBuilt = true;

    this._syncWorldUiRefs();
    this.worldScene?.setSimulationSpeedReady?.(true);
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
    w.clockText = this.clockText;

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
    const H = 36;
    const world = this.worldScene;

    const bar = this.add.rectangle(0, 0, W, H, 0x222222, 0.7).setOrigin(0, 0).setDepth(UIDEPTH - 1);
    this.scale.on("resize", ({ width }) => bar.setSize(width, H));

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

    const centerX = W / 2;
    const moneyLeftX = centerX - 30;
    const moneyIcon = makeIcon(centerX - 30, "monies");
    this.moneyText = makeText(centerX - 4, `$${world.money}`);
    this.topHudElements.push(moneyIcon, this.moneyText);
    this.topHudHoverTargets.push(registerHover(moneyLeftX, centerX - 4 + this.moneyText.width, "Money"));

    const clockX = W - 160;
    if (!world.clock || typeof world.clock.formatTimeWithDay !== "function") {
      world.clock = new Clock(world);
    }
    this.clockText = makeText(clockX, world.clock.formatTimeWithDay());
    world.clock.externalText = this.clockText;
    this.topHudElements.push(this.clockText);

    this.topHud = this.add.container(0, 0, [bar, ...this.topHudElements]).setDepth(UIDEPTH);
    this._refreshTopHudValues(true);
  }

  _getTopHudNeedCount() {
    return Teams.teamLists?.["1"]?.playerList?.length || 0;
  }

  _refreshTopHudValues(force = false) {
    if (!this.worldScene) return;

    const needCount = this._getTopHudNeedCount();
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
    };

    const nextSig = JSON.stringify(snapshot);
    if (!force && nextSig === this._topHudValueSignature) return;
    this._topHudValueSignature = nextSig;

    if (this.foodText) {
      this.foodText.setText(`${snapshot.food}/${snapshot.needCount}`);
      this.foodText.setColor(snapshot.food >= snapshot.needCount ? "#00ff00" : "#ff3333");
    }
    if (this.waterText) {
      this.waterText.setText(`${snapshot.water}/${snapshot.needCount}`);
      this.waterText.setColor(snapshot.water >= snapshot.needCount ? "#00ff00" : "#ff3333");
    }
    if (this.seedsText) this.seedsText.setText(`${snapshot.seeds}`);
    if (this.berryText) this.berryText.setText(`${snapshot.berries}`);
    if (this.woodText) this.woodText.setText(`${snapshot.wood}`);
    if (this.stoneText) this.stoneText.setText(`${snapshot.stone}`);
    if (this.permitText) this.permitText.setText(`${snapshot.permits}`);
    if (this.moneyText) this.moneyText.setText(`$${snapshot.money}`);
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

  _showTopHudHover(label, anchorX) {
    const bubble = this._ensureTopHudHoverBubble();
    this._layoutTopHudHoverBubble(label);
    this._topHudHoverHideTimer?.remove?.(false);
    this._topHudHoverHideTimer = null;

    const targetX = Phaser.Math.Clamp(anchorX, bubble.widthPx / 2 + 12, this.scale.width - bubble.widthPx / 2 - 12);
    const targetY = 56;

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
      this._showTopHudHover(label, anchorX);
    });
    target.on("pointerout", () => {
      this._topHudHoverHideTimer?.remove?.(false);
      this._topHudHoverHideTimer = this.time.delayedCall(40, () => this._hideTopHudHover());
    });
  }

  _buildStageMetaHud() {
    if (this.stageMetaText) return;

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

    const recompute = () => {
      const stage = Math.max(1, Number(StageState.stageIndex || 1));
      const line1 = `\uD83C\uDFF9 Endless Run`;
      const line2 = `\uD83D\uDD25 Horde ${stage}`;
      this.stageMetaText.setText(`${line1}\n${line2}`);
      this.stageMetaText.setColor("#f6f0ff");
    };

    recompute();
    this.worldScene?.events?.on?.("stage:changed", recompute);

    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: recompute,
    });

    this.scale.on("resize", () => {
      this.stageMetaText?.setPosition(panelX, panelY);
    });
  }

  _buildZoomControls() {
    if (this.zoomControls) return;

    const BTN_SIZE = 48;
    const GAP = 8;
    const X_PAD = 30;
    const Y_PAD = 88;
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
      root.setPosition(this.scale.width - X_PAD, Y_PAD);
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

    root.updateState();
    this.zoomControls = root;
    this.events.once("shutdown", () => {
      this.scale.off("resize", positionControls);
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
    if (!targetText) return;
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

  onMoneyChanged(amountDelta) {
    if (!this.moneyText || !this.worldScene) return;
    const isGain = amountDelta > 0;
    const color = isGain ? "#00ff00" : "#ff3333";
    const sign = isGain ? "+" : "-";
    this.moneyText.setText(`$${this.worldScene.money}`);
    this.moneyText.setFill(color);
    this._ghostAt(this.moneyText, `${sign}$${Math.abs(amountDelta)}`, color);
    this.time.delayedCall(600, () => this.moneyText?.setFill("#ffffff"));
  }

  onSeedsChanged(amountDelta) {
    if (!this.seedsText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#00ff00" : "#ff3333";
    this.seedsText.setText(`${this.worldScene.seeds}`);
    this.seedsText.setFill(color);
    this._ghostAt(this.seedsText, amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`, color);
    this.time.delayedCall(600, () => this.seedsText?.setFill("#ffffff"));
  }

  onBerryChanged(amountDelta) {
    if (!this.berryText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#00ff00" : "#ff3333";
    this.berryText.setText(`${this.worldScene.berries}`);
    this.berryText.setFill(color);
    this._ghostAt(this.berryText, amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`, color);
    this.time.delayedCall(600, () => this.berryText?.setFill("#ffffff"));
  }

  onPermitsChanged(amountDelta) {
    if (!this.permitText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#d8b4fe" : "#fca5a5";
    const sign = amountDelta > 0 ? "+" : "-";
    this.permitText.setText(`${this.worldScene.permits ?? 0}`);
    this.permitText.setFill(color);
    this._ghostAt(this.permitText, `${sign}${Math.abs(amountDelta)}📜`, color);
    this.time.delayedCall(600, () => this.permitText?.setFill("#ffffff"));
  }

  update() {
    // The UI scene should never pan with world interactions.
    this.cameras.main?.setScroll?.(0, 0);
    this._refreshTopHudValues();
    this.zoomControls?.updateState?.();
    this._syncUiAnimationTimeScale();
    this.contractHud?.update?.();
    this.selectionCommandBar?.update?.();
  }
}
