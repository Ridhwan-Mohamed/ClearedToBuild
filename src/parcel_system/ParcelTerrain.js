// src/parcel_system/ParcelTerrain.js
// Terrain painters for contract parcels.

import { PARCEL_SIZE } from "./ParcelConfig.js";

function randInt(rng, a, b) { // inclusive
  return a + Math.floor(rng() * (b - a + 1));
}

function key(x, y) { return `${x},${y}`; }

function hasCell(cells, x, y) {
  return cells.has(key(x, y));
}

function fillConcavePondCells(cells, min, max) {
  let changed = true;

  while (changed) {
    changed = false;
    const toAdd = [];

    for (let yy = min; yy <= max; yy++) {
      for (let xx = min; xx <= max; xx++) {
        if (hasCell(cells, xx, yy)) continue;

        const up = hasCell(cells, xx, yy - 1);
        const right = hasCell(cells, xx + 1, yy);
        const down = hasCell(cells, xx, yy + 1);
        const left = hasCell(cells, xx - 1, yy);
        const waterNeighbors = Number(up) + Number(right) + Number(down) + Number(left);
        const concaveNotch =
          (up && right) ||
          (right && down) ||
          (down && left) ||
          (left && up);

        // Fill inward notches and single-tile holes so the shoreline only
        // needs straight edges and outer corners.
        if (waterNeighbors >= 3 || concaveNotch) {
          toAdd.push(key(xx, yy));
        }
      }
    }

    if (toAdd.length) {
      changed = true;
      for (const kk of toAdd) cells.add(kk);
    }
  }
}

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

  fillConcavePondCells(cells, min, max);

  return cells;
}

export function paintResourceParcel({
  origin,
  size = PARCEL_SIZE,
  rng,
  setGroundRect,
  setWater,
  groundType = "dirt",
  // pond controls
  pondTiles = 30,
  edgeBuffer = 2,
}) {
  const plan = buildResourceParcelTerrainPlan({
    origin,
    size,
    rng,
    groundType,
    pondTiles,
    edgeBuffer,
  });

  // one-shot fill (NO per-tile loops)
  setGroundRect(origin.x, origin.y, size, size, groundType);

  for (const cell of plan.cells) {
    if (cell.tileType !== "water") continue;
    setWater(cell.x, cell.y);
  }

  return plan;
}

export function buildResourceParcelTerrainPlan({
  origin,
  size = PARCEL_SIZE,
  rng,
  groundType = "dirt",
  pondTiles = 30,
  edgeBuffer = 2,
}) {
  const pond = buildPondCells({ size, rng, edgeBuffer, pondTiles });
  const cells = [];
  const tileTypeByKey = new Map();

  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      const tileType = pond.has(key(lx, ly)) ? "water" : groundType;
      const x = origin.x + lx;
      const y = origin.y + ly;
      const cell = { x, y, lx, ly, tileType };
      cells.push(cell);
      tileTypeByKey.set(key(x, y), tileType);
    }
  }

  return {
    origin: { x: origin.x, y: origin.y },
    size,
    groundType,
    cells,
    pondCells: Array.from(pond).map((kk) => {
      const [lx, ly] = kk.split(",").map(Number);
      return { x: origin.x + lx, y: origin.y + ly, lx, ly, tileType: "water" };
    }),
    tileTypeByKey,
  };
}

export function paintWaterRect({ origin, size = PARCEL_SIZE, setWaterRect }) {
  setWaterRect(origin.x, origin.y, size, size);
}
