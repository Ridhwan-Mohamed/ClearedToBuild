// buildings/SpawnerBuilding.js
// A simple, breakable spawner building that emits Raiders on an interval
// and shows "enemies left" above it.
//
// Dependencies expected on the Scene:
//   - scene.add, scene.tweens, scene.time
//   - scene.spawnManager or scene.spawnManager.spawnRaider(...)
//   - scene.uiTextStyle? (optional)
//
// You already have a TILE_TYPES.spawn entry; this file focuses on behaviour.
import { Map } from "../map.js";
import { TILE_TYPES, SQUARESIZE } from "../constants.js";
import { spawnRaiderAtWorld } from "../Manager/spawnManager.js";

export class SpawnerBuilding {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} gx tile x
   * @param {number} gy tile y
   * @param {object} opts
   */
  constructor(scene, gx, gy, opts = {}) {
    this.scene = scene;
    this.tilePos = { tileX: gx, tileY: gy };

    // ✅ bake into grid + block both nav grids + create barrier
    // uses Map.addBlockItem(...) which writes tile + sets navGrid/enemyNavGrid to 0 for blocking items :contentReference[oaicite:1]{index=1}
    Map.addBlockItem(gx, gy, TILE_TYPES.spawn);

    // compute world position internally
    const worldX = gx * SQUARESIZE + SQUARESIZE / 2;
    const worldY = gy * SQUARESIZE + SQUARESIZE / 2;

    this.difficulty = opts.difficulty ?? 1;
    this.stageIndex = opts.stageIndex ?? 1;

    this.maxHp = opts.maxHp ?? 80;
    this.hp = this.maxHp;
    this.contractId = opts.contractId ?? null;

    this.quotaRemaining = opts.quota ?? 3;
    this.aliveCount = 0;

    this.intervalMs = opts.intervalMs ?? 4000;
    this.textureKey = opts.textureKey ?? TILE_TYPES.spawn.value; // assumes TILE_TYPES.spawn exists

    this._destroyed = false;

    // create visuals
    this.sprite = scene.add.image(worldX, worldY, this.textureKey);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(50);

    // ✅ ensure it’s actually on the world layer
    if (typeof Map._worldAdd === "function") Map._worldAdd(this.sprite);

    this._playSpawnFX();

    const style = scene.uiTextStyle ?? { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" };
    this.counterText = scene.add.text(this.sprite.x, this.sprite.y - 26, "", style);
    this.counterText.setOrigin(0.5, 0.5);
    this.counterText.setDepth(60);
    if (typeof Map._worldAdd === "function") Map._worldAdd(this.counterText);

    this._updateCounter();

    // timer tick (spawns raiders)
    this.timer = scene.time.addEvent({
      delay: this.intervalMs,
      loop: true,
      callback: () => this._tick(),
    });

    // optional bookkeeping
    if (Array.isArray(Map.worldSpawners)) Map.worldSpawners.push(this);
  }

  _playSpawnFX() {
    // Shake
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.sprite.x + 3,
      duration: 60,
      yoyo: true,
      repeat: 6,
    });

    // Flash
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.25,
      duration: 80,
      yoyo: true,
      repeat: 5,
    });
  }

  _updateCounter() {
    if (!this.counterText) return;

    // show "spawns remaining" (goes DOWN on each spawn)
    this.counterText.setText(String(Math.max(0, this.quotaRemaining)));
  }

  _tick() {
    if (this._destroyed) return;

    // Spawn only while quota remains.
    if (this.quotaRemaining <= 0) {
      // Keep counter alive until all spawned enemies are dead.
      this._updateCounter();
      return;
    }

    // Spawn a Raider (you said existing attack logic will take over).
    // We only need to call into your spawnManager.
    const spawned = this._spawnRaider();
    if (spawned) {
      this.quotaRemaining -= 1;
      this.aliveCount += 1;
      this._updateCounter();
    }
  }

  // buildings/SpawnerBuilding.js
  _spawnRaider() {
    const raider = spawnRaiderAtWorld(this.sprite.x, this.sprite.y);
    raider.spawner = this;               // already there :contentReference[oaicite:2]{index=2}
    raider.contractId = this.contractId; // ✅ add
    this.scene?.parcelManager?.notifyRaiderSpawned?.(raider.contractId);
    return true;
  }


  // Call this when a raider dies (hook from Raider.onDeath or your spawnManager)
  notifyEnemyDied() {
    if (this._destroyed) return;
    this.aliveCount = Math.max(0, this.aliveCount - 1);
    this._updateCounter();
  }

  applyDamage(dmg) {
    if (this._destroyed) return;
    this.hp -= dmg;
    // Minor feedback
    this.scene.tweens.add({ targets: this.sprite, angle: { from: -2, to: 2 }, duration: 40, yoyo: true, repeat: 1 });
    if (this.hp <= 0) this.destroy();
  }

  isComplete() {
    return this.quotaRemaining <= 0 && this.aliveCount <= 0;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.timer) this.timer.remove(false);
    this.sprite?.destroy();
    this.counterText?.destroy();
  }
}
