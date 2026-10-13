/**
 * Physician trigger decision store.
 *
 * Every value here is entered by the treating physician. The application
 * never writes a trigger type, dose or timing, never suggests a default and
 * never derives a value from any engine. All entries are append-only audit
 * records held in local storage.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "ivf-ai-calc.trigger-decision";
const AUDIT_KEY = "ivf-ai-calc.trigger-audit";
const EVENT = "ivf-trigger-decision-changed";
const LIMIT = 200;
const AUDIT_LIMIT = 400;

export type TriggerDecisionKind =
  | "physician-selected"
  | "defer"
  | "continue-stimulation"
  | "evidence-insufficient"
  | "need-more-information";

export const triggerDecisionLabel: Record<TriggerDecisionKind, string> = {
  "physician-selected": "Physician-selected trigger",
  defer: "Defer trigger decision",
  "continue-stimulation": "Continue stimulation — no trigger today",
  "evidence-insufficient": "Insufficient evidence to select a trigger",
  "need-more-information": "Need more information",
};

export const triggerDecisionKinds: TriggerDecisionKind[] = [
  "physician-selected",
  "defer",
  "continue-stimulation",
  "evidence-insufficient",
  "need-more-information",
];

export function isTriggerSelection(kind: TriggerDecisionKind): boolean {
  return kind === "physician-selected";
}

export interface TriggerDecision {
  patientId: string;
  patientName: string;
  kind: TriggerDecisionKind;
  /** Free text entered by the physician; never pre-filled. */
  triggerType: string;
  medication: string;
  dose: string;
  route: string;
  plannedDateTime: string;
  plannedRetrievalDateTime: string;
  rationale: string;
  /** Always physician-entered — never an application output. */
  origin: "Physician-selected";
  monitoringDay: number | null;
  engineVersion: string;
  decidedBy: string;
  decidedAt: string;
}

export interface TriggerAuditEntry {
  id: string;
  patientId: string;
  patientName: string;
  kind: TriggerDecisionKind;
  label: string;
  summary: string;
  rationale: string;
  origin: "Physician-selected";
  monitoringDay: number | null;
  engineVersion: string;
  decidedBy: string;
  decidedAt: string;
}

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[], limit: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(list.slice(0, limit)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getTriggerDecision(patientId: string): TriggerDecision | null {
  return readList<TriggerDecision>(KEY).find((d) => d.patientId === patientId) ?? null;
}

export function triggerDecisionSummary(d: TriggerDecision | null): string {
  if (!d) return "No physician trigger decision recorded.";
  if (!isTriggerSelection(d.kind)) return `${triggerDecisionLabel[d.kind]} — ${d.decidedBy}`;
  const parts = [d.triggerType, d.medication, d.dose, d.route].filter((p) => p && p.trim() !== "");
  return `${triggerDecisionLabel[d.kind]}: ${parts.join(" · ") || "details not entered"}${
    d.plannedDateTime ? ` · planned ${d.plannedDateTime}` : ""
  }`;
}

export function saveTriggerDecision(decision: TriggerDecision) {
  const list = readList<TriggerDecision>(KEY).filter((d) => d.patientId !== decision.patientId);
  writeList(KEY, [decision, ...list], LIMIT);

  const entry: TriggerAuditEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId: decision.patientId,
    patientName: decision.patientName,
    kind: decision.kind,
    label: triggerDecisionLabel[decision.kind],
    summary: triggerDecisionSummary(decision),
    rationale: decision.rationale,
    origin: decision.origin,
    monitoringDay: decision.monitoringDay,
    engineVersion: decision.engineVersion,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
  };
  writeList(AUDIT_KEY, [entry, ...readList<TriggerAuditEntry>(AUDIT_KEY)], AUDIT_LIMIT);
  return entry;
}

export function clearTriggerDecision(patientId: string) {
  writeList(KEY, readList<TriggerDecision>(KEY).filter((d) => d.patientId !== patientId), LIMIT);
}

export function getTriggerAudit(patientId?: string): TriggerAuditEntry[] {
  const all = readList<TriggerAuditEntry>(AUDIT_KEY);
  return patientId ? all.filter((e) => e.patientId === patientId) : all;
}

export function useTriggerDecision(patientId: string) {
  const [decision, setDecision] = useState<TriggerDecision | null>(null);
  const [audit, setAudit] = useState<TriggerAuditEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDecision(getTriggerDecision(patientId));
      setAudit(getTriggerAudit(patientId));
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

  const save = useCallback((d: TriggerDecision) => saveTriggerDecision(d), []);
  const clear = useCallback(() => clearTriggerDecision(patientId), [patientId]);

  return { decision, audit, hydrated, save, clear };
}
