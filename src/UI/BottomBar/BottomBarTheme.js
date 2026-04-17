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
