/**
 * System settings for the calculation framework.
 * Stores module enable/disable state and database source configuration.
 */

import { useCallback, useEffect, useState } from "react";
import { engineModules } from "./registry";

export interface EngineSettings {
  /** Module ids explicitly disabled by the administrator. */
  disabled: string[];
  /** Reference database sources — descriptive configuration only. */
  databases: {
    evidenceSources: string;
    medicationDatabase: string;
    protocolDatabase: string;
    brandDatabase: string;
  };
  autoUpdateAlgorithms: boolean;
}

export const defaultEngineSettings: EngineSettings = {
  disabled: [],
  databases: {
    evidenceSources: "Internal indexed library",
    medicationDatabase: "Not configured",
    protocolDatabase: "Not configured",
    brandDatabase: "Not configured",
  },
  autoUpdateAlgorithms: true,
};

export const databaseOptions: Record<keyof EngineSettings["databases"], string[]> = {
  evidenceSources: ["Internal indexed library", "Institutional repository", "Not configured"],
  medicationDatabase: ["Not configured", "Clinic formulary", "National registry"],
  protocolDatabase: ["Not configured", "Clinic protocol set", "Guideline-derived set"],
  brandDatabase: ["Not configured", "Regional availability list"],
};

const KEY = "ivf-ai-calc.engine-settings";

function read(): EngineSettings {
  if (typeof window === "undefined") return defaultEngineSettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultEngineSettings;
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    return {
      ...defaultEngineSettings,
      ...parsed,
      databases: { ...defaultEngineSettings.databases, ...(parsed.databases ?? {}) },
      disabled: parsed.disabled ?? [],
    };
  } catch {
    return defaultEngineSettings;
  }
}

export function useEngineSettings() {
  const [settings, setSettings] = useState<EngineSettings>(defaultEngineSettings);

  useEffect(() => {
    setSettings(read());
  }, []);

  const persist = useCallback((next: EngineSettings) => {
    setSettings(next);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const toggleModule = useCallback(
    (id: string, enabled: boolean) => {
      const current = read();
      const disabled = enabled
        ? current.disabled.filter((m) => m !== id)
        : Array.from(new Set([...current.disabled, id]));
      persist({ ...current, disabled });
    },
    [persist],
  );

  const setDatabase = useCallback(
    (key: keyof EngineSettings["databases"], value: string) => {
      const current = read();
      persist({ ...current, databases: { ...current.databases, [key]: value } });
    },
    [persist],
  );

  const setAutoUpdate = useCallback(
    (value: boolean) => persist({ ...read(), autoUpdateAlgorithms: value }),
    [persist],
  );

  const isEnabled = useCallback((id: string) => !settings.disabled.includes(id), [settings]);

  return {
    settings,
    toggleModule,
    setDatabase,
    setAutoUpdate,
    isEnabled,
    enabledCount: engineModules.length - settings.disabled.length,
  };
}
