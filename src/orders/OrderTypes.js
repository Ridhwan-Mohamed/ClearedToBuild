export const ORDER_KINDS = {
  GATHER_TYPE: "gather_type",
  GATHER_AREA: "gather_area",
  GATHER_SET: "gather_set",
  DEFEND_TOWN: "defend_town",
  HOLD_POSITION: "hold_position",
};

export function isGatherOrder(order) {
  return !!(
    order &&
    (
      order.kind === ORDER_KINDS.GATHER_TYPE ||
      order.kind === ORDER_KINDS.GATHER_AREA ||
      order.kind === ORDER_KINDS.GATHER_SET
    ) &&
    order.status === "active"
  );
}
