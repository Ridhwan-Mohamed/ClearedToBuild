import { RolePolicy } from "./RolePolicy";

export class GunslingerPolicy extends RolePolicy {
    constructor() {
        super("Gunslinger", ["enemy_destroy_tile", "enemy_destroy_block"]);
    }
}

