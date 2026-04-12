// === StorageUI.js ===

import { UIDEPTH } from '../constants';
import { UI_ITEM_TYPES } from './UIConstants';

export class StorageUI {
    static scene = null;
    static openUIs = new Map(); // Map of Storage -> Container

    static init(scene) {
        this.scene = scene;
    }

    static refreshStatus(storage) {
        if (!this.scene || !storage?.sprite) return;

        const state = storage.getStorageWarningState?.();
        if (!state) {
            this.hideStatus(storage);
            return;
        }

        const style = state === 'full'
            ? { label: 'FULL\nCAPACITY', bg: 0xb42318, text: '#fff4f2', low: 0.38, high: 1, width: 60, height: 24 }
            : { label: 'SLOTS\nFULL', bg: 0xd97706, text: '#fff7d6', low: 0.5, high: 0.95, width: 60, height: 24 };

        let ui = storage.statusUI;
        if (!ui) {
            const container = this.scene.add.container(0, 0).setDepth(UIDEPTH + 1).setScrollFactor(0);
            const bg = this.scene.add.rectangle(0, 0, style.width, style.height, style.bg, 0.95)
                .setStrokeStyle(1, 0xffffff, 0.18);
            const text = this.scene.add.text(0, 0, style.label, {
                fontSize: '8px',
                fill: style.text,
                fontFamily: 'Bungee',
                align: 'center'
            }).setOrigin(0.5).setLineSpacing(-2);

            container.add([bg, text]);

            const updatePosition = () => {
                if (!storage?.sprite?.active) return;
                const { x, y } = storage.sprite;
                const spriteTop = y - ((storage.sprite.displayHeight || 0) * 0.5);
                container.setPosition(
                    x - this.scene.cameras.main.scrollX,
                    spriteTop + 6 - this.scene.cameras.main.scrollY
                );
            };

            updatePosition();
            this.scene.events.on('update', updatePosition);

            ui = { container, bg, text, updatePosition, tween: null, state: null };
            storage.statusUI = ui;
        }

        ui.bg.setSize?.(style.width, style.height);
        ui.bg.setFillStyle(style.bg, 0.95);
        ui.text.setText(style.label).setColor(style.text);
        ui.state = state;
        ui.updatePosition?.();

        ui.tween?.remove();
        ui.container.setAlpha(style.high);
        ui.tween = this.scene.tweens.add({
            targets: ui.container,
            alpha: { from: style.high, to: style.low },
            duration: state === 'full' ? 420 : 700,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    }

    static hideStatus(storage) {
        if (!storage?.statusUI) return;
        const { container, updatePosition, tween } = storage.statusUI;
        tween?.remove();
        if (updatePosition) this.scene?.events?.off('update', updatePosition);
        container?.destroy();
        storage.statusUI = null;
    }

    // === Minor UI: show stored / capacity ===
    static showMinor(storage) {
        if (storage.minorUI) return;
        const capacity = Number(storage?.capacity ?? 0) || 8;

        const bg = this.scene.add.rectangle(0, 0, 60, 14, 0x000000, 0.75)
            .setOrigin(0.5).setScrollFactor(0).setDepth(UIDEPTH);

        const text = this.scene.add.text(0, 0, `${storage.totalStored}/${capacity}`, {
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

        const total = storage.getTotalCount?.() ?? storage.totalStored ?? 0;
        const capacity = Number(storage?.capacity ?? 0) || 8;
        const [bg, text] = storage.minorUI;
        if (text?.setText) {
            text.setText(`${total}/${capacity}`);
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

    // === Major UI: 4xN grid showing icons ===
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
        const capacity = Number(storage?.capacity ?? 0) || 8;
        const cols = 4;
        const rows = Math.max(1, Math.ceil(capacity / cols));
        const cellSize = 42;
        const panelHeight = 132 + rows * cellSize;
        const panelTop = camY - (panelHeight * 0.5);

        const bg = this.scene.add.rectangle(camX, camY, 188, panelHeight, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff);
        container.add(bg)
        // === Title ===
        const title = this.scene.add.text(camX, panelTop + 18, 'Storage', {
            fontSize: '16px',
            fontFamily: 'Bungee',
            fill: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        // === Close Button ===
        const closeBtn = StorageUI.scene.add.text(camX + 70, panelTop + 18, 'X', {
            fontSize: '12px',
            fill: '#ff4444'
        }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.closeMajor(storage));
        // === 4xN Grid of Items ===
        const gridStartX = camX - 60;
        const gridStartY = camY - (panelHeight * 0.5) + 70;
        const items = storage.storageItems;
        storage.uiElements = [];
        // === Top-Right Label for Hovered Item ===
        const itemLabel = this.scene.add.text(camX, panelTop + 34, '', {
            fontSize: '12px',
            fill: '#ffffcc',
            fontFamily: 'Bungee',
            align: 'right'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(UIDEPTH + 2);
        container.add(itemLabel);

        for (let i = 0; i < capacity; i++) {
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

        const capacity = Number(storage?.capacity ?? 0) || 8;
        for (let i = 0; i < capacity; i++) {
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


