export const UI_ITEM_TYPES = {
    unclean_water: {
        name: "unclean_water",
        icon: "uncleanWaterIcon",
        description: "Water from a unclean source, for farming",
        cooksTo: "clean_water",
        label: "Unclean Water",
        stacks: 12,
        moneyValue: 1
    },
    clean_water: {
        name: "clean_water",
        icon: "waterIcon",
        label: "Clean Water",
        description: "Safe drinking water",
        stacks: 12,
        moneyValue: 2
    },
    food: {
        name: "food",
        icon: "foodIcon",
        description: "Cooked rations",
        label: "Food",
        stacks: 12,
        moneyValue: 3
    },
    rawFood: {
        name: "rawFood",
        icon: "foodIcon",
        description: "Uncooked rations",
        label: "Raw Food",
        cooksTo: "food",
        stacks: 12,
        moneyValue: 2
    },
    wood: {
        name: "wood",
        icon: "woodIcon",
        label: "Wood",
        description: "Basic fuel for ovens",
        stacks: 5,
        moneyValue: 10
    },
    stone: {
        name: "stone",
        icon: "stoneIcon",
        label: "Stone",
        description: "Construction material",
        stacks: 5,
        moneyValue: 10
    },
    crop: {
        name: "crop",
        icon: "foodIcon",
        description: "Wheat",
        label: "Crop",
        stacks: 10,
        food: true,
        foodValue: 1,
        moneyValue: 2
    },
    seedCrop: {
        name: "seedCrop",
        stacks: 8,
        label: "Crop Seed",
        icon: "seeds",
        food: false,
        seed: true,
        moneyValue: 1
    },
    seedBerry: {
        name: "seedBerry",
        label: "Berry Seed",
        stacks: 8,
        icon: "berry",
        food: false,
        seed: true,
        moneyValue: 2
    }
};
