import { UIDEPTH, estimatePressureContract, showAlert } from "../constants.js";
import { PRESSURE } from "../parcel_system/ParcelConfig.js";
import { StageState } from "../parcelController/StageState.js";
import { Teams } from "../Teams.js";
import { makeButton } from "../parcelSpawn/ui/makeButton.js";
import { formatPermitCostText, getContractPermitCost } from "../permitSystem.js";
import { hasStoreUnlock, STORE_UNLOCK_KEYS } from "../parcel_system/StoreUnlockSystem.js";

const SLOT_ORDER = ["N", "E", "S", "W"];
const SLOT_LABELS = {
  N: "NORTH",
  S: "SOUTH",
  E: "EAST",
  W: "WEST",
};
const FORT_ICON = "\u265B";
const FORT_TOWER_ICON = "\u265C";

const CONTRACT_DEFS = {
  FOREST: {
    emoji: "🌲",
    title: "Forest Contract",
    color: 0x166534,
    lines: (scene) => [
      "Spawns a forest parcel.",
      "Timer-based resource run.",
      "",
      `Permit Cost: ${formatPermitCostText(getContractPermitCost("FOREST"))}`,
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
      `Permit Cost: ${formatPermitCostText(getContractPermitCost("ROCK"))}`,
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
      `Permit Cost: ${formatPermitCostText(getContractPermitCost("MARKET"))}`,
    ],
  },
  FARM: {
    emoji: "🌾",
    title: "Field Contract",
    color: 0x15803d,
    lines: (scene) => [
      "Dark field parcel.",
      "Mixed seed and berry bushes grow there.",
      "",
      `Permit Cost: ${formatPermitCostText(getContractPermitCost("FARM"))}`,
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
      `Permit Cost: ${formatPermitCostText(getContractPermitCost("MILITIA"))}`,
    ],
  },
  LOCKED_MILITIA: {
    emoji: "🔒",
    title: "Locked",
    color: 0x374151,
    lines: () => [
      "Unlocks at Town XP Level 3.",
      "Militia parcel is not available yet.",
    ],
  },
};

const BUYABLE_TYPES = ["FOREST", "ROCK", "PRESSURE", "MARKET", "FARM"];

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
    this._popupTween = null;
    this._clusterTween = null;
    this._hudVisible = false;

    this._buildSquares();
    this._buildPopup();
    this._layout();
    this._refreshSquares();
    this._hudVisible = this.world?.zoomMixer?.mode !== "overview";
    this.root.setVisible(this._hudVisible);
    if (this._hudVisible) this._playSquareClusterIntro();

    this._onResize = () => this._layout();
    this.scene.scale.on("resize", this._onResize);
  }

  destroy() {
    this._stopPopupTween();
    this._stopClusterTween();
    this.squares.forEach((_, slotId) => this._stopSquareTween(slotId));
    this.scene.scale.off("resize", this._onResize);
    this.root?.destroy(true);
  }

  update() {
    const isDetailed = this.world?.zoomMixer?.mode !== "overview";
    if (isDetailed !== this._hudVisible) {
      this._hudVisible = isDetailed;
      if (isDetailed) this._showHudCluster();
      else this._hideHudCluster();
    }
    if (!isDetailed) {
      return;
    }

    this._refreshSquares();
    this._refreshPopup();
  }

  focusSlot(slotId) {
    if (!this._hudVisible || !slotId) return false;
    const status = this._getSlotStatus(slotId);
    if (!status) return false;
    if (status.kind === "locked-empty") {
      this._showParcelLockedMessage();
      return false;
    }
    if (status.kind === "empty") {
      this._openChooser(slotId);
      return true;
    }
    this._openSummary(slotId);
    return true;
  }

  setExternalHover(slotId, hovered = false) {
    const slot = this.squares.get(slotId);
    if (!slot) return;
    slot.externalHovered = !!hovered;
    this._applySquareVisual(slotId, this._getSlotStatus(slotId));
  }

  _getWorldNowMs() {
    return Number(this.world?.getSimulationNow?.() ?? this.world?.simNowMs ?? 0);
  }

  _getPhaseInfo() {
    return this.world?.clock?.getPhaseInfo?.() ?? null;
  }

  _getTownLevel() {
    return Math.max(1, Number(this.world?.getTownXpSnapshot?.()?.level || 1));
  }

  _isMilitiaUnlocked() {
    return hasStoreUnlock(STORE_UNLOCK_KEYS.militiaParcel);
  }

  _canAccessMilitia() {
    return this._isMilitiaUnlocked() && this._getTownLevel() >= 3;
  }

  _showMilitiaLockedMessage() {
    showAlert(this.scene, "🔒 Unlocks at Town XP Level 3", "#ffe08a");
  }

  _getBuyableTypes() {
    const base = ["FOREST", "ROCK", "PRESSURE", "MARKET", "FARM"];
    if (this._canAccessMilitia()) {
      base.push("MILITIA");
    } else {
      base.push("LOCKED_MILITIA");
    }
    return base;
  }
  _canBuyContracts() {
    return this.world?.clock?.canBuyParcels?.() ?? true;
  }

  _showParcelLockedMessage() {
    showAlert(this.scene, "Parcel contracts stay open during every phase.", "#a7f3d0");
  }

  _getNorthFortArrival() {
    return this.world?.getNorthFortArrivalInfo?.() ?? null;
  }

  _stopPopupTween() {
    if (this.popup) this.scene.tweens.killTweensOf(this.popup);
    this._popupTween = null;
  }

  _stopSquareTween(slotId) {
    const slot = this.squares.get(slotId);
    if (!slot?.group) return;
    this.scene.tweens.killTweensOf(slot.group);
  }

  _stopClusterTween() {
    const groups = SLOT_ORDER.map((slotId) => this.squares.get(slotId)?.group).filter(Boolean);
    if (groups.length) this.scene.tweens.killTweensOf(groups);
    this._clusterTween = null;
  }

  _showHudCluster() {
    this.root.setVisible(true);
    this._playSquareClusterIntro();
  }

  _hideHudCluster() {
    this.closePopup(false);
    this._stopClusterTween();
    const groups = SLOT_ORDER.map((slotId) => this.squares.get(slotId)?.group).filter(Boolean);
    if (!groups.length) {
      this.root.setVisible(false);
      return;
    }

    let completed = 0;
    groups.forEach((group, index) => {
      this.scene.tweens.add({
        targets: group,
        scaleX: 0.74,
        scaleY: 0.74,
        alpha: 0,
        duration: 120,
        delay: index * 24,
        ease: "Back.easeIn",
        onComplete: () => {
          completed += 1;
          if (completed < groups.length) return;
          groups.forEach((entry) => {
            entry.setScale(1);
            entry.setAlpha(1);
          });
          this.root.setVisible(false);
          this._clusterTween = null;
        },
      });
    });
  }

  _playSquareClusterIntro() {
    this._stopClusterTween();
    this.root.setVisible(true);
    SLOT_ORDER.forEach((slotId, index) => {
      const slot = this.squares.get(slotId);
      if (!slot?.group) return;
      slot.group.setScale(0.72);
      slot.group.setAlpha(0);
      this.scene.tweens.add({
        targets: slot.group,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 220,
        delay: index * 45,
        ease: "Back.easeOut",
      });
    });
  }

  _animateSquare(slotId, mode = "open") {
    const slot = this.squares.get(slotId);
    if (!slot?.group) return;

    const config = mode === "buy"
      ? { scale: 1.18, alpha: 1, duration: 150, hold: 50, ease: "Back.easeOut" }
      : mode === "close"
        ? { scale: 0.82, alpha: 0.74, duration: 110, hold: 10, ease: "Quad.easeInOut" }
        : { scale: 1.12, alpha: 1, duration: 130, hold: 24, ease: "Back.easeOut" };

    this._stopSquareTween(slotId);
    this.scene.tweens.add({
      targets: slot.group,
      scaleX: config.scale,
      scaleY: config.scale,
      alpha: config.alpha,
      duration: config.duration,
      hold: config.hold,
      yoyo: true,
      ease: config.ease,
      onComplete: () => {
        slot.group.setScale(1);
        slot.group.setAlpha(1);
      },
    });
  }

  _getPopupAnchorSlotId(state = this.popupState) {
    if (!state) return null;
    return state.slotId ?? null;
  }

  _animatePopupOpen(slotId = null) {
    this._stopPopupTween();
    this.popup.setVisible(true);
    this.popup.setScale(0.88);
    this.popup.setAlpha(0);
    if (slotId) this._animateSquare(slotId, "open");
    this._popupTween = this.scene.tweens.add({
      targets: this.popup,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.easeOut",
      onComplete: () => {
        this._popupTween = null;
      },
    });
  }

  _buildSquares() {
    for (const slotId of SLOT_ORDER) {
      const group = this.scene.add.container(0, 0);
      const defaultIconText = "+";
      const defaultTimerText = "BUY";
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

      const icon = this.scene.add.text(0, 34, "+", {
        fontFamily: "Bungee",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#001018",
        strokeThickness: 5,
        align: "center",
      }).setOrigin(0.5);

      const timer = this.scene.add.text(0, 72, "BUY", {
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
      this.squares.set(slotId, {
        group,
        label,
        frame,
        icon,
        timer,
        zone,
        hovered: false,
        pressed: false,
        externalHovered: false,
      });
      icon.setText(defaultIconText);
      timer.setText(defaultTimerText);
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
    const stackX = 54;
    const xpBottom = Math.round(
      (this.scene?.townXpHud?.y ?? 72) + ((this.scene?.townXpHud?.panelHeight ?? 60) / 2)
    );
    const topY = Math.max(132, xpBottom + 16);
    const gap = 94;

    SLOT_ORDER.forEach((slotId, index) => {
      const x = stackX;
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
    const isHovered = !!(slot.hovered || slot.externalHovered);
    const strokeAlpha = slot.pressed ? 0.95 : isHovered ? 0.78 : 0.55;
    const iconColor = status.iconColor ?? "#ffffff";

    slot.frame.clear();
    if (fillAlpha > 0) {
      const boostedFill = isHovered ? Math.min(fillAlpha + 0.08, 1) : fillAlpha;
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
      const remainingMs = Math.max(0, Number(active.expireAt || 0) - this._getWorldNowMs());
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

      if (!this._canBuyContracts()) {
        return {
          kind: "locked-empty",
          iconText: "🔒",
          timerText: "LOCK",
          fillColor: 0x1f2937,
          strokeColor: 0xfbbf24,
          iconSize: 24,
          fillAlpha: 0.18,
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
    return this.world?.towerPressureController?.getSlotPressureInfo?.(slotId)
      ?? null;
  }

  _getPressureSummaryLines(info, { live = false, contract = null } = {}) {
    const skull = "\u{1F480}";
    const difficulty = Math.max(1, Number(info?.difficulty || 1));
    const enemyTypeLabel = String(info?.enemyTypeLabel || "Raiders");
    const lines = [];

    if (live) {
      lines.push("Status: LIVE");
    } else if (info?.remainingText) {
      lines.push(`ETA: ${info.remainingText}`);
    }

    if (Number.isFinite(info?.hordeIndex) && Number(info.hordeIndex) > 0) {
      lines.push(`Horde: ${info.hordeIndex}`);
    }

    lines.push(`Difficulty: ${skull.repeat(difficulty)}`);

    if (info?.modifierLabel) {
      lines.push(`Modifier: ${info.modifierLabel}`);
    }

    if (live) {
      const totalSpawners = Math.max(1, Number(info?.spawners || contract?.spawners?.length || 1));
      const activeSpawners = Math.max(
        0,
        Number(
          info?.activeSpawners
          || (contract?.spawners || []).filter((s) => s?.building && !s.building._destroyed).length
        )
      );
      const totalEnemies = Math.max(
        0,
        Number(info?.enemies || contract?.totalPlannedEnemies || 0)
      );
      const aliveEnemies = Math.max(
        0,
        Number(info?.aliveEnemies || (Number(contract?.spawned || 0) - Number(contract?.killed || 0)))
      );
      const killedEnemies = Math.max(0, Number(contract?.killed || 0));

      lines.push(`Spawners Active: ${activeSpawners}/${totalSpawners}`);
      lines.push(`${enemyTypeLabel} Alive: ${aliveEnemies}/${totalEnemies}`);
      lines.push(`Destroyed: ${killedEnemies}/${totalEnemies}`);
      return lines;
    }

    lines.push(`Spawners: ${Math.max(1, Number(info?.spawners || 1))}`);
    lines.push(`${enemyTypeLabel}: ${Math.max(0, Number(info?.enemies || 0))}`);
    return lines;
  }

  _getFortSummaryLines() {
    const arrival = this._getNorthFortArrival();
    if (arrival) {
      return [
        `Arrival: Day ${arrival.arrivalDay}`,
        `${arrival.statusText}`,
        `Season ${arrival.seasonIndex}  Stage ${arrival.stageIndex}`,
      ];
    }

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

  _getFortPopupConfig() {
    const arrival = this._getNorthFortArrival();
    if (arrival) {
      return {
        theme: {
          bgColor: 0x4c1d95,
          bgAlpha: 0.34,
          strokeColor: 0xf0abfc,
          titleColor: "#fff5cf",
          bodyColor: "#f6ecff",
        },
        title: `${FORT_TOWER_ICON} North Fort Incoming`,
        body: [
          `Arrival: Day ${arrival.arrivalDay}`,
          `${arrival.statusText}`,
          `Season ${arrival.seasonIndex}`,
          `Stage ${arrival.stageIndex}`,
        ].join("\n"),
      };
    }

    return {
      theme: {
        bgColor: 0x4c1d95,
        bgAlpha: 0.34,
        strokeColor: 0xfbbf24,
        titleColor: "#fff5cf",
        bodyColor: "#f6ecff",
      },
      title: `${FORT_ICON} North Fort`,
      body: this._getFortSummaryLines().join("\n"),
    };

    if (false && arrival) {
      return {
        theme: {
          bgColor: 0x4c1d95,
          bgAlpha: 0.34,
          strokeColor: 0xf0abfc,
          titleColor: "#fff5cf",
          bodyColor: "#f6ecff",
        },
        title: "♜ North Fort Incoming",
        body: [
          `Arrival: Day ${arrival.arrivalDay}`,
          `${arrival.statusText}`,
          `Season ${arrival.seasonIndex}`,
          `Stage ${arrival.stageIndex}`,
        ].join("\n"),
      };
    }

    return {
      theme: {
        bgColor: 0x4c1d95,
        bgAlpha: 0.34,
        strokeColor: 0xfbbf24,
        titleColor: "#fff5cf",
        bodyColor: "#f6ecff",
      },
      title: "♛ North Fort",
      body: this._getFortSummaryLines().join("\n"),
    };
  }

  _onSquareClicked(slotId) {
    if (this.popupState?.slotId === slotId) {
      this.closePopup();
      return;
    }

    const status = this._getSlotStatus(slotId);
    if (status.kind === "locked-empty") {
      this._showParcelLockedMessage();
      return;
    }
    if (status.kind === "empty") {
      this._openChooser(slotId);
      return;
    }

    this._openSummary(slotId);
  }

  _openFortPopup() {
    const animatePopup = !this.popup.visible;
    this.popupState = { kind: "fort" };
    this._positionPopupFor("N");
    this._renderPopup();
    if (animatePopup) this._animatePopupOpen("N");
    else this._animateSquare("N", "open");
  }

  _openChooser(slotId) {
    const animatePopup = !this.popup.visible;
    this.popupState = { kind: "slot", slotId, view: "chooser" };
    this._positionPopupFor(slotId);
    this._renderPopup();
    if (animatePopup) this._animatePopupOpen(slotId);
    else this._animateSquare(slotId, "open");
  }

  _openDetail(slotId, type) {
    if (type === "MILITIA" && !this._canAccessMilitia()) {
      this._showMilitiaLockedMessage();
      return;
    }

    const animatePopup = !this.popup.visible;
    this.popupState = {
      kind: "slot",
      slotId,
      view: "detail",
      type,
      difficulty: 1,
    };
    this._positionPopupFor(slotId);
    this._renderPopup();
    if (animatePopup) this._animatePopupOpen(slotId);
    else this._animateSquare(slotId, "open");
  }

  _openSummary(slotId) {
    const animatePopup = !this.popup.visible;
    this.popupState = { kind: "slot", slotId, view: this._getSlotStatus(slotId).kind };
    this._positionPopupFor(slotId);
    this._renderPopup();
    if (animatePopup) this._animatePopupOpen(slotId);
    else this._animateSquare(slotId, "open");
  }

  closePopup(animated = true, squareMode = "close", forceSlotId = null) {
    const closingState = this.popupState;
    const slotId = forceSlotId ?? this._getPopupAnchorSlotId(closingState);
    const finish = () => {
      this.popupState = null;
      this.popup.setVisible(false);
      this.popup.setScale(1);
      this.popup.setAlpha(1);
      this._clearPopupButtons();
      this._popupTween = null;
    };

    if (!animated || !this.popup.visible) {
      finish();
      return;
    }

    this._stopPopupTween();
    if (slotId) this._animateSquare(slotId, squareMode);
    this._popupTween = this.scene.tweens.add({
      targets: this.popup,
      scaleX: 0.88,
      scaleY: 0.88,
      alpha: 0,
      duration: 120,
      ease: "Quad.easeIn",
      onComplete: finish,
    });
  }

  _refreshPopup() {
    if (!this.popup.visible || !this.popupState) return;

    if (this.popupState.kind === "fort") {
      const fortPopup = this._getFortPopupConfig();
      this._setPopupTheme(fortPopup.theme);
      this.popupTitle.setText(fortPopup.title);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText(fortPopup.body);
      return;
    }

    const currentStatus = this._getSlotStatus(this.popupState.slotId);
    if ((this.popupState.view === "chooser" || this.popupState.view === "detail") && !this._canBuyContracts()) {
      this.closePopup(false);
      return;
    }

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
      this.popupBody.setText(this._getPressureSummaryLines(info).join("\n"));
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
      this.popupBody.setText(this._getPressureSummaryLines({
        hordeIndex: inst?.pressureHordeIndex ?? null,
        difficulty: inst?.difficulty || 1,
        spawners: totalSpawners,
        activeSpawners,
        enemies: totalRaiders,
        aliveEnemies: aliveRaiders,
        enemyTypeLabel: inst?.enemyTypeLabel || "Raiders",
        modifierLabel: inst?.pressureModifier?.label || null,
      }, {
        live: true,
        contract: inst,
      }).join("\n"));
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
      const remainingMs = Math.max(0, Number(inst?.expireAt || 0) - this._getWorldNowMs());
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
      const fortPopup = this._getFortPopupConfig();
      this._setPopupTheme(fortPopup.theme);
      this.popupTitle.setText(fortPopup.title);
      this.popupBody.setPosition(18, 52);
      this.popupBody.setText(fortPopup.body);
      this._addPopupButtons([
        { x: 140, y: 220, w: 90, h: 32, label: "Close", onClick: () => this.closePopup() },
      ]);
      return;

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
      this._getBuyableTypes().forEach((type, index) => {
        const def = CONTRACT_DEFS[type];
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = 74 + col * 132;
        const y = 108 + row * 40;

        const isLockedMilitia = type === "LOCKED_MILITIA";
        const cost = isLockedMilitia ? 0 : getContractPermitCost(type, 1);

        buttons.push({
          x,
          y,
          w: 120,
          h: 34,
          label: isLockedMilitia
            ? `🔒 Level 3`
            : `${def.emoji} ${def.title.replace(" Contract", "")}\n${formatPermitCostText(cost)}`,
          onClick: () => {
            if (isLockedMilitia) {
              this._showMilitiaLockedMessage();
              return;
            }
            this._openDetail(slotId, type);
          },
        });
      });
      buttons.push({ x: 140, y: 228, w: 90, h: 32, label: "Close", onClick: () => this.closePopup() });
      this._addPopupButtons(buttons);
      return;
    }

    if (view === "detail") {
      const type = this.popupState.type;
      if (type === "MILITIA" && !this._canAccessMilitia()) {
        this._setPopupTheme({
          bgColor: 0x374151,
          bgAlpha: 0.36,
          strokeColor: 0xfbbf24,
          titleColor: "#ffffff",
          bodyColor: "#eef7ff",
        });
        this.popupTitle.setText("🔒 Locked");
        this.popupBody.setPosition(18, 52);
        this.popupBody.setText([
          "Unlocks at Town XP Level 3.",
          "Militia parcel is not available yet.",
        ].join("\n"));
        this._addPopupButtons([
          { x: 78, y: 220, w: 90, h: 32, label: "← Back", onClick: () => this._openChooser(slotId) },
        ]);
        return;
      }
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
          `Permit Cost: ${formatPermitCostText(getContractPermitCost("PRESSURE", diff))}`,
          `Max payout: $${est.gross}`,
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
      this.popupBody.setText(this._getPressureSummaryLines(info).join("\n"));
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
      this.popupBody.setText(this._getPressureSummaryLines({
        hordeIndex: inst?.pressureHordeIndex ?? null,
        difficulty: inst?.difficulty || 1,
        spawners: totalSpawners,
        activeSpawners,
        enemies: totalRaiders,
        aliveEnemies: aliveRaiders,
        enemyTypeLabel: inst?.enemyTypeLabel || "Raiders",
        modifierLabel: inst?.pressureModifier?.label || null,
      }, {
        live: true,
        contract: inst,
      }).join("\n"));
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
      const remainingMs = Math.max(0, Number(inst?.expireAt || 0) - this._getWorldNowMs());
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
    if (!this._canBuyContracts()) {
      this._showParcelLockedMessage();
      this.closePopup(false);
      return;
    }

    const status = this._getSlotStatus(slotId);
    if (status.kind !== "empty") return;

    const type = payload.type;
    const difficulty = payload.difficulty ?? 1;
    if (type === "MILITIA" && !this._canAccessMilitia()) {
      this._showMilitiaLockedMessage();
      return;
    }
    const cost = payload.cost != null
      ? payload.cost
      : getContractPermitCost(type, difficulty);

    if (cost > 0) {
      if (!this.scene.checkSufficientPermits(cost)) return;
      this.scene.updatePermits(-cost);
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
      if (cost > 0) this.scene.updatePermits(+cost);
      return;
    }

    pm.markContractPermitCost?.(started, cost);

    this.closePopup(true, "buy", slotId);
  }
}
