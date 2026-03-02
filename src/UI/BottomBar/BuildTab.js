// BuildTab.js (v2)
// VERTICAL cards (icon + name + desc + cost). Charged only on placement commit.
// Uses iconKey placeholders; you’ll swap to real images later.

import { UIDEPTH, SQUARESIZE, showAlert, TILE_TYPES } from "../../constants";
import { Map as GameMap } from "../../map";

const RARITY = {
  common: { border: 0x2ecc71, label: "#2ecc71" }, // green
  rare:   { border: 0x4aa3ff, label: "#4aa3ff" }, // blue
};

function hasResources(scene, cost) {
  if (!cost) return true;
  const need = (k) => Number(cost[k] ?? 0);
  if (need("money") > 0 && (scene.money ?? 0) < need("money")) return false;
  if (need("wood") > 0 && (scene.woodAmnt ?? 0) < need("wood")) return false;
  if (need("stone") > 0 && (scene.stoneAmnt ?? 0) < need("stone")) return false;
  if (need("seeds") > 0 && (scene.seeds ?? 0) < need("seeds")) return false;
  if (need("food") > 0 && (scene.foodAmnt ?? 0) < need("food")) return false;
  if (need("clean_water") > 0 && (scene.cleanWaterAmnt ?? 0) < need("clean_water")) return false;
  return true;
}

function spendResources(scene, cost) {
  if (!cost) return;
  const take = (k) => Number(cost[k] ?? 0);

  const money = take("money");
  if (money) scene.updateMoney?.(-money);

  const wood = take("wood");
  if (wood) { scene.woodAmnt = (scene.woodAmnt ?? 0) - wood; scene.woodText?.setText(String(scene.woodAmnt)); }

  const stone = take("stone");
  if (stone) { scene.stoneAmnt = (scene.stoneAmnt ?? 0) - stone; scene.stoneText?.setText(String(scene.stoneAmnt)); }

  const seeds = take("seeds");
  if (seeds) scene.updateSeeds?.(-seeds);

  const food = take("food");
  if (food) {
    scene.foodAmnt = (scene.foodAmnt ?? 0) - food;
    if (scene.foodText) {
      const raw = scene.foodText.text || "";
      const parts = raw.split("/");
      scene.foodText.setText(parts.length === 2 ? `${scene.foodAmnt}/${parts[1]}` : String(scene.foodAmnt));
    }
  }

  const water = take("clean_water");
  if (water) {
    scene.cleanWaterAmnt = (scene.cleanWaterAmnt ?? 0) - water;
    if (scene.waterText) {
      const raw = scene.waterText.text || "";
      const parts = raw.split("/");
      scene.waterText.setText(parts.length === 2 ? `${scene.cleanWaterAmnt}/${parts[1]}` : String(scene.cleanWaterAmnt));
    }
  }
}

function fmtCost(cost) {
  if (!cost) return "";
  const parts = [];
  for (const [k, v] of Object.entries(cost)) {
    if (!v) continue;
    if (k === "clean_water") parts.push(`water:${v}`);
    else parts.push(`${k}:${v}`);
  }
  return parts.join("  ");
}

function makeIcon(scene, def, w, h) {
  // If you later load textures with these keys, it will auto-swap to images.
  if (def.iconKey && scene.textures.exists(def.iconKey)) {
    return scene.add.image(0, 0, def.iconKey).setDisplaySize(w, h);
  }

  // Placeholder visual + label so you know what to replace.
  const c = scene.rexUI.add.sizer({ orientation: "y", space: { item: 4 } });
  const box = scene.add.rectangle(0, 0, w, h, 0x333333, 1).setStrokeStyle(1, 0x111111);
  const label = scene.add.text(0, 0, def.iconKey ?? "icon_missing", {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#aaaaaa",
    align: "center",
    wordWrap: { width: w }
  }).setOrigin(0.5, 0.5);

  c.add(box, { expand: false, align: "center" });
  c.add(label, { expand: false, align: "center" });
  return c;
}

function normalizeTileCost(tile) {
  if (!tile) return {};

  // prefer cost; fallback to price
  const raw = tile.cost ?? tile.price ?? {};

  // some tiles use numeric `price` (money), normalize it
  if (typeof raw === "number") return { money: raw };
  if (typeof raw === "object") return raw;

  return {};
}

function getDefCost(def) {
  // walls: use wallTypeName; buildings: tileTypeName
  const tileKey = def.isWall ? def.wallTypeName : def.tileTypeName;
  return normalizeTileCost(TILE_TYPES[tileKey]);
}

export default class BuildTab {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    this.width = width;
    this.height = height;

    this.activeKey = null;
    this.pendingDef = null;
    this._placeClickBound = false;

    this.view = scene.add.container(0, 0).setDepth(UIDEPTH);
    this.container = this.view; // if you referenced this.container elsewhere
    scene.cameras.main.ignore(this.view);
    this.container.setOrigin?.(0, 0); // safe if available

    scene.cameras.main.ignore(this.container);
    scene.buildTab = this;

    this._buildDefs = this._makeBuildDefs();
    this._cardRefs = [];

    this._makeUI();
    this._ensurePlacementHooks();

    this.container.setScrollFactor(0).setDepth(UIDEPTH);
  }

  _makeBuildDefs() {
    return [
      { key:"house", name:"House", desc:"Adds housing capacity.", rarity:"common", iconKey:"icon_house", tileTypeName:"house1" },      { key: "storage",  name: "Storage",   desc: "More inventory space.",  rarity: "common", iconKey: "icon_storage",  tileTypeName: "storage",},
      { key: "clayOven", name: "Clay Oven", desc: "Cook food over time.",   rarity: "common", iconKey: "icon_clay_oven",tileTypeName: "clayOven",},

      // Walls live here now
      { key: "woodWall",  name: "Wood Wall",  desc: "Cheap defense.", rarity: "common", iconKey: "icon_wood_wall",  wallTypeName: "woodWall",  isWall: true },
      { key: "stoneWall", name: "Stone Wall", desc: "Tough defense.", rarity: "rare",   iconKey: "icon_stone_wall", wallTypeName: "wall", isWall: true },
    ];
  }

  _makeUI() {
    const scene = this.scene;

    // Clear old children if hot-reloading
    this.view.removeAll(true);
    this._cardRefs = [];

    // Local coordinate system: 0,0 is center of the page area (CardsTab-style)
    const centerX = 0;
    const topY = -132;

    // ----- Header -----
    const title = scene.add.text(centerX, topY + 6, "BUILD", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#dddddd",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const hint = scene.add.text(
      centerX,
      topY + 30,
      "Pick a card -> place on map. Charged on placement.",
      { fontSize: "12px", fontFamily: "monospace", color: "#aaaaaa", align: "center" }
    ).setOrigin(0.5);

    this.view.add([title, hint]);

    // ----- Card layout constants -----
    const CARD_W = 140;
    const CARD_H = 170;
    const ICON_W = 96;
    const ICON_H = 70;

    const gap = 24;

    // ----- Scroller viewport (masked) -----
    // width: leave margin so it looks like CardsTab and doesn't touch edges
    const viewportW = scene.scale.width - 140;
    const viewportH = CARD_H + 40; // includes a bit of padding above/below cards

    // Lower the whole scroller so the header is readable
    const viewportY = topY + 50; // <= tweak this to lower/raise scroller
    const viewportX = centerX;

    // Hit area (dragging works anywhere in the viewport)
    const viewportHit = scene.add.rectangle(viewportX, viewportY, viewportW, viewportH, 0x000000, 0)
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    // Viewport bounds for horizontal scrolling
    const left = viewportX - viewportW / 2;
    const top = viewportY;

    // Content container starts at viewport top-left
    const cardsContainer = scene.add.container(left, top);

    // Optional visual lane so the horizontal scroller area is obvious
    const viewportFrame = scene.add.rectangle(viewportX, viewportY, viewportW, viewportH, 0x000000, 0)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x666666, 0.5);

    // Add to view
    this.view.add([viewportHit, cardsContainer, viewportFrame]);

    // Store for scrolling helpers
    this._cardsContainer = cardsContainer;
    this._cardsViewport = { left, top, w: viewportW, h: viewportH };
    this._cardsScrollX = 0;
    this._cardsContentW = 0;

    // ----- Build cards horizontally -----
    let xCursor = 0;

    // card center Y inside viewport
    const cardCenterY = 18 + CARD_H / 2;

    this._buildDefs.forEach((def) => {
      const rarity = RARITY[def.rarity] ?? RARITY.common;

      const x = xCursor + CARD_W / 2;
      const y = cardCenterY;

      const bg = scene.add.rectangle(x, y, CARD_W, CARD_H, 0x1e1e1e, 0.95)
        .setStrokeStyle(2, rarity.border)
        .setInteractive({ useHandCursor: true });

      const icon = makeIcon(scene, def, ICON_W, ICON_H);
      icon.x = x;
      icon.y = y - 32;

      const name = scene.add.text(x, y + 30, def.name, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: rarity.label,
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: CARD_W - 16 }
      }).setOrigin(0.5);

      const desc = scene.add.text(x, y + 55, def.desc ?? "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#bbbbbb",
        align: "center",
        wordWrap: { width: CARD_W - 16 }
      }).setOrigin(0.5);

      // ✅ Cost from TILE_TYPES via your helper
      const costObj = getDefCost(def);
      const cost = scene.add.text(x, y + 78, fmtCost(costObj), {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#dddddd",
        align: "center",
      }).setOrigin(0.5);

      bg.on("pointerdown", () => this._select(def.key));

      this._cardRefs.push({ def, bg });

      cardsContainer.add([bg, icon, name, desc, cost]);

      xCursor += CARD_W + gap;
    });

    // Total scrollable width
    this._cardsContentW = Math.max(0, xCursor - gap);

    // Clamp and enable scrolling
    this._clampCardsScroll();
    this._enableCardScrolling(viewportHit);
  }

  _clampCardsScroll() {
    if (!this._cardsContainer || !this._cardsViewport) return;

    const { left, w } = this._cardsViewport;
    const contentW = this._cardsContentW || 0;

    // if content fits, lock to start
    if (contentW <= w) {
      this._cardsScrollX = 0;
      this._cardsContainer.x = left;
      return;
    }

    // scroll range: [min, max] in pixels
    const maxScroll = 0;
    const minScroll = -(contentW - w);

    this._cardsScrollX = Phaser.Math.Clamp(this._cardsScrollX, minScroll, maxScroll);
    this._cardsContainer.x = left + this._cardsScrollX;
  }

  _enableCardScrolling(viewportHit) {
    const scene = this.scene;

    let dragging = false;
    let dragStartX = 0;
    let scrollStart = 0;

    viewportHit.on("pointerdown", (p) => {
      dragging = true;
      dragStartX = p.x;
      scrollStart = this._cardsScrollX || 0;
    });

    scene.input.on("pointerup", () => { dragging = false; });

    scene.input.on("pointermove", (p) => {
      if (!dragging) return;
      const dx = p.x - dragStartX;
      this._cardsScrollX = scrollStart + dx;
      this._clampCardsScroll();
    });

    // mouse wheel (optional but nice)
    scene.input.on("wheel", (pointer, gameObjects, dx, dy) => {
      // only if mouse is over the viewport area
      const { left, top, w, h } = this._cardsViewport || {};
      if (left == null) return;

      const mx = pointer.x;
      const my = pointer.y;
      const over =
        mx >= left && mx <= left + w &&
        my >= top  && my <= top + h;

      if (!over) return;

      this._cardsScrollX -= dy * 0.6; // dy positive = wheel down
      this._clampCardsScroll();
    });
  }

  _select(key) {
    const scene = this.scene;
    const def = this._buildDefs.find(d => d.key === key);
    if (!def) return;

    if (this.activeKey === key) {
      this._clearSelection(true);
      return;
    }

    this.activeKey = key;
    this.pendingDef = def;

    this._cardRefs.forEach(({ def: d, bg }) => {
      const rarity = RARITY[d.rarity] ?? RARITY.common;
      bg.setStrokeStyle(d.key === key ? 4 : 2, d.key === key ? 0xffff00 : rarity.border);
    });

    if (def.isWall) {
      showAlert(scene, `Begin placing: ${def.name}`, "#aaffaa");
      scene.stoneWallMode = (def.wallTypeName === "wall");
      scene.woodWallMode = (def.wallTypeName === "woodWall");
      scene.wallPlacer?.start?.(def.wallTypeName);
      return;
    }

    const tile = TILE_TYPES[def.tileTypeName];
    if (!tile) {
      showAlert(scene, `Missing TILE_TYPES for "${def.tileTypeName}"`, "#ff5555");
      return;
    }

    showAlert(scene, `Begin placing: ${def.name}`, "#aaffaa");
    GameMap.beginPlacing(tile);
  }

  _clearSelection(silent = false) {
    this.activeKey = null;
    this.pendingDef = null;

    this._cardRefs.forEach(({ def: d, bg }) => {
      const rarity = RARITY[d.rarity] ?? RARITY.common;
      bg.setStrokeStyle(2, rarity.border);
    });

    if (this.scene.wallPlacer?.active) this.scene.wallPlacer.stop?.();

    if (GameMap.isPlacing) {
      GameMap.isPlacing = false;
      GameMap.placingItem?.destroy?.();
      GameMap.placingItem = null;
    }

    if (!silent) showAlert(this.scene, "Cancelled placement", "#ffaaaa");
  }

  _ensurePlacementHooks() {
    if (this._placeClickBound) return;
    this._placeClickBound = true;

    this.scene.input.on("pointerdown", (pointer) => {
      if (!this.pendingDef || this.pendingDef.isWall) return;
      if (!GameMap.isPlacing || !GameMap.placingItem) return;
      if (GameMap.placingItem.blocked) return;

      // Don’t place through the bottom bar
      if (pointer.y > this.scene.scale.height - 180 && this.scene.uiBottomBar?.expanded) return;

      const tile = TILE_TYPES[this.pendingDef.tileTypeName];
      if (!tile) return;

      const lenX = tile.lenX, lenY = tile.lenY;
      let x = Math.floor(pointer.worldX - (pointer.worldX % SQUARESIZE));
      let y = Math.floor(pointer.worldY - (pointer.worldY % SQUARESIZE));
      if (lenX % 2 !== 0) x += SQUARESIZE / 2;
      if (lenY % 2 !== 0) y += SQUARESIZE / 2;

      const gridX = Math.floor(x / SQUARESIZE) - Math.floor(lenX / 2);
      const gridY = Math.floor(y / SQUARESIZE) - Math.floor(lenY / 2);

      const costObj = getDefCost(this.pendingDef);

      if (!hasResources(this.scene, costObj)) {
        showAlert(this.scene, "Not enough resources", "#ff5555");
        return;
      }

      spendResources(this.scene, costObj);

      GameMap.placeItem(gridX * SQUARESIZE, gridY * SQUARESIZE, tile);

      this._clearSelection(true);
      showAlert(this.scene, "Built!", "#aaffaa");
    });

    this.scene.input.keyboard.on("keydown-ESC", () => {
      if (!this.pendingDef) return;
      if (this.pendingDef.isWall && this.scene.wallPlacer?.active) return;
      this._clearSelection(true);
    });
  }

  onShow() {}
  hide() {}
}













