import Phaser from "phaser";

export function getCardOutlineTint(card) {
  return Phaser.Display.Color.HexStringToColor(card?.OUTLINE ?? "#ffffff").color;
}

export function createWorldCardPreview(scene, card, x, y, options = {}) {
  const borderColor = getCardOutlineTint(card);
  const depth = options.depth ?? 10020;
  const width = options.width ?? 170;
  const height = options.height ?? 180;

  const container = scene.add.container(x, y).setDepth(depth).setVisible(false);

  const bg = scene.add.rectangle(0, 0, width, height, borderColor, 0.16)
    .setStrokeStyle(3, borderColor, 1)
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

  container.add([bg, icon, name, desc]);

  return {
    container,
    show() { container.setVisible(true); },
    hide() { container.setVisible(false); },
    setPosition(nx, ny) { container.setPosition(nx, ny); },
    destroy() { container.destroy(true); },
  };
}
