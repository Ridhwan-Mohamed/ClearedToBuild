import { RolePolicy } from "./RolePolicy";
import { StorageManager } from "../../Manager/StorageManager";
import { UI_ITEM_TYPES } from "../../UI/UIConstants";

export class FarmerPolicy extends RolePolicy {
    constructor() {
        super("Farmer", ["harvest", "seed", "water"]);
    }

    collectCandidates(troop, tickets) {
        const candidates = super.collectCandidates(troop, tickets);
        const hasCropRoom =
            !!StorageManager.getDeliveryReservation(troop, UI_ITEM_TYPES.crop) ||
            StorageManager.canReserveDeliverySpace(troop?.body?.team, UI_ITEM_TYPES.crop);

        return candidates.filter(ticket => ticket.kind !== "harvest" || hasCropRoom);
    }
}
