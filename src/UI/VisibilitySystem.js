// VisibilitySystem.js — simple & efficient: full-view rebuilds; lights & vision chunked; no "explored" persistence.

import Phaser from "phaser";
import {
  CHUNK_SIZE,
  SQUARESIZE,
  WORLD_DIMENSIONX,
  WORLD_DIMENSIONY,
  UIDEPTH,
  TILE_TYPES,
  TILE_MAP,
  BLOCKDEPTH,
} from "../constants";
import { Map as GameMap } from "../map";

function idx(x, y) { return y * WORLD_DIMENSIONX + x; }
function inBounds(x, y) { return x >= 0 && y >= 0 && x < WORLD_DIMENSIONX && y < WORLD_DIMENSIONY; }

export class VisibilitySystem {
  /** Phaser.Scene */
  static scene;

  // --- map-scale logic grids ---
  static blockerGrid;             // Uint8Array (0/1) — pines/rocks
  static occlusionGrid;           // Float32Array (0..1)

  // --- inputs ---
  static ambient = 1.0;           // 0..1
  static lightSources = [];       // [{id, x,y,r,brightness}]
  static visionBubbles = [];      // [{id, x,y,r,boost}]

  // --- render state (single view RT) ---
  static viewRect = null;         // {gx0, gy0, tilesW, tilesH}
  static viewRT = null;

  // --- UI cam opt-out ---
  static uiCam = null;
  static registerUICamera(cam) {
    this.uiCam = cam;
    if (this.viewRT) cam.ignore(this.viewRT);
  }

  // --- tunables ---
  static useOcclusion = true;
  static dayCutoff = 1; // >= this = daytime (everything visible)

  // Discrete occlusion rings; >=4 → black
  static occlusionMinShade = 0.0;  // final shade = 1 - O; O=1 => black
  static occFirstRing  = 0.15;
  static occSecondRing = 0.35;
  static occThirdRing  = 0.65;
  static occFourthRing = 0.90;

  // --- per-view scratch (resized to tilesW*tilesH) ---
  static _fog   = new Float32Array(0);   // will store (ambient + boost) from vision bubbles
  static _light = new Float32Array(0);   // ambient + lights
  static _cap   = 0;

  // === Fog of War helpers (world-space, chunk-accelerated) ===
  static playerTeam = 1;           // local player’s team id
  static pendingRebuild = false;   // micro-batch full rebuilds within a frame

  // --- Light spatial index (by CHUNK_SIZE tiles) ---
  static _lightChunks = new Map();   // key "cx,cy" -> array of lights
  static _lightChunkSize = CHUNK_SIZE;
  static _lightIdSeq = 1;
  static _lightKey(cx, cy) { return `${cx},${cy}`; }
  static _lightAABBChunks(gx0, gy0, gx1, gy1) {
    const s = this._lightChunkSize;
    const cx0 = Math.floor(gx0 / s), cy0 = Math.floor(gy0 / s);
    const cx1 = Math.floor(gx1 / s), cy1 = Math.floor(gy1 / s);
    const out = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) out.push({cx,cy});
    return out;
  }

  // --- Vision spatial index (by CHUNK_SIZE tiles) ---
  static _visionChunks = new Map();  // key "cx,cy" -> array of bubbles
  static _visionChunkSize = CHUNK_SIZE;
  static _visionIdSeq = 1;
  static _visionKey(cx, cy) { return `${cx},${cy}`; }
  static _visionAABBChunks(gx0, gy0, gx1, gy1) {
    const s = this._visionChunkSize;
    const cx0 = Math.floor(gx0 / s), cy0 = Math.floor(gy0 / s);
    const cx1 = Math.floor(gx1 / s), cy1 = Math.floor(gy1 / s);
    const out = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) out.push({cx,cy});
    return out;
  }

  // ===== Init =====
  static init(scene) {
    this.scene = scene;

    const N = WORLD_DIMENSIONX * WORLD_DIMENSIONY;
    this.blockerGrid   = new Uint8Array(N);
    this.occlusionGrid = new Float32Array(N);

    this._buildInitialBlockers();
    this._recomputeAllOcclusion();
  }

  // ===== Public API =====

  // Called by your map reDraw: define current view rect (tile coords)
  static setViewRect(gx0, gy0, tilesW, tilesH) {
    this.viewRect = { gx0, gy0, tilesW, tilesH };
    this._ensureViewRT();
    // full paint is triggered by callers (ambient/occluder/unit/etc.)
  }

  // Ambient change → rebuild full mask
  static setAmbient(value01) {
    const v = Phaser.Math.Clamp(value01, 0, 1);
    if(Math.abs(v-this.ambient) < 0.05) return;
    if (v === this.ambient && this.viewRT) return;
    this.ambient = v;
    this._rebuildViewFull();
  }

  // ---------- Lights (chunked) ----------
  static setLightSources(sources /* [{x,y,r,brightness}] */) {
    this.lightSources = [];
    this._lightChunks.clear();
    if (!sources) { this._rebuildViewFull(); return; }
    for (const s of sources) this.addLightSource(s, /*noRepaint=*/true);
    if (this.ambient >= this.dayCutoff) return;   // ⬅️ skip daytime rebuild
    this._rebuildViewFull();
  }

  static addLightSource(light, noRepaint = false) {
    const id = this._lightIdSeq++;
    const s = { id, brightness: 1, ...light };
    this.lightSources.push(s);

    const gx0 = Math.floor(s.x - s.r), gy0 = Math.floor(s.y - s.r);
    const gx1 = Math.ceil (s.x + s.r), gy1 = Math.ceil (s.y + s.r);
    for (const {cx,cy} of this._lightAABBChunks(gx0, gy0, gx1, gy1)) {
      const k = this._lightKey(cx,cy);
      if (!this._lightChunks.has(k)) this._lightChunks.set(k, []);
      this._lightChunks.get(k).push(s);
    }
    if (!noRepaint && this.ambient < this.dayCutoff) this._rebuildViewFull();
    return id;
  }

  static removeLightById(id) {
    this.lightSources = this.lightSources.filter(s => s.id !== id);
    for (const [k, arr] of this._lightChunks) {
      const n = arr.filter(s => s.id !== id);
      if (n.length) this._lightChunks.set(k, n); else this._lightChunks.delete(k);
    }
    if (this.ambient < this.dayCutoff) this._rebuildViewFull();
  }

  // ---------- Vision (chunked; slight boost over ambient) ----------
  // boost = additional brightness over ambient within the bubble (default 0.1)
  static addVisionBubble(b /* {x,y,r,boost?} */, noRepaint = false) {
    const id = this._visionIdSeq++;
    const s = { id, boost: 0.1, ...b };
    this.visionBubbles.push(s);

    const gx0 = Math.floor(s.x - s.r), gy0 = Math.floor(s.y - s.r);
    const gx1 = Math.ceil (s.x + s.r), gy1 = Math.ceil (s.y + s.r);
    for (const {cx,cy} of this._visionAABBChunks(gx0, gy0, gx1, gy1)) {
      const k = this._visionKey(cx,cy);
      if (!this._visionChunks.has(k)) this._visionChunks.set(k, []);
      this._visionChunks.get(k).push(s);
    }
    if (!noRepaint) this._rebuildViewFull();
    return id;
  }

  static moveVisionBubble(id, x, y, r) {
    const s = this.visionBubbles.find(v => v.id === id);
    if (!s) return;
    // remove from old chunks
    const ogx0 = Math.floor(s.x - s.r), ogy0 = Math.floor(s.y - s.r);
    const ogx1 = Math.ceil (s.x + s.r), ogy1 = Math.ceil (s.y + s.r);
    for (const {cx,cy} of this._visionAABBChunks(ogx0, ogy0, ogx1, ogy1)) {
      const k = this._visionKey(cx,cy);
      const arr = this._visionChunks.get(k);
      if (!arr) continue;
      const n = arr.filter(v => v.id !== id);
      if (n.length) this._visionChunks.set(k, n); else this._visionChunks.delete(k);
    }
    // update
    s.x = x; s.y = y; if (r != null) s.r = r;
    // add to new chunks
    const ngx0 = Math.floor(s.x - s.r), ngy0 = Math.floor(s.y - s.r);
    const ngx1 = Math.ceil (s.x + s.r), ngy1 = Math.ceil (s.y + s.r);
    for (const {cx,cy} of this._visionAABBChunks(ngx0, ngy0, ngx1, ngy1)) {
      const k = this._visionKey(cx,cy);
      if (!this._visionChunks.has(k)) this._visionChunks.set(k, []);
      this._visionChunks.get(k).push(s);
    }
    // only rebuild if intersects view
    if (this.viewRect) {
      const { gx0, gy0, tilesW, tilesH } = this.viewRect;
      const vx0 = gx0, vy0 = gy0;
      const vx1 = gx0 + tilesW - 1, vy1 = gy0 + tilesH - 1;
      const ax0 = s.x - s.r, ay0 = s.y - s.r;
      const ax1 = s.x + s.r, ay1 = s.y + s.r;
      const hit = !(ax1 < vx0 || ax0 > vx1 || ay1 < vy0 || ay0 > vy1);
      if (hit && this.ambient < this.dayCutoff) this._markDirty();
    }
  }

  static removeVisionBubble(id) {
    this.visionBubbles = this.visionBubbles.filter(v => v.id !== id);
    for (const [k, arr] of this._visionChunks) {
      const n = arr.filter(v => v.id !== id);
      if (n.length) this._visionChunks.set(k, n); else this._visionChunks.delete(k);
    }
    if (this.ambient < this.dayCutoff) this._rebuildViewFull();
  }

  static clearVisionBubbles() {
    this.visionBubbles = [];
    this._visionChunks.clear();
    this._rebuildViewFull();
  }

  // ===== Gameplay hooks =====

  // Use this from Player movement: pass NEW grid coords (center of bubble), radius
  static onUnitMoved(gxNew, gyNew, r = 6, visionId = null) {
    if (visionId != null) {
      this.moveVisionBubble(visionId, gxNew, gyNew, r);
    } else {
      // fallback: create a transient bubble
      this.addVisionBubble({ x: gxNew, y: gyNew, r, boost: 0.1 });
    }
  }

  // Occluder (e.g., pine/rock) edits → recompute occlusion near change, then full repaint
  static onOccluderChangedRect(gx, gy, wTiles, hTiles, isBlock) {
    const x0 = Math.max(0, gx);
    const y0 = Math.max(0, gy);
    const x1 = Math.min(WORLD_DIMENSIONX - 1, gx + wTiles - 1);
    const y1 = Math.min(WORLD_DIMENSIONY - 1, gy + hTiles - 1);

    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      this.blockerGrid[idx(x, y)] = isBlock ? 1 : 0;

    const pad = 12;
    const ax0 = Math.max(0, x0 - pad), ay0 = Math.max(0, y0 - pad);
    const ax1 = Math.min(WORLD_DIMENSIONX - 1, x1 + pad);
    const ay1 = Math.min(WORLD_DIMENSIONY - 1, y1 + pad);
    this._floodExteriorToOcclusion(ax0, ay0, ax1, ay1);

    this._rebuildViewFull();
  }

  // Return true if (gx,gy) is inside ANY current vision bubble (night only)
  static pointInAnyVision(gx, gy) {
    if (this.ambient >= this.dayCutoff) return true; // day: everything visible
    const s = this._visionChunkSize;
    const cx = Math.floor(gx / s), cy = Math.floor(gy / s);
    const arr = this._visionChunks.get(this._visionKey(cx, cy));
    if (!arr || arr.length === 0) return false;
    for (const v of arr) {
      const dx = gx - v.x, dy = gy - v.y;
      if (dx*dx + dy*dy <= v.r*v.r) return true;
    }
    return false;
  }

  // Apply FoW to a sprite (cheap: O(k) where k = few bubbles in its chunk)
  static applyFoWToSprite(sprite, allVisibile=false) {
    if (!sprite?.body) return;
    if (this.ambient >= this.dayCutoff || allVisibile) { sprite.setVisible(true); return; }

    // Your units are always visible to you
    if (sprite.body.team === this.playerTeam) { sprite.setVisible(true); return; }

    const gx = Math.floor(sprite.x / SQUARESIZE);
    const gy = Math.floor(sprite.y / SQUARESIZE);
    const isVisible = this.pointInAnyVision(gx, gy)
    const inView = GameMap.cameraBounds?.contains(sprite.x, sprite.y);
    sprite.setVisible(inView); // Will not draw if false
    if(!inView || !isVisible){
      sprite.setVisible(false);
    }else {
      sprite.setVisible(true);
    }
  }

  // ===== Internals =====

  static _markDirty() {
    if (this.pendingRebuild) return;
    this.pendingRebuild = true;
    // defer to end-of-tick so many moves coalesce into a single rebuild
    this.scene.time.delayedCall(0, () => {
      this.pendingRebuild = false;
      if (this.ambient < this.dayCutoff) this._rebuildViewFull();
    });
  }

  static _ensureViewRT() {
    if (!this.viewRect) return;
    const { gx0, gy0, tilesW, tilesH } = this.viewRect;
    const needNew =
      !this.viewRT ||
      this.viewRT.width  !== tilesW ||
      this.viewRT.height !== tilesH;

    if (needNew) {
      if (this.viewRT) this.viewRT.destroy(true);
      this.viewRT = this.scene.add.renderTexture(0, 0, tilesW, tilesH)
        .setOrigin(0, 0)
        .setDepth(UIDEPTH - 3)
        .setScrollFactor(1, 1);
      this.scene.uiCamera.ignore(this.viewRT);
      this.viewRT.setDisplaySize(tilesW * SQUARESIZE, tilesH * SQUARESIZE);
      if (this.uiCam?.ignore) this.uiCam.ignore(this.viewRT);

      // resize scratch
      const cap = tilesW * tilesH;
      this._fog   = new Float32Array(cap);
      this._light = new Float32Array(cap);
      this._cap   = cap;
    }

    this.viewRT.setPosition(gx0 * SQUARESIZE, gy0 * SQUARESIZE);
    this.viewRT.gx0 = gx0; this.viewRT.gy0 = gy0;
    this.viewRT.tilesW = tilesW; this.viewRT.tilesH = tilesH;
  }

  /** Full rebuild of the current view */
  static _rebuildViewFull() {
    if (!this.viewRect) return;
    this._ensureViewRT();
    if (!this.viewRT) return;

    // ✅ Daytime fast-path: ONLY occlusion (no fog, no lights, no vision)
    if (this.ambient >= this.dayCutoff) {
      const { gx0, gy0, tilesW, tilesH } = this.viewRect;
      const rt = this.viewRT;
      rt.clear();

      const gfx = this.scene.add.graphics();
      for (let ly = 0; ly < tilesH; ly++) {
        const gy = gy0 + ly;
        for (let lx = 0; lx < tilesW; lx++) {
          const gx = gx0 + lx;
          const O = this.occlusionGrid[idx(gx, gy)] || 0; // 0..1
          // shade=1 when no occlusion; shade < 1 under occluders/interior
          const shade = Phaser.Math.Linear(1.0, this.occlusionMinShade, O);
          const finalDark = 1 - shade;                   // only occlusion contributes
          if (finalDark <= 0) continue;
          gfx.fillStyle(0x000000, finalDark);
          gfx.fillRect(lx, ly, 1, 1);
        }
      }
      rt.draw(gfx, 0, 0);
      gfx.destroy();
      return;
    }

    const { gx0, gy0, tilesW, tilesH } = this.viewRect;
    const vx0 = gx0, vy0 = gy0;
    const vx1 = gx0 + tilesW - 1, vy1 = gy0 + tilesH - 1;

    const rt = this.viewRT;
    rt.clear();

    // 1) Vision (chunked): start at 0; set to ambient+boost within bubbles
    this._fog.fill(0, 0, tilesW * tilesH);

    const visCandidates = [];
    const visSeen = new Set();
    for (const {cx,cy} of this._visionAABBChunks(vx0, vy0, vx1, vy1)) {
      const k = this._visionKey(cx,cy);
      const arr = this._visionChunks.get(k);
      if (!arr) continue;
      for (const s of arr) {
        if (visSeen.has(s.id)) continue;
        const ax0 = Math.floor(s.x - s.r), ay0 = Math.floor(s.y - s.r);
        const ax1 = Math.ceil (s.x + s.r), ay1 = Math.ceil (s.y + s.r);
        if (ax1 < vx0 || ax0 > vx1 || ay1 < vy0 || ay0 > vy1) continue;
        visSeen.add(s.id);
        visCandidates.push(s);
      }
    }

    for (const V of visCandidates) {
      const { x, y, r, boost = 1 } = V;
      const minx = Math.max(vx0, Math.floor(x - r));
      const maxx = Math.min(vx1, Math.ceil (x + r));
      const miny = Math.max(vy0, Math.floor(y - r));
      const maxy = Math.min(vy1, Math.ceil (y + r));
      const r2 = r * r;
      const target = Phaser.Math.Clamp(this.ambient + boost, 0, 1);

      for (let gy = miny; gy <= maxy; gy++) {
        const rowOff = (gy - vy0) * tilesW;
        for (let gx = minx; gx <= maxx; gx++) {
          const dx = gx - x, dy = gy - y;
          if (dx*dx + dy*dy <= r2) {
            const j = rowOff + (gx - vx0);
            if (target > this._fog[j]) this._fog[j] = target;
          }
        }
      }
    }

    // 2) Light (chunked): ambient base + lights
    this._light.fill(this.ambient, 0, tilesW * tilesH);

    const lightCandidates = [];
    const lightSeen = new Set();
    for (const {cx,cy} of this._lightAABBChunks(vx0, vy0, vx1, vy1)) {
      const k = this._lightKey(cx,cy);
      const arr = this._lightChunks.get(k);
      if (!arr) continue;
      for (const s of arr) {
        if (lightSeen.has(s.id)) continue;
        const ax0 = Math.floor(s.x - s.r), ay0 = Math.floor(s.y - s.r);
        const ax1 = Math.ceil (s.x + s.r), ay1 = Math.ceil (s.y + s.r);
        if (ax1 < vx0 || ax0 > vx1 || ay1 < vy0 || ay0 > vy1) continue;
        lightSeen.add(s.id);
        lightCandidates.push(s);
      }
    }

    for (const L of lightCandidates) {
      const { x, y, r, brightness = 1.0 } = L;
      const minx = Math.max(vx0, Math.floor(x - r));
      const maxx = Math.min(vx1, Math.ceil (x + r));
      const miny = Math.max(vy0, Math.floor(y - r));
      const maxy = Math.min(vy1, Math.ceil (y + r));
      const r2 = r * r;

      for (let gy = miny; gy <= maxy; gy++) {
        const rowOff = (gy - vy0) * tilesW;
        for (let gx = minx; gx <= maxx; gx++) {
          const dx = gx - x, dy = gy - y;
          const d2 = dx*dx + dy*dy;
          if (d2 > r2) continue;
          const fall = 1 - Math.sqrt(d2) / r;          // linear falloff
          const add = Phaser.Math.Clamp(brightness * fall, 0, 1);
          const j = rowOff + (gx - vx0);
          if (add > this._light[j]) this._light[j] = add;
        }
      }
    }

    // 3) Draw final darkness (max(vision, light) then occlusion)
    const gfx = this.scene.add.graphics();
    for (let ly = 0; ly < tilesH; ly++) {
      const rowOff = ly * tilesW;
      for (let lx = 0; lx < tilesW; lx++) {
        const j  = rowOff + lx;
        const gx = gx0 + lx, gy = gy0 + ly;

        let vis = Math.max(this._fog[j], this._light[j]); // brightness
        if (this.useOcclusion) {
          const O = this.occlusionGrid[idx(gx, gy)] || 0;
          const shade = Phaser.Math.Linear(1.0, this.occlusionMinShade, O);
          vis *= shade;
        }
        const finalDark = 1 - Phaser.Math.Clamp(vis, 0, 1);
        if (finalDark <= 0) continue;

        // NOTE: 1x1 grid pixel; RT is scaled to world size
        gfx.fillStyle(0x000000, finalDark);
        gfx.fillRect(lx, ly, 1, 1);
      }
    }
    rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  // ===== Occlusion (discrete rings) =====

  static _buildInitialBlockers() {
    const grid = GameMap.grid;
    if (!grid) return;
    for (let y = 0; y < WORLD_DIMENSIONY; y++) {
      for (let x = 0; x < WORLD_DIMENSIONX; x++) {
        const code = GameMap.grabDepth(grid[y][x], BLOCKDEPTH);
        const name = TILE_TYPES[TILE_MAP(code)]?.name;
        this.blockerGrid[idx(x, y)] = (name === "pine" || name === "rock") ? 1 : 0;
      }
    }
  }

  static _recomputeAllOcclusion() {
    this._floodExteriorToOcclusion(0, 0, WORLD_DIMENSIONX - 1, WORLD_DIMENSIONY - 1);
  }

  /** Exterior flood within AABB; writes occlusionGrid using discrete blocker depths. */
  static _floodExteriorToOcclusion(x0, y0, x1, y1) {
    const W = x1 - x0 + 1, H = y1 - y0 + 1;
    const idxLocal = (x, y) => (y - y0) * W + (x - x0);
    const inLocal = (x, y) => x >= x0 && y >= y0 && x <= x1 && y <= y1;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    // 1) Exterior flood (through non-blockers)
    const mark = new Uint8Array(W * H);
    const dist = new Uint16Array(W * H);
    const qx = new Int16Array(W * H), qy = new Int16Array(W * H);
    let qs = 0, qe = 0;
    const push = (x,y,d)=>{const i=idxLocal(x,y); qx[qe]=x; qy[qe]=y; dist[i]=d; qe++;};
    const pop  = ()=>[qx[qs], qy[qs++]];

    for (let x = x0; x <= x1; x++) {
      if (!this.blockerGrid[idx(x, y0)]) { mark[idxLocal(x, y0)] = 1; push(x, y0, 0); }
      if (!this.blockerGrid[idx(x, y1)]) { mark[idxLocal(x, y1)] = 1; push(x, y1, 0); }
    }
    for (let y = y0; y <= y1; y++) {
      if (!this.blockerGrid[idx(x0, y)]) { mark[idxLocal(x0, y)] = 1; push(x0, y, 0); }
      if (!this.blockerGrid[idx(x1, y)]) { mark[idxLocal(x1, y)] = 1; push(x1, y, 0); }
    }
    while (qs < qe) {
      const [cx, cy] = pop();
      const cd = dist[idxLocal(cx, cy)];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!inLocal(nx, ny)) continue;
        const ni = idxLocal(nx, ny);
        if (mark[ni]) continue;
        if (this.blockerGrid[idx(nx, ny)]) continue;
        mark[ni] = 1; push(nx, ny, cd + 1);
      }
    }

    // 2) Blocker depth flood (layers inside blockers)
    const depth = new Uint8Array(W * H);
    qs = qe = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const gi = idx(x, y);
        if (!this.blockerGrid[gi]) continue;
        let touches = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (!inLocal(nx, ny)) continue;
          if (!this.blockerGrid[idx(nx, ny)] && mark[idxLocal(nx, ny)]) { touches = true; break; }
        }
        if (touches) {
          depth[idxLocal(x, y)] = 1;
          qx[qe] = x; qy[qe] = y; qe++;
        }
      }
    }
    while (qs < qe) {
      const cx = qx[qs], cy = qy[qs++], d = depth[idxLocal(cx, cy)];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!inLocal(nx, ny)) continue;
        const gi = idx(nx, ny), li = idxLocal(nx, ny);
        if (!this.blockerGrid[gi]) continue;
        if (depth[li]) continue;
        depth[li] = d + 1;
        qx[qe] = nx; qy[qe] = ny; qe++;
      }
    }

    // 3) Write occlusion (discrete rings on blockers; interior empty ramps up)
    const MAX_EMPTY_OCC = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const gi = idx(x, y), li = idxLocal(x, y);
        if (this.blockerGrid[gi]) {
          const d = depth[li] | 0;
          let O = 0.0;
          if (d === 1) O = this.occFirstRing;
          else if (d === 2) O = this.occSecondRing;
          else if (d === 3) O = this.occThirdRing;
          else if (d === 4) O = this.occFourthRing;
          else if (d >= 4) O = 1.0;
          this.occlusionGrid[gi] = O;
        } else {
          const exterior = mark[li];
          if (!exterior) {
            this.occlusionGrid[gi] = 1.0;
          } else {
            const d = dist[li];
            const norm = Math.min(d / 8, 1);
            this.occlusionGrid[gi] = norm * MAX_EMPTY_OCC;
          }
        }
      }
    }
  }
}

