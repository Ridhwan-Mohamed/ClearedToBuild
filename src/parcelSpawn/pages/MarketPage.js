import { BasePage } from "./BasePage.js";
export class MarketPage extends BasePage {
  constructor(scene, slot) {
    super(scene, slot, {
      bgColor: 0x7c2d12,
      title: "🏪 Market Contract",
      lines: [
        "Temporary traveling market.",
        "• Buy seeds/food/water/berries (later)",
        "",
        "Cost: (stub) $40",
        "Items priced separately (later)",
      ],
      primaryLabel: "Open",
      onPrimary: () => slot.commit({ type:"MARKET", cost:40 })
    });
  }
}
