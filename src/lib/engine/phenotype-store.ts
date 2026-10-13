/**
 * Stored patient phenotype assessments.
 *
 * Keeps a versioned history of each phenotype evaluation so the physician
 * timeline can show what was assessed, when, and with which engine version.
 * Storage only — no clinical conclusion is produced here.
 */

import { useCallback, useEffect, useState } from "react";

import { PHENOTYPE_ENGINE_VERSION, type PhenotypeResult } from "./phenotype";

const KEY = "ivf-ai-calc.phenotype-history";
const EVENT = "ivf-phenotype-changed";
const LIMIT = 100;

export interface StoredPhenotypeAssessment {
  id: string;
  patientId: string;
  patientName: string;
  phenotype: PhenotypeResult["phenotype"];
  poseidonStatus: PhenotypeResult["poseidon"]["status"];
  poseidonGroup: string | null;
  bolognaStatus: PhenotypeResult["bologna"]["status"];
  reserveCategory: PhenotypeResult["reserve"]["category"];
  missingCount: number;
  assessedAt: string;
  version: string;
}

function read(): StoredPhenotypeAssessment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredPhenotypeAssessment[]) : [];
  } catch {
    return [];
  }
}

function write(entries: StoredPhenotypeAssessment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

/** Records a phenotype evaluation, replacing an identical latest entry. */
export function savePhenotypeAssessment(
  patientId: string,
  patientName: string,
  result: PhenotypeResult,
): StoredPhenotypeAssessment {
  const entry: StoredPhenotypeAssessment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId,
    patientName,
    phenotype: result.phenotype,
    poseidonStatus: result.poseidon.status,
    poseidonGroup: result.poseidon.group,
    bolognaStatus: result.bologna.status,
    reserveCategory: result.reserve.category,
    missingCount: result.missing.length,
    assessedAt: result.computedAt,
    version: PHENOTYPE_ENGINE_VERSION,
  };

  const existing = read();
  const last = existing.find((e) => e.patientId === patientId);
  const unchanged =
    last &&
    last.phenotype === entry.phenotype &&
    last.poseidonGroup === entry.poseidonGroup &&
    last.poseidonStatus === entry.poseidonStatus &&
    last.bolognaStatus === entry.bolognaStatus &&
    last.reserveCategory === entry.reserveCategory &&
    last.missingCount === entry.missingCount;

  if (unchanged) return last;
  write([entry, ...existing]);
  return entry;
}

export function usePhenotypeHistory(patientId?: string) {
  const [entries, setEntries] = useState<StoredPhenotypeAssessment[]>([]);

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
    clear,
  };
}
