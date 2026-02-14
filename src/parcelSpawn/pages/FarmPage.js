import { calcContractCost } from "../../constants.js";
import { BasePage } from "./BasePage.js";
export class FarmPage extends BasePage {
  constructor(scene, slot) {
    const cost = calcContractCost(scene, "FARM");

    super(scene, slot, {
      bgColor: 0x166534,
      title: "🌾 Farm Contract",
      lines: [
        "Fertile land parcel.",
        "• More crop space without base growth",
        "• May include temp farmers (later)",
        "",
        `Cost: $${cost}`,
      ],
      primaryLabel: "Buy",
      onPrimary: () => slot.commit({ type:"FARM" }) // let SlotPanel compute cost
    });
  }
}
