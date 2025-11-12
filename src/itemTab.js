import Phaser from "phaser";
import { FLOORDEPTH, UIDEPTH, TILE_TYPES, showAlert } from "./constants";
import sand from 'url:../assets/sand.png'
import flower from 'url:../assets/flower.png'
import pine from 'url:../assets/pine.png'
import rock3 from 'url:../assets/rock3.png'
import brick from 'url:../assets/wall/brick.png'
import dirtImg from 'url:../assets/Dirt/dirtImg.png'
import turretBase from 'url:../assets/turretBase.png'
import turret from 'url:../assets/turret.png'
import Wall from 'url:../assets/wall/Wall.png'
import TWall from 'url:../assets/wall/TWall.png'
import BWall from 'url:../assets/wall/BWall.png'
import RWall from 'url:../assets/wall/RWall.png'
import LWall from 'url:../assets/wall/LWall.png'
import TRCWall from 'url:../assets/wall/TRCWall.png'
import BRCWall from 'url:../assets/wall/BRCWall.png'
import TLCWall from 'url:../assets/wall/TLCWall.png'
import BLCWall from 'url:../assets/wall/BLCWall.png'
import Dirt from 'url:../assets/Dirt/Dirt.png'
import TDirt from 'url:../assets/Dirt/TDirt.png'
import iDirt from 'url:../assets/Dirt/iDirt.png'
// import BDirt from 'url:../assets/Dirt/BDirt.png'
// import RDirt from 'url:../assets/Dirt/RDirt.png'
// import LDirt from 'url:../assets/Dirt/LDirt.png'
// import TRCDirt from 'url:../assets/Dirt/TRCDirt.png'
// import BRCDirt from 'url:../assets/Dirt/BRCDirt.png'
import TLCDirt from 'url:../assets/Dirt/TLCDirt.png'
// import BLCDirt from 'url:../assets/Dirt/BLCDirt.png'
import WaterImg from 'url:../assets/water/waterImg.png'
import playerImg from 'url:../assets/Players/playerImg.png'
import house1 from 'url:../assets/house1.png'
import house2 from 'url:../assets/house2.png'
import well from 'url:../assets/well.png'
import road_interior from 'url:../assets/Roads/road.png'
import road_edge from 'url:../assets/Roads/road_edge.png'
import road_corner from 'url:../assets/Roads/road_corner.png'
import road_island from 'url:../assets/Roads/road_island.png'
import house1Img from 'url:../assets/house1Img.png'
import construction from 'url:../assets/construction.png'
import grassCrop from 'url:../assets/grassCrop.png'
import grassBerry from 'url:../assets/grassBerry.png'
import grassRock from 'url:../assets/grassRock.png'
import grassWood from 'url:../assets/grassWood.png'
import storage from 'url:../assets/storage.png'
import pine2 from 'url:../assets/pine2.png'
import pine1 from 'url:../assets/pine1.png'
import rock2 from 'url:../assets/rock2.png'
import rock1 from 'url:../assets/rock1.png'

export class itemTab extends Phaser.Scene {

    static mapRef;

    constructor() {
        super('itemTab');
        this.numItems = 10;
    }

    preload(){}

    static preload(scene) {
        scene.load.image('image1', sand);  // Make sure the path and filename are correct
        scene.load.image('rock3', rock3);
        scene.load.image('rock2', rock2);
        scene.load.image('rock1', rock1);
        scene.load.image('image3', flower);
        scene.load.image('image4', brick);
        scene.load.image('image5', dirtImg);
        scene.load.image('pine3', pine);
        scene.load.image('pine2', pine2);
        scene.load.image('pine1', pine1);
        scene.load.image('image7', turretBase)
        scene.load.image('image7a', turret)
        scene.load.image('image8', WaterImg); //water image
        scene.load.image('image9', playerImg); //water image
        scene.load.image('image10', house1Img);
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
        scene.load.image('dirt_edge', TDirt); // Top Dirt
        scene.load.image('dirt_island', iDirt); // Top Dirt
        // scene.load.image('bDirt', BDirt); // Bottom Dirt
        // scene.load.image('rDirt', RDirt); // Right Dirt
        // scene.load.image('lDirt', LDirt); // Left Dirt
        // scene.load.image('trcDirt', TRCDirt); // Top-right corner Dirt
        // scene.load.image('brcDirt', BRCDirt); // Bottom-right corner Dirt
        scene.load.image('dirt_corner', TLCDirt); // Top-left corner Dirt
        // scene.load.image('blcDirt', BLCDirt); // Bottom-left corner Dirt
        scene.load.image('house1', house1); 
        scene.load.image('house2', house2); 
        scene.load.image('construction', construction);
        scene.load.image('well', well); 
        scene.load.image('road_interior', road_interior); 
        scene.load.image('road_edge', road_edge); 
        scene.load.image('road_corner', road_corner); 
        scene.load.image('road_island', road_island);
        scene.load.image('grassCrop', grassCrop);
        scene.load.image('grassBerry', grassBerry);
        scene.load.image('grassWood', grassWood);
        scene.load.image('grassRock', grassRock);
        scene.load.image('storage', storage);
    }

    create() {
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
        for (let i = 0; i < 11; i++) {
            let y = (i * imageSpacing + 80)
            let x = 80
            if(y > 700){
                y %= 700;
                x += 150
            }
            const image = this.add.image(x, y, `image${(i % this.numItems) + 1}`)
                .setInteractive()
                .setName(`image${(i % this.numItems) + 1}`);

            const price = itemTab.itemValues(`image${(i % this.numItems) + 1}`).price || 0;

            // Price label
            const priceText = this.add.text(x + 40, y, `$${price}`, {
                fontSize: '16px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0, 0.5);


            // Add selection behavior
            image.on('pointerdown', () => {
                if (itemTab.mapRef.money >= price) {
                    this.input.stopPropagation();
                    this.registry.set('image', image.name);
                    this.scene.switch('mapView');
                } else {
                    showAlert(this, 'Insufficient Funds', '#ff3333');
                }
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



    static itemValues(value){
        switch (value) {
            case 'image1':
                return TILE_TYPES.sand
            case 'image2':
                return {grid: 2, lenX: 3, lenY: 3, block: false, depth: FLOORDEPTH, value: 'image2', spread: false}
            case 'image3':
                return TILE_TYPES.grass;
            case 'image4': //wall
                return TILE_TYPES.wall;
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
            case 'image10':
                return TILE_TYPES.house1
            default:
                break;
        }
    }
}

