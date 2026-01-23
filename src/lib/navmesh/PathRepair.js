// PathRepair.js
import { PathRegistry } from "./PathRegistry.js";
import { Player } from "../../players/Player.js";

export class PathRepair {
  static repairUnitPath(unit, removedPolyIds, navMesh) {
    // If unit has no destination, nothing to do
    if (!unit.finalPos) return false;

    // 1) Try stitch (2-step)
    const stitched = this.tryStitch(unit, removedPolyIds, navMesh);
    if (stitched) {
      const moved = Player.moveTo(unit, stitched.points);
      if (!moved) return false;
      PathRegistry.registerUnitPath(navMesh, unit, stitched.polyIds);
      return true;
    }

    // 2) Full repath
    const repathed = this.fullRepath(unit, navMesh);
    if (repathed) {
      const moved = Player.moveTo(unit, repathed.points);
      if (!moved) return false;
      PathRegistry.registerUnitPath(navMesh, unit, repathed.polyIds);
      return true;
    }

    return false;
  }

  static tryStitch(unit, removedPolyIds, navMesh, lookahead = 8) {
    const corridor = unit.__pathPolyIds || [];
    if (corridor.length === 0) return null;

    const removedSet = new Set(removedPolyIds);

    // Find first removed poly in corridor (simple version)
    let k = -1;
    for (let i = 0; i < corridor.length; i++) {
      if (removedSet.has(corridor[i])) { k = i; break; }
    }
    if (k === -1) return null;

    // Find goal poly after removed that still exists and isn't removed
    let goalPolyId = null;
    for (let j = k + 1; j < Math.min(corridor.length, k + 1 + lookahead); j++) {
      const pid = corridor[j];
      if (removedSet.has(pid)) continue;
      if (navMesh.getPolygonById(pid)) { goalPolyId = pid; break; }
    }
    if (goalPolyId == null) return null;

    const goalPoly = navMesh.getPolygonById(goalPolyId);
    if (!goalPoly) return null;

    const start = { x: unit.x, y: unit.y };
    const mid = { x: goalPoly.centroid.x, y: goalPoly.centroid.y };

    // Path current -> centroid of later poly
    const p1 = navMesh.findPathDetailed(start, mid, { includePolys: true });
    if (!p1 || !p1.points || p1.points.length === 0) return null;

    // Path centroid -> final destination
    const p2 = navMesh.findPathDetailed(mid, unit.finalPos, { includePolys: true });
    if (!p2 || !p2.points || p2.points.length === 0) return null;

    // Merge points (dedupe join)
    const points = p1.points.slice();
    // p2.points starts at mid; avoid duplicate
    for (let i = 1; i < p2.points.length; i++) points.push(p2.points[i]);

    // Merge poly corridor ids (dedupe join)
    const polyIds = p1.polyIds.slice();
    for (const pid of p2.polyIds) {
      if (polyIds.length === 0 || polyIds[polyIds.length - 1] !== pid) polyIds.push(pid);
    }

    return { points, polyIds };
  }

  static fullRepath(unit, navMesh) {
    const start = { x: unit.x, y: unit.y };
    const end = unit.finalPos;
    const res = navMesh.findPathDetailed(start, end, { includePolys: true });
    if (!res || !res.points || res.points.length === 0) return null;
    return { points: res.points, polyIds: res.polyIds };
  }
}
