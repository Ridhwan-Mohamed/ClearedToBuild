import Phaser from "phaser";

export const BOTTOM_BAR_THEME = {
  shellFill: 0x12394d,
  shellAlpha: 0.84,
  shellStroke: 0x98e7ff,
  shellStrokeAlpha: 0.18,
  shellShadow: 0x030c14,
  shellShadowAlpha: 0.18,
  panelFill: 0x17384d,
  panelAlpha: 0.74,
  panelStroke: 0x98e7ff,
  panelStrokeAlpha: 0.16,
  panelSoftFill: 0x1a4259,
  panelSoftAlpha: 0.56,
  laneFill: 0x102c3d,
  laneAlpha: 0.88,
  laneStroke: 0x98e7ff,
  laneStrokeAlpha: 0.14,
  cardFill: 0x173649,
  cardAlpha: 0.9,
  cardStrokeAlpha: 0.16,
  tabIdleFill: 0x14384c,
  tabIdleAlpha: 0.78,
  tabHoverFill: 0x19465d,
  tabHoverAlpha: 0.9,
  tabSelectedAlpha: 0.96,
  text: "#fff9ef",
  textSoft: "#d3edf9",
  textMuted: "#a7c8d9",
};

export const BOTTOM_BAR_SIDE_INSET = 6;

export function getBottomBarWidth(scene) {
  const width = Number(scene?.scale?.width || 0);
  return Math.max(0, width - (BOTTOM_BAR_SIDE_INSET * 2));
}

export function mixColor(colorA, colorB, t = 0.5) {
  const a = Phaser.Display.Color.IntegerToColor(colorA);
  const b = Phaser.Display.Color.IntegerToColor(colorB);
  return Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(Phaser.Math.Clamp(t, 0, 1) * 100)).color;
}

export function makeGlassRoundRect(
  scene,
  width = 0,
  height = 0,
  radius = 14,
  {
    fill = BOTTOM_BAR_THEME.panelFill,
    alpha = BOTTOM_BAR_THEME.panelAlpha,
    stroke = BOTTOM_BAR_THEME.panelStroke,
    strokeAlpha = BOTTOM_BAR_THEME.panelStrokeAlpha,
    strokeWidth = 2,
  } = {}
) {
  const rect = scene.rexUI.add.roundRectangle(0, 0, width, height, radius, fill, alpha);
  if (strokeWidth > 0 && strokeAlpha > 0) {
    rect.setStrokeStyle(strokeWidth, stroke, strokeAlpha);
  }
  return rect;
}

export function drawGlassRect(
  graphics,
  x,
  y,
  width,
  height,
  radius = 14,
  {
    fill = BOTTOM_BAR_THEME.panelFill,
    alpha = BOTTOM_BAR_THEME.panelAlpha,
    stroke = BOTTOM_BAR_THEME.panelStroke,
    strokeAlpha = BOTTOM_BAR_THEME.panelStrokeAlpha,
    innerStroke = null,
    innerStrokeAlpha = 0,
    shineAlpha = 0.08,
    shadowAlpha = 0.12,
  } = {}
) {
  graphics.clear();
  if (shadowAlpha > 0) {
    graphics.fillStyle(BOTTOM_BAR_THEME.shellShadow, shadowAlpha);
    graphics.fillRoundedRect(x + 2, y + 4, width, height, radius);
  }
  graphics.fillStyle(fill, alpha);
  graphics.fillRoundedRect(x, y, width, height, radius);
  if (shineAlpha > 0) {
    graphics.fillStyle(0xffffff, shineAlpha);
    graphics.fillRoundedRect(
      x + 8,
      y + 6,
      Math.max(12, width - 16),
      Math.max(10, Math.floor(height * 0.34)),
      Math.max(8, radius - 5)
    );
  }
  if (strokeAlpha > 0) {
    graphics.lineStyle(2, stroke, strokeAlpha);
    graphics.strokeRoundedRect(x, y, width, height, radius);
  }
  if (innerStroke != null && innerStrokeAlpha > 0) {
    graphics.lineStyle(1, innerStroke, innerStrokeAlpha);
    graphics.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, Math.max(0, radius - 1));
  }
}

export function setHoverLiftState(
  scene,
  target,
  hovered,
  {
    baseY = target.y,
    baseScale = 1,
    hoverLift = 4,
    hoverScale = 1.02,
    duration = 120,
    moveY = true,
  } = {}
) {
  scene.tweens.killTweensOf(target);
  const tweenConfig = {
    targets: target,
    scaleX: hovered ? hoverScale : baseScale,
    scaleY: hovered ? hoverScale : baseScale,
    duration,
    ease: "Quad.easeOut",
  };
  if (moveY) {
    tweenConfig.y = hovered ? baseY - hoverLift : baseY;
  }
  scene.tweens.add(tweenConfig);
}

export function makeBottomBarEmptyRow(
  scene,
  {
    width = 240,
    height = 52,
    title = "Nothing here",
    subtitle = "",
    accent = BOTTOM_BAR_THEME.panelStroke,
  } = {}
) {
  const row = scene.rexUI.add.sizer({
    orientation: "y",
    space: { left: 12, right: 12, top: 8, bottom: 8, item: 2 },
  });
  row.addBackground(makeGlassRoundRect(scene, width, height, 14, {
    fill: mixColor(BOTTOM_BAR_THEME.cardFill, accent, 0.08),
    alpha: 0.62,
    stroke: accent,
    strokeAlpha: 0.14,
    strokeWidth: 1.5,
  }));

  const titleText = scene.add.text(0, 0, title, {
    fontFamily: "Bungee",
    fontSize: "11px",
    color: BOTTOM_BAR_THEME.textSoft,
    stroke: "#081621",
    strokeThickness: 2,
    align: "center",
    wordWrap: { width: Math.max(120, width - 28) },
  }).setOrigin(0.5, 0.5);
  row.add(titleText, { expand: false, align: "center" });

  if (subtitle) {
    row.add(scene.add.text(0, 0, subtitle, {
      fontFamily: "Bungee",
      fontSize: "8px",
      color: BOTTOM_BAR_THEME.textMuted,
      stroke: "#081621",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: Math.max(120, width - 28) },
    }).setOrigin(0.5, 0.5), { expand: false, align: "center" });
  }

  row.setMinSize(width, height);
  return row;
}

export function handleScrollablePanelWheel(scene, panel, pointer, dx, dy, { speed = 0.8 } = {}) {
  if (!panel?.isOverflowY || !panel?.getBounds || !panel?.addChildOY) return false;
  const bounds = panel.getBounds();
  if (!bounds || !Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y)) return false;

  const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  if (Math.abs(dominantDelta) < 0.1) return false;

  panel.addChildOY(-dominantDelta * speed, true);
  scene.input.stopPropagation();
  return true;
}

export function addScrollablePanelAffordance(
  scene,
  panel,
  {
    inset = 10,
    idleAlpha = 0.18,
    hoverAlpha = 0.58,
    fill = 0x071925,
    accent = 0x98e7ff,
    isActive = () => true,
  } = {}
) {
  if (!scene || !panel) return null;

  const track = scene.add.graphics();
  const drawTrack = (height) => {
    track.clear();
    track.fillStyle(fill, 0.56);
    track.fillRoundedRect(-5, -height / 2, 10, height, 5);
    track.lineStyle(1, accent, 0.12);
    track.strokeRoundedRect(-5, -height / 2, 10, height, 5);
  };
  drawTrack(48);
  const up = scene.add.text(0, 0, "^", {
    fontFamily: "Bungee",
    fontSize: "10px",
    color: "#dff8ff",
    stroke: "#06131b",
    strokeThickness: 2,
  }).setOrigin(0.5);
  const down = scene.add.text(0, 0, "v", {
    fontFamily: "Bungee",
    fontSize: "10px",
    color: "#dff8ff",
    stroke: "#06131b",
    strokeThickness: 2,
  }).setOrigin(0.5);
  const group = scene.add.container(0, 0, [track, up, down])
    .setDepth((panel.depth || 0) + 4)
    .setScrollFactor(0)
    .setAlpha(0)
    .setVisible(false);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    scene.events?.off?.("postupdate", update);
    panel.off?.("destroy", cleanup);
    group.destroy?.(true);
  };

  const update = () => {
    if (cleaned) return;
    if (!panel?.scene || panel.scene !== scene || !panel.getBounds) {
      cleanup();
      return;
    }

    const bounds = panel.getBounds();
    const overflow = !!panel.isOverflowY;
    const visible = isActive() && overflow && bounds.width > 0 && bounds.height > 0;
    group.setVisible(visible);
    if (!visible) {
      group.setAlpha(0);
      return;
    }

    const barHeight = Math.max(34, bounds.height - 18);
    const pointer = scene.input?.activePointer;
    const hovered = !!(pointer && Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y));
    const alpha = hovered ? hoverAlpha : idleAlpha;

    group.setAlpha(alpha);
    group.setPosition(bounds.right - inset, bounds.centerY);
    group.setDepth((panel.depth || 0) + 4);
    drawTrack(barHeight);
    up.setPosition(0, -barHeight / 2 + 9);
    down.setPosition(0, barHeight / 2 - 9);
  };

  scene.events.on("postupdate", update);
  scene.events.once("shutdown", cleanup);
  panel.once?.("destroy", cleanup);
  update();

  return { destroy: cleanup };
}

export function addViewportScrollAffordance(
  scene,
  ownerContainer,
  getViewport,
  getState,
  {
    orientation = "x",
    idleAlpha = 0.18,
    hoverAlpha = 0.58,
    fill = 0x071925,
    accent = 0x98e7ff,
    isActive = () => true,
  } = {}
) {
  if (!scene || !ownerContainer || typeof getViewport !== "function") return null;

  const track = scene.add.graphics();
  const thumb = scene.add.graphics();
  const drawTrack = (width, height) => {
    track.clear();
    track.fillStyle(fill, 0.56);
    track.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    track.lineStyle(1, accent, 0.12);
    track.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  };
  const drawThumb = (width, height) => {
    thumb.clear();
    thumb.fillStyle(accent, 0.42);
    thumb.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  };
  drawTrack(64, 10);
  drawThumb(24, 5);
  const back = scene.add.text(0, 0, orientation === "x" ? "<" : "^", {
    fontFamily: "Bungee",
    fontSize: "10px",
    color: "#dff8ff",
    stroke: "#06131b",
    strokeThickness: 2,
  }).setOrigin(0.5);
  const forward = scene.add.text(0, 0, orientation === "x" ? ">" : "v", {
    fontFamily: "Bungee",
    fontSize: "10px",
    color: "#dff8ff",
    stroke: "#06131b",
    strokeThickness: 2,
  }).setOrigin(0.5);
  const group = scene.add.container(0, 0, [track, thumb, back, forward])
    .setAlpha(0)
    .setVisible(false);
  ownerContainer.add(group);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    scene.events?.off?.("postupdate", update);
    group.destroy?.(true);
  };

  const update = () => {
    if (cleaned) return;
    if (!ownerContainer?.scene || ownerContainer.scene !== scene) {
      cleanup();
      return;
    }
    const viewport = getViewport() || {};
    const state = getState?.() || {};
    const overflow = !!state.overflow;
    const visible = isActive() && overflow;
    group.setVisible(visible);
    if (!visible) {
      group.setAlpha(0);
      return;
    }

    const alpha = state.hovered ? hoverAlpha : idleAlpha;
    group.setAlpha(alpha);

    if (orientation === "x") {
      const width = Math.max(54, (viewport.w || 0) - 26);
      group.setPosition((viewport.left || 0) + (viewport.w || 0) / 2, (viewport.top || 0) + (viewport.h || 0) - 10);
      drawTrack(width, 10);
      const thumbWidth = Phaser.Math.Clamp(width * (state.viewportRatio || 0.25), 18, Math.max(18, width - 34));
      const travel = Math.max(1, width - 34 - thumbWidth);
      drawThumb(thumbWidth, 5);
      thumb.setPosition(-travel / 2 + travel * Phaser.Math.Clamp(state.progress || 0, 0, 1), 0);
      back.setPosition(-width / 2 + 9, 0).setAlpha(state.canBack === false ? 0.28 : 1);
      forward.setPosition(width / 2 - 9, 0).setAlpha(state.canForward === false ? 0.28 : 1);
    } else {
      const height = Math.max(38, (viewport.h || 0) - 18);
      group.setPosition((viewport.left || 0) + (viewport.w || 0) - 10, (viewport.top || 0) + (viewport.h || 0) / 2);
      drawTrack(10, height);
      drawThumb(5, Math.max(18, height * (state.viewportRatio || 0.25)));
      back.setPosition(0, -height / 2 + 9).setAlpha(state.canBack === false ? 0.28 : 1);
      forward.setPosition(0, height / 2 - 9).setAlpha(state.canForward === false ? 0.28 : 1);
    }
  };

  scene.events.on("postupdate", update);
  scene.events.once("shutdown", cleanup);
  update();

  return { destroy: cleanup };
}
