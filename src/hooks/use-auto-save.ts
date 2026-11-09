import { useEffect, useRef, useCallback } from "react";

export interface UseAutoSaveOptions {
  onSave: () => void | Promise<void>;
  intervalMs?: number; // Maximum interval between auto-saves (default 30,000ms / 30 seconds)
  enabled?: boolean;
}

/**
 * Hospital-Grade Auto-Save Hook
 *
 * Requirements:
 *  - Calls onSave() at most every 30 seconds while forms are active.
 *  - Immediately triggers onSave() when document.visibilityState === "hidden"
 *    (e.g., clinician switches tabs, minimizes window, or navigates away).
 */
export function useAutoSave({ onSave, intervalMs = 30000, enabled = true }: UseAutoSaveOptions) {
  const lastSaveTimeRef = useRef<number>(Date.now());
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const triggerSave = useCallback(() => {
    if (!enabled) return;
    lastSaveTimeRef.current = Date.now();
    try {
      void onSaveRef.current();
    } catch (err) {
      console.warn("[AutoSave] Error during auto-save execution:", err);
    }
  }, [enabled]);

  // Periodic interval: calls onSave() at most every 30 seconds
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastSaveTimeRef.current >= intervalMs) {
        triggerSave();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, enabled, triggerSave]);

  // Visibility change listener: immediately saves when user leaves or minimizes tab
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerSave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, triggerSave]);

  return { triggerSave, lastSavedAt: lastSaveTimeRef.current };
}
