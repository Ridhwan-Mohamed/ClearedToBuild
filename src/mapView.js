import Phaser, { Plugins } from 'phaser';
import worldMap from 'url:./assets/worldMap.png'
import black from 'url:./assets/black.png'
import gray from 'url:./assets/gray.png'
import green from 'url:./assets/green.png'
import leader from 'url:./assets/purple.png'
import hammer from 'url:./assets/hammer.png'
import waterParticle from 'url:./assets/waterParticle.png'
import zoomOutWaterTxt1 from 'url:./assets/zoomOutWaterTxt1.png'
import zoomOutWaterTxt2 from 'url:./assets/zoomOutWaterTxt2.png'
import { Map as GameMap } from './map.js';
import { Turret } from './buildings/Turret.js';
import { Catapult } from './buildings/Catapult.js';
import { UIDEPTH, SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, CONTROL_STATES, TILE_MAP, FLOORDEPTH, PARCEL, showAlert, colorFor } from './constants';
import {itemTab} from './itemTab.js';
import { Player } from './players/Player.js';
import { Farmer } from './players/Farmer.js';
import { Builder } from './players/Builder.js';
import { Forager } from './players/Forager.js';
import { Fireman } from './players/Fireman.js';
import { Brawler } from './players/Brawler.js';
import { Blademaster } from './players/Blademaster.js';
import { Gunslinger } from './players/Gunslinger.js';
import { Raider } from './players/Raider.js';
import { Projectile } from './Projectile.js';
import player from 'url:./assets/Players/player.png'
import gun1 from 'url:./assets/Players/gun1.png'
import playerAction from 'url:./assets/Players/playerAction.png'
import playerCarry from 'url:./assets/Players/playerCarry.png'
import { playerDict, setupTownBoundsToggle, townBounds, townRoads } from './town.js';
import { tillManager } from './Manager/tillManager.js'
import { Teams } from './Teams.js';
import { buildingManager } from './Manager/buildingManager.js';
import monies from 'url:./assets/monies.png'
import seeds from 'url:./assets/seeds.png'
import { fightManager } from './Manager/fightManager.js';
import { seedManager } from './Manager/seedManager.js';
import char from 'url:./assets/char.png'
import berry from 'url:./assets/berry.png'
import spawn from 'url:./assets/hole.png'
import { recalculateDestroyTasksFromPoint } from './Manager/spawnManager.js';
import { Clock } from './Controllers/Clock.js';
import clayOven from 'url:./assets/clayOven.png'
import { ClayOven } from './buildings/ClayOven.js';
import { DailyNeedsTracker } from './UI/DailyNeedsTracker.js';
import tillOverlay from 'url:./assets/tillOverlay.png'
import foodIcon from 'url:./assets/foodIcon.png'
import waterIcon from 'url:./assets/waterIcon.png'
import woodIcon from 'url:./assets/woodIcon.png'
import stoneIcon from 'url:./assets/stoneIcon.png'
import playerIcon from 'url:./assets/playerIcon.png'
import uncleanWaterIcon from 'url:./assets/uncleanWaterIcon.png'
import { ClayOvenUI } from './UI/ClayOvenUI.js';
import { StorageBuilding } from './buildings/Storage.js';
import { StorageUI } from './UI/StorageUI.js';
import { StorageManager } from './Manager/StorageManager.js';
import { House } from './buildings/House.js';
import { GameStart } from './Controllers/GameStart.js';
import { ZoomMixer } from './UI/ZoomMixer.js';
import { MainMenu } from './mainMenu.js';
import { blockResourceManager } from './Manager/BlockResourceManager.js';
import { HouseUI } from './UI/HouseUI.js';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import fullBasePine from 'url:./assets/trees/fullBasePine.png';
import fullMiddlePine from 'url:./assets/trees/fullMiddlePine.png';
import fullTopPine from 'url:./assets/trees/fullTopPine.png';
import mediumBasePine from 'url:./assets/trees/mediumBasePine.png';
import mediumMiddlePine from 'url:./assets/trees/mediumMiddlePine.png';
import mediumTopPine from 'url:./assets/trees/mediumTopPine.png';
import { PineTree } from './buildings/pineTree.js';
import { RockNode } from './buildings/RockNode.js';
import { VisibilitySystem } from './UI/VisibilitySystem.js';
import { loadCardData, POWERUP_CARDS } from './Cards/PowerupCards.js';
import { AudioManager } from './Manager/AudioManager.js';
import { WallPlacementController } from './Controllers/WallPlacementController.js';
import { WallDestroyController } from './Controllers/WallDestroyController.js';
import { TowerBuilding } from './buildings/Tower.js';
import { Bank } from './buildings/Bank.js';
import { Prison } from './buildings/Prison.js';
import { TowerPressureController } from './parcel_system/TowerPressureController.js';
import { StageState } from './parcelController/StageState.js';
import { loadShipMarketAssets } from './UI/ShipMarket.js';
import { openFortRewardSelection } from './parcel_system/FortRewardSystem.js';
import { clearNorthFort, spawnNorthFort } from './parcel_system/FortRaidParcel.js';
import { GameUIScene } from './UI/GameUIScene.js';
import { OverviewCloudLayer } from './UI/OverviewCloudLayer.js';
import { OverviewOceanWaves } from './UI/OverviewOceanWaves.js';
import { OverviewShoreWaves } from './UI/OverviewShoreWaves.js';
import { OrderRunner } from './orders/OrderRunner.js';
import { getStagePermitReward } from './permitSystem.js';
import { getBossUnlockReward, openBossUnlockRewardPresentation } from './parcel_system/BossUnlockRewardSystem.js';
import { createPlayerPortraitAnimations, preloadPlayerPortraits } from './players/playerPortraits.js';

const screenH = window.innerHeight
const screenW = window.innerWidth

export class mapView extends Phaser.Scene {
    constructor() {
        super('mapView');
        mapView.scene = this;
        GameMap.scene = this;
        Turret.scene = this;
        Catapult.scene = this;
        tillManager.scene = this;
        buildingManager.scene = this;
        blockResourceManager.scene = this;
        fightManager.scene = this;
        seedManager.scene = this;
        StorageManager.scene = this;
        ClayOven.scene = this;
        itemTab.mapRef = this;
        House.scene = this;
        ZoomMixer.scene = this;
        this.gridPlace = false;
        this.selectMode = true;
        this.brushTiles = []; // Array to store affected tiles
        this.isBrushMode = false; // Track if brush mode is active
        this.isBrushActive = false;
        this.farmMode = false;
        this.stoneWallMode = false;
        this.woodWallMode = false;
        // Farm plot selection state (laptop-friendly, 2-click)
        this._prevFarmMode = false;
        this.farmConsumeNextClick = false; // eat the UI click that toggled farm mode
        this.farmSelectActive = false;     // true while choosing plot corners
        this.farmSelectPhase = 0;          // 0=inactive, 1=pick start, 2=pick end
        this.farmHover = null;             // phase-1 hover outline graphic
        this.farmBanner = null;            // top-center instruction banner (container)
        this.farmBannerParts = null;       // { left, esc, middle, seedCount, seedIcon, right }
        this.farmInstructionText = null;   // top-center instruction banner
        this.harvestMode = false;
        this.money = 1300; // Starting amount
        this.seeds = 10;
        this.foodAmnt = 15;
        this.cleanWaterAmnt = 15;
        this.woodAmnt = 4;
        this.stoneAmnt = 4;
        this.berries = 0;
        this.permits = 0;
        this.berryMode = false;
        this.seedGridMode = false;
        this.selectingEnemies = false;
        this.enemySelectStart = null;
        this.enemySelectionRect = null;
        this.tillPreviewSprites = new Map(); // key = "x,y" → sprite
        this.farmSelectionPreviewSprites = new Map();
        this.tillPulseTween = null;
        this.guardPlacement = { active: false, troop: null };
        this._trackpadDoubleClickWindowMs = 520;
        this._trackpadDoubleClickRadiusPx = 44;
        this._lastPrimaryPointerDownAt = -Infinity;
        this._lastPrimaryPointerDownX = 0;
        this._lastPrimaryPointerDownY = 0;
        this._lastPrimaryPointerUpAt = -Infinity;
        this._lastPrimaryPointerUpX = 0;
        this._lastPrimaryPointerUpY = 0;
        this._trackpadTapDragActive = false;
        this._trackpadTapDragMoved = false;
        this._trackpadTapDragIdleMs = 220;
        this._trackpadTapDragTimer = null;
        this._trackpadSelectStartWorld = null;
        this._trackpadSelectEndWorld = null;
        this._selectionDragZone = null;
        this._selectionDragDistanceThreshold = 6;
        this._selectionDragPending = false;
        this._selectionDragActive = false;
        this._selectionDragPointerId = null;
        this._selectionDragStartScreenX = 0;
        this._selectionDragStartScreenY = 0;
        this._debugCurrentText = null;
        this._debugSelectionCountText = null;
        this.selectedSimSpeed = 1;
        this.simNowMs = 0;
        this._simulationSpeedReady = false;
        this._simulationPauseReasons = new Set();
        this._appliedSimulationSpeed = 0;
        this._appliedEngineSimSpeed = 1;
        this._northFortMainIslandOrigin = null;
        this._northFortArrival = {
            pending: false,
            delayDays: 0,
            createdOnDay: 1,
            arrivalDay: 1,
            reason: null,
            seasonIndex: 1,
            stageIndex: 1,
        };
        this._northFortArrivalMarker = null;
        this._activeFort = null;
        this._activeNightHorde = null;
        this._hordeRewardInProgress = false;
        this._townTowerLossInProgress = false;
        this._gameOverOverlay = null;
        this._townTowerStats = { built: 0, destroyed: 0 };
    }

    setSimulationSpeed(multiplier) {
        const allowed = new Set([1, 2, 4]);
        const next = Number(multiplier);
        const normalized = allowed.has(next) ? next : 1;
        if (this.selectedSimSpeed === normalized) {
            return this.applySimulationSpeed();
        }

        this.selectedSimSpeed = normalized;
        this.events.emit("sim-speed:changed", normalized);
        return this.applySimulationSpeed();
    }

    getSimulationSpeed() {
        return this.selectedSimSpeed || 1;
    }

    getSimulationNow() {
        return Number(this.simNowMs || 0);
    }

    getAppliedSimulationSpeed() {
        return Number(this._appliedSimulationSpeed ?? this.getEffectiveSimulationSpeed());
    }

    isSimulationPaused() {
        return !!(this.clock?.paused || this._simulationPauseReasons?.size);
    }

    getEffectiveSimulationSpeed() {
        if (!this._simulationSpeedReady) return 0;
        return this.isSimulationPaused() ? 0 : this.getSimulationSpeed();
    }

    setSimulationPause(reason, paused = true) {
        const key = String(reason || "external");
        if (paused) this._simulationPauseReasons.add(key);
        else this._simulationPauseReasons.delete(key);
        return this.applySimulationSpeed();
    }

    setSimulationSpeedReady(ready = true) {
        this._simulationSpeedReady = !!ready;
        return this.applySimulationSpeed(true);
    }

    applySimulationSpeed(force = false) {
        const selected = this.getSimulationSpeed();
        const effective = this.getEffectiveSimulationSpeed();
        const engineSpeed = this._simulationSpeedReady ? effective : 1;

        if (!force && this._appliedSimulationSpeed === effective && this._appliedEngineSimSpeed === engineSpeed) {
            return effective;
        }

        if (this.time) {
            this.time.timeScale = engineSpeed;
        }
        if (this.tweens) {
            this.tweens.timeScale = engineSpeed;
        }

        const physicsWorld = this.physics?.world;
        if (physicsWorld) {
            if (engineSpeed > 0) {
                physicsWorld.resume?.();
                physicsWorld.timeScale = 1 / engineSpeed;
            } else {
                physicsWorld.timeScale = 1;
                physicsWorld.pause?.();
            }
        }

        if (this.anims) {
            this.anims.globalTimeScale = engineSpeed > 0 ? engineSpeed : 0;
        }

        this._appliedEngineSimSpeed = engineSpeed;
        this._appliedSimulationSpeed = effective;
        this.events.emit("sim-speed:applied", { selected, effective, engineSpeed });
        return effective;
    }

    _refreshOverviewFromGrid() {
        this.zoomMixer?.buildOverviewTextureFromGrid?.(GameMap.grid, SQUARESIZE, (cell) => colorFor(cell));
        GameMap._uiIgnoreWorldLayer?.();
    }

    getCurrentHordeIndex() {
        return Math.max(1, Number(StageState.stageIndex || 1));
    }

    _getMainIslandBounds() {
        const origin = this.parcelManager?.mainIslandOrigin ?? PARCEL.MAIN_ORIGIN;
        const minx = Number(origin?.x ?? PARCEL.MAIN_ORIGIN.x);
        const miny = Number(origin?.y ?? PARCEL.MAIN_ORIGIN.y);
        return {
            minx,
            miny,
            maxx: minx + PARCEL.SIZE - 1,
            maxy: miny + PARCEL.SIZE - 1,
        };
    }

    _getMainIslandCenterWorld() {
        const bounds = this._getMainIslandBounds();
        return {
            x: ((bounds.minx + bounds.maxx + 1) * 0.5) * SQUARESIZE,
            y: ((bounds.miny + bounds.maxy + 1) * 0.5) * SQUARESIZE,
        };
    }

    _getNightHordePlan(hordeIndex = this.getCurrentHordeIndex()) {
        const laneCount = Math.min(3, 1 + Math.floor(Math.max(0, hordeIndex - 1) / 2));
        const baseDifficulty = Math.min(3, 1 + Math.floor(Math.max(0, hordeIndex - 1) / 3));
        const slotIds = Phaser.Utils.Array.Shuffle(["W", "E", "S"].slice()).slice(0, laneCount);
        return { hordeIndex, laneCount, baseDifficulty, slotIds };
    }

    handleNightStart() {
        if (!StageState.endlessMode || this._hordeRewardInProgress) return;
        if (this._activeNightHorde?.startedOnDay === this.clock?.day) return;
        this.startNightlyHorde();
    }

    handleDayStart() {
        if (!StageState.endlessMode || this._hordeRewardInProgress) return;
        this.grantTownTowerDawnIncome();
        this.finishNightlyHordeAtDawn();
    }

    grantTownTowerDawnIncome() {
        const payout = TowerBuilding.grantDawnIncome(this, 1);
        if (!payout) return null;

        showAlert(
            this,
            `Town Towers: +$${payout.money} and +${payout.permits} permit${payout.permits === 1 ? "" : "s"}`,
            "#a7f3d0"
        );
        return payout;
    }

    handleTownCoreLost(tower) {
        if (this._townTowerLossInProgress) return;
        this._townTowerLossInProgress = true;
        this._movementLocked = true;
        this.stageCompleteLock = true;
        if (this.clock) this.clock.paused = true;
        this.applySimulationSpeed(true);

        AudioManager.playSound?.('sfx_end_stage_explosions');
        this.cameras.main.shake(900, 0.012);
        this._playTownTowerCollapseSequence(tower, () => {
            this._showGameOverOverlay();
        });
    }

    _playTownTowerCollapseSequence(tower, onDone) {
        const sprite = tower?.sprite;
        if (!sprite?.active) {
            onDone?.();
            return;
        }

        const spots = [];
        for (let i = 0; i < 5; i++) {
            spots.push({
                x: sprite.x + Phaser.Math.Between(-28, 28),
                y: sprite.y + Phaser.Math.Between(-28, 28),
                delay: i * 90,
            });
        }

        let finished = 0;
        const total = spots.length;
        spots.forEach((spot) => {
            this.time.delayedCall(spot.delay, () => {
                const fx = this.add.sprite(spot.x, spot.y, 'explosions')
                    .setDepth(10050)
                    .setScrollFactor(1);
                fx.play('explosions');
                fx.once('animationcomplete', () => {
                    fx.destroy();
                    finished += 1;
                    if (finished >= total) onDone?.();
                });
            });
        });
    }

    _getRunSummaryLines() {
        const team = Teams.teamLists?.["1"] || {};
        const hordesCleared = Math.max(0, this.getCurrentHordeIndex() - 1);
        const dayReached = Math.max(1, Number(this.clock?.day || 1));
        const livingPlayers = (team.playerList || []).filter((player) => player?.active).length;
        const cardsHeld = (team.cardHand || []).length;
        const stats = this._townTowerStats || { built: 0, destroyed: 0 };

        return [
            `Hordes Survived: ${hordesCleared}`,
            `Day Reached: ${dayReached}`,
            `Town Towers Built: ${stats.built}`,
            `Town Towers Lost: ${stats.destroyed}`,
            `Crew Alive: ${livingPlayers}`,
            `Cards Held: ${cardsHeld}`,
            `Money Banked: $${Math.max(0, Math.floor(this.money || 0))}`,
        ];
    }

    _showGameOverOverlay() {
        if (this._gameOverOverlay?.active) return;

        const cam = this.cameras.main;
        const overlay = this.add.container(0, 0).setDepth(20000).setScrollFactor(0);
        const shade = this.add.rectangle(0, 0, cam.width, cam.height, 0x030712, 0.78)
            .setOrigin(0)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        const panel = this.add.rectangle(cam.centerX, cam.centerY, Math.min(620, cam.width - 100), 320, 0x0f172a, 0.94)
            .setStrokeStyle(3, 0xf87171, 0.4)
            .setScrollFactor(0);
        const title = this.add.text(cam.centerX, cam.centerY - 118, "Town Lost", {
            fontFamily: "Bungee",
            fontSize: "34px",
            color: "#fff5f5",
            stroke: "#300808",
            strokeThickness: 6,
        }).setOrigin(0.5).setScrollFactor(0);
        const subtitle = this.add.text(cam.centerX, cam.centerY - 82, "Your last Town Tower collapsed.", {
            fontFamily: "Bungee",
            fontSize: "13px",
            color: "#fecaca",
            align: "center",
        }).setOrigin(0.5).setScrollFactor(0);
        const summary = this.add.text(cam.centerX, cam.centerY - 16, this._getRunSummaryLines().join("\n"), {
            fontFamily: "Bungee",
            fontSize: "14px",
            color: "#e5eef6",
            align: "center",
            lineSpacing: 8,
        }).setOrigin(0.5).setScrollFactor(0);

        const buttonBg = this.add.rectangle(cam.centerX, cam.centerY + 112, 230, 50, 0x4ade80, 0.98)
            .setStrokeStyle(2, 0xffffff, 0.22)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        const buttonText = this.add.text(cam.centerX, cam.centerY + 112, "Back To Main Menu", {
            fontFamily: "Bungee",
            fontSize: "16px",
            color: "#0f172a",
            stroke: "#ffffff",
            strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0);

        const reload = () => window.location.reload();
        buttonBg.on("pointerover", () => buttonBg.setFillStyle(0x86efac, 1));
        buttonBg.on("pointerout", () => buttonBg.setFillStyle(0x4ade80, 0.98));
        buttonBg.on("pointerdown", reload);
        buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", reload);

        overlay.add([shade, panel, title, subtitle, summary, buttonBg, buttonText]);
        overlay.setAlpha(0);
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 260,
            ease: "Quad.easeOut",
        });
        this._gameOverOverlay = overlay;
    }

    startNightlyHorde() {
        if (!this.parcelManager || this._hordeRewardInProgress) return;

        const plan = this._getNightHordePlan();
        this.parcelManager.forceClearContracts?.("nightfall_cleanup");

        const contractIds = [];
        const laneDetails = [];

        plan.slotIds.forEach((slotId, idx) => {
            const difficulty = Math.min(3, plan.baseDifficulty + ((idx === plan.slotIds.length - 1 && plan.hordeIndex >= 4) ? 1 : 0));
            const contractId = this.parcelManager.startPressure(slotId, difficulty, { source: "night_horde" });
            if (!contractId) return;
            contractIds.push(contractId);
            laneDetails.push({ slotId, difficulty });
        });

        if (!contractIds.length) return;

        this._activeNightHorde = {
            hordeIndex: plan.hordeIndex,
            startedOnDay: Math.max(1, Number(this.clock?.day || 1)),
            contractIds,
            laneDetails,
        };

        showAlert(
            this,
            `Horde ${plan.hordeIndex} incoming: ${laneDetails.length} lane${laneDetails.length === 1 ? "" : "s"}`,
            "#fecaca"
        );
    }

    finishNightlyHordeAtDawn() {
        const active = this._activeNightHorde;
        if (!active) return;

        this.parcelManager?.forceClearContracts?.("night_horde_end", { source: "night_horde" });
        this._activeNightHorde = null;
        this.startHordeRewardSequence(active.hordeIndex);
    }

    startHordeRewardSequence(hordeIndex) {
        if (this._hordeRewardInProgress) return;
        this._hordeRewardInProgress = true;

        const cam = this.cameras.main;
        const center = this._getMainIslandCenterWorld();
        const bounds = this._getMainIslandBounds();

        this.zoomMixer?.setZoomOutLocked?.(true);
        this._movementLocked = true;

        if (this.zoomMixer) {
            this.zoomMixer.targetZoom = 1;
            this.zoomMixer.smoothCenterZoomTo(1, 220);
        }

        const openRewards = () => {
            this.clock.paused = true;
            this.applySimulationSpeed(true);
            this._activeRewardUI?.destroy?.();
            this._activeRewardUI = openFortRewardSelection(this, {
                stageIndex: hordeIndex,
                meta: { bounds },
                onComplete: () => {
                    this._activeRewardUI = null;
                    StageState.advanceHorde({ reason: "night_horde_survived", hordeIndex });
                    this._movementLocked = false;
                    this.clock.paused = false;
                    this.applySimulationSpeed(true);
                    this.zoomMixer?.setZoomOutLocked?.(false);
                    this._hordeRewardInProgress = false;
                    this._stageHud?.recompute?.();
                    this.events.emit("stage:changed");
                    showAlert(this, `Horde ${hordeIndex} survived`, "#a7f3d0");
                }
            });
        };

        this.tweens.add({
            targets: cam,
            scrollX: center.x - cam.width / 2,
            scrollY: center.y - cam.height / 2,
            duration: 260,
            ease: "Quad.easeInOut",
            onComplete: openRewards,
        });
    }

    getNorthFortArrivalInfo() {
        const state = this._northFortArrival;
        if (!state?.pending) return null;

        const currentDay = Math.max(1, Number(this.clock?.day ?? state.createdOnDay ?? 1));
        const arrivalDay = Math.max(currentDay, Number(state.arrivalDay ?? currentDay));
        const daysRemaining = Math.max(0, arrivalDay - currentDay);
        const seasonIndex = Math.max(1, Number(state.seasonIndex ?? StageState.seasonIndex ?? 1));
        const stageIndex = Math.max(1, Number(state.stageIndex ?? StageState.stageIndex ?? 1));

        return {
            pending: true,
            delayDays: Math.max(0, Number(state.delayDays ?? 0)),
            createdOnDay: Math.max(1, Number(state.createdOnDay ?? currentDay)),
            arrivalDay,
            daysRemaining,
            reason: state.reason ?? "scheduled",
            seasonIndex,
            stageIndex,
            timerText: `DAY ${arrivalDay}`,
            statusText: daysRemaining === 0
                ? "Arrives today"
                : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`,
            metaText: `Season ${seasonIndex}  Stage ${stageIndex}`,
        };
    }

    _getNorthFortArrivalAnchor() {
        const baseOrigin = this._northFortMainIslandOrigin
            ?? this.parcelManager?.mainIslandOrigin
            ?? PARCEL.MAIN_ORIGIN;
        const fortOrigin = {
            x: Number(baseOrigin?.x ?? PARCEL.MAIN_ORIGIN.x),
            y: Number(baseOrigin?.y ?? PARCEL.MAIN_ORIGIN.y) - PARCEL.SIZE,
        };

        return {
            x: (fortOrigin.x + PARCEL.SIZE * 0.5) * SQUARESIZE,
            y: (fortOrigin.y + PARCEL.SIZE * 0.5) * SQUARESIZE,
        };
    }

    _ensureNorthFortArrivalMarker() {
        if (this._northFortArrivalMarker?.root?.active) return this._northFortArrivalMarker;

        const root = this.add.container(0, 0).setDepth(UIDEPTH - 0.35);
        const plate = this.add.graphics();
        const badge = this.add.circle(0, -132, 34, 0x4c1d95, 0.96)
            .setStrokeStyle(3, 0xfbbf24, 0.88);
        const tower = this.add.text(0, -59, "♜", {
            fontFamily: "Bungee",
            fontSize: "28px",
            color: "#fff5cf",
            stroke: "#190b2f",
            strokeThickness: 4,
        }).setOrigin(0.5);
        const crown = this.add.text(16, -74, "♛", {
            fontFamily: "Bungee",
            fontSize: "16px",
            color: "#fbbf24",
            stroke: "#190b2f",
            strokeThickness: 3,
        }).setOrigin(0.5);
        const title = this.add.text(0, -18, "NORTH FORT", {
            fontFamily: "Bungee",
            fontSize: "14px",
            color: "#f6ecff",
            stroke: "#14071f",
            strokeThickness: 4,
            align: "center",
        }).setOrigin(0.5);
        const timer = this.add.text(0, 5, "DAY 1", {
            fontFamily: "Bungee",
            fontSize: "18px",
            color: "#fff5cf",
            stroke: "#14071f",
            strokeThickness: 4,
            align: "center",
        }).setOrigin(0.5);
        const meta = this.add.text(0, 24, "", {
            fontFamily: "Bungee",
            fontSize: "11px",
            color: "#ead9ff",
            stroke: "#14071f",
            strokeThickness: 3,
            align: "center",
        }).setOrigin(0.5, 0);

        tower.setPosition(0, -133);
        tower.setFontSize("42px");
        tower.setText("♜");
        crown.setPosition(24, -154);
        crown.setFontSize("20px");
        crown.setText("♛");
        title.setPosition(0, -84);
        tower.setText("\u265C");
        crown.setText("\u265B");
        title.setFontSize("30px");
        title.setStroke("#14071f", 6);
        title.setText("NORTH FORT INCOMING");
        timer.setPosition(0, -4);
        timer.setFontSize("76px");
        timer.setStroke("#14071f", 8);
        meta.setPosition(0, 128);
        meta.setFontSize("16px");
        meta.setAlign("center");
        meta.setLineSpacing(8);
        meta.setWordWrapWidth(PARCEL.SIZE * SQUARESIZE - 72);

        const detailStatus = this.add.text(0, 74, "3 DAYS LEFT", {
            fontFamily: "Bungee",
            fontSize: "28px",
            color: "#f5d0fe",
            stroke: "#14071f",
            strokeThickness: 6,
            align: "center",
        }).setOrigin(0.5);
        const overviewPrimary = this.add.text(0, -34, "DAY 1", {
            fontFamily: "Bungee",
            fontSize: "96px",
            color: "#fff5cf",
            stroke: "#14071f",
            strokeThickness: 12,
            align: "center",
        }).setOrigin(0.5);
        const overviewSecondary = this.add.text(0, 102, "NORTH FORT\n3 DAYS LEFT", {
            fontFamily: "Bungee",
            fontSize: "32px",
            color: "#f5d0fe",
            stroke: "#14071f",
            strokeThickness: 8,
            align: "center",
            lineSpacing: 10,
            wordWrap: { width: PARCEL.SIZE * SQUARESIZE - 72 },
        }).setOrigin(0.5);

        root.add([plate, badge, tower, crown, title, timer, detailStatus, meta, overviewPrimary, overviewSecondary]);
        root.setAlpha(0);
        root.setScale(0.9);

        const pulse = this.tweens.add({
            targets: [badge, tower, timer, overviewPrimary],
            alpha: { from: 1, to: 0.82 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
        const appear = this.tweens.add({
            targets: root,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 220,
            ease: "Back.easeOut",
        });

        this._northFortArrivalMarker = {
            root,
            plate,
            badge,
            tower,
            crown,
            title,
            timer,
            detailStatus,
            meta,
            overviewPrimary,
            overviewSecondary,
            pulse,
            appear,
        };
        return this._northFortArrivalMarker;
    }

    _destroyNorthFortArrivalMarker() {
        const marker = this._northFortArrivalMarker;
        if (!marker) return;

        marker.appear?.remove?.();
        marker.pulse?.remove?.();
        marker.root?.destroy?.(true);
        this._northFortArrivalMarker = null;
    }

    _refreshNorthFortArrivalMarker() {
        const info = this.getNorthFortArrivalInfo();
        if (!info) {
            this._destroyNorthFortArrivalMarker();
            return;
        }

        const marker = this._ensureNorthFortArrivalMarker();
        const anchor = this._getNorthFortArrivalAnchor();
        const isOverview = this.zoomMixer?.mode === "overview";
        const panelW = PARCEL.SIZE * SQUARESIZE - 24;
        const panelH = PARCEL.SIZE * SQUARESIZE - 24;

        marker.plate.clear();
        marker.plate.fillStyle(0x2b0f42, isOverview ? 0.46 : 0.28);
        marker.plate.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);
        marker.plate.lineStyle(isOverview ? 6 : 5, 0xf0abfc, isOverview ? 0.86 : 0.74);
        marker.plate.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);
        marker.plate.lineStyle(2, 0xfbbf24, isOverview ? 0.36 : 0.26);
        marker.plate.strokeRoundedRect(-(panelW / 2) + 16, -(panelH / 2) + 16, panelW - 32, panelH - 32, 20);

        marker.root.setPosition(anchor.x, anchor.y);
        marker.root.setScale(1);
        marker.root.setAlpha(1);
        marker.badge.setVisible(!isOverview);
        marker.tower.setVisible(!isOverview);
        marker.crown.setVisible(!isOverview);
        marker.title.setVisible(!isOverview);
        marker.timer.setText(info.timerText);
        marker.timer.setVisible(!isOverview);
        marker.detailStatus.setVisible(!isOverview);
        marker.meta.setVisible(!isOverview);
        marker.overviewPrimary.setVisible(isOverview);
        marker.overviewSecondary.setVisible(isOverview);
        marker.title.setText("NORTH FORT INCOMING");
        marker.detailStatus.setText(String(info.statusText || "").toUpperCase());
        marker.meta.setText(`${info.metaText}\nCROWN FORT GATHERING IN THE NORTH`);
        marker.overviewPrimary.setText(info.timerText);
        marker.overviewSecondary.setText(`NORTH FORT\n${String(info.statusText || "").toUpperCase()}`);
    }

    _resetNorthFortArrivalState() {
        this._northFortArrival = {
            pending: false,
            delayDays: 0,
            createdOnDay: Math.max(1, Number(this.clock?.day ?? 1)),
            arrivalDay: Math.max(1, Number(this.clock?.day ?? 1)),
            reason: null,
            seasonIndex: Math.max(1, Number(StageState.seasonIndex || 1)),
            stageIndex: Math.max(1, Number(StageState.stageIndex || 1)),
        };
    }

    _spawnPendingNorthFort(reason = "scheduled") {
        const pendingInfo = this.getNorthFortArrivalInfo();
        const mainIslandOrigin = this._northFortMainIslandOrigin
            ?? this.parcelManager?.mainIslandOrigin
            ?? PARCEL.MAIN_ORIGIN;

        this._resetNorthFortArrivalState();
        this._destroyNorthFortArrivalMarker();

        this._activeFort = spawnNorthFort({
            scene: this,
            map: GameMap,
            mainIslandOrigin,
        });
        this._refreshOverviewFromGrid();
        this.events.emit("north-fort:arrival-changed", null);

        if (pendingInfo && pendingInfo.delayDays > 0) {
            showAlert(this, "North Fort sighted in the north", "#d8b4fe");
        }

        return this._activeFort;
    }

    scheduleNorthFortArrival({
        delayDays = 0,
        reason = "scheduled",
        mainIslandOrigin = null,
        oldMeta = null,
    } = {}) {
        const normalizedDelay = Math.max(0, Math.floor(Number(delayDays) || 0));
        if (mainIslandOrigin && Number.isFinite(mainIslandOrigin.x) && Number.isFinite(mainIslandOrigin.y)) {
            this._northFortMainIslandOrigin = { x: mainIslandOrigin.x, y: mainIslandOrigin.y };
        } else if (!this._northFortMainIslandOrigin) {
            this._northFortMainIslandOrigin = { ...PARCEL.MAIN_ORIGIN };
        }

        if (oldMeta?.bounds) {
            clearNorthFort({ scene: this, map: GameMap, meta: oldMeta });
            this._refreshOverviewFromGrid();
        }

        this._activeFort = null;
        this._resetNorthFortArrivalState();

        if (normalizedDelay <= 0) {
            return this._spawnPendingNorthFort(reason);
        }

        const currentDay = Math.max(1, Number(this.clock?.day ?? 1));
        this._northFortArrival = {
            pending: true,
            delayDays: normalizedDelay,
            createdOnDay: currentDay,
            arrivalDay: currentDay + normalizedDelay,
            reason,
            seasonIndex: Math.max(1, Number(StageState.seasonIndex || 1)),
            stageIndex: Math.max(1, Number(StageState.stageIndex || 1)),
        };

        this._refreshNorthFortArrivalMarker();
        this.events.emit("north-fort:arrival-changed", this.getNorthFortArrivalInfo());
        return null;
    }

    _updateNorthFortArrival() {
        const info = this.getNorthFortArrivalInfo();
        if (info && Number(this.clock?.day || 0) >= info.arrivalDay) {
            this._spawnPendingNorthFort(info.reason);
            return;
        }

        this._refreshNorthFortArrivalMarker();
    }

    preload() {
        this.load.spritesheet('player', player, { frameWidth: 16, frameHeight: 16});
        this.load.spritesheet('gun1', gun1, { frameWidth: 16, frameHeight: 16});
        this.load.spritesheet('playerAction', playerAction, { frameWidth: 16, frameHeight: 16});
        this.load.spritesheet('playerCarry', playerCarry, { frameWidth: 16, frameHeight: 16});
        this.load.image('barrier', gray);  // Load a barrier image
        this.load.image('worldMap', worldMap);
        this.load.image('cube', black);  // Make sure the path and filename are correct
        this.load.image('selected', green)
        this.load.image('leader', leader)
        this.load.image('hammer', hammer);
        this.load.image('monies', monies);
        this.load.image('seeds', seeds);
        this.load.image('berry', berry);
        this.load.image('spawn', spawn);
        this.load.image('foodIcon', foodIcon);
        this.load.image('waterIcon', waterIcon);
        this.load.image('woodIcon', woodIcon);
        this.load.image('stoneIcon', stoneIcon);
        this.load.image('playerIcon', playerIcon);
        this.load.image('uncleanWaterIcon', uncleanWaterIcon);
        this.load.image('sparkle', waterParticle);
        this.load.image('zoomOutWaterTxt1', zoomOutWaterTxt1);
        this.load.image('zoomOutWaterTxt2', zoomOutWaterTxt2);
        this.load.image('tillOverlay', tillOverlay);
        this.load.spritesheet('char', char, {frameWidth: 60, frameHeight: 50});
        this.load.spritesheet('clayOven', clayOven, { frameWidth: 64, frameHeight: 64});
        this.load.image('fullBasePine', fullBasePine);
        this.load.image('fullMiddlePine', fullMiddlePine);
        this.load.image('fullTopPine', fullTopPine);
        this.load.image('mediumBasePine', mediumBasePine);
        this.load.image('mediumMiddlePine', mediumMiddlePine);
        this.load.image('mediumTopPine', mediumTopPine);
        Farmer.preload(this);
        Builder.preload(this);
        Forager.preload(this);
        Fireman.preload(this);
        Brawler.preload(this);
        Blademaster.preload(this);
        Gunslinger.preload(this);
        Raider.preload(this);
        preloadPlayerPortraits(this);
        this.brushGraphics = this.add.graphics(); // Graphics for tinting tiles
        itemTab.preload(this);
        Projectile.init(this);
        AudioManager.init(this);
        DailyNeedsTracker.init(this);
        ClayOvenUI.init(this); // once in your main scene's create()
        StorageBuilding.scene = this;
        StorageUI.init(this);
        HouseUI.init(this);
        MainMenu.attach(this);
        PineTree.init(this);
        RockNode.init(this);
        TowerBuilding.scene = this;
        Bank.scene = this;
        Prison.scene = this;
        WallPlacementController.preload(this);
        loadCardData(this);
        loadShipMarketAssets(this);
    }

    _enableGlobalTextFont() {
        if (this._globalTextFontPatched || !this.add?.text) return;
        const originalAddText = this.add.text.bind(this.add);
        this.add.text = (x, y, text, style = {}) => {
            const nextStyle = (style && typeof style === "object") ? { ...style } : {};
            if (!nextStyle.fontFamily) nextStyle.fontFamily = "Bungee";
            return originalAddText(x, y, text, nextStyle);
        };
        this._globalTextFontPatched = true;
    }

    _ensureOceanTextures() {
        if (!this.textures.exists("ocean_gradient")) {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillGradientStyle(0x1a5d7e, 0x1a5d7e, 0x2f93bc, 0x2f93bc, 1, 1, 1, 1);
            g.fillRect(0, 0, 4, 256);
            g.generateTexture("ocean_gradient", 4, 256);
            g.destroy();
        }

    }

    _createOceanBackdrop() {
        this._ensureOceanTextures();
        const w = this.scale.width;
        const h = this.scale.height;

        this.oceanBackdropBase = this.add.rectangle(0, 0, w, h, 0x1e6f93, 1)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(-10000);

        this.oceanBackdropGradient = this.add.image(0, 0, "ocean_gradient")
            .setOrigin(0)
            .setDisplaySize(w, h)
            .setAlpha(0.34)
            .setScrollFactor(0)
            .setDepth(-9999);

        this.overviewOceanWaves?.destroy?.();
        this.overviewOceanWaves = new OverviewOceanWaves(this, {
            depth: UIDEPTH - 2.6
        });

        this.overviewCloudLayer?.destroy?.();
        this.overviewCloudLayer = new OverviewCloudLayer(this, {
            depth: UIDEPTH - 0.4,
            cloudCount: 10,
            cellSizePx: 6,
            cellWorldSize: SQUARESIZE
        });
        this.overviewShoreWaves?.destroy?.();
        this.overviewShoreWaves = new OverviewShoreWaves(this, {
            depth: UIDEPTH - 1.15,
            maxOffsetPx: 14,
            pulseCyclesPerSec: 0.50,
            rebuildIntervalMs: 900,
            getGrid: () => this.gridData || GameMap.grid
        });

        this._setOceanBackdropMode(this.zoomMixer?.mode || "detailed");

        this.scale.on("resize", ({ width, height }) => {
            this.oceanBackdropBase?.setSize(width, height);
            this.oceanBackdropGradient?.setDisplaySize(width, height);
            this.overviewOceanWaves?.resize?.();
        });
    }

    _setOceanBackdropMode(mode = "detailed") {
        const isOverview = mode === "overview";
        if (this._oceanMode === mode) return;
        this._oceanMode = mode;

        this.oceanBackdropGradient?.setAlpha(isOverview ? 0.44 : 0.30);
        this.overviewOceanWaves?.setMode?.(mode);
        this.overviewCloudLayer?.setMode?.(mode);
    }

    _updateOceanBackdrop() {
        this._setOceanBackdropMode(this.zoomMixer?.mode || "detailed");
        this.overviewOceanWaves?.update?.(this.zoomMixer?.mode || "detailed", this.time?.now || 0);
        this.overviewCloudLayer?.update?.(this.zoomMixer?.mode || "detailed");
        this.overviewShoreWaves?.update?.(this.zoomMixer?.mode || "detailed", this.time?.now || 0);
    }

    create() {
        this._enableGlobalTextFont();
        this._createOceanBackdrop();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            Turret.cancelPlacement();
            Catapult.cancelPlacement();
            this.overviewOceanWaves?.destroy?.();
            this.overviewOceanWaves = null;
            this.overviewCloudLayer?.destroy?.();
            this.overviewCloudLayer = null;
            this.overviewShoreWaves?.destroy?.();
            this.overviewShoreWaves = null;
            if (this.time) this.time.timeScale = 1;
            if (this.tweens) this.tweens.timeScale = 1;
            if (this.physics?.world) {
                this.physics.world.resume?.();
                this.physics.world.timeScale = 1;
            }
            if (this.anims) this.anims.globalTimeScale = 1;
            this._destroyNorthFortArrivalMarker();
        });
        this.createAnim('water')
        this.createAnim('crops',0,1)
        this.createAnim('char', -1, 5, 3)
        createPlayerPortraitAnimations(this);
        if (!this.anims.exists('rock_projectile_spin')) {
            this.anims.create({
                key: 'rock_projectile_spin',
                frames: this.anims.generateFrameNumbers('rock_projectile', { start: 0, end: 2 }),
                frameRate: 10,
                repeat: -1
            });
        }
        ZoomMixer.initMapIconContainer();
        this.wallDestroyer = new WallDestroyController(this);

        Player.init(this);
        Player.createAnim('oven_idle', 'clayOven', 0, 0, -1, 1);
        Player.createAnim('oven_cooking', 'clayOven', 1, 2, -1, 3);
        if (!this.scene.isActive('GameUIScene')) {
            this.scene.launch('GameUIScene', { worldSceneKey: 'mapView' });
        }
        this.uiScene = this.scene.get('GameUIScene');
        this.uiScene?.bindWorldScene?.(this);
        this.cameras.main.useBounds = false;

        MainMenu.startMenuPhase();
        setupTownBoundsToggle(this);
        this.cursors = this.input.keyboard.createCursorKeys();
        // Add collision between the cube and the barriers
        // this.physics.add.collider(characters, GameMap.barrier);
        // this.physics.add.overlap(Player.characters, Player.characters, Player.handlePlayerCollision, null, this);
        this.physics.add.collider(
            Player.characters,
            Projectile.projectileGroup,
            Projectile.handleCollision,
            (player, bullet) => !bullet?.deferImpactUntilEnd && bullet.team !== player.body.team, // Only collide if teams are different
            this
        );

        GameMap.structureBarrier = this.physics.add.staticGroup(); // structures (walls/buildings) persistent
        this.physics.add.collider(
            Projectile.projectileGroup,
            GameMap.structureBarrier,
            Projectile.handleStructureCollision,
            (projectile) => !projectile?.deferImpactUntilEnd,
            this
        );

        this.cursors = this.input.keyboard.createCursorKeys();
        this.towerPressureController = new TowerPressureController(this, { /* your opts */ });
        // explosion spritesheet (single row, 5 frames)
        this.createAnim('explosions', 0, 10, 4);

        // stage completion lock
        this.stageCompleteLock = false;
        this._movementLocked = false;

        this.registry.set('image','init');
        this.registry.events.on('changedata-image', (parent, value) => {
            console.log(`Registry key 'image' updated to value:`, value);
            const item = TILE_TYPES[value];
            Turret.cancelPlacement();
            if(item.spread){
                // this.gridPlace = true;
            }
            else if(item == TILE_TYPES.turret){
                Turret.beginPlacing(item, 1)
            }
            else if(item == TILE_TYPES.clayOven){
                ClayOven.beginPlacing(this, 1)
            }
            else{
                GameMap.beginPlacing(item)
            }
        });

        // Store references to keys
        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
            arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
            arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
            arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.selectMode = true
            if (Turret.isPlacing) {
                Turret.cancelPlacement();
                return;
            }
            // Farm mode: ESC cycles (end->start) then (start->exit farm mode)
            if (!this.farmMode && !this.farmSelectActive) return;

            // If selecting: step back through phases
            if (this.farmSelectActive) {
                if (this.farmSelectPhase === 2) {
                    // back to phase 1
                    this.farmSelectPhase = 1;
                    this.startCell = null;
                    this.endCell = null;
                    this.graphics.clear();
                    if (this.farmHover) this.farmHover.setVisible(false);
                    this.setFarmInstructionPhase1();
                    return;
                }
                if (this.farmSelectPhase === 1) {
                    // exit farm mode entirely
                    this.cancelFarmSelection(true);
                    return;
                }
            }

            // if farmMode is on but selection not active, still exit
            this.cancelFarmSelection(true);
            if(this.gridPlace){
                this.gridPlace = false
            }
            else if(Turret.isPlacing){
                Turret.cancelPlacement();
            }
            else{
                GameMap.isPlacing = false; // Exit placing mode
                GameMap.placingItem.destroy(); // Clear placing item
                GameMap.placingItem = null;
            }
        });
        this.clock = new Clock(this);
        this.clock.paused = true;
        this.applySimulationSpeed(true);
        this.graphics = this.add.graphics(); // Graphics object for drawing the selection outline
        this._setupSelectionDragZone();
        this.startCell = null; // Start cell (grid coordinates)
        this.endCell = null; // End cell (grid coordinates)
        // Farm mode UX helpers (world hover + UI banner)
        this.farmHover = this.add.graphics()
            .setVisible(false)
            .setDepth(UIDEPTH);


        this.ensureFarmInstructionUI();

        // inside create() or constructor after scene exists:
        this.wallPlacer = new WallPlacementController(this);

        // pointer move
        this.input.on("pointermove", (pointer) => {
            if (this.wallPlacer?.active) this.wallPlacer.onPointerMove(pointer);
            if (this.wallDestroyer?.active) this.wallDestroyer.onPointerMove(pointer);
        });

        // ESC
        this.input.keyboard.on("keydown-ESC", () => {
            if (this.wallPlacer?.active) this.wallPlacer.onEsc();
            if (this.wallDestroyer?.active) this.wallDestroyer.onEsc();
        });

        this.keyboardSpeed = 10;
        this.input.keyboard.on('keydown-K', () => {
            this.selectingEnemies = true;
            this.enemySelectStart = this.input.activePointer.positionToCamera(this.cameras.main).clone();
            if (this.enemySelectionRect) this.enemySelectionRect.destroy();
            this.enemySelectionRect = this.add.graphics().setDepth(1000);
        });
        // Add a mouse click listener
        this.input.on('pointerdown', (pointer) => {

            let cam = this.cameras.main;
            const clickedOnPlayer = this.input.manager.hitTest(pointer, Player.characters.getChildren(), cam);
            const clickedInteractiveWorldObject = this.input.manager
                .hitTest(pointer, this.children.list, cam)
                .some((obj) => obj?.input?.enabled && obj !== this._selectionDragZone);
            if (this.isSimulationPaused()) return;
            if (this._trackpadTapDragActive && pointer.button === 0) {
                if (this._trackpadTapDragMoved) {
                    this._finalizeTrackpadTapDrag();
                    return;
                }
                this._cancelTrackpadTapDrag();
            }
            // ✅ WALL MODE CONSUMES INPUT
            if (this.wallPlacer?.active && pointer.button === 0) {
                this.wallPlacer.onClick(pointer);
                return; // IMPORTANT: prevent fall-through into selection/move/build/etc
            }
            // ✅ DESTROY MODE CONSUMES INPUT
            if (this.wallDestroyer?.active && pointer.button === 0) {
                this.wallDestroyer.onClick(pointer);
                return;
            }
            if (clickedOnPlayer.length > 0) {
                console.log("hit player");
                return;
            }
            // 🔵 GUARD / SURVEY MODE: if PlayerTab put us into guardPlacement, consume this click
            if (this.guardPlacement && this.guardPlacement.active && pointer.button === 0) {
                const gridX = Math.floor(pointer.worldX / SQUARESIZE);
                const gridY = Math.floor(pointer.worldY / SQUARESIZE);
                const worldX = gridX * SQUARESIZE + SQUARESIZE / 2;
                const worldY = gridY * SQUARESIZE + SQUARESIZE / 2;

                Player.setGuardPost(this.guardPlacement.troop, worldX, worldY);

                this.guardPlacement.active = false;
                this.guardPlacement.troop = null;
                this.input.setDefaultCursor('default');

                return;
            }
            // 🌾 FARM MODE: laptop-friendly 2-click plot selection (left click)
            else if (this.farmMode && pointer.button === 0) {
                // Consume the UI click that toggled farm mode on
                if (this.farmConsumeNextClick) {
                    this.farmConsumeNextClick = false;
                    this.beginFarmSelectionIfNeeded();
                    return;
                }
                this.handleFarmPointerDown(pointer);
                return;
            }
            else if(GameMap.placingItem && !GameMap.placingItem.blocked){
                const items = TILE_TYPES[this.registry.get('image')]
                if (!items) {
                    return;
                }
                let x = Math.floor((pointer.x + cam.scrollX) / SQUARESIZE);
                let y = Math.floor((pointer.y + cam.scrollY) / SQUARESIZE);
                if(items == TILE_TYPES.player){GameMap.handleMapClick(x,y,items)}
                else{
                    Teams.teamLists['1'].blockBuildingStates.push({
                        type: items,
                        x: x - Math.floor(items.lenX/2),
                        y: y - Math.floor(items.lenY/2),
                        duration: 100,
                        assigned: 0
                    });
                    buildingManager.assignTroopToBuildBlock(1);
                }
            }
            else if(Turret.isPlacing){
                const items = itemTab.itemValues(this.registry.get('image'))
                if(items?.price && this.money < items.price){
                    showAlert(this, 'insufficient Funds', "#ff0000");
                    return;
                }
                const turret = Turret.handlePlacementClick(pointer, items, 1)
                if(turret){
                    if(items.price){
                        this.updateMoney(-1*items.price)
                    }
                    Turret.beginPlacing(items, 1)
                }
            }
            else if (
                pointer.button === 0 &&
                OrderRunner.hasPendingGatherPlacement() &&
                Player.selected.length > 0 &&
                !this.gridPlace &&
                !this.harvestMode &&
                !this.seedGridMode &&
                !this.farmMode &&
                !this.isBrushMode &&
                (this.breakItems?.text ?? "") != 'Place'
            ) {
                if (clickedInteractiveWorldObject) {
                    return;
                }
                const placed = OrderRunner.issuePendingGatherPlacement(Player.selected, pointer.worldX, pointer.worldY);
                if (placed) return;
            }
            else if (
                this._canUseSelectionDrag(pointer, clickedInteractiveWorldObject, clickedOnPlayer)
            ) {
                this._armSelectionDrag(pointer);
                return;
            }
            else if (
                pointer.button === 0 &&
                !clickedInteractiveWorldObject &&
                Player.selected.length === 0 &&
                this._canUseTrackpadDrag() &&
                this._isDoublePrimaryPointerDown(pointer)
            ) {
                this._armTrackpadTapDrag(pointer);
                return;
            }
            else if (
                pointer.button === 2 &&
                !clickedInteractiveWorldObject &&
                Player.selected.length > 0 &&
                !this.gridPlace &&
                !this.harvestMode &&
                !this.seedGridMode &&
                !this.farmMode &&
                !this.isBrushMode &&
                (this.breakItems?.text ?? "") != 'Place'
            ){
                let x = pointer.worldX;
                let y = pointer.worldY;

                let posX = Math.floor(x / SQUARESIZE);
                let posY = Math.floor(y / SQUARESIZE);

                this._showWorldDebugText(posX, posY);

                const formationSpots = Player.getFormation(posX,posY,Player.selected.length);
                let issuedMoveOrder = false;
                OrderRunner.cancelOrders(Player.selected);
                Player.selected.forEach((troop, index) => {
                    if(!troop.active){Player.selected.splice(index, 1); return;}
                    Teams.movePlayerState(troop, CONTROL_STATES.USER_MODE)
                    let troopX = Math.floor(troop.body.x / SQUARESIZE);
                    let troopY = Math.floor(troop.body.y / SQUARESIZE);
                    const spot = formationSpots[index];
                    if (!spot) return;
                    let [targetX, targetY] = spot;
                    const variance = 4;
                    targetX += Phaser.Math.RND.between(-variance, variance);
                    targetY += Phaser.Math.RND.between(-variance, variance);
                    if(GameMap.navGrid[troopY][troopX] == 0){
                        let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                        if (newX === -1) {
                            console.log("No valid start tile nearby");
                            return;
                        } else {
                            console.log("New valid tile:", newX, newY);
                            troopX = newX
                            troopY = newY
                        }
                    }
                    else if(GameMap.navGrid[posY][posX] == 0){
                        console.log("end pos is at blocked grid");
                        return;
                    }
                    troop.roam = false;
                    const moved = Player.moveTo(
                        troop,
                        GameMap.navMesh.findPath(
                            { x: troopX * SQUARESIZE, y: troopY * SQUARESIZE },
                            { x: targetX + SQUARESIZE / 2, y: targetY + SQUARESIZE / 2 }
                        )
                    );
                    issuedMoveOrder = issuedMoveOrder || !!moved;
                });
                if (issuedMoveOrder && Player.selected.length) Player.clearSelection();
            }
            else if((this.gridPlace || this.selectMode) && pointer.button == 2){
                const gridX = Math.floor(pointer.worldX / SQUARESIZE);
                const gridY = Math.floor(pointer.worldY / SQUARESIZE);
                this.pointerMoving = true;
                // Set the starting cell for selection
                this.startCell = { x: gridX, y: gridY };
                this.endCell = { x: gridX, y: gridY };
            }
            else if(this.isBrushMode && pointer.button == 2){
                this.isBrushActive = true;  
                this.brushTiles = [];
            }
            else if (
                pointer.button === 0 &&
                !clickedInteractiveWorldObject &&
                Player.selected.length > 0 &&
                !this.gridPlace &&
                !this.harvestMode &&
                !this.seedGridMode &&
                !this.farmMode &&
                !this.isBrushMode &&
                (this.breakItems?.text ?? "") != 'Place'
            ){
                Player.clearSelection();
            }
            else if (
                pointer.button === 0 &&
                !clickedInteractiveWorldObject &&
                Player.selected.length === 0 &&
                (this.breakItems?.text ?? "") != 'Place'
            ){
                let x = pointer.worldX;
                let y = pointer.worldY;

                let posX = Math.floor(x / SQUARESIZE) 
                let posY = Math.floor(y / SQUARESIZE)

                this._showWorldDebugText(posX, posY);
                const formationSpots = Player.getFormation(posX,posY,Player.selected.length);
                let issuedMoveOrder = false;
                OrderRunner.cancelOrders(Player.selected);
                Player.selected.forEach((troop, index) => {
                    if(!troop.active){Player.selected.splice(index, 1); return;}
                    Teams.movePlayerState(troop, CONTROL_STATES.USER_MODE)
                    let troopX = Math.floor(troop.body.x / SQUARESIZE);
                    let troopY = Math.floor(troop.body.y / SQUARESIZE);
                    const spot = formationSpots[index];
                    if (!spot) return; // Not enough available spots
                    let [targetX, targetY] = spot;
                    // 🔥 Add slight pixel variance (±8px)
                    const variance = 4;
                    targetX += Phaser.Math.RND.between(-variance, variance);
                    targetY += Phaser.Math.RND.between(-variance, variance);
                    if(GameMap.navGrid[troopY][troopX] == 0){
                        let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                        if (newX === -1) {
                            console.log("No valid start tile nearby");
                            return;
                        } else {
                            console.log("New valid tile:", newX, newY);
                            troopX = newX
                            troopY = newY
                        }
                    }
                    else if(GameMap.navGrid[posY][posX] == 0){
                        console.log("end pos is at blocked grid");
                        return;
                    }
                    troop.roam = false;
                    const moved = Player.moveTo(
                        troop,
                        GameMap.navMesh.findPath(
                            { x: troopX * SQUARESIZE, y: troopY * SQUARESIZE },
                            { x: targetX + SQUARESIZE / 2, y: targetY + SQUARESIZE / 2 }
                        )
                    );
                    issuedMoveOrder = issuedMoveOrder || !!moved;
                });
                if (issuedMoveOrder && Player.selected.length) Player.clearSelection();
            }
        });
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer, SQUARESIZE));
        this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));

    }

    handleKeyboardCameraMovement() {
        if (this.stageCompleteLock || this._movementLocked) return;
        const camera = this.cameras.main;
        const dt = (this.game?.loop?.delta || 16.67) / 850;

        if (!this._camPanState) {
            this._camPanState = {
                vx: 0,
                vy: 0
            };
        }

        let inputX = 0;
        let inputY = 0;
        if (this.keys.left.isDown || this.keys.arrowLeft.isDown) inputX -= 1;
        if (this.keys.right.isDown || this.keys.arrowRight.isDown) inputX += 1;
        if (this.keys.up.isDown || this.keys.arrowUp.isDown) inputY -= 1;
        if (this.keys.down.isDown || this.keys.arrowDown.isDown) inputY += 1;

        // Normalize diagonal movement so speed is consistent.
        if (inputX !== 0 && inputY !== 0) {
            const inv = 1 / Math.sqrt(2);
            inputX *= inv;
            inputY *= inv;
        }

        const accel = 2600;          // px/s^2
        const maxSpeed = 980;        // px/s
        const dampingPerSec = 9.5;   // higher = quicker stop

        const st = this._camPanState;
        if (inputX !== 0 || inputY !== 0) {
            st.vx += inputX * accel * dt;
            st.vy += inputY * accel * dt;
            const mag = Math.hypot(st.vx, st.vy);
            if (mag > maxSpeed) {
                const s = maxSpeed / mag;
                st.vx *= s;
                st.vy *= s;
            }
        } else {
            const damp = Math.exp(-dampingPerSec * dt);
            st.vx *= damp;
            st.vy *= damp;
            if (Math.abs(st.vx) < 2) st.vx = 0;
            if (Math.abs(st.vy) < 2) st.vy = 0;
        }

        let targetX = camera.scrollX + st.vx * dt;
        let targetY = camera.scrollY + st.vy * dt;

        // Final smoothing pass to reduce micro-jitter.
        const lerp = 1 - Math.exp(-18 * dt);
        camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetX, lerp);
        camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, lerp);
    }
    
    onPointerMove(pointer) {
        // Farm mode hover/preview
        // === Farm mode hover / live preview ===
        if (this.farmSelectActive && this.farmSelectPhase === 1) {
            const gridX = Math.floor(pointer.worldX / SQUARESIZE);
            const gridY = Math.floor(pointer.worldY / SQUARESIZE);

            this.graphics.clear();
            if (this.farmHover) {
                this.farmHover.clear();
                this.farmHover.setVisible(false);
            }

            const preview = this.getFarmSelectionPreviewData(gridX, gridX, gridY, gridY);
            this.renderFarmSelectionPreview(preview.cells);
            return;
        }
        else if (this.farmSelectActive && this.farmSelectPhase === 2 && this.startCell) {
            const gridX = Math.floor(pointer.worldX / SQUARESIZE);
            const gridY = Math.floor(pointer.worldY / SQUARESIZE);

            this.endCell = { x: gridX, y: gridY };

            const minX = Math.min(this.startCell.x, this.endCell.x);
            const maxX = Math.max(this.startCell.x, this.endCell.x);
            const minY = Math.min(this.startCell.y, this.endCell.y);
            const maxY = Math.max(this.startCell.y, this.endCell.y);

            const preview = this.getFarmSelectionPreviewData(minX, maxX, minY, maxY);
            this.graphics.clear();
            this.renderFarmSelectionPreview(preview.cells);
            this.setFarmInstructionPhase2(preview.totalNeeded);
            return;
        }
        else if (this.isBrushMode && this.isBrushActive) {
            const gridX = Math.floor(pointer.worldX / SQUARESIZE);
            const gridY = Math.floor(pointer.worldY / SQUARESIZE);

            const alreadyExists = this.brushTiles.some(tile => tile.x === gridX && tile.y === gridY);

            if (!alreadyExists && gridX >= 0 && gridX < WORLD_DIMENSIONX && gridY >= 0 && gridY < WORLD_DIMENSIONY) {
                this.brushTiles.push({ x: gridX, y: gridY });

                this.brushGraphics.fillStyle(0x00ff00, 0.5);
                this.brushGraphics.fillRect(
                    gridX * SQUARESIZE,
                    gridY * SQUARESIZE,
                    SQUARESIZE,
                    SQUARESIZE
                ).setDepth(UIDEPTH);
            }
            if (this._trackpadTapDragActive) {
                this._trackpadTapDragMoved = true;
                this._refreshTrackpadTapDragTimer();
            }
        }
        else if (this._trackpadTapDragActive && this._trackpadSelectStartWorld) {
            this._trackpadSelectEndWorld = { x: pointer.worldX, y: pointer.worldY };
            this._drawWorldSelectionOutline(0x00ff00);
            this._trackpadTapDragMoved = true;
            this._refreshTrackpadTapDragTimer();
        }
        else if (this._trackpadTapDragActive && this.startCell) {
            const gridX = Math.floor(pointer.worldX / SQUARESIZE);
            const gridY = Math.floor(pointer.worldY / SQUARESIZE);

            this.endCell = { x: gridX, y: gridY };
            if(GameMap.checkSpreadPosition(this.startCell.x,this.startCell.y,this.endCell.x, this.endCell.y)){
                this.drawSelectionOutline("0xff0000");
            } else{
                this.drawSelectionOutline("0x00ff00");
            }
            this._trackpadTapDragMoved = true;
            this._refreshTrackpadTapDragTimer();
        }
        else if (
            (this._selectionDragPending || this._selectionDragActive) &&
            this._selectionDragPointerId === pointer?.id &&
            pointer?.isDown
        ) {
            const dx = (pointer.x ?? 0) - this._selectionDragStartScreenX;
            const dy = (pointer.y ?? 0) - this._selectionDragStartScreenY;
            const movedFarEnough = ((dx * dx) + (dy * dy)) >= (this._selectionDragDistanceThreshold * this._selectionDragDistanceThreshold);

            if (this._selectionDragPending && movedFarEnough) {
                this._startSelectionDrag(pointer);
            }
            if (this._selectionDragActive) {
                this._updateSelectionDrag(pointer);
            }
        }
        else if (this.startCell) {
            const gridX = Math.floor(pointer.worldX / SQUARESIZE);
            const gridY = Math.floor(pointer.worldY / SQUARESIZE);
    
            // Update the end cell for selection
            this.endCell = { x: gridX, y: gridY };
            if(GameMap.checkSpreadPosition(this.startCell.x,this.startCell.y,this.endCell.x, this.endCell.y)){
                this.drawSelectionOutline("0xff0000");
            } else{
                // Visualize the current selection
                this.drawSelectionOutline("0x00ff00");
            }
        }
    }

    onPointerUp(pointer) {
        if (
            this._trackpadTapDragActive &&
            pointer?.button === 0 &&
            !pointer?._skipTrackpadTapArm
        ) {
            this._rememberPrimaryPointerUp(pointer);
            return;
        }
        this._rememberPrimaryPointerUp(pointer);
        if (this._selectionDragActive && this._selectionDragPointerId === pointer?.id) {
            this._finishSelectionDrag(pointer);
            return;
        }
        if (this._consumeSelectionDragTap(pointer)) {
            return;
        }
        this.graphics.clear();
        // Farm mode uses click-to-pick; don't let pointerup clear our selection state.
        if (this.farmSelectActive) return;
        else if (this.selectingEnemies) {
            const end = this.input.activePointer.positionToCamera(this.cameras.main).clone();
            this.processEnemySelection(this.enemySelectStart, end);
            this.selectingEnemies = false;

            if (this.enemySelectionRect) {
                this.enemySelectionRect.clear();
                this.enemySelectionRect.destroy();
                this.enemySelectionRect = null;
            }

            this.events.emit('mode:completed', 'Attack');
        }
        // else if(this.farmMode){
        //     this.getSelectedCells(1)
        //     this.events.emit('mode:completed', 'Farm');
        // }
        else if(this.harvestMode){
            this.getSelectedCells(2)
        }
        else if(this.seedGridMode){
            this.getSelectedCells(3)
            this.events.emit('mode:completed', 'Seed');
        }
        else if (this.isBrushMode && this.isBrushActive) {
            this.isBrushActive = false
            this.brushGraphics.clear();
            let items = itemTab.itemValues(this.registry.get('image'))
            if(items.price && !this.checkSufficientFunds(items.price*this.brushTiles.length)) return;
            buildingManager.createBuildTileStateArray(this.brushTiles, 1);
            this.brushTiles = [];
            buildingManager.assingTroopsToBuildTile(1);
        }
        else if (this._trackpadSelectStartWorld && this._trackpadSelectEndWorld) {
            Player.handlePlayerSelectWorldRect(this._trackpadSelectStartWorld, this._trackpadSelectEndWorld);
        }
        else if(!this.gridPlace){ // player select
            Player.handlePlayerSelect();
        }
        else if (this.startCell && this.endCell) {
            // Get all selected grid cells
            this.getSelectedCells();
        }
        this.startCell = null;
        this.endCell = null;
        this._clearTrackpadWorldSelection();
        this.pointerMoving = false;
        this._clearTrackpadTapDragTimer();
        this._trackpadTapDragActive = false;
        this._trackpadTapDragMoved = false;
    }

    _canUseTrackpadDrag() {
        return !!(
            this.gridPlace ||
            this.harvestMode ||
            this.seedGridMode ||
            this.isBrushMode
        );
    }

    _isDoublePrimaryPointerDown(pointer) {
        if (pointer.button !== 0) return false;

        const now = this.time?.now ?? performance.now();
        const radiusSq = this._trackpadDoubleClickRadiusPx * this._trackpadDoubleClickRadiusPx;
        const upDx = pointer.x - this._lastPrimaryPointerUpX;
        const upDy = pointer.y - this._lastPrimaryPointerUpY;
        const downDx = pointer.x - this._lastPrimaryPointerDownX;
        const downDy = pointer.y - this._lastPrimaryPointerDownY;
        const matchesPrevUp =
            this._lastPrimaryPointerUpAt > 0 &&
            (now - this._lastPrimaryPointerUpAt) <= this._trackpadDoubleClickWindowMs &&
            ((upDx * upDx + upDy * upDy) <= radiusSq);
        const matchesPrevDown =
            this._lastPrimaryPointerDownAt > 0 &&
            (now - this._lastPrimaryPointerDownAt) <= this._trackpadDoubleClickWindowMs &&
            ((downDx * downDx + downDy * downDy) <= radiusSq);
        const isDouble = matchesPrevUp || matchesPrevDown;

        this._lastPrimaryPointerDownAt = now;
        this._lastPrimaryPointerDownX = pointer.x;
        this._lastPrimaryPointerDownY = pointer.y;

        if (isDouble) {
            this._lastPrimaryPointerDownAt = -Infinity;
            this._lastPrimaryPointerUpAt = -Infinity;
        }

        return isDouble;
    }

    _rememberPrimaryPointerUp(pointer) {
        if (pointer?.button !== 0) return;
        const now = this.time?.now ?? performance.now();
        this._lastPrimaryPointerUpAt = now;
        this._lastPrimaryPointerUpX = pointer.x;
        this._lastPrimaryPointerUpY = pointer.y;
    }

    _isTrackpadWorldSelectionMode() {
        return !!(
            this.selectMode &&
            !this.gridPlace &&
            !this.harvestMode &&
            !this.seedGridMode &&
            !this.farmMode &&
            !this.isBrushMode
        );
    }

    _drawWorldSelectionOutline(color = 0x00ff00) {
        if (!this._trackpadSelectStartWorld || !this._trackpadSelectEndWorld) return;

        const minX = Math.min(this._trackpadSelectStartWorld.x, this._trackpadSelectEndWorld.x);
        const maxX = Math.max(this._trackpadSelectStartWorld.x, this._trackpadSelectEndWorld.x);
        const minY = Math.min(this._trackpadSelectStartWorld.y, this._trackpadSelectEndWorld.y);
        const maxY = Math.max(this._trackpadSelectStartWorld.y, this._trackpadSelectEndWorld.y);

        this.graphics.clear();
        this.graphics.lineStyle(2, color, 1);
        this.graphics.setDepth(UIDEPTH);
        this.graphics.strokeRect(minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY));
    }

    _clearTrackpadWorldSelection() {
        this._trackpadSelectStartWorld = null;
        this._trackpadSelectEndWorld = null;
    }

    _setupSelectionDragZone() {
        if (this._selectionDragZone) {
            this._selectionDragZone.destroy();
            this._selectionDragZone = null;
        }
    }

    _syncSelectionDragZoneBounds() {
        return;
    }

    _canUseSelectionDrag(pointer, clickedInteractiveWorldObject, clickedOnPlayer) {
        return !!(
            pointer?.button === 0 &&
            this.selectMode &&
            !this.gridPlace &&
            !this.harvestMode &&
            !this.seedGridMode &&
            !this.farmMode &&
            !this.isBrushMode &&
            !clickedInteractiveWorldObject &&
            !(clickedOnPlayer?.length > 0) &&
            (this.breakItems?.text ?? "") !== "Place"
        );
    }

    _armSelectionDrag(pointer) {
        this._selectionDragPending = true;
        this._selectionDragActive = false;
        this._selectionDragPointerId = pointer?.id ?? null;
        this._selectionDragStartScreenX = pointer?.x ?? 0;
        this._selectionDragStartScreenY = pointer?.y ?? 0;
        this._trackpadSelectStartWorld = { x: pointer.worldX, y: pointer.worldY };
        this._trackpadSelectEndWorld = { x: pointer.worldX, y: pointer.worldY };
    }

    _startSelectionDrag(pointer) {
        if (!this._selectionDragPending || this._selectionDragPointerId !== pointer?.id) return;
        this._selectionDragPending = false;
        this._selectionDragActive = true;
        this._trackpadSelectStartWorld = this._trackpadSelectStartWorld || { x: pointer.worldX, y: pointer.worldY };
        this._trackpadSelectEndWorld = { x: pointer.worldX, y: pointer.worldY };
        this._drawWorldSelectionOutline(0x00ff00);
    }

    _updateSelectionDrag(pointer) {
        if (!this._selectionDragActive || this._selectionDragPointerId !== pointer?.id) return;
        this._trackpadSelectEndWorld = { x: pointer.worldX, y: pointer.worldY };
        this._drawWorldSelectionOutline(0x00ff00);
    }

    _finishSelectionDrag(pointer) {
        if (!this._selectionDragActive || this._selectionDragPointerId !== pointer?.id) return;
        if (this._trackpadSelectStartWorld && this._trackpadSelectEndWorld) {
            Player.handlePlayerSelectWorldRect(this._trackpadSelectStartWorld, this._trackpadSelectEndWorld);
        }
        this.graphics.clear();
        this._clearTrackpadWorldSelection();
        this._selectionDragPending = false;
        this._selectionDragActive = false;
        this._selectionDragPointerId = null;
        this._selectionDragStartScreenX = 0;
        this._selectionDragStartScreenY = 0;
    }

    _consumeSelectionDragTap(pointer) {
        if (!this._selectionDragPending || this._selectionDragPointerId !== pointer?.id) return false;

        this._selectionDragPending = false;
        this._selectionDragActive = false;
        this._selectionDragPointerId = null;
        this._selectionDragStartScreenX = 0;
        this._selectionDragStartScreenY = 0;
        this._clearTrackpadWorldSelection();
        this.graphics.clear();

        if (Player.selected.length > 0) {
            Player.clearSelection();
        } else if (pointer) {
            const posX = Math.floor(pointer.worldX / SQUARESIZE);
            const posY = Math.floor(pointer.worldY / SQUARESIZE);
            this._showWorldDebugText(posX, posY);
        }

        return true;
    }

    _showWorldDebugText(posX, posY) {
        this._debugCurrentText?.destroy?.();
        this._debugSelectionCountText?.destroy?.();

        this._debugCurrentText = this.add.text(
            this.cameras.main.width - 150,
            50,
            `(${posX}, ${posY})`,
            { fontSize: '14px', fill: '#ffffff' }
        )
            .setScrollFactor(0)
            .setDepth(UIDEPTH);

        this._debugSelectionCountText = this.add.text(
            this.cameras.main.width - 150,
            65,
            `Selected: ${Player.selected.length}\nnavGird: ${GameMap.navGrid[posY][posX]}\ngrid: ${GameMap.grid[posY][posX]}`,
            { fontSize: '14px', fill: '#ffffff' }
        )
            .setScrollFactor(0)
            .setDepth(UIDEPTH);
    }

    _beginTrackpadDrag(pointer) {
        if (this.isBrushMode) {
            this.isBrushActive = true;
            this.brushTiles = [];
            return;
        }

        this.pointerMoving = true;
        if (this._isTrackpadWorldSelectionMode()) {
            this._trackpadSelectStartWorld = { x: pointer.worldX, y: pointer.worldY };
            this._trackpadSelectEndWorld = { x: pointer.worldX, y: pointer.worldY };
            this.startCell = null;
            this.endCell = null;
            return;
        }

        const gridX = Math.floor(pointer.worldX / SQUARESIZE);
        const gridY = Math.floor(pointer.worldY / SQUARESIZE);
        this.startCell = { x: gridX, y: gridY };
        this.endCell = { x: gridX, y: gridY };
    }

    _armTrackpadTapDrag(pointer) {
        this._trackpadTapDragActive = true;
        this._trackpadTapDragMoved = false;
        this._beginTrackpadDrag(pointer);
        this._refreshTrackpadTapDragTimer();
    }

    _clearTrackpadTapDragTimer() {
        if (this._trackpadTapDragTimer) {
            this._trackpadTapDragTimer.remove(false);
            this._trackpadTapDragTimer = null;
        }
    }

    _refreshTrackpadTapDragTimer() {
        this._clearTrackpadTapDragTimer();
        this._trackpadTapDragTimer = this.time.delayedCall(this._trackpadTapDragIdleMs, () => {
            if (!this._trackpadTapDragActive) return;
            if (this._trackpadTapDragMoved) {
                this._finalizeTrackpadTapDrag();
            } else {
                this._cancelTrackpadTapDrag();
            }
        });
    }

    _cancelTrackpadTapDrag() {
        this._clearTrackpadTapDragTimer();
        this._trackpadTapDragActive = false;
        this._trackpadTapDragMoved = false;
        this.pointerMoving = false;
        if (this.isBrushMode) {
            this.isBrushActive = false;
            this.brushTiles = [];
            this.brushGraphics?.clear?.();
        }
        this.graphics?.clear?.();
        this.startCell = null;
        this.endCell = null;
        this._clearTrackpadWorldSelection();
    }

    _finalizeTrackpadTapDrag() {
        if (!this._trackpadTapDragActive) return;
        this._clearTrackpadTapDragTimer();
        this.onPointerUp({ button: 0, _skipTrackpadTapArm: true });
    }

    // === Farm mode: laptop-friendly 2-click plot selection ===
// === Farm instruction UI (segmented, colored parts, seed icon) ===
ensureFarmInstructionUI() {
    if (this.farmInstructionUI) return;

    const y = 40; // below top bar
    const x = this.cameras.main.width / 2;

    this.farmInstructionUI = this.add.container(x, y)
        .setScrollFactor(0)
        .setDepth(UIDEPTH + 10)
        .setVisible(false);

    // children we reuse
    this.farmInstrLeft = this.add.text(0, 0, "", {
        fontSize: "16px",
        fontFamily: "Bungee",
        fill: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
    }).setOrigin(0, 0);

    this.farmInstrMid = this.add.text(0, 0, "", {
        fontSize: "16px",
        fontFamily: "Bungee",
        fill: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
    }).setOrigin(0, 0);

    this.farmInstrSeedCount = this.add.text(0, 0, "", {
        fontSize: "16px",
        fontFamily: "Bungee",
        fill: "#00ff00",
        stroke: "#000",
        strokeThickness: 3,
    }).setOrigin(0, 0);

    this.farmInstrSeedIcon = this.add.image(0, 8, "seeds") // seed icon key MUST be 'seeds'
        .setOrigin(0, 0.5)
        .setScale(0.7);

    this.farmInstrRight = this.add.text(0, 0, "", {
        fontSize: "16px",
        fontFamily: "Bungee",
        fill: "#ff4444", // red for Esc part
        stroke: "#000",
        strokeThickness: 3,
    }).setOrigin(0, 0);

    this.farmInstructionUI.add([
        this.farmInstrLeft,
        this.farmInstrMid,
        this.farmInstrSeedCount,
        this.farmInstrSeedIcon,
        this.farmInstrRight,
    ]);

    // ignore by camera

    // keep centered on resize
    this.scale.on("resize", ({ width }) => {
        if (this.farmInstructionUI) this.farmInstructionUI.setX(width / 2);
    });
}

layoutFarmInstruction() {
    // layout left-to-right, then center container contents
    const pad = 8;

    // hide seed bits unless they have text
    const seedVisible = !!this.farmInstrSeedCount.text;

    this.farmInstrSeedCount.setVisible(seedVisible);
    this.farmInstrSeedIcon.setVisible(seedVisible);

    let x = 0;
    this.farmInstrLeft.setX(x);
    x += this.farmInstrLeft.width + pad;

    this.farmInstrMid.setX(x);
    x += this.farmInstrMid.width + pad;

    if (seedVisible) {
        this.farmInstrSeedCount.setX(x);
        x += this.farmInstrSeedCount.width + pad;

        this.farmInstrSeedIcon.setX(x);
        x += this.farmInstrSeedIcon.displayWidth + pad;
    }

    this.farmInstrRight.setX(x);
    x += this.farmInstrRight.width;

    // center the whole strip around container origin
    const totalW = x;
    for (const child of this.farmInstructionUI.list) {
        child.x -= totalW / 2;
    }
}

showFarmInstruction() {
    this.ensureFarmInstructionUI();
    this.farmInstructionUI.setVisible(true);
}

hideFarmInstruction() {
    if (this.farmInstructionUI) this.farmInstructionUI.setVisible(false);
}

setFarmInstructionPhase1() {
    this.ensureFarmInstructionUI();

    this.farmInstrLeft.setText("Click spot to begin plot");
    this.farmInstrMid.setText("");               // no middle piece
    this.farmInstrSeedCount.setText("");         // no seed count in phase 1
    this.farmInstrRight.setText(" Esc to cancel");
    this.farmInstrRight.setColor("#ff4444");     // red Esc

    this.showFarmInstruction();
    this.layoutFarmInstruction();
}

setFarmInstructionPhase2(totalNeeded) {
    this.ensureFarmInstructionUI();

    this.farmInstrLeft.setText("Select end spot");
    this.farmInstrMid.setText(" - x");
    this.farmInstrSeedCount.setText(String(totalNeeded));

    const enough = (this.seeds >= totalNeeded);
    this.farmInstrSeedCount.setColor(enough ? "#00ff00" : "#ff4444");

    this.farmInstrRight.setText("  Esc to go back");
    this.farmInstrRight.setColor("#ff4444");

    this.showFarmInstruction();
    this.layoutFarmInstruction();
}

// Valid start tile rules (matches your getSelectedCells(1) behavior)
isValidFarmTile(x, y) {
    if (!this.isFarmTileInWorld(x, y)) return false;

    const cell = GameMap.grid?.[y]?.[x];
    if (cell == null) return false;

    const vals = Array.isArray(cell) ? cell : [cell];
    const names = vals.map((v) => TILE_MAP(v)).filter(Boolean);
    if (names.includes("water") || names.includes("road")) return false;

    const floorName = TILE_MAP(GameMap.grabDepth(cell, FLOORDEPTH));
    const type = floorName ? TILE_TYPES[floorName] : null;

    // Tillable ground (spread tiles) excluding water/road
    if (type?.spread && type.name !== "water" && type.name !== "road") return true;

    // Existing crop tile that doesn't have a seed yet
    if (names.includes("crops") || type?.name === "crops") {
        const crop = Teams.getCropAt(x, y, 1);
        if (crop && !crop.hasSeed) return true;
    }

    return false;
}

isFarmTileInWorld(x, y) {
    return x >= 0 && y >= 0 && x < WORLD_DIMENSIONX && y < WORLD_DIMENSIONY;
}

isValidFarmSelection(minX, maxX, minY, maxY) {
    let validCount = 0;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (!this.isValidFarmTile(x, y)) return false;
            validCount++;
        }
    }
    return validCount > 0;
}

// ---- Farm selection seed accounting helpers ----
getPendingFarmTileKeySet() {
    const team1 = Teams.teamLists?.["1"];
    const list = team1?.tileList || [];
    const set = new Set();

    for (const t of list) {
        if (!t) continue;
        if (typeof t.x !== "number" || typeof t.y !== "number") continue;
        set.add(`${t.x},${t.y}`);
    }
    return set;
}

getFarmSelectionPreviewData(minX, maxX, minY, maxY) {
    const pending = this.getPendingFarmTileKeySet();
    const cells = [];

    const startX = Phaser.Math.Clamp(minX, 0, WORLD_DIMENSIONX - 1);
    const endX = Phaser.Math.Clamp(maxX, 0, WORLD_DIMENSIONX - 1);
    const startY = Phaser.Math.Clamp(minY, 0, WORLD_DIMENSIONY - 1);
    const endY = Phaser.Math.Clamp(maxY, 0, WORLD_DIMENSIONY - 1);

    if (startX > endX || startY > endY) {
        return {
            pendingCount: pending.size,
            newCount: 0,
            totalNeeded: pending.size,
            validSelection: false,
            enoughSeeds: pending.size <= this.seeds,
            cells,
        };
    }

    const availableNewSeeds = Math.max(0, (this.seeds ?? 0) - pending.size);
    let newCount = 0;

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            if (!this.isValidFarmTile(x, y)) continue;

            const key = `${x},${y}`;
            if (pending.has(key)) continue;

            const overBudget = newCount >= availableNewSeeds;
            cells.push({
                x,
                y,
                tint: overBudget ? 0xff5a5a : 0x52ff7a,
            });
            newCount++;
        }
    }

    const totalNeeded = pending.size + newCount;
    return {
        pendingCount: pending.size,
        newCount,
        totalNeeded,
        validSelection: newCount > 0,
        enoughSeeds: totalNeeded <= this.seeds,
        cells,
    };
}

// Returns how many seeds we need if we confirm THIS rectangle,
// INCLUDING already-queued (pending) tiles.
getFarmSelectionSeedCost(minX, maxX, minY, maxY) {
    const preview = this.getFarmSelectionPreviewData(minX, maxX, minY, maxY);
    return {
        pendingCount: preview.pendingCount,
        newCount: preview.newCount,
        totalNeeded: preview.totalNeeded,
    };
}

beginFarmSelectionIfNeeded() {
    if (!this.farmMode) return;
    if (this.farmSelectActive) return;

    this.farmSelectActive = true;
    this.farmSelectPhase = 1;
    this.startCell = null;
    this.endCell = null;
    this.graphics.clear();

    // IMPORTANT: consume the click that turned farm mode on (prevents fall-through)
    this.farmConsumeNextClick = true;

    this.setFarmInstructionPhase1();
}

cancelFarmSelection(exitFarmMode = false) {
    this.farmSelectActive = false;
    this.farmSelectPhase = 0;
    this.startCell = null;
    this.endCell = null;
    this.graphics.clear();
    if (this.farmHover) this.farmHover.setVisible(false);
    this.clearFarmSelectionPreview();
    this.hideFarmInstruction();

    if (exitFarmMode) {
        // this is the key — FunctionTab uses this to un-toggle
        this.events.emit("mode:completed", "Farm");
        this.farmMode = false; // keep for safety; UI state comes from the event
    }
}

    handleFarmPointerDown(pointer) {
        this.beginFarmSelectionIfNeeded();

        // consume the activation click (so first "real" click sets the start tile)
        if (this.farmConsumeNextClick) {
            this.farmConsumeNextClick = false;
            return;
        }

        const gridX = Math.floor(pointer.worldX / SQUARESIZE);
        const gridY = Math.floor(pointer.worldY / SQUARESIZE);

        // Phase 1: pick a valid start tile
        if (this.farmSelectPhase === 1) {
            const preview = this.getFarmSelectionPreviewData(gridX, gridX, gridY, gridY);
            if (!preview.validSelection) return;

            this.startCell = { x: gridX, y: gridY };
            this.endCell = { x: gridX, y: gridY };
            this.farmSelectPhase = 2;

            if (this.farmHover) this.farmHover.setVisible(false);
            return;
        }

        // Phase 2: confirm end tile
        if (this.farmSelectPhase === 2 && this.startCell) {
            this.endCell = { x: gridX, y: gridY };

            const minX = Math.min(this.startCell.x, this.endCell.x);
            const maxX = Math.max(this.startCell.x, this.endCell.x);
            const minY = Math.min(this.startCell.y, this.endCell.y);
            const maxY = Math.max(this.startCell.y, this.endCell.y);

            const preview = this.getFarmSelectionPreviewData(minX, maxX, minY, maxY);
            if (!preview.validSelection) return;

            if (!this.checkSufficientSeeds(preview.totalNeeded)) {
                // stay in phase 2, user can resize selection or Esc back
                return;
            }

            // NOW it's allowed: proceed to existing tilling code
            this.getSelectedCells(1);

            // IMPORTANT: fully shut off selection + tell UI to toggle the Farm button off
            this.cancelFarmSelection(false);
            this.events.emit("mode:completed", "Farm");
            return;
        }
    }

    drawSelectionOutline(color) {
        this.graphics.clear(); // Clear previous drawings
        this.graphics.lineStyle(2, color, 1); // black outline with thickness
    
        const minX = Math.min(this.startCell.x, this.endCell.x);
        const maxX = Math.max(this.startCell.x, this.endCell.x);
        const minY = Math.min(this.startCell.y, this.endCell.y);
        const maxY = Math.max(this.startCell.y, this.endCell.y);
    
        const rectX = minX * SQUARESIZE;
        const rectY = minY * SQUARESIZE;
        const rectWidth = (maxX - minX + 1) * SQUARESIZE;
        const rectHeight = (maxY - minY + 1) * SQUARESIZE;
        
        this.graphics.setDepth(UIDEPTH);
        this.graphics.strokeRect(rectX, rectY, rectWidth, rectHeight); // Draw the rectangle
    }

    getSelectedCells(mode = 0) {
        const team1 = Teams.teamLists?.["1"];
        if (!team1) return;

        const existing = this.getPendingFarmTileKeySet();
        const minX = Math.min(this.startCell.x, this.endCell.x);
        const maxX = Math.max(this.startCell.x, this.endCell.x);
        const minY = Math.min(this.startCell.y, this.endCell.y);
        const maxY = Math.max(this.startCell.y, this.endCell.y);
        // if insufficient, show alert and bail out
        if (mode === 1) {
            // FARM/TILL selection mode
            const tillList = Teams.teamLists['1'].tileList;
            const preview = this.getFarmSelectionPreviewData(minX, maxX, minY, maxY);

            for (const cell of preview.cells) {
                const key = `${cell.x},${cell.y}`;
                if (existing.has(key)) continue;
                existing.add(key);
                tillList.push({ x: cell.x, y: cell.y, assigned: 0 });
                this.addTillPreviewSprite(cell.x, cell.y);
            }

            // IMPORTANT: do NOT turn farmMode off here.
            // Selection lifecycle should end via your "complete" event path (see section 3).
        }
        else if(mode == 2){
            let cropList = Teams.teamLists['1'].cropList;
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    let type = TILE_TYPES[TILE_MAP(GameMap.grabDepth(GameMap.grid[y][x], FLOORDEPTH))]
                    if(type.name == 'crops'){
                        let cropTile;
                        const key = `${x},${y}`
                        if(Array.isArray(GameMap.cropDict[key])){
                            cropTile = GameMap.cropDict[key][0]
                        }else{cropTile = GameMap.cropDict[key]}
                        if(cropTile.anims.currentFrame.index == 3){
                            cropList.push({
                                x,
                                y,
                                assigned: 0
                            });
                        }
                    }
                }
            }
            tillManager.assignCropsToTroops(1);
        }
        else if (mode == 3) {
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    this.seedGridMode = false;
                    this.functionTab.updateVisuals();
                    let tileType = TILE_TYPES[TILE_MAP(GameMap.grabDepth(GameMap.grid[y][x], FLOORDEPTH))];
                    if (tileType.interactable) {
                        const block = GameMap.blocks[y * WORLD_DIMENSIONX + x];
                        // register the seed task AND bind the block to it
                        const task = { x, y, block, forageType: 'seed', assigned: 0 };
                        Teams.teamLists["1"].foragerQueue.push(task);
                        // 🟡 draw persistent yellow outline
                        if (block && !block.queuedOutline) {
                            const size = SQUARESIZE;
                            const outline = GameMap.scene.add.graphics();
                            outline.setDepth(UIDEPTH);
                            outline.lineStyle(2, 0xffff00, 1);
                            outline.strokeRect(x * size, y * size, size, size);
                            block.queuedOutline = outline;
                        }
                    }
                }
            }
            // seedManager.assignSeedsToTroops(1);
        }
        else{
            const item = itemTab.itemValues(this.registry.get('image'));
            item.lenX = maxX-minX; item.lenY = maxY-minY;
            GameMap.addSpreadItem(minX,minY,item);
        }
    }

    sceneButtons() {
        const camera = this.cameras.main;
        const W = camera.width;
        const H = 36;

        // 🔳 Background
        const bar = this.add.rectangle(0, 0, W, H, 0x222222, 0.7)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(UIDEPTH - 1);

        this.scale.on("resize", ({ width }) => bar.setSize(width, H));

        const makeIcon = (x, key) =>
            this.add.image(x, H / 2, key)
            .setDisplaySize(20, 20)
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(UIDEPTH);

        const makeText = (x, text, color = "#fff") =>
            this.add.text(x, H / 2, text, {
            fontSize: "14px",
            fill: color,
            fontFamily: "Bungee",
            stroke: "#000",
            strokeThickness: 2,
            }).setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(UIDEPTH);

        let x = 12;
        const spacing = 8;
        const iconSize = 20;

        // === Daily Needs Section ===
        const needs = DailyNeedsTracker.getValues();
        this.topHudElements = [];

        for (const item of needs) {
            const icon = makeIcon(x, item.key);
            x += iconSize + 4;
            const display = item.need
                ? `${item.have}/${item.need}`
                : `${item.have}`;
            const color = item.need
                ? (item.have >= item.need ? "#00ff00" : "#ff3333")
                : (item.have > 0 ? "#00ff00" : "#ff3333");
            const text = makeText(x, display, color);
            x += text.width + spacing;

            // 🟢 store references
            if (item.key === "foodIcon") this.foodText = text;
            if (item.key === "waterIcon") this.waterText = text;

            this.topHudElements.push(icon, text);
        }

        // === Resource Section ===
        const resources = [
            { key: "seeds", value: this.seeds },
            { key: "berry", value: this.berries },
            { key: "woodIcon", value: this.woodAmnt },
            { key: "stoneIcon", value: this.stoneAmnt },
        ];

        for (const r of resources) {
            const icon = makeIcon(x, r.key);
            x += iconSize + 4;
            const text = makeText(x, `${r.value}`);
            text.name = r.key; // 🟢 give each text a name for lookup
            x += text.width + spacing;

            switch (r.key) {
                case "seeds": this.seedsText = text; break;
                case "berry": this.berryText = text; break;
                case "woodIcon": this.woodText = text; break;
                case "stoneIcon": this.stoneText = text; break;
                case "waterIcon": this.waterText = text; break;
            }

            this.topHudElements.push(icon, text);
        }

        // === Money (centered) ===
        const centerX = W / 2;
        const moneyIcon = makeIcon(centerX - 30, "monies");
        this.moneyText = makeText(centerX - 4, `$${this.money}`);
        this.topHudElements.push(moneyIcon, this.moneyText);

        // === Clock (right) ===
        const clockX = W - 160;
        this.clock = new Clock(this);
        this.clockText = makeText(clockX, this.clock.formatTimeWithDay());
        this.clock.externalText = this.clockText; // pass reference
        this.topHudElements.push(this.clockText);


        this.topHud = this.add.container(0, 0, [bar, ...this.topHudElements])
            .setScrollFactor(0)
            .setDepth(UIDEPTH);
        this.uiScene?._syncWorldUiRefs?.();
    }



    static refreshUICameraIgnores() {}


    updateMoney(amountDelta) {
        this.money += amountDelta;
        if (this.uiScene?.onMoneyChanged) {
            this.uiScene.onMoneyChanged(amountDelta);
            return;
        }
        if (!this.moneyText) return;
        this.moneyText.setText(`$${this.money}`);
    
        // Determine color and ghost prefix
        const isGain = amountDelta > 0;
        const color = isGain ? '#00ff00' : '#ff3333';
        const sign = isGain ? '+' : '-';
    
        // Temporarily change the fill color
        this.moneyText.setFill(color);
    
        // Create ghost text above the current amount
        const ghost = this.add.text(
            this.moneyText.x,
            this.moneyText.y,
            `${sign}$${Math.abs(amountDelta)}`,
            {
                fontSize: '18px',
                fill: color,
            }
        ).setOrigin(0, 0).setDepth(UIDEPTH).setScrollFactor(0);
    
        // Animate ghost text: float up and fade out
        this.tweens.add({
            targets: ghost,
            y: ghost.y - 20,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => ghost.destroy()
        });
    
        // Reset fill color back to white after a short delay
        this.time.delayedCall(600, () => {
            this.moneyText.setFill('#ffffff');
        });
    }

    updateSeeds(amountDelta) {
        this.seeds += amountDelta;
        if (this.uiScene?.onSeedsChanged) {
            this.uiScene.onSeedsChanged(amountDelta);
            return;
        }
        if (!this.seedsText) return;
        this.seedsText.setText(`${this.seeds}`);
    
        // color flash
        const color = amountDelta > 0 ? '#00ff00' : '#ff3333';
        this.seedsText.setFill(color);
    
        // floating ghost text
        const ghost = this.add.text(
            this.seedsText.x,
            this.seedsText.y,
            amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`,
            {
                fontSize: '18px',
                fill: color,
            }
        )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(UIDEPTH);
    
        this.tweens.add({
            targets: ghost,
            y: ghost.y - 20,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => ghost.destroy()
        });
    
        // reset color
        this.time.delayedCall(600, () => {
            this.seedsText.setFill('#ffffff');
        });
    }

    updateBerry(amountDelta) {
        this.berries += amountDelta;
        if (this.uiScene?.onBerryChanged) {
            this.uiScene.onBerryChanged(amountDelta);
            return;
        }
        if (!this.berryText) return;
        this.berryText.setText(`${this.berries}`);
    
        const color = amountDelta > 0 ? '#00ff00' : '#ff3333';
        this.berryText.setFill(color);
    
        const ghost = this.add.text(
            this.berryText.x,
            this.berryText.y,
            amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`,
            {
                fontSize: '18px',
                fill: color,
            }
        )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(UIDEPTH);
    
        this.tweens.add({
            targets: ghost,
            y: ghost.y - 20,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => ghost.destroy()
        });
    
        this.time.delayedCall(600, () => {
            this.berryText.setFill('#ffffff');
        });
    }

    updatePermits(amountDelta) {
        this.permits = Math.max(0, (this.permits ?? 0) + amountDelta);
        if (this.uiScene?.onPermitsChanged) {
            this.uiScene.onPermitsChanged(amountDelta);
            return;
        }
        if (!this.permitText) return;
        this.permitText.setText(`${this.permits}`);

        const isGain = amountDelta > 0;
        const color = isGain ? '#d8b4fe' : '#fca5a5';
        const sign = isGain ? '+' : '-';
        this.permitText.setFill(color);

        const ghost = this.add.text(
            this.permitText.x,
            this.permitText.y,
            `${sign}${Math.abs(amountDelta)}📜`,
            {
                fontSize: '18px',
                fill: color,
            }
        )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(UIDEPTH);

        this.tweens.add({
            targets: ghost,
            y: ghost.y - 20,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => ghost.destroy()
        });

        this.time.delayedCall(600, () => {
            this.permitText?.setFill?.('#ffffff');
        });
    }
    
    
    
    createAnim(key,repeat = -1, frameRate = 3, end=2){
        this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: end }),
            frameRate: frameRate,
            repeat: repeat
        });
    }
    
    update(time, delta) {
        this._updateOceanBackdrop();
        const effectiveSimSpeed = this.applySimulationSpeed();

        if (effectiveSimSpeed > 0) {
            const simDeltaMs = delta * effectiveSimSpeed;
            this.simNowMs += simDeltaMs;
            const simNowMs = this.getSimulationNow();

            Turret.updateAll(simNowMs, simDeltaMs);
            Catapult.updateAll(simNowMs, simDeltaMs);
            this.clock.update(Math.max(1, Math.round(effectiveSimSpeed)));
            this._updateNorthFortArrival();
            this.handleKeyboardCameraMovement();
            PineTree.updateAll(this.time.now);
            if (this.farmMode && !this._prevFarmMode) {
                this.farmConsumeNextClick = true;
                this.beginFarmSelectionIfNeeded();
            }
            if (!this.farmMode && this._prevFarmMode) {
                this.cancelFarmSelection(false);
            }
            this._prevFarmMode = this.farmMode;
        }
        Player.update();
        ClayOvenUI.updateAllOvens(effectiveSimSpeed);
        this._refreshNorthFortArrivalMarker();
    }

    showSaveNotification() {
        const text = this.add.text(this.cameras.main.width / 2, -50, "World data saved 🌍", {
            fontSize: "32px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4,
            fontStyle: "bold"
        })
        .setOrigin(0.5, 0.5) // Center the text
        .setDepth(1000); // Ensure it's on top
    
        // Tween: Drop down slightly, then bounce back up
        this.tweens.add({
            targets: text,
            y: 60, // Move down to this position
            duration: 600, // Drop duration
            ease: "Bounce.easeOut", // Smooth drop effect
            yoyo: true, // Move back up slightly
            onComplete: () => {
                // Remove the text after a delay
                this.time.delayedCall(1000, () => {
                    text.destroy();
                });
            }
        });
    }

    checkSufficientFunds(price){
        if(price>this.money){
            showAlert(this, "Insufficient Funds", '#ff0000')
        }
        return price<=this.money;
    }

    checkSufficientSeeds(seedAmnt){
        if(seedAmnt>this.seeds){
            showAlert(this, "Insufficient seeds", '#ff0000')
        }
        return seedAmnt<=this.seeds;
    }

    checkSufficientBerries(berryAmnt){
        if(berryAmnt>this.berries){
            showAlert(this, "Insufficient berries", '#ff0000')
        }
        return berryAmnt<=this.berries;
    }

    checkSufficientPermits(permitAmnt){
        if (permitAmnt > (this.permits ?? 0)) {
            showAlert(this, "Insufficient permits", '#ff0000');
        }
        return permitAmnt <= (this.permits ?? 0);
    }

    processEnemySelection(start, end) {
        const team1 = Teams.teamLists['1'];
        if (!team1) return;

        const x1 = Math.min(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const x2 = Math.max(start.x, end.x);
        const y2 = Math.max(start.y, end.y);

        const enemies = Teams.teamLists['0'].playerList.filter(enemy => {
            return enemy.x >= x1 && enemy.x <= x2 &&
                enemy.y >= y1 && enemy.y <= y2 &&
                enemy.active;
        });

        for (const enemy of enemies) {
            if (!team1.fightingList.includes(enemy)) {
                Teams.addTroopsToFight('1', enemy);
            }
        }

        fightManager.sendToAttack()
    }

    addTillPreviewSprite(x, y) {
        const key = `${x},${y}`;

        // already exists?
        if (this.tillPreviewSprites.has(key)) return;

        const spr = this.add.image(
            x * SQUARESIZE + SQUARESIZE / 2,
            y * SQUARESIZE + SQUARESIZE / 2,
            "tillOverlay"
        )
        .setDisplaySize(SQUARESIZE, SQUARESIZE)
        .setDepth(FLOORDEPTH)
        .setAlpha(0.6);

        this.tillPreviewSprites.set(key, spr);
    }

    addFarmSelectionPreviewSprite(x, y, tint = 0x52ff7a) {
        const key = `${x},${y}`;
        if (this.farmSelectionPreviewSprites.has(key)) return;

        const spr = this.add.image(
            x * SQUARESIZE + SQUARESIZE / 2,
            y * SQUARESIZE + SQUARESIZE / 2,
            "tillOverlay"
        )
        .setDisplaySize(SQUARESIZE, SQUARESIZE)
        .setDepth(FLOORDEPTH + 0.01)
        .setAlpha(0.72)
        .setTint(tint);

        this.farmSelectionPreviewSprites.set(key, spr);
    }

    renderFarmSelectionPreview(cells = []) {
        const desired = new Set();

        for (const cell of cells) {
            const key = `${cell.x},${cell.y}`;
            desired.add(key);

            const existing = this.farmSelectionPreviewSprites.get(key);
            if (existing) {
                existing.setTint(cell.tint ?? 0x52ff7a);
                continue;
            }

            this.addFarmSelectionPreviewSprite(cell.x, cell.y, cell.tint ?? 0x52ff7a);
        }

        for (const [key, spr] of this.farmSelectionPreviewSprites.entries()) {
            if (desired.has(key)) continue;
            spr.destroy();
            this.farmSelectionPreviewSprites.delete(key);
        }
    }

    clearFarmSelectionPreview() {
        for (const spr of this.farmSelectionPreviewSprites.values()) {
            spr.destroy();
        }
        this.farmSelectionPreviewSprites.clear();
    }

    syncTillPulseTween() {

        if (!this.tillPulseTween) {
            this.tillPulseTween = this.tweens.add({
                targets: Array.from(this.tillPreviewSprites.values()),
                alpha: { from: 0.4, to: 0.9 },
                duration: 700,
                ease: 'Sine.inOut',
                yoyo: true,
                repeat: -1
            });
        } else {
            this.tillPulseTween.targets = Array.from(this.tillPreviewSprites.values());
        }
    }

    enableTillFlash(x, y) {
        const key = `${x},${y}`;
        const spr = this.tillPreviewSprites.get(key);
        if (!spr) return;

        // already flashing? don't double-attach
        if (spr._flashTween) {
            return;
        }

        spr._flashTween = this.tweens.add({
            targets: spr,
            alpha: { from: 0.4, to: 0.9 },
            duration: 650,
            ease: 'Sine.inOut',
            yoyo: true,
            repeat: -1
        });
    }

    removeTillPreviewSprite(x, y) {
        const key = `${x},${y}`;
        const spr = this.tillPreviewSprites.get(key);
        if (!spr) return;

        this.tillPreviewSprites.delete(key);

        if (spr._flashTween) {
            spr._flashTween.remove();
            spr._flashTween = null;
        }

        spr.destroy();
    }

    startStageCompleteSequence(stageIndex, meta) {
        if (this.stageCompleteLock) return;
        this.stageCompleteLock = true;

        const cam = this.cameras.main;

        // lock camera/inputs immediately, but keep simulation running for troop evacuation
        this._movementLocked = true;

        // Stop tower-spawned pressure parcels from continuing to spawn/attack
        // during the stage-end cinematic and reward flow.
        this.parcelManager?.stopTowerPressureForStageEnd?.();

        // Send friendlies out of fort before reward selection.
        this._sendFortPlayersBackToTown(meta);

        // Force zoom-in cinematic framing.
        if (this.zoomMixer) {
            this.zoomMixer.targetZoom = 1;
            this.zoomMixer.smoothCenterZoomTo(1, 250);
        }

        // Disable zoom changes during stage-end sequence.
        this.zoomMixer?.setZoomOutLocked?.(true);

        this.tweens.add({
            targets: cam,
            scrollX: 50 * SQUARESIZE - cam.width / 2,
            scrollY: 24.5 * SQUARESIZE - cam.height / 2,
            duration: 450,
            ease: 'Quad.easeInOut',
            onComplete: () => {
                this.zoomMixer?.smoothCenterZoomTo(1, 200);

                AudioManager.playSound('sfx_end_stage_explosions');
                this.cameras.main.shake(1000, 0.01);

                this.tweens.add({
                    targets: this.cameras.main,
                    zoom: { from: 1.01, to: 1 },
                    duration: 1000,
                    ease: 'Quad.easeOut'
                });

                this._playFortExplosions(meta, () => {
                    this._showStageCompletedGhost(stageIndex);

                    // Wait until all friendly fighters have moved south of the fort bottom edge.
                    this._waitForFortEvacuation(meta, null, () => {
                        this._openFortRewards(stageIndex, meta);
                    });
                });

                // Remove enemy fort grunts right as the explosion sequence starts.
                this.parcelManager?.clearAllFortGrunts?.();
            }
        });
    }

    _openFortRewards(stageIndex, meta) {
        // Now freeze gameplay for selection.
        this.clock.paused = true;
        this.applySimulationSpeed(true);

        const finalizeStageCompletion = () => {
            const permitReward = getStagePermitReward(
                StageState.stageIndex,
                StageState.seasonIndex,
                StageState.STAGES_PER_SEASON
            );
            this.updatePermits(permitReward);
            showAlert(
                this,
                `North Fort cleared: +${permitReward} permit${permitReward === 1 ? "" : "s"}`,
                "#d8b4fe"
            );

            // Stage transition cleanup:
            // - remove only tower-spawned pressure parcels + their raiders
            // - keep manually started pressure contracts alive (they remain paused during rewards)
            this.parcelManager?.forceClearPressureContracts?.("stage_end_cleanup", { onlyTowerSpawned: true });
            // Remove all fort grunts from the previous fort cycle.
            this.parcelManager?.clearAllFortGrunts?.();

            // Progress stage/season AFTER reward is chosen.
            StageState.completeFortCycle(
                { reason: 'fort_reward_collected' },
                { stagesPerSeason: StageState.STAGES_PER_SEASON }
            );

            // Fully clear old fort state and give the next stage a short breather
            // before the replacement North Fort arrives.
            const mainIslandOrigin = this.parcelManager?.mainIslandOrigin ?? PARCEL.MAIN_ORIGIN;
            this.scheduleNorthFortArrival({
                delayDays: 1,
                reason: 'fort_cleared',
                mainIslandOrigin,
                oldMeta: meta,
            });

            // Release sequence locks.
            this._movementLocked = false;
            this.stageCompleteLock = false;
            this.clock.paused = false;
            this.applySimulationSpeed(true);
            this.zoomMixer?.setZoomOutLocked?.(false);
            this._stageHud?.recompute?.();
            this.events.emit('stage:changed');
            this.events.emit('season:changed');
        };

        const maybeOpenBossUnlockReward = () => {
            if (!StageState.isBossStage(stageIndex)) {
                finalizeStageCompletion();
                return;
            }

            const bossReward = getBossUnlockReward(stageIndex, StageState.seasonIndex);
            if (!bossReward) {
                finalizeStageCompletion();
                return;
            }

            this._activeBossRewardUI?.destroy?.();
            this._activeBossRewardUI = openBossUnlockRewardPresentation(this, {
                reward: bossReward,
                onComplete: () => {
                    this._activeBossRewardUI = null;
                    finalizeStageCompletion();
                }
            });
        };

        this._activeRewardUI?.destroy?.();
        this._activeRewardUI = openFortRewardSelection(this, {
            stageIndex,
            meta,
            onComplete: () => {
                this._activeRewardUI = null;
                maybeOpenBossUnlockReward();
            }
        });
    }

    _waitForFortEvacuation(metaOrBounds, timeoutMs = 7000, done = null) {
        const bounds = this._resolveFortEvacBounds(metaOrBounds);
        if (!bounds) {
            done?.();
            return;
        }

        const startedAt = this.time.now;

        const tick = () => {
            const elapsed = this.time.now - startedAt;
            // Keep re-issuing return orders while sequence runs.
            this._sendFortPlayersBackToTown(metaOrBounds);

            const allOut = this._areFortFightersBelowBottom(metaOrBounds);

            if (allOut) {
                done?.();
                return;
            }

            if (timeoutMs != null && elapsed >= timeoutMs) {
                done?.();
                return;
            }

            this.time.delayedCall(150, tick);
        };

        tick();
    }

    _areFortPlayersStillInside(bounds) {
        const team = Teams.teamLists?.['1'];
        const players = team?.playerList || [];

        for (const troop of players) {
            if (!troop?.active || !troop.body) continue;
            if (!this._isFriendlyFighter(troop)) continue;

            const gx = Math.floor(troop.x / SQUARESIZE);
            const gy = Math.floor(troop.y / SQUARESIZE);
            const inside = gx >= bounds.minx && gx <= bounds.maxx && gy >= bounds.miny && gy <= bounds.maxy;
            if (inside) return true;
        }

        return false;
    }

    _sendFortPlayersBackToTown(metaOrBounds) {
        const bounds = this._resolveFortEvacBounds(metaOrBounds);
        if (!bounds) return;

        const team = Teams.teamLists?.['1'];
        const players = team?.fighterList || [];

        for (const troop of players) {
            if (!troop?.active || !troop.body) continue;
            if (!this._isFriendlyFighter(troop)) continue;

            const gy = Math.floor(troop.y / SQUARESIZE);
            if (gy > bounds.maxy) continue;

            Teams.sendTroopToTown(troop);
        }
    }

    _areFortFightersBelowBottom(metaOrBounds) {
        const bounds = this._resolveFortEvacBounds(metaOrBounds);
        if (!bounds) return true;
        const team = Teams.teamLists?.['1'];
        const fighters = team?.fighterList || [];

        for (const troop of fighters) {
            if (!troop?.active || !troop.body) continue;
            if (!this._isFriendlyFighter(troop)) continue;

            const gy = Math.floor(troop.y / SQUARESIZE);
            if (gy <= bounds.maxy) return false;
        }
        return true;
    }

    _resolveFortEvacBounds(metaOrBounds) {
        // Prefer full fort parcel bounds (25x25). Fall back to objective bounds.
        if (metaOrBounds?.refs?.parcelBounds) return metaOrBounds.refs.parcelBounds;
        if (metaOrBounds?.parcelBounds) return metaOrBounds.parcelBounds;
        if (metaOrBounds?.bounds) return metaOrBounds.bounds;
        if (
            metaOrBounds &&
            Number.isFinite(metaOrBounds.minx) &&
            Number.isFinite(metaOrBounds.miny) &&
            Number.isFinite(metaOrBounds.maxx) &&
            Number.isFinite(metaOrBounds.maxy)
        ) {
            return metaOrBounds;
        }
        return null;
    }

    _forceEvacuateFortPlayers(bounds) {
        if (!bounds) return;

        const roads = townRoads['1'] || [];
        if (!roads.length) return;

        const team = Teams.teamLists?.['1'];
        const players = team?.playerList || [];

        for (const troop of players) {
            if (!troop?.active || !troop.body) continue;
            if (!this._isFriendlyFighter(troop)) continue;

            const gx = Math.floor(troop.x / SQUARESIZE);
            const gy = Math.floor(troop.y / SQUARESIZE);
            const inside = gx >= bounds.minx && gx <= bounds.maxx && gy >= bounds.miny && gy <= bounds.maxy;
            if (!inside) continue;

            const [tx, ty] = Phaser.Utils.Array.GetRandom(roads);
            const px = tx * SQUARESIZE + SQUARESIZE / 2;
            const py = ty * SQUARESIZE + SQUARESIZE / 2;

            troop.setVelocity?.(0, 0);
            if (typeof troop.body.reset === 'function') {
                troop.body.reset(px, py);
            } else {
                troop.setPosition?.(px, py);
            }

            Teams.sendTroopToTown(troop);
        }
    }

    _isFriendlyFighter(troop) {
        return !!(troop?.isBrawler || troop?.isBlademaster || troop?.isGunslinger);
    }

    _getTowerCenter(meta) {
        const tower = meta?.refs?.tower;

        if (tower?.sprite) {
            return {
            x: tower.sprite.x,
            y: tower.sprite.y
            };
        }

        const b = meta?.bounds;
        return {
            x: ((b.minx + b.maxx) / 2) * SQUARESIZE,
            y: ((b.miny + b.maxy) / 2) * SQUARESIZE
        };
    }

    _playFortExplosions(meta, onDone) {
        const bounds = meta?.bounds;
        const tower = meta?.refs?.tower;

        const spots = [];

        // ⭐ EXACT tower explosion
        if (tower?.sprite) {
            spots.push({
            x: tower.sprite.x,
            y: tower.sprite.y
            });
        }

        // remaining explosions (4 total minimum)
        const extraCount = Phaser.Math.Between(3, 4);

        for (let i = 0; i < extraCount; i++) {
            const gx = Phaser.Math.Between(bounds.minx + 1, bounds.maxx - 1);
            const gy = Phaser.Math.Between(bounds.miny + 1, bounds.maxy - 1);

            spots.push({
            x: gx * SQUARESIZE + SQUARESIZE / 2,
            y: gy * SQUARESIZE + SQUARESIZE / 2
            });
        }

        let finished = 0;

        spots.forEach(p => {
            const fx = this.add.sprite(p.x, p.y, 'explosions')
            .setDepth(9999);

            fx.play('explosions');

            fx.once('animationcomplete', () => {
            fx.destroy();
            finished++;
            if (finished === spots.length) onDone?.();
            });
        });
    }

    _fadeOutFortStructures(meta) {
        const track = meta?.refs?.fortTrack;
        const bounds = meta?.bounds;
        if (bounds) {
            VisibilitySystem.clearSourcesInBounds(bounds.minx, bounds.miny, bounds.maxx, bounds.maxy);
        }

        // Best path: fade ONLY tracked fort sprites
        if (track?.sprites?.length) {
            // optionally also disable their physics bodies
            (track.bodies || []).forEach(b => { try { b.enable = false; } catch(e){} });

            this.tweens.add({
            targets: track.sprites,
            alpha: 0,
            duration: 550,
            ease: 'Quad.easeInOut',
            onComplete: () => {
                track.sprites.forEach(s => { if (s?.destroy) s.destroy(); });
            }
            });
            return;
        }

        // Fallback (if something was not tracked yet): do nothing.
    }

    _showStageCompletedGhost(stageIndex) {

        const txt = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            `STAGE ${stageIndex} COMPLETED`,
            {
            fontFamily: 'Bungee',
            fontSize: '72px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
            }
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(99999)
        .setAlpha(0);


        this.tweens.add({
            targets: txt,
            alpha: 1,
            duration: 250,
            yoyo: true,
            hold: 1000,
            onComplete: () => txt.destroy()
        });
    }

}





const config = {
    type: Phaser.AUTO,
    parent: "game",            // or whatever div id you use
    dom: { createContainer: true },  // <-- THIS fixes the error
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1e6f93',
    scene: [mapView, GameUIScene, itemTab],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    plugins: {
        scene: [
            {
                key: 'rexUI',
                plugin: UIPlugin,
                mapping: 'rexUI'
            }
        ]
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    }
};


new Phaser.Game(config);











