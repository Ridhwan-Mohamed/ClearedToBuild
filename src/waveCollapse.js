import { TILE_TYPES } from "./constants";
import { Noise } from 'noisejs'; // Ensure you have noisejs for Perlin noise

export class WaveCollapse {
    static noise = new Noise(Math.random()); // Initialize Perlin noise

    static rules = {
        water: ["dirt", "water", "grass"], 
        dirt: ["grass", "dirt", "water"], 
        grass: ["water", "dirt", "grass"],
        pine: ["grass"]
    };

    static generateGrid(width, height) {
        const noise = new Noise(Math.random()); // Re-seed each time
    
        let grid = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => Object.keys(this.rules))
        );
    
        // ✅ Pass noise in to use it for seeding
        this.seedTerrain(grid, width, height, noise);
    
        return this.collapseWave(grid);
    }
    
    static seedTerrain(grid, width, height, noise) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let noiseValue = noise.simplex2(x / 50, y / 50);
                if (noiseValue < 0) {
                    grid[y][x] = ["water"];
                } else if (noiseValue < 0.3) {
                    grid[y][x] = ["dirt"];
                } else {
                    grid[y][x] = ["grass"];
                }
            }
        }
    }
    

    static collapseWave(grid) {
        let width = grid[0].length;
        let height = grid.length;

        while (!this.isFullyCollapsed(grid)) {
            let [x, y] = this.findLowestEntropy(grid);
            if (x === -1 || y === -1) break;

            // Bias selection: Favor majority tile in neighbors
            let chosenTile = this.getBiasedTile(grid, x, y);
            
            grid[y][x] = [chosenTile];

            this.propagate(grid, x, y, chosenTile, width, height);
        }

        return this.convertToGridValues(grid);
    }

    static getBiasedTile(grid, x, y) {
        let neighbors = this.getNeighbors(grid, x, y);
        let tileCounts = {};

        for (let tile of neighbors) {
            if (!tileCounts[tile]) tileCounts[tile] = 0;
            tileCounts[tile]++;
        }

        let maxTile = Object.keys(tileCounts).reduce((a, b) =>
            tileCounts[a] > tileCounts[b] ? a : b
        );

        return Math.random() < 0.75 ? maxTile : Phaser.Utils.Array.GetRandom(grid[y][x]); // Bias to natural spread
    }

    static propagate(grid, x, y, tile, width, height) {
        let possibleTiles = this.rules[tile] || [];

        let neighbors = this.getNeighborPositions(x, y, width, height);

        for (let [nx, ny] of neighbors) {
            let currentOptions = grid[ny][nx];

            let newOptions = currentOptions.filter(t => possibleTiles.includes(t));

            if (newOptions.length === 0) {
                newOptions = [Phaser.Utils.Array.GetRandom(possibleTiles)];
            }

            grid[ny][nx] = newOptions;
        }
    }

    static getNeighbors(grid, x, y) {
        let neighbors = [];
        let positions = this.getNeighborPositions(x, y, grid[0].length, grid.length);
        for (let [nx, ny] of positions) {
            neighbors.push(grid[ny][nx][0]); 
        }
        return neighbors;
    }

    static getNeighborPositions(x, y, width, height) {
        return [
            [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y], 
            [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]
        ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height);
    }

    static findLowestEntropy(grid) {
        let lowestEntropy = Infinity;
        let lowestCell = [-1, -1];

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                let entropy = grid[y][x].length;
                if (entropy > 1 && entropy < lowestEntropy) {
                    lowestEntropy = entropy;
                    lowestCell = [x, y];
                }
            }
        }
        return lowestCell;
    }

    static isFullyCollapsed(grid) {
        return grid.every(row => row.every(cell => cell.length === 1));
    }

    static convertToGridValues(grid) {
        return grid.map(row =>
            row.map(cell => TILE_TYPES[cell[0]].grid)
        );
    }
}
