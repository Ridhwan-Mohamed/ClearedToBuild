import { buildPolysFromGridMap } from '../lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import { SQUARESIZE } from '../constants.js';

self.onmessage = function (e) {
  const { navGrid } = e.data;
  try {
    const polys = buildPolysFromGridMap(navGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
    self.postMessage({ success: true, polys });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
