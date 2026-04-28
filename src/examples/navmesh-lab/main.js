import Phaser from "phaser";
import { NavmeshLabScene } from "./NavmeshLabScene.js";

const ui = {
    toolButtons: [...document.querySelectorAll("[data-tool]")],
    navModeButtons: [...document.querySelectorAll("[data-nav-mode]")],
    updateModeButtons: [...document.querySelectorAll("[data-update-mode]")],
    chipToolText: document.getElementById("chip-tool-text"),
    chipToolDot: document.getElementById("chip-tool-dot"),
    chipNavText: document.getElementById("chip-nav-text"),
    chipNavDot: document.getElementById("chip-nav-dot"),
    chipUpdateText: document.getElementById("chip-update-text"),
    chipUpdateDot: document.getElementById("chip-update-dot"),
    statusSummary: document.getElementById("status-summary"),
    statFastLast: document.getElementById("stat-fast-last"),
    statFastAvg: document.getElementById("stat-fast-avg"),
    statFastCount: document.getElementById("stat-fast-count"),
    statLegacyLast: document.getElementById("stat-legacy-last"),
    statLegacyAvg: document.getElementById("stat-legacy-avg"),
    statLegacyCount: document.getElementById("stat-legacy-count"),
    statPolys: document.getElementById("stat-polys"),
    statWalkable: document.getElementById("stat-walkable"),
    statLandCount: document.getElementById("stat-land-count"),
    statWaterCount: document.getElementById("stat-water-count"),
    statWallCount: document.getElementById("stat-wall-count"),
    statsNote: document.getElementById("stats-note"),
    lastPatchLabel: document.getElementById("last-patch-label"),
};

function setActiveButton(buttons, activeValue, attrName) {
    for (const button of buttons) {
        button.classList.toggle("active", button.dataset[attrName] === activeValue);
    }
}

function renderSnapshot(snapshot) {
    if (!snapshot) return;

    setActiveButton(ui.toolButtons, snapshot.tool, "tool");
    setActiveButton(ui.navModeButtons, snapshot.navMode, "navMode");
    setActiveButton(ui.updateModeButtons, snapshot.updateMode, "updateMode");

    ui.chipToolText.textContent = snapshot.toolLabel;
    ui.chipToolDot.style.color = snapshot.toolColor;

    ui.chipNavText.textContent = snapshot.navModeLabel;
    ui.chipNavDot.style.color = snapshot.navModeColor;

    ui.chipUpdateText.textContent = snapshot.updateModeLabel;
    ui.chipUpdateDot.style.color = snapshot.updateModeColor;

    ui.statusSummary.textContent = snapshot.summary;
    ui.lastPatchLabel.textContent = snapshot.lastPatchLabel;

    ui.statFastLast.textContent = snapshot.stats.accelerated.last;
    ui.statFastAvg.textContent = snapshot.stats.accelerated.avg;
    ui.statFastCount.textContent = snapshot.stats.accelerated.count;

    ui.statLegacyLast.textContent = snapshot.stats.legacy.last;
    ui.statLegacyAvg.textContent = snapshot.stats.legacy.avg;
    ui.statLegacyCount.textContent = snapshot.stats.legacy.count;

    ui.statPolys.textContent = String(snapshot.activePolygons);
    ui.statWalkable.textContent = String(snapshot.activeWalkableTiles);
    ui.statLandCount.textContent = String(snapshot.landTiles);
    ui.statWaterCount.textContent = String(snapshot.waterTiles);
    ui.statWallCount.textContent = String(snapshot.wallTiles);
    ui.statsNote.textContent = snapshot.note;
}

const scene = new NavmeshLabScene({ renderSnapshot });

for (const button of ui.toolButtons) {
    button.addEventListener("click", () => scene.setTool(button.dataset.tool));
}

for (const button of ui.navModeButtons) {
    button.addEventListener("click", () => scene.setNavMode(button.dataset.navMode));
}

for (const button of ui.updateModeButtons) {
    button.addEventListener("click", () => scene.setUpdateMode(button.dataset.updateMode));
}

const shell = document.getElementById("game-shell");

const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-shell",
    backgroundColor: "#0b3340",
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: Math.max(1, shell.clientWidth),
        height: Math.max(1, shell.clientHeight),
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: false,
        }
    },
    render: {
        pixelArt: true,
        antialias: false,
    },
    scene: [scene],
});

const resizeObserver = new ResizeObserver(() => {
    const rect = shell.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        game.scale.resize(rect.width, rect.height);
        scene.handleExternalResize?.(rect.width, rect.height);
    }
});

resizeObserver.observe(shell);

window.addEventListener("beforeunload", () => {
    resizeObserver.disconnect();
    game.destroy(true);
});
