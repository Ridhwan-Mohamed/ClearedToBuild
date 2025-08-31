import Phaser, { Plugins } from 'phaser';
import worldMap from 'url:../assets/worldMap.png'
import black from 'url:../assets/black.png'
import gray from 'url:../assets/gray.png'
import green from 'url:../assets/green.png'
import leader from 'url:../assets/purple.png'
import hammer from 'url:../assets/hammer.png'
import grass from 'url:../assets/grass.png'
import Water from 'url:../assets/water/water.png'
import TWater from 'url:../assets/water/TWater.png'
import BWater from 'url:../assets/water/BWater.png'
import RWater from 'url:../assets/water/RWater.png'
import LWater from 'url:../assets/water/LWater.png'
import TRCWater from 'url:../assets/water/TRCWater.png'
import BRCWater from 'url:../assets/water/BRCWater.png'
import TLCWater from 'url:../assets/water/TLCWater.png'
import BLCWater from 'url:../assets/water/BLCWater.png'
import waterParticle from 'url:../assets/waterParticle.png'
import crops from 'url:../assets/crops.png'
import { Map } from './map.js';
import { Turret } from './Turret.js';
import { NavMesh } from './lib/navmesh/navmesh.js';
import { buildPolysFromGridMap } from './lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import { create2DArray, UIDEPTH, SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, CONTROL_STATES, CHUNK_SIZE, EDGE_RATIO, TILE_MAP, FLOORDEPTH, showAlert } from './constants';
import {itemTab} from './itemTab.js';
import { Player } from './players/Player.js';
import { Projectile } from './Projectile.js';
import player from 'url:../assets/Players/player.png'
import gun1 from 'url:../assets/Players/gun1.png'
import playerAction from 'url:../assets/Players/playerAction.png'
import playerCarry from 'url:../assets/Players/playerCarry.png'
import { playerDict, setupTownBoundsToggle, townBounds } from './town.js';
import { tillManager } from './Manager/tillManager.js'
import { Teams } from './Teams.js';
import { buildingManager } from './Manager/buildingManager.js';
import monies from 'url:../assets/monies.png'
import seeds from 'url:../assets/seeds.png'
import { fightManager } from './Manager/fightManager.js';
import { seedManager } from './Manager/seedManager.js';
import char from 'url:../assets/char.png'
import charHurt from 'url:../assets/charHurt.png'
import berry from 'url:../assets/berry.png'
import spawn from 'url:../assets/hole.png'
import { recalculateDestroyTasksFromPoint } from './Manager/spawnManager.js';
import { Clock } from './Controllers/Clock.js';
import clayOven from 'url:../assets/clayOven.png'
import { ClayOven } from './buildings/ClayOven.js';
import { DailyNeedsTracker } from './UI/DailyNeedsTracker.js';
import foodIcon from 'url:../assets/foodIcon.png'
import waterIcon from 'url:../assets/waterIcon.png'
import woodIcon from 'url:../assets/woodIcon.png'
import stoneIcon from 'url:../assets/stoneIcon.png'
import uncleanWaterIcon from 'url:../assets/uncleanWaterIcon.png'
import { ClayOvenUI } from './UI/ClayOvenUI.js';
import { StorageBuilding } from './buildings/Storage.js';
import { StorageUI } from './UI/StorageUI.js';
import { StorageManager } from './Manager/StorageManager.js';
import { House } from './buildings/House.js';
import { GameStart } from './Controllers/GameStart.js';
import { ZoomMixer } from './UI/ZoomMixer.js';
import { MainMenu } from './mainMenu.js';
import { blockResourceManager } from './Manager/BlockResourceManager.js';

const screenH = window.innerHeight
const screenW = window.innerWidth

export class mapView extends Phaser.Scene {
    constructor() {
        super('mapView');
        mapView.scene = this;
        Map.scene = this;
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
        this.harvestMode = false;
        this.money = 1300; // Starting amount
        this.seeds = 0;
        this.foodAmnt = 15;
        this.cleanWaterAmnt = 15;
        this.woodAmnt = 0;
        this.stoneAmnt = 0;
        this.berries = 0;
        this.berryMode = false;
        this.seedGridMode = false;
        this.selectingEnemies = false;
        this.enemySelectStart = null;
        this.enemySelectionRect = null;
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
        this.load.image('grass', grass);
        this.load.image('monies', monies);
        this.load.image('seeds', seeds);
        this.load.image('berry', berry);
        this.load.image('spawn', spawn);
        this.load.image('foodIcon', foodIcon);
        this.load.image('waterIcon', waterIcon);
        this.load.image('woodIcon', woodIcon);
        this.load.image('stoneIcon', stoneIcon);
        this.load.image('uncleanWaterIcon', uncleanWaterIcon);
        this.load.image('sparkle', waterParticle);
        this.load.spritesheet('water', Water, { frameWidth: 16, frameHeight: 16});
        this.load.spritesheet('twater', TWater, { frameWidth: 16, frameHeight: 16}); // Top Water
        this.load.spritesheet('bwater', BWater, { frameWidth: 16, frameHeight: 16}); // Bottom Water
        this.load.spritesheet('rwater', RWater, { frameWidth: 16, frameHeight: 16}); // Right Water
        this.load.spritesheet('lwater', LWater, { frameWidth: 16, frameHeight: 16}); // Left Water
        this.load.spritesheet('trcwater', TRCWater, { frameWidth: 16, frameHeight: 16}); // Top-right corner Water
        this.load.spritesheet('brcwater', BRCWater, { frameWidth: 16, frameHeight: 16}); // Bottom-right corner Water
        this.load.spritesheet('tlcwater', TLCWater, { frameWidth: 16, frameHeight: 16}); // Top-left corner Water
        this.load.spritesheet('blcwater', BLCWater, { frameWidth: 16, frameHeight: 16}); // Bottom-left corner Water
        this.load.spritesheet('crops', crops, {frameWidth: 16, frameHeight: 16});
        this.load.spritesheet('char', char, {frameWidth: 60, frameHeight: 50});
        this.load.spritesheet('charHurt', charHurt, {frameWidth: 60, frameHeight: 50});
        this.load.spritesheet('clayOven', clayOven, { frameWidth: 64, frameHeight: 64});
        this.brushGraphics = this.add.graphics(); // Graphics for tinting tiles
        itemTab.preload(this);
        Projectile.init(this);
        DailyNeedsTracker.init(this);
        ClayOvenUI.init(this); // once in your main scene's create()
        StorageBuilding.scene = this;
        StorageUI.init(this);
        MainMenu.attach(this);
    }

    create() {
        this.createAnim('water')
        this.createAnim('twater')
        this.createAnim('bwater')
        this.createAnim('rwater')
        this.createAnim('lwater')
        this.createAnim('trcwater')
        this.createAnim('brcwater')
        this.createAnim('tlcwater')
        this.createAnim('blcwater')
        this.createAnim('crops',0,1)
        this.createAnim('char', -1, 5, 3)
        this.createAnim('charHurt', -1, 5, 3)
        ZoomMixer.initMapIconContainer();

        Player.init(this);
        Player.createAnim('oven_idle', 'clayOven', 0, 0, -1, 1);
        Player.createAnim('oven_cooking', 'clayOven', 1, 2, -1, 3);
        // Bind this scene to MainMenu and build the menu phase in *this* scene
        // UI camera once (top of create)
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0).setZoom(1).setBackgroundColor('rgba(0,0,0,0)');
        this.scale.on('resize', ({ width, height }) => this.uiCamera.setSize(width, height));

        // Bind menu to this scene and build menu UI (grid, towns, icons, Play)
        MainMenu.startMenuPhase();
        setupTownBoundsToggle(this);
        this.cursors = this.input.keyboard.createCursorKeys();
        recalculateDestroyTasksFromPoint();
        // Add collision between the cube and the barriers
        // this.physics.add.collider(characters, Map.barrier);
        // this.physics.add.overlap(Player.characters, Player.characters, Player.handlePlayerCollision, null, this);
        this.physics.add.collider(
            Player.characters,
            Projectile.projectileGroup,
            Projectile.handleCollision,
            (player, bullet) => bullet.team !== player.body.team, // Only collide if teams are different
            this
        );
        
        this.cursors = this.input.keyboard.createCursorKeys();

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
                Map.beginPlacing(item)
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
            //Map.navMesh = new NavMesh(buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0));
            if(this.gridPlace){
                this.gridPlace = false
            }
            else if(Turret.isPlacing){
                Turret.isPlacing = false;
                Turret.topItem.destroy();
                Turret.baseItem.destroy();
            }
            else{
                Map.isPlacing = false; // Exit placing mode
                Map.placingItem.destroy(); // Clear placing item
                Map.placingItem = null;
            }
        });
        this.clock = {paused: true};
        this.graphics = this.add.graphics(); // Graphics object for drawing the selection outline
        this.startCell = null; // Start cell (grid coordinates)
        this.endCell = null; // End cell (grid coordinates)
        this.keyboardSpeed = 10;
        this.input.keyboard.on('keydown-F', () => {
            this.farmMode = !this.farmMode;
        });
        this.input.keyboard.on('keydown-C', () => {
            this.harvestMode = !this.harvestMode;
        });
        this.input.keyboard.on('keydown-V', () => {
            this.seedGridMode = !this.seedGridMode;
        });
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
            if (clickedOnPlayer.length > 0) {
                console.log("hit player");
                return;
            }
            if(Map.placingItem && !Map.placingItem.blocked){
                const items = TILE_TYPES[this.registry.get('image')]
                // if(items.price){
                //     if(!this.checkSufficientFunds(items.price)){
                //         showAlert(this, 'insufficient Funds', "#ff0000");
                //         return;
                //     }
                // }
                let x = Math.floor((pointer.x + cam.scrollX) / SQUARESIZE);
                let y = Math.floor((pointer.y + cam.scrollY) / SQUARESIZE);
                if(items == TILE_TYPES.player){Map.handleMapClick(x,y,items)}
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
            else if (this.breakItems.text != 'Place'){
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
                    `Selected: ${Player.selected.length}\nnavGird: ${Map.navGrid[posY][posX]}\ngrid: ${Map.grid[posY][posX]}`, 
                    { fontSize: '14px', fill: '#ffffff' }
                )
                    .setScrollFactor(0)                // Stick to camera
                    .setDepth(UIDEPTH);
                this.cameras.main.ignore([selectionCountText, currentText]);
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
                    if(Map.navGrid[troopY][troopX] == 0){
                        let [newX, newY] = Player.findBestStartPos(troop, troopX, troopY);
                        if (newX === -1) {
                            console.log("No valid start tile nearby");
                        } else {
                            console.log("New valid tile:", newX, newY);
                            troopX = newX
                            troopY = newY
                        }
                    }
                    else if(Map.navGrid[posY][posX] == 0){
                        console.log("end pos is at blocked grid");
                    }
                    Player.moveTo(troop, Map.navMesh.findPath({ x: troopX*SQUARESIZE, y: troopY*SQUARESIZE }, { x: targetX+SQUARESIZE/2, y: targetY+SQUARESIZE/2 }));
                });
            }
        });
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer, SQUARESIZE));
        this.input.on('pointerup', () => this.onPointerUp());
    }

    handleKeyboardCameraMovement() {
        const camera = this.cameras.main;
        const speed = this.keyboardSpeed; // Camera movement speed
        const { width, height } = camera;
    
        // Check keyboard inputs for WASD or arrow keys
        if (this.keys.up.isDown || this.keys.arrowUp.isDown) {
            camera.scrollY -= speed; // Move up
        }
        if (this.keys.down.isDown || this.keys.arrowDown.isDown) {
            camera.scrollY += speed; // Move down
        }
        if (this.keys.left.isDown || this.keys.arrowLeft.isDown) {
            camera.scrollX -= speed; // Move left
        }
        if (this.keys.right.isDown || this.keys.arrowRight.isDown) {
            camera.scrollX += speed; // Move right
        }
    
        // Clamp camera position to avoid accessing invalid indices
        Phaser.Math.Clamp(camera.scrollX, -32, WORLD_DIMENSIONX * SQUARESIZE - width);
        Phaser.Math.Clamp(camera.scrollY, -32, WORLD_DIMENSIONY * SQUARESIZE - height);

        // Calculate the center chunk coordinates of the camera
        const centerChunkX = Math.floor(camera.scrollX / SQUARESIZE);
        const centerChunkY = Math.floor(camera.scrollY / SQUARESIZE);

        // Initialize old center if not already set
        if (!this.oldMapCenter) {
            this.oldMapCenter = [centerChunkX, centerChunkY];
        }
    
        // Check if the camera has deviated from the old center by a chunk size
        const deviationX = Math.abs(centerChunkX - this.oldMapCenter[0]);
        const deviationY = Math.abs(centerChunkY - this.oldMapCenter[1]);
    
        if (deviationX > EDGE_RATIO || deviationY > EDGE_RATIO) {
            this.oldMapCenter = [centerChunkX, centerChunkY]; // Update old center
            if(this.zoomMixer.mode == 'detailed') Map.reDraw(); // Trigger a redraw
        }

    }
    
    onPointerMove(pointer) {
        if (this.isBrushMode && this.isBrushActive) {
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
            if(Map.checkSpreadPosition(this.startCell.x,this.startCell.y,this.endCell.x, this.endCell.y)){
                this.drawSelectionOutline("0xff0000");
            } else{
                // Visualize the current selection
                this.drawSelectionOutline("0x00ff00");
            }
        }
    }

    onPointerUp() {
        this.graphics.clear();
        if (this.selectingEnemies) {
            const end = this.input.activePointer.positionToCamera(this.cameras.main).clone();
            this.processEnemySelection(this.enemySelectStart, end);
            this.selectingEnemies = false;

            if (this.enemySelectionRect) {
                this.enemySelectionRect.clear();
                this.enemySelectionRect.destroy();
                this.enemySelectionRect = null;
            }
        }
        else if(this.farmMode){
            this.getSelectedCells(1)
            this.farmMode = false;
        }
        else if(this.harvestMode){
            this.getSelectedCells(2)
            this.harvestMode = false;
        }
        else if(this.seedGridMode){
            this.getSelectedCells(3)
            this.seedGridMode = false;
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
        const minX = Math.min(this.startCell.x, this.endCell.x);
        const maxX = Math.max(this.startCell.x, this.endCell.x);
        const minY = Math.min(this.startCell.y, this.endCell.y);
        const maxY = Math.max(this.startCell.y, this.endCell.y);
        // compute total seeds needed in the selected rectangle
        const tileCount = (maxX - minX + 1) * (maxY - minY + 1);
        // if insufficient, show alert and bail out
        if(mode == 1){
            if (!this.checkSufficientSeeds(tileCount)) return;
            let tillList = Teams.teamLists['1'].tileList;
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    let type = TILE_TYPES[TILE_MAP(Map.grabDepth(Map.grid[y][x], FLOORDEPTH))]
                    if(type.spread && type.name != "water" && type.name != 'crops' && type.name != 'road'){
                        tillList.push( {
                            x,
                            y,
                            assigned: 0
                        });
                    }
                }
            }
            tillManager.assignTilesToTroops(1)
        }
        else if(mode == 2){
            let cropList = Teams.teamLists['1'].cropList;
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    let type = TILE_TYPES[TILE_MAP(Map.grabDepth(Map.grid[y][x], FLOORDEPTH))]
                    if(type.name == 'crops'){
                        let cropTile;
                        const key = `${x},${y}`
                        if(Array.isArray(Map.cropDict[key])){
                            cropTile = Map.cropDict[key][0]
                        }else{cropTile = Map.cropDict[key]}
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
            tillManager.assignCropsToTroops(1)
        }
        else if(mode == 3){
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    let tileType = TILE_TYPES[TILE_MAP(Map.grabDepth(Map.grid[y][x], FLOORDEPTH))];
                    if(tileType.interactable){
                        Teams.addSeedSpots(1, x, y);
                    }
                }
            }
            seedManager.assignSeedsToTroops(1)
        }
        else{
            const item = itemTab.itemValues(this.registry.get('image'));
            item.lenX = maxX-minX; item.lenY = maxY-minY;
            Map.addSpreadItem(minX,minY,item);
        }
    }

    sceneButtons() {
        const camera = this.cameras.main;

        // === MONEY UI (Top Center) ===
        const topCenterX = this.cameras.main.width / 2;
        const moneyIcon = this.add.image(topCenterX - 20, 25, 'monies')
            .setScrollFactor(0)
            .setScale(0.5)
            .setDepth(UIDEPTH);

        this.moneyText = this.add.text(topCenterX + 5, 18, `$${this.money}`, {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: "#000000",
            strokeThickness: 2,
        })
        .setScrollFactor(0)
        .setDepth(UIDEPTH);

        // === SEEDS UI (Top Center) ===
        const seedsIcon = this.add.image(topCenterX - 80, 25, 'seeds')
            .setScrollFactor(0)
            .setScale(0.5)
            .setDepth(UIDEPTH);

        // seeds text
        this.seedsText = this.add.text(topCenterX - 65, 18, `${this.seeds}`, {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: "#000000",
            strokeThickness: 2,
        })
        .setScrollFactor(0)
        .setDepth(UIDEPTH);

        // === SEEDS UI (Top Center) ===
        const berryIcon = this.add.image(topCenterX - 140, 25, 'berry')
            .setScrollFactor(0)
            .setScale(0.5)
            .setDepth(UIDEPTH);
    
        this.berryText = this.add.text(topCenterX - 125, 18, `${this.berries}`, {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: "#000000",
            strokeThickness: 2,
        })
            .setScrollFactor(0)
            .setDepth(UIDEPTH);

        let berryOutline = null;
        berryIcon
              .setInteractive()
              .on('pointerdown', () => {
                this.berryMode = !this.berryMode;
            
                if (this.berryMode) {
                  // draw a white outline around the berry icon
                  berryOutline = this.add.graphics()
                    .setScrollFactor(0)
                    .setDepth(UIDEPTH);
                  berryOutline.lineStyle(2, 0xffffff, 1);
                  const b = berryIcon.getBounds();
                  berryOutline.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
                } else {
                  // remove the outline
                  if (berryOutline) {
                    berryOutline.destroy();
                    berryOutline = null;
                  }
                }
              });            

        // Add a button on the bottom bar
        const brushToggleButton = this.add.text(230, window.innerHeight - 40, 'Brush Mode: OFF', {
            fontSize: '22px',
            fill: '#ffffff'
        })
            .setInteractive()
            .on('pointerdown', () => {
                if(this.isBrushMode){
                    this.isBrushMode = false;
                    this.gridPlace = true;
                } else {this.isBrushMode = true; this.gridPlace = false;}
                brushToggleButton.setText(`Brush Mode: ${this.isBrushMode ? 'ON' : 'OFF'}`);
            });

        // Ensure the button sticks to the bottom bar
        brushToggleButton.setScrollFactor(0);
        brushToggleButton.setDepth(UIDEPTH);
    
        // Add the top bar
        const topBar = this.add.rectangle(0, 0, camera.width, 50, 0x808080, 0.5) // Gray and transparent
            .setOrigin(0, 0)
            .setScrollFactor(0) // Sticks to the camera
            .setDepth(UIDEPTH - 1);
    
        // Add the bottom bar
        const bottomBar = this.add.rectangle(0, camera.height - 50, camera.width, 50, 0x808080, 0.5) // Opaque black
            .setOrigin(0, 0)
            .setScrollFactor(0) // Sticks to the camera
            .setDepth(UIDEPTH - 1);
            
    
        // Add "Layout" button
        const itemTab = this.add.text(10, camera.height - 40, 'Layout', { fontSize: '22px', fill: '#ffffff' })
            .setInteractive()
            .setScrollFactor(0) // Sticks to the camera
            .setDepth(UIDEPTH)
            .on('pointerdown', () => {
                this.selectMode = false;
                this.input.stopPropagation();
                this.gridPlace = false;
                this.scene.switch('itemTab');
            });
        itemTab.setStroke('#000000', 3);

        // Add "Farm" Button on Bottom Right
        const farmButton = this.add.text(screenW - 100, camera.height - 40, 'Farm', {
            fontSize: '22px',
            fill: '#ffffff',
        })
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(UIDEPTH)
        .on('pointerdown', () => {
            this.farmMode = true;
        });
    
        // Add "Delete/Place" button
        this.breakItems = this.add.text(120, camera.height - 40, 'Delete', { fontSize: '22px', fill: '#ffffff' })
            .setInteractive()
            .setScrollFactor(0) // Sticks to the camera
            .setDepth(UIDEPTH)
            .on('pointerdown', () => {
                if (this.breakItems.text === 'Delete') {
                    this.selectMode = false;
                    this.breakItems.setText('Place');
                    this.input.setDefaultCursor('none');
                    this.customCursor = this.add.sprite(0, 0, 'hammer').setDepth(UIDEPTH + 1).setScrollFactor(0); // Stick cursor to camera
                    this.input.on('pointermove', (pointer) => {
                        if (this.customCursor) {
                            this.customCursor.setPosition(pointer.x, pointer.y); // ← screen-space position
                        }
                    });
                } else if (this.breakItems.text === 'Place') {
                    this.selectMode = true;
                    this.breakItems.setText('Delete');
                    this.input.setDefaultCursor('default');
                    if (this.customCursor) {
                        this.customCursor.destroy();
                        this.customCursor = null;
                    }
                }
            });
        this.breakItems.setStroke('#000000', 3);

        // Automatically scale the bars if the window resizes
        this.scale.on('resize', (gameSize) => {
            const { width, height } = gameSize;
            topBar.setSize(width, 50);
            bottomBar.setSize(width, 100).setY(height - 100);
        });

        // Add Save and Load Buttons
        const buttonWidth = 80;
        const buttonHeight = 30;
        const buttonMargin = 10;

        // Save Button
        const saveButton = this.add.graphics();
        saveButton.fillStyle(0x00ff00, 1); // Green fill
        saveButton.fillRoundedRect(buttonMargin, buttonMargin, buttonWidth, buttonHeight, 10); // Rounded rectangle
        saveButton.setScrollFactor(0).setDepth(UIDEPTH);

        // Add Save Text
        const saveText = this.add.text(buttonMargin + buttonWidth / 2, buttonMargin + buttonHeight / 2, 'Save', {
            fontSize: '14px',
            fill: '#ffffff',
            align: 'center',
        })
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0)
            .setDepth(UIDEPTH);

        // Make Save Button Interactive
        const saveButtonHitArea = new Phaser.Geom.Rectangle(buttonMargin, buttonMargin, buttonWidth, buttonHeight);
        saveButton.setInteractive(saveButtonHitArea, Phaser.Geom.Rectangle.Contains);
        saveButton.on('pointerdown', () => {
            console.log('Save button clicked');
            
            // Convert Map.grid to a JSON string and copy it to clipboard
            const gridData = JSON.stringify(Map.grid);
            navigator.clipboard.writeText(gridData).then(() => {
                this.showSaveNotification()
            }).catch(err => {
                console.error('Failed to copy grid to clipboard:', err);
            });
        });

        // Load Button
        const loadButton = this.add.graphics();
        loadButton.fillStyle(0x0000ff, 1); // Blue fill
        loadButton.fillRoundedRect(buttonMargin + buttonWidth + buttonMargin, buttonMargin, buttonWidth, buttonHeight, 10); // Rounded rectangle
        loadButton.setScrollFactor(0).setDepth(UIDEPTH);

        // Add Load Text
        const loadText = this.add.text(buttonMargin + buttonWidth * 1.5 + buttonMargin, buttonMargin + buttonHeight / 2, 'Load', {
            fontSize: '14px',
            fill: '#ffffff',
            align: 'center'
        })
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0)
            .setDepth(UIDEPTH);
        // Make Load Button Interactive
        const loadButtonHitArea = new Phaser.Geom.Rectangle(buttonMargin + buttonWidth + buttonMargin, buttonMargin, buttonWidth, buttonHeight);
        loadButton.setInteractive(loadButtonHitArea, Phaser.Geom.Rectangle.Contains);
        // Load Button
        loadButton.on('pointerdown', () => {
            console.log('Load button clicked');
        
            // Create a prompt to paste the grid data
            const gridData = prompt('Paste your grid data here (JSON format):');
            if (gridData) {
                try {
                    // Parse the JSON string and update Map.grid
                    let newGrid = JSON.parse(gridData);
                    const copyGrid = structuredClone(newGrid)
                    // Ensure the new grid is a valid 2D array
                    if (Array.isArray(newGrid) && newGrid.every(row => Array.isArray(row))) {
                        Map.grid = newGrid; // Update the grid
                        Map.reDraw();       // Redraw the map
                        Map.grid = copyGrid
                        newGrid = null;
                        console.log('Grid successfully loaded and redrawn.');
                    } else {
                        alert('Invalid grid format. Ensure it is a 2D array.');
                    }
                } catch (err) {
                    alert(`Error parsing grid data: ${err.message}`);
                    console.error('Failed to load grid:', err);
                }
            }
        });

        // One-line HUD container with your actual objects:
        this.hud = this.add.container(0, 0, [
        topBar, bottomBar,
        moneyIcon, this.moneyText,
        seedsIcon, this.seedsText,
        berryIcon, this.berryText,
        itemTab, brushToggleButton, farmButton,
        this.breakItems,
        saveButton, saveText,
        loadButton, loadText
        ]);

        // Important: HUD is screen-space UI, so lock it to camera
        this.hud.setScrollFactor(0);

        // Route rendering:
        // - main camera: show world only (ignore HUD)
        // - ui camera: show HUD only (ignore world)
        this.cameras.main.ignore(this.hud);
    }

    static refreshUICameraIgnores() {
        const scene = mapView.scene;
        if (!scene || !scene.uiCamera) return;

        // UI = scrollFactor 0/0; World = everything else
        const uiObjs = [];
        const worldObjs = [];

        for (const go of scene.children.list) {
            const sfx = ('scrollFactorX' in go) ? go.scrollFactorX : 1;
            const sfy = ('scrollFactorY' in go) ? go.scrollFactorY : 1;
            if (sfx === 0 && sfy === 0) uiObjs.push(go);
            else worldObjs.push(go);
        }

        // Main camera shows world (ignores UI)
        scene.cameras.main.ignore(uiObjs);

        // UI camera shows UI (ignores world)
        scene.uiCamera.ignore(worldObjs);
    }


    updateMoney(amountDelta) {
        const oldAmount = this.money;
        this.money += amountDelta;
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
        const oldCount = this.seeds;
        this.seeds += amountDelta;
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
        if(!this.clock?.paused){
            Turret.update();
            this.clock.update();
            this.handleKeyboardCameraMovement();
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


}



const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#00a8f3',
    scene: [mapView, itemTab],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
 
};

new Phaser.Game(config);
