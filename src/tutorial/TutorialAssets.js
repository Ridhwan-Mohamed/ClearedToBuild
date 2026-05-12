import farmerSpeaking from "url:../assets/Players/farmer/farmer speaking.png";
import foragerSpeaking from "url:../assets/Players/forager/forager_speaking.png";
import builderSpeaking from "url:../assets/Players/builder/builder_speaking.png";
import firemanSpeaking from "url:../assets/Players/fireman/fireman_speaking.png";
import brawlerSpeaking from "url:../assets/Players/brawler/brawler_speaking.png";

export const TUTORIAL_SPEAKERS = Object.freeze({
  farmer: {
    key: "farmer",
    name: "Farmer",
    textureKey: "tutorial_farmer_speaking",
    animKey: "tutorial_farmer_speaking_talk",
    asset: farmerSpeaking,
    frameCount: 6,
    color: 0x8b5a2b,
    textColor: "#ffd9a1",
  },
  forager: {
    key: "forager",
    name: "Forager",
    textureKey: "tutorial_forager_speaking",
    animKey: "tutorial_forager_speaking_talk",
    asset: foragerSpeaking,
    frameCount: 6,
    color: 0x2cb96f,
    textColor: "#a7f3d0",
  },
  builder: {
    key: "builder",
    name: "Builder",
    textureKey: "tutorial_builder_speaking",
    animKey: "tutorial_builder_speaking_talk",
    asset: builderSpeaking,
    frameCount: 6,
    color: 0x6d6dff,
    textColor: "#c7d2fe",
  },
  fireman: {
    key: "fireman",
    name: "Fireman",
    textureKey: "tutorial_fireman_speaking",
    animKey: "tutorial_fireman_speaking_talk",
    asset: firemanSpeaking,
    frameCount: 5,
    color: 0xff9933,
    textColor: "#fed7aa",
  },
  brawler: {
    key: "brawler",
    name: "Brawler",
    textureKey: "tutorial_brawler_speaking",
    animKey: "tutorial_brawler_speaking_talk",
    asset: brawlerSpeaking,
    frameCount: 6,
    color: 0xffd712,
    textColor: "#fef08a",
  },
});

export function preloadTutorialAssets(scene) {
  Object.values(TUTORIAL_SPEAKERS).forEach((speaker) => {
    if (scene.textures.exists(speaker.textureKey)) return;
    scene.load.spritesheet(speaker.textureKey, speaker.asset, {
      frameWidth: 128,
      frameHeight: 128,
    });
  });
}

export function createTutorialAnimations(scene) {
  Object.values(TUTORIAL_SPEAKERS).forEach((speaker) => {
    if (scene.anims.exists(speaker.animKey)) return;
    scene.anims.create({
      key: speaker.animKey,
      frames: scene.anims.generateFrameNumbers(speaker.textureKey, {
        start: 0,
        end: Math.max(0, speaker.frameCount - 1),
      }),
      frameRate: speaker.key === "fireman" ? 7 : 8,
      repeat: -1,
    });
  });
}
