export class TaskTicket {
    constructor({
        id,
        kind,
        team,
        x,
        y,
        roleMask = [],
        hardPriority = 0,
        softPriority = 0,
        urgency = 0,
        phase = "pre_pickup",
        source = "queue",
        assignedCount = 0,
        maxAssigned = 1,
        reservationKey = null,
        ref = null,
        arrayKey = null,
        payload = null,
    }) {
        this.id = id;
        this.kind = kind;
        this.team = team;
        this.x = x;
        this.y = y;
        this.roleMask = roleMask;
        this.hardPriority = hardPriority;
        this.softPriority = softPriority;
        this.urgency = urgency;
        this.phase = phase;
        this.source = source;
        this.assignedCount = assignedCount;
        this.maxAssigned = maxAssigned;
        this.reservationKey = reservationKey;
        this.ref = ref;
        this.arrayKey = arrayKey;
        this.payload = payload;
    }
}

