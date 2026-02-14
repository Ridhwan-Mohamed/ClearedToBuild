import { calcContractCost } from "../../constants.js";
import { BasePage } from "./BasePage.js";
export class MilitiaPage extends BasePage {
  constructor(scene, slot) {
    const cost = calcContractCost(scene, "MILITIA");
    super(scene, slot, {
      bgColor: 0x0f172a,
      title: "🛡 Militia Contract",
      lines: [
        "Hire temporary fighters.",
        "• Extra bodies for a few days",
        "• Fade out when contract ends",
        "",
        `Cost: $${cost}`,
      ],
      primaryLabel: "Hire",
      onPrimary: () => slot.commit({ type:"MILITIA"})
    });
  }
}
