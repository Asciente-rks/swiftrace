import { useState, useEffect } from "react";

type ShipmentsViewProps = {
  runRequest: (path: string, options: RequestInit, label: string) => Promise<unknown>;
};

const ShipmentsView = ({ runRequest }: ShipmentsViewProps) => {
  const [shipments, setShipments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('in_transit');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadShipments = async () => {
      setIsLoading(true);
      const data = await runRequest(`/shipments/status/${statusFilter}`, { method: 'GET' }, 'Get shipments');
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { data?: unknown } | null)?.data)
          ? ((data as { data: any[] }).data)
          : [];
      setShipments(list);
      setIsLoading(false);
    };
    loadShipments();
  }, [statusFilter, runRequest]);

  return (
    <section className="shipments-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Manage Shipments</h2>
        </div>
        <label className="field field-inline">
          Filter by status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Tracking Number</th>
              <th>Status</th>
              <th>Current Location</th>
              <th>Origin</th>
              <th>Destination</th>
              <th>Customer</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(shipment => (
              <tr key={shipment.shipment_id}>
                <td>{shipment.tracking_number}</td>
                <td>{shipment.status_}</td>
                <td>{shipment.current_location || 'N/A'}</td>
                <td>{shipment.origin}</td>
                <td>{shipment.destination}</td>
                <td>{shipment.customer_name}</td>
                <td>{new Date(shipment.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No shipments found.</p>
      )}
    </section>
  );
};

export default ShipmentsView;