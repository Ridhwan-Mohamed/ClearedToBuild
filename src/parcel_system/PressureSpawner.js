// parcelSystem/PressureSpawner.js
import { PRESSURE } from "./ParcelConfig.js";

export function createPressureSpawners({
  scene,
  origin,
  difficulty,
  contractId,
  spawnSpawnerBuilding,
}) {
  const diff = Math.max(1, Math.min(PRESSURE.maxDifficulty, difficulty | 0));

  const spawnerPositions = [
    { gx: origin.x + 7,  gy: origin.y + 7  },
    { gx: origin.x + 17, gy: origin.y + 7  },
    { gx: origin.x + 12, gy: origin.y + 17 },
  ].slice(0, diff);

  const totalPlannedEnemies = diff * PRESSURE.baseEnemiesPerSpawner;

  const spawners = spawnerPositions.map((pos, idx) => {
    const planned = PRESSURE.baseEnemiesPerSpawner;
    const building = spawnSpawnerBuilding({
      gx: pos.gx,
      gy: pos.gy,
      contractId,
      plannedEnemies: planned,
      spawnIntervalMs: PRESSURE.spawnIntervalMs,
    });
    return { idx, pos, planned, building };
  });

  return { spawners, totalPlannedEnemies };
}
