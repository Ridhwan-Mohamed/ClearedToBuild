// parcelController/ParcelInstance.js
export class ParcelInstance {
  /**
   * @param {{slotKey:'W'|'S'|'E', type:string, origin:{x:number,y:number}, size:number}} def
   */
  constructor(def) {
    this.slotKey = def.slotKey;
    this.type = def.type;
    this.origin = def.origin;
    this.size = def.size;
    this.objects = []; // buildings / sprites etc to clean up
  }

  addObject(obj) { this.objects.push(obj); }

  destroy() {
    for (const o of this.objects) {
      try {
        if (o?.destroy) o.destroy();
      } catch {}
    }
    this.objects.length = 0;
  }
}
