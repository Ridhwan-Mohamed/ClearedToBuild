export const PERMIT_EMOJI = "📜";

export function formatPermitCostText(cost = 0) {
  const n = Math.max(0, Number(cost) || 0);
  return `${PERMIT_EMOJI}${n}`;
}

export function getHousePermitCost(tileOrName) {
  const name = typeof tileOrName === "string" ? tileOrName : tileOrName?.name;
  return (name === "house1" || name === "house2") ? 1 : 0;
}

export function getContractPermitCost(type, difficulty = 1) {
  switch (type) {
    case "FOREST":
    case "ROCK":
    case "PRESSURE":
    case "MARKET":
    case "FARM":
    case "MILITIA":
      return 1;
    default:
      return 0;
  }
}

export function getStagePermitReward(stageIndex, seasonIndex = 1, stagesPerSeason = 5) {
  const stage = Math.max(1, Number(stageIndex) || 1);
  const season = Math.max(1, Number(seasonIndex) || 1);
  const bossBonus = stage >= stagesPerSeason ? 1 : 0;
  const seasonGrowth = Math.floor((season - 1) / 2);
  return 1 + bossBonus + seasonGrowth;
}
