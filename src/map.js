import { CHUNK_SIZE, SQUARESIZE, FLOORDEPTH, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, TILE_MAP, TILE_ARR, BLOCKDEPTH, CONTROL_STATES, UIDEPTH, showAlert } from "./constants";
import Phaser from "phaser";
import { Turret } from "./Turret";
import { Player } from "./players/Player";
import { buildingArray, clearBuildingArray, spawnPoints, townRoads, turretTeams } from "./town";
import { Teams } from "./Teams";
import { buildingManager } from "./Manager/buildingManager";
import { seedManager } from "./Manager/seedManager";
import { House } from "./buildings/House";
import { StorageBuilding } from "./buildings/Storage";
import { blockResourceManager } from "./Manager/BlockResourceManager";
import { ClayOven } from "./buildings/ClayOven";
import { mapView } from "./mapView";
import { PineTree } from "./buildings/pineTree";
import { VisibilitySystem } from "./UI/VisibilitySystem";
import { AudioManager } from "./Manager/AudioManager";
import { WallPlacementController } from "./Controllers/WallPlacementController";
import { Wall } from "./buildings/Wall";

const colors = {
    green: { r: 14, g: 209, b: 69 },
    blue: { r: 60, g: 184, b: 241 },
    gray : {r: 88, g: 88, b: 88},
    brown: {r: 76, g: 43, b: 24},
    lightGray : {r: 195, g: 195, b: 195},
    darkGreen: {r: 0, g: 100, b: 0},
    darkRed: {r: 139, g: 0, b: 0},
    lightBrown: {r: 125, g: 73, b: 0},
    rockGray: {r: 90, g: 104, b: 43}
};

export class Map{
    static barrier;
    static graphics;
    static grid;
    static navGrid
    static navMesh;
    static regionSystem;
    static regionDrawer;
    static enemyNavMesh;
    static enemyNavGrid;
    static enemyRegionSystem;
    static enemyRegionDrawer;
    static scene;
    static imageData;
    static placingItem = null; // The current item being placed
    static isPlacing = false; // Flag to indicate placement mode
    static blocks = [];
    static cropDict = {};  // add at top of map.js
    static waterBlocks = [];
    static cameraBounds;
    static worldPines = [];
    static worldStones = [];

    static initMap(){
        this.barrier = this.scene.physics.add.staticGroup();  // Ensure barriers are static bodies
        this.graphics = this.scene.add.graphics();
        Map.worldLayer = Map.scene.add.layer();
        Map.worldLayer.setName?.("worldLayer");
        Map.worldStaticLayer = Map.scene.add.layer();   // NEW: buildings/trees/rocks/placing ghosts etc.
    }

    static initGrid(){ // precompute oriented frames + minimal base/top pairing
        const H = this.grid.length, W = this.grid[0].length;

        for (let y=0; y<H; y++){
            for (let x=0; x<W; x++){
            const cell = this.grid[y][x];

            if (Array.isArray(cell)) {
                const btm = TILE_MAP(cell[0]);
                const top = TILE_MAP(cell[1]);
                if (btm && TILE_TYPES[btm].complex) this.determineTileType(x,y,btm,0,0);
                if (top && TILE_TYPES[top].complex)  this.determineTileType(x,y,top,1,0);
                continue;
            }

            const name = TILE_MAP(cell);
            if (!name) continue;

            // Water always sits on base (avoid seams), even if interior
            if (name === 'water') {
                this.determineTileType(x,y,'water',-1,0);
                continue;
            }

            // Complex floors (dirt): orient; pair only if non-interior (edges/corners/island)
            if (TILE_TYPES[name].complex) {
                this.determineTileType(x,y,name,-1,0);
            }

            // Non-complex: leave as-is
            }
        }
    }

    static MapFromImage(canvas, image){
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        this.imageData = context.getImageData(0, 0, image.width, image.height);

        for (let y = 0; y < this.imageData.height; y++) {
            for (let x = 0; x < this.imageData.width; x++) {
                let sample = this.sample(x,y);
                this.grid[y][x] = sample;
                if(sample == TILE_TYPES.water.grid || sample == TILE_TYPES.wall.grid){
                    this.navGrid[y][x] = 0
                }else{
                    this.navGrid[y][x] = 1
                }
            }
        }
        this.imageData = null;
        return this.grid;
    }

    static mapFromData(data){
        this.grid = data;
        this.initGrid();
    }

    static beginPlacing(item){
        this.placingItem = this.scene.add.sprite(0, 0, item.value)
            .setAlpha(0.5) // Make it semi-transparent
            .setDepth(item.depth) // Ensure it's above everything
            .setInteractive();
        this.placingItem.blocked = false;
       // Enable mouse-following behavior
        this.isPlacing = true; 
        this.scene.input.on('pointermove', (pointer) => {
            if (this.placingItem && this.isPlacing && pointer.x>0 && pointer.x<SQUARESIZE*WORLD_DIMENSIONX && pointer.y>0 && pointer.y<SQUARESIZE*WORLD_DIMENSIONY) {
                let lenX = item.lenX;
                let lenY = item.lenY;
                let x = Math.floor(pointer.worldX - pointer.worldX%SQUARESIZE);
                let y = Math.floor(pointer.worldY - pointer.worldY%SQUARESIZE);
                if(item.lenX%2 != 0){x += SQUARESIZE/2}
                if(item.lenY%2 != 0){y += SQUARESIZE/2}
                // compute the grid‐aligned top-left tile for the item
                const gridX = Math.floor(x / SQUARESIZE) - Math.floor(lenX / 2);
                const gridY = Math.floor(y / SQUARESIZE) - Math.floor(lenY / 2);
                // pass both dimensions into checkBlockPosition
                const tintColor = this.checkBlockPosition(gridX, gridY, lenX, lenY);
                this.placingItem.setTint(tintColor);
                this.placingItem.setPosition(x, y);
            }
        });
    }

    static placeItem(x,y,item){
        const placingItem = this.scene.add.sprite(0, 0, item.value)
            .setDepth(item.depth) // Ensure it's above everything
            .setInteractive();
        placingItem.clearTint()
        placingItem.setAlpha(1); // Set full visibility
        if(item.lenX%2 != 0){x += SQUARESIZE/2}
        if(item.lenY%2 != 0){y += SQUARESIZE/2}
        placingItem.setPosition(x + Math.floor(item.lenX/2)*SQUARESIZE, y + Math.floor(item.lenY/2)*SQUARESIZE); // Finalize position
        x = Math.floor(x/SQUARESIZE)
        y = Math.floor(y/SQUARESIZE)
        this.drawRoadAround(x,y,item)
        this.addBlockItem(x,y,item)
        const itemToPlace = placingItem
        itemToPlace.setInteractive();
        itemToPlace.dontTrack = true;
        itemToPlace.sx = x
        itemToPlace.sy = y
        itemToPlace.lenX = item.lenX
        itemToPlace.lenY = item.lenY
        itemToPlace.on('pointerover', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                itemToPlace.setTint(0xaaaaaa); // Darken slightly on hover
            }
        });
        itemToPlace.on('pointerout', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                itemToPlace.clearTint(); // Restore original color
            }
        });
        itemToPlace.on('pointerdown', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                console.log('Destroying item...');
                Teams.teamLists['1'].destroyStates.push({
                    type: item,
                    value: itemToPlace,
                    x: x,
                    y: y,
                    duration: 100,
                    assigned: 0
                });
                buildingManager.assingTroopsToDestroy(1);
            }
        });
    }

    static drawRoadAround(x, y, item, team) {
        const startX = x - 1;
        const startY = y - 1;
        const endX   = x + item.lenX;
        const endY   = y + item.lenY;

        if (VisibilitySystem.viewRect == null) return;

        const roadList = (team != null && townRoads[team]) ? townRoads[team] : null;

        const inBounds = (gx, gy) =>
            gy >= 0 && gx >= 0 && gy < Map.grid.length && gx < Map.grid[0].length;

        // Floor-only gate: allow painting floor where base isn't blocking.
        const canWriteFloorHere = (gx, gy) => {
            if (!inBounds(gx, gy)) return false;
            const cell    = Map.grid[gy][gx];
            const baseVal = Array.isArray(cell) ? Map._pickFloorValFromCell(cell) : cell;
            const baseTyp = TILE_TYPES[TILE_MAP(baseVal)];
            return !baseTyp?.block; // floor must not be blocking
        };

        // 1) UNDERLAY: fill the whole building footprint with ROAD INTERIOR on the floor layer
        //    (so the building sits on road, like your old behavior)
        const roadInterior = TILE_TYPES.road.interior;
        for (let row = y; row < y + item.lenY; row++) {
            for (let col = x; col < x + item.lenX; col++) {
            if (!canWriteFloorHere(col, row)) continue;

            // Write a floor road interior, regardless of any other floor at this cell
            // (uses your depth-aware writer; okay to overwrite floor here)
            this.checkAndPlace(col, row, roadInterior, FLOORDEPTH);
            this.drawGridValue(col, row);
            }
        }

        // 2) RING: auto-tile the perimeter roads using placeTile (edges/corners/islands + neighbor updates)
        const ringCanLay = (gx, gy) => {
            if (!inBounds(gx, gy)) return false;

            const cell    = Map.grid[gy][gx];
            const baseVal = Array.isArray(cell) ? Map._pickFloorValFromCell(cell) : cell;
            const topVal  = Array.isArray(cell) ? (cell[0] === baseVal ? cell[1] : cell[0]) : null;

            const baseType = TILE_TYPES[TILE_MAP(baseVal)];
            const topType  = topVal != null ? TILE_TYPES[TILE_MAP(topVal)] : null;

            // skip if a blocking top (building, wall, etc.)
            if (topType?.block) return false;
            // skip if base already road (no need to repaint)
            if (TILE_MAP(baseVal) === 'road') return false;
            // skip if base itself is blocking
            if (baseType?.block) return false;

            return true;
        };

        // Pass 1: lay ring roads
        for (let row = startY; row <= endY; row++) {
            for (let col = startX; col <= endX; col++) {
            const isEdge = (row === startY || row === endY || col === startX || col === endX);
            if (!isEdge) continue;

            if (ringCanLay(col, row)) {
                this.placeTile(col, row, 'road'); // lets your auto-tiler pick edge/corner/island
                if (roadList) roadList.push([col, row]);
            }
            }
        }

        // Pass 2: light re-touch to finalize ring corners after full ring exists
        for (let row = startY; row <= endY; row++) {
            for (let col = startX; col <= endX; col++) {
            const isEdge = (row === startY || row === endY || col === startX || col === endX);
            if (!isEdge) continue;

            const cell    = Map.grid[row][col];
            const baseVal = Array.isArray(cell) ? Map._pickFloorValFromCell(cell) : cell;
            if (TILE_MAP(baseVal) === 'road') this.placeTile(col, row, 'road');
            }
        }
    }


    static handleMapClick(x, y, item) {
        // If we're in placing mode, finalize the placement
        if(item == TILE_TYPES.player && this.placingItem && !this.placingItem.blocked){
            Player.addPlayer(x, y, 0)
        }
        else {
            this.placeItem(x,y,item)
        }
    }

    // Helper: does a tile value block?
    // Accepts:
    // - null/undefined
    // - numeric tile value
    // - nested arrays like [floor, top] or even [[floorA, floorB], top]
    static _tileIsBlocking(val) {
        if (val == null) return false;
        // NEW: recursive array handling
        if (Array.isArray(val)) {
            // block if ANY element blocks (covers 2-floor weirdness + nested pairs)
            for (const v of val) {
                return this._tileIsBlocking(v);
            }
        }
        const name = TILE_MAP(val);
        if (!name) return false;
        const t = TILE_TYPES[name];
        return !!t?.block;
    }

    static _cellIsBlocking(x, y) {
        const row = this.grid[y];
        if (!row) return true;          // OOB blocked
        const cell = row[x];
        if (cell == null) return true;  // missing blocked

        // NEW: let _tileIsBlocking handle scalar OR array OR nested arrays
        return this._tileIsBlocking(cell);
    }

    // New array-aware placement check (used for buildings/turrets preview)
    static checkBlockPosition(posX, posY, lenX, lenY, turret = 0){
        for (let y = posY; y < posY + lenY; y++) {
            for (let x = posX; x < posX + lenX; x++) {
                if (this._cellIsBlocking(x, y)) {
                    if (turret) Turret.topItem.blocked = true;
                    else this.placingItem.blocked = true;
                    return Phaser.Display.Color.GetColor(200, 49, 19); // red
                }
            }
        }
        if (turret) Turret.topItem.blocked = false;
        else this.placingItem.blocked = false;
        return Phaser.Display.Color.GetColor(14, 209, 69); // green
        }

        // (Optional) make the generator check consistent with the new rules
        static checkBlockPositionGen(posX, posY, lenX, lenY){
        for (let y = posY; y < posY + lenY; y++) {
            for (let x = posX; x < posX + lenX; x++) {
            if (this._cellIsBlocking(x, y)) return true;
            }
        }
        return false;
    }

    static checkSpreadPosition(posX, posY, endX, endY){
        let lenX = endX - posX;
        let lenY = endY - posY;
        for (let y = posY; y < posY + lenY + 1; y++) {
            for (let x = posX; x < posX + lenX + 1; x++) {
                if(this._cellIsBlocking(x,y)){
                    return true;
                }
            }
        }
        return false;
    }

    static addSpreadItem(posX, posY, item) {
        let index;
        for (let y = posY; y < posY + item.lenY + 1; y++) {
            for (let x = posX; x < posX + item.lenX + 1; x++) {
                item.depth == FLOORDEPTH? index = 0: index = 1
                this.addSpreadArr(x,y,item,index)
            }   
        }
    }

    static addBlockItem(posX, posY, item){
        for (let y = posY; y < posY + item.lenY; y++) {
            for (let x = posX; x < posX + item.lenX; x++) {
                this.checkAndPlace(x,y,item.grid,item.depth)
                if(item.block){
                    let barrierBlock = this.scene.physics.add.staticImage(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, 'barrier');
                    barrierBlock.setDisplaySize(SQUARESIZE, SQUARESIZE).setDepth(FLOORDEPTH).setAlpha(0);
                    this.barrier.add(barrierBlock);
                    Map.navGrid[y][x] = 0;
                    Map.enemyNavGrid[y][x] = 0;
                }
            }
        }
    }

    // Return whichever layer in `cell` is floor-depth; if both are floor, prefer [0].
    static _pickFloorValFromCell(cell){
        if (!Array.isArray(cell)) return cell;
        const v0 = cell[0], v1 = cell[1];
        const t0 = TILE_TYPES[TILE_MAP(v0)];
        const t1 = TILE_TYPES[TILE_MAP(v1)];
        const d0 = t0?.depth, d1 = t1?.depth;
        if (d0 === FLOORDEPTH && d1 !== FLOORDEPTH) return v0;
        if (d1 === FLOORDEPTH && d0 !== FLOORDEPTH) return v1;
        return v1; // both floor (or neither): default to [0]
    }

    // Choose which layer index to write to in an existing array cell.
    // Prefer the layer that already holds `preferTypeName`; else the one matching `depth`.
    // If both match depth (two floors), prefer the layer that already contains the same type;
    // if still ambiguous, prefer index 1 for "overlay" feel; else fallback to 0.
    static _chooseLayerIndexForExistingCell(cell, depth, preferTypeName){
        const m0 = TILE_MAP(cell[0]);
        const m1 = TILE_MAP(cell[1]);
        if (preferTypeName) {
            if (m0 === preferTypeName) return 0;
            if (m1 === preferTypeName) return 1;
        }
        const d0 = TILE_TYPES[m0]?.depth, d1 = TILE_TYPES[m1]?.depth;
        const z0 = d0 === depth, z1 = d1 === depth;
        if (z0 && !z1) return 0;
        if (z1 && !z0) return 1;
        if (z0 && z1) {
            // both same depth (e.g., two floors). If one already matches the type, we’d have caught it above.
            return 1; // treat [1] as overlay by convention
        }
        return 0;
    }

    // Convenience: resolve index for (x,y)
    static _layerIndexFor(x, y, depth, preferTypeName){
        const cell = this.grid[y]?.[x];
        if (!Array.isArray(cell)) return depth === FLOORDEPTH ? 0 : 1;
        return this._chooseLayerIndexForExistingCell(cell, depth, preferTypeName);
    }

    static placeTile(x, y, tileType, index = -1) {
        // 1) Write current cell (let determineTileType auto-pair if needed)
        this.determineTileType(x, y, tileType, index);

        // 2) Depth comes from the type we just placed (don’t infer from cell)
        const depth = TILE_TYPES[tileType].depth;

        // 3) For each neighbor that contains this tileType in ANY layer, re-orient it.
        const upd = (gx, gy) => {
            if (!this.grid[gy]) return;
            if (!this._hasTypeAt(gx, gy, tileType)) return;
                // choose the correct layer in the neighbor to rewrite
                const nIdx = this._layerIndexFor(gx, gy, depth, tileType);
                if (Array.isArray(this.grid[gy][gx])) {
                // compute the oriented numeric code AND write it into the chosen layer
                const oriented = this.determineTileType(gx, gy, tileType, nIdx);
                // ensure the numeric gets stored in the chosen layer, preserving the other
                if(oriented) this.checkAndPlace(gx, gy, oriented, depth, tileType);
            } else {
            // scalar cell → just rewrite it
            this.grid[gy][gx] = this.determineTileType(gx, gy, tileType);
            }
        };

        upd(x, y - 1); // up
        upd(x, y + 1); // down
        upd(x - 1, y); // left
        upd(x + 1, y); // right
    }


    static removeTile(posX, posY, lenX, lenY) {
        // Reset the tile
        for(let y = posY; y < posY+lenY+1; y++){
            for(let x = posX; x < posX+lenX+1; x++){
                this.grid[y][x] = 1;
                this.drawGridValue(x,y)
            }
        }
    }

    static navgridDraw(x, y) {
        if(Map.navGrid[y]){
            const value = Map.navGrid[y][x];
    
            const color = value !== 0 ? 0xffffff : 0x000000;
            const alpha = value !== 0 ? 0.3 : 0.6;
        
            const tile = this.scene.add.rectangle(
                x * SQUARESIZE,
                y * SQUARESIZE,
                SQUARESIZE,
                SQUARESIZE,
                color,
                alpha
            ).setOrigin(0)
             .setDepth(100);
        }
    }

    static drawBuildings(){
        for(let i = 0; i < buildingArray.length; i++){
            if(buildingArray[i][2].name === TILE_TYPES.house1.name || buildingArray[i][2].name == TILE_TYPES.house2.name) new House(buildingArray[i][0],buildingArray[i][1],buildingArray[i][2],buildingArray[i][3]);
            else if(buildingArray[i][2].name === TILE_TYPES.storage.name) new StorageBuilding(buildingArray[i][0],buildingArray[i][1],buildingArray[i][3]);
            else if(buildingArray[i][2].name === TILE_TYPES.clayOven.name) new ClayOven(buildingArray[i][0],buildingArray[i][1],buildingArray[i][3]);
            else if(buildingArray[i][2].name === TILE_TYPES.pine.name) {
                const level = 1; // or derive from map/seed
                const pine = new PineTree(buildingArray[i][0], buildingArray[i][1], level);
                this.worldPines.push(pine);
            }
            else this.handleLoadNonSpread(buildingArray[i][0],buildingArray[i][1],buildingArray[i][2],i);
            if(buildingArray[i][2] == TILE_TYPES.spawn) buildingArray.splice(i, 1);
        }
        // map.js — after the draw loop inside drawBuildings(), add:
        const townLightSources = [];
        for (let i = 0; i < buildingArray.length; i++) {
            const [gx, gy, tileType, teamNumber] = buildingArray[i];
            const name = tileType?.name;

            // skip resource occluders — we light everything else
            if (name === 'pine' || name === 'rock') continue;

            const lenX = tileType.lenX || 1;
            const lenY = tileType.lenY || 1;

            // center of the building in GRID coords
            const cx = gx + lenX/2;
            const cy = gy + lenY/2;

            // heuristic radius: scale a bit with footprint, but keep bounded
            const r = Math.max(3, Math.min(7, Math.round((lenX + lenY) / 2 + 3)));
            const brightness = 1.75;

            townLightSources.push({ x: cx, y: cy, r, brightness });
        }

        // merge with existing lights (torches/players/etc.)
        const merged = (VisibilitySystem.lightSources || []).concat(townLightSources);

        // this rebuilds the chunk index:
        VisibilitySystem.setLightSources(merged);

        for (let i = 0; i < buildingArray.length; i++) {
            const [gx, gy, tileType] = buildingArray[i];
            const name = tileType?.name;
            if (name === 'pine' || name === 'rock') continue; // skip occluders

            const lenX = tileType.lenX || 1;
            const lenY = tileType.lenY || 1;
            const cx = gx + lenX / 2;
            const cy = gy + lenY / 2;

            // Use a similar radius as the building light
            const r = Math.max(3, Math.min(9, Math.round((lenX + lenY) / 2 + 5)));

            // slight visibility boost over ambient (0.1)
            if (buildingArray[i][3] === 1) {
                VisibilitySystem.addVisionBubble({ x: cx, y: cy, r, boost: 0.1 }, /*noRepaint=*/true);
            }else{
                continue;
            }
        }
        // finally rebuild once
        VisibilitySystem._rebuildViewFull();
    }

    static deleteAllGridElements(){
        this.graphics.clear();
        this.blocks.forEach(Map._destroyNode);
        this.blocks = [];
        this.waterBlocks.forEach(child => child.destroy());
        this.barrier.clear(true);
    }

    static _destroyNode(node){
        if(!node) return;
        if (Array.isArray(node)) { node.forEach(Map._destroyNode); return; }
        if (node.destroy) node.destroy();
    }

    static _storeAt(x,y,layerIndex,sprites){ // 0=floor, 1=block
        const idx = y*WORLD_DIMENSIONX + x;
        if (!Array.isArray(this.blocks[idx])) {
            // nuke old single sprite if present and ensure [floor,block] shape
            if (this.blocks[idx]?.destroy) this.blocks[idx].destroy();
            this.blocks[idx] = [null, null];
        }
        // clear old content at that layer (can be sprite or array)
        this._destroyNode(this.blocks[idx][layerIndex]);
        this.blocks[idx][layerIndex] = sprites;
    }

    static reDraw(width = WORLD_DIMENSIONX, height = WORLD_DIMENSIONY) {
        this.graphics.clear();
        this.blocks.forEach(Map._destroyNode);
        this.blocks = [];
        this.waterBlocks.forEach(child => child.destroy());
        this.barrier.clear(true);

        // remove any prior world-layer children created last redraw
        if (this.worldLayer) this.worldLayer.removeAll(true);
    
        const camera = this.scene.cameras.main;
    
        // Calculate top-left and bottom-right grid indices to draw
        const topLeftX = Math.floor(camera.scrollX / SQUARESIZE);
        const topLeftY = Math.floor(camera.scrollY / SQUARESIZE);
        
        const bottomRightX = Math.max(topLeftX + CHUNK_SIZE, topLeftX + Math.floor(window.innerWidth/SQUARESIZE))
        const bottomRightY = topLeftY + CHUNK_SIZE

        PineTree.rebuildVisibleForGridRange(topLeftX, topLeftY, bottomRightX, bottomRightY);
        VisibilitySystem.setViewRect(topLeftX, topLeftY, bottomRightX-topLeftX, bottomRightY-topLeftY);
        VisibilitySystem._rebuildViewFull();

        this.cameraBounds = new Phaser.Geom.Rectangle(
            topLeftX * SQUARESIZE,
            topLeftY * SQUARESIZE,
            bottomRightX * SQUARESIZE,
            bottomRightY * SQUARESIZE
        );
        // Loop through only the visible chunk
        for (let y = topLeftY; y < bottomRightY; y++) {
            for (let x = topLeftX; x < bottomRightX; x++) {
                if (y < 0 || x < 0 || y >= height || x >= width) {
                    // Draw water tiles for out-of-bounds
                    let barrierBlock = this.scene.add.sprite(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, 'water');
                    this._worldAdd(barrierBlock); 
                    barrierBlock.play('water').setDepth(FLOORDEPTH)
                    this.waterBlocks.push(barrierBlock)
                }
                else if(this.grid[y][x] == TILE_TYPES.crops.grid){
                    this.handleCrops(x,y);
                } else if (Array.isArray(this.grid[y][x])) {
                    const type = TILE_TYPES[TILE_MAP(this.grid[y][x][1])];
                    const name = type.name;
                    this.drawGridValue(x, y, 0);
                    if (type && type.spread) {
                        this.drawGridValue(x, y, 1)
                    }
                } else {
                    this.drawGridValue(x, y);
                }
            }
        }

        // After we've rebuilt visible world objects:
        AudioManager.updateFromRedraw({
        topLeftX,
        topLeftY,
        bottomRightX,
        bottomRightY,
        grid: this.grid,
        width,
        height,
        buildingArray
        });
        
        // After we've rebuilt visible world objects:
        this._uiIgnoreWorldLayer();
    }   

    static handleCrops(x,y){
        const key = `${x},${y}`;
        if(!this.cropDict[key]){
            this.drawGridValue(x, y);
        }
    }

    static _shapeAndAngle(def, val) {
        // Map the stored number to (shape, angle) for NESW
        if (val === def.interior) return { shape: 'interior', angle: 0 };
        if (def.island != null && val === def.island) return { shape: 'island', angle: 0 };

        // sides
        if (val === def.sides?.up)    return { shape: 'edge',   angle: 0   };
        if (val === def.sides?.right) return { shape: 'edge',   angle: 90  };
        if (val === def.sides?.down)  return { shape: 'edge',   angle: 180 };
        if (val === def.sides?.left)  return { shape: 'edge',   angle: 270 };

        // corners (we treat sprites as "top-left" rotated; adjust to your atlas)
        if (val === def.corners?.topLeft)     return { shape: 'corner', angle: 0   };
        if (val === def.corners?.topRight)    return { shape: 'corner', angle: 90  };
        if (val === def.corners?.bottomRight) return { shape: 'corner', angle: 180 };
        if (val === def.corners?.bottomLeft)  return { shape: 'corner', angle: 270 };

        return { shape: 'interior', angle: 0 };
    }

    static _spawnSpec(cx, cy, depth, spec, angle = 0) {
        const node = spec.sheet
            ? this.scene.add.sprite(cx, cy, spec.key).setDepth(depth).play(spec.anim || spec.key)
            : this.scene.add.image (cx, cy, spec.key).setDepth(depth);
        this._worldAdd(node); 
        if (angle) node.setAngle(angle);
        return node;
    }

    static drawGridValue(x, y, index = -1) {
        const cell = this.grid[y]?.[x];
        if (cell == null) return;

        const paired = Array.isArray(cell);
        const baseVal = paired ? cell[0] : cell;
        const topVal  = paired ? cell[1] : null;

        const isCrops = (val) => TILE_MAP(val) === 'crops';

        // --- CROPS (legacy seed + team logic)
        const cropsCandidate =
            index === 1 ? topVal :
            index === 0 ? baseVal :
            (paired ? (isCrops(topVal) ? topVal : (isCrops(baseVal) ? baseVal : null))
                    : (isCrops(baseVal) ? baseVal : null));

        if (cropsCandidate && isCrops(cropsCandidate)) {
            const key = `${x},${y}`;
            if (!this.cropDict[key]) {
                const def = TILE_TYPES.crops;
                const cx  = x * SQUARESIZE + SQUARESIZE / 2;
                const cy  = y * SQUARESIZE + SQUARESIZE / 2;
                const block = this.scene.add.sprite(cx, cy, 'crops').setDepth(def.depth);
                this.addToWorldStatic(block); 
                block.setFrame(1);
                WallPlacementController.bindStructureLightAndVision(block, cx, cy, {
                    r: 6,
                    boost: 0.12,
                    intensity: 1.1
                });
                block.hasSeed = true;
                this.handleGridDelete(block, def, x, y);
            }
            return;
        }
        // --- /CROPS

        // NEW: walls + doors are STATIC STRUCTURES, not part of redraw blocks
        if (index != 0 && Wall.isWallOrDoorCell(cell)) {
            // ensure the static sprite exists (stored in Map.worldStaticLayer)
            Wall.ensureAt(this.scene, x, y);
            return null; // IMPORTANT: do not store/draw as normal grid element
        }

        const drawOne = (val) => {
            const name = TILE_MAP(val);
            const def  = TILE_TYPES[name];
            const cx = x * SQUARESIZE + SQUARESIZE / 2;
            const cy = y * SQUARESIZE + SQUARESIZE / 2;
            let node;

            if (def.assets && def.complex) {
                const { shape, angle } = Map._shapeAndAngle(def, val);
                const a = def.assets;
                if (shape === 'interior') node = this._spawnSpec(cx, cy, def.depth, a.interior);
                else if (shape === 'island') node = this._spawnSpec(cx, cy, def.depth, a.island);
                else if (shape === 'edge') node = this._spawnSpec(cx, cy, def.depth, a.edge, angle);
                else node = this._spawnSpec(cx, cy, def.depth, a.corner, angle);
                if(def.name == "wall" || def.name == "woodWall") {
                    WallPlacementController.bindStructureLightAndVision(node, cx, cy, {
                        r: 6,
                        boost: 0.12,
                        intensity: 1.1
                    });
                }
            } else {
                const tileKey = TILE_ARR[val];

                const isDoor =
                    tileKey === "wall_door" || tileKey === "woodWall_door" ||
                    name === "wallDoor" || name === "woodWallDoor";

                if (def.spriteSheet) {
                    node = this.scene.add.sprite(cx, cy, tileKey).setDepth(def.depth);

                    // map.js (inside drawGridValue -> after creating `node` as a sprite)

                    if (isDoor) {
                        node.setFrame(0); // closed

                        // Rotate 90° if vertical wall (above/below neighbors), else 0°
                        // IMPORTANT: pass the DOOR type name (wall_door / woodWall_door)
                        const doorTypeName = (tileKey === "woodWall_door") ? "woodWall_door" : "wall_door";
                        node.setAngle(WallPlacementController.doorAngleForCell(this.grid, x, y, doorTypeName));

                        // ✅ put this door into the door physics group so overlap works
                        WallPlacementController.bindDoorSprite(this.scene, node);
                        WallPlacementController.bindStructureLightAndVision(node, cx, cy, {
                            r: 6,
                            boost: 0.12,
                            intensity: 1.1
                        });
                    }
                    else {
                        node.play(tileKey);
                    }
                } else {
                    node = this.scene.add.image(cx, cy, tileKey).setDepth(def.depth);
                }

                this._worldAdd(node); 
            }

            // Basic rotation logic preserved
            if (def.block) {
                node.setDisplaySize(SQUARESIZE, SQUARESIZE);
                this.barrier.add(node);
            }

            // ✅ handle interactable seed-type logic here
            if (def.interactable) {
                // link to seedManager
                seedManager.makeClickable(x, y, node);
            }

            return node;
        };

        // --- draw layers
        if (index === 0) {
            const n = drawOne(baseVal);
            this._storeAt(x, y, 0, n);
            return;
        }
        if (index === 1 && paired) {
            const n = drawOne(topVal);
            this._storeAt(x, y, 1, n);
            return;
        }

        const floorNode = drawOne(baseVal);
        if (paired) {
            const topNode = drawOne(topVal);
            this._storeAt(x, y, 0, floorNode);
            this._storeAt(x, y, 1, topNode);
        } else {
            this._storeAt(x, y, 0, floorNode);
        }
    }

    static _sameAs(x,y,typeName){
        const cell = this.grid[y]?.[x];
        if (cell == null) return false;
        const top  = Array.isArray(cell) ? TILE_MAP(cell[1]) : null;
        const base = Array.isArray(cell) ? TILE_MAP(cell[0]) : TILE_MAP(cell);
        return (top === typeName) || (base === typeName);
    }

    static _texExists(key){ return this.scene.textures.exists(key); }

    static _overlaySpec(spec) {
        // Accept legacy string ('shore_edge') or object {key, sheet, anim}
        if (!spec) return null;
        return (typeof spec === 'string') ? { key: spec, sheet: false } : spec;
    }

    static _addOverlayAt(cx, cy, depth, spec, angle) {
        if (!spec || !spec.key) return null;
        const node = spec.sheet
            ? this.scene.add.sprite(cx, cy, spec.key).setDepth(depth)
            : this.scene.add.image (cx, cy, spec.key).setDepth(depth);
        this._worldAdd(node); 
        if (spec.sheet) node.play(spec.anim || spec.key);
        node.setAngle(angle);
        return node;
    }

    static _stampOverlays(x, y, type){
        const specEdge   = this._overlaySpec(type.overlay?.edge);
        const specCorner = this._overlaySpec(type.overlay?.corner);
        if (!specEdge && !specCorner) return [];

        const cx = x * SQUARESIZE + SQUARESIZE/2;
        const cy = y * SQUARESIZE + SQUARESIZE/2;

        const n  = this._sameAs(x, y-1, type.name);
        const s  = this._sameAs(x, y+1, type.name);
        const w  = this._sameAs(x-1, y, type.name);
        const e  = this._sameAs(x+1, y, type.name);
        const nw = this._sameAs(x-1, y-1, type.name);
        const ne = this._sameAs(x+1, y-1, type.name);
        const sw = this._sameAs(x-1, y+1, type.name);
        const se = this._sameAs(x+1, y+1, type.name);

        const overlays = [];

        // Edges (rotate one north-facing strip): 0=N, 90=E, 180=S, 270=W
        if (specEdge) {
            if (!n) overlays.push(this._addOverlayAt(cx, cy, type.depth, specEdge,   0));
            if (!e) overlays.push(this._addOverlayAt(cx, cy, type.depth, specEdge,  90));
            if (!s) overlays.push(this._addOverlayAt(cx, cy, type.depth, specEdge, 180));
            if (!w) overlays.push(this._addOverlayAt(cx, cy, type.depth, specEdge, 270));
        }

        // Corners (rotate one top-left quarter)
        if (specCorner) {
            if ( n &&  w && !nw) overlays.push(this._addOverlayAt(cx, cy, type.depth, specCorner,   0)); // TL
            if ( n &&  e && !ne) overlays.push(this._addOverlayAt(cx, cy, type.depth, specCorner,  90)); // TR
            if ( s &&  e && !se) overlays.push(this._addOverlayAt(cx, cy, type.depth, specCorner, 180)); // BR
            if ( s &&  w && !sw) overlays.push(this._addOverlayAt(cx, cy, type.depth, specCorner, 270)); // BL
        }

        return overlays.filter(Boolean);
    }

    static handleGridDelete(block, type, x, y){
        if(type.name == "wall" || type.name == "woodWall" || type.name == "wall_door" || type.name == "woodWall_door"){
            const idx = y * WORLD_DIMENSIONX + x;
            const slot = this.blocks[idx];
            if (slot && Array.isArray(slot)) {
                // In normal (non-overview) mode this will be the old ground sprite
                if (slot && slot[1] && slot[1].destroy) slot.destroy();
                this.blocks[idx] = slot[0]
            }
            if(Array.isArray(this.grid[y][x])){
                this.grid[y][x] = this.grid[y][x][0];
            }
            return;
        }
        if (type.name === "crops") {
            const key = `${x},${y}`;
            Map.cropDict[key] = block;
            Teams.teamLists['1'].crops.push({
                sprite: block,
                x: x,
                y: y,
                dailyWatered: false,
                growthStage: 0,
                hasSeed: true
            });
            Teams.teamLists['1'].wateringList.push({
                x: x,
                y: y,
                assigned: 0,
                sprite: block
            });
            // track this crop separately
            const idx = y * WORLD_DIMENSIONX + x;
            const slot = this.blocks[idx];

            if (slot && !Array.isArray(slot)) {
                // In normal (non-overview) mode this will be the old ground sprite
                if (slot.destroy) slot.destroy();
            }
            // Safe even if blocks is [] or empty at this index (overview mode)
            this.blocks[idx] = null;
            return;  // don’t fall through into the normal blocks[] logic
        }
        else if(type.depth == BLOCKDEPTH){
            if(!Array.isArray(this.blocks[y*WORLD_DIMENSIONX+x])){
                this.blocks[y*WORLD_DIMENSIONX+x] = [this.blocks[y*WORLD_DIMENSIONX+x], block];
            }
            else{
                if(Array.isArray(this.blocks[y*WORLD_DIMENSIONX+x][1])){
                    this.blocks[y*WORLD_DIMENSIONX+x][1][0].destroy();
                    this.blocks[y*WORLD_DIMENSIONX+x][1][1].destroy();
                }else{this.blocks[y*WORLD_DIMENSIONX+x][1]?.destroy();}
                this.blocks[y*WORLD_DIMENSIONX+x][1] = block;
            }
        }
        else{
            if(!Array.isArray(this.blocks[y*WORLD_DIMENSIONX+x])){
                let Sblock = this.blocks[y*WORLD_DIMENSIONX+x];
                this.blocks[y*WORLD_DIMENSIONX+x]?.destroy();
                this.blocks[y*WORLD_DIMENSIONX+x] = block;
            }
            else{
                this.blocks[y*WORLD_DIMENSIONX+x][0]?.destroy();
                this.blocks[y*WORLD_DIMENSIONX+x][0] = block;
                if(this.blocks[y*WORLD_DIMENSIONX+x][1].body){
                    Map.navGrid[y][x] = 0;
                    Map.enemyNavGrid[y][x] = 0;
                }
            }
        }
        if(type.interactable){
            seedManager.makeClickable(x, y, block);
        }
    }

    static _hasTypeAt(gx, gy, typeName) {
        const c = this.grid[gy]?.[gx];
        if (c == null) return false;

        // Wall-family equivalence:
        // - "wall" should treat "wall_door" as same family
        // - "woodWall" should treat "woodWall_door" as same family
        // (but if you ask specifically for a door type, keep it exact)
        const matches = (mapped) => {
            if (!mapped) return false;

            // family match for adjacency logic
            if (typeName === "wall")      return mapped === "wall" || mapped === "wall_door";
            if (typeName === "woodWall")  return mapped === "woodWall" || mapped === "woodWall_door";

            // optional convenience if you ever want it:
            if (typeName === "door") return mapped === "wall_door" || mapped === "woodWall_door";

            // otherwise exact match
            return mapped === typeName;
        };

        if (Array.isArray(c)) {
            // check top and base; either can be this type family
            return matches(TILE_MAP(c[0])) || matches(TILE_MAP(c[1]));
        }

        return matches(TILE_MAP(c));
    }

    static determineTileType(x, y, tileType, index = -1, draw = 1) {
        const def = TILE_TYPES[tileType];

        //dont handle doors
        if(index && (TILE_MAP(this.grid[y][x][1]) == "woodWall_door" || TILE_MAP(this.grid[y][x][1]) == "wall_door")){
            return;
        }

        // inside determineTileType(...)
        const   write = (val, pairUnderForced) => {
            // if (index > -1) {
            //     this.grid[y][x][index] = val;
            //     if (draw) this.drawGridValue(x,y,index);
            //     return val;
            // }

            // Auto-pair only when needed (non-interior complex tiles)
            let pairUnder = pairUnderForced;
            if (pairUnder === undefined && def.complex && val !== def.interior) {
                // figure out shape+angle from the numeric code we just chose
                const { shape, angle } = Map._shapeAndAngle(def, val);

                // NESW delta by angle
                const dNESW = a => (a===0 ? [0,-1] : a===90 ? [1,0] : a===180 ? [0,1] : [-1,0]);
                // diagonal delta by angle (0=TL, 90=TR, 180=BR, 270=BL)
                const dDiag = a => (a===0 ? [-1,-1] : a===90 ? [1,-1] : a===180 ? [1,1] : [-1,1]);

                // neighbor booleans (you already computed depth above)
                const A = this._hasTypeAt(x, y-1, tileType); // above
                const B = this._hasTypeAt(x, y+1, tileType); // below
                const L = this._hasTypeAt(x-1, y, tileType); // left
                const R = this._hasTypeAt(x+1, y, tileType); // right

                // pick neighbor cell to sample based on the decided shape/orientation
                let nx = x, ny = y;
                if (shape === 'edge') {
                    const [dx,dy] = dNESW(angle); nx += dx; ny += dy;
                } else if (shape === 'corner') {
                    const isRightVariant = (angle === 90 || angle === 180); // TR or BR
                    nx += isRightVariant ? 1 : -1; // move horizontally only
                    // ny unchanged
                } else if (shape === 'island') {
                    // opposite of the sole attachment
                    if      (A) ny += 1;
                    else if (R) nx -= 1;
                    else if (B) ny -= 1;
                    else if (L) nx += 1;
                }
                // ...
                const neigh = this.grid[ny]?.[nx];
                const neighVal = this._pickFloorValFromCell(neigh);
                const neighName = TILE_MAP(neighVal);
                const neighDef  = neighName ? TILE_TYPES[neighName] : null;

                pairUnder = (neighDef && neighDef.depth === FLOORDEPTH)
                ? (neighDef.interior ?? neighDef.grid)
                : TILE_TYPES.grass.grid;
            }
            if(this.grid[y][x] && pairUnder && !Array.isArray(this.grid[y][x]) && def.block){
                this.grid[y][x] = [this.grid[y][x], val];
                if (draw) this.drawGridValue(x,y,1);
                return val;
            }
            if(this.grid[y][x] && pairUnder && Array.isArray(this.grid[y][x]) && def.block){
                this.handleGridDelete(null, def, x, y);
                this.grid[y][x] = [this.grid[y][x], val];
                if (draw) this.drawGridValue(x,y,1);
                return val;
            }
            this.grid[y][x] = (pairUnder != null) ? [pairUnder, val] : val;
            if (draw) this.drawGridValue(x,y);
            return val;
        };

        // bounds guard for water
        if (def.name === "water" && (x < 0 || y < 0 || x > this.grid[0].length-1 || y > this.grid.length-1)) {
            return write(def.interior);
        }

        const A = this._hasTypeAt(x, y-1, tileType); // above
        const B = this._hasTypeAt(x, y+1, tileType); // below
        const L = this._hasTypeAt(x-1, y, tileType); // left
        const R = this._hasTypeAt(x+1, y, tileType); // right
        const cnt = (A?1:0) + (B?1:0) + (L?1:0) + (R?1:0);

        // 0 neighbors → interior
        if (cnt === 0 && (def.name != "wall" && def.name != "woodWall")) return write(def.interior);

        // 1 neighbor → ATTACHED-ISLAND (dirt only), else a side
        if (cnt === 1 && (def.name != "wall" && def.name != "woodWall")) {
            if (def.island != null) return write(def.island);   // dirt & water islands
            if (A) return write(def.sides.up);
            if (R) return write(def.sides.right);
            if (B) return write(def.sides.down);
            return write(def.sides.left);
        } else if ((def.name == "wall" || def.name == "woodWall")) {
            if(cnt === 1){
                if (A) return write(def.sides.right, this.grid[y][x]);
                if (R) return write(def.sides.up, this.grid[y][x]);
                if (B) return write(def.sides.left, this.grid[y][x]);
                return write(def.sides.down, this.grid[y][x]);
            }
            else if(cnt === 2){
                // special case for walls: 2 neighbors that are opposite → straight wall
                if (A && B && !L && !R) return write(def.sides.right, this.grid[y][x]);
                if (L && R && !A && !B) return write(def.sides.up, this.grid[y][x]);
                // else corner
                if (A && L && !R && !B) return write(def.corners.bottomRight, this.grid[y][x]);
                if (A && R && !L && !B) return write(def.corners.bottomLeft, this.grid[y][x]);
                if (B && L && !R && !A) return write(def.corners.topRight, this.grid[y][x]);
                if (B && R && !L && !A) return write(def.corners.topLeft, this.grid[y][x]);
            }
            else if(cnt === 3){
                // special case for walls: 3 neighbors → side facing missing one
                return write(def.interior, this.grid[y][x]);
            }
            else{
                return write(def.interior, this.grid[y][x]);
            }
        }

        // 2 neighbors: orthogonal → corner; opposite → interior run
        if (A && L && !R && !B) return write(def.corners.bottomRight);
        if (A && R && !L && !B) return write(def.corners.bottomLeft);
        if (B && L && !R && !A) return write(def.corners.topRight);
        if (B && R && !L && !A) return write(def.corners.topLeft);
        if (A && B && !L && !R) return write(def.interior);
        if (L && R && !A && !B) return write(def.interior);

        // 3 neighbors → side facing the missing one
        if (!A && L && R && B) return write(def.sides.up);
        if (!R && A && B && L) return write(def.sides.right);
        if (!B && L && R && A) return write(def.sides.down);
        if (!L && A && B && R) return write(def.sides.left);

        // 4 neighbors → interior
        return write(def.interior);
    }

    
    static addSpreadArr(x, y, newItem, index){
        if(newItem.block){Map.navGrid[y][x] = 0; Map.enemyNavGrid[y][x] = 0;}
        if(Array.isArray(this.grid[y][x])){
            if(newItem.name == 'grass'){
                this.grid[y][x][index] = newItem.grid
                return this.drawGridValue(x,y,index)
            }
            this.grid[y][x][index] = newItem.grid
            return this.placeTile(x,y,newItem.name,index)
        }
        let oldItem = TILE_TYPES[TILE_MAP(this.grid[y][x])]
        if(newItem.depth < oldItem.depth && newItem.complex){
            this.grid[y][x] = [newItem.grid, oldItem.grid]
            return this.placeTile(x,y,newItem.name,0)
        }
        else if(newItem.depth > oldItem.depth && newItem.complex){
            this.grid[y][x] = [oldItem.grid, newItem.grid]
            return this.placeTile(x,y,newItem.name,1)
        }
        else if(newItem.complex){
            this.grid[y][x] = newItem.grid;
            this.placeTile(x,y,newItem.name)
        }
        else {this.grid[y][x] = newItem.grid; this.drawGridValue(x,y)}
    }

    static grabIndex(arr,index){
        if(Array.isArray(arr) && index > -1){
            return arr[index]
        }
        return arr
    }

    static grabDepth(arr, depth){
        if(Array.isArray(arr)){
            return depth == FLOORDEPTH? arr[0]: arr[1]
        }
        return arr
    }

    static checkAndPlace(x, y, val, depth){
        if(Array.isArray(this.grid[y][x])){
            depth == FLOORDEPTH? this.grid[y][x][0] = val: this.grid[y][x][1] = val
            return;
        }
        const oldItem = TILE_TYPES[TILE_MAP(this.grid[y][x])]
        const newItem = TILE_TYPES[TILE_MAP(val)]
        if(oldItem && newItem.depth != oldItem.depth){
            newItem.depth == FLOORDEPTH? this.grid[y][x] = [newItem.grid, oldItem.grid]: this.grid[y][x] = [oldItem.grid, newItem.grid] 
            return
        }
        this.grid[y][x] = val
    }

    static sample(x, y){
        let rgb = this.getPixelRGBA(x,y);
        const distances = {
            1  : this.colorDistance(rgb, colors.green),      // grass
            2  : this.colorDistance(rgb, colors.lightGray),  // wall
            24 : this.colorDistance(rgb, colors.blue),       // water interior
            37 : this.colorDistance(rgb, colors.gray),       // road  (shifted from 36)
            14 : this.colorDistance(rgb, colors.brown),      // dirt interior
            43 : this.colorDistance(rgb, colors.lightBrown), // storage (shifted from 42)
            34 : this.colorDistance(rgb, colors.darkRed),    // house1 (shifted from 33)
            12 : this.colorDistance(rgb, colors.darkGreen),  // pine
            46 : this.colorDistance(rgb, colors.rockGray)    // rock (shifted from 45)
        };


        // Find the color category with the smallest distance to the given rgb color
        return Number(Object.keys(distances).reduce((a, b) => distances[a] < distances[b] ? a : b));
    }
    
    static addValToIndex(x,y,val){
        const oldItem = TILE_TYPES[TILE_MAP(this.grid[y][x])]
        const newItem = TILE_TYPES[TILE_MAP(val)]
        if(oldItem && newItem.depth != oldItem.depth){
            newItem.depth == FLOORDEPTH? this.grid[y][x] = [newItem.grid, oldItem.grid]: this.grid[y][x] = [oldItem.grid, newItem.grid] 
            return
        }
        this.grid[y][x] = newItem.grid
    }

    static handleLoadNonSpread(posX,posY,item,index=-1){
        if(item.name == 'turret'){
            Turret.baseItem = this.scene.add.sprite(posX*SQUARESIZE+item.lenX/2*SQUARESIZE, posY*SQUARESIZE+item.lenY/2*SQUARESIZE, item.value[0])
                .setDepth(item.depth) 
                .setInteractive()
            Turret.topItem = this.scene.add.sprite(posX*SQUARESIZE+item.lenX/2*SQUARESIZE, posY*SQUARESIZE+item.lenY/2*SQUARESIZE, item.value[1])
                .setDepth(item.depth+1) // Ensure it's above base
            const itemToPlace = Turret.baseItem;
            Turret.topItem.team = turretTeams[`${posX},${posY}`]
            const top = Turret.topItem
            this.addBlockItem(posX,posY,item)
            itemToPlace.setInteractive();
            itemToPlace.sx = posX
            itemToPlace.sy = posY
            itemToPlace.lenX = item.lenX
            itemToPlace.lenY = item.lenY
            itemToPlace.on('pointerover', () => {
            if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                    itemToPlace.setTint(0xaaaaaa); // Darken slightly on hover
                }
            });
            itemToPlace.on('pointerout', () => {
                if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                    itemToPlace.clearTint(); // Restore original color
                }
            });
            itemToPlace.on('pointerdown', () => {
                if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                    console.log('Destroying item...');
                    itemToPlace.destroy(); // Destroy the specific item
                    top.destroy()
                }
            });
            Turret.guns.push(Turret.topItem)
            Turret.topItem.delta = 1          
            Turret.placeItem = null;
        }
        else{
            this.placingItem = this.scene.add.sprite(posX*SQUARESIZE+item.lenX/2*SQUARESIZE, posY*SQUARESIZE+item.lenY/2*SQUARESIZE, item.value)
                .setDepth(item.depth) // Ensure it's above everything
                .setInteractive({ cursor: 'pointer' });
            this.addBlockItem(posX,posY,item)
            const itemToPlace = this.placingItem
            itemToPlace.sx = posX + Math.floor(item.lenX)
            itemToPlace.sy = posY + Math.floor(item.lenY)
            itemToPlace.lenX = item.lenX
            itemToPlace.lenY = item.lenY
            if(item == TILE_TYPES.spawn) spawnPoints.push([posX, posY, itemToPlace])
            if(index>-1) buildingArray[index][3] = itemToPlace;
            if (item.name === 'pine' || item.name === 'rock') {
                itemToPlace.resourceType = item.name;
                itemToPlace.health = 3;
                // 🟡 outline persists until resource is destroyed

                itemToPlace.on('pointerdown', () => {
                    const teamList = Teams.teamLists['1'].blockResourceList;
                    const foragerQueue = Teams.teamLists['1'].foragerQueue
                    // ✅ accessibility gate for legacy sprites (pine/rock)
                    if (!buildingManager.isBlockAccessible(posX, posY, item)) {
                        showAlert(this.scene, "Can't reach that resource");
                        return;
                    }
                    if (!itemToPlace.task) {
                        // Create a new task if none exists
                        if (!itemToPlace.queuedOutline) {
                            itemToPlace.queuedOutline = Map.scene.add.graphics();
                            itemToPlace.queuedOutline.setDepth(UIDEPTH);
                            itemToPlace.queuedOutline.lineStyle(2, 0xffff00, 1);
                            const xStart = itemToPlace.x-(itemToPlace.lenX/2*SQUARESIZE)
                            const yStart = itemToPlace.y-(itemToPlace.lenY/2*SQUARESIZE)
                            itemToPlace.queuedOutline.strokeRect(xStart, yStart, SQUARESIZE*itemToPlace.lenX, SQUARESIZE*itemToPlace.lenY);
                        }
                        const task = {
                            x: posX,
                            y: posY,
                            type: item,
                            resource: item.resource,
                            value: itemToPlace,
                            assigned: 0,
                            remaining: itemToPlace.health,
                            forageType: 'block'
                        };
                        itemToPlace.task = task;
                        foragerQueue.push(task);
                    } else {
                        // Ensure the task is still in the blockResourceList
                        const stillInList = teamList.includes(itemToPlace.task);
                        if (!stillInList) {
                            teamList.push(itemToPlace.task);
                        }
                    }
                    blockResourceManager.assingTroopsToGetBlockResources(1);
                });
                if (item.name === 'pine') Map.worldPines.push(itemToPlace);
                if (item.name === 'rock') Map.worldStones.push(itemToPlace);
            }
            itemToPlace.on('pointerover', () => {
                if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                    itemToPlace.setTint(0xaaaaaa); // Darken slightly on hover
                }
            });
            itemToPlace.on('pointerout', () => {
                if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                    itemToPlace.clearTint(); // Restore original color
                }
            });
            itemToPlace.on('pointerdown', () => {
                if(this.scene.breakItems && this.scene.breakItems.text == "Place"){
                    console.log('Destroying item...');
                    Teams.teamLists['1'].destroyStates.push({
                        type: item,
                        value: itemToPlace,
                        x: posX,
                        y: posY,
                        duration: 100,
                        assigned: 0
                    });
                    buildingManager.assingTroopsToDestroy(1);
                    // itemToPlace.destroy(); // Destroy the specific item
                    // this.removeTile(itemToPlace.sx, itemToPlace.sy, itemToPlace.lenX, itemToPlace.lenY)
                }
            });
            this.placingItem = null;
        }
    }

    static _worldAdd(obj) {
        if (!obj) return obj;
        if (this.worldLayer) this.worldLayer.add(obj);
        return obj;
    }

    static addToWorldStatic(obj) {
        if (!obj) return obj;

        // put into static world layer (so it's logically grouped)
        Map.worldStaticLayer.add(obj);

        // IMPORTANT: UI cam must not render it
        const uiCam = Map.scene?.uiCamera;
        if (uiCam) uiCam.ignore(obj);

        return obj;
    }

    static removeFromWorldStatic(obj, destroy = true) {
        if (!obj) return;
        Map.worldStaticLayer?.remove(obj);

        if (destroy && obj.destroy) obj.destroy();
    }

    static _uiIgnoreWorldLayer() {
        const cam = this.scene?.uiCamera;
        if (!cam || !this.worldLayer) return;

        const gridKids   = Map.worldLayer?.getChildren?.() || [];
        // static layer only needs to be ignored once per object, BUT ignoring again is harmless
        const staticKids = Map.worldStaticLayer?.getChildren?.() || [];

        cam.ignore([...gridKids, ...staticKids]);
    }

    static getPixelRGBA(x, y) {

        const index = (x + y * this.imageData.width) * 4; // Calculate the index in the array
        const r = this.imageData.data[index];     // Red value
        const g = this.imageData.data[index + 1]; // Green value
        const b = this.imageData.data[index + 2]; // Blue value
        const a = this.imageData.data[index + 3]; // Alpha value (opacity)

        return { r, g, b, a };
    }

    static colorDistance(color1, color2) {
        return Math.sqrt(
            (color1.r - color2.r) ** 2 +
            (color1.g - color2.g) ** 2 +
            (color1.b - color2.b) ** 2
        );
    }

    item = [{x: 2, y:4}, {x: 6, y:4}]
}
