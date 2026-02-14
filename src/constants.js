import { UI_ITEM_TYPES } from "./UI/UIConstants";
import { StageState } from "./parcelController/StageState";
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
    DESTROY_MODE: 9,
    SEED_MODE: 10,
    R_FARM_MODE: 11,
    BACK_TO_TOWN: 12,
    TRACK_TARGET: 13,
    SEND_TO_STORAGE: 14, //general send item to store
    WATER_CROPS_MODE: 15,
    GET_WATER_MODE: 16,
    COOK_MODE: 18,
    GET_FROM_STORAGE: 19, //from storage
    SEND_TO_OVEN: 20, //to oven
    GET_FROM_OVEN: 21, //obtain from oven
    GET_BLOCK_RESOURCE: 22,
    SLEEP_MODE: 23,
    GO_HOME_MODE: 24,
    FLEE_MODE: 25,
    HEADING_TO_GUARD: 26,
    FIX_BUILDING: 27,
    SIEGE_MODE: 28,
    DESTROY_MODE_T: 29,
}

export const MAX_CROP_GROWTH_STAGE = 2; // assuming 0-4 frames
export var WORLD_DIMENSIONX = 100;
export var WORLD_DIMENSIONY = 100;
export const UIDEPTH = 10
export const FLOORDEPTH = 2
export const BLOCKDEPTH = FLOORDEPTH+1
export const SQUARESIZE = 16;
export const CHUNK_SIZE = 60
export const EDGE_RATIO = CHUNK_SIZE/8
// --- TILE_TYPES (full) ---
export const TILE_TYPES = {
  grass : {
    name: "grass",
    spread: true,
    block: false,
    complex: false,
    grid: 1,
    depth: FLOORDEPTH
  },

  wall: {
    name: "wall",
    interior: 2,
    sides: { up: 3, down: 4, left: 5, right: 6 },
    corners: { topLeft: 7, topRight: 8, bottomLeft: 9, bottomRight: 10 },
    complex: true,
    price: { stone: 1 },         
    spread: true,
    block: true,
    grid: 2,
    depth: BLOCKDEPTH,
    spriteSheet: true,
    lenX: 1, lenY: 1,

    // OPTIONAL but recommended: new per-piece assets you mentioned
    // (keeps numeric mapping for grid/TILE_MAP but draw can use assets)
    assets: {
      interior: { key: 'wall_interior', sheet: false },
      edge:     { key: 'wall_edge',     sheet: false },   // "top edge" source; map.js flips/rotates
      corner:   { key: 'wall_corner',   sheet: false },   // "top-left corner" source; map.js flips/rotates
    }
  },

  sand: {
    name: "sand",
    value: 'image1',
    spread: false,
    block: true,
    complex: false,
    grid: 11,
    lenX: 3, lenY: 3,
    price: 10,
    depth: BLOCKDEPTH
  },

  pine: {
    name: "pine",
    value: 'pine3',
    price: 50,
    spread: false,
    block: true,
    complex: false,
    grid: 12,
    lenX: 3, lenY: 3,
    depth: BLOCKDEPTH+2,
    resource: UI_ITEM_TYPES.wood,
    images: ['pine1','pine2','pine3']
  },

  turret: {
    name: "turret",
    value: ['image7','image7a'],
    spread: false,
    block: true,
    complex: false,
    grid: 13,
    lenX: 3, lenY: 3,
    price: 20000,
    depth: BLOCKDEPTH
  },

  // ── Dirt (complex, numbered + island; draw uses assets, not TILE_ARR) ──
  dirt : {
    name: "dirt",
    spread: true,
    block: false,
    complex: true,
    grid: 14,                 // interior code
    interior: 14,             // interior
    island:   15,             // island (cap)
    sides:    { up: 16, down: 17, left: 18, right: 19 },
    corners:  { topLeft: 20, topRight: 21, bottomLeft: 22, bottomRight: 23 },
    depth: FLOORDEPTH,
    assets: {
      interior: { key: 'Dirt',        sheet: false },
      island:   { key: 'dirt_island', sheet: false },
      edge:     { key: 'dirt_edge',   sheet: false },
      corner:   { key: 'dirt_corner', sheet: false }
    }
  },

  // ── Water (complex, numbered + island; draw uses assets, not TILE_ARR) ──
  water : {
    name: "water",
    spriteSheet: true, // interior is animated
    spread: true,
    block: true,
    complex: true,
    grid: 24,                 // interior code
    interior: 24,             // interior
    island:   25,             // island (cap)
    sides:    { up: 26, down: 27, left: 28, right: 29 },
    corners:  { topLeft: 30, topRight: 31, bottomLeft: 32, bottomRight: 33 },
    depth: BLOCKDEPTH,
    assets: {
      interior: { key: 'water',        sheet: true,  anim: 'water' },
      island:   { key: 'shore_island', sheet: true,  anim: 'shore_island' },
      edge:     { key: 'shore_edge',   sheet: true,  anim: 'shore_edge' },
      corner:   { key: 'shore_corner', sheet: true,  anim: 'shore_corner' }
    }
  },

  house1:{
    name: "house1",
    value: "house1",
    spriteSheet: false,
    spread: false,
    block: true,
    complex: false,
    grid: 34,
    depth: BLOCKDEPTH,
    lenX: 4, lenY: 4,
    cost: { wood: 4, stone: 4 }
  },

  house2:{
    name: "house2",
    value: "house2",
    spriteSheet: false,
    spread: false,
    block: true,
    complex: false,
    grid: 35,
    depth: BLOCKDEPTH,
    lenX: 4, lenY: 4,
    cost: { wood: 4, stone: 4 }
  },

  well:{
    name: "well",
    value: "well",
    spriteSheet: false,
    spread: false,
    block: true,
    complex: false,
    grid: 36,
    depth: BLOCKDEPTH,
    lenX: 4, lenY: 4
  },

  // ── Road (NEW: complex, interior/edge/corner/island; interior kept at 37) ──
  road : {
    name: "road",
    spread: true,
    block: false,
    complex: true,
    grid: 37,                 // interior code (kept the same)
    interior: 37,             // interior
    island:   48,             // island (cap)
    sides:    { up: 49, down: 50, left: 51, right: 52 },
    corners:  { topLeft: 53, topRight: 54, bottomLeft: 55, bottomRight: 56 },
    depth: FLOORDEPTH,
    assets: {
      interior: { key: 'road_interior', sheet: false },
      island:   { key: 'road_island',   sheet: false },
      edge:     { key: 'road_edge',     sheet: false },
      corner:   { key: 'road_corner',   sheet: false }
    }
  },

  player:{
    name: "player",
    block: true,
    value: 'image9',
    depth: BLOCKDEPTH+1,
    lenX: 1, lenY: 1,
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
    grid: 38
  },

  grassCrop : {
    name: "grassCrop",
    spread: true,
    block: false,
    complex: false,
    grid: 39,
    depth: FLOORDEPTH,
    interactable: true
  },

  grassBerry : {
    name: "grassBerry",
    spread: true,
    block: false,
    complex: false,
    grid: 40,
    depth: FLOORDEPTH,
    interactable: true
  },

  spawn: {
    name: "spawn",
    value: "spawn",
    spriteSheet: false,
    spread: false,
    block: false,
    complex: false,
    grid: 41,
    depth: BLOCKDEPTH,
    lenX: 4, lenY: 4
  },

  clayOven: {
    name: "clayOven",
    value: "clayOven",
    spriteSheet: true,
    spread: false,
    block: true,
    complex: false,
    grid: 42,
    depth: BLOCKDEPTH,
    lenX: 4, lenY: 4,
    cost: { stone: 4 }
  },

  storage: {
    name: "storage",
    value: "storage",
    spriteSheet: false,
    spread: false,
    block: true,
    complex: false,
    grid: 43,
    depth: BLOCKDEPTH,
    lenX: 4, lenY: 4,
    cost: { wood: 4 }
  },

  grassWood : {
    name: "grassWood",
    spread: true,
    block: false,
    complex: false,
    grid: 44,
    depth: FLOORDEPTH,
    interactable: true
  },

  grassRock : {
    name: "grassRock",
    spread: true,
    block: false,
    complex: false,
    grid: 45,
    depth: FLOORDEPTH,
    interactable: true
  },

  rock: {
    name: "rock",
    value: 'rock3',
    spread: false,
    block: true,
    complex: false,
    grid: 46,
    lenX: 2, lenY: 2,
    depth: BLOCKDEPTH+2,
    resource: UI_ITEM_TYPES.stone,
    images: ['rock1','rock2','rock3']
  },

  construction: {
    name: "construction",
    value: 'construction',
    spread: false,
    block: true,
    complex: false,
    grid: 47,
    lenX: 4, lenY: 4,
    depth: BLOCKDEPTH+2,
  },

    woodWall: {
    name: "woodWall",
    interior: 57,
    sides: { up: 58, down: 59, left: 60, right: 61 },
    corners: { topLeft: 62, topRight: 63, bottomLeft: 64, bottomRight: 65 },
    complex: true,
    price: 5,                 // or whatever
    spread: true,
    block: true,
    grid: 57,                 // IMPORTANT: used in MapFromImage “blocked” check if you add it
    depth: BLOCKDEPTH,
    cost: { wood: 1 },         // for your UI counters
    spriteSheet: true,
    lenX: 1, lenY: 1,
    // OPTIONAL recommended per-piece assets (your new naming scheme)
    assets: {
      interior: { key: 'woodWall_interior', sheet: false },
      edge:     { key: 'woodWall_edge',     sheet: false },
      corner:   { key: 'woodWall_corner',   sheet: false },
      // door can be separate later: { key:'woodWall_door', ... }
    }
  },
  // --- DOORS (NOT blocked; spriteSheet w/ 2 frames) ---
  wall_door: {
    value: 'wall_door',
    name: "wall_door",
    grid: 66,            // new numeric id
    block: false,        // IMPORTANT: doors do NOT block navmesh
    depth: BLOCKDEPTH,
    lenX: 1,
    lenY: 1,
    spriteSheet: true,   // IMPORTANT: 2-frame sheet
    complex: false,
    price: { stone: 1 }
  },
  woodWall_door: {
    value: 'woodWall_door',
    name: "woodWall_door",
    grid: 67,            // new numeric id
    block: false,
    depth: BLOCKDEPTH,
    lenX: 1,
    lenY: 1,
    spriteSheet: true,
    complex: false,
    price: { wood: 1 }
  },
};


export const DRAFT_UI_X_SHIFT = 120;

export const teamSetupArray = {
    smallTeam: [TILE_TYPES.clayOven, TILE_TYPES.house2, TILE_TYPES.house1, TILE_TYPES.storage],
    bigTeam: [TILE_TYPES.well,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1]
}

export const TILE_ARR = [
  0,
  'grass',                // 1  grass

  // wall (2..10)
  'wall',                 // 2  interior
  'tWall',                // 3
  'bWall',                // 4
  'lWall',                // 5
  'rWall',                // 6
  'tlcWall',              // 7
  'trcWall',              // 8
  'blcWall',              // 9
  'brcWall',              // 10

  'image1',               // 11 sand
  'pine3',                // 12 pine
  ['image7','image7a'],   // 13 turret

  // dirt (14..23) — compatibility only (draw uses assets)
  'Dirt',     // 14
  'iDirt',    // 15
  'tDirt',    // 16
  'bDirt',    // 17
  'lDirt',    // 18
  'rDirt',    // 19
  'tlcDirt',  // 20
  'trcDirt',  // 21
  'blcDirt',  // 22
  'brcDirt',  // 23

  // water (24..33) — compatibility only (draw uses assets)
  'water',     // 24
  'iwater',    // 25
  'twater',    // 26
  'bwater',    // 27
  'lwater',    // 28
  'rwater',    // 29
  'tlcwater',  // 30
  'trcwater',  // 31
  'blcwater',  // 32
  'brcwater',  // 33

  'house1',     // 34
  'house2',     // 35
  'well',       // 36

  // road interior kept as 37 for legacy sampling
  'road_interior', // 37

  'crops',      // 38
  'grassCrop',  // 39
  'grassBerry', // 40
  'spawn',      // 41
  'clayOven',   // 42
  'storage',    // 43
  'grassWood',  // 44
  'grassRock',  // 45
  'rock3',      // 46
  'construction', // 47

  // road (48..56) — compatibility only (draw uses assets + rotation)
  'road_island',  // 48
  'road_edge',    // 49 (N)
  'road_edge',    // 50 (S)
  'road_edge',    // 51 (L/W)
  'road_edge',    // 52 (R/E)
  'road_corner',  // 53 (TL)
  'road_corner',  // 54 (TR)
  'road_corner',  // 55 (BL)
  'road_corner',   // 56 (BR)

  'woodWall',   // 57 interior
  'wood_tWall', // 58
  'wood_bWall', // 59
  'wood_lWall', // 60
  'wood_rWall', // 61
  'wood_tlcWall', // 62
  'wood_trcWall', // 63
  'wood_blcWall', // 64
  'wood_brcWall', // 65
  'wall_door',     // 66 wall door
  'woodWall_door'  // 67 wood wall door
];

// --- TILE_MAP (full) ---
export function TILE_MAP(val){
  if (val == 1) return "grass";
  else if (val >= 2 && val <= 10) return "wall";
  else if (val == 11) return "sand";
  else if (val == 12) return "pine";
  else if (val == 13) return "turret";

  // dirt 14..23
  else if (val >= 14 && val <= 23) return "dirt";

  // water 24..33
  else if (val >= 24 && val <= 33) return "water";

  else if (val == 34) return "house1";
  else if (val == 35) return "house2";
  else if (val == 36) return "well";

  // road interior (37) + road variants 48..56
  else if (val == 37 || (val >= 48 && val <= 56)) return "road";

  else if (val == 38) return "crops";
  else if (val == 39) return "grassCrop";
  else if (val == 40) return "grassBerry";
  else if (val == 41) return "spawn";
  else if (val == 42) return "clayOven";
  else if (val == 43) return "storage";
  else if (val == 44) return "grassWood";
  else if (val == 45) return "grassRock";
  else if (val == 46) return "rock";
  else if (val == 47) return "construction";
  else if (val >= 57 && val <= 65) return "woodWall";
  else if (val == 66) return "wall_door";
  else if (val == 67) return "woodWall_door";
}


export function gridPos(x, y){
    return {
        x: Math.floor(x % WORLD_DIMENSIONX),
        y: Math.floor(y % WORLD_DIMENSIONY)
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

export function showAlert(scene, message, color = '#ffffff', duration = 1000) {
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
        duration: duration,
        ease: 'Cubic.easeOut',
        onComplete: () => alert.destroy()
    });
}

export function intDiv(n,d){
    return Math.floor(n/d)
}

export function clearTaskPlusTimer(sprite){
    if(sprite.task){
        sprite.task = null;
    }
    if(sprite.timer){
        sprite.timer.remove(false);
        sprite.timer = null;
    }
}

export const gridColors = {
    water:  0x3cb8f1,
    wall: 0x808080,
    woodWall: 0x808080,
    wall_door: 0x5a5a5a,
    wall_door: 0x5a5a5a,
    dirt:   0x4c2b18,
    grass:  0x33cc33,
    house1: 0x8b0000,
    house2: 0x006400,
    road:   0x555555,
    well:   0xADD8E6,
    grassCrop: 0x33cc33,
    grassBerry:0x33cc33,
    grassWood: 0x33cc33,
    grassRock: 0x33cc33,
    spawn:  0x333333,
    storage:0x7d4900,
    pine: 0x006400,
    rock: 0x5a682b,
    crops: 0xFCF55F,
};

export const GHOST_ITEM_ICONS = {
  food: '🍖',
  clean_water: '💧',
  unclean_water: '💧',
  wood: '🌲',
  stone: '🗿',
  crop: '🌾',
  seedCrop: '🌱',
  seedBerry: '🍒',
};


export const colorFor = (cell) => {
    const type = Array.isArray(cell) ? TILE_MAP(cell[1]) : TILE_MAP(cell);
    return gridColors[type] || 0xffffff;
};

export function showGhostText(scene, x, y, text, teamNumber, isCrit = false, isMiss = false, colorGiven = false) {
    let color;

    if(colorGiven){
      color = colorGiven
    } else if (isMiss) {
        color = '#888888'; // Gray for MISS
    } else if (teamNumber === 1) {
        color = '#44ff44'; // Green for player/team 0 hit
    } else {
        color = isCrit ? '#ff4444' : '#ffffff'; // Red or white for enemies
    }

    const ghost = scene.add.text(x, y, text, {
        fontSize: '16px',
        fill: color,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2
    }).setDepth(1000).setOrigin(0.5);

    scene.tweens.add({
        targets: ghost,
        y: y - 20,
        alpha: 0,
        duration: 600,
        onComplete: () => ghost.destroy()
    });
} 

export function createBubbleText({
    scene,
    target,
    text,
    textColor = '#ffffff',
    bgColor = 'rgba(0,0,0,0.6)',
    fontSize = 10,
    duration = 1200,
    floatOffset = 18,
    fadeDuration = 350
}) {
    if (!scene || !target) return;

    // Base text (world-space)
    const label = scene.add.text(target.x, target.y - 20, text, {
        fontSize: `${fontSize}px`,
        fontFamily: 'monospace',
        color: textColor,
        stroke: '#000000',
        strokeThickness: 2
    })
    .setDepth(10000)
    .setOrigin(0.5)
    .setScrollFactor(1, 1);   // 🔹 world, not UI

    // Background auto-sized to text
    const padding = 4;
    const bg = scene.add.rectangle(
        label.x, label.y,
        label.width + padding * 2,
        label.height + padding * 2,
        Phaser.Display.Color.HexStringToColor(bgColor).color,
        1
    )
    .setOrigin(0.5)
    .setDepth(9999)
    .setScrollFactor(1, 1);   // 🔹 world, not UI

    // Make sure uiCamera does NOT render these
    if (scene.uiCamera) {
        scene.uiCamera.ignore([label, bg]);
    }

    const container = { label, bg, target };

    // Follow target
    container.update = () => {
        if (!container.target || !container.label.active || !container.bg.active) return;

        const newX = container.target.x;
        const newY = container.target.y - floatOffset;

        container.label.x = newX;
        container.label.y = newY;
        container.bg.x    = newX;
        container.bg.y    = newY;
    };

    scene.events.on('update', container.update);

    // Float then fade
    scene.tweens.add({
        targets: [label, bg],
        y: label.y - 15,
        duration,
        ease: 'Linear',
        onComplete: () => {
            scene.tweens.add({
                targets: [label, bg],
                alpha: 0,
                duration: fadeDuration,
                onComplete: () => {
                    label.destroy();
                    bg.destroy();
                    scene.events.off('update', container.update);
                }
            });
        }
    });

    return container;
}

//parcel
// ---- Parcel/Contract system (add to constants.js) ----
export const PARCEL = {
  SIZE: 25,
  // Main island top-left (world is 100x100; main parcel at 37,37 → 25 down/right)
  MAIN_ORIGIN: { x: 37, y: 37 },
  // Contract parcels sit one parcel away from main island; add a gap so UI isn't touching
  GAP_TILES: 0, // distance between parcel edges
  // World-space slot layout: W / S / E around the main parcel (N reserved for fort)
  SLOTS: {
    W: { dx: -25, dy: 0 },
    S: { dx: 0, dy: 25 },
    E: { dx: 25, dy: 0 },
  },
};

export const PRESSURE_CONTRACT = {
  DIFFICULTY_MIN: 1,
  DIFFICULTY_MAX: 3,

  // how many spawners per difficulty (1..3)
  SPAWNERS_BY_DIFFICULTY: { 1: 1, 2: 2, 3: 3 },

  // total raiders quota per spawner at stage 1 (scaled with stageIndex later)
  BASE_QUOTA_PER_SPAWNER: 3,

  // spawn interval (ms) drops as stage increases, down to MIN_INTERVAL_MS.
  BASE_INTERVAL_MS: 4000,
  MIN_INTERVAL_MS: 1500,
  INTERVAL_DROP_PER_STAGE_MS: 250, // e.g., stage 5 => 4000 - 1000
};

// ---- Contract economy (costs + rewards) ----
// constants.js
import { StageState } from "./parcelController/StageState.js"; // <-- adjust path if needed

export const CONTRACT_ECON = {
  STAGE_MULT: 0.25,

  COST_BASE: {
    FARM: 150,
    FOREST: 150,
    ROCK: 125,
    MILITIA: 200,
    PRESSURE: 120,
  },

  PRESSURE_PER_DIFFICULTY: 60,

  PRESSURE_BONUS_BASE: 150,
  PRESSURE_BONUS_PER_DIFFICULTY: 75,

  // ✅ deterministic raider pay (matches raider.killReward=40)
  KILL_PAY_BASE: 40,
};

export function getContractStage(scene) {
  // ✅ preferred: global stage state
  if (StageState?.stageIndex != null) return StageState.stageIndex;

  // fallback if you ever run without StageState wired
  if (!scene.contractStage) scene.contractStage = 1;
  return scene.contractStage;
}

export function estimatePressureContract(scene, difficulty = 1) {
  const stage = getContractStage(scene);

  const spawners = PRESSURE_CONTRACT.SPAWNERS_BY_DIFFICULTY[difficulty] ?? 1;
  const quotaPerSpawner =
    PRESSURE_CONTRACT.BASE_QUOTA_PER_SPAWNER + Math.max(0, stage - 1);

  const totalKills = spawners * quotaPerSpawner;

  const cost = calcContractCost(scene, "PRESSURE", difficulty);
  const bonus = calcPressureBonus(scene, difficulty);

  const killPay = CONTRACT_ECON.KILL_PAY_BASE;
  const killTotal = totalKills * killPay;

  const gross = killTotal + bonus;
  const net = gross - cost;

  return { stage, spawners, quotaPerSpawner, totalKills, killPay, killTotal, bonus, cost, gross, net };
}

export function removeFromArray(arr, obj) {
  if (!Array.isArray(arr)) return;
  const i = arr.indexOf(obj);
  if (i !== -1) arr.splice(i, 1);
}

export function calcStageScaled(value, stage, mult) {
  const m = 1 + mult * Math.max(0, stage - 1);
  return Math.round(value * m);
}

export function calcContractCost(scene, type, difficulty = 1) {
  const stage = getContractStage(scene);
  const base = CONTRACT_ECON.COST_BASE[type] ?? 0;

  let raw = base;
  if (type === "PRESSURE") raw = base + CONTRACT_ECON.PRESSURE_PER_DIFFICULTY * Math.max(1, difficulty);

  return calcStageScaled(raw, stage, CONTRACT_ECON.STAGE_MULT);
}

export function calcPressureBonus(scene, difficulty = 1) {
  const stage = getContractStage(scene);
  const raw =
    CONTRACT_ECON.PRESSURE_BONUS_BASE +
    CONTRACT_ECON.PRESSURE_BONUS_PER_DIFFICULTY * Math.max(1, difficulty);

  return calcStageScaled(raw, stage, CONTRACT_ECON.STAGE_MULT);
}

export const RESOURCE_PARCEL = {
  // how much water "spots" to scatter (percent of tiles)
  WATER_SPOT_PCT: 0.06, // 6%
  // min distance from parcel edge to place water so you don’t create open-water borders
  WATER_EDGE_BUFFER: 2,
};
