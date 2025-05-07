import { Player } from "./Player";

export function create2DArray(rows, cols) {
    let array = new Array(rows);
    for (let i = 0; i < rows; i++) {
        array[i] = new Array(cols).fill(1);
    }
    return array;
}
export let selected = 'image0'
export const GRID_HEIGHT    = 10
export const CONTROL_STATES = {
    USER_MODE: 0,
    TRACK_MODE: 1,
    ATTACK_MODE: 2,
    FARM_MODE: 3,
    HARVEST_MODE: 4,
    FISH_MODE: 5,
    HEAL_MODE: 6,
    BUILD_MODE_T: 7,
    BUILD_MODE_B: 8,
    DESTROY_MODE: 9
}
export var WORLD_DIMENSIONX = 70;
export var WORLD_DIMENSIONY = 70;
export const UIDEPTH = 10
export const FLOORDEPTH = 2
export const BLOCKDEPTH = FLOORDEPTH+1
export const SQUARESIZE = 16;
export const CHUNK_SIZE = 60
export const EDGE_RATIO = CHUNK_SIZE/2
export const TILE_TYPES = {
    grass : {
        name: "grass",
        spread: true,
        block: false,
        complex: false,
        grid: 1,
        depth: FLOORDEPTH
    },
    wall : {
        name: "wall",
        interior: 2, // Incremented by 1
        sides: {
            up: 3,
            down: 4,
            left: 5,
            right: 6,
        },
        corners: {
            topLeft: 7,
            topRight: 8,
            bottomLeft: 9,
            bottomRight: 10,
        },
        complex: true,
        price: 5,
        spread: true,
        block: true,
        grid: 2,
        depth: BLOCKDEPTH
    },
    sand: {
        name: "sand",
        value: 'image1',
        spread: false,
        block: true,
        complex: false,
        grid: 11,
        lenX: 4,
        lenY: 4,
        depth: BLOCKDEPTH
    },
    pine: {
        name: "pine",
        value: 'image6',
        price: 50,
        spread: false,
        block: true,
        complex: false,
        grid: 12,
        lenX: 2,
        lenY: 2,
        depth: BLOCKDEPTH
    },
    turret: {
        name: "turret",
        value: ['image7','image7a'],
        spread: false,
        block: true,
        complex: false,
        grid: 13,
        lenX: 3,
        lenY: 3,
        depth: BLOCKDEPTH
    },
    dirt : {
        name: "dirt",
        spread: true,
        block: false,
        complex: true,
        interior: 14, // Incremented by 1
        sides: {
            up: 15,
            down: 16,
            left: 17,
            right: 18,
        },
        corners: {
            topLeft: 19,
            topRight: 20,
            bottomLeft: 21,
            bottomRight: 22,
        },
        grid: 14,
        depth: FLOORDEPTH
    },
    water : {
        name: "water",
        spriteSheet: true,
        spread: true,
        block: true,
        complex: true,
        interior: 23, // Incremented by 1
        sides: {
            up: 24,
            down: 25,
            left: 26,
            right: 27,
        },
        corners: {
            topLeft: 28,
            topRight: 29,
            bottomLeft: 30,
            bottomRight: 31,
        },
        grid: 23,
        depth: BLOCKDEPTH
    },
    house1:{
        name: "house1",
        value: "house1",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 32,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4
    },
    house2:{
        name: "house2",
        value: "house2",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 33,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4
    },
    well:{
        name: "well",
        value: "well",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 34,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4
    },
    road : {
        name: "road",
        spread: true,
        block: false,
        complex: false,
        grid: 35,
        depth: FLOORDEPTH
    },
    player:{
        name: "player",
        block: true,
        value: 'image9',
        depth: BLOCKDEPTH+1,
        lenX: 1,
        lenY: 1,
    },
    crops: {
        name: "crops",
        block: false,
        value: 'crops',
        spriteSheet: true,
        depth: FLOORDEPTH,
        spread: true,
        complex: false,
        price: 5,
        grid: 36
    }
};

export const TILE_ARR = [
    0,
    'grass',                // grass
    'wall',                 // Interior wall
    'tWall',                // Top wall
    'bWall',                // Bottom wall
    'lWall',                // Right wall
    'rWall',                // Left wall
    'tlcWall',              // Top-right corner wall
    'trcWall',              // Bottom-right corner wall
    'blcWall',              // Top-left corner wall
    'brcWall',              // Bottom-left corner wall
    'image1',               // sand
    'image6',               // pine
    ['image7', 'image7a'],  // Turret
    'Dirt',                 // Interior Dirt
    'tDirt',                // Top Dirt
    'bDirt',                // Bottom Dirt
    'lDirt',                // Right Dirt
    'rDirt',                // Left Dirt
    'tlcDirt',              // Top-right corner Dirt
    'trcDirt',              // Bottom-right corner Dirt
    'blcDirt',              // Top-left corner Dirt
    'brcDirt',              // Bottom-left corner Dirt
    'water',                 // Interior water
    'twater',                // Top water
    'bwater',                // Bottom water
    'lwater',                // Right water
    'rwater',                // Left water
    'tlcwater',              // Top-right corner water
    'trcwater',              // Bottom-right corner water
    'blcwater',              // Top-left corner water
    'brcwater',              // Bottom-left corner water
    'house1',
    'house2',
    'well',
    'road',
    'crops'
];

export function TILE_MAP(val){
    if(val == 1){return "grass"}
    else if(val >= 2 && val <= 10){return "wall"}
    else if(val == 11){return "sand"}
    else if(val == 12){return "pine"}
    else if(val == 13){return "turret"}
    else if(val >= 14 && val <= 22){return "dirt"}
    else if(val >= 23 && val <= 31){return "water"}
    else if(val == 32){return "house1"}
    else if(val == 33){return "house2"}
    else if(val == 34){return "well"}
    else if(val == 35){return "road"}
    else if(val == 36){return "crops"}
    else{return {}}
}

export function gridPos(x, y){
    return {
        x: Math.floor(x % WORLD_DIMENSION),
        y: Math.floor(y % WORLD_DIMENSION)
    };
}

export function distanceBetween(x1,y1,x2,y2){
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function handleGridXY(x,y,itemX,itemY){
    let finalX, finalY;
    if(itemX%2 == 1){
        finalX = x - x%SQUARESIZE + SQUARESIZE/2
    }
    else{
        finalX = x - x%SQUARESIZE + SQUARESIZE/2
    }
    if(itemY%2 == 1){
        finalY = y - y%SQUARESIZE + SQUARESIZE/2
    }
    else{
        finalY = y - y%SQUARESIZE + SQUARESIZE/2
    }

    return [finalX,finalY]
}

export function showAlert(scene, message, color = '#ffffff') {
    const alert = scene.add.text(
        scene.cameras.main.width / 2, 0, message,
        { fontSize: '24px', fill: color, stroke: '#000000', strokeThickness: 3 }
    )
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(UIDEPTH);

    scene.tweens.add({
        targets: alert,
        y: 50,
        alpha: 0,
        duration: 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => alert.destroy()
    });
}

export function intDiv(n,d){
    return Math.floor(n/d)
}
