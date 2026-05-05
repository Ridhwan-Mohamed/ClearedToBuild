import { BLOCKDEPTH, SQUARESIZE } from "../constants";

export const SMOKE_CLEARING_KEY = "smoke_clearing";
export const SMOKE_CLEARING_ANIM = "smoke_clearing_anim";

export function ensureSmokeClearingAnimation(scene) {
  if (!scene?.anims || !scene.textures?.exists?.(SMOKE_CLEARING_KEY)) return false;
  if (!scene.anims.exists(SMOKE_CLEARING_ANIM)) {
    scene.anims.create({
      key: SMOKE_CLEARING_ANIM,
      frames: scene.anims.generateFrameNumbers(SMOKE_CLEARING_KEY, { start: 0, end: 5 }),
      frameRate: 12,
      repeat: 0,
    });
  }
  return true;
}

export function playSmokeClearing(scene, x, y, {
  width = SQUARESIZE,
  height = SQUARESIZE,
  depth = BLOCKDEPTH + 12,
  alpha = 0.9,
} = {}) {
  if (!scene || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!ensureSmokeClearingAnimation(scene)) return null;

  const smoke = scene.add.sprite(x, y, SMOKE_CLEARING_KEY, 0)
    .setDepth(depth)
    .setAlpha(alpha)
    .setDisplaySize(Math.max(8, width), Math.max(8, height));
  smoke.play(SMOKE_CLEARING_ANIM);
  smoke.once("animationcomplete", () => smoke.destroy());
  return smoke;
}

export function playBuildingCollapseSmoke(building, {
  scene = null,
  width = null,
  height = null,
  x = null,
  y = null,
} = {}) {
  const resolvedScene = scene || building?.scene || building?.sprite?.scene || building?.baseSprite?.scene || building?.topSprite?.scene;
  if (!resolvedScene || !building) return null;

  const sprite = building.sprite || building.baseSprite || building.topSprite || null;
  const tileType = building.tileType || building.type || {};
  const fallbackWidth = Math.max(1, Number(tileType.lenX || 1)) * SQUARESIZE;
  const fallbackHeight = Math.max(1, Number(tileType.lenY || 1)) * SQUARESIZE;
  const centerX = Number.isFinite(x)
    ? x
    : Number(sprite?.x ?? ((Number(building.x ?? building.gridX ?? building.tilePos?.tileX ?? 0) + Math.max(1, Number(tileType.lenX || 1)) / 2) * SQUARESIZE));
  const centerY = Number.isFinite(y)
    ? y
    : Number(sprite?.y ?? ((Number(building.y ?? building.gridY ?? building.tilePos?.tileY ?? 0) + Math.max(1, Number(tileType.lenY || 1)) / 2) * SQUARESIZE));

  return playSmokeClearing(resolvedScene, centerX, centerY, {
    width: Math.max(SQUARESIZE, Number(width || sprite?.displayWidth || fallbackWidth) * 1.12),
    height: Math.max(SQUARESIZE, Number(height || sprite?.displayHeight || fallbackHeight) * 1.12),
  });
}
