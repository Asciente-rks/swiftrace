import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import Sidebar from "./Sidebar/Sidebar";
import HeroSection from "./HeroSection/HeroSection";

import SampleOrderSection from "./SampleOrderSection/SampleOrderSection";
import { ShipmentUpdateSection } from "./ShipmentUpdateSection/ShipmentUpdateSection";
import AdminSection from "./AdminSection/AdminSection";
import UsersView from "./UsersView/UsersView";
import ShipmentsView from "./ShipmentsView";
import DevTools from "./DevTools";
import Footer from "./Footer";
import { Illustration } from "./Illustration";
import { Logo } from "./Logo";
import { UserDropdown } from "./UserDropdown";
import { getRoleFromToken, getUserNameFromToken } from "../utils/auth";
import type { ApiResponse } from "../types/api";

type DashboardProps = {
  apiBase: string;
  authToken: string;
  setAuthToken: (token: string) => void;
};

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

type HistoryItem = {
  historyType?: string;
  status?: string;
  historyAt?: string;
  verifiedAt?: string;
  timestamp?: string | number;
  location?: string;
  current_location?: string;
};

type TrackedShipment = {
  shipment: ShipmentDraft | null;
  history: HistoryItem[];
};

const Dashboard = ({ apiBase, authToken, setAuthToken }: DashboardProps) => {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [currentView, setCurrentView] = useState("track");
  const [trackedShipment, setTrackedShipment] = useState<TrackedShipment>({
    shipment: null,
    history: [],
  });
  const [selectedShipment, setSelectedShipment] =
    useState<ShipmentDraft | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<
    "idle" | "loading" | "found" | "not_found"
  >("idle");
  const navigate = useNavigate();

  const role = useMemo(() => getRoleFromToken(authToken), [authToken]);
  const userName = useMemo(() => getUserNameFromToken(authToken), [authToken]);

  useEffect(() => {
    if (!authToken) {
      navigate("/");
    }
  }, [authToken, navigate]);

  const runRequest = useCallback(
    async (
      path: string,
      options: RequestInit,
      label: string,
    ): Promise<unknown> => {
      try {
        const res = await fetch(`${apiBase}${path}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${authToken}`,
          },
        });
        const text = await res.text();
        let payload: unknown = text;
        try {
          const parsed = text ? JSON.parse(text) : null;
          payload =
            parsed && typeof parsed === "object" && "data" in parsed
              ? ((parsed as { data?: unknown }).data ?? parsed)
              : parsed;
        } catch {
          payload = text;
        }
        return payload;
      } catch {
        return null;
      }
    },
    [apiBase, authToken],
  );

  const handleTracking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTrackingStatus("loading");
    const data = await runRequest(
      `/shipments/tracking/${encodeURIComponent(trackingNumber)}`,
      { method: "GET" },
      "Track shipment",
    );
    if (
      data &&
      typeof data === "object" &&
      "shipment" in data &&
      data.shipment
    ) {
      setTrackedShipment({
        shipment: (data as { shipment?: ShipmentDraft }).shipment || null,
        history: (data as { history?: HistoryItem[] }).history || [],
      });
      setTrackingStatus("found");
    } else {
      setTrackedShipment({ shipment: null, history: [] });
      setTrackingStatus("not_found");
    }
  };

  const handleLogout = () => {
    setAuthToken("");
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const handleEditShipment = (shipment: ShipmentDraft) => {
    setSelectedShipment(shipment);
    setCurrentView("update");
  };

  if (!role) return <div>Loading...</div>;

  const renderMainContent = () => {
    switch (currentView) {
      case "track":
        return (
          <div className="track-content">
            <HeroSection
              key={`track-${trackingNumber}`}
              trackingNumber={trackingNumber}
              setTrackingNumber={setTrackingNumber}
              onTrack={handleTracking}
            />

            {(trackingStatus === "found" ||
              trackingStatus === "loading" ||
              trackingStatus === "not_found") && (
              <div className="tracking-results-section">
                <div className="tracking-results-card">
                  <h3>Tracking Results</h3>
                  {trackingStatus === "loading" && (
                    <p>Searching for shipment...</p>
                  )}
                  {trackingStatus === "found" &&
                    trackedShipment &&
                    trackedShipment.shipment && (
                      <>
                        <div className="status-grid">
                          <div>
                            <span>Status</span>
                            <strong>
                              {trackedShipment.shipment.status_ || "N/A"}
                            </strong>
                          </div>
                          <div>
                            <span>Current Location</span>
                            <strong>
                              {trackedShipment.shipment.current_location ||
                                "N/A"}
                            </strong>
                          </div>
                          <div>
                            <span>Origin</span>
                            <strong>
                              {trackedShipment.shipment.origin || "N/A"}
                            </strong>
                          </div>
                          <div>
                            <span>Destination</span>
                            <strong>
                              {trackedShipment.shipment.destination || "N/A"}
                            </strong>
                          </div>
                          <div>
                            <span>Customer</span>
                            <strong>
                              {trackedShipment.shipment.customer_name || "N/A"}
                            </strong>
                          </div>
                          <div>
                            <span>Tracking Number</span>
                            <strong>
                              {trackedShipment.shipment.tracking_number ||
                                "N/A"}
                            </strong>
                          </div>
                        </div>
                        {Array.isArray(trackedShipment.history) &&
                          trackedShipment.history.length > 0 && (
                            <div className="tracking-history">
                              <h4>Shipment History</h4>
                              <ul>
                                {trackedShipment.history.map(
                                  (item: HistoryItem, index: number) => (
                                    <li key={index}>
                                      <strong>
                                        {item.historyType || "Unknown"}
                                      </strong>{" "}
                                      - {item.status || "N/A"} at{" "}
                                      {item.current_location || "N/A"} (
                                      {item.historyAt ||
                                      item.verifiedAt ||
                                      item.timestamp
                                        ? new Date(
                                            item.historyAt ||
                                              item.verifiedAt ||
                                              item.timestamp ||
                                              0,
                                          ).toLocaleString()
                                        : "N/A"}
                                      )
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </>
                    )}
                  {trackingStatus === "found" &&
                    (!trackedShipment || !trackedShipment.shipment) && (
                      <div className="tracking-details-card error">
                        <h3>Shipment Not Found</h3>
                        <p>Invalid shipment data received.</p>
                      </div>
                    )}
                  {trackingStatus === "not_found" && (
                    <p>Shipment not found. Please check the tracking number.</p>
                  )}
                </div>
                <Illustration
                  type="drone"
                  className="tracking-drone"
                  size="large"
                />
              </div>
            )}
          </div>
        );
      case "order":
        return <SampleOrderSection runRequest={runRequest} />;
      case "update":
        return (
          <ShipmentUpdateSection
            role={(role as "admin" | "shipper") || "shipper"}
            runRequest={runRequest}
            initialShipment={selectedShipment}
          />
        );
      case "createUser":
        return <AdminSection runRequest={runRequest} />;
      case "users":
        return <UsersView runRequest={runRequest} />;
      case "shipments":
        return (
          <ShipmentsView
            runRequest={runRequest}
            onEditShipment={handleEditShipment}
          />
        );
      default:
        return <div>Select a view</div>;
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <Logo className="dashboard-logo" size="small" />
          <h1>Swiftrace Dashboard</h1>
        </div>
        <div className="header-right">
          <UserDropdown userName={userName || "User"} onLogout={handleLogout} />
        </div>
      </header>
      <div className="dashboard-content">
        <Sidebar
          role={role}
          currentView={currentView}
          setCurrentView={setCurrentView}
        />
        <main>{renderMainContent()}</main>
      </div>
      <Footer />
      <DevTools runRequest={runRequest} />
    </div>
  );
};

export default Dashboard;
