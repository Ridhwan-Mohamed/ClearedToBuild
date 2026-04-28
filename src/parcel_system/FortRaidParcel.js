// src/parcel_system/FortRaidParcel.js
// North fort "raid spawn" island: terrain + tower + enemy-only-walkable walls + a few raiders.

import { PARCEL_SIZE } from "./ParcelConfig.js";
import { TILE_TYPES, SQUARESIZE, TILE_MAP } from "../constants.js";
import { StageState } from "../parcelController/StageState.js";
import { TowerBuilding } from "../buildings/Tower.js";
import { Wall } from "../buildings/Wall.js";
import { Prison } from "../buildings/Prison.js";
import { Bank } from "../buildings/Bank.js";
import { Teams } from "../Teams.js";
import Phaser from "phaser";
import { FortGrunt } from "../players/FortGrunt.js";
import { VisibilitySystem } from "../UI/VisibilitySystem.js";

export const FORT_GRUNT_CONFIG = {
  BASE_COUNT: 2,
  PER_STAGE: 1,
  PER_SEASON: 2,
  MAX_COUNT: 12,
};

export const FORT_TOWER_CONFIG = {
  STAGE_1_2: 1,
  STAGE_3_4: 2,
  STAGE_5_BOSS: 3,
};

function getTowerCountForStage(stageIndex) {
  const s = Math.max(1, Number(stageIndex || 1));
  if (s >= 5) return FORT_TOWER_CONFIG.STAGE_5_BOSS;
  if (s >= 3) return FORT_TOWER_CONFIG.STAGE_3_4;
  return FORT_TOWER_CONFIG.STAGE_1_2;
}

function randInt(min, maxInclusive) {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function inBounds(map, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    map?.grid &&
    y < map.grid.length &&
    x < map.grid[0].length
  );
}

function isWaterCell(map, gx, gy) {
  const cell = map?.grid?.[gy]?.[gx];
  if (cell == null) return true;
  if (Array.isArray(cell)) {
    return cell[0] === TILE_TYPES.water.grid || cell[1] === TILE_TYPES.water.grid;
  }
  return cell === TILE_TYPES.water.grid;
}

function footprintOverlaps(a, b) {
  // a/b: {x,y,w,h} in tiles
  return !(
    a.x + a.w - 1 < b.x ||
    b.x + b.w - 1 < a.x ||
    a.y + a.h - 1 < b.y ||
    b.y + b.h - 1 < a.y
  );
}

function expandedFootprint(fp, pad) {
  return { x: fp.x - pad, y: fp.y - pad, w: fp.w + pad * 2, h: fp.h + pad * 2 };
}

function insideRect(fp, rx, ry, rw, rh) {
  return (
    fp.x >= rx &&
    fp.y >= ry &&
    (fp.x + fp.w) <= (rx + rw) &&
    (fp.y + fp.h) <= (ry + rh)
  );
}

// candidate anchors around a "center" footprint, keeping a 1-tile corridor gap
function buildRingCandidates(centerFp, objW, objH, gap = 1) {
  const cx0 = centerFp.x;
  const cy0 = centerFp.y;
  const cw = centerFp.w;
  const ch = centerFp.h;

  // positions are top-left anchors for the object footprint
  return [
    // cardinal
    { x: cx0,               y: cy0 - (objH + gap) },                  // N
    { x: cx0,               y: cy0 + ch + gap },                      // S
    { x: cx0 - (objW + gap),y: cy0 },                                 // W
    { x: cx0 + cw + gap,    y: cy0 },                                 // E

    // diagonals
    { x: cx0 - (objW + gap),y: cy0 - (objH + gap) },                  // NW
    { x: cx0 + cw + gap,    y: cy0 - (objH + gap) },                  // NE
    { x: cx0 - (objW + gap),y: cy0 + ch + gap },                      // SW
    { x: cx0 + cw + gap,    y: cy0 + ch + gap },                      // SE
  ];
}

// simple shuffle using rng()
function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setCellTop(map, gx, gy, topGridVal) {
  const cell = map.grid?.[gy]?.[gx];
  if (cell == null) return;

  if (Array.isArray(cell)) {
    // keep existing floor, replace overlay
    map.grid[gy][gx] = [cell[0], topGridVal];
  } else {
    // add overlay
    map.grid[gy][gx] = [cell, topGridVal];
  }
}

// === Fort object tracking (for clean fade-out later) ===
function _trackFortThing(track, objOrSprite) {
  if (!track || !objOrSprite) return;

  // If they passed a building (Tower/Bank/Prison), prefer its sprite + collider
  const spr = objOrSprite.sprite ?? objOrSprite;
  const body = objOrSprite.body;

  if (spr && spr.setAlpha) track.sprites.push(spr);
  if (body && body.enable !== undefined) track.bodies.push(body);
}

// wall: blocks BOTH player + enemy
function placeFortWall(map, gx, gy, typeKey, track) {
  if (!inBounds(map, gx, gy)) return null;
  if (isWaterCell(map, gx, gy)) return null;

  setCellTop(map, gx, gy, TILE_TYPES[typeKey].grid);

  const wall = Wall.ensureAt(map.scene, gx, gy, 0); // returns Wall instance :contentReference[oaicite:2]{index=2}
  map.refreshWallShapesAround?.(gx, gy);
  _trackFortThing(track, wall);

  if (map.navGrid?.[gy])      map.navGrid[gy][gx] = 0; // player blocked
  if (map.enemyNavGrid?.[gy]) map.enemyNavGrid[gy][gx] = 0; // enemy blocked
  return wall;
}

// door: blocks player, allows enemy
function placeFortDoor(map, gx, gy, doorKey, track) {
  if (!inBounds(map, gx, gy)) return null;
  if (isWaterCell(map, gx, gy)) return null;

  setCellTop(map, gx, gy, TILE_TYPES[doorKey].grid);

  const wall = Wall.ensureAt(map.scene, gx, gy, 0);
  map.refreshWallShapesAround?.(gx, gy);
  _trackFortThing(track, wall);

  if (map.navGrid?.[gy])      map.navGrid[gy][gx] = 0; // player blocked
  if (map.enemyNavGrid?.[gy]) map.enemyNavGrid[gy][gx] = 1; // enemy can pass
  return wall;
}

/**
 * Spawn the fort directly north of the main island.
 * - Paint water pad + fort_floor interior
 * - Pick a random tower spot inside the island interior
 * - Build a wall ring around the tower footprint (+ padding), with a door
 * - Spawn a few raiders inside the walls
 */
export function spawnNorthFort({
  scene,
  map,
  mainIslandOrigin,
  size = PARCEL_SIZE,
  inset = 0,

  // Optional knobs
  wallPadding = 2,             // extra tiles between tower footprint and walls
  wallType = "woodWall",       // "woodWall" | "wall" (stone)
  doorType = "woodWall_door",  // matching door
  fortGruntCount = null,
} = {}) {
  if (!scene || !map || !mainIslandOrigin) return null;

  const origin = {
    x: mainIslandOrigin.x,
    y: mainIslandOrigin.y - size,
  };

  // 1) Water pad (separate island feel)
  map.setWaterRect?.(origin.x, origin.y, size, size);
  const fortTrack = { sprites: [], bodies: [] };
  const objectiveTowers = [];

  // 2) Fort floor
  const inner = Math.max(1, size - inset * 2);
  const innerX = origin.x + inset;
  const innerY = origin.y + inset;
  map.setGroundRect?.(innerX, innerY, inner, inner, "fort_floor");
  map.refreshTerrainShapesInRect?.(innerX, innerY, inner, inner, 2);

  const stageIndex = Math.max(1, StageState.stageIndex || 1);
  const seasonIndex = Math.max(1, StageState.seasonIndex || 1);
  const towerCount = getTowerCountForStage(stageIndex);

  // 3) Pick a random tower spot inside the inner rect (with safe margins)
  const towerType = TILE_TYPES.tower ?? { lenX: 1, lenY: 1, name: "tower" };
  const tw = towerType.lenX ?? 1;
  const th = towerType.lenY ?? 1;

  // Keep the whole tower footprint inside the inner rect, with room for walls
  const margin = Math.max(1, wallPadding + 1);
  const minGX = innerX + margin;
  const minGY = innerY + margin;
  const maxGX = innerX + inner - tw - margin;
  const maxGY = innerY + inner - th - margin;

  // "back middle" = near the NORTH edge, centered on X
  const anchorGX = clamp(
    Math.floor(innerX + (inner / 2) - (tw / 2)),
    minGX,
    maxGX
  );

  // push tower toward the back (north). keep it legal.
  const anchorGY = clamp(
    innerY + margin,   // as far north as we safely can
    minGY,
    maxGY
  );
  const towerGX = anchorGX;
  const towerGY = anchorGY;

  // Make sure TowerBuilding has a scene
  TowerBuilding.scene = TowerBuilding.scene ?? scene;

  // ✅ Create the tower HERE, then set objective HERE
  const dirs = ["W", "E", "S"];
  const pressureSlotId = dirs[randInt(0, dirs.length - 1)];

  const towerInstance = new TowerBuilding(towerGX, towerGY, /*team*/ 0, {
    isFortObjective: true,
    isPressureTower: true,
    pressureSlotId,
  });

  objectiveTowers.push(towerInstance);
  _trackFortThing(fortTrack, towerInstance);

  const extraTowerSpots = [];
  const remainingPressureSlots = dirs.filter((d) => d !== pressureSlotId);
  if (towerCount > 1) {
    const taken = new Set([`${towerGX},${towerGY}`]);
    const towerGap = 1;
    const placedTowerFps = [{ x: towerGX, y: towerGY, w: tw, h: th }];
    const pref = [
      { x: clamp(towerGX - (tw + towerGap), minGX, maxGX), y: clamp(towerGY, minGY, maxGY) },
      { x: clamp(towerGX + (tw + towerGap), minGX, maxGX), y: clamp(towerGY, minGY, maxGY) },
      { x: clamp(towerGX, minGX, maxGX), y: clamp(towerGY + (th + towerGap), minGY, maxGY) },
    ];
    const canPlace = (gx, gy) => {
      const key = `${gx},${gy}`;
      if (taken.has(key)) return false;
      if (gx < minGX || gy < minGY || gx > maxGX || gy > maxGY) return false;
      for (let yy = gy; yy < gy + th; yy++) {
        for (let xx = gx; xx < gx + tw; xx++) {
          if (!inBounds(map, xx, yy) || isWaterCell(map, xx, yy)) return false;
        }
      }

      const fp = { x: gx, y: gy, w: tw, h: th };
      const padded = expandedFootprint(fp, towerGap);
      for (const p of placedTowerFps) {
        if (footprintOverlaps(padded, expandedFootprint(p, towerGap))) return false;
      }
      return true;
    };
    const pushSpot = (gx, gy) => {
      if (!canPlace(gx, gy)) return false;
      taken.add(`${gx},${gy}`);
      extraTowerSpots.push({ x: gx, y: gy });
      placedTowerFps.push({ x: gx, y: gy, w: tw, h: th });
      return true;
    };

    for (const c of pref) {
      if (objectiveTowers.length + extraTowerSpots.length >= towerCount) break;
      pushSpot(c.x, c.y);
    }
    for (let i = 0; i < 300 && objectiveTowers.length + extraTowerSpots.length < towerCount; i++) {
      pushSpot(randInt(minGX, maxGX), randInt(minGY, maxGY));
    }

    for (const spot of extraTowerSpots) {
      const slotForTower = remainingPressureSlots.shift() ?? null;
      const tower = new TowerBuilding(spot.x, spot.y, 0, {
        isFortObjective: true,
        isPressureTower: true,
        pressureSlotId: slotForTower,
      });
      objectiveTowers.push(tower);
      _trackFortThing(fortTrack, tower);
    }
  }


  // 3.5) Place bank + prison near the tower with a 1-tile gap,
  // then wall around the whole cluster (tower+bank+prison).
  // ─────────────────────────────────────────────────────────────
  const rng = scene?.rng ?? Math.random;

  const gap = 1; // 1-tile corridor between footprints
  const bankType = TILE_TYPES.bank ?? { lenX: 4, lenY: 4 };
  const prisonType = TILE_TYPES.prison ?? { lenX: 4, lenY: 4 };

  const towerFp = { x: towerGX, y: towerGY, w: tw, h: th };

  // We enforce separation by expanding "no-go" by gap around each placed footprint.
  const placed = [];
  placed.push(towerFp);
  for (const spot of extraTowerSpots) {
    placed.push({ x: spot.x, y: spot.y, w: tw, h: th });
  }

  function tryPlaceAroundTower(objType, ctorFn) {
    const objW = objType.lenX ?? 4;
    const objH = objType.lenY ?? 4;

    let candidates = buildRingCandidates(towerFp, objW, objH, gap);
    shuffleInPlace(candidates, rng);

    // fallback: if ring fails, scan a small box around tower
    const fallbackScan = [];
    const scanR = 8; // tiles
    for (let dy = -scanR; dy <= scanR; dy++) {
      for (let dx = -scanR; dx <= scanR; dx++) {
        fallbackScan.push({ x: towerFp.x + dx, y: towerFp.y + dy });
      }
    }
    shuffleInPlace(fallbackScan, rng);
    candidates = candidates.concat(fallbackScan);

    for (const c of candidates) {
      const fp = { x: c.x, y: c.y, w: objW, h: objH };

      const rectX = innerX + 1;
      const rectY = innerY + 1;
      const rectW = inner - 2;
      const rectH = inner - 2;
      if (!insideRect(fp, rectX, rectY, rectW, rectH)) continue;

      const fpNoGo = expandedFootprint(fp, gap);
      let ok = true;
      for (const p of placed) {
        const pNoGo = expandedFootprint(p, gap);
        if (footprintOverlaps(fpNoGo, pNoGo)) { ok = false; break; }
      }
      if (!ok) continue;

      // optional: verify the full footprint isn't water
      let bad = false;
      for (let yy = fp.y; yy < fp.y + fp.h; yy++) {
        for (let xx = fp.x; xx < fp.x + fp.w; xx++) {
          if (isWaterCell(map, xx, yy)) { bad = true; break; }
        }
        if (bad) break;
      }
      if (bad) continue;

      const inst = ctorFn(fp.x, fp.y);
      placed.push(fp);
      return { fp, inst };
    }

    return null;
  }

  // Spawn BANK + PRISON (order randomized so layout varies)
  const order = rng() < 0.5 ? ["bank", "prison"] : ["prison", "bank"];

  let bankInst = null;
  let prisonInst = null;

  for (const key of order) {
    if (key === "bank") {
      const res = tryPlaceAroundTower(bankType, (gx, gy) => new Bank(gx, gy, 0));
      bankInst = res?.inst ?? bankInst;
      if (res?.inst) _trackFortThing(fortTrack, res.inst);
    } else {
      const res = tryPlaceAroundTower(prisonType, (gx, gy) =>
        new Prison(gx, gy, 0)
      );
      prisonInst = res?.inst ?? prisonInst;
      if (res?.inst) _trackFortThing(fortTrack, res.inst);
    }
  }

  // raw bounds
  // 4) Build a wall ring around the whole cluster (tower + bank + prison)
  const extra = 2; // keep your existing “expand walls” behavior
  const pad = wallPadding + extra;

  // Compute cluster bounds from all placed footprints
  let clusterMinX = Infinity, clusterMinY = Infinity, clusterMaxX = -Infinity, clusterMaxY = -Infinity;
  for (const fp of placed) {
    clusterMinX = Math.min(clusterMinX, fp.x);
    clusterMinY = Math.min(clusterMinY, fp.y);
    clusterMaxX = Math.max(clusterMaxX, fp.x + fp.w - 1);
    clusterMaxY = Math.max(clusterMaxY, fp.y + fp.h - 1);
  }

  // expand by pad to create space between buildings and walls
  let minx = clusterMinX - pad;
  let miny = clusterMinY - pad;
  let maxx = clusterMaxX + pad;
  let maxy = clusterMaxY + pad;

  // Clamp wall bounds to stay inside the fort floor (inner rect), minus 1 tile,
  // so walls don't spill into water or beyond the parcel.
  const clampMinX = innerX + 1;
  const clampMinY = innerY + 1;
  const clampMaxX = innerX + inner - 2;
  const clampMaxY = innerY + inner - 2;

  minx = clamp(minx, clampMinX, clampMaxX);
  miny = clamp(miny, clampMinY, clampMaxY);
  maxx = clamp(maxx, clampMinX, clampMaxX);
  maxy = clamp(maxy, clampMinY, clampMaxY);

  // Door in the middle of the south edge
  const doorX = Math.floor((minx + maxx) / 2);
  const doorY = maxy;


  // Top / bottom edges
  for (let x = minx; x <= maxx; x++) {
    placeFortWall(map, x, miny, wallType, fortTrack);
    if (!(x === doorX && doorY === maxy)) placeFortWall(map, x, maxy, wallType, fortTrack);
  }

  // Left / right edges
  for (let y = miny; y <= maxy; y++) {
    placeFortWall(map, minx, y, wallType, fortTrack);
    placeFortWall(map, maxx, y, wallType, fortTrack);
  }

  placeFortDoor(map, doorX, doorY, doorType, fortTrack);
  map.refreshTerrainShapesInRect?.(origin.x, origin.y, size, size, 2);

  const fortRoads = [];
  for (let y = miny + 1; y <= maxy - 1; y++) {
    for (let x = minx + 1; x <= maxx - 1; x++) {
      if (map.enemyNavGrid?.[y]?.[x] === 1) fortRoads.push([x, y]);
    }
  }

  const desiredCount = fortGruntCount ?? Math.min(
    FORT_GRUNT_CONFIG.MAX_COUNT,
    FORT_GRUNT_CONFIG.BASE_COUNT +
      (stageIndex - 1) * FORT_GRUNT_CONFIG.PER_STAGE +
      (seasonIndex - 1) * (FORT_GRUNT_CONFIG.PER_SEASON ?? 0)
  );

  const spawnPool = [...fortRoads];
  for (let i = 0; i < desiredCount && spawnPool.length > 0; i++) {
    const pick = Phaser.Utils.Array.RemoveRandomElement(spawnPool);
    if (!pick) break;
    const [gx, gy] = pick;
    const grunt = new FortGrunt(gx, gy, 0);
    grunt.fortBounds = { minx, miny, maxx, maxy };
    grunt.fortRoads = fortRoads;
  }

  const parcelBounds = {
    minx: origin.x,
    miny: origin.y,
    maxx: origin.x + size - 1,
    maxy: origin.y + size - 1,
  };

  try {
    const refreshArea = {
      x: parcelBounds.minx,
      y: parcelBounds.miny,
      w: parcelBounds.maxx - parcelBounds.minx + 1,
      h: parcelBounds.maxy - parcelBounds.miny + 1,
      parcelTag: "parcel:fort_north",
    };
    if (scene.refreshParcelArea) {
      scene.refreshParcelArea(refreshArea);
    } else {
      map.reDraw?.();
      scene.rebuildBothNavMeshes?.();
    }
    map._uiIgnoreWorldLayer?.();
  } catch (_) {}

  // Arm the fort objective AFTER everything is spawned and bounds are known

  StageState.setFortObjective({
    parcel: "north_fort",
    requiredTowerCount: objectiveTowers.length, // supports multiple towers
    requiredFortEnemyCount: desiredCount,
    bounds: { minx, miny, maxx, maxy },
    refs: {
      // camera / explosions want one explicit tower ref
      tower: objectiveTowers[0] || null,
      // your fade-out system expects this (best path)
      fortTrack, // assuming you already built fortTrack = { sprites:[], bodies:[] }
      // full 25x25 fort parcel bounds (used for evacuation gating)
      parcelBounds,
    },
  });

  return {
    origin,
    tower: towerInstance,
    bank: bankInst,
    prison: prisonInst,
    fortRoads,
    bounds: { minx, miny, maxx, maxy }
  };
}

function _cellInBounds(gx, gy, b) {
  return gx >= b.minx && gx <= b.maxx && gy >= b.miny && gy <= b.maxy;
}

function _destroyBarrierChildrenInBounds(group, bounds) {
  const kids = group?.getChildren?.() || [];
  for (const body of kids) {
    if (!body?.active) continue;
    const gx = Math.floor((body.x ?? 0) / SQUARESIZE);
    const gy = Math.floor((body.y ?? 0) / SQUARESIZE);
    if (_cellInBounds(gx, gy, bounds)) {
      try { body.destroy?.(); } catch {}
    }
  }
}

export function clearNorthFort({ scene, map, meta } = {}) {
  if (!scene || !map || !meta?.bounds) return;

  const bounds = meta.bounds;
  const enemyTeam = Teams.teamLists?.["0"];

  // Remove any lingering FoW light/vision sources from this fort area.
  // This guards against objects that were faded/destroyed without running
  // their normal destroy hooks.
  VisibilitySystem.clearSourcesInBounds(bounds.minx, bounds.miny, bounds.maxx, bounds.maxy);

  // 1) Remove tracked visuals/colliders if still around
  const track = meta?.refs?.fortTrack;
  if (track?.bodies?.length) {
    track.bodies.forEach((b) => {
      try { b.enable = false; b.destroy?.(); } catch {}
    });
  }
  if (track?.sprites?.length) {
    track.sprites.forEach((s) => {
      try { s.destroy?.(); } catch {}
    });
  }

  // 2) Destroy wall registry entries explicitly (prevents rehydrate from stale byCell)
  for (let y = bounds.miny; y <= bounds.maxy; y++) {
    for (let x = bounds.minx; x <= bounds.maxx; x++) {
      const w = Wall.getAt?.(x, y);
      if (w) {
        try { Wall.destroyAt(x, y); } catch {}
      }
    }
  }

  // 2.5) Remove fort-bound grunts from previous cycle.
  if (enemyTeam?.playerList?.length) {
    const toRemove = enemyTeam.playerList.filter((troop) => {
      if (!troop?.active || !troop?.isFortGrunt) return false;
      const gx = Math.floor((troop.x ?? 0) / SQUARESIZE);
      const gy = Math.floor((troop.y ?? 0) / SQUARESIZE);
      return _cellInBounds(gx, gy, bounds);
    });

    toRemove.forEach((troop) => {
      try { troop.destroySelf?.({ silentStageCleanup: true }); } catch {}
    });
  }

  // Also clear queued destroy tasks that point at stale fort objects.
  const team1 = Teams.teamLists?.["1"];
  if (team1) {
    if (Array.isArray(team1.enemyDestroyStates)) {
      team1.enemyDestroyStates = team1.enemyDestroyStates.filter((t) => !t || !_cellInBounds(t.x ?? -1, t.y ?? -1, bounds));
    }
    if (Array.isArray(team1.enemyDestroyTileStates)) {
      team1.enemyDestroyTileStates = team1.enemyDestroyTileStates.filter((t) => !t || !_cellInBounds(t.x ?? -1, t.y ?? -1, bounds));
    }
  }

  // 3) Clear any physics blockers left in both groups for this fort area
  _destroyBarrierChildrenInBounds(map.barrier, bounds);
  _destroyBarrierChildrenInBounds(map.structureBarrier, bounds);

  // 4) Reset fort cells to plain fort floor + walkable nav
  for (let y = bounds.miny; y <= bounds.maxy; y++) {
    for (let x = bounds.minx; x <= bounds.maxx; x++) {
      const cell = map.grid?.[y]?.[x];
      if (cell == null) continue;

      // keep only floor layer; force to fort interior if needed
      const floorVal = Array.isArray(cell) ? cell[0] : cell;
      const floorName = TILE_MAP(floorVal);
      map.grid[y][x] = (floorName === "fort_floor") ? floorVal : TILE_TYPES.fort_floor.interior;

      if (map.navGrid?.[y]) map.navGrid[y][x] = 1;
      if (map.enemyNavGrid?.[y]) map.enemyNavGrid[y][x] = 1;
    }
  }

  map.refreshTerrainShapesInRect?.(
    bounds.minx,
    bounds.miny,
    bounds.maxx - bounds.minx + 1,
    bounds.maxy - bounds.miny + 1,
    2
  );

  const refreshBounds = meta?.refs?.parcelBounds || bounds;
  const refreshArea = {
    x: refreshBounds.minx,
    y: refreshBounds.miny,
    w: refreshBounds.maxx - refreshBounds.minx + 1,
    h: refreshBounds.maxy - refreshBounds.miny + 1,
    parcelTag: "parcel:fort_north",
  };
  if (scene.refreshParcelArea) {
    scene.refreshParcelArea(refreshArea);
  } else {
    map.reDraw?.();
    scene.rebuildBothNavMeshes?.();
  }
  map._uiIgnoreWorldLayer?.();
}

export function respawnNorthFort({ scene, map, mainIslandOrigin, oldMeta } = {}) {
  if (!scene || !map || !mainIslandOrigin) return null;

  // Hard-clear any previous fort footprint first.
  clearNorthFort({ scene, map, meta: oldMeta });

  const spawned = spawnNorthFort({ scene, map, mainIslandOrigin });

  return spawned;
}



