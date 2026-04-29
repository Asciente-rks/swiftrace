import type { FormEvent } from "react";
import "./HeroSection.css";

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
      <h1>Track the sample order journey in minutes, not hours.</h1>
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

    </div>
  </section>
);

export default HeroSection;
