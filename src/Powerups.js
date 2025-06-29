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
        const group = scene.add.container(groupX, storeYOffset).setDepth(1);

        const cardWidth = 100;
        const cardHeight = 120;

        const bg = scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0.2)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true });

        const icon = scene.add.image(0, -20, item.image).setScale(1.2);
        const name = scene.add.text(0, 30, item.name, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5);
        const cost = scene.add.text(0, 50, `$${item.cost}`, {
            fontSize: '12px',
            fill: '#ffff00'
        }).setOrigin(0.5);

        [bg, icon, name, cost].forEach(el => el.setScrollFactor(0));

        bg.on('pointerdown', () => {
            if (scene.checkSufficientFunds(item.cost)) {
                if (item.apply) {
                    item.apply(scene);  // ✅ Executes the assigned function
                }
                scene.updateMoney(-1 * item.cost);
                // TODO: apply item effect
            }
        });

        group.add([bg, icon, name, cost]);
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
            .setDepth(1)
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

    scene.powerupUI = uiContainer;
}

function closePowerupScreen(scene, container) {
    if (container) container.destroy();
    scene.clock.resume();
    scene.clock.powerupScreenShown = false;
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

export const STORE = [
    {
        image: 'item_healthpack',
        name: 'Health Pack',
        text: 'Restores 50 health.',
        cost: 25,
        apply: (scene) => scene.updateBerry(1)  
    },
    {
        image: 'item_grenade',
        name: 'Grenade',
        text: 'Deals 100 AoE damage.',
        cost: 40
    },
    // configurable set
];
