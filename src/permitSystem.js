export const PERMIT_EMOJI = "📜";

export function formatPermitCostText(cost = 0) {
  const n = Math.max(0, Number(cost) || 0);
  return `${PERMIT_EMOJI}${n}`;
}

export function getHousePermitCost(tileOrName) {
  const name = typeof tileOrName === "string" ? tileOrName : tileOrName?.name;
  return (name === "house1" || name === "house2") ? 1 : 0;
}

export function getCompletedPermitBossWeeks(runContext = null) {
  const day = Math.max(1, Number(runContext?.clock?.day ?? runContext?.day ?? 1) || 1);
  return Math.max(0, Math.floor((day - 1) / 7));
}

export function getContractPermitCost(type, difficulty = 1, runContext = null) {
  if (difficulty && typeof difficulty === "object") {
    runContext = difficulty;
    difficulty = 1;
  }

  const normalizedType = String(type || "").toUpperCase();
  const completedBossWeeks = getCompletedPermitBossWeeks(runContext);

  if (completedBossWeeks >= 1) {
    if (normalizedType === "ROCK" || normalizedType === "MARKET") return 2;
    if (normalizedType === "FOREST" || normalizedType === "FARM") return 1;
  }

  switch (normalizedType) {
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
  return 1;
}
