import Phaser from "phaser";
import { SQUARESIZE, UIDEPTH, showAlert } from "../constants.js";
import { AudioManager } from "../Manager/AudioManager.js";
import { SaveManager } from "../save/SaveManager.js";
import { Teams } from "../Teams.js";
import { Player } from "../players/Player.js";
import { TUTORIAL_STEPS } from "./TutorialSteps.js";
import { TutorialOverlay } from "./TutorialOverlay.js";

const PAUSE_REASON = "tutorial";
const ACTION_PAUSE_REASON = "tutorial_dialog";

export class TutorialManager {
  constructor(scene) {
    this.scene = scene;
    this.uiScene = null;
    this.overlay = null;
    this.active = false;
    this.promptOpen = false;
    this.currentIndex = -1;
    this.currentStep = null;
    this.waitFor = null;
    this.lastRecruited = {};
    this.uiHighlight = null;
    this.uiHighlightTween = null;
    this.worldPulse = null;
    this.worldPulseTween = null;
    this.hoveredParcelSlotId = null;
  }

  destroy() {
    this._clearHighlights();
    this.overlay?.destroy?.();
    this.overlay = null;
    this.scene?.setSimulationPause?.(PAUSE_REASON, false);
    this.scene?.setSimulationPause?.(ACTION_PAUSE_REASON, false);
  }

  isActive() {
    return !!this.active;
  }

  isBlockingSaves() {
    return this.isActive();
  }

  promptIfNeeded() {
    if (this.promptOpen || this.active) return false;
    if (!this.scene?.uiScene?._hudBuilt) return false;
    this._ensureOverlay();
    this.promptOpen = true;
    this.scene.setSimulationPause?.(PAUSE_REASON, true);
    this.overlay.showPrompt({
      onStart: () => {
        this.promptOpen = false;
        this.start();
      },
      onSkip: () => {
        this.promptOpen = false;
        this.scene.setSimulationPause?.(PAUSE_REASON, false);
        this.overlay?.promptRoot?.destroy?.(true);
        this.overlay.promptRoot = null;
      },
    });
    return true;
  }

  start() {
    this._ensureOverlay();
    this.active = true;
    this.currentIndex = -1;
    this.waitFor = null;
    this.lastRecruited = {};
    this.scene.tutorialManager = this;
    this._ensureTutorialResources();
    SaveManager.clearRunSave();
    this.scene.events?.emit?.("tutorial:started");
    this.advance();
  }

  complete() {
    if (!this.active) return;
    this.active = false;
    this.waitFor = null;
    this._clearHighlights();
    this.scene.setSimulationPause?.(PAUSE_REASON, false);
    this.scene.setSimulationPause?.(ACTION_PAUSE_REASON, false);
    this.overlay?.destroy?.();
    this.overlay = null;
    this.scene.events?.emit?.("tutorial:completed");
    showAlert(this.scene, "Tutorial complete. Saving is enabled.", "#a7f3d0", 2200);
    SaveManager.attachScene(this.scene);
    SaveManager.saveNow("tutorial_complete", { silent: true });
  }

  advanceFromOverlay() {
    if (!this.active) return;
    if (this.currentStep?.completeOnAdvance) {
      this.complete();
      return;
    }
    this.advance();
  }

  advance() {
    if (!this.active) return;
    this.currentIndex += 1;
    if (this.currentIndex >= TUTORIAL_STEPS.length) {
      this.complete();
      return;
    }
    this._enterStep(TUTORIAL_STEPS[this.currentIndex]);
  }

  canPerformAction(action, payload = {}) {
    if (!this.active) return true;
    const step = this.currentStep;
    const allowed = Array.isArray(step?.allowedActions) ? step.allowedActions : [];
    if (!allowed.length) {
      this.blockAction(payload?.message);
      return false;
    }

    const ok = allowed.some((rule) => this._matchesRule(rule, action, payload));
    if (!ok) {
      this.blockAction(payload?.message);
      return false;
    }
    return true;
  }

  blockAction(message = null) {
    const text = message || this._blockedMessageForStep();
    AudioManager.playError({ volume: 0.18 });
    showAlert(this.scene, text, "#fca5a5", 1800);
  }

  notifyAction(action, payload = {}) {
    if (!this.active) return false;
    const wait = this.waitFor;
    if (!wait || !this._matchesRule(wait, action, payload)) return false;

    if (action === "build.placed") {
      this._focusPlacedBuild(payload);
    }
    if (action === "build.recruit" && payload?.player) {
      this.lastRecruited[payload.key] = payload.player;
    }

    this.waitFor = null;
    const delay = action === "parcel.commit" ? 1200 : 360;
    this.scene.time?.delayedCall?.(delay, () => this.advance());
    return true;
  }

  _enterStep(step) {
    this.currentStep = step;
    this.waitFor = step.waitFor || null;
    this._clearHighlights();
    this.scene.setSimulationPause?.(PAUSE_REASON, false);
    this.scene.setSimulationPause?.(ACTION_PAUSE_REASON, !step.resumeSimulation);

    if (step.forceDetailed) {
      this._ensureDetailedMode();
    }
    if (step.selectRole) {
      this._selectRole(step.selectRole, { faceDown: !!step.faceDown });
    }
    if (step.openTab) {
      this._openTab(step.openTab);
    }
    this._syncBottomBarForStep(step);
    if (step.setBuildMode) {
      this._setBuildMode(step.setBuildMode);
    }
    if (step.focusParcel) {
      this._focusParcel(step.focusParcel);
    }
    if (step.hoverParcel) {
      this.scene.time?.delayedCall?.(220, () => this._setParcelHover(step.hoverParcel, true));
    }
    if (step.highlight) {
      this.scene.time?.delayedCall?.(260, () => this._showUiHighlight(step.highlight));
    }

    this.overlay.showStep(step);
  }

  _ensureOverlay() {
    this.uiScene = this.scene.uiScene || this.scene.scene?.get?.("GameUIScene") || this.scene;
    if (!this.overlay || this.overlay.scene !== this.uiScene) {
      this.overlay?.destroy?.();
      this.overlay = new TutorialOverlay(this.uiScene, this);
    }
    return this.overlay;
  }

  _ensureTutorialResources() {
    const minimums = {
      money: 300,
      seeds: 8,
      foodAmnt: 8,
      cleanWaterAmnt: 8,
      woodAmnt: 12,
      stoneAmnt: 8,
      permits: 2,
    };
    const applyDelta = (field, updater) => {
      const current = Number(this.scene[field] ?? 0);
      const min = minimums[field];
      if (current >= min) return;
      const delta = min - current;
      if (updater) updater(delta);
      else this.scene[field] = min;
    };
    applyDelta("money", (delta) => this.scene.updateMoney?.(delta));
    applyDelta("seeds", (delta) => this.scene.updateSeeds?.(delta));
    applyDelta("permits", (delta) => this.scene.updatePermits?.(delta));
    applyDelta("foodAmnt");
    applyDelta("cleanWaterAmnt");
    applyDelta("woodAmnt");
    applyDelta("stoneAmnt");
    this.scene.uiScene?._refreshTopHudValues?.();
  }

  _matchesRule(rule, action, payload = {}) {
    if (!rule || rule.action !== action) return false;
    if (rule.key && rule.key !== payload.key) return false;
    if (rule.type && rule.type !== payload.type) return false;
    if (rule.slotId && rule.slotId !== payload.slotId) return false;
    if (rule.source && rule.source !== payload.source) return false;
    if (rule.mode && rule.mode !== payload.mode) return false;
    if (rule.resourceType && rule.resourceType !== payload.resourceType) return false;
    if (Object.prototype.hasOwnProperty.call(rule, "enabled") && rule.enabled !== payload.enabled) return false;
    return true;
  }

  _blockedMessageForStep() {
    const id = this.currentStep?.id || "";
    if (id.includes("storage")) return "Build the storage first.";
    if (id.includes("house")) return "Build the house first.";
    if (id.includes("brawler")) return "Recruit the brawler first.";
    if (id.includes("contract_slot")) return "Open the East contract first.";
    if (id.includes("contract_type")) return "Choose the Forest contract first.";
    if (id.includes("parcel") || id.includes("contract_buy")) return "Buy the forest parcel first.";
    return "Finish this tutorial step first.";
  }

  _selectRole(roleKey, opts = {}) {
    const troop = this._findRole(roleKey);
    if (!troop) return null;
    Player.selectSingleTroop(troop);
    if (opts.faceDown) this._faceTroopDown(troop, roleKey);
    this._focusTroop(troop);
    return troop;
  }

  _findRole(roleKey) {
    if (roleKey === "brawler" && this.lastRecruited.brawler?.active) return this.lastRecruited.brawler;
    const team = Teams.getTeam("1");
    const listName = `${roleKey}List`;
    return (team?.[listName] || []).find((troop) => troop?.active) || null;
  }

  _faceTroopDown(troop, roleKey) {
    if (!troop?.active) return;
    const textureKey = `${roleKey}_walk_down`;
    if (!this.scene.textures.exists(textureKey)) return;
    troop.anims?.stop?.();
    troop.rotation = 0;
    troop.setTexture(textureKey);
    troop.setFrame?.(1);
    if (troop.directionalMove) {
      troop.directionalMove.lastDirection = "down";
    }
  }

  _focusTroop(troop) {
    if (!troop?.active) return;
    this._focusWorldPoint(troop.x, troop.y, 1.08, 520);
  }

  _openTab(pageKey) {
    const ui = this.scene.uiScene;
    const bar = ui?.uiBottomBar;
    if (!ui || !bar?.pages) return;

    bar.pages.swapPage(pageKey);
    bar.currentPage = pageKey;
    bar.tabs?.setValue?.(pageKey);
    if (!bar.expanded) ui.setBottomBar?.(true);

    if (pageKey !== "players") ui.playerTab?.hidePortrait?.();
    if (pageKey !== "players") ui.playerTab?.onHide?.();
    if (pageKey !== "functions") ui.functionTab?.hide?.();
    if (pageKey !== "ovens") ui.clayTab?.hide?.();
    if (pageKey !== "storage") ui.storageTab?.hide?.();
    if (pageKey !== "houses") ui.housesTab?.hide?.();
    if (pageKey !== "build") ui.buildTab?.hide?.();
    if (pageKey !== "cards") ui.cardsTab?.hide?.();

    if (pageKey === "functions") ui.functionTab?.onShow?.();
    if (pageKey === "ovens") ui.clayTab?.onShow?.();
    if (pageKey === "storage") ui.storageTab?.onShow?.();
    if (pageKey === "players") ui.playerTab?.onShow?.();
    if (pageKey === "houses") ui.housesTab?.onShow?.();
    if (pageKey === "build") ui.buildTab?.onShow?.();
    if (pageKey === "cards") ui.cardsTab?.onShow?.();
  }

  _setBuildMode(mode) {
    const tab = this.scene.uiScene?.buildTab;
    if (!tab) return;
    tab._setMode?.(mode);
  }

  _syncBottomBarForStep(step = this.currentStep) {
    const ui = this.scene.uiScene;
    if (!ui?.setBottomBar || !ui?.uiBottomBar) return;
    const open = this._shouldOpenBottomBar(step);
    ui.setBottomBar(open);
    this.scene.time?.delayedCall?.(230, () => this.overlay?.relayout?.());
  }

  _shouldOpenBottomBar(step = {}) {
    if (step.bottomBar === "open") return true;
    if (step.bottomBar === "closed") return false;
    if (step.openTab) return true;
    return [
      "bottomTabs",
      "farmButton",
      "waterButton",
      "buildStorageCard",
      "buildHouseCard",
      "buildUnitStoreArea",
    ].includes(step.highlight);
  }

  _focusParcel(slotId) {
    const slot = this.scene.parcelSpawnUI?.slots?.get?.(slotId);
    if (!slot?.container) return;
    this._focusWorldPoint(slot.container.x, slot.container.y, 0.95);
  }

  _ensureDetailedMode() {
    const mixer = this.scene.zoomMixer;
    if (mixer?.mode === "overview") {
      mixer.swapMode?.("detailed", 240);
    }
  }

  _setParcelHover(slotId, hovered = true) {
    if (!slotId) return;
    const slot = this.scene.parcelSpawnUI?.slots?.get?.(slotId);
    slot?._setDetailedProxyHovered?.(!!hovered);
    this.scene.uiScene?.contractHud?.setExternalHover?.(slotId, !!hovered);
    this.hoveredParcelSlotId = hovered ? slotId : null;
  }

  _focusPlacedBuild(payload = {}) {
    const tile = payload.tile || {};
    const gridX = Number(payload.gridX);
    const gridY = Number(payload.gridY);
    if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return;
    const width = Math.max(1, Number(tile.lenX || 1)) * SQUARESIZE;
    const height = Math.max(1, Number(tile.lenY || 1)) * SQUARESIZE;
    const x = gridX * SQUARESIZE;
    const y = gridY * SQUARESIZE;
    this._focusWorldPoint(x + width / 2, y + height / 2, 1.08);
    this._showWorldPulse(x, y, width, height);
  }

  _focusWorldPoint(worldX, worldY, zoom = null, duration = 380) {
    const cam = this.scene.cameras?.main;
    if (!cam || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
    const nextZoom = Number.isFinite(zoom) ? zoom : cam.zoom;
    const scrollX = worldX - (cam.width * 0.5) / Math.max(0.0001, nextZoom);
    const scrollY = worldY - (cam.height * 0.5) / Math.max(0.0001, nextZoom);
    this.scene.tweens?.add?.({
      targets: cam,
      scrollX,
      scrollY,
      zoom: nextZoom,
      duration,
      ease: "Cubic.easeInOut",
    });
  }

  _clearHighlights() {
    if (this.hoveredParcelSlotId) {
      this._setParcelHover(this.hoveredParcelSlotId, false);
    }
    this.uiHighlightTween?.remove?.();
    this.uiHighlightTween = null;
    this.uiHighlight?.destroy?.();
    this.uiHighlight = null;
    this.worldPulseTween?.remove?.();
    this.worldPulseTween = null;
    this.worldPulse?.destroy?.();
    this.worldPulse = null;
  }

  _showUiHighlight(key) {
    const ui = this.scene.uiScene;
    if (!ui?.add) return;
    const rect = this._resolveHighlightRect(key);
    if (!rect) return;
    this.uiHighlight?.destroy?.();
    const g = ui.add.graphics().setDepth(UIDEPTH + 510).setScrollFactor(0);
    const draw = () => {
      g.clear();
      g.fillStyle(0x02070d, 0.22);
      g.fillRoundedRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16, 14);
      g.lineStyle(4, 0xfef08a, 0.90);
      g.strokeRoundedRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16, 14);
      g.lineStyle(2, 0xffffff, 0.50);
      g.strokeRoundedRect(rect.x - 3, rect.y - 3, rect.width + 6, rect.height + 6, 11);
    };
    draw();
    this.uiHighlight = g;
    this.uiHighlightTween = ui.tweens.add({
      targets: g,
      alpha: { from: 0.42, to: 1 },
      duration: 520,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.overlay?.relayout?.();
  }

  getOverlayTargetRect() {
    if (!this.currentStep?.highlight) return null;
    return this._resolveHighlightRect(this.currentStep.highlight);
  }

  _resolveHighlightRect(key) {
    const ui = this.scene.uiScene;
    if (!ui) return null;
    if (key === "topHud") return this._boundsOf(ui.topHud);
    if (key === "bottomTabs") return this._boundsOf(ui.uiBottomBar?.tabs);
    if (key === "farmButton") return this._boundsOf(ui.functionTab?.mainButtons?.Farm?.hit);
    if (key === "waterButton") return this._boundsOf(ui.functionTab?.mainButtons?.water?.hit);
    if (key === "buildStorageCard") return this._boundsOf(this._findBuildCard("storage")?.card);
    if (key === "buildHouseCard") return this._boundsOf(this._findBuildCard("house")?.card);
    if (key === "buildUnitStoreArea") return this._boundsOf(ui.buildTab?._cardsViewportHit);
    if (key === "eastContractHud") return ui.contractHud?.getTutorialTargetBounds?.("slot:E") ?? null;
    if (key === "contractForestButton") return ui.contractHud?.getTutorialTargetBounds?.("button:contract:FOREST") ?? null;
    if (key === "contractBuyButton") return ui.contractHud?.getTutorialTargetBounds?.("button:contractBuy:FOREST") ?? null;
    return null;
  }

  _findBuildCard(key) {
    const tab = this.scene.uiScene?.buildTab;
    return tab?._cardRefs?.find?.((ref) => ref?.def?.key === key) || null;
  }

  _boundsOf(obj) {
    const bounds = obj?.getBounds?.();
    if (!bounds) return null;
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  _showWorldPulse(x, y, width, height) {
    this.worldPulse?.destroy?.();
    const g = this.scene.add.graphics().setDepth(UIDEPTH + 18);
    g.fillStyle(0x02070d, 0.20);
    g.fillRoundedRect(x - 5, y - 5, width + 10, height + 10, 8);
    g.lineStyle(4, 0xfef08a, 0.9);
    g.strokeRoundedRect(x - 5, y - 5, width + 10, height + 10, 8);
    this.worldPulse = g;
    this.worldPulseTween = this.scene.tweens.add({
      targets: g,
      alpha: { from: 0.35, to: 1 },
      duration: 420,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        g.destroy();
        if (this.worldPulse === g) this.worldPulse = null;
      },
    });
  }
}
