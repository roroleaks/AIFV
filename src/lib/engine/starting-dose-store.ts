/**
 * Physician starting-dose decision store.
 *
 * Every dose recorded here is entered by the treating physician and is
 * always labelled PHYSICIAN-SELECTED. The application never writes a dose,
 * never suggests a default, and never derives a value from CONSORT, from a
 * historical dose or from any other engine.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "ivf-ai-calc.starting-dose-decision";
const AUDIT_KEY = "ivf-ai-calc.starting-dose-audit";
const EVENT = "ivf-starting-dose-decision-changed";
const LIMIT = 200;
const AUDIT_LIMIT = 400;

export type StartingDoseDecisionKind =
  | "physician-selected"
  | "defer"
  | "evidence-insufficient"
  | "need-more-information";

export const startingDoseDecisionLabel: Record<StartingDoseDecisionKind, string> = {
  "physician-selected": "Physician-selected starting dose",
  defer: "Defer decision",
  "evidence-insufficient": "Insufficient evidence to select a dose",
  "need-more-information": "Need more information",
};

export const startingDoseDecisionKinds: StartingDoseDecisionKind[] = [
  "physician-selected",
  "defer",
  "evidence-insufficient",
  "need-more-information",
];

export const DOSE_UNITS = ["IU/day", "IU every other day"] as const;

export interface StartingDoseDecision {
  patientId: string;
  patientName: string;
  kind: StartingDoseDecisionKind;
  /** Dose entered by the physician, when the kind is a selection. */
  dose: number | null;
  unit: string;
  frequency: string;
  gonadotropin: string | null;
  rationale: string;
  /** Always "Physician-selected" — never an application output. */
  origin: "Physician-selected";
  patientContextVersion: string;
  engineVersion: string;
  decidedBy: string;
  decidedAt: string;
}

export interface StartingDoseAuditEntry {
  id: string;
  patientId: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
}

function readAll<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeAll<T>(key: string, entries: T[], limit: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries.slice(0, limit)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function logStartingDoseAudit(entry: Omit<StartingDoseAuditEntry, "id" | "at">) {
  const full: StartingDoseAuditEntry = {
    ...entry,
    id: `sd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  writeAll(AUDIT_KEY, [full, ...readAll<StartingDoseAuditEntry>(AUDIT_KEY)], AUDIT_LIMIT);
}

export function getStartingDoseAudit(patientId: string): StartingDoseAuditEntry[] {
  return readAll<StartingDoseAuditEntry>(AUDIT_KEY).filter((e) => e.patientId === patientId);
}

export function saveStartingDoseDecision(decision: StartingDoseDecision) {
  const rest = readAll<StartingDoseDecision>(KEY).filter((d) => d.patientId !== decision.patientId);
  writeAll(KEY, [decision, ...rest], LIMIT);
  logStartingDoseAudit({
    patientId: decision.patientId,
    action: startingDoseDecisionLabel[decision.kind],
    detail:
      decision.kind === "physician-selected" && decision.dose !== null
        ? `Physician-selected ${decision.dose} ${decision.unit} ${decision.gonadotropin ?? ""}`.trim()
        : decision.rationale || "No rationale recorded.",
    actor: decision.decidedBy,
  });
}

export function getStartingDoseDecision(patientId: string): StartingDoseDecision | null {
  return readAll<StartingDoseDecision>(KEY).find((d) => d.patientId === patientId) ?? null;
}

export function useStartingDoseDecision(patientId: string) {
  const [decision, setDecision] = useState<StartingDoseDecision | null>(null);
  const [audit, setAudit] = useState<StartingDoseAuditEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDecision(getStartingDoseDecision(patientId));
      setAudit(getStartingDoseAudit(patientId));
      setHydrated(true);
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [patientId]);

  const save = useCallback((d: StartingDoseDecision) => {
    saveStartingDoseDecision(d);
    setDecision(d);
    setAudit(getStartingDoseAudit(d.patientId));
  }, []);

  const clear = useCallback(() => {
    writeAll(
      KEY,
      readAll<StartingDoseDecision>(KEY).filter((d) => d.patientId !== patientId),
      LIMIT,
    );
    logStartingDoseAudit({
      patientId,
      action: "Starting-dose decision cleared",
      detail: "Physician cleared the recorded starting-dose decision.",
      actor: "Clinician (local session)",
    });
    setDecision(null);
    setAudit(getStartingDoseAudit(patientId));
  }, [patientId]);

  return { decision, audit, hydrated, save, clear };
}
