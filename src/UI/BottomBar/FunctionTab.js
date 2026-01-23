export default class FunctionTab {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    this.width = width;
    this.height = height;

    this.modes = ['Farm', 'Seed', 'Attack', 'Destroy'];
    this.wallModes = ['Stone Wall', 'Wood Wall'];

    this.colors = {
      Farm: 0x8B4513,
      Seed: 0x008000,
      Attack: 0xFF0000,
      Destroy: 0x990000, // red (new type, same color ok)
      'Stone Wall': 0x808080, // gray
      'Wood Wall': 0xC2A165,  // tan/wood
    };

    this.activeMode = null;

    this.container = scene.rexUI.add.sizer({ orientation: 'x', space:{left: 0, right:0,} });
    
    this.buttons = [];
    this.createButtons();
    this.registerHotkeys();

    // When the scene tells us a mode is completed, clear highlight AND shut off the actual mode flag
    this.scene.events.on('mode:completed', (mode) => {
      if (!mode) return;

      if (mode === "Farm")   this.scene.farmMode = false;
      if (mode === "Seed")   this.scene.seedGridMode = false;
      if (mode === "Attack") this.scene.attackMode = false;
      if (mode === "Destroy") {
        this.scene.destroyWallMode = false;
        this.scene.wallDestroyer?.stop?.();
        this.scene.input.setDefaultCursor('default');
      }

      if (mode === this.activeMode) {
        this.activeMode = null;
        this.updateVisuals();
      }
    });


    // keep container out of main camera
    scene.cameras.main.ignore(this.container);
    scene.functionTab = this;
  }

  createButtons() {
    const columns = 5;                
    const colWidth = this.width / columns;
    const fullHeight = this.height;

    // --- First 3 columns: Farm / Seed / Attack (same behavior as before)
    this.modes.forEach((mode) => {
      const color = this.colors[mode];

      const btn = this.scene.rexUI.add.label({
        width: colWidth,
        height: fullHeight,
        background: this.scene.add.rectangle(0, 0, 0, 0, 0x222222),
        text: this.scene.add.text(0, 0, mode, {
          fontSize: 16,
          color: Phaser.Display.Color.IntegerToColor(color).rgba,
          fontStyle: 'bold'
        }),
        align: 'center',
      })
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => this.toggleMode(mode));

      this.container.add(btn, { proportion: 1, expand: true });
      this.buttons.push({ btn, mode, color });
    });

    // --- 4th column: vertical stack (Stone Wall / Wood Wall)
    const wallCol = this.scene.rexUI.add.sizer({
      orientation: 'y',
      space: { item: 6 } // gap between stacked buttons
    });

    const wallButtonHeight = (fullHeight - 6) / 2; // subtract gap once

    this.wallModes.forEach((mode) => {
      const color = this.colors[mode];

      const btn = this.scene.rexUI.add.label({
        width: colWidth,
        height: wallButtonHeight,
        background: this.scene.add.rectangle(0, 0, 0, 0, 0x222222),
        text: this.scene.add.text(0, 0, mode, {
          fontSize: 14,
          color: Phaser.Display.Color.IntegerToColor(color).rgba,
          fontStyle: 'bold'
        }),
        align: 'center',
      })
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => this.toggleMode(mode));

      wallCol.add(btn, { proportion: 1, expand: true });
      this.buttons.push({ btn, mode, color }); // IMPORTANT: so updateVisuals() highlights them too
    });

    this.container.add(wallCol, { proportion: 1, expand: true });

    // start with nothing selected visually
    this.updateVisuals();
  }

  toggleMode(mode) {
    const turningOn = (this.activeMode !== mode);
    this.activeMode = turningOn ? mode : null;
    this.updateVisuals();

    // First, turn everything off (deterministic)
    this.scene.farmMode = false;
    this.scene.seedGridMode = false;
    this.scene.attackMode = false;

    // placeholders for later logic
    this.scene.stoneWallMode = false;
    this.scene.woodWallMode = false;
    this.scene.destroyWallMode = false;

    // Then, if turning on, enable exactly one
    if (turningOn) {
      if (mode === "Farm") this.scene.farmMode = true;
      if (mode === "Seed") this.scene.seedGridMode = true;
      if (mode === "Attack") this.scene.attackMode = true;

      if (mode === "Stone Wall") {this.scene.stoneWallMode = true; this.scene.wallPlacer.start("wall");};
      if (mode === "Wood Wall") {this.scene.woodWallMode = true; this.scene.wallPlacer.start("woodWall");};
      if (mode === "Destroy") {
        this.scene.destroyWallMode = true;
        this.scene.wallDestroyer?.start?.(); // NEW
      }
    } else {
      // turning off currently active mode:
      if (mode === "Destroy") {
        this.scene.wallDestroyer?.stop?.();
        this.scene.input.setDefaultCursor('default');
      }
    }

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
