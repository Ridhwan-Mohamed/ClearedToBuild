
// src/UI/ShipMarket.js
//
// World-space "market ship" that docks beside the parcel that bought the Market contract.
// - No navgrid: ship is a sprite + pile sprites.
// - Hover a pile -> tiny world-space buy widget above it.
// - UI is rendered on the active world camera.
// - Current ship offers seeds, berries, and one rotating card offer.
//
// Usage:
//   1) In your scene preload: loadShipMarketAssets(this);
//   2) On Market contract spawn: spawnMarketShip(this, { parcelCenterWorld: {x,y}, teamNumber: 1, durationMs: 60000 });
//   3) On contract complete: destroy returned handle or call handle.destroy().

import Phaser from "phaser";
import shipPng from "url:../assets/ship/ship.png";
import foodPilePng from "url:../assets/ship/food_pile.png";
import waterPilePng from "url:../assets/ship/water_pile.png";
import cropPilePng from "url:../assets/ship/crop_pile.png";
import berryPilePng from "url:../assets/ship/berry_pile.png";
import woodPilePng from "url:../assets/ship/wood_pile.png";
import stonePilePng from "url:../assets/ship/stone_pile.png";
import shipMiniCardPng from "url:../assets/ship/mini_card.png";

import { showAlert, UIDEPTH } from "../constants";
import { Teams } from "../Teams";
import { POWERUP_CARDS } from "../Cards/PowerupCards";
import { addCardToHand, getCardHand } from "./Powerups";
import { createWorldCardPreview, getCardOutlineTint } from "./CardPreview";
import { StorageManager } from "../Manager/StorageManager";
import { UI_ITEM_TYPES } from "./UIConstants";

// Default prices should match DraftStartState.prices.supplies.
// If you have a live DraftStartState instance on scene, pass it in spawnMarketShip({ prices }).
export const DEFAULT_SUPPLY_PRICES = Object.freeze({
  seeds: 2,
  berries: 3,
  card: 80,
});

const BASE_GOODS = [
  { key: "seeds", label: "Seeds", texture: "ship_crop_pile", priceKey: "seeds", kind: "counter", maxQty: 99 },
  { key: "berries", label: "Berries", texture: "ship_berry_pile", priceKey: "berries", kind: "counter", maxQty: 99 },
];

export function loadShipMarketAssets(scene) {
  scene.load.image("market_ship", shipPng);
  scene.load.image("ship_food_pile", foodPilePng);
  scene.load.image("ship_water_pile", waterPilePng);
  scene.load.image("ship_crop_pile", cropPilePng);
  scene.load.image("ship_berry_pile", berryPilePng);
  scene.load.image("ship_wood_pile", woodPilePng);
  scene.load.image("ship_stone_pile", stonePilePng);
  scene.load.image("ship_mini_card", shipMiniCardPng);
}

function getPriceTable(pricesMaybe) {
  if (pricesMaybe && typeof pricesMaybe === "object") {
    return { ...DEFAULT_SUPPLY_PRICES, ...pricesMaybe };
  }
  return { ...DEFAULT_SUPPLY_PRICES };
}

function getHeldCardIds(teamNumber) {
  const hand = getCardHand(String(teamNumber)) ?? [];
  return new Set(hand.map(card => card?.id).filter(Boolean));
}

function getEligibleShipCards(teamNumber, excludeIds = []) {
  const blocked = getHeldCardIds(teamNumber);
  excludeIds.forEach(id => id && blocked.add(id));
  return POWERUP_CARDS.filter(card => card?.id && !blocked.has(card.id));
}

function pickShipCard(teamNumber, excludeIds = []) {
  const pool = getEligibleShipCards(teamNumber, excludeIds);
  if (!pool.length) return null;
  return Phaser.Utils.Array.GetRandom(pool);
}

function createShipGoods(teamNumber) {
  const goods = BASE_GOODS.map(good => ({ ...good }));
  const card = pickShipCard(teamNumber);
  if (card) {
    goods.push({
      key: `card:${card.id}`,
      label: card.name,
      texture: "ship_mini_card",
      priceKey: "card",
      kind: "card",
      maxQty: 1,
      card,
      soldOut: false,
    });
  }
  return goods;
}

// ---------- Storage capacity helpers (block overfill purchases) ----------

function getStorageItemForGood(goodKey) {
  switch (goodKey) {
    case "seeds":
      return UI_ITEM_TYPES.seedCrop;
    case "berries":
      return UI_ITEM_TYPES.seedBerry;
    default:
      return null;
  }
}

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

function teamFreeForItem(teamNumber, itemDef) {
  const storages = Teams.teamLists?.[String(teamNumber)]?.storageList ?? Teams.teamLists?.[teamNumber]?.storageList ?? [];
  let free = 0;
  for (const st of storages) {
    free += storageFreeForItem(st, itemDef);
  }
  return free;
}

function teamCanAcceptAmount(teamNumber, itemDef, amount) {
  return teamFreeForItem(teamNumber, itemDef) >= amount;
}

function addToTeamStorage(teamNumber, itemDef, amount, scene) {
  return StorageManager.grantItemToTeam(String(teamNumber), itemDef, amount, scene);
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

  c._hoveringMenu = false;
  c._hoveringPile = false;
  c._activePreview = null;

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

  const bg = scene.add.rectangle(0, 0, MENU_W, MENU_H, 0x000000, 0.72).setOrigin(0.5);
  bg.setStrokeStyle(2, 0xffffff, 0.65);

  const title = scene.add.text(0, -18, "Buy", {
    fontFamily: "Bungee",
    fontSize: "12px",
    color: "#ffffff",
  }).setOrigin(0.5);

  const qtyText = scene.add.text(0, 4, "x1", {
    fontFamily: "Bungee",
    fontSize: "14px",
    color: "#ffffaa",
  }).setOrigin(0.5);

  const costText = scene.add.text(0, 22, "$0", {
    fontFamily: "Bungee",
    fontSize: "12px",
    color: "#aaffaa",
  }).setOrigin(0.5);

  const mkBtn = (x, y, w, h, label) => {
    const r = scene.add.rectangle(x, y, w, h, 0x222222, 0.9).setOrigin(0.5);
    r.setStrokeStyle(1, 0xffffff, 0.5);
    const t = scene.add.text(x, y, label, {
      fontFamily: "Bungee",
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

  c._state = {
    qty: 1,
    maxQty: 1,
    unitPrice: 0,
    label: "",
    teamNumber: 1,
    good: null,
    availableQty: 0,
    storageFull: false,
  };

  function refresh() {
    const s = c._state;
    title.setText(s.label || "Buy");
    if (s.good?.kind === "counter" && s.storageFull) {
      qtyText.setText("Full");
      costText.setText("No storage room");
    } else {
      qtyText.setText(s.good?.kind === "card" ? "Unique" : `x${s.qty}`);
      costText.setText(`$${s.qty * s.unitPrice}`);
    }
    const allowQty = s.good?.kind !== "card";
    [minus.r, minus.t, plus.r, plus.t].forEach(node => {
      node.setVisible(allowQty);
      if (node.input) node.input.enabled = allowQty;
    });
    buy.r.setAlpha(s.storageFull ? 0.5 : 1);
    buy.t.setAlpha(s.storageFull ? 0.5 : 1);
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

  c._refreshPreviewPosition = () => {
    if (!c._activePreview) return;
    c._activePreview.setPosition(c.x + 150, c.y - 58);
  };

  c._setPreviewForGood = (good) => {
    c._activePreview?.hide?.();
    c._activePreview = null;

    if (good?.kind !== "card" || !good.card) return;

    if (!good.preview) {
      good.preview = createWorldCardPreview(scene, good.card, c.x + 150, c.y - 58, { depth: (UIDEPTH ?? 2000) + 240 });
    }
    c._activePreview = good.preview;
    c._refreshPreviewPosition();
    c._activePreview.show();
  };

  c.hidePreview = () => {
    c._activePreview?.hide?.();
    c._activePreview = null;
  };

  const onMinus = () => {
    if (c._state.good?.kind === "card") return;
    c._state.qty = Math.max(1, c._state.qty - 1);
    refresh();
  };

  const onPlus = () => {
    if (c._state.good?.kind === "card") return;
    c._state.qty = Math.min(c._state.maxQty, c._state.qty + 1);
    refresh();
  };

  minus.r.on("pointerdown", onMinus);
  minus.t.on("pointerdown", onMinus);

  plus.r.on("pointerdown", onPlus);
  plus.t.on("pointerdown", onPlus);

  const doBuy = () => {
    const s = c._state;
    const good = s.good;
    if (!good) return;

    const totalCost = s.qty * s.unitPrice;
    if (!canAfford(scene, totalCost)) {
      showAlert(scene, "Not enough money", "#ff5555");
      flash(buy.r, buy.t, false);
      shake(buy.r);
      shake(buy.t);
      return;
    }

    if (good.kind === "counter") {
      const itemDef = getStorageItemForGood(good.key);
      if (!itemDef) {
        showAlert(scene, "That market item is not configured", "#ff5555");
        flash(buy.r, buy.t, false);
        return;
      }
      if (s.storageFull || !teamCanAcceptAmount(s.teamNumber, itemDef, s.qty)) {
        showAlert(scene, "Not enough storage space", "#ff5555");
        flash(buy.r, buy.t, false);
        shake(buy.r);
        shake(buy.t);
        return;
      }

      spend(scene, totalCost);
      const added = addToTeamStorage(s.teamNumber, itemDef, s.qty, scene);
      if (added <= 0) {
        spend(scene, -totalCost);
        showAlert(scene, "Not enough storage space", "#ff5555");
        flash(buy.r, buy.t, false);
        shake(buy.r);
        shake(buy.t);
        return;
      }

      if (added < s.qty) {
        spend(scene, -((s.qty - added) * s.unitPrice));
      }

      showAlert(scene, `Bought x${added} ${good.label}`, "#aaffaa");
      flash(buy.r, buy.t, true);
      return;
    }

    if (good.kind === "card") {
      if (!good.card || good.soldOut) {
        showAlert(scene, "No card available", "#ff5555");
        flash(buy.r, buy.t, false);
        return;
      }

      const hand = getCardHand(String(s.teamNumber)) ?? [];
      if (hand.some(card => card?.id === good.card?.id)) {
        showAlert(scene, "That card is already in hand", "#ff5555");
        flash(buy.r, buy.t, false);
        return;
      }
      if (hand.length >= 5) {
        showAlert(scene, "Card hand full", "#ff5555");
        flash(buy.r, buy.t, false);
        return;
      }

      spend(scene, totalCost);
      const added = addCardToHand(good.card, String(s.teamNumber));
      if (!added) {
        spend(scene, -totalCost);
        showAlert(scene, "Card hand full", "#ff5555");
        flash(buy.r, buy.t, false);
        return;
      }

      good.soldOut = true;
      good.onSoldOut?.();
      scene.events.emit("cards:updated");
      showAlert(scene, `Bought card: ${good.card.name}`, "#aaffaa");
      flash(buy.r, buy.t, true);
      c.hidePreview();
      c.setVisible(false);
      return;
    }
  };

  buy.r.on("pointerdown", doBuy);
  buy.t.on("pointerdown", doBuy);

  c.setStateFor = (pileSprite, good, teamNumber, prices) => {
    const unit = prices[good.priceKey] ?? 1;
    const itemDef = good.kind === "counter" ? getStorageItemForGood(good.key) : null;
    const availableQty = itemDef ? teamFreeForItem(teamNumber, itemDef) : 0;
    c._state.unitPrice = unit;
    c._state.label = good.label;
    c._state.teamNumber = teamNumber;
    c._state.good = good;
    c._state.availableQty = availableQty;
    c._state.storageFull = good.kind === "counter" && availableQty <= 0;
    c._state.maxQty = good.kind === "counter"
      ? Math.max(1, Math.min(good.maxQty ?? 1, Math.max(0, availableQty)))
      : Math.max(1, good.maxQty ?? 1);
    c._state.qty = 1;

    c.x = pileSprite.x;
    c.y = pileSprite.y - 46;
    c._setPreviewForGood(good);
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
      c.hidePreview();
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
  const shipGoods = createShipGoods(teamNumber);

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
  shipGoods.forEach((good, i) => {
    const pos = pilePositions[i % pilePositions.length];
    const spr = scene.add.image(pos.x, pos.y, good.texture).setOrigin(0.5).setScale(1);
    if (good.kind === "card" && good.card) {
      spr.setTint(getCardOutlineTint(good.card));
      spr.setScale(1.15);
    }
    spr.setInteractive({ useHandCursor: true });

    good.onSoldOut = () => {
      spr.disableInteractive();
      spr.setAlpha(0.32);
      spr.clearTint();
    };

    spr.on("pointerover", () => {
      if (good.kind === "card") {
        if (good.soldOut) return;
        const replacement = pickShipCard(teamNumber);
        if (!replacement) {
          good.onSoldOut?.();
          hoverMenu.hidePreview?.();
          hoverMenu.setVisible(false);
          return;
        }
        if (!good.card || getHeldCardIds(teamNumber).has(good.card.id)) {
          good.card = replacement;
          good.label = replacement.name;
          good.preview?.destroy?.();
          good.preview = null;
          spr.setTint(getCardOutlineTint(good.card));
        }
      }

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
      hoverMenu._refreshPreviewPosition?.();
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
    hoverMenu.hidePreview?.();

    scene.tweens.add({
      targets: container,
      x: leaveX,
      y: leaveY,
      duration: 900,
      ease: "Sine.easeIn",
      onComplete: () => {
        scene.events.off("cards:updated", onCardsUpdated);
        shipGoods.forEach(good => good.preview?.destroy?.());
        hoverMenu.destroy(true);
        container.destroy(true);
        onDone?.();
      }
    });
  };

  const leaveTimer = scene.time.delayedCall(durationMs, () => depart(), null, scene);

  const onCardsUpdated = () => {
    const heldIds = getHeldCardIds(teamNumber);
    pileSprites.forEach((spr, index) => {
      const good = shipGoods[index];
      if (good?.kind !== "card" || good.soldOut) return;
      if (good.card && !heldIds.has(good.card.id)) return;
      const replacement = pickShipCard(teamNumber);
      if (!replacement) {
        good.card = null;
        good.onSoldOut?.();
        return;
      }
      good.card = replacement;
      good.label = replacement.name;
      good.preview?.destroy?.();
      good.preview = null;
      spr.setAlpha(1);
      spr.setInteractive({ useHandCursor: true });
      spr.setTint(getCardOutlineTint(replacement));
    });
  };

  scene.events.on("cards:updated", onCardsUpdated);

  return {
    container,
    hoverMenu,
    leaveTimer,
    depart, // <---
    destroy: () => {
      leaveTimer?.remove(false);
      scene.events.off("cards:updated", onCardsUpdated);
      shipGoods.forEach(good => good.preview?.destroy?.());
      hoverMenu?.destroy(true);
      container?.destroy(true);
    }
  };
}

