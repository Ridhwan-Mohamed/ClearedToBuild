
// === HousesTab.js ===
import { Teams } from '../../Teams';
import { StaminaManager } from '../../Manager/staminaManager.js';
import { CONTROL_STATES, SQUARESIZE, showAlert } from '../../constants';

export default class HousesTab {
  constructor(scene, teamNumber = 1) {
    this.scene = scene;
    this.team = teamNumber;
    this.selected = null;
    this.rows = new Map(); // house -> { row, bg, hpFill, occText }

    this.root = this.build();

    scene.cameras.main.ignore(this.root);

    // ALSO ignore all children, so sprites like portraits never render in world cam
    const kids = this.root.getAllChildren?.() || this.root.list || [];
    scene.cameras.main.ignore(kids);


    this._tickEvt = scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.tick(),
    });

    scene.cameras.main.ignore(this.root);
  }

  destroy() {
    this._tickEvt?.remove(false);
    this._tickEvt = null;
    this.root?.destroy();
    this.rows.clear();
  }

  get view() { return this.root; }

  // ---------- UI ----------
  build() {
    const scene = this.scene;

    const root = scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 8, right: 8, top: 8, bottom: 8, item: 10 },
    });

    // LEFT (details)
    this.detailCard = this.buildHouseDetailPanel(scene);
    const detailSizer = scene.rexUI.add.sizer({ orientation: 'y' })
      .add(this.detailCard.panel, { proportion: 1, expand: true });

    // RIGHT (list)
    this.listBody = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } });

    this.scroll = scene.rexUI.add.scrollablePanel({
      width: Math.floor(scene.scale.width * (2 / 3)) - 48,
      height: 200,
      scrollMode: 0,
      background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 8, 0x000000, 0.25),
      panel: { child: this.listBody, mask: { padding: 1 } },
      sliderY: scene.rexUI.add.slider({
        height: 160,
        orientation: 'y',
        track: scene.rexUI.add.roundRectangle(0, 0, 10, 0, 5, 0x333333),
        thumb: scene.rexUI.add.roundRectangle(0, 0, 10, 28, 5, 0x888888),
      }),
      space: { left: 4, right: 4, top: 4, bottom: 4, panel: 6 },
    });

    root.add(detailSizer, { proportion: 1, expand: true });
    root.add(this.scroll,  { proportion: 2, expand: true });

    this.rebuildList();
    root.layout();
    return root;
  }

  rr(w, h, r, color, alpha = 1) {
    return this.scene.rexUI.add.roundRectangle(0, 0, w, h, r, color, alpha);
  }

  makeBar(width, height, fillColor) {
    const scene = this.scene;
    const s = scene.rexUI.add.overlapSizer({ width, height });
    const bg = scene.rexUI.add.roundRectangle(0, 0, width, height, 4, 0x222222, 1);
    const fill = scene.rexUI.add.roundRectangle(0, 0, Math.max(1, width - 2), height - 2, 4, fillColor, 1)
      .setOrigin(0, 0.5);

    s.addBackground(bg);
    s.add(fill, { key: 'fill', align: 'left', expand: false, padding: { left: 1, right: 1 } });
    s.layout();

    s.setPercent = (pct) => {
      const p = Phaser.Math.Clamp(pct ?? 0, 0, 1);
      fill.width = Math.max(1, (width - 2) * p);
      s.layout();
    };

    return { sizer: s, fill };
  }

  buildHouseDetailPanel(scene) {
    const rr = (w, h, r, color, alpha = 1) => scene.rexUI.add.roundRectangle(0, 0, w, h, r, color, alpha);

    // House HP bar with centered number (HP cur/max)
    const makeHpBarWithText = (width, height) => {
      const s = scene.rexUI.add.overlapSizer({ width, height });

      const bg = rr(width, height, 5, 0x222222, 1);
      const fill = rr(Math.max(1, width - 2), height - 2, 5, 0x4caf50, 1)
        .setOrigin(0, 0.5);

      const txt = scene.add.text(0, 0, 'HP —/—', {
        fontFamily: 'sans-serif',
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

    const title = scene.add.text(0, 0, 'House', { fontSize: '16px', color: '#EDEDED' });
    const sub = scene.add.text(0, 0, '—', { fontSize: '12px', color: '#B0B0B0' });
    const houseHpBar = makeHpBarWithText(240, 14);

    const occSizer = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 8 } });

    // two occupant slots
    const slot0 = this.buildOccupantSlot(scene, 0);
    const slot1 = this.buildOccupantSlot(scene, 1);
    occSizer.add(slot0.panel, 0, 'left', 0, true);
    occSizer.add(slot1.panel, 0, 'left', 0, true);

    const fixBtn = this.makeButton(scene, '🛠 Fix', () => {
      const b = this.selected; // house
      if (!b) return;

      const maxHp = (b.maxHealth ?? 100);
      const hp    = (b.health ?? b.hp ?? 0);
      if (hp >= maxHp) {showAlert(scene, "Building is Already in condition", '#00ff00'); return}

      const team = Teams.teamLists[this.team];
      if (!team.buildingFixTasks) team.buildingFixTasks = [];

      Teams.addToStateArrayIfNotExists(this.team, "buildingFixTasks", {
        x: b.gridX ?? b.x,
        y: b.gridY ?? b.y,
        type: b.buildType, // house should already carry this
        value: b,
        assigned: 0,
      });
    }, 0x2f7d32, 28);

    const panel = scene.rexUI.add.sizer({
      orientation: 'y',
      space: { left: 10, right: 10, top: 8, bottom: 8, item: 10 },
    });

    const titleCol = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 2 } })
      .add(title, 0, 'left', 0, false)
      .add(sub,   0, 'left', 0, false);

    const headerRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } })
      .add(titleCol, { proportion: 1, expand: true })
      .add(fixBtn,   { proportion: 0, expand: false, align: 'right' });

    const header = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } })
      .add(headerRow,  0, 'left', 0, true)
      .add(houseHpBar, 0, 'left', 0, false);

    panel.add(header, 0, 'left', 0, true);
    panel.add(occSizer, 0, 'left', 0, true);

    return {
      panel,
      setHouse: (house) => {
        if (!house) {
          title.setText('House');
          sub.setText('—');
          houseHpBar.setValue(0, 1);
          slot0.setTroop(null);
          slot1.setTroop(null);
          return;
        }
        const gx = Math.floor((house.x ?? 0) / SQUARESIZE);
        const gy = Math.floor((house.y ?? 0) / SQUARESIZE);
        title.setText('House');
        sub.setText(`(${gx}, ${gy})`);
        houseHpBar.setValue(house.health ?? 0, house.maxHealth ?? 1);

        const occ = house.occupants ?? [];
        slot0.setTroop(occ[0] || null);
        slot1.setTroop(occ[1] || null);
      },
      slots: [slot0, slot1],
    };
  }

  makeButton(scene, labelText, onClick, bgColor = 0x2a5bd8, h = 28) {
    const label = scene.rexUI.add.label({
      background: scene.rexUI.add.roundRectangle(0, 0, 0, h, 10, bgColor),
      text: scene.add.text(0, 0, labelText, { fontFamily: 'sans-serif', fontSize: 13, color: '#ffffff' }),
      space: { left: 10, right: 10, top: 5, bottom: 5 },
    });

    label.setMinSize(92, h);
    label.setInteractive({ useHandCursor: true }).on('pointerup', () => onClick?.());
    return label;
  }

  buildOccupantSlot(scene, idx) {
    const rr = (w, h, r, color, alpha = 1) => scene.rexUI.add.roundRectangle(0, 0, w, h, r, color, alpha);

    const bg = rr(0, 0, 8, 0x000000, 0.20);

    const portrait = scene.add.sprite(0, 0, 'char')
      .setDisplaySize(44, 44)
      .setOrigin(0.5, 0.5);
    portrait.setVisible(false);

    const name = scene.add.text(0, 0, `Slot ${idx + 1}: —`, { fontSize: '13px', color: '#ffffff' });

    const hp = this.makeBar(160, 8, 0x4caf50); // green
    const st = this.makeBar(160, 8, 0x2196f3); // blue

    const bars = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } })
      .add(hp.sizer, 0, 'left', 0, false)
      .add(st.sizer, 0, 'left', 0, false);

    const btn = this.makeButton(scene, 'Sleep', () => {}, 0x2a5bd8);

    const right = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } })
      .add(name, 0, 'left', 0, false)
      .add(bars, 0, 'left', 0, false)
      .add(btn, 0, 'left', 0, false);

    const panel = scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 6, right: 6, top: 6, bottom: 6, item: 8 }, // was 8/8/8/8 item 10
    })
      .addBackground(bg)
      .add(portrait, 0, 'center', 0, false)
      .add(right, { proportion: 1, expand: true });

    const setBtnLabel = (text) => {
      const t = btn.getElement?.('text');
      if (t?.setText) t.setText(text);
    };

    const updateBtn = (troop) => {
      if (!troop || !troop.active) {
        setBtnLabel('—');
        btn.disableInteractive?.();
        btn.setAlpha?.(0.35);
        return;
      }

      btn.setAlpha?.(1);
      btn.setInteractive({ useHandCursor: true });

      const isSleepLike = (troop.state === CONTROL_STATES.SLEEP_MODE || troop.state === CONTROL_STATES.GO_HOME_MODE);
      setBtnLabel(isSleepLike ? 'Awaken' : 'Sleep');

      btn.removeAllListeners?.('pointerup');
      btn.on('pointerup', () => {
        if (troop.state === CONTROL_STATES.SLEEP_MODE) {
          StaminaManager.wakeUp(troop);
        } else {
          StaminaManager.sendTroopHome(troop);
        }
        updateBtn(troop);
      });
    };

    return {
      panel,
      hidePortrait: () => {
        portrait.setVisible(false);
        portrait.setAlpha(0);
      },
      setTroop: (troop) => {
        if (!troop || !troop.active) {
          name.setText(`Slot ${idx + 1}: —`);
          portrait.setVisible(false);
          hp.sizer.setPercent(0);
          st.sizer.setPercent(0);
          updateBtn(null);
          return;
        }

        name.setText(`Slot ${idx + 1}: ${troop.name || 'Unnamed'}`);

        // Use same "closeup" animation keys as PlayerTab
        const portraitKey = (troop.health ?? 0) > 50 ? 'char' : 'charHurt';
        portrait.setVisible(true);
        portrait.setTexture(portraitKey);
        // if animations exist under same key, play them; safe-guard if not
        if (scene.anims?.exists?.(portraitKey)) {
          portrait.play(portraitKey);
        }

        const hpPct = (troop.health ?? 0) / (troop.maxHealth || 100);
        const stPct = (troop.stamina ?? 0) / (troop.maxStamina || 100);
        hp.sizer.setPercent(hpPct);
        st.sizer.setPercent(stPct);

        updateBtn(troop);

        portrait.setVisible(true);
        portrait.setAlpha(1);   // <-- add this
        portrait.setTexture(portraitKey);
      },
    };
  }

  // ---------- DATA / LIST ----------
  getHouseList() {
    return Teams.teamLists?.[this.team]?.houseList || [];
  }

  rebuildList() {
    const scene = this.scene;
    this.listBody.clear(true);
    this.rows.clear();

    const houses = this.getHouseList().slice();

    houses.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    houses.forEach((h, i) => {
      const row = this.createRow(h);
      this.listBody.add(row, { expand: true });
    });

    this.listBody.layout();
    this.scroll.layout();
  }

  createRow(house) {
    const scene = this.scene;

    const tint = 0x777777;
    const bg = scene.rexUI.add.roundRectangle(0, 0, 0, 0, 6, tint, 0.15)
      .setStrokeStyle(2, tint, 1);

    const gx = Math.floor((house.x ?? 0) / SQUARESIZE);
    const gy = Math.floor((house.y ?? 0) / SQUARESIZE);

    const title = scene.add.text(0, 0, `${gx},${gy} - 🏠`, { fontSize: '13px', color: '#ffffff' });

    const occCount = (house.occupants?.filter(Boolean).length) || 0;
    const occText = scene.add.text(0, 0, `Occ: ${occCount}/2`, { fontSize: '12px', color: '#dddddd' });

    // Make the bar span (almost) the full row width
    const fullWidth = Math.floor(scene.scale.width * (2 / 3)) - 72;
    const hpW = Math.max(160, fullWidth - 70); // padding buffer so it doesn't touch edges

    const hp = this.makeBar(hpW, 6, 0x4caf50);
    hp.sizer.setPercent((house.health ?? 0) / (house.maxHealth || 300));

    const right = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 3 } })
      .add(title, 0, 'left', 0, false)
      .add(occText, 0, 'left', 0, false)
      .add(hp.sizer, 0, 'left', 0, false);

    const row = scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 8, right: 8, top: 6, bottom: 6, item: 10 },
    })
      .addBackground(bg)
      .add(right, { proportion: 1, expand: true });

    row.setMinSize(fullWidth, 6);

    row.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.select(house));

    this.rows.set(house, { row, bg, hpFill: hp.sizer, occText });

    return row;
  }

  select(house) {
    this.selected = house;

    for (const [h, data] of this.rows.entries()) {
      const on = (h === house);
      data.bg.setAlpha(on ? 1 : 0.6);
      data.bg.setStrokeStyle(2, on ? 0xffffff : 0x777777, 1);
    }

    this.paintDetails();
  }

  selectFromWorld(house) {
    if (!house) return;
    this.select(house);

    // optional: center camera on the clicked house
    const cam = this.scene.cameras.main;
    const spr = house.sprite;
    if (cam && spr?.getBounds) {
      const b = spr.getBounds();
      cam.centerOn(b.centerX, b.centerY);
    }
  }

  paintDetails() {
    const h = this.selected;
    if (!h) {
      this.detailCard.setHouse(null);
      return;
    }
    this.detailCard.setHouse(h);
  }

  clearDetails() {
    this.selected = null;
    this.detailCard.setHouse(null);
  }

  // Called when page becomes visible
  onShow() {
    const houses = this.getHouseList();
    if (!this.selected || !houses.includes(this.selected)) {
      this.selected = houses[0] || null;
    }
    this.paintDetails();
  }

  hide() {
    this.selected = null;
    this.detailCard?.setHouse?.(null);

    // hard-hide occupant portraits so they never leak on tab switch / startup
    this.detailCard?.slots?.forEach(s => s?.hidePortrait?.());
  }

  tick() {
    const current = this.scene.uiBottomBar?.currentPage;
    if (current !== 'houses') return;

    // list changed?
    const houses = this.getHouseList();
    if (houses.length !== this.listBody.getChildren?.().length) {
      this.rebuildList();
    }

    // refresh rows
    for (const h of houses) {
      const data = this.rows.get(h);
      if (!data) continue;

      const occCount = (h.occupants?.filter(Boolean).length) || 0;
      data.occText.setText(`Occ: ${occCount}/2`);
      data.hpFill.setPercent((h.health ?? 0) / (h.maxHealth || 300));
    }

    // refresh details live
    if (this.selected) this.paintDetails();
  }

  refresh(teamNumber) {
    if (teamNumber !== undefined) this.team = teamNumber;
    this.rebuildList();
    this.onShow();
  }
}