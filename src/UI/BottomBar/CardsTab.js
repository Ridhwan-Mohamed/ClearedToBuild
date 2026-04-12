import Phaser from "phaser";
import { UIDEPTH } from "../../constants";
import { getCardHand } from "../Powerups";
import { getCardOutlineTint } from "../CardPreview";

const CARD_W = 154;
const CARD_H = 184;
const CARD_GAP = 22;

export default class CardsTab {
    constructor(scene) {
        this.scene = scene;
        this.team = "1";
        this.view = scene.add.container(0, 0).setDepth(UIDEPTH);
        this._cardsScrollX = 0;
        this._cardsContentW = 0;
        this._cardsDragging = false;
        this._cardsScrollHooksBound = false;
        this._onCardsPointerUp = null;
        this._onCardsPointerMove = null;
        this._onCardsWheel = null;
        this._cardsViewport = null;
        this._cardsViewportHit = null;
        this._cardsContainer = null;
        this.countText = null;

        this._onResize = () => {
            this.buildUI();
            this.refresh();
        };

        this.buildUI();
        this.refresh();

        scene.events.on("cards:updated", this.refresh, this);
        scene.scale.on("resize", this._onResize);
    }

    destroy() {
        this.scene?.events?.off?.("cards:updated", this.refresh, this);
        this.scene?.scale?.off?.("resize", this._onResize);
        if (this._onCardsPointerUp) {
            this.scene?.input?.off?.("pointerup", this._onCardsPointerUp);
            this._onCardsPointerUp = null;
        }
        if (this._onCardsPointerMove) {
            this.scene?.input?.off?.("pointermove", this._onCardsPointerMove);
            this._onCardsPointerMove = null;
        }
        if (this._onCardsWheel) {
            this.scene?.input?.off?.("wheel", this._onCardsWheel);
            this._onCardsWheel = null;
        }
        this._cardsViewportHit = null;
        this._cardsViewport = null;
        this._cardsContainer = null;
        this.view?.destroy?.(true);
    }

    buildUI() {
        this.view.removeAll(true);

        const scene = this.scene;
        const centerX = 0;
        const topY = -124;

        const headerBg = scene.add.rectangle(centerX, topY + 18, 290, 34, 0x143247, 0.95)
            .setStrokeStyle(2, 0xbfefff, 0.24);
        const headerText = scene.add.text(centerX, topY + 18, "CARD DECK", {
            fontSize: "14px",
            fontFamily: "Bungee",
            color: "#fff7e6",
            stroke: "#07111b",
            strokeThickness: 3,
        }).setOrigin(0.5);
        this.countText = scene.add.text(centerX + 212, topY + 18, "0 cards", {
            fontSize: "11px",
            fontFamily: "Bungee",
            color: "#bfefff",
            stroke: "#07111b",
            strokeThickness: 2,
        }).setOrigin(1, 0.5);
        const hintText = scene.add.text(centerX, topY + 48, "Drag or mouse-wheel to browse the whole deck.", {
            fontSize: "10px",
            fontFamily: "Bungee",
            color: "#bdd7e8",
            stroke: "#07111b",
            strokeThickness: 2,
        }).setOrigin(0.5);

        const viewportW = scene.scale.width - 150;
        const viewportH = CARD_H + 24;
        const viewportCenterY = topY + 136;
        const viewportLeft = centerX - (viewportW / 2);
        const viewportTop = viewportCenterY - (viewportH / 2);

        const laneShadow = scene.add.rectangle(centerX, viewportCenterY + 8, viewportW, viewportH, 0x04101a, 0.26)
            .setStrokeStyle(2, 0xffffff, 0.03);
        const laneBg = scene.add.rectangle(centerX, viewportCenterY, viewportW, viewportH, 0x0d2233, 0.92)
            .setStrokeStyle(2, 0xbfefff, 0.12);
        const laneGlow = scene.add.rectangle(centerX, viewportCenterY - 24, viewportW - 24, 66, 0x7dd3fc, 0.07);

        const viewportHit = scene.add.rectangle(centerX, viewportCenterY, viewportW, viewportH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const cardsContainer = scene.add.container(viewportLeft, viewportTop);

        const maskGraphic = scene.add.graphics();
        maskGraphic.fillStyle(0xffffff, 1);
        maskGraphic.fillRect(viewportLeft, viewportTop, viewportW, viewportH);
        maskGraphic.setVisible(false);
        cardsContainer.setMask(maskGraphic.createGeometryMask());

        this.view.add([
            headerBg,
            headerText,
            this.countText,
            hintText,
            laneShadow,
            laneBg,
            laneGlow,
            viewportHit,
            cardsContainer,
            maskGraphic,
        ]);

        this._cardsViewport = { left: viewportLeft, top: viewportTop, w: viewportW, h: viewportH };
        this._cardsViewportHit = viewportHit;
        this._cardsContainer = cardsContainer;
        this._enableCardScrolling(viewportHit);
    }

    _clearCardEntries() {
        if (!this._cardsContainer) return;
        this._cardsContainer.removeAll(true);
    }

    _clampCardsScroll() {
        if (!this._cardsContainer || !this._cardsViewport) return;

        const { left, w } = this._cardsViewport;
        if (this._cardsContentW <= w) {
            this._cardsScrollX = 0;
            this._cardsContainer.x = left;
            return;
        }

        const minScroll = -(this._cardsContentW - w);
        this._cardsScrollX = Phaser.Math.Clamp(this._cardsScrollX, minScroll, 0);
        this._cardsContainer.x = left + this._cardsScrollX;
    }

    _enableCardScrolling(viewportHit) {
        viewportHit.on("pointerdown", (pointer) => {
            this._cardsDragging = true;
            this._cardsDragStartX = pointer.x;
            this._cardsScrollStart = this._cardsScrollX || 0;
        });

        if (this._cardsScrollHooksBound) return;
        this._cardsScrollHooksBound = true;

        this._onCardsPointerUp = () => {
            this._cardsDragging = false;
        };
        this.scene.input.on("pointerup", this._onCardsPointerUp);

        this._onCardsPointerMove = (pointer) => {
            if (!this._cardsDragging) return;
            const dx = pointer.x - this._cardsDragStartX;
            this._cardsScrollX = this._cardsScrollStart + dx;
            this._clampCardsScroll();
        };
        this.scene.input.on("pointermove", this._onCardsPointerMove);

        this._onCardsWheel = (pointer, gameObjects, dx, dy) => {
            const bounds = this._cardsViewportHit?.getBounds?.();
            if (!bounds) return;
            if (!Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y)) return;

            const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
            if (Math.abs(dominantDelta) < 0.1) return;

            this._cardsScrollX -= dominantDelta * 0.8;
            this._clampCardsScroll();
        };
        this.scene.input.on("wheel", this._onCardsWheel);
    }

    _makeCardTile(card, index, x, y) {
        const scene = this.scene;
        const tint = getCardOutlineTint(card);
        const tile = scene.add.container(x, y);
        const frameKey = scene.textures.exists("reward_mini_card") ? "reward_mini_card" : "__WHITE";
        const iconKey = scene.textures.exists(card?.image) ? card.image : "__WHITE";

        const plateShadow = scene.add.image(4, 8, frameKey)
            .setTint(0x04101a)
            .setAlpha(frameKey === "__WHITE" ? 0.16 : 0.22);
        const plate = scene.add.image(0, 0, frameKey)
            .setTint(frameKey === "__WHITE" ? tint : 0xffffff)
            .setAlpha(frameKey === "__WHITE" ? 0.16 : 1);
        plateShadow.setDisplaySize(138, 164);
        plate.setDisplaySize(138, 164);

        const glow = scene.add.circle(0, -34, 30, tint, 0.12);
        const iconPlate = scene.add.circle(0, -36, 28, 0x0d2233, 0.96)
            .setStrokeStyle(2, tint, 0.26);
        const icon = scene.add.image(0, -36, iconKey).setDisplaySize(42, 42);

        const indexBadge = scene.add.rectangle(38, -64, 36, 22, 0x0c2b3f, 0.96)
            .setStrokeStyle(2, tint, 0.3);
        const indexText = scene.add.text(38, -64, `#${index + 1}`, {
            fontSize: "8px",
            fontFamily: "Bungee",
            color: "#fff7e6",
            stroke: "#07111b",
            strokeThickness: 2,
        }).setOrigin(0.5);

        const name = scene.add.text(0, 12, card?.name || "Mystery Card", {
            fontSize: "10px",
            fontFamily: "Bungee",
            color: "#fff7e6",
            stroke: "#07111b",
            strokeThickness: 3,
            align: "center",
            wordWrap: { width: CARD_W - 46 },
        }).setOrigin(0.5);
        const desc = scene.add.text(0, 56, card?.text || "", {
            fontSize: "8px",
            fontFamily: "Bungee",
            color: "#d7efff",
            stroke: "#07111b",
            strokeThickness: 2,
            align: "center",
            wordWrap: { width: CARD_W - 42 },
            lineSpacing: 4,
        }).setOrigin(0.5);

        tile.add([plateShadow, plate, glow, iconPlate, icon, indexBadge, indexText, name, desc]);
        return tile;
    }

    refresh = () => {
        if (!this.view?.scene || !this._cardsContainer) return;

        const hand = getCardHand(this.team);
        this._clearCardEntries();
        this.countText?.setText?.(`${hand.length} card${hand.length === 1 ? "" : "s"}`);

        if (!hand.length) {
            const emptyTitle = this.scene.add.text(
                this._cardsViewport.w / 2,
                this._cardsViewport.h / 2 - 14,
                "No cards yet",
                {
                    fontSize: "14px",
                    fontFamily: "Bungee",
                    color: "#fff7e6",
                    stroke: "#07111b",
                    strokeThickness: 3,
                }
            ).setOrigin(0.5);
            const emptyHint = this.scene.add.text(
                this._cardsViewport.w / 2,
                this._cardsViewport.h / 2 + 14,
                "Level rewards and shops will start filling this deck.",
                {
                    fontSize: "10px",
                    fontFamily: "Bungee",
                    color: "#bcd6e6",
                    stroke: "#07111b",
                    strokeThickness: 2,
                    align: "center",
                }
            ).setOrigin(0.5);
            this._cardsContainer.add([emptyTitle, emptyHint]);
            this._cardsContentW = 0;
            this._clampCardsScroll();
            return;
        }

        let xCursor = 10;
        const centerY = this._cardsViewport.h / 2;
        hand.forEach((card, index) => {
            const tileX = xCursor + (CARD_W / 2);
            const tile = this._makeCardTile(card, index, tileX, centerY);
            this._cardsContainer.add(tile);
            xCursor += CARD_W + CARD_GAP;
        });

        this._cardsContentW = Math.max(0, xCursor - CARD_GAP + 10);
        this._clampCardsScroll();
    };
}
