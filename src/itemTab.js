import Phaser from "phaser";
import { FLOORDEPTH, UIDEPTH, TILE_TYPES } from "./constants";
import sand from '../assets/sand.png'
import flower from '../assets/flower.png'
import pine from '../assets/pine.png'
import rock from '../assets/rock.png'
import brick from '../assets/wall/brick.png'
import dirtImg from '../assets/Dirt/dirtImg.png'
import turretBase from '../assets/turretBase.png'
import turret from '../assets/turret.png'
import Wall from '../assets/wall/Wall.png'
import TWall from '../assets/wall/TWall.png'
import BWall from '../assets/wall/BWall.png'
import RWall from '../assets/wall/RWall.png'
import LWall from '../assets/wall/LWall.png'
import TRCWall from '../assets/wall/TRCWall.png'
import BRCWall from '../assets/wall/BRCWall.png'
import TLCWall from '../assets/wall/TLCWall.png'
import BLCWall from '../assets/wall/BLCWall.png'
import Dirt from '../assets/Dirt/Dirt.png'
import TDirt from '../assets/Dirt/TDirt.png'
import BDirt from '../assets/Dirt/BDirt.png'
import RDirt from '../assets/Dirt/RDirt.png'
import LDirt from '../assets/Dirt/LDirt.png'
import TRCDirt from '../assets/Dirt/TRCDirt.png'
import BRCDirt from '../assets/Dirt/BRCDirt.png'
import TLCDirt from '../assets/Dirt/TLCDirt.png'
import BLCDirt from '../assets/Dirt/BLCDirt.png'
import WaterImg from '../assets/water/waterImg.png'
import Water from '../assets/water/water.png'
import TWater from '../assets/water/TWater.png'
import BWater from '../assets/water/BWater.png'
import RWater from '../assets/water/RWater.png'
import LWater from '../assets/water/LWater.png'
import TRCWater from '../assets/water/TRCWater.png'
import BRCWater from '../assets/water/BRCWater.png'
import TLCWater from '../assets/water/TLCWater.png'
import BLCWater from '../assets/water/BLCWater.png'
import playerImg from '../assets/Players/playerImg.png'

export class itemTab extends Phaser.Scene {
    constructor() {
        super('itemTab');
        this.numItems = 9;
    }

    preload(){}

    static preload(scene) {
        scene.load.image('image1', sand);  // Make sure the path and filename are correct
        scene.load.image('image2', rock);
        scene.load.image('image3', flower);
        scene.load.image('image4', brick);
        scene.load.image('image5', dirtImg);
        scene.load.image('image6', pine);
        scene.load.image('image7', turretBase)
        scene.load.image('image7a', turret)
        scene.load.image('image8', WaterImg); //water image
        scene.load.image('image9', playerImg); //water image
        scene.load.image('wall', Wall);
        scene.load.image('tWall', TWall); // Top wall
        scene.load.image('bWall', BWall); // Bottom wall
        scene.load.image('rWall', RWall); // Right wall
        scene.load.image('lWall', LWall); // Left wall
        scene.load.image('trcWall', TRCWall); // Top-right corner wall
        scene.load.image('brcWall', BRCWall); // Bottom-right corner wall
        scene.load.image('tlcWall', TLCWall); // Top-left corner wall
        scene.load.image('blcWall', BLCWall); // Bottom-left corner wall
        scene.load.image('Dirt', Dirt);
        scene.load.image('tDirt', TDirt); // Top Dirt
        scene.load.image('bDirt', BDirt); // Bottom Dirt
        scene.load.image('rDirt', RDirt); // Right Dirt
        scene.load.image('lDirt', LDirt); // Left Dirt
        scene.load.image('trcDirt', TRCDirt); // Top-right corner Dirt
        scene.load.image('brcDirt', BRCDirt); // Bottom-right corner Dirt
        scene.load.image('tlcDirt', TLCDirt); // Top-left corner Dirt
        scene.load.image('blcDirt', BLCDirt); // Bottom-left corner Dirt
        scene.load.spritesheet('water', Water, { frameWidth: 16, frameHeight: 16});
        scene.load.spritesheet('twater', TWater, { frameWidth: 16, frameHeight: 16}); // Top Water
        scene.load.spritesheet('bwater', BWater, { frameWidth: 16, frameHeight: 16}); // Bottom Water
        scene.load.spritesheet('rwater', RWater, { frameWidth: 16, frameHeight: 16}); // Right Water
        scene.load.spritesheet('lwater', LWater, { frameWidth: 16, frameHeight: 16}); // Left Water
        scene.load.spritesheet('trcwater', TRCWater, { frameWidth: 16, frameHeight: 16}); // Top-right corner Water
        scene.load.spritesheet('brcwater', BRCWater, { frameWidth: 16, frameHeight: 16}); // Bottom-right corner Water
        scene.load.spritesheet('tlcwater', TLCWater, { frameWidth: 16, frameHeight: 16}); // Top-left corner Water
        scene.load.spritesheet('blcwater', BLCWater, { frameWidth: 16, frameHeight: 16}); // Bottom-left corner Water
    }

    create() {
        this.createAnim('water')
        this.createAnim('twater')
        this.createAnim('bwater')
        this.createAnim('rwater')
        this.createAnim('lwater')
        this.createAnim('trcwater')
        this.createAnim('brcwater')
        this.createAnim('tlcwater')
        this.createAnim('blcwater')

        // Create a container for the dialog box
        const dialogContainer = this.add.container(0, 0);
        const dialogWidth = 800;
        const dialogHeight = 800;

        // Add a background for the dialog
        const dialogBackground = this.add.rectangle(0, 0, dialogWidth, dialogHeight, 0x222222)
            .setOrigin(0)
            .setInteractive(); // Make the background interactive for scrolling
        dialogContainer.add(dialogBackground);

        // Create a content container to hold the images
        const contentContainer = this.add.container(0, 0);

        // Add images to the content container
        const imageSpacing = 100; // Spacing between images
        for (let i = 0; i < 10; i++) {
            let y = (i * imageSpacing + 80)
            let x = 80
            if(y > 700){
                y %= 700;
                x += 150
            }
            const image = this.add.image(x, y, `image${(i % this.numItems) + 1}`)
                .setInteractive()
                .setName(`image${(i % this.numItems) + 1}`);

            // Add selection behavior
            image.on('pointerdown', () => {
                this.input.stopPropagation();
                this.registry.set('image', image.name);
                this.scene.switch('mapView');
            });

            // Add to content container
            contentContainer.add(image);
        }

        // Add the content container to the dialog
        dialogContainer.add(contentContainer);

        // Mask the content
        const maskShape = this.add.graphics().fillRect(0, 0, dialogWidth, dialogHeight);
        const mask = maskShape.createGeometryMask();
        contentContainer.setMask(mask);

        // Enable scrolling
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            const newY = Phaser.Math.Clamp(contentContainer.y - deltaY, -(contentContainer.height - dialogHeight), 0);
            contentContainer.setY(newY);
        });

        this.sceneButtons()
    }

    sceneButtons(){
        // Add a button or event to switch back to SceneA
        const main = this.add.text(10, this.cameras.main.height - 40, 'Main', { fontSize: '24px', fill: '#00ff00' })
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.selectMode = true;
                this.input.stopPropagation();
                this.scene.switch('mapView');
            })
        main.depth = UIDEPTH;
    }

    createAnim(key){
        this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: 2 }),
            frameRate: 2,
            repeat: -1
        });
    }

    static itemValues(value){
        switch (value) {
            case 'image1':
                return TILE_TYPES.sand
            case 'image2':
                return {grid: 2, lenX: 3, lenY: 3, block: false, depth: FLOORDEPTH, value: 'image2', spread: false}
            case 'image3':
                return TILE_TYPES.grass;
            case 'image4': //wall
                return TILE_TYPES.stone;
            case 'image5':
                return TILE_TYPES.dirt;
            case 'image6':
                return TILE_TYPES.pine
            case 'image7':
                return TILE_TYPES.turret
            case 'image8':
                return TILE_TYPES.water
            case 'image9':
                return TILE_TYPES.player
            default:
                break;
        }
    }
}

