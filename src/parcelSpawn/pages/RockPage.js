import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";

export class RockPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("ROCK");
    super(scene, slot, {
      title: "🪨 Rock Contract",
      bgColor: 0x334155,
      bgAlpha: 0.22,
      bodyColor: "#e2e8f0",
      lines: [
        "Spawns a rock parcel.",
        "Timer-based.",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type: "ROCK" }),
    });
  }
}
