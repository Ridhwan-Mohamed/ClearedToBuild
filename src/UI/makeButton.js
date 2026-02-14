export function makeButton(scene, { x, y, w, h, label, onClick }) {
  const c = scene.add.container(x, y);
  c.setScrollFactor(1);

  const bg = scene.add.rectangle(0, 0, w, h, 0x111827, 0.88);
  bg.setScrollFactor(1);
  bg.setStrokeStyle(1, 0xffffff, 0.25);

  const txt = scene.add.text(0, 0, label, {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#ffffff"
  }).setOrigin(0.5);
  txt.setScrollFactor(1);

  bg.setInteractive({ useHandCursor: true });
  bg.on("pointerdown", () => onClick?.());
  bg.on("pointerover", () => bg.setFillStyle(0x1f2937, 0.95));
  bg.on("pointerout",  () => bg.setFillStyle(0x111827, 0.88));

  c.add([bg, txt]);
  return c;
}
