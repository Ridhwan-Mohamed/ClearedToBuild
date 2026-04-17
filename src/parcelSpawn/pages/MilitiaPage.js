import { BasePage } from "./BasePage.js";

const MILITIA_FORMATIONS = [
  {
    key: "cheap",
    title: "Cheap Formation",
    permitCost: 1,
    moneyCost: 200,
    lines: [
      "• Costs: 1 permit + $200",
      "• 3 Turrets",
    ],
    militiaConfig: {
      formationKey: "cheap",
      layout: ["turret", "turret", "turret"],
    },
  },
  {
    key: "medium",
    title: "Medium Formation",
    permitCost: 2,
    moneyCost: 400,
    lines: [
      "• Costs: 2 permits + $400",
      "• 2 Turrets + 1 Catapult",
    ],
    militiaConfig: {
      formationKey: "medium",
      layout: ["turret", "catapult", "turret"],
    },
  },
  {
    key: "expensive",
    title: "Expensive Formation",
    permitCost: 3,
    moneyCost: 600,
    lines: [
      "• Costs: 3 permits + $600",
      "• 2 Catapults + 1 Turret",
    ],
    militiaConfig: {
      formationKey: "expensive",
      layout: ["catapult", "turret", "catapult"],
    },
  },
];

export class MilitiaPage extends BasePage {
  constructor(scene, slot) {
    super(scene, slot, {
      bgColor: 0x0f172a,
      title: "🛡 Militia Parcel",
      lines: [
        "Choose a militia formation.",
        "These support islands last 1 day.",
      ],
      primaryLabel: "Back",
      onPrimary: () => slot.back(),
    });
  }

  render() {
    super.render();

    const startY = 58;
    const gapY = 78;

    MILITIA_FORMATIONS.forEach((entry, index) => {
      const y = startY + index * gapY;

      const title = this.scene.add.text(-120, y, entry.title, {
        fontFamily: "Bungee",
        fontSize: "13px",
        color: "#ffffff",
      }).setOrigin(0, 0.5);

      const body = this.scene.add.text(-120, y + 16, entry.lines.join("\n"), {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#dbeafe",
        lineSpacing: 2,
      }).setOrigin(0, 0);

      const buy = this.scene.add.text(118, y + 10, "BUY", {
        fontFamily: "Bungee",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#1d4ed8",
        padding: { left: 12, right: 12, top: 8, bottom: 8 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });

      buy.on("pointerover", () => buy.setTint(0xdbeafe));
      buy.on("pointerout", () => buy.clearTint());
      buy.on("pointerup", () => {
        this.slot.commit({
          type: "MILITIA",
          cost: entry.permitCost,
          moneyCost: entry.moneyCost,
          militiaConfig: entry.militiaConfig,
        });
      });

      this.container.add([title, body, buy]);
    });
  }
}