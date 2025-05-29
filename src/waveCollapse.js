import { TILE_TYPES } from "./constants";
import { Noise } from 'noisejs'; // Ensure you have noisejs for Perlin noise
import { Map } from "./map";
export class WaveCollapse {
    static noise = new Noise(Math.random()); // Initialize Perlin noise

    static rules = {
        water: ["dirt", "water", "grass"], 
        dirt: ["grass", "dirt", "water"], 
        grass: ["water", "dirt", "grass"],
        pine: ["grass"]
    };

    static generateGrid(width, height, ratio = 0.8) {
        const noise = new Noise(Math.random()); // Re-seed each time
    
        let grid = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => Object.keys(this.rules))
        );
    
        this.seedTerrain(grid, width, height, noise, ratio);
        grid = this.convertToGridValues(grid)
        this.scatterOnGrass(grid)
        this.scatterOnGrass(grid, 10, TILE_TYPES.grassBerry.grid)
        return grid;
    }

    static seedTerrain(grid, width, height, noise, ratio = 0.8) {
        // Ratio = [0.3 ... 0.8] → map to waterThreshold (lower = more water)
        const waterThreshold = 1 - ratio; // e.g., 0.3 → 0.8 water, 0.8 → 0.3 water
    
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let noiseValue = noise.simplex2(x / 50, y / 50);
    
                if (noiseValue < -waterThreshold) {
                    grid[y][x] = ["water"];
                    Map.navGrid[y][x] = 0;
                } else if (noiseValue < 0.3) {
                    grid[y][x] = ["dirt"];
                    Map.navGrid[y][x] = 1;
                } else {
                    grid[y][x] = ["grass"];
                    Map.navGrid[y][x] = 1;
                }
            }
        }
    }

    static scatterOnGrass(grid, count = 50, itemValue = 37) {
        const grassCode = TILE_TYPES.grass.grid;
        const candidates = [];

        // 1. Collect all grass positions
        for (let y = 0; y < grid.length; y++) {
          for (let x = 0; x < grid[y].length; x++) {
            if (grid[y][x] === grassCode) {
              candidates.push({ x, y });
            }
          }
        }
      
        // 2. Shuffle with Fisher–Yates
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
      
        // 3. Overwrite the first `count` candidates
        const placeCount = Math.min(count, candidates.length);
        for (let i = 0; i < placeCount; i++) {
          const { x, y } = candidates[i];
          grid[y][x] = itemValue;
        }
      }
      
    
    static convertToGridValues(grid) {
        return grid.map(row =>
            row.map(cell => TILE_TYPES[cell[0]].grid)
        );
    }


}
