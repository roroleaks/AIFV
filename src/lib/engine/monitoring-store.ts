/**
 * Stored stimulation monitoring visits.
 *
 * Per-patient persistence of the monitoring timeline so the OHSS Risk,
 * Trigger Strategy, Freeze-All and Final Report modules can read it.
 * Storage only — no clinical logic here.
 */

import { useCallback, useEffect, useState } from "react";

import { normalizeVisit, type MonitoringVisit } from "./monitoring";

const KEY = "ivf-ai-calc.monitoring-visits";
const EVENT = "ivf-monitoring-changed";

type Store = Record<string, MonitoringVisit[]>;

import { DEFAULT_VIRTUAL_MONITORING } from "../assessment/virtual-patients-data";

function read(): Store {
  if (typeof window === "undefined") return DEFAULT_VIRTUAL_MONITORING;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      write(DEFAULT_VIRTUAL_MONITORING);
      return DEFAULT_VIRTUAL_MONITORING;
    }
    const parsed = JSON.parse(raw) as Store;
    // Repair records written by earlier builds so a missing field can never
    // crash the monitoring, trigger or report chain.
    return Object.fromEntries(
      Object.entries({ ...DEFAULT_VIRTUAL_MONITORING, ...parsed }).map(([id, list]) => [
        id,
        (Array.isArray(list) ? list : []).map(normalizeVisit),
      ]),
    );
  } catch {
    return DEFAULT_VIRTUAL_MONITORING;
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

/** Latest stored monitoring timeline for a patient — the downstream read path. */
export function getMonitoringVisits(patientId: string): MonitoringVisit[] {
  return read()[patientId] ?? [];
}

export function useMonitoringVisits(patientId: string) {
  const [visits, setVisits] = useState<MonitoringVisit[]>([]);

  useEffect(() => {
    const sync = () => setVisits(read()[patientId] ?? []);
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [patientId]);

  const save = useCallback(
    (visit: MonitoringVisit) => {
      const store = read();
      const list = store[patientId] ?? [];
      const index = list.findIndex((v) => v.id === visit.id);
      const next = index >= 0 ? list.map((v) => (v.id === visit.id ? visit : v)) : [...list, visit];
      next.sort((a, b) => a.day - b.day);
      write({ ...store, [patientId]: next });
    },
    [patientId],
  );

  const remove = useCallback(
    (id: string) => {
      const store = read();
      write({ ...store, [patientId]: (store[patientId] ?? []).filter((v) => v.id !== id) });
    },
    [patientId],
  );

  const clear = useCallback(() => {
    const store = read();
    write({ ...store, [patientId]: [] });
  }, [patientId]);

  return { visits, save, remove, clear };
}

export function newVisitId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
