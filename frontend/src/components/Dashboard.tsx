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

const Dashboard = ({ apiBase, authToken, setAuthToken }: DashboardProps) => {
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [currentView, setCurrentView] = useState('track');
  const [trackedShipment, setTrackedShipment] = useState<any>({ shipment: null, history: [] });
  const [trackingStatus, setTrackingStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
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
      label: string
    ): Promise<unknown> => {
      setIsLoading(true);
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
              ? (parsed as { data?: unknown }).data ?? parsed
              : parsed;
        } catch {
          payload = text;
        }
        setResponse({ label, status: res.status, payload });
        return payload;
      } catch (error) {
        setResponse({
          label,
          error: error instanceof Error ? error.message : "Request failed.",
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBase, authToken]
  );

  const handleTracking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTrackingStatus('loading');
    const data = await runRequest(
      `/shipments/tracking/${encodeURIComponent(trackingNumber)}`,
      { method: "GET" },
      "Track shipment"
    );
    if (data && typeof data === 'object' && 'shipment' in data && data.shipment) {
      setTrackedShipment(data);
      setTrackingStatus('found');
    } else {
      setTrackedShipment({ shipment: null, history: [] });
      setTrackingStatus('not_found');
    }
  };

  const handleLogout = () => {
    setAuthToken("");
    localStorage.removeItem("authToken");
    navigate("/");
  };

  if (!role) return <div>Loading...</div>;

  const renderMainContent = () => {
    switch (currentView) {
      case 'track':
        return (
          <div className="track-content">
            <HeroSection
              key={`track-${trackingNumber}-${Date.now()}`}
              trackingNumber={trackingNumber}
              setTrackingNumber={setTrackingNumber}
              onTrack={handleTracking}
              trackedShipment={trackedShipment}
              trackingStatus={trackingStatus}
            />

            {(trackingStatus === 'found' || trackingStatus === 'loading' || trackingStatus === 'not_found') && (
              <div className="tracking-results-section">
                <div className="tracking-results-card">
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
                <Illustration type="drone" className="tracking-drone" size="large" />
              </div>
            )}
          </div>
        );
      case 'order':
        return <SampleOrderSection apiBase={apiBase} authToken={authToken} runRequest={runRequest} />;
      case 'update':
        return <ShipmentUpdateSection apiBase={apiBase} authToken={authToken} runRequest={runRequest} />;
      case 'createUser':
        return <AdminSection apiBase={apiBase} authToken={authToken} runRequest={runRequest} />;
      case 'users':
        return <UsersView runRequest={runRequest} />;
      case 'shipments':
        return <ShipmentsView runRequest={runRequest} />;
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
            <UserDropdown userName={userName || 'User'} onLogout={handleLogout} />
          </div>
        </header>
       <div className="dashboard-content">
         <Sidebar role={role} currentView={currentView} setCurrentView={setCurrentView} />
         <main>
           {renderMainContent()}
         </main>
       </div>
       <Footer />
     </div>
   );
};

export default Dashboard;