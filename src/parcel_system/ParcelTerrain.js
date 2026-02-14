// src/parcel_system/ParcelTerrain.js
// Terrain painters for contract parcels.

import { PARCEL_SIZE } from "./ParcelConfig.js";

function randInt(rng, a, b) { // inclusive
  return a + Math.floor(rng() * (b - a + 1));
}

function key(x, y) { return `${x},${y}`; }

/**
 * Build a clustered pond using a remembered random-walk + smoothing.
 * Returns a Set of "x,y" local coords.
 */
function buildPondCells({ size, rng, edgeBuffer = 2, pondTiles = 30 }) {
  const min = edgeBuffer;
  const max = size - 1 - edgeBuffer;

  // start near the center-ish
  let x = randInt(rng, min + 2, max - 2);
  let y = randInt(rng, min + 2, max - 2);

  const cells = new Set();
  const clamp = (v) => Math.max(min, Math.min(max, v));

  // remembered random walk
  for (let i = 0; i < pondTiles; i++) {
    cells.add(key(x, y));

    const r = rng();
    if (r < 0.25) x = clamp(x + 1);
    else if (r < 0.50) x = clamp(x - 1);
    else if (r < 0.75) y = clamp(y + 1);
    else y = clamp(y - 1);

    // occasionally make lobes
    if (rng() < 0.08) {
      x = clamp(x + randInt(rng, -2, 2));
      y = clamp(y + randInt(rng, -2, 2));
    }
  }

  // smoothing: add tiles with many pond neighbors
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const toAdd = [];
  for (let yy = min; yy <= max; yy++) {
    for (let xx = min; xx <= max; xx++) {
      const kk = key(xx, yy);
      if (cells.has(kk)) continue;
      let n = 0;
      for (const [dx, dy] of dirs) {
        if (cells.has(key(xx + dx, yy + dy))) n++;
      }
      if (n >= 3) toAdd.push(kk);
    }
  }
  for (const kk of toAdd) cells.add(kk);

  return cells;
}

export function paintResourceParcel({
  origin,
  size = PARCEL_SIZE,
  rng,
  setGroundRect,
  setWater,
  // pond controls
  pondTiles = 30,
  edgeBuffer = 2,
}) {
  // one-shot fill (NO per-tile loops)
  setGroundRect(origin.x, origin.y, size, size);

  const pond = buildPondCells({ size, rng, edgeBuffer, pondTiles });
  for (const kk of pond) {
    const [lx, ly] = kk.split(",").map(Number);
    setWater(origin.x + lx, origin.y + ly);
  }
}

export function paintWaterRect({ origin, size = PARCEL_SIZE, setWaterRect }) {
  setWaterRect(origin.x, origin.y, size, size);
}
