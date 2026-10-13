/**
 * Stored POSEIDON assessment results.
 *
 * Persists the classification output so future modules (Bologna, Ovarian
 * Reserve, Protocol, CONSORT, OHSS, Report Generator) can consume it.
 * Storage only — no recommendation is produced or implied here.
 */

import { useCallback, useEffect, useState } from "react";

import type { PoseidonResult } from "./poseidon";

const KEY = "ivf-ai-calc.poseidon-results";
const EVENT = "ivf-poseidon-changed";

export interface StoredPoseidonAssessment {
  patientId: string;
  patientName: string;
  status: PoseidonResult["status"];
  group: PoseidonResult["group"];
  groupTitle: string | null;
  dataQuality: PoseidonResult["dataQuality"];
  confidence: number;
  missing: string[];
  validation: string[];
  inputs: PoseidonResult["inputs"];
  context: PoseidonResult["context"];
  assessedAt: string;
  version: string;
}

export const POSEIDON_ENGINE_VERSION = "1.0.0";

function read(): Record<string, StoredPoseidonAssessment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredPoseidonAssessment>) : {};
  } catch {
    return {};
  }
}

function write(map: Record<string, StoredPoseidonAssessment>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function savePoseidonAssessment(
  patientId: string,
  patientName: string,
  result: PoseidonResult,
): StoredPoseidonAssessment {
  const entry: StoredPoseidonAssessment = {
    patientId,
    patientName,
    status: result.status,
    group: result.group,
    groupTitle: result.groupTitle,
    dataQuality: result.dataQuality,
    confidence: result.confidence,
    missing: result.missing,
    validation: result.validation,
    inputs: result.inputs,
    context: result.context,
    assessedAt: result.computedAt,
    version: POSEIDON_ENGINE_VERSION,
  };
  write({ ...read(), [patientId]: entry });
  return entry;
}

export function getPoseidonAssessment(patientId: string): StoredPoseidonAssessment | null {
  return read()[patientId] ?? null;
}

export function usePoseidonAssessments() {
  const [entries, setEntries] = useState<StoredPoseidonAssessment[]>([]);

  useEffect(() => {
    const sync = () =>
      setEntries(Object.values(read()).sort((a, b) => b.assessedAt.localeCompare(a.assessedAt)));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const clear = useCallback(() => write({}), []);

  return { entries, clear };
}
