import { House } from "../../buildings/House.js";
import { showAlert } from "../../constants";
import { StaminaManager } from "../../Manager/staminaManager.js";
import { Player } from "../../players/Player";
import { Teams } from "../../Teams.js";


export default class PlayerTab {
  constructor(scene) {
    this.scene = scene;
    this.selected = null;
    this.rows = new Map(); // sprite.id -> { row, hpBar, stBar, nameText, bg }
    this.refreshEvt = null;

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

    // hide root container from main camera
    scene.cameras.main.ignore(this.root);
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
    buildUnitInfoPanel(scene, ui, {
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
        const rr = (w, h, r, color) => scene.rexUI.add.roundRectangle(0, 0, w, h, r, color);

        function makeBar(width, height, fillColor) {
            // Use OverlapSizer so fill sits ABOVE the background (no side-by-side issue)
            const s = scene.rexUI.add.overlapSizer({ width, height });

            const bg   = rr(width, height, 4, 0x353535);
            const fill = rr(Math.max(1, width - 6), height - 6, 4, fillColor)
                        .setOrigin(0, 0.5);

            s.addBackground(bg);
            s.add(fill, { key: 'fill', align: 'left', expand: false, padding: { left: 3, right: 3 } });
            s.layout();

            s.setPercent = (pct) => {
            const p = Phaser.Math.Clamp(pct, 0, 1);
            fill.width = Math.max(1, (width - 6) * p);
            s.layout();
            };

            return s;
        }

        function makeButton(labelText, onClick) {
            const label = scene.rexUI.add.label({
            background: rr(0, 36, 10, 0x2a5bd8),
            text: scene.add.text(0, 0, labelText, { fontFamily: 'sans-serif', fontSize: 14, color: '#ffffff' }),
            space: { left: 14, right: 14, top: 8, bottom: 8 }
            });
            label.setMinSize(120, 36); // consistent size so text never hides under the bg
            label.setInteractive({ useHandCursor: true }).on('pointerup', () => onClick?.());
            return label;
        }

        function makePricedButton(title, price, onClick) {
            // price above button, both centered; wrap in a vertical sizer so they stay together
            const v = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } });
            if (price !== null && price !== undefined) {
            v.add(
                scene.add.text(0, 0, `(${price})`, { fontFamily: 'sans-serif', fontSize: 12, color: '#CCCCCC' }),
                0, 'center', 0, false
            );
            }
            v.add(makeButton(title, onClick), 0, 'center', 0, false);
            v.setMinSize(140, 56); // gives both buttons the same overall footprint
            return v;
        }

        function makeSellButton(onClick) {
            const label = scene.rexUI.add.label({
                background: rr(0, 36, 10, 0x9c27b0),
                text: scene.add.text(0, 0, 'Sell', { fontFamily: 'sans-serif', fontSize: 14, color: '#ffffff' }),
                space: { left: 14, right: 14, top: 8, bottom: 8 }
            });
            label.setMinSize(120, 36);
            label.setInteractive({ useHandCursor: true }).on('pointerup', () => onClick?.());
            return label;
        }


        // ---------- header row: portrait + details ----------
        const header = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 12 } });

        const portrait = scene.add.sprite(0, 0, 'char')
            .setDisplaySize(48, 48)
            .setOrigin(0.5, 0.5);
        header.add(portrait, 0, 'center', 0, false);

        portrait.setVisible(false); // start hidden

        this.portrait = portrait;

        const detailsText = scene.add.text(
            0, 0,
            `Name: ${name}\nType: ${type}\nTeam: ${team}\nWeapon: ${weapon}`,
            { fontFamily: 'sans-serif', fontSize: 16, color: '#EDEDED' }
        );

        header.add(portrait,     0, 'center', 0, false);
        header.add(detailsText,  0, 'left',   0, true);

        // ---------- bars column: labels + overlapped bars ----------
        const barsCol = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 6 } });

        const hpRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } });
        hpRow.add(scene.add.text(0, 0, 'HP', { fontSize: 12, color: '#B0B0B0' }), 0, 'center', { right: 4 }, false);
        const hpBar = makeBar(BAR_W, BAR_H, 0xFF5A70);
        hpBar.setPercent(hpPct);
        hpRow.add(hpBar, 0, 'center', 0, false);

        const stRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } });
        stRow.add(scene.add.text(0, 0, 'ST', { fontSize: 12, color: '#B0B0B0' }), 0, 'center', { right: 4 }, false);
        const stBar = makeBar(BAR_W, BAR_H, 0x69D6FF);
        stBar.setPercent(stPct);
        stRow.add(stBar, 0, 'center', 0, false);

        barsCol.add(hpRow, 0, 'left', 0, false);
        barsCol.add(stRow, 0, 'left', 0, false);

        // ---------- buttons row: inline, same size, price above ----------
        const buttonsRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 16 } });

        const sellBtn = makeSellButton(() => this.sellSelected());
        const sleepBtn = makePricedButton(
            'Sleep',
            sleepPrice,
            () => this.sendSelectedToSleep()
        );

        buttonsRow.add(sellBtn,  0, 'top', 0, false);
        buttonsRow.add(sleepBtn, 0, 'top', 0, false);

        // ---------- root panel stack ----------
        const panel = scene.rexUI.add.sizer({
            orientation: 'y',
            space: { left: 8, right: 8, top: 6, bottom: 6, item: 8 }
        });

        panel.add(header,     0, 'left', 0, true);
        panel.add(barsCol,    0, 'left', 0, true);
        panel.add(buttonsRow, 0, 'left', 0, true);

        // return with some setters for live updates
        return {
            panel,
            portrait, // expose portrait
            setHP(pct) { hpBar.setPercent(pct); },
            setST(pct) { stBar.setPercent(pct); },
            setUnit(u) {
            detailsText.setText(
                `Name: ${u.name}\nType: ${u.type}\nTeam: ${u.team}\nWeapon: ${u.weapon}`
            );

            if (u.portraitKey) {
                portrait.setVisible(true);
                portrait.setTexture(u.portraitKey);
                portrait.play(u.portraitKey); // 🔥 play anim based on key
            } else {
                portrait.setVisible(false);
            }
            },
            setHP(pct) { hpBar.setPercent(pct); },
            setST(pct) { stBar.setPercent(pct); },
            setPrices({ seed = seedPrice, sleep = sleepPrice } = {}) {
            // Rebuild labels if needed; or just replace text on the first child (price label)
            const sleepPriceLabel = sleepBtn.getChildren?.()[0] || sleepBtn.getElement?.('text');
            if (sleep !== null && sleepPriceLabel?.setText) sleepPriceLabel.setText(`(${sleep})`);
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
    function makeMiniBar(width, height, fillColor) {
        const s = scene.rexUI.add.overlapSizer({ width, height });
        const bg   = scene.add.rectangle(0, 0, width, height, 0x222222).setOrigin(0, 0.5);
        const fill = scene.add.rectangle(0, 0, width, height, fillColor).setOrigin(0, 0.5);
        s.addBackground(bg);
        s.add(fill, { key: 'fill', align: 'left', expand: true });
        return { sizer: s, fill };
    }

    const hp = makeMiniBar(90, 6, 0xff4d4d);
    const st = makeMiniBar(90, 6, 0x4dd2ff);

    const bars = scene.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } })
        .add(hp.sizer, 0, 'left', 0, false)
        .add(st.sizer, 0, 'left', 0, false);

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
        hpBar: hp.fill,
        stBar: st.fill,
        nameText: name,
        bg
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
        this.paintDetails(sprite);
    }

    paintDetails(s) {
        if (!s || !s.active) {
            this.clearDetails();
            return;
        }

        const type = this.typeOf(s);
        const price = this.SELL_PRICE[type] ?? this.SELL_PRICE.Default;

        // You can still change the portrait dynamically if needed:
        const portraitKey = s.health > 50 ? 'char' : 'charHurt';
        this.detailCard.setUnit({
            name: s.name || 'Unnamed',
            type,
            team: s.body?.team ?? '?',
            weapon: s.weapon?.name ?? 'None',
            portraitKey
        });
        this.detailCard.setHP((s.health ?? 0) / 100);
        this.detailCard.setST((s.stamina ?? 0) / (s.maxStamina || 100));
        this.detailCard.setPrices({ seed: price, sleep: null });
        
        // todo: set portraitKey into detailCard if you extend setUnit
    }


    clearDetails() {
        this.detailCard.setUnit({ name: '—', type: '—', team: '—', weapon: '—', portraitKey: null });
        this.detailCard.setHP(0);
        this.detailCard.setST(0);
        this.detailCard.setPrices({ seed: 0, sleep: null });
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
        // skip if Players page not open
        const isActive = this.scene.uiBottomBar?.pages?.isCurrentPage?.('players');
        if (!isActive) return;

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


  updateRowBars({ sprite: s, hpBar, stBar }) {
    hpBar.width = 90 * Math.max(0, Math.min(1, (s.health ?? 0) / 100));
    stBar.width = 90 * Math.max(0, Math.min(1, (s.stamina ?? 0) / (s.maxStamina || 100)));
  }

  typeOf(s) {
    if (s.isFarmer) return 'Farmer';
    if (s.isForager) return 'Forager';
    if (s.isFireman) return 'Fireman';
    if (s.isBuilder) return 'Builder';
    if (s.isGunslinger) return 'Gunslinger';
    return 'Unit';
  }

  hidePortrait() {
    this.portrait?.setVisible(false);
  }

  // Expose the root for rexUI pages.addPage(...)
  get view() { return this.root; }
}
