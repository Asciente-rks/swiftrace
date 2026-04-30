import { useTheme } from "../contexts/useTheme";
import lightLogo from "../assets/Logo_LightMode.jpg";
import darkLogo from "../assets/Logo_DarkMode.jpg";
import "./Logo.css";

interface LogoProps {
  className?: string;
  size?: "small" | "medium" | "large";
}

export const Logo = ({ className = "", size = "medium" }: LogoProps) => {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? darkLogo : lightLogo;

  const sizeClasses = {
    small: "logo-small",
    medium: "logo-medium",
    large: "logo-large",
  };

  return (
    <img
      src={logoSrc}
      alt="Swiftrace Logo"
      className={`logo ${sizeClasses[size]} ${className}`}
    />
  );
};
