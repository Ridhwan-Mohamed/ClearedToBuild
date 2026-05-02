import Phaser from "phaser";

export const MARKET_CARD_KIND = Object.freeze({
  CONSUMABLE: "consumable",
});

export const MARKET_CARD_SECTION = Object.freeze({
  RECOVERY: "recovery",
  ATTACK: "attack",
  STRATEGY: "strategy",
});

export const MARKET_CARD_SECTIONS = Object.freeze([
  { key: MARKET_CARD_SECTION.RECOVERY, label: "Recovery" },
  { key: MARKET_CARD_SECTION.ATTACK, label: "Attack Items" },
  { key: MARKET_CARD_SECTION.STRATEGY, label: "Defense & Strategy" },
]);

export const MARKET_PLACEHOLDER_ASSETS = Object.freeze({
  storefront: "market_storefront_placeholder",
  uiPanel: "market_ui_panel_placeholder",
  uiAccent: "market_ui_accent_placeholder",
  cardSlotFrame: "market_card_slot_frame_placeholder",
  deckTab: "market_tab_deck_cards_placeholder",
  consumablesTab: "market_tab_consumables_placeholder",
  confirmButton: "card_confirm_button_placeholder",
  targetCursors: {
    chainZapper: "target_cursor_chain_zapper_placeholder",
    meteorDrop: "target_cursor_meteor_drop_placeholder",
    fortifyPatch: "target_cursor_fortify_patch_placeholder",
  },
  ghosts: {
    autoWall: "target_ghost_auto_wall_placeholder",
    decoyBeacon: "target_ghost_decoy_beacon_placeholder",
    shockMine: "target_ghost_shock_mine_placeholder",
  },
  cardIcons: {
    autoWall: "card_icon_auto_wall_placeholder",
    chainZapper: "card_icon_chain_zapper_placeholder",
    meteorDrop: "card_icon_meteor_drop_placeholder",
    decoyBeacon: "card_icon_decoy_beacon_placeholder",
    fortifyPatch: "card_icon_fortify_patch_placeholder",
    shockMine: "card_icon_shock_mine_placeholder",
    teamHeal: "card_icon_team_heal_placeholder",
    fighterHeal: "card_icon_fighter_heal_placeholder",
    workerHeal: "card_icon_worker_heal_placeholder",
    adrenalineDraft: "card_icon_adrenaline_draft_placeholder",
  },
});

export const MARKET_CARDS = Object.freeze([
  {
    id: "auto_wall",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.autoWall,
    name: "Auto Wall",
    text: "Preview and place a town perimeter wall with one tile of berth.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.STRATEGY,
    activation: "auto_wall",
    price: 900,
    OUTLINE: "#7bd9ff",
    balanceNote: "Permanent defense, priced as a late bailout.",
  },
  {
    id: "chain_zapper",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.chainZapper,
    name: "Chain Zapper",
    text: "Target a raider. A heavy zap chains through nearby raiders once each.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.ATTACK,
    activation: "chain_zapper",
    price: 480,
    OUTLINE: "#a7f0ff",
    balanceNote: "Single burst against clustered enemies.",
  },
  {
    id: "meteor_drop",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.meteorDrop,
    name: "Meteor Drop",
    text: "Target an area. Damages troops and buildings in the blast radius.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.ATTACK,
    activation: "meteor_drop",
    price: 650,
    OUTLINE: "#ffad73",
    balanceNote: "Friendly fire allowed; high impact with positioning risk.",
  },
  {
    id: "decoy_beacon",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.decoyBeacon,
    name: "Decoy Beacon",
    text: "Place a fragile lure. When destroyed, it explodes near raiders.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.STRATEGY,
    activation: "decoy_beacon",
    price: 380,
    OUTLINE: "#ffe07a",
    balanceNote: "Temporary target control, not a permanent blocker.",
  },
  {
    id: "fortify_patch",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.fortifyPatch,
    name: "Fortify Patch",
    text: "Select a building or wall to repair and temporarily reinforce.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.STRATEGY,
    activation: "fortify_patch",
    price: 340,
    OUTLINE: "#9dffa5",
    balanceNote: "Saves a target under pressure; does not build new economy.",
  },
  {
    id: "shock_mine",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.shockMine,
    name: "Shock Mine",
    text: "Place a trap that shocks and briefly disrupts enemies that trigger it.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.STRATEGY,
    activation: "shock_mine",
    price: 320,
    OUTLINE: "#b28cff",
    balanceNote: "One-shot area disruption.",
  },
  {
    id: "team_heal",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.teamHeal,
    name: "Team Heal",
    text: "Confirm to heal all team members by 50% max HP.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.RECOVERY,
    activation: "team_heal",
    price: 300,
    OUTLINE: "#7cffb2",
    balanceNote: "Emergency recovery only.",
  },
  {
    id: "fighter_heal",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.fighterHeal,
    name: "Fighter Heal",
    text: "Confirm to heal all fighters by 70% max HP.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.RECOVERY,
    activation: "fighter_heal",
    price: 260,
    OUTLINE: "#ff8ba8",
    balanceNote: "Combat recovery without adding damage.",
  },
  {
    id: "worker_heal",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.workerHeal,
    name: "Worker Heal",
    text: "Confirm to heal all workers by 70% max HP.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.RECOVERY,
    activation: "worker_heal",
    price: 240,
    OUTLINE: "#8fe7ff",
    balanceNote: "Protects labor without replacing food or water loops.",
  },
  {
    id: "adrenaline_draft",
    image: MARKET_PLACEHOLDER_ASSETS.cardIcons.adrenalineDraft,
    name: "Adrenaline Draft",
    text: "Confirm for a brief team tempo buff to movement and response.",
    kind: MARKET_CARD_KIND.CONSUMABLE,
    marketSection: MARKET_CARD_SECTION.STRATEGY,
    activation: "adrenaline_draft",
    price: 360,
    OUTLINE: "#fff17a",
    balanceNote: "Temporary pressure response.",
  },
]);

export const MARKET_CARD_BY_ID = new Map(MARKET_CARDS.map((card) => [card.id, card]));
export const MARKET_CONSUMABLE_CARDS = Object.freeze(MARKET_CARDS.filter((card) => card.kind === MARKET_CARD_KIND.CONSUMABLE));
export const MARKET_CARD_OFFERS = Object.freeze([...MARKET_CARDS]);
export const MARKET_CARDS_BY_SECTION = Object.freeze(
  Object.fromEntries(
    MARKET_CARD_SECTIONS.map((section) => [
      section.key,
      MARKET_CARD_OFFERS.filter((card) => card.marketSection === section.key),
    ])
  )
);

export function getMarketCardDefinition(cardOrId) {
  if (!cardOrId) return null;
  if (typeof cardOrId === "string") return MARKET_CARD_BY_ID.get(cardOrId) || null;
  return MARKET_CARD_BY_ID.get(cardOrId.id) || cardOrId;
}

function makePlaceholderTexture(scene, key, {
  width = 64,
  height = 64,
  fill = 0x17384d,
  stroke = 0x98e7ff,
  accent = 0xffffff,
  radius = 8,
  icon = "square",
} = {}) {
  if (!scene?.textures || scene.textures.exists(key)) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.clear();
  g.fillStyle(fill, 0.86);
  g.fillRoundedRect?.(0, 0, width, height, radius) ?? g.fillRect(0, 0, width, height);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect?.(4, 4, Math.max(4, width - 8), Math.max(4, height * 0.36), Math.max(3, radius - 3)) ?? g.fillRect(4, 4, Math.max(4, width - 8), Math.max(4, height * 0.36));
  g.lineStyle(2, stroke, 0.65);
  g.strokeRoundedRect?.(1, 1, width - 2, height - 2, radius) ?? g.strokeRect(1, 1, width - 2, height - 2);

  const cx = width / 2;
  const cy = height / 2;
  g.lineStyle(3, accent, 0.9);
  g.fillStyle(accent, 0.18);
  if (icon === "bolt") {
    const p = new Phaser.Geom.Polygon([
      cx - 7, cy - 21, cx + 10, cy - 21, cx + 1, cy - 2,
      cx + 14, cy - 2, cx - 8, cy + 24, cx - 1, cy + 4,
      cx - 14, cy + 4,
    ]);
    g.fillPoints(p.points, true);
    g.strokePoints(p.points, true);
  } else if (icon === "cross") {
    g.fillRect(cx - 5, cy - 22, 10, 44);
    g.fillRect(cx - 22, cy - 5, 44, 10);
    g.strokeRect(cx - 5, cy - 22, 10, 44);
    g.strokeRect(cx - 22, cy - 5, 44, 10);
  } else if (icon === "target") {
    g.strokeCircle(cx, cy, 21);
    g.strokeCircle(cx, cy, 11);
    g.beginPath();
    g.moveTo(cx - 25, cy);
    g.lineTo(cx + 25, cy);
    g.moveTo(cx, cy - 25);
    g.lineTo(cx, cy + 25);
    g.strokePath();
  } else if (icon === "mine") {
    g.fillCircle(cx, cy + 5, 17);
    g.strokeCircle(cx, cy + 5, 17);
    g.strokeLineShape(new Phaser.Geom.Line(cx - 18, cy - 15, cx + 18, cy - 15));
    g.strokeLineShape(new Phaser.Geom.Line(cx, cy - 15, cx, cy - 27));
  } else if (icon === "wall") {
    for (let yy = -14; yy <= 14; yy += 14) {
      for (let xx = -18; xx <= 18; xx += 18) {
        g.strokeRect(cx + xx - 9, cy + yy - 6, 18, 12);
      }
    }
  } else if (icon === "beacon") {
    g.fillTriangle(cx, cy - 25, cx + 20, cy + 18, cx - 20, cy + 18);
    g.strokeTriangle(cx, cy - 25, cx + 20, cy + 18, cx - 20, cy + 18);
    g.strokeCircle(cx, cy - 8, 9);
  } else if (icon === "meteor") {
    g.fillCircle(cx + 6, cy + 8, 16);
    g.strokeCircle(cx + 6, cy + 8, 16);
    g.beginPath();
    g.moveTo(cx - 24, cy - 24);
    g.lineTo(cx - 5, cy - 7);
    g.moveTo(cx - 12, cy - 26);
    g.lineTo(cx + 2, cy - 10);
    g.strokePath();
  } else {
    g.strokeRect(cx - 18, cy - 18, 36, 36);
  }

  g.generateTexture(key, width, height);
  g.destroy();
}

export function loadMarketCardPlaceholderAssets(scene) {
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.storefront, {
    width: 320,
    height: 224,
    fill: 0x16394f,
    stroke: 0x98e7ff,
    accent: 0xffd47c,
    radius: 10,
    icon: "target",
  });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.uiPanel, {
    width: 640,
    height: 420,
    fill: 0x102f42,
    stroke: 0x98e7ff,
    accent: 0xffffff,
    radius: 12,
  });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.uiAccent, {
    width: 96,
    height: 24,
    fill: 0x1b536d,
    stroke: 0x98e7ff,
    accent: 0xffd47c,
    radius: 6,
  });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardSlotFrame, {
    width: 220,
    height: 126,
    fill: 0x17384d,
    stroke: 0x98e7ff,
    accent: 0xffffff,
    radius: 8,
  });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.deckTab, {
    width: 148,
    height: 34,
    fill: 0x19465d,
    stroke: 0x98e7ff,
    accent: 0x7bd9ff,
    radius: 8,
  });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.consumablesTab, {
    width: 148,
    height: 34,
    fill: 0x19465d,
    stroke: 0x98e7ff,
    accent: 0x7cffb2,
    radius: 8,
  });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.confirmButton, {
    width: 120,
    height: 36,
    fill: 0x1f5c42,
    stroke: 0x9dffa5,
    accent: 0xffffff,
    radius: 8,
    icon: "cross",
  });

  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.autoWall, { accent: 0x7bd9ff, icon: "wall" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.chainZapper, { accent: 0xa7f0ff, icon: "bolt" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.meteorDrop, { accent: 0xffad73, icon: "meteor" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.decoyBeacon, { accent: 0xffe07a, icon: "beacon" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.fortifyPatch, { accent: 0x9dffa5, icon: "cross" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.shockMine, { accent: 0xb28cff, icon: "mine" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.teamHeal, { accent: 0x7cffb2, icon: "cross" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.fighterHeal, { accent: 0xff8ba8, icon: "cross" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.workerHeal, { accent: 0x8fe7ff, icon: "cross" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.cardIcons.adrenalineDraft, { accent: 0xfff17a, icon: "bolt" });

  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.targetCursors.chainZapper, { accent: 0xa7f0ff, icon: "bolt" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.targetCursors.meteorDrop, { accent: 0xffad73, icon: "target" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.targetCursors.fortifyPatch, { accent: 0x9dffa5, icon: "cross" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.ghosts.autoWall, { accent: 0x7bd9ff, icon: "wall" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.ghosts.decoyBeacon, { accent: 0xffe07a, icon: "beacon" });
  makePlaceholderTexture(scene, MARKET_PLACEHOLDER_ASSETS.ghosts.shockMine, { accent: 0xb28cff, icon: "mine" });
}
