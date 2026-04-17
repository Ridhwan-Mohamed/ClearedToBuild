import { TILE_MAP } from "../constants";

function intToRgb(c) {
  return {
    r: (c >> 16) & 255,
    g: (c >> 8) & 255,
    b: c & 255,
  };
}

function rgbToHex({ r, g, b }) {
  const rr = Math.max(0, Math.min(255, r | 0));
  const gg = Math.max(0, Math.min(255, g | 0));
  const bb = Math.max(0, Math.min(255, b | 0));
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

function shade(rgb, factor) {
  return {
    r: rgb.r * factor,
    g: rgb.g * factor,
    b: rgb.b * factor,
  };
}

function blend(rgb, target, t) {
  return {
    r: rgb.r + (target.r - rgb.r) * t,
    g: rgb.g + (target.g - rgb.g) * t,
    b: rgb.b + (target.b - rgb.b) * t,
  };
}

function hash2(x, y, seed = 0) {
  let n = x * 374761393 + y * 668265263 + seed * 700001;
  n = (n ^ (n >> 13)) * 1274126177;
  n ^= n >> 16;
  return (n >>> 0) / 4294967295;
}

function tileVal(cell) {
  return Array.isArray(cell) ? cell[1] : cell;
}

function tileName(cell) {
  return TILE_MAP(tileVal(cell));
}

function isWater(cell) {
  return tileName(cell) === "water";
}

function hasWaterNeighbor(grid, x, y, dx, dy) {
  const ny = y + dy;
  const nx = x + dx;
  if (ny < 0 || nx < 0 || ny >= grid.length || nx >= grid[0].length) return true;
  return isWater(grid[ny][nx]);
}

function stylizeColor(baseColor, type, x, y, w, h) {
  let rgb = intToRgb(baseColor);
  const n = hash2(x, y, 13) - 0.5;
  const gx = w > 1 ? x / (w - 1) : 0;
  const gy = h > 1 ? y / (h - 1) : 0;

  // World gradient to avoid flat monotone parcels.
  const grade = 1.03 + (1 - gx) * 0.05 - gy * 0.03;
  rgb = shade(rgb, grade);

  // Tiny pixel dither/noise for painterly map-card effect.
  rgb = shade(rgb, 1 + n * 0.12);

  // Biome/material accents.
  if (type === "grass" || type === "dark_grass" || type === "dirt" || type === "crops" || type === "grassCrop" || type === "grassBerry") {
    rgb = blend(rgb, { r: 120, g: 220, b: 120 }, 0.06);
  } else if (type === "fort_floor" || type === "wall" || type === "woodWall") {
    rgb = blend(rgb, { r: 165, g: 155, b: 145 }, 0.08);
  } else if (type === "road") {
    rgb = blend(rgb, { r: 190, g: 155, b: 105 }, 0.08);
  } else if (type === "tower" || type === "bank" || type === "prison" || type === "storage" || type === "clayOven" || type === "house1" || type === "house2" || type === "catapult") {
    rgb = shade(rgb, 1.08);
    rgb = blend(rgb, { r: 245, g: 228, b: 170 }, 0.05);
  }

  return rgb;
}

function inBounds(x, y, minX, minY, maxX, maxY) {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function paintOverviewTexture(ctx, grid, colorForType, bounds = null, overlayMarkers = null) {
  const h = grid.length;
  const w = grid[0].length;
  const minX = bounds ? Math.max(0, bounds.minX) : 0;
  const minY = bounds ? Math.max(0, bounds.minY) : 0;
  const maxX = bounds ? Math.min(w - 1, bounds.maxX) : (w - 1);
  const maxY = bounds ? Math.min(h - 1, bounds.maxY) : (h - 1);

  // Pass 1: stylized base paint.
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = grid[y][x];
      if (isWater(cell)) {
        ctx.clearRect(x, y, 1, 1);
        continue;
      }
      const base = colorForType(cell);
      const type = tileName(cell);
      const rgb = stylizeColor(base, type, x, y, w, h);
      ctx.fillStyle = rgbToHex(rgb);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Pass 2: shoreline/parcel rim-light + bottom-right shade.
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = grid[y][x];
      if (isWater(cell)) continue;

      const waterUp = hasWaterNeighbor(grid, x, y, 0, -1);
      const waterLeft = hasWaterNeighbor(grid, x, y, -1, 0);
      const waterDown = hasWaterNeighbor(grid, x, y, 0, 1);
      const waterRight = hasWaterNeighbor(grid, x, y, 1, 0);
      if (!waterUp && !waterLeft && !waterDown && !waterRight) continue;

      const base = colorForType(cell);
      const type = tileName(cell);
      let rgb = stylizeColor(base, type, x, y, w, h);
      if (waterUp || waterLeft) rgb = blend(rgb, { r: 255, g: 255, b: 255 }, 0.22);
      if (waterDown || waterRight) rgb = shade(rgb, 0.80);

      ctx.fillStyle = rgbToHex(rgb);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (Array.isArray(overlayMarkers)) {
    for (const marker of overlayMarkers) {
      const x = Number(marker?.x);
      const y = Number(marker?.y);
      const color = marker?.color;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !color) continue;
      if (!inBounds(x, y, minX, minY, maxX, maxY)) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
