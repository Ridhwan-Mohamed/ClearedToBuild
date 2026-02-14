// parcelController/PressureParcel.js
import { SpawnerBuilding } from "../buildings/SpawnerBuilding.js";
import { StageState } from "./StageState.js";

export function createPressureParcel(scene, parcel, { difficulty, spawnerTextureKey, quotaPerSpawner = 3, intervalMs = 4000 }) {
  const size = parcel.size;
  const origin = parcel.origin;

  // Place 1..3 spawners, spaced out.
  const spawnerCount = Math.max(1, Math.min(3, difficulty));

  const positions = [
    { x: origin.x + Math.floor(size*0.30), y: origin.y + Math.floor(size*0.35) },
    { x: origin.x + Math.floor(size*0.70), y: origin.y + Math.floor(size*0.35) },
    { x: origin.x + Math.floor(size*0.50), y: origin.y + Math.floor(size*0.70) },
  ].slice(0, spawnerCount);

  const stageIndex = StageState.stageIndex;

  for (const p of positions) {
    const worldPx = scene.parcelMapAdapter.tileToWorldCenter(p.x, p.y);

    // IMPORTANT: also register this as a "building" in your buildingManager if needed.
    // For now we only place the sprite + behavior.
    const spawner = new SpawnerBuilding(scene, worldPx, { tileX: p.x, tileY: p.y }, {
      difficulty,
      stageIndex,
      quota: quotaPerSpawner + (stageIndex - 1), // tiny scaling you can tune later
      intervalMs,
      textureKey: spawnerTextureKey,
      maxHp: 80 + 10 * (difficulty - 1),
    });

    parcel.addObject(spawner);
  }

  return parcel;
}
