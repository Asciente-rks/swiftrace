import type { FormEvent } from "react";
import type { ApiResponse } from "../types/api";

type ConsoleSectionProps = {
  apiBase: string;
  setApiBase: (value: string) => void;
  authToken: string;
  setAuthToken: (value: string) => void;
  isLoading: boolean;
  response: ApiResponse | null;
  loginEmail: string;
  setLoginEmail: (value: string) => void;
  loginPassword: string;
  setLoginPassword: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  adminToken: string;
  setAdminToken: (value: string) => void;
  newUserName: string;
  setNewUserName: (value: string) => void;
  newUserEmail: string;
  setNewUserEmail: (value: string) => void;
  newUserPassword: string;
  setNewUserPassword: (value: string) => void;
  newUserRole: string;
  setNewUserRole: (value: string) => void;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void;
  orderDestination: string;
  setOrderDestination: (value: string) => void;
  orderOrigin: string;
  setOrderOrigin: (value: string) => void;
  orderToken: string;
  setOrderToken: (value: string) => void;
  onSampleOrder: (event: FormEvent<HTMLFormElement>) => void;
  shipmentId: string;
  setShipmentId: (value: string) => void;
  shipmentStatus: string;
  setShipmentStatus: (value: string) => void;
  shipmentLocation: string;
  setShipmentLocation: (value: string) => void;
  shipmentToken: string;
  setShipmentToken: (value: string) => void;
  onShipmentUpdate: (event: FormEvent<HTMLFormElement>) => void;
};

const ConsoleSection = ({
  apiBase,
  setApiBase,
  authToken,
  setAuthToken,
  isLoading,
  response,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  onLogin,
  adminToken,
  setAdminToken,
  newUserName,
  setNewUserName,
  newUserEmail,
  setNewUserEmail,
  newUserPassword,
  setNewUserPassword,
  newUserRole,
  setNewUserRole,
  onCreateUser,
  orderDestination,
  setOrderDestination,
  orderOrigin,
  setOrderOrigin,
  orderToken,
  setOrderToken,
  onSampleOrder,
  shipmentId,
  setShipmentId,
  shipmentStatus,
  setShipmentStatus,
  shipmentLocation,
  setShipmentLocation,
  shipmentToken,
  setShipmentToken,
  onShipmentUpdate,
}: ConsoleSectionProps) => {
  const runRequest = async (
    path: string,
    options: RequestInit,
    label: string
  ): Promise<unknown> => {
    // Placeholder, since it's admin console, assume auth is set
    return null;
  };

  return (
    <section className="console" id="console">
    <div className="section-head">
      <h2>Backend test console</h2>
      <p>Point to any API base when you are ready to test.</p>
    </div>

    <div className="console-bar">
      <label className="field">
        API base URL
        <input
          type="text"
          value={apiBase}
          onChange={(event) => setApiBase(event.target.value)}
          placeholder="http://localhost:3000"
        />
      </label>
      <div className="token-box">
        <span>Active token</span>
        <input
          type="text"
          value={authToken}
          onChange={(event) => setAuthToken(event.target.value)}
          placeholder="JWT will appear here"
        />
      </div>
    </div>

    <div className="console-grid">
      <form className="panel" onSubmit={onLogin}>
        <div className="panel-head">
          <h3>Login</h3>
          <span className="badge badge-soft">POST /auth/login</span>
        </div>
        <label className="field">
          Email
          <input
            type="email"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            placeholder="admin@swiftrace.com"
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            placeholder="Minimum 8 characters"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Sign in
        </button>
      </form>

      <form className="panel" onSubmit={onCreateUser}>
        <div className="panel-head">
          <h3>Create user</h3>
          <span className="badge badge-soft">POST /users</span>
        </div>
        <label className="field">
          Admin token
          <input
            type="text"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="Bearer token"
          />
        </label>
        <label className="field">
          Name
          <input
            type="text"
            value={newUserName}
            onChange={(event) => setNewUserName(event.target.value)}
            placeholder="Jane Doe"
          />
        </label>
        <label className="field">
          Email
          <input
            type="email"
            value={newUserEmail}
            onChange={(event) => setNewUserEmail(event.target.value)}
            placeholder="customer@swiftrace.com"
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={newUserPassword}
            onChange={(event) => setNewUserPassword(event.target.value)}
            placeholder="Temporary password"
          />
        </label>
        <label className="field">
          Role
          <select
            value={newUserRole}
            onChange={(event) => setNewUserRole(event.target.value)}
          >
            <option value="customer">Customer</option>
            <option value="shipper">Shipper</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="btn btn-outline" type="submit">
          Create account
        </button>
      </form>

      <form className="panel" onSubmit={onSampleOrder}>
        <div className="panel-head">
          <h3>Sample order</h3>
          <span className="badge badge-soft">POST /orders/sample</span>
        </div>
        <label className="field">
          Customer token
          <input
            type="text"
            value={orderToken}
            onChange={(event) => setOrderToken(event.target.value)}
            placeholder="Bearer token"
          />
        </label>
        <label className="field">
          Destination
          <input
            type="text"
            value={orderDestination}
            onChange={(event) => setOrderDestination(event.target.value)}
            placeholder="Manila, PH"
          />
        </label>
        <label className="field">
          Origin (optional)
          <input
            type="text"
            value={orderOrigin}
            onChange={(event) => setOrderOrigin(event.target.value)}
            placeholder="Warehouse"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Create sample order
        </button>
      </form>

      <form className="panel" onSubmit={onShipmentUpdate}>
        <div className="panel-head">
          <h3>Update shipment</h3>
          <span className="badge badge-soft">PUT /shipments/{"{id}"}</span>
        </div>
        <label className="field">
          Shipper token
          <input
            type="text"
            value={shipmentToken}
            onChange={(event) => setShipmentToken(event.target.value)}
            placeholder="Bearer token"
          />
        </label>
        <label className="field">
          Shipment ID
          <input
            type="text"
            value={shipmentId}
            onChange={(event) => setShipmentId(event.target.value)}
            placeholder="Shipment UUID"
          />
        </label>
        <label className="field">
          Status
          <select
            value={shipmentStatus}
            onChange={(event) => setShipmentStatus(event.target.value)}
          >
            <option value="preparing">Preparing</option>
            <option value="in_transit">In transit</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <label className="field">
          Current location
          <input
            type="text"
            value={shipmentLocation}
            onChange={(event) => setShipmentLocation(event.target.value)}
            placeholder="Regional hub"
          />
        </label>
        <button className="btn btn-outline" type="submit">
          Update status
        </button>
      </form>
    </div>

    <div className="response">
      <div>
        <h3>Response</h3>
        <span>{isLoading ? "Request in progress" : "Last payload"}</span>
      </div>
      <pre>
        {response
          ? JSON.stringify(response, null, 2)
          : "Run a request to see the response here."}
      </pre>
    </div>
  </section>
  );
};

export default ConsoleSection;
