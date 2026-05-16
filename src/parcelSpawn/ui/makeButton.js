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
  const fillColor = cfg.fillColor ?? 0xffffff;
  const fillAlpha = cfg.fillAlpha ?? 0.10;
  const hoverFillAlpha = cfg.hoverFillAlpha ?? Math.min(fillAlpha + 0.06, 0.24);
  const pressedFillAlpha = cfg.pressedFillAlpha ?? Math.min(fillAlpha + 0.12, 0.34);
  const strokeColor = cfg.strokeColor ?? 0xffffff;
  const strokeAlpha = cfg.strokeAlpha ?? 0.22;
  const textColor = cfg.textColor ?? "#ffffff";
  const fontSize = cfg.fontSize ?? "12px";

  const c = scene.add.container(x, y);
  c.setScrollFactor(1);
  c.setSize(w, h);
  c.tutorialW = w;
  c.tutorialH = h;

  const bg = scene.add.rectangle(0, 0, w, h, fillColor, fillAlpha);
  bg.setStrokeStyle(2, strokeColor, strokeAlpha);
  bg.setScrollFactor(1);

  const t = scene.add.text(0, 0, label, {
    fontFamily: "Bungee",
    fontSize,
    color: textColor,
    align: "center"
  }).setOrigin(0.5);
  t.setScrollFactor(1);

  bg.setInteractive({ useHandCursor: true });
  c.bg = bg;
  c.label = t;

  bg.on("pointerover", () => bg.setFillStyle(fillColor, hoverFillAlpha));
  bg.on("pointerout",  () => bg.setFillStyle(fillColor, fillAlpha));
  bg.on("pointerdown", () => bg.setFillStyle(fillColor, pressedFillAlpha));
  bg.on("pointerup", () => {
    bg.setFillStyle(fillColor, hoverFillAlpha);
    cfg.onClick?.();
  });

  c.add([bg, t]);
  return c;
}

