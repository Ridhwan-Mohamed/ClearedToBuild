import icon_speed_boots from 'url:../assets/cardIcons/icon_speed_boots.png'
import icon_battery from 'url:../assets/cardIcons/icon_battery.png'
import icon_fire from 'url:../assets/cardIcons/icon_fire.png'
import icon_sleep_zzz from 'url:../assets/cardIcons/icon_sleep_zzz.png'
import icon_strength from 'url:../assets/cardIcons/icon_strength.png'
import icon_explosion from 'url:../assets/cardIcons/icon_explosion.png'
import icon_water_jar from 'url:../assets/cardIcons/icon_water_jar.png'
import icon_house from 'url:../assets/cardIcons/icon_house.png'
import icon_accuracy from 'url:../assets/cardIcons/icon_accuracy.png'
import { blockResourceManager } from '../Manager/BlockResourceManager'
import { Farmer } from '../players/Farmer'
import { Fireman } from '../players/Fireman'
import { Gunslinger } from '../players/Gunslinger'
import { Forager } from '../players/Forager'
import { ClayOven } from '../buildings/ClayOven'
import { buildingManager } from '../Manager/buildingManager'
import { StaminaManager } from '../Manager/staminaManager'
import { weapons } from '../weapons'

export function loadCardData(scene){
    scene.load.image('icon_speed_boots', icon_speed_boots);
    scene.load.image('icon_battery', icon_battery);
    scene.load.image('icon_fire', icon_fire);
    scene.load.image('icon_sleep_zzz', icon_sleep_zzz);
    scene.load.image('icon_strength', icon_strength);
    scene.load.image('icon_explosion', icon_explosion);
    scene.load.image('icon_water_jar', icon_water_jar);
    scene.load.image('icon_house', icon_house);
    scene.load.image('icon_accuracy', icon_accuracy);
}

export const POWERUP_CARDS = [
    // ===== PLAYER SPEED – 2x faster =====
    {
        id: "farmer_speed_2x",
        image: "icon_speed_boots",
        name: "Fleet Farmers",
        text: "Farmers move 2x faster.",
        type: "player",
        target: "farmer",
        OUTLINE: "#8b5a2b", // farmer tint
        probability: 15,
        apply: () => {
            console.log("Apply 2x speed to Farmers");
            Farmer.speed *= 2
        },
        remove: () => {
            console.log("Removing 2x speed to Farmers");
            Farmer.speed /= 2
        }
    },
    {
        id: "fireman_speed_2x",
        image: "icon_speed_boots",
        name: "Rapid Firemen",
        text: "Firemen move 2x faster.",
        type: "player",
        target: "fireman",
        OUTLINE: "#ff9933", // fireman tint
        probability: 15,
        apply: () => {
            console.log("Apply 2x speed to Fireman");
            Fireman.speed *= 2
        },
        remove: () => {
            console.log("Removing 2x speed to Fireman");
            Fireman.speed /= 2
        }
    },
    {
        id: "gunslinger_speed_2x",
        image: "icon_speed_boots",
        name: "Quickdraw Gunslingers",
        text: "Gunslingers move 2x faster.",
        type: "player",
        target: "gunslinger",
        OUTLINE: "#9999ff", // gunslinger tint
        probability: 15,
        apply: () => {
            console.log("Apply 2x speed to Gunslingers");
            Gunslinger.speed *= 2
        },
        remove: () => {
            console.log("Removing 2x speed to Gunslingers");
            Gunslinger.speed /= 2
        }
    },
    {
        id: "forager_speed_2x",
        image: "icon_speed_boots",
        name: "Frantic Foragers",
        text: "Foragers move 2x faster.",
        type: "player",
        target: "Foragers",
        OUTLINE: "#228B22", // forager tint
        probability: 15,
        apply: () => {
            console.log("Apply 2x speed to Foragers");
            Forager.speed *= 2
        },
        remove: () => {
            console.log("Removing 2x speed to Foragers");
            Forager.speed /= 2
        }
    },

    // ===== STAMINA EFFICIENCY – 50% less stamina burn =====
    {
        id: "farmer_stamina_half",
        image: "icon_battery",
        name: "Efficient Farmers",
        text: "Farmers use 50% less stamina over time.",
        type: "player",
        target: "farmer",
        OUTLINE: "#8b5a2b",
        probability: 15,
        apply: () => {
            console.log("Apply 50% stamina efficiency to Farmers");
            Farmer.stamina /= 2;
        },
        remove: () => {
            console.log("Removing 50% stamina efficiency to Farmers");
            Farmer.stamina *= 2;
        },
    },
    {
        id: "fireman_stamina_half",
        image: "icon_battery",
        name: "Efficient Firemen",
        text: "Firemen use 50% less stamina over time.",
        type: "player",
        target: "fireman",
        OUTLINE: "#ff9933",
        probability: 15,
        apply: () => {
            console.log("Apply 50% stamina efficiency to Firemen");
            Fireman.stamina /= 2;
        },
        remove: () => {
            console.log("Removing 50% stamina efficiency to Firemen");
            Fireman.stamina *= 2;
        },
    },
    {
        id: "gunslinger_stamina_half",
        image: "icon_battery",
        name: "Efficient Gunslingers",
        text: "Gunslingers use 50% less stamina over time.",
        type: "player",
        target: "gunslinger",
        OUTLINE: "#9999ff",
        probability: 15,
        apply: () => {
            console.log("Apply 50% stamina efficiency to Gunslingers");
            Gunslinger.stamina /= 2;
        },
        remove: () => {
            console.log("Removing 50% stamina efficiency to Gunslingers");
            Gunslinger.stamina *= 2;
        },
    },
    {
        id: "forager_stamina_half",
        image: "icon_battery",
        name: "Efficient Foragers",
        text: "Foragers use 50% less stamina over time.",
        type: "player",
        target: "Foragers",
        OUTLINE: "#9999ff",
        probability: 15,
        apply: () => {
            console.log("Apply 50% stamina efficiency to Foragers");
            Forager.stamina /= 2;
        },
        remove: () => {
            console.log("Removing 50% stamina efficiency to Foragers");
            Forager.stamina *= 2;
        },
    },

    // ===== CLAY OVENS – 2x cooking speed =====
    {
        id: "oven_speed_2x",
        image: "icon_fire",
        name: "Hot Ovens",
        text: "Clay ovens cook 2x faster.",
        type: "building",
        target: "clayOven",
        OUTLINE: "#8b4513", // brown
        probability: 20,
        apply: () => {
            console.log("Apply 2x cooking speed to Clay Ovens");
            ClayOven.cookDuration /= 2;
        },
        remove: () => {
            console.log("Removing 2x cooking speed to Clay Ovens");
            ClayOven.cookDuration *= 2;
        }
    },

    // ===== GLOBAL SLEEP REGEN – 2x stamina per tick while sleeping =====
    {
        id: "sleep_regen_2x",
        image: "icon_sleep_zzz",
        name: "Restful Nights",
        text: "Sleeping restores 2x stamina for all players.",
        type: "global",
        target: "sleep",
        OUTLINE: "#3366ff", // blue
        probability: 20,
        apply: () => {
            console.log("Apply 2x sleep stamina regen");
            StaminaManager.staminaIncreaseAmnt *= 2;
        },
        remove: () => {
            console.log("Removing 2x sleep stamina regen");
            StaminaManager.staminaIncreaseAmnt /= 2;
        }
    },

    // ===== WOOD & STONE GATHERING – faster chop/break time =====
    {
        id: "gather_speed_wood_stone",
        image: "icon_strength",
        name: "Mighty Workers",
        text: "Wood chopping and stone breaking are significantly faster.",
        type: "gathering",
        target: "wood_stone",
        OUTLINE: "#64ff32", // bright green
        probability: 20,
        apply: () => {
            console.log("Apply faster wood/stone gathering");
            blockResourceManager.woodBreakDuration /= 2;
            blockResourceManager.rockBreakDuration /= 2;
        },
        remove: () => {
            console.log("Removed faster wood/stone gathering");
            blockResourceManager.woodBreakDuration *= 2;
            blockResourceManager.rockBreakDuration *= 2;
        }
    },

    // ===== GUNSLINGER ACCURACY – +50% accuracy per shot =====
    {
        id: "gunslinger_accuracy_50",
        image: "icon_accuracy",
        name: "Deadly Aim",
        text: "Gunslingers gain double hit accuracy.",
        type: "player",
        target: "gunslinger",
        OUTLINE: "#9999ff",
        probability: 15,
        apply: () => {
            weapons.pistol.accuracy *= 2
        }
    },

    // ===== FARMER: MORE WATER CAPACITY – 5 instead of 3 =====
    {
        id: "farmer_water_capacity_5",
        image: "icon_water_jar",
        name: "Hydrated Farmers",
        text: "Farmers can carry up to 5 water instead of 3.",
        type: "player",
        target: "farmer",
        OUTLINE: "#8b5a2b",
        probability: 15,
        apply: () => {
            console.log("Apply +2 water capacity to Farmers");
            Farmer.maxWaterPailCarry += 2;
        },
        remove: () => {
            console.log("Apply +2 water capacity to Farmers");
            Farmer.maxWaterPailCarry -= 2;
        }
    },

    // ====== Builder: Make Building Faster =====
    {
        id: "builder_speed_2x",
        image: "icon_house",                // ← house icon sprite you’ll make
        name: "Master Builders",
        text: "Builders construct buildings 2x faster.",
        type: "player",
        target: "builder",
        OUTLINE: "#4433ff",                 // builder tint color
        probability: 15,
        apply: () => {
            console.log("Apply 2x build speed to Builders");
            buildingManager.blockBuildingDuration /= 2;
        },
        remove: () => {
            console.log("Removing 2x build speed to Builders");
            buildingManager.blockBuildingDuration *= 2;
        }
    }
];
