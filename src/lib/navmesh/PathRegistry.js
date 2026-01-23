export class PathRegistry {
  static _byMesh = new WeakMap(); // navMesh -> registryState

  static init(navMesh) {
    if (!navMesh) return;
    if (!this._byMesh.has(navMesh)) {
      this._byMesh.set(navMesh, {
        polyToUnits: new Map(),   // polyId -> Set(unit)
        unitToPath: new Map(),    // unit -> { polyIds, points, ... }
      });
    }
  }

  static _state(navMesh) {
    this.init(navMesh);
    return this._byMesh.get(navMesh);
  }

  // ✅ register a path for a unit on a specific mesh
  static registerUnitPath(navMesh, unit, pathPolyIds, pathPoints) {
    const st = this._state(navMesh);

    // clear old mapping for this unit first
    this.unregisterUnit(navMesh, unit);

    st.unitToPath.set(unit, { polyIds: pathPolyIds, points: pathPoints });

    // only store polys actually used
    for (const pid of pathPolyIds) {
      let set = st.polyToUnits.get(pid);
      if (!set) { set = new Set(); st.polyToUnits.set(pid, set); }
      set.add(unit);
    }
  }

  static unregisterUnit(navMesh, unit) {
    const st = this._state(navMesh);
    const rec = st.unitToPath.get(unit);
    if (!rec) return;

    for (const pid of rec.polyIds) {
      const set = st.polyToUnits.get(pid);
      if (!set) continue;
      set.delete(unit);
      if (set.size === 0) st.polyToUnits.delete(pid);
    }
    st.unitToPath.delete(unit);
  }

  // ✅ called after navmesh edits
  static handlePolysRemoved(navMesh, removedPolyIds = [], addedPolyIds = []) {
    const st = this._state(navMesh);

    const impacted = new Set();
    for (const pid of removedPolyIds) {
      const set = st.polyToUnits.get(pid);
      if (!set) continue;
      for (const u of set) impacted.add(u);
    }

    // let caller repair per-unit (PathRepair will be mesh agnostic below)
    return impacted;
  }

  // ✅ update progress so you don't “repair behind the unit”
  static updateUnitProgress(navMesh, unit, currentWorldPosVec2 /* Phaser.Math.Vector2 */) {
    const st = this._state(navMesh);
    const rec = st.unitToPath.get(unit);
    if (!rec) return;

    // Use your existing closest-poly logic but on the passed mesh
    const meshPoint = navMesh.findClosestMeshPoint(currentWorldPosVec2); // you already fixed Vec2 usage
    if (!meshPoint || !meshPoint.polygon) return;

    const curPid = meshPoint.polygon.id;

    // If the unit has already progressed past some polyIds, drop them from the registry mapping:
    const idx = rec.polyIds.indexOf(curPid);
    if (idx > 0) {
      // remove earlier polys from polyToUnits
      for (let i = 0; i < idx; i++) {
        const oldPid = rec.polyIds[i];
        const set = st.polyToUnits.get(oldPid);
        if (set) {
          set.delete(unit);
          if (set.size === 0) st.polyToUnits.delete(oldPid);
        }
      }
      rec.polyIds = rec.polyIds.slice(idx);
      st.unitToPath.set(unit, rec);
    }
  }
}
