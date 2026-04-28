import Phaser from "phaser";
import { getCardHand } from "../Powerups";
import { getCardOutlineTint } from "../CardPreview";
import {
  BOTTOM_BAR_THEME,
  makeGlassRoundRect,
  mixColor,
} from "./BottomBarTheme";

const CARD_W = 196;
const MIN_CARD_H = 94;
const CARD_GAP = 12;
const TAB_H = 120;
const STRIP_H = 98;
const TAB_BASE_DEPTH = 51;
const MIN_TAB_W = 420;

export default class CardsTab {
  constructor(scene, teamNumber = 1) {
    this.scene = scene;
    this.teamNumber = String(teamNumber);
    this._cardRefs = [];
    this._onWheel = null;
    this._onResize = () => {
      if (!this.view) return;
      this.buildShell();
      this.rebuild();
    };

    this.view = scene.rexUI.add.sizer({
      orientation: "y",
      width: this.getTabWidth(),
      height: TAB_H,
      space: { left: 8, right: 8, top: 4, bottom: 2, item: 4 },
    }).setDepth(TAB_BASE_DEPTH);

    this.buildShell();
    this.bindScrollInput();
    this.scene.scale.on("resize", this._onResize);
    this.rebuild();
  }

  destroy() {
    this.scene.scale.off("resize", this._onResize);
    if (this._onWheel) {
      this.scene.input.off("wheel", this._onWheel);
      this._onWheel = null;
    }
    this.view?.destroy(true);
    this.view = null;
    this.listBody = null;
    this.scroll = null;
    this._cardRefs = [];
  }

  onShow() {
    this.refresh();
  }

  hide() {}

  refresh() {
    this.rebuild();
  }

  getTabWidth() {
    return Math.max(MIN_TAB_W, this.scene.scale.width - 20);
  }

  getStripWidth() {
    return Math.max(MIN_TAB_W - 16, this.scene.scale.width - 36);
  }

  getCardHeight() {
    const boundsHeight = this.scroll?.getBounds?.()?.height;
    const scrollHeight = boundsHeight ?? this.scroll?.height ?? STRIP_H;
    return Math.max(MIN_CARD_H, Math.floor(scrollHeight - 8));
  }

  buildShell() {
    const scene = this.scene;
    const tabWidth = this.getTabWidth();
    const stripWidth = this.getStripWidth();

    this.view.removeAll(true);
    this.view.setMinSize(tabWidth, TAB_H);
    this.view.addBackground(makeGlassRoundRect(scene, 0, 0, 18, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.08),
      alpha: 0.78,
      stroke: 0x98e7ff,
      strokeAlpha: 0.14,
    }));

    const titleLabel = scene.rexUI.add.label({
      background: makeGlassRoundRect(scene, 0, 0, 12, {
        fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.16),
        alpha: 0.9,
        stroke: 0x9fe7ff,
        strokeAlpha: 0.24,
      }),
      text: scene.add.text(0, 0, "CARD DECK", {
        fontFamily: "Bungee",
        fontSize: "13px",
        color: BOTTOM_BAR_THEME.text,
        stroke: "#081621",
        strokeThickness: 3,
        letterSpacing: 0.6,
      }),
      space: { left: 14, right: 14, top: 6, bottom: 6 },
    });

    this.countText = scene.add.text(0, 0, "0 CARDS", {
      fontFamily: "Bungee",
      fontSize: "11px",
      color: "#000000",
      stroke: "#ffffff",
      strokeThickness: 1,
    }).setAlpha(1);
    this.countText.setColor("#000000");
    this.countText.setTint(0x000000);

    const countLabel = scene.rexUI.add.label({
      background: makeGlassRoundRect(scene, 0, 0, 11, {
        fill: mixColor(0xffd47c, 0xffffff, 0.14),
        alpha: 0.92,
        stroke: 0xfff1b3,
        strokeAlpha: 0.26,
      }),
      text: this.countText,
      space: { left: 12, right: 12, top: 4, bottom: 4 },
    });
    this.countText.setDepth(this.countText.depth + 1 || 10);
    const header = scene.rexUI.add.sizer({
      orientation: "x",
      space: { left: 4, right: 4, item: 8 },
    });
    header.add(titleLabel, { proportion: 0, expand: false, align: "left" });
    header.add(scene.add.zone(0, 0, 1, 1), { proportion: 1, expand: true });
    header.add(countLabel, { proportion: 0, expand: false, align: "right" });

    this.listBody = scene.rexUI.add.sizer({
      orientation: "x",
      space: { left: 6, right: 6, top: 1, bottom: 1, item: CARD_GAP },
    });

    this.scroll = scene.rexUI.add.scrollablePanel({
      width: stripWidth,
      height: STRIP_H,
      scrollMode: 1,
      scrollDetectionMode: "rectBounds",
      background: makeGlassRoundRect(scene, 0, 0, 18, {
        fill: mixColor(BOTTOM_BAR_THEME.panelFill, 0xffffff, 0.08),
        alpha: 0.76,
        stroke: 0x98e7ff,
        strokeAlpha: 0.16,
      }),
      panel: { child: this.listBody, mask: { padding: 1 } },
      scrollerX: {
        pointerOutRelease: true,
        rectBoundsInteractive: true,
      },
      space: { left: 6, right: 6, top: 2, bottom: 2, panel: 8 },
    }).setDepth(TAB_BASE_DEPTH);

    this.view.add(header, { proportion: 0, expand: true });
    this.view.add(this.scroll, { proportion: 1, expand: true });
    this.view.layout();
  }

  bindScrollInput() {
    if (this._onWheel) return;

    this._onWheel = (pointer, _gameObjects, dx, dy) => {
      if (this.scene.uiBottomBar?.currentPage !== "cards") return;
      if (!this.scene.uiBottomBar?.expanded) return;
      if (!this.scroll?.isOverflowX) return;
      if (!this.isPointerOverScroll(pointer)) return;

      const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(dominantDelta) < 0.1) return;

      this.scroll.addChildOX(-dominantDelta * 0.8, true);
      this.scene.input.stopPropagation();
    };

    this.scene.input.on("wheel", this._onWheel);
  }

  isPointerOverScroll(pointer) {
    if (!pointer || !this.scroll?.getBounds) return false;
    const bounds = this.scroll.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
  }

  rebuild() {
    if (!this.listBody || !this.scroll) return;
    this.view.layout();

    const hand = getCardHand(this.teamNumber) || [];
    const cardHeight = this.getCardHeight();

    this.listBody.removeAll(true);
    this.listBody.setMinSize(0, cardHeight);
    this._cardRefs = [];
    this.countText?.setText(`${hand.length} ${hand.length === 1 ? "CARD" : "CARDS"}`);
    this.countText?.setColor?.("#000000");
    this.countText?.setTint?.(0x000000);
    this.countText?.setAlpha?.(1);

    if (hand.length === 0) {
      this.listBody.add(this.createEmptyState(cardHeight), { proportion: 0, expand: true, align: "center" });
      this.scroll.setChildOX?.(0, true);
      this.scroll.layout();
      this.view.layout();
      return;
    }

    hand.forEach((card, index) => {
      const ref = this.createCard(card, index, cardHeight);
      this._cardRefs.push(ref);
      this.listBody.add(ref.card, { proportion: 0, expand: true, align: "center" });
    });

    this.scroll.setChildOX?.(0, true);
    this.scroll.layout();
    this.view.layout();
  }

  createEmptyState(cardHeight = this.getCardHeight()) {
    const scene = this.scene;
    const shell = scene.rexUI.add.sizer({
      orientation: "y",
      width: Math.max(280, this.getStripWidth() - 32),
      height: cardHeight,
      space: { left: 14, right: 14, top: 12, bottom: 10, item: 4 },
    });
    shell.setMinSize(Math.max(280, this.getStripWidth() - 32), cardHeight);
    shell.addBackground(makeGlassRoundRect(scene, 0, 0, 16, {
      fill: mixColor(BOTTOM_BAR_THEME.cardFill, 0x72d8ff, 0.08),
      alpha: 0.9,
      stroke: 0x98e7ff,
      strokeAlpha: 0.18,
    }));

    shell.add(scene.add.text(0, 0, "NO CARDS YET", {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: BOTTOM_BAR_THEME.text,
      stroke: "#081621",
      strokeThickness: 3,
    }), { proportion: 0, expand: false, align: "center" });

    shell.add(scene.add.text(0, 0, "Earn or buy town powerups to fill this deck.", {
      fontFamily: "Bungee",
      fontSize: "8px",
      color: BOTTOM_BAR_THEME.textMuted,
      stroke: "#081621",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: Math.max(240, this.getStripWidth() - 72) },
    }), { proportion: 0, expand: false, align: "center" });

    return shell;
  }

  createCard(card, index, cardHeight = this.getCardHeight()) {
    const scene = this.scene;
    const tint = getCardOutlineTint(card);
    const softTint = mixColor(tint, 0xffffff, 0.35);

    const shell = scene.rexUI.add.overlapSizer({
      width: CARD_W,
      height: cardHeight,
    });
    shell.setMinSize(CARD_W, cardHeight);

    const bg = makeGlassRoundRect(scene, CARD_W, cardHeight, 18, {
      fill: mixColor(BOTTOM_BAR_THEME.cardFill, tint, 0.12),
      alpha: 0.94,
      stroke: tint,
      strokeAlpha: 0.4,
      strokeWidth: 2,
    });

    const shine = scene.add.rectangle(0, (-cardHeight / 2) + 14, CARD_W - 24, 14, 0xffffff, 0.06)
      .setOrigin(0.5);

    const iconPlate = scene.rexUI.add.overlapSizer({ width: 44, height: 44 });
    iconPlate.addBackground(makeGlassRoundRect(scene, 44, 44, 12, {
      fill: mixColor(BOTTOM_BAR_THEME.panelFill, tint, 0.15),
      alpha: 0.84,
      stroke: softTint,
      strokeAlpha: 0.18,
      strokeWidth: 1.5,
    }));
    const icon = scene.textures.exists(card?.image)
      ? scene.add.image(0, 0, card.image).setDisplaySize(24, 24)
      : scene.add.rectangle(0, 0, 24, 24, softTint, 0.25).setStrokeStyle(2, tint, 0.4);
    iconPlate.add(icon, { align: "center" });

    const tagLabel = scene.rexUI.add.label({
      background: makeGlassRoundRect(scene, 0, 0, 8, {
        fill: mixColor(tint, 0x0c1a24, 0.2),
        alpha: 0.96,
        stroke: 0xffffff,
        strokeAlpha: 0.12,
        strokeWidth: 1,
      }),
      text: scene.add.text(0, 0, `#${index + 1}`, {
        fontFamily: "Bungee",
        fontSize: "9px",
        color: "#fff9df",
        stroke: "#081621",
        strokeThickness: 2,
      }),
      space: { left: 8, right: 8, top: 3, bottom: 3 },
    });

    const name = scene.add.text(0, 0, String(card?.name || "Card"), {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: BOTTOM_BAR_THEME.text,
      stroke: "#081621",
      strokeThickness: 2,
      wordWrap: { width: CARD_W - 88 },
    });

    const body = scene.add.text(0, 0, String(card?.text || ""), {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: BOTTOM_BAR_THEME.textSoft,
      stroke: "#081621",
      strokeThickness: 2,
      lineSpacing: 2,
      wordWrap: { width: CARD_W - 88 },
    });

    const right = scene.rexUI.add.sizer({
      orientation: "y",
      space: { item: 4 },
    });
    right.add(tagLabel, { proportion: 0, expand: false, align: "left" });
    right.add(name, { proportion: 0, expand: false, align: "left" });

    const top = scene.rexUI.add.sizer({
      orientation: "x",
      space: { item: 8 },
    });
    top.add(iconPlate, { proportion: 0, expand: false, align: "center" });
    top.add(right, { proportion: 1, expand: true, align: "center" });

    const content = scene.rexUI.add.sizer({
      orientation: "y",
      width: CARD_W - 20,
      height: cardHeight - 18,
      space: { left: 10, right: 10, top: 10, bottom: 10, item: 6 },
    });
    content.setMinSize(CARD_W - 20, cardHeight - 18);
    content.add(top, { proportion: 0, expand: true });
    content.add(body, { proportion: 1, expand: true, align: "left" });

    const hit = scene.add.zone(0, 0, CARD_W, cardHeight).setInteractive({ useHandCursor: true });
    shell.addBackground(bg);
    shell.add(shine, { align: "center" });
    shell.add(content, { align: "center" });
    shell.add(hit, { align: "center", expand: true });

    const applyState = (hovered) => {
      scene.tweens.killTweensOf(shell);
      scene.tweens.add({
        targets: shell,
        scaleX: hovered ? 1.02 : 1,
        scaleY: hovered ? 1.02 : 1,
        duration: 140,
        ease: "Quad.easeOut",
      });
      bg.setFillStyle(mixColor(BOTTOM_BAR_THEME.cardFill, tint, hovered ? 0.18 : 0.12), hovered ? 0.98 : 0.94);
      bg.setStrokeStyle(hovered ? 3 : 2, tint, hovered ? 0.8 : 0.4);
    };

    hit.on("pointerover", () => applyState(true));
    hit.on("pointerout", () => applyState(false));

    return { card: shell, hit };
  }
}
