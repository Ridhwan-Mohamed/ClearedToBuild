import { BLOCKDEPTH, SQUARESIZE, TILE_TYPES, UIDEPTH } from "../constants";
import { Map } from "../map";
import { Teams } from "../Teams";
import { HouseUI } from "../UI/HouseUI";
import { VisibilitySystem } from "../UI/VisibilitySystem";

export class House {

    static scene;

    constructor(x, y, houseType, team) {
        this.scene = House.scene;
        this.x = x;
        this.y = y;
        this.team = team;
        this.occupants = [];
        this.uiContainer = House.scene.add.container(0, 0).setDepth(UIDEPTH);

        this.sprite = House.scene.add.image(x * SQUARESIZE, y * SQUARESIZE, houseType.name)
            .setOrigin(0)
            .setDepth(BLOCKDEPTH)
            .setInteractive()
            .on('pointerdown', () => {
                HouseUI.toggleMajor(this);
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

        this.sprite.on('pointerover', () => this.updateIcons());
        this.sprite.on('pointerout', () => this.clearIcons());

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
            const icon = this.scene.add.image(
                this.sprite.x + 16 + i * 28,
                this.sprite.y - 14,
                'char'
            ).setDepth(10).setScale(0.4);
            this.uiContainer.add(icon);
            icon.setTint(p.tint);
            return icon;
        });

        this.scene.uiCamera.ignore([this.uiContainer])
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

    destroy() {
        if (this.visionId) VisibilitySystem.removeVisionBubble(this.visionId);
        if (this.lightId)  VisibilitySystem.removeLightById(this.lightId);
        this.sprite?.destroy();
        this.clearIcons?.();
    }


}
