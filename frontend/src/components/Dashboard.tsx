import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import Sidebar from "./Sidebar";
import HeroSection from "./HeroSection";
import FlowSection from "./FlowSection";
import SampleOrderSection from "./SampleOrderSection";
import { ShipmentUpdateSection } from "./ShipmentUpdateSection";
import AdminSection from "./AdminSection";
import UsersView from "./UsersView";
import ShipmentsView from "./ShipmentsView";
import Footer from "./Footer";
import { getRoleFromToken } from "../utils/auth";
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

            <FlowSection />
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
         <h1>Swiftrace Dashboard</h1>
         <div>
           <span>Role: {role}</span>
           <button onClick={handleLogout}>Logout</button>
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