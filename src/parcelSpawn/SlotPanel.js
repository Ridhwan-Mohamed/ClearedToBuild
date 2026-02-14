import { makeButton } from "./ui/makeButton.js";
import { BasePage } from "./pages/BasePage.js";
import { ForestPage } from "./pages/ForestPage.js";
import { RockPage } from "./pages/RockPage.js";
import { PressurePage } from "./pages/PressurePage.js";
import { calcContractCost } from "../constants.js";

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

    this._buildFrame();
    this._buildGrid();
  }

  _buildFrame() {
    const g = this.scene.add.graphics();
    g.setScrollFactor(1);

    // Hollow outline (no fill) + subtle inner glass
    g.lineStyle(3, 0xffffff, 0.35);
    g.strokeRoundedRect(-this.W/2, -this.H/2, this.W, this.H, 16);

    g.fillStyle(0x0b1020, 0.10);
    g.fillRoundedRect(-this.W/2 + 4, -this.H/2 + 4, this.W - 8, this.H - 8, 14);

    this.container.add(g);

    this.header = this.scene.add.text(0, -this.H/2, this._titleForSlot(), {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);
    this.header.setScrollFactor(1);
    this.container.add(this.header);
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
    this.gridObjects.forEach(o => o.setVisible(true));
    this._state = "GRID";
  }

  resetToGrid() {
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
      else if (type === "PRESSURE") pm.startPressure(this.id, difficulty);
      else console.warn("Unknown contract type:", type);
    } catch (e) {
      console.error("Contract commit failed:", e);
      // optional: refund on error
      if (cost > 0) this.scene.updateMoney(+cost);
      return;
    }

    this.setVisible(false);
  }

  setVisible(v) {
    this.container.setVisible(v);
  }
}
