import jsastar from "javascript-astar";
/**
 * Graph for javascript-astar. It implements the functionality for astar. See GPS test from astar
 * repo for structure: https://github.com/bgrins/javascript-astar/blob/master/test/tests.js
 *
 * @class NavGraph
 * @private
 */
class NavGraph {
    constructor(navPolygons) {
        this.grid = [];
        this.init = jsastar.Graph.prototype.init.bind(this);
        this.cleanDirty = jsastar.Graph.prototype.cleanDirty.bind(this);
        this.markDirty = jsastar.Graph.prototype.markDirty.bind(this);
        this.toString = jsastar.Graph.prototype.toString.bind(this);
        this.nodes = navPolygons;
        this.init();
    }
    neighbors(navPolygon) {
        return navPolygon.neighbors;
    }
    navHeuristic(navPolygon1, navPolygon2) {
        return navPolygon1.centroidDistance(navPolygon2);
    }
    destroy() {
        this.cleanDirty();
        this.nodes = [];
    }
}
export default NavGraph;
