import { UIDEPTH } from '../constants';
import { StaminaManager } from '../Manager/staminaManager';
import { CONTROL_STATES } from '../constants';

export class HouseUI {
  static scene = null;
  static openUIs = new Map(); // House -> container

  static init(scene) {
    this.scene = scene;
  }

  static toggleMajor(house) {
    if (this.openUIs.has(house)) {
      this.closeMajor(house);
      return;
    }

    const cam = this.scene.cameras.main;
    const camX = cam.width / 2;
    const camY = cam.height / 2;

    const container = this.scene.add.container(0, 0).setDepth(UIDEPTH);
    container.setScrollFactor(0);

    // === Background ===
    const bg = this.scene.add.rectangle(camX, camY, 400, 180, 0x222222, 0.95)
      .setStrokeStyle(2, 0xffffff);
    container.add(bg);

    // === Title ===
    const title = this.scene.add.text(camX, camY - 70, 'House', {
      fontSize: '18px',
      fontFamily: 'Bungee',
      fill: '#ffffff'
    }).setOrigin(0.5);
    container.add(title);

    // === Close Button ===
    const closeBtn = this.scene.add.text(camX + 110, camY - 70, 'X', {
      fontSize: '14px',
      fill: '#ff4444'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeMajor(house));
    container.add(closeBtn);

    // === Rows for occupants ===
    house.uiElements = [];
    const startY = camY - 30;
    house.occupants.forEach((troop, i) => {
      const rowY = startY + i * 40;

      const name = this.scene.add.text(camX - 185, rowY, troop.name || `Troop${troop.id}`, {
        fontSize: '14px', fill: '#ffffff'
      }).setOrigin(0, 0.5);

      const health = this.scene.add.text(camX - 40, rowY, `HP: ${troop.health}`, {
        fontSize: '14px', fill: '#ff5555'
      }).setOrigin(0, 0.5);

      const stamina = this.scene.add.text(camX + 30, rowY, `STA: ${Math.floor(troop.stamina)}`, {
        fontSize: '14px', fill: '#00aaff'
      }).setOrigin(0, 0.5);

      const btn = this.scene.add.text(camX + 130, rowY, '', {
        fontSize: '12px',
        backgroundColor: '#0066ff',
        padding: { x: 6, y: 2 },
        fill: '#ffffff'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const updateBtn = () => {
        if (troop.state === CONTROL_STATES.SLEEP_MODE || troop.state == CONTROL_STATES.GO_HOME_MODE) {
          btn.setText('Awaken');
          btn.setStyle({ backgroundColor: '#ffcc00', fill: '#000' });
        } else {
          btn.setText('Sleep');
          btn.setStyle({ backgroundColor: '#0066ff', fill: '#fff' });
        }
      };
      updateBtn();

      btn.on('pointerdown', () => {
        if (troop.state === CONTROL_STATES.SLEEP_MODE) {
          StaminaManager.wakeUp(troop);
        } else {
          StaminaManager.sendTroopHome(troop);
        }
        updateBtn();
      });

      container.add([name, health, stamina, btn]);
      house.uiElements.push({ health, stamina, btn, updateBtn, troop });
    });

    this.openUIs.set(house, container);
    this.scene.cameras.main.ignore(container);

    // === Hook update for refreshing stats ===
    const refresh = () => {
      if (!this.openUIs.has(house)) {
        this.scene.events.off('update', refresh);
        return;
      }
      house.uiElements.forEach(el => {
        el.health.setText(`HP: ${el.troop.health}`);
        el.stamina.setText(`STA: ${Math.floor(el.troop.stamina)}`);
        el.updateBtn();
      });
    };
    this.scene.events.on('update', refresh);
  }

  static closeMajor(house) {
    const container = this.openUIs.get(house);
    if (container) {
      container.destroy();
      this.openUIs.delete(house);
      house.uiElements = null;
    }
  }
}
