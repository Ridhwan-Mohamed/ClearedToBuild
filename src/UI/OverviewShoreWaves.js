import Phaser from "phaser";
import { SQUARESIZE, UIDEPTH, TILE_MAP } from "../constants";

function cellVal(cell) {
  return Array.isArray(cell) ? cell[1] : cell;
}

function isWaterCell(cell) {
  return TILE_MAP(cellVal(cell)) === "water";
}

export class OverviewShoreWaves {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.mode = "detailed";
    this.depth = opts.depth ?? (UIDEPTH - 1.15);
    this.getGrid = opts.getGrid || (() => null);
    this.rebuildIntervalMs = opts.rebuildIntervalMs ?? 1000;
    this.maxOffsetPx = opts.maxOffsetPx ?? 6;
    this.pulseCyclesPerSec = opts.pulseCyclesPerSec ?? opts.waveSpeed ?? 0.55;
    this.edges = [];
    this._lastBuildAt = -Infinity;

    this.gfxA = scene.add.graphics().setDepth(this.depth).setVisible(false);
    this.gfxB = scene.add.graphics().setDepth(this.depth + 0.001).setVisible(false);
    this.gfxA.setBlendMode(Phaser.BlendModes.ADD);
    this.gfxB.setBlendMode(Phaser.BlendModes.ADD);
  }

  destroy() {
    this.gfxA?.destroy?.();
    this.gfxB?.destroy?.();
    this.gfxA = null;
    this.gfxB = null;
    this.edges = [];
  }

  setMode(mode = "detailed") {
    this.mode = mode;
    const show = mode === "overview";
    this.gfxA?.setVisible(show);
    this.gfxB?.setVisible(show);
    if (!show) {
      this.gfxA?.clear?.();
      this.gfxB?.clear?.();
    }
  }

  update(mode = "detailed", now = 0) {
    this.setMode(mode);
    if (this.mode !== "overview") return;

    if (now - this._lastBuildAt >= this.rebuildIntervalMs) {
      this._rebuildEdges();
      this._lastBuildAt = now;
    }
    this._drawPulse(now);
  }

  _rebuildEdges() {
    const grid = this.getGrid?.();
    if (!grid?.length || !grid[0]?.length) {
      this.edges = [];
      return;
    }

    const h = grid.length;
    const w = grid[0].length;
    const edges = [];
    const S = SQUARESIZE;

    const isWaterAt = (x, y) => {
      if (y < 0 || x < 0 || y >= h || x >= w) return true;
      return isWaterCell(grid[y][x]);
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        if (isWaterCell(cell)) continue;

        const x0 = x * S;
        const y0 = y * S;
        const x1 = x0 + S;
        const y1 = y0 + S;

        if (isWaterAt(x, y - 1)) edges.push({ x0, y0, x1, y1: y0, nx: 0, ny: -1 });
        if (isWaterAt(x, y + 1)) edges.push({ x0, y0: y1, x1, y1, nx: 0, ny: 1 });
        if (isWaterAt(x - 1, y)) edges.push({ x0, y0, x1: x0, y1, nx: -1, ny: 0 });
        if (isWaterAt(x + 1, y)) edges.push({ x0: x1, y0, x1, y1, nx: 1, ny: 0 });
      }
    }

    this.edges = edges;
  }

  _drawPulse(now) {
    if (!this.gfxA || !this.gfxB) return;
    const edges = this.edges;
    this.gfxA.clear();
    this.gfxB.clear();
    if (!edges.length) return;

    const t = (now || 0) * 0.001;
    const cyc = this.pulseCyclesPerSec;
    const phaseA = (t * cyc) % 1;
    const phaseB = (phaseA + 0.5) % 1;
    const offA = phaseA * this.maxOffsetPx;
    const offB = phaseB * this.maxOffsetPx;

    const alphaA = 0.30 * (1 - phaseA);
    const alphaB = 0.26 * (1 - phaseB);
    const widthA = 1 + (1 - phaseA) * 1.1;
    const widthB = 1 + (1 - phaseB) * 1.1;

    this.gfxA.lineStyle(widthA, 0xbfefff, alphaA);
    this.gfxB.lineStyle(widthB, 0xeaffff, alphaB);

    for (const e of edges) {
      const ax = e.nx * offA;
      const ay = e.ny * offA;
      this.gfxA.beginPath();
      this.gfxA.moveTo(e.x0 + ax, e.y0 + ay);
      this.gfxA.lineTo(e.x1 + ax, e.y1 + ay);
      this.gfxA.strokePath();

      const bx = e.nx * offB;
      const by = e.ny * offB;
      this.gfxB.beginPath();
      this.gfxB.moveTo(e.x0 + bx, e.y0 + by);
      this.gfxB.lineTo(e.x1 + bx, e.y1 + by);
      this.gfxB.strokePath();
    }
  }
}
