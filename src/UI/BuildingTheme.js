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
