import { SQUARESIZE, TILE_TYPES } from "../constants.js";
import { Map as GameMap } from "../map.js";
import { Teams } from "../Teams.js";
import { Player } from "../players/Player.js";
import { Wall } from "../buildings/Wall.js";
import { FarmBushNode } from "../buildings/FarmBushNode.js";
import { PineTree } from "../buildings/pineTree.js";
import { RockNode } from "../buildings/RockNode.js";
import { StageState } from "../parcelController/StageState.js";
import { unlockStoreItem, resetStoreUnlocks } from "../parcel_system/StoreUnlockSystem.js";
import { POWERUP_CARDS } from "../Cards/PowerupCards.js";
import { clearBuildingArray, buildingArray, townBounds, townRoads, spawnPoints } from "../town.js";
import { TROOP_TYPE_REGISTRY, CARD_REGISTRY, reapplySavedCards, restoreItemStack, getTileTypeByKey, makeBuildingRef } from "./saveAdapters.js";
import { validateRunSnapshot } from "./saveSchema.js";
import { Scheduler } from "../ai/scheduler/Scheduler.js";
import { spawnNorthFort } from "../parcel_system/FortRaidParcel.js";
import { buildingManager } from "../Manager/buildingManager.js";

function cloneSimple(value, fallback) {
  if (value == null) return fallback;
  try {
    return structuredClone(value);
  } catch {
    return fallback;
  }
}

function assignPlain(target, value, fallback) {
  const clone = cloneSimple(value, fallback);
  return clone == null ? fallback : clone;
}

function rehydrateTaskLike(task, queueKey = null, teamId = null) {
  if (!task || typeof task !== "object") return task;
  const next = assignPlain(null, task, {});
  const type = getTileTypeByKey(next.type);
  const buildType = getTileTypeByKey(next.buildType ?? next.buildTypeName);

  if (type) next.type = type;
  if (buildType) next.buildType = buildType;
  else if (type) next.buildType = type;

  if (!next.type && next.buildType) next.type = next.buildType;
  if (queueKey) next.queueKey = queueKey;
  if (teamId != null && next.teamNumber == null) next.teamNumber = Number(teamId);
  next.assigned = 0;
  delete next.reservedBy;

  return next;
}

function rehydrateTaskList(tasks, queueKey = null, teamId = null) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task) => rehydrateTaskLike(task, queueKey, teamId))
    .filter(Boolean);
}

function getQueuedTillTint(kind) {
  return kind === "reseed" ? 0x45c9ff : 0x7cff97;
}

function restoreQueuedFarmPreviews(scene) {
  if (!scene?.addTillPreviewSprite) return;

  for (const [teamId, team] of Object.entries(Teams.teamLists || {})) {
    if (String(teamId) !== "1") continue;
    for (const task of team?.tileList || []) {
      if (!Number.isFinite(task?.x) || !Number.isFinite(task?.y)) continue;
      scene.addTillPreviewSprite(task.x, task.y, getQueuedTillTint(task.kind));
    }
  }
}

function restoreQueuedBuildVisuals(scene) {
  for (const [teamId, team] of Object.entries(Teams.teamLists || {})) {
    const numericTeamId = Number(teamId || 1);

    for (const task of team?.buildingTileStates || []) {
      buildingManager.ensureQueuedTileBuildGhost(task, numericTeamId);
    }

    for (const task of team?.blockBuildingStates || []) {
      buildingManager.restoreQueuedBlockBuildTask(task, numericTeamId);
    }
  }
}

function setSceneResource(scene, key, value) {
  scene[key] = Number(value || 0);
}

function getTeamCardIds(snapshot, teamId = "1") {
  return snapshot?.teams?.[String(teamId)]?.cardIds || [];
}

function syncStoreUnlocks(scene, unlockKeys = []) {
  resetStoreUnlocks(null, scene);
  for (const key of Array.isArray(unlockKeys) ? unlockKeys : []) {
    unlockStoreItem(key, scene);
  }
}

function restoreBuildingState(building, saved) {
  if (!building || !saved) return;
  if (Number.isFinite(saved.maxHealth) && saved.maxHealth > 0) {
    if ("maxHealth" in building) building.maxHealth = saved.maxHealth;
    if ("maxHp" in building) building.maxHp = saved.maxHealth;
  }
  if (Number.isFinite(saved.health)) {
    if (typeof building.setHealth === "function") building.setHealth(saved.health);
    else if ("health" in building) building.health = saved.health;
    else if ("hp" in building) building.hp = saved.health;
  }
  if (saved.typeKey === "storage") {
    building.storageItems = (saved.storageItems || []).map(restoreItemStack);
    building.reservedPickup = {};
  } else if (saved.typeKey === "clayOven") {
    building.cookingSlots = (saved.cookingSlots || []).map(restoreItemStack);
    building.outputSlots = (saved.outputSlots || []).map(restoreItemStack);
    building.cookTimers = assignPlain(null, saved.cookTimers, []);
    building.cookDurations = assignPlain(null, saved.cookDurations, []);
    building.isCooking = assignPlain(null, saved.isCooking, []);
    building.fuel = Number(saved.fuel || 0);
    building._updateCookingState?.();
  } else if (saved.typeKey === "tower") {
    building.isPressureTower = !!saved.isPressureTower;
    building.isFortObjective = !!saved.isFortObjective;
    building.isTownTower = !!saved.isTownTower;
    building.isStarterTownTower = !!saved.isStarterTownTower;
    building.pressureSlotId = saved.pressureSlotId ?? building.pressureSlotId ?? null;
  }
  building.updateHealthBar?.();
}

function rebuildBuildingRegistry(scene) {
  const registry = new Map();
  for (const [teamId, team] of Object.entries(Teams.teamLists || {})) {
    for (const entry of team.buildings || []) {
      const building = entry?.[3]?.buildingRef;
      if (!building) continue;
      const typeKey = building.tileType?.name || entry?.[2]?.name || "unknown";
      registry.set(makeBuildingRef(teamId, typeKey, building.x, building.y), building);
    }
  }
  return registry;
}

function restoreWalls(snapshotWalls = []) {
  for (const saved of snapshotWalls) {
    const wall = Wall.ensureAt(Player.scene, saved.x, saved.y, saved.teamId);
    if (!wall) continue;
    wall.maxHp = Number(saved.maxHp || wall.maxHp || 1);
    wall.hp = Number(saved.hp || wall.hp || wall.maxHp || 1);
    wall.phase = Number(saved.phase || 0);
    wall.isOpen = !!saved.isOpen;
    wall._applyVisuals?.();
    wall.setOpen?.(saved.isOpen);
  }
}

function restoreNonParcelResources(snapshotWorld = {}) {
  const pineByPos = new Map((GameMap.worldPines || []).filter((n) => n?.active).map((n) => [`${n.gridX},${n.gridY}`, n]));
  const rockByPos = new Map((GameMap.worldStones || []).filter((n) => n?.active).map((n) => [`${n.gridX},${n.gridY}`, n]));
  for (const saved of snapshotWorld.worldPines || []) {
    if (saved.contractId) continue;
    const node = pineByPos.get(`${saved.x},${saved.y}`);
    if (node) node.health = Number(saved.health || node.health || 0);
  }
  for (const saved of snapshotWorld.worldStones || []) {
    if (saved.contractId) continue;
    const node = rockByPos.get(`${saved.x},${saved.y}`);
    if (node) node.health = Number(saved.health || node.health || 0);
  }
}

function restoreTeamSnapshots(snapshot) {
  for (const [teamId, saved] of Object.entries(snapshot?.teams || {})) {
    const team = Teams.teamLists?.[teamId];
    if (!team || !saved) continue;
    team.name = saved.name || team.name;
    team.center = assignPlain(null, saved.center, team.center);
    team.tileList = rehydrateTaskList(saved.tileList, "tileList", teamId);
    team.foragerQueue = rehydrateTaskList(saved.foragerQueue, "foragerQueue", teamId);
    team.buildingTileStates = rehydrateTaskList(saved.buildingTileStates, "buildingTileStates", teamId);
    team.blockBuildingStates = rehydrateTaskList(saved.blockBuildingStates, "blockBuildingStates", teamId);
    team.destroyStates = rehydrateTaskList(saved.destroyStates, "destroyStates", teamId);
    team.enemyDestroyStates = rehydrateTaskList(saved.enemyDestroyStates, "enemyDestroyStates", teamId);
    team.enemyDestroyTileStates = rehydrateTaskList(saved.enemyDestroyTileStates, "enemyDestroyTileStates", teamId);
    team.buildingFixTasks = rehydrateTaskList(saved.buildingFixTasks, "buildingFixTasks", teamId);
    team.ovenJobs = rehydrateTaskList(saved.ovenJobs, "ovenJobs", teamId);
    team.ovenPickupJobs = rehydrateTaskList(saved.ovenPickupJobs, "ovenPickupJobs", teamId);
    team.ovenFuelJobs = rehydrateTaskList(saved.ovenFuelJobs, "ovenFuelJobs", teamId);
    team.ovenFuelDeliveryItems = [];
    team.ovenDeliveryItems = [];
    team.storageDeliveryItems = [];
    team.storageDeliveryReservations = [];
    team.cropList = assignPlain(null, saved.cropList, []);
    team.crops = assignPlain(null, saved.crops, []);
    team.wateringList = assignPlain(null, saved.wateringList, []);
    team.TeamFarmSpots = assignPlain(null, saved.TeamFarmSpots, []);
    team.townAutomation = assignPlain(null, saved.townAutomation, {});
    team.cardHand = (saved.cardIds || []).map((id) => CARD_REGISTRY.get(id)).filter(Boolean);
  }
}

function restorePlayers(scene, snapshot, buildingRegistry) {
  const troops = [];
  const houseRegistry = new Map();
  for (const [ref, building] of buildingRegistry.entries()) {
    houseRegistry.set(ref, building);
  }

  for (const saved of snapshot?.players || []) {
    const TroopClass = TROOP_TYPE_REGISTRY[saved.typeKey];
    if (!TroopClass) continue;
    const gx = Math.max(0, Math.floor(Number(saved.x || 0) / SQUARESIZE));
    const gy = Math.max(0, Math.floor(Number(saved.y || 0) / SQUARESIZE));
    const troop = new TroopClass(gx, gy, Number(saved.teamId || 0));
    troop.x = Number(saved.x || troop.x);
    troop.y = Number(saved.y || troop.y);
    troop.id = Number(saved.id || troop.id || 0);
    troop.health = Number(saved.health || troop.health || 0);
    troop.maxHealth = Number(saved.maxHealth || troop.maxHealth || troop.health || 0);
    troop.stamina = Number(saved.stamina || troop.stamina || 0);
    troop.maxStamina = Number(saved.maxStamina || troop.maxStamina || troop.stamina || 0);
    if (saved.name) troop.name = saved.name;
    troop.roam = !!saved.roam;
    troop.carrying = restoreItemStack(saved.carrying);
    troop.waterBucket = assignPlain(null, saved.waterBucket, troop.waterBucket ?? null);
    troop._sleepQueued = !!saved.sleepQueued;
    troop.guardPost = assignPlain(null, saved.guardPost, null);
    troop.deferredCarry = null;
    troop.pendingFarmSpot = null;
    troop.pendingStorageDeliveryReservation = null;
    troop.pendingOvenJob = null;
    troop.pendingFuelJob = null;
    troop.taskMeta = null;
    troop.task = null;
    troop.contractId = saved.contractId ?? null;
    troop.nightHordeId = saved.nightHordeId ?? null;
    troop.hordeIndex = saved.hordeIndex ?? null;
    troop.pressureEnemyType = saved.pressureEnemyType ?? null;
    troop.hordeModifierKey = saved.hordeModifierKey ?? null;
    troop.hordeModifierLabel = saved.hordeModifierLabel ?? null;
    troop.currentPath = [];
    troop.destX = null;
    troop.destY = null;
    troop.timer?.remove?.(false);
    troop.timer = null;
    troop.body?.reset?.(troop.x, troop.y);
    troops.push({ troop, saved });
  }

  let maxId = 0;
  for (const { troop, saved } of troops) {
    maxId = Math.max(maxId, Number(saved.id || troop.id || 0));
    if (saved.home?.typeKey) {
      const ref = makeBuildingRef(saved.teamId, saved.home.typeKey, saved.home.x, saved.home.y);
      const home = houseRegistry.get(ref);
      if (home) {
        troop.home = home;
        if (Array.isArray(home.occupants) && !home.occupants.includes(troop)) home.occupants.push(troop);
      }
    }
  }
  Player.count = maxId + 1;
}

export function prepareSnapshotWorldForBoot(snapshot) {
  const validation = validateRunSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(validation.reason || "Invalid save snapshot");
  }

  clearBuildingArray();
  const savedEntries = Array.isArray(snapshot?.world?.buildingEntries) ? snapshot.world.buildingEntries : [];
  for (const entry of savedEntries) {
    const tileType = getTileTypeByKey(entry.typeKey);
    if (!tileType) continue;
    buildingArray.push([Number(entry.x || 0), Number(entry.y || 0), tileType, Number(entry.teamId || 0)]);
  }

  Object.keys(townBounds).forEach((key) => delete townBounds[key]);
  Object.assign(townBounds, cloneSimple(snapshot?.world?.townBounds, {}));
  Object.keys(townRoads).forEach((key) => delete townRoads[key]);
  Object.assign(townRoads, cloneSimple(snapshot?.world?.townRoads, {}));
  spawnPoints.length = 0;
  for (const point of snapshot?.world?.spawnPoints || []) spawnPoints.push(point);
}

export function restoreRunSnapshotIntoScene(scene, snapshot) {
  const validation = validateRunSnapshot(snapshot);
  if (!validation.ok) throw new Error(validation.reason || "Invalid save snapshot");

  scene._restoringFromSave = true;
  try {
    scene.simNowMs = Number(snapshot?.progression?.simNowMs || scene.simNowMs || 0);
    reapplySavedCards(getTeamCardIds(snapshot, "1"));
    restoreTeamSnapshots(snapshot);
    syncStoreUnlocks(scene, snapshot?.systems?.storeUnlocks || []);

    scene.clock?.restoreSnapshot?.(snapshot?.progression?.clock || null);

    StageState.stageIndex = Math.max(1, Number(snapshot?.progression?.stageState?.stageIndex || 1));
    StageState.seasonIndex = Math.max(1, Number(snapshot?.progression?.stageState?.seasonIndex || 1));
    StageState.startDay = Math.max(1, Number(snapshot?.progression?.stageState?.startDay || 1));
    StageState.endlessMode = !!snapshot?.progression?.stageState?.endlessMode;
    StageState.fortObjectiveEnabled = !!snapshot?.progression?.stageState?.fortObjectiveEnabled;

    const resources = snapshot?.progression?.resources || {};
    setSceneResource(scene, "money", resources.money);
    setSceneResource(scene, "seeds", resources.seeds);
    setSceneResource(scene, "berries", resources.berries);
    setSceneResource(scene, "woodAmnt", resources.woodAmnt);
    setSceneResource(scene, "stoneAmnt", resources.stoneAmnt);
    setSceneResource(scene, "foodAmnt", resources.foodAmnt);
    setSceneResource(scene, "cleanWaterAmnt", resources.cleanWaterAmnt);
    setSceneResource(scene, "permits", resources.permits);
    scene.selectedSimSpeed = Number(snapshot?.progression?.selectedSimSpeed || scene.selectedSimSpeed || 1);

    scene._runStats = {
      ...(snapshot?.progression?.runStats || {}),
      troopUnlockKeys: new Set(snapshot?.progression?.runStats?.troopUnlockKeys || []),
      claimedContractIds: new Set(snapshot?.progression?.runStats?.claimedContractIds || []),
      defeatedEnemyIds: new Set(snapshot?.progression?.runStats?.defeatedEnemyIds || []),
    };
    scene._townXp = cloneSimple(snapshot?.progression?.townXp, scene._townXp);
    scene._northFortArrival = cloneSimple(snapshot?.progression?.northFortArrival, scene._northFortArrival);
    scene._townTowerStats = cloneSimple(snapshot?.progression?.townTowerStats, scene._townTowerStats);
    scene._northFortMainIslandOrigin = cloneSimple(snapshot?.world?.northFortMainIslandOrigin, scene._northFortMainIslandOrigin);

    GameMap.cropDict = cloneSimple(snapshot?.world?.cropDict, {});

    const buildingRegistry = rebuildBuildingRegistry(scene);
    for (const team of Object.values(snapshot?.teams || {})) {
      for (const saved of team?.buildings || []) {
        const building = buildingRegistry.get(saved.ref);
        if (building) restoreBuildingState(building, saved);
      }
    }

    restoreWalls(snapshot?.world?.walls || []);
    restoreNonParcelResources(snapshot?.world || {});

    scene.parcelManager?.restoreSnapshot?.(snapshot?.parcels?.parcelManager, snapshot);
    scene.towerPressureController?.restoreSnapshot?.(snapshot?.parcels?.towerPressure, scene, snapshot);

    restorePlayers(scene, snapshot, buildingRegistry);
    restoreQueuedFarmPreviews(scene);
    restoreQueuedBuildVisuals(scene);

    scene._activeNightHorde = cloneSimple(snapshot?.progression?.activeNightHorde, null);
    scene.achievementSystem?.restoreSnapshot?.(snapshot?.progression?.achievements || null);

    if (snapshot?.progression?.activeFort?.origin && scene?._northFortMainIslandOrigin) {
      scene._activeFort = spawnNorthFort({
        scene,
        map: GameMap,
        mainIslandOrigin: scene._northFortMainIslandOrigin,
      });
    }

    scene.uiScene?.refreshAll?.();
    scene.events.emit?.("store:unlock-changed", { changed: true, unlocks: snapshot?.systems?.storeUnlocks || [] });
    scene.events.emit?.("stage:changed", { stageIndex: StageState.stageIndex, seasonIndex: StageState.seasonIndex });
    scene.showSaveNotification?.();

    for (const troop of Player.troops || []) {
      if (!troop?.active || Number(troop.body?.team ?? troop._teamNumber ?? 0) !== 1) continue;
      Scheduler.stepUnit(troop);
    }
  } finally {
    scene._restoringFromSave = false;
  }
}
