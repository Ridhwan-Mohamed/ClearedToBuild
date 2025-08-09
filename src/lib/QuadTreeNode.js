export class QuadtreeNode {
  constructor(bounds, capacity = 4) {
    this.bounds = bounds; // {x, y, width, height}
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }

  insert(point) {
    const { x, y } = point;
    const { x: bx, y: by, width, height } = this.bounds;
    if (x < bx || x >= bx + width || y < by || y >= by + height) return false;

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) this.subdivide();

    return (
      this.northeast.insert(point) ||
      this.northwest.insert(point) ||
      this.southeast.insert(point) ||
      this.southwest.insert(point)
    );
  }

  subdivide() {
    const { x, y, width, height } = this.bounds;
    const hw = width / 2, hh = height / 2;
    this.northeast = new QuadtreeNode({ x: x + hw, y, width: hw, height: hh }, this.capacity);
    this.northwest = new QuadtreeNode({ x, y, width: hw, height: hh }, this.capacity);
    this.southeast = new QuadtreeNode({ x: x + hw, y: y + hh, width: hw, height: hh }, this.capacity);
    this.southwest = new QuadtreeNode({ x, y: y + hh, width: hw, height: hh }, this.capacity);
    this.divided = true;
  }

  nearest(x, y, maxDist = Infinity) {
    let best = null;
    let bestDist = maxDist;

    const check = (node) => {
      for (const pt of node.points) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          best = pt;
          bestDist = d;
        }
      }

      if (!node.divided) return;
      for (const child of [node.northeast, node.northwest, node.southeast, node.southwest]) {
        const { x: cx, y: cy, width, height } = child.bounds;
        const cxMid = cx + width / 2, cyMid = cy + height / 2;
        const dx = Math.max(Math.abs(x - cxMid) - width / 2, 0);
        const dy = Math.max(Math.abs(y - cyMid) - height / 2, 0);
        if ((dx * dx + dy * dy) < bestDist) check(child);
      }
    };

    check(this);
    return best;
  }
}
