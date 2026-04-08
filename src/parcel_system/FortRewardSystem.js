import Phaser from 'phaser';
import { POWERUP_CARDS } from "../Cards/PowerupCards";
import { House } from "../buildings/House";
import { SQUARESIZE, UIDEPTH, showAlert } from "../constants";
import { addCardToHand, getCardHand } from "../UI/Powerups";
import { createWorldCardPreview, getCardOutlineTint } from "../UI/CardPreview";
import { Builder } from "../players/Builder";
import { Farmer } from "../players/Farmer";
import { Fireman } from "../players/Fireman";
import { Forager } from "../players/Forager";
import { Gunslinger } from "../players/Gunslinger";
import { Blademaster } from "../players/Blademaster";
import { Brawler } from "../players/Brawler";
import { StorageManager } from "../Manager/StorageManager";
import { UI_ITEM_TYPES } from "../UI/UIConstants";

const TEAM_ID = "1";
const NO_HOUSE_FALLBACK_MONEY = 500;

const PLAYER_REWARDS = [
  { key: "farmer", name: "Farmer", tint: 0x8b5a2b, ctor: Farmer },
  { key: "builder", name: "Builder", tint: 0x4433ff, ctor: Builder },
  { key: "forager", name: "Forager", tint: 0x228b22, ctor: Forager },
  { key: "fireman", name: "Fireman", tint: 0xff9933, ctor: Fireman },
  { key: "gunslinger", name: "Gunslinger", tint: 0x9999ff, ctor: Gunslinger },
  { key: "blademaster", name: "Blademaster", tint: 0xaa33ee, ctor: Blademaster },
  { key: "brawler", name: "Brawler", tint: 0xffd712, ctor: Brawler },
];

const CHEST_REWARDS = [
  {
    key: "money",
    name: "Money Chest",
    contents: [{ key: "monies", label: "Money", amount: 250 }],
    grant: (scene) => {
      scene.updateMoney?.(250);
      showAlert(scene, "+$250", "#aaffaa");
    }
  },
  {
    key: "resource",
    name: "Resource Chest",
    contents: [
      { key: "woodIcon", label: "Wood", amount: 6 },
      { key: "stoneIcon", label: "Stone", amount: 6 },
      { key: "seeds", label: "Seeds", amount: 4 },
    ],
    grant: (scene) => {
      addResource(scene, "wood", 6);
      addResource(scene, "stone", 6);
      addResource(scene, "seeds", 4);
      showAlert(scene, "+Resources", "#aaffaa");
    }
  },
  {
    key: "survival",
    name: "Food + Water Chest",
    contents: [
      { key: "foodIcon", label: "Food", amount: 8 },
      { key: "waterIcon", label: "Water", amount: 8 },
      { key: "berry", label: "Berry", amount: 3 },
    ],
    grant: (scene) => {
      addResource(scene, "food", 8);
      addResource(scene, "clean_water", 8);
      addResource(scene, "berry", 3);
      showAlert(scene, "+Food + Water", "#aaffaa");
    }
  },
];

function worldify(scene, go) {
  if (!go) return go;
  return go;
}

function addResource(scene, key, amount) {
  if (!amount) return;
  if (key === "money") {
    scene.updateMoney?.(amount);
    return;
  }
  const itemType = ({
    seeds: UI_ITEM_TYPES.seedCrop,
    berry: UI_ITEM_TYPES.seedBerry,
    berries: UI_ITEM_TYPES.seedBerry,
    wood: UI_ITEM_TYPES.wood,
    stone: UI_ITEM_TYPES.stone,
    food: UI_ITEM_TYPES.food,
    clean_water: UI_ITEM_TYPES.clean_water,
    water: UI_ITEM_TYPES.clean_water,
  })[key];

  if (!itemType) return;
  StorageManager.grantItemToTeam(TEAM_ID, itemType, amount, scene);
}

function safeDestroy(go) {
  if (!go) return;
  try { go.destroy?.(); } catch {}
}

function pickRewardType(stageIndex) {
  const r = stageIndex % 3;
  if (r === 1) return "card";
  if (r === 2) return "chest";
  return "player";
}

function getFortCenter(meta) {
  const b = meta?.bounds;
  if (!b) return { x: 50 * SQUARESIZE, y: 25 * SQUARESIZE, gx: 50, gy: 25 };

  const gx = Math.floor((b.minx + b.maxx) / 2);
  const gy = Math.floor((b.miny + b.maxy) / 2);

  return {
    x: gx * SQUARESIZE + SQUARESIZE / 2,
    y: gy * SQUARESIZE + SQUARESIZE / 2,
    gx,
    gy,
  };
}

function rowPositions(cx, y, spacing = 165) {
  return [
    { x: cx - spacing, y },
    { x: cx, y },
    { x: cx + spacing, y },
  ];
}

function randomCards(count = 3) {
  const pool = POWERUP_CARDS.slice();
  Phaser.Utils.Array.Shuffle(pool);
  return pool.slice(0, Math.min(count, pool.length));
}

function chestTooltip(scene, x, y, chestDef) {
  const bg = worldify(scene, scene.add.rectangle(x, y, 180, 90, 0x000000, 0.72)
    .setStrokeStyle(1, 0xffffff, 0.5)
    .setDepth(10020)
    .setVisible(false));

  const title = worldify(scene, scene.add.text(x, y - 30, chestDef.name, {
    fontSize: "12px",
    color: "#ffffff",
    fontFamily: "Bungee",
    fontStyle: "bold",
  }).setOrigin(0.5).setDepth(10021).setVisible(false));

  const lines = [];
  chestDef.contents.forEach((entry, i) => {
    const ey = y - 10 + i * 20;
    const icon = worldify(scene, scene.add.image(x - 55, ey, entry.key).setScale(0.6).setDepth(10021).setVisible(false));
    const text = worldify(scene, scene.add.text(x - 40, ey, `+${entry.amount} ${entry.label}`, {
      fontSize: "12px",
      color: "#d8d8d8",
      fontFamily: "Bungee"
    }).setOrigin(0, 0.5).setDepth(10021).setVisible(false));
    lines.push(icon, text);
  });

  const list = [bg, title, ...lines];

  return {
    list,
    show() { list.forEach(o => o.setVisible(true)); },
    hide() { list.forEach(o => o.setVisible(false)); },
    destroy() { list.forEach(safeDestroy); }
  };
}

function animateChest(sprite, toFrame, scene) {
  const from = sprite.frame?.name ?? 0;
  if (from === toFrame) return;

  sprite._frameTimer?.remove(false);
  const dir = toFrame > from ? 1 : -1;

  sprite._frameTimer = scene.time.addEvent({
    delay: 45,
    loop: true,
    callback: () => {
      if (!sprite.active) {
        sprite._frameTimer?.remove(false);
        return;
      }
      const next = (sprite.frame?.name ?? 0) + dir;
      sprite.setFrame(next);
      if (next === toFrame) sprite._frameTimer?.remove(false);
    }
  });
}

function openSwapOverlay(scene, incomingCard, onDone) {
  const hand = getCardHand(TEAM_ID);
  const cam = scene.cameras.main;

  const overlay = scene.add.container(0, 0).setDepth((UIDEPTH ?? 10) + 1000);
  overlay.setScrollFactor(0);
  scene.cameras.main.ignore(overlay);

  const shade = scene.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.75)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0);

  const title = scene.add.text(cam.centerX, 70, "Hand Full - Choose a Card to Replace", {
    fontSize: "18px",
    color: "#ffffff",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setScrollFactor(0);

  const subtitle = scene.add.text(cam.centerX, 95, `New: ${incomingCard.name}`, {
    fontSize: "12px",
    color: "#cccccc",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setScrollFactor(0);

  overlay.add([shade, title, subtitle]);

  const y = 200;
  const slotW = 160;
  const slotH = 190;
  const spacing = 175;
  const startX = cam.centerX - 2 * spacing;

  for (let i = 0; i < 5; i++) {
    const x = startX + i * spacing;
    const existing = hand[i];

    const bg = scene.add.rectangle(x, y, slotW, slotH, 0x222222, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);

    const iconBg = scene.add.rectangle(x, y - 35, 50, 50, 0x111111, 1)
      .setStrokeStyle(1, 0xffffff, 0.4)
      .setScrollFactor(0);

    const name = scene.add.text(x, y - 70, existing?.name || "(empty?)", {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Bungee"
    }).setOrigin(0.5).setScrollFactor(0);

    const desc = scene.add.text(x, y + 25, existing?.text || "", {
      fontSize: "12px",
      color: "#cccccc",
      wordWrap: { width: slotW - 20 }
    }).setOrigin(0.5).setScrollFactor(0);

    const icon = existing?.image
      ? scene.add.image(x, y - 35, existing.image).setScale(1).setScrollFactor(0)
      : scene.add.text(x, y - 35, "?", { fontSize: "18px", color: "#ffffff" }).setOrigin(0.5).setScrollFactor(0);

    bg.on("pointerdown", () => {
      const old = hand[i];
      if (old && typeof old.remove === "function") old.remove(scene);

      hand[i] = incomingCard;
      if (incomingCard && typeof incomingCard.apply === "function") incomingCard.apply(scene);

      scene.events.emit("cards:updated");
      overlay.destroy(true);
      onDone?.(true);
    });

    overlay.add([bg, iconBg, icon, name, desc]);
  }

  const cancelBg = scene.add.rectangle(cam.centerX, cam.height - 80, 220, 44, 0x550000, 0.85)
    .setStrokeStyle(2, 0xffffff)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0);

  const cancelTx = scene.add.text(cam.centerX, cam.height - 80, "Cancel", {
    fontSize: "16px",
    color: "#ffffff",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setScrollFactor(0);

  cancelBg.on("pointerdown", () => {
    overlay.destroy(true);
    onDone?.(false);
  });

  overlay.add([cancelBg, cancelTx]);
}

function grantCardReward(scene, card, onDone) {
  const hand = getCardHand(TEAM_ID);

  if (hand.length >= 5) {
    openSwapOverlay(scene, card, (selected) => {
      if (!selected) return;
      onDone?.();
    });
    return;
  }

  addCardToHand(card, TEAM_ID);
  scene.events.emit("cards:updated");
  onDone?.();
}

function buildChestReward(scene, meta, ctx, completeReward) {
  const center = getFortCenter(meta);
  const positions = rowPositions(center.x, center.y, 170);

  CHEST_REWARDS.forEach((chestDef, i) => {
    const pos = positions[i];
    const chest = worldify(scene, scene.add.sprite(pos.x, pos.y, "reward_treasure_chest", 0)
      .setDepth(10010)
      .setInteractive({ useHandCursor: true }));

    const tooltip = chestTooltip(scene, pos.x, pos.y - 95, chestDef);

    chest.on("pointerover", () => {
      animateChest(chest, 4, scene);
      tooltip.show();
    });

    chest.on("pointerout", () => {
      animateChest(chest, 0, scene);
      tooltip.hide();
    });

    chest.on("pointerdown", () => {
      chestDef.grant(scene);
      completeReward();
    });

    ctx.destroyers.push(() => {
      chest._frameTimer?.remove(false);
      tooltip.destroy();
      safeDestroy(chest);
    });
  });
}

function buildCardReward(scene, meta, ctx, completeReward) {
  const center = getFortCenter(meta);
  const cards = randomCards(3);
  const positions = rowPositions(center.x, center.y, 165);

  cards.forEach((card, i) => {
    const pos = positions[i];
    const tint = getCardOutlineTint(card);

    const mini = worldify(scene, scene.add.image(pos.x, pos.y, "reward_mini_card")
      .setDepth(10010)
      .setScale(1.25)
      .setTint(tint)
      .setInteractive({ useHandCursor: true }));

    const preview = createWorldCardPreview(scene, card, pos.x, pos.y - 150);

    mini.on("pointerover", () => preview.show());
    mini.on("pointerout", () => preview.hide());
    mini.on("pointerdown", () => {
      grantCardReward(scene, card, () => {
        showAlert(scene, `Picked card: ${card.name}`, "#aaffaa");
        completeReward();
      });
    });

    ctx.destroyers.push(() => {
      preview.destroy();
      safeDestroy(mini);
    });
  });
}

function buildPlayerReward(scene, meta, ctx, completeReward) {
  const center = getFortCenter(meta);
  const y = center.y;

  const title = worldify(scene, scene.add.text(center.x, y - 110, "PLAYER REWARD", {
    fontSize: "16px",
    color: "#ffffff",
    fontFamily: "Bungee",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(10015));

  const hint = worldify(scene, scene.add.text(center.x, y - 90, "Click arrows to pick class, then confirm", {
    fontSize: "12px",
    color: "#cccccc",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setDepth(10015));

  let index = 0;

  const preview = worldify(scene, scene.add.sprite(center.x, y, "player", 0)
    .setDepth(10010)
    .setScale(2.2)
    .setInteractive({ useHandCursor: true }));

  const left = worldify(scene, scene.add.text(center.x - 72, y, "<", {
    fontSize: "30px",
    color: "#ffffff",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setDepth(10015).setInteractive({ useHandCursor: true }));

  const right = worldify(scene, scene.add.text(center.x + 72, y, ">", {
    fontSize: "30px",
    color: "#ffffff",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setDepth(10015).setInteractive({ useHandCursor: true }));

  const name = worldify(scene, scene.add.text(center.x, y + 42, PLAYER_REWARDS[index].name, {
    fontSize: "15px",
    color: "#ffffff",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setDepth(10015));

  const confirmBg = worldify(scene, scene.add.rectangle(center.x, y + 75, 170, 32, 0x123312, 0.9)
    .setStrokeStyle(1, 0xaaffaa, 0.8)
    .setDepth(10014)
    .setInteractive({ useHandCursor: true }));

  const confirmText = worldify(scene, scene.add.text(center.x, y + 75, "Confirm Recruit", {
    fontSize: "14px",
    color: "#e7ffe7",
    fontFamily: "Bungee"
  }).setOrigin(0.5).setDepth(10015));

  const refresh = () => {
    const def = PLAYER_REWARDS[index];
    name.setText(def.name);
    preview.setTint(def.tint);
  };

  const cycle = (dir) => {
    index = (index + dir + PLAYER_REWARDS.length) % PLAYER_REWARDS.length;
    refresh();
  };

  left.on("pointerdown", () => cycle(-1));
  right.on("pointerdown", () => cycle(1));
  preview.on("pointerdown", () => cycle(1));

  confirmBg.on("pointerdown", () => {
    const def = PLAYER_REWARDS[index];
    const troop = new def.ctor(center.gx, center.gy, 1);

    const assigned = House.assignPlayerToHouse(troop, TEAM_ID);
    if (!assigned) {
      troop.destroySelf?.() ?? safeDestroy(troop);
      scene.updateMoney?.(NO_HOUSE_FALLBACK_MONEY);
      showAlert(scene, `No housing: +$${NO_HOUSE_FALLBACK_MONEY}`, "#ffcc88");
    } else {
      showAlert(scene, `Recruited: ${def.name}`, "#aaffaa");
    }

    completeReward();
  });

  refresh();

  ctx.destroyers.push(() => {
    [title, hint, preview, left, right, name, confirmBg, confirmText].forEach(safeDestroy);
  });
}

export function openFortRewardSelection(scene, { stageIndex, meta, onComplete } = {}) {
  const ctx = {
    done: false,
    destroyers: [],
  };

  const cleanup = () => {
    ctx.destroyers.forEach(fn => {
      try { fn?.(); } catch {}
    });
    ctx.destroyers.length = 0;
  };

  const finish = () => {
    if (ctx.done) return;
    ctx.done = true;
    cleanup();
    onComplete?.();
  };

  const type = pickRewardType(stageIndex ?? 1);

  if (type === "chest") {
    buildChestReward(scene, meta, ctx, finish);
  } else if (type === "player") {
    buildPlayerReward(scene, meta, ctx, finish);
  } else {
    buildCardReward(scene, meta, ctx, finish);
  }

  return {
    destroy: () => {
      if (ctx.done) return;
      ctx.done = true;
      cleanup();
    }
  };
}


