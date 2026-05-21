export const MARKET_ADRENALINE_MOVE_MULTIPLIER = 1.22;
export const MARKET_ADRENALINE_WORK_MULTIPLIER = 1.35;

export const MARKET_MELEE_CRIT_CHANCE_BONUS = 28;
export const MARKET_MELEE_CRIT_DAMAGE_MULTIPLIER = 1.3;
export const MARKET_PROJECTILE_CRIT_CHANCE_BONUS = 24;
export const MARKET_PROJECTILE_CRIT_DAMAGE_MULTIPLIER = 1.25;

const SCENE_BUFF_KEYS = Object.freeze({
  meleeCrit: "_marketMeleeCritUntil",
  projectileCrit: "_marketProjectileCritUntil",
});

function getSceneNow(scene) {
  return scene?.getSimulationNow?.() ?? scene?.simNowMs ?? scene?.time?.now ?? 0;
}

function isFriendlyTroop(troop) {
  return Number(troop?.body?.team ?? troop?._teamNumber ?? 0) === 1;
}

function hasActiveSceneBuff(scene, key, now = getSceneNow(scene)) {
  const until = Number(scene?.[key] || 0);
  return until > now;
}

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

export function setSceneMarketBuff(scene, kind, until) {
  const key = SCENE_BUFF_KEYS[kind];
  if (!scene || !key) return 0;
  const nextUntil = Math.max(Number(scene[key] || 0), Number(until || 0));
  scene[key] = nextUntil;
  return nextUntil;
}

export function clearExpiredSceneMarketBuffs(scene, now = getSceneNow(scene)) {
  if (!scene) return false;
  let changed = false;
  Object.values(SCENE_BUFF_KEYS).forEach((key) => {
    if (Number(scene[key] || 0) > now) return;
    if (!scene[key]) return;
    scene[key] = 0;
    changed = true;
  });
  return changed;
}

export function getSceneMarketBuffRemaining(scene, kind, now = getSceneNow(scene)) {
  const key = SCENE_BUFF_KEYS[kind];
  if (!scene || !key) return 0;
  return Math.max(0, Number(scene[key] || 0) - now);
}

export function getMarketCritProfile(attacker, weapon, now = getSceneNow(attacker?.scene)) {
  if (!attacker?.active || !weapon || !isFriendlyTroop(attacker)) {
    return {
      critChanceBonus: 0,
      critDamageMultiplier: 1,
    };
  }

  const scene = attacker.scene;
  const isMeleeSpecialist = !!(attacker.isBrawler || attacker.isBlademaster);

  if (!weapon.projectile && isMeleeSpecialist && hasActiveSceneBuff(scene, SCENE_BUFF_KEYS.meleeCrit, now)) {
    return {
      critChanceBonus: MARKET_MELEE_CRIT_CHANCE_BONUS,
      critDamageMultiplier: MARKET_MELEE_CRIT_DAMAGE_MULTIPLIER,
    };
  }

  if (weapon.projectile && hasActiveSceneBuff(scene, SCENE_BUFF_KEYS.projectileCrit, now)) {
    return {
      critChanceBonus: MARKET_PROJECTILE_CRIT_CHANCE_BONUS,
      critDamageMultiplier: MARKET_PROJECTILE_CRIT_DAMAGE_MULTIPLIER,
    };
  }

  return {
    critChanceBonus: 0,
    critDamageMultiplier: 1,
  };
}
