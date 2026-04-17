import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";

export class FarmPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("FARM");

    super(scene, slot, {
      bgColor: 0x166534,
      title: "Field Contract",
      lines: [
        "Dark field parcel.",
        "Seeds and berries grow there over dark grass.",
        "Send foragers to gather and haul them home.",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type: "FARM" }),
    });
  }
}
