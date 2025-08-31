// src/lib/waterQuadtree.js
import { TILE_MAP, TILE_TYPES } from "../constants.js";
import { QuadtreeNode } from "./QuadTreeNode.js";


export function buildWaterQuadtree(grid) {
  const waterSourcesQuadTree = new QuadtreeNode({
    x: 0,
    y: 0,
    width: grid[0].length,
    height: grid.length
  });

  const isWalkable = (tile) => {
    if (Array.isArray(tile)) {
      return !TILE_TYPES[TILE_MAP(tile[1])]?.block;
    }
    return !TILE_TYPES[TILE_MAP(tile)]?.block;
  };

  const directions = [[0,1],[1,0],[-1,0],[0,-1]];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] !== TILE_TYPES.water.grid) continue;
      for (let [dx, dy] of directions) {
        const nx = x + dx, ny = y + dy;
        if (grid[ny]?.[nx] !== undefined && isWalkable(grid[ny][nx])) {
          waterSourcesQuadTree.insert({ x: nx, y: ny });
        }
      }
    }
  }

  return waterSourcesQuadTree
}
