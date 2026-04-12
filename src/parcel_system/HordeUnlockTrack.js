import { STORE_UNLOCK_KEYS, unlockStoreItem } from "./StoreUnlockSystem";

const HORDE_UNLOCKS = Object.freeze([
  {
    hordeIndex: 1,
    unlockKey: STORE_UNLOCK_KEYS.blademaster,
    title: "Blademaster Unlocked",
    description: "The Blademaster has been added to the store. You can now recruit this elite melee fighter for later hordes.",
    displayLabel: "Blademaster",
    badgeLabel: "HORDE UNLOCKED",
    subLabel: "NEW UNIT IN STORE",
    accentColor: 0x8b5cf6,
    glowColor: 0xd8b4fe,
    panelColor: 0x1a1230,
    compositeArt: {
      textureKey: "horde_unlock_blademaster_composite",
      width: 96,
      height: 96,
      parts: [
        { key: "blademaster_walk_down", frame: 1, x: 48, y: 56, scale: 2.2, useSprite: true },
      ],
    },
  },
  {
    hordeIndex: 2,
    unlockKey: STORE_UNLOCK_KEYS.gunslinger,
    title: "Gunslinger Unlocked",
    description: "The Gunslinger is now in the store. Bring ranged firepower online before the later horde spikes arrive.",
    displayLabel: "Gunslinger",
    badgeLabel: "HORDE UNLOCKED",
    subLabel: "NEW UNIT IN STORE",
    accentColor: 0x60a5fa,
    glowColor: 0xbfdbfe,
    panelColor: 0x132238,
    compositeArt: {
      textureKey: "horde_unlock_gunslinger_composite",
      width: 96,
      height: 96,
      parts: [
        { key: "gunslinger_walk_down", frame: 1, x: 48, y: 56, scale: 2.15, useSprite: true },
      ],
    },
  },
  {
    hordeIndex: 3,
    unlockKey: STORE_UNLOCK_KEYS.turret,
    title: "Turret Unlocked",
    description: "Builders can now construct Turrets from the store. Set up automated firing lanes before the pressure ramps harder.",
    displayLabel: "Turret",
    badgeLabel: "HORDE UNLOCKED",
    subLabel: "NEW BUILD IN STORE",
    accentColor: 0xf4ca67,
    glowColor: 0xffefb6,
    panelColor: 0x111a2c,
    compositeArt: {
      textureKey: "horde_unlock_turret_composite",
      width: 96,
      height: 96,
      parts: [
        { key: "image7", x: 48, y: 60, scale: 1.15 },
        { key: "image7a", x: 48, y: 30, scale: 1.15 },
      ],
    },
  },
  {
    hordeIndex: 4,
    unlockKey: STORE_UNLOCK_KEYS.stoneWall,
    title: "Stone Walls Unlocked",
    description: "Stone Walls are now available in the store. Upgrade from wood defenses before the horde starts punching through.",
    displayLabel: "Stone Walls",
    badgeLabel: "HORDE UNLOCKED",
    subLabel: "NEW BUILD IN STORE",
    accentColor: 0xcbd5e1,
    glowColor: 0xe2e8f0,
    panelColor: 0x1b2230,
    compositeArt: {
      textureKey: "horde_unlock_stone_wall_composite",
      width: 96,
      height: 96,
      parts: [
        { key: "wall_interior", frame: 0, x: 48, y: 48, scale: 2.2, useSprite: true },
      ],
    },
  },
  {
    hordeIndex: 5,
    unlockKey: STORE_UNLOCK_KEYS.catapult,
    title: "Catapult Unlocked",
    description: "Catapults have been added to the store. Your builders can now field long-range siege support.",
    displayLabel: "Catapult",
    badgeLabel: "HORDE UNLOCKED",
    subLabel: "NEW BUILD IN STORE",
    accentColor: 0xff9b64,
    glowColor: 0xffd6aa,
    panelColor: 0x1a1625,
    compositeArt: {
      textureKey: "horde_unlock_catapult_composite",
      width: 96,
      height: 96,
      parts: [
        { key: "catapult_base", x: 48, y: 56, scale: 1.1 },
        { key: "catapult_top", x: 48, y: 44, scale: 1.1, frame: 1, useSprite: true },
      ],
    },
  },
]);

function cloneReward(reward) {
  if (!reward) return null;
  return {
    ...reward,
    compositeArt: reward.compositeArt
      ? {
          ...reward.compositeArt,
          parts: Array.isArray(reward.compositeArt.parts)
            ? reward.compositeArt.parts.map((part) => ({ ...part }))
            : [],
        }
      : null,
    onGrant: (scene) => unlockStoreItem(reward.unlockKey, scene),
  };
}

export function getHordeUnlockReward(hordeIndex) {
  const horde = Math.max(1, Number(hordeIndex) || 1);
  return cloneReward(HORDE_UNLOCKS.find((reward) => reward.hordeIndex === horde) || null);
}

export function getNextHordeUnlock(hordeIndex) {
  const horde = Math.max(1, Number(hordeIndex) || 1);
  const next = HORDE_UNLOCKS.find((reward) => reward.hordeIndex >= horde) || null;
  return next ? { ...next } : null;
}

export function getRunStoreUnlockKeys() {
  return HORDE_UNLOCKS.map((reward) => reward.unlockKey);
}

export function grantHordeUnlockCatchup(scene, completedHordes = 0) {
  const cleared = Math.max(0, Math.floor(Number(completedHordes) || 0));
  const granted = [];

  for (const reward of HORDE_UNLOCKS) {
    if (reward.hordeIndex > cleared) continue;
    const changed = unlockStoreItem(reward.unlockKey, scene);
    if (changed) granted.push(cloneReward(reward));
  }

  return granted;
}
