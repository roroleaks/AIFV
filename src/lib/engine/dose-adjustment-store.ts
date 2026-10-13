/**
 * Dose-change audit trail and physician decision store (per patient).
 *
 * Storage only. Nothing in this module derives, proposes or applies a dose:
 * every stored record originates either from a physician action or from an
 * evidence-supported adjustment that the physician explicitly confirmed.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "ivf-ai-calc.dose-adjustment-events";
const EVENT = "ivf-dose-adjustment-changed";

export type DoseEventOrigin = "PHYSICIAN-ENTERED" | "EVIDENCE-SUPPORTED — CONFIRMED BY PHYSICIAN";

export type PhysicianDecision = "accept" | "modify" | "decline" | "defer";

export const physicianDecisionLabel: Record<PhysicianDecision, string> = {
  accept: "Accepted",
  modify: "Modified",
  decline: "Declined",
  defer: "Deferred",
};

export interface DoseEvent {
  id: string;
  recordedAt: string;
  stimulationDay: number | null;
  medication: string;
  previousDose: number | null;
  newDose: number | null;
  reason: string;
  origin: DoseEventOrigin;
  /** Populated only when an ACTIVE validated rule produced the adjustment. */
  evidenceRuleId: string | null;
  evidenceDerivedDose: number | null;
  physicianDecision: PhysicianDecision | null;
  physicianNote: string;
  evidenceVersion: string;
  engineVersion: string;
}

type Store = Record<string, DoseEvent[]>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
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

export function getDoseEvents(patientId: string): DoseEvent[] {
  return read()[patientId] ?? [];
}

export function newDoseEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useDoseEvents(patientId: string) {
  const [events, setEvents] = useState<DoseEvent[]>([]);

  useEffect(() => {
    const sync = () => setEvents(read()[patientId] ?? []);
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [patientId]);

  const record = useCallback(
    (event: Omit<DoseEvent, "id" | "recordedAt">) => {
      const store = read();
      const list = store[patientId] ?? [];
      const next: DoseEvent = { ...event, id: newDoseEventId(), recordedAt: new Date().toISOString() };
      write({ ...store, [patientId]: [...list, next] });
    },
    [patientId],
  );

  const remove = useCallback(
    (id: string) => {
      const store = read();
      write({ ...store, [patientId]: (store[patientId] ?? []).filter((e) => e.id !== id) });
    },
    [patientId],
  );

  const clear = useCallback(() => {
    const store = read();
    write({ ...store, [patientId]: [] });
  }, [patientId]);

  return { events, record, remove, clear };
}
