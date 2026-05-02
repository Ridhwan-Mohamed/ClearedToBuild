import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";

export class MarketPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("MARKET");

    super(scene, slot, {
      bgColor: 0x14384c,
      title: "Market Contract",
      lines: [
        "Builds a temporary parcel storefront.",
        "Sells expensive bailout cards only.",
        "Purchased cards go to card inventory.",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
        "No food, water, seeds, or berries sold here.",
      ],
      primaryLabel: "Open",
      onPrimary: () => slot.commit({ type: "MARKET" }),
    });
  }
}
