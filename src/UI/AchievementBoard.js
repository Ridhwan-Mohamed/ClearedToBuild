import Phaser from "phaser";
import { UIDEPTH } from "../constants.js";

const BOARD_W = 332;
const HEADER_H = 0;
const ROW_H = 58;
const ROW_GAP = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class AchievementBoard {
  constructor(scene, worldScene) {
    this.scene = scene;
    this.worldScene = worldScene;
    this.expanded = false;
    this._lastSignature = "";
    this._rowBySlot = new Map();
    this._completionTimers = new Map();

    this.root = scene.add.container(0, 0).setDepth((UIDEPTH ?? 0) + 18);
    this.header = scene.add.container(0, 0);
    this.panel = scene.add.container(0, 0).setVisible(this.expanded).setAlpha(this.expanded ? 1 : 0);

    this.headerShadow = scene.add.graphics();
    this.headerBg = scene.add.graphics();
    this.headerShine = scene.add.graphics();
    this.headerTitle = scene.add.text(0, -6, "TOWN GOALS", {
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#eef8ff",
      stroke: "#07111b",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.headerStatus = scene.add.text(0, 11, "3 ACTIVE", {
      fontFamily: "Bungee",
      fontSize: "9px",
      color: "#b9deef",
      stroke: "#07111b",
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.chevron = scene.add.text(BOARD_W / 2 - 24, 0, "v", {
      fontFamily: "Bungee",
      fontSize: "14px",
      color: "#d6efff",
      stroke: "#07111b",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.headerHit = scene.add.zone(0, 0, BOARD_W, HEADER_H).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.headerHit.on("pointerdown", () => this.toggle());

    this.header.add([
      this.headerShadow,
      this.headerBg,
      this.headerShine,
      this.headerTitle,
      this.headerStatus,
      this.chevron,
      this.headerHit,
    ]);

    this.panelShadow = scene.add.graphics();
    this.panelBg = scene.add.graphics();
    this.panelShine = scene.add.graphics();
    this.panel.add([this.panelShadow, this.panelBg, this.panelShine]);

    this.rows = ["build", "economy", "combat"].map((slot, index) => this._createRow(slot, index));
    this.rows.forEach((row) => {
      this.panel.add(row.root);
      this._rowBySlot.set(row.slot, row);
    });

    this.root.add([this.header, this.panel]);

    this._onChanged = () => this.refresh(true);
    this._onCompleted = (payload) => this._animateCompletion(payload);
    scene.events.on("achievements:changed", this._onChanged);
    scene.events.on("achievement:completed", this._onCompleted);

    this._resizeHandler = () => {
      this.reposition();
      this.refresh(true);
    };
    scene.scale.on("resize", this._resizeHandler);

    this._drawShell();
    this.header.setVisible(false);
    this.reposition();
    this.refresh(true);
  }

  _createRow(slot, index) {
    const root = this.scene.add.container(0, 0);
    root.baseY = HEADER_H + 10 + (ROW_H / 2) + index * (ROW_H + ROW_GAP);

    const bg = this.scene.add.graphics();
    const shine = this.scene.add.graphics();
    const tag = this.scene.add.text(-(BOARD_W / 2) + 34, -17, "", {
      fontFamily: "Bungee",
      fontSize: "9px",
      color: "#ffffff",
      stroke: "#07111b",
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    const title = this.scene.add.text(-(BOARD_W / 2) + 34, -4, "", {
      fontFamily: "Bungee",
      fontSize: "12px",
      color: "#eef8ff",
      stroke: "#07111b",
      strokeThickness: 3,
      wordWrap: { width: 190 },
    }).setOrigin(0, 0.5);
    const desc = this.scene.add.text(-(BOARD_W / 2) + 34, 16, "", {
      fontFamily: "Bungee",
      fontSize: "9px",
      color: "#cfe4f2",
      stroke: "#07111b",
      strokeThickness: 2,
      wordWrap: { width: 200 },
    }).setOrigin(0, 0.5);

    const rewardBg = this.scene.add.graphics();
    const rewardText = this.scene.add.text((BOARD_W / 2) - 76, -14, "", {
      fontFamily: "Bungee",
      fontSize: "8px",
      color: "#fff4cf",
      stroke: "#07111b",
      strokeThickness: 2,
      align: "right",
      wordWrap: { width: 104 },
    }).setOrigin(0.5);

    const progressBg = this.scene.add.graphics();
    const progressText = this.scene.add.text((BOARD_W / 2) - 76, 14, "", {
      fontFamily: "Bungee",
      fontSize: "10px",
      color: "#e6f7ff",
      stroke: "#07111b",
      strokeThickness: 2,
    }).setOrigin(0.5);

    const strike = this.scene.add.graphics();

    root.add([bg, shine, rewardBg, progressBg, tag, title, desc, rewardText, progressText, strike]);
    root.setPosition(0, root.baseY);

    return {
      slot,
      root,
      bg,
      shine,
      tag,
      title,
      desc,
      rewardBg,
      rewardText,
      progressBg,
      progressText,
      strike,
      locked: false,
    };
  }

  _drawShell() {
    this.headerShadow.clear();
    this.headerShadow.fillStyle(0x02060d, 0.28);
    this.headerShadow.fillRoundedRect(-(BOARD_W / 2) + 2, -HEADER_H / 2 + 4, BOARD_W, HEADER_H, 18);

    this.headerBg.clear();
    this.headerBg.fillStyle(0x123548, 0.94);
    this.headerBg.lineStyle(2, 0x9edfff, 0.24);
    this.headerBg.fillRoundedRect(-(BOARD_W / 2), -HEADER_H / 2, BOARD_W, HEADER_H, 18);
    this.headerBg.strokeRoundedRect(-(BOARD_W / 2), -HEADER_H / 2, BOARD_W, HEADER_H, 18);

    this.headerShine.clear();
    this.headerShine.fillStyle(0xffffff, 0.08);
    this.headerShine.fillRoundedRect(-(BOARD_W / 2) + 10, -HEADER_H / 2 + 6, BOARD_W - 20, 13, 10);

    const panelH = this.rows.length * ROW_H + (this.rows.length - 1) * ROW_GAP + 20;
    this.panelShadow.clear();
    this.panelShadow.fillStyle(0x02060d, 0.26);
    this.panelShadow.fillRoundedRect(-(BOARD_W / 2) + 3, HEADER_H - 5, BOARD_W, panelH, 20);

    this.panelBg.clear();
    this.panelBg.fillStyle(0x10283a, 0.86);
    this.panelBg.lineStyle(2, 0x89d6ff, 0.18);
    this.panelBg.fillRoundedRect(-(BOARD_W / 2), HEADER_H - 10, BOARD_W, panelH, 20);
    this.panelBg.strokeRoundedRect(-(BOARD_W / 2), HEADER_H - 10, BOARD_W, panelH, 20);

    this.panelShine.clear();
    this.panelShine.fillStyle(0xffffff, 0.05);
    this.panelShine.fillRoundedRect(-(BOARD_W / 2) + 10, HEADER_H - 2, BOARD_W - 20, 18, 12);
  }

  _goalSignature(snapshot) {
    return JSON.stringify({
      expanded: this.expanded,
      serial: snapshot?.serial || 0,
      completed: snapshot?.totalCompleted || 0,
      goals: (snapshot?.activeGoals || []).map((goal) => ({
        id: goal.instanceId,
        value: goal.progressValue,
        target: goal.progressTarget,
        title: goal.title,
      })),
    });
  }

  _renderRow(row, goal, { completed = false } = {}) {
    if (!row) return;
    if (!goal) {
      row.root.setVisible(false);
      return;
    }

    row.root.setVisible(true);
    row.root.setAlpha(1);
    row.root.setScale(1);

    const accent = completed ? 0x5fd18a : Number(goal.accent || 0x9edfff);
    const fill = completed ? 0x173725 : Number(goal.fill || 0x10283a);
    const stroke = completed ? 0x93f5b5 : Number(goal.stroke || 0x89d6ff);

    row.bg.clear();
    row.bg.fillStyle(fill, 0.98);
    row.bg.lineStyle(2, stroke, 0.28);
    row.bg.fillRoundedRect(-(BOARD_W / 2) + 8, -(ROW_H / 2), BOARD_W - 16, ROW_H, 16);
    row.bg.strokeRoundedRect(-(BOARD_W / 2) + 8, -(ROW_H / 2), BOARD_W - 16, ROW_H, 16);

    row.shine.clear();
    row.shine.fillStyle(0xffffff, completed ? 0.08 : 0.05);
    row.shine.fillRoundedRect(-(BOARD_W / 2) + 18, -(ROW_H / 2) + 6, BOARD_W - 36, 12, 10);

    row.tag.setText(String(goal.slotLabel || "").toUpperCase());
    row.tag.setColor(completed ? "#bff6d3" : "#d8f2ff");
    row.title.setText(completed ? `${goal.title} COMPLETE` : goal.title);
    row.title.setColor(completed ? "#d9ffe4" : "#eef8ff");
    row.desc.setText(goal.description || "");
    row.desc.setColor(completed ? "#b9efc9" : "#cfe4f2");

    row.rewardBg.clear();
    row.rewardBg.fillStyle(completed ? 0x24593a : 0x5a4311, 0.96);
    row.rewardBg.lineStyle(2, completed ? 0xbff6d3 : 0xf7d58b, 0.26);
    row.rewardBg.fillRoundedRect((BOARD_W / 2) - 132, -25, 112, 22, 11);
    row.rewardBg.strokeRoundedRect((BOARD_W / 2) - 132, -25, 112, 22, 11);
    row.rewardText.setText(completed ? "Reward paid" : (goal.rewardText || ""));
    row.rewardText.setColor(completed ? "#d9ffe4" : "#fff4cf");

    row.progressBg.clear();
    row.progressBg.fillStyle(completed ? 0x2f7d4f : 0x16364d, 0.96);
    row.progressBg.lineStyle(2, completed ? 0xbff6d3 : accent, 0.28);
    row.progressBg.fillRoundedRect((BOARD_W / 2) - 116, 4, 96, 22, 11);
    row.progressBg.strokeRoundedRect((BOARD_W / 2) - 116, 4, 96, 22, 11);
    row.progressText.setText(completed ? "DONE" : `${goal.progressValue}/${goal.progressTarget}`);
    row.progressText.setColor(completed ? "#f0fff5" : "#e6f7ff");

    row.strike.clear();
    if (completed) {
      row.strike.lineStyle(4, 0xbff6d3, 0.9);
      row.strike.beginPath();
      row.strike.moveTo(-(BOARD_W / 2) + 28, 4);
      row.strike.lineTo((BOARD_W / 2) - 142, 4);
      row.strike.strokePath();
    }
  }

  _animateCompletion(payload) {
    const completed = payload?.completed;
    if (!completed) return;

    this._pulseHeader();

    if (!this.expanded) {
      this.scene.time.delayedCall(720, () => this.refresh(true));
      return;
    }

    const row = this._rowBySlot.get(completed.slot);
    if (!row) return;

    this._completionTimers.get(row.slot)?.remove?.(false);
    row.locked = true;
    this._renderRow(row, completed, { completed: true });
    this.scene.tweens.killTweensOf(row.root);
    this.scene.tweens.add({
      targets: row.root,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 130,
      ease: "Sine.Out",
      yoyo: true,
    });
    this.scene.tweens.add({
      targets: row.root,
      alpha: 0.32,
      delay: 390,
      duration: 260,
      ease: "Quad.Out",
    });

    const timer = this.scene.time.delayedCall(720, () => {
      row.locked = false;
      row.root.setAlpha(0);
      row.root.setPosition(0, row.root.baseY + 8);
      this.refresh(true);
      this.scene.tweens.add({
        targets: row.root,
        alpha: 1,
        y: row.root.baseY,
        duration: 220,
        ease: "Back.Out",
      });
    });
    this._completionTimers.set(row.slot, timer);
  }

  _pulseHeader() {
    const pulseTarget = this.scene.townXpHud || this.root;
    this.scene.tweens.killTweensOf(pulseTarget);
    pulseTarget.setScale(1);
    this.scene.tweens.add({
      targets: pulseTarget,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 130,
      ease: "Sine.Out",
      yoyo: true,
    });
  }

  toggle() {
    this.expanded = !this.expanded;
    this.chevron.setText(this.expanded ? "v" : "^");
    this.scene.tweens.killTweensOf(this.panel);
    this.panel.setVisible(true);
    this.scene.tweens.add({
      targets: this.panel,
      alpha: this.expanded ? 1 : 0,
      scaleY: this.expanded ? 1 : 0.94,
      duration: 180,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (!this.expanded) {
          this.panel.setVisible(false);
        }
      },
    });
    this.refresh(true);
  }

  reposition() {
    const hud = this.scene.townXpHud;
    const panelWidth = Math.max(BOARD_W, Number(hud?.panelWidth || BOARD_W));
    const centerX = clamp(Number(hud?.x || 180), panelWidth / 2 + 16, this.scene.scale.width - panelWidth / 2 - 16);
    const topY = Math.round((Number(hud?.y || 72) + Number(hud?.panelHeight || 60) / 2) + 14);
    this.root.setPosition(centerX, topY);
  }

  refresh(force = false) {
    const snapshot = this.worldScene?.getAchievementBoardSnapshot?.() || {
      serial: 0,
      totalCompleted: 0,
      activeGoals: [],
    };
    const signature = this._goalSignature(snapshot);
    if (!force && signature === this._lastSignature) return;
    this._lastSignature = signature;

    const activeCount = Array.isArray(snapshot.activeGoals) ? snapshot.activeGoals.length : 0;
    this.headerStatus.setText(`${activeCount} ACTIVE  ${snapshot.totalCompleted || 0} DONE`);
    this.chevron.setText(this.expanded ? "v" : "^");
    this.reposition();

    const goalsBySlot = new Map((snapshot.activeGoals || []).map((goal) => [goal.slot, goal]));
    this.rows.forEach((row) => {
      if (row.locked) return;
      this._renderRow(row, goalsBySlot.get(row.slot));
      row.root.setPosition(0, row.root.baseY);
    });
  }

  update() {
    this.refresh(false);
  }

  destroy() {
    this.scene.events.off("achievements:changed", this._onChanged);
    this.scene.events.off("achievement:completed", this._onCompleted);
    this.scene.scale.off("resize", this._resizeHandler);
    this._completionTimers.forEach((timer) => timer?.remove?.(false));
    this._completionTimers.clear();
    this.root?.destroy?.(true);
    this.root = null;
  }
}
