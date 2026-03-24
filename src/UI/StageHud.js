
// src/UI/StageHud.js
//
// Tiny world-space HUD label for Season + Stage.
// Renders with the world camera.

import { UIDEPTH } from "../constants";
import { StageState } from "../parcelController/StageState";

const DEFAULT_SEASONS = ["Spring", "Summer", "Fall", "Winter", "Boss"];

export function ensureStageHud(scene, {
  stagesPerSeason = 5,
  seasons = DEFAULT_SEASONS,
  x = 12,
  y = 50
} = {}) {
  if (scene._stageHud) return scene._stageHud;

  const txt = scene.add.text(x, y, "", {
    fontFamily: "Bungee",
    fontSize: "16px",
    color: "#ffffff",
    stroke: "#000000",
    strokeThickness: 4,
  }).setOrigin(0, 0).setDepth((UIDEPTH ?? 2000) + 1000);

  // world-only
  txt.setScrollFactor(0);

  function recompute() {
    const stageIndex = StageState.stageIndex ?? 1;
    // If you later want season derived from stageIndex:
    // const seasonIdx = Math.floor((stageIndex - 1) / stagesPerSeason);
    // For now, respect StageState.seasonIndex if you’re already driving it.
    const seasonIndex = (StageState.seasonIndex ?? 1) - 1;
    const seasonName = seasons[seasonIndex] ?? `Season ${seasonIndex + 1}`;
    txt.setText(`${seasonName} — Stage ${stageIndex}`);
  }

  recompute();

  // Lightweight event hook if you already emit stage updates; otherwise call recompute manually.
  scene.events.on("stage:changed", recompute);
  scene.events.on("season:changed", recompute);

  scene._stageHud = { txt, recompute, destroy: () => txt.destroy() };
  return scene._stageHud;
}

