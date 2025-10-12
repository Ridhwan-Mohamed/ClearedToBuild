import logo from 'url:../public/logo.png'
import logoMini from 'url:../public/logoMini.png'
import { TILE_MAP, TILE_TYPES, UIDEPTH, colorFor, create2DArray } from './constants';
import { WaveCollapse } from './waveCollapse';
import { generateTown, buildingArray, townBounds, townRoads, waterSourcesQuadTree } from './town.js';
import { Map } from './map.js';
import { Teams } from './Teams.js';
import worldMap from 'url:../assets/worldMap.png'
import townIcon from 'url:../assets/houseIcon.png'
import { SQUARESIZE } from './constants';
import { NavMeshUpdater } from './NavMeshUpdater.js';
import { ZoomMixer } from './UI/ZoomMixer.js';
import { NavMesh } from './lib/navmesh/navmesh.js';
import { GameStart } from './Controllers/GameStart.js';
import { buildingManager } from './Manager/buildingManager.js';
import { blockResourceManager } from './Manager/BlockResourceManager.js';
import { teamSetupArray } from './constants';
import { Clock } from './Controllers/Clock.js';
import { buildWaterQuadtree } from './lib/waterQuadTree.js'
import start from 'url:../assets/start.png'
import playButton from 'url:../assets/playButton.png'
import { CreateBottomBar } from './UI/BottomBar/BottomBar.js';
import { StorageBuilding } from './buildings/Storage.js';
export var waterSourcesQuadTree;

export class MainMenu {
    static scene = null;

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
        scene.versionText = scene.add.text(scene.scale.width - 75, scene.scale.height - 20, 'v0.2.0', {
            fontSize: '18px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0,1);
        scene.menu.add([scene.logo, scene.versionText]);

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

        scene.logoMini = scene.add.image(centerX, 55, 'logoMini').setOrigin(0.5).setAlpha(0);
        scene.tweens.add({ targets: scene.logoMini, alpha: 1, duration: 500, ease: 'Quad.easeInOut' });

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
        const img = scene.textures.get('worldMap').getSourceImage(); // 500x500
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
        WaveCollapse.scatterOnGrass(scene.gridData, 200);
        WaveCollapse.scatterOnGrass(scene.gridData, 200, TILE_TYPES.grassBerry.grid);
        tex.refresh();
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

        // save handy references for repaint + handoff
        scene._menuTex   = tex;
        scene._menuCtx   = ctx;
        scene._colorCell = colorFor;
        scene._srcW      = srcW;
        scene._srcH      = srcH;
        scene.mapTexKey  = texKey;            // ✅ remember the texture key
        // Show preview centered in screen space
        const maxW = scene.scale.width * 0.9;
        const maxH = scene.scale.height * 0.7;
        const scale = Math.min(maxW / srcW, maxH / srcH);
        const worldW = srcW * SQUARESIZE, worldH = srcH * SQUARESIZE;

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
        cam.centerOn(worldW/2, worldH/2);
        cam.setZoom(0.09);

        scene.uiCamera.ignore(scene.menuPreview); // don’t show on UI cam

        scene.zoomMixer = new ZoomMixer();
        scene.zoomMixer.overviewImage = scene.menuPreview;
        scene.zoomMixer.mode = 'overview'

        scene.tweens.add({ targets: scene.menuPreview, alpha: 1, duration: 500, ease: 'Quad.easeInOut' });

        // Your team-select UI on the preview (icons, swapping etc.)
        MainMenu.buildTeamSelectUI_OnMenuPreview(srcW, srcH, scale);

        // Play button (UI)
        const play = scene.add.image(centerX, scene.scale.height - 40, 'playBtn')
        .setOrigin(0.5)
        .setInteractive({ cursor:'pointer' });
        scene.menu.add(play);

        // Wiggle animation
        scene.tweens.add({
            targets: play,
            angle: { from: -3, to: 3 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        play.on('pointerdown', () => {
            scene.tweens.add({
                targets: [play, scene.menu],
                alpha: 0,
                duration: 200,
                ease: 'Quad.easeInOut',
                onComplete: () => {
                    play.destroy();
                    MainMenu.beginLoadingAndHandOff();
                }
            });
        });

        // Hover darken effect
        play.on('pointerover', () => {
        play.setTint(0xaaaaaa);   // darker shade
        });
        play.on('pointerout', () => {
        play.clearTint();         // restore original
        });

        // Route cameras now that menu exists
        scene.cameras.main.ignore(scene.menu); // main cam: world-only
        // uiCamera sees menu by default
    }

    static buildTeamSelectUI_OnMenuPreview(srcW, srcH, scale) {
        const scene = MainMenu.scene;
        // --- helpers bound to the current preview image ---
        const preview = scene.menuPreview;
        const y0 = preview.y - preview.displayHeight / 2;


        // repaint a bbox (inclusive)
        const repaintBounds = (b) => {
            const ctx = scene._menuCtx;
            const colorForCell = scene._colorCell;
            for (let y = b.miny; y <= b.maxy; y++) {
                for (let x = b.minx; x <= b.maxx; x++) {
                    const val = Array.isArray(scene.gridData[y][x]) ? scene.gridData[y][x][1] : scene.gridData[y][x] 
                    const c = colorForCell(val);
                    ctx.fillStyle = `#${c.toString(16).padStart(6,'0')}`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            scene._menuTex.refresh();
            scene._menuTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        };

        // simple white circle icon if 'townIcon' isn't loaded
        const iconKey = 'townIcon';
        if (!scene.textures.exists(iconKey)) {
            const g = scene.add.graphics();
            g.fillStyle(0xffffff, 1).fillCircle(12, 12, 10);
            g.lineStyle(2, 0x000000, 1).strokeCircle(12, 12, 10);
            g.generateTexture(iconKey, 24, 24);
            g.destroy();
        }

        // === seeds & teams (Team 1 is player by default)
        const seeds = [
            [92, 331], // team 1
            [293, 383], // team 2
            [273, 119], // team 3
            [104, 197]  // team 4
        ];
        const teams = [1, 2, 3, 4];

        // ensure team objects exist
        Teams.newTeam(1); Teams.newTeam(2); Teams.newTeam(3); Teams.newTeam(4);

        // place towns and stamp building ownership (index 3)
        seeds.forEach(([sx, sy], idx) => {
            const team = teams[idx];
            scene.gridData = generateTown(
                scene.gridData,
                // choose your setup here (smallTeam / bigTeam):
                teamSetupArray.smallTeam,
                team,
                sx, sy,
                Map.navGrid
            );
            const b = townBounds[team];
            if (!b) return;

            // ensure buildingArray[3] = team inside this bbox
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

        // status label near top of preview
        const label = scene.add.text(
            preview.x, y0 + 20, '',
            { fontSize: '16px', fill: '#ffffff', stroke: '#000', strokeThickness: 3 }
        ).setOrigin(0.5).setAlpha(0.9);

        // create clickable icons for teams
        const townIcons = {};
        const makeIconForTeam = (team) => {
            const b = townBounds[team];
            if (!b) return null;

            const cx = Math.round((b.minx + b.maxx) / 2);
            const cy = Math.round((b.miny + b.maxy) / 2);
            const ix = cx * SQUARESIZE;
            const iy = cy * SQUARESIZE;

            const icon = ZoomMixer.createZoomInvariantIcon(
                'townIcon',
                `Team ${team}`,
                ix, iy,
                { baseScale: 0.9 }
            );

            // default: dark grey tint; team 1 (player) clears tint
            icon.setTint(0x141414);
            townIcons[team] = icon;

            icon.on('pointerover', () => icon.setScale(1.05));
            icon.on('pointerout',  () => icon.setScale(0.9));

            icon.on('pointerdown', () => {
            if (team === 1) return; // already player

            const bSel = townBounds[team];
            const bPly = townBounds[1];
            if (!bSel || !bPly) return;

            // 1) Mark clicked team's buildings to temp
            for (let i = 0; i < buildingArray.length; i++) {
                const e = buildingArray[i];
                if (!e || e.length < 4) continue;
                const [bx, by, , curTeam] = e;
                if (curTeam === team &&
                    bx >= bSel.minx && bx <= bSel.maxx &&
                    by >= bSel.miny && by <= bSel.maxy) {
                buildingArray[i][3] = -999; // temp marker
                }
            }
            // 2) Player -> clicked team
            for (let i = 0; i < buildingArray.length; i++) {
                const e = buildingArray[i];
                if (!e || e.length < 4) continue;
                const [bx, by, , curTeam] = e;
                if (curTeam === 1 &&
                    bx >= bPly.minx && bx <= bPly.maxx &&
                    by >= bPly.miny && by <= bPly.maxy) {
                buildingArray[i][3] = team;
                }
            }
            // 3) Temp -> player
            for (let i = 0; i < buildingArray.length; i++) {
                if (buildingArray[i] && buildingArray[i][3] === -999) buildingArray[i][3] = 1;
            }

            // 4) Swap bounds
            const tmpB = townBounds[1];
            townBounds[1]   = bSel;
            townBounds[team] = tmpB;

            // 5) Swap roads by reference (so spawns/pathing move too)
            const t1 = '1', tSel = String(team);
            const tmpR = townRoads[t1];
            townRoads[t1]    = townRoads[tSel];
            townRoads[tSel]  = tmpR;

            // (Optional) swap centers if tracked in Teams
            if (Teams?.teamLists?.[t1] && Teams?.teamLists?.[tSel]) {
                const c1 = Teams.teamLists[t1].center;
                Teams.teamLists[t1].center  = Teams.teamLists[tSel].center;
                Teams.teamLists[tSel].center= c1;
            }

            // repaint both towns’ areas
            repaintBounds(townBounds[1]);
            repaintBounds(townBounds[team]);

            // tints: make all dark grey, then clear the (now player) icon
            Object.values(townIcons).forEach(ic => ic.setTint(0x141414));
            icon.clearTint();

            // feedback label
            label.setText(`Selected Team ${team} as Player`).setAlpha(1);
            scene.time.delayedCall(1200, () => label.setAlpha(0));
            });

            return icon;
        };

        [1,2,3,4].forEach(makeIconForTeam);
        if (townIcons[1]) townIcons[1].clearTint(); // auto-highlight player town
    }

    static beginLoadingAndHandOff() {
        const scene = MainMenu.scene;
        const centerX = scene.scale.width / 2;
        const centerY = scene.scale.height - 40; // same Y as Play button

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
            Map.initMap();
            Map.mapFromData(scene.gridData);
            Map.navMesh = new NavMesh(polys);
            // when you create the navmesh, after constructor:
            Map.navMesh._nextPolyId = Math.max(...Map.navMesh.navPolygons.map(p => p.id)) + 1;
            scene.navMeshUpdater = new NavMeshUpdater(Map.navMesh, scene);
            scene.navMeshUpdater.setupAddAndRemove();
            buildingManager.NavMeshUpdater = scene.navMeshUpdater;
            blockResourceManager.NavMeshUpdater = scene.navMeshUpdater;
            Map.drawBuildings();
            CreateBottomBar(scene);
            GameStart.placePlayers();
            scene.sceneButtons();
            scene.clock = new Clock(scene);

            // Fade out everything in menu + loading UI
            const fadeTargets = [scene.menu, scene.logoMini, loading];
            scene.tweens.add({
                targets: fadeTargets,
                alpha: 0,
                duration: 600,
                ease: 'Quad.easeInOut',
                onComplete: () => {
                    scene.menu.destroy();
                    scene.logoMini.destroy();
                    loading.destroy();

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
                    scene.zoomMixer.hookWheel();
                    scene.zoomMixer.hookKeys();
                    worker.terminate();
                }
            });
        };

        worker.postMessage({ navGrid: Map.navGrid, gridData: scene.gridData });
    }

}
