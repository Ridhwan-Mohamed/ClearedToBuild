import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";

export class MarketPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("MARKET");

    super(scene, slot, {
      bgColor: 0x7c2d12,
      title: "🏪 Market Contract",
      lines: [
        "Temporary traveling market.",
        "Buy seeds, berries, and one card later.",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
        "Items priced separately once the ship arrives.",
      ],
      primaryLabel: "Open",
      onPrimary: () => slot.commit({ type: "MARKET" }),
    });
  }
}
