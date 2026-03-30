import ClayOvenTab from "./clayOvenTab";
import FunctionTab from "./FunctionTab";
import PlayerTab from "./PlayerTab";
import StorageTab from "./storageTab";
import CardsTab from "./CardsTab";   
import HousesTab from "./HousesTab"
import BuildTab from "./BuildTab";

const COLOR_DARK = 0x260e04;
const COLOR_FUNCTIONS = 0x800080;  // Purple
const COLOR_PLAYERS   = 0x008000;  // Green
const COLOR_OVENS     = 0xff0000;  // Red
const COLOR_STORAGE   = 0x8B4513;  // Brown
const COLOR_CARDS     = 0xFFD700;  // gold for cards
const COLOR_BROWNISH  = 0x2d251e;  // brown for house
const COLOR_BUILD     = 0xc84c8f;  // pink for store/build tab

// after EXPANDED/COLLAPSED:
const COLLAPSED = 32;     // how much of the bar stays visible when hidden
const EXPANDED  = 160;    // full bar height (tall enough for your tabs/pages)
const START_OPEN  = false; // start expanded?

export function CreateBottomBar(scene) {
  const tabPage = CreateTabPage(scene);

  const ui = tabPage.sizer
    .setOrigin(0.5, 1)
    // ✅ start in collapsed position (no mystery +95/+155)
    .setPosition(scene.scale.width / 2, scene.scale.height + (EXPANDED - COLLAPSED + 155))
    .setMinSize(scene.scale.width, EXPANDED)
    .layout();

  const tabs = tabPage.tabs;
  const pages = tabPage.pages;
  const toggleBtn = tabPage.toggleBtn;

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

  // ensure setBottomBar updates scene.uiBottomBar.expanded too
  function setBottomBar(open) {
    if (tween) tween.stop();
    tween = scene.tweens.add({
      targets: ui,
      y: open ? EXPANDED_Y : COLLAPSED_Y,
      duration: 200,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const travel = COLLAPSED_Y - EXPANDED_Y;
        const progress = travel <= 0 ? (open ? 1 : 0) : Phaser.Math.Clamp((COLLAPSED_Y - ui.y) / travel, 0, 1);
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
    .on('pointerup', () => toggleBottomBar());

  // ✅ click tabs
  tabs.on('button.click', (btn) => {
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
  });

  // default page
  pages.swapPage('functions');
  tabs.setValue?.('functions');

  // (optional) spacebar toggle
  scene.input.keyboard.on('keydown-SPACE', () => toggleBottomBar());

  scene.housesTab?.hide?.();
}


var CreateTabPage = function (scene) {
  const sizer = scene.rexUI.add.sizer({
    width: scene.scale.width,
    orientation: 'y',
    space: { left: 0, right: 0, top: 0, bottom: 0, item: 0 }
  });

  const topRow = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 6 } });

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

  return scene.rexUI.add.buttons({
    orientation: 'x',
    space: { left : 0 },
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
};

var CreateLabel = function (scene, text, color, width) {
  return scene.rexUI.add.label({
    width,
    height: 32,
    background: scene.rexUI.add.roundRectangle(
      0, 0, 0, 0,               // auto size
      { tl: 6, tr: 6, bl: 0, br: 0 },  // radius only top-left & top-right
      0x222222                  // dark gray background fill
    )
    .setStrokeStyle(1, 0x000000), // subtle outline if you want

    text: scene.add.text(0, 0, text, {
      fontSize: 16,
      color: Phaser.Display.Color.IntegerToColor(color).rgba, // colored text
      fontStyle: 'bold',
      stroke: '#000000',         // white outline for contrast
      strokeThickness: 3,
    }),

    space: { left: 12, right: 8, top: 4, bottom: 4 }
  });
};

var CreateToggleLabel = function (scene, text, width = 44) {
  return scene.rexUI.add.label({
    width,
    height: 32,
    background: scene.rexUI.add.roundRectangle(
      0, 0, 0, 0,
      { tl: 6, tr: 6, bl: 0, br: 0 },
      0x222222
    ).setStrokeStyle(1, 0x000000),

    text: scene.add.text(0, 0, text, {
      fontSize: 16,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }),

    space: { left: 16, right: 8, top: 4, bottom: 4 }
  });
};

var CreatePages = function (scene) {
    const pages = scene.rexUI.add.pages({ fadeDuration: 500 })
        .addBackground(scene.rexUI.add.roundRectangle(0,0,0,0,0, COLOR_DARK, 0.85))
        .add(new FunctionTab(scene, 0, 0, scene.scale.width, 100).getContainer(), { key: 'functions', expand: true });

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
