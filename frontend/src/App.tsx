import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage/LoginPage";
import Dashboard from "./components/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

// Lambda Function URL provisioned by .github/workflows/deploy-backend.yml.
// Used as a fallback so the live deployment keeps working even if the Vercel
// `VITE_API_BASE` env var is missing or still points at the legacy
// Serverless / API Gateway URL that was decommissioned in the May 2026 migration.
const FALLBACK_API_BASE =
  "https://ysdiyhemhgtyj667jwnkv3zusi0ewzvu.lambda-url.ap-southeast-1.on.aws";

const RAW_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// If the configured base still points at the old API Gateway host
// (execute-api.*.amazonaws.com), ignore it — that endpoint no longer exists.
const DEFAULT_BASE =
  RAW_BASE && !/execute-api\.[a-z0-9-]+\.amazonaws\.com/.test(RAW_BASE)
    ? RAW_BASE
    : FALLBACK_API_BASE;

function App() {
  const [apiBase] = useState(DEFAULT_BASE);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("authToken") || "");

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route
            path="/"
            element={
              <LoginPage apiBase={apiBase} setAuthToken={setAuthToken} />
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={!!authToken}>
                <Dashboard
                  apiBase={apiBase}
                  authToken={authToken}
                  setAuthToken={setAuthToken}
                />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
