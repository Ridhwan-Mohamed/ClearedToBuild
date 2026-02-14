// parcelController/StageState.js
// Minimal stage scaffold (you'll extend when forts exist).
export const StageState = {
  stageIndex: 1,      // starts at 1
  seasonIndex: 1,
  // You can tick this up when a fort is destroyed.
  advanceStage() {
    this.stageIndex += 1;
  },
  advanceSeason() {
    this.seasonIndex += 1;
    this.stageIndex += 1;
  }
};
