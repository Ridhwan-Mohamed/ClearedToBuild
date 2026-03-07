import { RolePolicy } from "./RolePolicy";

export class BrawlerPolicy extends RolePolicy {
    constructor() {
        super("Brawler", ["enemy_destroy_tile", "enemy_destroy_block"]);
    }
}

