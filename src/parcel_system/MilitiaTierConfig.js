const MILITIA_TIERS = Object.freeze({
  1: Object.freeze({
    tier: 1,
    permitCost: 2,
    summary: "3 Turrets",
    layout: Object.freeze(["turret", "turret", "turret"]),
  }),
  2: Object.freeze({
    tier: 2,
    permitCost: 3,
    summary: "2 Turrets + 1 Catapult",
    layout: Object.freeze(["turret", "turret", "catapult"]),
  }),
  3: Object.freeze({
    tier: 3,
    permitCost: 4,
    summary: "3 Catapults",
    layout: Object.freeze(["catapult", "catapult", "catapult"]),
  }),
});

export function clampMilitiaTier(tier = 1) {
  const normalized = Math.floor(Number(tier) || 1);
  return Math.max(1, Math.min(3, normalized));
}

export function getMilitiaTierConfig(tier = 1) {
  return MILITIA_TIERS[clampMilitiaTier(tier)] ?? MILITIA_TIERS[1];
}

export function getMilitiaTierLayout(tier = 1) {
  return [...getMilitiaTierConfig(tier).layout];
}
