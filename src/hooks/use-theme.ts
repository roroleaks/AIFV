import { useEffect, useState } from "react";
import {
  encryptedStore,
  isEncryptionInitialized,
  initializeEncryption,
} from "@/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "@/services/auth/pinConfig";

export type Theme = "light" | "dark" | "high-contrast";

const LEGACY_THEME_KEY = "user_preference_theme";
const THEME_PREFERENCE_KEY = "theme";

function applyThemeClasses(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("dark", "high-contrast");
  document.documentElement.removeAttribute("data-theme");

  if (t === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (t === "high-contrast") {
    document.documentElement.classList.add("high-contrast");
    document.documentElement.setAttribute("data-theme", "high-contrast");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        if (!isEncryptionInitialized()) {
          await initializeEncryption(DEFAULT_DEV_PIN);
        }
        // §2.4: Dedicated preferences store with legacy fallback migration
        let stored = await encryptedStore.get<Theme>("preferences", THEME_PREFERENCE_KEY);
        if (!stored) {
          stored = await encryptedStore.get<Theme>("cases", LEGACY_THEME_KEY);
          if (stored) {
            await encryptedStore.set("preferences", THEME_PREFERENCE_KEY, stored);
            await encryptedStore.delete("cases", LEGACY_THEME_KEY).catch(() => {});
          }
        }

        if (stored && mounted) {
          applyThemeClasses(stored);
          setTheme(stored);
        }
      } catch {
        /* fallback to default */
      }
    };

    loadTheme();
    return () => {
      mounted = false;
    };
  }, []);

  const applyTheme = (next: Theme) => {
    setTheme(next);
    applyThemeClasses(next);
    encryptedStore.set("preferences", THEME_PREFERENCE_KEY, next).catch(() => {});
  };

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "high-contrast" : "light";
    applyTheme(next);
  };

  return {
    theme,
    setTheme: applyTheme,
    toggle,
  };
}
