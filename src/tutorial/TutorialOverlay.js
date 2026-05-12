import Phaser from "phaser";
import { UIDEPTH } from "../constants.js";
import { AudioManager } from "../Manager/AudioManager.js";
import { TUTORIAL_SPEAKERS } from "./TutorialAssets.js";

const OVERLAY_DEPTH = UIDEPTH + 520;
const TYPE_DELAY_MS = 27;

export class TutorialOverlay {
  constructor(scene, manager) {
    this.scene = scene;
    this.manager = manager;
    this.root = null;
    this.promptRoot = null;
    this.currentStep = null;
    this.typeEvent = null;
    this.fullText = "";
    this.visibleText = "";
    this.isTyping = false;
    this._charIndex = 0;
    this.avatarFrameEvent = null;
    this._avatarFrameIndex = 0;
    this._spaceHandler = null;
    this._resizeHandler = null;
  }

  destroy() {
    this.typeEvent?.remove(false);
    this.typeEvent = null;
    this.avatarFrameEvent?.remove(false);
    this.avatarFrameEvent = null;
    this._unbindSpace();
    this._setResizeHandler(null);
    this.promptRoot?.destroy?.(true);
    this.promptRoot = null;
    this.root?.destroy?.(true);
    this.root = null;
  }

  showPrompt({ onStart, onSkip } = {}) {
    this.promptRoot?.destroy?.(true);
    this.root?.setVisible?.(false);

    const cam = this.scene.cameras.main;
    const root = this.scene.add.container(0, 0).setDepth(OVERLAY_DEPTH).setScrollFactor(0);
    const shade = this.scene.add.rectangle(0, 0, cam.width, cam.height, 0x031019, 0.52)
      .setOrigin(0)
      .setInteractive({ useHandCursor: false });
    const card = this.scene.add.container(cam.width / 2, cam.height * 0.52);
    const width = Math.min(560, cam.width - 44);
    const height = 250;
    const bg = this.scene.add.graphics();
    this._drawPanel(bg, width, height, 0x123148, 0x9ee7ff, 26);
    const title = this.scene.add.text(0, -78, "PLAY SHORT TUTORIAL?", {
      fontFamily: "Bungee",
      fontSize: "24px",
      color: "#f4fbff",
      stroke: "#04111a",
      strokeThickness: 5,
      align: "center",
    }).setOrigin(0.5);
    const body = this.scene.add.text(0, -24, "A quick guided start explains farming, parcels, building, water and defense.", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#c7e8f5",
      stroke: "#04111a",
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: width - 86 },
      lineSpacing: 6,
    }).setOrigin(0.5);

    const yes = this._makeButton(-112, 74, 166, "START", "#eafffb", 0x1f7667, onStart);
    const no = this._makeButton(112, 74, 166, "SKIP", "#ffe7ed", 0x682a3a, onSkip);
    card.add([bg, title, body, ...yes, ...no]);
    root.add([shade, card]);

    this.promptRoot = root;
    this._setResizeHandler(() => {
      shade.setSize(this.scene.scale.width, this.scene.scale.height);
      card.setPosition(this.scene.scale.width / 2, this.scene.scale.height * 0.52);
    });
  }

  showStep(step, opts = {}) {
    this.promptRoot?.destroy?.(true);
    this.promptRoot = null;
    this.currentStep = step;
    this._ensureSpeechRoot();
    this._setResizeHandler(() => this._layoutSpeech());
    this.root.setVisible(true).setAlpha(1);

    const speaker = TUTORIAL_SPEAKERS[step.speaker] ?? TUTORIAL_SPEAKERS.farmer;
    this.avatar.anims?.stop?.();
    this.avatar.setTexture(speaker.textureKey, 0).setFrame(0).setVisible(true);
    this.nameText.setText(speaker.name).setColor(speaker.textColor);
    this.fullText = String(step.text || "");
    this.visibleText = "";
    this.bodyText.setText("");
    this.nextText.setText(step.waitFor ? "WAITING" : (step.completeOnAdvance ? "DONE" : "NEXT"));
    this.nextHint.setText(step.waitFor ? "finish the highlighted action" : "click or press space");
    this._setNextEnabled(!step.waitFor);
    this._layoutSpeech();
    this._startTyping(speaker);
  }

  relayout() {
    this._layoutSpeech();
  }

  finishCurrentText() {
    if (!this.isTyping) return false;
    this.typeEvent?.remove(false);
    this.typeEvent = null;
    this.isTyping = false;
    this.visibleText = this.fullText;
    this.bodyText.setText(this.fullText);
    this.avatarFrameEvent?.remove(false);
    this.avatarFrameEvent = null;
    this.avatar?.anims?.stop?.();
    this.avatar?.setFrame?.(0);
    return true;
  }

  _startTyping(speaker) {
    this.typeEvent?.remove(false);
    this.typeEvent = null;
    this._charIndex = 0;
    this.visibleText = "";
    this.isTyping = true;
    this._startSpeakerFrames(speaker);

    this.typeEvent = this.scene.time.addEvent({
      delay: TYPE_DELAY_MS,
      loop: true,
      callback: () => {
        if (this._charIndex >= this.fullText.length) {
          this.finishCurrentText();
          return;
        }

        const char = this.fullText[this._charIndex];
        this.visibleText += char;
        this.bodyText.setText(this.visibleText);
        if (char.trim() && this._charIndex % 3 === 0) {
          AudioManager.playUiType({ volume: 0.12, rate: 0.96 + Math.random() * 0.12 });
        }
        this._charIndex += 1;
      },
    });
  }

  _ensureSpeechRoot() {
    if (this.root?.active) return;

    this.root = this.scene.add.container(0, 0).setDepth(OVERLAY_DEPTH).setScrollFactor(0);
    this.shadow = this.scene.add.graphics();
    this.panel = this.scene.add.graphics();
    this.avatarPlate = this.scene.add.graphics();
    this.avatar = this.scene.add.sprite(0, 0, TUTORIAL_SPEAKERS.farmer.textureKey, 0)
      .setOrigin(0.5)
      .setDisplaySize(128, 128);
    this.nameText = this.scene.add.text(0, 0, "", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#ffffff",
      stroke: "#04111a",
      strokeThickness: 4,
      align: "center",
    }).setOrigin(0.5);
    this.bodyText = this.scene.add.text(0, 0, "", {
      fontFamily: "Bungee",
      fontSize: "15px",
      color: "#f4fbff",
      stroke: "#04111a",
      strokeThickness: 3,
      align: "left",
      lineSpacing: 5,
      wordWrap: { width: 480 },
    }).setOrigin(0, 0);
    this.nextBg = this.scene.add.graphics();
    this.nextText = this.scene.add.text(0, 0, "NEXT", {
      fontFamily: "Bungee",
      fontSize: "13px",
      color: "#eafffb",
      stroke: "#04111a",
      strokeThickness: 3,
      align: "center",
    }).setOrigin(0.5);
    this.nextHint = this.scene.add.text(0, 0, "click or press space", {
      fontFamily: "Bungee",
      fontSize: "8px",
      color: "#bfe9f5",
      stroke: "#04111a",
      strokeThickness: 2,
      align: "center",
    }).setOrigin(0.5);
    this.nextHit = this.scene.add.zone(0, 0, 116, 42)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.nextHit.on("pointerdown", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      this._handleAdvanceInput();
    });

    this.root.add([
      this.shadow,
      this.panel,
      this.avatarPlate,
      this.avatar,
      this.nameText,
      this.bodyText,
      this.nextBg,
      this.nextText,
      this.nextHint,
      this.nextHit,
    ]);

    this._bindSpace();
  }

  _bindSpace() {
    if (this._spaceHandler || !this.scene.input?.keyboard) return;
    this._spaceHandler = (event) => {
      if (event?.repeat) return;
      this._handleAdvanceInput();
    };
    this.scene.input.keyboard.on("keydown-SPACE", this._spaceHandler);
  }

  _unbindSpace() {
    if (!this._spaceHandler || !this.scene.input?.keyboard) return;
    this.scene.input.keyboard.off("keydown-SPACE", this._spaceHandler);
    this._spaceHandler = null;
  }

  _handleAdvanceInput() {
    if (this.finishCurrentText()) return;
    if (this.currentStep?.waitFor) return;
    AudioManager.playMenuClick({ volume: 0.18 });
    this.manager.advanceFromOverlay();
  }

  _setNextEnabled(enabled) {
    const active = !!enabled;
    this.nextHit.input.enabled = active;
    this.nextBg.setAlpha(active ? 1 : 0.56);
    this.nextText.setAlpha(active ? 1 : 0.62);
    this.nextHint.setAlpha(active ? 1 : 0.58);
  }

  _layoutSpeech() {
    if (!this.root) return;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const compact = width <= 1680 || height <= 1100 || !!this.scene.uiBottomBar?.expanded;
    const panelW = compact
      ? Phaser.Math.Clamp(Math.round(width * 0.48), 430, 620)
      : Phaser.Math.Clamp(width - 48, 560, 720);
    const avatarSize = compact
      ? Phaser.Math.Clamp(Math.round(height * 0.084), 76, 96)
      : Phaser.Math.Clamp(Math.round(height * 0.108), 98, 128);
    const panelH = compact
      ? Math.max(126, avatarSize + 48)
      : Math.max(158, avatarSize + 50);
    const { x, y } = this._chooseSpeechPosition(panelW, panelH);
    const bubbleX = 14 + avatarSize + 18;
    const bubbleW = panelW - avatarSize - 28;

    this.root.setPosition(x, y);
    this.shadow.clear();
    this.shadow.fillStyle(0x02070d, 0.32);
    this.shadow.fillRoundedRect(3, 7, panelW, panelH, 18);
    this.panel.clear();
    this._drawPanel(this.panel, panelW, panelH, 0x102f43, 0x9ee7ff, 18, 0, 0);
    this.avatarPlate.clear();
    this.avatarPlate.fillStyle(0x071722, 0.72);
    this.avatarPlate.fillRoundedRect(10, 11, avatarSize + 8, avatarSize + 30, 16);
    this.avatarPlate.lineStyle(2, 0xb7ecff, 0.18);
    this.avatarPlate.strokeRoundedRect(10, 11, avatarSize + 8, avatarSize + 30, 16);

    this.avatar.setPosition(14 + avatarSize / 2, 14 + avatarSize / 2).setDisplaySize(avatarSize, avatarSize);
    this.nameText
      .setFontSize(compact ? "10px" : "12px")
      .setPosition(14 + avatarSize / 2, 18 + avatarSize + 11);
    this.bodyText
      .setFontSize(compact ? "13px" : "15px")
      .setLineSpacing(compact ? 4 : 5)
      .setPosition(bubbleX, compact ? 18 : 22);
    this.bodyText.setWordWrapWidth(Math.max(260, bubbleW - 34));
    this.nextBg.setPosition(bubbleX + bubbleW - 68, panelH - 34);
    this.nextText
      .setFontSize(compact ? "11px" : "13px")
      .setPosition(bubbleX + bubbleW - 68, panelH - 40);
    this.nextHint
      .setFontSize("8px")
      .setPosition(bubbleX + bubbleW - 68, panelH - 22);
    this.nextHit.setPosition(bubbleX + bubbleW - 68, panelH - 32).setSize(108, 38);
    this._drawNextButton();
  }

  _chooseSpeechPosition(panelW, panelH) {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const margin = 18;
    const safeTop = 84;
    const bottomBarRect = this._getBottomBarRect();
    const bottomLimit = bottomBarRect ? Math.max(safeTop + panelH, bottomBarRect.y - 14) : height - 70;
    const maxX = Math.max(margin, width - panelW - margin);
    const maxY = Math.max(safeTop, bottomLimit - panelH);
    const placement = this.currentStep?.speechPlacement;
    if (placement === "top") {
      return {
        x: Phaser.Math.Clamp(Math.round((width - panelW) / 2), margin, maxX),
        y: safeTop,
      };
    }
    if (placement === "contractBottom") {
      return {
        x: Phaser.Math.Clamp(Math.round(width * 0.58 - panelW / 2), margin, maxX),
        y: Phaser.Math.Clamp(Math.round(height - panelH - 86), safeTop, maxY),
      };
    }
    const target = this.manager?.getOverlayTargetRect?.() ?? null;
    const candidates = [];
    const add = (x, y, bias = 0) => {
      candidates.push({
        x: Phaser.Math.Clamp(Math.round(x), margin, maxX),
        y: Phaser.Math.Clamp(Math.round(y), safeTop, maxY),
        bias,
      });
    };

    if (target) {
      const targetMidY = target.y + target.height / 2 - panelH / 2;
      add(target.x + target.width + 24, targetMidY, -28);
      add(target.x - panelW - 24, targetMidY, -20);
      add(target.x + target.width + 24, target.y + target.height + 18, -16);
      add(target.x - panelW - 24, target.y + target.height + 18, -12);
      add((width - panelW) / 2, target.y + target.height + 24, -8);
      add((width - panelW) / 2, safeTop, 2);
      add((width - panelW) / 2, maxY, 8);
    } else {
      add(margin, maxY, -12);
      add((width - panelW) / 2, maxY, -8);
      add((width - panelW) / 2, safeTop, 0);
      add(width - panelW - margin, safeTop, 8);
    }

    const avoidRects = [
      target ? this._inflateRect(target, 14) : null,
      bottomBarRect ? this._inflateRect(bottomBarRect, 8) : null,
    ].filter(Boolean);

    let best = candidates[0] || { x: margin, y: maxY, bias: 0 };
    let bestScore = Infinity;
    for (const candidate of candidates) {
      const rect = { x: candidate.x, y: candidate.y, width: panelW, height: panelH };
      let score = candidate.bias || 0;
      for (const avoid of avoidRects) {
        score += this._intersectionArea(rect, avoid) * 20;
      }
      if (target) {
        const dx = (rect.x + rect.width / 2) - (target.x + target.width / 2);
        const dy = (rect.y + rect.height / 2) - (target.y + target.height / 2);
        score -= Math.min(260, Math.hypot(dx, dy)) * 0.35;
      }
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  _startSpeakerFrames(speaker) {
    this.avatarFrameEvent?.remove(false);
    this.avatarFrameEvent = null;
    this._avatarFrameIndex = 0;
    this.avatar?.anims?.stop?.();
    this.avatar?.setFrame?.(0);

    const frameCount = Math.max(1, Number(speaker?.frameCount || 1));
    if (frameCount <= 1) return;

    const frameRate = speaker?.key === "fireman" ? 7 : 8;
    this.avatarFrameEvent = this.scene.time.addEvent({
      delay: Math.max(60, Math.round(1000 / frameRate)),
      loop: true,
      callback: () => {
        if (!this.isTyping || !this.avatar?.active) return;
        this._avatarFrameIndex = (this._avatarFrameIndex + 1) % frameCount;
        this.avatar.setFrame(this._avatarFrameIndex);
      },
    });
  }

  _getBottomBarRect() {
    const bar = this.scene.uiBottomBar;
    const bounds = bar?.ui?.getBounds?.();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      if (!bar?.expanded) return null;
      return { x: 0, y: this.scene.scale.height - 180, width: this.scene.scale.width, height: 180 };
    }
    const visibleHeight = Math.max(0, this.scene.scale.height - bounds.y);
    if (visibleHeight < 64 && !bar?.expanded) return null;
    return {
      x: bounds.x,
      y: Math.max(0, bounds.y),
      width: bounds.width,
      height: Math.max(64, visibleHeight),
    };
  }

  _inflateRect(rect, amount) {
    return {
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + amount * 2,
      height: rect.height + amount * 2,
    };
  }

  _intersectionArea(a, b) {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  }

  _drawNextButton() {
    this.nextBg.clear();
    this.nextBg.fillStyle(0x031019, 0.20);
    this.nextBg.fillRoundedRect(-54, -19 + 4, 108, 38, 12);
    this.nextBg.fillStyle(0x1d766a, 0.92);
    this.nextBg.fillRoundedRect(-54, -19, 108, 38, 12);
    this.nextBg.fillStyle(0xffffff, 0.08);
    this.nextBg.fillRoundedRect(-45, -14, 90, 11, 7);
    this.nextBg.lineStyle(2, 0xb9fff0, 0.22);
    this.nextBg.strokeRoundedRect(-54, -19, 108, 38, 12);
  }

  _makeButton(x, y, width, label, color, fill, onClick) {
    const bg = this.scene.add.graphics();
    const draw = (hovered = false) => {
      bg.clear();
      bg.fillStyle(0x02070d, 0.22);
      bg.fillRoundedRect(x - width / 2, y - 29 + 5, width, 58, 18);
      bg.fillStyle(fill, hovered ? 1 : 0.96);
      bg.fillRoundedRect(x - width / 2, y - 29, width, 58, 18);
      bg.lineStyle(2, 0xffffff, hovered ? 0.30 : 0.16);
      bg.strokeRoundedRect(x - width / 2, y - 29, width, 58, 18);
    };
    draw(false);
    const text = this.scene.add.text(x, y, label, {
      fontFamily: "Bungee",
      fontSize: "16px",
      color,
      stroke: "#04111a",
      strokeThickness: 3,
    }).setOrigin(0.5);
    const hit = this.scene.add.zone(x, y, width, 58).setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => draw(true));
    hit.on("pointerout", () => draw(false));
    hit.on("pointerdown", (_pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      AudioManager.playMenuClick({ volume: 0.2 });
      onClick?.();
    });
    return [bg, text, hit];
  }

  _drawPanel(g, width, height, fill, stroke, radius, x = -width / 2, y = -height / 2) {
    g.clear();
    g.fillStyle(0x02070d, 0.24);
    g.fillRoundedRect(x + 3, y + 6, width, height, radius);
    g.fillStyle(fill, 0.96);
    g.fillRoundedRect(x, y, width, height, radius);
    g.fillStyle(0xffffff, 0.07);
    g.fillRoundedRect(x + 16, y + 10, Math.max(24, width - 32), 20, 12);
    g.lineStyle(2, stroke, 0.24);
    g.strokeRoundedRect(x, y, width, height, radius);
    g.lineStyle(1, 0xffffff, 0.10);
    g.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, Math.max(1, radius - 1));
  }

  _setResizeHandler(handler) {
    if (this._resizeHandler) {
      this.scene.scale.off("resize", this._resizeHandler);
    }
    this._resizeHandler = handler || null;
    if (this._resizeHandler) {
      this.scene.scale.on("resize", this._resizeHandler);
    }
  }
}
