import { BLOCKDEPTH, SQUARESIZE, TILE_TYPES, UIDEPTH, showGhostText } from "../constants";
import { Map } from "../map";
import { Teams } from "../Teams";
import { VisibilitySystem } from "../UI/VisibilitySystem";
import { buildingManager } from "../Manager/buildingManager";
import {
    applyPortraitKeyToSprite,
    DEFAULT_PLAYER_PORTRAIT_KEY,
    getPlayerPortraitKey,
} from "../players/playerPortraits";

export class House {

    static scene;

    constructor(x, y, houseType, team) {
        this.scene = House.scene;
        this.x = x;
        this.y = y;
        this.team = team;
        this.occupants = [];
        this.uiContainer = House.scene.add.container(0, 0).setDepth(UIDEPTH);

        // 🔹 Building health
        this.maxHealth = 300;
        this.health = this.maxHealth;
        this.healthBarBg = null;
        this.healthBar   = null;
        this._damageBarUntil = 0;

        this.sprite = Map.addToWorldStatic(
            House.scene.add.image(x * SQUARESIZE, y * SQUARESIZE, houseType.name)
                .setOrigin(0)
                .setDepth(BLOCKDEPTH)
                .setInteractive()
            )
                .setOrigin(0)
                .setDepth(BLOCKDEPTH)
                .setInteractive()
                .on('pointerdown', () => {
                    const scene = this.scene;
                    const handled = buildingManager.handleBuildingClickForBuilders(this, null, this.team);
                    if (handled) return;

                    // Prefer BottomBar tab flow (like ovens/storage)
                    if (scene?.openDetailPage) {
                        scene.openDetailPage('houses', (tab) => {
                            tab?.selectFromWorld?.(this);  // select + center handled by tab
                        });
                        return;
                    }
                });
        Map.drawRoadAround(x,y,houseType,team);
        Map.addBlockItem(x,y,houseType);

        if(team == 1){
            const cx = x + Math.floor(houseType.lenX/2);
            const cy = y + Math.floor(houseType.lenY/2);
            // Vision bubble so nearby tiles are slightly brighter
            this.visionId = VisibilitySystem.addVisionBubble({ x: cx, y: cy, r: 6, boost: 0.10 });
            // Optional: small porch light (trim or remove if you don’t want light)
            this.lightId  = VisibilitySystem.addLightSource({ x: cx, y: cy, r: 5, brightness: 2 });
        }

        this.sprite.buildingRef = this;

        this.sprite.on('pointerover', () => {
            this.isHovered = true;
            this.updateHealthBar?.();
            this.updateIcons()
        });
        this.sprite.on('pointerout', () => {
            this.isHovered = false;
            this.updateHealthBar?.();
            this.clearIcons()
        });

        this.uiIcons = [null, null];
        Teams.teamLists[team].houseList.push(this);
        Teams.teamLists[team].buildings.push([x, y, TILE_TYPES.house1, this.sprite])
    }

    canAcceptPlayer() {
        return this.occupants.length < 2;
    }

    static availableHouse(team) {
        const house = Teams.teamLists[team].houseList.find(h => h.canAcceptPlayer());
        if (!house) return false;
        return true;
    }

    static assignPlayerToHouse(player, team){
        const house = Teams.teamLists[team].houseList.find(h => h.canAcceptPlayer());
        if (!house) return false;
        house.assignPlayer(player);
        return true;
    }

    assignPlayer(player) {
        if (!this.canAcceptPlayer()) return false;
        this.occupants.push(player);
        player.home = this;   // 🔑 reference to their house
        return true;
    }

    updateIcons() {
        this.clearIcons(); // always start fresh

        // Create background
        this.iconBg = this.scene.add.rectangle(
            this.sprite.x + 30,
            this.sprite.y - 14,
            64, // width: 2 icons @20px + padding
            22,
            0x000000,
            0.6
        ).setOrigin(0.5).setDepth(9).setStrokeStyle(1, 0xffffff, 0.4);
        this.uiContainer.add(this.iconBg);

        this.uiIcons = this.occupants.map((p, i) => {
            const icon = this.scene.add.sprite(
                this.sprite.x + 16 + i * 28,
                this.sprite.y - 14,
                DEFAULT_PLAYER_PORTRAIT_KEY
            ).setDepth(10);
            applyPortraitKeyToSprite(this.scene, icon, getPlayerPortraitKey(p), 18);
            this.uiContainer.add(icon);
            return icon;
        });

    }

    clearIcons() {
        if (this.iconBg) {
            this.iconBg.destroy();
            this.iconBg = null;
        }

        for (const icon of this.uiIcons) {
            if (icon) icon.destroy();
        }

        this.uiContainer.removeAll(true);

        this.uiIcons = [];
    }

    selectFromWorld(house) {
        if (!house) return;
        this.select(house);
        this.centerOnHouse(house);
    }

    centerOnHouse(house) {
        const cam = this.scene?.uiScene?.worldScene?.cameras?.main || this.scene.cameras.main;
        if (!cam || !house?.sprite) return;

        const b = house.sprite.getBounds();
        cam.centerOn(b.centerX, b.centerY);
    }

    ensureHealthBar() {
        if (!this.sprite) return;
        const scene = this.scene;
        if (!scene) return;

        const fullWidth = this.sprite.displayWidth || (TILE_TYPES.house1.lenX * SQUARESIZE);
        const y = this.sprite.y - this.sprite.displayHeight / 2 - 4;

        if (!this.healthBarBg) {
            this.healthBarBg = scene.add
                .rectangle(this.sprite.x + fullWidth / 2, y, fullWidth, 4, 0x000000, 0.6)
                .setDepth(BLOCKDEPTH + 1);
            Map.addToWorldStatic(this.healthBarBg);
        }
        if (!this.healthBar) {
            this.healthBar = scene.add
                .rectangle(this.sprite.x + fullWidth / 2, y, fullWidth, 2, 0x00ff00, 1)
                .setDepth(BLOCKDEPTH + 2);
            Map.addToWorldStatic(this.healthBar);
        }
    }

    updateHealthBar() {
        if (!this.sprite) return;
        this.ensureHealthBar();

        if (!this.healthBar || !this.healthBarBg) return;
        const fullWidth = this.sprite.displayWidth || (TILE_TYPES.house1.lenX * SQUARESIZE);
        const ratio = this.maxHealth > 0 ? Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1) : 0;

        this.healthBarBg.setDisplaySize(fullWidth, 4);
        this.healthBar.setDisplaySize(fullWidth * ratio, 2);

        const now = this.scene?.time?.now ?? 0;
        const visible = this.isHovered || now < this._damageBarUntil;
        this.healthBarBg.setVisible(visible);
        this.healthBar.setVisible(visible);
    }

    shakeAndFlash() {
        if (!this.sprite) return;
        const targets = [this.sprite];
        if (this.healthBarBg) targets.push(this.healthBarBg);
        if (this.healthBar)   targets.push(this.healthBar);

        this.scene.tweens.add({
            targets,
            x: "+=3",
            yoyo: true,
            duration: 40,
            repeat: 2
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
        const now = House.scene?.time?.now ?? 0;
        this._damageBarUntil = now + 2000;
        this.updateHealthBar();
        // 🔑 force a visibility re-check after expiry (so it hides without hover)
        this._damageBarTimer?.remove(false);
        this._damageBarTimer = House.scene.time.delayedCall(2000, () => {
            this.updateHealthBar?.();
        });


        const fullWidth = this.sprite.displayWidth || (TILE_TYPES.house1.lenX * SQUARESIZE);
        const textX = this.sprite.x + fullWidth / 2;
        const textY = this.sprite.y - this.sprite.displayHeight / 2 - 8;

        showGhostText(
            this.scene,
            textX,
            textY,
            `-${damage}`,
            this.team, 0, 0,
            '#ff5555'
        );
    }

    destroy() {
        this._damageBarTimer?.remove(false);
        this._damageBarTimer = null;
        
        // remove from team house list so UI rows vanish
        const list = Teams.teamLists?.[this.team]?.houseList;
        if (Array.isArray(list)) {
            const i = list.indexOf(this);
            if (i !== -1) list.splice(i, 1);
        }

        if (this.visionId) VisibilitySystem.removeVisionBubble(this.visionId);
        if (this.lightId)  VisibilitySystem.removeLightById(this.lightId);
        if (this.healthBarBg) this.healthBarBg.destroy();
        if (this.healthBar)   this.healthBar.destroy();
        this.sprite?.destroy();
        this.clearIcons?.();
    }
}
