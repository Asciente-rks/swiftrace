import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { Logo } from "../Logo";
import { Illustration } from "../Illustration";
import "./LoginPage.css";

type LoginPageProps = {
  apiBase: string;
  setAuthToken: (token: string) => void;
};

type TestCredential = {
  email: string;
  password: string;
  role: string;
};

const TEST_CREDENTIALS: TestCredential[] = [
  { email: "admin@swiftrace.com", password: "admin123", role: "Admin" },
  { email: "shipper@swiftrace.com", password: "shipper123", role: "Shipper" },
  { email: "customer@swiftrace.com", password: "customer123", role: "Customer" },
];

const LoginPage = ({ apiBase, setAuthToken }: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const navigate = useNavigate();

  const describeError = (status: number, fallback: string): string => {
    if (status === 401) return "Invalid email or password.";
    if (status === 429)
      return "Too many login attempts. Please wait a moment.";
    return fallback;
  };

  const performLogin = async (
    candidateEmail: string,
    candidatePassword: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: candidateEmail,
          password: candidatePassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.data?.token) {
        setAuthToken(data.data.token);
        localStorage.setItem("authToken", data.data.token);
        navigate("/dashboard");
        return;
      }

      const fallback = data?.message || "Login failed";
      setError(describeError(res.status, fallback));
    } catch {
      setError("Network error. Is the backend reachable?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await performLogin(email, password);
  };

  const handleDevQuickLogin = (cred: TestCredential) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setShowDevTools(false);
    void performLogin(cred.email, cred.password);
  };

  return (
    <div className="login-page">
      <ThemeToggle />
      <div className="login-layout">
        <div className="login-container">
          <Logo className="login-logo" size="small" />
          <h1>Swiftrace Login</h1>
          <form onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
        <Illustration
          type="robot"
          className="login-illustration"
          size="large"
        />
      </div>

      <button
        className="dev-quick-btn"
        onClick={() => setShowDevTools(!showDevTools)}
        title="Dev Tools"
        aria-label="Dev Tools"
      >
        ⚙
      </button>

      {showDevTools && (
        <div
          className="dev-quick-popover"
          role="dialog"
          aria-modal="true"
          aria-label="Dev Tools"
        >
          <button
            className="dev-quick-close"
            onClick={() => setShowDevTools(false)}
            aria-label="Close Dev Tools"
          >
            ✕
          </button>
          <div className="dev-quick-header">
            <h3>Dev Tools</h3>
            <span className="dev-quick-tag">demo</span>
          </div>
          <p className="dev-quick-help">
            Quick-login as a seeded account so portfolio reviewers don't have
            to type anything.
          </p>
          <div className="dev-quick-list">
            {TEST_CREDENTIALS.map((cred) => (
              <button
                key={cred.email}
                type="button"
                className="dev-quick-option"
                disabled={isLoading}
                onClick={() => handleDevQuickLogin(cred)}
              >
                <span className="role-label">{cred.role}</span>
                <code>{cred.email}</code>
              </button>
            ))}
          </div>
        </div>
      )}

      {showDevTools && (
        <div
          className="dev-quick-backdrop"
          onClick={() => setShowDevTools(false)}
        />
      )}
    </div>
  );
};

export default LoginPage;
