import { AudioManager } from "../Manager/AudioManager.js";
import { FLOORDEPTH, SQUARESIZE, TILE_TYPES } from "../constants.js";

function delay(scene, ms) {
  return new Promise((resolve) => {
    scene.time.delayedCall(Math.max(0, ms), resolve);
  });
}

function sortRevealCells(cells, slotId, size) {
  const center = (size - 1) / 2;
  const axisDistance = (cell) => {
    if (slotId === "N") return size - 1 - cell.ly;
    if (slotId === "S") return cell.ly;
    if (slotId === "E") return cell.lx;
    if (slotId === "W") return size - 1 - cell.lx;
    return Math.abs(cell.lx - center) + Math.abs(cell.ly - center);
  };

  return cells.slice().sort((a, b) => {
    const da = axisDistance(a);
    const db = axisDistance(b);
    if (da !== db) return da - db;

    const ca = Math.abs((slotId === "N" || slotId === "S") ? a.lx - center : a.ly - center);
    const cb = Math.abs((slotId === "N" || slotId === "S") ? b.lx - center : b.ly - center);
    if (ca !== cb) return ca - cb;

    return a.y === b.y ? a.x - b.x : a.y - b.y;
  });
}

export class ParcelRevealAnimator {
  constructor(scene, {
    cells,
    slotId = null,
    size = 25,
    alpha = 0.5,
    batchSize = 7,
    batchDelayMs = 14,
    playThuds = false,
  } = {}) {
    this.scene = scene;
    this.cells = sortRevealCells(Array.isArray(cells) ? cells : [], slotId, size);
    this.alpha = alpha;
    this.batchSize = Math.max(1, batchSize | 0);
    this.batchDelayMs = Math.max(0, batchDelayMs | 0);
    this.playThuds = !!playThuds;
    this.container = scene.add.container(0, 0).setDepth(FLOORDEPTH + 0.35).setScrollFactor(1);
    this.nodes = [];
    this._destroyed = false;
  }

  async play() {
    if (!this.cells.length || this._destroyed) return;

    for (let index = 0; index < this.cells.length && !this._destroyed; index += this.batchSize) {
      const batch = this.cells.slice(index, index + this.batchSize);
      for (const cell of batch) {
        this._addCell(cell);
      }
      if (this.playThuds && batch.length) {
        AudioManager.playLayoutMove({
          volume: 0.18,
          cooldownMs: Math.max(40, this.batchDelayMs * 2),
        });
      }
      await delay(this.scene, this.batchDelayMs);
    }
  }

  async complete({ holdMs = 55, darkenMs = 180 } = {}) {
    if (this._destroyed) return;

    if (this.nodes.length) {
      await new Promise((resolve) => {
        this.scene.tweens.add({
          targets: this.nodes.filter((node) => node?.active !== false),
          alpha: 1,
          duration: Math.max(1, darkenMs),
          ease: "Quad.easeOut",
          onComplete: resolve,
        });
      });
    }

    if (holdMs > 0) await delay(this.scene, holdMs);
    this.destroy();
  }

  pulseWaiting() {
    if (this._destroyed || this._pulseTween || !this.container) return;
    this._pulseTween = this.scene.tweens.add({
      targets: this.container,
      alpha: 0.84,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  stopPulse() {
    this._pulseTween?.stop?.();
    this._pulseTween?.remove?.();
    this._pulseTween = null;
    this.container?.setAlpha?.(1);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stopPulse();
    this.container?.destroy?.(true);
    this.container = null;
    this.nodes = [];
  }

  _addCell(cell) {
    const def = TILE_TYPES[cell.tileType] || TILE_TYPES.dirt;
    const spec = def?.assets?.interior;
    const cx = cell.x * SQUARESIZE + SQUARESIZE / 2;
    const cy = cell.y * SQUARESIZE + SQUARESIZE / 2;
    let node = null;

    if (spec?.sheet) {
      node = this.scene.add.sprite(cx, cy, spec.key).setDepth(FLOORDEPTH + 0.35);
      if (spec.anim && this.scene.anims?.exists?.(spec.anim)) {
        node.play(spec.anim);
      }
    } else {
      node = this.scene.add.image(cx, cy, spec?.key || def.value || def.name).setDepth(FLOORDEPTH + 0.35);
    }

    node.setAlpha(this.alpha);
    node.setDisplaySize?.(SQUARESIZE, SQUARESIZE);
    node.setScale?.(0.92);
    this.container.add(node);
    this.nodes.push(node);

    this.scene.tweens.add({
      targets: node,
      scaleX: 1,
      scaleY: 1,
      duration: 130,
      ease: "Back.easeOut",
    });
  }
}
