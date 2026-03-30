import { UIDEPTH, calcContractCost, estimatePressureContract } from "../constants.js";
import { PRESSURE } from "../parcel_system/ParcelConfig.js";
import { StageState } from "../parcelController/StageState.js";
import { Teams } from "../Teams.js";
import { makeButton } from "../parcelSpawn/ui/makeButton.js";

const SLOT_ORDER = ["N", "E", "S", "W"];
const SLOT_LABELS = {
  N: "NORTH",
  S: "SOUTH",
  E: "EAST",
  W: "WEST",
};

const CONTRACT_DEFS = {
  FOREST: {
    emoji: "🌲",
    title: "Forest Contract",
    color: 0x166534,
    lines: (scene) => [
      "Spawns a forest parcel.",
      "Timer-based resource run.",
      "",
      `Cost: $${calcContractCost(scene, "FOREST")}`,
    ],
  },
  ROCK: {
    emoji: "🪨",
    title: "Rock Contract",
    color: 0x475569,
    lines: (scene) => [
      "Spawns a rock parcel.",
      "Timer-based resource run.",
      "",
      `Cost: $${calcContractCost(scene, "ROCK")}`,
    ],
  },
  PRESSURE: {
    emoji: "💀",
    title: "Pressure Contract",
    color: 0x991b1b,
  },
  MARKET: {
    emoji: "🏪",
    title: "Market Contract",
    color: 0x92400e,
    lines: () => [
      "Temporary traveling market.",
      "Ship docks at the parcel.",
      "",
      "Cost: $40",
    ],
  },
  FARM: {
    emoji: "🌾",
    title: "Farm Contract",
    color: 0x15803d,
    lines: (scene) => [
      "Fertile land parcel.",
      "More crop space off-island.",
      "",
      `Cost: $${calcContractCost(scene, "FARM")}`,
    ],
  },
  MILITIA: {
    emoji: "🛡",
    title: "Militia Contract",
    color: 0x0f172a,
    lines: (scene) => [
      "Hire temporary fighters.",
      "Extra bodies for a short run.",
      "",
      `Cost: $${calcContractCost(scene, "MILITIA")}`,
    ],
  },
};

const BUYABLE_TYPES = ["FOREST", "ROCK", "PRESSURE", "MARKET", "FARM", "MILITIA"];

function fmtMMSS(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class ContractHud {
  constructor(scene) {
    this.scene = scene;
    this.world = scene.worldScene;
    this.popupW = 280;
    this.popupH = 256;
    this.root = scene.add.container(0, 0).setDepth(UIDEPTH + 5);
    this.squares = new Map();
    this.popupObjects = [];
    this.popupState = null;

    this._buildSquares();
    this._buildPopup();
    this._layout();
    this._refreshSquares();

    this._onResize = () => this._layout();
    this.scene.scale.on("resize", this._onResize);
  }

  destroy() {
    this.scene.scale.off("resize", this._onResize);
    this.root?.destroy(true);
  }

  update() {
    const isDetailed = this.world?.zoomMixer?.mode !== "overview";
    this.root.setVisible(isDetailed);
    if (!isDetailed) {
      this.popup?.setVisible(false);
      return;
    }

    this._refreshSquares();
    this._refreshPopup();
  }

  _buildSquares() {
    for (const slotId of SLOT_ORDER) {
      const group = this.scene.add.container(0, 0);
      const label = this.scene.add.text(0, 0, SLOT_LABELS[slotId], {
        fontFamily: "Bungee",
        fontSize: "16px",
        color: "#f8f6ff",
        stroke: "#000000",
        strokeThickness: 4,
      }).setOrigin(0.5, 0);

      const frame = this.scene.add.graphics();
      frame.setPosition(0, 0);

      const zone = this.scene.add.zone(0, 34, 56, 56).setInteractive({ useHandCursor: true });

      const icon = this.scene.add.text(0, 34, slotId === "N" ? "👑" : "+", {
        fontFamily: "Bungee",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#001018",
        strokeThickness: 5,
        align: "center",
      }).setOrigin(0.5);

      const timer = this.scene.add.text(0, 72, slotId === "N" ? "👑" : "BUY", {
        fontFamily: "Bungee",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center",
      }).setOrigin(0.5, 0);

      zone.on("pointerover", () => {
        const slot = this.squares.get(slotId);
        if (!slot) return;
        slot.hovered = true;
        this._applySquareVisual(slotId, this._getSlotStatus(slotId));
      });
      zone.on("pointerout", () => {
        const slot = this.squares.get(slotId);
        if (!slot) return;
        slot.hovered = false;
        slot.pressed = false;
        this._applySquareVisual(slotId, this._getSlotStatus(slotId));
      });
      zone.on("pointerdown", () => {
        const slot = this.squares.get(slotId);
        if (!slot) return;
        slot.pressed = true;
        this._applySquareVisual(slotId, this._getSlotStatus(slotId));
      });
      zone.on("pointerup", () => {
        const slot = this.squares.get(slotId);
        if (!slot) return;
        slot.pressed = false;
        this._applySquareVisual(slotId, this._getSlotStatus(slotId));
        this._onSquareClicked(slotId);
      });

      group.add([frame, label, icon, timer, zone]);
      this.root.add(group);
      this.squares.set(slotId, { group, label, frame, icon, timer, zone, hovered: false, pressed: false });
    }
  }

  _buildPopup() {
    this.popup = this.scene.add.container(0, 0).setVisible(false);

    this.popupFrame = this.scene.add.graphics();

    this.popupTitle = this.scene.add.text(18, 14, "", {
      fontFamily: "Bungee",
      fontSize: "18px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      wordWrap: { width: 244 },
    }).setOrigin(0, 0);

    this.popupBody = this.scene.add.text(18, 52, "", {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: "#f8fbff",
      stroke: "#000000",
      strokeThickness: 3,
      lineSpacing: 6,
      wordWrap: { width: 244 },
    }).setOrigin(0, 0);

    this.popup.add([this.popupFrame, this.popupTitle, this.popupBody]);
    this.root.add(this.popup);
    this._setPopupTheme();
  }

  _setPopupTheme({
    bgColor = 0x1f2937,
    bgAlpha = 0.36,
    strokeColor = 0xffffff,
    titleColor = "#ffffff",
    bodyColor = "#f8fbff",
  } = {}) {
    this.popupFrame.clear();
    this.popupFrame.fillStyle(bgColor, bgAlpha);
    this.popupFrame.fillRoundedRect(0, 0, this.popupW, this.popupH, 16);
    this.popupFrame.lineStyle(2, strokeColor, 0.22);
    this.popupFrame.strokeRoundedRect(0, 0, this.popupW, this.popupH, 16);
    this.popupTitle.setColor(titleColor);
    this.popupBody.setColor(bodyColor);
  }

  _layout() {
    const startX = 40;
    const topY = 90;
    const gap = 94;

    SLOT_ORDER.forEach((slotId, index) => {
      const x = startX;
      const y = topY + index * gap;
      const slot = this.squares.get(slotId);
      if (!slot) return;
      slot.group.setPosition(x, y);
    });

    if (this.popupState?.slotId) {
      this._positionPopupFor(this.popupState.slotId);
    } else if (this.popupState?.kind === "fort") {
      this._positionPopupFor("N");
    }
  }

  _positionPopupFor(slotId) {
    const slot = this.squares.get(slotId);
    if (!slot) return;
    const x = clamp(slot.group.x + 82, 160, Math.max(160, this.scene.scale.width - 150));
    const y = clamp(slot.group.y - 12, 52, Math.max(52, this.scene.scale.height - (this.popupH + 20)));
    this.popup.setPosition(x, y);
  }

  _refreshSquares() {
    for (const slotId of SLOT_ORDER) {
      this._applySquareVisual(slotId, this._getSlotStatus(slotId));
    }
  }

  _applySquareVisual(slotId, status) {
    const slot = this.squares.get(slotId);
    if (!slot || !status) return;

    const fillAlpha = status.fillAlpha ?? 0.94;
    const strokeAlpha = slot.pressed ? 0.95 : slot.hovered ? 0.78 : 0.55;
    const iconColor = status.iconColor ?? "#ffffff";

    slot.frame.clear();
    if (fillAlpha > 0) {
      const boostedFill = slot.hovered ? Math.min(fillAlpha + 0.08, 1) : fillAlpha;
      slot.frame.fillStyle(status.fillColor ?? 0x111827, boostedFill);
      slot.frame.fillRoundedRect(-28, 6, 56, 56, 12);
    }
    slot.frame.lineStyle(3, status.strokeColor ?? 0xffffff, strokeAlpha);
    slot.frame.strokeRoundedRect(-28, 6, 56, 56, 12);

    slot.icon.setText(status.iconText);
    slot.icon.setColor(iconColor);
    slot.icon.setFontSize(status.iconSize ?? 24);
    slot.timer.setText(status.timerText ?? "");
    slot.timer.setVisible(!!status.timerText);
    slot.timer.setColor(status.timerColor ?? "#ffffff");
  }

  _getSlotStatus(slotId) {
    if (slotId === "N") {
      return {
        kind: "fort",
        iconText: "👑",
        timerText: "",
        fillColor: 0x4c1d95,
        strokeColor: 0xfbbf24,
        iconSize: 24,
      };
    }

    const active = this._getActiveContract(slotId);
    if (active) {
      if (active.type === "PRESSURE") {
        return {
          kind: "pressure-live",
          iconText: "💀".repeat(Math.max(1, active.difficulty || 1)),
          timerText: "LIVE",
          fillColor: 0x7f1d1d,
          strokeColor: 0xf87171,
          iconSize: 18,
          contract: active,
        };
      }

      const def = CONTRACT_DEFS[active.type] || CONTRACT_DEFS.FOREST;
      const remainingMs = Math.max(0, Number(active.expireAt || 0) - (this.scene.time?.now || 0));
      return {
        kind: "active",
        iconText: def.emoji,
        timerText: fmtMMSS(remainingMs),
        fillColor: def.color,
        strokeColor: 0xffffff,
        iconSize: 24,
        contract: active,
      };
    }

    const incoming = this._getIncomingPressure(slotId);
    if (incoming) {
      return {
        kind: "pressure-incoming",
        iconText: "💀".repeat(Math.max(1, incoming.difficulty || 1)),
        timerText: incoming.phase === "countdown" ? incoming.remainingText : "LOCK",
        fillColor: 0x5b1720,
        strokeColor: 0xfca5a5,
        iconSize: 18,
        incoming,
      };
    }

      return {
        kind: "empty",
        iconText: "+",
        timerText: "BUY",
        fillColor: 0x111827,
        strokeColor: 0xdbeafe,
        iconSize: 30,
        fillAlpha: 0,
      };
    }

  _getActiveContract(slotId) {
    const pm = this.world?.parcelManager;
    const id = pm?.slotToContractId?.[slotId];
    if (!id) return null;
    return pm?.contractsById?.get?.(id) ?? null;
  }

  _getIncomingPressure(slotId) {
    return this.world?.towerPressureController?.getSlotPressureInfo?.(slotId) ?? null;
  }

  _getFortSummaryLines() {
    const obj = StageState?._fortObjective;
    const towersRequired = Math.max(0, Number(obj?.requiredCount || 0));
    const towersDestroyed = Math.max(0, Number(obj?.destroyedSet?.size || 0));
    const totalFortEnemies = Math.max(0, Number(obj?.meta?.requiredFortEnemyCount || 0));
    const aliveFortEnemies = (Teams.teamLists?.["0"]?.fighterList || []).filter(
      (t) => t?.active && t?.isFortGrunt
    ).length;
    const fortDestroyed = Math.max(
      0,
      totalFortEnemies > 0 ? (totalFortEnemies - aliveFortEnemies) : 0
    );

    return [
      `🏰 Towers ${towersDestroyed}/${towersRequired}`,
      `💀 Fort Enemies ${fortDestroyed}/${totalFortEnemies}`,
    ];
  }

  _onSquareClicked(slotId) {
    if (slotId === "N") {
      if (this.popupState?.kind === "fort") {
        this.closePopup();
      } else {
        this._openFortPopup();
      }
      return;
    }

    if (this.popupState?.slotId === slotId) {
      this.closePopup();
      return;
    }

    const status = this._getSlotStatus(slotId);
    if (status.kind === "empty") {
      this._openChooser(slotId);
      return;
    }

    this._openSummary(slotId);
  }

  _openFortPopup() {
    this.popupState = { kind: "fort" };
    this._positionPopupFor("N");
    this.popup.setVisible(true);
    this._renderPopup();
  }

  _openChooser(slotId) {
    this.popupState = { kind: "slot", slotId, view: "chooser" };
    this._positionPopupFor(slotId);
    this.popup.setVisible(true);
    this._renderPopup();
  }

  _openDetail(slotId, type) {
    this.popupState = {
      kind: "slot",
      slotId,
      view: "detail",
      type,
      difficulty: 1,
    };
    this._positionPopupFor(slotId);
    this.popup.setVisible(true);
    this._renderPopup();
  }

  _openSummary(slotId) {
    this.popupState = { kind: "slot", slotId, view: this._getSlotStatus(slotId).kind };
    this._positionPopupFor(slotId);
    this.popup.setVisible(true);
    this._renderPopup();
  }

  closePopup() {
    this.popupState = null;
    this.popup.setVisible(false);
    this._clearPopupButtons();
  }

  _refreshPopup() {
    if (!this.popup.visible || !this.popupState) return;

    if (this.popupState.kind === "fort") {
      this.popupBody.setText(this._getFortSummaryLines().join("\n"));
      return;
    }

    const currentStatus = this._getSlotStatus(this.popupState.slotId);
    if (this.popupState.view === "chooser" || this.popupState.view === "detail") {
      if (currentStatus.kind !== "empty") {
        this.popupState.view = currentStatus.kind;
        this._renderPopup();
      }
      return;
    }

    if (currentStatus.kind === "empty") {
      this._openChooser(this.popupState.slotId);
      return;
    }

    if (this.popupState.view !== currentStatus.kind) {
      this.popupState.view = currentStatus.kind;
      this._renderPopup();
      return;
    }

    if (this.popupState.view === "pressure-live" || this.popupState.view === "active" || this.popupState.view === "pressure-incoming") {
      this._refreshSummaryPopup(this.popupState.slotId, currentStatus);
    }
  }

  _refreshSummaryPopup(slotId, status, withButtons = false) {
    const slotLabel = SLOT_LABELS[slotId];
    const skull = "\u{1F480}";

    if (status.kind === "pressure-incoming") {
      this._setPopupTheme({
        bgColor: 0x7f1d1d,
        bgAlpha: 0.34,
        strokeColor: 0xfca5a5,
        titleColor: "#fff1f1",
        bodyColor: "#ffe1e1",
      });
      const info = status.incoming;
      this.popupTitle.setText(`${skull} ${slotLabel} Pressure`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText([
        `ETA: ${info.remainingText}`,
        `Difficulty: ${skull.repeat(info.difficulty)}`,
        `Spawners: ${info.spawners}`,
        `Raiders: ${info.enemies}`,
      ].join("\n"));
    } else if (status.kind === "pressure-live") {
      this._setPopupTheme({
        bgColor: 0x7f1d1d,
        bgAlpha: 0.36,
        strokeColor: 0xfca5a5,
        titleColor: "#fff1f1",
        bodyColor: "#ffe1e1",
      });
      const inst = status.contract;
      const totalSpawners = inst?.spawners?.length || inst?.difficulty || 1;
      const activeSpawners = (inst?.spawners || []).filter((s) => s?.building && !s.building._destroyed).length;
      const totalRaiders = inst?.totalPlannedEnemies || (inst?.difficulty || 1) * (PRESSURE.baseEnemiesPerSpawner ?? 3);
      const aliveRaiders = Math.max(0, Number(inst?.spawned || 0) - Number(inst?.killed || 0));
      this.popupTitle.setText(`${skull} ${slotLabel} Pressure`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText([
        `Difficulty: ${skull.repeat(inst?.difficulty || 1)}`,
        `Spawners Active: ${activeSpawners}/${totalSpawners}`,
        `Raiders Alive: ${aliveRaiders}/${totalRaiders}`,
        `Destroyed: ${inst?.killed || 0}/${totalRaiders}`,
      ].join("\n"));
    } else if (status.kind === "active") {
      const inst = status.contract;
      const def = CONTRACT_DEFS[inst?.type] || CONTRACT_DEFS.FOREST;
      this._setPopupTheme({
        bgColor: def.color ?? 0x1f2937,
        bgAlpha: 0.34,
        strokeColor: 0xffffff,
        titleColor: "#ffffff",
        bodyColor: "#eef7ff",
      });
      const remainingMs = Math.max(0, Number(inst?.expireAt || 0) - (this.scene.time?.now || 0));
      this.popupTitle.setText(`${def.emoji} ${slotLabel} ${def.title}`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText([
        `Time Left: ${fmtMMSS(remainingMs)}`,
        `${def.title} is active.`,
      ].join("\n"));
    }

    if (withButtons) {
      this._addPopupButtons([
        { x: 140, y: 220, w: 90, h: 32, label: "Close", onClick: () => this.closePopup() },
      ]);
    }
  }

  _renderPopup() {
    if (!this.popupState) return;
    this._clearPopupButtons();

    if (this.popupState.kind === "fort") {
      this._setPopupTheme({
        bgColor: 0x4c1d95,
        bgAlpha: 0.34,
        strokeColor: 0xfbbf24,
        titleColor: "#fff5cf",
        bodyColor: "#f6ecff",
      });
      this.popupTitle.setText("👑 North Fort");
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText(this._getFortSummaryLines().join("\n"));
      this._addPopupButtons([
        { x: 140, y: 220, w: 90, h: 32, label: "Close", onClick: () => this.closePopup() },
      ]);
      return;
    }

    const { slotId, view } = this.popupState;
    const slotLabel = SLOT_LABELS[slotId];

    if (view === "chooser") {
      this._setPopupTheme({
        bgColor: 0x374151,
        bgAlpha: 0.34,
        strokeColor: 0xffffff,
        titleColor: "#ffffff",
        bodyColor: "#e5edf7",
      });
      this.popupTitle.setText(`${slotLabel} Contract`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText("Pick a contract to inspect, then buy it here.");
      const buttons = [];
      BUYABLE_TYPES.forEach((type, index) => {
        const def = CONTRACT_DEFS[type];
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = 74 + col * 132;
        const y = 108 + row * 40;
        const cost = type === "MARKET"
          ? 40
          : calcContractCost(this.world ?? this.scene, type, 1);
        buttons.push({
          x,
          y,
          w: 120,
          h: 34,
          label: `${def.emoji} ${def.title.replace(" Contract", "")}\n$${cost}`,
          onClick: () => this._openDetail(slotId, type),
        });
      });
      buttons.push({ x: 140, y: 228, w: 90, h: 32, label: "Close", onClick: () => this.closePopup() });
      this._addPopupButtons(buttons);
      return;
    }

    if (view === "detail") {
      const type = this.popupState.type;
      if (type === "PRESSURE") {
        this._setPopupTheme({
          bgColor: 0x7f1d1d,
          bgAlpha: 0.36,
          strokeColor: 0xfca5a5,
          titleColor: "#fff1f1",
          bodyColor: "#ffe1e1",
        });
        const diff = this.popupState.difficulty ?? 1;
        const est = estimatePressureContract(this.world ?? this.scene, diff);
        this.popupTitle.setText("💀 Pressure Contract");
        this.popupBody.setPosition(18, 52);
        this.popupBody.setText([
          `Difficulty: ${"💀".repeat(diff)}`,
          `Cost: $${est.cost}`,
          `Spawners: ${diff}`,
          `Raiders: ${diff * (PRESSURE.baseEnemiesPerSpawner ?? 3)}`,
        ].join("\n"));

        const buttons = [
          { x: 56, y: 158, w: 60, h: 32, label: "💀 1", onClick: () => { this.popupState.difficulty = 1; this._renderPopup(); } },
          { x: 140, y: 158, w: 60, h: 32, label: "💀 2", onClick: () => { this.popupState.difficulty = 2; this._renderPopup(); } },
          { x: 224, y: 158, w: 60, h: 32, label: "💀 3", onClick: () => { this.popupState.difficulty = 3; this._renderPopup(); } },
          { x: 78, y: 220, w: 90, h: 32, label: "← Back", onClick: () => this._openChooser(slotId) },
          { x: 202, y: 220, w: 90, h: 32, label: "Start", onClick: () => this._commit(slotId, { type: "PRESSURE", difficulty: diff }) },
        ];
        this._addPopupButtons(buttons);
        return;
      }

      const def = CONTRACT_DEFS[type];
      this._setPopupTheme({
        bgColor: def.color ?? 0x1f2937,
        bgAlpha: 0.36,
        strokeColor: 0xffffff,
        titleColor: "#ffffff",
        bodyColor: "#eef7ff",
      });
      this.popupTitle.setText(`${def.emoji} ${def.title}`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText((def.lines?.(this.world ?? this.scene) ?? []).join("\n"));
      this._addPopupButtons([
        { x: 78, y: 220, w: 90, h: 32, label: "← Back", onClick: () => this._openChooser(slotId) },
        { x: 202, y: 220, w: 90, h: 32, label: "Buy", onClick: () => this._commit(slotId, { type }) },
      ]);
      return;
    }

    const status = this._getSlotStatus(slotId);
    if (status.kind === "pressure-incoming") {
      this._setPopupTheme({
        bgColor: 0x7f1d1d,
        bgAlpha: 0.34,
        strokeColor: 0xfca5a5,
        titleColor: "#fff1f1",
        bodyColor: "#ffe1e1",
      });
      const info = status.incoming;
      this.popupTitle.setText(`💀 ${slotLabel} Pressure`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText([
        `ETA: ${info.remainingText}`,
        `Difficulty: ${"💀".repeat(info.difficulty)}`,
        `Spawners: ${info.spawners}`,
        `Raiders: ${info.enemies}`,
      ].join("\n"));
    } else if (status.kind === "pressure-live") {
      this._setPopupTheme({
        bgColor: 0x7f1d1d,
        bgAlpha: 0.36,
        strokeColor: 0xfca5a5,
        titleColor: "#fff1f1",
        bodyColor: "#ffe1e1",
      });
      const inst = status.contract;
      const totalSpawners = inst?.spawners?.length || inst?.difficulty || 1;
      const activeSpawners = (inst?.spawners || []).filter((s) => s?.building && !s.building._destroyed).length;
      const totalRaiders = inst?.totalPlannedEnemies || (inst?.difficulty || 1) * (PRESSURE.baseEnemiesPerSpawner ?? 3);
      const aliveRaiders = Math.max(0, Number(inst?.spawned || 0) - Number(inst?.killed || 0));
      this.popupTitle.setText(`💀 ${slotLabel} Pressure`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText([
        `Difficulty: ${"💀".repeat(inst?.difficulty || 1)}`,
        `Spawners Active: ${activeSpawners}/${totalSpawners}`,
        `Raiders Alive: ${aliveRaiders}/${totalRaiders}`,
        `Destroyed: ${inst?.killed || 0}/${totalRaiders}`,
      ].join("\n"));
    } else if (status.kind === "active") {
      const inst = status.contract;
      const def = CONTRACT_DEFS[inst?.type] || CONTRACT_DEFS.FOREST;
      this._setPopupTheme({
        bgColor: def.color ?? 0x1f2937,
        bgAlpha: 0.34,
        strokeColor: 0xffffff,
        titleColor: "#ffffff",
        bodyColor: "#eef7ff",
      });
      const remainingMs = Math.max(0, Number(inst?.expireAt || 0) - (this.scene.time?.now || 0));
      this.popupTitle.setText(`${def.emoji} ${slotLabel} ${def.title}`);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText([
        `Time Left: ${fmtMMSS(remainingMs)}`,
        `${def.title} is active.`,
      ].join("\n"));
    }

    this._addPopupButtons([
      { x: 140, y: 220, w: 90, h: 32, label: "Close", onClick: () => this.closePopup() },
    ]);
  }

  _clearPopupButtons() {
    this.popupObjects.forEach((obj) => obj?.destroy?.());
    this.popupObjects = [];
  }

  _addPopupButtons(defs) {
    defs.forEach((cfg) => {
      const btn = makeButton(this.scene, cfg);
      this.popup.add(btn);
      this.popupObjects.push(btn);
    });
  }

  _commit(slotId, payload) {
    const pm = this.world?.parcelManager;
    if (!pm) return;

    const status = this._getSlotStatus(slotId);
    if (status.kind !== "empty") return;

    const type = payload.type;
    const difficulty = payload.difficulty ?? 1;
    const cost = payload.cost != null
      ? payload.cost
      : calcContractCost(this.world ?? this.scene, type, difficulty);

    if (cost > 0) {
      if (!this.scene.checkSufficientFunds(cost)) return;
      this.scene.updateMoney(-cost);
    }

    let started = null;
    try {
      if (type === "FOREST") started = pm.startForest(slotId);
      else if (type === "ROCK") started = pm.startRock(slotId);
      else if (type === "FARM") started = pm.startFarm?.(slotId);
      else if (type === "MILITIA") started = pm.startMilitia?.(slotId);
      else if (type === "PRESSURE") started = pm.startPressure(slotId, difficulty, { source: "manual" });
      else if (type === "MARKET") started = pm.startMarket(slotId);
    } catch (err) {
      console.error("ContractHud commit failed:", err);
    }

    if (!started) {
      if (cost > 0) this.scene.updateMoney(+cost);
      return;
    }

    this.closePopup();
  }
}
