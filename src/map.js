import { CHUNK_SIZE, SQUARESIZE, FLOORDEPTH, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, TILE_MAP, TILE_ARR, BLOCKDEPTH } from "./constants";
import Phaser from "phaser";
import { Turret } from "./Turret";
import { Player } from "./Player";
import { buildingArray, clearBuildingArray, turretTeams } from "./town";
import { buildPolysFromGridMap, NavMesh } from "navmesh";
import { Teams } from "./Teams";
import { buildingManager } from "./buildingManager";

const colors = {
    green: { r: 14, g: 209, b: 69 },
    blue: { r: 0, g: 168, b: 243 },
    white: { r: 255, g: 255, b: 255 },
    brownishYellow: { r: 204, g: 153, b: 0 },
    gray : {r: 195, g: 195, b: 195}
};


export class Map{

    static barrier;
    static graphics;
    static grid;
    static navGrid
    static navMesh;
    static scene;
    static imageData;
    static placingItem = null; // The current item being placed
    static isPlacing = false; // Flag to indicate placement mode
    static blocks = [];
    static waterBlocks = [];
    static cameraBounds;

    static initMap(){
        this.barrier = this.scene.physics.add.staticGroup();  // Ensure barriers are static bodies
        this.graphics = this.scene.add.graphics();
    }

    static initGrid(){ //makes tile types into correct orientation
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[0].length; x++) {
                let item = TILE_MAP(this.grid[y][x])
                if(Array.isArray(this.grid[y][x])){
                    let btmTile = TILE_MAP(this.grid[y][x][0])
                    let topTile = TILE_MAP(this.grid[y][x][1])
                    if(TILE_TYPES[btmTile].complex){
                        this.determineTileType(x,y,item,0,0)
                    }
                }
                else if (item == "water") {
                    this.determineTileType(x,y,item,-1,0)
                    this.grid[y][x] = [1, this.grid[y][x]]
                }
                else if(TILE_TYPES[item].complex) {
                    this.determineTileType(x,y,item,-1,0)
                }
            }
        }
    }

    static MapFromImage(canvas, image){
        this.barrier = this.scene.physics.add.staticGroup();  // Ensure barriers are static bodies
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        this.imageData = context.getImageData(0, 0, image.width, image.height);

        this.graphics = this.scene.add.graphics();
        for (let y = 0; y < this.imageData.height; y++) {
            for (let x = 0; x < this.imageData.width; x++) {
                const index = (x + y * this.imageData.width) * 4;
                const r = this.imageData.data[index];
                const g = this.imageData.data[index + 1];
                const b = this.imageData.data[index + 2];
                const a = this.imageData.data[index + 3] / 255;

                let sample = this.sample(x,y);
                this.grid[y][x] = sample;
                if (sample == 0) {
                    let barrierBlock = this.scene.physics.add.staticImage(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, 'barrier');
                    barrierBlock.setDisplaySize(SQUARESIZE, SQUARESIZE);
                    this.barrier.add(barrierBlock);
                } else {
                    this.graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), a);
                    this.graphics.fillRect(x * SQUARESIZE, y * SQUARESIZE, SQUARESIZE, SQUARESIZE);
                }
            }
        }
        this.imageData = null;
    }

    static mapFromData(data){
        this.grid = data;
        this.initGrid();
        this.reDraw(data[0].length, data.length);
    }

    static placeItem(item){
        this.placingItem = this.scene.add.sprite(0, 0, item.value)
            .setAlpha(0.5) // Make it semi-transparent
            .setDepth(item.depth) // Ensure it's above everything
            .setInteractive();
        this.placingItem.blocked = false;
        // Enable mouse-following behavior
        this.isPlacing = true;
        this.scene.input.on('pointermove', (pointer) => {
            if (this.placingItem && this.isPlacing && pointer.x>0 && pointer.x<SQUARESIZE*WORLD_DIMENSIONX && pointer.y>0 && pointer.y<SQUARESIZE*WORLD_DIMENSIONY) {
                let lenX = item.lenX
                let lenY = item.lenY
                let x = pointer.worldX - pointer.worldX%SQUARESIZE - lenX/2*SQUARESIZE
                let y = pointer.worldY - pointer.worldY%SQUARESIZE - lenY/2*SQUARESIZE
                this.placingItem.setTint(this.checkBlockPosition(Math.floor(x/SQUARESIZE),Math.floor(y/SQUARESIZE),lenX, lenY))
                this.placingItem.setPosition(pointer.worldX - pointer.worldX%SQUARESIZE, pointer.worldY - pointer.worldY%SQUARESIZE);
            }
        });
    }

    static handleMapClick(x, y, item) {
        // If we're in placing mode, finalize the placement
        if(item == TILE_TYPES.player && this.isPlacing && this.placingItem && !this.placingItem.blocked){
            // const worldX = this.scene.cameras.main.scrollX / SQUARESIZE + pointer.x/SQUARESIZE;
            // const worldY = this.scene.cameras.main.scrollY / SQUARESIZE + pointer.y/SQUARESIZE;
            Player.addPlayer(Math.floor(worldX), Math.floor(worldY))
            this.isPlacing = false; // Exit placing mode
            this.placingItem.destroy(); // Clear placing item
        }
        else if (this.isPlacing && this.placingItem && !this.placingItem.blocked) {
            // let x = pointer.worldX - pointer.worldX%SQUARESIZE - item.lenX/2*SQUARESIZE
            // let y = pointer.worldY - pointer.worldY%SQUARESIZE - item.lenY/2*SQUARESIZE
            this.placingItem.clearTint()
            this.placingItem.setAlpha(1); // Set full visibility
            this.placingItem.setPosition(x, y); // Finalize position
            x = Math.floor(x/SQUARESIZE)
            y = Math.floor(y/SQUARESIZE)
            this.isPlacing = false;
            this.addBlockItem(x,y,item)
            const itemToPlace = this.placingItem
            itemToPlace.setInteractive();
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
                    Teams.teamLists['1'].destroyList.push([x,y])
                    Teams.teamLists['1'].destroyState[`${x},${y}`] = {
                        type: item,
                        value: itemToPlace,
                        x: x,
                        y: y,
                        duration: 100
                    }
                    buildingManager.assingTroopsToDestroy(1)
                    // itemToPlace.destroy(); // Destroy the specific item
                    // this.removeTile(itemToPlace.sx, itemToPlace.sy, itemToPlace.lenX, itemToPlace.lenY)
                }
            });
        }
    }
    
    static checkBlockPosition(posX, posY, lenX, lenY, turret=0){
        for (let y = posY; y < posY + lenY; y++) {
            for (let x = posX; x < posX + lenX; x++) {
                if(TILE_TYPES[TILE_MAP(this.grid[y][x])]?.block){
                    turret ? Turret.topItem.blocked = true : this.placingItem.blocked = true;
                    return Phaser.Display.Color.GetColor(200, 49, 19);
                }
            }
        }
        turret ? Turret.topItem.blocked = false : this.placingItem.blocked = false;
        return Phaser.Display.Color.GetColor(14, 209, 69);
    }

    static checkSpreadPosition(posX, posY, endX, endY){
        let lenX = endX - posX;
        let lenY = endY - posY;
        for (let y = posY; y < posY + lenY + 1; y++) {
            for (let x = posX; x < posX + lenX + 1; x++) {
                if(TILE_TYPES[TILE_MAP(this.grid[y][x])]?.block){
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
                // this.addValToIndex(x,y,item.grid)
                // this.grid[y][x] = item.grid;
                if(item.block){
                    let barrierBlock = this.scene.physics.add.staticImage(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, 'barrier');
                    barrierBlock.setDisplaySize(SQUARESIZE, SQUARESIZE).setDepth(FLOORDEPTH).setAlpha(0);
                    this.barrier.add(barrierBlock);
                    Map.navGrid[y][x] = 0;
                    // this.blocks[y*WORLD_DIMENSIONX+x] = barrierBlock; // Add to an array for tracking        
                }
            }
        }
    }

    static placeTile(x, y, tileType, index=-1) {
        // Place the tile in the this.grid
        this.determineTileType(x, y, tileType, index);
        let depth = TILE_TYPES[TILE_MAP(this.grabIndex(this.grid[y][x],index))].depth
        index = depth == FLOORDEPTH? 0 : 1;
        // Update neighbors to ensure correct transitions
        if (this.grid[y - 1] && TILE_MAP(this.grabDepth(this.grid[y - 1][x], depth)) === tileType) {
            if (Array.isArray(this.grid[y - 1][x])) this.checkAndPlace(x, y - 1, this.determineTileType(x, y - 1, tileType, index), depth); // Above
            else this.grid[y - 1][x] = this.determineTileType(x, y - 1, tileType); // Above
        }
        if (this.grid[y + 1] && TILE_MAP(this.grabDepth(this.grid[y + 1][x], depth)) === tileType) {
            if (Array.isArray(this.grid[y + 1][x])) this.checkAndPlace(x, y + 1, this.determineTileType(x, y + 1, tileType, index), depth); // Above
            else this.grid[y + 1][x] = this.determineTileType(x, y + 1, tileType); // Above
        }
        if (this.grid[y][x - 1] && TILE_MAP(this.grabDepth(this.grid[y][x - 1], depth)) === tileType) {
            if (Array.isArray(this.grid[y][x - 1])) this.checkAndPlace(x - 1, y, this.determineTileType(x - 1, y, tileType, index), depth); // Above
            else this.grid[y][x - 1] = this.determineTileType(x - 1, y, tileType); // Above
        }
        if (this.grid[y][x + 1] && TILE_MAP(this.grabDepth(this.grid[y][x + 1], depth)) === tileType) {
            if (Array.isArray(this.grid[y][x + 1])) this.checkAndPlace(x + 1, y, this.determineTileType(x + 1, y, tileType, index), depth); // Above
            else this.grid[y][x + 1] = this.determineTileType(x + 1, y, tileType); // Above
        }
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
            this.handleLoadNonSpread(buildingArray[i][0],buildingArray[i][1],buildingArray[i][2]);
        }
        clearBuildingArray();
    }

    static reDraw(width = WORLD_DIMENSIONX, height = WORLD_DIMENSIONY) {
        this.graphics.clear();
        this.blocks.forEach(child => {
            if (Array.isArray(child)) {
                for (let i = 0; i < child.length; i++) {
                    if(Array.isArray(child[i])){
                        child[i][0].destroy();
                        child[i][1].destroy();
                    }
                    else{
                        child[i].destroy();
                    }
                }
            } else {
                child.destroy();
            }
        });
        this.blocks = []
        this.waterBlocks.forEach(child => child.destroy())
        this.barrier.clear(true);
    
        const camera = this.scene.cameras.main;
    
        // Calculate top-left and bottom-right grid indices to draw
        const topLeftX = Math.floor(camera.scrollX / SQUARESIZE);
        const topLeftY = Math.floor(camera.scrollY / SQUARESIZE);
        
        const bottomRightX = Math.max(topLeftX + CHUNK_SIZE, topLeftX + Math.floor(window.innerWidth/SQUARESIZE))
        const bottomRightY = topLeftY + CHUNK_SIZE

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
                    barrierBlock.play('water').setDepth(FLOORDEPTH)
                    this.waterBlocks.push(barrierBlock)
                } else if (Array.isArray(this.grid[y][x])) {
                    const type = TILE_TYPES[TILE_MAP(this.grid[y][x][1])];
                    this.drawGridValue(x, y, 0);
                    if (type && type.spread) {
                        this.drawGridValue(x, y, 1)
                    }
                } else {
                    this.drawGridValue(x, y);
                }
            }
        }
    }   

    static drawGridValue(x,y,index=-1){
        let tileKey, type;
        if(index > -1) {tileKey = TILE_ARR[this.grid[y][x][index]];type = TILE_TYPES[TILE_MAP(this.grid[y][x][index])]}
        else {tileKey = TILE_ARR[this.grid[y][x]]; type = TILE_TYPES[TILE_MAP(this.grid[y][x])]}
        if(type.block){
            let barrierBlock;
            if(type.spriteSheet){
                barrierBlock = this.scene.add.sprite(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, tileKey);
                barrierBlock.play(tileKey).setDepth(type.depth)
            }
            else{
                barrierBlock = this.scene.physics.add.staticImage(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, tileKey);
                barrierBlock.setDisplaySize(SQUARESIZE, SQUARESIZE).setDepth(type.depth);
            }
            this.barrier.add(barrierBlock);
            this.handleGridDelete(barrierBlock, type, x, y)
        }
        else{
            let block;
            if(type.spriteSheet){
                block = this.scene.add.sprite(x * SQUARESIZE + SQUARESIZE/2, y * SQUARESIZE + SQUARESIZE/2, tileKey);
                block.play(tileKey).setDepth(type.depth)
            }
            else{
                block = this.scene.add.image(
                    x * SQUARESIZE + SQUARESIZE / 2, 
                    y * SQUARESIZE + SQUARESIZE / 2, 
                    tileKey
                );
            }
            block.setDepth(type.depth); // Scale to fit the grid
            this.handleGridDelete(block, type, x, y)
        }
    }

    static handleGridDelete(block, type, x, y){
        if(type.depth == BLOCKDEPTH){
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
                this.blocks[y*WORLD_DIMENSIONX+x]?.destroy();
                this.blocks[y*WORLD_DIMENSIONX+x] = block;
            }
            else{
                this.blocks[y*WORLD_DIMENSIONX+x][0]?.destroy();
                this.blocks[y*WORLD_DIMENSIONX+x][0] = block;
                if(this.blocks[y*WORLD_DIMENSIONX+x][1].body){
                    Map.navGrid[y][x] = 0
                }
            }
        }
    }

    static determineTileType(x, y, tileType,index = -1, draw = 1) {
        if(TILE_TYPES[tileType].name == "water" && (x == 0 || x == this.grid[0].length - 1
            || y == 0 || y == this.grid.length - 1
        )){
            // Default fallback for interior
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].interior;
            else this.grid[y][x] = TILE_TYPES[tileType].interior;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].interior; // Default to interior
        }
        let depth = TILE_TYPES[tileType].depth
        const above = TILE_MAP(this.grabDepth(this.grid[y - 1]?.[x], depth)) === tileType;
        const below = TILE_MAP(this.grabDepth(this.grid[y + 1]?.[x], depth)) === tileType;
        const left = TILE_MAP(this.grabDepth(this.grid[y]?.[x - 1], depth)) === tileType;
        const right = TILE_MAP(this.grabDepth(this.grid[y]?.[x + 1], depth)) === tileType;
    
        if (!above && !below && !left && !right) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].interior;
            else this.grid[y][x] = TILE_TYPES[tileType].interior;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].interior; // Isolated tile type
        } else if (!above && left && right) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].sides.up;
            else this.grid[y][x] = TILE_TYPES[tileType].sides.up;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].sides.up; // Side - up
        } else if (!below && left && right) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].sides.down;
            else this.grid[y][x] = TILE_TYPES[tileType].sides.down;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].sides.down; // Side - down
        } else if (!left && above && below) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].sides.left;
            else this.grid[y][x] = TILE_TYPES[tileType].sides.left;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].sides.left; // Side - left
        } else if (!right && above && below) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].sides.right;
            else this.grid[y][x] = TILE_TYPES[tileType].sides.right;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].sides.right; // Side - right
        } else if (!above && !left) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].corners.topLeft;
            else this.grid[y][x] = TILE_TYPES[tileType].corners.topLeft;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].corners.topLeft; // Corner - top left
        } else if (!above && !right) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].corners.topRight;
            else this.grid[y][x] = TILE_TYPES[tileType].corners.topRight;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].corners.topRight; // Corner - top right
        } else if (!below && !left) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].corners.bottomLeft;
            else this.grid[y][x] = TILE_TYPES[tileType].corners.bottomLeft;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].corners.bottomLeft; // Corner - bottom left
        } else if (!below && !right) {
            if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].corners.bottomRight;
            else this.grid[y][x] = TILE_TYPES[tileType].corners.bottomRight;
            if (draw) this.drawGridValue(x,y,index)
            return TILE_TYPES[tileType].corners.bottomRight; // Corner - bottom right
        } 
        
        // Default fallback for interior
        if(index > -1) this.grid[y][x][index] = TILE_TYPES[tileType].interior;
        else this.grid[y][x] = TILE_TYPES[tileType].interior;
        if (draw) this.drawGridValue(x,y,index)
        return TILE_TYPES[tileType].interior; // Default to interior
    }
    
    static addSpreadArr(x, y, newItem, index){
        if(newItem.block){Map.navGrid[y][x] = 0}
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
            1: this.colorDistance(rgb, colors.green),
            3: this.colorDistance(rgb, colors.blue),
            4: this.colorDistance(rgb, colors.white),
            5: this.colorDistance(rgb, colors.brownishYellow),
            0: this.colorDistance(rgb, colors.gray)
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

    static handleLoadNonSpread(posX,posY,item){
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
                .setInteractive();
            this.addBlockItem(posX,posY,item)
            const itemToPlace = this.placingItem
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
                    //this.removeTile(itemToPlace.sx, itemToPlace.sy, itemToPlace.lenX, itemToPlace.lenY)
                }
            });
            this.placingItem = null;
        }
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
