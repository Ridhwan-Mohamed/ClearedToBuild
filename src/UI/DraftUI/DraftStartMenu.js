// UI/DraftStartMenu_v5.js

import { DraftStartState } from "./DraftStartState.js";
import { DraftStartPreviewController } from "./DraftStartPreviewController.js";
import { TeamNameInput } from "./TeamNameInput.js";
import { POWERUP_CARDS } from "../../Cards/PowerupCards.js";
import { DRAFT_UI_X_SHIFT, UIDEPTH } from "../../constants.js";

const MAP_UI_CENTER_X = (window.innerWidth / 2) + DRAFT_UI_X_SHIFT;

function randPickN(arr, n){
  const a = [...arr];
  Phaser.Utils.Array.Shuffle(a);
  return a.slice(0,n);
}

export class DraftStartMenu {
  static build(scene, opts){
    const m = new DraftStartMenu(scene, opts);
    m.buildUI();
    return m;
  }

  constructor(scene, opts){
    this.scene = scene;
    this.srcW = opts.srcW;
    this.srcH = opts.srcH;
    this.gridData = opts.gridData;
    this.repaintBounds = opts.repaintBounds;

    this.container = scene.add.container(0,0).setDepth(2000);

    // State + preview
    this.state = new DraftStartState({ startingCash: 1200 });
    this.preview = new DraftStartPreviewController(scene, {
      srcW: this.srcW,
      srcH: this.srcH,
      gridData: this.gridData,
      repaintBounds: this.repaintBounds,
      fullRepaintPreview: scene.fullRepaintPreview?.bind(scene)
    });

    this.mode = { kind: "none", typeKey: null, selected: null };

    // UI refs
    this.ui = {};

    // Bungee is uppercase-only; enforce uppercase + font on draft UI text.
    this._installDraftTextTheme();
  }

  destroy(){
    if (this._escKeyHandler) {
      this.scene.input.keyboard?.off("keydown-ESC", this._escKeyHandler);
      this._escKeyHandler = null;
    }

    // ✅ destroy map overlay (hint) which is NOT inside this.container
    this.mapOverlayContainer?.destroy?.(true);
    this.mapOverlayContainer = null;

    // ✅ destroy preview controller graphics/containers
    this.preview?.destroy?.();
    this.preview = null;
    this.teamNameInput?.destroy?.();
    this.teamNameInput = null;

    this.container?.destroy(true);
    this.container = null;
    this._uninstallDraftTextTheme();
  }

  _installDraftTextTheme() {
    if (this._draftTextThemeInstalled) return;
    const add = this.scene?.add;
    if (!add?.text) return;

    this._originalAddText = add.text.bind(add);
    add.text = (x, y, text, style = {}) => {
      const nextStyle = (style && typeof style === "object") ? { ...style } : {};
      if (!nextStyle.fontFamily) nextStyle.fontFamily = "Bungee";
      const themedText =
        (nextStyle.fontFamily === "Bungee" && typeof text === "string")
          ? text.toUpperCase()
          : text;
      return this._originalAddText(x, y, themedText, nextStyle);
    };
    this._draftTextThemeInstalled = true;
  }

  _uninstallDraftTextTheme() {
    if (!this._draftTextThemeInstalled) return;
    if (this.scene?.add && this._originalAddText) {
      this.scene.add.text = this._originalAddText;
    }
    this._originalAddText = null;
    this._draftTextThemeInstalled = false;
  }

  buildUI(){
    const s = this.scene;
    const W = s.cameras.main.width;
    const H = s.cameras.main.height;
    
    // Shift map-side UI to the right so we can widen the left bars later.

    // --- Left panel
    const leftW = 460;
    const leftBg = s.add.rectangle(0,0,leftW,H,0x121212,0.88).setOrigin(0).setScrollFactor(0);
    this.container.add(leftBg);

    const title = s.add.text(18, 14, "Founding Draft", { fontSize: "18px", fontStyle: "bold", color: "#ffffff"}).setScrollFactor(0);
    this.container.add(title);

    // Team name (inline text box)
    const teamLabel = s.add.text(18, 44, "Team:", { fontSize: "14px", color: "#bbbbbb"}).setScrollFactor(0);
    this.container.add([teamLabel]);
    this.teamNameInput = new TeamNameInput(s, {
      x: 210,
      y: 52,
      width: 180,
      placeholder: "Team name",
      initialValue: this.state.teamName,
      onChange: (v) => this.state.setTeamName(v),
    });

    // Money readout
    const money = s.add.text(18, 70, "", { fontSize: "14px", fontStyle: "bold", color: "#8fe388"}).setScrollFactor(0);
    this.container.add(money);
    this.ui.money = money;

    // Create a dedicated overlay container anchored to the MAP PREVIEW.
    // Important: DO NOT add this to the left-side UI container.
    this.mapOverlayContainer?.destroy?.();
    this.mapOverlayContainer = this.scene.add.container(0, 0).setDepth(UIDEPTH + 10);


    // Hint text (hidden by default; only shown during add/move)
    this.ui.placeHintBg = this.scene.add.rectangle(0, 0, 0, 0, 0x000000, 0.65).setOrigin(0.5,0.5);
    this.ui.placeHintText = this.scene.add.text(0, 0, "", { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5);

    this.mapOverlayContainer.add([this.ui.placeHintBg, this.ui.placeHintText]);
    this.mapOverlayContainer.setVisible(false);

    // ESC cancels place/move mode
    this._escKeyHandler = () => this._cancelPlacementOrMove();
    this.scene.input.keyboard?.on("keydown-ESC", this._escKeyHandler);

    // Crew counters
    let y = 100;
    y = this._section("Crew", 18, y);
    y = this._crewRow("Forager", "forager", 18, y, { min: 1 });
    y = this._crewRow("Builder", "builder", 18, y, { min: 1 });
    y = this._crewRow("Fireman", "fireman", 18, y);
    y = this._crewRow("Brawler", "brawler", 18, y);
    y = this._crewRow("Gunslinger", "gunslinger", 18, y);
    y = this._crewRow("Blademaster", "blademaster", 18, y);
    y = this._crewRow("Farmer", "farmer", 18, y);

    // Supplies
    y += 10;
    y = this._section("Supplies", 18, y);
    y = this._supplyRow("Seeds", "seeds", 18, y);
    y = this._supplyRow("Food", "food", 18, y);
    y = this._supplyRow("Berries", "berries", 18, y);
    y = this._supplyRow("Wood", "wood", 18, y);
    y = this._supplyRow("Stone", "stone", 18, y);
    y = this._supplyRow("Clean Water", "water", 18, y);

    // Buildings (extras)
    y += 10;
    y = this._section("Buildings", 18, y);
    const info = s.add.text(18, y, "Storage + Clay Oven required. Houses auto-scale (2 crew/house).", {
      fontSize: "12px", color: "#999999", wordWrap: { width: leftW - 36 }
    }).setScrollFactor(0);
    this.container.add(info);
    y += 34;

    const housePrice   = this.state.prices.extras.house;
    const storagePrice = this.state.prices.extras.storage;
    const ovenPrice    = this.state.prices.extras.oven;

    const addHouse = this._actionBtn(`Add House ($${housePrice})`, 18,  y, () => this._enterPlace("house1"));
    const addStorage = this._actionBtn(`Add Storage ($${storagePrice})`, 165, y, () => this._enterPlace("storage"));
    const addOven = this._actionBtn(`Add Oven ($${ovenPrice})`, 315, y, () => this._enterPlace("clayOven"));

    // ✅ keep refs so we can shake them later
    this.ui.addHouseBtn = addHouse.r;
    this.ui.addHouseBtnText = addHouse.t;

    y += 34;

    // Wall toggle + type
    const wallToggle = s.add.rectangle(18, y+10, 18, 18, 0x333333, 1)
      .setOrigin(0).setScrollFactor(0).setInteractive({ cursor:"pointer" });

    const wallLabel = s.add.text(42, y+8, "Add perimeter wall", { fontSize: "14px", color: "#dddddd" })
      .setScrollFactor(0);

    // NEW: explicit label so it's obvious the pill is clickable
    const swapLabel = s.add.text(200, y-2, "Material:", { fontSize: "11px", color: "#999999" })
      .setScrollFactor(0);

    // the clickable "swap" pill
    const wallType = s.add.text(200, y+12, "WOOD", {
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffffff",
      backgroundColor: "#444444",
      padding: { left: 6, right: 6, top: 2, bottom: 2 }
    })
    .setScrollFactor(0)
    .setInteractive({ cursor:"pointer" });

    // NEW: put estimate *right below* the swap pill
    const wallCost = s.add.text(200, y+30, "", { fontSize:"12px", color:"#aaaaaa" })
      .setScrollFactor(0);

    this.container.add([wallToggle, wallLabel, swapLabel, wallType, wallCost]);

    this.ui.wallToggle = wallToggle;
    this.ui.wallType = wallType;
    this.ui.wallCost = wallCost;

    wallType.on("pointerdown", () => {
      this.state.setExtra("wallType", this.state.extras.wallType === "wood" ? "stone" : "wood");
    });

    wallToggle.on("pointerdown", () => {
      const next = this.state.extras.wall ? 0 : 1;
      this.state.setExtra("wall", next);
      if (next) {
        const est = this.preview.estimateWallTiles();
        this.state.setWallEstimate(est, false); // <-- was true
        this.preview.applyWall(this.state);
      } else {
        this.preview.clearWall?.();
        this.state.setWallEstimate(0, false);   // <-- add this line to keep UI consistent
      }
      this.scene.fullRepaintPreview?.();
    });

    // give enough vertical room for the 2-line wall UI now
    y += 58;

    // Cards
    y = this._section("Cards", 18, y);
    const cardsNote = s.add.text(18, y, "Pick 3 of 5.", { fontSize:"12px", color:"#999999" }).setScrollFactor(0);
    this.container.add(cardsNote);
    y += 20;

    this.ui.cardTexts = [];
    for (let i=0; i<5; i++) {
      const t = s.add.text(18, y + i*18, "", { fontSize:"12px", color:"#bbbbbb" }).setScrollFactor(0).setInteractive({ cursor:"pointer" });
      t.on("pointerdown", () => {
        const card = this.state.cards.offered[i];
        if (card) this.state.togglePickCard(card);
      });
      this.container.add(t);
      this.ui.cardTexts.push(t);
    }
    y += 110;

    // Confirm
    const confirmY = H - 38;
    const confirm = s.add.rectangle(MAP_UI_CENTER_X, confirmY, leftW-36, 34, 0x2f6fed, 1)
      .setOrigin(0.5).setScrollFactor(0).setInteractive({ cursor:"pointer" });
    const confirmT = s.add.text(MAP_UI_CENTER_X, confirmY, "Confirm", { fontSize:"16px", fontStyle:"bold", color:"#ffffff" })
      .setOrigin(0.5).setScrollFactor(0);
    confirm.on("pointerdown", () => {
      this.state.recalc();
      if (!this.state.canAfford()) {
        s.tweens.add({ targets: confirm, alpha: 0.35, duration: 80, yoyo: true, repeat: 2 });
        return;
      }
      // Ensure wall estimate is up to date
      if (this.state.extras.wall) {
        const est = this.preview.estimateWallTiles();
        this.state.setWallEstimate(est, true);
        this.preview.applyWall(this.state);
      }
      this.preview._updatePlacedBuildingsIntoState?.(this.state);
      const startConfig = this.state.toStartConfig();
      startConfig.spawnPoints = this.preview.getSpawnPoints();
      this.preview?.clearDraftPlayerIcons?.();
      s.events.emit("draftConfirmed", startConfig);
    });
    this.container.add([confirm, confirmT]);

    // Offer cards once
    this.state.setOfferedCards(randPickN(POWERUP_CARDS, this.state.cards.offerCount));

    // Place mandatory base town once
    this.preview.initBaseTown(this.state);
    const num = this.preview.estimateWallTiles();
    this.state.setWallEstimate(num, true);

    // mode button above the map preview (hidden unless in placing/moving)
    const img = this.scene.menuPreview;
    const btnW = 160, btnH = 26;

    const bx = img.x + (DRAFT_UI_X_SHIFT / s.cameras.main.zoom);
    const by = img.y - img.displayHeight * 0.5 - 14;

    const modeBtn = this.scene.add.rectangle(bx, by, btnW, btnH, 0x111111, 0.9)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2200)
      .setInteractive({ cursor:"pointer" });

    const modeBtnText = this.scene.add.text(bx, by, "", { fontSize:"12px", color:"#ffffff" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2201);

    modeBtn.on("pointerdown", () => this._cancelPlacementOrMove());

    modeBtn.setVisible(false);
    modeBtnText.setVisible(false);

    this.container.add([modeBtn, modeBtnText]);
    this.ui.modeBtn = modeBtn;
    this.ui.modeBtnText = modeBtnText;


    // Pointer interactions on preview
    this._wirePreviewPointer();

    this._lastCrewSig = "";

    // State -> UI updates only
    this.state.onChange((_st, reason) => {
      this._refreshUI();
      // Only repaint preview for preview-affecting changes (e.g. wall type toggled)
      if (reason === "preview") {
        if (this.state.extras.wall) {
          const est = this.preview.estimateWallTiles();
          this.state.setWallEstimate(est, false);   // <-- was true
          this.preview.applyWall(this.state);
        } else {
          this.preview.clearWall?.();
          this.state.setWallEstimate(0, false);     // <-- was true
        }
        this.scene.fullRepaintPreview?.();
      }
    });

    this.scene.scale.on("resize", () => {
      if (this.mapOverlayContainer?.visible) this._positionHintAboveMap();
    });

    this._refreshUI();
  }

  _positionHintAboveMap() {
    const img = this.scene.menuPreview;
    if (!img) return;

    // tweakables
    const HINT_Y_LIFT = 38;            // <-- increase to raise hint more
    const HINT_MARGIN_TOP = 150;        // keep away from top edge

    const px = (window.innerWidth / 2) + DRAFT_UI_X_SHIFT ; // use the actual preview position
    let py = img.y - (img.displayHeight * 0.5) + HINT_MARGIN_TOP + HINT_Y_LIFT;

    this.mapOverlayContainer.setPosition(px, py);

    // center text + bg at (0,0) inside overlay
    this.ui.placeHintText.setOrigin(0.5).setPosition(0, 0);

    const tw = Math.max(80, this.ui.placeHintText.width + 18);
    const th = Math.max(26, this.ui.placeHintText.height + 10);

    this.ui.placeHintBg.setOrigin(0.5).setPosition(0, 0);
    this.ui.placeHintBg.setSize(tw, th); // IMPORTANT: use setSize (not width/height)
  }

  setPlacementHintVisible(isVisible, msg = "") {
    this.mapOverlayContainer.setVisible(!!isVisible);
    if (msg) this.ui.placeHintText.setText(msg);
    if (isVisible) this._positionHintAboveMap();
  }

  _section(name, x, y){
    const t = this.scene.add.text(x, y, name, { fontSize:"14px", fontStyle:"bold", color:"#ffffff" }).setScrollFactor(0);
    this.container.add(t);
    return y + 20;
  }

  _miniBtn(x, y, label, onClick){
    const r = this.scene.add.rectangle(x, y, 22, 18, 0x333333, 0.95).setOrigin(0).setScrollFactor(0).setInteractive({ cursor:"pointer" });
    const t = this.scene.add.text(x+11, y+9, label, { fontSize:"16px", color:"#ffffff" }).setOrigin(0.5).setScrollFactor(0);
    r.on("pointerdown", onClick);
    this.container.add([r,t]);
    return r;
  }

  _crewRow(label, key, x, y, opts = {}){
    const s = this.scene;
    const name = s.add.text(x, y, label, { fontSize:"13px", color:"#dddddd" }).setScrollFactor(0);
    const price = s.add.text(x+150, y, `(${this.state.prices.crew[key]})`, { fontSize:"12px", color:"#999999" }).setScrollFactor(0);
    const val = s.add.text(x+240, y, "0", { fontSize:"13px", fontStyle:"bold", color:"#ffffff" }).setScrollFactor(0);

    const min = opts.min ?? 0;
    this._miniBtn(x+210, y+2, "-", () => this.state.setCrew(key, Math.max(min, (this.state.crew[key]??0) - 1)));
    this._miniBtn(x+270, y+2, "+", () => {
      const next = (this.state.crew[key] ?? 0) + 1;

      // compute total crew AFTER this change
      const curTotal = this.state.getTotalCrew();
      const cur = (this.state.crew[key] ?? 0);
      const nextTotal = curTotal - cur + next;

      const cap = this._getCrewCap();
      if (nextTotal > cap) {
        this._flashNeedHouseHint();
        this._shakeAddHouseBtn();
        return;
      }

      this.state.setCrew(key, next);
    });

    this.container.add([name, price, val]);
    if (!this.ui.crew) this.ui.crew = {};
    this.ui.crew[key] = { val, price };
    return y + 22;
  }

  _supplyRow(label, key, x, y){
    const s = this.scene;
    const name = s.add.text(x, y, label, { fontSize:"13px", color:"#dddddd" }).setScrollFactor(0);
    const price = s.add.text(x+150, y, `(${this.state.prices.supplies[key]})`, { fontSize:"12px", color:"#999999" }).setScrollFactor(0);
    const val = s.add.text(x+240, y, "0", { fontSize:"13px", fontStyle:"bold", color:"#ffffff" }).setScrollFactor(0);

    this._miniBtn(x+210, y+2, "-", () => this.state.setSupply(key, Math.max(0, (this.state.supplies[key]??0) - 1)));
    this._miniBtn(x+270, y+2, "+", () => this.state.setSupply(key, (this.state.supplies[key]??0) + 1));

    this.container.add([name, price, val]);
    if (!this.ui.supplies) this.ui.supplies = {};
    this.ui.supplies[key] = { val, price };
    return y + 22;
  }

  _actionBtn(label, x, y, onClick){
    const r = this.scene.add.rectangle(x, y, 145, 26, 0x222222, 0.95)
      .setOrigin(0).setScrollFactor(0).setInteractive({ cursor:"pointer" });

    const t = this.scene.add.text(x+74, y+13, label, { fontSize:"12px", color:"#ffffff" })
      .setOrigin(0.5).setScrollFactor(0);

    r.on("pointerdown", onClick);
    this.container.add([r,t]);

    return { r, t };
  }

  _getPlacedHouseCount(){
    // state.placedBuildings is maintained by the preview controller
    const list = this.state.placedBuildings ?? [];
    let n = 0;
    for (const b of list) {
      const k = b?.typeKey || b?.type; // depending on what got stored
      if (k === "house1" || k === "house2") n++;
    }
    return Math.max(0, n);
  }

  _getCrewCap(){
    return this._getPlacedHouseCount() * 2;
  }

  _shakeAddHouseBtn(){
    const r = this.ui.addHouseBtn;
    const t = this.ui.addHouseBtnText;
    if (!r || !t) return;

    const baseXr = r.x;
    const baseXt = t.x;

    // shake rect
    this.scene.tweens.add({
      targets: r,
      x: { from: baseXr - 4, to: baseXr + 4 },
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => { r.x = baseXr; }
    });

    // shake text (around its own center position)
    this.scene.tweens.add({
      targets: t,
      x: { from: baseXt - 4, to: baseXt + 4 },
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => { t.x = baseXt; }
    });
  }

  _flashNeedHouseHint(){
    this.setPlacementHintVisible(true, "Housing full (2 crew per house). Add a house.");
    this._positionHintAboveMap();

    // auto-hide after a moment (doesn't change mode)
    this.scene.time.delayedCall(1400, () => {
      // only hide if not currently using the hint for placement/move modes
      if (this.mode?.kind === "none") this.setPlacementHintVisible(false, "");
    });
  }

  _cancelPlacementOrMove(){
    this.mode.kind = "none";
    this.mode.typeKey = null;
    this.mode.selected = null;

    this.preview.clearHover?.();

    // ✅ Correct system: map-overlay hint
    this.setPlacementHintVisible(false, "");

    // Mode button above map
    this.ui.modeBtnText?.setText("");
    this.ui.modeBtn?.setVisible(false);
    this.ui.modeBtnText?.setVisible(false);
  }

  _enterPlace(typeKey){
    if (typeKey === "house1") {
      typeKey = (Phaser.Math.RND.integerInRange(0,1) === 0) ? "house1" : "house2";
    }

    this.mode.kind = "placing";
    this.mode.typeKey = typeKey;
    this.mode.selected = null;

    this.setPlacementHintVisible(true, "Add: click on the map to place");

    this.ui.modeBtn?.setVisible(true);
    this.ui.modeBtnText?.setVisible(true);
    this.ui.modeBtnText?.setText("End add mode (ESC)");
  }

  _wirePreviewPointer(){
    const img = this.scene.menuPreview;
    if (!img) return;

    img.setInteractive();

    img.on("pointermove", (pointer) => {
      if (this.mapOverlayContainer?.visible) {
        this._positionHintAboveMap();
      }
      const g = this._screenToGrid(pointer.worldX, pointer.worldY);
      if (!g) { this.preview.clearHover?.(); return; }

      if (this.mode.kind === "placing" && this.mode.typeKey) {
        this.preview.setHover(this.mode.typeKey, this.state, g.x, g.y);
        return;
      }

      if (this.mode.kind === "moving" && this.mode.selected) {
        this.preview.setMoveHover(this.mode.selected, this.state, g.x, g.y);
        return;
      }
    });

    img.on("pointerout", () => {
      this.preview.clearHover?.();
    });

  img.on("pointerdown", (pointer) => {
    const g = this._screenToGrid(pointer.worldX, pointer.worldY);
    if (!g) return;

    // 1) placing mode: click confirms placement
    if (this.mode.kind === "placing" && this.mode.typeKey) {
      const res = this.preview.tryPlaceExtra(this.mode.typeKey, this.state, g.x, g.y);
      if (res.ok) {
        this.preview._refreshSpawnIfInvalid(this.state.crew);
        this._cancelPlacementOrMove();
      } else {
        // keep mode; optionally flash hint
        this.setPlacementHintVisible(true, res.reason ?? "Can't place there");
      }
      this._refreshUI();
      return;
    }

    // 2) moving mode: click confirms move target
    if (this.mode.kind === "moving" && this.mode.selected) {
      const res = this.preview.tryMoveSelected(this.mode.selected, this.state, g.x, g.y);
      if (res.ok) {
        this.preview._refreshSpawnIfInvalid(this.state.crew);
        this._cancelPlacementOrMove();
      } else {
        this.setPlacementHintVisible(true, res.reason ?? "Can't move there");
      }
      this._refreshUI();
      return;
    }

    // 3) idle: click a building -> enter moving mode
    const hit = this.preview.hitTestPlaced(g.x, g.y);
    if (hit) {
      this.mode.kind = "moving";
      this.mode.selected = hit;
      this.mode.typeKey = null;

      this.ui.modeBtn?.setVisible(true);
      this.ui.modeBtnText?.setVisible(true);
      this.ui.modeBtnText?.setText("End move mode (ESC)");

      this.setPlacementHintVisible(true, "Move: click a new spot");
      // immediately draw hover at current cursor
      this.preview.setMoveHover(hit, this.state, g.x, g.y);
      return;
    }

    // else: clicked empty space, do nothing (or clear selection)
  });

  }

  _screenToGrid(worldX, worldY){
    const img = this.scene.menuPreview;
    if (!img) return null;

    // Convert pointer world coords to image-local coords
    const left = img.x - img.displayWidth * img.originX;
    const top  = img.y - img.displayHeight * img.originY;
    const lx = worldX - left;
    const ly = worldY - top;
    if (lx < 0 || ly < 0 || lx > img.displayWidth || ly > img.displayHeight) return null;

    const gx = Math.floor((lx / img.displayWidth) * this.srcW);
    const gy = Math.floor((ly / img.displayHeight) * this.srcH);
    if (gx < 0 || gy < 0 || gx >= this.srcW || gy >= this.srcH) return null;
    return { x: gx, y: gy };
  }

  _refreshUI(){
    this.state.recalc();
    const domInput = this.teamNameInput?.dom?.node?.querySelector?.("input");
    if (domInput && domInput.value !== this.state.teamName) {
      this.teamNameInput.setValue(this.state.teamName);
    }
    this.scene.events.emit("draftTeamNameChanged", this.state.teamName);
    this.ui.money?.setText(`Money left: $${this.state.cash}`);

    // Crew values + price labels
    for (const [k, refs] of Object.entries(this.ui.crew ?? {})) {
      refs.val.setText(String(this.state.crew[k] ?? 0));
      refs.price.setText(`(${this.state.prices.crew[k]})`);
    }
    for (const [k, refs] of Object.entries(this.ui.supplies ?? {})) {
      refs.val.setText(String(this.state.supplies[k] ?? 0));
      refs.price.setText(`(${this.state.prices.supplies[k]})`);
    }

    const wt = (this.state.extras.wallType === "stone") ? "STONE" : "WOOD";
    const per = (this.state.extras.wallType === "stone")
      ? (this.state.prices.extras.wallStonePerTile ?? 15)
      : (this.state.prices.extras.wallWoodPerTile ?? 10);

    this.state.wall.estimatedTiles = this.preview.estimateWallTiles();
    const tiles = this.state.wall?.estimatedTiles ?? 0;
    const total = tiles * per;

    this.ui.wallType?.setText(wt);

    // "button light" ON/OFF
    this.ui.wallToggle?.setFillStyle(this.state.extras.wall ? 0x2f6fed : 0x333333, 1);

    // cost label: "$10/tile  tiles≈12  total≈$120"
    this.ui.wallCost?.setText(`Est: $${per}/tile • ${tiles} tiles • ~$${total}`);

    // Cards
    for (let i=0; i<this.ui.cardTexts.length; i++) {
      const c = this.state.cards.offered[i];
      if (!c) { this.ui.cardTexts[i].setText(""); continue; }
      const picked = this.state.cards.picked.includes(c);
      const prefix = picked ? "[x]" : "[ ]";
      this.ui.cardTexts[i].setText(`${prefix} ${c.name ?? c.id ?? "Card"}`);
      this.ui.cardTexts[i].setColor(picked ? "#ffffff" : "#bbbbbb");
    }

    const sig = JSON.stringify(this.state.crew);
    if (sig !== this._lastCrewSig) {
      this._lastCrewSig = sig;
      this.preview.updateCrewSpawnPreview(this.state.crew);
    }
    if (this.mapOverlayContainer?.visible) {
      this._positionHintAboveMap();
    }

  }
}
