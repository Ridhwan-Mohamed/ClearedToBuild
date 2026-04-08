import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";
export class FarmPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("FARM");

    super(scene, slot, {
      bgColor: 0x166534,
      title: "🌾 Farm Contract",
      lines: [
        "Fertile land parcel.",
        "• More crop space without base growth",
        "• May include temp farmers (later)",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type:"FARM" }) // let SlotPanel compute cost
    });
  }
}
