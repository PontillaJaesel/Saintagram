"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      role="switch"
      aria-checked={dark}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
        </span>
      </span>
      <span className="theme-toggle-label">
        {dark ? "Dark" : "Light"}
      </span>
    </button>
  );
}
