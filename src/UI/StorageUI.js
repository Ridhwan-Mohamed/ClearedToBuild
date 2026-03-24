// === StorageUI.js ===

import { UIDEPTH } from '../constants';
import { UI_ITEM_TYPES } from './UIConstants';

export class StorageUI {
    static scene = null;
    static openUIs = new Map(); // Map of Storage -> Container

    static init(scene) {
        this.scene = scene;
    }

    // === Minor UI: show stored / capacity ===
    static showMinor(storage) {
        if (storage.minorUI) return;

        const bg = this.scene.add.rectangle(0, 0, 60, 14, 0x000000, 0.75)
            .setOrigin(0.5).setScrollFactor(0).setDepth(UIDEPTH);

        const text = this.scene.add.text(0, 0, `${storage.totalStored}/16`, {
            fontSize: '12px',
            fill: '#ffffff',
            fontFamily: 'Bungee',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(UIDEPTH);

        const updatePosition = () => {
            const { x, y } = storage.sprite;
            bg.setPosition(x - this.scene.cameras.main.scrollX, y - 40 - this.scene.cameras.main.scrollY);
            text.setPosition(bg.x, bg.y);
        };

        updatePosition();
        this.scene.events.on('update', updatePosition);
        bg._uiUpdate = updatePosition;
        text._uiUpdate = updatePosition;

        storage.minorUI = [bg, text];
    }

    static refreshMinor(storage) {
        if (!storage.minorUI || !Array.isArray(storage.minorUI)) return;

        const total = storage.getTotalCount?.() ?? 0;
        const [bg, text] = storage.minorUI;
        if (text?.setText) {
            text.setText(`${total}/16`);
        }
    }

    static hideMinor(storage) {
        if (storage.minorUI) {
            storage.minorUI.forEach(el => {
                if (el._uiUpdate) this.scene.events.off('update', el._uiUpdate);
                el.destroy();
            });
            storage.minorUI = null;
        }
    }

    // === Major UI: 4x4 grid showing icons ===
    static toggleMajor(storage) {
        if (this.openUIs.has(storage)) {
            this.closeMajor(storage);
            return;
        }

        const cam = StorageUI.scene.cameras.main;
        const camX = cam.width / 2;
        const camY = cam.height / 2;

        const container = StorageUI.scene.add.container(0, 0).setDepth(UIDEPTH);
        container.setScrollFactor(0); // Lock to screen

        // === Background ===
        const bg = this.scene.add.rectangle(camX, camY, 180, 220, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff);
        container.add(bg)
        // === Title ===
        const title = this.scene.add.text(camX, camY - 90, 'Storage', {
            fontSize: '16px',
            fontFamily: 'Bungee',
            fill: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        // === Close Button ===
        const closeBtn = StorageUI.scene.add.text(camX + 70, camY - 90, 'X', {
            fontSize: '12px',
            fill: '#ff4444'
        }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.closeMajor(storage));
        // === 4x4 Grid of Items ===
        const gridStartX = camX - 60;
        const gridStartY = camY - 40;
        const cellSize = 42;
        const items = storage.storageItems;
        storage.uiElements = [];
        // === Top-Right Label for Hovered Item ===
        const itemLabel = this.scene.add.text(camX, camY - 70, '', {
            fontSize: '12px',
            fill: '#ffffcc',
            fontFamily: 'Bungee',
            align: 'right'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(UIDEPTH + 2);
        container.add(itemLabel);

        for (let i = 0; i < 16; i++) {
            const item = items[i] || null;
            const iconKey = UI_ITEM_TYPES[item?.item.name || 'empty']?.icon || 'blank';
            const col = i % 4;
            const row = Math.floor(i / 4);

            const x = gridStartX + col * cellSize;
            const y = gridStartY + row * cellSize;

            const icon = this.scene.add.image(x, y, iconKey)
                .setDisplaySize(24, 24)
                .setScrollFactor(0)
                .setDepth(UIDEPTH + 1);

            icon.setInteractive({ useHandCursor: true });
            icon.on('pointerover', () => {
                const label = item?.item?.label || '';
                itemLabel.setText(label);
            });
            icon.on('pointerout', () => {
                itemLabel.setText('');
            });


            const counter = this.scene.add.text(x + 10, y + 10, 
                item?.amount > 1 ? `x${item.amount}` : '', {
                fontSize: '10px',
                fill: '#ffffff',
                fontFamily: 'Bungee',
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(1).setScrollFactor(0).setDepth(UIDEPTH + 2);

            container.add([icon, counter]);
            storage.uiElements[i] = { icon, counter };
        }
        
        container.add([closeBtn, title, itemLabel])
        this.openUIs.set(storage, container);
    }

    static refreshMajor(storage) {
        if (!this.openUIs.has(storage) || !storage.uiElements) return;

        for (let i = 0; i < 16; i++) {
            const slot = storage.storageItems[i];
            const { icon, counter } = storage.uiElements[i] || {};

            const itemName = slot?.item?.name || 'empty';
            const itemIcon = UI_ITEM_TYPES[itemName]?.icon || 'blank';
            const amountText = slot?.amount > 1 ? `x${slot.amount}` : '';

            if (icon?.texture.key !== itemIcon) icon.setTexture(itemIcon);
            if (counter) counter.setText(amountText);
        }
    }

    static closeMajor(storage) {
        const container = this.openUIs.get(storage);
        if (container) {
            // destroy individual UI elements (icons + counters)
            storage.uiElements?.forEach(({ icon, counter }) => {
                icon.destroy();
                counter.destroy();
            });
            storage.uiElements = null;

            container.destroy();
            this.openUIs.delete(storage);
        }
    }

}


