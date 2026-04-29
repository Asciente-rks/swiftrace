import { useState } from "react";
import type { FormEvent } from "react";
import "./AdminSection.css";

type AdminSectionProps = {
  apiBase: string;
  authToken: string;
  runRequest: (path: string, options: RequestInit, label: string) => Promise<unknown>;
};

const AdminSection = ({ apiBase, authToken, runRequest }: AdminSectionProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runRequest(
      "/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          verification_status: "verified",
        }),
      },
      "Create user"
    );
  };

  return (
    <section className="admin-section">
      <h2>Admin Panel</h2>
      <p>Create new users and manage the system.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@swiftrace.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password"
            required
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="customer">Customer</option>
            <option value="shipper">Shipper</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit">Create User</button>
      </form>
    </section>
  );
};

export default AdminSection;