import { showAlert, TILE_TYPES, UIDEPTH } from "../../constants";
import { Teams } from "../../Teams";
import { UI_ITEM_TYPES } from "../UIConstants";
import { buildingManager } from "../../Manager/buildingManager.js";

export default class ClayOvenTab {
  static ensureBlankTexture(scene) {
    if (scene.textures.exists("blank")) return;
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("blank", 1, 1);
    g.destroy();
  }

  constructor(scene, teamNumber = 1) {
    this.scene = scene;
    this.team = teamNumber;
    this.selected = null;
    this.cardByOven = new Map();
    this._onWheel = null;
    this._destroyed = false;
    this._listDirty = false;
    this._listRefreshQueued = false;
    this.root = this.build();
    this.bindScrollInput();

    this._update = this.update.bind(this);
    this.scene.events.on("update", this._update);

    this._onOvenUpdated = (oven) => {
      if (!oven || oven.teamNumber !== this.team) return;
      if (!this.cardByOven.has(oven)) {
        this._scheduleListRefresh();
      }
      if (this.scene.uiBottomBar?.currentPage !== "ovens") return;
      this.updateCard(oven);
      if (this.selected === oven) this.detail?.setOven?.(oven);
    };

    this._onOvenAdded = (oven) => {
      if (!oven || oven.teamNumber !== this.team) return;
      this._scheduleListRefresh();
    };

    this._onOvenRemoved = (oven) => {
      if (this._destroyed) return;
      const team = Teams.teamLists[this.team];
      if (team) {
        for (const key of ["ovenJobs", "ovenFuelJobs", "ovenPickupJobs", "ovenDeliveryItems", "ovenFuelDeliveryItems"]) {
          if (Array.isArray(team[key])) team[key] = team[key].filter((job) => job?.oven !== oven);
        }
      }
      const row = this.cardByOven.get(oven);
      if (row) {
        row.destroy();
        this.cardByOven.delete(oven);
        this._safeScrollLayout();
      }
      if (this.selected === oven) {
        this.selected = null;
        this.detail?.setOven?.(null);
      }
      this._scheduleListRefresh();
    };

    this._onResize = () => { if (this.jobPopup) this.positionJobPopup(this.jobPopup); };
    scene.events.on("oven:updated", this._onOvenUpdated);
    scene.events.on("oven:added", this._onOvenAdded);
    scene.events.on("oven:removed", this._onOvenRemoved);
    scene.scale.on("resize", this._onResize);
  }

  get view() { return this.root; }

  hide() {
    this.selected = null;
    this.detail?.setOven?.(null);
    this.closeJobEditor?.();
  }

  destroy() {
    this._destroyed = true;
    this.scene.events.off("update", this._update);
    this.scene.events.off("oven:updated", this._onOvenUpdated);
    this.scene.events.off("oven:added", this._onOvenAdded);
    this.scene.events.off("oven:removed", this._onOvenRemoved);
    this.scene.scale.off("resize", this._onResize);
    if (this._onWheel) this.scene.input.off("wheel", this._onWheel);
    this.closeJobEditor?.();
    this.root?.destroy();
  }

  _scheduleListRefresh() {
    this._listDirty = true;
    if (
      this._destroyed ||
      this._listRefreshQueued ||
      this.scene?.uiBottomBar?.currentPage !== "ovens" ||
      !this._isUiAlive()
    ) {
      return;
    }

    this._listRefreshQueued = true;
    this.scene.time.delayedCall(0, () => {
      this._listRefreshQueued = false;
      if (!this._isUiAlive()) return;
      if (!this._listDirty) return;
      this.rebuildList();
    });
  }

  _isUiAlive() {
    return !!(
      !this._destroyed &&
      this.scene?.sys &&
      this.root?.scene === this.scene &&
      this.listBody?.scene === this.scene &&
      this.scroll?.scene === this.scene
    );
  }

  _safeScrollLayout() {
    if (!this._isUiAlive()) return false;
    try {
      this.scroll.layout();
      return true;
    } catch {
      return false;
    }
  }

  rr(w = 0, h = 0, r = 14, c = 0x153248, a = 0.78, stroke = 0x95e4ff, sa = 0.16) {
    const rect = this.scene.rexUI.add.roundRectangle(0, 0, w, h, r, c, a);
    rect.setStrokeStyle(2, stroke, sa);
    return rect;
  }

  panelBg(w = 0, h = 0, r = 14, c = 0x153248, a = 0.78, stroke = 0x95e4ff, sa = 0.16) {
    const bg = this.rr(w, h, r, c, a, stroke, sa);
    bg.setDepth(-1);
    return bg;
  }

  txt(text, style = {}) {
    const label = this.scene.add.text(0, 0, text, { fontFamily: "Bungee", fontSize: 12, color: "#ffffff", ...style });
    label.setAlpha(1);
    label.setShadow(0, 1, "#000000", 2, true, true);
    return label;
  }

  button(label, fill = 0x305f78, stroke = 0xa9ebff, color = "#ffffff") {
    const compact = this.scene.scale.width < 1080;
    const bg = this.panelBg(0, 0, 12, fill, 0.95, stroke, 0.18);
    const text = this.txt(label, { fontSize: compact ? 11 : 12, color });
    const btn = this.scene.rexUI.add.label({
      background: bg,
      text,
      space: { left: compact ? 10 : 12, right: compact ? 10 : 12, top: compact ? 6 : 8, bottom: compact ? 6 : 8 }
    });
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => bg.setFillStyle(fill, 1));
    btn.on("pointerout", () => bg.setFillStyle(fill, 0.95));
    btn.setEnabledState = (enabled) => {
      btn.disableInteractive();
      if (enabled) btn.setInteractive({ useHandCursor: true });
      btn.setAlpha(enabled ? 1 : 0.4);
    };
    return btn;
  }

  pill(text, fill = 0x17384c, stroke = 0x93dfff, color = "#d7f5ff") {
    const compact = this.scene.scale.width < 1080;
    const bg = this.panelBg(0, 0, 11, fill, 0.92, stroke, 0.16);
    const label = this.txt(text, { fontSize: compact ? 9 : 10, color });
    const pill = this.scene.rexUI.add.label({
      background: bg,
      text: label,
      space: { left: compact ? 8 : 10, right: compact ? 8 : 10, top: compact ? 4 : 5, bottom: compact ? 4 : 5 }
    });
    pill.setValue = (nextText, nextFill = fill, nextStroke = stroke, nextColor = color) => {
      label.setText(nextText);
      label.setColor(nextColor);
      bg.setFillStyle(nextFill, 0.92);
      bg.setStrokeStyle(2, nextStroke, 0.16);
    };
    return pill;
  }

  slot(size = 54) {
    const s = this.scene.rexUI.add.overlapSizer({ width: size, height: size });
    const bg = this.panelBg(size, size, 13, 0x102637, 0.95, 0x98e7ff, 0.14);
    const shine = this.scene.rexUI.add.roundRectangle(0, 0, size - 16, 12, 6, 0xffffff, 0.08);
    const icon = this.scene.add.image(0, 0, "blank").setDisplaySize(size - 18, size - 18).setVisible(false);
    const count = this.txt("", { fontSize: 10, stroke: "#091018", strokeThickness: 3 }).setOrigin(1, 1).setVisible(false);
    const hint = this.txt("", { fontSize: 9, color: "#98bed0", align: "center", wordWrap: { width: size - 12 } }).setOrigin(0.5);
    s.addBackground(bg);
    s.add(shine, { align: "top", padding: { top: 7 } });
    s.add(icon, { align: "center" });
    s.add(hint, { align: "center" });
    s.add(count, { align: "right-bottom", padding: { right: 6, bottom: 5 } });
    s.setItem = (item, amount = 0, empty = "") => {
      const ui = typeof item === "string" ? UI_ITEM_TYPES[item] : (item?.name ? UI_ITEM_TYPES[item.name] : item);
      const iconKey = ui?.icon || null;
      const showIcon = !!(iconKey && this.scene.textures.exists(iconKey));
      icon.setVisible(showIcon);
      if (showIcon) icon.setTexture(iconKey);
      hint.setVisible(!showIcon && !!empty).setText(showIcon ? "" : empty);
      count.setVisible(amount > 1).setText(amount > 1 ? `x${amount}` : "");
      s.layout();
    };
    return s;
  }

  bar(width = 150, height = 12) {
    const s = this.scene.rexUI.add.overlapSizer({ width, height });
    const bg = this.panelBg(width, height, height / 2, 0x08121a, 0.92, 0x92ddff, 0.08);
    const fill = this.scene.rexUI.add.roundRectangle(0, 0, 1, height - 4, (height - 4) / 2, 0x49cf73, 1).setOrigin(0, 0.5);
    const text = this.txt("Idle", { fontSize: (width < 110 || this.scene.scale.width < 1080) ? 8 : 9, color: "#d7f3dc" }).setOrigin(0.5);
    s.addBackground(bg);
    s.add(fill, { align: "left", padding: { left: 2, right: 2 } });
    s.add(text, { align: "center" });
    s.setValue = (pct, label = "Idle", color = 0x49cf73) => {
      const fillWidth = Math.max(1, (width - 4) * Phaser.Math.Clamp(pct || 0, 0, 1));
      fill.setSize(fillWidth, height - 4);
      fill.setFillStyle(color, 1);
      text.setText(label);
      s.layout();
    };
    return s;
  }

  cookJob(oven) { return (Teams.teamLists[this.team]?.ovenJobs || []).find((j) => !j.canceled && j.oven === oven && j.inputidx === 0); }
  fuelJob(oven) { return (Teams.teamLists[this.team]?.ovenFuelJobs || []).find((j) => !j.canceled && j.oven === oven); }
  pickupJob(oven) { return (Teams.teamLists[this.team]?.ovenPickupJobs || []).find((j) => j.oven === oven && j.outputidx === 0 && j.amount > 0); }

  build() {
    const scene = this.scene;
    const rootSpace = { left: 10, right: 10, top: 8, bottom: 8, item: 12 };
    const splitWidth = Math.max(0, scene.scale.width - rootSpace.left - rootSpace.right - rootSpace.item);
    if (splitWidth < 420) {
      this.detailWidth = Math.max(160, Math.floor(splitWidth * 0.46));
      this.listWidth = Math.max(160, splitWidth - this.detailWidth);
    } else {
      const minPaneWidth = splitWidth >= 700 ? 320 : 240;
      this.detailWidth = Phaser.Math.Clamp(
        Math.floor(splitWidth * 0.44),
        minPaneWidth,
        Math.max(minPaneWidth, splitWidth - minPaneWidth)
      );
      this.listWidth = Math.max(minPaneWidth, splitWidth - this.detailWidth);
    }

    const root = scene.rexUI.add.sizer({ orientation: "x", space: rootSpace });
    this.detail = this.buildDetailPanel();
    this.detailScroll = scene.rexUI.add.scrollablePanel({
      width: this.detailWidth,
      height: 200,
      scrollMode: 0,
      scrollDetectionMode: "rectBounds",
      background: this.rr(0, 0, 16, 0x0f2432, 0.42, 0x93dfff, 0.14),
      panel: { child: this.detail.panel, mask: { padding: 2 } },
      sliderY: scene.rexUI.add.slider({
        height: 160,
        orientation: "y",
        track: scene.rexUI.add.roundRectangle(0, 0, 10, 0, 5, 0x0f1d28, 0.9),
        thumb: scene.rexUI.add.roundRectangle(0, 0, 10, 30, 5, 0x7adfff, 0.8),
      }),
      scrollerY: { pointerOutRelease: true, rectBoundsInteractive: true },
      space: { left: 8, right: 8, top: 8, bottom: 8, panel: 8 },
    });
    root.add(this.detailScroll, { proportion: 1.4, expand: true });

    this.listBody = this.scene.rexUI.add.sizer({ orientation: "y", space: { item: 10 } });
    this.scroll = this.scene.rexUI.add.scrollablePanel({
      width: this.listWidth,
      height: 200,
      scrollMode: 0,
      scrollDetectionMode: "rectBounds",
      background: this.rr(0, 0, 16, 0x0f2432, 0.42, 0x93dfff, 0.14),
      panel: { child: this.listBody, mask: { padding: 2 } },
      sliderY: this.scene.rexUI.add.slider({
        height: 168,
        orientation: "y",
        track: this.scene.rexUI.add.roundRectangle(0, 0, 10, 0, 5, 0x0f1d28, 0.9),
        thumb: this.scene.rexUI.add.roundRectangle(0, 0, 10, 34, 5, 0x7adfff, 0.8),
      }),
      scrollerY: { pointerOutRelease: true, rectBoundsInteractive: true },
      space: { left: 8, right: 8, top: 8, bottom: 8, panel: 10 },
    });
    root.add(this.scroll, { proportion: 1.6, expand: true });
    this.rebuildList();
    return root;
  }

  bindScrollInput() {
    if (this._onWheel) return;
    this._onWheel = (pointer, _gameObjects, dx, dy) => {
      if (this.scene.uiBottomBar?.currentPage !== "ovens") return;
      if (!this.scene.uiBottomBar?.expanded) return;
      if (!this.scroll?.isOverflowY) return;
      if (!this.isPointerOverScroll(pointer)) return;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(d) < 0.1) return;
      this.scroll.addChildOY(-d * 0.8, true);
      this.scene.input.stopPropagation();
    };
    this.scene.input.on("wheel", this._onWheel);
  }

  isPointerOverScroll(pointer) {
    if (!this.scroll?.getBounds) return false;
    return Phaser.Geom.Rectangle.Contains(this.scroll.getBounds(), pointer.x, pointer.y);
  }

  buildDetailPanel() {
    const compact = this.scene.scale.width < 1080;
    const contentWidth = Math.max(220, (this.detailWidth || 360) - 54);
    let queueColumnWidth = Math.max(156, Math.floor(contentWidth * 0.36));
    let burnerWidth = contentWidth - queueColumnWidth - 10;
    if (burnerWidth < 210) {
      burnerWidth = Math.floor((contentWidth - 10) * 0.58);
      queueColumnWidth = contentWidth - burnerWidth - 10;
    }

    const burnerBg = this.panelBg(0, 0, 15, 0x1f4a64, 0.46, 0x9ce7ff, 0.16);
    const title = this.txt("Clay Oven", { fontSize: compact ? 16 : 18 });
    const hp = this.bar(Math.max(150, contentWidth - 112), 13);
    const fuel = this.pill("Fuel 0", 0x2c2817, 0xffcf88, "#ffe8b2");
    const input = this.slot(compact ? 54 : 58);
    const output = this.slot(compact ? 54 : 58);
    const progress = this.bar(Math.max(98, burnerWidth - 172), 12);
    const burnerStatus = this.txt("Click the left tray to queue cooking. Click the right tray to request pickup.", {
      fontSize: compact ? 9 : 10, color: "#d9f5ff", wordWrap: { width: Math.max(110, burnerWidth - 176) }
    });
    const pickup = this.pill("No pickup queued", 0x17354a, 0x93dfff, "#d7f5ff");
    const refuelBtn = this.button("Queue Fuel");
    const fixBtn = this.button("Fix", 0x387344, 0xb4ffd1);
    const cookBubble = this.buildQueueBubble("Cook Request", 0x16384d, 0x6dd3ff, queueColumnWidth);
    const fuelBubble = this.buildQueueBubble("Fuel Request", 0x2a2517, 0xffcf88, queueColumnWidth);
    const actionButtonWidth = Math.max(118, Math.floor((contentWidth - 10) / 2));
    refuelBtn.setMinSize(actionButtonWidth, 38);
    fixBtn.setMinSize(actionButtonWidth, 38);
    fuel.setMinSize(96, 0);

    input.setInteractive({ useHandCursor: true }).on("pointerup", () => { if (this.selected) this.openJobEditor(this.selected); });
    output.setInteractive({ useHandCursor: true }).on("pointerup", () => { if (this.selected) this.queueOvenOutputPickup(this.selected); });
    refuelBtn.on("pointerup", () => { if (this.selected) this.openRefuelEditor(this.selected); });
    fixBtn.on("pointerup", () => { if (this.selected) buildingManager.requestBuildingFix(this.selected, this.team, []); });

    const actionRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 10 } })
      .add(refuelBtn, { proportion: 1, expand: true })
      .add(fixBtn, { proportion: 1, expand: true });
    const burnerMid = this.scene.rexUI.add.sizer({ orientation: "y", space: { item: 5 } })
      .add(this.txt("Burner Lane", { fontSize: compact ? 10 : 11, color: "#effcff" }), { expand: false })
      .add(progress, { expand: false })
      .add(burnerStatus, { expand: false });
    const burnerRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 10 } })
      .add(input, { expand: false })
      .add(burnerMid, { proportion: 1, expand: true })
      .add(this.txt("->", { fontSize: 16, color: "#9ccde0" }), { expand: false })
      .add(output, { expand: false });
    const burnerCard = this.scene.rexUI.add.sizer({ orientation: "y", space: { left: 10, right: 10, top: compact ? 6 : 8, bottom: compact ? 6 : 8, item: compact ? 5 : 6 } })
      .addBackground(burnerBg)
      .add(burnerRow, { expand: true })
      .add(pickup, { expand: false, align: "left" });
    const statRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(hp, { proportion: 1, expand: true })
      .add(fuel, { expand: false, align: "center" });
    const queueColumn = this.scene.rexUI.add.sizer({ orientation: "y", space: { item: 6 } })
      .add(cookBubble.box, { expand: true })
      .add(fuelBubble.box, { expand: true });
    const workRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 10 } })
      .add(burnerCard, { proportion: 1, expand: true })
      .add(queueColumn, { proportion: 0, expand: false, align: "top" });
    const panel = this.scene.rexUI.add.sizer({ orientation: "y", space: { left: 4, right: 4, top: 2, bottom: 2, item: 6 } })
      .add(title, { expand: false, align: "left" })
      .add(statRow, { expand: true })
      .add(actionRow, { expand: true })
      .add(workRow, { expand: true });

    panel.setMinSize(contentWidth, 0);
    burnerCard.setMinSize(burnerWidth, 0);
    cookBubble.box.setMinSize(queueColumnWidth, 0);
    fuelBubble.box.setMinSize(queueColumnWidth, 0);

    const setOven = (oven) => {
      if (!oven) {
        title.setText("Clay Oven");
        hp.setValue(0, "", 0x49cf73);
        fuel.setValue("Fuel 0", 0x2c2817, 0xffcf88, "#ffe8b2");
        input.setItem(null, 0, "");
        output.setItem(null, 0, "");
        progress.setValue(0, "", 0x49cf73);
        burnerStatus.setText("");
        pickup.setValue("", 0x17354a, 0x93dfff, "#d7f5ff");
        cookBubble.set("", "", null, 0, false, null);
        fuelBubble.set("", "", null, 0, false, null);
        refuelBtn.setEnabledState(false);
        fixBtn.setEnabledState(false);
        panel.layout();
        return;
      }

      const slot = oven?.cookingSlots?.[0] || null;
      const out = oven?.outputSlots?.[0] || null;
      const cookJob = oven ? this.cookJob(oven) : null;
      const fuelJob = oven ? this.fuelJob(oven) : null;
      const pickupJob = oven ? this.pickupJob(oven) : null;
      const dur = oven?.cookDurations?.[0] || 0;
      const elapsed = oven?.cookTimers?.[0] || 0;
      const pct = dur > 0 ? Math.min(elapsed / dur, 1) : 0;
      title.setText(oven ? `Oven (${oven.x}, ${oven.y})` : "Clay Oven");
      hp.setValue((oven?.health || 0) / Math.max(1, oven?.maxHealth || 1), oven ? `HP ${Math.floor(oven.health)}/${Math.floor(oven.maxHealth || 1)}` : "Idle", 0x49cf73);
      fuel.setValue(`Fuel ${oven?.fuel || 0}`, 0x2c2817, 0xffcf88, "#ffe8b2");
      input.setItem(slot?.item || null, slot?.amount || 0, "Cook");
      output.setItem(out?.item || null, out?.amount || 0, "Out");
      refuelBtn.setEnabledState(true);
      fixBtn.setEnabledState(true);
      progress.setValue(pct, slot ? (pct > 0 ? `${Math.round(pct * 100)}%` : "Queued") : "Idle", 0x49cf73);
      burnerStatus.setText(slot ? `${slot.item?.label || slot.item?.name || "Item"} is in the burner.` : "Click the left tray to queue cooking. Click the right tray to request pickup.");
      pickup.setValue(
        pickupJob ? `Pickup queued | ${pickupJob.amount} ready` : (out?.amount > 0 ? "Output ready | click tray to queue pickup" : "No pickup queued"),
        out?.amount > 0 ? 0x24453a : 0x17354a,
        out?.amount > 0 ? 0x8bf0c3 : 0x93dfff,
        out?.amount > 0 ? "#e5fff6" : "#d7f5ff"
      );
      cookBubble.set(cookJob ? `${cookJob.item?.label || cookJob.item?.name} x${cookJob.target}` : "Cook Request", cookJob ? `${cookJob.remaining}/${cookJob.target} left${cookJob.assigned > 0 ? ` | ${cookJob.assigned} assigned` : ""}` : "No cook request queued. Click the left tray to add one.", cookJob?.item || null, cookJob?.target || 0, !!cookJob, () => this.cancelOvenJob(cookJob));
      fuelBubble.set(fuelJob ? `Wood x${fuelJob.target}` : "Fuel Request", fuelJob ? `${fuelJob.remaining}/${fuelJob.target} wood left${fuelJob.assigned > 0 ? ` | ${fuelJob.assigned} assigned` : ""}` : "No fuel request queued. Use Queue Fuel to call for wood.", UI_ITEM_TYPES.wood, fuelJob?.target || 0, !!fuelJob, () => this.cancelFuelJob(fuelJob));
      panel.layout();
    };

    return { panel, setOven };
  }

  buildQueueBubble(name, fill, stroke, widthOverride = null) {
    const compact = this.scene.scale.width < 1080 || (widthOverride || 0) < 220;
    const contentWidth = widthOverride || Math.max(300, (this.detailWidth || 360) - 34);
    const bg = this.panelBg(0, 0, 14, fill, 0.44, stroke, 0.16);
    const icon = this.slot(compact ? 36 : 42);
    const title = this.txt(name, { fontSize: compact ? 11 : 12, color: "#f3fcff" });
    const cancelWidth = Math.max(82, Math.min(102, Math.floor(contentWidth * 0.3)));
    const body = this.txt("No request queued.", { fontSize: compact ? 9 : 10, color: "#e3f8ff", wordWrap: { width: Math.max(104, contentWidth - cancelWidth - 76) } });
    const cancel = this.button("Cancel", 0x7a2d41, 0xffb4c3);
    cancel.setMinSize(cancelWidth, compact ? 30 : 32);
    const textCol = this.scene.rexUI.add.sizer({ orientation: "y", space: { item: compact ? 2 : 4 } })
      .add(title, { expand: false })
      .add(body, { expand: false });
    const box = this.scene.rexUI.add.sizer({ orientation: "x", space: { left: 10, right: 10, top: compact ? 6 : 8, bottom: compact ? 6 : 8, item: compact ? 8 : 10 } })
      .addBackground(bg)
      .add(icon, { expand: false })
      .add(textCol, { proportion: 1, expand: true })
      .add(cancel, { expand: false });
    box.setMinSize(contentWidth, 0);
    return {
      box,
      set: (nextTitle, nextBody, item, amount, canCancel, onCancel) => {
        title.setText(nextTitle);
        body.setText(nextBody);
        const emptyHint = item
          ? ""
          : ((nextTitle || nextBody) ? (name === "Fuel Request" ? "Fuel" : "Cook") : "");
        icon.setItem(item, amount, emptyHint);
        cancel.removeAllListeners("pointerup");
        cancel.on("pointerup", () => { if (canCancel) onCancel?.(); });
        cancel.setEnabledState(canCancel);
        box.layout();
      }
    };
  }

  rebuildList() {
    if (!this._isUiAlive()) return false;
    this.cardByOven.clear();
    this.listBody.clear(true);
    try {
      (Teams.teamLists[this.team]?.ovenList || []).forEach((oven, idx) => {
        const row = this.createCard(oven, idx);
        if (!row) return;
        this.listBody.add(row, { expand: true });
        this.cardByOven.set(oven, row);
        this.updateCard(oven);
      });
      this._listDirty = false;
      return this._safeScrollLayout();
    } catch {
      return false;
    }
  }

  createCard(oven, idx) {
    const width = Math.max(220, (this.listWidth || (Math.floor(this.scene.scale.width * (2 / 3)) - 46)) - 24);
    const compact = width < 420 || this.scene.scale.width < 1080;
    const rowHeight = compact ? 76 : 80;
    const slotSize = compact ? 38 : 44;
    const progressWidth = compact ? 92 : 112;
    const bg = this.rr(width, rowHeight, 16, 0x102a3b, 0.78, 0x8fe5ff, 0.16);
    const input = this.slot(slotSize);
    const output = this.slot(slotSize);
    const progress = this.bar(progressWidth, 12);
    const fuel = this.pill("Fuel 0", 0x2e2a18, 0xffcf88, "#ffe8b2");
    const cook = this.pill("No cook request");
    const fuelReq = this.pill("No fuel request", 0x2a2417, 0xffcf88, "#ffe8b2");
    const pickup = this.pill("No pickup queued");
    const hp = this.bar(Math.max(80, width - 28), 9);
    const titleColWidth = compact ? 124 : 150;
    const titleLabel = this.txt(`Oven ${idx + 1} (${oven.x}, ${oven.y})`, {
      fontSize: compact ? 11 : 13,
      color: "#f4fcff",
      wordWrap: { width: titleColWidth }
    });
    const lane = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(input, { expand: false })
      .add(progress, { expand: false })
      .add(this.txt("->", { fontSize: 14, color: "#a5cfdf" }), { expand: false })
      .add(output, { expand: false });
    const top = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: compact ? 6 : 8 } })
      .add(this.scene.rexUI.add.sizer({ orientation: "x" }).add(titleLabel, { expand: false, align: "left" }), { expand: false, align: "center" })
      .add(lane, { proportion: 1, expand: true, align: "center" })
      .add(fuel, { expand: false, align: "center" });
    const bottom = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(cook, { proportion: 1, expand: true }).add(fuelReq, { proportion: 1, expand: true }).add(pickup, { proportion: 1, expand: true });
    const row = this.scene.rexUI.add.overlapSizer({ width, height: rowHeight })
      .addBackground(bg)
      .add(this.scene.rexUI.add.sizer({ orientation: "y", space: { left: 12, right: 12, top: compact ? 8 : 10, bottom: compact ? 8 : 10, item: compact ? 6 : 8 } })
        .add(top, { expand: true }).add(bottom, { expand: true }).add(hp, { expand: false }), { expand: true });
    row.userData = { bg, input, output, progress, fuel, cook, fuelReq, pickup, hp };
    row.setInteractive({ useHandCursor: true }).on("pointerdown", () => { this.selectOven(oven); this.centerCameraOnOven(oven); });
    row.on("pointerover", () => bg.setFillStyle(0x13354a, 0.9));
    row.on("pointerout", () => bg.setFillStyle(0x102a3b, 0.78));
    return row;
  }

  updateCard(oven) {
    const row = this.cardByOven.get(oven);
    if (!row?.userData) return;
    const slot = oven.cookingSlots?.[0] || null;
    const out = oven.outputSlots?.[0] || null;
    const cookJob = this.cookJob(oven);
    const fuelJob = this.fuelJob(oven);
    const pickupJob = this.pickupJob(oven);
    const dur = oven.cookDurations?.[0] || 0;
    const elapsed = oven.cookTimers?.[0] || 0;
    const pct = dur > 0 ? Math.min(elapsed / dur, 1) : 0;
    row.userData.input.setItem(slot?.item || null, slot?.amount || 0, "Cook");
    row.userData.output.setItem(out?.item || null, out?.amount || 0, "Out");
    row.userData.progress.setValue(pct, slot ? (pct > 0 ? `${Math.round(pct * 100)}%` : "Queued") : "Idle", 0x49cf73);
    row.userData.fuel.setValue(`Fuel ${oven.fuel | 0}`, 0x2e2a18, 0xffcf88, "#ffe8b2");
    row.userData.cook.setValue(cookJob ? `${cookJob.item?.label || cookJob.item?.name} ${cookJob.remaining}/${cookJob.target}` : "No cook request");
    row.userData.fuelReq.setValue(fuelJob ? `Wood ${fuelJob.remaining}/${fuelJob.target}` : "No fuel request", 0x2a2417, 0xffcf88, "#ffe8b2");
    row.userData.pickup.setValue(
      pickupJob ? `Pickup ${pickupJob.amount} ready` : (out?.amount > 0 ? "Output ready" : "No pickup queued"),
      out?.amount > 0 ? 0x24453a : 0x17384c,
      out?.amount > 0 ? 0x8bf0c3 : 0x93dfff,
      out?.amount > 0 ? "#e5fff6" : "#d7f5ff"
    );
    row.userData.hp.setValue((oven.health || 0) / Math.max(1, oven.maxHealth || 1), "", 0x49cf73);
  }

  queueOvenOutputPickup(oven) {
    if (!oven) return;
    const team = Teams.teamLists[this.team];
    const slot = oven.outputSlots?.[0];
    if (!team || !slot?.item || slot.amount <= 0) return showAlert(this.scene, "Nothing to pick up in that tray.");
    const existing = (team.ovenPickupJobs || []).find((j) => j.oven === oven && j.outputidx === 0 && j.taskType === "ovenPickup" && j.amount > j.assigned);
    if (existing) return showAlert(this.scene, "Pickup is already queued for this tray.");
    (team.ovenPickupJobs || (team.ovenPickupJobs = [])).push({ oven, outputidx: 0, x: oven.x, y: oven.y, type: TILE_TYPES.clayOven, assigned: 0, amount: slot.amount, taskType: "ovenPickup" });
    this.scene.events.emit("oven:updated", oven);
  }

  onShow() {
    this.rebuildList();
    const ovens = Teams.teamLists[this.team]?.ovenList || [];
    if (!this.selected || !ovens.includes(this.selected)) this.selected = ovens[0] || null;
    this.detail?.setOven?.(this.selected);
    ovens.forEach((oven) => this.updateCard(oven));
  }

  selectOven(oven) { this.selected = oven; this.detail?.setOven?.(oven); }
  selectFromWorld(oven) {
    if (oven && !this.cardByOven.has(oven)) this.rebuildList();
    this.selectOven(oven);
  }
  centerCameraOnOven(oven) {
    if (!oven?.sprite) return;
    const cam = this.scene.worldScene?.cameras?.main || this.scene.cameras.main;
    cam.centerOn(oven.sprite.x, oven.sprite.y);
  }

  openJobEditor(oven) {
    if (!oven) return;
    this.closeJobEditor?.();
    const existing = this.cookJob(oven);
    const cookables = Object.values(UI_ITEM_TYPES).filter((item) => item.cooksTo);
    const keys = cookables.map((item) => item.name);
    let itemKey = existing?.item?.name || cookables[0]?.name;
    let amount = Math.max(1, existing?.remaining || 1);
    const current = oven.cookingSlots?.[0];
    const currentItem = current?.item?.name || null;
    const currentAmt = current?.amount || 0;
    const capFor = (key) => Math.max(0, (UI_ITEM_TYPES[key]?.stacks || 1) - (currentItem === key ? currentAmt : 0));
    if (capFor(itemKey) <= 0 && !existing) {
      showAlert(this.scene, "That burner is already full.");
      return;
    }
    const popupBg = this.panelBg(0, 0, 14, 0x102738, 0.98, 0x8fe6ff, 0.18);
    const title = this.txt("Queue Burner Job", { fontSize: 13 });
    const itemText = this.txt(UI_ITEM_TYPES[itemKey]?.label || itemKey, { fontSize: 12, color: "#dff6ff" });
    const amtText = this.txt(String(amount), { fontSize: 14 });
    const change = this.button("Change Item");
    const dec = this.button("-", 0x21394a, 0x8fe6ff);
    const inc = this.button("+", 0x21394a, 0x8fe6ff);
    const start = this.button(existing ? "Update Job" : "Start Job", 0x2f6b4a, 0xb4ffd1);
    const end = this.button("Cancel Job", 0x7a2d41, 0xffb4c3);
    const close = this.button("Close", 0x4a5661, 0xc9d6df);
    dec.setMinSize(34, 34); inc.setMinSize(34, 34); end.setEnabledState(!!existing);
    change.on("pointerup", () => {
      const i = keys.indexOf(itemKey);
      itemKey = keys[(i + 1) % keys.length];
      itemText.setText(UI_ITEM_TYPES[itemKey]?.label || itemKey);
      const cap = capFor(itemKey);
      amount = cap > 0 ? Math.min(cap, amount) : 1;
      amtText.setText(String(amount));
    });
    dec.on("pointerup", () => { amount = Math.max(1, amount - 1); amtText.setText(String(amount)); });
    inc.on("pointerup", () => {
      const cap = capFor(itemKey);
      amount = cap > 0 ? Math.min(cap, amount + 1) : 1;
      amtText.setText(String(amount));
    });
    start.on("pointerup", () => { this.startOvenJob(oven, itemKey, amount); this.closeJobEditor(); });
    end.on("pointerup", () => { const live = this.cookJob(oven); if (live) this.cancelOvenJob(live); this.closeJobEditor(); });
    close.on("pointerup", () => this.closeJobEditor());
    const qtyRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(this.txt("Qty", { fontSize: 11, color: "#a7cbdc" }), { expand: false, align: "center" })
      .add(dec, { expand: false, align: "center" })
      .add(amtText, { expand: false, align: "center" })
      .add(inc, { expand: false, align: "center" });
    const actionRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(start, { proportion: 1, expand: true })
      .add(end, { proportion: 1, expand: true })
      .add(close, { proportion: 1, expand: true });
    const toolbar = this.scene.rexUI.add.sizer({ orientation: "y", space: { left: 12, right: 12, top: 12, bottom: 12, item: 10 } })
      .add(title, { expand: false, align: "left" })
      .add(itemText, { expand: false, align: "left" })
      .add(change, { expand: true })
      .add(qtyRow, { expand: false, align: "left" })
      .add(actionRow, { expand: true });
    const popup = this.scene.rexUI.add.sizer({ orientation: "x", space: { left: 8, right: 8, top: 8, bottom: 8 } })
      .addBackground(popupBg)
      .add(toolbar, { proportion: 1, expand: true });
    popup.setMinSize(360, 0);
    this.showPopup(popup);
  }

  openRefuelEditor(oven) {
    if (!oven) return;
    this.closeJobEditor?.();
    const existing = this.fuelJob(oven);
    let amount = Math.max(1, existing?.remaining || 5);
    const popupBg = this.panelBg(0, 0, 14, 0x102738, 0.98, 0x8fe6ff, 0.18);
    const amtText = this.txt(String(amount), { fontSize: 14 });
    const dec = this.button("-", 0x21394a, 0x8fe6ff);
    const inc = this.button("+", 0x21394a, 0x8fe6ff);
    const start = this.button(existing ? "Update Fuel" : "Start Fuel", 0x2f6b4a, 0xb4ffd1);
    const end = this.button("Cancel Fuel", 0x7a2d41, 0xffb4c3);
    const close = this.button("Close", 0x4a5661, 0xc9d6df);
    dec.setMinSize(34, 34); inc.setMinSize(34, 34); end.setEnabledState(!!existing);
    dec.on("pointerup", () => { amount = Math.max(1, amount - 1); amtText.setText(String(amount)); });
    inc.on("pointerup", () => { amount = Math.min(99, amount + 1); amtText.setText(String(amount)); });
    start.on("pointerup", () => { this.startRefuelJob(oven, amount); this.closeJobEditor(); });
    end.on("pointerup", () => { const live = this.fuelJob(oven); if (live) this.cancelFuelJob(live); this.closeJobEditor(); });
    close.on("pointerup", () => this.closeJobEditor());
    const amountRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(this.txt("Wood", { fontSize: 11, color: "#a7cbdc" }), { expand: false, align: "center" })
      .add(dec, { expand: false, align: "center" })
      .add(amtText, { expand: false, align: "center" })
      .add(inc, { expand: false, align: "center" });
    const actionRow = this.scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
      .add(start, { proportion: 1, expand: true })
      .add(end, { proportion: 1, expand: true })
      .add(close, { proportion: 1, expand: true });
    const toolbar = this.scene.rexUI.add.sizer({ orientation: "y", space: { left: 12, right: 12, top: 12, bottom: 12, item: 10 } })
      .add(this.txt("Queue Fuel Delivery", { fontSize: 13 }), { expand: false, align: "left" })
      .add(this.txt("Request wood for this oven.", { fontSize: 11, color: "#abd0e0" }), { expand: false, align: "left" })
      .add(amountRow, { expand: false, align: "left" })
      .add(actionRow, { expand: true });
    const popup = this.scene.rexUI.add.sizer({ orientation: "x", space: { left: 8, right: 8, top: 8, bottom: 8 } })
      .addBackground(popupBg)
      .add(toolbar, { proportion: 1, expand: true });
    popup.setMinSize(350, 0);
    this.showPopup(popup);
  }

  showPopup(popup) {
    this.jobPopup = popup;
    this.scene.add.existing(popup);
    popup.setDepth(UIDEPTH + 100).layout();
    this.positionJobPopup(popup);
    this.jobBlocker?.destroy();
    this.jobBlocker = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.01)
      .setOrigin(0).setDepth(UIDEPTH + 99).setInteractive()
      .on("pointerup", (pointer) => {
        const bounds = popup.getBounds();
        if (!Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y)) this.closeJobEditor();
      });
    this.closeJobEditor = () => {
      this.jobBlocker?.destroy(); this.jobBlocker = null;
      if (this.jobPopup?.scene) this.jobPopup.destroy();
      this.jobPopup = null;
    };
  }

  positionJobPopup(popup) {
    const pad = 12;
    popup.layout();
    const pw = popup.width || popup.getBounds().width;
    const ph = popup.height || popup.getBounds().height;
    const bounds = this.detailScroll?.getBounds?.();
    const preferredX = bounds ? bounds.centerX : this.scene.scale.width / 2;
    const preferredY = bounds ? bounds.y + 18 + ph / 2 : this.scene.scale.height / 2;
    const x = Phaser.Math.Clamp(preferredX, pad + pw / 2, this.scene.scale.width - pad - pw / 2);
    const y = Phaser.Math.Clamp(preferredY, pad + ph / 2, this.scene.scale.height - pad - ph / 2);
    popup.setPosition(x, y);
  }

  startOvenJob(oven, itemKey, amount) {
    const item = UI_ITEM_TYPES[itemKey];
    if (!item?.cooksTo) return;
    const current = oven.cookingSlots?.[0];
    const inSlot = current?.item?.name === itemKey ? current.amount : 0;
    const capacity = Math.max(0, (item.stacks || 1) - inSlot);
    if (capacity <= 0) {
      showAlert(this.scene, "That burner is already full.");
      return;
    }
    const target = Math.max(1, Math.min(capacity, amount));
    const team = Teams.teamLists[this.team];
    const existing = this.cookJob(oven);
    if (existing) this.cancelOvenJob(existing, true);
    team.ovenJobs.push({ oven, inputidx: 0, item, target, delivered: 0, remaining: target, assigned: 0, canceled: false, x: oven.x, y: oven.y });
    this.scene.events.emit("oven:updated", oven);
  }

  cancelOvenJob(job, silent = false) {
    if (!job) return;
    const team = Teams.teamLists[this.team];
    job.canceled = true;
    const arr = team.ovenDeliveryItems || (team.ovenDeliveryItems = []);
    for (let i = arr.length - 1; i >= 0; i--) {
      const task = arr[i];
      if (task.oven === job.oven && task.inputidx === job.inputidx && task.item?.name === job.item?.name) arr.splice(i, 1);
    }
    const idx = team.ovenJobs.indexOf(job);
    if (idx !== -1) team.ovenJobs.splice(idx, 1);
    if (!silent) this.scene.events.emit("oven:updated", job.oven);
  }

  startRefuelJob(oven, amount) {
    const team = Teams.teamLists[this.team];
    const target = Math.max(1, Math.min(99, amount | 0));
    const existing = this.fuelJob(oven);
    if (existing) this.cancelFuelJob(existing, true);
    team.ovenFuelJobs.push({ oven, target, delivered: 0, remaining: target, assigned: 0, canceled: false, x: oven.x, y: oven.y });
    this.scene.events.emit("oven:updated", oven);
  }

  cancelFuelJob(job, silent = false) {
    if (!job) return;
    const team = Teams.teamLists[this.team];
    job.canceled = true;
    const arr = team.ovenFuelDeliveryItems || (team.ovenFuelDeliveryItems = []);
    for (let i = arr.length - 1; i >= 0; i--) {
      const task = arr[i];
      if (task.job === job || task.oven === job.oven) arr.splice(i, 1);
    }
    const idx = team.ovenFuelJobs.indexOf(job);
    if (idx !== -1) team.ovenFuelJobs.splice(idx, 1);
    if (!silent) this.scene.events.emit("oven:updated", job.oven);
  }

  update() {
    if (this.scene.uiBottomBar?.currentPage !== "ovens" || !this.selected) return;
    this.detail?.setOven?.(this.selected);
    this.updateCard(this.selected);
  }
}
