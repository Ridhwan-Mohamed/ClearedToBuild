import { BasePage } from "./BasePage.js";
import { calcContractCost } from "../../constants.js";

export class RockPage extends BasePage {
  constructor(scene, slot) {
    const cost = calcContractCost(scene, "ROCK");
    super(scene, slot, {
      title: "🪨 Rock Contract",
      bgColor: 0x334155,
      bgAlpha: 0.22,
      bodyColor: "#e2e8f0",
      lines: [
        "Spawns a rock parcel.",
        "Timer-based.",
        "",
        `Cost: $${cost}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type: "ROCK" }),
    });
  }
}
