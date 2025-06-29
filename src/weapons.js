import { Projectile } from "./Projectile";

export const weapons = {
    hands : {
        name: "Hands",
        baseDmg: 10,
        critDmg: 15,
        critProb: 20,
        accuracy: 75,
        duration: 100,
        range: 16,
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
}