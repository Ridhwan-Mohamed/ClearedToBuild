import ClayOvenTab from "./clayOvenTab";
import FunctionTab from "./FunctionTab";
import PlayerTab from "./PlayerTab";
import StorageTab from "./storageTab";
import CardsTab from "./CardsTab";   
import HousesTab from "./HousesTab"
import BuildTab from "./BuildTab";
import {
  BOTTOM_BAR_THEME,
  makeGlassRoundRect,
  mixColor,
  setHoverLiftState,
} from "./BottomBarTheme";

const COLOR_DARK = 0x0f3144;
const COLOR_FUNCTIONS = 0x8f7cff;
const COLOR_PLAYERS   = 0x57d68d;
const COLOR_OVENS     = 0xff8a65;
const COLOR_STORAGE   = 0xffc97a;
const COLOR_CARDS     = 0xffdd73;
const COLOR_BROWNISH  = 0xa78bfa;
const COLOR_BUILD     = 0xff97c2;

// after EXPANDED/COLLAPSED:
const COLLAPSED = 32;     // how much of the bar stays visible when hidden
const EXPANDED  = 160;    // full bar height (tall enough for your tabs/pages)
const START_OPEN  = false; // start expanded?

export function CreateBottomBar(scene) {
  scene.uiBottomBar?.destroy?.();
  const tabPage = CreateTabPage(scene);
  const collapsedOffset = EXPANDED - COLLAPSED + 155;

  const ui = tabPage.sizer
    .setOrigin(0.5, 1)
    // ✅ start in collapsed position (no mystery +95/+155)
    .setPosition(scene.scale.width / 2, scene.scale.height + collapsedOffset)
    .setMinSize(scene.scale.width, EXPANDED)
    .layout();

  const tabs = tabPage.tabs;
  const pages = tabPage.pages;
  const toggleBtn = tabPage.toggleBtn;
  syncTabButtonAnchors(tabs, toggleBtn);

  let expanded = START_OPEN;
  let tween = null;

  const EXPANDED_Y = scene.scale.height;
  const COLLAPSED_Y = scene.scale.height + (EXPANDED - COLLAPSED + 155); // ✅ no extra offset

  // after you have `tabs` and `pages`
  scene.uiBottomBar = {
    ui,
    tabs,
    pages,
    currentPage: 'functions',
    expanded: START_OPEN,
    expandedY: EXPANDED_Y,
    collapsedY: COLLAPSED_Y,
    openProgress: START_OPEN ? 1 : 0,
  };

  const syncBottomBarLayout = () => {
    const width = scene.scale.width;
    const expandedY = scene.scale.height;
    const collapsedY = scene.scale.height + collapsedOffset;
    const progress = scene.uiBottomBar?.openProgress ?? (expanded ? 1 : 0);
    ui.setMinSize(width, EXPANDED);
    ui.setPosition(width / 2, Phaser.Math.Linear(collapsedY, expandedY, progress));
    ui.layout();
    syncTabButtonAnchors(tabs, toggleBtn);
    scene.uiBottomBar.expandedY = expandedY;
    scene.uiBottomBar.collapsedY = collapsedY;
  };
  syncBottomBarLayout();

  // ensure setBottomBar updates scene.uiBottomBar.expanded too
  function setBottomBar(open) {
    if (tween) tween.stop();
    tween = scene.tweens.add({
      targets: ui,
      y: open ? scene.uiBottomBar.expandedY : scene.uiBottomBar.collapsedY,
      duration: 200,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const expandedY = scene.uiBottomBar.expandedY;
        const collapsedY = scene.uiBottomBar.collapsedY;
        const travel = collapsedY - expandedY;
        const progress = travel <= 0 ? (open ? 1 : 0) : Phaser.Math.Clamp((collapsedY - ui.y) / travel, 0, 1);
        scene.uiBottomBar.openProgress = progress;
      },
      onComplete: () => {
        expanded = open;
        scene.uiBottomBar.expanded = open;   // ✅ keep in sync
        scene.uiBottomBar.openProgress = open ? 1 : 0;
        tween = null;

        if (scene.uiBottomBar.currentPage === 'players') {
          if (open) scene.playerTab?.onShow?.();
          else scene.playerTab?.onHide?.();
        }

        const t = toggleBtn.getElement?.('text') || toggleBtn.text;
        if (t) t.setText(expanded ? '▼' : '▲');
      }
    });
  }

  function toggleBottomBar() {
    setBottomBar(!expanded);
  }

  const onTogglePointerUp = () => toggleBottomBar();
  const onTabButtonClick = (btn) => {
    const key = btn?.name;
    if (!key) return;
    scene.cameras.main?.setScroll?.(0, 0);

    pages.swapPage(key);
    scene.uiBottomBar.currentPage = key;

    if (!expanded) setBottomBar(true);

    if (key !== 'players') {
      scene.playerTab?.hidePortrait?.();
      scene.playerTab?.onHide?.();
    }
    if (key !== 'ovens')   scene.clayTab?.hide?.();
    if (key !== 'storage') scene.storageTab?.hide?.();
    if (key !== 'houses')  scene.housesTab?.hide?.();
    if (key !== 'build') scene.buildTab?.hide?.();

    if (key === 'ovens')   scene.clayTab?.onShow?.();
    if (key === 'storage') scene.storageTab?.onShow?.();
    if (key === 'players') scene.playerTab?.onShow?.();
    if (key === 'houses')  scene.housesTab?.onShow?.();
    if (key === 'build') scene.buildTab?.onShow?.();
    updateTabButtonStyles(tabs, key);
  };
  const onSpaceToggle = () => toggleBottomBar();

  scene.setBottomBar = setBottomBar;

  scene.openDetailPage = function(pageKey, callback) {
    const bar = scene.uiBottomBar;
    if (!bar) return;
    scene.cameras.main?.setScroll?.(0, 0);

    // 1) swap page
    bar.pages.swapPage(pageKey);
    bar.currentPage = pageKey;

    // 2) sync the radio tab selection so UI matches
    bar.tabs?.setValue?.(pageKey);

    // 3) expand if needed
    if (!bar.expanded) scene.setBottomBar(true);

    // 4) map to the real tab object instances
    const tab =
      (pageKey === 'ovens')   ? scene.clayTab :
      (pageKey === 'storage') ? scene.storageTab :
      (pageKey === 'players') ? scene.playerTab :
      (pageKey === 'houses')  ? scene.housesTab :
      null;

    if (pageKey !== 'players') {
      scene.playerTab?.onHide?.();
    }

    // 5) show hook
    tab?.onShow?.();

    // 6) run selection callback
    if (callback && tab) callback(tab);
  };

  // ✅ toggle button
  toggleBtn
    .setInteractive({ useHandCursor: true })
    .on('pointerup', onTogglePointerUp);

  // ✅ click tabs
  tabs.on('button.click', onTabButtonClick);

  // default page
  pages.swapPage('functions');
  tabs.setValue?.('functions');
  updateTabButtonStyles(tabs, 'functions');

  // (optional) spacebar toggle
  scene.input.keyboard.on('keydown-SPACE', onSpaceToggle);
  scene.scale.on('resize', syncBottomBarLayout);

  scene.uiBottomBar.destroy = () => {
    const bar = scene.uiBottomBar;
    if (!bar || bar._destroying) return;
    bar._destroying = true;

    if (tween) {
      tween.stop();
      tween = null;
    }

    toggleBtn?.off?.('pointerup', onTogglePointerUp);
    tabs?.off?.('button.click', onTabButtonClick);
    scene.input?.keyboard?.off?.('keydown-SPACE', onSpaceToggle);
    scene.scale?.off?.('resize', syncBottomBarLayout);

    scene.functionTab?.destroy?.();
    scene.playerTab?.destroy?.();
    scene.clayTab?.destroy?.();
    scene.storageTab?.destroy?.();
    scene.housesTab?.destroy?.();
    scene.buildTab?.destroy?.();
    scene.cardsTab?.destroy?.();

    scene.functionTab = null;
    scene.playerTab = null;
    scene.clayTab = null;
    scene.storageTab = null;
    scene.housesTab = null;
    scene.buildTab = null;
    scene.cardsTab = null;
    scene.setBottomBar = null;
    scene.openDetailPage = null;

    bar.ui?.destroy?.(true);
    if (scene.uiBottomBar === bar) {
      scene.uiBottomBar = null;
    }
  };

  scene.housesTab?.hide?.();
}


var CreateTabPage = function (scene) {
  const sizer = scene.rexUI.add.sizer({
    width: scene.scale.width,
    orientation: 'y',
    space: { left: 0, right: 0, top: 0, bottom: 0, item: 0 }
  });
  sizer.addBackground(
    makeGlassRoundRect(scene, 0, 0, 24, {
      fill: BOTTOM_BAR_THEME.shellFill,
      alpha: BOTTOM_BAR_THEME.shellAlpha,
      stroke: BOTTOM_BAR_THEME.shellStroke,
      strokeAlpha: BOTTOM_BAR_THEME.shellStrokeAlpha,
    })
  );

  const topRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 6 } });
  topRow.addBackground(
    makeGlassRoundRect(scene, 0, 0, 18, {
      fill: mixColor(BOTTOM_BAR_THEME.shellFill, 0xffffff, 0.08),
      alpha: 0.78,
      stroke: BOTTOM_BAR_THEME.shellStroke,
      strokeAlpha: 0.12,
    })
  );

  const tabs = CreateButtons(scene);
  const toggleBtn = CreateToggleLabel(scene, '▲', 44);
  const pages = CreatePages(scene);

  // ✅ IMPORTANT: give keys so ui.getElement('tabs') works
  topRow.add(tabs,      { key: 'tabs',      proportion: 1, expand: true,  align: 'left' });
  topRow.add(toggleBtn, { key: 'toggleBtn', proportion: 0, expand: false, align: 'right' });

  sizer.add(topRow, { expand: true });
  sizer.add(pages, { key: 'pages', proportion: 1, expand: true });

  // ✅ Return real references so we don't depend on getElement()
  return { sizer, tabs, pages, toggleBtn };
};

var CreateButtons = function (scene) {
  const TAB_W = 50;
  const tabs = scene.rexUI.add.buttons({
    orientation: 'x',
    space: { left : 4, item: 6 },
    buttons: [
      CreateLabel(scene, 'Functions', COLOR_FUNCTIONS, TAB_W).setName('functions'),
      CreateLabel(scene, 'Store', COLOR_BUILD, TAB_W).setName('build'),
      CreateLabel(scene, 'Players',   COLOR_PLAYERS,   TAB_W).setName('players'),
      CreateLabel(scene, 'Clay Ovens',COLOR_OVENS,     TAB_W).setName('ovens'),
      CreateLabel(scene, 'Storage',   COLOR_STORAGE,   TAB_W).setName('storage'),
      CreateLabel(scene, 'Houses',    COLOR_BROWNISH, TAB_W).setName('houses'),
      CreateLabel(scene, 'Cards',      COLOR_CARDS,     TAB_W).setName('cards'),   
    ],
    buttonsType: 'radio'
  });
  (tabs.buttons || []).forEach((button) => {
    button.hovered = false;
    button.baseY = button.y;
    button.on('pointerover', () => {
      button.hovered = true;
      applyTabLabelVisual(button, button.__selected === true);
    });
    button.on('pointerout', () => {
      button.hovered = false;
      applyTabLabelVisual(button, button.__selected === true);
    });
    applyTabLabelVisual(button, false);
  });
  return tabs;
};

var CreateLabel = function (scene, text, color, width) {
  const label = scene.rexUI.add.label({
    width,
    height: 34,
    background: makeGlassRoundRect(
      scene,
      0,
      0,
      14,
      {
        fill: BOTTOM_BAR_THEME.tabIdleFill,
        alpha: BOTTOM_BAR_THEME.tabIdleAlpha,
        stroke: color,
        strokeAlpha: 0.14,
        strokeWidth: 1.5,
      }
    ),

    text: scene.add.text(0, 0, text, {
      fontSize: 14,
      fontFamily: "Bungee",
      color: BOTTOM_BAR_THEME.text,
      fontStyle: 'bold',
      stroke: '#08202d',
      strokeThickness: 2,
    }),

    space: { left: 12, right: 12, top: 6, bottom: 6 }
  });
  label.accentColor = color;
  label.__selected = false;
  return label;
};

var CreateToggleLabel = function (scene, text, width = 44) {
  const label = scene.rexUI.add.label({
    width,
    height: 34,
    background: makeGlassRoundRect(scene, 0, 0, 14, {
      fill: mixColor(BOTTOM_BAR_THEME.shellFill, 0xffffff, 0.08),
      alpha: 0.84,
      stroke: BOTTOM_BAR_THEME.shellStroke,
      strokeAlpha: 0.18,
      strokeWidth: 1.5,
    }),

    text: scene.add.text(0, 0, text, {
      fontSize: 15,
      fontFamily: "Bungee",
      color: BOTTOM_BAR_THEME.text,
      fontStyle: 'bold',
      stroke: '#08202d',
      strokeThickness: 2,
    }),

    space: { left: 14, right: 14, top: 6, bottom: 6 }
  });
  label.baseY = label.y;
  label.on('pointerover', () => {
    label.baseY ??= label.y;
    setHoverLiftState(scene, label, true, { baseY: label.baseY, hoverLift: 0, hoverScale: 1.04, moveY: false });
  });
  label.on('pointerout', () => {
    label.baseY ??= label.y;
    setHoverLiftState(scene, label, false, { baseY: label.baseY, hoverLift: 0, hoverScale: 1.04, moveY: false });
  });
  return label;
};

var CreatePages = function (scene) {
    const pages = scene.rexUI.add.pages({ fadeDuration: 500 })
        .addBackground(makeGlassRoundRect(scene, 0, 0, 22, {
          fill: COLOR_DARK,
          alpha: 0.72,
          stroke: BOTTOM_BAR_THEME.shellStroke,
          strokeAlpha: 0.10,
        }))
        .add(new FunctionTab(scene, 0, 0, scene.scale.width, EXPANDED - 34).getContainer(), { key: 'functions', expand: true });

    const playerTab = new PlayerTab(scene);
    pages.add(playerTab.view, { key: 'players', expand: true });
    scene.playerTab = playerTab;

    const clayTab = new ClayOvenTab(scene);
    ClayOvenTab.ensureBlankTexture(scene);
    pages.add(clayTab.view, { key: 'ovens', expand: true });
    scene.clayTab = clayTab;

    // inside CreatePages(scene) where other tabs are created
    scene.buildTab = new BuildTab(scene, 0, 0, scene.scale.width, EXPANDED - 40); // pass dimensions to BuildTab
    pages.add(scene.buildTab.view, { key: 'build', expand: true });

    const storageTab = new StorageTab(scene);
    pages.add(storageTab.view, { key: 'storage', expand: true });
    pages.storageTab = storageTab;
    scene.storageTab = storageTab;
    storageTab.refresh(1);

    const housesTab = new HousesTab(scene);
    pages.add(housesTab.view, { key: 'houses', expand: true });
    pages.housesTab = housesTab;
    scene.housesTab = housesTab;
    housesTab.refresh(1);

    const cardsTab = new CardsTab(scene);                        
    pages.add(cardsTab.view, { key: 'cards', expand: true });    
    scene.cardsTab = cardsTab;                                   

    pages.clayTab   = clayTab;
    pages.playerTab = playerTab;

    return pages;
};

function applyTabLabelVisual(label, selected) {
  if (!label) return;
  const bg = label.getElement?.('background') || label.background;
  const text = label.getElement?.('text') || label.text;
  const accent = label.accentColor ?? 0xffffff;
  const hovered = !!label.hovered;

  label.__selected = selected;
  bg?.setFillStyle(
    selected ? mixColor(accent, 0xffffff, 0.18) : (hovered ? BOTTOM_BAR_THEME.tabHoverFill : BOTTOM_BAR_THEME.tabIdleFill),
    selected ? BOTTOM_BAR_THEME.tabSelectedAlpha : (hovered ? BOTTOM_BAR_THEME.tabHoverAlpha : BOTTOM_BAR_THEME.tabIdleAlpha)
  );
  bg?.setStrokeStyle(
    selected ? 2 : 1.5,
    selected ? accent : mixColor(accent, BOTTOM_BAR_THEME.shellStroke, 0.35),
    selected ? 0.56 : (hovered ? 0.26 : 0.14)
  );
  if (text?.setColor) {
    text.setColor(selected ? BOTTOM_BAR_THEME.text : Phaser.Display.Color.IntegerToColor(accent).rgba);
  }
  setHoverLiftState(label.scene, label, selected || hovered, {
    baseY: label.baseY ?? label.y ?? 0,
    hoverLift: 0,
    hoverScale: selected ? 1.04 : 1.02,
    moveY: false,
  });
}

function updateTabButtonStyles(tabs, activeKey) {
  (tabs?.buttons || []).forEach((button) => {
    applyTabLabelVisual(button, button?.name === activeKey);
  });
}

function syncTabButtonAnchors(tabs, toggleBtn) {
  (tabs?.buttons || []).forEach((button) => {
    button.baseY = button.y;
  });
  if (toggleBtn) toggleBtn.baseY = toggleBtn.y;
}

var CreatePage = function (scene, title, color) {
    return scene.rexUI.add.textArea({
        text: scene.rexUI.add.BBCodeText(0, 0, `[color=${Phaser.Display.Color.IntegerToColor(color).rgba}]${title}[/color]`, { fontSize: 22 }),
        slider: {
            track: scene.rexUI.add.roundRectangle(0, 0, 20, 0, 10, color),
            thumb: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 13, 0xffffff)
        },
        content: `${title} content goes here...`
    })
}
