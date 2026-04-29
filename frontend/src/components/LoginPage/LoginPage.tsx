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

const LoginPage = ({ apiBase, setAuthToken }: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.data?.token) {
        setAuthToken(data.data.token);
        localStorage.setItem("authToken", data.data.token);
        navigate("/dashboard");
      } else {
        setError(data.message || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
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
      <Illustration type="robot" className="login-illustration" size="large" />
    </div>
  </div>
  );
};

export default LoginPage;