import { useState } from "react";
import "./DevTools.css";

type DevToolsProps = {
  runRequest: (
    path: string,
    options: RequestInit,
    label: string,
  ) => Promise<unknown>;
};

const DevTools = ({ runRequest }: DevToolsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm("Reset database to seeded state?")) return;
    setIsResetting(true);
    try {
      await runRequest("/dev/clear", { method: "POST" }, "Reset database");
      alert("Database reset successfully");
    } catch {
      alert("Error resetting database");
    } finally {
      setIsResetting(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        className="dev-tools-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Dev Tools"
        aria-label="Developer Tools"
      >
        ⚙️
      </button>

      {isOpen && (
        <div
          className="dev-tools-popover"
          role="dialog"
          aria-modal="true"
          aria-label="Developer Tools"
        >
          <button
            className="dev-tools-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close Dev Tools"
          >
            ✕
          </button>
          <h3>Dev Tools</h3>
          <button
            className="dev-reset-btn"
            onClick={handleReset}
            disabled={isResetting}
          >
            {isResetting ? "Resetting..." : "Reset Database"}
          </button>
        </div>
      )}

      {isOpen && (
        <div className="dev-tools-backdrop" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
};

export default DevTools;
