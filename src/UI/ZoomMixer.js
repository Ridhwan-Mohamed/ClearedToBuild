// ZoomMixer.js
// Smooth pointer-centric zoom with crossfade between detailed and overview layers.

import { colorFor, UIDEPTH } from "../constants";
import { Map } from "../map";

export class ZoomMixer {
  /** assign once from your scene: ZoomMixer.scene = this */
  static scene = null;
  static mapIconContainer;

  constructor() {
    this.mode = 'detailed'; // 'detailed' | 'overview'
    this.IN_THRESHOLD  = 0.45;
    this.OUT_THRESHOLD = 0.35;
    this.targetZoom = 1.0;

    this.overviewImage = null; // Phaser.GameObjects.Image
    this.texKey = 'mapOverview';
  }

  /** Initialize the container once per scene */
  static initMapIconContainer() {
    const scene = ZoomMixer.scene;
    if (ZoomMixer.mapIconContainer) ZoomMixer.mapIconContainer.destroy();

    ZoomMixer.mapIconContainer = scene.add.container(0, 0).setDepth(UIDEPTH - 1);
    // hide from UI camera
    scene.uiCamera?.ignore(ZoomMixer.mapIconContainer);
  }

  /** Use an *existing* texture (e.g., 'mapPreview') as the overview overlay. */
  buildOverviewFromTexture(texKey, gridWidth, gridHeight, squareSize) {
    const scene = ZoomMixer.scene;

    // Ensure the texture exists (MainMenu created it)
    const tex = scene.textures.get(texKey);
    if (!tex) {
      console.warn('ZoomMixer: missing texture', texKey, '— fallback to buildOverviewTextureFromGrid');
      return this.buildOverviewTextureFromGrid(Map.grid, squareSize);
    }

    // Crisp scaling for THIS texture only
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

    const worldW = gridWidth  * squareSize;
    const worldH = gridHeight * squareSize;

    if (this.overviewImage) this.overviewImage.destroy();
    this.overviewImage = scene.add.image(0, 0, texKey)
      .setOrigin(0, 0)
      .setDisplaySize(worldW, worldH)
      .setScrollFactor(1)
      .setDepth(UIDEPTH - 2)
      .setAlpha(0)
      .setVisible(false);

    // Make sure UI camera doesn't render the overlay
    scene.uiCamera?.ignore(this.overviewImage);
  }

  /** Build (or rebuild) the overview texture from a grid. */
  buildOverviewTextureFromGrid(grid, squareSize, colorForType) {
    const scene = ZoomMixer.scene;
    const h = grid.length;
    const w = grid[0].length;

    // (Re)create canvas texture 1:1 with tiles
    if (scene.textures.exists(this.texKey)) scene.textures.remove(this.texKey);
    const tex = scene.textures.createCanvas(this.texKey, w, h);
    const ctx = tex.getContext();

    // Paint 1 pixel per tile (fast)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        const c = colorForType(cell);
        ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Place as a world-aligned image stretched to world size
    const worldW = w * squareSize;
    const worldH = h * squareSize;

    if (this.overviewImage) this.overviewImage.destroy();
    this.overviewImage = scene.add.image(0, 0, this.texKey)
      .setOrigin(0, 0)
      .setDisplaySize(worldW, worldH)
      .setScrollFactor(1)
      .setDepth(0)       // put this under your gameplay layers
      .setAlpha(0)
      .setVisible(false);
  }

  // Zoom to targetZoom around the camera center (no pointer reference)
  smoothCenterZoomTo(targetZoom, duration = 300, ease = 'Quad.easeInOut') {
    const scene = ZoomMixer.scene;
    const cam   = scene.cameras.main;

    // world-space point at the camera's center BEFORE zoom
    const mid   = cam.midPoint;          // { x, y } in world coords
    const cx    = mid.x;
    const cy    = mid.y;

    // compute scroll after zoom so that cx,cy stays at the view center
    let targetScrollX = cx - (cam.width  / (2 * targetZoom));
    let targetScrollY = cy - (cam.height / (2 * targetZoom));

    // clamp to camera bounds (requires cam.setBounds(...) in your scene)
    const bounds = cam.getBounds();
    const viewW  = cam.width  / targetZoom;
    const viewH  = cam.height / targetZoom;

    const minX = bounds.x;
    const minY = bounds.y;
    const maxX = bounds.right  - viewW;
    const maxY = bounds.bottom - viewH;

    if (maxX < minX) targetScrollX = minX + (bounds.width  - viewW) * 0.5;
    else             targetScrollX = Phaser.Math.Clamp(targetScrollX, minX, maxX);
    if (maxY < minY) targetScrollY = minY + (bounds.height - viewH) * 0.5;
    else             targetScrollY = Phaser.Math.Clamp(targetScrollY, minY, maxY);

    scene.tweens.killTweensOf(cam);

    const self = this;
    scene.tweens.add({
      targets: cam,
      zoom:    targetZoom,
      duration,
      ease,
      onComplete() {
        // ✅ switch modes only once zoom finishes
        if (targetZoom <= self.OUT_THRESHOLD && self.mode !== 'overview') {
          self.swapMode('overview');
        } else if (targetZoom >= self.IN_THRESHOLD && self.mode !== 'detailed') {
          self.swapMode('detailed');
        }
      }
    });
  }


  swapMode(mode, duration = 350) {
    if (this.mode === mode) return;
    const scene = ZoomMixer.scene;

    if (mode === 'overview') {
      scene.keyboardSpeed = 30;
      Map.deleteAllGridElements();

      this.overviewImage.setVisible(true);
      scene.tweens.add({ targets: this.overviewImage, alpha: 1, duration, ease: 'Quad.easeInOut' });

      // fade in map icons
      if (ZoomMixer.mapIconContainer) {
        ZoomMixer.mapIconContainer.setVisible(true);
        scene.tweens.add({ targets: ZoomMixer.mapIconContainer, alpha: 1, duration, ease: 'Quad.easeInOut' });
      }

      this.mode = 'overview';
    } else {
      scene.keyboardSpeed = 10;
      Map.reDraw();
      scene.tweens.add({
        targets: this.overviewImage,
        alpha: 0,
        duration,
        ease: 'Quad.easeInOut',
        onComplete: () => this.overviewImage.setVisible(false)
      });
      // fade out map icons
      if (ZoomMixer.mapIconContainer) {
        scene.tweens.add({
          targets: ZoomMixer.mapIconContainer,
          alpha: 0,
          duration,
          ease: 'Quad.easeInOut',
          onComplete: () => ZoomMixer.mapIconContainer.setVisible(false)
        });
      }
      this.mode = 'detailed';
    }
  }

  /** Mouse wheel handler: pointer-centric zoom + hysteresis crossfade. */
  hookWheel({ minZoom = 0.2, maxZoom = 2.0, inThresh = 0.50, outThresh = 0.40 } = {}) {
    const scene = ZoomMixer.scene;
    this.IN_THRESHOLD  = inThresh;
    this.OUT_THRESHOLD = outThresh;
    this.MIN_ZOOM = minZoom;
    this.MAX_ZOOM = maxZoom;

    scene.input.on('wheel', (_pointer, _gos, _dx, dy /* deltaY */, _dz) => {
      const cam = scene.cameras.main;
      const cur = cam.zoom;
      const factor = Math.exp(-dy * 0.003);               // works for mouse & trackpad
      const target = Phaser.Math.Clamp(cur * factor, this.MIN_ZOOM, this.MAX_ZOOM);
      this.targetZoom = target;
      this.smoothCenterZoomTo(target);                    // << center-based
    });
  }

  /** Optional keyboard shortcuts (Z/X). */
  hookKeys(zoomOut = 0.30, zoomIn = 1.00) {
    const scene = ZoomMixer.scene;
    scene.input.keyboard.on('keydown-Z', () => {
      this.targetZoom = zoomOut;
      this.smoothCenterZoomTo(zoomOut);
    });
    scene.input.keyboard.on('keydown-X', () => {
      this.targetZoom = zoomIn;
      this.smoothCenterZoomTo(zoomIn);
    });
  }

  static createZoomInvariantIcon(imageKey, description, x, y, opts = {}) {
    const scene = ZoomMixer.scene;
    const cam   = scene.cameras.main;
    if (!ZoomMixer.mapIconContainer) ZoomMixer.initMapIconContainer();

    const baseScale = opts.baseScale || 1;
    const depth     = opts.depth     || UIDEPTH - 1;

    // Create icon
    const icon = scene.add.image(x, y, imageKey)
      .setOrigin(0.5)
      .setDepth(depth)
      .setInteractive({ cursor: 'pointer' });

    icon.setScale(baseScale / cam.zoom);


    // Hover label
    const label = scene.add.text(x, y - 20, description, {
      fontSize: '14px',
      fill: '#000000',
      stroke: '#ffffff',
      strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.3)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(depth + 1).setVisible(false);
    label.setScale(baseScale / cam.zoom);

    scene.events.on('update', () => {
      icon.setScale(baseScale / cam.zoom);
      label.setScale(baseScale / cam.zoom);
    });
    icon.on('pointerover', () => {
      label.setVisible(true);
      scene.tweens.add({ targets: label, alpha: 1, duration: 150 });
    });
    icon.on('pointerout', () => {
      scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: 150,
        onComplete: () => label.setVisible(false)
      });
    });

    ZoomMixer.mapIconContainer.add([icon, label]);
    return icon;
  }

}
