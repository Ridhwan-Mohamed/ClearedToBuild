export const MARKET_ADRENALINE_MOVE_MULTIPLIER = 1.22;
export const MARKET_ADRENALINE_WORK_MULTIPLIER = 1.35;

export function getMarketMoveMultiplier(troop) {
  const multiplier = Number(troop?._marketMoveSpeedMultiplier ?? 1);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function getMarketWorkDuration(troop, baseDuration) {
  const duration = Math.max(1, Number(baseDuration) || 1);
  const multiplier = Number(troop?._marketWorkSpeedMultiplier ?? 1);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return Math.max(80, Math.round(duration / safeMultiplier));
}

export function setMarketAdrenalineBuff(
  troop,
  until,
  moveMultiplier = MARKET_ADRENALINE_MOVE_MULTIPLIER,
  workMultiplier = MARKET_ADRENALINE_WORK_MULTIPLIER
) {
  if (!troop) return false;
  troop._marketAdrenalineUntil = Math.max(Number(troop._marketAdrenalineUntil || 0), Number(until || 0));
  troop._marketMoveSpeedMultiplier = Math.max(Number(troop._marketMoveSpeedMultiplier || 1), moveMultiplier);
  troop._marketWorkSpeedMultiplier = Math.max(Number(troop._marketWorkSpeedMultiplier || 1), workMultiplier);
  return true;
}

export function clearExpiredMarketAdrenalineBuff(troop, now) {
  if (!troop?._marketAdrenalineUntil) return false;
  if (Number(troop._marketAdrenalineUntil) > Number(now || 0)) return false;
  delete troop._marketAdrenalineUntil;
  delete troop._marketMoveSpeedMultiplier;
  delete troop._marketWorkSpeedMultiplier;
  return true;
}
