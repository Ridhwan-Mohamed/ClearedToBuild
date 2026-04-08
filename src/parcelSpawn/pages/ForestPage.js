import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";

export class ForestPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("FOREST");

    super(scene, slot, {
      title: "🌲 Forest Contract",
      bgColor: 0x064e3b,
      bgAlpha: 0.22,
      bodyColor: "#d1fae5",
      lines: [
        "Spawns a forest parcel.",
        "Timer-based (later).",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type: "FOREST" }), // cost enforced elsewhere
    });
  }
}
