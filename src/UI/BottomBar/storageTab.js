// === StorageTab.js ===
import { UI_ITEM_TYPES } from "../UIConstants";
import { Teams } from '../../Teams'
import { TILE_TYPES, showAlert } from '../../constants'
import { buildingManager } from '../../Manager/buildingManager.js';
import { StorageManager } from '../../Manager/StorageManager.js';
import { StorageBuilding } from '../../buildings/Storage.js';

export default class StorageTab {
    constructor(scene, teamNumber = 0) {
    this.scene = scene;
    
    this.team = teamNumber;
    this.selected = null;
    this.cardByStorage = new Map();
    this._onWheel = null;

    this.root = this.build();
    this.bindScrollInput();

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
        if (c.ghostIcon) c.ghostIcon.setVisible(false);
        if (c.text) c.text.setVisible(false);
        if (c.queueText) c.queueText.setVisible(false);
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
    if (this._onWheel) {
      this.scene.input.off('wheel', this._onWheel);
      this._onWheel = null;
    }
    this.root?.destroy();
  }

  // ---------- UI BUILD ----------
  build() {
    const scene = this.scene;
    const CONTENT_H = 112;
    const listWidth = Math.max(230, Math.floor(scene.scale.width * 0.38) - 28);
    const detailWidth = Math.max(360, scene.scale.width - listWidth - 42);
    this.listWidth = listWidth;
    const root = scene.rexUI.add.sizer({
      height: CONTENT_H,
      orientation: "x",
      space: { left: 8, right: 8, top: 4, bottom: 4, item: 10 },
    });
    root.setMinSize(0, CONTENT_H);

    this.detail = this.buildDetailPanel();
    this.detail.panel?.setMinSize?.(detailWidth, CONTENT_H);
    const detailSizer = scene.rexUI.add.sizer({
      orientation: "y",
      height: CONTENT_H,
    }).add(this.detail.panel, { proportion: 1, expand: true });
    detailSizer.setMinSize(detailWidth, CONTENT_H);
    root.add(detailSizer, { proportion: 1, expand: true });

    this.listBody = scene.rexUI.add.sizer({ orientation: "y", space: { item: 8 } });

    this.scroll = scene.rexUI.add.scrollablePanel({
      width: listWidth,
      height: CONTENT_H,
      scrollMode: 0,
      scrollDetectionMode: 'rectBounds',
      background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 8, 0x000000, 0.15),
      panel: { child: this.listBody, mask: { padding: 1 } },
      sliderY: scene.rexUI.add.slider({
        height: CONTENT_H - 20,
        orientation: "y",
        track: scene.rexUI.add.roundRectangle(0, 0, 10, 0, 5, 0x333333),
        thumb: scene.rexUI.add.roundRectangle(0, 0, 10, 28, 5, 0x999999),
      }),
      scrollerY: {
        pointerOutRelease: true,
        rectBoundsInteractive: true,
      },
      space: { left: 6, right: 6, top: 6, bottom: 6, panel: 8 },
    });
    this.scroll.setMinSize(0, CONTENT_H);

    root.add(this.scroll, { proportion: 1, expand: true });
    this.rebuildList();
    root.layout();
    return root;
  }

  bindScrollInput() {
    if (this._onWheel) return;

    this._onWheel = (pointer, _gameObjects, dx, dy) => {
      if (this.scene.uiBottomBar?.currentPage !== 'storage') return;
      if (!this.scene.uiBottomBar?.expanded) return;
      if (!this.scroll?.isOverflowY) return;
      if (!this.isPointerOverScroll(pointer)) return;

      const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(dominantDelta) < 0.1) return;

      this.scroll.addChildOY(-dominantDelta * 0.8, true);
      this.scene.input.stopPropagation();
    };

    this.scene.input.on('wheel', this._onWheel);
  }

  isPointerOverScroll(pointer) {
    if (!this.scroll?.getBounds) return false;
    const bounds = this.scroll.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
  }

  getProjectedSlots(storage) {
    if (!storage) return [];
    const teamNumber = storage.teamNumber ?? this.team ?? 1;
    return StorageBuilding._getProjectedSlots?.(storage, teamNumber) ?? [];
  }

  // ---------- DETAIL PANEL ----------
  buildDetailPanel() {
    {
      const scene = this.scene;
      const compact = scene.scale.width < 1180;
      const rr = (w, h, r, c, a = 1) => scene.rexUI.add.roundRectangle(0, 0, w, h, r, c, a);
      const panelBg = (w = 0, h = 0, r = 14, c = 0x153248, a = 0.78, stroke = 0x95e4ff, sa = 0.16) => {
        const bg = rr(w, h, r, c, a);
        bg.setStrokeStyle(2, stroke, sa);
        bg.setDepth(-1);
        return bg;
      };
      const text = (value, style = {}) => scene.add.text(0, 0, value, {
        fontFamily: "Bungee",
        fontSize: 12,
        color: "#ffffff",
        ...style,
      }).setShadow(0, 1, "#000000", 2, true, true);

      if (!scene.textures.exists("blank")) {
        const g = scene.add.graphics();
        g.fillStyle(0xffffff, 1);
        g.fillRect(0, 0, 1, 1);
        g.generateTexture("blank", 1, 1);
        g.destroy();
      }

      const makeHpBarWithText = (width, height) => {
        const s = scene.rexUI.add.overlapSizer({ width, height });
        const bg = panelBg(width, height, height / 2, 0x08121a, 0.92, 0x92ddff, 0.08);
        const fill = rr(Math.max(1, width - 4), Math.max(1, height - 4), (height - 4) / 2, 0x49cf73, 1).setOrigin(0, 0.5);
        const label = text("HP 0/0", { fontSize: compact ? 10 : 11 });
        s.addBackground(bg);
        s.add(fill, { key: "fill", align: "left", expand: false, padding: { left: 2, right: 2 } });
        s.add(label, { key: "txt", align: "center", expand: false });
        s.layout();
        s.setValue = (cur, max) => {
          const m = Math.max(1, max ?? 1);
          const c = Math.max(0, cur ?? 0);
          const p = Phaser.Math.Clamp(c / m, 0, 1);
          fill.width = Math.max(1, (width - 4) * p);
          label.setText(`HP ${Math.floor(c)}/${Math.floor(m)}`);
          s.layout();
        };
        return s;
      };

      const button = (label, fill = 0x305f78, stroke = 0xa9ebff) => {
        const bg = panelBg(0, 0, 12, fill, 0.96, stroke, 0.18);
        const labelText = text(label, { fontSize: compact ? 10 : 11 });
        const btn = scene.rexUI.add.label({
          background: bg,
          text: labelText,
          space: { left: compact ? 8 : 10, right: compact ? 8 : 10, top: compact ? 4 : 6, bottom: compact ? 4 : 6 }
        });
        btn.labelText = labelText;
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerover", () => bg.setFillStyle(fill, 1));
        btn.on("pointerout", () => bg.setFillStyle(fill, 0.96));
        btn.setEnabledState = (enabled) => {
          btn.disableInteractive();
          if (enabled) btn.setInteractive({ useHandCursor: true });
          btn.setAlpha(enabled ? 1 : 0.35);
        };
        return btn;
      };

      const title = text("Storage", { fontSize: 15 });
      const sub = text("-", { fontSize: 11, color: "#b0b0b0" });
      const slotCount = StorageBuilding.defaultCapacity || 8;
      const gridColumns = 4;
      const gridRows = Math.max(1, Math.ceil(slotCount / gridColumns));
      const contentWidth = Math.max(330, (this.detailWidth || 380) - 18);
      const contentGap = compact ? 8 : 10;
      const leftPaneWidth = Math.max(188, Math.floor(contentWidth * 0.64));
      const rightPaneWidth = Math.max(132, contentWidth - leftPaneWidth - contentGap);
      const hpWidth = Math.max(170, contentWidth - 108);
      const storageHpBar = makeHpBarWithText(hpWidth, 16);
      const cellGap = compact ? 4 : 6;
      const maxCellByWidth = Math.floor((leftPaneWidth - 18 - cellGap * (gridColumns - 1)) / gridColumns);
      const cellSize = Phaser.Math.Clamp(maxCellByWidth, compact ? 28 : 30, compact ? 32 : 34);
      const previewSize = Phaser.Math.Clamp(Math.floor(rightPaneWidth * 0.42), compact ? 44 : 48, compact ? 54 : 60);
      const descWrap = Math.max(110, rightPaneWidth - 14);

      let currentStorage = null;
      let selectedSlotIndex = null;

      const gridSizer = scene.rexUI.add.gridSizer({
        column: gridColumns,
        row: gridRows,
        columnProportions: 1,
        rowProportions: 1,
        space: { column: cellGap, row: cellGap, left: 2, right: 2, top: 2, bottom: 2 },
      });

      const makeCell = () => {
        const s = scene.rexUI.add.overlapSizer({ width: cellSize, height: cellSize });
        const bg = panelBg(cellSize, cellSize, 10, 0x102637, 0.95, 0x98e7ff, 0.12);
        const shine = rr(cellSize - 12, 8, 4, 0xffffff, 0.08);
        const icon = scene.add.image(0, 0, "blank").setDisplaySize(cellSize - 12, cellSize - 12).setVisible(false);
        const ghostIcon = scene.add.image(0, 0, "blank").setDisplaySize(cellSize - 12, cellSize - 12).setAlpha(0.34).setVisible(false);
        const count = text("", { fontSize: compact ? 8 : 9 }).setOrigin(1, 1);
        const queued = text("", { fontSize: compact ? 7 : 8, color: "#9fdfff" }).setOrigin(0, 0).setVisible(false);

        s.addBackground(bg);
        s.add(shine, { align: "top-center", padding: { top: 6 } });
        s.add(icon, { align: "center" });
        s.add(ghostIcon, { align: "center" });
        s.add(queued, { align: "top-left", padding: { left: 4, top: 3 } });
        s.add(count, { align: "right-bottom", padding: { right: 6, bottom: 4 } });

        s.icon = icon;
        s.ghostIcon = ghostIcon;
        s.text = count;
        s.queueText = queued;
        s.setIcon = (key, amt, queuedKey = null, queuedAmount = 0) => {
          const hasIcon = key && scene.textures.exists(key);
          if (hasIcon) {
            icon.setTexture(key);
            icon.setDisplaySize(cellSize - 12, cellSize - 12);
            icon.setVisible(true);
          } else {
            icon.setVisible(false);
          }

          const hasQueuedIcon = queuedKey && scene.textures.exists(queuedKey) && queuedAmount > 0;
          if (hasQueuedIcon) {
            ghostIcon.setTexture(queuedKey);
            ghostIcon.setDisplaySize(cellSize - 12, cellSize - 12);
            ghostIcon.setAlpha(hasIcon ? 0.2 : 0.34);
            ghostIcon.setVisible(true);
            queued.setVisible(true).setText(`Q+${queuedAmount}`);
          } else {
            ghostIcon.setVisible(false);
            queued.setVisible(false);
          }

          if (amt > 0) {
            count.setVisible(true).setText(`x${amt}`);
          } else {
            count.setVisible(false);
          }
        };
        s.setSelected = (active) => {
          bg.setFillStyle(active ? 0x2a4f73 : 0x102637, active ? 1 : 0.95);
          bg.setStrokeStyle(2, active ? 0xbaf1ff : 0x98e7ff, active ? 0.3 : 0.12);
        };
        s.setSelected(false);
        return s;
      };

      const cells = [];
      for (let i = 0; i < slotCount; i++) {
        const cell = makeCell();
        gridSizer.add(cell, { column: i % gridColumns, row: Math.floor(i / gridColumns), expand: false });
        cells.push(cell);
      }

      const inventoryPanel = scene.rexUI.add.sizer({
        orientation: "y",
        width: leftPaneWidth,
        space: { left: 8, right: 8, top: 6, bottom: 6, item: 4 }
      })
        .addBackground(panelBg(leftPaneWidth, 0, 14, 0x17384c, 0.5, 0x98e7ff, 0.12))
        .add(gridSizer, { proportion: 1, expand: true, align: "center" });
      inventoryPanel.setMinSize(leftPaneWidth, 0);

      const previewSlot = scene.rexUI.add.overlapSizer({ width: previewSize, height: previewSize });
      const previewBg = panelBg(previewSize, previewSize, 18, 0x102637, 0.96, 0x8fe6ff, 0.16);
      const previewShine = rr(previewSize - 16, 10, 5, 0xffffff, 0.08);
      const previewIcon = scene.add.image(0, 0, "blank").setDisplaySize(previewSize - 18, previewSize - 18).setVisible(false);
      const previewCount = text("", { fontSize: compact ? 9 : 10 }).setOrigin(1, 1).setVisible(false);
      const previewEmpty = text("EMPTY", { fontSize: compact ? 10 : 11, color: "#7cb9ce" });
      previewSlot.addBackground(previewBg);
      previewSlot.add(previewShine, { align: "top-center", padding: { top: 8 } });
      previewSlot.add(previewIcon, { align: "center" });
      previewSlot.add(previewEmpty, { align: "center" });
      previewSlot.add(previewCount, { align: "right-bottom", padding: { right: 8, bottom: 6 } });

      const detailTitle = text("No Slot Selected", { fontSize: compact ? 10 : 11 });
      const detailMeta = text("Pick a filled slot to inspect it.", {
        fontSize: compact ? 7 : 8,
        color: "#9fdfff",
        wordWrap: { width: descWrap }
      });
      const detailDesc = text("", {
        fontSize: compact ? 7 : 8,
        color: "#d9eef8",
        wordWrap: { width: descWrap }
      });

      const detailCopy = scene.rexUI.add.sizer({
        orientation: "y",
        space: { item: 4 }
      })
        .add(detailTitle, { expand: false, align: "left" })
        .add(detailMeta, { expand: false, align: "left" })
        .add(detailDesc, { expand: false, align: "left" });

      const detailBody = scene.rexUI.add.sizer({
        orientation: "y",
        space: { item: compact ? 5 : 6 }
      })
        .add(previewSlot, { proportion: 0, expand: false, align: "center" })
        .add(detailCopy, { proportion: 1, expand: true, align: "left" });

      const detailPanel = scene.rexUI.add.sizer({
        orientation: "y",
        space: { left: 8, right: 8, top: 6, bottom: 6, item: 4 }
      })
        .addBackground(panelBg(0, 0, 14, 0x17384c, 0.5, 0x98e7ff, 0.12))
        .add(detailBody, { proportion: 1, expand: true, align: "center" });
      detailPanel.setMinSize(rightPaneWidth, 0);

      const sellSummary = text("Select a filled slot to sell items.", {
        fontSize: compact ? 7 : 8,
        color: "#cfe8f4",
        wordWrap: { width: descWrap }
      });

      const sellOneBtn = button("Sell 1", 0x7c3aed, 0xd8b4fe);
      const sellStackBtn = button("Sell Stack", 0xc86b1f, 0xfacc15);
      sellOneBtn.setEnabledState(false);
      sellStackBtn.setEnabledState(false);

      const actionsRow = scene.rexUI.add.sizer({
        orientation: "x",
        space: { item: 4 }
      })
        .add(sellOneBtn, { proportion: 1, expand: true })
        .add(sellStackBtn, { proportion: 1, expand: true });

      detailPanel
        .add(sellSummary, { expand: false, align: "left" })
        .add(actionsRow, { expand: false, align: "left" });

      const fixBtn = button("Fix", 0x2f7d32, 0x95f5a6).setMinSize(92, compact ? 28 : 30);
      fixBtn.on("pointerup", () => {
        const storage = this.selected;
        if (!storage) return;
        buildingManager.requestBuildingFix(storage, this.team, []);
      });

      const contentRow = scene.rexUI.add.sizer({
        orientation: "x",
        space: { item: contentGap }
      })
        .add(inventoryPanel, { proportion: 2, expand: true, align: "top" })
        .add(detailPanel, { proportion: 1, expand: true, align: "top" });

      const titleCol = scene.rexUI.add.sizer({
        orientation: "y",
        space: { item: 1 }
      })
        .add(title, { expand: false, align: "left" })
        .add(sub, { expand: false, align: "left" });

      const headerRow = scene.rexUI.add.sizer({
        orientation: "x",
        space: { item: 6 }
      })
        .add(titleCol, { proportion: 1, align: "left", expand: true })
        .add(fixBtn, { proportion: 0, align: "right", expand: false });

      const refreshSelectionUi = () => {
        const slot = currentStorage?.storageItems?.[selectedSlotIndex] || null;

        cells.forEach((cell, idx) => {
          cell.setSelected(!!slot && idx === selectedSlotIndex);
        });

        if (!slot?.item) {
          previewIcon.setVisible(false);
          previewCount.setVisible(false);
          previewEmpty.setVisible(true);
          detailTitle.setText("No Slot Selected");
          detailMeta.setText("Pick a filled slot to inspect it.");
          detailDesc.setText("");
          sellSummary.setText("Select a filled slot to sell items.");
          sellOneBtn.labelText.setText("Sell 1");
          sellStackBtn.labelText.setText("Sell Stack");
          sellOneBtn.setEnabledState(false);
          sellStackBtn.setEnabledState(false);
          return;
        }

        const item = slot.item;
        const iconKey = UI_ITEM_TYPES[item.name]?.icon || null;
        const price = StorageManager.getStorageSellPrice(item);
        const total = price * slot.amount;

        if (iconKey && scene.textures.exists(iconKey)) {
          previewIcon.setTexture(iconKey);
          previewIcon.setDisplaySize(previewSize - 22, previewSize - 22);
          previewIcon.setVisible(true);
          previewEmpty.setVisible(false);
        } else {
          previewIcon.setVisible(false);
          previewEmpty.setVisible(true);
        }

        previewCount.setText(`x${slot.amount}`).setVisible(true);
        detailTitle.setText(item.label || item.name);
        detailMeta.setText(`Slot ${selectedSlotIndex + 1} | ${slot.amount}/${item.stacks || slot.amount} | $${price} each`);
        detailDesc.setText(item.description || "Stored supply item.");
        sellSummary.setText(`Sell one for $${price}, or clear the whole stack for $${total}.`);
        sellOneBtn.labelText.setText(`Sell 1 ($${price})`);
        sellStackBtn.labelText.setText(`Sell Stack ($${total})`);
        sellOneBtn.setEnabledState(true);
        sellStackBtn.setEnabledState(true);
      };

      const setStorage = (storage) => {
        currentStorage = storage;

        if (!storage) {
          selectedSlotIndex = null;
          title.setText("Storage");
          sub.setText("-");
          storageHpBar.setValue(0, 1);
          cells.forEach(cell => cell.setIcon(null, 0, null, 0));
          refreshSelectionUi();
          return;
        }

        if (selectedSlotIndex == null || !storage.storageItems?.[selectedSlotIndex]?.item) {
          const firstFilledIndex = storage.storageItems.findIndex(slot => slot?.item);
          selectedSlotIndex = firstFilledIndex >= 0 ? firstFilledIndex : null;
        }

        title.setText("Storage");
        sub.setText(`(${storage.x ?? 0}, ${storage.y ?? 0})`);
        storageHpBar.setValue(storage.health ?? 0, storage.maxHealth ?? 1);
        const projected = this.getProjectedSlots(storage);

        for (let i = 0; i < slotCount; i++) {
          const slot = storage.storageItems?.[i] || null;
          const projectedSlot = projected?.[i] || null;
          const key = UI_ITEM_TYPES[slot?.item?.name || "empty"]?.icon || null;

          let queuedKey = null;
          let queuedAmount = 0;
          if (projectedSlot?.item) {
            if (!slot?.item) {
              queuedKey = UI_ITEM_TYPES[projectedSlot.item.name]?.icon || null;
              queuedAmount = projectedSlot.amount || 0;
            } else if (slot.item?.name === projectedSlot.item.name && projectedSlot.amount > slot.amount) {
              queuedKey = UI_ITEM_TYPES[projectedSlot.item.name]?.icon || null;
              queuedAmount = projectedSlot.amount - slot.amount;
            }
          }

          cells[i].setIcon(key, slot?.amount || 0, queuedKey, queuedAmount);
        }

        refreshSelectionUi();
      };

      const sellSelectedSlot = (sellStack = false) => {
        const slot = currentStorage?.storageItems?.[selectedSlotIndex];
        if (!slot?.item) return;

        const amount = sellStack ? slot.amount : 1;
        const { sold, revenue, item } = StorageManager.sellFromStorage(currentStorage, selectedSlotIndex, amount, scene);
        if (sold <= 0) return;

        showAlert(scene, `Sold ${sold} ${item?.label || item?.name} for $${revenue}`, "#33ff77", 1800);
        if (currentStorage) setStorage(currentStorage);
      };

      sellOneBtn.on("pointerup", () => sellSelectedSlot(false));
      sellStackBtn.on("pointerup", () => sellSelectedSlot(true));

      cells.forEach((cell, idx) => {
        cell
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            const slot = currentStorage?.storageItems?.[idx];
            selectedSlotIndex = slot?.item ? idx : null;
            refreshSelectionUi();
          });
      });

      const panel = scene.rexUI.add.sizer({ orientation: "y", space: { item: 4 } })
        .add(headerRow, 0, "left", 0, true)
        .add(storageHpBar, 0, "left", 0, false)
        .add(contentRow, { proportion: 1, expand: true });

      return { panel, setStorage, cells };
    }
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
    let currentStorage = null;
    let selectedSlotIndex = null;

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

      s.bg = bg;
      s.icon = icon;
      s.text = count;

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

      s.setSelected = (active) => {
        bg.setFillStyle(active ? 0x6e5cff : 0x333333, active ? 0.95 : 0.9);
        bg.setStrokeStyle(active ? 2 : 1, 0xffffff, active ? 0.35 : 0.08);
      };

      s.setSelected(false);

      return s;
    };

    const cells = [];
    for (let i = 0; i < 16; i++) {
      const c = makeCell();
      gridSizer.add(c, { column: i % 4, row: Math.floor(i / 4), expand: false });
      cells.push(c);
    }

    const selectionText = scene.add.text(0, 0, "Select a filled slot to sell items.", {
      fontSize: 11,
      color: "#b7c9d8",
      fontFamily: "Bungee",
      wordWrap: { width: 240 }
    });

    const makeActionBtn = (label, fill) => {
      const text = scene.add.text(0, 0, label, {
        fontFamily: "Bungee",
        fontSize: 12,
        color: "#ffffff"
      });

      const btn = scene.rexUI.add.label({
        background: scene.rexUI.add.roundRectangle(0, 0, 0, 32, 10, fill, 1),
        text,
        space: { left: 10, right: 10, top: 6, bottom: 6 }
      }).setMinSize(100, 32);

      btn.labelText = text;
      btn.setEnabledState = (enabled) => {
        btn.setAlpha(enabled ? 1 : 0.35);
      };
      btn.setEnabledState(false);
      return btn;
    };

    const sellOneBtn = makeActionBtn("Sell 1", 0x8b5cf6);
    const sellStackBtn = makeActionBtn("Sell Stack", 0xde7b2a);

    const actionsRow = scene.rexUI.add.sizer({
      orientation: "x",
      space: { item: 8 }
    })
      .add(sellOneBtn, { proportion: 1, expand: true })
      .add(sellStackBtn, { proportion: 1, expand: true });

    const refreshSelectionUi = () => {
      const slot = currentStorage?.storageItems?.[selectedSlotIndex] || null;

      cells.forEach((cell, idx) => {
        cell.setSelected(!!slot && idx === selectedSlotIndex);
      });

      if (!slot?.item) {
        selectionText.setText("Select a filled slot to sell items.");
        sellOneBtn.labelText.setText("Sell 1");
        sellStackBtn.labelText.setText("Sell Stack");
        sellOneBtn.setEnabledState(false);
        sellStackBtn.setEnabledState(false);
        return;
      }

      const price = StorageManager.getStorageSellPrice(slot.item);
      selectionText.setText(`${slot.item.label || slot.item.name} x${slot.amount}  •  $${price} each`);
      sellOneBtn.labelText.setText(`Sell 1 ($${price})`);
      sellStackBtn.labelText.setText(`Sell Stack ($${price * slot.amount})`);
      sellOneBtn.setEnabledState(true);
      sellStackBtn.setEnabledState(true);
    };

    const sellSelectedSlot = (sellStack = false) => {
      const slot = currentStorage?.storageItems?.[selectedSlotIndex];
      if (!slot?.item) return;

      const amount = sellStack ? slot.amount : 1;
      const { sold, revenue, item } = StorageManager.sellFromStorage(currentStorage, selectedSlotIndex, amount, scene);
      if (sold <= 0) return;

      showAlert(scene, `Sold ${sold} ${item?.label || item?.name} for $${revenue}`, "#33ff77", 1800);
      selectedSlotIndex = null;
      refreshSelectionUi();
      if (currentStorage) {
        setStorage(currentStorage);
      }
    };

    sellOneBtn
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => sellSelectedSlot(false));

    sellStackBtn
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => sellSelectedSlot(true));

    cells.forEach((cell, idx) => {
      cell
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          const slot = currentStorage?.storageItems?.[idx];
          selectedSlotIndex = slot?.item ? idx : null;
          refreshSelectionUi();
        });
    });

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
      .add(gridSizer, 0, "left", 0, false)
      .add(selectionText, 0, "left", 0, false)
      .add(actionsRow, 0, "left", 0, true);

    const setStorage = (storage) => {
      currentStorage = storage;
      if (!storage || !storage.storageItems?.[selectedSlotIndex]?.item) {
        selectedSlotIndex = null;
      }
      if (!storage) {
        title.setText("Storage");
        sub.setText("—");
        storageHpBar.setValue(0, 1);
        refreshSelectionUi();
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

      refreshSelectionUi();
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

    const fullWidth = Math.max(220, (this.listWidth ?? Math.floor(scene.scale.width * 0.5)) - 24);

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
