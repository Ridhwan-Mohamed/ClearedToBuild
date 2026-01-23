// === WallDestroyController.js (snippet) ===
import { SQUARESIZE, UIDEPTH, CONTROL_STATES, TILE_TYPES, TILE_MAP } from "../constants";
import { Teams } from "../Teams";
import { Manager } from "../Manager/Manager";
import { Player } from "../players/Player";
import { Wall } from "../buildings/Wall";
import { Map as GameMap } from "../map";
import { buildingManager } from "../Manager/buildingManager";

export class WallDestroyController {
    constructor(scene) {
    this.scene = scene;
    this.active = false;

    this.consumeNextClick = false;
    this.selected = new Map();

    this.ui = null;
    this.uiBg = null;
    this.uiText = null;
    this.finalBtn = null;
    }


    start() {
        this.active = true;
        this.consumeNextClick = true;

        this.selected.clear();
        this.scene.input.setDefaultCursor('url(hammer.png), pointer');

        this._ensureUI();
        this._setBannerText();
        this._updateFinalizeEnabled(false);
    }

    stop() {
        this.active = false;
        this.consumeNextClick = false;

        this._clearSelection();
        this.scene.input.setDefaultCursor('default');

        if (this.ui) this.ui.setVisible(false);
    }

    onEsc() {
        if (!this.active) return;

        if (this.selected.size > 0) {
            this._clearSelection();
            this._updateFinalizeEnabled(false);
            this._setBannerText();
            return;
        }

        this.stop();
    }


  onPointerMove(_pointer) {
    // optional: hover highlight if you want later
  }

    onClick(pointer) {
        if (!this.active) return;

        if (this.consumeNextClick) {
            this.consumeNextClick = false;
            return;
        }

        const gx = Math.floor(pointer.worldX / SQUARESIZE);
        const gy = Math.floor(pointer.worldY / SQUARESIZE);

        const cell = GameMap.grid?.[gy]?.[gx];
        if (!cell) return;

        const gridVal = Array.isArray(cell) ? cell[1] : cell;
        if (!Wall.isWallOrDoorCell(gridVal)) return;

        const key = `${gx},${gy}`;
        if (this.selected.has(key)) this._unselect(key);
        else this._select(gx, gy, gridVal);

        this._updateFinalizeEnabled(this.selected.size > 0);
        this._setBannerText();
    }

    _select(x, y, gridVal) {
        const cx = x * SQUARESIZE + SQUARESIZE / 2;
        const cy = y * SQUARESIZE + SQUARESIZE / 2;

        const marker = this.scene.add.rectangle(cx, cy, SQUARESIZE, SQUARESIZE)
            .setStrokeStyle(2, 0xff3333, 1)
            .setDepth(UIDEPTH + 2);

        this.selected.set(`${x},${y}`, { x, y, gridVal, marker });
    }

    _unselect(key) {
        const e = this.selected.get(key);
        if (!e) return;
        e.marker.destroy();
        this.selected.delete(key);
    }

    _clearSelection() {
        for (const k of this.selected.keys()) this._unselect(k);
    }

    _setBannerText() {
        const n = this.selected.size;
        this.uiText.setText(
            n === 0
            ? "Click walls to mark for destruction | esc to cancel"
            : `Destroy ${n} tiles | Click ✔ Finalize`
        );
        this._layoutUI();
    }


    _ensureUI() {
        if (this.ui) {
            this.ui.setVisible(true);
            return;
        }

        const y = 60;
        const x = this.scene.scale.width / 2;

        this.ui = this.scene.add.container(x, y)
            .setScrollFactor(0)
            .setDepth(UIDEPTH + 10)
            .setVisible(true);

        this.uiBg = this.scene.add.rectangle(0, 0, 10, 40, 0x220000, 0.75);
        this.uiText = this.scene.add.text(0, 0, "", {
            fontSize: "16px",
            fontFamily: "monospace",
            color: "#ff6666",
            stroke: "#000",
            strokeThickness: 3,
        }).setOrigin(0.5);

        this.finalBtn = this.scene.add.text(0, 0, "✔ Finalize", {
            fontSize: "14px",
            fontFamily: "monospace",
            color: "#ffffff",
            backgroundColor: "#220000",
            padding: { left: 8, right: 8, top: 4, bottom: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.finalBtn.on("pointerdown", () => this.finalize());

        this.ui.add([this.uiBg, this.uiText, this.finalBtn]);
        this.scene.cameras.main.ignore(this.ui);

        this.scene.scale.on("resize", ({ width }) => {
            this.ui.setX(width / 2);
            this._layoutUI();
        });

        this._layoutUI();
    }

  _ensureFinalizeUI() {
    if (this.finalizeUI) return;

    const x = this.scene.cameras.main.width / 2;
    const y = this.scene.cameras.main.height - 110;

    this.finalizeUI = this.scene.add.rectangle(x, y, 220, 44, 0x220000, 0.9)
      .setScrollFactor(0)
      .setDepth(UIDEPTH + 50)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => this.finalize());

    this.finalizeText = this.scene.add.text(x, y, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(UIDEPTH + 51);

    // keep out of main camera? (these are UI so ignore world camera scrolling)
    if (this.scene.uiCamera) {
      // uiCamera renders UI; so ignore them in main, or just scrollFactor(0) is enough in your setup.
      this.scene.cameras.main.ignore([this.finalizeUI, this.finalizeText]);
    }
  }

  _syncFinalizeUI() {
    const n = this.selected.size;
    const show = this.active && n > 0;

    if (this.finalizeUI) this.finalizeUI.setVisible(show);
    if (this.finalizeText) {
      this.finalizeText.setVisible(show);
      this.finalizeText.setText(`Finalize Destroy (${n})`);
    }
  }

  _layoutUI() {
    if (!this.ui || !this.uiText || !this.uiBg || !this.finalBtn) return;

    const padX = 18;
    const padY = 10;
    const spacing = 16;

    // background sized to banner text only
    const w = this.uiText.width + padX * 2;
    const h = this.uiText.height + padY;

    this.uiBg.setSize(w, Math.max(26, h));
    this.uiBg.setPosition(0, 0);

    this.uiText.setPosition(0, 0);

    // finalize button sits to the right of the banner
    const btnX = (w / 2) + spacing + (this.finalBtn.width / 2);
    this.finalBtn.setPosition(btnX, 0);
  }


    _updateFinalizeEnabled(enabled) {
        this.finalBtn.setAlpha(enabled ? 1 : 0.35);
        this.finalBtn.disableInteractive();
        if (enabled) this.finalBtn.setInteractive({ useHandCursor: true });
    }

    finalize() {
        if (!this.active || this.selected.size === 0) return;

        const ordered = [];
        for (const { x, y, gridVal } of this.selected.values()) {
            ordered.push({ x, y, originalGridVal: gridVal, type: TILE_TYPES[TILE_MAP(gridVal)] });
        }

        buildingManager.createDestroyTileStateArray(ordered, "1");
        
        this.stop();
    }
}
