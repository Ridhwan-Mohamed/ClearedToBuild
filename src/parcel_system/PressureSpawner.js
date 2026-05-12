// parcelSystem/PressureSpawner.js
import { PRESSURE } from "./ParcelConfig.js";
import { buildPressureSpawnerProfile, getEnemyTypeLabel } from "../balance/GameBalance.js";

export function buildPressureSpawnerPlan({
  scene,
  origin,
  difficulty,
  modifier = null,
}) {
  const diff = Math.max(1, Math.min(PRESSURE.maxDifficulty, difficulty | 0));
  const profile = buildPressureSpawnerProfile(scene, diff, modifier);
  const spawnerCount = profile.spawnerCount;
  const quotaPerSpawner = profile.quotaPerSpawner;
  const spawnIntervalMs = profile.spawnIntervalMs;
  const enemyMods = profile.enemyMods;

  const spawnerPositions = [
    { gx: origin.x + 7,  gy: origin.y + 7  },
    { gx: origin.x + 17, gy: origin.y + 7  },
    { gx: origin.x + 12, gy: origin.y + 17 },
  ].slice(0, spawnerCount);

  const totalPlannedEnemies = profile.totalPlannedEnemies;
  const spawnerSpecs = spawnerPositions.map((pos, idx) => {
    const enemyType = profile.spawnerEnemyTypes[idx] || "raider";
    return {
    idx,
    pos,
    planned: quotaPerSpawner,
    spawnIntervalMs,
    enemyType,
    enemyMods,
    enemyTypeLabel: getEnemyTypeLabel(enemyType),
    modifierKey: modifier?.key ?? null,
    modifierLabel: modifier?.label ?? null,
    };
  });

  return {
    spawnerSpecs,
    totalPlannedEnemies,
    enemyType: profile.enemyType,
    enemyTypeLabel: profile.enemyTypeLabel,
    quotaPerSpawner,
    spawnerCount,
  };
}

export function createPressureSpawners({
  scene,
  origin,
  difficulty,
  contractId,
  spawnSpawnerBuilding,
  modifier = null,
  plan = null,
}) {
  const pressurePlan = plan || buildPressureSpawnerPlan({
    scene,
    origin,
    difficulty,
    modifier,
  });

  const spawners = pressurePlan.spawnerSpecs.map((spec) => {
    const building = spawnSpawnerBuilding({
      gx: spec.pos.gx,
      gy: spec.pos.gy,
      contractId,
      plannedEnemies: spec.planned,
      spawnIntervalMs: spec.spawnIntervalMs,
      enemyType: spec.enemyType,
      enemyMods: spec.enemyMods,
      enemyTypeLabel: spec.enemyTypeLabel,
      modifierKey: spec.modifierKey,
      modifierLabel: spec.modifierLabel,
    });
    return { idx: spec.idx, pos: spec.pos, planned: spec.planned, building };
  });

  return {
    ...pressurePlan,
    spawners,
  };
}
