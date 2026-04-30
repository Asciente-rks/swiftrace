import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/useTheme";
import "./UserDropdown.css";

interface UserDropdownProps {
  userName: string;
  onLogout: () => void;
}

export const UserDropdown = ({ userName, onLogout }: UserDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideDropdown =
        dropdownRef.current && dropdownRef.current.contains(target);
      const clickedInsideMenu =
        menuRef.current && menuRef.current.contains(target);
      const clickedTrigger =
        triggerRef.current && triggerRef.current.contains(target);

      if (!clickedInsideDropdown && !clickedInsideMenu && !clickedTrigger) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const top = rect.bottom + 8; // 8px gap
      const rightPx = window.innerWidth - rect.right;
      setMenuStyle({
        position: "fixed",
        top: `${top}px`,
        right: `${rightPx}px`,
        zIndex: 99999,
      });
    } else {
      setMenuStyle(null);
    }
  }, [isOpen]);

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button
        ref={triggerRef}
        className="user-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        <span>Welcome {userName}</span>
        <svg
          className={`dropdown-arrow ${isOpen ? "open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen &&
        createPortal(
          <div
            className="user-dropdown-menu portal"
            style={menuStyle ?? undefined}
            ref={menuRef}
          >
            <button
              type="button"
              className="dropdown-item theme-toggle-action"
              onClick={() => toggleTheme()}
              aria-pressed={theme === "dark"}
            >
              <span>Theme</span>
              <span className="theme-icon">
                {theme === "light" ? "🌙" : "☀️"}
              </span>
            </button>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item logout-btn" onClick={onLogout}>
              <span>Logout</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};
