import Phaser from "phaser";
import { SQUARESIZE, UIDEPTH, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "../constants";

function hash01(a, b, seed = 0) {
  let n = (Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(seed, 982451653)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

export class OverviewOceanWaves {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.mode = "detailed";
    this.depth = opts.depth ?? (UIDEPTH - 2.6);
    this.waveKeys = opts.waveKeys ?? ["zoomOutWaterTxt1", "zoomOutWaterTxt2"];
    this.wavePalette = opts.wavePalette ?? [0x74d6ef, 0x9feeff, 0x59bfd9, 0xbaf8ff];
    this.cellSize = opts.cellSize ?? 180;
    this.jitterRatio = opts.jitterRatio ?? 0.46;
    this.coverageScreens = opts.coverageScreens ?? 2.5;
    this.getWorldSize = opts.getWorldSize || (() => {
      const img = this.scene?.zoomMixer?.overviewImage || this.scene?.menuPreview;
      if (img?.displayWidth && img?.displayHeight) {
        return { width: img.displayWidth, height: img.displayHeight };
      }
      const grid = this.scene?.gridData;
      if (grid?.length && grid[0]?.length) {
        return { width: grid[0].length * SQUARESIZE, height: grid.length * SQUARESIZE };
      }
      return { width: WORLD_DIMENSIONX * SQUARESIZE, height: WORLD_DIMENSIONY * SQUARESIZE };
    });
    this.waves = [];

    this.container = scene.add.container(0, 0)
      .setDepth(this.depth)
      .setVisible(false)
      .setScrollFactor(1);

    this._rebuild();
  }

  destroy() {
    this._clear();
    this.container?.destroy?.();
    this.container = null;
  }

  setMode(mode = "detailed") {
    this.mode = mode;
    this.container?.setVisible(mode === "overview");
  }

  resize() {
    this._rebuild();
  }

  update(mode = "detailed", now = 0) {
    this.setMode(mode);
    if (mode !== "overview") return;

    const t = (now || 0) * 0.001;
    for (const wave of this.waves) {
      const sprite = wave.sprite;
      if (!sprite) continue;

      const rotPulse = Math.sin(t * wave.spinSpeed + wave.phase);
      const bob = Math.cos(t * wave.driftSpeed + wave.phase * 1.17);
      const swell = Math.sin(t * wave.scaleSpeed + wave.phase * 0.63);

      sprite.setPosition(
        wave.baseX + Math.cos(wave.driftAngle) * bob * wave.driftAmp,
        wave.baseY + Math.sin(wave.driftAngle) * bob * wave.driftAmp
      );
      sprite.setRotation(wave.baseRotation + rotPulse * wave.spinAmp);
      sprite.setScale(
        wave.baseScaleX * (1 + swell * 0.06),
        wave.baseScaleY * (1 + swell * 0.08)
      );
      sprite.setAlpha(Math.max(0.10, wave.baseAlpha + swell * 0.05));
    }
  }

  _clear() {
    this.container?.removeAll(true);
    this.waves = [];
  }

  _rebuild() {
    if (!this.container) return;

    const world = this.getWorldSize?.() || {};
    const worldWidth = Math.max(world.width || 0, WORLD_DIMENSIONX * SQUARESIZE);
    const worldHeight = Math.max(world.height || 0, WORLD_DIMENSIONY * SQUARESIZE);
    const padX = Math.max(this.scene.scale.width * this.coverageScreens, this.cellSize * 4);
    const padY = Math.max(this.scene.scale.height * this.coverageScreens, this.cellSize * 4);
    const originX = -padX;
    const originY = -padY;
    const width = worldWidth + padX * 2;
    const height = worldHeight + padY * 2;
    const cols = Math.max(1, Math.ceil(width / this.cellSize));
    const rows = Math.max(1, Math.ceil(height / this.cellSize));
    const cellW = width / cols;
    const cellH = height / rows;
    const jitterX = cellW * this.jitterRatio;
    const jitterY = cellH * this.jitterRatio;

    this._clear();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const seed = row * cols + col + 1;
        const px = originX + (col + 0.5) * cellW + (hash01(col, row, 11) - 0.5) * jitterX;
        const py = originY + (row + 0.5) * cellH + (hash01(col, row, 17) - 0.5) * jitterY;
        const key = this.waveKeys[Math.floor(hash01(col, row, 23) * this.waveKeys.length) % this.waveKeys.length];
        const tint = this.wavePalette[Math.floor(hash01(col, row, 29) * this.wavePalette.length) % this.wavePalette.length];
        const baseScale = 0.44 + hash01(col, row, 31) * 0.28;
        const stretch = 0.66 + hash01(col, row, 37) * 0.24;
        const sprite = this.scene.add.image(px, py, key)
        .setOrigin(0.5 + (hash01(col, row, 41) - 0.5) * 0.28, 0.5 + (hash01(col, row, 43) - 0.5) * 0.20)
        .setTint(tint)
        .setAlpha(0.14 + hash01(col, row, 47) * 0.08)
        .setScale(baseScale, baseScale * stretch)
        .setRotation(Phaser.Math.DegToRad(-10 + hash01(col, row, 53) * 20))
        .setFlip(hash01(col, row, 59) > 0.5, hash01(col, row, 61) > 0.7)
        .setBlendMode(Phaser.BlendModes.SCREEN);

        this.container.add(sprite);
        this.waves.push({
          sprite,
          baseX: px,
          baseY: py,
          baseAlpha: sprite.alpha,
          baseRotation: sprite.rotation,
          baseScaleX: sprite.scaleX,
          baseScaleY: sprite.scaleY,
          spinAmp: Phaser.Math.DegToRad(2 + hash01(col, row, 67) * 6),
          spinSpeed: 0.28 + hash01(col, row, 71) * 0.40,
          driftAmp: 1.5 + hash01(col, row, 73) * 4.5,
          driftAngle: hash01(col, row, 79) * Math.PI * 2,
          driftSpeed: 0.20 + hash01(col, row, 83) * 0.30,
          scaleSpeed: 0.35 + hash01(col, row, 89) * 0.35,
          phase: hash01(col, row, 97) * Math.PI * 2,
        });
      }
    }
  }
}
