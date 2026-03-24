// src/UI/CardsTab.js
import { UIDEPTH } from "../../constants";
import { getCardHand } from "../Powerups";

export default class CardsTab {

    constructor(scene) {
        this.scene = scene;
        this.team  = "1";

        // Put the container at the center of its page; children will use local coords.
        this.view  = scene.add.container(0, 0).setDepth(UIDEPTH);
        this.slots = [];

        this.buildUI();
        this.refresh();

        scene.events.on("cards:updated", this.refresh, this);
    }

    buildUI() {
        // Local coordinate system: treat (0, 0) as the center of the page.
        const centerX   = 0;
        const y         = 0;
        const slotWidth = 160;   // wider cards
        const slotHeight = 190;
        const spacing   = 175;

        const firstOffset = -2;  // 5 cards → -2..+2

        for (let i = 0; i < 5; i++) {
            const offset = firstOffset + i;
            const x = centerX + offset * spacing;

            const bg = this.scene.add.rectangle(x, y, slotWidth, slotHeight, 0x222222, 0.8)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true })
                .setDepth(UIDEPTH);

            // Icon box + image + "Empty" text
            const iconBg = this.scene.add.rectangle(x, y - 35, 50, 50, 0x111111, 1)
                .setStrokeStyle(1, 0xffffff, 0.4)
                .setDepth(UIDEPTH);

            const iconImage = this.scene.add.image(x, y - 35, "icon_speed_boots")
                .setDepth(UIDEPTH + 1)
                .setVisible(false) // hidden until a card is present
                .setScale(1);

            const iconText = this.scene.add.text(x, y - 35, "Empty", {
                fontSize: "12px",
                fill: "#999999",
                fontFamily: "Bungee"
            }).setOrigin(0.5).setDepth(UIDEPTH + 2);

            const name = this.scene.add.text(x, y - 70, "", {
                fontSize: "12px",
                fill: "#ffffff",
                fontFamily: "Bungee"
            }).setOrigin(0.5).setDepth(UIDEPTH);

            const desc = this.scene.add.text(x, y + 25, "", {
                fontSize: "12px",
                fill: "#cccccc",
                wordWrap: { width: slotWidth - 20 }
            }).setOrigin(0.5).setDepth(UIDEPTH);

            [bg, iconBg, iconImage, iconText, name, desc].forEach(el => {
                this.view.add(el);
            });

            this.slots.push({
                bg,
                name,
                desc,
                iconBg,
                iconImage,
                iconText,
                index: i
            });
        }
    }

    refresh = () => {
        const hand = getCardHand(this.team);

        this.slots.forEach((slot, i) => {
            const card = hand[i];

            if (!card) {
                slot.bg.setAlpha(0.3);
                slot.name.setText("");
                slot.desc.setText("");

                slot.iconImage.setVisible(false);
                slot.iconText.setText("Empty");
                slot.iconText.setVisible(true);
                return;
            }

            slot.bg.setAlpha(0.9);
            slot.name.setText(card.name || "???");
            slot.desc.setText(card.text || "");

            // show actual icon image
            slot.iconImage.setTexture(card.image);
            slot.iconImage.setVisible(true);

            // hide "Empty" text
            slot.iconText.setVisible(false);
        });
    };
}
