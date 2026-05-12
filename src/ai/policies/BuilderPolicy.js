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

    collectCandidates(troop, tickets) {
        const candidates = super.collectCandidates(troop, tickets);
        const hasBuildWork = candidates.some((candidate) =>
            candidate?.kind === "build_block" || candidate?.kind === "build_tile"
        );
        if (!hasBuildWork) return candidates;
        return candidates.filter((candidate) => candidate?.kind !== "fix");
    }
}
