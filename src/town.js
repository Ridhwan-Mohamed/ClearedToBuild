import { SQUARESIZE, TILE_MAP, TILE_TYPES, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "./constants";
import { Map } from "./map";
import { Player } from "./Player";
import { Teams } from "./Teams";

export var playerDict = {}
export var townBounds = {}

export function clearPlayerDict(){
    playerDict = {}
}

export var buildingArray = []

export function clearBuildingArray(){
    buildingArray.length = 0;
}

export const turretTeams = {}

export function setupTownBoundsToggle(scene) {
    let boundsGroup = null;
    let showing = false;
  
    // Listen for "T" key
    const keyT = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    keyT.on('down', () => {
      if (showing) {
        // Remove all drawn bounds
        boundsGroup.clear(true, true);
        boundsGroup = null;
        showing = false;
      } else {
        // Draw bounds for each team
        boundsGroup = scene.add.group();
        for (const team in townBounds) {
          const { minx, miny, maxx, maxy } = townBounds[team];
          const rect = scene.add.rectangle(
            minx * SQUARESIZE,
            miny * SQUARESIZE,
            (maxx - minx + 1) * SQUARESIZE,
            (maxy - miny + 1) * SQUARESIZE,
            0x00ff00,
            0.2
          )
          .setOrigin(0)
          .setDepth(500);
          boundsGroup.add(rect);
        }
        showing = true;
      }
    });
  }

export function generateTown(grid, buildings, teamNumber, startX = -1, startY = -1, navGrid = Map.navGrid) {
    grid = structuredClone(grid);
    let gridWidth = grid[0].length;
    let gridHeight = grid.length;
    // Step 1: Start with a random town seed within grid bounds
    let townCenterX;
    let townCenterY;
    if(teamNumber == 1 && startX != -1 && startY != -1){
        if(!canPlaceBuildingAtAnyCorner(grid, startX, startY, buildings[0]).success) return;
        townCenterX = startX;
        townCenterY = startY;
    }
    else{
        // loop until valid start location
        townCenterX = Phaser.Math.RND.between(1, gridWidth - buildings[0].lenX);  // Avoid edges if needed
        townCenterY = Phaser.Math.RND.between(1, gridHeight - buildings[0].lenY);
        while(!canPlaceBuildingAtAnyCorner(grid, townCenterX, townCenterY, buildings[0]).success){
            // loop until valid start location
            townCenterX = Phaser.Math.RND.between(1, gridWidth - buildings[0].lenX);  // Avoid edges if needed
            townCenterY = Phaser.Math.RND.between(1, gridHeight - buildings[0].lenY);
        }
    }
    const firstIndex = buildingArray.length;
    placeBuilding(grid, townCenterX, townCenterY, buildings[0], navGrid);
    const center = getValidCenterTile(townCenterX, townCenterY, buildings[0])
    Teams.teamLists[`${teamNumber}`].center[0] = center.tx
    Teams.teamLists[`${teamNumber}`].center[1] = center.ty
    if(buildings[0] == TILE_TYPES.turret) turretTeams[`${townCenterX},${townCenterY}`] = teamNumber;

    let outerRoads = [];
    outerRoads.push(expandRoads(grid, townCenterX, townCenterY, buildings[0])[1]); // Step 2: Expand roads around seed


    // // Step 3: Place remaining buildings
    while(outerRoads.length && buildings.length){
        let outerRoadsSucesss = false;
        for(let i = 1; i < buildings.length; i++){
            let curBuilding = buildings[i]
            for(let j = 0; j < outerRoads[0].length; j++){
                let spot = Phaser.Utils.Array.GetRandom(outerRoads[0])
                let canFit = canPlaceBuildingAtAnyCorner(grid, spot[0], spot[1], curBuilding)
                if(canFit.success){
                    outerRoads[0] = outerRoads[0].filter(([x, y]) => x !== spot[0] || y !== spot[1]);
                    if(curBuilding == TILE_TYPES.turret) turretTeams[`${spot[0]},${spot[1]}`] = teamNumber;
                    placeBuilding(grid, canFit.x, canFit.y, curBuilding, navGrid);
                    buildings.splice(i, 1); 
                    let [roads, newOuterRoads] = expandRoads(grid, canFit.x, canFit.y, curBuilding);
                    outerRoads.push(newOuterRoads); // Add new surrounding roads
                    if(curBuilding == TILE_TYPES.house1 || curBuilding == TILE_TYPES.house2) placePlayers(roads, teamNumber);
                    outerRoadsSucesss = true;
                    break; // Move to next building after placing
                }
            }
        }
        if(!outerRoadsSucesss) outerRoads.splice(0,1)
    }

    const myBuildings = buildingArray.slice(firstIndex);
    // Compute bounding box from all placed buildings
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [bx, by, building] of myBuildings) {
    // building.lenX, lenY are its footprint dimensions
        minx = Math.min(minx, bx);
        miny = Math.min(miny, by);
        maxx = Math.max(maxx, bx + building.lenX - 1);
        maxy = Math.max(maxy, by + building.lenY - 1);
    }
    minx = Math.max(0, minx - 1);
    miny = Math.max(0, miny - 1);
    maxx = Math.min(gridWidth - 1, maxx + 1);
    maxy = Math.min(gridHeight - 1, maxy + 1); //extend by 1 in all directions
    // Store in the global townBounds dictionary under this team number
    townBounds[teamNumber] = { minx, miny, maxx, maxy };

    return grid;
}

export function placeNeutralPlayers(count) {
    let placed = 0;
    while (placed < count) {
      const x = Phaser.Math.Between(0, WORLD_DIMENSIONX - 1);
      const y = Phaser.Math.Between(0, WORLD_DIMENSIONY - 1);
  
      // Must be walkable
      if (Map.navGrid[y][x] !== 1) continue;
  
      // Skip if inside any town’s rectangle
      let insideTown = false;
      for (const team in townBounds) {
        const b = townBounds[team];
        if (x >= b.minx && x <= b.maxx && y >= b.miny && y <= b.maxy) {
          insideTown = true;
          break;
        }
      }
      if (insideTown) continue;
  
      // Place one neutral (team 0) here
      playerDict[`${x},${y}`] = 0;
      placed++;
    }
  }

// Function to place a building
function placeBuilding(grid, x, y, building, navGrid) {
    buildingArray.push([x,y,building])
    for (let i = 0; i < building.lenY; i++) {
        for (let j = 0; j < building.lenX; j++) {
            grid[y + i][x + j] = [35,building.grid]; // Mark as building
            navGrid[y + i][x + j] = 0
        }
    }
}

function placePlayers(roads, teamNumber){
    for(let i = 0; i < 2; i++){
        // Convert set to array and select a random spot
        let spotStr = Phaser.Utils.Array.GetRandom(Array.from(roads));
        let [x, y] = spotStr.split(',').map(Number);

        // Use as key
        playerDict[`${x},${y}`] = teamNumber;

        // Remove from the set
        roads.delete(spotStr);
    }
}

function expandRoads(grid, startX, startY, building) {
    let roadValue = 35;
    let roadTiles = new Set();
    let surroundingTiles = new Set();

    // Step 1: Place roads in a full rectangle around the building
    for (let y = startY - 1; y <= startY + building.lenY; y++) {
        for (let x = startX - 1; x <= startX + building.lenX; x++) {
            if (
                x >= 0 && y >= 0 && x < grid[0].length && y < grid.length &&
                !(x >= startX && x < startX + building.lenX && y >= startY && y < startY + building.lenY) // Exclude the building itself
            ) {
                if (TILE_MAP(grid[y][x]) != "water") { // Only replace empty tiles
                    grid[y][x] = roadValue;
                    roadTiles.add(`${x},${y}`);
                }
            }
        }
    }

    // Step 2: Find surrounding tiles **outside the road area**
    for (let tile of roadTiles) {
        let [roadX, roadY] = tile.split(',').map(Number);
        
        let possibleSurrounding = [
            [roadX - 1, roadY], [roadX + 1, roadY], // Left & Right
            [roadX, roadY - 1], [roadX, roadY + 1], // Above & Below
            [roadX - 1, roadY - 1], [roadX + 1, roadY - 1], // Top Corners
            [roadX - 1, roadY + 1], [roadX + 1, roadY + 1]  // Bottom Corners
        ];

        for (let [sx, sy] of possibleSurrounding) {
            if (
                sx >= 0 && sy >= 0 && sx < grid[0].length && sy < grid.length &&
                !roadTiles.has(`${sx},${sy}`) // Ensure it's NOT a road tile
            ) {
                surroundingTiles.add(`${sx},${sy}`);
                // grid[sy][sx] = surroundingValue; // Mark surrounding area
            }
        }
    }

    return [roadTiles, Array.from(surroundingTiles).map(coord => coord.split(',').map(Number))];
}

function canPlaceBuildingAtAnyCorner(grid, x, y, building) {
    let width = building.lenX;
    let height = building.lenY;
    let gridWidth = grid[0].length;
    let gridHeight = grid.length;

    let possibleOrigins = [
        { ox: x, oy: y, name: "Top-Left" },  // Treat (x, y) as top-left
        { ox: x - width + 1, oy: y, name: "Top-Right" },  // Treat (x, y) as top-right
        { ox: x, oy: y - height + 1, name: "Bottom-Left" },  // Treat (x, y) as bottom-left
        { ox: x - width + 1, oy: y - height + 1, name: "Bottom-Right" }  // Treat (x, y) as bottom-right
    ];

    for (let { ox, oy, name } of possibleOrigins) {
        if (ox < 0 || oy < 0 || ox + width > gridWidth || oy + height > gridHeight) continue; // Out of bounds

        let canFit = true;
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                let tile_type;
                if(Array.isArray(grid[oy + dy][ox + dx])){
                    tile_type = TILE_MAP(grid[oy + dy][ox + dx][1])
                }
                else{
                    tile_type = TILE_MAP(grid[oy + dy][ox + dx])
                }
                if (tile_type == "road" || TILE_TYPES[tile_type].block) { 
                    canFit = false;
                    break;
                }
            }
            if (!canFit) break;
        }

        if (canFit) {
            return { success: true, origin: name, x: ox, y: oy };
        }
    }

    return { success: false };
}


function getValidCenterTile(startX,startY,type){

    // 1. Build list of candidate tiles with distances
    let candidates = [];
    for (let dy = -1; dy <= type.lenY; dy++) {
        for (let dx = -1; dx <= type.lenX; dx++) {
            const tx = startX + dx;
            const ty = startY + dy;

            const isInsideBlock = dx >= 0 && dx < type.lenX && dy >= 0 && dy < type.lenY;
            if (isInsideBlock) continue;

            if (tx < 0 || ty < 0 || ty >= Map.navGrid.length || tx >= Map.navGrid[0].length) continue;
            if (!Map.navGrid[ty][tx]) continue; // Not walkable

            candidates.push({ tx, ty });
        }
    }

    return Phaser.Utils.Array.GetRandom(candidates)
}
