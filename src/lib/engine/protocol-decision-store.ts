/**
 * Physician protocol decision store.
 *
 * Records the clinician's own decision after reviewing the evidence. This is a
 * human decision log — the application never writes a decision itself.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "ivf-ai-calc.protocol-decision";
const EVENT = "ivf-protocol-decision-changed";
const LIMIT = 200;

export type ProtocolDecisionKind =
  | "select-protocol"
  | "defer"
  | "need-more-information"
  | "evidence-insufficient";

export const protocolDecisionLabel: Record<ProtocolDecisionKind, string> = {
  "select-protocol": "Protocol selected by physician",
  defer: "Decision deferred",
  "need-more-information": "More information needed",
  "evidence-insufficient": "Evidence insufficient",
};

export interface ProtocolDecision {
  patientId: string;
  patientName: string;
  kind: ProtocolDecisionKind;
  /** Protocol name chosen by the physician, when the kind is select-protocol. */
  protocol: string | null;
  note: string;
  decidedBy: string;
  decidedAt: string;
}

function read(): ProtocolDecision[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProtocolDecision[]) : [];
  } catch {
    return [];
  }
}

function write(entries: ProtocolDecision[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function saveProtocolDecision(decision: ProtocolDecision) {
  const rest = read().filter((d) => d.patientId !== decision.patientId);
  write([decision, ...rest]);
}

export function getProtocolDecision(patientId: string): ProtocolDecision | null {
  return read().find((d) => d.patientId === patientId) ?? null;
}

export function useProtocolDecision(patientId: string) {
  const [decision, setDecision] = useState<ProtocolDecision | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDecision(getProtocolDecision(patientId));
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

  const save = useCallback((d: ProtocolDecision) => {
    saveProtocolDecision(d);
    setDecision(d);
  }, []);

  const clear = useCallback(() => {
    write(read().filter((d) => d.patientId !== patientId));
    setDecision(null);
  }, [patientId]);

  return { decision, hydrated, save, clear };
}
