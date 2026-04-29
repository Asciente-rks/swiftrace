import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage/LoginPage";
import Dashboard from "./components/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

const DEFAULT_BASE = import.meta.env.VITE_API_BASE || "";

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
