import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "rcre-theme";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

// Apply before React renders to prevent flash
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Run immediately on module load
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme, toggle, isDark: theme === "dark" };
}
