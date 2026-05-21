const HORDE_MODIFIERS = Object.freeze([
  {
    key: "fast_raiders",
    label: "Fast Raiders",
    shortLabel: "Fast",
    description: "Raiders sprint harder and arrive faster tonight.",
    enemyType: "raider",
    enemyTypeLabel: "Raiders",
    quotaMultiplier: 1.08,
    intervalMultiplier: 0.76,
    speedMultiplier: 1.35,
    healthMultiplier: 1,
    damageMultiplier: 1,
    extraSpawners: 0,
    visual: { tint: 0xffd166, scale: 0.94 },
  },
  {
    key: "heavy_grunts",
    label: "Heavy Grunts",
    shortLabel: "Heavy",
    description: "Fort grunts replace raiders and bring heavier frontline pressure.",
    enemyType: "grunt",
    enemyTypeLabel: "Fort Grunts",
    quotaMultiplier: 0.9,
    intervalMultiplier: 1,
    speedMultiplier: 0.92,
    healthMultiplier: 1.18,
    damageMultiplier: 1.05,
    extraSpawners: 0,
    visual: { tint: 0x7f1d1d, scale: 1.12 },
  },
  {
    key: "siege_pressure",
    label: "Siege Pressure",
    shortLabel: "Siege",
    description: "Extra spawners and thicker waves hammer your defenses tonight.",
    enemyType: "raider",
    enemyTypeLabel: "Siege Raiders",
    quotaMultiplier: 1.25,
    intervalMultiplier: 0.8,
    speedMultiplier: 1.03,
    healthMultiplier: 1,
    damageMultiplier: 1.05,
    extraSpawners: 1,
    visual: { tint: 0xd97706, scale: 1.04 },
  },
  {
    key: "torch_rush",
    label: "Torch Rush",
    shortLabel: "Torch",
    description: "Torch raiders flood in fast and hit harder once they arrive.",
    enemyType: "raider",
    enemyTypeLabel: "Torch Raiders",
    quotaMultiplier: 1.18,
    intervalMultiplier: 0.7,
    speedMultiplier: 1.14,
    healthMultiplier: 1,
    damageMultiplier: 1.12,
    extraSpawners: 0,
    visual: { tint: 0xff7a1a, scale: 1 },
  },
]);

function cloneModifier(modifier) {
  return modifier ? { ...modifier, visual: modifier.visual ? { ...modifier.visual } : null } : null;
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
