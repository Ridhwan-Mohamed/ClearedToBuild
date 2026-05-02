// SiegePlanner.js
// Uses RegionSystem's cached breach graph to choose wall/door chains to break.
// Thick walls are represented as weighted region edges whose cost is the number
// of wall tiles in a chain through a connected wall component. RegionSystem can
// expose many breach options for the same region pair; the planner keeps wall
// break count primary and uses tile distance only as a tie-breaker.

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
    if (!rs?.getRegionIdForWorldPoint || !rs?.regionGraph) {
      return null;
    }

    const key = (a, b) => `${Math.min(a, b)}|${Math.max(a, b)}`;
    const startTile = this._worldToTile(startWorldX, startWorldY);

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

    // ---- Dijkstra over weighted breach edges ----
    const open = [startRid];
    const dist = new Map([[startRid, 0]]);
    const prev = new Map([[startRid, null]]);
    const prevEdge = new Map();
    const closed = new Set();

    let goal = null;
    while (open.length) {
      open.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
      const r = open.shift();
      if (closed.has(r)) continue;
      closed.add(r);

      if (targetRegions.has(r)) { goal = r; break; }

      const neigh = rs.regionGraph.get(r);
      if (!neigh) continue;

      for (const n of neigh) {
        if (closed.has(n)) continue;
        const edge = this._chooseBreachOption(rs, key(r, n), r, n, startTile, targets);
        if (!edge?.breachTiles?.length) continue;

        const cost = Math.max(1, Number(edge.planCost || edge.cost || edge.breachTiles.length || 1));
        const nextDist = (dist.get(r) ?? Infinity) + cost;
        if (nextDist >= (dist.get(n) ?? Infinity)) continue;

        dist.set(n, nextDist);
        prev.set(n, r);
        prevEdge.set(n, { edge, fromRegion: r, toRegion: n });
        open.push(n);
      }
    }

    if (goal == null) {
      return null;
    }

    // Reconstruct weighted wall-chain edges: start region -> ... -> goal region.
    const edgePath = [];
    for (let cur = goal; cur !== startRid; cur = prev.get(cur)) {
      const step = prevEdge.get(cur);
      if (!step) return null;
      edgePath.push(step);
    }
    edgePath.reverse();

    const breachTiles = [];
    for (const step of edgePath) {
      const edge = step.edge;
      const forward =
        step.fromRegion === edge.fromRegion &&
        step.toRegion === edge.toRegion;
      const tiles = forward ? edge.breachTiles : [...edge.breachTiles].reverse();

      for (const tile of tiles) {
        if (!tile) continue;
        if (!this.isBreachableTile(tile.x, tile.y)) continue;
        if (this.isHardBlockedTile(tile.x, tile.y)) continue;
        breachTiles.push({ x: tile.x, y: tile.y });
      }
    }

    return breachTiles.length ? this._uniqTiles(breachTiles) : null;
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

  _orientedTilesForOption(option, fromRegion, toRegion) {
    if (!option?.breachTiles?.length) return null;
    const forward =
      fromRegion === option.fromRegion &&
      toRegion === option.toRegion;
    return forward ? option.breachTiles : [...option.breachTiles].reverse();
  }

  _tileManhattan(a, b) {
    if (!a || !b) return 0;
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  _nearestTargetTileDistance(tile, targets) {
    if (!tile || !Array.isArray(targets) || !targets.length) return 0;
    let best = Infinity;
    for (const target of targets) {
      const d = this._tileManhattan(tile, target);
      if (d < best) best = d;
    }
    return Number.isFinite(best) ? best : 0;
  }

  _chooseBreachOption(regionSystem, edgeKey, fromRegion, toRegion, startTile, targets) {
    const options = regionSystem.breachEdgeOptions?.get?.(edgeKey) ?? [];
    const fallback = regionSystem.breachEdges?.get?.(edgeKey);
    const candidates = options.length ? options : (fallback ? [fallback] : []);
    if (!candidates.length) return null;

    let best = null;
    let bestScore = Infinity;
    for (const option of candidates) {
      const tiles = this._orientedTilesForOption(option, fromRegion, toRegion);
      if (!tiles?.length) continue;

      const first = tiles[0];
      const last = tiles[tiles.length - 1];
      const wallCost = Math.max(1, Number(option.cost || tiles.length || 1));
      const tieBreakDistance =
        this._tileManhattan(startTile, first) +
        this._nearestTargetTileDistance(last, targets);
      const score = wallCost + Math.min(999, tieBreakDistance) * 0.001;

      if (score >= bestScore) continue;
      bestScore = score;
      best = {
        ...option,
        fromRegion,
        toRegion,
        breachTiles: tiles,
        planCost: score,
      };
    }

    return best;
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
