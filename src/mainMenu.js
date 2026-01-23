import logo from 'url:../public/logo.png'
import logoMini from 'url:../public/logoMini.png'
import { TILE_MAP, TILE_TYPES, UIDEPTH, colorFor, create2DArray } from './constants';
import { WaveCollapse } from './waveCollapse';
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
import { POWERUP_CARDS } from './Cards/PowerupCards.js';
import { PathRegistry } from './lib/navmesh/PathRegistry.js';
import { RegionSystem } from './lib/navmesh/RegionSystem.js';
import { RegionDebugDrawer } from './lib/navmesh/RegionDebugDrawer.js';

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
        scene.versionText = scene.add.text(scene.scale.width - 75, scene.scale.height - 20, 'v0.7.0', {
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

        // Create water mask canvas
        const waterTexKey = "waterMask";
        if (scene.textures.exists(waterTexKey)) scene.textures.remove(waterTexKey);

        const wTex = scene.textures.createCanvas(waterTexKey, srcW, srcH);
        const wCtx = wTex.getContext();

        // === Build a water mask with a fading waterline from shore ===
        // Grab the full image data once (faster than per-pixel getImageData)
        const imgData = ctx.getImageData(0, 0, srcW, srcH).data;

        // 1) Classify pixels as water vs land
        const isWaterMap = new Array(srcH);
        for (let y = 0; y < srcH; y++) {
            const row = new Array(srcW);
            for (let x = 0; x < srcW; x++) {
                const idx = (y * srcW + x) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];

                // your water colour test (tweak if needed)
                const isWater = b > 184 && r <= 60;

                row[x] = isWater;
            }
            isWaterMap[y] = row;
        }

        // 2) For each water pixel, find distance to nearest land, fade by distance
        const maxRadius = 8;   // how far out the waterline extends
        const maxAlpha  = 0.5; // opacity at the shoreline

        for (let y = 0; y < srcH; y++) {
            for (let x = 0; x < srcW; x++) {
                if (!isWaterMap[y][x]) continue; // only care about water pixels

                let minDist = maxRadius + 1;

                // search a neighbourhood around this water pixel for land
                for (let dy = -maxRadius; dy <= maxRadius && minDist > 1; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= srcH) continue;

                    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= srcW) continue;

                        // any non-water pixel counts as land
                        if (!isWaterMap[ny][nx]) {
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < minDist) minDist = d;
                        }
                    }
                }

                // If we didn't find land nearby, skip (deep ocean, no line)
                if (minDist > maxRadius) continue;

                // Closer to land → higher alpha; farther → fade out
                const t = 1 - (minDist / maxRadius);      // 1 at shore, 0 at maxRadius
                const alpha = maxAlpha * t;               // scale by max alpha

                if (alpha <= 0) continue;

                wCtx.fillStyle = `rgba(200,200,255,${alpha.toFixed(3)})`;
                wCtx.fillRect(x, y, 1, 1);
            }
        }

        wTex.refresh();
        wTex.setFilter(Phaser.Textures.FilterMode.NEAREST);

        // Show preview centered in screen space
        const maxW = scene.scale.width * 0.9;
        const maxH = scene.scale.height * 0.7;
        const scale = Math.min(maxW / srcW, maxH / srcH);
        const worldW = srcW * SQUARESIZE, worldH = srcH * SQUARESIZE;

        // === Water overlay aligned with the world map ===
        const waterOverlay = scene.add.image(worldW / 2, worldH / 2, "waterMask")
            .setOrigin(0.5)
            .setScale(SQUARESIZE)        // match the map grid size
            .setDepth(UIDEPTH - 1)       // ABOVE the mapPreview (UIDEPTH - 2)
            .setAlpha(0.8)
            .setScrollFactor(1);

        scene.waterOverlay = waterOverlay;
        scene.uiCamera.ignore(waterOverlay);

        // gentle alpha pulse
        scene.tweens.add({
            targets: waterOverlay,
            alpha: { from: 0.1, to: 0.9 },
            duration: 1600,
            repeat: -1,
            yoyo: true,
            ease: "Sine.easeInOut"
        });

        // // subtle hue wobble
        // scene.events.on("update", () => {
        //     const t = scene.time.now * 0.0001;
        //     waterOverlay.setTint(
        //         Phaser.Display.Color.HSLToColor(
        //         0.55 + Math.sin(t) * 0.02, 0.7, 0.6
        //         ).color
        //     );
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
        cam.centerOn(worldW/2, worldH/2);
        cam.setZoom(0.2);

        scene.uiCamera.ignore(scene.menuPreview); // don’t show on UI cam

        scene.zoomMixer = new ZoomMixer();
        // hand off the existing preview image
        scene.zoomMixer.overviewImage = scene.menuPreview;
        // tell ZoomMixer which canvas texture to write into
        scene.zoomMixer.texKey = scene.mapTexKey;   // <- IMPORTANT
        scene.zoomMixer.mode = 'overview';


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

        // === Town seeds (positions)
        const seeds = [
            [126, 154]
        ];
        const teams = [1, 2, 3, 4];

        Teams.newTeam(1); Teams.newTeam(2); Teams.newTeam(3); Teams.newTeam(4);

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

        // === Starting Kits: resources + goofy names + 3 cards
        const randInt = (min, max) =>
            Math.floor(Math.random() * (max - min + 1)) + min;

        const goofyNamesPool = [
            'Muddy Turnip Militia',
            'Berry Bureaucrats',
            'Log Goblin League',
            'Soggy Sock Syndicate',
            'Radish Radicals',
            'Soup Overlords',
            'Pebble Parliament',
            'Thirsty Turnip Union'
        ];

        // shuffle names
        const names = goofyNamesPool.slice();
        for (let i = names.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [names[i], names[j]] = [names[j], names[i]];
        }

        const teamInfo = {};

        teams.forEach((team, idx) => {
            const resources = {
                seeds:   randInt(2, 10),
                berries: randInt(2, 10),
                wood:    randInt(0, 6),
                stone:   randInt(0, 6),
                food:    randInt(12, 20),
                water:   randInt(12, 20)
            };

            const available = POWERUP_CARDS.slice();
            const cards = [];
            for (let i = 0; i < 3 && available.length > 0; i++) {
                const pick = Math.floor(Math.random() * available.length);
                cards.push(available[pick]);
                available.splice(pick, 1);
            }

            const kit = {
                name: names[idx] || `Team ${team}`,
                resources,
                cards
            };

            teamInfo[team] = kit;

            const key = String(team);
            if (!Teams.teamLists[key]) Teams.newTeam(team);
            Teams.teamLists[key].displayName = kit.name;
            Teams.teamLists[key].startKit    = kit;
        });

        // After teams.forEach(...) that fills teamInfo
        MainMenu.selectedStartKit  = teamInfo[1];
        MainMenu.selectedStartTeam = 1;

        // === Start Kit Selection Row (no location swap, just kits) ===
        const centerX = scene.scale.width / 2;

        // replace kitRow creation
        const kitRow = scene.add.container(0, 0)
            .setScrollFactor(0)
            .setDepth(9999);
        scene.menu.add(kitRow);

        // card sizing – you can bump slightly for readability
        const cardWidth  = 240;
        const cardHeight = 160;

        // 4 quadrant anchors (leave map center mostly free)
        const positions = [
            { x: scene.scale.width * 0.12, y: scene.scale.height * 0.25 }, // top-left
            { x: scene.scale.width * 0.88, y: scene.scale.height * 0.25 }, // top-right
            { x: scene.scale.width * 0.12, y: scene.scale.height * 0.75 }, // bottom-left
            { x: scene.scale.width * 0.88, y: scene.scale.height * 0.75 }  // bottom-right
        ];

        const kitUIs = {};
        const kitTeams = teams;

        kitTeams.forEach((team, idx) => {
            const kit = teamInfo[team];
            if (!kit) return;

            const pos = positions[idx] || {
                x: scene.scale.width / 2,
                y: scene.scale.height / 2
            };

            const group = scene.add.container(pos.x, pos.y);
            kitRow.add(group);

            const bg = scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0.7)
                .setOrigin(0.5)
                .setStrokeStyle(3, 0x444444)
                .setInteractive({ cursor: 'pointer' });

            const nameText = scene.add.text(0, -cardHeight / 2 + 8, kit.name, {
                fontSize: '16px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                wordWrap: { width: cardWidth - 20 }
            }).setOrigin(0.5, 0);

            const r = kit.resources;

            const resText = scene.add.text(
                0, -10,
                `Seeds  ${r.seeds}   Berries ${r.berries}\n` +
                `Wood   ${r.wood}    Stone   ${r.stone}\n` +
                `Food   ${r.food}    Water   ${r.water}`,
                {
                    fontSize: '13px',
                    fill: '#f0f0f0',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);

            group.add([bg, nameText, resText]);

            // Card names (3 cards)
            kit.cards.forEach((card, i) => {
                const t = scene.add.text(0, 24 + i * 20, card.name, {
                    fontSize: '13px',
                    fill: '#ffffff',                          // bright readable text
                    stroke: card.OUTLINE || '#00ccff',        // use card colour as outline
                    strokeThickness: 3,
                    align: 'center'
                }).setOrigin(0.5);
                group.add(t);
            });

            kitUIs[team] = { group, bg };

            // interactions
            bg.on('pointerover', () => {
                scene.tweens.add({
                    targets: group,
                    scale: 1.05,
                    duration: 120,
                    ease: 'Quad.easeOut'
                });
            });

            bg.on('pointerout', () => {
                scene.tweens.add({
                    targets: group,
                    scale: 1.0,
                    duration: 120,
                    ease: 'Quad.easeIn'
                });
            });

            bg.on('pointerdown', () => {
                // update selection data
                MainMenu.selectedStartKit  = kit;
                MainMenu.selectedStartTeam = team;

                // visual highlight for selected card
                kitTeams.forEach(tid => {
                    const ui = kitUIs[tid];
                    if (!ui) return;
                    const selected = (tid === team);
                    ui.bg.setStrokeStyle(
                        selected ? 3 : 2,
                        selected ? 0x00ff66 : 0x666666
                    );
                });
            });
        });

        // initial highlight on kit 1 (default)
        if (kitUIs[1]) {
            kitUIs[1].bg.setStrokeStyle(3, 0x00ff66);
        }

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

    static beginLoadingAndHandOff() {
        const scene = MainMenu.scene;
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
            Map.regionDrawer = new RegionDebugDrawer(scene, Map.navMesh, Map.regionSystem, { toggleKey: "R" });

            // enemy
            Map.enemyRegionSystem = new RegionSystem(Map.enemyNavMesh, Map.enemyNavGrid);
            Map.enemyRegionDrawer = new RegionDebugDrawer(scene, Map.enemyNavMesh, Map.enemyRegionSystem, { toggleKey: "Y", alpha: 0.16 });
            
            // let managers access enemy updater too
            buildingManager.EnemyNavMeshUpdater = scene.enemyNavMeshUpdater;

            blockResourceManager.NavMeshUpdater = scene.navMeshUpdater;
            Map.drawBuildings();
            GameStart.placePlayers();
            CreateBottomBar(scene);
            scene.sceneButtons();
            VisibilitySystem.init(scene);           // build blockers + occlusion from the map

            createZoomButtons(scene)
            Teams.newTeam(0);
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
