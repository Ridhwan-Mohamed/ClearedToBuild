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
    this.borderWalls = new Map(); // key "a|b" -> Set("x,y") of WALL tiles separating regions a and b
    this.regionGraph = new Map(); // regionId -> Set(neighborRegionId)
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
    const prevRegionCount = this._regionCount;

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
    const newRegionCount = this.regionCount;
    const topologyChanged = newRegionCount !== prevRegionCount;
    if (topologyChanged) {
      this.borderWalls.clear();
      this.regionGraph.clear();
      for (const key of Wall.byCell.keys()) {
        const [x, y] = key.split(",").map(Number);
        this._indexWallBorderTileInternal(x, y);
      }
    }
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
    this.borderWalls.clear();
    this.regionGraph.clear();

    for (const key of allWalls) {
      const [x, y] = key.split(",").map(Number);

      if (
        x < bounds.minX || x > bounds.maxX ||
        y < bounds.minY || y > bounds.maxY
      ) {
        continue;
      }

      this.indexWallBorderTile(x, y, navGrid, squareSize);
    }
  }

  // If a wall is destroyed / becomes walkable, remove it from all buckets.
  // (Cheapest: just delete "x,y" from every Set; faster: keep a reverse index wall->keys)
  removeWallFromBorderIndex(x, y) {
    const t = `${x},${y}`;
    for (const set of this.borderWalls.values()) set.delete(t);
  }

  // Convenience for "is path possible at all (topology-wise)" checks.
  canReachWorldToWorld(ax, ay, bx, by) {
    const ra = this.getRegionIdForWorldPoint(ax, ay);
    const rb = this.getRegionIdForWorldPoint(bx, by);
    return ra !== -1 && ra === rb;
  }
}
