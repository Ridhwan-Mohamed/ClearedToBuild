// === StorageTab.js ===
import { UI_ITEM_TYPES } from "../UIConstants";
import { Teams } from '../../Teams'
import { TILE_TYPES, showAlert } from '../../constants'
import { buildingManager } from '../../Manager/buildingManager.js';

export default class StorageTab {
    constructor(scene, teamNumber = 0) {
    this.scene = scene;
    
    this.team = teamNumber;
    this.selected = null;
    this.cardByStorage = new Map();

    this.root = this.build();

    // --- live update binding ---
    this._update = this.update.bind(this);
    this.scene.events.on("update", this._update);

    // --- storage lifecycle listeners ---
    this._onAdded = (storage) => {
      if (!storage || storage.teamNumber !== this.team) return;
      const idx = (Teams.teamLists[this.team]?.storageList || []).indexOf(storage);
      const card = this.createCard(storage, idx >= 0 ? idx : this.cardByStorage.size);
      this.listBody.add(card, { expand: false });
      this.cardByStorage.set(storage, card);
      this.scroll.layout();
    };

    this._onRemoved = (storage) => {
      const row = this.cardByStorage.get(storage);
      if (row) {
        row.destroy();
        this.cardByStorage.delete(storage);
        this.scroll.layout();
      }
      if (this.selected === storage) {
        this.selected = null;
        this.detail.setStorage(null);
      }
    };

    this._onUpdated = (storage) => {
      if (!storage || storage.teamNumber !== this.team) return;

      const current = this.scene.uiBottomBar?.currentPage;

      // 🔒 Only touch UI if the Storage tab is actually open
      if (current !== 'storage') return;

      // Keep the row UI in sync with the storage state (only when tab is open)
      this.updateCard(storage);

      // And only touch the detail panel if this storage is selected
      if (this.selected === storage && this.detail?.setStorage) {
        this.detail.setStorage(storage);
      }
    };

    this._onResize = () => this.scroll.layout();

    scene.events.on("storage:added", this._onAdded);
    scene.events.on("storage:removed", this._onRemoved);
    scene.events.on("storage:updated", this._onUpdated);
    scene.scale.on("resize", this._onResize);
  }

  get view() { return this.root; }

  hide() {
    this.selected = null;

    // Hide or clear detail panel
    if (this.detail?.setOven) this.detail.setOven(null);
    if (this.detail?.setStorage) this.detail.setStorage(null);

    // Hide any visible count texts / icons
    if (this.detail?.cells) {
      this.detail.cells.forEach(c => {
        if (c.icon) c.icon.setVisible(false);
        if (c.text) c.text.setVisible(false);
      });
    }
    if (this.cards?.childrenMap?.grid) {
      this.cards.childrenMap.grid.getAllVisibleChildren?.().forEach(child => {
        if (child.setVisible) child.setVisible(false);
      });
    }
  }


  destroy() {
    this.scene.events.off("update", this._update);
    this.scene.events.off("storage:added", this._onAdded);
    this.scene.events.off("storage:removed", this._onRemoved);
    this.scene.events.off("storage:updated", this._onUpdated);
    this.scene.scale.off("resize", this._onResize);
    this.root?.destroy();
  }

  // ---------- UI BUILD ----------
  build() {
    const scene = this.scene;
    const root = scene.rexUI.add.sizer({
      orientation: "x",
      space: { left: 12, right: 12, top: 8, bottom: 8, item: 12 },
    });

    this.detail = this.buildDetailPanel();
    root.add(this.detail.panel, { proportion: 1, expand: true });

    this.listBody = scene.rexUI.add.sizer({ orientation: "y", space: { item: 8 } });

    this.scroll = scene.rexUI.add.scrollablePanel({
      width: Math.floor(scene.scale.width * (2 / 3)) - 48,
      height: 200,
      scrollMode: 0,
      background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 8, 0x000000, 0.15),
      panel: { child: this.listBody, mask: { padding: 1 } },
      sliderY: scene.rexUI.add.slider({
        height: 160,
        orientation: "y",
        track: scene.rexUI.add.roundRectangle(0, 0, 10, 0, 5, 0x333333),
        thumb: scene.rexUI.add.roundRectangle(0, 0, 10, 28, 5, 0x999999),
      }),
      space: { left: 6, right: 6, top: 6, bottom: 6, panel: 8 },
    });

    root.add(this.scroll, { proportion: 2, expand: true });
    this.rebuildList();
    return root;
  }

  // ---------- DETAIL PANEL ----------
  buildDetailPanel() {
    const scene = this.scene;
    const rr = (w, h, r, c, a = 1) => scene.rexUI.add.roundRectangle(0, 0, w, h, r, c, a);

    const ensureBlankTexture = () => {
      if (scene.textures.exists("blank")) return;

      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture("blank", 1, 1);
      g.destroy();
    };
    ensureBlankTexture();

    // header: title + coords + HP
    const title = scene.add.text(0, 0, "Storage", { fontSize: 16, color: "#ffffff", fontFamily: "Bungee" });
    const sub = scene.add.text(0, 0, "—", { fontSize: 12, color: "#b0b0b0", fontFamily: "Bungee" });

    const makeHpBarWithText = (width, height) => {
      const s = scene.rexUI.add.overlapSizer({ width, height });

      const bg = rr(width, height, 5, 0x222222, 1);
      const fill = rr(Math.max(1, width - 2), Math.max(1, height - 2), 5, 0x4caf50, 1)
        .setOrigin(0, 0.5);

      const txt = scene.add.text(0, 0, 'HP —/—', {
        fontFamily: 'Bungee',
        fontSize: 12,
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);

      s.addBackground(bg);
      s.add(fill, { key: 'fill', align: 'left', expand: false, padding: { left: 1, right: 1 } });
      s.add(txt,  { key: 'txt',  align: 'center', expand: false });
      s.layout();

      s.setValue = (cur, max) => {
        const m = Math.max(1, (max ?? 0));
        const c = Math.max(0, (cur ?? 0));
        const p = Phaser.Math.Clamp(c / m, 0, 1);
        fill.width = Math.max(1, (width - 2) * p);
        txt.setText(`HP ${Math.floor(c)}/${Math.floor(m)}`);
        s.layout();
      };

      return s;
    };

    const storageHpBar = makeHpBarWithText(240, 14);
    const gridSizer = scene.rexUI.add.gridSizer({
      column: 4, row: 4,
      columnProportions: 1, rowProportions: 1,
      space: { column: 8, row: 8, left: 6, right: 6, top: 6, bottom: 6 },
    });

    const makeCell = () => {
      const s = scene.rexUI.add.overlapSizer({ width: 32, height: 32 });

      // 🔲 background gray box like ClayOvenTab
      const bg = scene.rexUI.add.roundRectangle(
        0, 0,
        28, 28,
        4,
        0x333333,
        0.9
      );
      s.addBackground(bg);

      // placeholder icon; we size it only when real texture is set
      const icon = scene.add.image(0, 0, "blank").setOrigin(0.5);

      const count = scene.add.text(0, 0, "", {
        fontSize: 11,
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 2,
        fontFamily: "Bungee",
      }).setOrigin(1, 1);

      s.add(icon,  { key: "icon",  align: "center" });
      s.add(count, { key: "count", align: "right-bottom" });

      s.setIcon = (key, amt) => {
        const hasIcon = key && scene.textures.exists(key);

        if (hasIcon) {
          icon.setTexture(key);
          icon.setDisplaySize(24, 24);   // size AFTER real texture
          icon.setVisible(true);
        } else {
          // no item → hide the icon, keep gray box visible
          icon.setVisible(false);
        }

        if (amt && amt > 1) {
          count.setVisible(true).setText("x" + amt);
        } else {
          count.setVisible(false);
        }
      };

      return s;
    };

    const cells = [];
    for (let i = 0; i < 16; i++) {
      const c = makeCell();
      gridSizer.add(c, { column: i % 4, row: Math.floor(i / 4), expand: false });
      cells.push(c);
    }

    const fixBtn = scene.rexUI.add.label({
      background: scene.rexUI.add.roundRectangle(0, 0, 0, 34, 10, 0x2f7d32),
      text: scene.add.text(0, 0, "🛠 Fix", { fontFamily: "Bungee", fontSize: 14, color: "#ffffff" }),
      space: { left: 12, right: 12, top: 7, bottom: 7 },
    })
      .setMinSize(110, 34)
      .setInteractive({ useHandCursor: true });

    fixBtn.on('pointerup', () => {
      const b = this.selected; // storage
      if (!b) return;
      buildingManager.requestBuildingFix(b, this.team, []);
    });

    const headerRow = scene.rexUI.add.sizer({
      orientation: "x",
      space: { item: 10 }
    })
      .add(title, { proportion: 1, align: "left", expand: true })
      .add(fixBtn, { proportion: 0, align: "right", expand: false });

    const panel = scene.rexUI.add.sizer({ orientation: "y", space: { item: 8 } })
      .add(headerRow, 0, "left", 0, true)
      .add(sub, 0, "left", 0, false)
      .add(storageHpBar, 0, "left", 0, false)
      .add(rr(0, 2, 0, 0xffffff, 0.15), 0, "left", 0, false)
      .add(gridSizer, 0, "left", 0, false);

    const setStorage = (storage) => {
      if (!storage) {
        title.setText("Storage");
        sub.setText("—");
        storageHpBar.setValue(0, 1);
        cells.forEach(c => c.setIcon(null, 0));   // 🔸 no texture for empty
        return;
      }

      title.setText("Storage");
      sub.setText(`(${storage.x ?? 0}, ${storage.y ?? 0})`);
      storageHpBar.setValue(storage.health ?? 0, storage.maxHealth ?? 1);

      const items = storage.storageItems;
      for (let i = 0; i < 16; i++) {
        const slot = items[i];
        const key  = UI_ITEM_TYPES[slot?.item?.name || "empty"]?.icon || null;
        cells[i].setIcon(key, slot?.amount || 0);
      }
    };

    return { panel, setStorage };
  }

  //refresh logic
  onShow() {
    const team = Teams.teamLists[this.team];
    const storages = team?.storageList || [];

    // If nothing selected (or old selection is gone), pick the first storage
    if (!this.selected || !storages.includes(this.selected)) {
      if (storages[0]) {
        // Opening the tab should not pan cameras; just select the first storage.
        this.selectStorage(storages[0]);
      } else {
        this.selected = null;
        if (this.detail?.setStorage) this.detail.setStorage(null);
        return;
      }
    } else if (this.detail?.setStorage) {
      // Ensure detail panel is synced with existing selection
      this.detail.setStorage(this.selected);
    }

    // Refresh every row from current storage state
    storages.forEach((s) => this.updateCard(s));
  }

  // ---------- CARD LIST ----------
  rebuildList() {
    const storages = Teams.teamLists['1']?.storageList || [];
    this.cardByStorage.clear();
    this.listBody.clear(true);

    storages.forEach((storage, idx) => {
      const card = this.createCard(storage, idx);
      this.listBody.add(card, { expand: false });
      this.cardByStorage.set(storage, card);
    });

    this.scroll.layout();
  }

  createCard(storage, idx) {
    const scene = this.scene;

    const nameText = scene.add.text(0, 0, `Storage ${idx + 1} (${storage.x ?? 0},${storage.y ?? 0})`, {
      fontSize: 13,
      color: "#ffffff",
    });

    const iconsRow = scene.rexUI.add.sizer({
      orientation: "x",
      space: { item: 6 },
    });

    const items = storage.storageItems
      .filter((s) => s && s.item && s.item.name !== "empty");

    items.forEach((slot) => {
      const key = UI_ITEM_TYPES[slot.item.name]?.icon || "blank";
      const s = scene.rexUI.add.overlapSizer({ width: 26, height: 26 });
      const im = scene.add.image(0, 0, key).setDisplaySize(22, 22).setOrigin(0.5);
      const tx = scene.add.text(0, 0, "", {
        fontSize: 10,
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 2,
        fontFamily: "Bungee",
      }).setOrigin(1, 1);
      if (slot.amount > 1) tx.setText("x" + slot.amount).setVisible(true);
      s.add(im, { key: "im", align: "center" });
      s.add(tx, { key: "tx", align: "right-bottom" });
      iconsRow.add(s);
    });

    // Full-width row style
    const bg = scene.rexUI
      .add.roundRectangle(0, 0, 0, 0, 6, 0xffffff, 0.08)
      .setStrokeStyle(1, 0xffffff, 0.15);

    const fullWidth = Math.floor(scene.scale.width * (2 / 3)) - 72;

    // helper: HP bar (no text)
    const makeHpBar = (width, height) => {
      const s = scene.rexUI.add.overlapSizer({ width, height });
      const b = scene.rexUI.add.roundRectangle(0, 0, width, height, 4, 0x222222, 1);
      const f = scene.rexUI.add.roundRectangle(0, 0, Math.max(1, width - 2), Math.max(1, height - 2), 4, 0x4caf50, 1)
        .setOrigin(0, 0.5);
      s.addBackground(b);
      s.add(f, { key: "fill", align: "left", expand: false, padding: { left: 1, right: 1 } });
      s.layout();
      s.setPercent = (pct) => {
        const p = Phaser.Math.Clamp(pct ?? 0, 0, 1);
        f.width = Math.max(1, (width - 2) * p);
        s.layout();
      };
      return s;
    };

    const hpBar = makeHpBar(Math.max(80, fullWidth - 24), 6);
    hpBar.setPercent((storage.health ?? 0) / (storage.maxHealth || 1));

    const content = scene.rexUI.add.sizer({
      orientation: "x",
      space: { left: 12, right: 12, top: 6, bottom: 14, item: 10 }, // leave room for HP bar
    })
      .add(nameText, { proportion: 1, expand: false, align: "left" })
      .add(iconsRow, { proportion: 1, expand: false, align: "left" });

    const card = scene.rexUI.add.overlapSizer({ width: fullWidth, height: 48 })
      .addBackground(bg)
      .add(content, { key: "content", align: "top", expand: false })
      .add(hpBar, { key: "hp", align: "bottom", expand: false, padding: { left: 12, right: 12, bottom: 6 } });

    card.userData = { storage, iconsRow, hpBar, nameText };
    card.setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.selectFromCard(storage));

    card.on("pointerover", () => bg.setFillStyle(0xffffff, 0.15));
    card.on("pointerout",  () => bg.setFillStyle(0xffffff, 0.08));

    return card;
  }

  updateCard(storage) {
    const card = this.cardByStorage.get(storage);
    if (!card || !card.userData) return;
    const { iconsRow, hpBar, nameText } = card.userData;
    iconsRow.removeAll(true);

    const items = storage.storageItems
      .filter(s => s && s.item && s.item.name !== "empty");
    items.forEach(slot => {
      const key = UI_ITEM_TYPES[slot.item.name]?.icon || "blank";
      const s = this.scene.rexUI.add.overlapSizer({ width: 26, height: 26 });
      const im = this.scene.add.image(0, 0, key).setDisplaySize(22, 22).setOrigin(0.5);
      const tx = this.scene.add.text(0, 0, "", {
        fontSize: 10, color: "#ffffff", stroke: "#000", strokeThickness: 2, fontFamily: "Bungee",
      }).setOrigin(1, 1);
      if (slot.amount > 1) tx.setText("x" + slot.amount).setVisible(true);
      s.add(im, { key: "im", align: "center" });
      s.add(tx, { key: "tx", align: "right-bottom" });
      iconsRow.add(s);
    });

    iconsRow.layout();

    if (nameText?.setText) {
      const base = (nameText.text || 'Storage').split('(')[0].trimEnd();
      nameText.setText(`${base}(${storage.x ?? 0},${storage.y ?? 0})`);
    }

    if (hpBar?.setPercent) {
      hpBar.setPercent((storage.health ?? 0) / (storage.maxHealth || 1));
    }
  }

  // ---------- BEHAVIOR ----------
  selectStorage(storage) {
    this.selected = storage;
    this.detail.setStorage(storage);
  }

  centerCameraOnStorage(storage) {
    if (!storage?.sprite) return;
    const cam = this.scene.worldScene?.cameras?.main || this.scene.cameras.main;
    cam.centerOn(storage.sprite.x, storage.sprite.y);
  }

  selectFromCard(storage) {
    this.selectStorage(storage);
    this.centerCameraOnStorage(storage);
  }

  selectFromWorld(storage) {
    this.selectStorage(storage);
    // no camera movement
  }

  refresh(teamNumber) {
    this.team = teamNumber;
    this.rebuildList();
  }

  update() {
    const current = this.scene.uiBottomBar?.currentPage;
    if (current !== 'storage' || !this.selected) return;

    this.detail.setStorage(this.selected);
  }

}
