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
import { Turret } from './Turret.js';
import { UIDEPTH, SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, CONTROL_STATES, TILE_MAP, FLOORDEPTH, showAlert } from './constants';
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
import charHurt from 'url:./assets/charHurt.png'
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
import { respawnNorthFort } from './parcel_system/FortRaidParcel.js';
import { GameUIScene } from './UI/GameUIScene.js';
import { OverviewCloudLayer } from './UI/OverviewCloudLayer.js';
import { OverviewOceanWaves } from './UI/OverviewOceanWaves.js';
import { OverviewShoreWaves } from './UI/OverviewShoreWaves.js';

const screenH = window.innerHeight
const screenW = window.innerWidth

export class mapView extends Phaser.Scene {
    constructor() {
        super('mapView');
        mapView.scene = this;
        GameMap.scene = this;
        Turret.scene = this;
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
        this.berryMode = false;
        this.seedGridMode = false;
        this.selectingEnemies = false;
        this.enemySelectStart = null;
        this.enemySelectionRect = null;
        this.tillPreviewSprites = new Map(); // key = "x,y" → sprite
        this.tillPulseTween = null;
        this.guardPlacement = { active: false, troop: null };
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
        this.load.spritesheet('charHurt', charHurt, {frameWidth: 60, frameHeight: 50});
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
            cellWorldSize: SQUARESIZE * 2
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
            this.overviewOceanWaves?.destroy?.();
            this.overviewOceanWaves = null;
            this.overviewCloudLayer?.destroy?.();
            this.overviewCloudLayer = null;
            this.overviewShoreWaves?.destroy?.();
            this.overviewShoreWaves = null;
        });
        this.createAnim('water')
        this.createAnim('crops',0,1)
        this.createAnim('char', -1, 5, 3)
        this.createAnim('charHurt', -1, 5, 3)
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
            (player, bullet) => bullet.team !== player.body.team, // Only collide if teams are different
            this
        );

        GameMap.structureBarrier = this.physics.add.staticGroup(); // structures (walls/buildings) persistent
        this.physics.add.collider(
            Projectile.projectileGroup,
            GameMap.structureBarrier,
            Projectile.handleStructureCollision,
            null,
            this
        );

        this.cursors = this.input.keyboard.createCursorKeys();
        this.towerPressureController = new TowerPressureController(this, { /* your opts */ });
        // explosion spritesheet (single row, 5 frames)
        this.createAnim('explosions', 0, 10, 4);

        // stage completion lock
        this.stageCompleteLock = false;
        this._movementLocked = false;

        // listen for fort destruction
        StageState.onFortDestroyed(({ stageIndex, meta }) => {
            this.startStageCompleteSequence(stageIndex, meta);
        });
        
        // Variable to store the current text object
        let currentText; 

        // Variable to store the current text objects
        let selectionCountText;
        this.registry.set('image','init');
        this.registry.events.on('changedata-image', (parent, value) => {
            console.log(`Registry key 'image' updated to value:`, value);
            const item = TILE_TYPES[value];
            if(item.spread){
                // this.gridPlace = true;
            }
            else if(item == TILE_TYPES.turret){
                Turret.placeItem(item)
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
                Turret.isPlacing = false;
                Turret.topItem.destroy();
                Turret.baseItem.destroy();
            }
            else{
                GameMap.isPlacing = false; // Exit placing mode
                GameMap.placingItem.destroy(); // Clear placing item
                GameMap.placingItem = null;
            }
        });
        this.clock = new Clock(this);
        this.clock.paused = true;
        this.graphics = this.add.graphics(); // Graphics object for drawing the selection outline
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
            if(this.clock.paused) return;
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
                if(items.price){
                    if(this.money>=items.price){
                        this.updateMoney(-1*items.price)
                    }else{
                        showAlert(this, 'insufficient Funds', "#ff0000");
                        return;
                    }
                }
                Turret.handleMapClick(pointer, items)
                if(!Turret.placeItem.blocked){
                    Turret.placeItem(items)
                }
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
            else if ((this.breakItems?.text ?? "") != 'Place'){
                let x = pointer.worldX;
                let y = pointer.worldY;

                let posX = Math.floor(x / SQUARESIZE) 
                let posY = Math.floor(y / SQUARESIZE)

                // Remove the previous text if it exists
                if (currentText) {
                    currentText.destroy();
                }
                if (selectionCountText) {
                    selectionCountText.destroy();
                }

                // Add the position text
                currentText = this.add.text(
                    this.cameras.main.width - 150,  // Relative to camera
                    50,                            // Slight padding from top
                    `(${posX}, ${posY})`,
                    { fontSize: '14px', fill: '#ffffff' }
                )
                .setScrollFactor(0)                // Stick to camera
                .setDepth(UIDEPTH);

                // Add the selection count text
                selectionCountText = this.add.text(
                    this.cameras.main.width - 150, // Relative to camera
                    65,                            // Slight padding below the position text
                    `Selected: ${Player.selected.length}\nnavGird: ${GameMap.navGrid[posY][posX]}\ngrid: ${GameMap.grid[posY][posX]}`, 
                    { fontSize: '14px', fill: '#ffffff' }
                )
                    .setScrollFactor(0)                // Stick to camera
                    .setDepth(UIDEPTH);
                const formationSpots = Player.getFormation(posX,posY,Player.selected.length);
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
                    Player.moveTo(troop, GameMap.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: targetX+SQUARESIZE/2, y: targetY+SQUARESIZE/2 }));
                });
            }
        });
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer, SQUARESIZE));
        this.input.on('pointerup', () => this.onPointerUp());

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

            const ok = this.isValidFarmTile(gridX, gridY);
            if (this.farmHover) {
                this.farmHover.setVisible(true);
                this.farmHover.clear();
                this.farmHover.lineStyle(2, ok ? 0x00ff00 : 0xff0000, 1);
                this.farmHover.strokeRect(
                    gridX * SQUARESIZE,
                    gridY * SQUARESIZE,
                    SQUARESIZE,
                    SQUARESIZE
                );
            }
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

            const validSelection = this.isValidFarmSelection(minX, maxX, minY, maxY);
            const { totalNeeded } = this.getFarmSelectionSeedCost(minX, maxX, minY, maxY);
            const enoughSeeds = (this.seeds >= totalNeeded);
            const isStartOnly = (minX === maxX && minY === maxY);
            const ok = isStartOnly ? validSelection : (validSelection && enoughSeeds);
            this.drawSelectionOutline(ok ? 0x00ff00 : 0xff0000);

            this.setFarmInstructionPhase2(totalNeeded);
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

    onPointerUp() {
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
        else if(!this.gridPlace){ // player select
            Player.handlePlayerSelect();
        }
        else if (this.startCell && this.endCell) {
            // Get all selected grid cells
            this.getSelectedCells();
        }
        this.startCell = null;
        this.endCell = null;
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
    if (x < 0 || y < 0 || x >= WORLD_DIMENSIONX || y >= WORLD_DIMENSIONY) return false;

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

// Returns how many seeds we need if we confirm THIS rectangle,
// INCLUDING already-queued (pending) tiles.
getFarmSelectionSeedCost(minX, maxX, minY, maxY) {
    const pending = this.getPendingFarmTileKeySet();
    let newCount = 0;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (!this.isValidFarmTile(x, y)) continue;

            const key = `${x},${y}`;
            if (pending.has(key)) continue;  // already queued, don't double count

            newCount++;
        }
    }

    const pendingCount = pending.size;
    const totalNeeded = pendingCount + newCount;

    return { pendingCount, newCount, totalNeeded };
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
            if (!this.isValidFarmTile(gridX, gridY)) return;

            this.startCell = { x: gridX, y: gridY };
            this.endCell = { x: gridX, y: gridY };
            this.farmSelectPhase = 2;

            if (this.farmHover) this.farmHover.setVisible(false);
            return;
        }

        // Phase 2: confirm end tile
        if (this.farmSelectPhase === 2 && this.startCell) {
            if (!this.isValidFarmTile(gridX, gridY)) return;

            this.endCell = { x: gridX, y: gridY };

            const minX = Math.min(this.startCell.x, this.endCell.x);
            const maxX = Math.max(this.startCell.x, this.endCell.x);
            const minY = Math.min(this.startCell.y, this.endCell.y);
            const maxY = Math.max(this.startCell.y, this.endCell.y);

            const validSelection = this.isValidFarmSelection(minX, maxX, minY, maxY);
            if (!validSelection) return;

            const { totalNeeded } = this.getFarmSelectionSeedCost(minX, maxX, minY, maxY);
            if (!this.checkSufficientSeeds(totalNeeded)) {
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
        // compute total seeds needed in the selected rectangle
        const tileCount = (maxX - minX + 1) * (maxY - minY + 1);
        // if insufficient, show alert and bail out
        if (mode === 1) {
            // FARM/TILL selection mode
            const tillList = Teams.teamLists['1'].tileList;

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const type = TILE_TYPES[TILE_MAP(GameMap.grabDepth(GameMap.grid[y][x], FLOORDEPTH))];
                    const key = `${x},${y}`;
                    if (existing.has(key)) continue; // don't double-add
                    existing.add(key);
                    // spreadable ground but not water/road
                    if (type.spread && type.name !== "water" && type.name !== "road") {
                        tillList.push({ x, y, assigned: 0 });
                        this.addTillPreviewSprite(x, y);
                    }
                    // crop tiles: only queue if crop exists and has no seed
                    else if (type.name === "crops") {
                        const crop = Teams.getCropAt(x, y, 1);
                        if (crop && !crop.hasSeed) {
                            tillList.push({ x, y, assigned: 0 });
                            this.addTillPreviewSprite(x, y);
                        }
                    }
                }
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
    
    
    
    createAnim(key,repeat = -1, frameRate = 3, end=2){
        this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: end }),
            frameRate: frameRate,
            repeat: repeat
        });
    }
    
    update() {
        this._updateOceanBackdrop();
        if(!this.clock?.paused){
            Turret.update();
            this.clock.update();
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
        ClayOvenUI.updateAllOvens(1);
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

        this._activeRewardUI?.destroy?.();
        this._activeRewardUI = openFortRewardSelection(this, {
            stageIndex,
            meta,
            onComplete: () => {
                this._activeRewardUI = null;

                // Stage transition cleanup:
                // - remove only tower-spawned pressure parcels + their raiders
                // - keep manually started pressure contracts alive (they remain paused during rewards)
                this.parcelManager?.forceClearPressureContracts?.("stage_end_cleanup", { onlyTowerSpawned: true });
                // Remove all fort grunts from the previous fort cycle.
                this.parcelManager?.clearAllFortGrunts?.();

                // Progress stage/season AFTER reward is chosen.
                StageState.completeFortCycle({ reason: 'fort_reward_collected' }, { stagesPerSeason: 5 });

                // Fully clear old fort state and spawn the next fort.
                const mainIslandOrigin = this.parcelManager?.mainIslandOrigin;
                this._activeFort = respawnNorthFort({
                    scene: this,
                    map: GameMap,
                    mainIslandOrigin,
                    oldMeta: meta,
                });

                // Release sequence locks.
                this._movementLocked = false;
                this.stageCompleteLock = false;
                this.clock.paused = false;
                this.zoomMixer?.setZoomOutLocked?.(false);
                this._stageHud?.recompute?.();
                this.events.emit('stage:changed');
                this.events.emit('season:changed');
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











