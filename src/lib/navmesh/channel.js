// Mostly sourced from PatrolJS at the moment. TODO: come back and reimplement this as an incomplete
// funnel algorithm so astar checks can be more accurate.
import { triarea2 } from "./utils";
/**
 * @private
 */
export default class Channel {
    constructor() {
        this.portals = [];
        this.path = [];
    }
    push(p1, p2) {
        if (p2 === undefined)
            p2 = p1;
        this.portals.push({
            left: p1,
            right: p2,
        });
    }
    stringPull() {
        const portals = this.portals;
        const pts = [];
        // Init scan state
        let apexIndex = 0;
        let leftIndex = 0;
        let rightIndex = 0;
        let portalApex = portals[0].left;
        let portalLeft = portals[0].left;
        let portalRight = portals[0].right;
        // Add start point.
        pts.push(portalApex);
        for (var i = 1; i < portals.length; i++) {
            // Find the next portal vertices
            const left = portals[i].left;
            const right = portals[i].right;
            // Update right vertex.
            if (triarea2(portalApex, portalRight, right) <= 0.0) {
                if (portalApex.equals(portalRight) || triarea2(portalApex, portalLeft, right) > 0.0) {
                    // Tighten the funnel.
                    portalRight = right;
                    rightIndex = i;
                }
                else {
                    // Right vertex just crossed over the left vertex, so the left vertex should
                    // now be part of the path.
                    pts.push(portalLeft);
                    // Restart scan from portal left point.
                    // Make current left the new apex.
                    portalApex = portalLeft;
                    apexIndex = leftIndex;
                    // Reset portal
                    portalLeft = portalApex;
                    portalRight = portalApex;
                    leftIndex = apexIndex;
                    rightIndex = apexIndex;
                    // Restart scan
                    i = apexIndex;
                    continue;
                }
            }
            // Update left vertex.
            if (triarea2(portalApex, portalLeft, left) >= 0.0) {
                if (portalApex.equals(portalLeft) || triarea2(portalApex, portalRight, left) < 0.0) {
                    // Tighten the funnel.
                    portalLeft = left;
                    leftIndex = i;
                }
                else {
                    // Left vertex just crossed over the right vertex, so the right vertex should
                    // now be part of the path
                    pts.push(portalRight);
                    // Restart scan from portal right point.
                    // Make current right the new apex.
                    portalApex = portalRight;
                    apexIndex = rightIndex;
                    // Reset portal
                    portalLeft = portalApex;
                    portalRight = portalApex;
                    leftIndex = apexIndex;
                    rightIndex = apexIndex;
                    // Restart scan
                    i = apexIndex;
                    continue;
                }
            }
        }
        if (pts.length === 0 || !pts[pts.length - 1].equals(portals[portals.length - 1].left)) {
            // Append last point to path.
            pts.push(portals[portals.length - 1].left);
        }
        this.path = pts;
        return pts;
    }
}
