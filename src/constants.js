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
    ATTACK_MODE: 2
}
export const GRID_WIDTH     = 10
export const GRID_ARRAY     = create2DArray(GRID_HEIGHT, GRID_WIDTH)
export var WORLD_DIMENSION = 60;
export const UIDEPTH = 10
export const FLOORDEPTH = 2
export const BLOCKDEPTH = FLOORDEPTH+1
export const SQUARESIZE = 16;
export const TILE_TYPES = {
    grass : {
        name: "grass",
        spread: true,
        block: false,
        complex: false,
        grid: 1,
        depth: FLOORDEPTH
    },
    stone : {
        name: "stone",
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
        spread: false,
        block: true,
        complex: false,
        grid: 12,
        lenX: 2,
        lenY: 2,
        depth: BLOCKDEPTH+10
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
        depth: BLOCKDEPTH+10
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
        depth: FLOORDEPTH
    },
    player:{
        name: "player",
        block:true,
        value: 'image9',
        depth: BLOCKDEPTH+1,
        lenX: 1,
        lenY: 1,
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
];

export function TILE_MAP(val){
    if(val == 1){return "grass"}
    else if(val >= 2 && val <= 10){return "stone"}
    else if(val == 11){return "sand"}
    else if(val == 12){return "pine"}
    else if(val == 13){return "turret"}
    else if(val >= 14 && val <= 22){return "dirt"}
    else if(val >= 23 && val <= 31){return "water"}
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

export function intDiv(n,d){
    return Math.floor(n/d)
}
