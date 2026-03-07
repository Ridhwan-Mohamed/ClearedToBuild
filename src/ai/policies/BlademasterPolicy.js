import { RolePolicy } from "./RolePolicy";

export class BlademasterPolicy extends RolePolicy {
    constructor() {
        super("Blademaster", ["enemy_destroy_tile", "enemy_destroy_block"]);
    }
}

