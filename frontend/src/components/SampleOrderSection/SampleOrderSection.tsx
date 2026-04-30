import { useState, useRef } from "react";
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState("saving");
    setSaveMessage(null);

    const result = await runRequest(
      "/orders/sample",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, origin: origin || undefined }),
      },
      "Sample order",
    );

    const wasError =
      result &&
      typeof result === "object" &&
      "status" in result &&
      typeof (result as { status?: unknown }).status === "number" &&
      (result as { status: number }).status >= 400;

    if (!wasError) {
      setSaveState("saved");
      setSaveMessage("Sample order created successfully.");
      setDestination("");
      setOrigin("");

      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
      }

      resetTimer.current = window.setTimeout(() => {
        setSaveState("idle");
        setSaveMessage(null);
      }, 2000);
    } else {
      setSaveState("idle");
    }
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
        <button
          type="submit"
          className={`sample-order-button ${saveState === "saved" ? "is-success" : ""}`}
          disabled={saveState === "saving"}
        >
          {saveState === "saving"
            ? "Creating..."
            : saveState === "saved"
              ? "Created"
              : "Create Sample Order"}
        </button>
        {saveMessage && (
          <div className="sample-order-feedback" aria-live="polite">
            {saveMessage}
          </div>
        )}
      </form>
    </section>
  );
};

export default SampleOrderSection;
