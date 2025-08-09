import { House } from "../buildings/House";
import { showAlert, UIDEPTH } from "../constants";
import { buildingManager } from "../Manager/buildingManager";
import { Builder } from "../players/Builder";
import { Farmer } from "../players/Farmer";
import { Fireman } from "../players/Fireman";
import { Forager } from "../players/Forager";
import { Gunslinger } from "../players/Gunslinger";
import { Teams } from "../Teams";
import { townRoads } from "../town";
import { UI_ITEM_TYPES } from "./UIConstants";

// === Character Spawns ===
const playerClasses = {
    farmer: Farmer,
    fireman: Fireman,
    forager: Forager,
    builder: Builder,
    gunslinger: Gunslinger
};

var pendingStoreItem = null;

export function openPowerupScreen(scene) {
    const cam = scene.cameras.main;
    const centerX = cam.centerX;
    const yOffset = 100;

    const uiContainer = scene.add.container(0, 0).setDepth(2000);
    uiContainer.setScrollFactor(0); // lock container to camera

    // === Background ===
    const bg = scene.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.6)
        .setOrigin(0)
        .setDepth(0);
    bg.setScrollFactor(0);
    uiContainer.add(bg);

    // === Store Items ===
    const storeYOffset = yOffset + 70;
    const storeSpacing = 120;
    let storeStartX = centerX - (STORE.length - 1) * storeSpacing / 2;

    STORE.forEach((item, i) => {
        const groupX = storeStartX + i * storeSpacing;
        const group = scene.add.container(groupX, storeYOffset).setDepth(UIDEPTH);

        const cardWidth = 100;
        const cardHeight = 120;

        const bg = scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0.2)
        bg
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true });

        bg.on('pointerdown', () => {
            if (!item.money) {
                if(buildingManager.hasRequiredMaterials(item.cost, 1)){
                    item.function(scene);
                }else{
                    showAlert(scene, "Not enough materials", "#ff0000")
                }
            }
            else if (scene.checkSufficientFunds(item.cost)) {
                scene.updateMoney(-item.cost);
                item.function(scene);
            }
        });


        const icon = item.spritesheet
            ? scene.add.sprite(0, -20, item.image, 0).setScale(1.2)  // frame 0 only
            : scene.add.image(0, -20, item.image).setScale(1.2);
        const name = scene.add.text(0, 30, item.name, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        bg.setFillStyle(0x8B4513, 0.4); // Brown tint like character cards (saddle brown)

        group.add([bg, icon, name]);

        // Draw cost icons + values if item.cost is a resource dict
        if (item.cost && typeof item.cost === 'object') {
            let offsetX = -30;
            const iconSpacing = 30;

            Object.entries(item.cost).forEach(([resourceKey, amount]) => {
                const icon = scene.add.image(offsetX, 50, UI_ITEM_TYPES[resourceKey].icon).setScale(0.5);
                const label = scene.add.text(offsetX + 10, 50, `${amount}`, {
                    fontSize: '12px',
                    fill: '#ffffaa',
                    fontFamily: 'monospace'
                }).setOrigin(0, 0.5);

                group.add([icon, label]);
                [icon, label].forEach(el => el.setScrollFactor(0));

                offsetX += iconSpacing;
            });
        } else {
            // fallback: numeric cost
            const costText = scene.add.text(0, 50, `$${item.cost}`, {
                fontSize: '12px',
                fill: '#ffff00'
            }).setOrigin(0.5);
            group.add(costText);
            costText.setScrollFactor(0);
        }

        // 👇 This is key: interactive area in local coordinates
        group.setSize(cardWidth, cardHeight);

        [bg, icon, name, group].forEach(el => el.setScrollFactor(0));

        uiContainer.add(group);
    });

    // === Powerups ===
    const powerups = getRandomPowerups();
    const cardYOffset = yOffset + 250;
    const cardSpacing = 160;
    let cardStartX = centerX - (powerups.length - 1) * cardSpacing / 2;

    powerups.forEach((pu, i) => {
        const cardX = cardStartX + i * cardSpacing;

        const card = scene.add.rectangle(cardX, cardYOffset, 130, 180, 0x222222)
            .setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(pu.OUTLINE).color)
            .setDepth(UIDEPTH)
            .setInteractive({ useHandCursor: true });

        const icon = scene.add.image(cardX, cardYOffset - 40, pu.image).setScale(1.2).setDepth(1);
        const name = scene.add.text(cardX, cardYOffset + 20, pu.name, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(1);
        const desc = scene.add.text(cardX, cardYOffset + 45, pu.text, {
            fontSize: '12px',
            fill: '#cccccc',
            wordWrap: { width: 120 }
        }).setOrigin(0.5).setDepth(1);

        [card, icon, name, desc].forEach(el => el.setScrollFactor(0));

        card.on('pointerdown', () => {
            closePowerupScreen(scene, uiContainer);
        });

        uiContainer.add([card, icon, name, desc]);
    });
    


    const spawnCardYOffset = storeYOffset + 360;
    const playerTypes = Object.keys(playerClasses);
    let spawnStartX = centerX - (playerTypes.length - 1) * storeSpacing / 2;

    playerTypes.forEach((type, i) => {
        const groupX = spawnStartX + i * storeSpacing;
        const group = scene.add.container(groupX, spawnCardYOffset).setDepth(UIDEPTH);

        const cardWidth = 100;
        const cardHeight = 120;

        const bg = scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x6600cc, 0.4)

        bg
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true });

        bg.on('pointerdown', () => {
            const cost = PLAYER_COSTS[type];
            if (scene.checkSufficientFunds(cost)) {
                const team = '1';
                if (!House.availableHouse(team)) {
                    console.log("Not enough housing!");
                    showAlert(scene, "Not enough Housing!", "#ff0000");
                    return;
                }
                scene.updateMoney(-cost);
                const roads = townRoads['1'] || [];
                if (roads.length === 0) return;
                const spawnTile = Phaser.Utils.Array.GetRandom(roads);
                const player = new playerClasses[type](spawnTile[0], spawnTile[1], 1);
                House.assignPlayerToHouse(player, team);
            }
        });


        // Create a temp sprite using the class' default texture
        const preview = scene.add.sprite(0, -20, 'player')
            .setScale(1.2)
            .setOrigin(0.5);

        // Tint by type
        let tint;
        switch (type) {
            case 'farmer':     tint = 0x8B5A2B; break;
            case 'forager':    tint = 0x228B22; break;
            case 'fireman':    tint = 0xff9933; break;
            case 'gunslinger': tint = 0x9999ff; break;
            case 'builder':    tint = 0x4433ff; break;
            default:           tint = 0x64ff32; break; // fallback team color
        }
        preview.setTint(tint);

        const name = scene.add.text(0, 30, type.charAt(0).toUpperCase() + type.slice(1), {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5);
        const cost = scene.add.text(0, 50, `$${PLAYER_COSTS[type]}`, {
            fontSize: '12px',
            fill: '#ffff00'
        }).setOrigin(0.5);

        group.add([bg, preview, name, cost]);

        group.setSize(cardWidth, cardHeight);

        group.on('pointerdown', () => {
            const cost = PLAYER_COSTS[type];
            if (scene.checkSufficientFunds(cost)) {
                const team = Teams.teamLists['1'];
                const availableHouse = team.houseList.find(h => h.canAcceptPlayer());
                if (!availableHouse) {
                    console.log("Not enough housing!");
                    return;
                }
                scene.updateMoney(-cost);
                // Get a random road from team 1
                const roads = townRoads['1'] || [];
                if (roads.length === 0) return;
                const spawnTile = Phaser.Utils.Array.GetRandom(roads);
                const player = new playerClasses[type](spawnTile[0], spawnTile[1], 1);
                availableHouse.assignPlayer(player);
            }
        });
        [bg, preview, name, cost, group].forEach(el => el.setScrollFactor(0));
        uiContainer.add(group);
    });
    scene.powerupUI = uiContainer;
}

function closePowerupScreen(scene, container) {
    if (container) container.destroy();
    scene.clock.resume();
    scene.clock.powerupScreenShown = false;

    if (pendingStoreItem) {
        const item = pendingStoreItem;
        pendingStoreItem = null;

        // Defer the placement to the *next* pointerup
        const handler = () => {
            scene.registry.set('image', item.type); // Trigger placement logic
            scene.input.off('pointerup', handler);
        };
        scene.input.once('pointerup', handler);
    }
    scene.events.emit('powerupScreenClosed');
}

function getRandomPowerups(count = 3) {
    const pool = [];
    for (let p of POWERUPS) {
        for (let i = 0; i < p.probability; i++) {
            pool.push(p);
        }
    }
    Phaser.Utils.Array.Shuffle(pool);
    return pool.slice(0, count);
}

export const TYPES = {
    PLAYERTYPE: 'player',
    WEAPONTYPE: 'weapon',
    BUFF: 'buff'
};

const PLAYER_COSTS = {
    farmer: 100,
    fireman: 100,
    forager: 100,
    builder: 100,
    gunslinger: 500
};

export const POWERUPS = [
    {
        image: 'powerup_attack',
        name: 'Sharpened Senses',
        text: 'Increase crit chance by 10%.',
        type: TYPES.PLAYERTYPE,
        OUTLINE: '#ff4444',
        probability: 20
    },
    {
        image: 'powerup_speed',
        name: 'Quick Feet',
        text: 'Increase movement speed by 15%.',
        type: TYPES.BUFF,
        OUTLINE: '#44ff44',
        probability: 25
    },
    // add more with varying probabilities
];

const STORE = [
    {
        image: 'berry',
        name: 'Berry',
        text: 'Restores 1 berry to your stockpile.',
        cost: 25,
        money: true,
        function: (scene) => {
            scene.updateBerry(1);
        }
    },
    {
        image: 'house2',
        name: 'House',
        text: 'Spawns 2 players and a house with connected roads.',
        cost : { wood: 4, stone: 4 },
        money: false,
        function: () => {
            pendingStoreItem = {
                type: 'house2',
                cost : { wood: 4, stone: 4 },
            };
        }
    },
    {
        image: 'clayOven',
        spritesheet: true,
        name: 'Clay Oven',
        text: 'For cooking and purifying',
        cost: { stone: 4 },
        money: false,
        function: () => {
            pendingStoreItem = {
                type: 'clayOven',
                cost: { stone: 4 }
            };
        }
    },
    {
        image: 'storage',
        name: 'Storage',
        text: 'For storing goods',
        cost : { wood: 4 },
        money: false,
        function: () => {
            pendingStoreItem = {
                type: 'storage',
                cost: { wood: 4 },
            };
        }
    }
];
