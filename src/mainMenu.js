import logo from 'url:../public/logo.png'
import logoMini from 'url:../public/logoMini.png'
import { DRAFT_UI_X_SHIFT, TILE_MAP, TILE_TYPES, UIDEPTH, colorFor, create2DArray, PARCEL } from './constants';
import { generateTown, buildingArray, townBounds, townRoads } from './town.js';
import { Map } from './map.js';
import { Teams } from './Teams.js';
import worldMap from 'url:./assets/worldMap.png'
import townIcon from 'url:./assets/houseIcon.png'
import { SQUARESIZE } from './constants';
import { NavMeshUpdater } from './lib/navmesh/NavMeshUpdater.js';
import { createZoomButtons, ZoomMixer } from './UI/ZoomMixer.js';
import { NavMesh } from './lib/navmesh/navmesh.js';
import { GameStart } from './Controllers/GameStart.js';
import { buildingManager } from './Manager/buildingManager.js';
import { blockResourceManager } from './Manager/BlockResourceManager.js';
import { teamSetupArray } from './constants';
import { buildWaterQuadtree } from './lib/waterQuadTree.js'
import start from 'url:./assets/start.png'
import playButton from 'url:./assets/playButton.png'
import { CreateBottomBar } from './UI/BottomBar/BottomBar.js';
import { VisibilitySystem } from './UI/VisibilitySystem.js';
import { PathRegistry } from './lib/navmesh/PathRegistry.js';
import { RegionSystem } from './lib/navmesh/RegionSystem.js';
import { RegionDebugDrawer } from './lib/navmesh/RegionDebugDrawer.js';
import { DraftStartMenu } from './UI/DraftUI/DraftStartMenu.js';
import { ParcelSpawnController } from './parcelSpawn/ParcelSpawnController.js';
import { ParcelManager } from './parcel_system/ParcelManager.js';
import { buildPolysFromGridMap } from './lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import { spawnNorthFort } from './parcel_system/FortRaidParcel.js';
import { ensureStageHud } from './UI/StageHud.js';
export var waterSourcesQuadTree;

export class MainMenu {
    static scene = null;

    static _upsertTeamTownIcon(teamName = "My Team") {
        const scene = MainMenu.scene;
        if (!scene) return;

        const b1 = townBounds[1];
        if (!b1) return;

        const cx = ((b1.minx + b1.maxx) / 2) * SQUARESIZE;
        const cy = ((b1.miny + b1.maxy) / 2) * SQUARESIZE;

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
        const centerX = scene.scale.width / 2;
        const centerY = scene.scale.height / 2;

        // Logo + version (your existing assets/keys)
        scene.menu = scene.add.container(0,0).setDepth(9998).setScrollFactor(0);
        scene.logo = scene.add.image(centerX, centerY, 'logo').setOrigin(0.5);
        scene.versionText = scene.add.text(scene.scale.width - 75, scene.scale.height - 20, 'v0.9.2', {
            fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0,1);
        scene.menu.add([scene.logo, scene.versionText]);
        scene.cameras.main.ignore(scene.menu);

        scene.startButton = scene.add.image(centerX, centerY + 260, 'startBtn')
            .setOrigin(0.5)
            .setInteractive({ cursor: 'pointer' });
        scene.menu.add(scene.startButton);

        // Wiggle animation
        scene.tweens.add({
            targets: scene.startButton,
            angle: { from: -2, to: 2 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Make button pulse a little
        scene.tweens.add({
            targets: scene.startButton,
            alpha: 0.25,
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        // Float
        scene.tweens.add({
        targets: scene.logo,
        y: centerY - 10,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
        });

        // Wiggle
        scene.tweens.add({
        targets: scene.logo,
        angle: { from: -2, to: 2 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
        });

        // Pulse
        scene.tweens.add({
        targets: scene.logo,
        scale: { from: 1, to: 1.05 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeInOut'
        });


        scene.startButton.on('pointerdown', () => {
            // Animate logo up and shrink
            scene.tweens.add({
                targets: scene.logo,
                y: 80, scale: 0.25,
                duration: 1000,
                alpha: 0,
                ease: 'Cubic.easeInOut',
                onComplete: () => scene.logo.destroy()
            });

            // Fade out the start button
            scene.tweens.add({
                targets: scene.startButton,
                alpha: 0,
                duration: 300,
                onComplete: () => scene.startButton.destroy()
            });

            // Delay slightly, then build the map/town select UI
            scene.time.delayedCall(1500, () => {
                MainMenu.buildMapSelectPhase();
            });
        });
    }

    static buildMapSelectPhase(){
        const scene = MainMenu.scene;
        const centerX = scene.scale.width / 2;
        const centerY = scene.scale.height / 2;

        scene.logoMini = scene.add.image(centerX + DRAFT_UI_X_SHIFT, 80, 'logoMini').setOrigin(0.5).setAlpha(0);
        scene.tweens.add({ targets: scene.logoMini, alpha: 1, duration: 500, ease: 'Quad.easeInOut' });
        scene.cameras.main.ignore(scene.logoMini);
        // Drop / bob down slightly
        scene.tweens.add({
            targets: scene.logoMini,
            y: 65,                   // lower than its initial 55
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        // Wiggle side to side
        scene.tweens.add({
            targets: scene.logoMini,
            angle: { from: -1.5, to: 1.5 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        // Pulse scale gently
        scene.tweens.add({
            targets: scene.logoMini,
            scale: { from: 1, to: 1.04 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut'
        });
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
                const c = colorFor(value);
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
                ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
                ctx.fillRect(x, y, 1, 1);
            }
        }

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
        // scene.uiCamera.ignore(waterOverlay);

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
            .setAlpha(0);

        scene.uiCamera.ignore(scene.menuPreview);

        const cam = scene.cameras.main;
        cam.roundPixels = true;
        // cam.setBounds(0,0, worldW, worldH);
        cam.setZoom(0.7);

        // Shift the camera center LEFT in world units so the map appears RIGHT on screen
        const dxWorld = DRAFT_UI_X_SHIFT / cam.zoom;
        cam.centerOn((worldW / 2) - dxWorld, worldH / 2);


        scene.uiCamera.ignore(scene.menuPreview); // don’t show on UI cam

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
        const colorForCell = scene._colorCell;
        for (let y = b.miny; y <= b.maxy; y++) {
            for (let x = b.minx; x <= b.maxx; x++) {
            const val = Array.isArray(scene.gridData[y][x]) ? scene.gridData[y][x][1] : scene.gridData[y][x];
            const c = colorForCell(val);
            ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
            ctx.fillRect(x, y, 1, 1);
            }
        }
        scene._menuTex.refresh();
        scene._menuTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        };

        // optional full repaint if you want a convenience hook
        scene.fullRepaintPreview = () => {
        repaintBounds({ minx: 0, miny: 0, maxx: srcW - 1, maxy: srcH - 1 });
        };

        // flag if you use it anywhere else
        scene.isMainMenuPreview = true;

        // destroy old if re-entering
        scene.draftMenu?.destroy?.();
        Teams.newTeam(1);

        // build the draft UI (v5)
            scene.draftMenu = DraftStartMenu.build(scene, {
            srcW,
            srcH,
            gridData: scene.gridData,
            repaintBounds
        });

        scene.events.off("draftTeamNameChanged");
        scene.events.on("draftTeamNameChanged", (name) => {
            MainMenu._upsertTeamTownIcon(name);
        });
        MainMenu._upsertTeamTownIcon(scene.draftMenu?.state?.teamName || "My Team");

        // IMPORTANT: make sure the draft UI is NOT rendered by the main camera
        scene.cameras.main.ignore(scene.draftMenu.container);

        // Confirm → start game with cfg
        scene.events.off("draftConfirmed");
        scene.events.on("draftConfirmed", (startCfg) => {
        // store it so beginLoadingAndHandOff + GameStart can use it
        scene.startCfg = startCfg;

        // fade out the draft UI if you want
        scene.tweens.add({
            targets: scene.draftMenu.container,
            alpha: 0,
            duration: 200,
            ease: "Quad.easeInOut",
            onComplete: () => {
                scene.draftMenu?.preview?.clearDraftPlayerIcons?.();
                scene.draftMenu.destroy();
                MainMenu.beginLoadingAndHandOff(startCfg);
            }
        });
        });
        scene.tweens.add({ targets: scene.menuPreview, alpha: 1, duration: 500, ease: 'Quad.easeInOut' });
        // uiCamera sees menu by default
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

        if (startCfg) {
            // team name
            const t1 = Teams.teamLists && Teams.teamLists["1"];
            if (t1) t1.name = startCfg.teamName;

            // supplies
            scene.seeds          = startCfg.supplies.seeds;
            scene.berries        = startCfg.supplies.berries;
            scene.woodAmnt       = startCfg.supplies.wood;
            scene.stoneAmnt      = startCfg.supplies.stone;
            scene.foodAmnt       = startCfg.supplies.food;
            scene.cleanWaterAmnt = startCfg.supplies.water;

            // cards: you’ll want to map ids back to your real card objects
            // (keep this simple for now—if your cards are already objects with apply(), you can store them directly)
            if (t1 && Array.isArray(startCfg.cards?.picked)) {
                t1.cardHand = startCfg.cards.picked.slice(0, 3);
                t1.cardHand.forEach(c => c.apply?.());
            }

            // crew config for GameStart
            scene.startCrew = startCfg.crew;

            // buildings are already written into gridData + buildingArray during the draft preview
        }
        
        const centerX = scene.scale.width / 2;
        const centerY = scene.scale.height - 40; // same Y as Play button

        // Apply the chosen starting kit (resources + starting cards) to Team 1
        const fallbackTeam = Teams.teamLists && Teams.teamLists['1'];
        const kit = MainMenu.selectedStartKit ||
                    (fallbackTeam && fallbackTeam.startKit);

        if (kit && kit.resources) {
            const r = kit.resources;

            scene.seeds          = r.seeds;
            scene.berries        = r.berries;
            scene.woodAmnt       = r.wood;
            scene.stoneAmnt      = r.stone;
            scene.foodAmnt       = r.food;
            scene.cleanWaterAmnt = r.water;


            if (Array.isArray(kit.cards) && fallbackTeam) {
                fallbackTeam.cardHand = kit.cards.slice(0, 3);
                fallbackTeam.cardHand.forEach(element => {
                    element.apply();
                });
            }
        }

        // Overlay container for bg + spinner
        const loading = scene.add.container(0, 0).setDepth(9999).setScrollFactor(0);

        // Dark background under spinner
        const darkBg = scene.add.rectangle(
            0, 0, scene.scale.width, scene.scale.height,
            0x000000, 0.65
        ).setOrigin(0).setAlpha(0);
        loading.add(darkBg);
        scene.cameras.main.ignore(loading)

        if (ZoomMixer.mapIconContainer) {
            ZoomMixer.mapIconContainer.iterate(child => {
                if (child?.disableInteractive) {
                    // Save hover behavior: leave pointerover/out intact
                    child.removeAllListeners('pointerdown');
                }
            });
        }

        // Spinner at play button spot
        const spinner = scene.add.graphics({ x: centerX, y: centerY });
        spinner.lineStyle(6, 0xffffff, 1);
        spinner.arc(0, 0, 15, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(270), false);
        spinner.strokePath();
        spinner.setAlpha(0);
        loading.add(spinner);

        // Fade both in
        scene.tweens.add({ targets: darkBg, alpha: 1, duration: 400, ease: 'Quad.easeInOut' });
        scene.tweens.add({ targets: spinner, alpha: 1, duration: 400, ease: 'Quad.easeInOut' });

        // Spin tween
        scene.tweens.add({
            targets: spinner,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });

        // Worker setup
        const worker = new Worker(new URL('./workers/navMeshWorker.js', import.meta.url), { type: 'module' });

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

            ensureStageHud(scene, { stagesPerSeason: 5 });

            blockResourceManager.NavMeshUpdater = scene.navMeshUpdater;
            blockResourceManager.EnemyNavMeshUpdater = scene.enemyNavMeshUpdater;
            Map.drawBuildings();
            GameStart.placePlayers(startCfg);
            CreateBottomBar(scene);
            scene.sceneButtons();
            VisibilitySystem.init(scene);           // build blockers + occlusion from the map
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
            createZoomButtons(scene)
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
            // --- North Fort (raid/boss island) ---
            // Spawn immediately so you can see it on load.
            spawnNorthFort({
                scene,
                map: Map,
                mainIslandOrigin: PARCEL.MAIN_ORIGIN,
            });
            // Keep the minimap/overview synced after painting
            scene.zoomMixer?.buildOverviewTextureFromGrid?.(Map.grid, SQUARESIZE, (cell) => colorFor(cell));
            Map._uiIgnoreWorldLayer?.();

            // Fade out everything in menu + loading UI
            const fadeTargets = [scene.menu, scene.logoMini, loading];
            scene.cameras.main.ignore(scene.logoMini);
            scene.tweens.add({
                targets: fadeTargets,
                alpha: 0,
                duration: 600,
                ease: 'Quad.easeInOut',
                onComplete: () => {
                    scene.menu.destroy();
                    scene.logoMini.destroy();
                    loading.destroy();
                    scene.menuPreview.removeAllListeners();

                    // Now continue into zoom + gameplay
                    const b = townBounds[1];
                    if (b) {
                        const cx = (b.minx + b.maxx) / 2 * SQUARESIZE;
                        const cy = (b.miny + b.maxy) / 2 * SQUARESIZE;
                        Map.reDraw()
                        const cam = scene.cameras.main;
                        scene.tweens.add({
                            targets: cam,
                            scrollX: cx - cam.width / 2,
                            scrollY: cy - cam.height / 2,
                            zoom: 1.0,
                            duration: 1000,
                            ease: 'Quad.easeInOut',
                            onComplete: () => {
                                scene.zoomMixer.swapMode('detailed');
                            }
                        });

                    }
                    scene.zoomMixer.swapMode('detailed');
                    scene.zoomMixer.hookWheel();
                    scene.zoomMixer.hookKeys();
                    worker.terminate();
                }
            });
        };

        worker.postMessage({ navGrid: Map.navGrid, gridData: scene.gridData });
    }

}
