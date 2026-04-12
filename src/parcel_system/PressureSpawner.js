// parcelSystem/PressureSpawner.js
import { PRESSURE } from "./ParcelConfig.js";
import { getContractStage, PRESSURE_CONTRACT } from "../constants.js";

export function createPressureSpawners({
  scene,
  origin,
  difficulty,
  contractId,
  spawnSpawnerBuilding,
  modifier = null,
}) {
  const stage = Math.max(1, Number(getContractStage(scene) || 1));
  const diff = Math.max(1, Math.min(PRESSURE.maxDifficulty, difficulty | 0));
  const extraSpawners = Math.max(0, Number(modifier?.extraSpawners ?? 0) || 0);
  const spawnerCount = Math.max(1, Math.min(3, diff + extraSpawners));
  const quotaPerSpawnerBase =
    Math.max(1, Number(PRESSURE_CONTRACT.BASE_QUOTA_PER_SPAWNER ?? PRESSURE.baseEnemiesPerSpawner ?? 3))
    + Math.max(0, stage - 1);
  const quotaPerSpawner = Math.max(
    1,
    Math.round(quotaPerSpawnerBase * Math.max(0.5, Number(modifier?.quotaMultiplier ?? 1) || 1))
  );
  const baseIntervalMs = Math.max(
    Number(PRESSURE_CONTRACT.MIN_INTERVAL_MS ?? PRESSURE.minSpawnIntervalMs ?? 1500),
    Number(PRESSURE_CONTRACT.BASE_INTERVAL_MS ?? PRESSURE.spawnIntervalMs ?? 6000)
      - Math.max(0, stage - 1) * Number(PRESSURE_CONTRACT.INTERVAL_DROP_PER_STAGE_MS ?? 250)
  );
  const spawnIntervalMs = Math.max(
    Number(PRESSURE_CONTRACT.MIN_INTERVAL_MS ?? PRESSURE.minSpawnIntervalMs ?? 1500),
    Math.round(baseIntervalMs * Math.max(0.4, Number(modifier?.intervalMultiplier ?? 1) || 1))
  );
  const enemyType = modifier?.enemyType === "grunt" ? "grunt" : "raider";
  const enemyTypeLabel = String(
    modifier?.enemyTypeLabel || (enemyType === "grunt" ? "Fort Grunts" : "Raiders")
  );
  const enemyMods = {
    speedMultiplier: Math.max(0.5, Number(modifier?.speedMultiplier ?? 1) || 1),
    healthMultiplier: Math.max(0.5, Number(modifier?.healthMultiplier ?? 1) || 1),
    damageMultiplier: Math.max(0.5, Number(modifier?.damageMultiplier ?? 1) || 1),
    modifierKey: modifier?.key ?? null,
    modifierLabel: modifier?.label ?? null,
  };

  const spawnerPositions = [
    { gx: origin.x + 7,  gy: origin.y + 7  },
    { gx: origin.x + 17, gy: origin.y + 7  },
    { gx: origin.x + 12, gy: origin.y + 17 },
  ].slice(0, spawnerCount);

  const totalPlannedEnemies = spawnerCount * quotaPerSpawner;

  const spawners = spawnerPositions.map((pos, idx) => {
    const planned = quotaPerSpawner;
    const building = spawnSpawnerBuilding({
      gx: pos.gx,
      gy: pos.gy,
      contractId,
      plannedEnemies: planned,
      spawnIntervalMs,
      enemyType,
      enemyMods,
      enemyTypeLabel,
      modifierKey: modifier?.key ?? null,
      modifierLabel: modifier?.label ?? null,
    });
    return { idx, pos, planned, building };
  });

  return {
    spawners,
    totalPlannedEnemies,
    enemyType,
    enemyTypeLabel,
    quotaPerSpawner,
    spawnerCount,
  };
}
