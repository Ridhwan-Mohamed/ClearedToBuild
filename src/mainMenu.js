import logo from 'url:../public/logo.png'
import logoMini from 'url:../public/logoMini.png'
import { TILE_MAP, TILE_TYPES, UIDEPTH, colorFor, create2DArray, PARCEL, showAlert } from './constants';
import { generateTown, buildingArray, townBounds, townRoads } from './town.js';
import { Map } from './map.js';
import { Teams } from './Teams.js';
import { Player } from './players/Player.js';
import worldMap from 'url:./assets/worldMap.png'
import townIcon from 'url:./assets/houseIcon.png'
import { SQUARESIZE } from './constants';
import { NavMeshUpdater } from './lib/navmesh/NavMeshUpdater.js';
import { ZoomMixer } from './UI/ZoomMixer.js';
import { NavMesh } from './lib/navmesh/navmesh.js';
import { GameStart } from './Controllers/GameStart.js';
import { buildingManager } from './Manager/buildingManager.js';
import { blockResourceManager } from './Manager/BlockResourceManager.js';
import { teamSetupArray } from './constants';
import { buildWaterQuadtree } from './lib/waterQuadTree.js'
import start from 'url:./assets/start.png'
import continueAsset from 'url:./assets/continue.png'
import playButton from 'url:./assets/playButton.png'
import yesButton from 'url:./assets/yes.png'
import noButton from 'url:./assets/no.png'
import { VisibilitySystem } from './UI/VisibilitySystem.js';
import { PathRegistry } from './lib/navmesh/PathRegistry.js';
import { PathRepair } from './lib/navmesh/PathRepair.js';
import { RegionSystem } from './lib/navmesh/RegionSystem.js';
import { RegionDebugDrawer } from './lib/navmesh/RegionDebugDrawer.js';
import { DraftStartMenu } from './UI/DraftUI/DraftStartMenu.js';
import { ParcelSpawnController } from './parcelSpawn/ParcelSpawnController.js';
import { ParcelManager } from './parcel_system/ParcelManager.js';
import { buildPolysFromGridMap } from './lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import { StageState } from './parcelController/StageState.js';
import { paintOverviewTexture } from './UI/OverviewStylePainter.js';
import { getRunStoreUnlockKeys, grantHordeUnlockCatchup } from './parcel_system/HordeUnlockTrack.js';
import { resetStoreUnlocks } from './parcel_system/StoreUnlockSystem.js';
import { SaveManager } from './save/SaveManager.js';
import { prepareSnapshotWorldForBoot } from './save/RunSnapshotLoader.js';
import { Scheduler } from './ai/scheduler/Scheduler.js';
import { OrderRunner } from './orders/OrderRunner.js';
import { AudioManager } from './Manager/AudioManager.js';
export var waterSourcesQuadTree;

export class MainMenu {
    static scene = null;
    static _pendingRestartReveal = null;

    static queueRestartReveal(opts = {}) {
        MainMenu._pendingRestartReveal = {
            color: opts.color ?? 0x64b9ff,
            fadeOutDuration: Math.max(220, Number(opts.fadeOutDuration) || 720),
        };
    }

    static _consumeRestartReveal() {
        const reveal = MainMenu._pendingRestartReveal;
        MainMenu._pendingRestartReveal = null;
        return reveal;
    }

    static _getOverlayScene(scene, opts = {}) {
        if (!scene) return null;
        const uiScene = scene.uiScene || scene.scene?.get?.('GameUIScene') || null;
        const uiActive = !!uiScene?.sys?.isActive?.();
        if (opts.requireActive) {
            return uiActive ? uiScene : null;
        }
        return uiActive ? uiScene : scene;
    }

    static _buildNavGridFromGridData(gridData) {
        if (!Array.isArray(gridData) || !Array.isArray(gridData[0])) return [];
        const height = gridData.length;
        const width = gridData[0].length;
        const navGrid = create2DArray(height, width);

        for (let y = 0; y < height; y++) {
            const row = gridData[y];
            if (!Array.isArray(row)) continue;
            for (let x = 0; x < width; x++) {
                const cell = row[x];
                const topVal = Array.isArray(cell) ? cell[cell.length - 1] : cell;
                const typeName = TILE_MAP(topVal);
                const type = typeName ? TILE_TYPES[typeName] : null;
                navGrid[y][x] = type?.block ? 0 : 1;
            }
        }

        return navGrid;
    }

    static _ensureNavGridForScene(scene, snapshot = null) {
        const savedNavGrid = snapshot?.world?.navGrid;
        if (Array.isArray(savedNavGrid) && Array.isArray(savedNavGrid[0])) {
            Map.navGrid = typeof structuredClone === 'function'
                ? structuredClone(savedNavGrid)
                : JSON.parse(JSON.stringify(savedNavGrid));
            return Map.navGrid;
        }

        if (Array.isArray(Map.navGrid) && Array.isArray(Map.navGrid[0])) {
            return Map.navGrid;
        }

        Map.navGrid = MainMenu._buildNavGridFromGridData(scene?.gridData);
        return Map.navGrid;
    }

    static _ensureZoomMixer(scene) {
        if (!scene) return null;
        if (scene.zoomMixer) return scene.zoomMixer;
        scene.zoomMixer = new ZoomMixer();
        if (scene.menuPreview) scene.zoomMixer.overviewImage = scene.menuPreview;
        if (scene.mapTexKey) scene.zoomMixer.texKey = scene.mapTexKey;
        scene.zoomMixer.mode = scene.menuPreview ? 'overview' : 'detailed';
        return scene.zoomMixer;
    }

    static _forceDetailedWorld(scene, zoomMixer) {
        if (!scene) return;
        scene.keyboardSpeed = 10;
        scene.parcelSpawnUI?.setMode?.("detailed");
        scene.parcelSpawnUI?.setVisible?.(true);
        Map.setDetailedWorldVisible?.(true);
        VisibilitySystem.setOverviewMode(false);
        Map.reDraw?.();
        if (zoomMixer?.overviewImage) {
            zoomMixer.overviewImage.setAlpha?.(0);
            zoomMixer.overviewImage.setVisible?.(false);
        }
        if (ZoomMixer.mapIconContainer) {
            ZoomMixer.mapIconContainer.setAlpha?.(0);
            ZoomMixer.mapIconContainer.setVisible?.(false);
        }
        if (zoomMixer) zoomMixer.mode = 'detailed';
    }

    static _resumeFriendlyTroops(scene) {
        if (!scene) return;
        for (const troop of Player.troops || []) {
            if (!troop?.active) continue;
            if (Number(troop.body?.team ?? troop._teamNumber ?? 0) !== 1) continue;
            if (troop.timer && typeof troop.timer.remove === "function") {
                troop.timer.remove(false);
                troop.timer = null;
            }
            if (OrderRunner.stepUnit(troop)) continue;
            Scheduler.stepUnit(troop);
        }
    }

    static _createStartButton(overlayScene, x, y, opts = {}) {
        const buttonWidth = Phaser.Math.Clamp(Math.round(overlayScene.scale.width * 0.19), 260, 360);
        const buttonHeight = Phaser.Math.Clamp(Math.round(overlayScene.scale.height * 0.09), 82, 102);
        const radius = Math.round(buttonHeight * 0.42);
        const artKey = opts.artKey ?? 'startBtn';
        const titleText = opts.titleText ?? null;
        const hintText = opts.hintText ?? 'Click To Begin';
        const hideHint = opts.hideHint === true;
        const panelColor = opts.panelColor ?? 0x205f97;
        const glowColor = opts.glowColor ?? 0x8de7ff;
        const artScaleMultiplier = Number(opts.artScaleMultiplier ?? 1);

        const root = overlayScene.add.container(x, y);
        const glow = overlayScene.add.ellipse(0, 12, buttonWidth * 1.08, buttonHeight * 1.18, glowColor, 0.16);

        const shadow = overlayScene.add.graphics();
        shadow.fillStyle(0x071a28, 0.30);
        shadow.fillRoundedRect(-buttonWidth / 2, (-buttonHeight / 2) + 7, buttonWidth, buttonHeight, radius);

        const panel = overlayScene.add.graphics();
        panel.fillStyle(panelColor, 0.96);
        panel.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, radius);
        panel.fillStyle(0xffffff, 0.08);
        panel.fillRoundedRect(
            (-buttonWidth / 2) + 12,
            (-buttonHeight / 2) + 10,
            buttonWidth - 24,
            Math.max(18, Math.round(buttonHeight * 0.34)),
            Math.max(8, radius - 10),
        );
        panel.lineStyle(3, 0xffffff, 0.16);
        panel.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, radius);

        const hit = overlayScene.add
            .rectangle(0, 0, buttonWidth, buttonHeight, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });

        let buttonArt;
        let baseArtScale = 1;
        if (artKey) {
            buttonArt = overlayScene.add.image(0, -6, artKey).setOrigin(0.5);
            baseArtScale = Phaser.Math.Clamp((buttonWidth * 0.76) / Math.max(buttonArt.width || 1, 1), 1.55, 2.35);
            baseArtScale *= Phaser.Math.Clamp(artScaleMultiplier, 0.3, 1.4);
            buttonArt.setScale(baseArtScale);
        } else {
            buttonArt = overlayScene.add.text(0, -6, titleText || 'Continue', {
                fontSize: `${Math.max(22, Math.round(buttonHeight * 0.34))}px`,
                color: '#ffffff',
                fontFamily: 'Bungee',
                stroke: '#0a1723',
                strokeThickness: 5,
            }).setOrigin(0.5);
            baseArtScale = 1;
        }

        const buttonHint = hideHint
            ? null
            : overlayScene.add.text(0, Math.round(buttonHeight * 0.27), hintText, {
                fontSize: '14px',
                color: '#effaff',
                fontFamily: 'Bungee',
                stroke: '#0a1723',
                strokeThickness: 3,
            }).setOrigin(0.5).setAlpha(0.82);

        root.add([glow, shadow, panel, hit, buttonArt, ...(buttonHint ? [buttonHint] : [])]);
        root.buttonHit = hit;
        root.buttonGlow = glow;
        root.buttonArt = buttonArt;
        root.buttonHint = buttonHint;
        root._artBaseScale = baseArtScale;
        return root;
    }

    static _createMainMenuImageButton(overlayScene, x, y, opts = {}) {
        const artKey = opts.artKey ?? 'startBtn';
        const widthFactor = Number(opts.widthFactor ?? 0.18);
        const maxWidth = Number(opts.maxWidth ?? 320);
        const minWidth = Number(opts.minWidth ?? 220);
        const lift = Number(opts.lift ?? 0);
        const alpha = Number(opts.alpha ?? 1);

        const targetWidth = Phaser.Math.Clamp(
            Math.round(overlayScene.scale.width * widthFactor),
            minWidth,
            maxWidth
        );

        const root = overlayScene.add.container(x, y);
        const art = overlayScene.add.image(0, lift, artKey).setOrigin(0.5).setAlpha(alpha);
        const baseScale = targetWidth / Math.max(art.width || 1, 1);
        art.setScale(baseScale);

        const hit = overlayScene.add
            .rectangle(0, lift, Math.max(targetWidth * 0.96, 180), Math.max((art.height || 48) * baseScale * 0.92, 60), 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });

        root.add([art, hit]);
        root.buttonHit = hit;
        root.buttonArt = art;
        root.buttonGlow = null;
        root._artBaseScale = baseScale;
        root._hoverTween = null;
        root._hoverLift = Number(opts.hoverLift ?? 8);
        root._baseY = y;
        root._neighborPush = Number(opts.neighborPush ?? 18);
        return root;
    }

    static _getViewportSize(overlayScene = null) {
        const cam = MainMenu.scene?.cameras?.main ?? overlayScene?.cameras?.main;
        const fallbackWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
        const fallbackHeight = typeof window !== "undefined" ? window.innerHeight : 720;
        const width = Number(cam?.width ?? overlayScene?.scale?.width ?? fallbackWidth);
        const height = Number(cam?.height ?? overlayScene?.scale?.height ?? fallbackHeight);
        return {
            width: Math.max(1, width),
            height: Math.max(1, height),
        };
    }

    static _getMainIslandCenterWorld(scene = MainMenu.scene, snapshot = null) {
        const savedOrigin = snapshot?.world?.mainIslandOrigin;
        const snapshotOrigin = Number.isFinite(savedOrigin?.x) && Number.isFinite(savedOrigin?.y)
            ? { x: savedOrigin.x, y: savedOrigin.y }
            : null;
        const liveBounds = !snapshotOrigin && typeof scene?._getMainIslandBounds === "function"
            ? scene._getMainIslandBounds()
            : null;
        const origin =
            snapshotOrigin
            ?? (liveBounds ? { x: liveBounds.minx, y: liveBounds.miny } : null)
            ?? scene?.parcelManager?.mainIslandOrigin
            ?? scene?._northFortMainIslandOrigin
            ?? PARCEL.MAIN_ORIGIN;
        const islandSize = liveBounds
            ? Math.max(1, Number((liveBounds.maxx - liveBounds.minx + 1) || PARCEL.SIZE || 25))
            : Math.max(1, Number(PARCEL.SIZE || 25));

        return {
            x: (Number(origin.x) + (islandSize * 0.5)) * SQUARESIZE,
            y: (Number(origin.y) + (islandSize * 0.5)) * SQUARESIZE,
            origin,
            islandSize,
            liveBounds,
        };
    }

    static _cameraPoseFromCenter(centerX, centerY, targetZoom, overlayScene = null) {
        const zoom = Math.max(0.0001, Number(targetZoom || 1));
        const viewport = MainMenu._getViewportSize(overlayScene);
        return {
            centerX,
            centerY,
            targetZoom: zoom,
            targetScrollX: centerX - ((viewport.width * 0.5) / zoom),
            targetScrollY: centerY - ((viewport.height * 0.5) / zoom),
        };
    }

    static _getMinZoomForNonNegativeScroll(centerX, centerY, overlayScene = null) {
        const viewport = MainMenu._getViewportSize(overlayScene);
        const minZoomX = centerX > 0 ? (viewport.width * 0.5) / centerX : 0;
        const minZoomY = centerY > 0 ? (viewport.height * 0.5) / centerY : 0;
        return Math.max(0, minZoomX, minZoomY);
    }

    static _lockStartupCameraCenter(scene, center) {
        if (!scene || !Number.isFinite(center?.x) || !Number.isFinite(center?.y)) return null;
        scene._startupCameraCenter = { x: center.x, y: center.y };
        return scene._startupCameraCenter;
    }

    static _getDraftCameraPose(scene, overlayScene = scene, snapshot = null) {
        const islandPose = MainMenu._getMainIslandOverviewPose(scene, overlayScene, snapshot);
        if (islandPose) {
            return islandPose;
        }

        const tex = scene?.textures?.get?.('worldMap');
        const img = tex?.getSourceImage?.();
        if (!img) return null;

        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const worldW = srcW * SQUARESIZE;
        const worldH = srcH * SQUARESIZE;
        const targetZoom = 0.72;
        const targetCenterX = worldW / 2;
        const targetCenterY = worldH / 2;

        return MainMenu._cameraPoseFromCenter(targetCenterX, targetCenterY, targetZoom, overlayScene);
    }

    static _getCameraScrollCenter(cam) {
        if (!cam) return null;
        const zoom = Math.max(0.0001, Number(cam.zoom || 1));
        return {
            x: cam.scrollX + ((cam.width * 0.5) / zoom),
            y: cam.scrollY + ((cam.height * 0.5) / zoom),
        };
    }

    static _applyCameraPose(cam, pose) {
        if (!cam || !pose) return;
        const zoom = Math.max(0.0001, Number(pose.targetZoom || cam.zoom || 1));
        const centerX = Number.isFinite(pose.centerX)
            ? pose.centerX
            : (Number.isFinite(pose.targetScrollX) ? pose.targetScrollX + ((cam.width * 0.5) / zoom) : null);
        const centerY = Number.isFinite(pose.centerY)
            ? pose.centerY
            : (Number.isFinite(pose.targetScrollY) ? pose.targetScrollY + ((cam.height * 0.5) / zoom) : null);
        const scrollX = Number.isFinite(centerX)
            ? centerX - ((cam.width * 0.5) / zoom)
            : Number(pose.targetScrollX || 0);
        const scrollY = Number.isFinite(centerY)
            ? centerY - ((cam.height * 0.5) / zoom)
            : Number(pose.targetScrollY || 0);

        cam.setZoom(zoom);
        cam.setScroll(scrollX, scrollY);
        cam.scrollX = scrollX;
        cam.scrollY = scrollY;
    }

    static _getPlacedBounds(placedBuildings = null) {
        if (!Array.isArray(placedBuildings) || !placedBuildings.length) return null;

        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (const building of placedBuildings) {
            const typeKey = building?.typeKey ?? building?.type;
            const type = TILE_TYPES[typeKey] || TILE_TYPES[building?.type] || { lenX: 1, lenY: 1 };
            const bx = building?.x ?? 0;
            const by = building?.y ?? 0;
            minx = Math.min(minx, bx);
            miny = Math.min(miny, by);
            maxx = Math.max(maxx, bx + (type.lenX || 1) - 1);
            maxy = Math.max(maxy, by + (type.lenY || 1) - 1);
        }

        if (!Number.isFinite(minx)) return null;
        return { minx, miny, maxx, maxy };
    }

    static _getLiveTeamBuildingEntries(teamId = "1") {
        const team = Teams.teamLists?.[String(teamId)];
        if (!Array.isArray(team?.buildings) || !team.buildings.length) return [];

        return team.buildings
            .map((entry) => {
                const x = Number(entry?.[0]);
                const y = Number(entry?.[1]);
                const type = entry?.[2];
                if (!Number.isFinite(x) || !Number.isFinite(y) || !type) return null;
                return {
                    x,
                    y,
                    typeKey: type?.name ?? type?.typeKey ?? type?.type ?? null,
                    type,
                };
            })
            .filter(Boolean);
    }

    static _getTownFocusPose(scene, overlayScene = scene, placedBuildings = null) {
        const placedBounds = MainMenu._getPlacedBounds(placedBuildings);
        const fallback = MainMenu._getDraftCameraPose(scene, overlayScene);
        if (!placedBounds) return fallback;

        const padTilesX = 11;
        const padTilesY = 11;
        const minx = placedBounds.minx - padTilesX;
        const miny = placedBounds.miny - padTilesY;
        const maxx = placedBounds.maxx + padTilesX;
        const maxy = placedBounds.maxy + padTilesY;

        const worldMinX = minx * SQUARESIZE;
        const worldMinY = miny * SQUARESIZE;
        const worldMaxX = (maxx + 1) * SQUARESIZE;
        const worldMaxY = (maxy + 1) * SQUARESIZE;
        const worldW = Math.max(SQUARESIZE * 10, worldMaxX - worldMinX);
        const worldH = Math.max(SQUARESIZE * 10, worldMaxY - worldMinY);
        const islandCenter = MainMenu._getMainIslandCenterWorld(scene);
        const centerX = islandCenter.x;
        const centerY = islandCenter.y;
        const viewport = MainMenu._getViewportSize(overlayScene);

        const fitZoom = Math.min(
            (viewport.width * 0.49) / worldW,
            (viewport.height * 0.55) / worldH,
        );
        const targetZoom = Phaser.Math.Clamp(fitZoom, 0.88, 1.55);

        return MainMenu._cameraPoseFromCenter(centerX, centerY, targetZoom, overlayScene);
    }

    static _getLiveTownFocusPose(scene, overlayScene = scene, snapshot = null) {
        const liveBuildings = MainMenu._getLiveTeamBuildingEntries("1");
        if (liveBuildings.length) {
            return MainMenu._getTownFocusPose(scene, overlayScene, liveBuildings);
        }

        const savedBuildings = snapshot?.teams?.["1"]?.buildings;
        if (Array.isArray(savedBuildings) && savedBuildings.length) {
            return MainMenu._getTownFocusPose(scene, overlayScene, savedBuildings);
        }

        return MainMenu._getTownFocusPose(scene, overlayScene, null);
    }

    static _getMainIslandOverviewPose(scene, overlayScene = scene, snapshot = null) {
        const islandCenter = MainMenu._getMainIslandCenterWorld(scene, snapshot);
        const origin = islandCenter.origin;
        const islandSize = islandCenter.islandSize;
        const padTiles = 9;
        const minx = origin.x - padTiles;
        const miny = origin.y - padTiles;
        const maxx = origin.x + islandSize + padTiles - 1;
        const maxy = origin.y + islandSize + padTiles - 1;

        const worldMinX = minx * SQUARESIZE;
        const worldMinY = miny * SQUARESIZE;
        const worldMaxX = (maxx + 1) * SQUARESIZE;
        const worldMaxY = (maxy + 1) * SQUARESIZE;
        const worldW = Math.max(SQUARESIZE * 10, worldMaxX - worldMinX);
        const worldH = Math.max(SQUARESIZE * 10, worldMaxY - worldMinY);
        const centerX = islandCenter.x;
        const centerY = islandCenter.y;
        const viewport = MainMenu._getViewportSize(overlayScene);

        const fitZoom = Math.min(
            (viewport.width * 0.68) / worldW,
            (viewport.height * 0.66) / worldH,
        );
        const minCenteredZoom = MainMenu._getMinZoomForNonNegativeScroll(centerX, centerY, overlayScene);
        const targetZoom = Phaser.Math.Clamp(Math.max(fitZoom, minCenteredZoom), 0.35, 0.86);

        return MainMenu._cameraPoseFromCenter(centerX, centerY, targetZoom, overlayScene);
    }

    static _setTroopPresentationVisible(scene, visible = true) {
        if (!scene) return;
        const alpha = visible ? 1 : 0;
        for (const troop of Player.troops || []) {
            if (!troop?.active) continue;
            troop.setVisible?.(visible);
            troop.setAlpha?.(alpha);
            troop._carryIndicator?.setVisible?.(false);
            troop._selectionIndicator?.setVisible?.(false);
            Player._hideMiniBars?.(troop);
        }
    }

    static _prepareContinueOverviewPresentation(scene, zoomMixer, snapshot, pose) {
        if (!scene || !zoomMixer || !pose) return;

        zoomMixer.buildOverviewTextureFromGrid(Map.grid, SQUARESIZE, (cell) => colorFor(cell));

        const cam = scene.cameras.main;
        MainMenu._applyCameraPose(cam, pose);
        MainMenu._lockStartupCameraCenter(scene, { x: pose.centerX, y: pose.centerY });

        zoomMixer.targetZoom = pose.targetZoom;
        zoomMixer.anchorWorld = Number.isFinite(pose.centerX) && Number.isFinite(pose.centerY)
            ? { x: pose.centerX, y: pose.centerY }
            : MainMenu._getCameraScrollCenter(cam);
        zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };
        zoomMixer.mode = "overview";

        scene.keyboardSpeed = 30;
        scene.parcelSpawnUI?.setMode?.("overview");
        scene.parcelSpawnUI?.setVisible?.(true);
        scene._setOceanBackdropMode?.("overview");

        Map.setDetailedWorldVisible?.(false);
        Map.deleteAllGridElements?.();
        VisibilitySystem.setOverviewMode(true);

        const overviewImage = zoomMixer.ensureOverviewImage?.();
        overviewImage?.setVisible?.(true);
        overviewImage?.setAlpha?.(1);

        if (ZoomMixer.mapIconContainer) {
            ZoomMixer.mapIconContainer.setAlpha?.(0);
            ZoomMixer.mapIconContainer.setVisible?.(false);
        }

        MainMenu._setTroopPresentationVisible(scene, false);
        scene.uiScene?.playMenuHudIntro?.(true);
    }

    static _restoreDetailedPresentation(scene, zoomMixer) {
        if (!scene) return;

        VisibilitySystem.init(scene);
        if (zoomMixer?.mode !== 'detailed') {
            zoomMixer.swapMode?.('detailed');
        } else {
            MainMenu._forceDetailedWorld(scene, zoomMixer);
        }

        scene._setOceanBackdropMode?.("detailed");
        MainMenu._setTroopPresentationVisible(scene, true);
    }

    static _stageContinueMenuCamera(snapshot) {
        const scene = MainMenu.scene;
        if (!scene || !snapshot?.world?.grid) return;

        scene._pendingContinueSnapshot = snapshot;
        const overlayScene = MainMenu._getOverlayScene(scene) || scene;
        const pose = MainMenu._getDraftCameraPose(scene, overlayScene, snapshot);
        const cam = scene.cameras.main;
        const zoomMixer = MainMenu._ensureZoomMixer(scene);

        cam.stopFollow?.();
        MainMenu._applyCameraPose(cam, pose);
        MainMenu._lockStartupCameraCenter(scene, { x: pose.centerX, y: pose.centerY });

        if (zoomMixer) {
            zoomMixer.targetZoom = pose.targetZoom;
            zoomMixer.anchorWorld = Number.isFinite(pose.centerX) && Number.isFinite(pose.centerY)
                ? { x: pose.centerX, y: pose.centerY }
                : MainMenu._getCameraScrollCenter(cam);
            zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };
            zoomMixer.mode = "overview";
        }

        Map.setDetailedWorldVisible?.(false);
        VisibilitySystem.setOverviewMode(true);
        scene._setOceanBackdropMode?.("overview");

        if (scene.menuPreview?.active) {
            scene.menuPreview.setVisible(true).setAlpha(1);
        }
        if (ZoomMixer.mapIconContainer) {
            ZoomMixer.mapIconContainer.setVisible?.(false);
            ZoomMixer.mapIconContainer.setAlpha?.(0);
        }

        MainMenu._setTroopPresentationVisible(scene, false);
    }

    static _setDraftPreviewVisibility(show, opts = {}) {
        const scene = MainMenu.scene;
        if (!scene) return;

        const overlayScene = MainMenu._getOverlayScene(scene) || scene;
        const cam = scene.cameras.main;
        const duration = opts.immediate ? 0 : (show ? 520 : 360);
        const pose = show
            ? MainMenu._getTownFocusPose(scene, overlayScene, opts.placedBuildings)
            : MainMenu._getDraftCameraPose(scene, overlayScene);
        const currentCenter = MainMenu._getCameraScrollCenter(cam);
        const zoomOnlyPose = pose && currentCenter
            ? MainMenu._cameraPoseFromCenter(currentCenter.x, currentCenter.y, pose.targetZoom, overlayScene)
            : pose;
        const fadeTargets = [scene.menuPreview, scene._teamTownIcon].filter(Boolean);

        for (const target of fadeTargets) {
            target.setVisible(true);
            if (typeof target.setActive === "function") target.setActive(true);
        }

        scene.tweens.killTweensOf(fadeTargets);
        scene.tweens.killTweensOf(cam);

        if (zoomOnlyPose) {
            const lockedCenter = currentCenter ?? {
                x: zoomOnlyPose.centerX,
                y: zoomOnlyPose.centerY
            };
            MainMenu._lockStartupCameraCenter(scene, lockedCenter);
            if (duration > 0) {
                const tweenConfig = {
                    targets: cam,
                    zoom: zoomOnlyPose.targetZoom,
                    duration,
                    ease: show ? 'Cubic.easeOut' : 'Quad.easeInOut',
                    onUpdate: () => scene._applyStartupCameraPose?.(),
                };
                scene.tweens.add(tweenConfig);
            } else {
                MainMenu._applyCameraPose(cam, zoomOnlyPose);
            }
            if (scene.zoomMixer) {
                scene.zoomMixer.targetZoom = zoomOnlyPose.targetZoom;
                scene.zoomMixer.anchorWorld = lockedCenter ?? MainMenu._getCameraScrollCenter(cam);
                scene.zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };
            }
        }

        if (duration > 0) {
            scene.tweens.add({
                targets: fadeTargets,
                alpha: show ? 1 : 0,
                duration,
                ease: 'Quad.easeInOut',
                onComplete: () => {
                    if (!show) {
                        for (const target of fadeTargets) target.setVisible(false);
                    }
                }
            });
        } else {
            for (const target of fadeTargets) {
                target.setAlpha(show ? 1 : 0);
                target.setVisible(show);
            }
        }
    }

    static _upsertTeamTownIcon(teamName = "My Team", placedBuildings = null) {
        const scene = MainMenu.scene;
        if (!scene) return;

        let cx = null;
        let cy = null;

        if (Array.isArray(placedBuildings) && placedBuildings.length) {
            let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
            for (const b of placedBuildings) {
                const t = TILE_TYPES[b?.typeKey] || TILE_TYPES[b?.type] || { lenX: 1, lenY: 1 };
                const bx = b?.x ?? 0;
                const by = b?.y ?? 0;
                minx = Math.min(minx, bx);
                miny = Math.min(miny, by);
                maxx = Math.max(maxx, bx + (t.lenX || 1) - 1);
                maxy = Math.max(maxy, by + (t.lenY || 1) - 1);
            }
            cx = ((minx + maxx + 1) / 2) * SQUARESIZE;
            cy = ((miny + maxy + 1) / 2) * SQUARESIZE;
        }

        if (cx == null || cy == null) {
            const teamCenter = Teams.teamLists?.['1']?.center;
            if (Array.isArray(teamCenter) && Number.isFinite(teamCenter[0]) && Number.isFinite(teamCenter[1])) {
                cx = teamCenter[0] * SQUARESIZE + SQUARESIZE / 2;
                cy = teamCenter[1] * SQUARESIZE + SQUARESIZE / 2;
            }
        }

        if (cx == null || cy == null) {
            const b1 = townBounds[1];
            if (!b1) return;
            cx = ((b1.minx + b1.maxx) / 2) * SQUARESIZE;
            cy = ((b1.miny + b1.maxy) / 2) * SQUARESIZE;
        }

        if (!scene._teamTownIcon || !scene._teamTownIcon.active) {
            scene._teamTownIcon = ZoomMixer.createZoomInvariantIcon(
                'townIcon',
                teamName,
                cx,
                cy,
                { baseScale: 1.1 }
            );
        }

        scene._teamTownIcon.setPosition(cx, cy);
        scene._teamTownIcon.setDescription?.(teamName);
    }

    /** Bind the live Phaser scene so static methods can use it */
    static attach(scene) {
        MainMenu.scene = scene;
        scene.load.image('logo', logo);
        scene.load.image('worldMap', worldMap)
        scene.load.image('townIcon', townIcon)
        scene.load.image('logoMini', logoMini)
        scene.load.image('startBtn', start);
        scene.load.image('continueBtn', continueAsset);
        scene.load.image('playBtn', playButton);
        scene.load.image('yesBtn', yesButton);
        scene.load.image('noBtn', noButton);
    }

    /** Build the preview/selection UI in screen space (on UI camera) */
    static startMenuPhase() {
        const scene = MainMenu.scene;
        if (!scene) return;
        AudioManager.startMenuOceanAmbience({ volume: 1 });
        scene._menuModeActive = true;

        const overlayScene = MainMenu._getOverlayScene(scene, { requireActive: true });
        if (!overlayScene) {
            scene._pendingMenuPhase = true;
            return;
        }
        scene._pendingMenuPhase = false;

        const centerX = overlayScene.scale.width / 2;
        const centerY = overlayScene.scale.height / 2;
        const cam = scene.cameras.main;
        const draftPose = MainMenu._getDraftCameraPose(scene, overlayScene);
        const reveal = MainMenu._consumeRestartReveal();
        const logoScale = Phaser.Math.Clamp(Math.min(overlayScene.scale.width / 1600, overlayScene.scale.height / 900), 0.94, 1.18);

        scene.menu?.destroy?.();
        scene.menu = null;
        scene.logo = null;
        scene.startButton = null;
        scene.versionText = null;
        scene._menuRevealFx?.destroy?.(true);
        scene._menuRevealFx = null;

        overlayScene.cameras?.main?.setScroll?.(0, 0);
        overlayScene.cameras?.main?.setZoom?.(1);

        if (draftPose) {
            cam.roundPixels = true;
            MainMenu._applyCameraPose(cam, draftPose);
            MainMenu._lockStartupCameraCenter(scene, { x: draftPose.centerX, y: draftPose.centerY });
        }
        const zoomMixer = MainMenu._ensureZoomMixer(scene);
        if (zoomMixer) {
            zoomMixer.mode = "overview";
            zoomMixer.targetZoom = cam.zoom;
            zoomMixer.anchorWorld = MainMenu._getCameraScrollCenter(cam);
            zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };
        }
        scene._setOceanBackdropMode?.("overview");
        scene.overviewOceanWaves?.setMode?.("overview");
        Map.setDetailedWorldVisible?.(false);
        VisibilitySystem.setOverviewMode(true);
        MainMenu._setTroopPresentationVisible(scene, false);

        // Logo + version (your existing assets/keys)
        const menu = overlayScene.add.container(0,0).setDepth(9998).setScrollFactor(0);
        const logoY = centerY - 30;
        const logo = overlayScene.add.image(centerX, logoY, 'logo').setOrigin(0.5).setScale(logoScale);
        const versionText = overlayScene.add.text(overlayScene.scale.width - 75, overlayScene.scale.height - 20, 'v0.9.9', {
            fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0,1);
        menu.add([logo, versionText]);
        // Keep refs on world scene for existing handoff/fade code.
        scene.menu = menu;
        scene.logo = logo;
        scene.versionText = versionText;

        const continueMeta = SaveManager.getRunSaveMeta();
        const hasContinue = !!continueMeta?.hasContinue;
        const startButtonY = hasContinue ? centerY + 224 : centerY + 252;
        const continueButtonY = centerY + 302;
        const startButton = MainMenu._createMainMenuImageButton(overlayScene, centerX, startButtonY, {
            artKey: 'startBtn',
            widthFactor: hasContinue ? 0.155 : 0.165,
            minWidth: hasContinue ? 210 : 230,
            maxWidth: hasContinue ? 290 : 310,
            hoverLift: 6,
            neighborPush: 20,
        });
        menu.add(startButton);
        scene.startButton = startButton;
        const continueButton = hasContinue
            ? MainMenu._createMainMenuImageButton(overlayScene, centerX, continueButtonY, {
                artKey: 'continueBtn',
                widthFactor: 0.12,
                minWidth: 145,
                maxWidth: 210,
                hoverLift: 5,
                neighborPush: 20,
            })
            : null;
        if (continueButton) {
            menu.add(continueButton);
            scene.continueButton = continueButton;
        }
        startButton._otherButton = continueButton || null;
        if (continueButton) continueButton._otherButton = startButton;

        if (reveal) {
            const revealFx = overlayScene.add.container(0, 0).setDepth(10040).setScrollFactor(0);
            const blueCover = overlayScene.add.rectangle(
                0,
                0,
                overlayScene.scale.width,
                overlayScene.scale.height,
                reveal.color,
                1
            ).setOrigin(0);
            const glowA = overlayScene.add.circle(overlayScene.scale.width * 0.24, overlayScene.scale.height * 0.28, 180, 0xffffff, 0.08);
            const glowB = overlayScene.add.circle(overlayScene.scale.width * 0.74, overlayScene.scale.height * 0.62, 220, 0xdbeafe, 0.07);
            revealFx.add([blueCover, glowA, glowB]);
            scene._menuRevealFx = revealFx;

            menu.setAlpha(0);
            logo.setY(logoY + 16).setScale(logoScale * 0.92);
            startButton.setY(startButtonY + 24).setScale(0.9).setAlpha(0);
            continueButton?.setY(continueButtonY + 16).setScale(0.9).setAlpha(0);
            versionText.setY(overlayScene.scale.height - 8).setAlpha(0);

            overlayScene.tweens.add({
                targets: menu,
                alpha: 1,
                duration: 260,
                delay: 120,
                ease: 'Quad.easeOut',
            });
            overlayScene.tweens.add({
                targets: logo,
                y: logoY,
                scaleX: logoScale,
                scaleY: logoScale,
                duration: 560,
                delay: 160,
                ease: 'Back.easeOut',
            });
            overlayScene.tweens.add({
                targets: startButton,
                y: startButtonY,
                scaleX: 1,
                scaleY: 1,
                alpha: 1,
                duration: 520,
                delay: 240,
                ease: 'Back.easeOut',
            });
            if (continueButton) {
                overlayScene.tweens.add({
                    targets: continueButton,
                    alpha: 1,
                    y: continueButtonY,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 520,
                    delay: 290,
                    ease: 'Back.easeOut',
                });
            }
            overlayScene.tweens.add({
                targets: versionText,
                y: overlayScene.scale.height - 20,
                alpha: 1,
                duration: 320,
                delay: 320,
                ease: 'Quad.easeOut',
            });
            overlayScene.tweens.add({
                targets: [glowA, glowB],
                alpha: 0,
                scaleX: 1.16,
                scaleY: 1.16,
                duration: reveal.fadeOutDuration,
                ease: 'Sine.easeOut',
            });
            overlayScene.tweens.add({
                targets: blueCover,
                alpha: 0,
                duration: reveal.fadeOutDuration,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    if (scene._menuRevealFx === revealFx) {
                        scene._menuRevealFx = null;
                    }
                    revealFx.destroy(true);
                }
            });
        }

        const attachButtonHover = (button) => {
            if (!button?.buttonHit) return;
            button.buttonHit.on('pointerover', () => {
                AudioManager.playUiHover({ volume: 0.18 });
                button._hoverTween?.remove?.();
                button._hoverTween = overlayScene.tweens.add({
                    targets: button,
                    angle: { from: -1.4, to: 1.4 },
                    duration: 520,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
                overlayScene.tweens.add({
                    targets: button.buttonArt,
                    scaleX: (button._artBaseScale || 1) * 1.24,
                    scaleY: (button._artBaseScale || 1) * 1.24,
                    duration: 180,
                    ease: 'Quad.easeOut',
                });
                overlayScene.tweens.add({
                    targets: button,
                    y: (button._baseY ?? button.y) - (button._hoverLift ?? 8),
                    duration: 180,
                    ease: 'Quad.easeOut',
                });
                const other = button._otherButton;
                if (other) {
                    const push = button._neighborPush ?? 18;
                    const dir = other._baseY > (button._baseY ?? button.y) ? 1 : -1;
                    overlayScene.tweens.add({
                        targets: other,
                        y: (other._baseY ?? other.y) + (push * dir),
                        duration: 180,
                        ease: 'Quad.easeOut',
                    });
                }
            });

            button.buttonHit.on('pointerout', () => {
                button._hoverTween?.remove?.();
                button._hoverTween = null;
                overlayScene.tweens.add({
                    targets: button.buttonArt,
                    scaleX: button._artBaseScale || 1,
                    scaleY: button._artBaseScale || 1,
                    duration: 180,
                    ease: 'Quad.easeOut',
                });
                overlayScene.tweens.add({
                    targets: button,
                    y: button._baseY ?? button.y,
                    angle: 0,
                    duration: 180,
                    ease: 'Quad.easeOut',
                });
                const other = button._otherButton;
                if (other) {
                    overlayScene.tweens.add({
                        targets: other,
                        y: other._baseY ?? other.y,
                        duration: 180,
                        ease: 'Quad.easeOut',
                    });
                }
            });
        };

        const setMenuButtonsEnabled = (enabled) => {
            if (enabled) {
                startButton?.buttonHit?.setInteractive?.({ useHandCursor: true });
                continueButton?.buttonHit?.setInteractive?.({ useHandCursor: true });
                return;
            }
            startButton?.buttonHit?.disableInteractive?.();
            continueButton?.buttonHit?.disableInteractive?.();
        };

        let newRunPrompt = null;
        const destroyNewRunPrompt = ({ restoreButtons = true } = {}) => {
            if (!newRunPrompt) return;
            newRunPrompt.confirm?.destroy?.();
            newRunPrompt.cancel?.destroy?.();
            newRunPrompt.root?.destroy?.(true);
            newRunPrompt = null;
            if (restoreButtons) {
                setMenuButtonsEnabled(true);
            }
        };

        const showNewRunPrompt = (onConfirm) => {
            if (newRunPrompt) return;

            setMenuButtonsEnabled(false);
            const root = overlayScene.add.container(0, 0).setDepth(10020).setScrollFactor(0);
            const blocker = overlayScene.add.rectangle(
                overlayScene.scale.width / 2,
                overlayScene.scale.height / 2,
                overlayScene.scale.width,
                overlayScene.scale.height,
                0x02060a,
                0.62
            ).setInteractive({ useHandCursor: false });
            const cardX = centerX;
            const cardY = centerY + 26;
            const shadow = overlayScene.add.rectangle(cardX, cardY + 10, 520, 250, 0x02060a, 0.34).setOrigin(0.5);
            const panel = overlayScene.add.rectangle(cardX, cardY, 500, 230, 0x0f1822, 0.97)
                .setOrigin(0.5)
                .setStrokeStyle(2, 0xe3f6ff, 0.18);
            const strip = overlayScene.add.rectangle(cardX, cardY - 82, 456, 36, 0x6dd3f5, 0.16).setOrigin(0.5);
            const title = overlayScene.add.text(cardX, cardY - 78, 'Start New Run?', {
                fontSize: '26px',
                color: '#f7fcff',
                fontFamily: 'Bungee',
                stroke: '#06111a',
                strokeThickness: 5,
            }).setOrigin(0.5);
            const body = overlayScene.add.text(cardX, cardY - 18, 'This will overwrite your current Continue save.\nAre you sure you want to reset the run?', {
                fontSize: '15px',
                color: '#d7ebf5',
                fontFamily: 'Bungee',
                stroke: '#06111a',
                strokeThickness: 4,
                align: 'center',
            }).setOrigin(0.5).setLineSpacing(6);

            const confirm = MainMenu._createStartButton(overlayScene, cardX - 112, cardY + 70, {
                artKey: 'yesBtn',
                hintText: '',
                hideHint: true,
                panelColor: 0x7a3244,
                glowColor: 0xffb3c3,
                artScaleMultiplier: 0.74,
            });
            confirm.setScale(0.62);
            const cancel = MainMenu._createStartButton(overlayScene, cardX + 112, cardY + 70, {
                artKey: 'noBtn',
                hintText: '',
                hideHint: true,
                panelColor: 0x205f97,
                glowColor: 0x8de7ff,
                artScaleMultiplier: 0.74,
            });
            cancel.setScale(0.62);

            root.add([blocker, shadow, panel, strip, title, body, confirm, cancel]);
            newRunPrompt = { root, confirm, cancel };

            attachButtonHover(confirm);
            attachButtonHover(cancel);
            blocker.on('pointerdown', () => {
                AudioManager.playMenuClick();
                destroyNewRunPrompt();
            });
            cancel.buttonHit.on('pointerdown', () => {
                AudioManager.playMenuClick();
                destroyNewRunPrompt();
            });
            confirm.buttonHit.on('pointerdown', () => {
                AudioManager.playMenuClick();
                destroyNewRunPrompt({ restoreButtons: false });
                onConfirm?.();
            });

            root.setAlpha(0);
            overlayScene.tweens.add({
                targets: root,
                alpha: 1,
                duration: 180,
                ease: 'Quad.easeOut',
            });
        };

        const fadeOutMenuForLaunch = (onDone) => {
            destroyNewRunPrompt({ restoreButtons: false });
            setMenuButtonsEnabled(false);
            overlayScene.tweens.killTweensOf(logo);
            overlayScene.tweens.killTweensOf(startButton);
            startButton._hoverTween?.remove?.();
            overlayScene.tweens.killTweensOf(startButton.buttonArt);
            if (continueButton) {
                overlayScene.tweens.killTweensOf(continueButton);
                continueButton._hoverTween?.remove?.();
                overlayScene.tweens.killTweensOf(continueButton.buttonArt);
            }
            overlayScene.tweens.killTweensOf(versionText);
            overlayScene.tweens.add({
                targets: versionText,
                alpha: 0,
                duration: 260,
                ease: 'Quad.easeOut',
            });
            overlayScene.tweens.add({
                targets: logo,
                y: 72,
                scale: logoScale * 0.22,
                duration: 1140,
                alpha: 0,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    logo.destroy();
                    overlayScene.time.delayedCall(140, () => onDone?.());
                }
            });
            overlayScene.tweens.add({
                targets: [startButton, continueButton].filter(Boolean),
                alpha: 0,
                scaleX: 0.9,
                scaleY: 0.9,
                duration: 320,
                onComplete: () => {
                    startButton.destroy();
                    continueButton?.destroy?.();
                }
            });
        };

        // Float
        overlayScene.tweens.add({
        targets: logo,
        y: logoY - 8,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
        });

        // Wiggle
        overlayScene.tweens.add({
        targets: logo,
        angle: { from: -2, to: 2 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
        });

        // Pulse
        overlayScene.tweens.add({
        targets: logo,
        scaleX: { from: logoScale, to: logoScale * 1.05 },
        scaleY: { from: logoScale, to: logoScale * 1.05 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeInOut'
        });

        attachButtonHover(startButton);
        attachButtonHover(continueButton);

        startButton.buttonHit.on('pointerdown', () => {
            if (hasContinue) {
                showNewRunPrompt(() => {
                    SaveManager.clearRunSave();
                    fadeOutMenuForLaunch(() => {
                        MainMenu.buildMapSelectPhase({ fromStartMenu: true });
                    });
                });
                return;
            }
            AudioManager.playMenuClick();
            SaveManager.clearRunSave();
            fadeOutMenuForLaunch(() => {
                MainMenu.buildMapSelectPhase({ fromStartMenu: true });
            });
        });

        continueButton?.buttonHit?.on('pointerdown', () => {
            const snapshot = SaveManager.loadSnapshot();
            if (!snapshot) {
                SaveManager.clearRunSave();
                showAlert(scene, 'Save could not be loaded', '#ff8080');
                MainMenu.startMenuPhase();
                return;
            }
            AudioManager.playMenuClick();
            MainMenu._stageContinueMenuCamera(snapshot);
            fadeOutMenuForLaunch(() => {
                MainMenu.beginContinueAndHandOff(snapshot);
            });
        });
    }

    static buildMapSelectPhase(opts = {}){
        const scene = MainMenu.scene;
        const overlayScene = MainMenu._getOverlayScene(scene) || scene;
        const logoMiniY = Phaser.Math.Clamp(Math.round(overlayScene.scale.height * 0.11), 62, 132);
        const logoMini = overlayScene.add
            .image(overlayScene.scale.width / 2, logoMiniY, 'logoMini')
            .setOrigin(0.5)
            .setAlpha(0)
            .setVisible(false);
        // Keep world-scene ref for existing cleanup code.
        scene.logoMini = logoMini;
        // === Build Map.grid from already-loaded map image ===
        const img = scene.textures.get('worldMap').getSourceImage(); // 250x250
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = srcW; canvas.height = srcH;

        Map.grid    = create2DArray(srcW, srcH);
        Map.navGrid = create2DArray(srcW, srcH);
        scene.gridData = Map.MapFromImage(canvas, img);

        // === Create the canvas texture used both here AND as gameplay overlay ===
        const texKey = 'mapPreview';          // ✅ unique key for the canvas preview
        if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
        const tex = scene.textures.createCanvas(texKey, srcW, srcH);
        const ctx = tex.getContext();

        for (let y = 0; y < srcH; y++) {
            for (let x = 0; x < srcW; x++) {
                let value;
                Array.isArray(scene.gridData[y][x]) ? value = scene.gridData[y][x][1] : value = scene.gridData[y][x]
                const type = TILE_TYPES[TILE_MAP(value)]
                if((type == TILE_TYPES.pine || type == TILE_TYPES.rock) && !Array.isArray(scene.gridData[y][x])){
                    buildingArray.push([x,y,type,null])
                    for(let i = y; i < y + type.lenY; i++){
                        for(let j = x; j < x + type.lenX; j++){
                            scene.gridData[i][j] = [TILE_TYPES.grass.grid, type.grid]
                            if(type.block) Map.navGrid[i][j] = 0;
                        }
                    }
                }
            }
        }

        paintOverviewTexture(
            ctx,
            scene.gridData,
            (cell) => colorFor(Array.isArray(cell) ? cell[1] : cell),
        );

        tex.refresh();
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

        // save handy references for repaint + handoff
        scene._menuTex   = tex;
        scene._menuCtx   = ctx;
        scene._colorCell = colorFor;
        scene._srcW      = srcW;
        scene._srcH      = srcH;
        scene.mapTexKey  = texKey;            // ✅ remember the texture key

        // // Create water mask canvas
        // const waterTexKey = "waterMask";
        // if (scene.textures.exists(waterTexKey)) scene.textures.remove(waterTexKey);

        // const wTex = scene.textures.createCanvas(waterTexKey, srcW, srcH);
        // const wCtx = wTex.getContext();

        // // === Build a water mask with a fading waterline from shore ===
        // // Grab the full image data once (faster than per-pixel getImageData)
        // const imgData = ctx.getImageData(0, 0, srcW, srcH).data;

        // // 1) Classify pixels as water vs land
        // const isWaterMap = new Array(srcH);
        // for (let y = 0; y < srcH; y++) {
        //     const row = new Array(srcW);
        //     for (let x = 0; x < srcW; x++) {
        //         const idx = (y * srcW + x) * 4;
        //         const r = imgData[idx];
        //         const g = imgData[idx + 1];
        //         const b = imgData[idx + 2];

        //         // your water colour test (tweak if needed)
        //         const isWater = b > 184 && r <= 60;

        //         row[x] = isWater;
        //     }
        //     isWaterMap[y] = row;
        // }

        // // 2) For each water pixel, find distance to nearest land, fade by distance
        // const maxRadius = 8;   // how far out the waterline extends
        // const maxAlpha  = 0.5; // opacity at the shoreline

        // for (let y = 0; y < srcH; y++) {
        //     for (let x = 0; x < srcW; x++) {
        //         if (!isWaterMap[y][x]) continue; // only care about water pixels

        //         let minDist = maxRadius + 1;

        //         // search a neighbourhood around this water pixel for land
        //         for (let dy = -maxRadius; dy <= maxRadius && minDist > 1; dy++) {
        //             const ny = y + dy;
        //             if (ny < 0 || ny >= srcH) continue;

        //             for (let dx = -maxRadius; dx <= maxRadius; dx++) {
        //                 const nx = x + dx;
        //                 if (nx < 0 || nx >= srcW) continue;

        //                 // any non-water pixel counts as land
        //                 if (!isWaterMap[ny][nx]) {
        //                     const d = Math.sqrt(dx * dx + dy * dy);
        //                     if (d < minDist) minDist = d;
        //                 }
        //             }
        //         }

        //         // If we didn't find land nearby, skip (deep ocean, no line)
        //         if (minDist > maxRadius) continue;

        //         // Closer to land → higher alpha; farther → fade out
        //         const t = 1 - (minDist / maxRadius);      // 1 at shore, 0 at maxRadius
        //         const alpha = maxAlpha * t;               // scale by max alpha

        //         if (alpha <= 0) continue;

        //         wCtx.fillStyle = `rgba(200,200,255,${alpha.toFixed(3)})`;
        //         wCtx.fillRect(x, y, 1, 1);
        //     }
        // }

        // wTex.refresh();
        // wTex.setFilter(Phaser.Textures.FilterMode.NEAREST);

        // // Show preview centered in screen space
        const maxW = scene.scale.width * 0.9;
        const maxH = scene.scale.height * 0.7;
        const scale = Math.min(maxW / srcW, maxH / srcH);
        const worldW = srcW * SQUARESIZE, worldH = srcH * SQUARESIZE;

        // // === Water overlay aligned with the world map ===
        // const waterOverlay = scene.add.image(worldW / 2, worldH / 2, "waterMask")
        //     .setOrigin(0.5)
        //     .setScale(SQUARESIZE)        // match the map grid size
        //     .setDepth(UIDEPTH - 1)       // ABOVE the mapPreview (UIDEPTH - 2)
        //     .setAlpha(0.8)
        //     .setScrollFactor(1);

        // scene.waterOverlay = waterOverlay;

        // // gentle alpha pulse
        // scene.tweens.add({
        //     targets: waterOverlay,
        //     alpha: { from: 0.1, to: 0.9 },
        //     duration: 1600,
        //     repeat: -1,
        //     yoyo: true,
        //     ease: "Sine.easeInOut"
        // });

        scene.menuPreview = scene.add.image(worldW/2, worldH/2, texKey)
            .setOrigin(0.5)
            .setScale(SQUARESIZE)
            .setScrollFactor(1)
            .setDepth(UIDEPTH-2)
            .setAlpha(0)
            .setVisible(false);
        scene.overviewOceanWaves?.resize?.();

        const cam = scene.cameras.main;
        cam.roundPixels = true;

        const draftPose = MainMenu._getDraftCameraPose(scene, overlayScene);
        const targetZoom = draftPose?.targetZoom ?? 0.7;
        if (draftPose) {
            MainMenu._lockStartupCameraCenter(scene, { x: draftPose.centerX, y: draftPose.centerY });
        }

        if (opts?.fromStartMenu) {
            const tweenConfig = {
                targets: cam,
                zoom: targetZoom,
                duration: 900,
                ease: 'Cubic.easeInOut',
                onUpdate: () => scene._applyStartupCameraPose?.(),
            };
            scene.tweens.add(tweenConfig);
        } else {
            const center = draftPose && Number.isFinite(draftPose.centerX) && Number.isFinite(draftPose.centerY)
                ? { x: draftPose.centerX, y: draftPose.centerY }
                : MainMenu._getCameraScrollCenter(cam);
            MainMenu._applyCameraPose(cam, MainMenu._cameraPoseFromCenter(center.x, center.y, targetZoom, overlayScene));
        }

        // mainMenu.js, right after cam.setZoom(0.5);
        scene.zoomMixer = new ZoomMixer();
        scene.zoomMixer.overviewImage = scene.menuPreview;
        scene.zoomMixer.texKey = scene.mapTexKey;
        scene.zoomMixer.mode = 'overview';

        // ✅ prevent update() from drifting zoom toward 1.0 during the menu
        scene.zoomMixer.targetZoom = cam.zoom;
        scene.zoomMixer.anchorWorld = MainMenu._getCameraScrollCenter(cam);
        scene.zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };


        scene.isMainMenuPreview = true; // if you want the optional sprite-suppression in map.js
        // --- repaint helper (keep yours if already defined)
        const repaintBounds = (b) => {
        const ctx = scene._menuCtx;
        paintOverviewTexture(
            ctx,
            scene.gridData,
            (cell) => colorFor(Array.isArray(cell) ? cell[1] : cell),
            {
                minX: b?.minx ?? 0,
                minY: b?.miny ?? 0,
                maxX: b?.maxx ?? (srcW - 1),
                maxY: b?.maxy ?? (srcH - 1),
            }
        );
        scene._menuTex.refresh();
        scene._menuTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        };

        // optional full repaint if you want a convenience hook
        scene.fullRepaintPreview = () => {
        repaintBounds({ minx: 0, miny: 0, maxx: srcW - 1, maxy: srcH - 1 });
        };

        // flag if you use it anywhere else
        scene.isMainMenuPreview = true;

        // Build draft UI on UI scene so world camera zoom does not scale it.
        const draftScene = MainMenu._getOverlayScene(scene) || scene;
        draftScene.menuPreview = scene.menuPreview;
        draftScene.fullRepaintPreview = scene.fullRepaintPreview?.bind(scene);
        draftScene.draftMenu?.destroy?.();
        Teams.newTeam(1);

        // build the draft UI (v5)
            const draftMenu = DraftStartMenu.build(draftScene, {
            srcW,
            srcH,
            gridData: scene.gridData,
            repaintBounds,
            worldScene: scene
        });
        scene.draftMenu = draftMenu;
        draftScene.draftMenu = draftMenu;

        draftScene.events.off("draftTeamNameChanged");
        draftScene.events.on("draftTeamNameChanged", (name) => {
            MainMenu._upsertTeamTownIcon(name || "My Team", draftMenu?.state?.placedBuildings);
        });
        draftScene.events.off("draftPhaseChanged");
        draftScene.events.on("draftPhaseChanged", (payload = {}) => {
            const placedBuildings = payload?.placedBuildings ?? draftMenu?.state?.placedBuildings;
            MainMenu._setDraftPreviewVisibility(payload?.phase === "layout", {
                placedBuildings,
                immediate: !!payload?.immediate,
            });
        });
        scene._draftTownIconUnsub?.();
        scene._draftTownIconUnsub = draftMenu?.state?.onChange?.((st) => {
            MainMenu._upsertTeamTownIcon(st.teamName || "My Team", st.placedBuildings);
        });
        MainMenu._upsertTeamTownIcon(draftMenu?.state?.teamName || "My Team", draftMenu?.state?.placedBuildings);
        MainMenu._setDraftPreviewVisibility(false, {
            placedBuildings: draftMenu?.state?.placedBuildings,
            immediate: true,
        });

        // IMPORTANT: make sure the draft UI is NOT rendered by the main camera

        // Confirm → start game with cfg
        draftScene.events.off("draftConfirmed");
        draftScene.events.on("draftConfirmed", (startCfg) => {
        // store it so beginLoadingAndHandOff + GameStart can use it
        scene.startCfg = startCfg;

        // fade out the draft UI if you want
        draftScene.tweens.add({
            targets: draftMenu.container,
            alpha: 0,
            duration: 200,
            ease: "Quad.easeInOut",
            onComplete: () => {
                draftMenu?.preview?.clearDraftPlayerIcons?.();
                draftMenu.destroy();
                scene._draftTownIconUnsub?.();
                scene._draftTownIconUnsub = null;
                MainMenu.beginLoadingAndHandOff(startCfg);
            }
        });
        });
    }

    static buildTeamSelectUI_OnMenuPreview(srcW, srcH, scale) {
        const scene = MainMenu.scene;

        const preview = scene.menuPreview;
        const y0 = preview.y - preview.displayHeight / 2;

        // repaint a bbox (inclusive)
        const repaintBounds = (b) => {
            const ctx = scene._menuCtx;
            const colorForCell = scene._colorCell;
            for (let y = b.miny; y <= b.maxy; y++) {
                for (let x = b.minx; x <= b.maxx; x++) {
                    const val = Array.isArray(scene.gridData[y][x])
                        ? scene.gridData[y][x][1]
                        : scene.gridData[y][x];
                    const type = TILE_TYPES[TILE_MAP(val)];
                    if (type?.name === 'water') {
                        ctx.clearRect(x, y, 1, 1);
                        continue;
                    }
                    const c = colorForCell(val);
                    ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            scene._menuTex.refresh();
            scene._menuTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        };

        // ensure icon texture exists
        const iconKey = 'townIcon';
        if (!scene.textures.exists(iconKey)) {
            const g = scene.add.graphics();
            g.fillStyle(0xffffff, 1).fillCircle(12, 12, 10);
            g.lineStyle(2, 0x000000, 1).strokeCircle(12, 12, 10);
            g.generateTexture(iconKey, 24, 24);
            g.destroy();
        }

        scene.repaintBounds = repaintBounds;

        // optional: easy full redraw fallback (cheap + reliable)
        scene.fullRepaintPreview = () => repaintBounds({
            minx: 0,
            miny: 0,
            maxx: scene._srcW - 1,
            maxy: scene._srcH - 1
        });


        // === Town seeds (positions)
        const seeds = [
            [10, 10]
        ];
        const teams = [1];

        Teams.newTeam(1);
        
        // place towns
        seeds.forEach(([sx, sy], idx) => {
            const team = teams[idx];
            scene.gridData = generateTown(
                scene.gridData,
                teamSetupArray.smallTeam,
                team,
                sx, sy,
                Map.navGrid
            );
            const b = townBounds[team];
            if (!b) return;

            for (let i = 0; i < buildingArray.length; i++) {
                const e = buildingArray[i];
                if (!e || e.length < 4) continue;
                const [bx, by] = e;
                if (bx >= b.minx && bx <= b.maxx && by >= b.miny && by <= b.maxy) {
                    buildingArray[i][3] = team;
                }
            }
            repaintBounds(b);
        });
        // === Draft Start Menu UI ===
        // after you have:
        // - this.menuPreview created (the center map image)
        // - this.gridData set up
        // - a function that can repaint the preview (see snippet below)

        this.isMainMenuPreview = true; // used by optional map.js patch (see below)

        this.draftMenu?.destroy?.();

        this.draftMenu = DraftStartMenu.build(scene, {
            srcW: scene._srcW,
            srcH: scene._srcH,
            gridData: scene.gridData,
            repaintBounds: (bbox) => {
                // must redraw only the bbox region onto menu preview
                // If you only have a full redraw right now, just call that instead:
                this.repaintBounds?.(bbox) ?? this.fullRepaintPreview?.();
            }
        });

        // When confirmed, transition into your normal "begin game" handoff:
        this.events.off("draftConfirmed");
        this.events.on("draftConfirmed", (startCfg) => {
            // startCfg contains: teamName, crew, supplies, extras(wallTiles/type), cards, money info
            // Use your existing flow:
            this.beginLoadingAndHandOff(startCfg);
        });

        // === Starting town house icon (visual marker on the map) ===
        const b1 = townBounds[1];
        if (b1) {
            const cx = ((b1.minx + b1.maxx) / 2) * SQUARESIZE;
            const cy = ((b1.miny + b1.maxy) / 2) * SQUARESIZE;

            // This uses ZoomMixer's helper so the icon stays a good size when zooming
            ZoomMixer.createZoomInvariantIcon(
                'townIcon',
                'Starting Town',
                cx,
                cy,
                { baseScale: 1.1 }
            );
        }

    }

    static beginContinueAndHandOff(snapshot) {
        const scene = MainMenu.scene;
        if (!scene || !snapshot?.world?.grid) return;
        if (!Teams.teamLists?.["1"]) Teams.newTeam(1);
        prepareSnapshotWorldForBoot(snapshot);
        scene.gridData = typeof structuredClone === 'function'
            ? structuredClone(snapshot.world.grid)
            : JSON.parse(JSON.stringify(snapshot.world.grid));
        scene._skipStarterResourceSeed = true;
        scene._pendingContinueSnapshot = snapshot;
        scene.startCfg = null;
        scene.draftStartCfg = null;
        MainMenu._ensureNavGridForScene(scene, snapshot);
        MainMenu.beginLoadingAndHandOff(null, { continueSnapshot: snapshot });
    }

    static beginLoadingAndHandOff(startCfg, opts = {}) {
        const scene = MainMenu.scene;
        const overlayScene = MainMenu._getOverlayScene(scene) || scene;
        const continueSnapshot = opts?.continueSnapshot ?? null;
        const isContinue = !!continueSnapshot;
        scene._menuModeActive = false;
        scene.isMainMenuPreview = false;
        scene._continueCameraLockActive = true;
        scene._startupCameraLocked = true;
        if (!scene._startupCameraCenter) {
            MainMenu._lockStartupCameraCenter(scene, MainMenu._getCameraScrollCenter(scene.cameras?.main));
        }
        AudioManager.stopMenuOceanAmbience();
        const t1 = Teams.teamLists && Teams.teamLists["1"];
        const kitResources = startCfg?.resources ?? MainMenu.selectedStartKit?.resources ?? t1?.startKit?.resources;
        const starterSupplies = isContinue ? null : (startCfg?.resources ?? startCfg?.supplies ?? kitResources ?? null);
        const kitCards = Array.isArray(startCfg?.cards?.picked)
            ? startCfg.cards.picked.slice(0, 3)
            : (Array.isArray(MainMenu.selectedStartKit?.cards)
                ? MainMenu.selectedStartKit.cards.slice(0, 3)
                : (Array.isArray(t1?.startKit?.cards) ? t1.startKit.cards.slice(0, 3) : null));

        if (startCfg && !isContinue) {
            // team name
            if (t1) t1.name = startCfg.teamName;

            // Starting cash is applied here; actual supplies come from storage seeding.
            const startResources = startCfg.resources ?? startCfg.supplies ?? {};
            scene.money = startResources.money ?? startCfg.money?.amount ?? scene.money;

            // cards: you’ll want to map ids back to your real card objects
            // (keep this simple for now—if your cards are already objects with apply(), you can store them directly)
            // crew config for GameStart
            scene.startCrew = startCfg.crew;

            // buildings are already written into gridData + buildingArray during the draft preview
        }

        if (!isContinue) scene.permits = 0;

        if (starterSupplies && !isContinue) {
            scene.seeds = 0;
            scene.berries = 0;
            scene.woodAmnt = 0;
            scene.stoneAmnt = 0;
            scene.foodAmnt = 0;
            scene.cleanWaterAmnt = 0;
        }
        
        // Apply the chosen starting kit cards to Team 1
        if (kitResources && !isContinue) {
            scene.money = kitResources.money ?? scene.money;
        }

        if (t1 && Array.isArray(kitCards) && !isContinue) {
            t1.cardHand = kitCards;
            t1.cardHand.forEach((card) => {
                card.apply?.();
            });
        }

        // UI-scene loading cover so it stays above draft/menu UI during the handoff.
        const loading = overlayScene.add.container(0, 0).setDepth(50000).setScrollFactor(0);
        const inputBlocker = overlayScene.add.rectangle(
            0,
            0,
            overlayScene.scale.width,
            overlayScene.scale.height,
            0x000000,
            0.14
        ).setOrigin(0);
        inputBlocker.setInteractive({ useHandCursor: false });
        loading.add(inputBlocker);

        if (ZoomMixer.mapIconContainer) {
            ZoomMixer.mapIconContainer.iterate(child => {
                if (child?.disableInteractive) {
                    // Save hover behavior: leave pointerover/out intact
                    child.removeAllListeners('pointerdown');
                }
            });
        }

        if (scene.logoMini) {
            scene.logoMini.setVisible(false).setAlpha(0);
        }

        const logoShowcaseY = Phaser.Math.Clamp(Math.round(overlayScene.scale.height * 0.11), 62, 132);
        const logoShowcase = overlayScene.add.container(overlayScene.scale.width / 2, logoShowcaseY)
            .setAlpha(0)
            .setScale(0.92);
        const logoSprite = overlayScene.add.image(0, 0, 'logoMini').setOrigin(0.5).setScale(1.02);
        logoShowcase.add(logoSprite);
        loading.add(logoShowcase);

        overlayScene.tweens.add({
            targets: logoShowcase,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 220,
            ease: 'Cubic.easeOut'
        });

        // Worker setup
        const worker = new Worker(new URL('./workers/navMeshWorker.js', import.meta.url), { type: 'module' });
        let launchSequencePlayed = false;
        const playReadyLogoSequence = (focusPose, transitionOpts = {}) => {
            if (launchSequencePlayed) return;
            launchSequencePlayed = true;

            const isContinueTransition = !!transitionOpts?.isContinue;
            const overviewPose = transitionOpts?.overviewPose ?? null;

            const fadeTargets = [scene.menu, scene._teamTownIcon].filter(Boolean);
            if (fadeTargets.length) {
                overlayScene.tweens.add({
                    targets: fadeTargets,
                    alpha: 0,
                    duration: 180,
                    ease: 'Quad.easeInOut',
                });
            }

            overlayScene.time.delayedCall(420, () => {
                scene.menu?.destroy?.();
                scene._teamTownIcon?.destroy?.();
                scene._teamTownIcon = null;
                scene.logoMini?.destroy?.();
                scene.logoMini = null;
                scene.menuPreview?.removeAllListeners?.();

                const cam = scene.cameras.main;
                const zoomMixer = MainMenu._ensureZoomMixer(scene);
                const currentCenter = MainMenu._getCameraScrollCenter(cam);
                const launchCenter = MainMenu._lockStartupCameraCenter(
                    scene,
                    scene._startupCameraCenter ?? currentCenter ?? {
                        x: focusPose?.centerX,
                        y: focusPose?.centerY
                    }
                ) ?? currentCenter;
                const targetZoom = zoomMixer?.detailedZoom ?? 1;
                if (zoomMixer) {
                    zoomMixer.targetZoom = targetZoom;
                    zoomMixer.anchorWorld = launchCenter;
                    zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };
                }

                AudioManager.playWhoosh({ volume: 0.36 });
                let detailedRevealPlayed = false;
                scene.tweens.add({
                    targets: cam,
                    zoom: targetZoom,
                    duration: isContinueTransition ? 1650 : 1000,
                    ease: 'Cubic.easeInOut',
                    onUpdate: () => {
                        scene._applyStartupCameraPose?.();
                        if (!isContinueTransition || detailedRevealPlayed) return;
                        if (cam.zoom < Math.max(zoomMixer?.IN_THRESHOLD ?? 0.45, 0.52)) return;
                        detailedRevealPlayed = true;
                        MainMenu._restoreDetailedPresentation(scene, zoomMixer);
                    },
                    onComplete: () => {
                        scene._applyStartupCameraPose?.();
                        if (!detailedRevealPlayed) {
                            MainMenu._restoreDetailedPresentation(scene, zoomMixer);
                        }
                        scene._continueCameraLockActive = false;
                        scene._startupCameraLocked = false;
                        scene._startupCameraCenter = null;
                        scene.uiScene?.initGameplayUI?.();
                        if (scene.clock) scene.clock.paused = false;
                        scene.time?.delayedCall?.(40, () => {
                            MainMenu._resumeFriendlyTroops(scene);
                        });

                        overlayScene.tweens.add({
                            targets: loading,
                            alpha: 0,
                            duration: 220,
                            ease: 'Quad.easeInOut',
                            onComplete: () => {
                                loading.destroy();
                            }
                        });

                        zoomMixer?.hookWheel?.();
                        zoomMixer?.hookKeys?.();
                        worker.terminate();
                    }
                });
            });
        };

        worker.onmessage = (e) => {
            const { success, polys, error } = e.data;
            if (!success) {
                console.error("Navmesh worker failed:", error);
                loading.destroy();
                return;
            }

            // Prepare game state but don’t show it yet
            scene.prebuiltPolys = polys;
            console.log(polys)
            Map.initMap();
            Map.mapFromData(scene.gridData);
            // existing
            Map.navMesh = new NavMesh(polys);
            for (const poly of Map.navMesh.getPolygons()) {
                poly.parcelTag = "main";
                poly.parcelTags = ["main"];
            }
            scene.navMeshUpdater = new NavMeshUpdater(Map.navMesh, scene, {
                toggleKey: "M",
                fillColor: 0x00ff00,
                fillAlpha: 0.20,
            });
            PathRegistry.init(Map.navMesh);
            buildingManager.NavMeshUpdater = scene.navMeshUpdater;

            // ✅ NEW: enemy grid (dupe) + enemy mesh (dupe) + enemy updater + enemy registry
            Map.enemyNavGrid = Map.navGrid.map(row => row.slice());
            // deep-clone polys so edits to enemy mesh don't mutate player mesh
            const enemyPolys = (typeof structuredClone === "function")
            ? structuredClone(polys)
            : polys.map(p => ({
                ...p,
                // common shapes in your worker output: "points" and "neighbors"
                points: (p.points || []).map(pt => ({ x: pt.x, y: pt.y })),
                neighbors: Array.isArray(p.neighbors) ? p.neighbors.slice() : [],
                }));

            Map.enemyNavMesh = new NavMesh(enemyPolys);
            for (const poly of Map.enemyNavMesh.getPolygons()) {
                poly.parcelTag = "main";
                poly.parcelTags = ["main"];
            }

            scene.enemyNavMeshUpdater = new NavMeshUpdater(Map.enemyNavMesh, scene, {
                toggleKey: "N",
                fillColor: 0xff0000,
                fillAlpha: 0.18,
            });

            // Give PathRegistry a second registry keyed to enemy mesh
            PathRegistry.init(Map.enemyNavMesh);

            // normal
            Map.regionSystem = new RegionSystem(Map.navMesh, Map.navGrid);
            Map.regionDrawer = new RegionDebugDrawer(scene, Map.navMesh, Map.regionSystem, { toggleKey: "U" });

            // enemy
            Map.enemyRegionSystem = new RegionSystem(Map.enemyNavMesh, Map.enemyNavGrid);
            Map.enemyRegionDrawer = new RegionDebugDrawer(scene, Map.enemyNavMesh, Map.enemyRegionSystem, { toggleKey: "Y", alpha: 0.16 });
            waterSourcesQuadTree?.destroy?.();
            waterSourcesQuadTree = buildWaterQuadtree(scene, {
                grid: scene.gridData,
                regionSystem: Map.regionSystem,
            });
            scene.waterSourcesQuadTree = waterSourcesQuadTree;

            // let managers access enemy updater too
            buildingManager.EnemyNavMeshUpdater = scene.enemyNavMeshUpdater;

            blockResourceManager.NavMeshUpdater = scene.navMeshUpdater;
            blockResourceManager.EnemyNavMeshUpdater = scene.enemyNavMeshUpdater;
            if (!Teams.teamLists?.["0"]) Teams.newTeam(0);
            if (!Teams.teamLists?.["1"]) Teams.newTeam(1);
            Map.drawBuildings();
            if (!isContinue) {
                GameStart.placePlayers(startCfg);
            }
            scene.parcelSpawnUI = new ParcelSpawnController(scene, {
                islandTileX: 37,
                islandTileY: 37,
                tileSize: SQUARESIZE,
                gapTiles: 1,     // tweak distance here (10–16 feels good)
                panelW: 300,
                panelH: 220
            }); 
            scene.parcelManager = new ParcelManager({
                scene: scene,
                opts: {
                    mainIslandOrigin: continueSnapshot?.world?.mainIslandOrigin ?? PARCEL.MAIN_ORIGIN,

                    // ✅ give ParcelManager the real Map class
                    map: Map,

                    // optional seeded rng later
                    rng: Math.random,
                }
            });
            scene.rebuildBothNavMeshes = function rebuildBothNavMeshes() {
                // ✅ kill old overlays/listeners first
                Map.regionDrawer?.destroy?.();
                Map.enemyRegionDrawer?.destroy?.();
                // ✅ CLEAN UP OLD UPDATERS FIRST
                this.navMeshUpdater?.destroy?.();
                this.enemyNavMeshUpdater?.destroy?.();

                const navMeshPolys = buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
                Map.navMesh = new NavMesh(navMeshPolys);
                for (const poly of Map.navMesh.getPolygons()) {
                    poly.parcelTag = "main";
                    poly.parcelTags = ["main"];
                }

                const enemyNavMeshPolys = buildPolysFromGridMap(Map.enemyNavGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
                Map.enemyNavMesh = new NavMesh(enemyNavMeshPolys);
                for (const poly of Map.enemyNavMesh.getPolygons()) {
                    poly.parcelTag = "main";
                    poly.parcelTags = ["main"];
                }

                // recreate updaters
                this.navMeshUpdater = new NavMeshUpdater(Map.navMesh, this, { toggleKey: "M" });
                this.enemyNavMeshUpdater = new NavMeshUpdater(Map.enemyNavMesh, this, { toggleKey: "N" });

                // after rebuilding Map.navMesh / Map.enemyNavMesh and recreating updaters
                this.navMeshUpdater?.clearDebug();
                this.enemyNavMeshUpdater?.clearDebug();

                if (this.navMeshUpdater?.debugEnabled) this.navMeshUpdater.drawDebug();
                if (this.enemyNavMeshUpdater?.debugEnabled) this.enemyNavMeshUpdater.drawDebug();

                // region systems / drawers (optional)
                Map.regionSystem = new RegionSystem(Map.navMesh, Map.navGrid);
                Map.enemyRegionSystem = new RegionSystem(Map.enemyNavMesh, Map.enemyNavGrid);

                Map.regionDrawer = new RegionDebugDrawer(this, Map.navMesh, Map.regionSystem, { toggleKey: "R" });
                Map.enemyRegionDrawer = new RegionDebugDrawer(this, Map.enemyNavMesh, Map.enemyRegionSystem, { toggleKey: "Y", alpha: 0.16 });
                waterSourcesQuadTree?.setGrid?.(this.gridData);
                waterSourcesQuadTree?.setRegionSystem?.(Map.regionSystem);
                waterSourcesQuadTree?.rebuildAll?.();
                this.waterSourcesQuadTree = waterSourcesQuadTree;

                // re-wire managers that cache updaters
                buildingManager.EnemyNavMeshUpdater = this.enemyNavMeshUpdater;
                buildingManager.NavMeshUpdater = this.navMeshUpdater;
                blockResourceManager.NavMeshUpdater = this.navMeshUpdater;
                blockResourceManager.EnemyNavMeshUpdater = this.enemyNavMeshUpdater;
            };
            scene.resolveParcelTagForTile = function resolveParcelTagForTile(x, y) {
                const fortBounds = StageState?.fortObjective?.refs?.parcelBounds;
                if (fortBounds &&
                    x >= fortBounds.minx && x <= fortBounds.maxx &&
                    y >= fortBounds.miny && y <= fortBounds.maxy) {
                    return "parcel:fort_north";
                }

                const contracts = this.parcelManager?.contractsById?.values?.();
                if (contracts) {
                    for (const inst of contracts) {
                        const bounds = inst?.getParcelBounds?.();
                        if (!bounds) continue;
                        if (x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h) {
                            return bounds.parcelTag ?? `parcel:${inst.slotId}`;
                        }
                    }
                }

                return "main";
            };
            scene.resolveParcelTagForTiles = function resolveParcelTagForTiles(tileCoords = []) {
                let commonTag = null;
                for (const tile of tileCoords) {
                    const tag = this.resolveParcelTagForTile?.(tile.x, tile.y) ?? "main";
                    if (commonTag == null) {
                        commonTag = tag;
                        continue;
                    }
                    if (commonTag !== tag) {
                        return null;
                    }
                }
                return commonTag ?? "main";
            };
            scene.refreshParcelArea = function refreshParcelArea(bounds, opts = {}) {
                const baseBounds = Map._normalizeGridRect?.(bounds?.x, bounds?.y, bounds?.w, bounds?.h, 0);
                if (!baseBounds) return;

                const paddedBounds = Map._normalizeGridRect?.(bounds?.x, bounds?.y, bounds?.w, bounds?.h, 1) ?? baseBounds;
                const isOverview = this.zoomMixer?.mode === "overview";
                const parcelTag = bounds?.parcelTag ?? this.resolveParcelTagForTile?.(baseBounds.minX, baseBounds.minY) ?? "main";

                const applyLocalMeshPatch = (updater, navMesh, navGrid) => {
                    if (!updater?.replaceBounds || !navMesh || !Array.isArray(navGrid) || !navGrid.length) {
                        return;
                    }

                    const change = updater.replaceBounds(
                        { ...paddedBounds, parcelTag, ownerBounds: baseBounds },
                        navGrid,
                        {
                            parcelTag,
                            allowMerge: true,
                            allowCrossTagMerge: true,
                            compactAll: true,
                            ownerBounds: baseBounds
                        }
                    );
                    if (!change?.removedPolyIds?.length) {
                        return;
                    }

                    const impacted = PathRegistry.handlePolysRemoved(navMesh, change.removedPolyIds, change.addedPolyIds);
                    for (const unit of impacted) {
                        PathRepair.repairUnitPath(unit, change.removedPolyIds, navMesh);
                    }
                };

                applyLocalMeshPatch(this.navMeshUpdater, Map.navMesh, Map.navGrid);
                applyLocalMeshPatch(this.enemyNavMeshUpdater, Map.enemyNavMesh, Map.enemyNavGrid);

                Map.regionSystem?.markDirty?.();
                Map.regionDrawer?.markDirty?.();
                Map.enemyRegionSystem?.markDirty?.();
                Map.enemyRegionDrawer?.markDirty?.();
                Map.regionSystem?.ensureUpToDate?.();
                Map.enemyRegionSystem?.ensureUpToDate?.();
                waterSourcesQuadTree?.setGrid?.(this.gridData);
                waterSourcesQuadTree?.setRegionSystem?.(Map.regionSystem);
                if (opts?.waterSourceUpdate?.landParcel && opts?.waterSourceUpdate?.slotId) {
                    waterSourcesQuadTree?.refreshForParcel?.(baseBounds, opts.waterSourceUpdate);
                } else {
                    waterSourcesQuadTree?.refreshBounds?.(opts?.waterSourceUpdate ?? {});
                }

                if (!isOverview) {
                    Map.setDetailedWorldVisible?.(true);
                    Map.redrawRect?.(baseBounds.minX, baseBounds.minY, baseBounds.width, baseBounds.height, 1);
                } else {
                    Map.setDetailedWorldVisible?.(false);
                }

                this.zoomMixer?.updateOverviewCell?.(
                    baseBounds.minX,
                    baseBounds.minY,
                    Map.grid,
                    baseBounds.width,
                    baseBounds.height
                );
                Map._uiIgnoreWorldLayer?.();
            };
            if (!isContinue) {
                // Endless horde run: start clean without a north-fort objective.
                const endlessStart = StageState.startEndlessRun?.() ?? {
                    stageIndex: Math.max(1, Number(StageState.stageIndex || 1)),
                    day: 1,
                    completedHordes: 0,
                };
                resetStoreUnlocks(getRunStoreUnlockKeys(), scene);
                const catchupUnlocks = grantHordeUnlockCatchup(scene, endlessStart.completedHordes);
                scene.clock?.setDay?.(endlessStart.day ?? 1);
                if (catchupUnlocks.length) {
                    showAlert(
                        scene,
                        `Starting unlocks: ${catchupUnlocks.map((reward) => reward.displayLabel).join(", ")}`,
                        "#a7f3d0",
                        2600
                    );
                }
            } else {
                SaveManager.attachScene(scene);
                SaveManager.restoreIntoScene(scene, continueSnapshot);
                scene._pendingContinueSnapshot = null;
            }
            scene._skipStarterResourceSeed = false;
            scene.events.emit?.("stage:changed");
            scene.uiScene?._refreshPhaseClock?.(true);
            scene.overviewOceanWaves?.resize?.();
            SaveManager.attachScene(scene);

            const overlayRef = MainMenu._getOverlayScene(scene) || scene;
            const focusPose = isContinue
                ? MainMenu._getLiveTownFocusPose(scene, overlayRef, continueSnapshot)
                : MainMenu._getTownFocusPose(scene, overlayRef, startCfg?.buildings);
            const overviewPose = isContinue
                ? MainMenu._getDraftCameraPose(scene, overlayRef, continueSnapshot)
                : null;
            if (isContinue && overviewPose) {
                const zoomMixer = MainMenu._ensureZoomMixer(scene);
                MainMenu._prepareContinueOverviewPresentation(scene, zoomMixer, continueSnapshot, overviewPose);
            }
            playReadyLogoSequence(focusPose, {
                isContinue,
                overviewPose,
            });
        };

        const navGridForWorker = MainMenu._ensureNavGridForScene(scene, continueSnapshot);
        worker.postMessage({ navGrid: navGridForWorker, gridData: scene.gridData });
    }

}

