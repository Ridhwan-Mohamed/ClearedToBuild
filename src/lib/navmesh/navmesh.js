import jsastar from "javascript-astar";
import NavPoly from "./navpoly";
import NavGraph from "./navgraph";
import Channel from "./channel";
import { angleDifference, areCollinear, projectPointToEdge } from "./utils";
import Vector2 from "./math/vector-2";
import Line from "./math/line";
import Polygon from "./math/polygon";
/**
 * The `NavMesh` class is the workhorse that represents a navigation mesh built from a series of
 * polygons. Once built, the mesh can be asked for a path from one point to another point. Some
 * internal terminology usage:
 * - neighbor: a polygon that shares part of an edge with another polygon
 * - portal: when two neighbor's have edges that overlap, the portal is the overlapping line segment
 * - channel: the path of polygons from starting point to end point
 * - pull the string: run the funnel algorithm on the channel so that the path hugs the edges of the
 *   channel. Equivalent to having a string snaking through a hallway and then pulling it taut.
 */
export class NavMesh {
    /**
     * @param meshPolygonPoints Array where each element is an array of point-like objects that
     * defines a polygon.
     * @param meshShrinkAmount The amount (in pixels) that the navmesh has been shrunk around
     * obstacles (a.k.a the amount obstacles have been expanded).
     */
    constructor(meshPolygonPoints, meshShrinkAmount = 0) {
        this.meshShrinkAmount = meshShrinkAmount;
        // Convert the PolyPoints[] into NavPoly instances.
        const newPolys = meshPolygonPoints.map((polyPoints) => {
            const vectors = polyPoints.map((p) => new Vector2(p.x, p.y));
            return new Polygon(vectors);
        });
        this.navPolygons = newPolys.map((polygon, i) => new NavPoly(i, polygon));
        this._syncNextPolyId();
        this.calculateNeighbors();
        // Astar graph of connections between polygons
        this.graph = new NavGraph(this.navPolygons);
    }
    /**
     * Get the NavPolys that are in this navmesh.
     */
    getPolygons() {
        return this.navPolygons;
    }

    getPolygonById(id) {
        for (const p of this.navPolygons) {
            if (p.id === id) return p;
        }
        return null;
    }

    rebuild(){
        if (this.graph) {
            this.graph.destroy();
        }
        this.graph = new NavGraph(this.getPolygons());
    }

    setPolygons(polys){
        this.navPolygons = polys.map((poly, index) => this._coerceToNavPoly(poly, index));
        this._syncNextPolyId();
        this._rebuildAllConnections();
    }

    createPolygon(polyPoints) {
        return this._createNavPoly(polyPoints);
    }

    addPolygon(poly) {
        const [addedPoly] = this.addPolygons([poly]);
        return addedPoly ?? null;
    }

    addPolygons(polys) {
        const incomingPolys = Array.isArray(polys) ? polys : [polys];
        const newNavPolys = incomingPolys
            .filter(Boolean)
            .map((poly) => this._createNavPoly(poly));

        if (!newNavPolys.length) {
            return [];
        }

        this.navPolygons.push(...newNavPolys);
        this._connectPolygonSet(newNavPolys, this.navPolygons);
        this.rebuild();

        return newNavPolys;
    }

    removePolygon(polyOrId) {
        const [removedPoly] = this.removePolygons([polyOrId]);
        return removedPoly ?? null;
    }

    removePolygons(polysOrIds) {
        const targetPolys = this._resolveNavPolys(polysOrIds);
        if (!targetPolys.length) {
            return [];
        }

        const targetSet = new Set(targetPolys);
        for (const poly of targetPolys) {
            this._disconnectPolygon(poly);
        }

        this.navPolygons = this.navPolygons.filter((poly) => !targetSet.has(poly));
        this.rebuild();

        return targetPolys;
    }

    replacePolygons(polysToRemove, polysToAdd, opts = {}) {
        const removedPolys = this._resolveNavPolys(polysToRemove);
        const removedSet = new Set(removedPolys);
        const incomingPolys = Array.isArray(polysToAdd) ? polysToAdd : [polysToAdd];
        const stagedAddedPolys = incomingPolys
            .filter(Boolean)
            .map((poly) => this._createNavPoly(poly));
        const neighborPolys = [];
        const seenNeighbors = new Set();

        for (const poly of removedPolys) {
            for (const neighbor of poly.neighbors || []) {
                if (removedSet.has(neighbor) || seenNeighbors.has(neighbor)) {
                    continue;
                }

                seenNeighbors.add(neighbor);
                neighborPolys.push(neighbor);
            }
        }

        if (removedPolys.length) {
            for (const poly of removedPolys) {
                this._disconnectPolygon(poly);
            }
            this.navPolygons = this.navPolygons.filter((poly) => !removedSet.has(poly));
        }

        const mergedNeighborPolys = [];
        let addedPolys = opts.allowMerge === true
            ? this._mergeReplacementPolygons(stagedAddedPolys, neighborPolys, mergedNeighborPolys, {
                mergeWithActive: opts.mergeWithActive === true
            })
            : stagedAddedPolys;

        if (addedPolys.length) {
            this.navPolygons.push(...addedPolys);
            this._connectPolygonSet(addedPolys, this.navPolygons);
        }

        this.rebuild();

        const removedResult = removedPolys.concat(mergedNeighborPolys);
        let finalAddedPolys = addedPolys;

        if (opts.compactAll === true) {
            const compactResult = this.compactAlignedRectangles();
            if (compactResult.removedPolys.length) {
                const compactRemovedSet = new Set(compactResult.removedPolys);
                removedResult.push(...compactResult.removedPolys);
                finalAddedPolys = finalAddedPolys
                    .filter((poly) => this.navPolygons.includes(poly) && !compactRemovedSet.has(poly))
                    .concat(compactResult.addedPolys);
            }
        }

        const finalNeighborPolys = neighborPolys.filter((poly) =>
            this.navPolygons.includes(poly) && !mergedNeighborPolys.includes(poly)
        );

        return {
            removedPolys: this._uniquePolys(removedResult),
            addedPolys: this._uniquePolys(finalAddedPolys),
            neighborPolys: finalNeighborPolys
        };
    }

    compactAlignedRectangles() {
        const removedPolys = [];
        const addedPolys = [];
        let changed = true;

        while (changed) {
            changed = false;

            mergeLoop:
            for (let i = 0; i < this.navPolygons.length; i++) {
                for (let j = i + 1; j < this.navPolygons.length; j++) {
                    const polyA = this.navPolygons[i];
                    const polyB = this.navPolygons[j];
                    const mergedPoly = this._mergeAxisAlignedRects(polyA, polyB);

                    if (!mergedPoly) {
                        continue;
                    }

                    this._disconnectPolygon(polyA);
                    this._disconnectPolygon(polyB);
                    this.navPolygons = this.navPolygons.filter((poly) => poly !== polyA && poly !== polyB);
                    this.navPolygons.push(mergedPoly);
                    removedPolys.push(polyA, polyB);
                    addedPolys.push(mergedPoly);
                    changed = true;
                    break mergeLoop;
                }
            }
        }

        if (removedPolys.length) {
            this._rebuildAllConnections();
        }

        return {
            removedPolys: this._uniquePolys(removedPolys),
            addedPolys: addedPolys.filter((poly) => this.navPolygons.includes(poly))
        };
    }
    /**
     * Cleanup method to remove references.
     */
    destroy() {
        if (this.graph) {
            this.graph.destroy();
        }
        for (const poly of this.navPolygons)
            poly.destroy();
        this.navPolygons = [];
    }
    /**
     * Find if the given point is within any of the polygons in the mesh.
     * @param point
     */
    isPointInMesh(point) {
        return this.navPolygons.some((navPoly) => navPoly.contains(point));
    }
    /**
     * Find the closest point in the mesh to the given point. If the point is already in the mesh,
     * this will give you that point. If the point is outside of the mesh, this will attempt to
     * project this point into the mesh (up to the given maxAllowableDist). This returns an object
     * with:
     * - distance - from the given point to the mesh
     * - polygon - the one the point is closest to, or null
     * - point - the point inside the mesh, or null
     * @param point
     * @param maxAllowableDist
     */
    findClosestMeshPoint(point, maxAllowableDist = Number.POSITIVE_INFINITY) {
        let minDistance = maxAllowableDist;
        let closestPoly = null;
        let pointOnClosestPoly = null;
        for (const navPoly of this.navPolygons) {
            // If we are inside a poly, we've got the closest.
            if (navPoly.contains(point)) {
                minDistance = 0;
                closestPoly = navPoly;
                pointOnClosestPoly = point;
                break;
            }
            // Is the poly close enough to warrant a more accurate check? Point is definitely outside of
            // the polygon. Distance - Radius is the smallest possible distance to an edge of the poly.
            // This will underestimate distance, but that's perfectly fine.
            const r = navPoly.boundingRadius;
            const d = navPoly.centroid.distance(point);
            if (d - r < minDistance) {
                const result = this.projectPointToPolygon(point, navPoly);
                if (result.distance < minDistance) {
                    minDistance = result.distance;
                    closestPoly = navPoly;
                    pointOnClosestPoly = result.point;
                }
            }
        }
        return { distance: minDistance, polygon: closestPoly, point: pointOnClosestPoly };
    }
    /**
     * Find a path from the start point to the end point using this nav mesh.
     * @param {object} startPoint A point-like object in the form {x, y}
     * @param {object} endPoint A point-like object in the form {x, y}
     * @returns {Vector2[]|null} An array of points if a path is found, or null if no path
     */
    findPath(startPoint, endPoint) {
        const result = this.findPathDetailed(startPoint, endPoint, { includePolys: false });
        return result ? result.points : null;
    }

    /**
     * Like findPath(), but returns the polygon corridor too.
     * @returns {{points: Vector2[], polyIds: number[], startPolyId: number, endPolyId: number} | null}
     */
    findPathDetailed(startPoint, endPoint, opts = { includePolys: true }) {
        let startPoly = null;
        let endPoly = null;
        let startDistance = Number.MAX_VALUE;
        let endDistance = Number.MAX_VALUE;
        let d, r;

        const startVector = new Vector2(startPoint.x, startPoint.y);
        const endVector = new Vector2(endPoint.x, endPoint.y);

        // Find closest poly for start/end (same as your existing logic)
        for (const navPoly of this.navPolygons) {
            r = navPoly.boundingRadius;

            d = navPoly.centroid.distance(startVector);
            if (d <= startDistance && d <= r && navPoly.contains(startVector)) {
            startPoly = navPoly;
            startDistance = d;
            }

            d = navPoly.centroid.distance(endVector);
            if (d <= endDistance && d <= r && navPoly.contains(endVector)) {
            endPoly = navPoly;
            endDistance = d;
            }
        }

        if (!endPoly) return null;

        if (!startPoly) return null;

        if (startPoly === endPoly) {
            const points = [startVector, endVector];
            return {
            points,
            polyIds: opts.includePolys ? [startPoly.id] : [],
            startPolyId: startPoly.id,
            endPolyId: endPoly.id,
            };
        }

        const astarPath = jsastar.astar.search(this.graph, startPoly, endPoly, {
            heuristic: this.graph.navHeuristic,
        });

        if (astarPath.length === 0) return null;

        // jsastar drops first; funnel expects it
        astarPath.unshift(startPoly);

        // --- funnel build (same as your existing code) ---
        const channel = new Channel();
        channel.push(startVector);

        for (let i = 0; i < astarPath.length - 1; i++) {
            const navPolygon = astarPath[i];
            const nextNavPolygon = astarPath[i + 1];

            let portal = null;
            for (let j = 0; j < navPolygon.neighbors.length; j++) {
            if (navPolygon.neighbors[j].id === nextNavPolygon.id) {
                portal = navPolygon.portals[j];
                break;
            }
            }
            if (!portal) throw new Error("Path was supposed to be found, but portal is missing!");

            channel.push(portal.start, portal.end);
        }

        channel.push(endVector);
        channel.stringPull();

        // Clone path excluding duplicates
        let lastPoint = null;
        const phaserPath = [];
        for (const p of channel.path) {
            const newPoint = p.clone();
            if (!lastPoint || !newPoint.equals(lastPoint)) phaserPath.push(newPoint);
            lastPoint = newPoint;
        }

        const polyIds = opts.includePolys ? astarPath.map(p => p.id) : [];

        return {
            points: phaserPath,
            polyIds,
            startPolyId: startPoly.id,
            endPolyId: endPoly.id,
        };
    }

    calculateNewNeighbors(newPolys){
        const scopedPolys = this._resolveNavPolys(newPolys);
        this._connectPolygonSet(scopedPolys, scopedPolys);
    }

    calculateNeighbors() {
        this._clearConnections(this.navPolygons);
        this._connectPolygonSet(this.navPolygons, this.navPolygons);
    }
    // Check two collinear line segments to see if they overlap by sorting the points.
    // Algorithm source: http://stackoverflow.com/a/17152247
    getSegmentOverlap(line1, line2) {
        const points = [
            { line: line1, point: line1.start },
            { line: line1, point: line1.end },
            { line: line2, point: line2.start },
            { line: line2, point: line2.end },
        ];
        points.sort(function (a, b) {
            if (a.point.x < b.point.x)
                return -1;
            else if (a.point.x > b.point.x)
                return 1;
            else {
                if (a.point.y < b.point.y)
                    return -1;
                else if (a.point.y > b.point.y)
                    return 1;
                else
                    return 0;
            }
        });
        // If the first two points in the array come from the same line, no overlap
        const noOverlap = points[0].line === points[1].line;
        // If the two middle points in the array are the same coordinates, then there is a
        // single point of overlap.
        const singlePointOverlap = points[1].point.equals(points[2].point);
        if (noOverlap || singlePointOverlap)
            return null;
        else
            return [points[1].point, points[2].point];
    }
    /**
     * Project a point onto a polygon in the shortest distance possible.
     *
     * @param {Phaser.Point} point The point to project
     * @param {NavPoly} navPoly The navigation polygon to test against
     * @returns {{point: Phaser.Point, distance: number}}
     */
    projectPointToPolygon(point, navPoly) {
        let closestProjection = null;
        let closestDistance = Number.MAX_VALUE;
        for (const edge of navPoly.edges) {
            const projectedPoint = projectPointToEdge(point, edge);
            const d = point.distance(projectedPoint);
            if (closestProjection === null || d < closestDistance) {
                closestDistance = d;
                closestProjection = projectedPoint;
            }
        }
        return { point: closestProjection, distance: closestDistance };
    }

    _rebuildAllConnections() {
        this.calculateNeighbors();
        this.rebuild();
    }

    _syncNextPolyId() {
        let maxId = -1;
        for (const poly of this.navPolygons) {
            if (typeof poly.id === "number" && poly.id > maxId) {
                maxId = poly.id;
            }
        }
        this._nextPolyId = maxId + 1;
    }

    _allocatePolyId() {
        const nextId = this._nextPolyId;
        this._nextPolyId += 1;
        return nextId;
    }

    _coerceToNavPoly(poly, fallbackId = null) {
        if (poly instanceof NavPoly) {
            return poly;
        }

        if (poly instanceof Polygon) {
            const id = fallbackId ?? this._allocatePolyId();
            const navPoly = new NavPoly(id, poly);
            this._applyPolyMetadata(navPoly, poly);
            return navPoly;
        }

        const sourcePoints = Array.isArray(poly) ? poly : poly?.points;
        const vectors = sourcePoints.map((point) => new Vector2(point.x, point.y));
        const polygon = new Polygon(vectors);
        const id = fallbackId ?? this._allocatePolyId();
        const navPoly = new NavPoly(id, polygon);
        this._applyPolyMetadata(navPoly, poly);
        return navPoly;
    }

    _createNavPoly(poly) {
        return this._coerceToNavPoly(poly);
    }

    _resolveNavPolys(polysOrIds) {
        const entries = Array.isArray(polysOrIds) ? polysOrIds : [polysOrIds];
        const resolved = [];
        const seen = new Set();

        for (const entry of entries) {
            if (entry === null || entry === undefined) {
                continue;
            }

            let poly = null;
            if (typeof entry === "number") {
                poly = this.getPolygonById(entry);
            }
            else if (this.navPolygons.includes(entry)) {
                poly = entry;
            }
            else if (typeof entry.id === "number") {
                poly = this.getPolygonById(entry.id);
            }

            if (!poly || seen.has(poly)) {
                continue;
            }

            seen.add(poly);
            resolved.push(poly);
        }

        return resolved;
    }

    _clearConnections(polys) {
        for (const poly of polys) {
            poly.neighbors = [];
            poly.portals = [];
        }
    }

    _disconnectPolygon(poly) {
        const neighbors = [...poly.neighbors];
        for (const neighbor of neighbors) {
            this._removeNeighborReference(neighbor, poly);
        }

        poly.neighbors = [];
        poly.portals = [];
    }

    _removeNeighborReference(sourcePoly, targetPoly) {
        for (let i = sourcePoly.neighbors.length - 1; i >= 0; i--) {
            if (sourcePoly.neighbors[i] !== targetPoly) {
                continue;
            }

            sourcePoly.neighbors.splice(i, 1);
            sourcePoly.portals.splice(i, 1);
        }
    }

    _connectPolygonSet(sourcePolys, candidatePolys) {
        const uniqueSources = this._uniquePolys(sourcePolys);
        const uniqueCandidates = this._uniquePolys(candidatePolys);

        for (const navPoly of uniqueSources) {
            for (const otherNavPoly of uniqueCandidates) {
                this._connectPolygonPair(navPoly, otherNavPoly);
            }
        }
    }

    _uniquePolys(polys) {
        const unique = [];
        const seen = new Set();

        for (const poly of polys) {
            if (!poly || seen.has(poly)) {
                continue;
            }

            seen.add(poly);
            unique.push(poly);
        }

        return unique;
    }

    _connectPolygonPair(navPoly, otherNavPoly) {
        if (!navPoly || !otherNavPoly || navPoly === otherNavPoly) {
            return false;
        }

        if (navPoly.neighbors.includes(otherNavPoly)) {
            return false;
        }

        const d = navPoly.centroid.distance(otherNavPoly.centroid);
        if (d > navPoly.boundingRadius + otherNavPoly.boundingRadius) {
            return false;
        }

        for (const edge of navPoly.edges) {
            for (const otherEdge of otherNavPoly.edges) {
                if (!areCollinear(edge, otherEdge)) {
                    continue;
                }

                const overlap = this.getSegmentOverlap(edge, otherEdge);
                if (!overlap) {
                    continue;
                }

                navPoly.neighbors.push(otherNavPoly);
                otherNavPoly.neighbors.push(navPoly);
                navPoly.portals.push(this._buildPortal(navPoly, edge, overlap));
                otherNavPoly.portals.push(this._buildPortal(otherNavPoly, otherEdge, overlap));
                return true;
            }
        }

        return false;
    }

    _buildPortal(navPoly, edge, overlap) {
        const [p1, p2] = overlap;
        const edgeStartAngle = navPoly.centroid.angle(edge.start);
        const a1 = navPoly.centroid.angle(overlap[0]);
        const a2 = navPoly.centroid.angle(overlap[1]);
        const d1 = angleDifference(edgeStartAngle, a1);
        const d2 = angleDifference(edgeStartAngle, a2);

        if (d1 < d2) {
            return new Line(p1.x, p1.y, p2.x, p2.y);
        }

        return new Line(p2.x, p2.y, p1.x, p1.y);
    }

    _mergeReplacementPolygons(addedPolys, neighborPolys, mergedNeighborPolys, opts = {}) {
        const workingAdded = [...addedPolys];

        for (let sourceIndex = 0; sourceIndex < workingAdded.length; sourceIndex += 1) {
            let sourcePoly = workingAdded[sourceIndex];
            let merged = true;

            while (merged) {
                merged = false;
                const activeCandidates = opts.mergeWithActive === true
                    ? this.navPolygons
                    : neighborPolys.filter((poly) => this.navPolygons.includes(poly));
                const candidates = this._uniquePolys([
                    ...activeCandidates,
                    ...workingAdded.filter((_, index) => index !== sourceIndex)
                ]);

                for (const candidate of candidates) {
                    if (!candidate || candidate === sourcePoly) {
                        continue;
                    }

                    const mergedPoly = this._mergeAxisAlignedRects(sourcePoly, candidate);
                    if (!mergedPoly) {
                        continue;
                    }

                    if (this.navPolygons.includes(candidate)) {
                        this._disconnectPolygon(candidate);
                        this.navPolygons = this.navPolygons.filter((poly) => poly !== candidate);
                        if (!mergedNeighborPolys.includes(candidate)) {
                            mergedNeighborPolys.push(candidate);
                        }
                    } else {
                        const candidateIndex = workingAdded.indexOf(candidate);
                        if (candidateIndex >= 0) {
                            workingAdded.splice(candidateIndex, 1);
                            if (candidateIndex < sourceIndex) {
                                sourceIndex -= 1;
                            }
                        }
                    }

                    workingAdded[sourceIndex] = mergedPoly;
                    sourcePoly = mergedPoly;
                    merged = true;
                    break;
                }
            }
        }

        return workingAdded;
    }

    _findMergeCandidateIndex(sourcePoly, candidatePolys, parcelTag = null) {
        for (let i = 0; i < candidatePolys.length; i++) {
            if (parcelTag != null && !this._polyHasParcelTag(candidatePolys[i], parcelTag)) {
                continue;
            }
            if (this._getMergedRect(sourcePoly, candidatePolys[i])) {
                return i;
            }
        }

        return -1;
    }

    _mergeAxisAlignedRects(a, b, parcelTag = null) {
        const mergedRect = this._getMergedRect(a, b);
        if (!mergedRect) {
            return null;
        }

        const parcelTags = this._mergePolyParcelTags(a, b, parcelTag);
        return this._createNavPoly({
            points: this._rectToPoints(mergedRect),
            parcelTags,
            parcelTag: parcelTags.length === 1 ? parcelTags[0] : null,
        });
    }

    _getMergedRect(a, b) {
        const rectA = this._getAxisAlignedRectBounds(a);
        const rectB = this._getAxisAlignedRectBounds(b);
        if (!rectA || !rectB) {
            return null;
        }

        const sameVerticalSpan = this._areNumbersEqual(rectA.minY, rectB.minY) && this._areNumbersEqual(rectA.maxY, rectB.maxY);
        const sameHorizontalSpan = this._areNumbersEqual(rectA.minX, rectB.minX) && this._areNumbersEqual(rectA.maxX, rectB.maxX);
        const touchesHorizontally = this._areNumbersEqual(rectA.maxX, rectB.minX) || this._areNumbersEqual(rectB.maxX, rectA.minX);
        const touchesVertically = this._areNumbersEqual(rectA.maxY, rectB.minY) || this._areNumbersEqual(rectB.maxY, rectA.minY);

        if (sameVerticalSpan && touchesHorizontally) {
            return {
                minX: Math.min(rectA.minX, rectB.minX),
                minY: rectA.minY,
                maxX: Math.max(rectA.maxX, rectB.maxX),
                maxY: rectA.maxY,
            };
        }

        if (sameHorizontalSpan && touchesVertically) {
            return {
                minX: rectA.minX,
                minY: Math.min(rectA.minY, rectB.minY),
                maxX: rectA.maxX,
                maxY: Math.max(rectA.maxY, rectB.maxY),
            };
        }

        return null;
    }

    _getAxisAlignedRectBounds(poly) {
        const points = poly?.polygon?.points || poly?.points;
        if (!Array.isArray(points) || points.length !== 4) {
            return null;
        }

        const xs = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
        const ys = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b);
        if (xs.length !== 2 || ys.length !== 2) {
            return null;
        }

        return { minX: xs[0], minY: ys[0], maxX: xs[1], maxY: ys[1] };
    }

    _rectToPoints(rect) {
        return [
            new Vector2(rect.minX, rect.minY),
            new Vector2(rect.maxX, rect.minY),
            new Vector2(rect.maxX, rect.maxY),
            new Vector2(rect.minX, rect.maxY),
        ];
    }

    _areNumbersEqual(a, b) {
        return Math.abs(a - b) <= 0.000001;
    }

    _getPolyParcelTag(poly) {
        const tags = this._getPolyParcelTags(poly);
        return tags.length === 1 ? tags[0] : null;
    }

    _getPolyParcelTags(poly) {
        if (!poly) return [];

        const tags = [];
        const addTag = (tag) => {
            if (typeof tag === "string" && tag.length && !tags.includes(tag)) {
                tags.push(tag);
            }
        };
        const readMeta = (meta) => {
            if (!meta) return;
            if (Array.isArray(meta.parcelTags)) {
                for (const tag of meta.parcelTags) addTag(tag);
            }
            addTag(meta.parcelTag);
        };

        readMeta(poly);
        readMeta(poly.navMeta);
        readMeta(poly.__navMeta);

        return this._normalizeParcelTags(tags);
    }

    _polyHasParcelTag(poly, parcelTag) {
        if (parcelTag == null) return true;
        return this._getPolyParcelTags(poly).includes(parcelTag);
    }

    _mergePolyParcelTags(...entries) {
        const tags = [];
        for (const entry of entries) {
            if (typeof entry === "string") {
                tags.push(entry);
                continue;
            }
            tags.push(...this._getPolyParcelTags(entry));
        }
        return this._normalizeParcelTags(tags);
    }

    _normalizeParcelTags(tags) {
        const unique = [];
        for (const tag of tags || []) {
            if (typeof tag !== "string" || !tag.length || unique.includes(tag)) {
                continue;
            }
            unique.push(tag);
        }

        unique.sort((a, b) => {
            if (a === "main") return -1;
            if (b === "main") return 1;
            return a.localeCompare(b);
        });
        return unique;
    }

    _setPolyParcelTags(targetPoly, tags) {
        const normalized = this._normalizeParcelTags(tags);
        targetPoly.parcelTags = normalized;
        targetPoly.parcelTag = normalized.length === 1 ? normalized[0] : null;
    }

    _applyPolyMetadata(targetPoly, sourcePoly) {
        this._setPolyParcelTags(targetPoly, this._getPolyParcelTags(sourcePoly));
    }
}
