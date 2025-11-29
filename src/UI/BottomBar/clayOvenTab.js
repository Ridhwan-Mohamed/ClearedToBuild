// ClayOvenTab.js
import { showAlert, TILE_TYPES, UIDEPTH } from "../../constants";
import { Teams } from "../../Teams";
import { UI_ITEM_TYPES } from "../UIConstants";


export default class ClayOvenTab {
  constructor(scene, teamNumber = 1) {
    this.scene = scene;
    this.team = teamNumber;
    this.selected = null;

    // 🔥 map ovens to their UI rows
    this.cardByOven = new Map();
    this.root = this.build();

    // live detail refresh still ok
    this._update = this.update.bind(this);
    this.scene.events.on('update', this._update);

    // 🔊 listen for oven lifecycle
    this._onOvenUpdated = (oven) => {
      if (!oven || oven.teamNumber !== this.team) return;

      const current = this.scene.uiBottomBar?.currentPage;

      // 🔒 Only touch UI if the ovens tab is actually open
      if (current !== 'ovens') return;

      // Keep the row UI in sync with the oven state (only when tab is open)
      this.updateCard(oven);

      // And only touch detail panel if this oven is selected
      if (this.selected === oven && this.detail?.setOven) {
        this.detail.setOven(oven);
      }
    };
    this._onOvenAdded = (oven) => {
      if (!oven || oven.teamNumber !== this.team) return;
      const idx = (Teams.teamLists[this.team]?.ovenList || []).indexOf(oven);
      const row = this.createCard(oven, idx >= 0 ? idx : this.cardByOven.size);
      this.listBody.add(row, { expand: false });
      this.cardByOven.set(oven, row);
      this.scroll.layout();
    };
    this._onOvenRemoved = (oven) => {
      const jobs = Teams.teamLists[this.team]?.ovenJobs;
      if (jobs) {
        for (let i = jobs.length - 1; i >= 0; i--) {
          if (jobs[i].oven === oven) jobs.splice(i, 1);
        }
      }
      const row = this.cardByOven.get(oven);
      if (row) {
        row.destroy();
        this.cardByOven.delete(oven);
        this.scroll.layout();
      }
      if (this.selected === oven) {
        this.selected = null;
        this.detail.setOven(null);
      }
    };

    this._onResize = () => { if (this.jobPopup) this.positionJobPopup(this.jobPopup); };
    this.scene.scale.on('resize', this._onResize);

    scene.events.on('oven:updated', this._onOvenUpdated);
    scene.events.on('oven:added',   this._onOvenAdded);
    scene.events.on('oven:removed', this._onOvenRemoved);
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
    // Hide icons & counters inside each oven card
    for (const [oven, row] of this.cardByOven.entries()) {
      if (!row?.userData) continue;
      // hide cook slot counters/icons
      row.userData.cookIcons?.forEach(ic => {
        ic?.setVisible(false);
        ic?.children?.map?.forEach?.(ch => ch.setVisible(false)); // icon + text
      });
      // hide output slot counters/icons
      row.userData.outIcons?.forEach(ic => {
        ic?.setVisible(false);
        ic?.children?.map?.forEach?.(ch => ch.setVisible(false));
      });
      // hide fuel text/icon
      row.userData.fuelValueText?.setVisible(false);
      row.userData.fuelBadge?.setVisible?.(false);
    }
  }

  destroy() {
    this.scene.events.off('update', this._update);
    this.scene.events.off('oven:updated', this._onOvenUpdated);
    this.scene.events.off('oven:added',   this._onOvenAdded);
    this.scene.events.off('oven:removed', this._onOvenRemoved);
    this.scene.scale.off('resize', this._onResize);
    this.root?.destroy();
  }


  // ---------- UI Builders ----------
  build() {
    const scene = this.scene;

    // Root split: left (details) 1/3, right (cards) 2/3
    const root = scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 12, right: 12, top: 8, bottom: 8, item: 12 }
    });

    // Left details panel
    this.detail = this.buildDetailPanel();
    root.add(this.detail.panel, { proportion: 1, expand: true });

    // Right: scrollable list of oven cards
    this.listBody = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 8 } });

    this.scroll = scene.rexUI.add.scrollablePanel({
      width: Math.floor(scene.scale.width * (2/3)) - 48,
      height: 200,
      scrollMode: 0,
      background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 8, 0x000000, 0.15),
      panel: { child: this.listBody, mask: { padding: 1 } },
      sliderY: scene.rexUI.add.slider({
        height: 160,
        orientation: 'y',
        track: scene.rexUI.add.roundRectangle(0, 0, 10, 0, 5, 0x333333),
        thumb: scene.rexUI.add.roundRectangle(0, 0, 10, 28, 5, 0x999999),
      }),
      space: { left: 6, right: 6, top: 6, bottom: 6, panel: 8 }
    });

    root.add(this.scroll, { proportion: 2, expand: true });

    // build list once
    this.rebuildList();
    return root;
  }

  buildDetailPanel() {
    const scene = this.scene;
    const rr = (w,h,r,c,a=1) => scene.rexUI.add.roundRectangle(0,0,w,h,r,c,a);

    // header: title
    const title = scene.add.text(0,0,"Oven Details", { fontSize: 16, color: "#ffffff", fontFamily: "sans-serif" });

    // after 'title' create a fuel row
    const woodIconKey = (UI_ITEM_TYPES['wood']?.icon) || 'wood' || 'blank';
    const fuelIcon = scene.add.image(0,0, woodIconKey).setDisplaySize(20,20).setOrigin(0.5);
    const fuelText = scene.add.text(0,0, 'Fuel: 0', { fontSize: 14, color: '#ffd27f' });

    const fuelRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } })
          .add(fuelIcon, 0, 'center', 0, false)
          .add(fuelText, 0, 'center', 0, false);

    const refuelBtn = scene.rexUI.add.label({
      background: scene.rexUI.add.roundRectangle(0,0,0,0,6,0x444444),
      text: scene.add.text(0,0,'Refuel Oven',{ fontSize:12, color:'#ffffff' }),
      space: { left:10,right:10,top:4,bottom:4 }
    })
    .setInteractive()
    .on('pointerup', () => {
      if (this.selected) this.openRefuelEditor(this.selected);
    });



    // helper: icon with count (overlay bottom-right)
    const iconWithCount = () => {
      const c = scene.rexUI.add.overlapSizer({ width: 28, height: 28 });
      const icon = scene.add.image(0,0,"blank").setDisplaySize(24,24).setOrigin(0.5);
      const count = scene.add.text(0,0,"", {
        fontSize: 12, color: "#ffffff", stroke: "#000", strokeThickness: 2, fontFamily: "monospace"
      }).setOrigin(1,1);
      c.add(icon, { key: "icon", align: "center" });
      c.add(count, { key: "count", align: "right-bottom" });
      c.setIcon = (key, amt) => {
        if (key) icon.setTexture(key);
        if (amt && amt > 1) { count.setVisible(true).setText("x"+amt); }
        else { count.setVisible(false); }
      };
      return c;
    };

    // helper: mini progress bar (overlapped so fill is above bg)
    const makeProgress = () => {
      const s = scene.rexUI.add.overlapSizer({ width: 80, height: 8 });
      const bg   = rr(80,8,4,0x111111,1);
      const fill = rr(1, 8,4,0x22cc66,1).setOrigin(0,0.5);
      s.addBackground(bg);
      s.add(fill, { key: "fill", align: "left", expand: false, padding: { left: 2, right: 2 } });
      s.setPct = (p) => {
        const pct = Phaser.Math.Clamp(p, 0, 1);
        fill.width = Math.max(1, (80-4) * pct);
        s.layout();
      };
      return s;
    };

    // build 3 rows: [ cookIcon + count ] [progress] → [ outIcon + count ]
    const rows = [];
    const col = scene.rexUI.add.sizer({ orientation: "y", space: { item: 10 } });

    for (let i=0;i<3;i++) {
      const cook = iconWithCount();
      const prog = makeProgress();
      const arrow = scene.add.text(0,0,"→", { fontSize: 16, color: "#bbbbbb" });
      const out  = iconWithCount();

      const row = scene.rexUI.add.sizer({ orientation: "x", space: { item: 8 } })
        .add(cook, 0, "center", 0, false)
        .add(prog, 0, "center", 0, false)
        .add(arrow,0, "center", 0, false)
        .add(out,  0, "center", 0, false);

      col.add(row, 0, "left", 0, false);
      rows.push({ cook, prog, out });
      cook.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.openJobEditor(this.selected, i);
      });
      out.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.queueOvenOutputPickup(this.selected, i);
      });
    }

    const panel = scene.rexUI.add.sizer({
      orientation: "y",
      space: { left: 10, right: 10, top: 6, bottom: 6, item: 10 }
    })
      .add(title, 0, "left", 0, false)
      .add(fuelRow, 0, "left", 0, false)
      .add(refuelBtn, 0, "left", 0, false)
      .add(col,   0, "left", 0, true);

    // methods to update details
    const setOven = (oven) => {
      if (!oven) {
        rows.forEach(r => {
          r.cook.setIcon("blank", 0);
          r.prog.setPct(0);
          r.out.setIcon("blank", 0);
        });
        fuelText.setText('Fuel: 0');
        return;
      }
      fuelText.setText(`Fuel: ${oven.fuel|0}`);
      for (let i=0;i<3;i++) {
        const cookSlot = oven.cookingSlots[i];
        const outSlot  = oven.outputSlots[i];
        const cookKey = UI_ITEM_TYPES[cookSlot?.item?.name || "empty"]?.icon || "blank";
        const outKey  = UI_ITEM_TYPES[outSlot?.item?.name  || "empty"]?.icon || "blank";
        rows[i].cook.setIcon(cookKey, cookSlot?.amount || 0);
        rows[i].out.setIcon(outKey, outSlot?.amount || 0);

        const dur = oven.cookDurations[i] || 0;
        const t   = oven.cookTimers[i] || 0;
        rows[i].prog.setPct(dur > 0 ? Math.min(t/dur, 1) : 0);
      }
    };

    return { panel, setOven, fuelText };
  }

  // ---------- List (cards) ----------
  rebuildList() {
    const scene = this.scene;
    this.cardByOven.clear();
    this.listBody.clear(true);

    const ovens = Teams.teamLists[this.team]?.ovenList || [];
    ovens.forEach((oven, idx) => {
      const row = this.createCard(oven, idx);
      this.listBody.add(row, { expand: false });
      this.cardByOven.set(oven, row);
    });

    this.scroll.layout();
  }


  createCard(oven, idx) {
    const scene = this.scene;
    const name = scene.add.text(0, 0, `Oven ${idx + 1} (${oven.x},${oven.y})`, {
      fontSize: 13,
      color: "#ffffff",
    });

    const woodKey = UI_ITEM_TYPES["wood"]?.icon || "wood" || "blank";
    const fuelValueText = scene.add.text(0, 0, String(oven.fuel | 0), {
      fontSize: 12,
      color: "#ffd27f",
    });

    const fuelBadge = scene.rexUI
      .add.sizer({ orientation: "x", space: { item: 4 } })
      .add(
        scene.add.image(0, 0, woodKey).setDisplaySize(16, 16).setOrigin(0.5)
      )
      .add(fuelValueText);

    // helper: icon overlay
    const icon = (key, amt) => {
      const c = scene.rexUI.add.overlapSizer({ width: 26, height: 26 });
      const im = scene.add
        .image(0, 0, key || "blank")
        .setDisplaySize(22, 22)
        .setOrigin(0.5);
      const tx = scene.add
        .text(0, 0, "", {
          fontSize: 11,
          color: "#ffffff",
          stroke: "#000",
          strokeThickness: 2,
          fontFamily: "monospace",
        })
        .setOrigin(1, 1);
      c.add(im, { key: "im", align: "center" });
      c.add(tx, { key: "tx", align: "right-bottom" });
      c.setIcon = (k, a) => {
        if (k) im.setTexture(k);
        if (a && a > 1) tx.setText("x" + a).setVisible(true);
        else tx.setVisible(false);
      };
      return c;
    };

    // input row icons
    const cookRow = scene.rexUI.add.sizer({ orientation: "x", space: { item: 6 } });
    const cookIcons = [];
    for (let i = 0; i < 3; i++) {
      const slot = oven.cookingSlots[i];
      const key = UI_ITEM_TYPES[slot?.item?.name || "empty"]?.icon || "blank";
      const ic = icon(key, slot?.amount || 0);
      cookRow.add(ic);
      cookIcons.push(ic);
    }

    const arrow = scene.add.text(0, 0, "→", { fontSize: 14, color: "#bbbbbb" });

    // output row icons
    const outRow = scene.rexUI.add.sizer({ orientation: "x", space: { item: 6 } });
    const outIcons = [];
    for (let i = 0; i < 3; i++) {
      const slot = oven.outputSlots[i];
      const key = UI_ITEM_TYPES[slot?.item?.name || "empty"]?.icon || "blank";
      const ic = icon(key, slot?.amount || 0);
      outRow.add(ic);
      outIcons.push(ic);
    }

    // background + layout
    const bg = scene.rexUI
      .add.roundRectangle(0, 0, 0, 0, 6, 0xffffff, 0.08)
      .setStrokeStyle(1, 0xffffff, 0.15);

    const row = scene.rexUI.add.sizer({
      orientation: "x",
      space: { left: 12, right: 12, top: 6, bottom: 6, item: 12 },
    })
      .addBackground(bg)
      .add(name, { proportion: 1, expand: false })
      .add(fuelBadge, { proportion: 0, expand: false })
      .add(cookRow, { proportion: 0, expand: false })
      .add(arrow, { proportion: 0, expand: false })
      .add(outRow, { proportion: 0, expand: false });

    // 🔥 stretch full width
    const fullWidth = Math.floor(scene.scale.width * (2 / 3)) - 72;
    row.setMinSize(fullWidth, 48);

    row.userData = { oven, name, cookIcons, outIcons, fuelBadge, fuelValueText };

    row.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.selectOven(oven);
      this.centerCameraOnOven(oven);
    });

    row.on("pointerover", () => bg.setFillStyle(0xffffff, 0.15));
    row.on("pointerout", () => bg.setFillStyle(0xffffff, 0.08));

    return row;
  }

  queueOvenOutputPickup(oven, idx) {
    if (!oven) return;

    const team = Teams.teamLists[this.team];
    if (!team) return;

    const slot = oven.outputSlots?.[idx];
    if (!slot || !slot.item || slot.amount <= 0) {
        showAlert(this.scene, 'Nothing to pick up in that slot.');
        return;
    }

    const jobs = team.ovenPickupJobs || (team.ovenPickupJobs = []);

    // Don't double-queue a live job for this oven/output slot
    const existing = jobs.find(j =>
        j.oven === oven &&
        j.outputidx === idx &&
        j.taskType === 'ovenPickup' &&
        j.amount > j.assigned
    );

    if (existing) {
        showAlert(this.scene, 'Pickup is already queued for this slot.');
        return;
    }

    // Create a job for the current amount in that slot
    jobs.push({
        oven,
        outputidx: idx,
        x: oven.x,
        y: oven.y,
        type: TILE_TYPES.clayOven, // same shape as auto-created tasks
        assigned: 0,
        amount: slot.amount,
        taskType: 'ovenPickup'
    });

    // Let UI/others know oven state changed
    this.scene.events.emit('oven:updated', oven);
  }

  onShow() {
    // Called when the Clay Ovens tab becomes visible
    const team = Teams.teamLists[this.team];
    if (!team) return;

    const ovens = team.ovenList || [];

    // If nothing selected (or old selection is gone), pick the first oven
    if (!this.selected || !ovens.includes(this.selected)) {
      if (ovens[0]) {
        this.selectOven(ovens[0]);
      } else {
        this.selected = null;
        if (this.detail?.setOven) this.detail.setOven(null);
        return;
      }
    } else if (this.detail?.setOven) {
      // Ensure detail panel is synced with existing selection
      this.detail.setOven(this.selected);
    }

    // Refresh every row from current oven state
    ovens.forEach((oven) => {
      this.updateCard(oven);
    });
  }

  // ---------- BEHAVIOR ----------
  selectOven(oven) {
    this.selected = oven;
    if (this.detail?.setOven) {
      this.detail.setOven(oven);
    }
  }

  centerCameraOnOven(oven) {
    if (!oven?.sprite) return;
    const cam = this.scene.cameras.main;
    cam.centerOn(oven.sprite.x, oven.sprite.y);
  }

  // Allow map clicks to open the detail view directly
  selectFromWorld(oven) {
    this.selectOven(oven);
    // no camera move on world click
  }

  updateCard(oven) {
    const row = this.cardByOven.get(oven);
    if (!row || !row.userData) return;

    // cooking slots
    for (let i=0;i<3;i++) {
      const slot = oven.cookingSlots[i];
      const key  = UI_ITEM_TYPES[slot?.item?.name || "empty"]?.icon || "blank";
      row.userData.cookIcons[i].setIcon(key, slot?.amount || 0);
    }

    // output slots
    for (let i=0;i<3;i++) {
      const slot = oven.outputSlots[i];
      const key  = UI_ITEM_TYPES[slot?.item?.name || "empty"]?.icon || "blank";
      row.userData.outIcons[i].setIcon(key, slot?.amount || 0);
    }

    const fuelText = row.userData.fuelValueText;
    if (fuelText && fuelText.setText) {
      fuelText.setText(String(oven.fuel | 0));
    }

  }


  // ------------ JOBS ------------

  findJob(oven, idx) {
    const jobs = Teams.teamLists[this.team]?.ovenJobs || [];
    return jobs.find(j => j.oven === oven && j.inputidx === idx);
  }

  openJobEditor(oven, idx) {
    if (!oven) return;

    // close existing popup
    this.closeJobEditor?.();

    const scene = this.scene;
    const cookables = Object.values(UI_ITEM_TYPES).filter(it => it.cooksTo);
    const itemKeys = cookables.map(it => it.name);
    let itemKey = cookables[0]?.name;
    const maxStacks = (n) => UI_ITEM_TYPES[n]?.stacks || 1;

    // current slot occupancy to cap target
    const slot = oven.cookingSlots[idx];
    const currentItem = slot?.item?.name;
    const currentAmt  = slot?.amount || 0;

    if(currentItem && currentAmt >= currentItem.stacks){
      showAlert(scene, "To much in slot");
      return;
    }

    let amount = 1;

    // 🔹 CREATE BACKGROUND FIRST so it’s behind everything
    const tbBg = scene.rexUI.add.roundRectangle(
      0, 0, 0, 0, 6, 0x333333, 1
    );
    // optional: force it behind by depth, if you want
    tbBg.setDepth(-1);

    // make sure toolbar/text aren’t inheriting any opacity
    const white = { fontSize: 13, color: '#ffffff' };
    const itemText = scene.add.text(0,0,itemKey, white).setAlpha(1);
    const amtText  = scene.add.text(0,0,String(amount),{ fontSize:14, color:'#ffffff' }).setAlpha(1);

    // optional readability bump for small UI text
    itemText.setShadow(0,1,'#000',2,true,true);
    amtText.setShadow(0,1,'#000',2,true,true);

    const dec = scene.rexUI.add.label({ text: scene.add.text(0,0,'−',{fontSize:16,color:'#fff'}), space:{left:6,right:6,top:4,bottom:4} })
      .setInteractive().on('pointerup', ()=> {
        amount = Math.max(1, amount-1);
        amtText.setText(String(amount));
      });

    const inc = scene.rexUI.add.label({ text: scene.add.text(0,0,'＋',{fontSize:16,color:'#fff'}), space:{left:6,right:6,top:4,bottom:4} })
      .setInteractive().on('pointerup', ()=> {
        const cap = maxStacks(itemKey) - (currentItem === itemKey ? currentAmt : 0);
        amount = Math.max(1, Math.min(cap, amount+1));
        amtText.setText(String(amount));
      });

    const rr = (w,h,r,c) => this.scene.rexUI.add.roundRectangle(0,0,w,h,r,c);

    // small button helper with guaranteed text area
    const mkBtn = (txt, bg) => this.scene.rexUI.add.label({
      text: this.scene.add.text(0,0,txt,{ fontSize: 12, color:'#ffffff' }),
      space:{ left:10,right:10,top:6,bottom:6 },
      background: scene.rexUI.add.roundRectangle(0,0,0,0,6,0x000000, 0.2)
    }).setMinSize(84, 28);// label factory

    const lbl = (t)=> this.scene.add.text(0,0,t,{ fontSize:12, color:'#ffffff' });

    // Cycle button (unchanged behavior)
    const cycle = scene.rexUI.add.label({
      background: scene.rexUI.add.roundRectangle(0,0,0,0,6,0x515151), // slightly brighter
      text: scene.add.text(0,0,'Change Item',{ fontSize:12, color:'#ffffff' })
    }).setInteractive()
    .on('pointerup', () => {
      const i = itemKeys.indexOf(itemKey);
      itemKey = itemKeys[(i+1) % itemKeys.length];
      itemText.setText(itemKey);
      const cap = maxStacks(itemKey) - (currentItem === itemKey ? currentAmt : 0);
      amount = Math.max(1, Math.min(cap, amount));
      amtText.setText(String(amount));
    });

    // NEW: vertical stack → [Item name] on top, [Cycle] under it
    const itemCol = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } })
      .add(itemText, 0, 'center', 0, false)
      .add(cycle,    0, 'center', 0, false);

      // --- action buttons ---
      const startBtn = mkBtn('Start Job', '#ffffff')
        .setInteractive()
        .on('pointerup', () => {
          this.startOvenJob(oven, idx, itemKey, amount);
          this.closeJobEditor();
        });

      const cancelBtn = mkBtn('Close', 0x555555)
        .setInteractive()
        .on('pointerup', () => this.closeJobEditor());

      const existing = this.findJob(oven, idx);
      const endBtn = existing
        ? mkBtn('End Job', 0xcc4444)
            .setInteractive()
            .on('pointerup', () => {
              this.cancelOvenJob(existing);
              this.closeJobEditor();
            })
        : null;

    // main toolbar with buttons
    const toolbar = this.scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 8, right: 8, top: 8, bottom: 8, item: 10 },
    })
      .add(lbl('Item:'), 0, 'center', 0, false)
      .add(itemCol,      0, 'center', 0, false)
      .add(lbl('Qty:'),  0, 'center', 0, false)
      .add(dec,          0, 'center', 0, false)
      .add(amtText,      0, 'center', 0, false)
      .add(inc,          0, 'center', 0, false)
      .add(startBtn,     0, 'center', 0, false);

    if (endBtn) toolbar.add(endBtn, 0, 'center', 0, false);
    toolbar.add(cancelBtn, 0, 'center', 0, false);

    // 🔧 use a simple sizer instead of overlapSizer for the popup
    const popup = this.scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 8, right: 8, top: 8, bottom: 8 }
    })
      .addBackground(tbBg)
      .add(toolbar, { proportion: 1, expand: true });

    this.jobPopup = popup;

    scene.cameras.main.ignore([popup, toolbar]);

    // float & layout
    this.scene.add.existing(popup);
    popup.setDepth(UIDEPTH + 100).layout();
    this.positionJobPopup(popup);

    // click-away blocker (kept below popup)
    this.jobBlocker?.destroy();
    this.jobBlocker = this.scene.add.rectangle(
      0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.001
    )
      .setOrigin(0)
      .setDepth(UIDEPTH+99)
      .setInteractive()
      .on('pointerup', (pointer) => {
        const b = popup.getBounds();
        if (!Phaser.Geom.Rectangle.Contains(b, pointer.x, pointer.y)) this.closeJobEditor();
      });

    // cleanup
    this.closeJobEditor = () => {
      this.jobBlocker?.destroy(); this.jobBlocker = null;
      if (this.jobPopup && this.jobPopup.scene) this.jobPopup.destroy();
      this.jobPopup = null;
    };
  }

  positionJobPopup(popup) {
    const pad = 12;
    // If your bottom bar expanded height differs, adjust this:
    const EXPANDED = 160;

    popup.layout(); // ensure width/height are valid
    const pw = popup.width  || popup.getBounds().width;
    const ph = popup.height || popup.getBounds().height;

    const pointer = this.scene.input.activePointer;

    // X anywhere on screen, clamped to keep popup visible
    let x = Phaser.Math.Clamp(pointer.x, pad + pw / 2, this.scene.scale.width - pad - pw / 2);

    // Y restricted to the bottom bar area (so it doesn't drift off-screen)
    const yTop = this.scene.scale.height - EXPANDED + pad + ph / 2;
    const yBot = this.scene.scale.height - pad - ph / 2;
    let y = Phaser.Math.Clamp(pointer.y, yTop, yBot);

    popup.setPosition(x, y);
  }


  startOvenJob(oven, idx, itemKey, amount) {
    const item = UI_ITEM_TYPES[itemKey];
    if (!item || !item.cooksTo) return;

    // cap to stack size minus existing amount in that slot
    const current = oven.cookingSlots[idx];
    const inSlot = (current && current.item?.name === itemKey) ? current.amount : 0;
    const cap = Math.max(0, (item.stacks||1) - inSlot);
    const target = Math.max(1, Math.min(cap, amount));
    if (target <= 0) return;

    const team = Teams.teamLists[this.team];
    const job = {
      oven, inputidx: idx, item,
      target, delivered: 0, remaining: target,
      assigned: 0, canceled: false,
      x: oven.x, y: oven.y
    };
    team.ovenJobs.push(job);

    // ping UI
    this.scene.events.emit('oven:updated', oven);
  }

  cancelOvenJob(job) {
    const team = Teams.teamLists[this.team];
    job.canceled = true;

    // remove any pending delivery tasks for this job
    const arr = team.ovenDeliveryItems;
    for (let i = arr.length - 1; i >= 0; i--) {
      const t = arr[i];
      if (t.oven === job.oven && t.inputidx === job.inputidx && t.item.name === job.item.name) {
        arr.splice(i, 1);
      }
    }

    // remove job from queue
    const i = team.ovenJobs.indexOf(job);
    if (i !== -1) team.ovenJobs.splice(i,1);

    this.scene.events.emit('oven:updated', job.oven);
  }

  openRefuelEditor(oven) {
    if (!oven) return;
    this.closeJobEditor?.();

    const scene = this.scene;
    const rr = (w,h,r,c)=>scene.rexUI.add.roundRectangle(0,0,w,h,r,c);
    let amount = 5;

    // --- popup container with background panel ---
    const bgPanel = scene.rexUI.add.roundRectangle(
      0, 0, 300, 110, 10, 0x333333, 1 // 🟩 semi-transparent black
    ).setStrokeStyle(2, 0xffffff, 0.2);   // thin white border

    const amtText = scene.add.text(0,0,String(amount),{fontSize:14,color:'#fff'});
    const dec = scene.rexUI.add.label({ text: scene.add.text(0,0,'−',{fontSize:16,color:'#fff'}) })
      .setInteractive().on('pointerup',()=>{amount=Math.max(1,amount-1);amtText.setText(amount);});
    const inc = scene.rexUI.add.label({ text: scene.add.text(0,0,'＋',{fontSize:16,color:'#fff'}) })
      .setInteractive().on('pointerup',()=>{amount=Math.min(99,amount+1);amtText.setText(amount);});

    const startBtn = scene.rexUI.add.label({
      background: rr(0,0,6,0x2a5bd8),
      text: scene.add.text(0,0,'Start Refuel',{fontSize:12,color:'#fff'}),
      space:{left:10,right:10,top:6,bottom:6}
    }).setInteractive().on('pointerup',()=>{
      this.startRefuelJob(oven, amount);
      this.closeJobEditor();
    });

    const cancelBtn = scene.rexUI.add.label({
      background: rr(0,0,6,0x555555,0.5),
      text: scene.add.text(0,0,'Cancel',{fontSize:12,color:'#fff'}),
      space:{left:10,right:10,top:6,bottom:6}
    }).setInteractive().on('pointerup',()=>this.closeJobEditor());

    const toolbar = scene.rexUI.add.sizer({orientation:'x',space:{left:10,right:10,item:8}})
      .add(scene.add.text(0,0,'Fuel:',{fontSize:12,color:'#fff'}))
      .add(dec).add(amtText).add(inc)
      .add(startBtn).add(cancelBtn);

    const popup = scene.rexUI.add.overlapSizer({
      width: 280,
      height: 80,
    })
      .addBackground(bgPanel)
      .add(toolbar, { align: "center", expand: false });

    // center it visually
    scene.add.existing(popup);
    popup.setDepth(10000).layout();
    this.positionJobPopup(popup);

    // 🟡 click-outside blocker (keeps dim overlay behind popup)
    this.jobBlocker?.destroy();
    this.jobBlocker = scene.add.rectangle(
      0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.01// dark overlay
    )
      .setOrigin(0)
      .setDepth(9999)
      .setInteractive()
      .on("pointerup", p => {
        const b = popup.getBounds();
        if (!Phaser.Geom.Rectangle.Contains(b, p.x, p.y)) this.closeJobEditor();
      });

    this.closeJobEditor = () => {
      this.jobBlocker?.destroy();
      this.jobBlocker = null;
      popup.destroy();
      this.jobPopup = null;
    };
  }

  startRefuelJob(oven, amount) {
    const team = Teams.teamLists[this.team];
    const job = {
      oven,
      target: amount,
      delivered: 0,
      remaining: amount,
      assigned: 0,
      canceled: false,
      x: oven.x, y: oven.y
    };
    team.ovenFuelJobs.push(job);
    this.scene.events.emit('oven:updated', oven);
  }

  // ---------- Behavior ----------
  selectOven(oven) {
    this.selected = oven;
    this.detail.setOven(oven);
  }

  centerCameraOnOven(oven) {
    if (!oven?.sprite) return;
    const cam = this.scene.cameras.main;
    cam.centerOn(oven.sprite.x, oven.sprite.y);
  }

  update() {
    const current = this.scene.uiBottomBar?.currentPage;
    if (current !== 'ovens' || !this.selected) return;

    this.detail.setOven(this.selected);
  }
}
