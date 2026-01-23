// SiegePlanner.js
// Uses enemyNavGrid for movement feasibility AND chooses wall/door tiles to break via 0-1 BFS.
// - walkable tile (1) cost = 0
// - breachable tile (wall/door) cost = 1
// - hard blocked (buildings etc.) cost = INF (ignored)

export class SiegePlanner {
  constructor(opts) {
    this.squareSize = opts.squareSize; // SQUARESIZE
    this.enemyNavGrid = opts.enemyNavGrid; // Map.enemyNavGrid
    this.isBreachableTile = opts.isBreachableTile; 
    this.regionSystem = opts.regionSystem; // e.g. Map.enemyRegionSystem
    // (x,y) => true if tile is wall or door (for raiders)
    this.isHardBlockedTile = opts.isHardBlockedTile || (() => false);
    // (x,y) => true if should be treated as impossible even for breach search (optional)
  }

  // Return tiles (grid coords) raiders should break to get from startWorld -> any target tile.
  // targets = array of {x,y} grid tiles (usually POI perimeter tiles)
  planBreach(startWorldX, startWorldY, targets) {
    const rs = this.regionSystem;
    if (!rs?.getRegionIdForWorldPoint || !rs?.borderWalls || !rs?.regionGraph) {
      // Fallback to old behavior if RegionSystem not wired (keeps game from breaking)
      return this._planBreach01BFS(startWorldX, startWorldY, targets);
    }

    const key = (a, b) => `${Math.min(a, b)}|${Math.max(a, b)}`;

    const worldCenterOfTile = (tx, ty) => ({
      x: tx * this.squareSize + this.squareSize / 2,
      y: ty * this.squareSize + this.squareSize / 2,
    });

    // Targets are usually perimeter tiles; if a target tile is NOT walkable (wall),
    // infer a region by checking its walkable neighbors.
    const regionForTile = (tx, ty) => {
      const H = this.enemyNavGrid.length;
      const W = this.enemyNavGrid[0].length;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return -1;

      if (this.enemyNavGrid[ty][tx] === 1) {
        const w = worldCenterOfTile(tx, ty);
        return rs.getRegionIdForWorldPoint(w.x, w.y);
      }

      // Not walkable => look for any adjacent walkable and use its region
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of dirs) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (this.enemyNavGrid[ny][nx] !== 1) continue;
        const w = worldCenterOfTile(nx, ny);
        const rid = rs.getRegionIdForWorldPoint(w.x, w.y);
        if (rid !== -1) return rid;
      }

      return -1;
    };

    const startRid = rs.getRegionIdForWorldPoint(startWorldX, startWorldY);
    if (startRid === -1) return null;

    // Collect unique target regions
    const targetRegions = new Set();
    for (const t of targets) {
      const rid = regionForTile(t.x, t.y);
      if (rid !== -1) targetRegions.add(rid);
    }
    if (targetRegions.size === 0) return null;

    // If already in a target region: no breach needed
    if (targetRegions.has(startRid)) return [];

    // ---- BFS over regionGraph (each edge = 1 breach) ----
    const q = [startRid];
    const prev = new Map(); // region -> prevRegion
    prev.set(startRid, null);

    let goal = null;
    while (q.length) {
      const r = q.shift();
      if (targetRegions.has(r)) { goal = r; break; }

      const neigh = rs.regionGraph.get(r);
      if (!neigh) continue;

      for (const n of neigh) {
        if (prev.has(n)) continue;
        prev.set(n, r);
        q.push(n);
      }
    }

    if (goal == null) {
      // No region-path to any target region (means borderWalls/graph not indexed properly)
      return null;
    }

    // Reconstruct region path: start -> ... -> goal
    const regionPath = [];
    for (let cur = goal; cur != null; cur = prev.get(cur)) regionPath.push(cur);
    regionPath.reverse();

    // For each region-to-region hop, choose ONE wall tile on that border (closest greedy)
    const breachTiles = [];
    let lastWX = startWorldX;
    let lastWY = startWorldY;

    for (let i = 0; i + 1 < regionPath.length; i++) {
      const a = regionPath[i];
      const b = regionPath[i + 1];
      const k = key(a, b);

      const set = rs.borderWalls.get(k);
      if (!set || set.size === 0) {
        // Graph says edge exists but no tiles indexed => indexing bug upstream
        return null;
      }

      // Pick the best wall tile on this border (nearest to our current "breach front")
      let best = null;
      let bestD = Infinity;

      for (const s of set) {
        const comma = s.indexOf(",");
        if (comma === -1) continue;
        const tx = parseInt(s.slice(0, comma), 10);
        const ty = parseInt(s.slice(comma + 1), 10);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;

        // Only consider actually breachable tiles (walls/doors)
        if (!this.isBreachableTile(tx, ty)) continue;
        if (this.isHardBlockedTile(tx, ty)) continue;

        const w = worldCenterOfTile(tx, ty);
        const d = (w.x - lastWX) * (w.x - lastWX) + (w.y - lastWY) * (w.y - lastWY);
        if (d < bestD) {
          bestD = d;
          best = { x: tx, y: ty };
        }
      }

      if (!best) return null;

      breachTiles.push(best);

      // advance the "front" to that breach tile
      const bw = worldCenterOfTile(best.x, best.y);
      lastWX = bw.x;
      lastWY = bw.y;
    }

    return this._uniqTiles(breachTiles);
  }

  // Build POI perimeter target tiles (grid coords) for a footprint rectangle (x,y,lenX,lenY).
  static buildPerimeterTargets(x, y, lenX, lenY, gridW, gridH) {
    const targets = [];
    // ring around the footprint
    for (let ty = y - 1; ty <= y + lenY; ty++) {
      for (let tx = x - 1; tx <= x + lenX; tx++) {
        const inside = (tx >= x && tx < x + lenX && ty >= y && ty < y + lenY);
        if (inside) continue;
        if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) continue;
        targets.push({ x: tx, y: ty });
      }
    }
    return targets;
  }

  _worldToTile(wx, wy) {
    return {
      x: Math.floor(wx / this.squareSize),
      y: Math.floor(wy / this.squareSize),
    };
  }

  _inBounds(x, y) {
    return y >= 0 && y < this.enemyNavGrid.length && x >= 0 && x < this.enemyNavGrid[0].length;
  }

  _uniqTiles(arr) {
    const out = [];
    const seen = new Set();
    for (const t of arr) {
      const k = `${t.x},${t.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }
}
