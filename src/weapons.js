import { Projectile } from "./Projectile";

export const weapons = {
    //default weapon for low class enemies
    hands : {
        name: "Hands",
        baseDmg: 10,
        critDmg: 15,
        critProb: 20,
        accuracy: 75,
        duration: 700,
        range: 16,
        projectile: false
    },

    // Fast, close-range melee – ideal baseline for Brawler / basic punchers
    boxingGloves: {
        name: "Boxing Gloves",
        baseDmg: 18,     // higher than old 10
        critDmg: 30,
        critProb: 25,    // a bit more critty
        accuracy: 80,
        duration: 700,    // faster swing than before
        range: 18,       // slightly more reach than bare hands
        projectile: false
    },

    // High-damage melee for Blademaster
    sword: {
        name: "Sword",
        baseDmg: 45,     // chunky hits
        critDmg: 85,
        critProb: 30,
        accuracy: 90,    // blades are precise
        duration: 1000,   // slower swing than gloves
        range: 22,       // a bit more reach than fists
        projectile: false
    },

    pistol: {
        name: "pistol",
        baseDmg: 100,
        critDmg: 175,
        critProb: 40,
        accuracy: 85,
        duration: 1000,
        range: 200,
        projectile: true,
        speed: 300
    }
};
