export default class FunctionTab {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    this.width = width;
    this.height = height;

    this.modes = ['Farm', 'Seed', 'Attack'];
    this.colors = { Farm: 0x8B4513, Seed: 0x008000, Attack: 0xFF0000 }; // ⬅ colors
    this.activeMode = null;

    this.container = scene.rexUI.add.sizer({ orientation: 'x', space:{left: 0, right:0,} });
    
    this.buttons = [];
    this.createButtons();
    this.registerHotkeys();

    // When the scene tells us a mode is completed, clear the highlight
    this.scene.events.on('mode:completed', (mode) => {
        if (!mode || mode === this.activeMode) {
            this.activeMode = null;
            this.updateVisuals();
        }
    });

    // keep container out of main camera
    scene.cameras.main.ignore(this.container);
    scene.functionTab = this;
  }

  createButtons() {
    const buttonWidth = this.width / this.modes.length;
    const buttonHeight = this.height;

    this.modes.forEach((mode) => {
      const color = this.colors[mode];

      const btn = this.scene.rexUI.add.label({
        width: buttonWidth,
        height: buttonHeight,
        background: this.scene.add.rectangle(0, 0, 0, 0, 0x222222),
        text: this.scene.add.text(0, 0, mode, {
          fontSize: 16,
          color: Phaser.Display.Color.IntegerToColor(color).rgba, // colored text
          fontStyle: 'bold'
        }),
        align: 'center',
      })
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => this.toggleMode(mode)); // ⬅ click toggles

      this.container.add(btn, { proportion: 1, expand: true });
      this.buttons.push({ btn, mode, color });
    });

    // start with nothing selected visually
    this.updateVisuals();
  }

  // toggle: clicking or pressing same key again turns it off
  toggleMode(mode) {
    this.activeMode = (this.activeMode === mode) ? null : mode;
    this.updateVisuals();
    switch (mode) {
        case "Farm":
            this.scene.farmMode = !this.scene.farmMode
            break;
        case "Seed":
            this.scene.seedGridMode = !this.scene.seedGridMode
            break;
        case "Attack":
            this.scene.attackMode = !this.scene.attackMode
            break;
        default:
            break;
    }
    // TODO: hook into your actual game mode switch here
  }

  updateVisuals() {
    this.buttons.forEach(({ btn, mode, color }) => {
      const bg = btn.getElement('background');
      const tx = btn.getElement('text');
      const isActive = (mode === this.activeMode);

      if (isActive) {
        bg.setFillStyle(color);             // filled with its color
        tx.setStyle({ color: '#000000' });  // black text on color
      } else {
        bg.setFillStyle(0x222222, 1);       // dark background
        tx.setStyle({ color: Phaser.Display.Color.IntegerToColor(color).rgba });
      }
    });
  }

  registerHotkeys() {
    this.scene.input.keyboard.on('keydown-F', () => this.toggleMode('Farm'));
    this.scene.input.keyboard.on('keydown-V', () => this.toggleMode('Seed'));
    this.scene.input.keyboard.on('keydown-K', () => this.toggleMode('Attack'));
  }

  getContainer() { return this.container; }
}
