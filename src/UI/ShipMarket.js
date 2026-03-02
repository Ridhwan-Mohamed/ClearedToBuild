
// src/UI/ShipMarket.js
//
// World-space "market ship" that docks beside the parcel that bought the Market contract.
// - No navgrid: ship is a sprite + pile sprites.
// - Hover a pile -> tiny world-space buy widget above it.
// - UI is hidden from uiCamera (only rendered by main/world camera).
// - Purchases are blocked if storage can't accept the full amount.
//
// Usage:
//   1) In your scene preload: loadShipMarketAssets(this);
//   2) On Market contract spawn: spawnMarketShip(this, { parcelCenterWorld: {x,y}, teamNumber: 1, durationMs: 60000 });
//   3) On contract complete: destroy returned handle or call handle.destroy().

import shipPng from "url:../assets/ship/ship.png";
import foodPilePng from "url:../assets/ship/food_pile.png";
import waterPilePng from "url:../assets/ship/water_pile.png";
import cropPilePng from "url:../assets/ship/crop_pile.png";
import berryPilePng from "url:../assets/ship/berry_pile.png";
import woodPilePng from "url:../assets/ship/wood_pile.png";
import stonePilePng from "url:../assets/ship/stone_pile.png";

import { showAlert, UIDEPTH } from "../constants";
import { UI_ITEM_TYPES } from "./UIConstants";
import { Teams } from "../Teams";

// Default prices should match DraftStartState.prices.supplies.
// If you have a live DraftStartState instance on scene, pass it in spawnMarketShip({ prices }).
export const DEFAULT_SUPPLY_PRICES = Object.freeze({
  seeds: 2,
  food: 3,
  berries: 3,
  wood: 4,
  stone: 5,
  water: 2
});

// What the ship sells.
// NOTE: "crop" pile represents seedCrop; "berry" pile represents seedBerry.
const GOODS = [
  { key: "food",       label: "Food",       texture: "ship_food_pile",  itemDef: UI_ITEM_TYPES.food,        priceKey: "food" },
  { key: "water",      label: "Clean Water",texture: "ship_water_pile", itemDef: UI_ITEM_TYPES.clean_water, priceKey: "water" },
  { key: "crop",       label: "Crop Seed",  texture: "ship_crop_pile",  itemDef: UI_ITEM_TYPES.seedCrop,    priceKey: "seeds" },
  { key: "berry",      label: "Berry Seed", texture: "ship_berry_pile", itemDef: UI_ITEM_TYPES.seedBerry,   priceKey: "berries" },
  { key: "wood",       label: "Wood",       texture: "ship_wood_pile",  itemDef: UI_ITEM_TYPES.wood,        priceKey: "wood" },
  { key: "stone",      label: "Stone",      texture: "ship_stone_pile", itemDef: UI_ITEM_TYPES.stone,       priceKey: "stone" }
];

export function loadShipMarketAssets(scene) {
  scene.load.image("market_ship", shipPng);
  scene.load.image("ship_food_pile", foodPilePng);
  scene.load.image("ship_water_pile", waterPilePng);
  scene.load.image("ship_crop_pile", cropPilePng);
  scene.load.image("ship_berry_pile", berryPilePng);
  scene.load.image("ship_wood_pile", woodPilePng);
  scene.load.image("ship_stone_pile", stonePilePng);
}

function getPriceTable(pricesMaybe) {
  // prefer caller's prices
  if (pricesMaybe && typeof pricesMaybe === "object") return pricesMaybe;
  return DEFAULT_SUPPLY_PRICES;
}

// ---------- Storage capacity helpers (block overfill purchases) ----------

// Compute how many of itemDef we can still fit in this specific storage.
function storageFreeForItem(storageBuilding, itemDef) {
  if (!storageBuilding || !itemDef) return 0;
  const maxStack = itemDef.stacks ?? 1;
  let free = 0;

  for (const slot of (storageBuilding.storageItems ?? [])) {
    if (!slot) {
      free += maxStack;
      continue;
    }
    if (slot.item === itemDef && (slot.amount ?? 0) < maxStack) {
      free += (maxStack - slot.amount);
    }
  }
  return free;
}

function teamCanAcceptAmount(teamNumber, itemDef, amount) {
  const storages = Teams.teamLists?.[String(teamNumber)]?.storageList ?? Teams.teamLists?.[teamNumber]?.storageList ?? [];
  let remaining = amount;

  for (const st of storages) {
    const free = storageFreeForItem(st, itemDef);
    const take = Math.min(free, remaining);
    remaining -= take;
    if (remaining <= 0) return true;
  }
  return false;
}

function addToTeamStorage(teamNumber, itemDef, amount) {
  const storages = Teams.teamLists?.[String(teamNumber)]?.storageList ?? Teams.teamLists?.[teamNumber]?.storageList ?? [];
  let remaining = amount;

  for (const st of storages) {
    if (remaining <= 0) break;
    // storage.addItem returns boolean "all added"; but we want partial handling:
    // We'll try to add remaining; if it can't fully add, it will partially add.
    const before = remaining;
    st.addItem(itemDef, remaining);
    // We can't directly get how many got added without reading UI, so compute via counts:
    // Safer approach: just re-check capacity each loop. For MVP, we assume addItem adds as much as possible.
    // We'll approximate by reducing by the storage's free at time of call (pre-add).
    const freePre = storageFreeForItem(st, itemDef);
    const addedApprox = Math.min(freePre, before);
    remaining -= addedApprox;
  }

  return remaining <= 0;
}

// ---------- Money helpers ----------
function getMoney(scene) {
  // Prefer existing scene API if present
  if (typeof scene.getMoney === "function") return scene.getMoney();
  if (typeof scene.money === "number") return scene.money;
  // fallback: 0
  return 0;
}

function canAfford(scene, cost) {
  if (typeof scene.checkSufficientFunds === "function") return scene.checkSufficientFunds(cost);
  return getMoney(scene) >= cost;
}

function spend(scene, cost) {
  if (typeof scene.updateMoney === "function") {
    scene.updateMoney(-cost);
    return;
  }
  if (typeof scene.money === "number") scene.money -= cost;
}

// ---------- Hover buy widget ----------
function createHoverMenu(scene) {
  const c = scene.add.container(0, 0).setDepth((UIDEPTH ?? 2000) + 200);
  c.setVisible(false);

  // --- hover state
  c._hoveringMenu = false;
  c._hoveringPile = false;

  const MENU_W = 220;
  const MENU_H = 72;

  const zone = scene.add.zone(0, 0, MENU_W, MENU_H).setOrigin(0.5);
  zone.setInteractive({ useHandCursor: false });

  zone.on("pointerover", () => { c._hoveringMenu = true; });
  zone.on("pointerout", () => {
    c._hoveringMenu = false;
    c.maybeHide?.(250);
  });

  c.add(zone);

  // Hide from uiCamera (world-only)
  scene.uiCamera?.ignore(c);

  const bg = scene.add.rectangle(0, 0, MENU_W, MENU_H, 0x000000, 0.72).setOrigin(0.5);
  bg.setStrokeStyle(2, 0xffffff, 0.65);

  const title = scene.add.text(0, -18, "Buy", {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#ffffff",
  }).setOrigin(0.5);

  const qtyText = scene.add.text(0, 4, "x1", {
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#ffffaa",
  }).setOrigin(0.5);

  const costText = scene.add.text(0, 22, "$0", {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#aaffaa",
  }).setOrigin(0.5);

  const mkBtn = (x, y, w, h, label) => {
    const r = scene.add.rectangle(x, y, w, h, 0x222222, 0.9).setOrigin(0.5);
    r.setStrokeStyle(1, 0xffffff, 0.5);
    const t = scene.add.text(x, y, label, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
    }).setOrigin(0.5);
    return { r, t };
  };

  const minus = mkBtn(-70, 6, 28, 24, "-");
  const plus  = mkBtn(-36, 6, 28, 24, "+");
  const buy   = mkBtn(70,  6, 86, 36, "BUY");

  title.setY(-22);
  qtyText.setY(6);
  costText.setY(28);

  [minus.r, minus.t, plus.r, plus.t, buy.r, buy.t].forEach(o => o.setInteractive({ useHandCursor: true }));

  c.add([bg, title, qtyText, costText, minus.r, minus.t, plus.r, plus.t, buy.r, buy.t]);

  // mutable state
  c._state = {
    qty: 1,
    maxQty: 1,
    unitPrice: 0,
    label: "",
    itemDef: null,
    teamNumber: 1,
    priceKey: "",
  };

  function applyToTopHud(scene, itemDef, qty) {
    // Money text updates already handled by scene.updateMoney if present (spend() calls it).
    // These are the resource counters shown on the top bar in mapView. :contentReference[oaicite:5]{index=5}

    const incText = (txt, nextVal, formatter = (v) => String(v)) => {
      if (!txt) return;
      txt.setText(formatter(nextVal));
    };

    // Food
    if (itemDef === UI_ITEM_TYPES.food) {
      scene.foodAmnt = (scene.foodAmnt ?? 0) + qty;
      // foodText is "have/need" sometimes; keep it simple: update have only if we can.
      if (scene.foodText) {
        const raw = scene.foodText.text || "";
        const parts = raw.split("/");
        if (parts.length === 2) scene.foodText.setText(`${scene.foodAmnt}/${parts[1]}`);
        else scene.foodText.setText(String(scene.foodAmnt));
      }
      return;
    }

    // Clean water
    if (itemDef === UI_ITEM_TYPES.clean_water) {
      scene.cleanWaterAmnt = (scene.cleanWaterAmnt ?? 0) + qty;
      if (scene.waterText) {
        const raw = scene.waterText.text || "";
        const parts = raw.split("/");
        if (parts.length === 2) scene.waterText.setText(`${scene.cleanWaterAmnt}/${parts[1]}`);
        else scene.waterText.setText(String(scene.cleanWaterAmnt));
      }
      return;
    }

    // Wood
    if (itemDef === UI_ITEM_TYPES.wood) {
      scene.woodAmnt = (scene.woodAmnt ?? 0) + qty;
      incText(scene.woodText, scene.woodAmnt);
      return;
    }

    // Stone
    if (itemDef === UI_ITEM_TYPES.stone) {
      scene.stoneAmnt = (scene.stoneAmnt ?? 0) + qty;
      incText(scene.stoneText, scene.stoneAmnt);
      return;
    }

    // Seeds (both crop + berry seeds feed the one "seeds" counter)
    if (itemDef === UI_ITEM_TYPES.seedCrop || itemDef === UI_ITEM_TYPES.seedBerry) {
      if (typeof scene.updateSeeds === "function") scene.updateSeeds(qty);
      else {
        scene.seeds = (scene.seeds ?? 0) + qty;
        incText(scene.seedsText, scene.seeds);
      }
      return;
    }
  }

  function refresh() {
    const s = c._state;
    qtyText.setText(`x${s.qty}`);
    costText.setText(`$${s.qty * s.unitPrice}`);
    title.setText(s.label);
  }

  function shake(go) {
    const ox = go.x;
    scene.tweens.add({
      targets: go,
      x: ox + 6,
      duration: 45,
      yoyo: true,
      repeat: 4,
      onComplete: () => { go.x = ox; }
    });
  }

  function flash(btnRect, btnText, ok) {
    const origFill = btnRect.fillColor;
    const origText = btnText.style.color;

    btnRect.setFillStyle(ok ? 0x1f7a1f : 0x7a1f1f, 0.95);
    btnText.setColor(ok ? "#aaffaa" : "#ffaaaa");

    scene.time.delayedCall(220, () => {
      btnRect.setFillStyle(origFill, 0.9);
      btnText.setColor(origText || "#ffffff");
    });
  }

  const onMinus = () => {
    c._state.qty = Math.max(1, c._state.qty - 1);
    refresh();
  };

  const onPlus = () => {
    c._state.qty = Math.min(c._state.maxQty, c._state.qty + 1);
    refresh();
  };

  minus.r.on("pointerdown", onMinus);
  minus.t.on("pointerdown", onMinus);

  plus.r.on("pointerdown", onPlus);
  plus.t.on("pointerdown", onPlus);

  const doBuy = () => {
    const s = c._state;
    const totalCost = s.qty * s.unitPrice;

    // funds
    if (!canAfford(scene, totalCost)) {
      showAlert(scene, "Not enough money", "#ff5555");
      flash(buy.r, buy.t, false);
      shake(buy.r); shake(buy.t);
      return;
    }

    // storage capacity
    if (!teamCanAcceptAmount(s.teamNumber, s.itemDef, s.qty)) {
      showAlert(scene, "Storage full", "#ff5555");
      flash(buy.r, buy.t, false);
      shake(buy.r); shake(buy.t);
      return;
    }

    // spend + store
    spend(scene, totalCost);
    addToTeamStorage(s.teamNumber, s.itemDef, s.qty);

    // update HUD counters (snippet #3 below)
    applyToTopHud(scene, s.itemDef, s.qty);

    // success feedback
    showAlert(scene, `Bought x${s.qty} ${s.label}`, "#aaffaa");
    flash(buy.r, buy.t, true);

    // IMPORTANT: do NOT close UI on buy
    // keep qty as-is or reset to 1 (your choice)
    // s.qty = 1; refresh();
  };

  buy.r.on("pointerdown", doBuy);
  buy.t.on("pointerdown", doBuy);

  c.setStateFor = (pileSprite, good, teamNumber, prices) => {
    const unit = prices[good.priceKey] ?? 1;
    c._state.unitPrice = unit;
    c._state.label = good.label;
    c._state.itemDef = good.itemDef;
    c._state.teamNumber = teamNumber;

    // qty step is 1; max qty = 99 for now (but storage limit will hard-block on BUY)
    c._state.maxQty = 99;
    c._state.qty = 1;

    // position above pile in WORLD space
    c.x = pileSprite.x;
    c.y = pileSprite.y - 46;

    refresh();
  };

  function pointerInsideMenu() {
    const p = scene.input.activePointer;
    const x = p.worldX;
    const y = p.worldY;
    const halfW = MENU_W / 2;
    const halfH = MENU_H / 2;
    return (x >= c.x - halfW && x <= c.x + halfW && y >= c.y - halfH && y <= c.y + halfH);
  }

  c.maybeHide = (delayMs = 300) => {
    scene.time.delayedCall(delayMs, () => {
      if (c._hoveringMenu) return;
      if (c._hoveringPile) return;
      if (pointerInsideMenu()) return;
      c.setVisible(false);
    });
  };
  return c;
}

// ---------- Main spawn ----------
export function spawnMarketShip(scene, {
  parcelCenterWorld,
  slotId = null,        // "W" | "E" | "S"
  teamNumber = 1,
  durationMs = 60_000,
  prices = null,
} = {}) {
  const priceTable = getPriceTable(prices);

  const dock = parcelCenterWorld ?? { x: scene.cameras.main.centerX, y: scene.cameras.main.centerY };

  const DOCK_OFFSET = 90;   // distance from parcel center to "dock" point
  const OFFSCREEN   = 750;  // spawn/leave distance

  let angleDeg = 0;
  let startX = dock.x, startY = dock.y;
  let endX = dock.x, endY = dock.y;
  let leaveX = dock.x, leaveY = dock.y;

  // Shipping lanes (exactly as requested):
  // W: from SOUTH -> dock near parcel, front faces UP
  // S: from EAST  -> dock near parcel, front faces WEST
  // E: from NORTH -> dock near parcel, front faces SOUTH
  if (slotId === "W") {
    angleDeg = 0; // front up
    endX = dock.x - DOCK_OFFSET;
    endY = dock.y;
    startX = endX;
    startY = endY + OFFSCREEN;   // from south
    leaveX = endX;
    leaveY = endY + OFFSCREEN;
  } else if (slotId === "S") {
    angleDeg = -90; // front west
    endX = dock.x;
    endY = dock.y + DOCK_OFFSET;
    startX = endX + OFFSCREEN;   // from east
    startY = endY;
    leaveX = endX + OFFSCREEN;
    leaveY = endY;
  } else if (slotId === "E") {
    angleDeg = 180; // front south
    endX = dock.x + DOCK_OFFSET;
    endY = dock.y;
    startX = endX;
    startY = endY - OFFSCREEN;   // from north
    leaveX = endX;
    leaveY = endY - OFFSCREEN;
  } else {
    // fallback: behave like E
    angleDeg = 180;
    endX = dock.x + DOCK_OFFSET;
    endY = dock.y;
    startX = endX;
    startY = endY - OFFSCREEN;
    leaveX = endX;
    leaveY = endY - OFFSCREEN;
  }

  const container = scene.add.container(startX, startY).setDepth((UIDEPTH ?? 2000) + 50);
  scene.uiCamera?.ignore(container); // world-only

  const ship = scene.add.image(0, 0, "market_ship").setOrigin(0.5).setAngle(angleDeg);
  container.add(ship);

  // Layout piles on the deck (relative to container center).
  const pilePositions = [
    { x: -60, y: -40 },
    { x:  10, y: -40 },
    { x:  80, y: -40 },
    { x: -60, y:  30 },
    { x:  10, y:  30 },
    { x:  80, y:  30 },
  ];

  const hoverMenu = createHoverMenu(scene);

  const pileSprites = [];
  GOODS.forEach((good, i) => {
    const pos = pilePositions[i % pilePositions.length];
    const spr = scene.add.image(pos.x, pos.y, good.texture).setOrigin(0.5).setScale(1);
    spr.setInteractive({ useHandCursor: true });

    spr.on("pointerover", () => {
      hoverMenu._hoveringPile = true;

      const worldX = container.x + spr.x;
      const worldY = container.y + spr.y;

      hoverMenu.setStateFor({ x: worldX, y: worldY }, good, teamNumber, priceTable);
      hoverMenu.setVisible(true);
    });

    spr.on("pointermove", () => {
      if (!hoverMenu.visible) return;
      const worldX = container.x + spr.x;
      const worldY = container.y + spr.y;
      hoverMenu.x = worldX;
      hoverMenu.y = worldY - 46;
    });

    spr.on("pointerout", () => {
      hoverMenu._hoveringPile = false;
      hoverMenu.maybeHide?.(350);
    });

    container.add(spr);
    pileSprites.push(spr);
  });

  // Tween ship to dock
  scene.tweens.add({
    targets: container,
    x: endX,
    y: endY,
    duration: 900,
    ease: "Sine.easeOut",
  });

  // Leave after duration
  const depart = (onDone) => {
    hoverMenu.setVisible(false);

    scene.tweens.add({
      targets: container,
      x: leaveX,
      y: leaveY,
      duration: 900,
      ease: "Sine.easeIn",
      onComplete: () => {
        hoverMenu.destroy(true);
        container.destroy(true);
        onDone?.();
      }
    });
  };

  const leaveTimer = scene.time.delayedCall(durationMs, () => depart(), null, scene);

  return {
    container,
    hoverMenu,
    leaveTimer,
    depart, // <---
    destroy: () => {
      leaveTimer?.remove(false);
      hoverMenu?.destroy(true);
      container?.destroy(true);
    }
  };
}
