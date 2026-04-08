import Phaser from "phaser";
import { DraftStartState } from "./DraftStartState.js";
import { DraftStartPreviewController } from "./DraftStartPreviewController.js";
import { TeamNameInput } from "./TeamNameInput.js";
import { getCardOutlineTint } from "../CardPreview.js";
import { SQUARESIZE, TILE_TYPES, UIDEPTH } from "../../constants.js";
import {
  applyPortraitKeyToSprite,
  getPlayerPortraitKey,
} from "../../players/playerPortraits.js";
import {
  createStarterPortraitUnit,
  REQUIRED_STARTER_TYPES,
} from "./DraftStarterDecks.js";

const RESOURCE_LAYOUT = [
  { key: "money", icon: "monies", label: "Cash" },
  { key: "seeds", icon: "seeds", label: "Seeds" },
  { key: "berries", icon: "berry", label: "Berries" },
  { key: "food", icon: "foodIcon", label: "Food" },
  { key: "water", icon: "waterIcon", label: "Water" },
  { key: "wood", icon: "woodIcon", label: "Wood" },
  { key: "stone", icon: "stoneIcon", label: "Stone" },
];

const BASE_DECK_FILL = 0x13293d;
const BASE_DECK_STROKE = 0xb2e8ff;
const HEADER_FILL = 0x10263b;
const SCREEN_TINT = 0x061520;
const TEXT_LIGHT = "#f8fcff";
const TEXT_MUTED = "#b7d3e0";
const TEXT_SUBTLE = "#7fa2b7";
const TEXT_WARM = "#ffe5c8";

const _LEGACY_BUILDING_META = Object.freeze({
  tower: { emoji: "🗼", label: "Town Tower" },
  house1: { emoji: "🏠", label: "House" },
  house2: { emoji: "🏠", label: "House" },
  storage: { emoji: "📦", label: "Storage" },
  clayOven: { emoji: "🔥", label: "Clay Oven" },
});

const BUILDING_META = Object.freeze({
  tower: { emoji: "\u{1F5FC}", label: "Town Tower" },
  house1: { emoji: "\u{1F3E0}", label: "House" },
  house2: { emoji: "\u{1F3E0}", label: "House" },
  storage: { emoji: "\u{1F4E6}", label: "Storage" },
  clayOven: { emoji: "\u{1F525}", label: "Clay Oven" },
});

function hexToColorInt(value, fallback = 0xffffff) {
  if (!value) return fallback;
  return Phaser.Display.Color.HexStringToColor(value).color;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class DraftStartMenu {
  static build(scene, opts) {
    const menu = new DraftStartMenu(scene, opts);
    menu.buildUI();
    return menu;
  }

  constructor(scene, opts) {
    this.scene = scene;
    this.worldScene = opts.worldScene ?? scene;
    this.srcW = opts.srcW;
    this.srcH = opts.srcH;
    this.gridData = opts.gridData;
    this.repaintBounds = opts.repaintBounds;

    this.container = scene.add.container(0, 0).setDepth(2200).setScrollFactor(0);
    this.state = new DraftStartState();
    this.preview = new DraftStartPreviewController(scene, {
      srcW: this.srcW,
      srcH: this.srcH,
      gridData: this.gridData,
      repaintBounds: this.repaintBounds,
      fullRepaintPreview: scene.fullRepaintPreview?.bind(scene),
      worldScene: this.worldScene,
    });

    this.ui = {
      deckRefs: [],
      cardHoverPreviews: [],
      mapInteractionRects: [],
    };
    this._teamNameInvalid = false;
    this.phase = "deck";
    this.selectedPlacedBuilding = null;
    this.selectedPlacedBuildingGrab = { x: 0, y: 0 };
    this._boundPointerMove = null;
    this._boundPointerDown = null;

    this._installDraftTextTheme();
  }

  destroy() {
    this.teamNameInput?.destroy?.();
    this.teamNameInput = null;

    this.preview?.destroy?.();
    this.preview = null;
    this._unbindLayoutMapInput?.();

    for (const preview of this.ui.cardHoverPreviews ?? []) {
      preview?.destroy?.();
    }

    this.container?.destroy?.(true);
    this.container = null;
    this._uninstallDraftTextTheme();
  }

  _installDraftTextTheme() {
    if (this._draftTextThemeInstalled) return;
    const add = this.scene?.add;
    if (!add?.text) return;

    this._originalAddText = add.text.bind(add);
    add.text = (x, y, text, style = {}) => {
      const nextStyle = style && typeof style === "object" ? { ...style } : {};
      if (!nextStyle.fontFamily) nextStyle.fontFamily = "Bungee";
      const themedText =
        nextStyle.fontFamily === "Bungee" && typeof text === "string"
          ? text.toUpperCase()
          : text;
      return this._originalAddText(x, y, themedText, nextStyle);
    };

    this._draftTextThemeInstalled = true;
  }

  _uninstallDraftTextTheme() {
    if (!this._draftTextThemeInstalled) return;
    if (this.scene?.add && this._originalAddText) {
      this.scene.add.text = this._originalAddText;
    }
    this._originalAddText = null;
    this._draftTextThemeInstalled = false;
  }

  buildUI() {
    const scene = this.scene;
    const width = scene.scale.width;
    const height = scene.scale.height;
    this.layout = this._createLayout(width, height);

    this._buildBackdrop(width, height);
    this._buildHeader(width);
    this._buildDeckRow(width, height);
    this._buildLayoutStage(width, height);
    this._buildFooter(width, height);
    this._buildCardHoverBubble(width, height);

    this.preview.initBaseTown(this.state);
    this.preview._updatePlacedBuildingsIntoState?.(this.state);
    this.preview.updateCrewSpawnPreview(this.state.crew);
    this.state.setWallEstimate(this.preview.estimateWallTiles(), true);
    this.scene.fullRepaintPreview?.();

    this.state.onChange(() => {
      this._refreshUI();
    });

    this._bindLayoutMapInput();
    this._setPhase("deck", { immediate: true, emit: true });
    this._refreshUI();

    this.container.setAlpha(0);
    this.teamNameInput?.dom?.setAlpha?.(0);
    scene.tweens.add({
      targets: [this.container, this.teamNameInput?.dom].filter(Boolean),
      alpha: 1,
      duration: 360,
      ease: "Cubic.easeOut",
    });
  }

  _createLayout(width, height) {
    const scale = clamp(Math.min(width / 1920, height / 1080), 0.74, 1);
    const compact = scale < 0.9;
    const pagePad = Math.max(18, Math.round(34 * scale));
    const gap = Math.max(10, Math.round(18 * scale));
    const headerHeight = Math.round((compact ? 110 : 126) * scale);
    const headerTopGap = 5;
    const headerY = headerTopGap + Math.round(headerHeight / 2);
    const footerHeight = Math.round((compact ? 98 : 110) * scale);
    const footerY = height - Math.round((compact ? 56 : 78) * scale);
    const topDeckStart = headerY + (headerHeight / 2) + Math.round(14 * scale);
    const bottomDeckEnd = footerY - (footerHeight / 2) - Math.round(4 * scale);
    const deckWidth = Math.min(
      Math.floor((width - pagePad * 2 - gap * 2) / 3),
      Math.round(392 * scale),
    );
    const deckHeight = Math.max(
      Math.round(438 * scale),
      bottomDeckEnd - topDeckStart,
    );
    const rowCenterY = topDeckStart + (deckHeight / 2);
    const teamInputWidth = compact ? 228 : 262;
    const confirmButtonWidth = clamp(Math.round(438 * scale), 332, 468);
    const confirmButtonHeight = clamp(Math.round(58 * scale), 46, 58);
    const confirmGlowWidth = confirmButtonWidth + Math.round(16 * scale);
    const confirmGlowHeight = confirmButtonHeight + Math.round(8 * scale);

    return {
      width,
      height,
      scale,
      compact,
      pagePad,
      gap,
      headerHeight,
      headerY,
      headerWidth: Math.min(Math.round(1120 * scale), width - pagePad * 2),
      footerHeight,
      footerY,
      footerWidth: Math.min(Math.round(1320 * scale), width - pagePad * 2),
      rowCenterY,
      deckWidth: Math.max(220, deckWidth),
      deckHeight: Math.max(360, deckHeight),
      teamInputWidth,
      confirmButtonWidth,
      confirmButtonHeight,
      confirmGlowWidth,
      confirmGlowHeight,
      layoutInfoWidth: Math.min(Math.round(438 * scale), Math.round(width * 0.28)),
      layoutInfoHeight: Math.round((compact ? 250 : 272) * scale),
      layoutLegendWidth: Math.min(Math.round(360 * scale), Math.round(width * 0.24)),
      layoutLegendHeight: Math.round((compact ? 300 : 300) * scale),
      layoutPanelY: headerY + (headerHeight / 2) + Math.round(142 * scale) + 20,
    };
  }

  _fontPx(base, min = 8, scale = this.layout?.scale ?? 1) {
    return `${Math.max(min, Math.round(base * scale))}px`;
  }

  _getTeamNameInputElement() {
    return this.teamNameInput?.getInputElement?.()
      ?? this.teamNameInput?.dom?.node?.querySelector?.("input")
      ?? null;
  }

  _setTeamNameValidationState(isInvalid) {
    this._teamNameInvalid = isInvalid;
    const shell = this.ui.teamInputShell;
    const label = this.ui.teamTag;

    if (shell) {
      this._redrawPanel(
        shell,
        this.ui.teamInputShellWidth,
        this.ui.teamInputShellHeight,
        isInvalid
          ? {
            fillColor: 0x4a1217,
            fillAlpha: 0.98,
            strokeColor: 0xff7d8c,
            strokeAlpha: 0.9,
            radius: this.ui.teamInputShellRadius,
            shadowColor: 0x280409,
            shadowAlpha: 0.34,
            shadowOffsetY: Math.round(8 * this.layout.scale),
          }
          : {
            fillColor: 0x0d2130,
            fillAlpha: 0.9,
            strokeColor: 0xd2f6ff,
            strokeAlpha: 0.18,
            radius: this.ui.teamInputShellRadius,
            shadowColor: 0x06121b,
            shadowAlpha: 0.2,
            shadowOffsetY: Math.round(8 * this.layout.scale),
          },
      );
    }

    if (label) {
      label.setColor(isInvalid ? "#ffb2bc" : TEXT_SUBTLE);
    }

    const input = this._getTeamNameInputElement();
    if (!input) return;
    input.style.background = isInvalid ? "rgba(118,21,33,0.84)" : "rgba(255,255,255,0.02)";
    input.style.borderColor = isInvalid ? "rgba(255,138,150,0.94)" : "rgba(255,255,255,0.05)";
    input.style.boxShadow = isInvalid ? "0 0 0 2px rgba(255,110,129,0.22)" : "none";
  }

  _shakeTeamNameInput() {
    const targets = [];
    if (this.ui.teamInputShell) {
      this.ui.teamInputShell.x = this.ui.teamInputShellX;
      targets.push(this.ui.teamInputShell);
    }
    if (this.teamNameInput?.dom) {
      this.teamNameInput.dom.x = this.ui.teamInputDomX;
      targets.push(this.teamNameInput.dom);
    }

    if (!targets.length) return;

    this.scene.tweens.killTweensOf(targets);
    this.scene.tweens.add({
      targets,
      x: "+=10",
      duration: 48,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        if (this.ui.teamInputShell) this.ui.teamInputShell.x = this.ui.teamInputShellX;
        if (this.teamNameInput?.dom) this.teamNameInput.dom.x = this.ui.teamInputDomX;
      },
    });
  }

  _updateFooterSummaryLayout(confirmWidth = this.layout.confirmButtonWidth) {
    if (!this.ui.footerSummary) return;

    const backWidth = this.phase === "layout" ? (this.ui.backButtonWidth ?? 0) : 0;
    const summaryLeft = this.phase === "layout"
      ? this.ui.backX + (backWidth / 2) + Math.round(24 * this.layout.scale)
      : this.ui.footerSummaryBaseX;
    const summaryRight =
      this.ui.confirmX
      - (confirmWidth / 2)
      - Math.round(22 * this.layout.scale);
    const wrapWidth = Math.max(180, Math.round(summaryRight - summaryLeft));

    this.ui.footerSummary.setX(summaryLeft);

    if (typeof this.ui.footerSummary.setWordWrapWidth === "function") {
      this.ui.footerSummary.setWordWrapWidth(wrapWidth);
    } else if (this.ui.footerSummary.style) {
      this.ui.footerSummary.style.wordWrapWidth = wrapWidth;
      this.ui.footerSummary.updateText?.();
    }
  }

  _getBuildingMetaLegacy(typeKey) {
    return BUILDING_META[typeKey] ?? { emoji: "🏗️", label: typeKey ?? "Building" };
  }

  _getBuildingMeta(typeKey) {
    return BUILDING_META[typeKey] ?? { emoji: "\u{1F3D7}\uFE0F", label: typeKey ?? "Building" };
  }

  _countPlacedBuildings(typeKeys) {
    const allowed = new Set(typeKeys);
    return (this.state.placedBuildings ?? []).reduce((count, building) => {
      const key = building?.typeKey ?? building?.type;
      return count + (allowed.has(key) ? 1 : 0);
    }, 0);
  }

  _setDeckSelectionEnabled(enabled) {
    for (const ref of this.ui.deckRefs ?? []) {
      if (ref.hitArea?.input) {
        ref.hitArea.input.enabled = enabled;
      }
      for (const cardRef of ref.cardRefs ?? []) {
        if (cardRef.hit?.input) {
          cardRef.hit.input.enabled = enabled;
        }
      }
    }
  }

  _showLayoutTooltip(pointer, text) {
    const tooltip = this.ui.layoutTooltip;
    if (!tooltip) return;
    tooltip.label.setText(text);
    const pad = Math.round(16 * this.layout.scale);
    const width = Math.max(Math.round(120 * this.layout.scale), Math.round(tooltip.label.width + pad * 2));
    const height = Math.max(Math.round(38 * this.layout.scale), Math.round(tooltip.label.height + pad));
    this._redrawPanel(tooltip.bg, width, height, {
      fillColor: 0x08151e,
      fillAlpha: 0.94,
      strokeColor: 0xffffff,
      strokeAlpha: 0.16,
      radius: Math.round(18 * this.layout.scale),
      shadowColor: 0x000000,
      shadowAlpha: 0.22,
      shadowOffsetY: Math.round(8 * this.layout.scale),
    });
    tooltip.label.setPosition(0, 0);
    tooltip.container.setVisible(true);
    tooltip.container.setAlpha(1);
    tooltip.container.setPosition(
      Phaser.Math.Clamp(pointer.x + Math.round(18 * this.layout.scale), width / 2 + 8, this.layout.width - width / 2 - 8),
      Phaser.Math.Clamp(pointer.y - Math.round(18 * this.layout.scale), height / 2 + 8, this.layout.height - height / 2 - 8),
    );
  }

  _hideLayoutTooltip() {
    this.ui.layoutTooltip?.container?.setVisible(false);
  }

  _pointerToGrid(pointer) {
    const cam = this.worldScene?.cameras?.main;
    if (!cam) return null;
    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
    return {
      gridX: Math.floor(worldPoint.x / SQUARESIZE),
      gridY: Math.floor(worldPoint.y / SQUARESIZE),
      worldX: worldPoint.x,
      worldY: worldPoint.y,
    };
  }

  _isPointerOnLayoutUi(pointer) {
    if (pointer.y <= this.layout.headerY + (this.layout.headerHeight / 2) + Math.round(10 * this.layout.scale)) return true;
    if (pointer.y >= this.layout.footerY - (this.layout.footerHeight / 2) - Math.round(8 * this.layout.scale)) return true;
    return (this.ui.mapInteractionRects ?? []).some((rect) =>
      pointer.x >= rect.left
      && pointer.x <= rect.right
      && pointer.y >= rect.top
      && pointer.y <= rect.bottom
    );
  }

  _selectPlacedBuilding(building, grabX, grabY) {
    this.selectedPlacedBuilding = building;
    this.selectedPlacedBuildingGrab = {
      x: Math.max(0, grabX - building.x),
      y: Math.max(0, grabY - building.y),
    };
    this._refreshUI();
  }

  _clearSelectedPlacedBuilding() {
    this.selectedPlacedBuilding = null;
    this.selectedPlacedBuildingGrab = { x: 0, y: 0 };
    this.preview.clearHover?.();
    this._hideLayoutTooltip();
    this._refreshUI();
  }

  _bindLayoutMapInput() {
    this._unbindLayoutMapInput?.();

    this._boundPointerMove = (pointer) => {
      if (this.phase !== "layout") return;
      if (this._isPointerOnLayoutUi(pointer)) {
        this.preview.clearHover?.();
        this._hideLayoutTooltip();
        return;
      }

      const point = this._pointerToGrid(pointer);
      if (!point) return;

      if (this.selectedPlacedBuilding) {
        const targetX = point.gridX - (this.selectedPlacedBuildingGrab?.x ?? 0);
        const targetY = point.gridY - (this.selectedPlacedBuildingGrab?.y ?? 0);
        this.preview.setMoveHover(this.selectedPlacedBuilding, this.state, targetX, targetY);
        const meta = this._getBuildingMeta(this.selectedPlacedBuilding?.typeKey);
        this._showLayoutTooltip(pointer, `${meta.emoji} Move ${meta.label}`);
        return;
      }

      const hovered = this.preview.hitTestPlaced(point.gridX, point.gridY);
      this.preview.clearHover?.();
      if (!hovered) {
        this._hideLayoutTooltip();
        return;
      }

      const meta = this._getBuildingMeta(hovered.typeKey ?? hovered.type?.name);
      this._showLayoutTooltip(pointer, `${meta.emoji} ${meta.label}`);
    };

    this._boundPointerDown = (pointer) => {
      if (this.phase !== "layout") return;
      if (this._isPointerOnLayoutUi(pointer)) return;

      const point = this._pointerToGrid(pointer);
      if (!point) return;

      const hitBuilding = this.preview.hitTestPlaced(point.gridX, point.gridY);
      if (!this.selectedPlacedBuilding) {
        if (hitBuilding) {
          this._selectPlacedBuilding(hitBuilding, point.gridX, point.gridY);
          const meta = this._getBuildingMeta(hitBuilding.typeKey ?? hitBuilding.type?.name);
          this._showLayoutTooltip(pointer, `${meta.emoji} ${meta.label} selected`);
        }
        return;
      }

      if (hitBuilding) {
        if (hitBuilding === this.selectedPlacedBuilding) {
          this._clearSelectedPlacedBuilding();
          return;
        }
        this._selectPlacedBuilding(hitBuilding, point.gridX, point.gridY);
        const meta = this._getBuildingMeta(hitBuilding.typeKey ?? hitBuilding.type?.name);
        this._showLayoutTooltip(pointer, `${meta.emoji} ${meta.label} selected`);
        return;
      }

      const targetX = point.gridX - (this.selectedPlacedBuildingGrab?.x ?? 0);
      const targetY = point.gridY - (this.selectedPlacedBuildingGrab?.y ?? 0);
      const moved = this.preview.tryMoveSelected(this.selectedPlacedBuilding, this.state, targetX, targetY);
      if (moved?.ok) {
        this.preview._refreshSpawnIfInvalid?.(this.state.crew);
        this._clearSelectedPlacedBuilding();
      }
    };

    this.scene.input.on("pointermove", this._boundPointerMove);
    this.scene.input.on("pointerdown", this._boundPointerDown);
  }

  _unbindLayoutMapInput() {
    if (this._boundPointerMove) {
      this.scene?.input?.off?.("pointermove", this._boundPointerMove);
      this._boundPointerMove = null;
    }
    if (this._boundPointerDown) {
      this.scene?.input?.off?.("pointerdown", this._boundPointerDown);
      this._boundPointerDown = null;
    }
  }

  _setPhase(nextPhase, opts = {}) {
    const phase = nextPhase === "layout" ? "layout" : "deck";
    const changed = this.phase !== phase;
    this.phase = phase;

    const isLayout = phase === "layout";
    const phaseOffset = Math.round(22 * this.layout.scale);
    const targetsToShow = [];
    const targetsToHide = [];

    if (this.ui.deckRow) {
      (isLayout ? targetsToHide : targetsToShow).push(this.ui.deckRow);
    }
    if (this.ui.layoutStage) {
      (isLayout ? targetsToShow : targetsToHide).push(this.ui.layoutStage);
    }

    if (!isLayout) {
      this._clearSelectedPlacedBuilding();
    } else {
      this._hideLayoutTooltip();
    }

    this._setDeckSelectionEnabled(!isLayout);

    for (const target of [...targetsToShow, ...targetsToHide]) {
      if (!target) continue;
      if (typeof target._draftPhaseBaseY !== "number") {
        target._draftPhaseBaseY = target.y ?? 0;
      }
    }

    for (const target of targetsToShow) {
      target.setVisible(true);
      if (opts.immediate) {
        target.setAlpha(1);
        target.y = target._draftPhaseBaseY ?? target.y ?? 0;
      } else {
        target.setAlpha(0);
        target.y = (target._draftPhaseBaseY ?? target.y ?? 0) + phaseOffset;
      }
    }
    for (const target of targetsToHide) {
      if (opts.immediate) {
        target.setAlpha(0).setVisible(false);
        target.y = target._draftPhaseBaseY ?? target.y ?? 0;
      }
    }

    if (!opts.immediate) {
      targetsToShow.forEach((target, index) => {
        this.scene.tweens.add({
          targets: target,
          alpha: 1,
          y: target._draftPhaseBaseY ?? target.y ?? 0,
          duration: 260,
          delay: index * 35,
          ease: "Cubic.easeOut",
        });
      });
      targetsToHide.forEach((target) => {
        const baseY = target._draftPhaseBaseY ?? target.y ?? 0;
        this.scene.tweens.add({
          targets: target,
          alpha: 0,
          y: baseY - phaseOffset,
          duration: 180,
          ease: "Quad.easeOut",
          onComplete: () => {
            target.setVisible(false);
            target.y = baseY;
          },
        });
      });
    }

    this.scene.events.emit("draftPhaseChanged", {
      phase,
      placedBuildings: this.state.placedBuildings,
      immediate: !!opts.immediate,
    });

    if (changed || opts.emit) {
      this._refreshUI();
    }
  }

  _confirmDraftStart() {
    if (!this.state.teamName.trim()) {
      this._setTeamNameValidationState(true);
      this._shakeTeamNameInput();
      this.teamNameInput?.focus?.();
      return;
    }

    if (this.phase !== "layout") {
      this._setTeamNameValidationState(false);
      this._setPhase("layout");
      return;
    }

    this._setTeamNameValidationState(false);
    this.preview.syncNavGridFromDraftLayout?.();
    const startConfig = this.state.toStartConfig();
    startConfig.spawnPoints = this.preview.getSpawnPoints();
    this.preview.clearDraftPlayerIcons?.();
    this.scene.events.emit("draftConfirmed", startConfig);
  }

  _buildBackdrop(width, height) {
    const scene = this.scene;

    const shade = scene.add.rectangle(width / 2, height / 2, width, height, SCREEN_TINT, 0.34);
    const topGlow = scene.add.ellipse(width / 2, 0, width * 0.78, 220, 0x74d8ff, 0.1);
    const centerGlow = scene.add.ellipse(width / 2, height * 0.5, width * 0.44, height * 0.68, 0xffffff, 0.06);
    const bottomGlow = scene.add.ellipse(width / 2, height + 20, width * 0.86, 220, 0x5cf0bf, 0.08);

    this.container.add([shade, topGlow, centerGlow, bottomGlow]);

    scene.tweens.add({
      targets: [topGlow, centerGlow],
      alpha: { from: 0.04, to: 0.13 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  _buildHeader(width) {
    const scene = this.scene;
    const layout = this.layout;
    const header = scene.add.container(width / 2, layout.headerY);
    const headerWidth = layout.headerWidth;
    const headerHeight = layout.headerHeight;
    const bodyWrapWidth = headerWidth - (layout.teamInputWidth + Math.round(220 * layout.scale));

    const shell = this._makeRoundedPanel(headerWidth, headerHeight, {
      fillColor: HEADER_FILL,
      fillAlpha: 0.74,
      strokeColor: 0x9be8ff,
      strokeAlpha: 0.25,
      radius: 34,
      shadowColor: 0x071116,
      shadowAlpha: 0.28,
      shadowOffsetY: 12,
    });

    const shine = this._makeRoundedPanel(headerWidth - 18, 42, {
      fillColor: 0xffffff,
      fillAlpha: 0.06,
      radius: 24,
    });
    shine.y = -26;

    const accent = scene.add.ellipse(
      -headerWidth / 2 + Math.round(86 * layout.scale),
      -Math.round(16 * layout.scale),
      Math.round(118 * layout.scale),
      Math.round(48 * layout.scale),
      0x72f0c0,
      0.16,
    );
    const title = scene.add.text(-headerWidth / 2 + Math.round(36 * layout.scale), -Math.round(20 * layout.scale), "Founding Draft", {
      fontSize: this._fontPx(34, 24),
      color: TEXT_LIGHT,
      stroke: "#0a1420",
      strokeThickness: Math.max(3, Math.round(5 * layout.scale)),
    }).setOrigin(0, 0.5);

    const subtitle = scene.add.text(-headerWidth / 2 + Math.round(36 * layout.scale), Math.round(24 * layout.scale), "Pick one starter deck. Your farmer, fireman, forager, and builder are locked in from the start.", {
      fontSize: this._fontPx(12, 9),
      color: TEXT_MUTED,
      wordWrap: { width: bodyWrapWidth },
      lineSpacing: Math.round(4 * layout.scale),
    }).setOrigin(0, 0.5);

    const teamTagX = headerWidth / 2 - (layout.teamInputWidth + Math.round(74 * layout.scale));
    const teamTag = scene.add.text(teamTagX, -Math.round(30 * layout.scale), "Team Name", {
      fontSize: this._fontPx(13, 10),
      color: TEXT_SUBTLE,
    }).setOrigin(0, 0.5);

    const teamInputShellWidth = layout.teamInputWidth + 44;
    const teamInputShellHeight = Math.round(56 * layout.scale);
    const teamInputShellRadius = Math.round(20 * layout.scale);
    const teamInputShell = this._makeRoundedPanel(teamInputShellWidth, teamInputShellHeight, {
      fillColor: 0x0d2130,
      fillAlpha: 0.9,
      strokeColor: 0xd2f6ff,
      strokeAlpha: 0.18,
      radius: teamInputShellRadius,
      shadowColor: 0x06121b,
      shadowAlpha: 0.2,
      shadowOffsetY: Math.round(8 * layout.scale),
    });
    teamInputShell.x = headerWidth / 2 - (layout.teamInputWidth / 2) - Math.round(46 * layout.scale);
    teamInputShell.y = Math.round(12 * layout.scale);


    header.add([
      shell,
      shine,
      accent,
      title,
      subtitle,
      teamTag,
      teamInputShell,
    ]);

    scene.tweens.add({
      targets: accent,
      alpha: { from: 0.1, to: 0.22 },
      scaleX: { from: 1, to: 1.08 },
      scaleY: { from: 1, to: 1.08 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.teamNameInput = new TeamNameInput(scene, {
      x: width / 2 + teamInputShell.x,
      y: layout.headerY + teamInputShell.y,
      width: layout.teamInputWidth,
      placeholder: "Name your town",
      initialValue: this.state.teamName,
      onChange: (value) => this.state.setTeamName(value),
      wrapperStyle: "display:flex; align-items:stretch;",
      inputStyle: `
        width:${layout.teamInputWidth}px;
        padding:${Math.round(9 * layout.scale)}px ${Math.round(16 * layout.scale)}px;
        font-size:${Math.max(11, Math.round(14 * layout.scale))}px;
        font-family:'Bungee', cursive;
        border-radius:${Math.round(16 * layout.scale)}px;
        border:1px solid rgba(255,255,255,0.05);
        box-shadow:none;
        -webkit-appearance:none;
        appearance:none;
        background:rgba(255,255,255,0.02);
        color:white;
        outline:none;
        caret-color:white;
        letter-spacing:0.02em;
      `,
    });

    this.ui.teamTag = teamTag;
    this.ui.teamInputShell = teamInputShell;
    this.ui.teamInputShellWidth = teamInputShellWidth;
    this.ui.teamInputShellHeight = teamInputShellHeight;
    this.ui.teamInputShellRadius = teamInputShellRadius;
    this.ui.teamInputShellX = teamInputShell.x;
    this.ui.teamInputDomX = this.teamNameInput?.dom?.x ?? 0;
    this.ui.headerTitle = title;
    this.ui.headerSubtitle = subtitle;
    this._setTeamNameValidationState(false);

    this.container.add(header);
    this.ui.header = header;
  }

  _buildDeckRow(width, height) {
    const decks = this.state.starterDecks;
    const layout = this.layout;
    const gap = layout.gap;
    const deckWidth = layout.deckWidth;
    const deckHeight = layout.deckHeight;
    const rowCenterY = layout.rowCenterY;
    const totalWidth = deckWidth * decks.length + gap * (decks.length - 1);
    let x = (width - totalWidth) / 2 + deckWidth / 2;
    const row = this.scene.add.container(0, 0);

    this.ui.deckRefs = [];

    decks.forEach((deck, index) => {
      const ref = this._buildDeckCard(deck, x, rowCenterY, deckWidth, deckHeight, index, row);
      this.ui.deckRefs.push(ref);
      x += deckWidth + gap;
    });

    this.container.add(row);
    this.ui.deckRow = row;
  }

  _buildDeckCard(deck, x, y, width, height, index, rowContainer = this.container) {
    const scene = this.scene;
    const layout = this.layout;
    const accent = hexToColorInt(deck.accent, 0xffffff);
    const container = scene.add.container(x, y);
    const contentScale = clamp(Math.min(width / 360, height / 610), 0.72, 1);
    const top = -height / 2;
    const bottom = height / 2;
    const sectionLeft = -width / 2 + Math.round(28 * contentScale);
    const innerWidth = width - Math.round(56 * contentScale);

    const glow = this._makeRoundedPanel(width + 10, height + 10, {
      fillColor: accent,
      fillAlpha: 0.12,
      radius: 34,
      shadowColor: accent,
      shadowAlpha: 0.12,
      shadowOffsetY: 0,
    });

    const panel = this._makeRoundedPanel(width, height, {
      fillColor: BASE_DECK_FILL,
      fillAlpha: 0.78,
      strokeColor: BASE_DECK_STROKE,
      strokeAlpha: 0.18,
      radius: 32,
      shadowColor: 0x071116,
      shadowAlpha: 0.3,
      shadowOffsetY: 18,
    });

    const topShine = this._makeRoundedPanel(width - Math.round(24 * contentScale), Math.round(48 * contentScale), {
      fillColor: 0xffffff,
      fillAlpha: 0.05,
      radius: Math.round(24 * contentScale),
    });
    topShine.y = top + Math.round(38 * contentScale);

    const orb = scene.add.ellipse(-width / 2 + Math.round(54 * contentScale), top + Math.round(48 * contentScale), Math.round(88 * contentScale), Math.round(88 * contentScale), accent, 0.18);
    const selectPill = this._makeRoundedPanel(Math.round(122 * contentScale), Math.round(34 * contentScale), {
      fillColor: deck.accentDark ? hexToColorInt(deck.accentDark, accent) : accent,
      fillAlpha: 0.8,
      radius: Math.round(17 * contentScale),
    });
    selectPill.x = 0;
    const selectPillY = top + Math.round(38 * contentScale);
    selectPill.y = selectPillY;

    const selectLabel = scene.add.text(0, top + Math.round(38 * contentScale), "Starter Deck", {
      fontSize: this._fontPx(11, 8, contentScale),
      color: TEXT_LIGHT,
    }).setOrigin(0.5);

    const name = scene.add.text(sectionLeft, top + Math.round(86 * contentScale), deck.name, {
      fontSize: this._fontPx(24, 15, contentScale),
      color: TEXT_LIGHT,
      stroke: "#08131d",
      strokeThickness: Math.max(2, Math.round(4 * contentScale)),
      wordWrap: { width: innerWidth },
    }).setOrigin(0, 0.5);

    const subtitle = scene.add.text(sectionLeft, top + Math.round(122 * contentScale), deck.subtitle, {
      fontSize: this._fontPx(12, 9, contentScale),
      color: deck.accent,
    }).setOrigin(0, 0.5);

    const summary = scene.add.text(sectionLeft, top + Math.round(154 * contentScale), deck.summary, {
      fontSize: this._fontPx(11, 8, contentScale),
      color: TEXT_MUTED,
      wordWrap: { width: innerWidth },
      lineSpacing: Math.max(2, Math.round(4 * contentScale)),
    }).setOrigin(0, 0.5);

    const stockLabel = scene.add.text(sectionLeft, top + Math.round(224 * contentScale), "Starting Stock", {
      fontSize: this._fontPx(11, 8, contentScale),
      color: TEXT_SUBTLE,
    }).setOrigin(0, 0.5);

    const stockTrayHeight = Math.round(98 * contentScale);
    const stockTray = this._makeRoundedPanel(width - Math.round(42 * contentScale), stockTrayHeight, {
      fillColor: 0x0d2130,
      fillAlpha: 0.86,
      strokeColor: 0xffffff,
      strokeAlpha: 0.08,
      radius: Math.round(26 * contentScale),
    });
    stockTray.y = top + Math.round(286 * contentScale);

    const resourceRefs = this._buildResourceChips(deck, width, stockTray.y, contentScale);

    const cardsLabel = scene.add.text(sectionLeft, top + Math.round(358 * contentScale), "Starter Cards", {
      fontSize: this._fontPx(11, 8, contentScale),
      color: TEXT_SUBTLE,
    }).setOrigin(0, 0.5);

    const cardGap = Math.max(6, Math.round(8 * contentScale));
    const cardWidth = Math.floor((width - Math.round(48 * contentScale) - cardGap * 2) / 3);
    const cardHeight = Math.max(80, Math.round((layout.compact ? 92 : 104) * contentScale));
    const cardStartX = -width / 2 + Math.round(24 * contentScale) + cardWidth / 2;
    const cardY = top + Math.round(432 * contentScale);
    const cardRefs = [];

    deck.cards.forEach((card, cardIndex) => {
      const cardX = cardStartX + cardIndex * (cardWidth + cardGap);
      const cardRef = this._buildStarterCard(
        deck,
        card,
        width,
        height,
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        contentScale,
      );
      cardRefs.push(cardRef);
    });

    const crewLabel = scene.add.text(sectionLeft, top + Math.round(520 * contentScale), "Starting Crew", {
      fontSize: this._fontPx(11, 8, contentScale),
      color: TEXT_SUBTLE,
    }).setOrigin(0, 0.5);

    const crewTray = this._makeRoundedPanel(width - Math.round(42 * contentScale), Math.round(102 * contentScale), {
      fillColor: 0x0d2130,
      fillAlpha: 0.86,
      strokeColor: 0xffffff,
      strokeAlpha: 0.08,
      radius: Math.round(26 * contentScale),
    });
    crewTray.y = top + Math.round(560 * contentScale);

    const portraitRefs = this._buildPortraitStrip(width, height, contentScale);

    const hitArea = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.001)
      .setInteractive({ cursor: "pointer" });

    container.add([
      glow,
      panel,
      hitArea,
      topShine,
      orb,
      selectPill,
      selectLabel,
      name,
      subtitle,
      summary,
      stockLabel,
      stockTray,
      ...resourceRefs.flatMap((entry) => entry.objects),
      cardsLabel,
      ...cardRefs.map((entry) => entry.container),
      crewLabel,
      crewTray,
      ...portraitRefs.flatMap((entry) => entry.objects),
    ]);

    const deckRef = {
      deck,
      container,
      glow,
      panel,
      selectPill,
      selectLabel,
      summary,
      resourceRefs,
      cardRefs,
      portraitRefs,
      hitArea,
      accent,
      baseY: y,
      contentScale,
      selectPillWidth: Math.round(122 * contentScale),
      selectPillHeight: Math.round(34 * contentScale),
      selectPillY,
      isHovered: false,
    };

    hitArea.on("pointerover", () => {
      deckRef.isHovered = true;
      this._syncDeckVisual(deckRef);
    });

    hitArea.on("pointerout", () => {
      deckRef.isHovered = false;
      this._syncDeckVisual(deckRef);
    });

    hitArea.on("pointerdown", () => {
      this.state.selectStarterDeck(deck.id);
    });

    scene.tweens.add({
      targets: orb,
      alpha: { from: 0.1, to: 0.24 },
      scaleX: { from: 1, to: 1.18 },
      scaleY: { from: 1, to: 1.18 },
      duration: 1700 + index * 220,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: container,
      alpha: { from: 0, to: 1 },
      y: { from: y + 40, to: y },
      duration: 520,
      delay: 100 + index * 110,
      ease: "Cubic.easeOut",
    });

    rowContainer.add(container);
    return deckRef;
  }

  _buildLayoutStage(width, height) {
    const scene = this.scene;
    const layout = this.layout;
    const scale = layout.scale;
    const stage = scene.add.container(0, 0).setVisible(false).setAlpha(0);
    const infoWidth = layout.layoutInfoWidth;
    const infoHeight = layout.layoutInfoHeight;
    const legendWidth = layout.layoutLegendWidth;
    const legendHeight = layout.layoutLegendHeight;
    const panelY = layout.layoutPanelY;
    const infoX = Math.round(layout.pagePad + infoWidth / 2 + 12 * scale);
    const legendX = width - Math.round(layout.pagePad + legendWidth / 2 + 12 * scale);

    const info = scene.add.container(infoX, panelY);
    const infoShell = this._makeRoundedPanel(infoWidth, infoHeight, {
      fillColor: HEADER_FILL,
      fillAlpha: 0.84,
      strokeColor: 0xb9efff,
      strokeAlpha: 0.16,
      radius: Math.round(28 * scale),
      shadowColor: 0x08131c,
      shadowAlpha: 0.24,
      shadowOffsetY: Math.round(12 * scale),
    });
    const infoTitle = scene.add.text(-infoWidth / 2 + Math.round(26 * scale), -infoHeight / 2 + Math.round(30 * scale), "Town Layout", {
      fontSize: this._fontPx(20, 13),
      color: TEXT_LIGHT,
      stroke: "#09131c",
      strokeThickness: Math.max(2, Math.round(4 * scale)),
    }).setOrigin(0, 0.5);
    const infoDeck = scene.add.text(-infoWidth / 2 + Math.round(26 * scale), -infoHeight / 2 + Math.round(68 * scale), "", {
      fontSize: this._fontPx(13, 10),
      color: TEXT_WARM,
    }).setOrigin(0, 0.5);
    const infoBody = scene.add.text(-infoWidth / 2 + Math.round(26 * scale), -infoHeight / 2 + Math.round(106 * scale), "", {
      fontSize: this._fontPx(12, 9),
      color: TEXT_MUTED,
      wordWrap: { width: infoWidth - Math.round(54 * scale) },
      lineSpacing: Math.round(5 * scale),
    }).setOrigin(0, 0);
    const infoSelected = scene.add.text(-infoWidth / 2 + Math.round(26 * scale), infoHeight / 2 - Math.round(26 * scale), "Select a building to move it.", {
      fontFamily: "Arial",
      fontSize: this._fontPx(12, 9),
      color: TEXT_SUBTLE,
      wordWrap: { width: infoWidth - Math.round(54 * scale) },
      lineSpacing: Math.round(4 * scale),
    }).setOrigin(0, 1);
    info.add([infoShell, infoTitle, infoDeck, infoBody, infoSelected]);

    const legend = scene.add.container(legendX, panelY);
    const legendShell = this._makeRoundedPanel(legendWidth, legendHeight, {
      fillColor: HEADER_FILL,
      fillAlpha: 0.82,
      strokeColor: 0xb9efff,
      strokeAlpha: 0.14,
      radius: Math.round(28 * scale),
      shadowColor: 0x08131c,
      shadowAlpha: 0.22,
      shadowOffsetY: Math.round(12 * scale),
    });
    const legendTitle = scene.add.text(-legendWidth / 2 + Math.round(24 * scale), -legendHeight / 2 + Math.round(28 * scale), "Buildings", {
      fontSize: this._fontPx(19, 13),
      color: TEXT_LIGHT,
      stroke: "#09131c",
      strokeThickness: Math.max(2, Math.round(4 * scale)),
    }).setOrigin(0, 0.5);

    const legendRefs = [];
    [
      { key: "tower", emoji: "🗼", label: "Town Tower", types: ["tower"] },
      { key: "house", emoji: "🏠", label: "House", types: ["house1", "house2"] },
      { key: "storage", emoji: "📦", label: "Storage", types: ["storage"] },
      { key: "clayOven", emoji: "🔥", label: "Clay Oven", types: ["clayOven"] },
    ].forEach((entry, index) => {
      const lineY = -legendHeight / 2 + Math.round((78 + index * 50) * scale);
      const label = scene.add.text(-legendWidth / 2 + Math.round(24 * scale), lineY, `${entry.emoji} ${entry.label}`, {
        fontFamily: "Arial",
        fontSize: this._fontPx(16, 12),
        color: TEXT_LIGHT,
      }).setOrigin(0, 0.5);
      const count = scene.add.text(legendWidth / 2 - Math.round(24 * scale), lineY, "x0", {
        fontSize: this._fontPx(13, 10),
        color: TEXT_WARM,
      }).setOrigin(1, 0.5);
      legendRefs.push({ ...entry, label, count });
      legend.add([label, count]);
    });

    const legendHint = scene.add.text(-legendWidth / 2 + Math.round(24 * scale), legendHeight / 2 - Math.round(24 * scale), "Hover a building to see its type. Click it, then click a new spot to move it.", {
      fontSize: this._fontPx(11, 8),
      color: TEXT_MUTED,
      wordWrap: { width: legendWidth - Math.round(48 * scale) },
      lineSpacing: Math.round(4 * scale),
    }).setOrigin(0, 1);
    legend.add([legendShell, legendTitle, legendHint]);
    legend.sendToBack(legendShell);

    const tooltip = scene.add.container(0, 0)
      .setVisible(false)
      .setAlpha(0.98);
    const tooltipBg = this._makeRoundedPanel(Math.round(170 * scale), Math.round(42 * scale), {
      fillColor: 0x08151e,
      fillAlpha: 0.94,
      strokeColor: 0xffffff,
      strokeAlpha: 0.14,
      radius: Math.round(18 * scale),
    });
    const tooltipLabel = scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: this._fontPx(15, 11),
      color: TEXT_LIGHT,
    }).setOrigin(0.5);
    tooltip.add([tooltipBg, tooltipLabel]);

    stage.add([info, legend, tooltip]);
    this.container.add(stage);

    this.ui.layoutStage = stage;
    this.ui.layoutInfoDeck = infoDeck;
    this.ui.layoutInfoBody = infoBody;
    this.ui.layoutInfoSelected = infoSelected;
    this.ui.layoutLegendRefs = legendRefs;
    this.ui.layoutTooltip = {
      container: tooltip,
      bg: tooltipBg,
      label: tooltipLabel,
    };
    this.ui.mapInteractionRects = [
      {
        left: infoX - infoWidth / 2,
        right: infoX + infoWidth / 2,
        top: panelY - infoHeight / 2,
        bottom: panelY + infoHeight / 2,
      },
      {
        left: legendX - legendWidth / 2,
        right: legendX + legendWidth / 2,
        top: panelY - legendHeight / 2,
        bottom: panelY + legendHeight / 2,
      },
    ];
  }

  _buildResourceChips(deck, deckWidth, centerY, contentScale = 1) {
    const scene = this.scene;
    const chipHeight = Math.max(24, Math.round(28 * contentScale));
    const gap = Math.max(5, Math.round(7 * contentScale));
    const trayWidth = deckWidth - Math.round(42 * contentScale);
    const refs = [];
    const rows = [
      RESOURCE_LAYOUT.slice(0, 4),
      RESOURCE_LAYOUT.slice(4),
    ];

    rows.forEach((row, rowIndex) => {
      const chipWidth = Math.floor((trayWidth - gap * (row.length - 1)) / row.length);
      const rowWidth = row.length * chipWidth + (row.length - 1) * gap;
      let chipX = -rowWidth / 2 + chipWidth / 2;
      const chipY = centerY - Math.round(18 * contentScale) + rowIndex * Math.round(34 * contentScale);

      row.forEach((entry) => {
        const chip = this._makeRoundedPanel(chipWidth, chipHeight, {
          fillColor: 0xffffff,
          fillAlpha: 0.05,
          strokeColor: 0xffffff,
          strokeAlpha: 0.08,
          radius: Math.round(14 * contentScale),
        });
        chip.x = chipX;
        chip.y = chipY;

        const iconX = chipX - (chipWidth / 2) + Math.round((entry.key === "money" ? 18 : 16) * contentScale);
        const valueX = chipX - (chipWidth / 2) + Math.round((entry.key === "money" ? 34 : 28) * contentScale);
        const icon = scene.add.image(iconX, chipY, entry.icon)
          .setScale(entry.key === "money" ? 0.5 * contentScale : 0.68 * contentScale);
        const value = scene.add.text(valueX, chipY, String(deck.resources[entry.key] ?? 0), {
          fontSize: this._fontPx(entry.key === "money" ? 9 : 10, 7, contentScale),
          color: TEXT_LIGHT,
        }).setOrigin(0, 0.5);

        refs.push({
          key: entry.key,
          value,
          objects: [chip, icon, value],
        });

        chipX += chipWidth + gap;
      });
    });

    return refs;
  }

  _buildStarterCard(deck, card, deckWidth, deckHeight, localX, localY, width, height, contentScale = 1) {
    const scene = this.scene;
    const cardContainer = scene.add.container(localX, localY);
    const tint = getCardOutlineTint(card);

    const bg = this._makeRoundedPanel(width, height, {
      fillColor: tint,
      fillAlpha: 0.16,
      strokeColor: tint,
      strokeAlpha: 0.8,
      radius: Math.round(18 * contentScale),
      shadowColor: 0x09121a,
      shadowAlpha: 0.18,
      shadowOffsetY: Math.round(8 * contentScale),
    });

    const shine = this._makeRoundedPanel(width - Math.round(12 * contentScale), Math.round(24 * contentScale), {
      fillColor: 0xffffff,
      fillAlpha: 0.08,
      radius: Math.round(14 * contentScale),
    });
    shine.y = -height / 2 + Math.round(18 * contentScale);

    const icon = scene.add.image(0, -height / 2 + Math.round(34 * contentScale), card.image).setScale(0.72 * contentScale);
    const name = scene.add.text(0, height / 2 - Math.round(22 * contentScale), card.name, {
      fontSize: this._fontPx(9, 7, contentScale),
      color: TEXT_LIGHT,
      stroke: "#07121b",
      strokeThickness: Math.max(2, Math.round(3 * contentScale)),
      align: "center",
      wordWrap: { width: width - Math.round(16 * contentScale) },
    }).setOrigin(0.5);

    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.001)
      .setInteractive({ cursor: "pointer" });

    hit.on("pointerover", () => {
      const deckContainer = cardContainer.parentContainer;
      this._showCardHoverBubble(
        card,
        tint,
        deckContainer?.x ?? this.scene.scale.width / 2,
        deckContainer?.y ?? this.scene.scale.height / 2,
      );
      scene.tweens.killTweensOf(cardContainer);
      scene.tweens.add({
        targets: cardContainer,
        scaleX: 1.04,
        scaleY: 1.04,
        y: localY - 8,
        duration: 140,
        ease: "Quad.easeOut",
      });
    });

    hit.on("pointerout", () => {
      this._hideCardHoverBubble();
      scene.tweens.killTweensOf(cardContainer);
      scene.tweens.add({
        targets: cardContainer,
        scaleX: 1,
        scaleY: 1,
        y: localY,
        duration: 140,
        ease: "Quad.easeOut",
      });
    });

    hit.on("pointerdown", () => {
      this.state.selectStarterDeck(deck.id);
    });

    cardContainer.add([bg, shine, icon, name, hit]);

    return {
      container: cardContainer,
      hit,
    };
  }

  _buildPortraitStrip(deckWidth, deckHeight, contentScale = 1) {
    const scene = this.scene;
    const chipWidth = Math.floor((deckWidth - Math.round(62 * contentScale)) / REQUIRED_STARTER_TYPES.length);
    const chipHeight = Math.round(86 * contentScale);
    const startX = -((REQUIRED_STARTER_TYPES.length - 1) * chipWidth) / 2;
    const y = (deckHeight / 2) - Math.round(62 * contentScale);

    return REQUIRED_STARTER_TYPES.map((typeKey, index) => {
      const unit = createStarterPortraitUnit(typeKey);
      const portraitKey = getPlayerPortraitKey(unit);
      const x = startX + index * chipWidth;

      const chip = this._makeRoundedPanel(chipWidth - 8, chipHeight, {
          fillColor: 0xffffff,
          fillAlpha: 0.05,
          strokeColor: 0xffffff,
          strokeAlpha: 0.08,
          radius: Math.round(18 * contentScale),
        });
      chip.x = x;
      chip.y = y;

      const portrait = scene.add.sprite(x, y - Math.round(10 * contentScale), portraitKey ?? "");
      applyPortraitKeyToSprite(scene, portrait, portraitKey, Math.round(34 * contentScale));

      const label = scene.add.text(x, y + Math.round(22 * contentScale), typeKey, {
        fontSize: this._fontPx(8, 6, contentScale),
        color: TEXT_LIGHT,
        align: "center",
        wordWrap: { width: chipWidth - Math.round(18 * contentScale) },
      }).setOrigin(0.5);

      const count = scene.add.text(x, y + Math.round(36 * contentScale), "x1", {
        fontSize: this._fontPx(8, 6, contentScale),
        color: TEXT_SUBTLE,
      }).setOrigin(0.5);

      return {
        objects: [chip, portrait, label, count],
      };
    });
  }

  _buildFooter(width, height) {
    const scene = this.scene;
    const layout = this.layout;
    const footer = scene.add.container(width / 2, layout.footerY);
    const footerWidth = layout.footerWidth;
    const footerHeight = layout.footerHeight;
    const footerInset = Math.round(30 * layout.scale);
    const backWidth = clamp(Math.round(196 * layout.scale), 152, 206);
    const backHeight = clamp(Math.round(48 * layout.scale), 40, 48);
    const backX = -footerWidth / 2 + (backWidth / 2) + Math.round(24 * layout.scale);
    const confirmX = footerWidth / 2 - (layout.confirmButtonWidth / 2) - Math.round(18 * layout.scale);
    const labelY = -footerHeight / 2 + Math.round(18 * layout.scale) - 5;
    const summaryY = labelY + Math.round(16 * layout.scale);

    const shell = this._makeRoundedPanel(footerWidth, footerHeight, {
      fillColor: HEADER_FILL,
      fillAlpha: 0.8,
      strokeColor: 0xb9efff,
      strokeAlpha: 0.18,
      radius: Math.round(28 * layout.scale),
      shadowColor: 0x08131c,
      shadowAlpha: 0.28,
      shadowOffsetY: Math.round(12 * layout.scale),
    });

    const pickLabel = scene.add.text(-footerWidth / 2 + footerInset, labelY, "Opening Summary", {
      fontSize: this._fontPx(11, 8),
      color: TEXT_SUBTLE,
    }).setOrigin(0, 0.5);

    const summary = scene.add.text(-footerWidth / 2 + footerInset, summaryY, "", {
      fontSize: this._fontPx(12, 9),
      color: TEXT_MUTED,
      wordWrap: { width: 220 },
      lineSpacing: Math.max(2, Math.round(4 * layout.scale)),
    }).setOrigin(0, 0);

    const backButton = this._makeRoundedPanel(backWidth, backHeight, {
      fillColor: 0x173247,
      fillAlpha: 0.92,
      strokeColor: 0xffffff,
      strokeAlpha: 0.12,
      radius: Math.round(20 * layout.scale),
    });
    backButton.x = backX;
    backButton.setVisible(false).setAlpha(0);
    backButton.setInteractive(
      new Phaser.Geom.Rectangle(-backWidth / 2, -backHeight / 2, backWidth, backHeight),
      Phaser.Geom.Rectangle.Contains,
    );

    const backLabel = scene.add.text(backX, 0, "Back To Decks", {
      fontSize: this._fontPx(14, 10),
      color: TEXT_LIGHT,
      stroke: "#0a1420",
      strokeThickness: Math.max(2, Math.round(3 * layout.scale)),
    }).setOrigin(0.5).setVisible(false).setAlpha(0);

    const confirmGlow = this._makeRoundedPanel(layout.confirmGlowWidth, layout.confirmGlowHeight, {
      fillColor: 0x69dfb0,
      fillAlpha: 0.24,
      radius: Math.round(24 * layout.scale),
    });
    confirmGlow.x = confirmX;

    const confirmButton = this._makeRoundedPanel(layout.confirmButtonWidth, layout.confirmButtonHeight, {
      fillColor: 0x2d88ff,
      fillAlpha: 0.98,
      strokeColor: 0xffffff,
      strokeAlpha: 0.18,
      radius: Math.round(22 * layout.scale),
    });
    confirmButton.x = confirmX;
    confirmButton.setInteractive(
      new Phaser.Geom.Rectangle(-layout.confirmButtonWidth / 2, -layout.confirmButtonHeight / 2, layout.confirmButtonWidth, layout.confirmButtonHeight),
      Phaser.Geom.Rectangle.Contains,
    );

    const confirmLabel = scene.add.text(confirmX, 0, "Begin Run", {
      fontSize: this._fontPx(18, 12),
      color: TEXT_LIGHT,
      stroke: "#0a1420",
      strokeThickness: Math.max(2, Math.round(4 * layout.scale)),
    }).setOrigin(0.5);

    confirmButton.on("pointerdown", () => {
      this._confirmDraftStart();
    });
    backButton.on("pointerdown", () => {
      this._setPhase("deck");
    });

    confirmButton.on("pointerover", () => {
      scene.tweens.add({
        targets: [confirmButton, confirmGlow],
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });

    confirmButton.on("pointerout", () => {
      scene.tweens.add({
        targets: [confirmButton, confirmGlow],
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });
    backButton.on("pointerover", () => {
      scene.tweens.add({
        targets: [backButton, backLabel],
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });
    backButton.on("pointerout", () => {
      scene.tweens.add({
        targets: [backButton, backLabel],
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });

    scene.tweens.add({
      targets: confirmGlow,
      alpha: { from: 0.18, to: 0.34 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    footer.add([
      shell,
      pickLabel,
      summary,
      backButton,
      backLabel,
      confirmGlow,
      confirmButton,
      confirmLabel,
    ]);

    this.container.add(footer);
    this.ui.footerSummary = summary;
    this.ui.confirmButton = confirmButton;
    this.ui.confirmGlow = confirmGlow;
    this.ui.confirmLabel = confirmLabel;
    this.ui.confirmX = confirmX;
    this.ui.backButton = backButton;
    this.ui.backLabel = backLabel;
    this.ui.backX = backX;
    this.ui.backButtonWidth = backWidth;
    this.ui.footerSummaryBaseX = -footerWidth / 2 + footerInset;
    this._updateFooterSummaryLayout(layout.confirmButtonWidth);
  }

  _buildCardHoverBubble(width, height) {
    const bubbleWidth = clamp(Math.round(320 * this.layout.scale), 240, 340);
    const bubbleHeight = clamp(Math.round(178 * this.layout.scale), 144, 190);
    const bubble = this.scene.add.container(width / 2, height / 2)
      .setDepth(UIDEPTH + 280)
      .setVisible(false)
      .setAlpha(0);

    const shadow = this._makeRoundedPanel(bubbleWidth + 16, bubbleHeight + 16, {
      fillColor: 0x000000,
      fillAlpha: 0.34,
      radius: Math.round(28 * this.layout.scale),
    });

    const bg = this._makeRoundedPanel(bubbleWidth, bubbleHeight, {
      fillColor: 0x07131c,
      fillAlpha: 0.96,
      strokeColor: 0xffffff,
      strokeAlpha: 0.28,
      radius: Math.round(24 * this.layout.scale),
      shadowColor: 0x000000,
      shadowAlpha: 0.24,
      shadowOffsetY: Math.round(10 * this.layout.scale),
    });

    const shine = this._makeRoundedPanel(bubbleWidth - Math.round(24 * this.layout.scale), Math.round(30 * this.layout.scale), {
      fillColor: 0xffffff,
      fillAlpha: 0.08,
      radius: Math.round(16 * this.layout.scale),
    });
    shine.y = -bubbleHeight / 2 + Math.round(24 * this.layout.scale);

    const icon = this.scene.add.image(0, -bubbleHeight / 2 + Math.round(48 * this.layout.scale), "icon_house").setScale(0.9 * this.layout.scale);
    const title = this.scene.add.text(0, -bubbleHeight / 2 + Math.round(84 * this.layout.scale), "", {
      fontSize: this._fontPx(14, 10),
      color: TEXT_LIGHT,
      stroke: "#07121b",
      strokeThickness: Math.max(2, Math.round(3 * this.layout.scale)),
      align: "center",
      wordWrap: { width: bubbleWidth - Math.round(34 * this.layout.scale) },
    }).setOrigin(0.5);

    const desc = this.scene.add.text(0, Math.round(24 * this.layout.scale), "", {
      fontSize: this._fontPx(11, 8),
      color: TEXT_MUTED,
      stroke: "#07121b",
      strokeThickness: Math.max(2, Math.round(2 * this.layout.scale)),
      align: "center",
      wordWrap: { width: bubbleWidth - Math.round(44 * this.layout.scale) },
      lineSpacing: Math.max(2, Math.round(4 * this.layout.scale)),
    }).setOrigin(0.5);

    bubble.add([shadow, bg, shine, icon, title, desc]);
    this.container.add(bubble);

    this.ui.cardHoverBubble = {
      container: bubble,
      bg,
      icon,
      title,
      desc,
      width: bubbleWidth,
      height: bubbleHeight,
    };
  }

  _showCardHoverBubble(card, tint, x, y) {
    const bubble = this.ui.cardHoverBubble;
    if (!bubble) return;

    this._redrawPanel(bubble.bg, bubble.width, bubble.height, {
      fillColor: 0x07131c,
      fillAlpha: 0.98,
      strokeColor: tint,
      strokeAlpha: 0.9,
      radius: Math.round(24 * this.layout.scale),
      shadowColor: 0x000000,
      shadowAlpha: 0.24,
      shadowOffsetY: Math.round(10 * this.layout.scale),
    });

    bubble.icon.setTexture(card.image).setScale(0.9 * this.layout.scale);
    bubble.title.setText(card.name);
    bubble.desc.setText(card.text);

    bubble.container.setPosition(x, y);
    this.scene.tweens.killTweensOf(bubble.container);
    bubble.container.setVisible(true);
    bubble.container.setAlpha(0);
    bubble.container.setScale(0.96);
    bubble.container.y = y + Math.round(8 * this.layout.scale);
    this.scene.tweens.add({
      targets: bubble.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y,
      duration: 120,
      ease: "Quad.easeOut",
    });
  }

  _hideCardHoverBubble() {
    const bubble = this.ui.cardHoverBubble;
    if (!bubble) return;
    this.scene.tweens.killTweensOf(bubble.container);
    this.scene.tweens.add({
      targets: bubble.container,
      alpha: 0,
      duration: 90,
      ease: "Quad.easeOut",
      onComplete: () => bubble.container.setVisible(false),
    });
  }

  _makeRoundedPanel(width, height, opts = {}) {
    const graphics = this.scene.add.graphics();
    this._redrawPanel(graphics, width, height, opts);
    return graphics;
  }

  _redrawPanel(graphics, width, height, opts = {}) {
    graphics.clear();
    const radius = opts.radius ?? 24;
    const left = -width / 2;
    const top = -height / 2;

    if (opts.shadowAlpha) {
      graphics.fillStyle(opts.shadowColor ?? 0x000000, opts.shadowAlpha);
      graphics.fillRoundedRect(
        left,
        top + (opts.shadowOffsetY ?? 10),
        width,
        height,
        radius,
      );
    }

    graphics.fillStyle(opts.fillColor ?? 0xffffff, opts.fillAlpha ?? 1);
    graphics.fillRoundedRect(left, top, width, height, radius);

    if (opts.strokeAlpha) {
      graphics.lineStyle(opts.strokeWidth ?? 2, opts.strokeColor ?? 0xffffff, opts.strokeAlpha);
      graphics.strokeRoundedRect(left, top, width, height, radius);
    }

    return graphics;
  }

  _refreshUI() {
    const selectedDeck = this.state.getSelectedDeck();
    const input = this._getTeamNameInputElement();
    const isLayout = this.phase === "layout";

    if (input && input.value !== this.state.teamName) {
      this.teamNameInput.setValue(this.state.teamName);
    }

    if (this._teamNameInvalid && this.state.teamName.trim()) {
      this._setTeamNameValidationState(false);
    }

    this.scene.events.emit("draftTeamNameChanged", this.state.teamName);

    if (this.ui.headerSubtitle) {
      this.ui.headerSubtitle.setText(
        isLayout
          ? "Arrange your starting town. Click a building, then click a new open spot to move it before the run begins."
          : "Pick one starter deck. Your farmer, fireman, forager, and builder are locked in from the start.",
      );
    }
    if (this.ui.headerTitle) {
      this.ui.headerTitle.setText(isLayout ? "Town Layout" : "Founding Draft");
    }

    if (this.ui.footerSummary) {
        this.ui.footerSummary.setText(
          isLayout
          ? `Set your town tower, houses, storage, and clay oven where you want them, then start the run. ${selectedDeck?.tradeoff ? `Tradeoff: ${selectedDeck.tradeoff}` : ""}`.trim()
          : `${selectedDeck?.summary ?? ""} ${selectedDeck?.tradeoff ? `Tradeoff: ${selectedDeck.tradeoff}` : ""}`.trim(),
      );
    }

    if (this.ui.confirmLabel) {
      this.ui.confirmLabel.setText(
        isLayout
          ? `Start ${selectedDeck?.name ?? "Run"}`
          : `Arrange ${selectedDeck?.name ?? "Deck"}`,
      );
    }

    const accent = hexToColorInt(selectedDeck?.accent, 0x2d88ff);
    const confirmWidth = clamp(
      Math.max(this.layout.confirmButtonWidth, Math.round((this.ui.confirmLabel?.width ?? 0) + (70 * this.layout.scale))),
      this.layout.confirmButtonWidth,
      Math.min(this.layout.footerWidth - Math.round(90 * this.layout.scale), 460),
    );
    const confirmGlowWidth = confirmWidth + Math.round(16 * this.layout.scale);

    if (this.ui.confirmGlow) {
      this._redrawPanel(this.ui.confirmGlow, confirmGlowWidth, this.layout.confirmGlowHeight, {
        fillColor: accent,
        fillAlpha: 0.24,
        radius: 24,
      });
    }

    if (this.ui.confirmButton) {
      this._redrawPanel(this.ui.confirmButton, confirmWidth, this.layout.confirmButtonHeight, {
        fillColor: accent,
        fillAlpha: 0.98,
        strokeColor: 0xffffff,
        strokeAlpha: 0.18,
        radius: 22,
      });
      this.ui.confirmButton.setInteractive(
        new Phaser.Geom.Rectangle(-confirmWidth / 2, -this.layout.confirmButtonHeight / 2, confirmWidth, this.layout.confirmButtonHeight),
        Phaser.Geom.Rectangle.Contains,
      );
    }

    if (this.ui.backButton && this.ui.backLabel) {
      this.ui.backButton.setVisible(isLayout);
      this.ui.backLabel.setVisible(isLayout);
      this.ui.backButton.setAlpha(isLayout ? 1 : 0);
      this.ui.backLabel.setAlpha(isLayout ? 1 : 0);
    }

    this._updateFooterSummaryLayout(confirmWidth);

    if (this.ui.layoutInfoDeck) {
      this.ui.layoutInfoDeck.setText(selectedDeck?.name ?? "Starter Deck");
    }
    if (this.ui.layoutInfoBody) {
      this.ui.layoutInfoBody.setText(
        `${selectedDeck?.summary ?? ""}\n${selectedDeck?.tradeoff ? `Tradeoff: ${selectedDeck.tradeoff}` : ""}`.trim(),
      );
    }
    if (this.ui.layoutInfoSelected) {
      if (this.selectedPlacedBuilding) {
        const meta = this._getBuildingMeta(this.selectedPlacedBuilding.typeKey ?? this.selectedPlacedBuilding.type?.name);
        this.ui.layoutInfoSelected.setText(`${meta.emoji} ${meta.label} selected. Click a new open spot on the map.`);
      } else {
        this.ui.layoutInfoSelected.setText("Select a building to move it. The town tower, houses, storage, and the clay oven can all be rearranged.");
      }
    }
    for (const entry of this.ui.layoutLegendRefs ?? []) {
      entry.count.setText(`x${this._countPlacedBuildings(entry.types)}`);
    }

    for (const ref of this.ui.deckRefs ?? []) {
      for (const entry of ref.resourceRefs ?? []) {
        entry.value.setText(String(ref.deck.resources?.[entry.key] ?? 0));
      }
      this._syncDeckVisual(ref);
    }
  }

  _syncDeckVisual(ref) {
    const selectedDeckId = this.state.selectedDeckId;
    const isSelected = ref.deck.id === selectedDeckId;
    const accent = ref.accent;
    const scale = isSelected ? 1.02 : ref.isHovered ? 1.015 : 1;
    const targetY = ref.baseY - (isSelected ? 12 : ref.isHovered ? 6 : 0);

    this._redrawPanel(ref.glow, ref.hitArea.width + 10, ref.hitArea.height + 10, {
      fillColor: accent,
      fillAlpha: isSelected ? 0.2 : ref.isHovered ? 0.14 : 0.08,
      radius: 34,
      shadowColor: accent,
      shadowAlpha: isSelected ? 0.18 : 0.1,
      shadowOffsetY: 0,
    });

    this._redrawPanel(ref.panel, ref.hitArea.width, ref.hitArea.height, {
      fillColor: BASE_DECK_FILL,
      fillAlpha: isSelected ? 0.88 : 0.78,
      strokeColor: isSelected ? accent : BASE_DECK_STROKE,
      strokeAlpha: isSelected ? 0.76 : ref.isHovered ? 0.3 : 0.18,
      radius: 32,
      shadowColor: 0x071116,
      shadowAlpha: isSelected ? 0.34 : 0.3,
      shadowOffsetY: 18,
    });

    this._redrawPanel(ref.selectPill, ref.selectPillWidth, ref.selectPillHeight, {
      fillColor: isSelected ? accent : hexToColorInt(ref.deck.accentDark, accent),
      fillAlpha: isSelected ? 1 : 0.8,
      radius: Math.round(17 * ref.contentScale),
    });
    ref.selectPill.x = 0;
    ref.selectPill.y = ref.selectPillY;

    ref.selectLabel.setText(isSelected ? "Selected" : "Starter Deck");
    ref.summary.setColor(isSelected ? TEXT_LIGHT : TEXT_MUTED);

    this.scene.tweens.killTweensOf(ref.container);
    this.scene.tweens.add({
      targets: ref.container,
      scaleX: scale,
      scaleY: scale,
      y: targetY,
      duration: 150,
      ease: "Quad.easeOut",
    });
  }
}
