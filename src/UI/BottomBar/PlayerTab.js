import { House } from "../../buildings/House.js";
import { showAlert, CONTROL_STATES } from "../../constants";
import { StaminaManager } from "../../Manager/staminaManager.js";
import { Player } from "../../players/Player";
import { Teams } from "../../Teams.js";


export default class PlayerTab {
  constructor(scene) {
    this.scene = scene;
    this.selected = null;
    this.rows = new Map(); // sprite.id -> { row, hpBar, stBar, nameText, bg }
    this.refreshEvt = null;
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
        this.root?.destroy();
        this.rows.clear();
    }

    build() {
        const scene = this.scene;

        const root = scene.rexUI.add.sizer({
            orientation: 'x',
            space: { left: 8, right: 8, top: 8, bottom: 8, item: 10 },
        });

        // build the detail panel first
        this.detailCard = this.buildUnitInfoPanel(scene);

        // LEFT (details) — 1/3
        this.detailSizer = scene.rexUI.add.sizer({ orientation: 'y' })
            .add(this.detailCard.panel, { proportion: 1, expand: true });

        // RIGHT (list) — 2/3
        this.listBody = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } });
        this.scroll = scene.rexUI.add.scrollablePanel({
            width: this.RIGHT_W,
            height: 180,
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

        const BAR_W = 260;
        const BAR_H = 14;

        // ---------- helpers ----------
        const rr = (w, h, r, color) =>
            scene.rexUI.add.roundRectangle(0, 0, w, h, r, color);

        const makeSegmentedBar = (width, height, fillColor) => {
        const bg = rr(width, height, 4, 0x353535);
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
        const hpVal = scene.add.text(0, 0, '0/0', { fontSize: 12, color: '#EDEDED' });

        const stBar = makeSegmentedBar(BAR_W, BAR_H, 0x69D6FF);
        const stVal = scene.add.text(0, 0, '0/0', { fontSize: 12, color: '#EDEDED' });

        function makeButton(labelText, onClick) {
            const label = scene.rexUI.add.label({
                background: rr(0, 36, 10, 0x2a5bd8),
                text: scene.add.text(0, 0, labelText, {
                    fontFamily: 'Bungee',
                    fontSize: 14,
                    color: '#ffffff'
                }),
                space: { left: 14, right: 14, top: 8, bottom: 8 }
            });
            label.setMinSize(80, 36);

            label
                .setInteractive({ useHandCursor: true })
                .on('pointerup', () => onClick?.())
                .on('pointerover', () => {
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('pointer');
                    }
                })
                .on('pointerout', () => {
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('default');
                    }
                });

            return label;
        }

        function makeSellButton(onClick) {
            const label = scene.rexUI.add.label({
                background: rr(0, 36, 10, 0x9c27b0),
                text: scene.add.text(0, 0, 'Sell', {
                    fontFamily: 'Bungee',
                    fontSize: 14,
                    color: '#ffffff'
                }),
                space: { left: 14, right: 14, top: 8, bottom: 8 }
            });
            label.setMinSize(80, 36);

            label
                .setInteractive({ useHandCursor: true })
                .on('pointerup', () => onClick?.())
                .on('pointerover', () => {
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('pointer');
                    }
                })
                .on('pointerout', () => {
                    // Don’t clobber guard placement cursor
                    if (!scene.guardPlacement?.active) {
                    scene.input.setDefaultCursor('default');
                    }
                });

            return label;
        }

        // ---------- header row: portrait + details ----------
        const header = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 12 } });

        const portrait = scene.add.sprite(0, 0, 'char')
            .setDisplaySize(48, 48)
            .setOrigin(0.5, 0.5);
        portrait.setVisible(false); // start hidden
        this.portrait = portrait;

        const detailsText = scene.add.text(
            0, 0,
            `Name: ${name}\nType: ${type}\nTeam: ${team}\nWeapon: ${weapon}`,
            { fontFamily: 'Bungee', fontSize: 16, color: '#EDEDED' }
        );

        header.add(portrait,    0, 'center', 0, false);
        header.add(detailsText, 0, 'left',   0, true);

        // ---------- bars column ----------
        const barsCol = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } });

        const hpRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } });
        hpRow.add(
            scene.add.text(0, 0, 'HP', { fontSize: 12, color: '#B0B0B0' }),
            0, 'center', { right: 4 }, false
        );
        hpRow.add(hpBar, 0, 'center', 0, false);
        hpRow.add(hpVal, 0, 'center', 0, false);

        const stRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } });
        stRow.add(
            scene.add.text(0, 0, 'ST', { fontSize: 12, color: '#B0B0B0' }),
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
        buttonsRow.setMinSize(BAR_W, 40);

        const sellBtn   = makeSellButton(() => ui.sellSelected());
        const sleepBtn  = makeButton('Sleep', () => ui.sendSelectedToSleep())
        const guardBtn  = makeButton('Guard',  () => ui.startGuardPlacementForSelected?.());
        const attackBtn = makeButton('Attack', () => ui.attackSelectedTarget?.());

        // layout helper: rebuild row so things always pack from the left
        function updateButtonsLayout({ isFriendly, isCombatant, isEnemy }) {
            // remove all children from the row, but keep them alive
            buttonsRow.clear(false);

            // hard reset visibility so dropped buttons don't float on screen
            sellBtn.setVisible(false);
            sleepBtn.setVisible(false);
            guardBtn.setVisible(false);
            attackBtn.setVisible(false);

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

            if (isEnemy) {
                attackBtn.setVisible(true);
                buttonsRow.add(attackBtn, 0, 'top', 0, false);
            }

            buttonsRow.layout();
        }

        // start with nothing shown (no unit selected yet)
        updateButtonsLayout({ isFriendly: false, isCombatant: false, isEnemy: false });

        // ---------- root panel stack ----------
        const panel = scene.rexUI.add.sizer({
            orientation: 'y',
            space: { left: 8, right: 8, top: 6, bottom: 6, item: 8 }
        });

        panel.add(header,     0, 'left', 0, true);
        panel.add(barsCol,    0, 'left', 0, true);
        // push buttons clearly below the bars, don't let them expand
        panel.add(buttonsRow, 0, 'center', { top: 16 }, false);

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
                stVal.setText(`${cur ?? 0}/${max ?? 0}`);
            },
            // (optional) keep these if you still use pct anywhere
            setHP(pct) { hpBar.setValues((pct ?? 0) * ui.BAR_SEG_UNIT, ui.BAR_SEG_UNIT); },
            setST(pct) { stBar.setValues((pct ?? 0) * ui.BAR_SEG_UNIT, ui.BAR_SEG_UNIT); },
            setUnit(u) {
                detailsText.setText(
                    `Name: ${u.name}\nType: ${u.type}\nTeam: ${u.team}\nWeapon: ${u.weapon}`
                );
                if (u.portraitKey) {
                    portrait.setVisible(true);
                    portrait.setTexture(u.portraitKey);
                    portrait.play(u.portraitKey);
                } else {
                    portrait.setVisible(false);
                }
            },
            setPrices({ seed = seedPrice, sleep = sleepPrice } = {}) {
                const sleepPriceLabel =
                    sleepBtn.getChildren?.()[0] || sleepBtn.getElement?.('text');
                if (sleep !== null && sleepPriceLabel?.setText) {
                    sleepPriceLabel.setText(`(${sleep})`);
                }
            },
            setSleepButton(labelText, onClick) {
                const children = sleepBtn.getChildren ? sleepBtn.getChildren() : [];
                if (!children.length) return;

                // last child is the actual button label (rexUI Label)
                const btnLabel = children[children.length - 1];
                const textObj = btnLabel.getElement
                    ? btnLabel.getElement('text')
                    : null;

                if (textObj?.setText) {
                    textObj.setText(labelText);
                }

                btnLabel.removeAllListeners?.('pointerup');
                btnLabel.setInteractive({ useHandCursor: true })
                    .on('pointerup', () => onClick?.());
            },
            // 🔥 called from paintDetails/clearDetails
            setButtonsLayout(flags) {
                updateButtonsLayout(flags);
            }
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
        this.scroll.setMinSize(this.RIGHT_W, 180);
        this.scroll.layout();
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
            // Ensure detail card is up to date for the existing selection
            this.paintDetails(this.selected);
        }
    }

    createRow(sprite) {
        const scene = this.scene;

        const bg = scene.rexUI.add.roundRectangle(
            0, 0, 0, 0, 6,
            sprite.unitTint ?? 0x666666,
            0.15
        ).setStrokeStyle(2, sprite.unitTint ?? 0x888888);

        const name = scene.add.text(
            0, 0,
            sprite.name || 'Unnamed',
            { fontSize: '13px', color: '#ffffff' }
        );

        // helper for mini bars
        function makeMiniSegBar(width, height, fillColor, ui) {
        const bg = scene.add.rectangle(0,0,width,height,0x222222).setOrigin(0,0.5);
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

        const hp = makeMiniSegBar(90, 6, 0xff4d4d, this);
        const st = makeMiniSegBar(90, 6, 0x4dd2ff, this);

        const bars = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } })
            .add(hp, 0, 'left', 0, false)
            .add(st, 0, 'left', 0, false);

        const row = scene.rexUI.add.sizer({
            orientation: 'x',
            space: { left: 8, right: 8, top: 6, bottom: 6, item: 10 },
        })
            .addBackground(bg)
            .add(name, { proportion: 1, expand: false })
            .add(bars, { proportion: 0, expand: false });
        
        // 🔥 stretch full width
        const fullWidth = Math.floor(scene.scale.width * (2 / 3)) - 72;
        row.setMinSize(fullWidth, 6);

        // row.setMinSize(this.RIGHT_W - 20, this.ROW_H);
        row.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.select(sprite));

        // store refs on row
        row.userData = {
            sprite,
            hpBar: hp,
            stBar: st,
            nameText: name,
            bg,
            row,
        };

        // initial bar widths
        this.updateRowBars(row.userData);

        return row;
    }

    // --------- selection & details ----------
    select(sprite) {
        this.selected = sprite;
        // highlight selected row
        for (const { bg, sprite: s } of this.rows.values()) {
            bg.setAlpha(s === sprite ? 1 : 0.6);
            bg.setStrokeStyle(2, s === sprite ? 0xffffff : (s.unitTint ?? 0x888888), 1);
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
        const portraitKey = s.health > 50 ? 'char' : 'charHurt';
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
        const isEnemy    = team === 0;

        const isCombatant =
            type === 'Gunslinger' ||
            type === 'Blademaster' ||
            type === 'Brawler';

        this.detailCard.setButtonsLayout?.({
            isFriendly,
            isCombatant,
            isEnemy
        });
    }

    clearDetails() {
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
            isCombatant: false,
            isEnemy: false
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

    typeOf(s) {
        if (s.isFarmer)      return 'Farmer';
        if (s.isForager)     return 'Forager';
        if (s.isFireman)     return 'Fireman';
        if (s.isBuilder)     return 'Builder';
        if (s.isGunslinger)  return 'Gunslinger';
        if (s.isBlademaster) return 'Blademaster';
        if (s.isBrawler)     return 'Brawler';
        return 'Unit';
    }

    hidePortrait() {
        this.portrait?.setVisible(false);
    }

    // Expose the root for rexUI pages.addPage(...)
    get view() { return this.root; }
}
