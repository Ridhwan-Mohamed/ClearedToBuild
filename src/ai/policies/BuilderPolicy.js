import { RolePolicy } from "./RolePolicy";

export class BuilderPolicy extends RolePolicy {
    constructor() {
        super("Builder", [
            "destroy_tile",
            "destroy_block",
            "build_block",
            "build_tile",
            "fix",
        ]);
    }
}

