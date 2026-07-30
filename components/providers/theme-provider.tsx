"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const STORAGE_KEY = "saintagram-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === "light" || stored === "dark" ? stored : systemTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        const nextTheme = event.matches ? "dark" : "light";
        setTheme(nextTheme);
        document.documentElement.dataset.theme = nextTheme;
      }
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      return nextTheme;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
