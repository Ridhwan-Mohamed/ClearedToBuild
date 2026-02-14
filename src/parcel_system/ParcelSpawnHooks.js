// parcelSystem/ParcelSpawnHooks.js
export function makeParcelSpawnHooks(parcelManager) {
  return {
    startForest: (slotId) => parcelManager.startForest(slotId),
    startRock: (slotId) => parcelManager.startRock(slotId),
    startPressure: (slotId, difficulty) => parcelManager.startPressure(slotId, difficulty),
  };
}
