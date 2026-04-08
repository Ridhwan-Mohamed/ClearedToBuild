import { BasePage } from "./BasePage.js";
import { formatPermitCostText, getContractPermitCost } from "../../permitSystem.js";
export class MilitiaPage extends BasePage {
  constructor(scene, slot) {
    const cost = getContractPermitCost("MILITIA");
    super(scene, slot, {
      bgColor: 0x0f172a,
      title: "🛡 Militia Contract",
      lines: [
        "Hire temporary fighters.",
        "• Extra bodies for a few days",
        "• Fade out when contract ends",
        "",
        `Permit Cost: ${formatPermitCostText(cost)}`,
      ],
      primaryLabel: "Hire",
      onPrimary: () => slot.commit({ type:"MILITIA"})
    });
  }
}
