import { makeButton } from "../ui/makeButton.js";

export class BasePage {
  constructor(scene, slot, cfg) {
    this.scene = scene;
    this.slot = slot;
    this.cfg = cfg;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(1);
    this._rendered = false;
  }

  render() {
    if (this._rendered) return;
    this._rendered = true;

    const { scene, slot, cfg } = this;

    const innerW = slot.W - 12;
    const innerH = slot.H - 12;

    const g = scene.add.graphics();
    g.setScrollFactor(1);

    const panelX = -innerW / 2;
    const panelY = -innerH / 2 + 20;
    const panelW = innerW;
    const panelH = innerH - 20;
    const bg = cfg.bgColor ?? 0x060b14;

    // Dark backing first so all detailed contract pages read clearly.
    g.fillStyle(0x02060d, cfg.baseBgAlpha ?? 0.86);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    g.fillStyle(bg, cfg.bgAlpha ?? 0.42);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    g.lineStyle(2, 0xdbeafe, 0.34);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    this.container.add(g);

    const title = scene.add.text(0, -innerH/2 + 20, cfg.title ?? "Contract", {
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);
    title.setScrollFactor(1);
    this.container.add(title);

    const body = scene.add.text(-innerW/2 + 12, -innerH/2 + 50, (cfg.lines ?? []).join("\n"), {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: cfg.bodyColor ?? "#e2e8f0",
      lineSpacing: 6,
      wordWrap: { width: innerW - 24 }
    }).setOrigin(0,0);
    body.setScrollFactor(1);
    this.container.add(body);

    const y = innerH/2 - 18;

    const back = makeButton(scene, {
      x: -60, y, w: 90, h: 30, label: "← Back",
      onClick: () => slot.back()
    });

    const primary = makeButton(scene, {
      x: 60, y, w: 110, h: 30,
      label: cfg.primaryLabel ?? "Select",
      onClick: () => cfg.onPrimary?.()
    });

    this.container.add([back, primary]);
  }
}
