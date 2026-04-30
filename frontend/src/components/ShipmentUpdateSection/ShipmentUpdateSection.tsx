import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./ShipmentUpdateSection.css";

type ShipmentDraft = {
  shipment_id: string;
  tracking_number?: string;
  status_: string;
  current_location?: string;
  customer_id?: string;
  customer_name?: string;
  product_name?: string;
  origin?: string;
  destination?: string;
};

type UserRole = "admin" | "shipper";

type ShipmentUpdateSectionProps = {
  role: UserRole;
  runRequest: (
    path: string,
    options: RequestInit,
    label: string,
  ) => Promise<unknown>;
  initialShipment?: ShipmentDraft | null;
};

const ShipmentUpdateSection = ({
  role,
  runRequest,
  initialShipment,
}: ShipmentUpdateSectionProps) => {
  const [shipmentId, setShipmentId] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [productName, setProductName] = useState("sample");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!initialShipment) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShipmentId(initialShipment.shipment_id);
    setStatus(initialShipment.status_ || "");
    setLocation(initialShipment.current_location || "");
    setCustomerName(initialShipment.customer_name || "");
    setProductName(initialShipment.product_name || "sample");
    setOrigin(initialShipment.origin || "");
    setDestination(initialShipment.destination || "");
  }, [initialShipment]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const isAdmin = role === "admin";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState("saving");
    setSaveMessage(null);

    const body = isAdmin
      ? {
          customer_name: customerName || undefined,
          product_name: productName || undefined,
          origin: origin || undefined,
          destination: destination || undefined,
          status_: status,
          current_location: location,
        }
      : {
          status_: status,
          current_location: location,
        };

    const result = await runRequest(
      `/shipments/${encodeURIComponent(shipmentId || "")}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      isAdmin ? "Admin update shipment" : "Update shipment",
    );

    const wasError =
      result &&
      typeof result === "object" &&
      "status" in result &&
      "message" in result &&
      typeof (result as { status?: unknown }).status === "number" &&
      (result as { status: number }).status >= 400;

    if (!wasError) {
      setSaveState("saved");
      setSaveMessage("Shipment saved successfully.");
      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => {
        setSaveState("idle");
        setSaveMessage(null);
      }, 1800);
    } else {
      setSaveState("idle");
    }
  };

  return (
    <section className="shipment-update">
      <div className="shipment-update-hero">
        <div>
          <p className="eyebrow">
            {isAdmin ? "Admin controls" : "Shipper controls"}
          </p>
          <h2>
            {isAdmin ? "Edit shipment details" : "Update shipment progress"}
          </h2>
          <p>
            {isAdmin
              ? "Admins can adjust the shipment record beyond delivery state and location."
              : "Shippers can only change status and current location."}
          </p>
        </div>
        <div className="shipment-update-pill">
          <span>Selected shipment</span>
          <strong>
            {initialShipment?.tracking_number ||
              "Choose from the shipments list"}
          </strong>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="shipment-grid">
          {isAdmin && (
            <>
              <label>
                Customer Name
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ralph Sonio"
                />
              </label>
              <label>
                Product Name
                <select
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                >
                  <option value="sample">Sample</option>
                </select>
              </label>
              <label>
                Origin
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Warehouse"
                />
              </label>
              <label>
                Destination
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Manila"
                />
              </label>
            </>
          )}
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="" disabled>
                Select a status
              </option>
              <option value="preparing">Preparing</option>
              <option value="in_transit">In transit</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
            </select>
          </label>
          <label className="shipment-wide-field">
            Current Location
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Regional hub"
            />
          </label>
        </div>
        <input type="hidden" value={shipmentId} readOnly />
        <div className="shipment-actions">
          <button
            type="submit"
            className={`btn-update ${saveState === "saved" ? "is-success" : ""}`}
            disabled={saveState === "saving"}
          >
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved"
                : isAdmin
                  ? "Save shipment changes"
                  : "Update status"}
          </button>
          {saveMessage && (
            <div className="shipment-save-feedback" aria-live="polite">
              {saveMessage}
            </div>
          )}
        </div>
      </form>
    </section>
  );
};

export { ShipmentUpdateSection };
