// PressurePage.js
import { estimatePressureContract } from "../../constants.js";
import { makeButton } from "../ui/makeButton.js";

export class PressurePage {
  constructor(scene, slot) {
    this.scene = scene;
    this.slot = slot;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(1);
    this._rendered = false;
    this.difficulty = null;
  }

  render() {
    if (this._rendered) return;
    this._rendered = true;

    const { scene, slot } = this;
    const innerW = slot.W - 12;
    const innerH = slot.H - 12;

    const g = scene.add.graphics();
    g.setScrollFactor(1);
    // red tint, but still "glass"
    g.fillStyle(0x7f1d1d, 0.22);
    g.fillRoundedRect(-innerW/2, -innerH/2+20, innerW, innerH-20, 12);
    g.lineStyle(2, 0xffffff, 0.22);
    g.strokeRoundedRect(-innerW/2, -innerH/2+20, innerW, innerH-20, 12);
    this.container.add(g);

    const title = scene.add.text(0, -innerH/2 + 20, "⚔️ Pressure Contract", {
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);
    title.setScrollFactor(1);
    this.container.add(title);

    const body = scene.add.text(-innerW/2 + 12, -innerH/2 + 50, [
      "Choose difficulty:",
      "• harder = more money (later)",
      "• failure = money loss (later)",
    ].join("\n"), {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: "#fee2e2",
      lineSpacing: 6,
      wordWrap: { width: innerW - 24 }
    }).setOrigin(0,0);
    body.setScrollFactor(1);
    this.container.add(body);

    const yBtns = 40;
    const d1 = makeButton(scene, { x:-80, y:yBtns, w:70, h:30, label:"💀 1", onClick: () => this.setDifficulty(1) });
    const d2 = makeButton(scene, { x:  0, y:yBtns, w:70, h:30, label:"💀 2", onClick: () => this.setDifficulty(2) });
    const d3 = makeButton(scene, { x: 80, y:yBtns, w:70, h:30, label:"💀 3", onClick: () => this.setDifficulty(3) });
    this.container.add([d1,d2,d3]);

    this.selected = scene.add.text(0, yBtns + 36, "Selected: none", {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5,0.5);
    this.selected.setScrollFactor(1);
    this.container.add(this.selected);

    const y = innerH/2 - 18;
    const back = makeButton(scene, { x:-60, y, w:90, h:30, label:"← Back", onClick: () => slot.back() });
    this.startBtn = makeButton(scene, { x: 60, y, w:110, h:30, label:"Start", onClick: () => this.start() });

    // disabled look initially
    this.startBtn.list[0].setFillStyle(0xffffff, 0.08);

    this.container.add([back, this.startBtn]);
  }

  setDifficulty(n) {
    this.difficulty = n;

    const est = estimatePressureContract(this.scene, n);

    this.selected.setText(
      [
        `Selected: ${"💀".repeat(n)} (${n})`,
        `Cost: $${est.cost}`,
        `Max payout: $${est.gross}`,
        `Net: +$${est.net}`,
      ].join("\n")
    );

    this.startBtn.list[0].setFillStyle(0xffffff, 0.16);
  }

  start() {
    if (!this.difficulty) return;
    this.slot.commit({ type:"PRESSURE", difficulty:this.difficulty });
  }
}
