const STORAGE_KEY = "processv2.store_unlocks_v1";

let cachedUnlocks = null;

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return null;
}

function loadUnlocks() {
  if (cachedUnlocks) return cachedUnlocks;

  const storage = getStorage();
  if (!storage) {
    cachedUnlocks = new Set();
    return cachedUnlocks;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cachedUnlocks = new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : []);
  } catch {
    cachedUnlocks = new Set();
  }

  return cachedUnlocks;
}

function persistUnlocks() {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(Array.from(loadUnlocks())));
  } catch {}
}

export const STORE_UNLOCK_KEYS = Object.freeze({
  turret: "turret",
  catapult: "catapult",
});

export function hasStoreUnlock(key) {
  if (!key) return false;
  return loadUnlocks().has(key);
}

export function getStoreUnlockSnapshot() {
  return Array.from(loadUnlocks());
}

export function unlockStoreItem(key, scene = null) {
  if (!key) return false;

  const unlocks = loadUnlocks();
  const changed = !unlocks.has(key);
  unlocks.add(key);
  persistUnlocks();

  scene?.events?.emit?.("store:unlock-changed", {
    key,
    changed,
    unlocks: getStoreUnlockSnapshot(),
  });

  return changed;
}
