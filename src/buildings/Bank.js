// buildings/Bank.js
// Enemy Bank building (closed/opened spritesheets + hover panel + destroy task + money reward)
// Matches Tower/House damage reactions: shake+flash, floating damage text, health bar visible on hover or after damage.

import { BLOCKDEPTH, ENEMY_BUILDING_HOVER_UI, SQUARESIZE, TILE_TYPES, UIDEPTH, showGhostText } from "../constants";
import { Map } from "../map";
import { StageState } from "../parcelController/StageState";
import { Teams } from "../Teams";
import { VisibilitySystem } from "../UI/VisibilitySystem";


// Reward curve defaults (override via opts)
export const BANK_REWARD_BASE = 200;
export const BANK_REWARD_PER_STAGE = 150;

export class Bank {
  static scene;

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x grid x (tile coord)
   * @param {number} y grid y (tile coord)
   * @param {number} team owning team (enemy default = 2)
   * @param {object} opts
   *  - maxHealth?: number
   *  - rewardBase?: number
   *  - rewardPerStage?: number
   *  - onReward?: (amount:number) => void
   */
  constructor(x, y, team = 2, opts = {}) {
    this.scene = Bank.scene;
    this.x = x;
    this.y = y;
    this.team = team;

    const tileType = TILE_TYPES.bank || { lenX: 4, lenY: 4, name: "bank" };
    const lenX = tileType.lenX || 4;
    const lenY = tileType.lenY || 4;

    this.tileType = tileType;
    this.maxHealth = opts.maxHealth ?? tileType.maxHealth ?? 500;
    this.health = this.maxHealth;

    this.rewardBase = opts.rewardBase ?? BANK_REWARD_BASE;
    this.rewardPerStage = opts.rewardPerStage ?? BANK_REWARD_PER_STAGE;

    this.healthBarBg = null;
    this.healthBar = null;
    this._damageBarUntil = 0;
    this._damageBarTimer = null;
    this.isHovered = false;

    this.uiContainer = this.scene.add.container(0, 0).setDepth(UIDEPTH);
    this.panelBg = null;
    this.panelText1 = null;
    this.panelText2 = null;

    this._ensureAnims();

    // Top-left pixel
    const px = x * SQUARESIZE;
    const py = y * SQUARESIZE;

    this.sprite = Map.addToWorldStatic(
      this.scene.add.sprite(px, py, "bank_closed", 0).setOrigin(0).setDepth(BLOCKDEPTH)
    );
    const cx = x + Math.floor((lenX || 4) / 2);
    const cy = y + Math.floor((lenY || 4) / 2);
    this.visionId = VisibilitySystem.addVisionBubble({ x: cx, y: cy, r: 7, boost: 0.12 });
    this.lightId = VisibilitySystem.addLightSource({ x: cx, y: cy, r: 6, brightness: 2 });

    this.sprite.play("bank_closed_idle");
    this.sprite.setInteractive({ cursor: "pointer" });

    // footprint collider for projectiles / overlaps (matches Tower pattern)
    const w = lenX * SQUARESIZE;
    const h = lenY * SQUARESIZE;
    this.collider = this.scene.physics.add.staticImage(px + w / 2, py + h / 2, "barrier");
    this.collider.setAlpha(0);
    this.collider.setSize(w, h);
    this.collider.refreshBody();
    this.collider.isBuilding = true;
    this.collider.team = this.team;
    this.collider.buildingRef = this;
    this.collider.body.setSize(w, h, true);
    this.collider.refreshBody();
    Map.structureBarrier?.add(this.collider);

    // building manager hooks
    this.sprite.buildingRef = this;
    this.sprite.isBuilding = true;
    this.sprite.team = this.team;

    // blocks nav/placement
    Map.addBlockItem?.(x, y, tileType);

    // Click to toggle destroy task (player team queues, same as tower)
    this.sprite.on("pointerdown", () => this._toggleDestroyTask());

    this.sprite.on("pointerover", () => {
      this.isHovered = true;
      this.updateHealthBar();
      this._showPanel();
    });
    this.sprite.on("pointerout", () => {
      this.isHovered = false;
      this.updateHealthBar();
      this._hidePanel();
    });
  }

  _ensureAnims() {
    const a = this.scene?.anims;
    if (!a) return;

    if (!a.exists("bank_closed_idle")) {
      a.create({
        key: "bank_closed_idle",
        frames: a.generateFrameNumbers("bank_closed", { start: 0, end: 1 }),
        frameRate: 2,
        repeat: -1,
      });
    }

    if (!a.exists("bank_opened_idle")) {
      a.create({
        key: "bank_opened_idle",
        frames: a.generateFrameNumbers("bank_opened", { start: 0, end: 1 }),
        frameRate: 2,
        repeat: -1,
      });
    }
  }

  computeReward() {
    const s = StageState?.currentStage ?? StageState?.stage ?? StageState?.level ?? 1;
    const stageIndex = Math.max(1, Number(s) || 1);
    return this.rewardBase + (stageIndex - 1) * this.rewardPerStage;
  }

  _toggleDestroyTask() {
    const playerTeam = 1;
    if (this.team === playerTeam) return; // only queue enemy buildings

    const list = Teams.teamLists?.[playerTeam];
    if (!list) return;

    const task = {
      x: this.x,
      y: this.y,
      type: this.tileType,         // mimic Tower's matching behavior (object compare)
      value: this.sprite,
      duration: this.health,
      totalDuration: this.maxHealth,
      assigned: 0,
    };

    const exists = list.enemyDestroyStates?.some(
      (t) => t?.x === task.x && t?.y === task.y && t?.type === task.type
    );

    if (exists) Teams.removeFromStateArray(playerTeam, "enemyDestroyStates", task);
    else Teams.addToStateArrayIfNotExists(playerTeam, "enemyDestroyStates", task);

    // click flash: dark -> normal
    this.sprite.setTint(0x666666);
    this.scene.time.delayedCall(120, () => {
      if (this.sprite?.active) this.sprite.clearTint();
    });
  }

  // ──────────────────────────
  // Hover UI (House-style panel)
  // ──────────────────────────
  _panelPos() {
    if (!this.sprite) return { cx: 0, y: 0 };
    const b = this.sprite.getBounds();
    return {
      cx: b.centerX,
      y: b.top - ENEMY_BUILDING_HOVER_UI.PANEL_Y_OFFSET,
    };
  }

  _showPanel() {
    this._ensurePanel();
    this._updatePanel();
    this.panelBg.setVisible(true);
    this.panelText1.setVisible(true);
    this.panelText2.setVisible(true);
  }

  _hidePanel() {
    if (!this.panelBg) return;
    this.panelBg.setVisible(false);
    this.panelText1.setVisible(false);
    this.panelText2.setVisible(false);
  }

  _ensurePanel() {
    if (this.panelBg) return;

    const scene = this.scene;

    // Create at (0,0) inside container; we move container itself in _updatePanel()
    this.panelBg = scene.add
      .rectangle(0, 0, 140, 30, 0x000000, 0.6)
      .setOrigin(0.5)
      .setDepth(UIDEPTH)
      .setStrokeStyle(1, 0xffffff, 0.4);

    this.panelText1 = scene.add
      .text(0, ENEMY_BUILDING_HOVER_UI.LINE1_DY, "", { fontSize: "10px", color: "#ffffff" })
      .setOrigin(0.5, 0.5)
      .setDepth(UIDEPTH + 1);

    this.panelText2 = scene.add
      .text(0, ENEMY_BUILDING_HOVER_UI.LINE2_DY, "", { fontSize: "10px", color: "#ffffff" })
      .setOrigin(0.5, 0.5)
      .setDepth(UIDEPTH + 1);

    this.uiContainer.add([this.panelBg, this.panelText1, this.panelText2]);

  }

  _updatePanel() {
    if (!this.uiContainer || !this.sprite || !this.panelBg) return;

    const { cx, y } = this._panelPos();

    // Move the whole panel as a unit
    this.uiContainer.setPosition(cx, y);

    // Update text content
    const hp = `HP: ${Math.max(0, this.health)}/${this.maxHealth}`;
    const loot = `Loot: $${this.computeReward()}`;

    this.panelText1.setText(hp);
    this.panelText2.setText(loot);
  }

  // ──────────────────────────
  // Health bar (Tower-style)
  // ──────────────────────────
  ensureHealthBar() {
    if (!this.sprite || !this.scene) return;

    const fullWidth = (this.tileType.lenX || 4) * SQUARESIZE;
    const topY = this.sprite.y - 6;
    const cx = this.sprite.x + fullWidth / 2;

    if (!this.healthBarBg) {
      this.healthBarBg = this.scene.add
        .rectangle(cx, topY, fullWidth, 4, 0x000000, 0.6)
        .setDepth(BLOCKDEPTH + 1);
      Map.addToWorldStatic(this.healthBarBg);
    }
    if (!this.healthBar) {
      // enemy bar: red
      this.healthBar = this.scene.add
        .rectangle(cx, topY, fullWidth, 2, 0xff0000, 1)
        .setDepth(BLOCKDEPTH + 2);
      Map.addToWorldStatic(this.healthBar);
    }
  }

  updateHealthBar() {
    if (!this.sprite || !this.scene) return;
    this.ensureHealthBar();
    if (!this.healthBar || !this.healthBarBg) return;

    const fullWidth = (this.tileType.lenX || 4) * SQUARESIZE;
    const cx = this.sprite.x + fullWidth / 2;
    const topY = this.sprite.y - 6;

    const ratio = this.maxHealth > 0 ? Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1) : 0;

    this.healthBarBg.setPosition(cx, topY);
    this.healthBar.setPosition(cx - (fullWidth * (1 - ratio)) / 2, topY); // keep left-anchored feel
    this.healthBarBg.setDisplaySize(fullWidth, 4);
    this.healthBar.setDisplaySize(fullWidth * ratio, 2);

    const now = this.scene.time?.now ?? 0;
    const visible = this.isHovered || now < this._damageBarUntil;
    this.healthBarBg.setVisible(visible);
    this.healthBar.setVisible(visible);

    // keep hover panel current
    if (this.isHovered) this._updatePanel();
  }

  shakeAndFlash() {
    if (!this.sprite || !this.scene) return;
    const targets = [this.sprite];
    if (this.healthBarBg) targets.push(this.healthBarBg);
    if (this.healthBar) targets.push(this.healthBar);

    this.scene.tweens.add({
      targets,
      x: "+=3",
      yoyo: true,
      duration: 40,
      repeat: 2,
    });

    this.sprite.setTint(0xff6666);
    this.scene.time.delayedCall(120, () => {
      if (this.sprite) this.sprite.clearTint();
    });
  }

  // Called by buildingManager.beginDestroyingBlock
  onDamaged(damage, currentHealth, maxHealth) {
    this.maxHealth = maxHealth ?? this.maxHealth ?? 1;
    this.health = Math.max(0, currentHealth);

    this.shakeAndFlash();

    const now = this.scene?.time?.now ?? 0;
    this._damageBarUntil = now + 2000;
    this.updateHealthBar();

    this._damageBarTimer?.remove(false);
    this._damageBarTimer = this.scene.time.delayedCall(2000, () => {
      this.updateHealthBar();
    });

    // floating damage text (same vibe as Tower/House)
    const fullWidth = (this.tileType.lenX || 4) * SQUARESIZE;
    showGhostText(
      this.scene,
      this.sprite.x + fullWidth / 2,
      this.sprite.y - 10,
      `-${damage}`,
      this.team,
      0,
      0,
      "#ff5555"
    );

    // refresh panel if hovered
    if (this.isHovered) this._updatePanel();
  }

  // Called when buildingManager actually destroys it
  destroy() {
    this._damageBarTimer?.remove(false);
    this._damageBarTimer = null;

    // Swap to opened + reward
    if (this.sprite?.active) {
      this.sprite.setTexture("bank_opened", 0);
      this.sprite.play("bank_opened_idle");
      this.sprite.disableInteractive();
    }

    Map.removeBlockItem?.(this.x, this.y);

    const amount = this.computeReward();
    this.scene.updateMoney(amount);

    const fullWidth = (this.tileType.lenX || 4) * SQUARESIZE;
    showGhostText(this.scene, this.sprite.x + fullWidth / 2, this.sprite.y - 10, `+$${amount}`, this.team);

    if (this.collider) {
      Map.structureBarrier?.remove(this.collider, true, true); // ✅ remove from group + destroy children
      this.collider.destroy();
      this.collider = null;
    }

    if (this.healthBarBg) this.healthBarBg.destroy();
    if (this.healthBar) this.healthBar.destroy();
    if (this.visionId != null) {
      VisibilitySystem.removeVisionBubble(this.visionId);
      this.visionId = null;
    }
    if (this.lightId != null) {
      VisibilitySystem.removeLightById(this.lightId);
      this.lightId = null;
    }

    // clear hover UI
    this.uiContainer?.destroy(true);
    this.uiContainer = null;
  }
}
