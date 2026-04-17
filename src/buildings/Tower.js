// buildings/Tower.js
// Town Tower / enemy tower building (shared footprint + health + destroy flow)

import { BLOCKDEPTH, ENEMY_BUILDING_HOVER_UI, SQUARESIZE, TILE_TYPES, UIDEPTH, showGhostText } from "../constants";
import { buildingManager } from "../Manager/buildingManager";
import { Map } from "../map";
import { StageState } from "../parcelController/StageState";
import { Teams } from "../Teams";
import { VisibilitySystem } from "../UI/VisibilitySystem";

/**
 * TowerBuilding
 * - Assumes spritesheet key: 'tower' (2 frames)
 * - Plays animation 'tower_idle'
 * - buildingManager.beginDestroyingBlock drives damage by calling sprite.buildingRef.onDamaged(...)
 */
export class TowerBuilding {
  static scene;

  static getLivingTownTowers(teamNumber = 1) {
    const towers = Teams.teamLists?.[teamNumber]?.townTowerList || [];
    return towers.filter((tower) => tower && !tower._destroyed && tower.health > 0);
  }

  static hasLivingTownTowers(teamNumber = 1) {
    return this.getLivingTownTowers(teamNumber).length > 0;
  }

  static grantDawnIncome(scene, teamNumber = 1) {
    const towers = this.getLivingTownTowers(teamNumber);
    if (!towers.length) return null;

    const money = towers.length * 150;
    const permits = towers.reduce((sum, tower) => sum + (tower.isStarterTownTower ? 2 : 1), 0);
    scene?.updateMoney?.(money);
    scene?.updatePermits?.(permits);

    return { towers, money, permits };
  }

  constructor(x, y, team = 0, opts = {}) {
    this.scene = TowerBuilding.scene;
    this.x = x;
    this.y = y;
    this.team = team;
    this.isPressureTower = !!opts.isPressureTower;
    this.isFortObjective = !!opts.isFortObjective;
    this.isTownTower = !!opts.isTownTower || (!!team && !this.isFortObjective && !this.isPressureTower);
    this.isStarterTownTower = !!opts.isStarterTownTower;
    this.grantBuildPermit = !!opts.grantBuildPermit;
    this.pressureSlotId = opts.pressureSlotId ?? null; // "N"|"W"|"E"|"S"
    if (this.isFortObjective) {
      StageState.registerFortTower(this);
    }

    const tileType = TILE_TYPES.tower || { lenX: 1, lenY: 1, name: "tower" };
    const lenX = tileType.lenX || 1;
    const lenY = tileType.lenY || 1;

    this.maxHealth = opts.maxHealth ?? tileType.maxHealth ?? 600;
    this.health = this.maxHealth;

    this.healthBarBg = null;
    this.healthBar = null;
    this._damageBarUntil = 0;
    this._damageBarTimer = null;
    this.isHovered = false;
    // Hover UI (Prison-style panel)
    this.uiContainer = this.scene.add.container(0, 0).setDepth(UIDEPTH);
    this.panelBg = null;
    this.panelText1 = null;
    this.panelText2 = null;

    this._ensureTowerAnim();

    // Prefer sprite (spritesheet) instead of image
    const px = x * SQUARESIZE + (lenX * SQUARESIZE) / 2;
    const py = y * SQUARESIZE + (lenY * SQUARESIZE) / 2;

    this.sprite = Map.addToWorldStatic(
      this.scene
        .add
        .sprite(px, py, "tower")
        .setDepth(BLOCKDEPTH)
        .setInteractive({ cursor: "pointer" })
    );
    const cx = x + Math.floor((lenX || 1) / 2);
    const cy = y + Math.floor((lenY || 1) / 2);
    this.visionId = VisibilitySystem.addVisionBubble({ x: cx, y: cy, r: 7, boost: 0.12 });
    this.lightId = VisibilitySystem.addLightSource({ x: cx, y: cy, r: 6, brightness: 2 });

    this.sprite.setInteractive({ useHandCursor: true });
    // keep sprite interactive/visible (no physics needed on it)
    this.sprite.buildingRef = this;
    this.sprite.isBuilding = true;

    // Example: if tower is wTiles by hTiles tiles
    const w = lenX * SQUARESIZE;
    const h = lenY * SQUARESIZE;

    // create an invisible physics body that matches footprint
    this.collider = this.scene.physics.add.staticImage(this.sprite.x, this.sprite.y, "barrier");
    this.collider.setAlpha(0);
    this.collider.setSize(w, h);
    this.collider.refreshBody();

    this.collider.buildingRef = this;
    Map.structureBarrier.add(this.collider);

    if (this.isPressureTower) {
      this.scene?.towerPressureController?.registerTower?.(this, this.pressureSlotId);
    }

    // add to your structure barrier group that projectiles overlap against
    this.collider.isBuilding = true;
    this.collider.team = this.team;

    this.sprite.buildingRef = this;
    this.sprite.team = this.team;
    this.tileType = TILE_TYPES.tower;

    if (this.isTownTower && Teams.teamLists?.[team]) {
      Teams.teamLists[team].townTowerList.push(this);
      Teams.teamLists[team].buildings.push([x, y, TILE_TYPES.tower, this.sprite]);
      const stats = this.scene?._townTowerStats || (this.scene._townTowerStats = { built: 0, destroyed: 0 });
      stats.built += 1;

      if (this.grantBuildPermit && this.team === 1) {
        this.scene?.updatePermits?.(1);
        showGhostText(this.scene, this.sprite.x, this.sprite.y - 14, "+1 Permit", this.team, 0, 0, "#9be7ff");
      }
    }

    // Click enemy structure to toggle a fighter destruction task (team 1 queues)
    this.sprite.on("pointerdown", () => {
      const playerTeam = 1;
      if (this.team === playerTeam || this.isTownTower) {
        buildingManager.handleBuildingClickForBuilders(this, null, this.team);
        return;
      }

      const list = Teams.teamLists[playerTeam];
      if (!list) return;

      const task = {
        x: this.x,
        y: this.y,
        type: "tower",
        duration: this.health,
        totalDuration: this.maxHealth,
        type: TILE_TYPES.tower,
        value: this.sprite,
        assigned: 0,
      };

      const exists = list.enemyDestroyStates?.some(
        t => t?.x === task.x && t?.y === task.y && t?.type === task.type
      );

      if (exists) Teams.removeFromStateArray(playerTeam, "enemyDestroyStates", task);
      else Teams.addToStateArrayIfNotExists(playerTeam, "enemyDestroyStates", task);

      // click flash: dark → normal
      this.sprite.setTint(0x666666);
      this.scene.time.delayedCall(120, () => {
        if (this.sprite?.active) this.sprite.clearTint();
      });
    });


    this.sprite.play("tower_idle");
    this.sprite.buildingRef = this;

    // Make sure it occupies tiles / blocks nav like other buildings
    if (this.isTownTower) {
      Map.drawRoadAround?.(x, y, tileType, team);
    }
    Map.addBlockItem?.(x, y, tileType);

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

  _ensureTowerAnim() {
    const animKey = "tower_idle";
    const a = this.scene?.anims;
    if (!a) return;
    if (a.exists(animKey)) return;

    const towerTexture = this.scene?.textures?.get?.("tower");
    const destroyedTexture = this.scene?.textures?.get?.("tower_destroyed");
    const towerEnd = towerTexture?.has?.(1) ? 1 : 0;
    const destroyedEnd = destroyedTexture?.has?.(1) ? 1 : 0;

    a.create({
      key: animKey,
      frames: a.generateFrameNumbers("tower", { start: 0, end: towerEnd }),
      frameRate: towerEnd > 0 ? 2 : 1,
      repeat: -1,
    });

    if (!a.exists("tower_destroyed_idle")) {
      a.create({
        key: "tower_destroyed_idle",
        frames: a.generateFrameNumbers("tower_destroyed", { start: 0, end: destroyedEnd }),
        frameRate: destroyedEnd > 0 ? 2 : 1,
        repeat: -1,
      });
    }
  }

  ensureHealthBar() {
    if (!this.sprite || !this.scene) return;

    const tileType = TILE_TYPES.tower || { lenX: 1, lenY: 1 };
    const fullWidth = (tileType.lenX || 1) * SQUARESIZE;
    const topY = this.sprite.y - (tileType.lenY || 1) * SQUARESIZE / 2 - 6;

    if (!this.healthBarBg) {
      this.healthBarBg = this.scene.add
        .rectangle(this.sprite.x, topY, fullWidth, 4, 0x000000, 0.6)
        .setDepth(BLOCKDEPTH + 1);
      Map.addToWorldStatic(this.healthBarBg);
    }
    if (!this.healthBar) {
      // 🔴 enemy bar
      this.healthBar = this.scene.add
        .rectangle(this.sprite.x, topY, fullWidth, 2, 0xff0000, 1)
        .setDepth(BLOCKDEPTH + 2);
      Map.addToWorldStatic(this.healthBar);
    }
  }

  updateHealthBar() {
    if (!this.sprite || !this.scene) return;
    this.ensureHealthBar();
    if (!this.healthBar || !this.healthBarBg) return;

    const tileType = TILE_TYPES.tower || { lenX: 1, lenY: 1 };
    const fullWidth = (tileType.lenX || 1) * SQUARESIZE;
    const ratio = this.maxHealth > 0 ? Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1) : 0;

    this.healthBarBg.setDisplaySize(fullWidth, 4);
    this.healthBar.setDisplaySize(fullWidth * ratio, 2);

    const now = this.scene.time?.now ?? 0;
    const visible = this.isHovered || now < this._damageBarUntil;
    this.healthBarBg.setVisible(visible);
    this.healthBar.setVisible(visible);
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
    buildingManager.queueAutoFixForBuilding(this, this.team);

    this.shakeAndFlash();

    const now = this.scene?.time?.now ?? 0;
    this._damageBarUntil = now + 2000;
    this.updateHealthBar();

    this._damageBarTimer?.remove(false);
    this._damageBarTimer = this.scene.time.delayedCall(2000, () => {
      this.updateHealthBar();
    });

    // floating damage text
    showGhostText(
      this.scene,
      this.sprite.x,
      this.sprite.y - (TILE_TYPES.tower?.lenY ?? 1) * SQUARESIZE / 2 - 10,
      `-${damage}`,
      this.team,
      0,
      0,
      "#ff5555"
    );
  }

  // ──────────────────────────
  // Hover UI (Prison-style panel)
  // ──────────────────────────
  _panelPos() {
    if (!this.sprite) return { cx: 0, y: 0 };
    const b = this.sprite.getBounds();
    return { cx: b.centerX, y: b.top - ENEMY_BUILDING_HOVER_UI.PANEL_Y_OFFSET };
  }

  _ensurePanel() {
    if (this.panelBg) return;

    const { cx, y } = this._panelPos();

    this.panelBg = this.scene.add
      .rectangle(cx, y, 170, 28, 0x000000, 0.6)
      .setOrigin(0.5)
      .setDepth(UIDEPTH)
      .setStrokeStyle(1, 0xffffff, 0.4);

    this.panelText1 = this.scene.add
      .text(cx - 80, y + ENEMY_BUILDING_HOVER_UI.LINE1_DY, "", { fontSize: "10px", color: "#ffffff" })
      .setOrigin(0, 0.5)
      .setDepth(UIDEPTH + 1);

    this.panelText2 = this.scene.add
      .text(cx - 80, y + ENEMY_BUILDING_HOVER_UI.LINE2_DY, "", { fontSize: "10px", color: "#ffffff" })
      .setOrigin(0, 0.5)
      .setDepth(UIDEPTH + 1);

    this.uiContainer.add([this.panelBg, this.panelText1, this.panelText2]);

  }

  _updatePanel() {
    if (!this.panelBg) return;

    const { cx, y } = this._panelPos();
    this.panelBg.setPosition(cx, y);
    this.panelText1.setPosition(cx - 80, y + ENEMY_BUILDING_HOVER_UI.LINE1_DY);
    this.panelText2.setPosition(cx - 80, y + ENEMY_BUILDING_HOVER_UI.LINE2_DY);

    const hp = `HP: ${Math.max(0, this.health)}/${this.maxHealth}`;
    if (this.isTownTower) {
      const permitText = this.isStarterTownTower ? "+2 permits" : "+1 permit";
      this.panelText1.setText(`Town Tower ${hp}`);
      this.panelText2.setText(`Dawn: +$150 ${permitText}`);
      return;
    }

    const tpc = this.scene?.towerPressureController;
    const info = tpc?.getTowerPressureInfo?.(this) ?? null;
    const laneLabel = (slotId) => {
      if (slotId === "N") return "North";
      if (slotId === "W") return "West";
      if (slotId === "E") return "East";
      if (slotId === "S") return "South";
      return null;
    };

    let pressure = "Raid lane: inactive";
    if (tpc && info?.slotId) {
      const lane = laneLabel(info.slotId) || info.slotId;
      if (info.phase === "raid_live") pressure = `Raid lane ${lane}: LIVE`;
      else if (info.phase === "countdown") pressure = `Raid lane ${lane}: ${info.remainingText}`;
      else if (info.phase === "waiting_slot") pressure = `Raid lane ${lane}: waiting`;
      else pressure = `Raid lane ${lane}: arming`;
    } else if (tpc) {
      pressure = "Raid lane: assigning";
    }

    this.panelText1.setText(hp);
    this.panelText2.setText(pressure);
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

  destroy() {
    this._damageBarTimer?.remove(false);
    this._damageBarTimer = null;
    this._destroyed = true;

    if (this.isFortObjective) {
      StageState.notifyFortTowerDestroyed(this);
      StageState.unregisterFortTower(this);
    }
    
    if (this.isPressureTower) {
      this.scene?.towerPressureController?.unregisterTower?.(this);
    }

    if (this.collider) {
      Map.structureBarrier?.remove(this.collider, true, true);
      this.collider.destroy();
      this.collider = null;
    }

    this.uiContainer?.destroy(true);
    this.uiContainer = null;

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

    if (this.isTownTower && Teams.teamLists?.[this.team]) {
      Teams.removeFromStateArray(this.team, "townTowerList", this);
      const stats = this.scene?._townTowerStats || (this.scene._townTowerStats = { built: 0, destroyed: 0 });
      stats.destroyed += 1;
    }

    // ✅ keep sprite, swap to destroyed anim, disable interaction
    if (this.sprite?.active) {
      this.sprite._destroyed = true;
      this.sprite.setTexture("tower_destroyed", 0);
      this.sprite.play("tower_destroyed_idle");
      this.sprite.disableInteractive();
    }

    if (this.isTownTower && !TowerBuilding.hasLivingTownTowers(this.team)) {
      this.scene?.handleTownCoreLost?.(this);
    }
  }
}
