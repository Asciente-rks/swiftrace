import { useState, useRef } from "react";
import type { FormEvent } from "react";
import "./AdminSection.css";

type AdminSectionProps = {
  runRequest: (
    path: string,
    options: RequestInit,
    label: string,
  ) => Promise<unknown>;
};

const AdminSection = ({ runRequest }: AdminSectionProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState("saving");
    setSaveMessage(null);

    const result = await runRequest(
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
      "Create user",
    );

    const wasError =
      result &&
      typeof result === "object" &&
      "status" in result &&
      typeof (result as { status?: unknown }).status === "number" &&
      (result as { status: number }).status >= 400;

    if (!wasError) {
      setSaveState("saved");
      setSaveMessage("User created successfully.");
      setName("");
      setEmail("");
      setPassword("");
      setRole("customer");

      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => {
        setSaveState("idle");
        setSaveMessage(null);
      }, 2000);
    } else {
      setSaveState("idle");
    }
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
        <button
          type="submit"
          className={`btn-create ${saveState === "saved" ? "is-success" : ""}`}
          disabled={saveState === "saving"}
        >
          {saveState === "saving"
            ? "Creating..."
            : saveState === "saved"
              ? "Created"
              : "Create User"}
        </button>
        {saveMessage && (
          <div className="admin-save-feedback" aria-live="polite">
            {saveMessage}
          </div>
        )}
      </form>
    </section>
  );
};

export default AdminSection;
