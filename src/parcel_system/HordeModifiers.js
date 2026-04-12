const HORDE_MODIFIERS = Object.freeze([
  {
    key: "fast_raiders",
    label: "Fast Raiders",
    shortLabel: "Fast",
    description: "Raiders sprint harder and arrive faster tonight.",
    enemyType: "raider",
    enemyTypeLabel: "Raiders",
    quotaMultiplier: 1.1,
    intervalMultiplier: 0.78,
    speedMultiplier: 1.45,
    healthMultiplier: 1,
    damageMultiplier: 1,
    extraSpawners: 0,
  },
  {
    key: "heavy_grunts",
    label: "Heavy Grunts",
    shortLabel: "Heavy",
    description: "Fort grunts replace raiders and bring heavier frontline pressure.",
    enemyType: "grunt",
    enemyTypeLabel: "Fort Grunts",
    quotaMultiplier: 0.95,
    intervalMultiplier: 1.05,
    speedMultiplier: 1,
    healthMultiplier: 1.35,
    damageMultiplier: 1.2,
    extraSpawners: 0,
  },
  {
    key: "siege_pressure",
    label: "Siege Pressure",
    shortLabel: "Siege",
    description: "Extra spawners and thicker waves hammer your defenses tonight.",
    enemyType: "raider",
    enemyTypeLabel: "Siege Raiders",
    quotaMultiplier: 1.4,
    intervalMultiplier: 0.84,
    speedMultiplier: 1.05,
    healthMultiplier: 1.1,
    damageMultiplier: 1.15,
    extraSpawners: 1,
  },
  {
    key: "torch_rush",
    label: "Torch Rush",
    shortLabel: "Torch",
    description: "Torch raiders flood in fast and hit harder once they arrive.",
    enemyType: "raider",
    enemyTypeLabel: "Torch Raiders",
    quotaMultiplier: 1.25,
    intervalMultiplier: 0.72,
    speedMultiplier: 1.18,
    healthMultiplier: 1,
    damageMultiplier: 1.35,
    extraSpawners: 0,
  },
]);

function cloneModifier(modifier) {
  return modifier ? { ...modifier } : null;
}

export function getHordeModifierByKey(key) {
  if (!key) return null;
  return cloneModifier(HORDE_MODIFIERS.find((modifier) => modifier.key === key) || null);
}

export function getHordeModifierForIndex(hordeIndex) {
  const index = Math.max(1, Number(hordeIndex) || 1);
  if (index < 3) return null;
  return cloneModifier(HORDE_MODIFIERS[(index - 3) % HORDE_MODIFIERS.length]);
}

