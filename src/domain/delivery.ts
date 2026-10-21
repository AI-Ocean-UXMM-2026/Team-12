export const customerStatuses = ["PROCESSING_DELIVERY", "ON_THE_WAY", "DELIVERED", "DELAY"] as const;
export type CustomerStatus = typeof customerStatuses[number];
export const deliveryResults = ["CUSTOMER_UNREACHABLE", "DELIVERED_HOME", "DELIVERED_TO_NEIGHBOUR", "LEFT_AT_DOOR"] as const;
export type DeliveryResult = typeof deliveryResults[number];
export function statusForResult(result: DeliveryResult): CustomerStatus {
  return result === "CUSTOMER_UNREACHABLE" ? "DELAY" : "DELIVERED";
}
export function canChangePreferences(status: CustomerStatus): boolean { return status !== "DELIVERED"; }
export function photoRequired(result: DeliveryResult): boolean { return result !== "CUSTOMER_UNREACHABLE"; }
