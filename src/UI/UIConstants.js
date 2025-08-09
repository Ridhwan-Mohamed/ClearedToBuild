export const UI_ITEM_TYPES = {
    unclean_water: {
        name: "unclean_water",
        icon: "uncleanWaterIcon",
        description: "Water from a unclean source, for farming",
        cooksTo: "clean_water",
        label: "Unclean Water",
        stacks: 15
    },
    clean_water: {
        name: "clean_water",
        icon: "waterIcon",
        label: "Clean Water",
        description: "Safe drinking water",
        stacks: 15
    },
    food: {
        name: "food",
        icon: "foodIcon",
        description: "Cooked rations",
        label: "Food",
        stacks: 15
    },
    wood: {
        name: "wood",
        icon: "woodIcon",
        label: "Wood",
        description: "Basic fuel for ovens",
        stacks: 5
    },
    stone: {
        name: "stone",
        icon: "stoneIcon",
        label: "Stone",
        description: "Construction material",
        stacks: 5
    },
    crop: {
        name: "crop",
        icon: "foodIcon",
        description: "Wheat",
        label: "Crop",
        stacks: 10,
        food: true,
        foodValue: 1
    },
    seedCrop: {
        name: 'seedCrop',
        stacks: 10,
        label: "Crop Seed",
        icon: 'seeds',
        food: false,
        seed: true
    },
    seedBerry: {
        name: 'seedBerry',
        label: "Berry Seed",
        stacks: 10,
        icon: 'berry',
        food: false,
        seed: true
    }
};
