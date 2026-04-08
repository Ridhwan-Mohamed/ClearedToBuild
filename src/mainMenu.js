import logo from 'url:../public/logo.png'
import logoMini from 'url:../public/logoMini.png'
import { TILE_MAP, TILE_TYPES, UIDEPTH, colorFor, create2DArray, PARCEL } from './constants';
import { generateTown, buildingArray, townBounds, townRoads } from './town.js';
import { Map } from './map.js';
import { Teams } from './Teams.js';
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
import playButton from 'url:./assets/playButton.png'
import { VisibilitySystem } from './UI/VisibilitySystem.js';
import { PathRegistry } from './lib/navmesh/PathRegistry.js';
import { RegionSystem } from './lib/navmesh/RegionSystem.js';
import { RegionDebugDrawer } from './lib/navmesh/RegionDebugDrawer.js';
import { DraftStartMenu } from './UI/DraftUI/DraftStartMenu.js';
import { ParcelSpawnController } from './parcelSpawn/ParcelSpawnController.js';
import { ParcelManager } from './parcel_system/ParcelManager.js';
import { buildPolysFromGridMap } from './lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import { StageState } from './parcelController/StageState.js';
import { paintOverviewTexture } from './UI/OverviewStylePainter.js';
export var waterSourcesQuadTree;

export class MainMenu {
    static scene = null;

    static _getDraftCameraPose(scene, overlayScene = scene) {
        const tex = scene?.textures?.get?.('worldMap');
        const img = tex?.getSourceImage?.();
        if (!img) return null;

        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const worldW = srcW * SQUARESIZE;
        const worldH = srcH * SQUARESIZE;
        const mapViewportCenterX = overlayScene.scale.width / 2;
        const targetZoom = 0.72;
        const targetCenterX = worldW / 2;
        const targetCenterY = worldH / 2;

        return {
            targetZoom,
            targetScrollX: targetCenterX - (mapViewportCenterX / targetZoom),
            targetScrollY: targetCenterY + 60 - ((overlayScene.scale.height * 0.5) / targetZoom),
        };
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
        const centerX = worldMinX + worldW / 2;
        const centerY = worldMinY + worldH / 2;

        const fitZoom = Math.min(
            (overlayScene.scale.width * 0.49) / worldW,
            (overlayScene.scale.height * 0.55) / worldH,
        );
        const targetZoom = Phaser.Math.Clamp(fitZoom, 0.88, 1.55);

        return {
            targetZoom,
            targetScrollX: centerX - ((overlayScene.scale.width * 0.5) / targetZoom),
            targetScrollY: centerY - ((overlayScene.scale.height * 0.5) / targetZoom),
        };
    }

    static _setDraftPreviewVisibility(show, opts = {}) {
        const scene = MainMenu.scene;
        if (!scene) return;

        const overlayScene = scene.uiScene || scene;
        const cam = scene.cameras.main;
        const duration = opts.immediate ? 0 : (show ? 520 : 360);
        const pose = show
            ? MainMenu._getTownFocusPose(scene, overlayScene, opts.placedBuildings)
            : MainMenu._getDraftCameraPose(scene, overlayScene);
        const fadeTargets = [scene.menuPreview, scene._teamTownIcon].filter(Boolean);

        for (const target of fadeTargets) {
            target.setVisible(true);
            if (typeof target.setActive === "function") target.setActive(true);
        }

        scene.tweens.killTweensOf(fadeTargets);
        scene.tweens.killTweensOf(cam);

        if (pose) {
            if (duration > 0) {
                scene.tweens.add({
                    targets: cam,
                    zoom: pose.targetZoom,
                    scrollX: pose.targetScrollX,
                    scrollY: pose.targetScrollY,
                    duration,
                    ease: show ? 'Cubic.easeOut' : 'Quad.easeInOut',
                });
            } else {
                cam.setZoom(pose.targetZoom);
                cam.setScroll(pose.targetScrollX, pose.targetScrollY);
            }
            if (scene.zoomMixer) {
                scene.zoomMixer.targetZoom = pose.targetZoom;
                scene.zoomMixer.anchorWorld = cam.midPoint ? { x: cam.midPoint.x, y: cam.midPoint.y } : null;
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
        console.log(worldMap)
        scene.load.image('logo', logo);
        scene.load.image('worldMap', worldMap)
        scene.load.image('townIcon', townIcon)
        scene.load.image('logoMini', logoMini)
        scene.load.image('startBtn', start);
        scene.load.image('playBtn', playButton);
    }

    /** Build the preview/selection UI in screen space (on UI camera) */
    static startMenuPhase() {
        const scene = MainMenu.scene;
        const overlayScene = scene.uiScene || scene;
        const centerX = overlayScene.scale.width / 2;
        const centerY = overlayScene.scale.height / 2;
        const cam = scene.cameras.main;
        const draftPose = MainMenu._getDraftCameraPose(scene, overlayScene);

        if (draftPose) {
            cam.roundPixels = true;
            cam.setZoom(draftPose.targetZoom);
            cam.setScroll(draftPose.targetScrollX, draftPose.targetScrollY);
        }

        // Logo + version (your existing assets/keys)
        const menu = overlayScene.add.container(0,0).setDepth(9998).setScrollFactor(0);
        const logo = overlayScene.add.image(centerX, centerY, 'logo').setOrigin(0.5);
        const versionText = overlayScene.add.text(overlayScene.scale.width - 75, overlayScene.scale.height - 20, 'v0.9.6', {
            fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0,1);
        menu.add([logo, versionText]);

        // Keep refs on world scene for existing handoff/fade code.
        scene.menu = menu;
        scene.logo = logo;
        scene.versionText = versionText;

        const startButton = overlayScene.add.image(centerX, centerY + 260, 'startBtn')
            .setOrigin(0.5)
            .setInteractive({ cursor: 'pointer' });
        menu.add(startButton);
        scene.startButton = startButton;

        // Wiggle animation
        overlayScene.tweens.add({
            targets: startButton,
            angle: { from: -2, to: 2 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Make button pulse a little
        overlayScene.tweens.add({
            targets: startButton,
            alpha: 0.25,
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        // Float
        overlayScene.tweens.add({
        targets: logo,
        y: centerY - 10,
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
        scale: { from: 1, to: 1.05 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeInOut'
        });


        startButton.on('pointerdown', () => {
            startButton.disableInteractive();
            overlayScene.tweens.killTweensOf(logo);
            overlayScene.tweens.killTweensOf(startButton);
            overlayScene.tweens.killTweensOf(versionText);
            overlayScene.tweens.add({
                targets: versionText,
                alpha: 0,
                duration: 260,
                ease: 'Quad.easeOut',
            });

            // Animate logo up and shrink, then only enter draft once the motion fully finishes.
            overlayScene.tweens.add({
                targets: logo,
                y: 72,
                scale: 0.22,
                duration: 1140,
                alpha: 0,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    logo.destroy();
                    scene.time.delayedCall(140, () => {
                        MainMenu.buildMapSelectPhase({ fromStartMenu: true });
                    });
                }
            });

            // Fade out the start button
            overlayScene.tweens.add({
                targets: startButton,
                alpha: 0,
                scaleX: 0.92,
                scaleY: 0.92,
                duration: 320,
                onComplete: () => startButton.destroy()
            });
        });
    }

    static buildMapSelectPhase(opts = {}){
        const scene = MainMenu.scene;
        const overlayScene = scene.uiScene || scene;
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
        const targetScrollX = draftPose?.targetScrollX ?? 0;
        const targetScrollY = draftPose?.targetScrollY ?? 0;

        if (opts?.fromStartMenu) {
            scene.tweens.add({
                targets: cam,
                zoom: targetZoom,
                scrollX: targetScrollX,
                scrollY: targetScrollY,
                duration: 900,
                ease: 'Cubic.easeInOut'
            });
        } else {
            cam.setZoom(targetZoom);
            cam.setScroll(targetScrollX, targetScrollY);
        }

        // mainMenu.js, right after cam.setZoom(0.5);
        scene.zoomMixer = new ZoomMixer();
        scene.zoomMixer.overviewImage = scene.menuPreview;
        scene.zoomMixer.texKey = scene.mapTexKey;
        scene.zoomMixer.mode = 'overview';

        // ✅ prevent update() from drifting zoom toward 1.0 during the menu
        scene.zoomMixer.targetZoom = cam.zoom;
        scene.zoomMixer.anchorWorld = cam.midPoint ? { x: cam.midPoint.x, y: cam.midPoint.y } : null;
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
        const draftScene = scene.uiScene || scene.scene.get('GameUIScene') || scene;
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

    static beginLoadingAndHandOff(startCfg) {
        const scene = MainMenu.scene;
        const overlayScene = scene.uiScene || scene;
        const t1 = Teams.teamLists && Teams.teamLists["1"];
        const kitResources = startCfg?.resources ?? MainMenu.selectedStartKit?.resources ?? t1?.startKit?.resources;
        const kitCards = Array.isArray(startCfg?.cards?.picked)
            ? startCfg.cards.picked.slice(0, 3)
            : (Array.isArray(MainMenu.selectedStartKit?.cards)
                ? MainMenu.selectedStartKit.cards.slice(0, 3)
                : (Array.isArray(t1?.startKit?.cards) ? t1.startKit.cards.slice(0, 3) : null));

        if (startCfg) {
            // team name
            if (t1) t1.name = startCfg.teamName;

            // supplies + starting cash
            const startResources = startCfg.resources ?? startCfg.supplies ?? {};
            scene.money          = startResources.money ?? startCfg.money?.amount ?? scene.money;
            scene.seeds          = startResources.seeds ?? 0;
            scene.berries        = startResources.berries ?? 0;
            scene.woodAmnt       = startResources.wood ?? 0;
            scene.stoneAmnt      = startResources.stone ?? 0;
            scene.foodAmnt       = startResources.food ?? 0;
            scene.cleanWaterAmnt = startResources.water ?? 0;

            // cards: you’ll want to map ids back to your real card objects
            // (keep this simple for now—if your cards are already objects with apply(), you can store them directly)
            // crew config for GameStart
            scene.startCrew = startCfg.crew;

            // buildings are already written into gridData + buildingArray during the draft preview
        }

        scene.permits = 2;
        
        // Apply the chosen starting kit (resources + starting cards) to Team 1
        if (kitResources) {
            scene.money          = kitResources.money ?? scene.money;
            scene.seeds          = kitResources.seeds ?? scene.seeds;
            scene.berries        = kitResources.berries ?? scene.berries;
            scene.woodAmnt       = kitResources.wood ?? scene.woodAmnt;
            scene.stoneAmnt      = kitResources.stone ?? scene.stoneAmnt;
            scene.foodAmnt       = kitResources.food ?? scene.foodAmnt;
            scene.cleanWaterAmnt = kitResources.water ?? scene.cleanWaterAmnt;
        }

        if (t1 && Array.isArray(kitCards)) {
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
        const playReadyLogoSequence = (focusPose) => {
            if (launchSequencePlayed) return;
            launchSequencePlayed = true;

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
                const targetZoom = scene.zoomMixer?.detailedZoom ?? 1;
                const targetScrollX = focusPose?.targetScrollX ?? cam.scrollX;
                const targetScrollY = focusPose?.targetScrollY ?? cam.scrollY;
                scene.zoomMixer.targetZoom = targetZoom;
                scene.zoomMixer.anchorWorld = cam.midPoint ? { x: cam.midPoint.x, y: cam.midPoint.y } : null;
                scene.zoomMixer.anchorScreen = { x: cam.width * 0.5, y: cam.height * 0.5 };

                scene.tweens.add({
                    targets: cam,
                    scrollX: targetScrollX,
                    scrollY: targetScrollY,
                    zoom: targetZoom,
                    duration: 1000,
                    ease: 'Cubic.easeInOut',
                    onComplete: () => {
                        VisibilitySystem.init(scene);
                        scene.zoomMixer.swapMode('detailed');
                        scene.uiScene?.initGameplayUI?.();
                        if (scene.clock) scene.clock.paused = false;

                        overlayScene.tweens.add({
                            targets: loading,
                            alpha: 0,
                            duration: 220,
                            ease: 'Quad.easeInOut',
                            onComplete: () => {
                                loading.destroy();
                            }
                        });

                        scene.zoomMixer.hookWheel();
                        scene.zoomMixer.hookKeys();
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
            waterSourcesQuadTree = buildWaterQuadtree(scene.gridData);
            scene.prebuiltPolys = polys;
            console.log(polys)
            Map.initMap();
            Map.mapFromData(scene.gridData);
            // existing
            Map.navMesh = new NavMesh(polys);
            Map.navMesh._nextPolyId = Math.max(...Map.navMesh.navPolygons.map(p => p.id)) + 1;
            scene.navMeshUpdater = new NavMeshUpdater(Map.navMesh, scene, {
                toggleKey: "M",
                fillColor: 0x00ff00,
                fillAlpha: 0.20,
            });
            scene.navMeshUpdater.setupAddAndRemove();
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
            Map.enemyNavMesh._nextPolyId = Math.max(...Map.enemyNavMesh.navPolygons.map(p => p.id)) + 1;

            scene.enemyNavMeshUpdater = new NavMeshUpdater(Map.enemyNavMesh, scene, {
                toggleKey: "N",
                fillColor: 0xff0000,
                fillAlpha: 0.18,
            });
            scene.enemyNavMeshUpdater.setupAddAndRemove();

            // Give PathRegistry a second registry keyed to enemy mesh
            PathRegistry.init(Map.enemyNavMesh);

            // normal
            Map.regionSystem = new RegionSystem(Map.navMesh, Map.navGrid);
            Map.regionDrawer = new RegionDebugDrawer(scene, Map.navMesh, Map.regionSystem, { toggleKey: "U" });

            // enemy
            Map.enemyRegionSystem = new RegionSystem(Map.enemyNavMesh, Map.enemyNavGrid);
            Map.enemyRegionDrawer = new RegionDebugDrawer(scene, Map.enemyNavMesh, Map.enemyRegionSystem, { toggleKey: "Y", alpha: 0.16 });
            
            // let managers access enemy updater too
            buildingManager.EnemyNavMeshUpdater = scene.enemyNavMeshUpdater;

            blockResourceManager.NavMeshUpdater = scene.navMeshUpdater;
            blockResourceManager.EnemyNavMeshUpdater = scene.enemyNavMeshUpdater;
            Map.drawBuildings();
            GameStart.placePlayers(startCfg);
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
                    mainIslandOrigin: PARCEL.MAIN_ORIGIN,

                    // ✅ give ParcelManager the real Map class
                    map: Map,

                    // optional seeded rng later
                    rng: Math.random,
                }
            });
            Teams.newTeam(0);
            scene.rebuildBothNavMeshes = function rebuildBothNavMeshes() {
                // ✅ kill old overlays/listeners first
                Map.regionDrawer?.destroy?.();
                Map.enemyRegionDrawer?.destroy?.();
                // ✅ CLEAN UP OLD UPDATERS FIRST
                this.navMeshUpdater?.destroy?.();
                this.enemyNavMeshUpdater?.destroy?.();

                const navMeshPolys = buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
                Map.navMesh = new NavMesh(navMeshPolys);

                const enemyNavMeshPolys = buildPolysFromGridMap(Map.enemyNavGrid, SQUARESIZE, SQUARESIZE, undefined, 0);
                Map.enemyNavMesh = new NavMesh(enemyNavMeshPolys);

                // after Map.navMesh = new NavMesh(navMeshPolys);
                Map.navMesh._nextPolyId = Math.max(...Map.navMesh.navPolygons.map(p => p.id)) + 1;
                console.log(Map.navMesh._nextPolyId);

                // after Map.enemyNavMesh = new NavMesh(enemyNavMeshPolys);
                Map.enemyNavMesh._nextPolyId = Math.max(...Map.enemyNavMesh.navPolygons.map(p => p.id)) + 1;
                console.log(Map.enemyNavMesh._nextPolyId);

                // recreate updaters
                this.navMeshUpdater = new NavMeshUpdater(Map.navMesh, this, { toggleKey: "M" });
                this.enemyNavMeshUpdater = new NavMeshUpdater(Map.enemyNavMesh, this, { toggleKey: "N" });

                // ✅ CRITICAL: re-apply the monkey patch methods
                this.navMeshUpdater.setupAddAndRemove();
                this.enemyNavMeshUpdater.setupAddAndRemove();

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

                // re-wire managers that cache updaters
                buildingManager.EnemyNavMeshUpdater = this.enemyNavMeshUpdater;
                buildingManager.NavMeshUpdater = this.navMeshUpdater;
                blockResourceManager.NavMeshUpdater = this.navMeshUpdater;
                blockResourceManager.EnemyNavMeshUpdater = this.enemyNavMeshUpdater;
            };
            // Endless horde run: start clean without a north-fort objective.
            StageState.startEndlessRun?.();
            scene.overviewOceanWaves?.resize?.();

            const focusPose = MainMenu._getTownFocusPose(scene, scene.uiScene || scene, startCfg?.buildings);
            playReadyLogoSequence(focusPose);
        };

        worker.postMessage({ navGrid: Map.navGrid, gridData: scene.gridData });
    }

}

