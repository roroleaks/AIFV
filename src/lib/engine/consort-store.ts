/**
 * Stored CONSORT starting-dose calculations.
 *
 * Persists the latest calculation per patient so the Dose Adjustment Engine,
 * the Trigger Strategy Engine and the Final Clinical Report can consume the
 * dose without recomputing it. Storage only — no clinical logic here.
 */

import { useCallback, useEffect, useState } from "react";

import { CONSORT_CALCULATOR_VERSION, type ConsortResult, type ConsortStatus } from "./consort-dose";

const KEY = "ivf-ai-calc.consort-dose";
const EVENT = "ivf-consort-dose-changed";
const LIMIT = 100;

export interface StoredConsortDose {
  id: string;
  patientId: string;
  patientName: string;
  status: ConsortStatus;
  dose: number | null;
  medication: string;
  variablesUsed: { label: string; value: string }[];
  missingCount: number;
  calculatedAt: string;
  version: string;
}

function read(): StoredConsortDose[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredConsortDose[]) : [];
  } catch {
    return [];
  }
}

function write(entries: StoredConsortDose[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function saveConsortDose(result: ConsortResult): StoredConsortDose {
  const entry: StoredConsortDose = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId: result.patientId,
    patientName: result.patientName,
    status: result.status,
    dose: result.dose,
    medication: result.medication,
    variablesUsed: result.variables
      .filter((v) => v.usedInCalculation && v.value !== null)
      .map((v) => ({ label: v.label, value: v.display })),
    missingCount: result.validation.missing.length,
    calculatedAt: result.computedAt,
    version: CONSORT_CALCULATOR_VERSION,
  };

  const existing = read();
  const last = existing.find((e) => e.patientId === entry.patientId);
  const unchanged =
    last &&
    last.status === entry.status &&
    last.dose === entry.dose &&
    last.missingCount === entry.missingCount &&
    JSON.stringify(last.variablesUsed) === JSON.stringify(entry.variablesUsed);

  if (unchanged) return last;
  write([entry, ...existing]);
  return entry;
}

/** Latest stored dose for a patient — the read path for downstream engines. */
export function getConsortDose(patientId: string): StoredConsortDose | null {
  return read().find((e) => e.patientId === patientId) ?? null;
}

export function useConsortDoses(patientId?: string) {
  const [entries, setEntries] = useState<StoredConsortDose[]>([]);

  useEffect(() => {
    const sync = () => setEntries(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const clear = useCallback(() => write([]), []);

  return {
    entries: patientId ? entries.filter((e) => e.patientId === patientId) : entries,
    latest: patientId
      ? (entries.find((e) => e.patientId === patientId) ?? null)
      : (entries[0] ?? null),
    clear,
  };
}
