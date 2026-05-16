import { getContractMoneyCost, roundPrice } from "../balance/GameBalance.js";
import { RESOURCE_CONTRACT_MS } from "./ParcelConfig.js";

export const SLOT_FAVOR_THRESHOLD = 2;
export const SLOT_FAVOR_MAX_ACTIVE = 2;

export const SLOT_FAVOR_TYPES = Object.freeze({
  discount: Object.freeze({
    kind: "discount",
    weight: 45,
    shortLabel: "SALE",
    title: "Sale",
    description: "Cash costs -50% here.",
    moneyMultiplier: 0.5,
    iconText: "$",
  }),
  extended: Object.freeze({
    kind: "extended",
    weight: 35,
    shortLabel: "LONG",
    title: "Long Run",
    description: "Eligible contracts last +30s here.",
    durationBonusMs: 30_000,
    iconText: "+30",
  }),
  completion: Object.freeze({
    kind: "completion",
    weight: 20,
    shortLabel: "BONUS",
    title: "Completion Bonus",
    description: "Earn extra cash when a contract ends here.",
    iconText: "\u2605",
  }),
});

const SLOT_FAVOR_KIND_ORDER = Object.freeze(Object.keys(SLOT_FAVOR_TYPES));
const MARKET_BASE_DURATION_MS = 60_000;

export function isSlotFavorEligibleContractType(type) {
  const normalized = String(type || "").toUpperCase();
  return normalized === "FOREST"
    || normalized === "ROCK"
    || normalized === "FARM"
    || normalized === "MARKET";
}

export function getBaseContractDurationMs(type) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "MARKET") return MARKET_BASE_DURATION_MS;
  return RESOURCE_CONTRACT_MS[normalized] ?? 0;
}

export function cloneSlotFavor(favor) {
  if (!favor || typeof favor !== "object") return null;
  const normalized = SLOT_FAVOR_TYPES[String(favor.kind || "").toLowerCase()];
  if (!normalized) return null;
  return { kind: normalized.kind };
}

export function pickRandomSlotFavor(rng = Math.random) {
  const totalWeight = SLOT_FAVOR_KIND_ORDER.reduce(
    (sum, kind) => sum + Number(SLOT_FAVOR_TYPES[kind]?.weight || 0),
    0
  );
  if (totalWeight <= 0) return cloneSlotFavor(SLOT_FAVOR_TYPES.discount);

  let roll = Math.max(0, Number(rng?.() ?? Math.random()) * totalWeight);
  for (const kind of SLOT_FAVOR_KIND_ORDER) {
    roll -= Number(SLOT_FAVOR_TYPES[kind]?.weight || 0);
    if (roll <= 0) return cloneSlotFavor(SLOT_FAVOR_TYPES[kind]);
  }
  return cloneSlotFavor(SLOT_FAVOR_TYPES.discount);
}

export function getSlotFavorConfig(favor) {
  return SLOT_FAVOR_TYPES[String(favor?.kind || "").toLowerCase()] ?? null;
}

export function getSlotFavorShortLabel(favor) {
  return getSlotFavorConfig(favor)?.shortLabel ?? "";
}

export function getSlotFavorTitle(favor) {
  return getSlotFavorConfig(favor)?.title ?? "";
}

export function getSlotFavorIconText(favor) {
  return getSlotFavorConfig(favor)?.iconText ?? "+";
}

export function getSlotFavorBannerText(favor) {
  const config = getSlotFavorConfig(favor);
  if (!config) return null;
  return {
    title: config.title,
    detail: config.description,
  };
}

export function getEffectiveContractMoneyCost(scene, type, difficulty = 1, favor = null) {
  const baseCost = getContractMoneyCost(scene, type, difficulty);
  const config = getSlotFavorConfig(favor);
  if (!config || config.kind !== "discount" || !isSlotFavorEligibleContractType(type)) {
    return baseCost;
  }
  return roundPrice(baseCost * Math.max(0, Number(config.moneyMultiplier || 1)), 5);
}

export function getEffectiveContractDurationMs(type, favor = null) {
  const baseDurationMs = getBaseContractDurationMs(type);
  const config = getSlotFavorConfig(favor);
  if (!config || config.kind !== "extended" || !isSlotFavorEligibleContractType(type)) {
    return baseDurationMs;
  }
  return Math.max(0, baseDurationMs + Math.max(0, Number(config.durationBonusMs || 0)));
}

export function getSlotFavorCompletionBonusMoney(scene, type, difficulty = 1, favor = null) {
  const config = getSlotFavorConfig(favor);
  if (!config || config.kind !== "completion" || !isSlotFavorEligibleContractType(type)) {
    return 0;
  }
  const baseCost = getContractMoneyCost(scene, type, difficulty);
  return Math.max(35, roundPrice(baseCost * 0.35, 5));
}

export function formatFavorDurationMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getSlotFavorEffectText(scene, favor, { type = null, difficulty = 1 } = {}) {
  const config = getSlotFavorConfig(favor);
  if (!config) return "";
  if (!type || !isSlotFavorEligibleContractType(type)) return config.description;

  if (config.kind === "discount") {
    const baseCost = getContractMoneyCost(scene, type, difficulty);
    const effectiveCost = getEffectiveContractMoneyCost(scene, type, difficulty, favor);
    return `Cash Cost: $${effectiveCost} (was $${baseCost})`;
  }

  if (config.kind === "extended") {
    const durationMs = getEffectiveContractDurationMs(type, favor);
    return `Duration: ${formatFavorDurationMs(durationMs)}`;
  }

  if (config.kind === "completion") {
    const bonusMoney = getSlotFavorCompletionBonusMoney(scene, type, difficulty, favor);
    return `Completion Reward: +$${bonusMoney}`;
  }

  return config.description;
}
