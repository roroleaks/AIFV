import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ivf-theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const applyTheme = (next: Theme) => {
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return {
    theme,
    setTheme: applyTheme,
    toggle: () => applyTheme(theme === "dark" ? "light" : "dark"),
  };
}
