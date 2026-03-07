export class RolePolicy {
    constructor(roleName, orderedKinds = []) {
        this.roleName = roleName;
        this.orderedKinds = orderedKinds;
    }

    getRoleName() {
        return this.roleName;
    }

    collectCandidates(troop, tickets) {
        const allowed = new Set(this.orderedKinds);
        return tickets.filter(t =>
            t &&
            t.roleMask?.includes(this.roleName) &&
            allowed.has(t.kind)
        );
    }

    score(troop, ticket) {
        const idx = this.orderedKinds.indexOf(ticket.kind);
        const kindWeight = idx === -1 ? 0 : (this.orderedKinds.length - idx) * 100;
        const dist = Phaser.Math.Distance.Between(
            troop.x, troop.y,
            ticket.x * SQUARESIZE + SQUARESIZE / 2, ticket.y * SQUARESIZE + SQUARESIZE / 2
        );
        const distancePenalty = Math.min(90, dist / 12);
        return ticket.hardPriority + ticket.softPriority + ticket.urgency + kindWeight - distancePenalty;
    }
}
import { SQUARESIZE } from "../../constants";
