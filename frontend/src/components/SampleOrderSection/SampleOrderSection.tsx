import { useState } from "react";
import type { FormEvent } from "react";
import "./SampleOrderSection.css";

type SampleOrderSectionProps = {
  runRequest: (
    path: string,
    options: RequestInit,
    label: string,
  ) => Promise<unknown>;
};

const SampleOrderSection = ({ runRequest }: SampleOrderSectionProps) => {
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runRequest(
      "/orders/sample",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, origin: origin || undefined }),
      },
      "Sample order",
    );
  };

  return (
    <section className="sample-order">
      <h2>Place Sample Order</h2>
      <p>Order a sample shipment to generate a tracking number.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Destination
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Manila, PH"
            required
          />
        </label>
        <label>
          Origin (optional)
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Warehouse"
          />
        </label>
        <button type="submit">Create Sample Order</button>
      </form>
    </section>
  );
};

export default SampleOrderSection;
