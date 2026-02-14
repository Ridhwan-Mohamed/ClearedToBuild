import { calcContractCost } from "../../constants.js";
import { BasePage } from "./BasePage.js";

export class ForestPage extends BasePage {
  constructor(scene, slot) {
    const cost = calcContractCost(scene, "FOREST");

    super(scene, slot, {
      title: "🌲 Forest Contract",
      bgColor: 0x064e3b,
      bgAlpha: 0.22,
      bodyColor: "#d1fae5",
      lines: [
        "Spawns a forest parcel.",
        "Timer-based (later).",
        "",
        `Cost: $${cost}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type: "FOREST" }), // cost enforced elsewhere
    });
  }
}
