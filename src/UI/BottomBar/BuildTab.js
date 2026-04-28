// BuildTab.js (v2)
// VERTICAL cards (icon + name + desc + cost). Charged only on placement commit.
// Uses iconKey placeholders; you’ll swap to real images later.

import { UIDEPTH, SQUARESIZE, showAlert, TILE_TYPES } from "../../constants";
import { Map as GameMap } from "../../map";
import { Teams } from "../../Teams";
import { buildingManager } from "../../Manager/buildingManager";
import { AudioManager } from "../../Manager/AudioManager.js";
import { House } from "../../buildings/House";
import { Turret } from "../../buildings/Turret";
import { Catapult } from "../../buildings/Catapult";
import { townRoads } from "../../town";
import { Farmer } from "../../players/Farmer";
import { Builder } from "../../players/Builder";
import { Forager } from "../../players/Forager";
import { Fireman } from "../../players/Fireman";
import { Brawler } from "../../players/Brawler";
import { Blademaster } from "../../players/Blademaster";
import { Gunslinger } from "../../players/Gunslinger";
import { formatPermitCostText } from "../../permitSystem";
import { hasStoreUnlock, STORE_UNLOCK_KEYS } from "../../parcel_system/StoreUnlockSystem";
import {
  BOTTOM_BAR_THEME,
  makeGlassRoundRect,
  mixColor,
} from "./BottomBarTheme";

const RARITY = {
  common: { border: 0x2ecc71, label: "#2ecc71" }, // green
  rare:   { border: 0x4aa3ff, label: "#4aa3ff" }, // blue
  epic:   { border: 0xd86bff, label: "#d86bff" }, // pink-purple
};

const SPECIAL_BUILD_PLACERS = {
  turret: Turret,
  catapult: Catapult,
};

const UNIT_STORE = [
  {
    key: "farmer",
    name: "Farmer",
    desc: "Plants, waters, and tends crops.",
    cost: { money: 100 },
    iconKey: "icon_farmer_store",
    portraitTexture: "portrait_farmer_healthy",
    unitClass: Farmer,
  },
  {
    key: "builder",
    name: "Builder",
    desc: "Constructs and repairs your structures.",
    cost: { money: 100 },
    iconKey: "icon_builder_store",
    portraitTexture: "portrait_builder_healthy",
    unitClass: Builder,
  },
  {
    key: "forager",
    name: "Forager",
    desc: "Harvests crops and gathers seeds.",
    cost: { money: 100 },
    iconKey: "icon_forager_store",
    portraitTexture: "portrait_forager_healthy",
    unitClass: Forager,
  },
  {
    key: "fireman",
    name: "Fireman",
    desc: "Runs ovens and keeps water flowing.",
    cost: { money: 100 },
    iconKey: "icon_fireman_store",
    portraitTexture: "portrait_fireman_healthy",
    unitClass: Fireman,
  },
  {
    key: "brawler",
    name: "Brawler",
    desc: "Fast melee bruiser for close fights.",
    cost: { money: 75 },
    iconKey: "icon_brawler_store",
    portraitTexture: "portrait_brawler_healthy",
    unitClass: Brawler,
  },
  {
    key: "blademaster",
    name: "Blademaster",
    desc: "Elite sword fighter with heavy hits.",
    cost: { money: 250 },
    unlockKey: STORE_UNLOCK_KEYS.blademaster,
    iconKey: "icon_blademaster_store",
    portraitTexture: "portrait_blademaster_healthy",
    unitClass: Blademaster,
  },
  {
    key: "gunslinger",
    name: "Gunslinger",
    desc: "Ranged fighter with high recruit cost.",
    cost: { money: 500 },
    unlockKey: STORE_UNLOCK_KEYS.gunslinger,
    iconKey: "icon_gunslinger_store",
    portraitTexture: "portrait_gunslinger_healthy",
    unitClass: Gunslinger,
  },
];

function getUnitRarity(price) {
  if (price >= 400) return "epic";
  if (price >= 200) return "rare";
  return "common";
}

function buildIconTexture(scene, iconKey, drawFn) {
  if (scene.textures.exists(iconKey)) scene.textures.remove(iconKey);
  const rt = scene.make.renderTexture({ width: 64, height: 64, add: false });
  rt.clear();
  drawFn(rt);
  rt.saveTexture(iconKey);
  rt.destroy();
}

function drawCenteredTexture(scene, rt, {
  key,
  frame = null,
  scale = 1,
  x = 32,
  y = 32,
  useSprite = false,
}) {
  const obj = useSprite
    ? scene.make.sprite({ x, y, key, frame, add: false })
    : scene.make.image({ x, y, key, add: false });
  obj.setOrigin(0.5);
  obj.setScale(scale);
  rt.draw(obj);
  obj.destroy();
}

function ensureBuildTabIcons(scene) {
  buildIconTexture(scene, "icon_storage", (rt) => {
    drawCenteredTexture(scene, rt, { key: "storage", scale: 1 });
  });

  buildIconTexture(scene, "icon_town_tower", (rt) => {
    drawCenteredTexture(scene, rt, { key: "tower", frame: 0, scale: 0.72, useSprite: true });
  });

  buildIconTexture(scene, "icon_clay_oven", (rt) => {
    drawCenteredTexture(scene, rt, { key: "clayOven", frame: 0, scale: 1, useSprite: true });
  });

  buildIconTexture(scene, "icon_stone_wall", (rt) => {
    drawCenteredTexture(scene, rt, { key: "wall_interior", frame: 0, scale: 1.5, useSprite: true });
  });

  buildIconTexture(scene, "icon_wood_wall", (rt) => {
    drawCenteredTexture(scene, rt, { key: "woodWall_interior", frame: 0, scale: 1.5, useSprite: true });
  });

  buildIconTexture(scene, "icon_turret_store", (rt) => {
    drawCenteredTexture(scene, rt, { key: "image7", scale: 0.85, x: 32, y: 40 });
    drawCenteredTexture(scene, rt, { key: "image7a", scale: 0.85, x: 32, y: 20 });
  });

  buildIconTexture(scene, "icon_catapult_store", (rt) => {
    drawCenteredTexture(scene, rt, { key: "catapult_base", scale: 0.76, x: 32, y: 38 });
    drawCenteredTexture(scene, rt, { key: "catapult_top", frame: 1, scale: 0.76, x: 32, y: 24, useSprite: true });
  });

  UNIT_STORE.forEach((unit) => {
    buildIconTexture(scene, unit.iconKey, (rt) => {
      drawCenteredTexture(scene, rt, {
        key: unit.portraitTexture,
        frame: 0,
        scale: 1.05,
        y: 34,
        useSprite: true,
      });
    });
  });
}

function hasResources(scene, cost) {
  if (!cost) return true;
  const need = (k) => Number(cost[k] ?? 0);
  if (need("permits") > 0 && (scene.permits ?? 0) < need("permits")) return false;
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

  const permits = take("permits");
  if (permits) scene.updatePermits?.(-permits);

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
  if (Object.keys(cost).length === 1 && cost.money) return `$${cost.money}`;
  if (Object.keys(cost).length === 1 && cost.permits) return formatPermitCostText(cost.permits);
  const parts = [];
  for (const [k, v] of Object.entries(cost)) {
    if (!v) continue;
    if (k === "permits") parts.push(formatPermitCostText(v));
    else
    if (k === "money") parts.push(`$${v}`);
    else if (k === "clean_water") parts.push(`water:${v}`);
    else parts.push(`${k}:${v}`);
  }
  return parts.join("  ");
}

function makeIcon(scene, def, w, h) {
  if (def.iconKey && scene.textures.exists(def.iconKey)) {
    const img = scene.add.image(0, 0, def.iconKey);
    const tex = scene.textures.get(def.iconKey)?.getSourceImage?.();
    const srcW = tex?.width || img.width || w;
    const srcH = tex?.height || img.height || h;
    const scale = Math.min(w / srcW, h / srcH);
    img.setScale(scale);
    return img;
  }

  // Placeholder visual + label so you know what to replace.
  const c = scene.rexUI.add.sizer({ orientation: "y", space: { item: 4 } });
  const box = makeGlassRoundRect(scene, w, h, 16, {
    fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.04),
    alpha: 0.9,
    stroke: 0xffffff,
    strokeAlpha: 0.12,
    strokeWidth: 1.5,
  });
  const label = scene.add.text(0, 0, def.iconKey ?? "icon_missing", {
    fontSize: "10px",
    fontFamily: "Bungee",
    color: BOTTOM_BAR_THEME.textMuted,
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

function getDefCost(def, scene = null) {
  if (def?.isUnit) return def.cost ?? {};
  if (def?.key === "house") {
    return Teams.getHouseBuildCost?.(scene?.teamNumber ?? "1") ?? { wood: 4, stone: 4, permits: 1 };
  }
  if (def?.cost) return def.cost;
  // walls: use wallTypeName; buildings: tileTypeName
  const tileKey = def.isWall ? def.wallTypeName : def.tileTypeName;
  return normalizeTileCost(TILE_TYPES[tileKey]);
}

function getSpecialBuildPlacer(tile) {
  return tile?.name ? SPECIAL_BUILD_PLACERS[tile.name] ?? null : null;
}

function applyBuildTabToggleVisual(bg, text, active, accent) {
  bg.setFillStyle(
    active ? mixColor(accent, 0xffffff, 0.12) : mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.06),
    active ? 0.94 : 0.82
  );
  bg.setStrokeStyle(active ? 2 : 1.5, active ? accent : mixColor(accent, 0x98e7ff, 0.35), active ? 0.52 : 0.16);
  text.setColor(active ? "#fff9ef" : BOTTOM_BAR_THEME.textSoft);
}

export default class BuildTab {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    this.width = width;
    this.height = height;

    this.activeKey = null;
    this.pendingDef = null;
    this._placeClickBound = false;
    this.mode = "buildings";
    this._cardsScrollHooksBound = false;
    this._placementInputScene = null;
    this._onCardsPointerUp = null;
    this._onCardsPointerMove = null;
    this._onCardsWheel = null;
    this._onPlacePointerDown = null;
    this._onPlaceEsc = null;

    ensureBuildTabIcons(scene);

    this.view = scene.add.container(0, 0).setDepth(UIDEPTH);
    this.container = this.view; // if you referenced this.container elsewhere
    this.container.setOrigin?.(0, 0); // safe if available

    scene.buildTab = this;

    this._buildDefs = this._makeBuildDefs();
    this._unitDefs = this._makeUnitDefs();
    this._cardRefs = [];

    this._onStoreUnlockChanged = () => this.refreshAvailableDefs();
    scene.events.on("store:unlock-changed", this._onStoreUnlockChanged);
    this._onHousingChanged = () => {
      if (this.mode === "buildings") this._makeUI();
    };
    scene.events.on("housing:updated", this._onHousingChanged);
    scene.events.once("shutdown", () => {
      scene.events.off("store:unlock-changed", this._onStoreUnlockChanged);
      scene.events.off("housing:updated", this._onHousingChanged);
    });

    this._makeUI();
    this._ensurePlacementHooks();

    this.container.setScrollFactor(0).setDepth(UIDEPTH);
  }

  destroy() {
    this.scene.events.off("store:unlock-changed", this._onStoreUnlockChanged);
    this.scene.events.off("housing:updated", this._onHousingChanged);
    if (this._onCardsPointerUp) {
      this.scene.input.off("pointerup", this._onCardsPointerUp);
      this._onCardsPointerUp = null;
    }
    if (this._onCardsPointerMove) {
      this.scene.input.off("pointermove", this._onCardsPointerMove);
      this._onCardsPointerMove = null;
    }
    if (this._onCardsWheel) {
      this.scene.input.off("wheel", this._onCardsWheel);
      this._onCardsWheel = null;
    }
    if (this._placementInputScene?.input && this._onPlacePointerDown) {
      this._placementInputScene.input.off("pointerdown", this._onPlacePointerDown);
    }
    if (this._placementInputScene?.input?.keyboard && this._onPlaceEsc) {
      this._placementInputScene.input.keyboard.off("keydown-ESC", this._onPlaceEsc);
    }
    this._onPlacePointerDown = null;
    this._onPlaceEsc = null;
    this._placementInputScene = null;
    this.view?.removeAll?.(true);
    this.view?.destroy?.(true);
    this.view = null;
    this.container = null;
    this._cardRefs = [];
  }

  _makeBuildDefs() {
    const defs = [
      { key: "tower", name: "Town Tower", desc: "Pays income and expansion permits at dawn.", rarity: "rare", iconKey: "icon_town_tower", tileTypeName: "tower" },
      { key:"house", name:"House", desc:"Adds housing capacity.", rarity:"common", iconKey:"icon_house", tileTypeName:"house1" },
      { key: "storage",  name: "Storage",   desc: "More inventory space.",  rarity: "common", iconKey: "icon_storage",  tileTypeName: "storage",},
      { key: "clayOven", name: "Clay Oven", desc: "Cook food over time.",   rarity: "common", iconKey: "icon_clay_oven",tileTypeName: "clayOven",},

      // Walls live here now
      { key: "woodWall",  name: "Wood Wall",  desc: "Cheap defense.", rarity: "common", iconKey: "icon_wood_wall",  wallTypeName: "woodWall",  isWall: true },
    ];

    if (hasStoreUnlock(STORE_UNLOCK_KEYS.stoneWall)) {
      defs.push({
        key: "stoneWall",
        name: "Stone Wall",
        desc: "Tough defense.",
        rarity: "rare",
        iconKey: "icon_stone_wall",
        wallTypeName: "wall",
        isWall: true,
      });
    }

    if (hasStoreUnlock(STORE_UNLOCK_KEYS.turret)) {
      defs.splice(3, 0, {
        key: "turret",
        name: "Turret",
        desc: "Auto-firing defense that tracks enemy raiders.",
        rarity: "epic",
        iconKey: "icon_turret_store",
        tileTypeName: "turret",
      });
    }

    if (hasStoreUnlock(STORE_UNLOCK_KEYS.catapult)) {
      defs.splice(4, 0, {
        key: "catapult",
        name: "Catapult",
        desc: "Long-range siege engine that lobs heavy stones.",
        rarity: "epic",
        iconKey: "icon_catapult_store",
        tileTypeName: "catapult",
      });
    }

    return defs;
  }

  _makeUnitDefs() {
    return UNIT_STORE.filter((unit) => !unit.unlockKey || hasStoreUnlock(unit.unlockKey)).map((unit) => ({
      key: unit.key,
      name: unit.name,
      desc: unit.desc,
      rarity: getUnitRarity(Number(unit.cost?.money ?? 0)),
      iconKey: unit.iconKey,
      unitClass: unit.unitClass,
      recruitType: unit.key,
      cost: unit.cost,
      isUnit: true,
    }));
  }

  _getCurrentDefs() {
    return this.mode === "units" ? this._unitDefs : this._buildDefs;
  }

  _makeUI() {
    const scene = this.scene;

    // Clear old children if hot-reloading
    this.view.removeAll(true);
    this._cardRefs = [];

    // Local coordinate system: 0,0 is center of the page area (CardsTab-style)
    const centerX = 0;
    const topY = -106;

    const toggleY = topY + 18;
    const buildToggleBg = makeGlassRoundRect(scene, 112, 30, 15, {
      fill: 0x1a4258,
      alpha: 0.82,
      stroke: 0xff97c2,
      strokeAlpha: 0.18,
      strokeWidth: 1.5,
    }).setPosition(centerX - 70, toggleY)
      .setInteractive({ useHandCursor: true });
    const buildToggleText = scene.add.text(centerX - 70, toggleY, "Buildings", {
      fontSize: "12px",
      fontFamily: "Bungee",
      color: this.mode === "buildings" ? "#ffe7f4" : BOTTOM_BAR_THEME.textSoft,
      stroke: "#081621",
      strokeThickness: 2,
    }).setOrigin(0.5);

    const unitToggleBg = makeGlassRoundRect(scene, 112, 30, 15, {
      fill: 0x1a4258,
      alpha: 0.82,
      stroke: 0x98e7ff,
      strokeAlpha: 0.18,
      strokeWidth: 1.5,
    }).setPosition(centerX + 70, toggleY)
      .setInteractive({ useHandCursor: true });
    const unitToggleText = scene.add.text(centerX + 70, toggleY, "Units", {
      fontSize: "12px",
      fontFamily: "Bungee",
      color: this.mode === "units" ? "#ffe7f4" : BOTTOM_BAR_THEME.textSoft,
      stroke: "#081621",
      strokeThickness: 2,
    }).setOrigin(0.5);

    buildToggleBg.on("pointerdown", () => {
      AudioManager.playBottomBarClick();
      this._setMode("buildings");
    });
    buildToggleText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      AudioManager.playBottomBarClick();
      this._setMode("buildings");
    });
    unitToggleBg.on("pointerdown", () => {
      AudioManager.playBottomBarClick();
      this._setMode("units");
    });
    unitToggleText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      AudioManager.playBottomBarClick();
      this._setMode("units");
    });
    applyBuildTabToggleVisual(buildToggleBg, buildToggleText, this.mode === "buildings", 0xff97c2);
    applyBuildTabToggleVisual(unitToggleBg, unitToggleText, this.mode === "units", 0x98e7ff);

    this.view.add([buildToggleBg, buildToggleText, unitToggleBg, unitToggleText]);

    // ----- Card layout constants -----
    const CARD_W = 272;
    const CARD_H = 136;
    const ICON_W = 76;
    const ICON_H = 76;

    const gap = 18;

    // ----- Scroller viewport (masked) -----
    // width: leave margin so it looks like CardsTab and doesn't touch edges
    const viewportW = scene.scale.width - 32;
    const viewportH = CARD_H + 18;
    const viewportY = topY + 38;
    const viewportX = centerX;

    // Hit area (dragging works anywhere in the viewport)
    const viewportHit = scene.add.rectangle(viewportX, viewportY, viewportW, viewportH, 0x000000, 0.001)
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    // Viewport bounds for horizontal scrolling
    const left = viewportX - viewportW / 2;
    const top = viewportY;

    // Content container starts at viewport top-left
    const cardsContainer = scene.add.container(left, top);

    // Optional visual lane so the horizontal scroller area is obvious
    const viewportFrame = makeGlassRoundRect(scene, viewportW, viewportH, 24, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.08),
      alpha: 0.74,
      stroke: 0x98e7ff,
      strokeAlpha: 0.16,
      strokeWidth: 1.5,
    }).setOrigin(0.5, 0);
    viewportFrame.setPosition(viewportX, viewportY);
    const viewportGlow = scene.add.rectangle(viewportX, viewportY + 16, viewportW - 24, 18, 0xffffff, 0.08)
      .setOrigin(0.5, 0);

    // Add to view
    this.view.add([viewportFrame, viewportGlow, viewportHit, cardsContainer]);

    // Store for scrolling helpers
    this._cardsContainer = cardsContainer;
    this._cardsViewport = { left, top, w: viewportW, h: viewportH };
    this._cardsViewportHit = viewportHit;
    this._cardsScrollX = 0;
    this._cardsContentW = 0;

    // ----- Build cards horizontally -----
    let xCursor = 0;

    // card center Y inside viewport
    const cardCenterY = 10 + CARD_H / 2;

    this._getCurrentDefs().forEach((def) => {
      const rarity = RARITY[def.rarity] ?? RARITY.common;

      const x = xCursor + CARD_W / 2;
      const y = cardCenterY;
      const icon = makeIcon(scene, def, ICON_W, ICON_H);
      const iconAura = scene.add.ellipse(0, 0, 84, 84, rarity.border, 0.16).setOrigin(0.5);
      const name = scene.add.text(0, 0, def.name, {
        fontSize: "16px",
        fontFamily: "Bungee",
        color: BOTTOM_BAR_THEME.text,
        fontStyle: "bold",
        stroke: "#081621",
        strokeThickness: 3,
        align: "left",
        wordWrap: { width: CARD_W - 124 }
      }).setOrigin(0, 0);

      const desc = scene.add.text(0, 0, def.desc ?? "", {
        fontSize: "11px",
        fontFamily: "Bungee",
        color: BOTTOM_BAR_THEME.textMuted,
        stroke: "#081621",
        strokeThickness: 2,
        align: "left",
        lineSpacing: 2,
        wordWrap: { width: CARD_W - 124 }
      }).setOrigin(0, 0);

      // ✅ Cost from TILE_TYPES via your helper
      const costObj = getDefCost(def, scene);
      const cost = scene.add.text(0, 0, fmtCost(costObj), {
        fontSize: "11px",
        fontFamily: "Bungee",
        color: "#fff0bf",
        stroke: "#5a2c00",
        strokeThickness: 2,
        align: "left",
        wordWrap: { width: CARD_W - 124 }
      }).setOrigin(0, 0);
      const cardGlow = scene.add.rectangle(0, 0, CARD_W - 10, CARD_H - 10, rarity.border, 0.1)
        .setOrigin(0.5)
        .setAlpha(0.14)
        .setScale(0.94);
      const cardBg = makeGlassRoundRect(scene, CARD_W, CARD_H, 22, {
        fill: mixColor(BOTTOM_BAR_THEME.cardFill, rarity.border, 0.12),
        alpha: 0.94,
        stroke: rarity.border,
        strokeAlpha: 0.34,
        strokeWidth: 2,
      });
      const cardShine = scene.add.rectangle(0, -CARD_H / 2 + 18, CARD_W - 28, 18, 0xffffff, 0.08).setOrigin(0.5);
      iconAura.setPosition(-CARD_W / 2 + 56, 0);
      icon.setPosition(-CARD_W / 2 + 56, 0);
      name.setPosition(-CARD_W / 2 + 102, -CARD_H / 2 + 22);
      desc.setPosition(-CARD_W / 2 + 102, -8);
      cost.setPosition(-CARD_W / 2 + 102, CARD_H / 2 - 28);
      const hit = scene.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      const card = scene.add.container(x, y, [cardGlow, cardBg, cardShine, iconAura, icon, name, desc, cost, hit]);

      hit.on("pointerdown", () => {
        AudioManager.playBottomBarClick();
        this._select(def.key);
      });

      const cardRef = {
        def,
        bg: cardBg,
        glow: cardGlow,
        iconAura,
        name,
        desc,
        cost,
        card,
        baseY: y,
        hit,
        hovered: false,
      };

      hit.on("pointerover", () => {
        cardRef.hovered = true;
        this._applyCardVisual(cardRef, this.activeKey === def.key);
      });
      hit.on("pointerout", () => {
        cardRef.hovered = false;
        this._applyCardVisual(cardRef, this.activeKey === def.key);
      });

      this._cardRefs.push(cardRef);
      this._applyCardVisual(cardRef, this.activeKey === def.key);
      cardsContainer.add(card);

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
    this._cardsDragging = false;
    this._cardsDragStartX = 0;
    this._cardsScrollStart = 0;

    viewportHit.on("pointerdown", (p) => {
      this._cardsDragging = true;
      this._cardsDragStartX = p.x;
      this._cardsScrollStart = this._cardsScrollX || 0;
    });

    if (this._cardsScrollHooksBound) return;
    this._cardsScrollHooksBound = true;

    this._onCardsPointerUp = () => { this._cardsDragging = false; };
    scene.input.on("pointerup", this._onCardsPointerUp);

    this._onCardsPointerMove = (p) => {
      if (!this._cardsDragging) return;
      const dx = p.x - this._cardsDragStartX;
      this._cardsScrollX = this._cardsScrollStart + dx;
      this._clampCardsScroll();
    };
    scene.input.on("pointermove", this._onCardsPointerMove);

    // Mouse wheel / trackpad scroll:
    // translate whichever axis the device gives us into horizontal card motion.
    this._onCardsWheel = (pointer, gameObjects, dx, dy) => {
      if (this.scene.uiBottomBar?.currentPage !== "build") return;
      if (!this.scene.uiBottomBar?.expanded) return;

      const bounds = this._cardsViewportHit?.getBounds?.();
      if (!bounds) return;

      const overViewport = Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
      const overCardHit = (gameObjects || []).some((gameObject) =>
        this._cardRefs?.some((ref) => ref.hit === gameObject || ref.card === gameObject)
      );
      const over = overViewport || overCardHit;

      if (!over) return;

      const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(dominantDelta) < 0.1) return;

      this._cardsScrollX -= dominantDelta * 0.8;
      this._clampCardsScroll();
    };
    scene.input.on("wheel", this._onCardsWheel);
  }

  _setMode(mode) {
    if (this.mode === mode) return;
    this._clearSelection(true);
    this.mode = mode;
    this._makeUI();
  }

  refreshAvailableDefs() {
    this._clearSelection(true);
    this._buildDefs = this._makeBuildDefs();
    this._unitDefs = this._makeUnitDefs();
    this._makeUI();
  }

  _recruitUnit(def) {
    const team = "1";
    const costObj = def.cost ?? {};
    const housing = Teams.getHousingStatus?.(team);

    if (!hasResources(this.scene, costObj)) {
      showAlert(this.scene, "Not enough money", "#ff5555");
      return;
    }

    if (!Teams.canRecruitPlayer?.(team)) {
      const message = housing?.homelessCount > 0
        ? "House your homeless players first"
        : "Not enough housing";
      showAlert(this.scene, message, "#ff5555");
      return;
    }

    const spawnTile = Teams.getTownSpawnTile?.(team);
    if (!spawnTile) {
      showAlert(this.scene, "No town road to spawn from", "#ff5555");
      return;
    }

    const player = new def.unitClass(spawnTile.x, spawnTile.y, 1);
    House.assignPlayerToHouse(player, team);
    spendResources(this.scene, costObj);
    showAlert(this.scene, `${def.name} recruited!`, "#ffb4dd");
  }

  _select(key) {
    const scene = this.scene;
    const def = this._getCurrentDefs().find(d => d.key === key);
    if (!def) return;

    if (def.isUnit) {
      this._recruitUnit(def);
      return;
    }

    if (this.activeKey === key) {
      this._clearSelection(true);
      return;
    }

    if (this.activeKey && this.activeKey !== key) {
      this._clearSelection(true);
    }

    this.activeKey = key;
    this.pendingDef = def;

    this._cardRefs.forEach((ref) => {
      this._applyCardVisual(ref, ref.def.key === key);
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
    const specialPlacer = getSpecialBuildPlacer(tile);
    if (specialPlacer) {
      specialPlacer.beginPlacing(tile, 1);
      return;
    }
    GameMap.beginPlacing(tile);
  }

  _clearSelection(silent = false) {
    this.activeKey = null;
    this.pendingDef = null;

    this._cardRefs.forEach((ref) => {
      this._applyCardVisual(ref, false);
    });

    if (this.scene.wallPlacer?.active) this.scene.wallPlacer.stop?.();

    Object.values(SPECIAL_BUILD_PLACERS).forEach((placer) => {
      if (placer?.isPlacing) placer.cancelPlacement();
    });

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

    const inputScene = this.scene.worldScene ?? this.scene;
    this._placementInputScene = inputScene;
    this._onPlacePointerDown = (pointer) => {
      if (!this.pendingDef || this.pendingDef.isWall) return;
      const tile = TILE_TYPES[this.pendingDef.tileTypeName];
      if (!tile) return;

      const specialPlacer = getSpecialBuildPlacer(tile);
      const genericPlacementActive = !!(GameMap.isPlacing && GameMap.placingItem);
      const specialPlacementActive = !!specialPlacer?.isPlacing;
      if (!genericPlacementActive && !specialPlacementActive) return;

      if (specialPlacer) {
        if (!specialPlacementActive || specialPlacer.placementState?.topSprite?.blocked) return;
      } else {
        if (!genericPlacementActive || GameMap.placingItem?.blocked) return;
      }

      // Don’t place through the bottom bar
      if (pointer.y > inputScene.scale.height - 180 && this.scene.uiBottomBar?.expanded) return;

      const lenX = tile.lenX, lenY = tile.lenY;
      let gridX;
      let gridY;

      if (specialPlacer) {
        const placement = specialPlacer.resolvePlacement(pointer, tile);
        if (!placement) return;
        gridX = placement.gridX;
        gridY = placement.gridY;
      } else {
        let x = Math.floor(pointer.worldX - (pointer.worldX % SQUARESIZE));
        let y = Math.floor(pointer.worldY - (pointer.worldY % SQUARESIZE));
        if (lenX % 2 !== 0) x += SQUARESIZE / 2;
        if (lenY % 2 !== 0) y += SQUARESIZE / 2;

        gridX = Math.floor(x / SQUARESIZE) - Math.floor(lenX / 2);
        gridY = Math.floor(y / SQUARESIZE) - Math.floor(lenY / 2);
      }

      const costObj = getDefCost(this.pendingDef, this.scene);

      if (!hasResources(this.scene, costObj)) {
        showAlert(this.scene, "Not enough resources or permits", "#ff5555");
        return;
      }

      const isBlockBuild =
        !!tile.block ||
        !!tile.stayBlocked ||
        (tile.lenX ?? 1) > 1 ||
        (tile.lenY ?? 1) > 1;

      if (isBlockBuild) {
        spendResources(this.scene, costObj);

        buildingManager.queueBlockBuildTask({
          type: tile,
          x: gridX,
          y: gridY,
          teamNumber: 1,
          duration: 100,
          assigned: 0,
          refundCost: { ...costObj },
          prepaid: Object.keys(costObj).length > 0,
        }, 1);
        this._clearSelection(true);
        showAlert(this.scene, "Construction started!", "#aaffaa");
        return;
      }

      spendResources(this.scene, costObj);
      GameMap.placeItem(gridX * SQUARESIZE, gridY * SQUARESIZE, tile);
      this._clearSelection(true);
      showAlert(this.scene, "Built!", "#aaffaa");
    };
    inputScene.input.on("pointerdown", this._onPlacePointerDown);

    this._onPlaceEsc = () => {
      if (!this.pendingDef) return;
      if (this.pendingDef.isWall && this.scene.wallPlacer?.active) return;
      this._clearSelection(true);
    };
    inputScene.input.keyboard.on("keydown-ESC", this._onPlaceEsc);
  }

  onShow() {}
  hide() {}

  _applyCardVisual(ref, selected) {
    if (!ref?.bg || !ref?.card) return;
    const rarity = RARITY[ref.def?.rarity] ?? RARITY.common;
    const hovered = !!ref.hovered;
    const accent = selected ? mixColor(rarity.border, 0xffffff, 0.16) : rarity.border;

    ref.bg.setFillStyle(
      mixColor(BOTTOM_BAR_THEME.cardFill, rarity.border, selected ? 0.2 : hovered ? 0.16 : 0.12),
      selected ? 0.98 : hovered ? 0.96 : 0.94
    );
    ref.bg.setStrokeStyle(selected ? 3 : hovered ? 2.5 : 2, accent, selected ? 0.86 : hovered ? 0.54 : 0.34);
    ref.iconAura?.setFillStyle(rarity.border, selected ? 0.24 : hovered ? 0.2 : 0.16);
    ref.name?.setColor(selected ? "#fffdf4" : BOTTOM_BAR_THEME.text);
    ref.desc?.setColor(hovered || selected ? BOTTOM_BAR_THEME.textSoft : BOTTOM_BAR_THEME.textMuted);
    ref.cost?.setColor(selected ? "#fff4c9" : "#fff0bf");
    ref.glow?.setFillStyle(rarity.border, selected ? 0.26 : hovered ? 0.2 : 0.14);
    ref.glow?.setScale(selected ? 1.02 : hovered ? 0.99 : 0.94);

    this.scene.tweens.killTweensOf(ref.card);
    this.scene.tweens.add({
      targets: ref.card,
      y: selected ? ref.baseY - 6 : hovered ? ref.baseY - 4 : ref.baseY,
      scaleX: selected ? 1.025 : hovered ? 1.012 : 1,
      scaleY: selected ? 1.025 : hovered ? 1.012 : 1,
      duration: 130,
      ease: "Quad.easeOut",
    });
  }
}
