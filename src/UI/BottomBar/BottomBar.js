import ClayOvenTab from "./clayOvenTab";
import FunctionTab from "./FunctionTab";
import PlayerTab from "./PlayerTab";
import StorageTab from "./storageTab";

const COLOR_DARK = 0x260e04;
const COLOR_FUNCTIONS = 0x800080;  // Purple
const COLOR_PLAYERS  = 0x008000;  // Green
const COLOR_OVENS    = 0xff0000;  // Red
const COLOR_STORAGE  = 0x8B4513;  // Brown
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
    scene.uiBottomBar = { ui, pages: ui.getElement('pages') };~

    // click a tab -> swap page
    tabs.on('button.click', (btn) => {
        const key = btn?.name;
        if (key) {
            pages.swapPage(key);

            if (key !== 'players' && scene.playerTab?.detailCard?.portrait) {
                scene.playerTab.detailCard.portrait.setVisible(false);
            }
            if (key !== 'ovens' && scene.clayTab) scene.clayTab.hide();
            if (key !== 'storage' && scene.storageTab) scene.storageTab.hide();
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
        // Always swap to the requested page
        bar.pages.swapPage(pageKey);
        if (!bar.expanded) scene.setBottomBar(true);
        // Handle mismatched tab names
        let tab = bar.pages[pageKey + 'Tab'] 
            || bar.pages.tabs?.[pageKey]
            || (pageKey === 'ovens' ? bar.pages.clayTab : null)
            || (pageKey === 'storage' ? bar.pages.storageTab : null)
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
            if (!expanded) setBottomBar(true);

            if (key !== 'players') PlayerTab.hidePortrait();
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
      stroke: '#ffffff',         // white outline for contrast
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

    // 🔥 New Clay Ovens tab
    const clayTab = new ClayOvenTab(scene);
    pages.add(clayTab.view, { key: 'ovens', expand: true });

    // keep your other pages (e.g., storage)
    const storageTab = new StorageTab(scene);
    pages.add(storageTab.view, { key: 'storage', expand: true });
    pages.storageTab = storageTab;
    // 🔥 call refresh once (for your current team 0)
    storageTab.refresh(1);

    // optional: expose for debugging
    pages.clayTab = clayTab;
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