import { makeButton } from "./ui/makeButton.js";
import { BasePage } from "./pages/BasePage.js";
import { ForestPage } from "./pages/ForestPage.js";
import { RockPage } from "./pages/RockPage.js";
import { PressurePage } from "./pages/PressurePage.js";
import { MarketPage } from "./pages/MarketPage.js";
import { showAlert } from "../constants.js";
import { formatPermitCostText, getContractPermitCost } from "../permitSystem.js";

export class SlotPanel {
  constructor(scene, cfg) {
    this.scene = scene;
    this.id = cfg.id;
    this.W = cfg.W;
    this.H = cfg.H;

    this.container = scene.add.container(cfg.x, cfg.y);
    this.container.setScrollFactor(1);
    this.container.setDepth(9000);

    this._state = "GRID"; // GRID | PAGE
    this._page = null;
    this._pressureMode = false;
    this._pressureText = null;
    this._overviewStatusPrimary = null;
    this._overviewStatusSecondary = null;
    this._overviewCards = [];
    this._overviewPressureCards = [];
    this._overviewPressureObjects = [];
    this._overviewMenu = "GRID"; // GRID | PRESSURE
    this.mode = "detailed";
    this._detailHovered = false;

    this._buildFrame();
    this._buildDetailedProxy();
    this._buildGrid();
    this._buildOverviewGrid();
    this.setMode("detailed");
  }

  _buildFrame() {
    this.frameG = this.scene.add.graphics();
    this.frameG.setScrollFactor(1);
    this.container.add(this.frameG);
    this._drawFrameTheme(false);

    this.header = this.scene.add.text(0, -this.H/2, this._titleForSlot(), {
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);
    this.header.setScrollFactor(1);
    this.container.add(this.header);
  }

  _buildDetailedProxy() {
    this.detailProxyGlow = this.scene.add.rectangle(0, 0, 144, 56, 0x9ee6ff, 0.10)
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setVisible(false);
    this.detailProxyBadge = this.scene.add.rectangle(0, 0, 128, 42, 0x113048, 0.88)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xb7ecff, 0.46)
      .setScrollFactor(1)
      .setVisible(false);
    this.detailProxyLabel = this.scene.add.text(0, 0, this._directionLabel(), {
      fontFamily: "Bungee",
      fontSize: "18px",
      color: "#e9f7ff",
      stroke: "#04101a",
      strokeThickness: 4,
      align: "center",
    }).setOrigin(0.5).setScrollFactor(1).setVisible(false);
    this.detailHitZone = this.scene.add.zone(0, 0, this.W, this.H)
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setInteractive({ useHandCursor: true });

    this.detailHitZone.on("pointerover", (_pointer, _localX, _localY, event) => {
      if (this.mode === "overview" || !this.container.visible) return;
      event?.stopPropagation?.();
      this._setDetailedProxyHovered(true);
      this.scene?.uiScene?.contractHud?.setExternalHover?.(this.id, true);
    });
    this.detailHitZone.on("pointerout", (_pointer, event) => {
      if (this.mode === "overview") return;
      event?.stopPropagation?.();
      this._setDetailedProxyHovered(false);
      this.scene?.uiScene?.contractHud?.setExternalHover?.(this.id, false);
    });
    this.detailHitZone.on("pointerdown", (_pointer, _localX, _localY, event) => {
      if (this.mode === "overview" || !this.container.visible) return;
      event?.stopPropagation?.();
      this._setDetailedProxyHovered(true);
    });
    this.detailHitZone.on("pointerup", (_pointer, _localX, _localY, event) => {
      if (this.mode === "overview" || !this.container.visible) return;
      event?.stopPropagation?.();
      this._handleDetailedProxyClick();
    });

    this.container.add([this.detailProxyGlow, this.detailProxyBadge, this.detailProxyLabel, this.detailHitZone]);
  }

  _drawFrameTheme(pressureMode) {
    if (!this.frameG) return;
    const g = this.frameG;
    g.clear();

    if (pressureMode) {
      g.lineStyle(3, 0xff4d4d, 0.9);
      g.strokeRoundedRect(-this.W / 2, -this.H / 2, this.W, this.H, 16);
      g.fillStyle(0x3a0000, 0.38);
      g.fillRoundedRect(-this.W / 2 + 4, -this.H / 2 + 4, this.W - 8, this.H - 8, 14);
      return;
    }

    g.lineStyle(3, 0xffffff, 0.35);
    g.strokeRoundedRect(-this.W / 2, -this.H / 2, this.W, this.H, 16);
    g.fillStyle(0x0b1020, 0.10);
    g.fillRoundedRect(-this.W / 2 + 4, -this.H / 2 + 4, this.W - 8, this.H - 8, 14);
  }

  _titleForSlot() {
    if (this.id === "N") return "Contract (North)";
    if (this.id === "W") return "Contract (West)";
    if (this.id === "E") return "Contract (East)";
    if (this.id === "S") return "Contract (South)";
    return "Contract";
  }

  _directionLabel() {
    if (this.id === "N") return "NORTH";
    if (this.id === "W") return "WEST";
    if (this.id === "E") return "EAST";
    if (this.id === "S") return "SOUTH";
    return "CONTRACT";
  }

  _setDetailedProxyHovered(hovered) {
    this._detailHovered = !!hovered;
    this._refreshDetailedProxyVisual();
  }

  _refreshDetailedProxyVisual() {
    const isDetailed = this.mode !== "overview";
    const visible = isDetailed && this.container.visible;
    const isPressure = !!this._pressureMode;
    const hovered = !!this._detailHovered;

    this.header?.setVisible(false);
    this.detailProxyGlow?.setVisible(visible);
    this.detailProxyBadge?.setVisible(visible);
    this.detailProxyLabel?.setVisible(visible);
    if (this.detailHitZone?.input) {
      this.detailHitZone.input.enabled = visible;
    }

    if (!visible) {
      this.frameG?.setAlpha?.(1);
      return;
    }

    const frameAlpha = hovered ? 0.42 : isPressure ? 0.34 : 0.22;
    this.frameG?.setAlpha?.(frameAlpha);
    this.detailProxyLabel?.setText?.(this._directionLabel());

    const badgeFill = isPressure ? 0x4e1717 : hovered ? 0x173e57 : 0x113048;
    const badgeStroke = isPressure ? 0xffb0b0 : 0xb7ecff;
    const badgeStrokeAlpha = hovered ? 0.82 : 0.46;
    const badgeScale = hovered ? 1.06 : 1;
    const glowAlpha = hovered ? (isPressure ? 0.20 : 0.18) : (isPressure ? 0.14 : 0.08);

    this.scene.tweens.killTweensOf([this.detailProxyGlow, this.detailProxyBadge, this.detailProxyLabel]);
    this.detailProxyBadge?.setFillStyle?.(badgeFill, hovered ? 0.96 : 0.88);
    this.detailProxyBadge?.setStrokeStyle?.(hovered ? 3 : 2, badgeStroke, badgeStrokeAlpha);
    this.detailProxyGlow?.setFillStyle?.(isPressure ? 0xffb0b0 : 0x9ee6ff, glowAlpha);
    this.detailProxyLabel?.setColor?.(hovered ? "#ffffff" : "#e9f7ff");

    this.scene.tweens.add({
      targets: [this.detailProxyGlow, this.detailProxyBadge, this.detailProxyLabel].filter(Boolean),
      scaleX: badgeScale,
      scaleY: badgeScale,
      duration: 120,
      ease: "Sine.easeOut",
    });
  }

  _handleDetailedProxyClick() {
    if (this.mode === "overview") return;
    this.scene?.uiScene?.contractHud?.focusSlot?.(this.id);
  }

  _buildGrid() {
    const pad = 14;
    const innerW = this.W - pad*2;
    const gridTop = -this.H/2 + 44;

    const btnW = Math.floor(innerW / 2) - 10;
    const btnH = 34;
    const gapX = 10;
    const gapY = 10;

    const buttons = [
      { label: "🌲 Forest",   type: "FOREST"   },
      { label: "🪨 Rock",     type: "ROCK"     },
      { label: "⚔️ Pressure", type: "PRESSURE" },
      { label: "🏪 Market",   type: "MARKET"   },
      { label: "🌾 Farm",     type: "FARM"     },
      { label: "🛡 Militia",  type: "MILITIA"  },
    ];

    this.gridObjects = [];

    for (let i = 0; i < buttons.length; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;

      const x = -innerW/2 + (btnW/2) + col * (btnW + gapX);
      const y = gridTop + row * (btnH + gapY);

      const b = makeButton(this.scene, {
        x, y,
        w: btnW, h: btnH,
        label: buttons[i].label,
        onClick: () => this.open(buttons[i].type),
      });

      // Safety: ensure ALL children have scrollFactor=1.
      b.setScrollFactor(1);
      b.list?.forEach?.(go => go.setScrollFactor?.(1));

      this.container.add(b);
      this.gridObjects.push(b);
    }
  }

  _getOverviewDefs() {
    return [
      { type: "FOREST", emoji: "🌲", cost: () => getContractPermitCost("FOREST") },
      { type: "ROCK", emoji: "🪨", cost: () => getContractPermitCost("ROCK") },
      { type: "PRESSURE", emoji: "⚔️", difficulty: 1, cost: () => getContractPermitCost("PRESSURE", 1) },
      { type: "MARKET", emoji: "🏪", cost: () => getContractPermitCost("MARKET") },
      { type: "FARM", emoji: "🌾", cost: () => getContractPermitCost("FARM") },
      { type: "MILITIA", emoji: "🛡", cost: () => getContractPermitCost("MILITIA") },
    ];
  }

  _buildOverviewGrid() {
    const pad = 10;
    const innerW = this.W - pad * 2;
    const innerH = this.H - pad * 2;
    const cellW = Math.floor(innerW / 2) - 10;
    const cellH = Math.floor((innerH - 16) / 3) - 6;
    const startY = -innerH / 2 + cellH / 2 + 4;
    const defs = this._getOverviewDefs();

    this.overviewGridObjects = [];
    this._overviewCards = [];

    for (let i = 0; i < defs.length; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const x = -innerW / 2 + cellW / 2 + col * (cellW + 12);
      const y = startY + row * (cellH + 10);
      const def = defs[i];

      const bg = this.scene.add.rectangle(x, y, cellW, cellH, 0xffffff, 0.08)
        .setStrokeStyle(2, 0xffffff, 0.28)
        .setScrollFactor(1)
        .setInteractive({ useHandCursor: true });

      const emoji = this.scene.add.text(x, y - 26, def.emoji, {
        fontSize: "84px",
        stroke: "#001018",
        strokeThickness: 8,
      }).setOrigin(0.5).setScrollFactor(1);

      const cost = this.scene.add.text(x, y + 46, "", {
        fontFamily: "Bungee",
        fontSize: "32px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 8,
        align: "center",
      }).setOrigin(0.5).setScrollFactor(1);

      const payload = def.type === "PRESSURE"
        ? { type: "PRESSURE", difficulty: def.difficulty ?? 1 }
        : { type: def.type };

      bg.on("pointerover", () => bg.setFillStyle(0xffffff, 0.16));
      bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.08));
      bg.on("pointerdown", () => bg.setFillStyle(0xffffff, 0.22));
      bg.on("pointerup", () => {
        bg.setFillStyle(0xffffff, 0.16);
        if (this.mode !== "overview" || this._pressureMode) return;
        if (def.type === "PRESSURE") {
          this._openOverviewPressureMenu();
          return;
        }
        this.commit(payload);
      });

      this.container.add([bg, emoji, cost]);
      this.overviewGridObjects.push(bg, emoji, cost);
      this._overviewCards.push({ def, costText: cost });
    }

    this._overviewStatusPrimary = this.scene.add.text(0, -48, "", {
      fontFamily: "Bungee",
      fontSize: "100px",
      color: "#ffffff",
      stroke: "#001018",
      strokeThickness: 12,
      align: "center",
    }).setOrigin(0.5).setScrollFactor(1).setVisible(false);

    this._overviewStatusSecondary = this.scene.add.text(0, 112, "", {
      fontFamily: "Bungee",
      fontSize: "36px",
      color: "#d6f5ff",
      stroke: "#001018",
      strokeThickness: 10,
      align: "center",
      lineSpacing: 12,
      wordWrap: { width: this.W - 36 },
    }).setOrigin(0.5).setScrollFactor(1).setVisible(false);

    this.container.add([this._overviewStatusPrimary, this._overviewStatusSecondary]);
    this._buildOverviewPressureMenu(cellW, cellH, innerW, innerH);
    this._refreshOverviewGridCosts();
    this._refreshOverviewPressureCosts();
  }

  _refreshOverviewGridCosts() {
    const canBuy = this._canBuyContracts();
    for (const card of this._overviewCards) {
      if (!canBuy) {
        card.costText.setText("LOCK\nDAY");
        continue;
      }
      if (card.def.type === "PRESSURE") {
        card.costText.setText("PICK\nLEVEL");
        continue;
      }
      const amount = Number(card.def.cost?.() ?? 0);
      const extra = card.def.type === "PRESSURE" ? "1" : "";
      card.costText.setText(`${extra ? `D${extra}\n` : ""}${formatPermitCostText(amount)}`);
    }
  }

  _buildOverviewPressureMenu(cellW, cellH, innerW, innerH) {
    const skull = "\u{1F480}";
    const closeEmoji = "\u274C";
    const gap = 12;
    const pressureCardW = Math.floor((innerW - gap) / 2);
    const pressureCardH = Math.floor((innerH - gap) / 2);
    const leftX = -(pressureCardW / 2) - (gap / 2);
    const rightX = (pressureCardW / 2) + (gap / 2);
    const topY = -(pressureCardH / 2) - (gap / 2);
    const bottomY = (pressureCardH / 2) + (gap / 2);
    const defs = [
      { difficulty: 1, emoji: skull, x: leftX, y: topY },
      { difficulty: 2, emoji: skull.repeat(2), x: rightX, y: topY },
      { difficulty: 3, emoji: skull.repeat(3), x: leftX, y: bottomY },
      { close: true, emoji: closeEmoji, x: rightX, y: bottomY },
    ];

    this._overviewPressureCards = [];
    this._overviewPressureObjects = [];

    for (const def of defs) {
      const bg = this.scene.add.rectangle(def.x, def.y, pressureCardW, pressureCardH, 0xffffff, 0.08)
        .setStrokeStyle(2, 0xffffff, 0.28)
        .setScrollFactor(1)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);

      const emoji = this.scene.add.text(def.x, def.y - (def.close ? 0 : 12), def.emoji, {
        fontSize: def.close ? "64px" : def.difficulty === 3 ? "52px" : "62px",
        color: def.close ? "#ff6b6b" : "#ffffff",
        stroke: def.close ? "#3a0000" : "#001018",
        strokeThickness: 8,
      }).setOrigin(0.5).setScrollFactor(1).setVisible(false);

      const cost = this.scene.add.text(def.x, def.y + 32, "", {
        fontFamily: "Bungee",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 7,
        align: "center",
      }).setOrigin(0.5).setScrollFactor(1).setVisible(!def.close);

      bg.on("pointerover", () => bg.setFillStyle(0xffffff, 0.16));
      bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.08));
      bg.on("pointerdown", () => bg.setFillStyle(0xffffff, 0.22));
      bg.on("pointerup", () => {
        bg.setFillStyle(0xffffff, 0.16);
        if (this.mode !== "overview" || this._pressureMode || this._overviewMenu !== "PRESSURE") return;
        if (def.close) {
          this._closeOverviewPressureMenu();
          return;
        }
        this.commit({ type: "PRESSURE", difficulty: def.difficulty });
      });

      this.container.add([bg, emoji, cost]);
      this._overviewPressureObjects.push(bg, emoji, cost);
      if (!def.close) this._overviewPressureCards.push({ def, costText: cost });
    }
  }

  _refreshOverviewPressureCosts() {
    const canBuy = this._canBuyContracts();
    for (const card of this._overviewPressureCards) {
      if (!card?.costText || card.def?.close) continue;
      if (!canBuy) {
        card.costText.setText("LOCK");
        continue;
      }
      const amount = Number(getContractPermitCost("PRESSURE", card.def.difficulty) ?? 0);
      card.costText.setText(formatPermitCostText(amount));
    }
  }

  _openOverviewPressureMenu() {
    if (!this._canBuyContracts()) {
      this._showParcelLockedMessage();
      return;
    }
    this._overviewMenu = "PRESSURE";
    this._hideOverviewStatus();
    this._refreshOverviewPressureCosts();
    this._syncOverviewVisibility();
  }

  _closeOverviewPressureMenu() {
    this._overviewMenu = "GRID";
    this._hideOverviewStatus();
    this._syncOverviewVisibility();
  }

  _syncOverviewVisibility() {
    const showGrid = this.mode === "overview" && !this._pressureMode && this._overviewMenu !== "PRESSURE";
    const showPressureMenu = this.mode === "overview" && !this._pressureMode && this._overviewMenu === "PRESSURE";

    this.overviewGridObjects?.forEach(o => o.setVisible(showGrid));
    this._overviewPressureObjects?.forEach(o => o.setVisible(showPressureMenu));
  }

  _showOverviewStatus(primary, secondary) {
    this._overviewStatusPrimary?.setText(primary ?? "");
    this._overviewStatusSecondary?.setText(secondary ?? "");
    this._overviewStatusPrimary?.setVisible(true);
    this._overviewStatusSecondary?.setVisible(true);
    this.overviewGridObjects?.forEach(o => o.setVisible(false));
    this._overviewPressureObjects?.forEach(o => o.setVisible(false));
  }

  _hideOverviewStatus() {
    this._overviewStatusPrimary?.setVisible(false);
    this._overviewStatusSecondary?.setVisible(false);
  }

  setMode(mode) {
    this.mode = mode === "overview" ? "overview" : "detailed";
    const isOverview = this.mode === "overview";
    if (!isOverview) this._overviewMenu = "GRID";

    this.header?.setVisible(false);
    this._refreshOverviewGridCosts();
    this._refreshOverviewPressureCosts();

    if (!isOverview && this._state === "PAGE") {
      this._clearPage();
      this._state = "GRID";
    }

    if (this._pressureMode) {
      this.gridObjects?.forEach(o => o.setVisible(false));
      if (this._page?.container) this._page.container.setVisible(false);

      if (isOverview) {
        this._pressureText?.setVisible(false);
        this._overviewStatusPrimary?.setVisible(true);
        this._overviewStatusSecondary?.setVisible(true);
        this._overviewPressureObjects?.forEach(o => o.setVisible(false));
      } else {
        this._hideOverviewStatus();
        this.overviewGridObjects?.forEach(o => o.setVisible(false));
        this._overviewPressureObjects?.forEach(o => o.setVisible(false));
        this._pressureText?.setVisible(false);
      }
      this._refreshDetailedProxyVisual();
      return;
    }

    this._pressureText?.setVisible(false);
    this._hideOverviewStatus();

    if (isOverview) {
      this.gridObjects?.forEach(o => o.setVisible(false));
      if (this._page?.container) this._page.container.setVisible(false);
      this._syncOverviewVisibility();
    } else {
      this.overviewGridObjects?.forEach(o => o.setVisible(false));
      this._overviewPressureObjects?.forEach(o => o.setVisible(false));
      this.gridObjects?.forEach(o => o.setVisible(false));
      if (this._page?.container) this._page.container.setVisible(false);
    }

    this._refreshDetailedProxyVisual();
  }

  open(type) {
    if (!this._canBuyContracts()) {
      this._showParcelLockedMessage();
      return;
    }
    this._clearPage();

    // Hide grid buttons while a page is open
    this.gridObjects.forEach(o => o.setVisible(false));

    if (type === "FOREST") this._page = new ForestPage(this.scene, this);
    else if (type === "ROCK") this._page = new RockPage(this.scene, this);
    else if (type === "PRESSURE") this._page = new PressurePage(this.scene, this);
    else if (type === "MARKET") this._page = new MarketPage(this.scene, this);
    else {
      this._page = new BasePage(this.scene, this, {
        title: `${type} (todo)`,
        lines: ["Not implemented yet."],
        primaryLabel: "OK",
        onPrimary: () => this.back(),
      });
    }

    this._page.render();
    this._page.container.setScrollFactor(1);
    this.container.add(this._page.container);

    this._state = "PAGE";
  }

  back() {
    this._clearPage();
    // When pressure overlay is active, keep grid hidden.
    if (this.mode === "overview") {
      this.gridObjects.forEach(o => o.setVisible(false));
      this._syncOverviewVisibility();
    } else {
      this.gridObjects.forEach(o => o.setVisible(false));
      this._refreshDetailedProxyVisual();
    }
    this._state = "GRID";
  }

  resetToGrid() {
    this.clearPressureState();
    this.back();
  }

  resetUiState() {
    this._closeOverviewPressureMenu();
    this._hideOverviewStatus();
    this._clearPage();
    this._state = "GRID";
    this._refreshOverviewGridCosts();
    this._refreshOverviewPressureCosts();
    if (!this._pressureMode) {
      if (this.mode === "overview") this._syncOverviewVisibility();
      else this.gridObjects?.forEach(o => o.setVisible(false));
    }
    this._refreshDetailedProxyVisual();
  }

  _canBuyContracts() {
    return this.scene?.clock?.canBuyParcels?.() ?? true;
  }

  _showParcelLockedMessage() {
    showAlert(this.scene, "Parcel contracts stay open during every phase.", "#a7f3d0");
  }

  _clearPage() {
    if (!this._page) return;
    this._page.container.destroy(true);
    this._page = null;
  }

  /**
   * Called by pages when user confirms.
   * Spawns parcel via scene.parcelManager, then hides THIS slot's UI.
   */
  commit(payload) {
    const pm = this.scene.parcelManager;
    if (!pm) {
      console.warn("SlotPanel.commit: scene.parcelManager missing");
      return;
    }
    if (this._pressureMode) return;
    if (!this._canBuyContracts()) {
      this._showParcelLockedMessage();
      return;
    }
    this._closeOverviewPressureMenu();

    const type = payload.type;
    const difficulty = payload.difficulty ?? 1;

    // ✅ compute cost (allow payload.cost override if you really want)
    const cost = (payload.cost != null) ? payload.cost : getContractPermitCost(type, difficulty);

    // ✅ enforce permits
    if (cost > 0) {
      if (!this.scene.checkSufficientPermits(cost)) return;
      this.scene.updatePermits(-cost);
    }

    let started = null;
    try {
      if (type === "FOREST") started = pm.startForest(this.id);
      else if (type === "ROCK") started = pm.startRock(this.id);
      else if (type === "FARM") started = pm.startFarm?.(this.id);
      else if (type === "MILITIA") started = pm.startMilitia?.(this.id);
      else if (type === "PRESSURE") started = pm.startPressure(this.id, difficulty, { source: "manual" });
      else if (type === "MARKET") started = pm.startMarket(this.id);
      else console.warn("Unknown contract type:", type);
    } catch (e) {
      console.error("Contract commit failed:", e);
      // optional: refund on error
      if (cost > 0) this.scene.updatePermits(+cost);
      return;
    }

    if (!started) {
      if (cost > 0) this.scene.updatePermits(+cost);
      return;
    }

    pm.markContractPermitCost?.(started, cost);

    this.playCloseTween(() => this.setVisible(false));
  }

  _ensurePressureText() {
    if (this._pressureText) return;

    this._pressureText = this.scene.add.text(
      0, 2,
      "",
      {
        fontFamily: "Bungee",
        fontSize: "30px",
        color: "#ffe9e9",
        stroke: "#2b0000",
        strokeThickness: 5,
        align: "center",
        wordWrap: { width: this.W - 28 },
        lineSpacing: 6,
      }
    ).setOrigin(0.5, 0.5).setScrollFactor(1).setDepth(9999);

    this.container.add(this._pressureText);
    this._pressureText.setVisible(false);
  }

  setPressureCountdown({ remainingText, spawners, enemies, enemyType, modifierLabel = null }) {
    this._ensurePressureText();
    this._pressureMode = true;
    this._overviewMenu = "GRID";
    this._drawFrameTheme(true);
    this.header?.setColor?.("#ffd6d6");

    this.gridObjects?.forEach(o => o.setVisible(false));
    this.overviewGridObjects?.forEach(o => o.setVisible(false));
    this._overviewPressureObjects?.forEach(o => o.setVisible(false));
    if (this._page?.container) this._page.container.setVisible(false);

    if (this.mode === "overview") {
      this._pressureText.setVisible(false);
      this._showOverviewStatus(
        remainingText,
        [
          `🧨 ${spawners} SPAWNER${spawners === 1 ? "" : "S"}`,
          `👹 ${enemies} ${String(enemyType || "Raiders").toUpperCase()}`,
          modifierLabel ? `✨ ${String(modifierLabel).toUpperCase()}` : null,
        ].filter(Boolean).join("\n")
      );
      return;
    }

    this._hideOverviewStatus();
    this._pressureText.setVisible(false);
    this._refreshDetailedProxyVisual();
    return;
    this._pressureText.setVisible(true);
    this._pressureText.setText([
      "🚨 INCOMING RAID 🚨",
      `${remainingText}`,
      `🧨 Spawners ${spawners}  👹 Enemies ${enemies}`,
      `⚔️ ${enemyType} squad in ${this._titleForSlot()}`,
      modifierLabel ? `✨ ${modifierLabel}` : null,
    ].filter(Boolean).join("\n"));
    return;

    // Hide normal UI while pressure is active
    this.gridObjects?.forEach(o => o.setVisible(false));
    if (this._page?.container) this._page.container.setVisible(false);

    this._pressureText.setVisible(true);
    this._pressureText.setText(
      `⏳ Next raid: ${remainingText}\n` +
      `Spawners: ${spawners} | Enemies: ${enemies} | Type: ${enemyType}`
    );
  }

  setPressureLive({ spawners, enemies, enemyType, modifierLabel = null }) {
    this._ensurePressureText();
    this._pressureMode = true;
    this._overviewMenu = "GRID";
    this._drawFrameTheme(true);
    this.header?.setColor?.("#ffd6d6");

    this.gridObjects?.forEach(o => o.setVisible(false));
    this.overviewGridObjects?.forEach(o => o.setVisible(false));
    this._overviewPressureObjects?.forEach(o => o.setVisible(false));
    if (this._page?.container) this._page.container.setVisible(false);

    if (this.mode === "overview") {
      this._pressureText.setVisible(false);
      this._showOverviewStatus(
        "LIVE",
        [
          `🧨 ${spawners} SPAWNER${spawners === 1 ? "" : "S"}`,
          `👹 ${enemies} ${String(enemyType || "Raiders").toUpperCase()}`,
          modifierLabel ? `✨ ${String(modifierLabel).toUpperCase()}` : null,
        ].filter(Boolean).join("\n")
      );
      return;
    }

    this._hideOverviewStatus();
    this._pressureText.setVisible(false);
    this._refreshDetailedProxyVisual();
    return;
    this._pressureText.setVisible(true);
    this._pressureText.setText([
      "⚠️ RAID ACTIVE ⚠️",
      `🧨 Spawners ${spawners}  👹 Enemies ${enemies}`,
      `⚔️ ${enemyType} assault in ${this._titleForSlot()}`,
      modifierLabel ? `✨ ${modifierLabel}` : null,
    ].filter(Boolean).join("\n"));
    return;

    this.gridObjects?.forEach(o => o.setVisible(false));
    if (this._page?.container) this._page.container.setVisible(false);

    this._pressureText.setVisible(true);
    this._pressureText.setText(
      `⚠️ RAID IN PROGRESS\n` +
      `Spawners: ${spawners} | Enemies: ${enemies} | Type: ${enemyType}`
    );
  }

  clearPressureState() {
    this._pressureMode = false;
    this._drawFrameTheme(false);
    this.header?.setColor?.("#ffffff");
    if (this._pressureText) this._pressureText.setVisible(false);
    this._hideOverviewStatus();

    // Restore normal UI (only if panel is visible)
    if (this.mode === "overview") {
      this.gridObjects?.forEach(o => o.setVisible(false));
      if (this._page?.container) this._page.container.setVisible(false);
      this._syncOverviewVisibility();
    } else {
      this.overviewGridObjects?.forEach(o => o.setVisible(false));
      this._overviewPressureObjects?.forEach(o => o.setVisible(false));
      this.gridObjects?.forEach(o => o.setVisible(false));
      if (this._page?.container) this._page.container.setVisible(false);
    }
    this._refreshDetailedProxyVisual();
  }

  setVisible(v) {
    const was = this.container.visible;
    if (v) {
      this._refreshOverviewGridCosts();
      this._refreshOverviewPressureCosts();
    }
    this.container.setVisible(v);
    if (!v) {
      this._detailHovered = false;
      this.scene?.uiScene?.contractHud?.setExternalHover?.(this.id, false);
    }
    this._refreshDetailedProxyVisual();

    if (v && !was) {
      // if we're being shown after being hidden, open tween
      this.playOpenTween();
    }
  }

  playCloseTween(onDone) {
    // prevent double-trigger
    if (this._closing) return;
    this._closing = true;

    const targets = [
      this.container,
      this.header,
      this.frameG,
      ...(this.gridObjects ?? []),
      ...(this.overviewGridObjects ?? []),
      ...(this._overviewPressureObjects ?? []),
      this._overviewStatusPrimary,
      this._overviewStatusSecondary,
      this._pressureText,
    ].filter(Boolean);

    // fade buttons + header + frame
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 120,
      ease: "Quad.easeIn",
    });

    // “frame closes into center” feel: scale down the whole panel container
    this.container.setOrigin?.(0.5, 0.5); // harmless if container ignores it
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.05,
      scaleY: 0.05,
      duration: 160,
      ease: "Back.easeIn",
      onComplete: () => {
        this._closing = false;
        // reset scale for next open
        this.container.setScale(1);
        this.container.setAlpha(1);
        this.header?.setAlpha(1);
        this.frameG?.setAlpha(1);
        this.gridObjects?.forEach(o => o.setAlpha?.(1));
        this.overviewGridObjects?.forEach(o => o.setAlpha?.(1));
        this._overviewPressureObjects?.forEach(o => o.setAlpha?.(1));
        this._overviewStatusPrimary?.setAlpha?.(1);
        this._overviewStatusSecondary?.setAlpha?.(1);
        this._pressureText?.setAlpha?.(1);
        onDone?.();
      },
    });
  }

  playOpenTween() {
    // prevent re-open spam
    if (this._opening) return;
    this._opening = true;

    // start collapsed
    this.container.setScale(0.05);
    this.container.setAlpha(0);
    this.header?.setAlpha(0);
    this.frameG?.setAlpha(0);
    this.gridObjects?.forEach(o => o.setAlpha?.(0));
    this.overviewGridObjects?.forEach(o => o.setAlpha?.(0));
    this._overviewPressureObjects?.forEach(o => o.setAlpha?.(0));
    this._overviewStatusPrimary?.setAlpha?.(0);
    this._overviewStatusSecondary?.setAlpha?.(0);
    this._pressureText?.setAlpha?.(0);

    // scale open
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.easeOut",
    });

    // fade in internals slightly after
    const targets = [
      this.header,
      this.frameG,
      ...(this.gridObjects ?? []),
      ...(this.overviewGridObjects ?? []),
      ...(this._overviewPressureObjects ?? []),
      this._overviewStatusPrimary,
      this._overviewStatusSecondary,
      this._pressureText,
    ].filter(Boolean);

    this.scene.tweens.add({
      targets,
      alpha: 1,
      duration: 160,
      delay: 40,
      ease: "Quad.easeOut",
      onComplete: () => { this._opening = false; }
    });
  }

}
