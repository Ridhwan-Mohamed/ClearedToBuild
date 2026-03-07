import { RolePolicy } from "./RolePolicy";

export class ForagerPolicy extends RolePolicy {
    constructor() {
        super("Forager", ["forage"]);
    }
}

