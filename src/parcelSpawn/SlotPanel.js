import { makeButton } from "./ui/makeButton.js";
import { BasePage } from "./pages/BasePage.js";
import { ForestPage } from "./pages/ForestPage.js";
import { RockPage } from "./pages/RockPage.js";
import { PressurePage } from "./pages/PressurePage.js";
import { calcContractCost } from "../constants.js";
import { MarketPage } from "./pages/MarketPage.js";

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

    this._buildFrame();
    this._buildGrid();
  }

  _buildFrame() {
    this.frameG = this.scene.add.graphics();
    this.frameG.setScrollFactor(1);
    this.container.add(this.frameG);
    this._drawFrameTheme(false);

    this.header = this.scene.add.text(0, -this.H/2, this._titleForSlot(), {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);
    this.header.setScrollFactor(1);
    this.container.add(this.header);
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
    if (this.id === "W") return "Contract (West)";
    if (this.id === "E") return "Contract (East)";
    if (this.id === "S") return "Contract (South)";
    return "Contract";
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

  open(type) {
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
    this.gridObjects.forEach(o => o.setVisible(!this._pressureMode));
    this._state = "GRID";
  }

  resetToGrid() {
    this.clearPressureState();
    this.back();
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

    const type = payload.type;
    const difficulty = payload.difficulty ?? 1;

    // ✅ compute cost (allow payload.cost override if you really want)
    const cost = (payload.cost != null) ? payload.cost : calcContractCost(this.scene, type, difficulty);

    // ✅ enforce money
    // mapView has checkSufficientFunds + updateMoney
    if (cost > 0) {
      if (!this.scene.checkSufficientFunds(cost)) return; // shows alert internally :contentReference[oaicite:2]{index=2}
      this.scene.updateMoney(-cost);                      // :contentReference[oaicite:3]{index=3}
    }

    try {
      if (type === "FOREST") pm.startForest(this.id);
      else if (type === "ROCK") pm.startRock(this.id);
      else if (type === "FARM") pm.startFarm?.(this.id);          // add startFarm below
      else if (type === "MILITIA") pm.startMilitia?.(this.id);    // stub below
      else if (type === "PRESSURE") pm.startPressure(this.id, difficulty, { source: "manual" });
      else if (type === "MARKET") pm.startMarket(this.id);
      else console.warn("Unknown contract type:", type);
    } catch (e) {
      console.error("Contract commit failed:", e);
      // optional: refund on error
      if (cost > 0) this.scene.updateMoney(+cost);
      return;
    }

    this.playCloseTween(() => this.setVisible(false));
  }

  _ensurePressureText() {
    if (this._pressureText) return;

    this._pressureText = this.scene.add.text(
      0, 2,
      "",
      {
        fontFamily: "monospace",
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

  setPressureCountdown({ remainingText, spawners, enemies, enemyType }) {
    this._ensurePressureText();
    this._pressureMode = true;
    this._drawFrameTheme(true);
    this.header?.setColor?.("#ffd6d6");

    this.gridObjects?.forEach(o => o.setVisible(false));
    if (this._page?.container) this._page.container.setVisible(false);

    this._pressureText.setVisible(true);
    this._pressureText.setText([
      "🚨 INCOMING RAID 🚨",
      `${remainingText}`,
      `🧨 Spawners ${spawners}  👹 Enemies ${enemies}`,
      `⚔️ ${enemyType} squad in ${this._titleForSlot()}`,
    ].join("\n"));
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

  setPressureLive({ spawners, enemies, enemyType }) {
    this._ensurePressureText();
    this._pressureMode = true;
    this._drawFrameTheme(true);
    this.header?.setColor?.("#ffd6d6");

    this.gridObjects?.forEach(o => o.setVisible(false));
    if (this._page?.container) this._page.container.setVisible(false);

    this._pressureText.setVisible(true);
    this._pressureText.setText([
      "⚠️ RAID ACTIVE ⚠️",
      `🧨 Spawners ${spawners}  👹 Enemies ${enemies}`,
      `⚔️ ${enemyType} assault in ${this._titleForSlot()}`,
    ].join("\n"));
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

    // Restore normal UI (only if panel is visible)
    this.gridObjects?.forEach(o => o.setVisible(true));
    if (this._page?.container) this._page.container.setVisible(true);
  }

  setVisible(v) {
    const was = this.container.visible;
    this.container.setVisible(v);

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
