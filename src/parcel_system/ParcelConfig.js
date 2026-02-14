// parcelSystem/ParcelConfig.js
export const PARCEL_SIZE = 25;

export const CONTRACT_SLOTS = {
  W:  { id: "W",  dx: -PARCEL_SIZE, dy: 0 },
  S: { id: "S", dx: 0,            dy: PARCEL_SIZE },
  E:  { id: "E",  dx: PARCEL_SIZE,  dy: 0 },
};

export const RESOURCE_CONTRACT_MS = {
  FOREST: 60_000,
  ROCK:   60_000,
};

export const PRESSURE = {
  baseEnemiesPerSpawner: 3,
  maxDifficulty: 3,
  spawnIntervalMs: 6000,
  minSpawnIntervalMs: 1500,
};
