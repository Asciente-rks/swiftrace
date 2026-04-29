import { useState } from "react";
import type { FormEvent } from "react";

type ShipmentUpdateSectionProps = {
  apiBase: string;
  authToken: string;
  runRequest: (path: string, options: RequestInit, label: string) => Promise<unknown>;
};

const ShipmentUpdateSection = ({ apiBase, authToken, runRequest }: ShipmentUpdateSectionProps) => {
  const [shipmentId, setShipmentId] = useState("");
  const [status, setStatus] = useState("in_transit");
  const [location, setLocation] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runRequest(
      `/shipments/${encodeURIComponent(shipmentId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_: status, current_location: location }),
      },
      "Update shipment"
    );
  };

  return (
    <section className="shipment-update">
      <h2>Update Shipment</h2>
      <p>Update the status and location of a shipment.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Shipment ID
          <input
            type="text"
            value={shipmentId}
            onChange={(e) => setShipmentId(e.target.value)}
            placeholder="Shipment UUID"
            required
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="preparing">Preparing</option>
            <option value="in_transit">In transit</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <label>
          Current Location
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Regional hub"
          />
        </label>
        <button type="submit" className="btn-update">Update Status</button>
      </form>
    </section>
  );
};

export { ShipmentUpdateSection };
