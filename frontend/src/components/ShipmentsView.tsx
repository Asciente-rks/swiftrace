import { useState, useEffect } from "react";

type ShipmentRow = {
  shipment_id: string;
  tracking_number: string;
  status_: string;
  current_location?: string;
  origin?: string;
  destination?: string;
  customer_name?: string;
  updatedAt?: string;
};

type ShipmentsViewProps = {
  runRequest: (
    path: string,
    options: RequestInit,
    label: string,
  ) => Promise<unknown>;
  onEditShipment: (shipment: ShipmentRow) => void;
};

const ShipmentsView = ({ runRequest, onEditShipment }: ShipmentsViewProps) => {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("in_transit");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRow | null>(
    null,
  );

  useEffect(() => {
    const loadShipments = async () => {
      setIsLoading(true);
      const data = await runRequest(
        `/shipments/status/${statusFilter}`,
        { method: "GET" },
        "Get shipments",
      );
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { data?: unknown } | null)?.data)
          ? (data as { data: ShipmentRow[] }).data
          : [];
      setShipments(list);
      setIsLoading(false);
    };
    loadShipments();
  }, [statusFilter, runRequest]);

  const openDetails = (shipment: ShipmentRow) => {
    setSelectedShipment(shipment);
  };

  const closeDetails = () => {
    setSelectedShipment(null);
  };

  const handleEditFromModal = () => {
    if (!selectedShipment) {
      return;
    }

    onEditShipment(selectedShipment);
    closeDetails();
  };

  return (
    <section className="shipments-view">
      <div className="shipments-toolbar">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Manage shipments</h2>
          <p>Pick a row to edit without exposing internal IDs in the UI.</p>
        </div>
        <label className="field field-inline">
          Filter by status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="preparing">Preparing</option>
            <option value="in_transit">In transit</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
      </div>
      {isLoading ? (
        <p className="empty-state">Loading shipments...</p>
      ) : shipments.length > 0 ? (
        <div className="shipments-shell">
          <table className="data-table shipments-table">
            <thead>
              <tr>
                <th>Tracking Number</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Updated</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.shipment_id}>
                  <td>{shipment.tracking_number}</td>
                  <td>{shipment.status_}</td>
                  <td>{shipment.customer_name}</td>
                  <td>
                    {new Date(shipment.updatedAt || 0).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-details"
                      onClick={() => openDetails(shipment)}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No shipments found.</p>
      )}

      {selectedShipment && (
        <div
          className="details-modal-backdrop"
          role="presentation"
          onClick={closeDetails}
        >
          <div
            className="details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipment-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="details-modal-header">
              <div>
                <p className="eyebrow">Shipment details</p>
                <h3 id="shipment-details-title">
                  {selectedShipment.tracking_number}
                </h3>
              </div>
              <button
                type="button"
                className="details-close-btn"
                onClick={closeDetails}
              >
                Close
              </button>
            </div>

            <div className="details-grid">
              <div>
                <span>Status</span>
                <strong>{selectedShipment.status_}</strong>
              </div>
              <div>
                <span>Current Location</span>
                <strong>{selectedShipment.current_location || "N/A"}</strong>
              </div>
              <div>
                <span>Origin</span>
                <strong>{selectedShipment.origin || "N/A"}</strong>
              </div>
              <div>
                <span>Destination</span>
                <strong>{selectedShipment.destination || "N/A"}</strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{selectedShipment.customer_name || "N/A"}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>
                  {new Date(
                    selectedShipment.updatedAt || 0,
                  ).toLocaleDateString()}
                </strong>
              </div>
            </div>

            <div className="details-modal-actions">
              <button
                type="button"
                className="btn-details"
                onClick={handleEditFromModal}
              >
                Edit shipment
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ShipmentsView;
