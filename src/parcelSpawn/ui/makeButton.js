/**
 * makeButton(scene, {x,y,w,h,label,onClick})
 * Returns a Container with a rounded-rect + centered text.
 *
 * IMPORTANT: scrollFactor MUST be 1 for ALL objects (your camera-split code
 * uses scrollFactor==0 to route objects to the overlay scene.
 */
export function makeButton(scene, cfg) {
  const x = cfg.x ?? 0;
  const y = cfg.y ?? 0;
  const w = cfg.w ?? 120;
  const h = cfg.h ?? 34;
  const label = cfg.label ?? "Button";

  const c = scene.add.container(x, y);
  c.setScrollFactor(1);

  const bg = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.10);
  bg.setStrokeStyle(2, 0xffffff, 0.22);
  bg.setScrollFactor(1);

  const t = scene.add.text(0, 0, label, {
    fontFamily: "Bungee",
    fontSize: "12px",
    color: "#ffffff"
  }).setOrigin(0.5);
  t.setScrollFactor(1);

  bg.setInteractive({ useHandCursor: true });

  bg.on("pointerover", () => bg.setFillStyle(0xffffff, 0.16));
  bg.on("pointerout",  () => bg.setFillStyle(0xffffff, 0.10));
  bg.on("pointerdown", () => bg.setFillStyle(0xffffff, 0.22));
  bg.on("pointerup", () => {
    bg.setFillStyle(0xffffff, 0.16);
    cfg.onClick?.();
  });

  c.add([bg, t]);
  return c;
}

