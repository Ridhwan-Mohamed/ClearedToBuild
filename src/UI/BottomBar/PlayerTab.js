import Phaser from "phaser";
import { House } from "../../buildings/House.js";
import { showAlert, CONTROL_STATES } from "../../constants";
import { StaminaManager } from "../../Manager/staminaManager.js";
import { AudioManager } from "../../Manager/AudioManager.js";
import { Player } from "../../players/Player";
import {
    applyPortraitKeyToSprite,
    DEFAULT_PLAYER_PORTRAIT_KEY,
    getPlayerPortraitKey,
} from "../../players/playerPortraits.js";
import { Teams } from "../../Teams.js";
import {
    BOTTOM_BAR_THEME,
    makeGlassRoundRect,
    mixColor,
    setHoverLiftState,
} from "./BottomBarTheme";

const TAB_BASE_DEPTH = 51;
const TAB_BG_DEPTH = 0;
const TAB_CONTENT_DEPTH = 1;


export default class PlayerTab {
  constructor(scene) {
    this.scene = scene;
    this.selected = null;
        this.rows = new Map(); // sprite.id -> { row, hpBar, stBar, nameText, bg }
        this.refreshEvt = null;
        this._onWheel = null;
        this._rowBaseY = new WeakMap();
        this.BAR_SEG_UNIT = 25;
        this.BAR_SEG_GAP  = 1;

    // ---- config ----
    this.W = Math.floor(scene.scale.width - 40); // will be constrained by bottom bar
    this.H = 130; // the bar will decide height; content is responsive
    this.RIGHT_W = 300; // list (right)
    this.ROW_H = 34;

    // price by type
    this.SELL_PRICE = {
      Farmer: 50,
      Forager: 45,
      Fireman: 55,
      Builder: 70,
      Gunslinger: 120,
      Default: 30,
    };

    // build UI
    this.root = this.build();
    this.bindScrollInput();
    // timed refresh (bars & list churn)
    this.refreshEvt = scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.tick(),
    });

  }

    destroy() {
        this.refreshEvt?.remove(false);
        this.refreshEvt = null;
        if (this._onWheel) {
            this.scene.input.off('wheel', this._onWheel);
            this._onWheel = null;
        }
        this.root?.destroy();
        this.rows.clear();
    }

    build() {
        const scene = this.scene;
        const detailWidth = Math.max(260, Math.floor(scene.scale.width / 3) - 40);
        const detailHeight = 180;

        const root = scene.rexUI.add.sizer({
            orientation: 'x',
            space: { left: 8, right: 8, top: 8, bottom: 8, item: 10 },
        }).setDepth(TAB_BASE_DEPTH);

        // build the detail panel first
        this.detailCard = this.buildUnitInfoPanel(scene);
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

        // LEFT (details) — 1/3
        this.detailSizer = scene.rexUI.add.sizer({ orientation: 'y' })
            .add(this.detailScroll, { proportion: 1, expand: true })
            .setDepth(TAB_BASE_DEPTH);

        // RIGHT (list) — 2/3
        this.listBody = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } });
        this.scroll = scene.rexUI.add.scrollablePanel({
            width: this.RIGHT_W,
            height: 180,
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
            height: 160,
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

        // 🔒 proportions fixed here
        root.add(this.detailSizer, { proportion: 1, expand: true });
        root.add(this.scroll,      { proportion: 2, expand: true });

        this.rebuildList();
        root.layout();
        return root;
    }

    // Build the unit info panel inside your bottom bar.
    // Call: const card = buildUnitInfoPanel(scene, ui, assets);
    // Then ui.add(card.panel, 0, 'top-left', { left: 12, top: 8 }, true).layout();
    buildUnitInfoPanel(scene, ui = this, {
        portraitKey = null,              // texture key for the portrait (optional)
        name = '—',
        type = '—',
        team = '—',
        weapon = '—',
        hpPct = 1.0,                     // 0..1
        stPct = 1.0,                     // 0..1
        seedPrice = 70,
        sleepPrice = null                // set a number to show, or null to hide
    } = {}) {
        const compact = scene.scale.width < 1180;

        const BAR_W = compact ? 232 : 244;
        const BAR_H = compact ? 12 : 13;
        const BUTTON_H = compact ? 30 : 32;

        // ---------- helpers ----------
        const rr = (w, h, r, color, alpha = 1) =>
            scene.rexUI.add.roundRectangle(0, 0, w, h, r, color, alpha);

        const makeSegmentedBar = (width, height, fillColor) => {
        const bg = makeGlassRoundRect(scene, width, height, 4, {
            fill: 0x08121a,
            alpha: 0.92,
            stroke: 0x98e7ff,
            strokeAlpha: 0.06,
            strokeWidth: 1,
        });
        const g  = scene.add.graphics();
        const c  = scene.add.container(0, 0, [bg, g]);
        c.setSize(width, height);

        const innerPad = 3;
        const innerW = width - innerPad * 2;
        const innerH = height - innerPad * 2;
        const segUnit = ui.BAR_SEG_UNIT;
        const gap = ui.BAR_SEG_GAP;

        c.setValues = (cur, max) => {
            const safeMax = Math.max(0, max ?? 0);
            const safeCur = Math.max(0, Math.min(cur ?? 0, safeMax || (cur ?? 0)));
            const segCount = Math.max(1, Math.ceil((safeMax || segUnit) / segUnit));
            const lastFrac = (safeMax % segUnit) === 0 ? 1 : (safeMax % segUnit) / segUnit;

            const totalGap = (segCount - 1) * gap;
            const baseSegW = Math.max(1, (innerW - totalGap) / segCount);

            g.clear();
            const x0 = -width / 2 + innerPad;
            const y0 = -height / 2 + innerPad;

            g.fillStyle(0x222222, 1);
            for (let i = 0; i < segCount; i++) {
            const isLast = (i === segCount - 1);
            const w = baseSegW * (isLast ? lastFrac : 1);
            const x = x0 + i * (baseSegW + gap);
            g.fillRect(x, y0, w, innerH);
            }

            const filledSegs = (safeCur / segUnit);
            g.fillStyle(fillColor, 1);
            for (let i = 0; i < segCount; i++) {
            const isLast = (i === segCount - 1);
            const w = baseSegW * (isLast ? lastFrac : 1);
            const x = x0 + i * (baseSegW + gap);
            const r = Phaser.Math.Clamp(filledSegs - i, 0, 1);
            if (r <= 0) continue;
            g.fillRect(x, y0, w * r, innerH);
            }
        };

        c.setValues(0, segUnit);
        return c;
        };

        // Detail panel rows now:
        const hpBar = makeSegmentedBar(BAR_W, BAR_H, 0xFF5A70);
        const hpVal = scene.add.text(0, 0, '0/0', { fontFamily: 'Bungee', fontSize: compact ? 10 : 11, color: BOTTOM_BAR_THEME.text, stroke: '#081621', strokeThickness: 2 });

        const stBar = makeSegmentedBar(BAR_W, BAR_H, 0x69D6FF);
        const stVal = scene.add.text(0, 0, '0/0', { fontFamily: 'Bungee', fontSize: compact ? 10 : 11, color: BOTTOM_BAR_THEME.text, stroke: '#081621', strokeThickness: 2 });

        function makeButton(labelText, onClick) {
            const label = scene.rexUI.add.label({
                background: makeGlassRoundRect(scene, 0, BUTTON_H, 10, {
                    fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0x7acfff, 0.2),
                    alpha: 0.9,
                    stroke: 0x7acfff,
                    strokeAlpha: 0.2,
                    strokeWidth: 1.5,
                }),
                text: scene.add.text(0, 0, labelText, {
                    fontFamily: 'Bungee',
                    fontSize: compact ? 12 : 13,
                    color: '#ffffff',
                    stroke: '#081621',
                    strokeThickness: 2,
                }),
                space: { left: compact ? 12 : 14, right: compact ? 12 : 14, top: compact ? 6 : 7, bottom: compact ? 6 : 7 }
            });
            label.setMinSize(compact ? 74 : 80, BUTTON_H);

            label
                .setInteractive({ useHandCursor: true })
                .on('pointerup', () => {
                    AudioManager.playBottomBarClick();
                    onClick?.();
                })
                .on('pointerover', () => {
                    label.__baseY ??= label.y;
                    setHoverLiftState(scene, label, true, { baseY: label.__baseY, hoverLift: 3, hoverScale: 1.03 });
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('pointer');
                    }
                })
                .on('pointerout', () => {
                    label.__baseY ??= label.y;
                    setHoverLiftState(scene, label, false, { baseY: label.__baseY, hoverLift: 3, hoverScale: 1.03 });
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('default');
                    }
                });

            return label;
        }

        function makeSellButton(onClick) {
            const label = scene.rexUI.add.label({
                background: makeGlassRoundRect(scene, 0, BUTTON_H, 10, {
                    fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffd07d, 0.2),
                    alpha: 0.92,
                    stroke: 0xffd07d,
                    strokeAlpha: 0.2,
                    strokeWidth: 1.5,
                }),
                text: scene.add.text(0, 0, 'Sell', {
                    fontFamily: 'Bungee',
                    fontSize: compact ? 12 : 13,
                    color: '#fff8e5',
                    stroke: '#5a2c00',
                    strokeThickness: 2,
                }),
                space: { left: compact ? 12 : 14, right: compact ? 12 : 14, top: compact ? 6 : 7, bottom: compact ? 6 : 7 }
            });
            label.setMinSize(compact ? 74 : 80, BUTTON_H);

            label
                .setInteractive({ useHandCursor: true })
                .on('pointerup', () => {
                    AudioManager.playBottomBarClick();
                    onClick?.();
                })
                .on('pointerover', () => {
                    label.__baseY ??= label.y;
                    setHoverLiftState(scene, label, true, { baseY: label.__baseY, hoverLift: 3, hoverScale: 1.03 });
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('pointer');
                    }
                })
                .on('pointerout', () => {
                    label.__baseY ??= label.y;
                    setHoverLiftState(scene, label, false, { baseY: label.__baseY, hoverLift: 3, hoverScale: 1.03 });
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('default');
                    }
                });

            return label;
        }

        // ---------- header row: portrait + details ----------
        const header = scene.rexUI.add.sizer({ orientation: 'x', space: { item: compact ? 10 : 12 } });

        const portrait = scene.add.sprite(0, 0, DEFAULT_PLAYER_PORTRAIT_KEY)
            .setDisplaySize(compact ? 42 : 44, compact ? 42 : 44)
            .setOrigin(0.5, 0.5);
        portrait.setVisible(false); // start hidden
        this.portrait = portrait;

        const detailsText = scene.add.text(
            0, 0,
            `Name: ${name}\nType: ${type}\nTeam: ${team}\nWeapon: ${weapon}`,
            { fontFamily: 'Bungee', fontSize: compact ? 13 : 14, color: BOTTOM_BAR_THEME.text, stroke: '#081621', strokeThickness: 2 }
        );

        header.add(portrait,    0, 'center', 0, false);
        header.add(detailsText, 0, 'left',   0, true);

        // ---------- bars column ----------
        const barsCol = scene.rexUI.add.sizer({ orientation: 'y', space: { item: compact ? 5 : 6 } });

        const hpRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: compact ? 6 : 8 } });
        hpRow.add(
            scene.add.text(0, 0, 'HP', { fontFamily: 'Bungee', fontSize: compact ? 10 : 11, color: BOTTOM_BAR_THEME.textMuted, stroke: '#081621', strokeThickness: 2 }),
            0, 'center', { right: 4 }, false
        );
        hpRow.add(hpBar, 0, 'center', 0, false);
        hpRow.add(hpVal, 0, 'center', 0, false);

        const stRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: compact ? 6 : 8 } });
        stRow.add(
            scene.add.text(0, 0, 'ST', { fontFamily: 'Bungee', fontSize: compact ? 10 : 11, color: BOTTOM_BAR_THEME.textMuted, stroke: '#081621', strokeThickness: 2 }),
            0, 'center', { right: 4 }, false
        );
        stRow.add(stBar, 0, 'center', 0, false);
        stRow.add(stVal, 0, 'center', 0, false);

        barsCol.add(hpRow, 0, 'left', 0, false);
        barsCol.add(stRow, 0, 'left', 0, false);

        // ---------- buttons row ----------
        const buttonsRow = scene.rexUI.add.sizer({
            orientation: 'x',
            space: { item: 16 }
        });

        // make the row as wide as the HP/ST bars so alignment is predictable
        buttonsRow.setMinSize(BAR_W, BUTTON_H + 8);

        const sellBtn   = makeSellButton(() => ui.sellSelected());
        const sleepBtn  = makeButton('Sleep', () => ui.sendSelectedToSleep())
        const guardBtn  = makeButton('Guard',  () => ui.startGuardPlacementForSelected?.());

        // layout helper: rebuild row so things always pack from the left
        function updateButtonsLayout({ isFriendly, isCombatant }) {
            // remove all children from the row, but keep them alive
            buttonsRow.clear(false);

            // hard reset visibility so dropped buttons don't float on screen
            sellBtn.setVisible(false);
            sleepBtn.setVisible(false);
            guardBtn.setVisible(false);

            if (isFriendly) {
                sellBtn.setVisible(true);
                buttonsRow.add(sellBtn,  0, 'top', 0, false);

                sleepBtn.setVisible(true);
                buttonsRow.add(sleepBtn, 0, 'top', 0, false);

                if (isCombatant) {
                    guardBtn.setVisible(true);
                    buttonsRow.add(guardBtn, 0, 'top', 0, false);
                }
            }

            buttonsRow.layout();
        }

        // start with nothing shown (no unit selected yet)
        updateButtonsLayout({ isFriendly: false, isCombatant: false });

        // ---------- root panel stack ----------
        const panelBg = makeGlassRoundRect(scene, 0, 0, 18, {
            fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.06),
            alpha: 0.82,
            stroke: 0xa6e9ff,
            strokeAlpha: 0.16,
        }).setDepth(TAB_BG_DEPTH);
        const panel = scene.rexUI.add.sizer({
            orientation: 'y',
            space: { left: compact ? 7 : 8, right: compact ? 7 : 8, top: compact ? 5 : 6, bottom: compact ? 5 : 6, item: compact ? 6 : 8 }
        });
        header.setDepth(TAB_CONTENT_DEPTH);
        barsCol.setDepth(TAB_CONTENT_DEPTH);

        panel.add(header,     0, 'left', 0, true);
        panel.add(barsCol,    0, 'left', 0, true);

        // ---------- return with setters ----------
        return {
            panel,
            portrait, 
            setHPValues(cur, max) {
                hpBar.setValues(cur ?? 0, max ?? 0);
                hpVal.setText(`${cur ?? 0}/${max ?? 0}`);
            },
            setSTValues(cur, max) {
                stBar.setValues(cur ?? 0, max ?? 0);
                stVal.setText(`${Math.round(cur ?? 0)}/${Math.round(max ?? 0)}`);
            },
            // (optional) keep these if you still use pct anywhere
            setHP(pct) { hpBar.setValues((pct ?? 0) * ui.BAR_SEG_UNIT, ui.BAR_SEG_UNIT); },
            setST(pct) { stBar.setValues((pct ?? 0) * ui.BAR_SEG_UNIT, ui.BAR_SEG_UNIT); },
            setUnit(u) {
                detailsText.setText(
                    `Name: ${u.name}\nType: ${u.type}\nTeam: ${u.team}\nWeapon: ${u.weapon}`
                );
                applyPortraitKeyToSprite(scene, portrait, u.portraitKey, compact ? 42 : 44);
            },
            setPrices() {},
            setSleepButton() {},
            setButtonsLayout() {},
        };
    }

    sendSelectedToSleep() {
        const s = this.selected;
        if (!s || !s.active) return;

        const ok = StaminaManager.sendTroopHome(s);

        if (ok) {
            showAlert?.(this.scene, `${s.name} went to sleep in a house.`, '#33aaff', 1800);
            this.clearDetails();
            this.rebuildList();
        } else {
            showAlert?.(this.scene, `No available house for ${s.name}.`, '#ff4444', 1800);
        }
    }

    startGuardPlacementForSelected() {
        const s = this.selected;
        if (!s || !s.active) return;

        // Put the scene into "guard placement" mode
        this.scene.guardPlacement = {
            active: true,
            troop: s
        };

        // Change mouse cursor to a "hand" / grab style to indicate mode
        this.scene.input.setDefaultCursor('grab');

        showAlert?.(
            this.scene,
            `Guard mode: click on the map to station ${s.name}.`,
            '#33aaff',
            2000
        );
    }

    wakeOrCancelSelected() {
        const s = this.selected;
        if (!s || !s.active) return;

        const state = s.state;

        // If already sleeping in a house → wake up early
        if (state === CONTROL_STATES.SLEEP_MODE) {
            StaminaManager.wakeUp(s);
            showAlert?.(this.scene, `${s.name} woke up.`, '#33ff77', 1800);
        }
        // If walking home to sleep → cancel that trip
        else if (state === CONTROL_STATES.GO_HOME_MODE) {
            s.task = null;
            if (s.currentPath) s.currentPath.length = 0;
            if (s.body?.setVelocity) s.body.setVelocity(0, 0);
            Teams.movePlayerState(s, CONTROL_STATES.TRACK_MODE);
            showAlert?.(this.scene, `${s.name} will stay awake.`, '#33ff77', 1800);
        }

        // Refresh detail panel to update button text/state
        this.paintDetails(s);
    }

    attackSelectedTarget() {
        const target = this.selected;
        if (!target || !target.active) return;

        if (!target.body || target.body.team !== 0) {
            showAlert?.(
                this.scene,
                'Attack is only for enemy units.',
                '#ffcc00',
                1500
            );
            return;
        }

        Player.assignFighterToTarget(target);
        showAlert?.(
            this.scene,
            `Sending a fighter to attack ${target.name || 'enemy'}.`,
            '#ff9933',
            1800
        );
    }

    attackSelectedTarget() {
        const target = this.selected;
        if (!target || !target.active) return;

        // Only attack enemies (team 0)
        if (!target.body || target.body.team !== 0) {
            showAlert?.(this.scene, 'Attack is only for enemy units.', '#ffcc00', 1500);
            return;
        }

        Player.assignFighterToTarget(target);
        showAlert?.(this.scene, `Sending a fighter to attack ${target.name || 'enemy'}.`, '#ff9933', 1800);
    }

    // --------- TEAM LIST (right) ----------
    rebuildList() {
        const scene = this.scene;
        this.listBody.clear(true);
        this.rows.clear();

        // "your team" is team 1 in your codebase
        // Instead of Player.troops...
        const team1 = Teams.teamLists['1'].playerList

        // sort by type then name for stability
        team1.sort((a, b) => (this.typeOf(a).localeCompare(this.typeOf(b))) || (a.name || '').localeCompare(b.name || ''));

        team1.forEach(sprite => {
            const row = this.createRow(sprite);
            this.listBody.add(row, { expand: true });
            this.rows.set(sprite.id, row.userData);
        });

        this.listBody.layout();
        this.scroll.layout();
    }

    bindScrollInput() {
        if (this._onWheel) return;

        this._onWheel = (pointer, _gameObjects, dx, dy) => {
            if (this.scene.uiBottomBar?.currentPage !== 'players') return;
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

    //refresh logic
    onShow() {
        const team1 = Teams.teamLists['1']?.playerList || [];

        // If nothing selected (or old selection is gone), pick the first player
        if (!this.selected || !team1.includes(this.selected)) {
            if (team1[0]) {
            this.select(team1[0]);
            } else {
            this.selected = null;
            this.clearDetails();
            return;
            }
        } else {
            this.select(this.selected);
        }
    }

    onHide() {
        Player.setMiniBarSelectedFromTab?.(null);
    }

    createRow(sprite) {
        const scene = this.scene;

        const accent = sprite.unitTint ?? 0x96d9ff;
        const bg = makeGlassRoundRect(scene, 0, 0, 14, {
            fill: mixColor(BOTTOM_BAR_THEME.cardFill, accent, 0.08),
            alpha: 0.88,
            stroke: accent,
            strokeAlpha: 0.12,
            strokeWidth: 1.5,
        }).setDepth(TAB_BG_DEPTH);

        const name = scene.add.text(
            0, 0,
            sprite.name || 'Unnamed',
            { fontFamily: 'Bungee', fontSize: '12px', color: BOTTOM_BAR_THEME.text, stroke: '#081621', strokeThickness: 2 }
        );

        // helper for mini bars
        function makeMiniSegBar(width, height, fillColor, ui) {
        const bg = makeGlassRoundRect(scene, width, height, 4, {
            fill: 0x08121a,
            alpha: 0.92,
            stroke: 0x98e7ff,
            strokeAlpha: 0.05,
            strokeWidth: 1,
        });
        const g  = scene.add.graphics();
        const c  = scene.add.container(0,0,[bg,g]);
        c.setSize(width, height);

        const segUnit = ui.BAR_SEG_UNIT;
        const gap = ui.BAR_SEG_GAP;
        const innerPad = 1;
        const innerW = width - innerPad*2;
        const innerH = height - innerPad*2;

        c.setValues = (cur, max) => {
            const safeMax = Math.max(0, max ?? 0);
            const safeCur = Math.max(0, Math.min(cur ?? 0, safeMax || (cur ?? 0)));
            const segCount = Math.max(1, Math.ceil((safeMax || segUnit) / segUnit));
            const lastFrac = (safeMax % segUnit) === 0 ? 1 : (safeMax % segUnit)/segUnit;

            const totalGap = (segCount - 1) * gap;
            const baseSegW = Math.max(1, (innerW - totalGap) / segCount);

            g.clear();
            const x0 = -width/2 + innerPad;
            const y0 = -height/2 + innerPad;

            g.fillStyle(0x111111, 1);
            for (let i=0;i<segCount;i++){
            const isLast = i===segCount-1;
            const w = baseSegW*(isLast?lastFrac:1);
            const x = x0 + i*(baseSegW+gap);
            g.fillRect(x,y0,w,innerH);
            }

            const filledSegs = safeCur / segUnit;
            g.fillStyle(fillColor,1);
            for (let i=0;i<segCount;i++){
            const isLast = i===segCount-1;
            const w = baseSegW*(isLast?lastFrac:1);
            const x = x0 + i*(baseSegW+gap);
            const r = Phaser.Math.Clamp(filledSegs - i, 0, 1);
            if (r<=0) continue;
            g.fillRect(x,y0,w*r,innerH);
            }
        };

        c.setValues(0, segUnit);
        return c;
        }

        const hp = makeMiniSegBar(76, 6, 0xff4d4d, this);
        const st = makeMiniSegBar(76, 6, 0x4dd2ff, this);

        const bars = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } })
            .add(hp, 0, 'left', 0, false)
            .add(st, 0, 'left', 0, false)
            .setDepth(TAB_CONTENT_DEPTH);
        name.setDepth(TAB_CONTENT_DEPTH);

        const row = scene.rexUI.add.sizer({
            orientation: 'x',
            space: { left: 8, right: 20, top: 6, bottom: 6, item: 8 },
        })
            .addBackground(bg)
            .add(name, { proportion: 1, expand: false })
            .add(bars, { proportion: 0, expand: false, padding: { left: 6, right: 10 } })
            .setDepth(TAB_BASE_DEPTH);
        
        // 🔥 stretch full width
        const fullWidth = Math.floor(scene.scale.width * (2 / 3)) - 72;
        row.setMinSize(fullWidth, 6);

        // row.setMinSize(this.RIGHT_W - 20, this.ROW_H);
        row.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.select(sprite))
            .on('pointerover', () => {
                const data = row.userData;
                if (!data) return;
                data.hovered = true;
                this.updateRowVisual(data);
            })
            .on('pointerout', () => {
                const data = row.userData;
                if (!data) return;
                data.hovered = false;
                this.updateRowVisual(data);
            });

        // store refs on row
        row.userData = {
            sprite,
            hpBar: hp,
            stBar: st,
            nameText: name,
            bg,
            row,
            hovered: false,
        };

        this._rowBaseY.set(row, row.y);
        this.updateRowVisual(row.userData);

        // initial bar widths
        this.updateRowBars(row.userData);

        return row;
    }

    // --------- selection & details ----------
    select(sprite) {
        this.selected = sprite;
        // highlight selected row
        for (const data of this.rows.values()) {
            this.updateRowVisual(data);
        }

        // 🔥 keep world mini bars open for selected unit
        if (Player.setMiniBarSelectedFromTab) {
            Player.setMiniBarSelectedFromTab(sprite);
        }

        this.paintDetails(sprite);
    }

    paintDetails(s) {
        if (!s || !s.active) {
            this.clearDetails();
            return;
        }

        const type = this.typeOf(s);
        const price = this.SELL_PRICE[type] ?? this.SELL_PRICE.Default;

        // same close-up logic as before
        const portraitKey = getPlayerPortraitKey(s);
        this.detailCard.setUnit({
            name:   s.name || 'Unnamed',
            type,
            team:   s.body?.team ?? '?',
            weapon: s.weapon?.name ?? 'None',
            portraitKey
        });

        const maxHP = s.maxHealth ?? 100;
        const maxST = s.maxStamina ?? s.maxStaminaValue ?? 100;

        // Segmented bars + correct labels (current / type max)
        this.detailCard.setHPValues?.(s.health ?? 0, maxHP);
        this.detailCard.setSTValues?.(s.stamina ?? 0, maxST);
        this.detailCard.setPrices({ seed: price, sleep: null });

        const state = s.state;
        const isSleepingLike =
            state === CONTROL_STATES.SLEEP_MODE ||
            state === CONTROL_STATES.GO_HOME_MODE;

        if (this.detailCard.setSleepButton) {
            if (isSleepingLike) {
                this.detailCard.setSleepButton('Wake', () => this.wakeOrCancelSelected());
            } else {
                this.detailCard.setSleepButton('Sleep', () => this.sendSelectedToSleep());
            }
        }

        // ---- NEW: control which buttons you see ----
        const team = s.body?.team;
        const isFriendly = team === 1;

        const isCombatant =
            type === 'Gunslinger' ||
            type === 'Blademaster' ||
            type === 'Brawler';

        this.detailCard.setButtonsLayout?.({
            isFriendly,
            isCombatant
        });
    }

    clearDetails() {
        this.selected = null;
        Player.setMiniBarSelectedFromTab?.(null);
        this.detailCard.setUnit({
            name: '—',
            type: '—',
            team: '—',
            weapon: '—',
            portraitKey: null
        });
        this.detailCard.setHPValues?.(100, 100);
        this.detailCard.setSTValues?.(100, 100);
        this.detailCard.setPrices({ seed: 0, sleep: null });
        this.detailCard.setButtonsLayout?.({
            isFriendly: false,
            isCombatant: false
        });
    }

    sellSelected() {
        const s = this.selected;
        if (!s || !s.active) return;

        const type = this.typeOf(s);
        const price = this.SELL_PRICE[type] ?? this.SELL_PRICE.Default;

        // 🔥 use mapView.updateMoney instead of addGold
        if (typeof this.scene.updateMoney === 'function') {
            this.scene.updateMoney(price);
        }

        showAlert?.(this.scene, `Sold ${s.name} (${type}) for $${price}`, '#33ff77', 1800);

        Player.destroyPlayer(s); // removes from world + team lists
        this.clearDetails();     // reset detail panel
        this.rebuildList();      // refresh list
    }

    // --------- tick / refresh ---------
    tick() {
        const current = this.scene.uiBottomBar?.currentPage;
        if (current !== 'players') return;

        // if any troop was removed/added, rebuild
        const team1Count = Teams.teamLists['1'].playerList.length;
        if (team1Count !== this.rows.size) {
            this.rebuildList();
        }

        // update bars for each row
        for (const data of this.rows.values()) {
            if (!data.sprite?.active) continue;
            this.updateRowBars(data);
        }

        // keep details live only when active
        if (this.selected?.active) {
            this.paintDetails(this.selected);
        }
    }


    onPlayerDestroyed(player) {
        if (!player) return;

        const data = this.rows.get(player.id);
        if (data) {
            // destroy the row UI
            if (data.row && !data.row.isDestroyed) {
                data.row.destroy();
            }
            this.rows.delete(player.id);
        }

        // if that player was selected, clear the detail panel
        if (this.selected === player) {
            this.selected = null;
            this.clearDetails();
        }

        // re-layout scroll panel so there isn't a gap
        this.listBody?.layout?.();
        this.scroll?.layout?.();

        // fallback: if counts are now out of sync for any reason, hard refresh
        const team1Count = Teams.teamLists['1'].playerList.length;
        if (team1Count !== this.rows.size) {
            this.rebuildList();
        }
    }

    updateRowBars({ sprite: s, hpBar, stBar }) {
        const maxHP = s.maxHealth ?? 100;
        const maxST = s.maxStamina ?? s.maxStaminaValue ?? 100;

        hpBar.setValues?.(s.health ?? 0, maxHP);
        stBar.setValues?.(s.stamina ?? 0, maxST);
    }

    updateRowVisual(data) {
        if (!data?.bg || !data?.row) return;
        const selected = this.selected === data.sprite;
        const hovered = !!data.hovered;
        const accent = selected ? 0xffd8a2 : (data.sprite?.unitTint ?? 0x96d9ff);
        data.bg.setFillStyle(
            mixColor(BOTTOM_BAR_THEME.cardFill, accent, selected ? 0.16 : hovered ? 0.12 : 0.08),
            selected ? 0.94 : hovered ? 0.9 : 0.88
        );
        data.bg.setStrokeStyle(selected ? 2.5 : hovered ? 2 : 1.5, accent, selected ? 0.34 : hovered ? 0.22 : 0.12);
        data.nameText?.setColor(selected ? "#fff8eb" : BOTTOM_BAR_THEME.text);
        setHoverLiftState(this.scene, data.row, hovered, {
            baseY: this._rowBaseY.get(data.row) ?? data.row.y,
            hoverLift: 0,
            hoverScale: 1.008,
            moveY: false,
        });
        if (!hovered) {
            data.row.setScale(1);
        }
    }

    typeOf(s) {
        if (s.isFarmer)      return 'Farmer';
        if (s.isForager)     return 'Forager';
        if (s.isFireman)     return 'Fireman';
        if (s.isBuilder)     return 'Builder';
        if (s.isGunslinger)  return 'Gunslinger';
        if (s.isBlademaster) return 'Blademaster';
        if (s.isBrawler)     return 'Brawler';
        if (s.isFortGrunt)   return 'Fort Grunt';
        if (s.isSeaRaider)   return 'Sea Raider';
        if (s.isRaider)      return 'Raider';
        return 'Unit';
    }

    hidePortrait() {
        this.portrait?.setVisible(false);
        this.portrait?.anims?.stop?.();
    }

    // Expose the root for rexUI pages.addPage(...)
    get view() { return this.root; }
}
