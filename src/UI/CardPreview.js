import Phaser from "phaser";

export function getCardOutlineTint(card) {
  return Phaser.Display.Color.HexStringToColor(card?.OUTLINE ?? "#ffffff").color;
}

export function getCardVisualStyle(card) {
  const outlineTint = getCardOutlineTint(card);
  const rarity = String(card?.rarity || "common").trim().toLowerCase();
  const isGold = rarity === "gold";
  return {
    rarity,
    isGold,
    outlineTint,
    auraTint: isGold ? 0xf1c75b : outlineTint,
    haloTint: isGold ? 0xffeb9f : outlineTint,
    fillAlpha: isGold ? 0.2 : 0.16,
    strokeWidth: isGold ? 4 : 3,
    outerGlowAlpha: isGold ? 0.16 : 0.06,
    outerStrokeAlpha: isGold ? 0.54 : 0.14,
  };
}

export function createCardGlowElements(scene, card, width, height) {
  const style = getCardVisualStyle(card);
  const elements = [];

  const halo = scene.add.ellipse(
    0,
    0,
    width + (style.isGold ? 28 : 18),
    height + (style.isGold ? 34 : 22),
    style.haloTint,
    style.outerGlowAlpha
  ).setOrigin(0.5);
  elements.push(halo);

  if (style.isGold) {
    const frameGlow = scene.add.rectangle(0, 0, width + 14, height + 14, style.auraTint, 0.08)
      .setStrokeStyle(2, style.auraTint, style.outerStrokeAlpha)
      .setOrigin(0.5);
    elements.push(frameGlow);
  }

  return { style, elements };
}

export function createWorldCardPreview(scene, card, x, y, options = {}) {
  const { style, elements } = createCardGlowElements(scene, card, options.width ?? 170, options.height ?? 180);
  const borderColor = style.outlineTint;
  const depth = options.depth ?? 10020;
  const width = options.width ?? 170;
  const height = options.height ?? 180;

  const container = scene.add.container(x, y).setDepth(depth).setVisible(false);

  const bg = scene.add.rectangle(0, 0, width, height, borderColor, style.fillAlpha)
    .setStrokeStyle(style.strokeWidth, borderColor, 1)
    .setOrigin(0.5);

  const icon = scene.add.image(0, -40, card.image).setScale(1);

  const name = scene.add.text(0, 0, card.name, {
    fontSize: "12px",
    color: "#ffffff",
    fontFamily: "Bungee",
    stroke: "#000000",
    strokeThickness: 2,
    align: "center",
    wordWrap: { width: width - 24 },
  }).setOrigin(0.5);

  const desc = scene.add.text(0, 45, card.text, {
    fontSize: "12px",
    color: "#dddddd",
    fontFamily: "Bungee",
    stroke: "#000000",
    strokeThickness: 2,
    align: "center",
    wordWrap: { width: width - 34 },
  }).setOrigin(0.5);

  container.add([...elements, bg, icon, name, desc]);

  if (style.isGold && elements[0]) {
    scene.tweens.add({
      targets: elements[0],
      alpha: { from: style.outerGlowAlpha * 0.75, to: style.outerGlowAlpha * 1.35 },
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  return {
    container,
    show() { container.setVisible(true); },
    hide() { container.setVisible(false); },
    setPosition(nx, ny) { container.setPosition(nx, ny); },
    destroy() { container.destroy(true); },
  };
}
