import { RolePolicy } from "./RolePolicy";

export class FiremanPolicy extends RolePolicy {
    constructor() {
        super("Fireman", ["oven_unload", "oven_fuel", "oven_fill"]);
    }
}

