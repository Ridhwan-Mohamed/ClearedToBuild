import { BLOCKDEPTH, UIDEPTH } from "../constants";
import { Map } from "../map";

const PANEL_FILL = 0x121b24;
const PANEL_SHADOW = 0x02060a;
const PANEL_BORDER = 0xe4f6ff;

const STRUCTURAL_BAR_HEIGHT = 10;
const STRUCTURAL_BAR_FILL_HEIGHT = 6;
const STRUCTURAL_BAR_PAD = 3;

export const BUILDING_PANEL_TEXT_STYLES = Object.freeze({
  title: {
    fontFamily: "Bungee",
    fontSize: "11px",
    color: "#f7fcff",
    stroke: "#06111a",
    strokeThickness: 3,
  },
  body: {
    fontFamily: "Bungee",
    fontSize: "10px",
    color: "#d6ebf5",
    stroke: "#06111a",
    strokeThickness: 3,
  },
  compact: {
    fontFamily: "Bungee",
    fontSize: "10px",
    color: "#f7fcff",
    stroke: "#06111a",
    strokeThickness: 3,
    align: "center",
  },
  compactBody: {
    fontFamily: "Bungee",
    fontSize: "9px",
    color: "#d6ebf5",
    stroke: "#06111a",
    strokeThickness: 3,
    align: "center",
  },
});

export function createBuildingHoverPanel(
  scene,
  {
    x = 0,
    y = 0,
    width = 150,
    height = 42,
    depth = UIDEPTH,
    scrollFactor = 1,
    accentColor = 0x86d9ff,
  } = {}
) {
  const root = scene.add.container(x, y).setDepth(depth);
  if (scrollFactor !== 1) {
    root.setScrollFactor(scrollFactor);
  }

  const shadow = scene.add
    .rectangle(0, 7, width + 10, height + 12, PANEL_SHADOW, 0.34)
    .setOrigin(0.5);

  const bg = scene.add
    .rectangle(0, 0, width, height, PANEL_FILL, 0.95)
    .setOrigin(0.5)
    .setStrokeStyle(2, PANEL_BORDER, 0.16);

  const glow = scene.add
    .rectangle(0, 0, width - 10, height - 10, accentColor, 0.055)
    .setOrigin(0.5);

  const topStripHeight = Math.max(8, Math.round(height * 0.26));
  const topStrip = scene.add
    .rectangle(0, (-height * 0.5) + 8, width - 16, topStripHeight, accentColor, 0.18)
    .setOrigin(0.5, 0.5);

  root.add([shadow, bg, glow, topStrip]);
  root.panelBg = bg;
  root.panelGlow = glow;
  root.panelAccent = topStrip;
  return root;
}

export function createGlassStatusBubble(
  scene,
  {
    x = 0,
    y = 0,
    width = 120,
    height = 34,
    radius = 18,
    depth = UIDEPTH,
    scrollFactor = 1,
    fillColor = 0x143347,
    fillAlpha = 0.92,
    strokeColor = 0xaee8ff,
    strokeAlpha = 0.22,
    accentColor = 0x7dd3fc,
    accentAlpha = 0.18,
    shineAlpha = 0.1,
    shadowAlpha = 0.3,
  } = {}
) {
  const root = scene.add.container(x, y).setDepth(depth);
  if (scrollFactor !== 1) {
    root.setScrollFactor(scrollFactor);
  }

  const shadow = scene.add.graphics();
  const bg = scene.add.graphics();
  const glow = scene.add.graphics();
  const shine = scene.add.graphics();
  const accent = scene.add.graphics();

  root.add([shadow, bg, glow, shine, accent]);

  root.redraw = (next = {}) => {
    const bubbleWidth = Math.max(44, Number(next.width ?? root.bubbleWidth ?? width) || width);
    const bubbleHeight = Math.max(22, Number(next.height ?? root.bubbleHeight ?? height) || height);
    const bubbleRadius = Math.max(10, Number(next.radius ?? root.bubbleRadius ?? radius) || radius);
    const nextFillColor = next.fillColor ?? root.fillColor ?? fillColor;
    const nextFillAlpha = next.fillAlpha ?? root.fillAlpha ?? fillAlpha;
    const nextStrokeColor = next.strokeColor ?? root.strokeColor ?? strokeColor;
    const nextStrokeAlpha = next.strokeAlpha ?? root.strokeAlpha ?? strokeAlpha;
    const nextAccentColor = next.accentColor ?? root.accentColor ?? accentColor;
    const nextAccentAlpha = next.accentAlpha ?? root.accentAlpha ?? accentAlpha;
    const nextShineAlpha = next.shineAlpha ?? root.shineAlpha ?? shineAlpha;
    const nextShadowAlpha = next.shadowAlpha ?? root.shadowAlpha ?? shadowAlpha;

    root.bubbleWidth = bubbleWidth;
    root.bubbleHeight = bubbleHeight;
    root.bubbleRadius = bubbleRadius;
    root.fillColor = nextFillColor;
    root.fillAlpha = nextFillAlpha;
    root.strokeColor = nextStrokeColor;
    root.strokeAlpha = nextStrokeAlpha;
    root.accentColor = nextAccentColor;
    root.accentAlpha = nextAccentAlpha;
    root.shineAlpha = nextShineAlpha;
    root.shadowAlpha = nextShadowAlpha;

    shadow.clear();
    shadow.fillStyle(PANEL_SHADOW, nextShadowAlpha);
    shadow.fillRoundedRect(
      Math.round(-bubbleWidth * 0.5) + 2,
      Math.round(-bubbleHeight * 0.5) + 4,
      bubbleWidth,
      bubbleHeight,
      bubbleRadius
    );

    bg.clear();
    bg.fillStyle(nextFillColor, nextFillAlpha);
    bg.lineStyle(2, nextStrokeColor, nextStrokeAlpha);
    bg.fillRoundedRect(
      Math.round(-bubbleWidth * 0.5),
      Math.round(-bubbleHeight * 0.5),
      bubbleWidth,
      bubbleHeight,
      bubbleRadius
    );
    bg.strokeRoundedRect(
      Math.round(-bubbleWidth * 0.5),
      Math.round(-bubbleHeight * 0.5),
      bubbleWidth,
      bubbleHeight,
      bubbleRadius
    );

    glow.clear();
    glow.fillStyle(nextAccentColor, 0.07);
    glow.fillRoundedRect(
      Math.round(-bubbleWidth * 0.5) + 4,
      Math.round(-bubbleHeight * 0.5) + 4,
      Math.max(16, bubbleWidth - 8),
      Math.max(12, bubbleHeight - 8),
      Math.max(8, bubbleRadius - 5)
    );

    shine.clear();
    shine.fillStyle(0xffffff, nextShineAlpha);
    shine.fillRoundedRect(
      Math.round(-bubbleWidth * 0.5) + 10,
      Math.round(-bubbleHeight * 0.5) + 5,
      Math.max(16, bubbleWidth - 20),
      Math.max(8, Math.round(bubbleHeight * 0.34)),
      Math.max(6, Math.round(bubbleRadius * 0.55))
    );

    accent.clear();
    accent.fillStyle(nextAccentColor, nextAccentAlpha);
    accent.fillRoundedRect(
      Math.round(-bubbleWidth * 0.5) + 8,
      Math.round(-bubbleHeight * 0.5) + 8,
      Math.max(12, Math.round(bubbleWidth * 0.42)),
      Math.max(7, Math.round(bubbleHeight * 0.18)),
      Math.max(5, Math.round(bubbleRadius * 0.4))
    );
  };

  root.redraw();
  root.bubbleShadow = shadow;
  root.bubbleBg = bg;
  root.bubbleGlow = glow;
  root.bubbleShine = shine;
  root.bubbleAccent = accent;
  return root;
}

export function getStructuralBarAnchor(
  sprite,
  {
    widthScale = 1,
    paddingX = 10,
    minWidth = 44,
    yOffset = 12,
    xOffset = 0,
  } = {}
) {
  const bounds = sprite?.getBounds?.();
  if (!bounds) {
    return {
      centerX: (sprite?.x ?? 0) + xOffset,
      topY: (sprite?.y ?? 0) + yOffset,
      width: minWidth,
    };
  }

  return {
    centerX: bounds.centerX + xOffset,
    topY: bounds.bottom + yOffset,
    width: Math.max(minWidth, Math.round(bounds.width * widthScale) + paddingX),
  };
}

export function ensureStructuralHealthBar(owner, scene, opts = {}) {
  if (!owner || !scene) return;

  const fillColor = opts.fillColor ?? 0x61d98f;
  const depthBase = opts.depthBase ?? (BLOCKDEPTH + 1);

  if (!owner.healthBarBg) {
    owner.healthBarBg = scene.add
      .rectangle(0, 0, 1, STRUCTURAL_BAR_HEIGHT, 0x131814, 0.94)
      .setOrigin(0.5)
      .setDepth(depthBase)
      .setStrokeStyle(2, 0xf4e8ca, 0.22);
    Map.addToWorldStatic(owner.healthBarBg);
  }

  if (!owner.healthBar) {
    owner.healthBar = scene.add
      .rectangle(0, 0, 1, STRUCTURAL_BAR_FILL_HEIGHT, fillColor, 0.98)
      .setOrigin(0, 0.5)
      .setDepth(depthBase + 1);
    Map.addToWorldStatic(owner.healthBar);
  }
}

export function layoutStructuralHealthBar(
  owner,
  {
    ratio = 0,
    centerX = 0,
    topY = 0,
    width = 44,
    visible = false,
    fillColor = 0x61d98f,
  } = {}
) {
  if (!owner?.healthBarBg || !owner?.healthBar) return;

  const clampedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  const safeWidth = Math.max(44, Number(width) || 44);
  const leftX = centerX - safeWidth / 2;
  const innerWidth = Math.max(0, safeWidth - (STRUCTURAL_BAR_PAD * 2));
  const fillWidth = innerWidth * clampedRatio;

  owner.healthBarBg
    .setPosition(centerX, topY)
    .setSize(safeWidth, STRUCTURAL_BAR_HEIGHT)
    .setStrokeStyle(2, 0xf4e8ca, 0.22)
    .setVisible(visible);

  owner.healthBar
    .setPosition(leftX + STRUCTURAL_BAR_PAD, topY)
    .setSize(fillWidth, STRUCTURAL_BAR_FILL_HEIGHT)
    .setFillStyle(fillColor, 0.98)
    .setVisible(visible && fillWidth > 0.4);
}

export function getStructuralHealthBarTargets(owner) {
  return [owner?.healthBarBg, owner?.healthBar].filter(Boolean);
}

export function destroyStructuralHealthBar(owner) {
  owner?.healthBarBg?.destroy?.();
  owner?.healthBar?.destroy?.();
  if (owner) {
    owner.healthBarBg = null;
    owner.healthBar = null;
  }
}
