// RegionSystem.js
// Team-agnostic "reachability regions" computed as connected components over navmesh polygons.
// Works for Map.navMesh and Map.enemyNavMesh equally.

import { Wall } from "../../buildings/Wall";
import { SQUARESIZE } from "../../constants";
import Vector2 from "./math/vector-2";

export class RegionSystem {

  constructor(navMesh, navGrid) {
    this.navMesh = navMesh;
    this.navGrid = navGrid;
    this.polyToRegion = new Map();   // polyId -> regionId
    this.regionToPolys = new Map();  // regionId -> array(polyId)
    // RegionSystem.js (add to constructor)
    this.borderWalls = new Map(); // key "a|b" -> Set("x,y") of WALL tiles that can participate in a breach between regions a and b
    this.regionGraph = new Map(); // regionId -> Set(neighborRegionId)
    this.wallComponents = new Map(); // componentId -> { id, tiles, regionTouches }
    this.breachEdges = new Map(); // key "a|b" -> weighted wall-chain edge between regions
    this.breachEdgeOptions = new Map(); // key "a|b" -> all weighted wall-chain options between regions
    this._regionCount = 0;
    this.dirty = true;
  }

  markDirty() {
    this.dirty = true;
  }

  ensureUpToDate() {
    if (!this.dirty) return;
    this.recompute();
  }

  recompute() {
    this.polyToRegion.clear();
    this.regionToPolys.clear();
    this._regionCount = 0;

    const polys = this.navMesh.getPolygons ? this.navMesh.getPolygons() : this.navMesh.navPolygons;
    const visited = new Set();

    for (const p of polys) {
      if (!p || visited.has(p.id)) continue;

      const rid = this._regionCount++;
      const stack = [p];
      visited.add(p.id);
      this.polyToRegion.set(p.id, rid);
      this.regionToPolys.set(rid, [p.id]);

      while (stack.length) {
        const cur = stack.pop();
        const neighbors = cur.neighbors || [];
        for (const n of neighbors) {
          if (!n) continue;
          if (visited.has(n.id)) continue;
          visited.add(n.id);
          this.polyToRegion.set(n.id, rid);
          this.regionToPolys.get(rid).push(n.id);
          stack.push(n);
        }
      }
    }

    this.dirty = false;
    this._rebuildWallBreachGraph();
  }

  getRegionCount() {
    this.ensureUpToDate();
    return this._regionCount;
  }

  getRegionIdForPoly(polyId) {
    this.ensureUpToDate();
    return this.polyToRegion.get(polyId) ?? -1;
  }

  // NOTE: uses navMesh.findClosestMeshPoint() which returns {polygon, point, distance}
  // so we don’t need any grid floodfills for region IDs.
  getRegionIdForWorldPoint(worldX, worldY) {
    this.ensureUpToDate();
    const res = this.navMesh.findClosestMeshPoint(new Vector2(worldX,worldY));
    if (!res || !res.polygon) return -1;
    return this.getRegionIdForPoly(res.polygon.id);
  }

  _key(a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return `${lo}|${hi}`;
  }

  _addEdge(a, b) {
    if (a === -1 || b === -1 || a === b) return;
    if (!this.regionGraph.has(a)) this.regionGraph.set(a, new Set());
    if (!this.regionGraph.has(b)) this.regionGraph.set(b, new Set());
    this.regionGraph.get(a).add(b);
    this.regionGraph.get(b).add(a);
  }

  _dirs4() {
    return [[1,0],[-1,0],[0,1],[0,-1]];
  }

  _wallKey(x, y) {
    return `${x},${y}`;
  }

  _parseWallKey(key) {
    const comma = key.indexOf(",");
    if (comma === -1) return null;
    const x = parseInt(key.slice(0, comma), 10);
    const y = parseInt(key.slice(comma + 1), 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  _activeWallKeys() {
    const out = new Set();
    for (const [key, wall] of Wall.byCell.entries()) {
      if (!wall?.active) continue;
      out.add(key);
    }
    return out;
  }

  _touchingRegionsForWallTile(x, y) {
    const regions = new Set();
    for (const [dx, dy] of this._dirs4()) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.navGrid?.[ny]?.[nx] !== 1) continue;

      const wx = nx * SQUARESIZE + SQUARESIZE / 2;
      const wy = ny * SQUARESIZE + SQUARESIZE / 2;
      const rid = this.getRegionIdForWorldPoint(wx, wy);
      if (rid !== -1) regions.add(rid);
    }
    return regions;
  }

  _collectWallComponent(startKey, activeWalls, visited, componentId) {
    const tiles = new Set();
    const regionTouches = new Map();
    const stack = [startKey];
    visited.add(startKey);

    while (stack.length) {
      const key = stack.pop();
      tiles.add(key);

      const cell = this._parseWallKey(key);
      if (!cell) continue;

      const touchingRegions = this._touchingRegionsForWallTile(cell.x, cell.y);
      for (const rid of touchingRegions) {
        if (!regionTouches.has(rid)) regionTouches.set(rid, new Set());
        regionTouches.get(rid).add(key);
      }

      for (const [dx, dy] of this._dirs4()) {
        const nextKey = this._wallKey(cell.x + dx, cell.y + dy);
        if (visited.has(nextKey) || !activeWalls.has(nextKey)) continue;
        visited.add(nextKey);
        stack.push(nextKey);
      }
    }

    return { id: componentId, tiles, regionTouches };
  }

  _wallPathBetweenTileSets(component, starts, goals) {
    if (!starts?.size || !goals?.size) return null;

    const q = [];
    const prev = new Map();
    const seen = new Set();

    for (const key of starts) {
      q.push(key);
      seen.add(key);
      prev.set(key, null);
    }

    let goalKey = null;
    while (q.length) {
      const key = q.shift();
      if (goals.has(key)) {
        goalKey = key;
        break;
      }

      const cell = this._parseWallKey(key);
      if (!cell) continue;

      for (const [dx, dy] of this._dirs4()) {
        const nextKey = this._wallKey(cell.x + dx, cell.y + dy);
        if (seen.has(nextKey) || !component.tiles.has(nextKey)) continue;
        seen.add(nextKey);
        prev.set(nextKey, key);
        q.push(nextKey);
      }
    }

    if (!goalKey) return null;

    const path = [];
    for (let cur = goalKey; cur != null; cur = prev.get(cur)) {
      path.push(cur);
    }
    path.reverse();
    return path;
  }

  _wallBreachOptionsInComponent(component, fromRegion, toRegion) {
    const fromTouches = component.regionTouches.get(fromRegion);
    const toTouches = component.regionTouches.get(toRegion);
    if (!fromTouches?.size || !toTouches?.size) return [];

    const out = [];
    const seenPaths = new Set();
    const addPath = (path) => {
      if (!path?.length) return;
      const key = path.join(";");
      if (seenPaths.has(key)) return;
      seenPaths.add(key);
      out.push(path);
    };

    for (const startKey of fromTouches) {
      addPath(this._wallPathBetweenTileSets(component, new Set([startKey]), toTouches));
    }

    for (const endKey of toTouches) {
      const reversePath = this._wallPathBetweenTileSets(component, new Set([endKey]), fromTouches);
      if (reversePath?.length) addPath([...reversePath].reverse());
    }

    out.sort((a, b) => a.length - b.length);
    return out;
  }

  _storeBreachEdgeOption(a, b, component, breachTileKeys) {
    if (!breachTileKeys?.length) return;
    const key = this._key(a, b);

    const breachTiles = breachTileKeys
      .map(tileKey => this._parseWallKey(tileKey))
      .filter(Boolean);

    const option = {
      fromRegion: a,
      toRegion: b,
      wallComponentId: component.id,
      cost: breachTiles.length,
      breachTiles,
    };

    if (!this.breachEdgeOptions.has(key)) this.breachEdgeOptions.set(key, []);
    this.breachEdgeOptions.get(key).push(option);

    if (!this.borderWalls.has(key)) this.borderWalls.set(key, new Set());
    const borderSet = this.borderWalls.get(key);
    for (const tileKey of breachTileKeys) borderSet.add(tileKey);

    const existing = this.breachEdges.get(key);
    if (!existing || option.cost < existing.cost) {
      this.breachEdges.set(key, option);
    }

    this._addEdge(a, b);
  }

  _rebuildWallBreachGraph() {
    this.borderWalls.clear();
    this.regionGraph.clear();
    this.wallComponents.clear();
    this.breachEdges.clear();
    this.breachEdgeOptions.clear();

    const activeWalls = this._activeWallKeys();
    const visited = new Set();
    let componentId = 0;

    for (const startKey of activeWalls) {
      if (visited.has(startKey)) continue;

      const component = this._collectWallComponent(startKey, activeWalls, visited, componentId++);
      this.wallComponents.set(component.id, component);

      const regions = [...component.regionTouches.keys()].sort((a, b) => a - b);
      if (regions.length < 2) continue;

      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          const paths = this._wallBreachOptionsInComponent(component, regions[i], regions[j]);
          for (const path of paths) {
            this._storeBreachEdgeOption(regions[i], regions[j], component, path);
          }
        }
      }
    }
  }

  _indexWallBorderTileInternal(x, y) {
    const regions = new Set();

    const dirs4 = [
  [1,0],[-1,0],[0,1],[0,-1],
    ]

    for (const [dx,dy] of dirs4) {
      if (this.navGrid[y+dy]?.[x+dx] !== 1) continue;

      const wx = (x+dx) * SQUARESIZE + SQUARESIZE/2;
      const wy = (y+dy) * SQUARESIZE + SQUARESIZE/2;
      const rid = this.getRegionIdForWorldPoint(wx, wy);
      if (rid !== -1) regions.add(rid);
    }

    if (regions.size < 2) return;

    const arr = [...regions].sort((a,b)=>a-b);
    for (let i=0;i<arr.length;i++) {
      for (let j=i+1;j<arr.length;j++) {
        const key = `${arr[i]}|${arr[j]}`;
        let set = this.borderWalls.get(key);
        if (!set) this.borderWalls.set(key, set = new Set());
        set.add(`${x},${y}`);
        this._addEdge(arr[i], arr[j]);
      }
    }
  }

  // RegionSystem.js
  rebuildBorderWallsInBounds(bounds, navGrid, squareSize, allWalls) {
    // bounds = { minX, minY, maxX, maxY } in GRID coords
    this._rebuildWallBreachGraph();
  }

  // If a wall is destroyed / becomes walkable, remove it from all buckets.
  // (Cheapest: just delete "x,y" from every Set; faster: keep a reverse index wall->keys)
  removeWallFromBorderIndex(x, y) {
    this._rebuildWallBreachGraph();
  }

  // Convenience for "is path possible at all (topology-wise)" checks.
  canReachWorldToWorld(ax, ay, bx, by) {
    const ra = this.getRegionIdForWorldPoint(ax, ay);
    const rb = this.getRegionIdForWorldPoint(bx, by);
    return ra !== -1 && ra === rb;
  }
}
