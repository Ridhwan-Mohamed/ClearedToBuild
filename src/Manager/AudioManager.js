// Manager/AudioManager.js
// Simple mix: grass(day/night) + occluded(forest+rock) + water + ovenCooking + step SFX.
// Updates happen only when you call updateFromRedraw(...) (i.e., on your redraw).
import { TILE_MAP, TILE_TYPES, FLOORDEPTH } from "../constants";
import day_ambience from 'url:../assets/audio/day-ambience.ogg';
import night_ambience from 'url:../assets/audio/night-ambience.ogg';
import occluded_ambience from 'url:../assets/audio/occluded-ambience.ogg';
import ocean_ambience from 'url:../assets/audio/ocean-ambience.ogg';
import oven_cooking from 'url:../assets/audio/oven-cooking.ogg';
import step_sfx from 'url:../assets/audio/footstep.ogg';
import axe_chop from 'url:../assets/audio/axe-chop.ogg';
import rock_hit from 'url:../assets/audio/rock-hit.ogg';
import construction_noise from 'url:../assets/audio/construction-noise.ogg';
import pickup from 'url:../assets/audio/pickup.ogg';
import gun_shot from 'url:../assets/audio/gun-shot.ogg';
import sword_hit from 'url:../assets/audio/sword-hit.ogg';
import hand_punch from 'url:../assets/audio/hand-punch.ogg';
import boxing_punch from 'url:../assets/audio/boxing-glove-punch.ogg';
import plant_audio from 'url:../assets/audio/plant-audio.ogg';
import plant_harvest from 'url:../assets/audio/plant-harvest.ogg';
import water_pickup from 'url:../assets/audio/water-pickup.ogg';
import watering_plant from 'url:../assets/audio/watering-plant.ogg';
import tree_break from 'url:../assets/audio/tree-break.ogg';
import rock_break from 'url:../assets/audio/rock-destroy.ogg';
import building_complete from 'url:../assets/audio/building-complete.ogg';
import building_damage from 'url:../assets/audio/building-damage.ogg';
import building_collapse from 'url:../assets/audio/building-collapse.ogg';

export class AudioManager {
  static scene = null;

  // tweakables
  static FADE_MS = 500;
  static AMBIENT_MASTER = 0.55;
  static OVEN_MASTER = 0.45;

  static ambience = new Map(); // key -> Phaser.Sound.BaseSound|null
  static loops = new Map();    // misc loops (oven)
  static lastMix = null;

  static isNight = false;

  // footsteps
  static STEP_COOLDOWN_MS = 240; // tune later
  static STEP_VOL = 0.22;

  // construction loop
  static constructionWorkers = new Set(); // sprite.id numbers
  static CONSTRUCTION_MASTER = 0.30;      // tune
    // harvesting loops
    static woodCutters = new Set(); // sprite.id
    static rockCutters = new Set(); // sprite.id
    static WOOD_CUT_MASTER = 0.28;
    static ROCK_CUT_MASTER = 0.28;


  static init(scene) {
    this.scene = scene;

    // You can load .wav — it’s fine — but for web builds you’ll usually want .ogg/.mp3 too.
    // Keep keys stable; swap file extensions later.

    scene.load.audio("amb_grass_day",   day_ambience);
    scene.load.audio("amb_grass_night", night_ambience);
    scene.load.audio("amb_occluded",    occluded_ambience);
    scene.load.audio("amb_water",       ocean_ambience);

    scene.load.audio("loop_oven_cook",  oven_cooking);

    scene.load.audio("sfx_step",        step_sfx);

    scene.load.audio("sfx_axe_chop",    axe_chop);
    scene.load.audio("sfx_rock_hit",    rock_hit);
    scene.load.audio("sfx_construction", construction_noise);
    scene.load.audio("sfx_pickup",      pickup);
    scene.load.audio("sfx_gun_shot",    gun_shot);
    scene.load.audio("sfx_sword_hit",   sword_hit);
    scene.load.audio("sfx_hand_punch",  hand_punch);
    scene.load.audio("sfx_boxing_punch", boxing_punch);
    scene.load.audio("sfx_plant_audio", plant_audio);
    scene.load.audio("sfx_plant_harvest", plant_harvest);
    scene.load.audio("sfx_water_pickup", water_pickup);
    scene.load.audio("sfx_watering_plant", watering_plant);
    scene.load.audio("sfx_tree_break",  tree_break);
    scene.load.audio("sfx_rock_break",  rock_break);
    scene.load.audio("sfx_building_complete", building_complete);
    scene.load.audio("sfx_building_damage", building_damage);
    scene.load.audio("sfx_building_collapse", building_collapse);
  }

  // Call once per redraw
  static updateFromRedraw({
    topLeftX, topLeftY, bottomRightX, bottomRightY,
    grid, width, height,
    // new:
    cookingOvenCount = 0,
    // optional: pass clock info if handy
    isNight = this.isNight
  }) {
    if (!this.scene) return;

    this.isNight = !!isNight;

    const tileMix = this._tallyTiles({ topLeftX, topLeftY, bottomRightX, bottomRightY, grid, width, height });
    this._applyAmbientMix(tileMix);

    this._applyOvenMix(cookingOvenCount);

    this.lastMix = { tileMix, cookingOvenCount };
  }

  // Call on day/night transition (Clock)
  static setIsNight(isNight) {
    this.isNight = !!isNight;

    // Re-apply last known ratios so the day/night grass swap crossfades immediately.
    if (this.lastMix?.tileMix) {
      this._applyAmbientMix(this.lastMix.tileMix);
    } else {
      // Ensure loops exist at least
      this._ensureLoop(this.ambience, "amb_grass_day");
      this._ensureLoop(this.ambience, "amb_grass_night");
      this._fadeTo(this.ambience.get("amb_grass_day"), 0);
      this._fadeTo(this.ambience.get("amb_grass_night"), 0);
    }
  }

  // Throttled step SFX helper (safe to call every frame)
  static tryPlayStep(sprite) {
    if (!this.scene) return;
    if (!this.scene.cache.audio.exists("sfx_step")) return;

    const now = this.scene.time.now;
    if (sprite._phxNextStepAt == null) sprite._phxNextStepAt = 0;
    if (now < sprite._phxNextStepAt) return;

    // Optional: make step rate mildly speed-dependent
    const speed = sprite.body?.velocity ? sprite.body.velocity.length() : 0;
    if (speed < 5) return;

    sprite._phxNextStepAt = now + this.STEP_COOLDOWN_MS;

    this.scene.sound.play("sfx_step", {
      volume: this.STEP_VOL,
      rate: 0.95 + Math.random() * 0.1
    });
  }

    static playPickup(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_pickup")) return;

        this.scene.sound.play("sfx_pickup", {
            volume: opts.volume ?? 0.35,
            rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    // AudioManager.js
    static playPlant(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_plant_audio")) return;

        this.scene.sound.play("sfx_plant_audio", {
            volume: opts.volume ?? 0.35,
            rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    static playCropHarvest(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_plant_harvest")) return;

        this.scene.sound.play("sfx_plant_harvest", {
            volume: opts.volume ?? 0.40,
            rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    static playWateringStart(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_watering_plant")) return;

        this.scene.sound.play("sfx_watering_plant", {
            volume: opts.volume ?? 0.35,
            rate: opts.rate ?? (0.98 + Math.random() * 0.06),
        });
    }

    static playWaterPickup(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_water_pickup")) return;

        this.scene.sound.play("sfx_water_pickup", {
        volume: opts.volume ?? 0.40,
        rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    static playSound(soundKey, opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists(soundKey)) return;

        this.scene.sound.play(soundKey, {
        volume: opts.volume ?? 0.40,
        rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    // AudioManager.js

    static playTreeBreak(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_tree_break")) return;

        this.scene.sound.play("sfx_tree_break", {
        volume: opts.volume ?? 0.55,
        rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    static playRockBreak(opts = {}) {
        if (!this.scene) return;
        if (!this.scene.cache.audio.exists("sfx_rock_break")) return;

        this.scene.sound.play("sfx_rock_break", {
        volume: opts.volume ?? 0.55,
        rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

    // Optional convenience wrapper:
    static playBlockBreak(material /* "wood" | "rock" */, opts = {}) {
        if (material === "rock") this.playRockBreak(opts);
        else this.playTreeBreak(opts);
    }


  // -----------------------
  // Internals
  // -----------------------

  static _tallyTiles({ topLeftX, topLeftY, bottomRightX, bottomRightY, grid, width, height }) {
    const counts = { grass: 0, forest: 0, rock: 0, water: 0 };
    let total = 0;

    for (let y = topLeftY; y < bottomRightY; y++) {
      for (let x = topLeftX; x < bottomRightX; x++) {
        total++;

        // Treat out-of-bounds as water ambience (ocean edge vibe)
        if (y < 0 || x < 0 || y >= height || x >= width) {
          counts.water++;
          continue;
        }

        const cell = grid[y][x];

        // If your grid stores [floor, top] pairs, classify using BOTH.
        // Priority: water > rock > forest > grass.
        const type = this._classifyTileCell(cell);
        counts[type] += 1;
      }
    }

    const denom = total || 1;
    return {
      total,
      ratio: {
        grass: counts.grass / denom,
        forest: counts.forest / denom,
        rock: counts.rock / denom,
        water: counts.water / denom,
      },
      counts,
    };
  }

  // Decide which entry in a [a,b] cell is the floor by using TILE_TYPES depth
  static _pickFloorValFromCell(cell) {
    if (cell == null) return null;
    if (!Array.isArray(cell)) return cell;

    const a = cell[0];
    const b = cell[1];

    const aName = TILE_MAP(a);
    const bName = TILE_MAP(b);

    const aDef = aName ? TILE_TYPES[aName] : null;
    const bDef = bName ? TILE_TYPES[bName] : null;

    if (aDef?.depth === FLOORDEPTH) return a;
    if (bDef?.depth === FLOORDEPTH) return b;

    // Fallback: preserve your old assumption (index 0 is "base")
    return a;
  }

  static _classifyTileCell(cell) {
    if (cell == null) return "grass";

    if (!Array.isArray(cell)) {
      return this._classifyTileValue(cell);
    }

    const floorVal = this._pickFloorValFromCell(cell);
    const topVal = (floorVal === cell[0]) ? cell[1] : cell[0];

    const floorType = this._classifyTileValue(floorVal);
    const topType = this._classifyTileValue(topVal);

    // Priority so big blockers / water dominate ambience
    if (floorType === "water" || topType === "water") return "water";
    if (floorType === "rock"  || topType === "rock")  return "rock";
    if (floorType === "forest"|| topType === "forest")return "forest";
    return "grass";
  }

  static 
  _classifyTileValue(val) {
    if (val == null || typeof val !== "number") return "grass";

    const name = TILE_MAP(val);
    if (!name) return "grass";

    // Map real tile names -> ambience buckets
    switch (name) {
      case "water":
        return "water";

      case "pine":
        return "forest";

      case "rock":
        return "rock";

      // Optional: walls feel occluded/hard rather than "grass"
      case "wall":
        return "rock";

      default:
        // grass, dirt, road, sand, crops, interactable grass tiles, buildings, etc.
        return "grass";
    }
  }

  // construction noise helpers

  static setConstructionActive(sprite, isActive) {
    if (!this.scene || !sprite) return;

    const id = sprite.id ?? sprite; // allow passing id directly if you want

    if (isActive) this.constructionWorkers.add(id);
    else this.constructionWorkers.delete(id);

    this._applyConstructionMix();
  }

  static onSpriteDestroyed(sprite) {
    if (!sprite) return;
    const id = sprite.id ?? sprite;
    if (this.constructionWorkers.delete(id)) {
      this._applyConstructionMix();
    }
  }

  static _applyConstructionMix() {
    // One shared loop for the whole world
    this._ensureLoop(this.loops, "sfx_construction");

    const s = this.loops.get("sfx_construction");
    if (!s) return;

    const n = this.constructionWorkers.size;

    // Option A: simple on/off with fade
    const target = (n > 0) ? this.CONSTRUCTION_MASTER : 0;

    // Option B: gentle ramp with # builders (uncomment if you prefer)
    // const target = (n > 0) ? this._clamp(0.18 + 0.06 * (n - 1), 0, 0.45) : 0;

    this._fadeTo(s, target);
  }

  static _applyAmbientMix(tileMix) {
    const r = tileMix.ratio;

    // forest + rock both feed occluded
    const occludedRatio = r.forest + r.rock;

    // grass splits across day/night loops depending on time
    const grassDayTarget   = (!this.isNight ? r.grass : 0) * this.AMBIENT_MASTER;
    const grassNightTarget = ( this.isNight ? r.grass : 0) * this.AMBIENT_MASTER;

    const targets = {
      amb_grass_day: grassDayTarget,
      amb_grass_night: grassNightTarget,
      amb_occluded: occludedRatio * this.AMBIENT_MASTER,
      amb_water: r.water * this.AMBIENT_MASTER,
    };

    for (const [key, vol] of Object.entries(targets)) {
      this._ensureLoop(this.ambience, key);
      this._fadeTo(this.ambience.get(key), vol);
    }
  }

  static _applyOvenMix(cookingOvenCount) {
    // Gentle ramp; tune when you have real assets.
    // Example: 1 oven = 0.15, 3 ovens = 0.35, 6+ caps near 0.6
    const v = this._clamp(0.10 + cookingOvenCount * 0.07, 0, 0.65) * this.OVEN_MASTER;

    this._ensureLoop(this.loops, "loop_oven_cook");
    this._fadeTo(this.loops.get("loop_oven_cook"), v);
  }

    static setHarvestActive(sprite, material /* "wood" | "rock" */, isActive) {
        if (!this.scene || !sprite) return;
        const id = sprite.id ?? sprite;

        if (material === "rock") {
            if (isActive) this.rockCutters.add(id);
            else this.rockCutters.delete(id);
            this._applyHarvestMix("rock");
        } else {
            if (isActive) this.woodCutters.add(id);
            else this.woodCutters.delete(id);
            this._applyHarvestMix("wood");
        }
    }

    static onSpriteDestroyed(sprite) {
        if (!sprite) return;
        const id = sprite.id ?? sprite;

        let changed = false;
        if (this.constructionWorkers?.delete(id)) changed = true;
        if (this.woodCutters?.delete(id)) changed = true;
        if (this.rockCutters?.delete(id)) changed = true;

        if (changed) {
            this._applyConstructionMix?.();
            this._applyHarvestMix?.("wood");
            this._applyHarvestMix?.("rock");
        }
    }

    static _applyHarvestMix(material /* "wood" | "rock" */) {
        const isRock = material === "rock";
        const loopKey = isRock ? "sfx_rock_hit" : "sfx_axe_chop";
        const setRef = isRock ? this.rockCutters : this.woodCutters;
        const master = isRock ? this.ROCK_CUT_MASTER : this.WOOD_CUT_MASTER;

        this._ensureLoop(this.loops, loopKey);
        const s = this.loops.get(loopKey);
        if (!s) return;

        const n = setRef.size;

        // simple on/off with fade (best v1)
        const target = (n > 0) ? master : 0;

        // or a gentle ramp if you want:
        // const target = (n > 0) ? this._clamp(0.18 + 0.05 * (n - 1), 0, 0.45) : 0;

        this._fadeTo(s, target);
    }

    // AudioManager.js
    static playWeaponAttack(attackerSprite, weapon, opts = {}) {
        if (!this.scene || !weapon) return;

        const key = weapon.attackSfxKey;
        if (!key) return;
        if (!this.scene.cache.audio.exists(key)) return;

        // Throttle per-attacker (avoid rapid spam if durations get small later)
        const now = this.scene.time.now;
        const cooldownMs = opts.cooldownMs ?? 80;

        if (attackerSprite) {
            if (attackerSprite._phxNextAtkSfxAt == null) attackerSprite._phxNextAtkSfxAt = 0;
            if (now < attackerSprite._phxNextAtkSfxAt) return;
            attackerSprite._phxNextAtkSfxAt = now + cooldownMs;
        }

        this.scene.sound.play(key, {
            volume: opts.volume ?? (weapon.projectile ? 0.42 : 0.32),
            rate: opts.rate ?? (0.95 + Math.random() * 0.1),
        });
    }

  static _ensureLoop(map, key) {
    if (map.has(key)) return;

    if (!this.scene.cache.audio.exists(key)) {
      map.set(key, null);
      return;
    }

    const s = this.scene.sound.add(key, { loop: true, volume: 0 });
    s.play();
    map.set(key, s);
  }

  static _fadeTo(sound, targetVol) {
    if (!sound) return;

    if (sound._phxFadeTween) {
      sound._phxFadeTween.stop();
      sound._phxFadeTween = null;
    }

    const cur = sound.volume ?? 0;
    if (Math.abs(cur - targetVol) < 0.01) {
      sound.setVolume(targetVol);
      return;
    }

    sound._phxFadeTween = this.scene.tweens.add({
      targets: sound,
      volume: targetVol,
      duration: this.FADE_MS,
      onComplete: () => { sound._phxFadeTween = null; }
    });
  }

  static _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
