// navmeshUpdater.js
import { SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from '../../constants.js';
import { Map } from '../../map.js';
import Vector2 from "./math/vector-2.js";
import { NavMesh } from './navmesh.js';
import { buildPolysFromGridMap } from './map-parsers/build-polys-from-grid-map.js';
import NavPoly from './navpoly.js';
import Polygon from './math/polygon.js';

export class NavMeshUpdater {
    constructor(navMesh, scene, opts) {
        this.navMesh = navMesh;
        this.scene = scene;
        this.debugGraphics = [];
        this.debugEnabled = false;

        this._toggleKey = opts.toggleKey ?? "M";
        this._fillColor = opts.fillColor ?? 0x00ff00;
        this._fillAlpha = opts.fillAlpha ?? 0.2;
        this._lineColor = opts.lineColor ?? 0xffffff;
        this._lineAlpha = opts.lineAlpha ?? 0.4;

        this._setupToggleKey();
    }

    _setupToggleKey() {
        this._onToggle = () => {
            this.debugEnabled = !this.debugEnabled;
            if (this.debugEnabled) this.drawDebug();
            else this.clearDebug();
        };
        this.scene.input.keyboard.on(`keydown-${this._toggleKey}`, this._onToggle);
    }

    destroy() {
        // remove key listener
        if (this._onToggle) {
            this.scene.input.keyboard.off(`keydown-${this._toggleKey}`, this._onToggle);
            this._onToggle = null;
        }
        // kill any drawn graphics
        this.clearDebug();
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
                if(point.x < 0 || point.x > WORLD_DIMENSIONX*SQUARESIZE || 
                    point.y < 0 || point.y > WORLD_DIMENSIONY*SQUARESIZE
                ) console.log(point)
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
        this.scene.uiCamera.ignore(this.debugGraphics);
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
        return this.blockTiles([{ x, y }]);
    }

    /**
     * Block multiple tiles at once (for multi-tile walls).
     */
    blockTiles(tileCoords, addTiles = false) {
        const tileRects = tileCoords.map(({ x, y }) => ({
            x: x * SQUARESIZE,
            y: y * SQUARESIZE,
            w: SQUARESIZE,
            h: SQUARESIZE
        }));
    
        // Step 1: Find affected polygons
        let affectedPolys;
        if(addTiles){
            affectedPolys = this.navMesh.navPolygons.filter(poly =>
                tileRects.some(tileRect => this._polygonIsAdjacentToRect(poly.polygon.points, tileRect))
            );            
        }else{
            affectedPolys = this.navMesh.navPolygons.filter(poly =>
                tileRects.some(tileRect => this._polygonIntersectsRect(poly.polygon.points, tileRect))
            );
        }
        const removedPolyIds = affectedPolys.map(p => p.id);

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
        const navGrid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0)); // All blocked initially        
    
        // Step 5: Mark blocked tiles in nav grid
        for (const poly of affectedPolys) {
            const polyPoints = poly.polygon.points;
        
            const minTileX = Math.floor((Math.min(...polyPoints.map(p => p.x)) - bounds.x) / SQUARESIZE);
            const maxTileX = Math.floor((Math.max(...polyPoints.map(p => p.x)) - bounds.x) / SQUARESIZE);
            const minTileY = Math.floor((Math.min(...polyPoints.map(p => p.y)) - bounds.y) / SQUARESIZE);
            const maxTileY = Math.floor((Math.max(...polyPoints.map(p => p.y)) - bounds.y) / SQUARESIZE);
        
            for (let ty = minTileY; ty <= maxTileY; ty++) {
                for (let tx = minTileX; tx <= maxTileX; tx++) {
                    const worldX = bounds.x + tx * SQUARESIZE + SQUARESIZE / 2;
                    const worldY = bounds.y + ty * SQUARESIZE + SQUARESIZE / 2;
                    if (poly.contains({ x: worldX, y: worldY })) {
                        navGrid[ty][tx] = 1;
                    }
                }
            }
        }
        //mark tile coords as 0
        const TILE_COORD_VAL = addTiles? 1 : 0;
        for (const { x, y } of tileCoords) {
            const localX = Math.floor((x * SQUARESIZE - bounds.x) / SQUARESIZE);
            const localY = Math.floor((y * SQUARESIZE - bounds.y) / SQUARESIZE);
            if (navGrid[localY] && navGrid[localY][localX] !== undefined) {
                navGrid[localY][localX] = TILE_COORD_VAL;
            }
        }
    
        // Step 6: Create new polys from nav grid (simple rectangles)
        const newPolygons = this._extractPolygonsFromGrid(navGrid, bounds.x, bounds.y);
    
        // Step 7: Build NavPoly instances
        const newNavPolys = newPolygons.map((polyPoints, i) => {
            const polygon = new Polygon(polyPoints.map(p => new Vector2(p.x, p.y)));
            const id = this.navMesh._nextPolyId++;
            return new NavPoly(id, polygon);
        });
        const addedPolyIds = newNavPolys.map(p => p.id);
        const neighborPolyIds = Array.from(neighborPolys).map(p => p.id);

        // Step 9: Remove old polys
        for (const oldPoly of affectedPolys) {
            this.navMesh.removePolygon(oldPoly);
        }
    
        // Step 10: Add new polys
        for (const newPoly of newNavPolys) {
            this.navMesh.addPolygon(newPoly);
        }

        const allPolys = newNavPolys.concat(Array.from(neighborPolys));
        this.navMesh.calculateNewNeighbors(allPolys);
        this.navMesh.rebuild()
    
        if (this.debugEnabled) this.drawDebug();
        return { removedPolyIds, addedPolyIds, neighborPolyIds };
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
        this.navMesh.addPolygon = function (navPoly) {
            const id = this.navPolygons.length;
            // Add to navPolygons list
            this.navPolygons.push(navPoly);
        };
        
        this.navMesh.removePolygon = function(poly) {
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

    _polygonIsAdjacentToRect(points, rect) {
        const polyBounds = this._getPolygonBounds(points);
    
        const horizontallyAdjacent =
            (polyBounds.x + polyBounds.w === rect.x || polyBounds.x === rect.x + rect.w) &&
            !(polyBounds.y + polyBounds.h <= rect.y || polyBounds.y >= rect.y + rect.h);
    
        const verticallyAdjacent =
            (polyBounds.y + polyBounds.h === rect.y || polyBounds.y === rect.y + rect.h) &&
            !(polyBounds.x + polyBounds.w <= rect.x || polyBounds.x >= rect.x + rect.w);
    
        return horizontallyAdjacent || verticallyAdjacent;
    }
    
}



