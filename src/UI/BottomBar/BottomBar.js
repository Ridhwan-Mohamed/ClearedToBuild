import ClayOvenTab from "./clayOvenTab";
import FunctionTab from "./FunctionTab";
import PlayerTab from "./PlayerTab";
import StorageTab from "./storageTab";
import CardsTab from "./CardsTab";   
import HousesTab from "./HousesTab"

const COLOR_DARK = 0x260e04;
const COLOR_FUNCTIONS = 0x800080;  // Purple
const COLOR_PLAYERS   = 0x008000;  // Green
const COLOR_OVENS     = 0xff0000;  // Red
const COLOR_STORAGE   = 0x8B4513;  // Brown
const COLOR_CARDS     = 0xFFD700;  // gold for cards
const COLOR_BROWNISH  = 0x2d251e;  // brown for house

// after EXPANDED/COLLAPSED:
const COLLAPSED = 32;     // how much of the bar stays visible when hidden
const EXPANDED  = 160;    // full bar height (tall enough for your tabs/pages)
const START_OPEN  = false; // start expanded?

export function CreateBottomBar(scene) {
    const ui = CreateTabPage(scene)
        .setOrigin(0.5, 1)
        .setPosition(scene.scale.width / 2, scene.scale.height + EXPANDED - COLLAPSED + 95)
        .setMinSize(scene.scale.width, EXPANDED)   // <-- force width
        .layout();

    const tabs  = ui.getElement('tabs');
    const pages = ui.getElement('pages');
    scene.uiBottomBar = { ui, pages: ui.getElement('pages') };
    scene.uiBottomBar.currentPage = 'functions';    // 🔹 track current page key

    // click a tab -> swap page
    tabs.on('button.click', (btn) => {
        const key = btn?.name;
        if (key) {
            pages.swapPage(key);
            scene.uiBottomBar.currentPage = key;

            if (key !== 'players' && scene.playerTab?.detailCard?.portrait) {
                scene.playerTab.detailCard.portrait.setVisible(false);
            }
            if (key !== 'ovens' && scene.clayTab) scene.clayTab.hide();
            if (key !== 'storage' && scene.storageTab) scene.storageTab.hide();
            if (key !== 'houses' && scene.housesTab) scene.housesTab.hide();

            // ⭐ when specific tabs are opened, force a refresh + auto-select
            if (key === 'ovens'   && scene.clayTab?.onShow)    scene.clayTab.onShow();
            if (key === 'storage' && scene.storageTab?.onShow) scene.storageTab.onShow();
            if (key === 'players' && scene.playerTab?.onShow)  scene.playerTab.onShow();
            if (key === 'houses' && scene.housesTab?.onShow) scene.housesTab.onShow();
        }
    });

    // default: show Functions on boot
    pages.swapPage('functions');
    if (typeof tabs.setValue === 'function') {
        tabs.setValue('functions');
    } else {
        const fnBtn = tabs.buttons?.find(b => b.name === 'functions');
        if (fnBtn) tabs.emit('button.click', fnBtn);
    }

    // --- COLLAPSE/EXPAND CONTROL ---
    let expanded = START_OPEN;
    let tween = null;
    const EXPANDED_Y = scene.scale.height;
    const COLLAPSED_Y = scene.scale.height + (EXPANDED - COLLAPSED + 95);

    function setBottomBar(open) {
        if (tween) tween.stop();
        tween = scene.tweens.add({
            targets: ui,
            y: open ? EXPANDED_Y : COLLAPSED_Y,
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                expanded = open;
                tween = null;
            }
        });
    }

    function toggleBottomBar() {
        setBottomBar(!expanded);
    }

    // expose to scene
    scene.setBottomBar = setBottomBar;
    scene.openDetailPage = function(pageKey, callback) {
        const bar = scene.uiBottomBar;
        if (!bar) return;

        bar.pages.swapPage(pageKey);
        bar.currentPage = pageKey;

        if (!bar.expanded) scene.setBottomBar(true);

        // 🔹 Ensure relevant tab gets its onShow() hook
        if (pageKey === 'ovens'   && scene.clayTab?.onShow)    scene.clayTab.onShow();
        if (pageKey === 'storage' && scene.storageTab?.onShow) scene.storageTab.onShow();
        if (pageKey === 'players' && scene.playerTab?.onShow)  scene.playerTab.onShow();

        let tab = bar.pages[pageKey + 'Tab'] 
            || bar.pages.tabs?.[pageKey]
            || (pageKey === 'ovens'   ? bar.pages.clayTab    : null)
            || (pageKey === 'storage' ? bar.pages.storageTab: null)
            || (pageKey === 'players' ? bar.pages.playerTab : null)
            || null;

        if (callback && tab) callback(tab);
    };

    // 🔹 space bar toggle
    scene.input.keyboard.on('keydown-SPACE', () => {
        toggleBottomBar();
    });

    // 🔹 clicking a tab opens bar if collapsed
    const tabBtns = ui.getElement('tabs');
        tabBtns.on('button.click', (btn) => {
        const key = btn?.name;
        if (key) {
            pages.swapPage(key);
            scene.uiBottomBar.currentPage = key;   // 🔹 keep it in sync
            if (!expanded) setBottomBar(true);

            if (key !== 'players') {
                scene.playerTab?.hidePortrait();
            }
        }
    });

    scene.scale.on('resize', (sz) => {
        ui.setMinSize(sz.width, EXPANDED);
        ui.setPosition(sz.width / 2, sz.height);

        // rebuild the tabs so TAB_W recalculates for the new width
        const tabs = ui.getElement('tabs');
        const pages = ui.getElement('pages');
        const value = tabs?.value ?? 'functions';

        // re-create the whole tab strip quickly:
        const newTabs = CreateButtons(scene);
        ui
            .remove(tabs, true)                          // destroy old
            .insertAt(0, newTabs, { key: 'tabs', align: 'left', expand: false })
            .layout();

        // restore selected tab
        newTabs.setValue?.(value);
    });

    // hide from main camera
    scene.cameras.main.ignore(ui);
}

var CreateTabPage = function (scene) {
    const sizer = scene.rexUI.add.sizer({
        width: scene.scale.width,
        orientation: 'y',
        space: { left: 0, right: 0, top: 0, bottom: 0, item: 0 }
    })

    // tabs on top
    .add(
      CreateButtons(scene),
      { key: 'tabs', align: 'left', expand: false, padding: { left: 0 } }
    )

    // pages below
    .add(
      CreatePages(scene),
      { key: 'pages', proportion: 1, expand: true }
    );

  return sizer;
};

var CreateButtons = function (scene) {
  const TAB_W = 50;

  return scene.rexUI.add.buttons({
    orientation: 'x',
    space: { left : 0 },
    buttons: [
      CreateLabel(scene, 'Functions', COLOR_FUNCTIONS, TAB_W).setName('functions'),
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