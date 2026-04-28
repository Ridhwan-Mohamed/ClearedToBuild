// ZoomMixer.js
// Smooth pointer-centric zoom with crossfade between detailed and overview layers.

import { colorFor, UIDEPTH, SQUARESIZE } from "../constants";
import { Map } from "../map";
import { Player } from "../players/Player";
import { AudioManager } from "../Manager/AudioManager";
import { paintOverviewTexture } from "./OverviewStylePainter";
import { VisibilitySystem } from "./VisibilitySystem";
import { DEFAULT_PLAYER_PORTRAIT_KEY, getPlayerPortraitKey } from "../players/playerPortraits";

export class ZoomMixer {
  /** assign once from your scene: ZoomMixer.scene = this */
  static scene = null;
  static mapIconContainer;

  constructor() {
    this.mode = 'detailed';
    this.IN_THRESHOLD  = 0.45;
    this.OUT_THRESHOLD = 0.35;
    this.detailedZoom = 1.0;
    this.overviewZoom = 0.3;
    this.targetZoom = this.detailedZoom;

    this.overviewImage = null;
    this.texKey = 'mapOverview';
    this.zoomOutLocked = false;

    // --- NEW: accel/decel state ---
    this.zoomVel = { v: 0 };
    this.scrollVel = { x: 0, y: 0 };
    this.zoomSmoothTime = 0.12;     // smaller = snappier
    this.scrollSmoothTime = 0.10;   // keep close to zoomSmoothTime

    // --- NEW: anchor for pointer-centric (or center) zoom ---
    this.anchorWorld = null;        // {x,y} world point we want to keep stable
    this.anchorScreen = null;       // {x,y} screen point (in pixels)
  }

  /** Initialize the container once per scene */
  static initMapIconContainer() {
    const scene = ZoomMixer.scene;
    if (ZoomMixer.mapIconContainer) ZoomMixer.mapIconContainer.destroy();

    ZoomMixer.mapIconContainer = scene.add.container(0, 0).setDepth(UIDEPTH - 1);
    // hide from UI camera
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
    const shouldShowNow = this.mode === "overview";

    if (this.overviewImage) this.overviewImage.destroy();
    this.overviewImage = scene.add.image(0, 0, texKey)
      .setOrigin(0, 0)
      .setDisplaySize(worldW, worldH)
      .setScrollFactor(1)
      .setDepth(UIDEPTH - 2)
      .setAlpha(shouldShowNow ? 1 : 0)
      .setVisible(shouldShowNow);

    // Make sure UI camera doesn't render the overlay
  }

  /** Build (or rebuild) the overview texture from a grid. */
  buildOverviewTextureFromGrid(grid, squareSize, colorForType) {
    const scene = ZoomMixer.scene;
    const h = grid.length;
    const w = grid[0].length;
    const shouldShowNow = this.mode === "overview";

    // (Re)create canvas texture 1:1 with tiles
    if (scene.textures.exists(this.texKey)) scene.textures.remove(this.texKey);
    const tex = scene.textures.createCanvas(this.texKey, w, h);
    const ctx = tex.getContext();

    paintOverviewTexture(ctx, grid, colorForType, null, this._getOverviewMarkers());
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
      .setDepth(UIDEPTH - 2)       // put this under your gameplay layers
      .setAlpha(shouldShowNow ? 1 : 0)
      .setVisible(shouldShowNow);

    // Make sure UI camera doesn't render the overlay
  }

  updateOverviewCell(gridX, gridY, grid, lenx=1, leny=1) {
      const scene = ZoomMixer.scene;
      if (!scene) return;

      // Prefer explicit texKey, fall back to overviewImage’s texture key
      const texKey =
          this.texKey ||
          (this.overviewImage && this.overviewImage.texture && this.overviewImage.texture.key);

      if (!texKey || !scene.textures.exists(texKey) || !this.overviewImage) {
          // nothing to update yet – don’t try to rebuild here, just bail
          return;
      }

      const tex = scene.textures.get(texKey);
      const canvas = tex.getSourceImage();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const useGrid = grid || Map.grid;
      if (!useGrid) return;

      // Expand by 1 so shoreline/rim shading remains coherent around changed cells.
      paintOverviewTexture(ctx, useGrid, (cell) => colorFor(Array.isArray(cell) ? cell[1] : cell), {
        minX: gridX - 1,
        minY: gridY - 1,
        maxX: gridX + lenx,
        maxY: gridY + leny,
      }, this._getOverviewMarkers());
      
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  ensureOverviewImage() {
    const scene = ZoomMixer.scene;
    if (this.overviewImage?.active) return this.overviewImage;
    const grid = Map.grid;
    if (!scene || !Array.isArray(grid) || !Array.isArray(grid[0])) return null;
    this.buildOverviewTextureFromGrid(grid, SQUARESIZE, (cell) => colorFor(cell));
    return this.overviewImage || null;
  }

  _getOverviewMarkers() {
    const markers = [];

    for (const node of Map.worldSeedBushes || []) {
      if (node?.active === false) continue;
      markers.push({ x: node.gridX, y: node.gridY, color: "#f4d23c" });
    }
    for (const node of Map.worldBerryBushes || []) {
      if (node?.active === false) continue;
      markers.push({ x: node.gridX, y: node.gridY, color: "#9b5cf6" });
    }

    return markers;
  }

  // Zoom to targetZoom around the camera center (no pointer reference)
  smoothCenterZoomTo(targetZoom, duration = 300, ease = 'Quad.easeInOut') {
    const scene = ZoomMixer.scene;
    if (!scene) return;
    if (this.zoomOutLocked || scene.stageCompleteLock) return;
    const cam   = scene.cameras.main;
    if (Math.abs((cam?.zoom ?? targetZoom) - targetZoom) < 0.01) return;

    AudioManager.playWhoosh({ volume: 0.32 });

    const mid = cam.midPoint;
    const cx  = mid.x;
    const cy  = mid.y;

    // compute final scroll
    let targetScrollX = cx - (cam.width / (2 * targetZoom));
    let targetScrollY = cy - (cam.height / (2 * targetZoom));

    const bounds = cam.getBounds();
    const viewW  = cam.width / targetZoom;
    const viewH  = cam.height / targetZoom;
    targetScrollX = Phaser.Math.Clamp(targetScrollX, bounds.x, bounds.right  - viewW);
    targetScrollY = Phaser.Math.Clamp(targetScrollY, bounds.y, bounds.bottom - viewH);

    scene.tweens.killTweensOf(cam);

    // 🔹 camera zoom tween
    const self = this;
    scene.tweens.add({
      targets: cam,
      zoom: targetZoom,
      duration,
      ease,
      onComplete: () => {
        // 🔁 restore mode-swap logic
        if (targetZoom <= self.OUT_THRESHOLD && self.mode !== "overview") {
          self.swapMode("overview");
        } else if (targetZoom >= self.IN_THRESHOLD && self.mode !== "detailed") {
          self.swapMode("detailed");
        }
      }
    });
  }

  swapMode(mode, duration = 350) {
    if (this.mode === mode) return;
    const scene = ZoomMixer.scene;

    if (mode === 'overview') {
      scene.keyboardSpeed = 30;
      Map.setDetailedWorldVisible?.(false);
      Map.deleteAllGridElements();
      scene.parcelSpawnUI?.setMode?.("overview");
      scene.parcelSpawnUI?.setVisible(true);
      VisibilitySystem.setOverviewMode(true);

      const overviewImage = this.ensureOverviewImage();
      if (overviewImage) {
        overviewImage.setVisible(true);
        scene.tweens.add({ targets: overviewImage, alpha: 1, duration, ease: 'Quad.easeInOut' });
      }

      // fade in map icons
      if (ZoomMixer.mapIconContainer) {
        ZoomMixer.mapIconContainer.setVisible(true);
        scene.tweens.add({ targets: ZoomMixer.mapIconContainer, alpha: 1, duration, ease: 'Quad.easeInOut' });
      }

      this.mode = 'overview';
    } else {
      scene.keyboardSpeed = 10;
      scene.parcelSpawnUI?.setMode?.("detailed");
      scene.parcelSpawnUI?.setVisible(true);
      Map.setDetailedWorldVisible?.(true);
      Map.reDraw();
      VisibilitySystem.setOverviewMode(false);
      if (this.overviewImage) {
        scene.tweens.add({
          targets: this.overviewImage,
          alpha: 0,
          duration,
          ease: 'Quad.easeInOut',
          onComplete: () => this.overviewImage?.setVisible(false)
        });
      }
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

    scene.input.on('wheel', (pointer, _gos, _dx, dy, _dz) => {
      if (this.zoomOutLocked || scene.stageCompleteLock) return;
      const cam = scene.cameras.main;

      // --- NEW: set anchor to pointer location (screen) + corresponding world point ---
      this.anchorScreen = { x: pointer.x, y: pointer.y };
      this.anchorWorld  = cam.getWorldPoint(pointer.x, pointer.y);

      const cur = cam.zoom;
      const factor = Math.exp(-dy * 0.003);
      this.targetZoom = Phaser.Math.Clamp(cur * factor, this.MIN_ZOOM, this.MAX_ZOOM);
    });
  }


  /** Optional keyboard shortcuts (Z/X). */
  hookKeys(zoomOut = this.overviewZoom, zoomIn = this.detailedZoom) {
    const scene = ZoomMixer.scene;
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el.tagName || "").toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    scene.input.keyboard.on('keydown-Z', () => {
      if (isTyping()) return;
      this.targetZoom = zoomOut;
      this.smoothCenterZoomTo(zoomOut);
    });
    scene.input.keyboard.on('keydown-X', () => {
      if (isTyping()) return;
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

    // ✅ hide this icon from the UI camera

    // Hover label
    const label = scene.add.text(x, y - 20, description, {
      fontSize: '14px',
      fill: '#ffffff',
      stroke: '#000000',
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


    // allow live hover-label updates (e.g., team/town renaming)
    icon._zoomLabel = label;
    icon.setDescription = (text) => {
      label.setText(text ?? "");
    };
    icon.destroyWithLabel = () => {
      if (label?.active) label.destroy();
      if (icon?.active) icon.destroy();
    };
    icon.once('destroy', () => {
      if (label?.active) label.destroy();
    });

    ZoomMixer.mapIconContainer.add([icon, label]);
    return icon;
  }

  static createZoomInvariantPortrait(description, x, y, portraitKey, opts = {}) {
    const scene = ZoomMixer.scene;
    const cam = scene.cameras.main;
    if (!ZoomMixer.mapIconContainer) ZoomMixer.initMapIconContainer();

    const depth = opts.depth || UIDEPTH - 1;
    const displayHeight = opts.displayHeight || 20;
    const key = portraitKey || DEFAULT_PLAYER_PORTRAIT_KEY;
    const frame = scene.textures.getFrame(key, 0);
    const frameWidth = frame?.width ?? 54;
    const frameHeight = frame?.height ?? 50;
    const worldHeight = displayHeight / Math.max(0.0001, cam.zoom);
    const worldWidth = Math.round((frameWidth / frameHeight) * worldHeight);

    const icon = scene.add.sprite(x, y, key, 0)
      .setOrigin(0.5)
      .setDepth(depth)
      .setInteractive({ cursor: 'pointer' });

    icon.anims?.stop?.();
    icon.setDisplaySize(worldWidth, worldHeight);

    const label = scene.add.text(x, y - 20, description, {
      fontSize: '14px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.3)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(depth + 1).setVisible(false);
    label.setScale(1 / Math.max(0.0001, cam.zoom));

    const onUpdateScale = () => {
      if (!icon?.active || !label?.active) return;
      const liveFrame = scene.textures.getFrame(key, 0);
      const liveFrameWidth = liveFrame?.width ?? frameWidth;
      const liveFrameHeight = liveFrame?.height ?? frameHeight;
      const liveWorldHeight = displayHeight / Math.max(0.0001, cam.zoom);
      const liveWorldWidth = Math.round((liveFrameWidth / liveFrameHeight) * liveWorldHeight);
      icon.setDisplaySize(liveWorldWidth, liveWorldHeight);
      label.setScale(1 / Math.max(0.0001, cam.zoom));
    };

    scene.events.on('update', onUpdateScale);
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

    icon._zoomLabel = label;
    icon.setDescription = (text) => {
      label.setText(text ?? "");
    };
    icon.destroyWithLabel = () => {
      scene.events.off('update', onUpdateScale);
      if (label?.active) label.destroy();
      if (icon?.active) icon.destroy();
    };
    icon.once('destroy', () => {
      scene.events.off('update', onUpdateScale);
      if (label?.active) label.destroy();
    });

    ZoomMixer.mapIconContainer.add([icon, label]);
    return icon;
  }

  static createPlayerMoniker(troop) {
    const scene = ZoomMixer.scene;
    let portraitKey = getPlayerPortraitKey(troop) || DEFAULT_PLAYER_PORTRAIT_KEY;
    const icon = ZoomMixer.createZoomInvariantPortrait(
      troop.name,   // description on hover
      troop.x, troop.y,
      portraitKey,
      { displayHeight: 13 }
    );

    // On click: select troop, open details window
    icon.on('pointerdown', () => {
      Player.selectSingleTroop?.(troop, { openDetails: false });
    });

    const cleanup = () => {
      scene.events.off('update', onUpdate);
      if (troop._overviewMonikerCleanup === cleanup) {
        troop._overviewMonikerCleanup = null;
      }
      icon.destroyWithLabel?.();
    };

    // Keep following troop in world space
    const onUpdate = () => {
        if (!troop?.active) {
            cleanup();
            return;
        }
        const nextPortraitKey = getPlayerPortraitKey(troop) || DEFAULT_PLAYER_PORTRAIT_KEY;
        if (nextPortraitKey !== portraitKey) {
            portraitKey = nextPortraitKey;
            icon.setTexture?.(portraitKey, 0);
            icon.anims?.stop?.();
        }
        if (icon.followingHouse) {
            return;
        }
        if (icon?.active) {
            icon.setPosition(troop.x, troop.y);
        }
    };
    scene.events.on('update', onUpdate);
    icon.once('destroy', () => {
        scene.events.off('update', onUpdate);
    });
    troop._overviewMonikerCleanup?.();
    troop._overviewMonikerCleanup = cleanup;
    troop.once?.('destroy', cleanup);


    return icon;
  }

  update(deltaMs) {
    const scene = ZoomMixer.scene;
    if (!scene) return;

    const cam = scene.cameras.main;
    const dt = Math.min(0.05, deltaMs / 1000); // clamp large frame spikes

    // If we don't have an anchor yet, default to camera center
    if (!this.anchorWorld || !this.anchorScreen) {
      const mid = cam.midPoint;
      this.anchorWorld = { x: mid.x, y: mid.y };
      this.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };
    }

    // 1) Smooth zoom (accelerate then decelerate)
    const newZoom = this._smoothDamp(
      cam.zoom,
      this.targetZoom,
      this.zoomVel,
      "v",
      this.zoomSmoothTime,
      dt,
      10 // max zoom speed (tweak)
    );
    cam.zoom = newZoom;

    // 2) Compute target scroll so anchorWorld stays under anchorScreen
    // screenX = (worldX - scrollX) * zoom  => scrollX = worldX - screenX/zoom
    let targetScrollX = this.anchorWorld.x - (this.anchorScreen.x / cam.zoom);
    let targetScrollY = this.anchorWorld.y - (this.anchorScreen.y / cam.zoom);

    // Clamp to bounds
    const bounds = cam.getBounds();
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;

    targetScrollX = Phaser.Math.Clamp(targetScrollX, bounds.x, bounds.right - viewW);
    targetScrollY = Phaser.Math.Clamp(targetScrollY, bounds.y, bounds.bottom - viewH);

    // 3) Smooth scroll (accelerate then decelerate)
    cam.scrollX = this._smoothDamp(
      cam.scrollX, targetScrollX, this.scrollVel, "x", this.scrollSmoothTime, dt, 5000
    );
    cam.scrollY = this._smoothDamp(
      cam.scrollY, targetScrollY, this.scrollVel, "y", this.scrollSmoothTime, dt, 5000
    );

    // 4) Your mode swap hysteresis (do it while moving, not just on tween complete)
    if (cam.zoom <= this.OUT_THRESHOLD && this.mode !== "overview") {
      this.swapMode("overview");
    } else if (cam.zoom >= this.IN_THRESHOLD && this.mode !== "detailed") {
      this.swapMode("detailed");
    }
  }

  setZoomOutLocked(v) {
    this.zoomOutLocked = !!v;

    if (this.zoomOutLocked && this.mode === "overview") {
      this.swapMode("detailed", 0);
    }
  }

  // --- SmoothDamp helpers (accel + decel) ---
  _smoothDamp(current, target, velObj, velKey, smoothTime, dtSec, maxSpeed = Infinity) {
    // critically damped-ish smoothing (Unity-style)
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;

    const x = omega * dtSec;
    const exp = 1 / (1 + x + 0.48*x*x + 0.235*x*x*x);

    let change = current - target;
    const originalTo = target;

    // clamp max speed
    const maxChange = maxSpeed * smoothTime;
    change = Phaser.Math.Clamp(change, -maxChange, maxChange);
    target = current - change;

    const vel = velObj[velKey] ?? 0;
    const temp = (vel + omega * change) * dtSec;
    velObj[velKey] = (vel - omega * temp) * exp;

    let output = target + (change + temp) * exp;

    // prevent overshoot
    if ((originalTo - current > 0) === (output > originalTo)) {
      output = originalTo;
      velObj[velKey] = 0;
    }
    return output;
  }
}

export function createZoomButtons(scene, opts = {}) {
  const {
    xPad = 30,
    yPad = 80,         // “below top bar” default
    gap = 8,
    alpha = 0.65,
    bgAlpha = 0.25,
    btnSize = 50,
  } = opts;

  // container anchored to screen (not world)
  const ui = scene.add.container(0, 0).setDepth(UIDEPTH + 50);
  ui.setScrollFactor(0);

  // IMPORTANT: world camera must ignore these
  scene.cameras.main.ignore(ui);

  const makeBtn = (label) => {
    const bg = scene.add.rectangle(0, 0, btnSize, btnSize, 0x000000, bgAlpha)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setInteractive({ useHandCursor: true }); // ✅ bg is the interactive target

    const txt = scene.add.text(0, 0, label, {
      fontFamily: 'Bungee',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Keep as container for layout, but DO NOT set container interactive
    const c = scene.add.container(0, 0, [bg, txt]);
    c.setSize(btnSize, btnSize);

    // hover feel on bg, drive alpha on the whole container
    bg.on('pointerover', () => c.setAlpha(1));
    bg.on('pointerout',  () => c.setAlpha(alpha));
    c.setAlpha(alpha);

    // optional: prevent clicks on the text from “missing” the bg hit area
    // (text is not interactive by default, so this is usually fine)

    // expose bg so caller can attach handlers to bg specifically
    c.bg = bg;

    return c;
  };

  const zoomInBtn  = makeBtn('🔎➕');
  const zoomOutBtn = makeBtn('🔎➖');

  ui.add([zoomInBtn, zoomOutBtn]);

  // layout (vertical stack)
  zoomInBtn.setPosition(0, 0);
  zoomOutBtn.setPosition(0, btnSize + gap);

  const positionUI = () => {
    ui.x = scene.scale.width - xPad;
    ui.y = yPad;
  };
  positionUI();

  scene.scale.on('resize', positionUI);

  zoomInBtn.bg.on('pointerdown', () => {
    const zm = scene.zoomMixer;
    if (!zm) return;
    const detailedZoom = zm.detailedZoom ?? 1;
    zm.targetZoom = detailedZoom;
    zm.smoothCenterZoomTo(detailedZoom);
  });

  zoomOutBtn.bg.on('pointerdown', () => {
    const zm = scene.zoomMixer;
    if (!zm) return;
    const overviewZoom = zm.overviewZoom ?? 0.3;
    zm.targetZoom = overviewZoom;
    zm.smoothCenterZoomTo(overviewZoom);
  });

  return ui;
}


