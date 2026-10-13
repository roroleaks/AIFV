/**
 * Physician gonadotropin decision store.
 *
 * Records the clinician's own medication selection after reviewing the
 * evidence. The application never writes a decision itself, and no AI
 * recommendation is ever stored here: every entry is physician-selected.
 * No dose is stored in this module.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "ivf-ai-calc.gonadotropin-decision";
const EVENT = "ivf-gonadotropin-decision-changed";
const LIMIT = 200;

export type GonadotropinDecisionKind =
  | "not-selected"
  | "select-rfsh"
  | "select-hmg"
  | "select-ufsh"
  | "select-hp-ufsh"
  | "select-other"
  | "defer"
  | "evidence-insufficient"
  | "need-more-information";

export const gonadotropinDecisionLabel: Record<GonadotropinDecisionKind, string> = {
  "not-selected": "Not selected",
  "select-rfsh": "Selected — rFSH",
  "select-hmg": "Selected — hMG",
  "select-ufsh": "Selected — uFSH",
  "select-hp-ufsh": "Selected — HP-uFSH",
  "select-other": "Selected — other supported option",
  defer: "Defer decision",
  "evidence-insufficient": "Insufficient evidence",
  "need-more-information": "Need more information",
};

export const gonadotropinDecisionKinds: GonadotropinDecisionKind[] = [
  "select-rfsh",
  "select-hmg",
  "select-ufsh",
  "select-hp-ufsh",
  "select-other",
  "defer",
  "evidence-insufficient",
  "need-more-information",
];

export const isSelectionKind = (k: GonadotropinDecisionKind) => k.startsWith("select-");

export interface GonadotropinDecision {
  patientId: string;
  patientName: string;
  kind: GonadotropinDecisionKind;
  /** Preparation named by the physician, when the kind is a selection. */
  gonadotropin: string | null;
  note: string;
  /** Always "Physician-selected" — never an application recommendation. */
  origin: "Physician-selected";
  patientContextVersion: string;
  evidenceVersion: string;
  decidedBy: string;
  decidedAt: string;
}

function read(): GonadotropinDecision[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GonadotropinDecision[]) : [];
  } catch {
    return [];
  }
}

function write(entries: GonadotropinDecision[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function saveGonadotropinDecision(decision: GonadotropinDecision) {
  const rest = read().filter((d) => d.patientId !== decision.patientId);
  write([decision, ...rest]);
}

export function getGonadotropinDecision(patientId: string): GonadotropinDecision | null {
  return read().find((d) => d.patientId === patientId) ?? null;
}

export function useGonadotropinDecision(patientId: string) {
  const [decision, setDecision] = useState<GonadotropinDecision | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDecision(getGonadotropinDecision(patientId));
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

  const save = useCallback((d: GonadotropinDecision) => {
    saveGonadotropinDecision(d);
    setDecision(d);
  }, []);

  const clear = useCallback(() => {
    write(read().filter((d) => d.patientId !== patientId));
    setDecision(null);
  }, [patientId]);

  return { decision, hydrated, save, clear };
}
