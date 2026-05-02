import { TILE_TYPES } from "../constants.js";
import { UI_ITEM_TYPES } from "../UI/UIConstants.js";
import { POWERUP_CARDS } from "../Cards/PowerupCards.js";
import { MARKET_CARDS } from "../Cards/MarketCards.js";
import { Farmer } from "../players/Farmer.js";
import { Builder } from "../players/Builder.js";
import { Forager } from "../players/Forager.js";
import { Fireman } from "../players/Fireman.js";
import { Brawler } from "../players/Brawler.js";
import { Blademaster } from "../players/Blademaster.js";
import { Gunslinger } from "../players/Gunslinger.js";
import { Raider } from "../players/Raider.js";
import { FortGrunt } from "../players/FortGrunt.js";
import { ClayOven } from "../buildings/ClayOven.js";

export const TROOP_TYPE_REGISTRY = Object.freeze({
  farmer: Farmer,
  builder: Builder,
  forager: Forager,
  fireman: Fireman,
  brawler: Brawler,
  blademaster: Blademaster,
  gunslinger: Gunslinger,
  raider: Raider,
  fort_grunt: FortGrunt,
});

export const CARD_REGISTRY = new Map((POWERUP_CARDS || []).map((card) => [card.id, card]));
export const MARKET_CARD_REGISTRY = new Map((MARKET_CARDS || []).map((card) => [card.id, card]));

const CARD_DEFAULTS = Object.freeze({
  Farmer: { speed: Farmer.speed, stamina: Farmer.stamina, maxWaterPailCarry: Farmer.maxWaterPailCarry },
  Builder: { speed: Builder.speed, stamina: Builder.stamina },
  Forager: { speed: Forager.speed, stamina: Forager.stamina },
  Fireman: { speed: Fireman.speed, stamina: Fireman.stamina },
  Brawler: { speed: Brawler.speed, stamina: Brawler.stamina },
  Blademaster: { speed: Blademaster.speed, stamina: Blademaster.stamina },
  Gunslinger: { speed: Gunslinger.speed, stamina: Gunslinger.stamina },
  ClayOven: { cookDuration: ClayOven.cookDuration },
});

export function resetCardModifiedDefaults() {
  Farmer.speed = CARD_DEFAULTS.Farmer.speed;
  Farmer.stamina = CARD_DEFAULTS.Farmer.stamina;
  Farmer.maxWaterPailCarry = CARD_DEFAULTS.Farmer.maxWaterPailCarry;
  Builder.speed = CARD_DEFAULTS.Builder.speed;
  Builder.stamina = CARD_DEFAULTS.Builder.stamina;
  Forager.speed = CARD_DEFAULTS.Forager.speed;
  Forager.stamina = CARD_DEFAULTS.Forager.stamina;
  Fireman.speed = CARD_DEFAULTS.Fireman.speed;
  Fireman.stamina = CARD_DEFAULTS.Fireman.stamina;
  Brawler.speed = CARD_DEFAULTS.Brawler.speed;
  Brawler.stamina = CARD_DEFAULTS.Brawler.stamina;
  Blademaster.speed = CARD_DEFAULTS.Blademaster.speed;
  Blademaster.stamina = CARD_DEFAULTS.Blademaster.stamina;
  Gunslinger.speed = CARD_DEFAULTS.Gunslinger.speed;
  Gunslinger.stamina = CARD_DEFAULTS.Gunslinger.stamina;
  ClayOven.cookDuration = CARD_DEFAULTS.ClayOven.cookDuration;
}

export function reapplySavedCards(cardIds = []) {
  resetCardModifiedDefaults();
  const seen = new Set();
  for (const id of Array.isArray(cardIds) ? cardIds : []) {
    if (!id || seen.has(id)) continue;
    const card = CARD_REGISTRY.get(id);
    if (!card?.apply) continue;
    card.apply();
    seen.add(id);
  }
}

export function normalizeTeamId(teamId) {
  return String(teamId ?? "1");
}

export function getTileTypeKey(tileType) {
  if (!tileType) return null;
  if (typeof tileType === "string") return tileType;
  return tileType.name || null;
}

export function getTroopTypeKey(troop) {
  const ctor = troop?.type;
  if (ctor === Farmer) return "farmer";
  if (ctor === Builder) return "builder";
  if (ctor === Forager) return "forager";
  if (ctor === Fireman) return "fireman";
  if (ctor === Brawler) return "brawler";
  if (ctor === Blademaster) return "blademaster";
  if (ctor === Gunslinger) return "gunslinger";
  if (troop?.isFortGrunt || ctor === FortGrunt) return "fort_grunt";
  if (troop?.isRaider || ctor === Raider) return "raider";
  return null;
}

export function snapshotItemStack(slot) {
  if (!slot) return null;
  const itemName = typeof slot.item === "string" ? slot.item : slot.item?.name;
  if (!itemName) return null;
  return {
    item: itemName,
    amount: Math.max(0, Number(slot.amount || 0)),
    forceStore: !!slot.forceStore,
  };
}

export function restoreItemStack(snapshot) {
  if (!snapshot?.item) return null;
  const item = UI_ITEM_TYPES[snapshot.item];
  if (!item) return null;
  return {
    item,
    amount: Math.max(0, Number(snapshot.amount || 0)),
    forceStore: !!snapshot.forceStore,
  };
}

export function cloneSimple(value, fallback) {
  if (value == null) return fallback;
  try {
    return structuredClone(value);
  } catch {
    return fallback;
  }
}

export function getCardIdsFromHand(cardHand = []) {
  return (Array.isArray(cardHand) ? cardHand : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.id))
    .filter((id) => typeof id === "string" && id.length > 0);
}

export function makeBuildingRef(teamId, typeKey, x, y) {
  return `${normalizeTeamId(teamId)}:${String(typeKey || "unknown")}:${Number(x || 0)}:${Number(y || 0)}`;
}

export function makeStorageRef(teamId, x, y) {
  return `storage:${normalizeTeamId(teamId)}:${Number(x || 0)}:${Number(y || 0)}`;
}

export function makeOvenRef(teamId, x, y) {
  return `oven:${normalizeTeamId(teamId)}:${Number(x || 0)}:${Number(y || 0)}`;
}

export function makeCropRef(x, y) {
  return `crop:${Number(x || 0)}:${Number(y || 0)}`;
}

export function makeWallRef(x, y) {
  return `wall:${Number(x || 0)}:${Number(y || 0)}`;
}

export function getTileTypeByKey(typeKey) {
  return typeKey ? TILE_TYPES[typeKey] ?? null : null;
}
