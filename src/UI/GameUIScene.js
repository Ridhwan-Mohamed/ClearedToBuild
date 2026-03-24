import Phaser from "phaser";
import { UIDEPTH } from "../constants";
import { DailyNeedsTracker } from "./DailyNeedsTracker";
import { Clock } from "../Controllers/Clock";
import { CreateBottomBar } from "./BottomBar/BottomBar";
import { StageState } from "../parcelController/StageState";
import { Teams } from "../Teams";

export class GameUIScene extends Phaser.Scene {
  constructor() {
    super("GameUIScene");
    this.worldScene = null;
    this._bridged = [];
  }

  init(data) {
    this.worldSceneKey = data?.worldSceneKey || "mapView";
  }

  create() {
    const world = this.scene.get(this.worldSceneKey);
    if (!world) return;
    this.bindWorldScene(world);
  }

  bindWorldScene(world) {
    this.worldScene = world;
    world.uiScene = this;

    this._bridgeWorldEvents();
    this._forwardWorldState();
  }

  _bridgeWorldEvents() {
    this._bridged.forEach(({ evt, fn }) => this.worldScene?.events?.off(evt, fn));
    this._bridged = [];

    const passthrough = [
      "oven:updated",
      "oven:added",
      "oven:removed",
      "storage:added",
      "storage:removed",
      "storage:updated",
      "cards:updated",
      "mode:completed",
    ];

    passthrough.forEach((evt) => {
      const fn = (...args) => this.events.emit(evt, ...args);
      this.worldScene.events.on(evt, fn);
      this._bridged.push({ evt, fn });
    });
  }

  _forwardWorldState() {
    const fields = [
      "money",
      "seeds",
      "berries",
      "woodAmnt",
      "stoneAmnt",
      "foodAmnt",
      "cleanWaterAmnt",
      "farmMode",
      "seedGridMode",
      "attackMode",
      "stoneWallMode",
      "woodWallMode",
      "destroyWallMode",
      "guardPlacement",
      "wallPlacer",
      "wallDestroyer",
      "uiBottomBar",
    ];

    fields.forEach((k) => {
      if (Object.getOwnPropertyDescriptor(this, k)) return;
      Object.defineProperty(this, k, {
        get: () => this.worldScene?.[k],
        set: (v) => {
          if (this.worldScene) this.worldScene[k] = v;
        },
      });
    });

    const fnNames = [
      "checkSufficientFunds",
      "checkSufficientSeeds",
      "checkSufficientBerries",
      "updateMoney",
      "updateSeeds",
      "updateBerry",
      "processEnemySelection",
    ];
    fnNames.forEach((k) => {
      if (typeof this[k] === "function") return;
      this[k] = (...args) => this.worldScene?.[k]?.(...args);
    });
  }

  initGameplayUI() {
    if (!this.worldScene) return;
    if (this._hudBuilt) return;

    this._buildTopHud();
    this._buildStageMetaHud();
    CreateBottomBar(this);
    this._hudBuilt = true;

    this._syncWorldUiRefs();
  }

  _syncWorldUiRefs() {
    const w = this.worldScene;
    if (!w) return;

    w.moneyText = this.moneyText;
    w.seedsText = this.seedsText;
    w.berryText = this.berryText;
    w.woodText = this.woodText;
    w.stoneText = this.stoneText;
    w.foodText = this.foodText;
    w.waterText = this.waterText;
    w.clockText = this.clockText;

    w.uiBottomBar = this.uiBottomBar;
    w.setBottomBar = this.setBottomBar;
    w.openDetailPage = this.openDetailPage;
    w.playerTab = this.playerTab;
    w.clayTab = this.clayTab;
    w.storageTab = this.storageTab;
    w.housesTab = this.housesTab;
    w.buildTab = this.buildTab;
    w.cardsTab = this.cardsTab;
  }

  _buildTopHud() {
    const W = this.scale.width;
    const H = 36;
    const world = this.worldScene;

    const bar = this.add.rectangle(0, 0, W, H, 0x222222, 0.7).setOrigin(0, 0).setDepth(UIDEPTH - 1);
    this.scale.on("resize", ({ width }) => bar.setSize(width, H));

    const makeIcon = (x, key) =>
      this.add.image(x, H / 2, key).setDisplaySize(20, 20).setOrigin(0, 0.5).setDepth(UIDEPTH);

    const makeText = (x, text, color = "#fff") =>
      this.add
        .text(x, H / 2, text, {
          fontSize: "14px",
          fill: color,
          fontFamily: "Bungee",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setDepth(UIDEPTH);

    let x = 12;
    const spacing = 8;
    const iconSize = 20;

    const needs = DailyNeedsTracker.getValues();
    this.topHudElements = [];

    for (const item of needs) {
      const icon = makeIcon(x, item.key);
      x += iconSize + 4;
      const display = item.need ? `${item.have}/${item.need}` : `${item.have}`;
      const color = item.need ? (item.have >= item.need ? "#00ff00" : "#ff3333") : item.have > 0 ? "#00ff00" : "#ff3333";
      const text = makeText(x, display, color);
      x += text.width + spacing;

      if (item.key === "foodIcon") this.foodText = text;
      if (item.key === "waterIcon") this.waterText = text;

      this.topHudElements.push(icon, text);
    }

    const resources = [
      { key: "seeds", value: world.seeds },
      { key: "berry", value: world.berries },
      { key: "woodIcon", value: world.woodAmnt },
      { key: "stoneIcon", value: world.stoneAmnt },
    ];

    for (const r of resources) {
      const icon = makeIcon(x, r.key);
      x += iconSize + 4;
      const text = makeText(x, `${r.value}`);
      x += text.width + spacing;

      switch (r.key) {
        case "seeds":
          this.seedsText = text;
          break;
        case "berry":
          this.berryText = text;
          break;
        case "woodIcon":
          this.woodText = text;
          break;
        case "stoneIcon":
          this.stoneText = text;
          break;
      }

      this.topHudElements.push(icon, text);
    }

    const centerX = W / 2;
    const moneyIcon = makeIcon(centerX - 30, "monies");
    this.moneyText = makeText(centerX - 4, `$${world.money}`);
    this.topHudElements.push(moneyIcon, this.moneyText);

    const clockX = W - 160;
    if (!world.clock || typeof world.clock.formatTimeWithDay !== "function") {
      world.clock = new Clock(world);
    }
    this.clockText = makeText(clockX, world.clock.formatTimeWithDay());
    world.clock.externalText = this.clockText;
    this.topHudElements.push(this.clockText);

    this.topHud = this.add.container(0, 0, [bar, ...this.topHudElements]).setDepth(UIDEPTH);
  }

  _buildStageMetaHud() {
    if (this.stageMetaText) return;

    const panelY = 42;
    const panelX = 12;

    this.stageMetaText = this.add.text(panelX, panelY, "", {
      fontFamily: "Bungee",
      fontSize: "18px",
      color: "#f6f0ff",
      stroke: "#000000",
      strokeThickness: 4,
      align: "left",
    }).setOrigin(0, 0).setDepth(UIDEPTH + 1);

    const recompute = () => {
      const stage = Math.max(1, Number(StageState.stageIndex || 1));
      const season = Math.max(1, Number(StageState.seasonIndex || 1));
      const stageCap = 5;
      const isBoss = stage >= stageCap;
      const seasonIcons = ["\uD83C\uDF31", "\u2600\uFE0F", "\uD83C\uDF42", "\u2744\uFE0F"];
      const seasonIcon = seasonIcons[(season - 1) % seasonIcons.length];

      const seasonLabel = `${seasonIcon} Season ${season}`;
      const stageLabel = isBoss ? `\uD83D\uDC79 BOSS` : `\u2694\uFE0F Stage ${stage}/4`;

      const obj = StageState?._fortObjective;
      const towersRequired = Math.max(0, Number(obj?.requiredCount || 0));
      const towersDestroyed = Math.max(0, Number(obj?.destroyedSet?.size || 0));

      const totalFortEnemies = Math.max(0, Number(obj?.meta?.requiredFortEnemyCount || 0));
      const aliveFortEnemies = (Teams.teamLists?.["0"]?.fighterList || []).filter(
        (t) => t?.active && t?.isFortGrunt
      ).length;
      const fortDestroyed = Math.max(
        0,
        totalFortEnemies > 0 ? (totalFortEnemies - aliveFortEnemies) : 0
      );

      const line1 = seasonLabel;
      const line2 = stageLabel;
      const line3 = `\uD83C\uDFF0 Towers ${towersDestroyed}/${towersRequired}`;
      const line4 = `\uD83D\uDC80 Fort enemies ${fortDestroyed}/${totalFortEnemies}`;

      this.stageMetaText.setText(`${line1}\n${line2}\n${line3}\n${line4}`);
      this.stageMetaText.setColor(isBoss ? "#ff4d4d" : "#f6f0ff");
    };

    recompute();
    this.worldScene?.events?.on?.("stage:changed", recompute);
    this.worldScene?.events?.on?.("season:changed", recompute);

    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: recompute,
    });

    this.scale.on("resize", () => {
      this.stageMetaText?.setPosition(panelX, panelY);
    });
  }
  _ghostAt(targetText, content, color) {
    if (!targetText) return;
    const ghost = this.add
      .text(targetText.x, targetText.y, content, { fontSize: "18px", fill: color })
      .setOrigin(0, 0)
      .setDepth(UIDEPTH);
    this.tweens.add({
      targets: ghost,
      y: ghost.y - 20,
      alpha: 0,
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => ghost.destroy(),
    });
  }

  onMoneyChanged(amountDelta) {
    if (!this.moneyText || !this.worldScene) return;
    const isGain = amountDelta > 0;
    const color = isGain ? "#00ff00" : "#ff3333";
    const sign = isGain ? "+" : "-";
    this.moneyText.setText(`$${this.worldScene.money}`);
    this.moneyText.setFill(color);
    this._ghostAt(this.moneyText, `${sign}$${Math.abs(amountDelta)}`, color);
    this.time.delayedCall(600, () => this.moneyText?.setFill("#ffffff"));
  }

  onSeedsChanged(amountDelta) {
    if (!this.seedsText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#00ff00" : "#ff3333";
    this.seedsText.setText(`${this.worldScene.seeds}`);
    this.seedsText.setFill(color);
    this._ghostAt(this.seedsText, amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`, color);
    this.time.delayedCall(600, () => this.seedsText?.setFill("#ffffff"));
  }

  onBerryChanged(amountDelta) {
    if (!this.berryText || !this.worldScene) return;
    const color = amountDelta > 0 ? "#00ff00" : "#ff3333";
    this.berryText.setText(`${this.worldScene.berries}`);
    this.berryText.setFill(color);
    this._ghostAt(this.berryText, amountDelta > 0 ? `+${amountDelta}` : `${amountDelta}`, color);
    this.time.delayedCall(600, () => this.berryText?.setFill("#ffffff"));
  }
}
