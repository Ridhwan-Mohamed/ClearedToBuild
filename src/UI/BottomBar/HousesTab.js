
// === HousesTab.js ===
import Phaser from "phaser";
import { Teams } from '../../Teams';
import { StaminaManager } from '../../Manager/staminaManager.js';
import { CONTROL_STATES, SQUARESIZE, TILE_TYPES, showAlert } from '../../constants';
import { buildingManager } from '../../Manager/buildingManager.js';
import { AudioManager } from '../../Manager/AudioManager.js';
import {
  applyPortraitKeyToSprite,
  DEFAULT_PLAYER_PORTRAIT_KEY,
  getPlayerPortraitKey,
} from '../../players/playerPortraits.js';
import {
  BOTTOM_BAR_THEME,
  makeGlassRoundRect,
  mixColor,
  setHoverLiftState,
} from "./BottomBarTheme";

const TAB_BASE_DEPTH = 51;
const TAB_BG_DEPTH = 0;
const TAB_CONTENT_DEPTH = 1;

export default class HousesTab {
  constructor(scene, teamNumber = 1) {
    this.scene = scene;
    this.team = teamNumber;
    this.selected = null;
    this.rows = new Map(); // house -> { row, bg, hpFill, occText }
    this._onWheel = null;
    this._rowBaseY = new WeakMap();

    this.root = this.build();
    this.bindScrollInput();

    this._tickEvt = scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.tick(),
    });
  }

  destroy() {
    this._tickEvt?.remove(false);
    this._tickEvt = null;
    if (this._onWheel) {
      this.scene.input.off('wheel', this._onWheel);
      this._onWheel = null;
    }
    this.root?.destroy();
    this.rows.clear();
  }

  get view() { return this.root; }

  // ---------- UI ----------
  build() {
    const scene = this.scene;
    const compact = scene.scale.width < 1180;
    const detailWidth = Math.max(228, Math.floor(scene.scale.width / 3) - (compact ? 36 : 42));
    const detailHeight = compact ? 112 : 118;

    const root = scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 8, right: 8, top: compact ? 6 : 8, bottom: compact ? 6 : 8, item: compact ? 8 : 10 },
    }).setDepth(TAB_BASE_DEPTH);

    // LEFT (details)
    this.detailCard = this.buildHouseDetailPanel(scene);
    this.detailScroll = scene.rexUI.add.scrollablePanel({
      width: detailWidth,
      height: detailHeight,
      scrollMode: 0,
      scrollDetectionMode: 'rectBounds',
      background: makeGlassRoundRect(scene, 0, 0, 16, {
        fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.08),
        alpha: 0.74,
        stroke: 0x98e7ff,
        strokeAlpha: 0.12,
      }),
      panel: { child: this.detailCard.panel, mask: { padding: 1 } },
      space: { left: 4, right: 4, top: 4, bottom: 4, panel: 6 },
    }).setDepth(TAB_BASE_DEPTH);
    const detailSizer = scene.rexUI.add.sizer({ orientation: 'y' })
      .add(this.detailScroll, { proportion: 1, expand: true })
      .setDepth(TAB_BASE_DEPTH);

    // RIGHT (list)
    this.listBody = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } });

    this.scroll = scene.rexUI.add.scrollablePanel({
      width: Math.floor(scene.scale.width * (2 / 3)) - 48,
      height: detailHeight,
      scrollMode: 0,
      scrollDetectionMode: 'rectBounds',
      background: makeGlassRoundRect(scene, 0, 0, 16, {
        fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.08),
        alpha: 0.74,
        stroke: 0x98e7ff,
        strokeAlpha: 0.12,
      }),
      panel: { child: this.listBody, mask: { padding: 1 } },
      sliderY: scene.rexUI.add.slider({
        height: Math.max(72, detailHeight - 24),
        orientation: 'y',
        track: makeGlassRoundRect(scene, 10, 0, 5, {
          fill: 0x0b2230,
          alpha: 0.82,
          stroke: 0x98e7ff,
          strokeAlpha: 0.08,
          strokeWidth: 1,
        }),
        thumb: makeGlassRoundRect(scene, 10, 28, 5, {
          fill: 0x72d8ff,
          alpha: 0.86,
          stroke: 0xffffff,
          strokeAlpha: 0.18,
          strokeWidth: 1,
        }),
      }),
      scrollerY: {
        pointerOutRelease: true,
        rectBoundsInteractive: true,
      },
      space: { left: 4, right: 4, top: 4, bottom: 4, panel: 6 },
    }).setDepth(TAB_BASE_DEPTH);

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
    const bg = makeGlassRoundRect(scene, width, height, 4, {
      fill: 0x08121a,
      alpha: 0.92,
      stroke: 0x98e7ff,
      strokeAlpha: 0.06,
      strokeWidth: 1,
    }).setDepth(TAB_BG_DEPTH);
    const fill = scene.rexUI.add.roundRectangle(0, 0, Math.max(1, width - 2), height - 2, 4, fillColor, 1)
      .setOrigin(0, 0.5)
      .setDepth(TAB_CONTENT_DEPTH);

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
    const compact = scene.scale.width < 1180;
    const detailWidth = Math.max(228, Math.floor(scene.scale.width / 3) - (compact ? 36 : 42));
    const slotGap = compact ? 6 : 8;
    const slotWidth = Math.max(102, Math.floor((detailWidth - slotGap) / 2) - 6);

    // House HP bar with centered number (HP cur/max)
    const makeHpBarWithText = (width, height) => {
      const s = scene.rexUI.add.overlapSizer({ width, height });

      const bg = makeGlassRoundRect(scene, width, height, 5, {
        fill: 0x08121a,
        alpha: 0.92,
        stroke: 0x98e7ff,
        strokeAlpha: 0.06,
        strokeWidth: 1,
      }).setDepth(TAB_BG_DEPTH);
      const fill = rr(Math.max(1, width - 2), height - 2, 5, 0x4caf50, 1)
        .setOrigin(0, 0.5)
        .setDepth(TAB_CONTENT_DEPTH);

      const txt = scene.add.text(0, 0, 'HP —/—', {
        fontFamily: 'Bungee',
        fontSize: 12,
        color: BOTTOM_BAR_THEME.text,
        stroke: '#081621',
        strokeThickness: 2,
      }).setOrigin(0.5, 0.5).setDepth(TAB_CONTENT_DEPTH);

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

    const title = scene.add.text(0, 0, 'House', { fontFamily: 'Bungee', fontSize: compact ? '14px' : '15px', color: BOTTOM_BAR_THEME.text, stroke: '#081621', strokeThickness: 2 });
    const sub = scene.add.text(0, 0, '—', { fontFamily: 'Bungee', fontSize: '11px', color: BOTTOM_BAR_THEME.textMuted, stroke: '#081621', strokeThickness: 2 });
    const houseHpBar = makeHpBarWithText(Math.max(188, detailWidth - 20), compact ? 13 : 14);

    const occSizer = scene.rexUI.add.sizer({ orientation: 'x', space: { item: slotGap } });

    // two occupant slots
    const slot0 = this.buildOccupantSlot(scene, 0, slotWidth);
    const slot1 = this.buildOccupantSlot(scene, 1, slotWidth);
    occSizer.add(slot0.panel, { proportion: 1, expand: true, align: 'top' });
    occSizer.add(slot1.panel, { proportion: 1, expand: true, align: 'top' });

    const fixBtn = this.makeButton(scene, '🛠 Fix', () => {
      const b = this.selected; // house
      if (!b) return;
      buildingManager.requestBuildingFix(b, this.team, []);
    }, 0x2f7d32, compact ? 24 : 26);

    const panelBg = makeGlassRoundRect(scene, 0, 0, 18, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.06),
      alpha: 0.82,
      stroke: 0xa6e9ff,
      strokeAlpha: 0.16,
    }).setDepth(TAB_BG_DEPTH);
    const panel = scene.rexUI.add.sizer({
      orientation: 'y',
      space: { left: compact ? 8 : 10, right: compact ? 8 : 10, top: compact ? 6 : 8, bottom: compact ? 6 : 8, item: compact ? 6 : 8 },
    });
    panel.setMinSize(detailWidth, 0);

    const titleCol = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 2 } })
      .add(title, 0, 'left', 0, false)
      .add(sub,   0, 'left', 0, false);

    const headerRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } })
      .add(titleCol, { proportion: 1, expand: true })
      .add(fixBtn,   { proportion: 0, expand: false, align: 'right' });

    const header = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } })
      .add(headerRow,  0, 'left', 0, true)
      .add(houseHpBar, 0, 'left', 0, true)
      .setDepth(TAB_CONTENT_DEPTH);
    occSizer.setDepth(TAB_CONTENT_DEPTH);

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
    const compact = h <= 24;
    const label = scene.rexUI.add.label({
      background: makeGlassRoundRect(scene, 0, h, 10, {
        fill: mixColor(BOTTOM_BAR_THEME.panelFill, bgColor, 0.24),
        alpha: 0.9,
        stroke: bgColor,
        strokeAlpha: 0.22,
        strokeWidth: 1.5,
      }),
      text: scene.add.text(0, 0, labelText, { fontFamily: 'Bungee', fontSize: compact ? 11 : 12, color: '#ffffff', stroke: '#081621', strokeThickness: 2 }),
      space: { left: compact ? 8 : 10, right: compact ? 8 : 10, top: compact ? 4 : 5, bottom: compact ? 4 : 5 },
    });

    label.setMinSize(compact ? 80 : 88, h);
    label.setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        AudioManager.playBottomBarClick();
        onClick?.();
      })
      .on('pointerover', () => {
        label.__baseY ??= label.y;
        setHoverLiftState(scene, label, true, { baseY: label.__baseY, hoverLift: 3, hoverScale: 1.03 });
      })
      .on('pointerout', () => {
        label.__baseY ??= label.y;
        setHoverLiftState(scene, label, false, { baseY: label.__baseY, hoverLift: 3, hoverScale: 1.03 });
      });
    return label;
  }

  buildOccupantSlot(scene, idx, slotWidth = 120) {
    const compact = scene.scale.width < 1180 || slotWidth < 126;
    const innerWidth = Math.max(92, slotWidth - (compact ? 10 : 12));
    const portraitSize = compact ? 28 : 32;
    const barWidth = Math.max(78, innerWidth - 4);

    const bg = makeGlassRoundRect(scene, 0, 0, 12, {
      fill: mixColor(BOTTOM_BAR_THEME.panelSoftFill, 0xffffff, 0.04),
      alpha: 0.82,
      stroke: 0xffffff,
      strokeAlpha: 0.08,
      strokeWidth: 1,
    }).setDepth(TAB_BG_DEPTH);

    const portrait = scene.add.sprite(0, 0, DEFAULT_PLAYER_PORTRAIT_KEY)
      .setDisplaySize(portraitSize, portraitSize)
      .setOrigin(0.5, 0.5);
    portrait.setVisible(false);

    const name = scene.add.text(0, 0, `Slot ${idx + 1}: —`, {
      fontFamily: 'Bungee',
      fontSize: compact ? '9px' : '10px',
      color: BOTTOM_BAR_THEME.text,
      stroke: '#081621',
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: innerWidth }
    }).setOrigin(0.5, 0);

    const hp = this.makeBar(barWidth, 6, 0x4caf50);
    const st = this.makeBar(barWidth, 6, 0x2196f3);

    const bars = scene.rexUI.add.sizer({ orientation: 'y', space: { item: compact ? 3 : 4 } })
      .add(hp.sizer, 0, 'center', 0, false)
      .add(st.sizer, 0, 'center', 0, false);

    const btn = this.makeButton(scene, 'Sleep', () => {}, 0x2a5bd8, compact ? 22 : 24);
    btn.setMinSize(innerWidth, compact ? 22 : 24);

    const content = scene.rexUI.add.sizer({ orientation: 'y', space: { item: compact ? 4 : 5 } })
      .add(portrait, 0, 'center', 0, false)
      .add(name, 0, 'center', 0, true)
      .add(bars, 0, 'center', 0, false)
      .add(btn, 0, 'center', 0, true)
      .setDepth(TAB_CONTENT_DEPTH);
    portrait.setDepth(TAB_CONTENT_DEPTH);

    const panel = scene.rexUI.add.sizer({
      orientation: 'y',
      space: { left: compact ? 5 : 6, right: compact ? 5 : 6, top: compact ? 5 : 6, bottom: compact ? 5 : 6, item: compact ? 4 : 5 },
    })
      .addBackground(bg)
      .add(content, { proportion: 1, expand: true, align: 'center' })
      .setDepth(TAB_BASE_DEPTH);
    panel.setMinSize(slotWidth, 0);

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
        portrait.anims?.stop?.();
      },
      setTroop: (troop) => {
        if (!troop || !troop.active) {
          name.setText(`Slot ${idx + 1}: —`);
          portrait.setVisible(false);
          portrait.anims?.stop?.();
          hp.sizer.setPercent(0);
          st.sizer.setPercent(0);
          updateBtn(null);
          return;
        }

        name.setText(`Slot ${idx + 1}: ${troop.name || 'Unnamed'}`);

        const portraitKey = getPlayerPortraitKey(troop);
        applyPortraitKeyToSprite(scene, portrait, portraitKey, portraitSize);

        const hpPct = (troop.health ?? 0) / (troop.maxHealth || 100);
        const stPct = (troop.stamina ?? 0) / (troop.maxStamina || 100);
        hp.sizer.setPercent(hpPct);
        st.sizer.setPercent(stPct);

        updateBtn(troop);

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

  bindScrollInput() {
    if (this._onWheel) return;

    this._onWheel = (pointer, _gameObjects, dx, dy) => {
      if (this.scene.uiBottomBar?.currentPage !== 'houses') return;
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

  createRow(house) {
    const scene = this.scene;

    const tint = 0xa5d8ff;
    const bg = makeGlassRoundRect(scene, 0, 0, 14, {
      fill: mixColor(BOTTOM_BAR_THEME.cardFill, tint, 0.08),
      alpha: 0.88,
      stroke: tint,
      strokeAlpha: 0.12,
      strokeWidth: 1.5,
    }).setDepth(TAB_BG_DEPTH);

    const gx = Math.floor((house.x ?? 0) / SQUARESIZE);
    const gy = Math.floor((house.y ?? 0) / SQUARESIZE);

    const title = scene.add.text(0, 0, `${gx},${gy} - House`, { fontFamily: 'Bungee', fontSize: '12px', color: BOTTOM_BAR_THEME.text, stroke: '#081621', strokeThickness: 2 });

    const occCount = (house.occupants?.filter(Boolean).length) || 0;
    const occText = scene.add.text(0, 0, `Occ: ${occCount}/2`, { fontFamily: 'Bungee', fontSize: '10px', color: BOTTOM_BAR_THEME.textMuted, stroke: '#081621', strokeThickness: 2 });

    // Make the bar span (almost) the full row width
    const fullWidth = Math.floor(scene.scale.width * (2 / 3)) - 72;
    const hpW = Math.max(160, fullWidth - 70); // padding buffer so it doesn't touch edges

    const hp = this.makeBar(hpW, 6, 0x4caf50);
    hp.sizer.setPercent((house.health ?? 0) / (house.maxHealth || 300));

    const right = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 3 } })
      .add(title, 0, 'left', 0, false)
      .add(occText, 0, 'left', 0, false)
      .add(hp.sizer, 0, 'left', 0, false)
      .setDepth(TAB_CONTENT_DEPTH);

    const row = scene.rexUI.add.sizer({
      orientation: 'x',
      space: { left: 8, right: 8, top: 6, bottom: 6, item: 10 },
    })
      .addBackground(bg)
      .add(right, { proportion: 1, expand: true })
      .setDepth(TAB_BASE_DEPTH);

    row.setMinSize(fullWidth, 6);

    row.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.select(house))
      .on('pointerover', () => {
        const data = this.rows.get(house);
        if (!data) return;
        data.hovered = true;
        this.updateRowVisual(house);
      })
      .on('pointerout', () => {
        const data = this.rows.get(house);
        if (!data) return;
        data.hovered = false;
        this.updateRowVisual(house);
      });

    this._rowBaseY.set(row, row.y);
    this.rows.set(house, { row, bg, hpFill: hp.sizer, occText, title, hovered: false });
    this.updateRowVisual(house);

    return row;
  }

  select(house) {
    this.selected = house;
    for (const h of this.rows.keys()) this.updateRowVisual(h);

    this.paintDetails();
  }

  updateRowVisual(house) {
    const data = this.rows.get(house);
    if (!data) return;
    const selected = this.selected === house;
    const hovered = !!data.hovered;
    const accent = selected ? 0xffd9a3 : 0xa5d8ff;
    data.bg.setFillStyle(
      mixColor(BOTTOM_BAR_THEME.cardFill, accent, selected ? 0.16 : hovered ? 0.12 : 0.08),
      selected ? 0.94 : hovered ? 0.9 : 0.88
    );
    data.bg.setStrokeStyle(selected ? 2.5 : hovered ? 2 : 1.5, accent, selected ? 0.34 : hovered ? 0.22 : 0.12);
    data.title?.setColor(selected ? "#fff8eb" : BOTTOM_BAR_THEME.text);
    data.occText?.setColor(selected ? "#ffe4b2" : BOTTOM_BAR_THEME.textMuted);
    setHoverLiftState(this.scene, data.row, selected || hovered, {
      baseY: this._rowBaseY.get(data.row) ?? data.row.y,
      hoverLift: 0,
      hoverScale: selected ? 1.012 : 1.008,
      moveY: false,
    });
  }

  selectFromWorld(house) {
    if (!house) return;
    this.select(house);

    // optional: center camera on the clicked house
    const cam = this.scene.worldScene?.cameras?.main || this.scene.cameras.main;
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
