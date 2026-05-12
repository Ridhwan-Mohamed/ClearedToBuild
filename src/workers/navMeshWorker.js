import { buildPolysFromGridMap } from '../lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import { SQUARESIZE } from '../constants.js';

self.onmessage = function (e) {
  const { navGrid, enemyNavGrid, requestId, type } = e.data;
  try {
    const polys = buildPolysFromGridMap(navGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
    if (type === 'buildBoth' && Array.isArray(enemyNavGrid)) {
      const enemyPolys = buildPolysFromGridMap(enemyNavGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
      self.postMessage({ success: true, requestId, polys, enemyPolys });
      return;
    }
    self.postMessage({ success: true, requestId, polys });
  } catch (err) {
    self.postMessage({ success: false, requestId, error: err.message });
  }
};
