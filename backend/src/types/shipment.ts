export const SHIPMENT_STATUS = [
  "preparing",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

export interface Shipment {
  customer_id: string;
  customer_name: string;
  product_name: "sample";
  tracking_number: string;
  origin: string;
  destination: string;
  current_location?: string;
  status_: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShipmentInput extends Omit<
  Shipment,
  "createdAt" | "updatedAt"
> {}

export interface UpdateShipmentInput extends Partial<
  Omit<Shipment, "tracking_number" | "createdAt" | "updatedAt">
> {}

export interface ShipmentRetrievalFilters {
  status_?: ShipmentStatus;
  sortOrder?: "asc" | "desc";
}