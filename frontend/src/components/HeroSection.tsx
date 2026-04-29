import type { FormEvent } from "react";

type HeroSectionProps = {
  trackingNumber: string;
  setTrackingNumber: (value: string) => void;
  onTrack: (event: FormEvent<HTMLFormElement>) => void;
  trackedShipment: any;
  trackingStatus: 'idle' | 'loading' | 'found' | 'not_found';
};

const HeroSection = ({
  trackingNumber,
  setTrackingNumber,
  onTrack,
  trackedShipment,
  trackingStatus,
}: HeroSectionProps) => (
  <section className="hero" id="track">
    <div className="hero-copy">
      <p className="eyebrow">Simple logistics, clear ownership</p>
      <h1>Track the sample order journey in minutes, not hours.</h1>
      <p className="lead">
        Admins create accounts. Customers place one sample order to receive a
        tracking number. Shippers update status and location. Anyone can track
        with a code.
      </p>
      <div className="chip-row">
        <span>Single table DynamoDB</span>
        <span>JWT auth</span>
        <span>Email tracking</span>
      </div>
      <div className="hero-actions">
        <a className="btn btn-primary" href="#console">
          Open test console
        </a>
        <a className="btn btn-outline" href="#flow">
          See the flow
        </a>
      </div>
      <div className="metrics">
        <div>
          <h3>1 order</h3>
          <p>per customer</p>
        </div>
        <div>
          <h3>3 roles</h3>
          <p>admin, shipper, customer</p>
        </div>
        <div>
          <h3>0 guesswork</h3>
          <p>history timeline logged</p>
        </div>
      </div>
    </div>

    <div className="hero-card">
      <div className="card-header">
        <div>
          <h2>Tracking quick view</h2>
          <p>Paste a tracking code to preview shipment status.</p>
        </div>
        <span className="badge">Public</span>
      </div>
      <form className="form" onSubmit={onTrack}>
        <label className="field">
          Tracking number
            <input
              type="text"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="SW1714371629903"
              required
            />
        </label>
        <button className="btn btn-primary" type="submit">
          Find shipment
        </button>
      </form>
      <div className="tracking-result-card">
        <h3>Tracking Results</h3>
        {trackingStatus === 'loading' && <p>Searching for shipment...</p>}
        {trackingStatus === 'found' && trackedShipment && trackedShipment.shipment && (
          <>
            <div className="status-grid">
              <div>
                <span>Status</span>
                <strong>{trackedShipment.shipment.status_ || 'N/A'}</strong>
              </div>
              <div>
                <span>Current Location</span>
                <strong>{trackedShipment.shipment.current_location || 'N/A'}</strong>
              </div>
              <div>
                <span>Origin</span>
                <strong>{trackedShipment.shipment.origin || 'N/A'}</strong>
              </div>
              <div>
                <span>Destination</span>
                <strong>{trackedShipment.shipment.destination || 'N/A'}</strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{trackedShipment.shipment.customer_name || 'N/A'}</strong>
              </div>
              <div>
                <span>Tracking Number</span>
                <strong>{trackedShipment.shipment.tracking_number || 'N/A'}</strong>
              </div>
            </div>
            {Array.isArray(trackedShipment.history) && trackedShipment.history.length > 0 && (
              <div className="tracking-history">
                <h4>Shipment History</h4>
                <ul>
                  {trackedShipment.history.map((item: any, index: number) => (
                    <li key={index}>
                      <strong>{item.historyType || 'Unknown'}</strong> - {item.status || 'N/A'} at {item.current_location || 'N/A'} ({item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {trackingStatus === 'found' && (!trackedShipment || !trackedShipment.shipment) && (
          <div className="tracking-details-card error">
            <h3>Shipment Not Found</h3>
            <p>Invalid shipment data received.</p>
          </div>
        )}
        {trackingStatus === 'not_found' && <p>Shipment not found. Please check the tracking number.</p>}
      </div>
    </div>
  </section>
);

export default HeroSection;
