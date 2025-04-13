import logo from '../public/logo.png'
import { TILE_MAP, WORLD_DIMENSIONX, WORLD_DIMENSIONY, TILE_TYPES, create2DArray } from './constants';
import { WaveCollapse } from './waveCollapse';
import { itemTab } from './itemTab';
import { mapView } from './mapView';
import { clearPlayerDict, generateTown, playerDict } from './town.js';
import { Map } from './map.js';

class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu');
    }

    preload() {
        this.load.image('logo', logo);
    }

    create() {
        this.logo = this.add.image(0, 0, 'logo').setOrigin(0.5).setScale(1);
        this.startText = this.add.text(0, 0, 'START', {
            fontSize: '30px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive();

        this.tweens.add({
            targets: this.startText,
            alpha: 0.3,
            yoyo: true,
            repeat: -1,
            duration: 500
        });

        this.updateLayout(); // Initial layout positioning

        this.startText.on('pointerdown', () => this.startGame());
        
        // ✅ Listen to Phaser's internal resize event
        this.scale.on('resize', this.updateLayout, this);   
    }

    updateLayout() {
        const { width, height } = this.scale;
        this.logo.setPosition(width / 2, height / 2);
        this.startText.setPosition(width / 2, height / 2 + 250);
    }

    startGame() {
        const { width } = this.scale;
        const targetY = 120;

        this.tweens.add({
            targets: this.logo,
            y: targetY,
            scale: 0.3,
            duration: 1000,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                // Once logo animation is complete, show grid + buttons
                this.showGridAndButtons();
            }
        });

        this.tweens.add({
            targets: this.startText,
            alpha: 0,
            duration: 300,
            ease: 'Linear',
            onComplete: () => {
                this.startText.destroy();
            }
        });
    }

    showGridAndButtons() {
        const gridWidth = WORLD_DIMENSIONX;
        const gridHeight = WORLD_DIMENSIONY;
        const tileSize = 6;
    
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const offsetX = centerX - (gridWidth * tileSize) / 2;
        const offsetY = centerY - (gridHeight * tileSize) / 2 + 50;
    
        this.gridData = [];
        this.gridGraphics = [];
    
        const drawGrid = (firstTime = false) => {
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    const type = Array.isArray(this.gridData[y][x])
                        ? TILE_MAP(this.gridData[y][x][1])
                        : TILE_MAP(this.gridData[y][x]);
        
                    const color = {
                        water: 0x3399ff,
                        dirt: 0xcc9966,
                        grass: 0x33cc33,
                        house1: 0x8b0000,
                        house2: 0x006400,
                        road: 0x555555,
                        well: 0xADD8E6
                    }[type] || 0xffffff;
        
                    const index = y * gridWidth + x;
                    const existing = this.gridGraphics[index];
        
                    const posX = offsetX + x * tileSize;
                    const posY = offsetY + y * tileSize;
        
                    if (!existing) {
                        const rect = this.add.rectangle(posX, posY, tileSize - 1, tileSize - 1, color)
                            .setOrigin(0)
                            .setDepth(1);
        
                        if (firstTime) {
                            rect.setAlpha(0);
                            // Grouped fade-in per row
                            this.time.delayedCall(y * 20, () => {
                                this.tweens.add({
                                    targets: rect,
                                    alpha: 1,
                                    duration: 150
                                });
                            });
                        }
        
                        this.gridGraphics[index] = rect;
                    } else {
                        const currentColor = existing.fillColor;
                        this.tweens.add({
                            targets: existing,
                            scale: 0.5,
                            duration: 150,
                            yoyo: true,
                            ease: 'Quad.easeOut'
                        });
    
                        this.tweens.addCounter({
                            from: 0,
                            to: 100,
                            duration: 200,
                            onUpdate: tween => {
                                const value = tween.getValue();
                                const newColor = Phaser.Display.Color.Interpolate.ColorWithColor(
                                    Phaser.Display.Color.ValueToColor(currentColor),
                                    Phaser.Display.Color.ValueToColor(color),
                                    100,
                                    value
                                );
                                existing.setFillStyle(
                                    Phaser.Display.Color.GetColor(newColor.r, newColor.g, newColor.b)
                                );
                            }
                        });
                        
                    }
                }
            }
        };


        const generateGridData = (firstTime = false) => {
            Map.navGrid = create2DArray(WORLD_DIMENSIONX,WORLD_DIMENSIONY);
            this.gridData = WaveCollapse.generateGrid(WORLD_DIMENSIONX, WORLD_DIMENSIONY);
            this.gridData = generateTown(this.gridData, [TILE_TYPES.turret,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,
                TILE_TYPES.well,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1
            ], 1)
            this.gridData = generateTown(this.gridData, [TILE_TYPES.turret,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,
                TILE_TYPES.well,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1,TILE_TYPES.house1,TILE_TYPES.house2,TILE_TYPES.house1
            ], 2)
            drawGrid(firstTime);
        };
    
        generateGridData(true); // Initial draw with fade-in
    
        // Buttons
        const buttonStyle = {
            fontSize: '20px',
            fill: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        };
    
        const buttonY = offsetY + gridHeight * tileSize + 30;
    
        const generateBtn = this.add.text(centerX - 100, buttonY, 'Generate', buttonStyle)
            .setOrigin(0.5)
            .setAlpha(0)
            .setInteractive()
            .on('pointerdown', () => {clearPlayerDict(); generateGridData(false)});
    
        const playBtn = this.add.text(centerX + 100, buttonY, 'Play', buttonStyle)
        .setOrigin(0.5)
        .setAlpha(0)
        .setInteractive()
        .on('pointerdown', () => {
            this.cameras.main.fadeOut(250, 0, 0, 0); // 500ms fade to black
    
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('mapView', this.gridData);
            });
        });
        
    
        this.tweens.add({
            targets: [generateBtn, playBtn],
            alpha: 1,
            duration: 500,
            delay: 400
        });
    }
    
    
}


const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a1a',
    scene: [MainMenu, mapView, itemTab],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: true
        }
    },
 
};

new Phaser.Game(config);
