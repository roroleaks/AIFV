import { useCallback, useEffect, useState } from "react";

import type { AssessmentDraft, CycleRecord, FieldValue } from "./use-assessment";
import { ageFromDob } from "./schema";
import { buildAlerts, computeTotals } from "./derived";

const KEY = "ivf-ai-calc:patients:v1";

export interface PatientRecord {
  id: string;
  name: string;
  fileNumber: string;
  age: string;
  partnerAge: string;
  infertilityType: string;
  causes: string[];
  cycles: number;
  completion: number;
  alerts: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  values: Record<string, FieldValue>;
  cycleRecords: CycleRecord[];
}

import { DEFAULT_VIRTUAL_PATIENTS } from "./virtual-patients-data";

const read = (): PatientRecord[] => {
  if (typeof window === "undefined") return DEFAULT_VIRTUAL_PATIENTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      write(DEFAULT_VIRTUAL_PATIENTS);
      return DEFAULT_VIRTUAL_PATIENTS;
    }
    const parsed = JSON.parse(raw) as PatientRecord[];
    return parsed.length > 0 ? parsed : DEFAULT_VIRTUAL_PATIENTS;
  } catch {
    return DEFAULT_VIRTUAL_PATIENTS;
  }
};

/** Live subscribers — every page that renders patient data stays in sync. */
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((fn) => fn());
};

export function subscribePatients(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const write = (records: PatientRecord[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable */
  }
  notify();
};

export const readPatients = read;

export function recordFromDraft(draft: AssessmentDraft, completion: number): PatientRecord {
  const v = draft.values;
  const str = (k: string) => (v[k] === undefined ? "" : String(v[k]));
  const totals = computeTotals(v, draft.cycles);
  const now = new Date().toISOString();
  return {
    id: str("fileNumber") || `pt-${Date.now()}`,
    name: str("fullName") || "Unnamed patient",
    fileNumber: str("fileNumber"),
    age: ageFromDob(v["dob"]),
    partnerAge: str("partnerAge"),
    infertilityType: str("infertilityType"),
    causes: Array.isArray(v["causes"]) ? (v["causes"] as string[]) : [],
    cycles: totals.totalCycles,
    completion,
    alerts: buildAlerts(v, draft.cycles).length,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    values: v,
    cycleRecords: draft.cycles,
  };
}

export function savePatient(record: PatientRecord) {
  const records = read();
  const existing = records.findIndex((r) => r.id === record.id);
  if (existing >= 0) {
    const prev = records[existing]!;
    records[existing] = { ...record, pinned: prev.pinned, createdAt: prev.createdAt };
  } else {
    records.unshift(record);
  }
  write(records);
  return records;
}

/**
 * Keep an already-saved patient record identical to the live assessment draft.
 *
 * Only updates a record that already exists — it never creates one — so the
 * physician still decides when a draft becomes a patient record, but once it
 * is saved every later edit (including previous-cycle values such as retrieved
 * oocytes) propagates to every engine that reads the record.
 */
export function syncPatientFromDraft(
  draft: AssessmentDraft,
  completion: number,
): PatientRecord | null {
  if (typeof window === "undefined") return null;
  const next = recordFromDraft(draft, completion);
  const records = read();
  const index = records.findIndex((r) => r.id === next.id);
  if (index < 0) return null;
  const prev = records[index]!;
  const merged: PatientRecord = { ...next, pinned: prev.pinned, createdAt: prev.createdAt };
  if (JSON.stringify({ ...prev, updatedAt: "" }) === JSON.stringify({ ...merged, updatedAt: "" })) {
    return prev;
  }
  records[index] = merged;
  write(records);
  return merged;
}

export function usePatients() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setRecords(read());
    refresh();
    setHydrated(true);
    const unsubscribe = subscribePatients(refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((next: PatientRecord[]) => {
    setRecords(next);
    write(next);
  }, []);

  const togglePin = useCallback(
    (id: string) => update(read().map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r))),
    [update],
  );

  const remove = useCallback((id: string) => update(read().filter((r) => r.id !== id)), [update]);

  return { records, hydrated, togglePin, remove };
}
