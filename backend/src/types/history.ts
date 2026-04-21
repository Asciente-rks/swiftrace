import { ShipmentStatus } from "./shipment";
export const SHIPMENT_HISTORY_TYPES = ["created", "picked_up", "in_transit", "out_for_delivery", "delivered"] as const;
export type ShipmentHistoryType = (typeof SHIPMENT_HISTORY_TYPES)[number];

export interface ShipmentHistoryItem {
  tracking_number: string;
  historyId: string;
  historyType: ShipmentHistoryType;
  historyAt: string;
  status?: ShipmentStatus;
  current_location?: string;
  details?: string;
  admin_verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface ShipmentHistoryResponse extends Omit<ShipmentHistoryItem, "admin_verified" | "verifiedAt" | "verifiedBy"> {}
