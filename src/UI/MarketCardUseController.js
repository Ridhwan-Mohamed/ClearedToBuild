import Phaser from "phaser";
import {
  SQUARESIZE,
  UIDEPTH,
  WORLD_DIMENSIONX,
  WORLD_DIMENSIONY,
  TILE_MAP,
  PARCEL,
  showAlert,
  showGhostText,
  colorFor,
} from "../constants";
import { Map as GameMap } from "../map";
import { Teams } from "../Teams";
import { Player } from "../players/Player";
import { fightManager } from "../Manager/fightManager";
import { Wall } from "../buildings/Wall";
import { AudioManager } from "../Manager/AudioManager";
import { townRoads } from "../town";
import {
  MARKET_CARD_KIND,
  MARKET_PLACEHOLDER_ASSETS,
  getMarketCardDefinition,
  loadMarketCardPlaceholderAssets,
} from "../Cards/MarketCards";

const CONTEXT_SOURCE = "market-card-use";
const PLAYER_TEAM = "1";
const ADRENALINE_MS = 45_000;
const FORTIFY_MS = 120_000;
const TARGETED_MARKET_ACTIVATIONS = new Set([
  "auto_wall",
  "chain_zapper",
  "meteor_drop",
  "decoy_beacon",
  "fortify_patch",
  "shock_mine",
]);

function gridKey(x, y) {
  return `${x},${y}`;
}

function worldToGrid(pointer) {
  return {
    x: Math.floor(Number(pointer?.worldX ?? 0) / SQUARESIZE),
    y: Math.floor(Number(pointer?.worldY ?? 0) / SQUARESIZE),
  };
}

function centerOfCell(x, y) {
  return {
    x: x * SQUARESIZE + SQUARESIZE / 2,
    y: y * SQUARESIZE + SQUARESIZE / 2,
  };
}

function inWorldBounds(x, y) {
  return x >= 0 && y >= 0 && x < WORLD_DIMENSIONX && y < WORLD_DIMENSIONY;
}

function cellTypeName(x, y) {
  const cell = GameMap.grid?.[y]?.[x];
  if (cell == null) return null;
  const val = Array.isArray(cell) ? cell[0] : cell;
  return TILE_MAP(val);
}

function isWaterCell(x, y) {
  return cellTypeName(x, y) === "water";
}

function isDetailedMode(scene) {
  return scene?.zoomMixer?.mode !== "overview";
}

function isFriendlyFighter(troop) {
  return !!(troop?.isBrawler || troop?.isBlademaster || troop?.isGunslinger || troop?.isFortGrunt);
}

function isFriendlyWorker(troop) {
  return !!troop && Number(troop.body?.team ?? troop._teamNumber ?? 0) === 1 && !isFriendlyFighter(troop);
}

function getLiveTeamTroops(teamNumber = PLAYER_TEAM) {
  const team = Teams.getTeam?.(teamNumber) ?? Teams.teamLists?.[String(teamNumber)];
  const fromTeam = Array.isArray(team?.playerList) ? team.playerList : [];
  return fromTeam.filter((troop) => troop?.active !== false && troop?.visible !== false);
}

function getLiveEnemies() {
  return (Player.troops || []).filter((troop) =>
    troop?.active !== false &&
    troop?.visible !== false &&
    Number(troop.body?.team ?? troop._teamNumber ?? 0) === 0 &&
    Number(troop.health ?? 1) > 0
  );
}

function healTroops(scene, troops, fraction, label) {
  let healed = 0;
  for (const troop of troops) {
    const max = Math.max(1, Number(troop.maxHealth ?? troop.health ?? 1));
    const before = Number(troop.health ?? max);
    const next = Math.min(max, before + max * fraction);
    if (next <= before) continue;
    troop.health = next;
    Player.showMiniBarsOnHit?.(troop);
    showGhostText(scene, troop.x, troop.y - 12, label, 1, false, false, "#7cffb2");
    healed++;
  }
  return healed;
}

function damageTroop(scene, troop, amount, {
  sourceTeam = 1,
  slowMultiplier = null,
  slowDurationMs = null,
  color = "#ffffff",
} = {}) {
  if (!troop?.active || Number(troop.health ?? 0) <= 0) return false;
  fightManager.applyHitReaction(troop, null, {
    moveSlowMultiplier: slowMultiplier,
    moveSlowDurationMs: slowDurationMs,
  });
  troop.health = Math.max(0, Number(troop.health ?? 0) - amount);
  Player.showMiniBarsOnHit?.(troop);
  showGhostText(scene, troop.x, troop.y - 12, String(Math.round(amount)), sourceTeam, false, false, color);
  if (troop.health <= 0) Player.destroyPlayer(troop);
  return true;
}

function damageStructure(scene, target, amount, color = "#ffad73") {
  if (!target) return false;
  if (target.wallRef) target = target.wallRef;

  if (target instanceof Wall || target.isWall || target.sprite?.isWall) {
    const wall = target.wallRef || target;
    const destroyed = wall.damage?.(amount);
    showGhostText(scene, wall.sprite?.x ?? ((wall.x + 0.5) * SQUARESIZE), (wall.sprite?.y ?? ((wall.y + 0.5) * SQUARESIZE)) - 12, String(Math.round(amount)), 1, false, false, color);
    return !destroyed;
  }

  if (typeof target.takeDamage === "function") {
    target.takeDamage(amount);
    return true;
  }

  const max = Math.max(1, Number(target.maxHealth ?? target.maxHp ?? target.health ?? target.hp ?? amount));
  const before = Number(target.health ?? target.hp ?? max);
  const next = Math.max(0, before - amount);
  if ("health" in target) target.health = next;
  if ("hp" in target) target.hp = next;
  target.onDamaged?.(amount, next, max);
  target.updateHealthBar?.();
  showGhostText(scene, target.sprite?.x ?? target.x * SQUARESIZE, (target.sprite?.y ?? target.y * SQUARESIZE) - 12, String(Math.round(amount)), 1, false, false, color);
  if (next <= 0) target.destroy?.();
  return next > 0;
}

function findNearestEnemyAtWorld(wx, wy, maxDistance = SQUARESIZE * 0.85) {
  let best = null;
  let bestDist = maxDistance;
  for (const enemy of getLiveEnemies()) {
    const d = Phaser.Math.Distance.Between(wx, wy, enemy.x, enemy.y);
    if (d > bestDist) continue;
    best = enemy;
    bestDist = d;
  }
  return best;
}

function getMainIslandBounds(scene) {
  const origin = scene?.parcelManager?.mainIslandOrigin || PARCEL.MAIN_ORIGIN;
  return {
    minX: Number(origin?.x ?? PARCEL.MAIN_ORIGIN.x),
    minY: Number(origin?.y ?? PARCEL.MAIN_ORIGIN.y),
    maxX: Number(origin?.x ?? PARCEL.MAIN_ORIGIN.x) + PARCEL.SIZE - 1,
    maxY: Number(origin?.y ?? PARCEL.MAIN_ORIGIN.y) + PARCEL.SIZE - 1,
  };
}

function isCellInBounds(bounds, x, y) {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function getTeamTownFootprint(teamNumber = PLAYER_TEAM) {
  const team = Teams.getTeam?.(teamNumber) ?? Teams.teamLists?.[String(teamNumber)];
  const cells = [];

  for (const entry of team?.buildings || []) {
    const x = Number(entry?.[0] ?? entry?.x);
    const y = Number(entry?.[1] ?? entry?.y);
    const type = entry?.[2] || entry?.type || entry?.tileType;
    const lenX = Math.max(1, Number(type?.lenX ?? 1));
    const lenY = Math.max(1, Number(type?.lenY ?? 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    for (let yy = y; yy < y + lenY; yy++) {
      for (let xx = x; xx < x + lenX; xx++) cells.push({ x: xx, y: yy });
    }
  }

  for (const road of townRoads?.[String(teamNumber)] || []) {
    const x = Number(Array.isArray(road) ? road[0] : road?.x);
    const y = Number(Array.isArray(road) ? road[1] : road?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) cells.push({ x, y });
  }

  for (const troop of getLiveTeamTroops(teamNumber)) {
    cells.push({
      x: Math.floor(troop.x / SQUARESIZE),
      y: Math.floor(troop.y / SQUARESIZE),
    });
  }

  return cells;
}

function computeAutoWallCells(scene) {
  const cells = getTeamTownFootprint(PLAYER_TEAM).filter((cell) => inWorldBounds(cell.x, cell.y));
  if (!cells.length) return [];

  const bounds = getMainIslandBounds(scene);
  let minX = Math.min(...cells.map((cell) => cell.x));
  let maxX = Math.max(...cells.map((cell) => cell.x));
  let minY = Math.min(...cells.map((cell) => cell.y));
  let maxY = Math.max(...cells.map((cell) => cell.y));

  minX = Math.max(bounds.minX, minX - 2);
  maxX = Math.min(bounds.maxX, maxX + 2);
  minY = Math.max(bounds.minY, minY - 2);
  maxY = Math.min(bounds.maxY, maxY + 2);

  const out = [];
  const seen = new Set();
  const tryAdd = (x, y) => {
    if (!isCellInBounds(bounds, x, y) || !inWorldBounds(x, y)) return;
    if (seen.has(gridKey(x, y))) return;
    seen.add(gridKey(x, y));
    if (isWaterCell(x, y)) return;
    if (Wall.getAt?.(x, y)?.active) return;
    if (GameMap.navGrid?.[y]?.[x] !== 1) return;
    out.push({ x, y });
  };

  for (let x = minX; x <= maxX; x++) {
    tryAdd(x, minY);
    tryAdd(x, maxY);
  }
  for (let y = minY + 1; y <= maxY - 1; y++) {
    tryAdd(minX, y);
    tryAdd(maxX, y);
  }

  return out;
}

function placeWallCells(scene, cells) {
  if (!cells.length) return 0;
  for (const cell of cells) {
    GameMap.navGrid[cell.y][cell.x] = 0;
    GameMap.enemyNavGrid[cell.y][cell.x] = 0;
    GameMap.placeTile(cell.x, cell.y, "wall");
    Wall.ensureAt(scene, cell.x, cell.y, 1);
  }
  for (const cell of cells) {
    GameMap.refreshWallShapesAround?.(cell.x, cell.y);
  }
  scene.refreshParcelArea?.({
    x: Math.min(...cells.map((cell) => cell.x)),
    y: Math.min(...cells.map((cell) => cell.y)),
    w: Math.max(...cells.map((cell) => cell.x)) - Math.min(...cells.map((cell) => cell.x)) + 1,
    h: Math.max(...cells.map((cell) => cell.y)) - Math.min(...cells.map((cell) => cell.y)) + 1,
    parcelTag: "main",
  });
  if (!scene.refreshParcelArea) {
    scene.rebuildBothNavMeshes?.();
    scene.zoomMixer?.buildOverviewTextureFromGrid?.(GameMap.grid, SQUARESIZE, (cell) => colorFor(cell));
  }
  return cells.length;
}

function findBuildingAtGrid(gx, gy) {
  for (const [teamId, team] of Object.entries(Teams.teamLists || {})) {
    if (String(teamId) !== PLAYER_TEAM) continue;
    for (const entry of team?.buildings || []) {
      const building = entry?.[3]?.buildingRef || entry?.buildingRef || entry?.building;
      const type = building?.tileType || entry?.[2] || {};
      const bx = Number(building?.x ?? entry?.[0]);
      const by = Number(building?.y ?? entry?.[1]);
      const lenX = Math.max(1, Number(type?.lenX ?? 1));
      const lenY = Math.max(1, Number(type?.lenY ?? 1));
      if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
      if (gx >= bx && gx < bx + lenX && gy >= by && gy < by + lenY) return building;
    }
  }
  return null;
}

function findFortifyTargetAtGrid(gx, gy) {
  const wall = Wall.getAt?.(gx, gy);
  if (wall?.active) {
    return {
      kind: "wall",
      label: "Wall",
      value: wall,
      x: wall.x,
      y: wall.y,
      w: 1,
      h: 1,
    };
  }

  const building = findBuildingAtGrid(gx, gy);
  if (!building) return null;
  const type = building.tileType || building.type || {};
  return {
    kind: "building",
    label: building.tileType?.label || building.tileType?.name || "Building",
    value: building,
    x: Number(building.x ?? building.gridX ?? 0),
    y: Number(building.y ?? building.gridY ?? 0),
    w: Math.max(1, Number(type.lenX ?? 1)),
    h: Math.max(1, Number(type.lenY ?? 1)),
  };
}

function isValidPlacementCell(gx, gy) {
  if (!inWorldBounds(gx, gy) || isWaterCell(gx, gy)) return false;
  if (GameMap.navGrid?.[gy]?.[gx] !== 1) return false;
  if (GameMap.checkBlockPositionGen?.(gx, gy, 1, 1)) return false;
  return true;
}

function applyFortify(scene, target) {
  if (!target?.value) return false;
  const obj = target.value;

  if (target.kind === "wall") {
    const originalMax = Math.max(1, Number(obj.maxHp ?? obj.hp ?? 1));
    obj.maxHp = Math.ceil(originalMax * 1.25);
    obj.hp = obj.maxHp;
    obj._applyVisuals?.();
    showGhostText(scene, (obj.x + 0.5) * SQUARESIZE, (obj.y + 0.5) * SQUARESIZE - 12, "FORTIFIED", 1, false, false, "#9dffa5");
    scene.time.delayedCall(FORTIFY_MS, () => {
      if (!obj.active) return;
      obj.maxHp = originalMax;
      obj.hp = Math.min(obj.hp, obj.maxHp);
      obj._applyVisuals?.();
    });
    return true;
  }

  const originalMax = Math.max(1, Number(obj.maxHealth ?? obj.maxHp ?? obj.health ?? obj.hp ?? 1));
  const boosted = Math.ceil(originalMax * 1.25);
  if ("maxHealth" in obj) obj.maxHealth = boosted;
  if ("maxHp" in obj) obj.maxHp = boosted;
  if ("health" in obj) obj.health = boosted;
  if ("hp" in obj) obj.hp = boosted;
  obj.updateHealthBar?.();
  obj.onDamaged?.(0, boosted, boosted);
  showGhostText(scene, obj.sprite?.x ?? ((target.x + 0.5) * SQUARESIZE), (obj.sprite?.y ?? ((target.y + 0.5) * SQUARESIZE)) - 12, "FORTIFIED", 1, false, false, "#9dffa5");
  scene.time.delayedCall(FORTIFY_MS, () => {
    if (obj.sprite && obj.sprite.active === false) return;
    if ("maxHealth" in obj) obj.maxHealth = originalMax;
    if ("maxHp" in obj) obj.maxHp = originalMax;
    if ("health" in obj) obj.health = Math.min(obj.health, originalMax);
    if ("hp" in obj) obj.hp = Math.min(obj.hp, originalMax);
    obj.updateHealthBar?.();
  });
  return true;
}

function buildChain(startEnemy) {
  const chain = [];
  const visited = new Set();
  let current = startEnemy;
  const range = SQUARESIZE * 4.25;
  while (current && chain.length < 8) {
    chain.push(current);
    visited.add(current);
    let best = null;
    let bestDist = range;
    for (const enemy of getLiveEnemies()) {
      if (visited.has(enemy)) continue;
      const d = Phaser.Math.Distance.Between(current.x, current.y, enemy.x, enemy.y);
      if (d > bestDist) continue;
      best = enemy;
      bestDist = d;
    }
    current = best;
  }
  return chain;
}

function applyChainZapper(scene, startEnemy) {
  const chain = buildChain(startEnemy);
  if (!chain.length) return 0;
  const graphics = scene.add.graphics().setDepth((UIDEPTH ?? 10) + 120);
  graphics.lineStyle(5, 0xa7f0ff, 0.8);
  for (let i = 0; i < chain.length - 1; i++) {
    graphics.strokeLineShape(new Phaser.Geom.Line(chain[i].x, chain[i].y, chain[i + 1].x, chain[i + 1].y));
  }
  chain.forEach((enemy, index) => {
    scene.tweens.add({
      targets: enemy,
      alpha: 0.45,
      duration: 60,
      yoyo: true,
      repeat: 2,
    });
    damageTroop(scene, enemy, index === 0 ? 145 : 95, {
      sourceTeam: 1,
      slowMultiplier: 0.45,
      slowDurationMs: 1200,
      color: "#a7f0ff",
    });
  });
  scene.time.delayedCall(180, () => graphics.destroy());
  return chain.length;
}

function applyMeteor(scene, target) {
  const radius = SQUARESIZE * 3.2;
  const graphics = scene.add.graphics().setDepth((UIDEPTH ?? 10) + 120);
  graphics.fillStyle(0xff743d, 0.28);
  graphics.fillCircle(target.x, target.y, radius);
  graphics.lineStyle(4, 0xffd08a, 0.85);
  graphics.strokeCircle(target.x, target.y, radius);
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: 360,
    ease: "Quad.easeOut",
    onComplete: () => graphics.destroy(),
  });

  let hits = 0;
  for (const troop of (Player.troops || []).slice()) {
    if (!troop?.active || Number(troop.health ?? 0) <= 0) continue;
    if (Phaser.Math.Distance.Between(target.x, target.y, troop.x, troop.y) > radius) continue;
    damageTroop(scene, troop, 160, { sourceTeam: 1, color: "#ffad73" });
    hits++;
  }

  const children = GameMap.structureBarrier?.getChildren?.() || [];
  const seen = new Set();
  for (const hit of children) {
    const targetObj = hit?.wallRef || hit?.buildingRef;
    if (!targetObj || seen.has(targetObj)) continue;
    const hx = hit.x ?? targetObj.sprite?.x ?? ((targetObj.x + 0.5) * SQUARESIZE);
    const hy = hit.y ?? targetObj.sprite?.y ?? ((targetObj.y + 0.5) * SQUARESIZE);
    if (Phaser.Math.Distance.Between(target.x, target.y, hx, hy) > radius) continue;
    seen.add(targetObj);
    damageStructure(scene, targetObj, 170, "#ffad73");
    hits++;
  }
  return hits;
}

function removeTeamBuildingRef(building) {
  for (const team of Object.values(Teams.teamLists || {})) {
    const list = team?.buildings;
    if (!Array.isArray(list)) continue;
    const index = list.findIndex((entry) => entry?.[3]?.buildingRef === building || entry?.buildingRef === building);
    if (index !== -1) list.splice(index, 1);
  }
}

function spawnDecoyBeacon(scene, gx, gy) {
  const pos = centerOfCell(gx, gy);
  const sprite = scene.add.image(pos.x, pos.y, MARKET_PLACEHOLDER_ASSETS.ghosts.decoyBeacon)
    .setDisplaySize(SQUARESIZE * 1.4, SQUARESIZE * 1.4)
    .setDepth((UIDEPTH ?? 10) + 2)
    .setInteractive({ useHandCursor: true });
  sprite.team = 1;
  const collider = scene.physics.add.staticImage(pos.x, pos.y, "barrier")
    .setDisplaySize(SQUARESIZE, SQUARESIZE)
    .setAlpha(0);
  collider.refreshBody();
  GameMap.structureBarrier?.add(collider);

  const decoy = {
    x: gx,
    y: gy,
    gridX: gx,
    gridY: gy,
    teamNumber: 1,
    team: 1,
    tileType: { name: "decoy_beacon", lenX: 1, lenY: 1 },
    maxHealth: 120,
    health: 120,
    sprite,
    collider,
    active: true,
    onDamaged(damage, currentHealth, maxHealth) {
      this.maxHealth = maxHealth ?? this.maxHealth;
      this.health = Math.max(0, currentHealth ?? (this.health - damage));
      sprite.setTint(0xff6666);
      scene.time.delayedCall(100, () => sprite.active && sprite.clearTint());
      if (this.health <= 0) this.destroy();
    },
    takeDamage(damage) {
      this.onDamaged(damage, Math.max(0, this.health - damage), this.maxHealth);
    },
    destroy() {
      if (!this.active) return;
      this.active = false;
      explodeDecoy(scene, pos.x, pos.y);
      for (const enemy of getLiveEnemies()) {
        if (enemy.forcedTarget === sprite) enemy.forcedTarget = null;
      }
      removeTeamBuildingRef(this);
      GameMap.structureBarrier?.remove(collider, true, true);
      collider.destroy?.();
      sprite.destroy?.();
    },
  };
  collider.buildingRef = decoy;
  collider.team = 1;
  sprite.buildingRef = decoy;
  Teams.getTeam?.(PLAYER_TEAM)?.buildings?.push([gx, gy, decoy.tileType, { buildingRef: decoy }]);
  for (const enemy of getLiveEnemies()) {
    if (Phaser.Math.Distance.Between(pos.x, pos.y, enemy.x, enemy.y) > SQUARESIZE * 12) continue;
    enemy.forcedTarget = sprite;
    enemy.roam = false;
  }
  scene.time.delayedCall(60_000, () => decoy.active && decoy.destroy());
  showGhostText(scene, pos.x, pos.y - 12, "DECOY", 1, false, false, "#ffe07a");
  return decoy;
}

function explodeDecoy(scene, x, y) {
  const radius = SQUARESIZE * 2.5;
  const graphics = scene.add.graphics().setDepth((UIDEPTH ?? 10) + 120);
  graphics.fillStyle(0xffe07a, 0.22);
  graphics.fillCircle(x, y, radius);
  graphics.lineStyle(3, 0xffe07a, 0.8);
  graphics.strokeCircle(x, y, radius);
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: 280,
    onComplete: () => graphics.destroy(),
  });
  for (const enemy of getLiveEnemies()) {
    if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) continue;
    damageTroop(scene, enemy, 110, { sourceTeam: 1, color: "#ffe07a" });
  }
}

function spawnShockMine(scene, gx, gy) {
  const pos = centerOfCell(gx, gy);
  const sprite = scene.add.image(pos.x, pos.y, MARKET_PLACEHOLDER_ASSETS.ghosts.shockMine)
    .setDisplaySize(SQUARESIZE * 1.1, SQUARESIZE * 1.1)
    .setDepth((UIDEPTH ?? 10) + 2)
    .setAlpha(0.94);
  const mine = { active: true, sprite, timer: null };
  const trigger = () => {
    if (!mine.active) return;
    const close = getLiveEnemies().find((enemy) => Phaser.Math.Distance.Between(pos.x, pos.y, enemy.x, enemy.y) <= SQUARESIZE * 0.95);
    if (!close) return;
    mine.active = false;
    mine.timer?.remove(false);

    const radius = SQUARESIZE * 2.15;
    const graphics = scene.add.graphics().setDepth((UIDEPTH ?? 10) + 120);
    graphics.fillStyle(0xb28cff, 0.22);
    graphics.fillCircle(pos.x, pos.y, radius);
    graphics.lineStyle(3, 0xb28cff, 0.88);
    graphics.strokeCircle(pos.x, pos.y, radius);
    scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 260,
      onComplete: () => graphics.destroy(),
    });
    for (const enemy of getLiveEnemies()) {
      if (Phaser.Math.Distance.Between(pos.x, pos.y, enemy.x, enemy.y) > radius) continue;
      damageTroop(scene, enemy, 100, {
        sourceTeam: 1,
        slowMultiplier: 0.35,
        slowDurationMs: 1800,
        color: "#d2b7ff",
      });
    }
    sprite.destroy();
  };
  mine.timer = scene.time.addEvent({ delay: 160, loop: true, callback: trigger });
  scene.time.delayedCall(90_000, () => {
    if (!mine.active) return;
    mine.active = false;
    mine.timer?.remove(false);
    sprite.destroy();
  });
  showGhostText(scene, pos.x, pos.y - 12, "ARMED", 1, false, false, "#d2b7ff");
  return mine;
}

export function useConsumableCard(scene, cardOrId) {
  const card = getMarketCardDefinition(cardOrId);
  if (!card || card.kind !== MARKET_CARD_KIND.CONSUMABLE) {
    return { ok: false, message: "That card is not a consumable" };
  }

  if (!isDetailedMode(scene)) {
    return { ok: false, message: "Zoom in to use cards" };
  }

  if (card.activation === "team_heal") {
    const healed = healTroops(scene, getLiveTeamTroops(PLAYER_TEAM), 0.5, "+HP");
    return { ok: healed > 0, message: healed > 0 ? `Healed ${healed} team members` : "No team members needed healing" };
  }

  if (card.activation === "fighter_heal") {
    const healed = healTroops(scene, getLiveTeamTroops(PLAYER_TEAM).filter(isFriendlyFighter), 0.7, "+HP");
    return { ok: healed > 0, message: healed > 0 ? `Healed ${healed} fighters` : "No fighters needed healing" };
  }

  if (card.activation === "worker_heal") {
    const healed = healTroops(scene, getLiveTeamTroops(PLAYER_TEAM).filter(isFriendlyWorker), 0.7, "+HP");
    return { ok: healed > 0, message: healed > 0 ? `Healed ${healed} workers` : "No workers needed healing" };
  }

  if (card.activation === "adrenaline_draft") {
    let buffed = 0;
    const now = scene.getSimulationNow?.() ?? scene.simNowMs ?? scene.time?.now ?? 0;
    for (const troop of getLiveTeamTroops(PLAYER_TEAM)) {
      if (!troop.active) continue;
      if (troop._marketAdrenalineBaseMoveMultiplier == null) {
        troop._marketAdrenalineBaseMoveMultiplier = Number(troop.moveSpeedMultiplier ?? 1) || 1;
      }
      troop._marketAdrenalineUntil = now + ADRENALINE_MS;
      troop.moveSpeedMultiplier = Math.max(
        Number(troop.moveSpeedMultiplier ?? 1) || 1,
        troop._marketAdrenalineBaseMoveMultiplier * 1.22
      );
      buffed++;
      showGhostText(scene, troop.x, troop.y - 12, "TEMPO", 1, false, false, "#fff17a");
    }
    scene.time.delayedCall(ADRENALINE_MS, () => {
      const checkNow = scene.getSimulationNow?.() ?? scene.simNowMs ?? scene.time?.now ?? 0;
      for (const troop of getLiveTeamTroops(PLAYER_TEAM)) {
        if (!troop?._marketAdrenalineUntil || troop._marketAdrenalineUntil > checkNow) continue;
        troop.moveSpeedMultiplier = troop._marketAdrenalineBaseMoveMultiplier ?? 1;
        delete troop._marketAdrenalineBaseMoveMultiplier;
        delete troop._marketAdrenalineUntil;
      }
    });
    return { ok: buffed > 0, message: buffed > 0 ? "Adrenaline Draft active" : "No team members to buff" };
  }

  return { ok: false, message: "That consumable has no effect yet" };
}

export class MarketCardUseController {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.card = null;
    this.activation = null;
    this.options = {};
    this.hover = null;
    this.selected = null;
    this.autoWallCells = [];
    this.graphics = null;
  }

  begin(cardOrId, options = {}) {
    const card = getMarketCardDefinition(cardOrId);
    if (!card || !TARGETED_MARKET_ACTIVATIONS.has(card.activation)) {
      showAlert(this.scene, "That card cannot target the world", "#ffaaaa");
      return false;
    }
    if (!isDetailedMode(this.scene)) {
      showAlert(this.scene, "Zoom in to use cards", "#ffaaaa");
      return false;
    }

    this.cancel(null, { silent: true });
    loadMarketCardPlaceholderAssets(this.scene);
    this.card = card;
    this.activation = card.activation;
    this.options = options || {};
    this.active = true;
    this.hover = null;
    this.selected = null;
    this.autoWallCells = this.activation === "auto_wall" ? computeAutoWallCells(this.scene) : [];
    this.graphics = this.scene.add.graphics().setDepth((UIDEPTH ?? 10) + 140);

    this.scene.input.setDefaultCursor(this._cursorForActivation());
    this._setCommandContext();
    this._updateFromPointer(this.scene.input.activePointer);
    this._drawPreview();
    AudioManager.playCardArm?.();
    return true;
  }

  cancel(message = null, { silent = false } = {}) {
    if (!this.active && !this.card) return;
    const card = this.card;
    const onCancel = this.options?.onCancel;
    this._cleanup();
    if (!silent) {
      onCancel?.(card);
      if (message) showAlert(this.scene, message, "#d3edf9");
    }
  }

  onPointerMove(pointer) {
    if (!this.active) return false;
    this._updateFromPointer(pointer);
    this._drawPreview();
    return true;
  }

  onPointerDown(pointer) {
    if (!this.active || pointer?.button !== 0) return false;
    this._updateFromPointer(pointer);
    if (this.activation !== "auto_wall") this.selected = this.hover;
    this._drawPreview();
    return true;
  }

  canConfirm() {
    if (!this.active) return false;
    if (this.activation === "auto_wall") return this.autoWallCells.length > 0;
    if (this.activation === "chain_zapper") return !!this.selected?.enemy;
    if (this.activation === "meteor_drop") return Number.isFinite(this.selected?.x) && Number.isFinite(this.selected?.y);
    if (this.activation === "fortify_patch") return !!this.selected?.target;
    if (this.activation === "decoy_beacon" || this.activation === "shock_mine") return !!this.selected?.valid;
    return false;
  }

  confirm() {
    if (!this.active || !this.canConfirm()) {
      AudioManager.playError?.();
      return false;
    }

    let result = { ok: false, message: "Card failed" };
    if (this.activation === "auto_wall") {
      const placed = placeWallCells(this.scene, this.autoWallCells);
      result = { ok: placed > 0, message: placed > 0 ? `Placed ${placed} wall segments` : "No valid wall cells" };
    } else if (this.activation === "chain_zapper") {
      const hits = applyChainZapper(this.scene, this.selected.enemy);
      result = { ok: hits > 0, message: hits > 0 ? `Zapped ${hits} enemies` : "No valid enemy chain" };
    } else if (this.activation === "meteor_drop") {
      const hits = applyMeteor(this.scene, this.selected);
      result = { ok: true, message: hits > 0 ? `Meteor hit ${hits} targets` : "Meteor dropped" };
    } else if (this.activation === "fortify_patch") {
      const ok = applyFortify(this.scene, this.selected.target);
      result = { ok, message: ok ? "Target fortified" : "No valid fortify target" };
    } else if (this.activation === "decoy_beacon") {
      spawnDecoyBeacon(this.scene, this.selected.gx, this.selected.gy);
      result = { ok: true, message: "Decoy Beacon placed" };
    } else if (this.activation === "shock_mine") {
      spawnShockMine(this.scene, this.selected.gx, this.selected.gy);
      result = { ok: true, message: "Shock Mine armed" };
    }

    if (!result.ok) {
      showAlert(this.scene, result.message || "Card failed", "#ffaaaa");
      AudioManager.playError?.();
      return false;
    }

    const card = this.card;
    const complete = this.options?.onComplete;
    this._cleanup();
    AudioManager.playCardConfirmUse?.();
    showAlert(this.scene, result.message, "#aaffaa");
    complete?.(card, result);
    return true;
  }

  _cursorForActivation() {
    if (this.activation === "chain_zapper" || this.activation === "meteor_drop") return "crosshair";
    if (this.activation === "fortify_patch") return "cell";
    return "copy";
  }

  _setCommandContext() {
    this.scene.uiScene?.selectionCommandBar?.setContext?.(CONTEXT_SOURCE, {
      helperText: () => this._helperText(),
      buttons: () => [
        {
          id: "cancel-card",
          label: "CANCEL",
          styleKey: "cancel",
          onClick: () => this.cancel(),
        },
        {
          id: "confirm-card",
          label: "CONFIRM USE",
          styleKey: "confirm",
          disabled: () => !this.canConfirm(),
          active: () => this.canConfirm(),
          onClick: () => this.confirm(),
        },
      ],
    });
  }

  _helperText() {
    if (!this.card) return "";
    if (this.activation === "auto_wall") {
      return this.autoWallCells.length
        ? `AUTO WALL | Previewing ${this.autoWallCells.length} valid wall cells`
        : "AUTO WALL | No valid perimeter cells found";
    }
    if (this.activation === "chain_zapper") {
      return this.selected?.enemy ? "CHAIN ZAPPER | Enemy selected" : "CHAIN ZAPPER | Click a raider, then confirm";
    }
    if (this.activation === "meteor_drop") {
      return this.selected?.x ? "METEOR DROP | Blast area selected" : "METEOR DROP | Click an area, then confirm";
    }
    if (this.activation === "fortify_patch") {
      return this.selected?.target ? `FORTIFY PATCH | ${this.selected.target.label} selected` : "FORTIFY PATCH | Click a building or wall";
    }
    if (this.activation === "decoy_beacon") {
      return this.selected?.valid ? "DECOY BEACON | Placement selected" : "DECOY BEACON | Click a valid empty tile";
    }
    if (this.activation === "shock_mine") {
      return this.selected?.valid ? "SHOCK MINE | Placement selected" : "SHOCK MINE | Click a valid empty tile";
    }
    return `${this.card.name} | Select target`;
  }

  _updateFromPointer(pointer) {
    if (!pointer || !this.active) return;
    const grid = worldToGrid(pointer);
    const world = {
      x: Number(pointer.worldX ?? 0),
      y: Number(pointer.worldY ?? 0),
    };

    if (this.activation === "chain_zapper") {
      this.hover = { enemy: findNearestEnemyAtWorld(world.x, world.y) };
      return;
    }

    if (this.activation === "meteor_drop") {
      this.hover = { x: world.x, y: world.y, gx: grid.x, gy: grid.y };
      return;
    }

    if (this.activation === "fortify_patch") {
      this.hover = { gx: grid.x, gy: grid.y, target: findFortifyTargetAtGrid(grid.x, grid.y) };
      return;
    }

    if (this.activation === "decoy_beacon" || this.activation === "shock_mine") {
      const valid = isValidPlacementCell(grid.x, grid.y);
      this.hover = { gx: grid.x, gy: grid.y, valid };
    }
  }

  _drawPreview() {
    if (!this.graphics) return;
    const g = this.graphics;
    g.clear();

    if (this.activation === "auto_wall") {
      g.fillStyle(0x7bd9ff, 0.18);
      g.lineStyle(2, 0x7bd9ff, 0.8);
      for (const cell of this.autoWallCells) {
        g.fillRect(cell.x * SQUARESIZE + 2, cell.y * SQUARESIZE + 2, SQUARESIZE - 4, SQUARESIZE - 4);
        g.strokeRect(cell.x * SQUARESIZE + 2, cell.y * SQUARESIZE + 2, SQUARESIZE - 4, SQUARESIZE - 4);
      }
      return;
    }

    if (this.activation === "chain_zapper") {
      const enemy = this.selected?.enemy || this.hover?.enemy;
      if (!enemy) return;
      g.lineStyle(3, 0xa7f0ff, 0.95);
      g.strokeCircle(enemy.x, enemy.y, SQUARESIZE * 0.75);
      const chain = buildChain(enemy);
      g.lineStyle(2, 0xa7f0ff, 0.42);
      for (let i = 0; i < chain.length - 1; i++) {
        g.strokeLineShape(new Phaser.Geom.Line(chain[i].x, chain[i].y, chain[i + 1].x, chain[i + 1].y));
      }
      return;
    }

    if (this.activation === "meteor_drop") {
      const target = this.selected || this.hover;
      if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) return;
      const radius = SQUARESIZE * 3.2;
      g.fillStyle(0xff743d, 0.14);
      g.fillCircle(target.x, target.y, radius);
      g.lineStyle(3, 0xffad73, 0.8);
      g.strokeCircle(target.x, target.y, radius);
      g.lineStyle(2, 0xffe0a8, 0.8);
      g.strokeCircle(target.x, target.y, 8);
      return;
    }

    if (this.activation === "fortify_patch") {
      const target = (this.selected?.target || this.hover?.target);
      if (!target) return;
      const x = target.x * SQUARESIZE;
      const y = target.y * SQUARESIZE;
      g.fillStyle(0x9dffa5, 0.14);
      g.fillRect(x, y, target.w * SQUARESIZE, target.h * SQUARESIZE);
      g.lineStyle(3, 0x9dffa5, 0.9);
      g.strokeRect(x + 2, y + 2, target.w * SQUARESIZE - 4, target.h * SQUARESIZE - 4);
      return;
    }

    if (this.activation === "decoy_beacon" || this.activation === "shock_mine") {
      const target = this.selected || this.hover;
      if (!target) return;
      const color = target.valid ? (this.activation === "decoy_beacon" ? 0xffe07a : 0xb28cff) : 0xff5555;
      const alpha = target.valid ? 0.28 : 0.18;
      g.fillStyle(color, alpha);
      g.fillRect(target.gx * SQUARESIZE + 3, target.gy * SQUARESIZE + 3, SQUARESIZE - 6, SQUARESIZE - 6);
      g.lineStyle(3, color, target.valid ? 0.85 : 0.65);
      g.strokeRect(target.gx * SQUARESIZE + 3, target.gy * SQUARESIZE + 3, SQUARESIZE - 6, SQUARESIZE - 6);
    }
  }

  _cleanup() {
    this.scene.uiScene?.selectionCommandBar?.clearContext?.(CONTEXT_SOURCE);
    this.scene.input.setDefaultCursor("default");
    this.graphics?.destroy();
    this.graphics = null;
    this.active = false;
    this.card = null;
    this.activation = null;
    this.options = {};
    this.hover = null;
    this.selected = null;
    this.autoWallCells = [];
  }
}

export function getMarketCardUseController(scene) {
  if (!scene) return null;
  if (!scene.marketCardUseController) {
    scene.marketCardUseController = new MarketCardUseController(scene);
  }
  return scene.marketCardUseController;
}
