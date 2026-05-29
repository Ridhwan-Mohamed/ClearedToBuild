// parcelSystem/PressureSpawner.js
import { TILE_TYPES } from "../constants.js";
import { PARCEL_SIZE, PRESSURE } from "./ParcelConfig.js";
import { buildPressureSpawnerProfile, getEnemyTypeLabel } from "../balance/GameBalance.js";

const PRESSURE_SPAWNER_EDGE_BERTH = 2;

function clampSpawnerPosToParcel(origin, pos) {
  const spawnType = TILE_TYPES.spawn;
  const lenX = Math.max(1, Number(spawnType?.lenX ?? 1) || 1);
  const lenY = Math.max(1, Number(spawnType?.lenY ?? 1) || 1);
  const minX = origin.x + PRESSURE_SPAWNER_EDGE_BERTH;
  const minY = origin.y + PRESSURE_SPAWNER_EDGE_BERTH;
  const maxX = origin.x + PARCEL_SIZE - PRESSURE_SPAWNER_EDGE_BERTH - lenX;
  const maxY = origin.y + PARCEL_SIZE - PRESSURE_SPAWNER_EDGE_BERTH - lenY;

  return {
    gx: Math.max(minX, Math.min(maxX, Number(pos?.gx ?? minX))),
    gy: Math.max(minY, Math.min(maxY, Number(pos?.gy ?? minY))),
  };
}

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
  ]
    .slice(0, spawnerCount)
    .map((pos) => clampSpawnerPosToParcel(origin, pos));

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
