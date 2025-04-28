// navmeshUpdater.js
import { SQUARESIZE } from './constants.js';
import { Map } from './map.js';
import jsastar from "javascript-astar";
import Vector2 from "./lib/navmesh/math/vector-2";
import { NavMesh } from './lib/navmesh/navmesh.js';
import { buildPolysFromGridMap } from './lib/navmesh/map-parsers/build-polys-from-grid-map.js';
import NavPoly from './lib/navmesh/navpoly.js';
import Polygon from './lib/navmesh/math/polygon.js';

export class NavMeshUpdater {
    constructor(navMesh, scene) {
        this.navMesh = navMesh;
        this.scene = scene;
        this.debugGraphics = [];
        this.debugEnabled = false;

        this._setupToggleKey();
    }

    _setupToggleKey() {
        this.scene.input.keyboard.on('keydown-M', () => {
            this.debugEnabled = !this.debugEnabled;
            if (this.debugEnabled) {
                this.drawDebug();
            } else {
                this.clearDebug();
            }
        });
    }

    drawDebug() {
        this.clearDebug();
    
        const drawnPortals = new Set(); // Prevent double-drawing of portals
    
        for (const polygon of this.navMesh.navPolygons) {
            const graphics = this.scene.add.graphics();
            graphics.lineStyle(1, 0xffffff, 0.4);
            graphics.fillStyle(0x00ff00, 0.2);
            graphics.setDepth(100);
    
            // Draw polygon shape
            const [first, ...rest] = polygon.polygon.points;
            graphics.beginPath();
            graphics.moveTo(first.x, first.y);
            for (const point of rest) {
                graphics.lineTo(point.x, point.y);
            }
            graphics.lineTo(first.x, first.y);
            graphics.strokePath();
            graphics.fillPath();
    
            this.debugGraphics.push(graphics);
    
            // --- Draw portals (black thick lines) ---
            for (const portal of polygon.portals) {
                const key = `${portal.start.x},${portal.start.y}-${portal.end.x},${portal.end.y}`;
                const reverseKey = `${portal.end.x},${portal.end.y}-${portal.start.x},${portal.start.y}`;
                if (drawnPortals.has(key) || drawnPortals.has(reverseKey)) continue;
    
                const portalGraphics = this.scene.add.graphics();
                portalGraphics.lineStyle(3, 0x000000, 1); // Thick black line
                portalGraphics.beginPath();
                portalGraphics.moveTo(portal.start.x, portal.start.y);
                portalGraphics.lineTo(portal.end.x, portal.end.y);
                portalGraphics.strokePath();
                portalGraphics.setDepth(101);
    
                drawnPortals.add(key);
                this.debugGraphics.push(portalGraphics);
            }
    
            // --- Draw centroid neighbor connections ---
            for (const neighbor of polygon.neighbors) {
                if (!neighbor) continue;
                
                const neighborGraphics = this.scene.add.graphics();
                neighborGraphics.lineStyle(2, 0x000000, 0.4); // Yellow faint line for neighbor connection
                neighborGraphics.beginPath();
                neighborGraphics.moveTo(polygon.centroid.x, polygon.centroid.y);
                neighborGraphics.lineTo(neighbor.centroid.x, neighbor.centroid.y);
                neighborGraphics.strokePath();
                neighborGraphics.setDepth(99);
    
                this.debugGraphics.push(neighborGraphics);
            }
        }
    }
    
    
    

    clearDebug() {
        for (const g of this.debugGraphics) {
            g.destroy();
        }
        this.debugGraphics = [];
    }

    /**
     * Block a single tile.
     */
    blockTile(x, y) {
        this.blockTiles([{x: x, y: y}]);
    }

    /**
     * Block multiple tiles at once (for multi-tile walls).
     */
    blockTiles(tileCoords) {
        const tileRects = tileCoords.map(({ x, y }) => ({
            x: x * SQUARESIZE,
            y: y * SQUARESIZE,
            w: SQUARESIZE,
            h: SQUARESIZE
        }));
    
        // Step 1: Find affected polygons
        const affectedPolys = Map.navMesh.navPolygons.filter(poly =>
            tileRects.some(tileRect => this._polygonIntersectsRect(poly.polygon.points, tileRect))
        );
    
        // Step 2: Gather unaffected neighbors
        const neighborPolys = new Set();
        for (const poly of affectedPolys) {
            for (const neighbor of poly.neighbors) {
                if (!affectedPolys.includes(neighbor)) {
                    neighborPolys.add(neighbor);
                }
            }
        }
    
        // Step 3: Find bounds
        const bounds = this._getPolygonsBounds(affectedPolys.map(p => p.polygon.points));
    
        // Step 4: Build local nav grid
        const gridWidth = Math.ceil(bounds.w / SQUARESIZE);
        const gridHeight = Math.ceil(bounds.h / SQUARESIZE);
        const navGrid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(1));
    
        // Step 5: Mark blocked tiles in nav grid
        for (const { x, y } of tileCoords) {
            const localX = Math.floor((x * SQUARESIZE - bounds.x) / SQUARESIZE);
            const localY = Math.floor((y * SQUARESIZE - bounds.y) / SQUARESIZE);
            if (navGrid[localY] && navGrid[localY][localX] !== undefined) {
                navGrid[localY][localX] = 0; // 0 = blocked
            }
        }
    
        // Step 6: Create new polys from nav grid (simple rectangles)
        const newPolygons = this._extractPolygonsFromGrid(navGrid, bounds.x, bounds.y);
    
        // Step 7: Build NavPoly instances
        const newNavPolys = newPolygons.map((polyPoints, i) => {
            const polygon = new Polygon(polyPoints.map(p => new Vector2(p.x, p.y)));
            return new NavPoly(Map.navMesh.navPolygons.length + i, polygon);
        });
    
        // Step 9: Remove old polys
        for (const oldPoly of affectedPolys) {
            Map.navMesh.removePolygon(oldPoly);
        }
    
        // Step 10: Add new polys
        for (const newPoly of newNavPolys) {
            Map.navMesh.navPolygons.push(newPoly);
        }

        const allPolys = newNavPolys.concat(Array.from(neighborPolys));
        Map.navMesh.calculateNewNeighbors(allPolys);
    
        if (this.debugEnabled) this.drawDebug();
    }

    _getPolygonsBounds(allPoints) {
        const xs = allPoints.flat().map(p => p.x);
        const ys = allPoints.flat().map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    
    _extractPolygonsFromGrid(grid, originX, originY) {

        // Create a new navmesh instance (locally, not touching your main one)
        const tempNavMesh = new NavMesh(buildPolysFromGridMap(grid, SQUARESIZE, SQUARESIZE, undefined, 0));
    
        // 2. Extract polygons from the temp navmesh and shift back into world coordinates
        const worldPolys = [];
    
        for (const navPoly of tempNavMesh.navPolygons) {
            const shiftedPoints = navPoly.polygon.points.map(p => ({
                x: p.x + originX,
                y: p.y + originY
            }));
    
            worldPolys.push(shiftedPoints);
        }
    
        return worldPolys;
    }
    
    _reconnectPolygons(newPolys, oldNeighbors) {
        // Connect new polys to each other
        for (let i = 0; i < newPolys.length; i++) {
            for (let j = i + 1; j < newPolys.length; j++) {
                if (newPolys[i].polygon.sharesEdge(newPolys[j].polygon)) {
                    newPolys[i].neighbors.push(newPolys[j]);
                    newPolys[j].neighbors.push(newPolys[i]);
                }
            }
        }
        // Connect new polys to old neighbors
        for (const neighbor of oldNeighbors) {
            for (const newPoly of newPolys) {
                if (neighbor.polygon.sharesEdge(newPoly.polygon)) {
                    neighbor.neighbors.push(newPoly);
                    newPoly.neighbors.push(neighbor);
                }
            }
        }
    }    

    _polygonIntersectsRect(points, rect) {
        const polyBounds = this._getPolygonBounds(points);
    
        return !(
            polyBounds.x + polyBounds.w <= rect.x ||    // polygon is left of tile
            polyBounds.x >= rect.x + rect.w ||          // polygon is right of tile
            polyBounds.y + polyBounds.h <= rect.y ||    // polygon is above tile
            polyBounds.y >= rect.y + rect.h             // polygon is below tile
        );
    }    

    _getPolygonBounds(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY
        };
    }

    _splitRectAround(bounds, hole) {
        const results = [];

        // Top
        if (hole.y > bounds.y) {
            results.push({
                x: bounds.x,
                y: bounds.y,
                w: bounds.w,
                h: hole.y - bounds.y
            });
        }

        // Bottom
        if (hole.y + hole.h < bounds.y + bounds.h) {
            results.push({
                x: bounds.x,
                y: hole.y + hole.h,
                w: bounds.w,
                h: (bounds.y + bounds.h) - (hole.y + hole.h)
            });
        }

        // Left
        if (hole.x > bounds.x) {
            results.push({
                x: bounds.x,
                y: Math.max(bounds.y, hole.y),
                w: hole.x - bounds.x,
                h: Math.min(bounds.h, hole.h)
            });
        }

        // Right
        if (hole.x + hole.w < bounds.x + bounds.w) {
            results.push({
                x: hole.x + hole.w,
                y: Math.max(bounds.y, hole.y),
                w: (bounds.x + bounds.w) - (hole.x + hole.w),
                h: Math.min(bounds.h, hole.h)
            });
        }

        return results.filter(r => r.w > 0 && r.h > 0);
    }

    setupAddAndRemove(){
        Map.navMesh.addPolygon = function (points) {
            const id = this.navPolygons.length;
        
            // Create polygon from raw points
            const polygon = new Polygon(points.map(p => new Vector2(p.x, p.y))); // assumes points are in {x,y} form
        
            // Create a new NavPoly from that polygon
            const navPoly = new NavPoly(id, polygon);
        
            // Add to navPolygons list
            this.navPolygons.push(navPoly);

            return navPoly
        };
        
        Map.navMesh.removePolygon = function(poly) {
            // Remove shared references from neighbors
            for (const neighbor of poly.neighbors) {
                // Remove this polygon from the neighbor's neighbor list
                neighbor.neighbors = neighbor.neighbors.filter(n => n !== poly);
        
                // Remove shared portal between poly and neighbor
                neighbor.portals = neighbor.portals.filter(portal => {
                    // Check if this portal is shared with the poly we're removing
                    return !poly.portals.some(pPortal =>
                        (pPortal.start.x === portal.start.x && pPortal.start.y === portal.start.y &&
                            pPortal.end.x === portal.end.x && pPortal.end.y === portal.end.y) ||
                        (pPortal.end.x === portal.start.x && pPortal.end.y === portal.start.y &&
                            pPortal.start.x === portal.end.x && pPortal.start.y === portal.end.y)
                    );
                });
            }
        
            // Clear the polygon's own data
            poly.neighbors = [];
            poly.portals = [];
        
            // Remove polygon from navPolygons list
            const index = this.navPolygons.findIndex(p => p === poly);
            if (index !== -1) {
                this.navPolygons.splice(index, 1);
            }
        };
            
    }

    static calculateCentroid(points){
        const centroid = new Vector2(0, 0);
        const length = points.length;
        points.forEach((p) => centroid.add(p));
        centroid.x /= length;
        centroid.y /= length;
        return centroid;
    }

    static calculateRadius(points, centroid) {
        let boundingRadius = 0;
        for (const point of points) {
            const d = centroid.distance(point);
            if (d > boundingRadius)
                boundingRadius = d;
        }
        return boundingRadius;
    }
}



