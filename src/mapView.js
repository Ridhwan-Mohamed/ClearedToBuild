import Phaser, { Plugins } from 'phaser';
import worldMap from '../assets/worldMap.png'
import black from '../assets/black.png'
import gray from '../assets/gray.png'
import green from '../assets/green.png'
import leader from '../assets/purple.png'
import hammer from '../assets/hammer.png'
import grass from '../assets/grass.png'
import Water from '../assets/water/water.png'
import TWater from '../assets/water/TWater.png'
import BWater from '../assets/water/BWater.png'
import RWater from '../assets/water/RWater.png'
import LWater from '../assets/water/LWater.png'
import TRCWater from '../assets/water/TRCWater.png'
import BRCWater from '../assets/water/BRCWater.png'
import TLCWater from '../assets/water/TLCWater.png'
import BLCWater from '../assets/water/BLCWater.png'
import { Map } from './map.js';
import { Turret } from './Turret.js';
import { buildPolysFromGridMap, NavMesh } from "navmesh";
import { create2DArray, UIDEPTH, SQUARESIZE, WORLD_DIMENSION, TILE_TYPES, CONTROL_STATES, CHUNK_SIZE, EDGE_RATIO, TILE_MAP } from './constants';
import {itemTab} from './itemTab.js';
import { Player } from './Player.js';
import { Projectile } from './Projectile.js';
import player from '../assets/Players/player.png'
import { WaveCollapse } from './waveCollapse.js';
import { generateTown } from './town.js';

const screenH = window.innerHeight
const screenW = window.innerWidth

class mapView extends Phaser.Scene {
    constructor() {
        super('mapView');
        Map.scene = this;
        Turret.scene = this;
        this.gridPlace = false;
        this.selectMode = true;
        this.brushTiles = []; // Array to store affected tiles
        this.isBrushMode = false; // Track if brush mode is active  
        this.isBrushActive = false;  
    }

    preload() {
        this.load.spritesheet('player', player, { frameWidth: 16, frameHeight: 16});
        this.load.image('barrier', gray);  // Load a barrier image
        this.load.image('worldMap', worldMap);
        this.load.image('cube', black);  // Make sure the path and filename are correct
        this.load.image('selected', green)
        this.load.image('leader', leader)
        this.load.image('hammer', hammer);
        this.load.image('grass', grass);
        this.load.spritesheet('water', Water, { frameWidth: 16, frameHeight: 16});
        this.load.spritesheet('twater', TWater, { frameWidth: 16, frameHeight: 16}); // Top Water
        this.load.spritesheet('bwater', BWater, { frameWidth: 16, frameHeight: 16}); // Bottom Water
        this.load.spritesheet('rwater', RWater, { frameWidth: 16, frameHeight: 16}); // Right Water
        this.load.spritesheet('lwater', LWater, { frameWidth: 16, frameHeight: 16}); // Left Water
        this.load.spritesheet('trcwater', TRCWater, { frameWidth: 16, frameHeight: 16}); // Top-right corner Water
        this.load.spritesheet('brcwater', BRCWater, { frameWidth: 16, frameHeight: 16}); // Bottom-right corner Water
        this.load.spritesheet('tlcwater', TLCWater, { frameWidth: 16, frameHeight: 16}); // Top-left corner Water
        this.load.spritesheet('blcwater', BLCWater, { frameWidth: 16, frameHeight: 16}); // Bottom-left corner Water
        this.brushGraphics = this.add.graphics(); // Graphics for tinting tiles
        itemTab.preload(this)
        Projectile.init(this)
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

        Player.init(this);
        Map.navGrid = create2DArray(WORLD_DIMENSION,WORLD_DIMENSION);
        let grid = WaveCollapse.generateGrid(WORLD_DIMENSION, WORLD_DIMENSION);
        grid = generateTown(grid, [TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,
            TILE_TYPES.well,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1
        ])
        grid = generateTown(grid, [TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,
            TILE_TYPES.well,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1
        ])
        grid = generateTown(grid, [TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,
            TILE_TYPES.well,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1
        ])
        grid = generateTown(grid, [TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,
            TILE_TYPES.well,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1
        ])
        Map.grid = grid;
        // Map.grid = [[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],
        // [1,1,1,1,1,1,1],[1,1,1,1,1,1,1],
        // [1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1]]
        Map.initMap();
        Map.mapFromData(Map.grid);
        Map.navMesh = new NavMesh(buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0));

        this.cursors = this.input.keyboard.createCursorKeys();

        // Add collision between the cube and the barriers
        // this.physics.add.collider(characters, Map.barrier);
        this.physics.add.collider(Player.characters, Player.characters, Player.handlePlayerCollision);
        this.physics.add.collider(Player.characters, Projectile.projectileGroup, Player.handleCollision, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();

        // Variable to store the current text object
        let currentText;

        // Variable to store the current text objects
        let selectionCountText;
        this.registry.set('image','init');
        this.registry.events.on('changedata-image', (parent, value) => {
            console.log(`Registry key 'image' updated to value:`, value);
            const item = itemTab.itemValues(value);
            if(item.spread){
                // this.gridPlace = true;
            }
            else if(item == TILE_TYPES.turret){
                Turret.placeItem(item)
            }
            else{
                Map.placeItem(item)
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
            }
            Map.navMesh = new NavMesh(buildPolysFromGridMap(Map.navGrid, SQUARESIZE, SQUARESIZE, undefined, 0));
        });

        this.graphics = this.add.graphics(); // Graphics object for drawing the selection outline
        this.startCell = null; // Start cell (grid coordinates)
        this.endCell = null; // End cell (grid coordinates)

        // Add a mouse click listener
        this.input.on('pointerdown', (pointer) => {
            if(Map.isPlacing && Map.placingItem){
                const items = itemTab.itemValues(this.registry.get('image'))
                Map.handleMapClick(pointer, items)
                if(!Map.placingItem.blocked){
                    Map.placeItem(items)
                }
            }
            else if(Turret.isPlacing){
                const items = itemTab.itemValues(this.registry.get('image'))
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
                    this.cameras.main.width - 120,  // Relative to camera
                    10,                            // Slight padding from top
                    `(${posX}, ${posY})`, 
                    { fontSize: '16px', fill: '#ffffff', stroke: '#000000', strokeThickness: 3 }
                )
                .setScrollFactor(0)                // Stick to camera
                .setDepth(UIDEPTH);

                // Add the selection count text
                selectionCountText = this.add.text(
                    this.cameras.main.width - 150, // Relative to camera
                    30,                            // Slight padding below the position text
                    `Selected: ${Player.selected.length}\nnavGird: ${Map.navGrid[posY],[posX]}\ngrid: ${Map.grid[posY],[posX]}`, 
                    { fontSize: '16px', fill: '#ffffff', stroke: '#000000', strokeThickness: 3 }
                )
                .setScrollFactor(0)                // Stick to camera
                .setDepth(UIDEPTH);
                Player.selected.forEach((troop, index) => {
                    if(!troop.active){Player.selected.splice(index, 1); return;}
                    troop.state = CONTROL_STATES.USER_MODE
                    let troopX = Math.floor(troop.body.x / SQUARESIZE)
                    let troopY = Math.floor(troop.body.y / SQUARESIZE)
                    if(Map.grid[troopY][troopX] == 0){
                        console.log("Start pos is at blocked grid");
                    }
                    else if(Map.grid[posY][posX] == 0){
                        console.log("end pos is at blocked grid");
                    }
                    Player.moveTo(troop, Map.navMesh.findPath({ x: troop.body.x, y: troop.body.y }, { x: x, y: y }));
                });
            }
        });
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer, SQUARESIZE));
        this.input.on('pointerup', () => this.onPointerUp());
        this.sceneButtons()
    }

    handleKeyboardCameraMovement() {
        const camera = this.cameras.main;
        const speed = 10; // Camera movement speed
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
        Phaser.Math.Clamp(camera.scrollX, -32, WORLD_DIMENSION * SQUARESIZE - width);
        Phaser.Math.Clamp(camera.scrollY, -32, WORLD_DIMENSION * SQUARESIZE - height);
    
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
            Map.reDraw(); // Trigger a redraw
        }
    }
    
    onPointerMove(pointer) {
        if (this.isBrushMode && this.isBrushActive) {
            const gridX = Math.floor(pointer.worldX / SQUARESIZE);
            const gridY = Math.floor(pointer.worldY / SQUARESIZE);

            const alreadyExists = this.brushTiles.some(tile => tile.x === gridX && tile.y === gridY);

            if (!alreadyExists && gridX >= 0 && gridX < WORLD_DIMENSION && gridY >= 0 && gridY < WORLD_DIMENSION) {
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
        if (this.isBrushMode && this.isBrushActive) {
            this.isBrushActive = false
            if (this.brushTiles.length > 0) {
                // Process the tiles
                this.brushTiles.forEach(tile => {
                    let item = itemTab.itemValues(this.registry.get('image'))
                    Map.addSpreadArr(tile.x, tile.y, item, item.depth) // Customize as needed
                });

                this.brushGraphics.clear();
            }
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

    getSelectedCells() {
        const minX = Math.min(this.startCell.x, this.endCell.x);
        const maxX = Math.max(this.startCell.x, this.endCell.x);
        const minY = Math.min(this.startCell.y, this.endCell.y);
        const maxY = Math.max(this.startCell.y, this.endCell.y);
        const item = itemTab.itemValues(this.registry.get('image'));
        item.lenX = maxX-minX; item.lenY = maxY-minY;
        Map.addSpreadItem(minX,minY,item);
    }

    sceneButtons() {
        const camera = this.cameras.main;

        // Add a button on the bottom bar
        const brushToggleButton = this.add.text(230, window.innerHeight - 40, 'Brush Mode: OFF', {
            fontSize: '24px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
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
        const bottomBar = this.add.rectangle(0, camera.height - 50, camera.width, 50, 0x000000, 1) // Opaque black
            .setOrigin(0, 0)
            .setScrollFactor(0) // Sticks to the camera
            .setDepth(UIDEPTH - 1);
            
    
        // Add "Layout" button
        const itemTab = this.add.text(10, camera.height - 40, 'Layout', { fontSize: '24px', fill: '#ffffff' })
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
    
        // Add "Delete/Place" button
        this.breakItems = this.add.text(120, camera.height - 40, 'Delete', { fontSize: '24px', fill: '#ffffff' })
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
                            this.customCursor.setPosition(pointer.worldX, pointer.worldY);
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
            fontSize: '16px',
            fill: '#ffffff',
            align: 'center',
            strokeThickness: 3,
            stroke: '#000000'
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
            fontSize: '16px',
            fill: '#ffffff',
            align: 'center',
            strokeThickness: 3,
            stroke: '#000000'
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
        
    }

    createAnim(key){
        this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: 2 }),
            frameRate: 3,
            repeat: -1
        });
    }
    
    update() {
        Player.update();
        Turret.update();
        this.handleKeyboardCameraMovement();
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

    
}

const config = {
    type: Phaser.WEBGL,
    width: screenW,
    height: screenH,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [mapView, itemTab]
};

const gameInstance = new Phaser.Game(config);

