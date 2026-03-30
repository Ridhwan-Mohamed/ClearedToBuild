import { Projectile } from "./Projectile";

// weapons.js
export const weapons = {
  hands : {
    name: "Hands",
    baseDmg: 10,
    critDmg: 15,
    critProb: 20,
    accuracy: 75,
    duration: 700,
    range: 16,
    projectile: false,
    attackSfxKey: "sfx_hand_punch",
    moveSlowMultiplier: 0.65,
    moveSlowDurationMs: 500,
  },

  boxingGloves: {
    name: "Boxing Gloves",
    baseDmg: 18,
    critDmg: 30,
    critProb: 25,
    accuracy: 80,
    duration: 700,
    range: 18,
    projectile: false,
    attackSfxKey: "sfx_boxing_punch",
    moveSlowMultiplier: 0.58,
    moveSlowDurationMs: 750,
  },

  sword: {
    name: "Sword",
    baseDmg: 45,
    critDmg: 85,
    critProb: 30,
    accuracy: 90,
    duration: 1000,
    range: 22,
    projectile: false,
    attackSfxKey: "sfx_sword_hit",
    moveSlowMultiplier: 0.62,
    moveSlowDurationMs: 850,
  },

  pistol: {
    name: "pistol",
    baseDmg: 100,
    critDmg: 175,
    critProb: 40,
    accuracy: 85,
    duration: 1000,
    range: 200,
    projectile: true,
    speed: 300,
    attackSfxKey: "sfx_gun_shot",
    moveSlowMultiplier: 0.72,
    moveSlowDurationMs: 650,
  }
};

