// parcelSystem/PressureSpawner.js
import { PRESSURE } from "./ParcelConfig.js";
import { getContractStage, PRESSURE_CONTRACT } from "../constants.js";

export function createPressureSpawners({
  scene,
  origin,
  difficulty,
  contractId,
  spawnSpawnerBuilding,
}) {
  const stage = Math.max(1, Number(getContractStage(scene) || 1));
  const diff = Math.max(1, Math.min(PRESSURE.maxDifficulty, difficulty | 0));
  const quotaPerSpawner =
    Math.max(1, Number(PRESSURE_CONTRACT.BASE_QUOTA_PER_SPAWNER ?? PRESSURE.baseEnemiesPerSpawner ?? 3))
    + Math.max(0, stage - 1);
  const spawnIntervalMs = Math.max(
    Number(PRESSURE_CONTRACT.MIN_INTERVAL_MS ?? PRESSURE.minSpawnIntervalMs ?? 1500),
    Number(PRESSURE_CONTRACT.BASE_INTERVAL_MS ?? PRESSURE.spawnIntervalMs ?? 6000)
      - Math.max(0, stage - 1) * Number(PRESSURE_CONTRACT.INTERVAL_DROP_PER_STAGE_MS ?? 250)
  );

  const spawnerPositions = [
    { gx: origin.x + 7,  gy: origin.y + 7  },
    { gx: origin.x + 17, gy: origin.y + 7  },
    { gx: origin.x + 12, gy: origin.y + 17 },
  ].slice(0, diff);

  const totalPlannedEnemies = diff * quotaPerSpawner;

  const spawners = spawnerPositions.map((pos, idx) => {
    const planned = quotaPerSpawner;
    const building = spawnSpawnerBuilding({
      gx: pos.gx,
      gy: pos.gy,
      contractId,
      plannedEnemies: planned,
      spawnIntervalMs,
    });
    return { idx, pos, planned, building };
  });

  return { spawners, totalPlannedEnemies };
}
