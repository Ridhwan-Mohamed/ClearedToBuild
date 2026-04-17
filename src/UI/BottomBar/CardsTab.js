import Phaser from "phaser";
import { UIDEPTH } from "../../constants";
import { getCardHand } from "../Powerups";
import { getCardOutlineTint } from "../CardPreview";
import {
  BOTTOM_BAR_THEME,
  makeGlassRoundRect,
  mixColor,
} from "./BottomBarTheme";

const CARD_W = 154;
const CARD_H = 176;
const CARD_GAP = 20;
const HEADER_Y = -122;
const VIEWPORT_Y = -80;
const VIEWPORT_H = 176;
const COUNT_PILL_W = 108;

export default class CardsTab {
  constructor(scene, teamNumber = 1) {
    this.scene = scene;
    this.teamNumber = String(teamNumber);
    this.view = scene.add.container(0, 0).setDepth(UIDEPTH);

    this._cardRefs = [];
    this._dragging = false;
    this._dragStartX = 0;
    this._scrollStart = 0;
    this._scrollX = 0;
    this._contentWidth = 0;
    this._onWheel = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this._onResize = () => {
      if (!this.view) return;
      this.view.removeAll(true);
      this._maskShape?.destroy();
      this._cardRefs = [];
      this._buildFrame();
      this.rebuild();
    };

    this._buildFrame();
    this._bindScrollInput();
    this.scene.scale.on("resize", this._onResize);
    this.rebuild();
  }

  destroy() {
    this.scene.scale.off("resize", this._onResize);
    if (this._onWheel) {
      this.scene.input.off("wheel", this._onWheel);
      this._onWheel = null;
    }
    if (this._onPointerMove) {
      this.scene.input.off("pointermove", this._onPointerMove);
      this._onPointerMove = null;
    }
    if (this._onPointerUp) {
      this.scene.input.off("pointerup", this._onPointerUp);
      this._onPointerUp = null;
    }
    this._maskShape?.destroy();
    this.view?.destroy(true);
    this.view = null;
    this._cardRefs = [];
  }

  onShow() {
    this.refresh();
  }

  hide() {}

  refresh() {
    this.rebuild();
  }

  _buildFrame() {
    const scene = this.scene;
    const viewportW = Math.max(440, scene.scale.width - 138);
    this.viewport = {
      x: 0,
      y: VIEWPORT_Y,
      w: viewportW,
      h: VIEWPORT_H,
      left: -viewportW / 2,
      top: VIEWPORT_Y,
    };

    this.headerPlate = makeGlassRoundRect(scene, 244, 34, 16, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.16),
      alpha: 0.9,
      stroke: 0x9fe7ff,
      strokeAlpha: 0.24,
    }).setPosition(0, HEADER_Y);

    this.headerText = scene.add.text(0, HEADER_Y, "CARD DECK", {
      fontFamily: "Bungee",
      fontSize: "16px",
      color: BOTTOM_BAR_THEME.text,
      stroke: "#081621",
      strokeThickness: 3,
      letterSpacing: 1,
    }).setOrigin(0.5);

    this.countPill = makeGlassRoundRect(scene, COUNT_PILL_W, 28, 14, {
      fill: mixColor(0xffd47c, 0xffffff, 0.14),
      alpha: 0.92,
      stroke: 0xfff1b3,
      strokeAlpha: 0.26,
    }).setPosition((viewportW / 2) - 86, HEADER_Y);

    this.countText = scene.add.text((viewportW / 2) - 86, HEADER_Y, "0 CARDS", {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: "#fff8d6",
      stroke: "#5a2c00",
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.subText = scene.add.text(0, HEADER_Y + 23, "DRAG OR SCROLL TO BROWSE YOUR ACTIVE TOWN CARDS", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: BOTTOM_BAR_THEME.textMuted,
      stroke: "#081621",
      strokeThickness: 2,
      letterSpacing: 0.3,
    }).setOrigin(0.5);

    this.viewportBg = makeGlassRoundRect(scene, viewportW, VIEWPORT_H, 24, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.08),
      alpha: 0.78,
      stroke: 0x98e7ff,
      strokeAlpha: 0.16,
    }).setPosition(0, VIEWPORT_Y + (VIEWPORT_H / 2));

    this.viewportGlow = scene.add.rectangle(0, VIEWPORT_Y + 18, viewportW - 34, 28, 0xffffff, 0.08)
      .setOrigin(0.5, 0.5);

    this.viewportHit = scene.add.rectangle(0, VIEWPORT_Y + (VIEWPORT_H / 2), viewportW, VIEWPORT_H, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    this.cardsContainer = scene.add.container(this.viewport.left, this.viewport.top);

    this.emptyTitle = scene.add.text(0, VIEWPORT_Y + 58, "No cards yet", {
      fontFamily: "Bungee",
      fontSize: "18px",
      color: BOTTOM_BAR_THEME.text,
      stroke: "#081621",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.emptyBody = scene.add.text(0, VIEWPORT_Y + 90, "Town powerups will show up here once you earn or buy them.", {
      fontFamily: "Bungee",
      fontSize: "11px",
      color: BOTTOM_BAR_THEME.textMuted,
      stroke: "#081621",
      strokeThickness: 2,
      align: "center",
    }).setOrigin(0.5);

    this._maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    this._maskShape.fillStyle(0xffffff, 1);
    this._maskShape.fillRect(this.viewport.left, this.viewport.top, this.viewport.w, this.viewport.h);
    this.cardsContainer.setMask(this._maskShape.createGeometryMask());

    this.viewportHit.on("pointerdown", (pointer) => {
      this._dragging = true;
      this._dragStartX = pointer.x;
      this._scrollStart = this._scrollX;
    });

    this.view.add([
      this.viewportBg,
      this.viewportGlow,
      this.cardsContainer,
      this.viewportHit,
      this.headerPlate,
      this.headerText,
      this.countPill,
      this.countText,
      this.subText,
      this.emptyTitle,
      this.emptyBody,
    ]);
  }

  _bindScrollInput() {
    if (this._onWheel || this._onPointerMove || this._onPointerUp) return;

    this._onPointerMove = (pointer) => {
      if (!this._dragging) return;
      const dx = pointer.x - this._dragStartX;
      this._scrollX = this._scrollStart + dx;
      this._clampScroll();
    };

    this._onPointerUp = () => {
      this._dragging = false;
    };

    this._onWheel = (pointer, _gameObjects, dx, dy) => {
      if (this.scene.uiBottomBar?.currentPage !== "cards") return;
      if (!this._isPointerOverViewport(pointer)) return;
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(delta) < 0.1) return;
      this._scrollX -= delta * 0.82;
      this._clampScroll();
      this.scene.input.stopPropagation();
    };

    this.scene.input.on("pointermove", this._onPointerMove);
    this.scene.input.on("pointerup", this._onPointerUp);
    this.scene.input.on("wheel", this._onWheel);
  }

  _isPointerOverViewport(pointer) {
    if (!pointer || !this.viewportHit?.getBounds) return false;
    const bounds = this.viewportHit.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
  }

  rebuild() {
    if (!this.view) return;
    const hand = getCardHand(this.teamNumber) || [];
    this._cardRefs.forEach((ref) => ref.container?.destroy(true));
    this._cardRefs = [];
    this.cardsContainer.removeAll(true);

    this.countText.setText(`${hand.length} ${hand.length === 1 ? "CARD" : "CARDS"}`);
    this.emptyTitle.setVisible(hand.length === 0);
    this.emptyBody.setVisible(hand.length === 0);

    const availableWidth = this.viewport.w;
    let xCursor = 0;

    hand.forEach((card, index) => {
      const ref = this._createCard(card, xCursor + (CARD_W / 2), 12 + (CARD_H / 2), index);
      this._cardRefs.push(ref);
      this.cardsContainer.add(ref.container);
      xCursor += CARD_W + CARD_GAP;
    });

    this._contentWidth = Math.max(0, xCursor - CARD_GAP);
    if (this._contentWidth <= availableWidth) {
      this._scrollX = Math.floor((availableWidth - this._contentWidth) / 2);
    }
    this._clampScroll();
  }

  _clampScroll() {
    if (!this.cardsContainer) return;
    const viewportLeft = this.viewport.left;
    const availableWidth = this.viewport.w;
    const contentWidth = this._contentWidth || 0;

    if (contentWidth <= availableWidth) {
      this.cardsContainer.x = viewportLeft + Math.floor((availableWidth - contentWidth) / 2);
      return;
    }

    const maxScroll = 0;
    const minScroll = -(contentWidth - availableWidth);
    this._scrollX = Phaser.Math.Clamp(this._scrollX, minScroll, maxScroll);
    this.cardsContainer.x = viewportLeft + this._scrollX;
  }

  _createCard(card, x, y, index) {
    const scene = this.scene;
    const tint = getCardOutlineTint(card);
    const softTint = mixColor(tint, 0xffffff, 0.35);

    const container = scene.add.container(x, y);

    const glow = scene.add.rectangle(0, 8, CARD_W - 10, CARD_H - 18, tint, 0.1)
      .setOrigin(0.5)
      .setAlpha(0.16)
      .setScale(0.94);

    const shadow = scene.add.rectangle(0, 10, CARD_W, CARD_H, 0x031019, 0.18)
      .setOrigin(0.5);

    const outer = makeGlassRoundRect(scene, CARD_W, CARD_H, 24, {
      fill: mixColor(BOTTOM_BAR_THEME.cardFill, tint, 0.12),
      alpha: 0.94,
      stroke: tint,
      strokeAlpha: 0.54,
      strokeWidth: 2,
    });

    const inner = scene.add.rectangle(0, -44, CARD_W - 26, 44, 0xffffff, 0.09).setOrigin(0.5);

    const iconPlate = makeGlassRoundRect(scene, CARD_W - 28, 58, 18, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, tint, 0.15),
      alpha: 0.82,
      stroke: softTint,
      strokeAlpha: 0.18,
      strokeWidth: 1.5,
    }).setPosition(0, -43);

    const icon = scene.textures.exists(card?.image)
      ? scene.add.image(0, -43, card.image).setDisplaySize(42, 42)
      : scene.add.rectangle(0, -43, 42, 42, softTint, 0.25).setStrokeStyle(2, tint, 0.4);

    const tag = makeGlassRoundRect(scene, 72, 22, 11, {
      fill: mixColor(tint, 0x0c1a24, 0.2),
      alpha: 0.96,
      stroke: 0xffffff,
      strokeAlpha: 0.12,
      strokeWidth: 1,
    }).setPosition(0, -74);

    const tagText = scene.add.text(0, -74, `CARD ${index + 1}`, {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#fff9df",
      stroke: "#081621",
      strokeThickness: 2,
    }).setOrigin(0.5);

    const name = scene.add.text(0, -2, String(card?.name || "Card"), {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: BOTTOM_BAR_THEME.text,
      stroke: "#081621",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: CARD_W - 24 },
    }).setOrigin(0.5);

    const body = scene.add.text(0, 52, String(card?.text || ""), {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: BOTTOM_BAR_THEME.textSoft,
      stroke: "#081621",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: CARD_W - 30 },
      lineSpacing: 2,
    }).setOrigin(0.5);

    const hit = scene.add.zone(0, 0, CARD_W, CARD_H)
      .setInteractive({ useHandCursor: true });

    container.add([glow, shadow, outer, inner, iconPlate, icon, tag, tagText, name, body, hit]);

    const baseY = y;
    const baseScale = 1;
    const applyHoverState = (hovered) => {
      scene.tweens.killTweensOf(container);
      scene.tweens.killTweensOf(glow);
      scene.tweens.add({
        targets: container,
        y: hovered ? baseY - 8 : baseY,
        scaleX: hovered ? 1.035 : baseScale,
        scaleY: hovered ? 1.035 : baseScale,
        duration: 150,
        ease: "Quad.easeOut",
      });
      scene.tweens.add({
        targets: glow,
        alpha: hovered ? 0.34 : 0.16,
        scaleX: hovered ? 1.06 : 0.94,
        scaleY: hovered ? 1.08 : 0.94,
        duration: 150,
        ease: "Quad.easeOut",
      });
      outer.setStrokeStyle(hovered ? 3 : 2, tint, hovered ? 0.9 : 0.54);
      iconPlate.setFillStyle(mixColor(BOTTOM_BAR_THEME.panelFill, tint, hovered ? 0.24 : 0.15), hovered ? 0.92 : 0.82);
    };

    hit.on("pointerover", () => applyHoverState(true));
    hit.on("pointerout", () => applyHoverState(false));

    return { container, card, hit };
  }
}
