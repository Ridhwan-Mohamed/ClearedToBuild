import { RolePolicy } from "./RolePolicy";

export class FarmerPolicy extends RolePolicy {
    constructor() {
        super("Farmer", ["harvest", "seed", "water"]);
    }
}

