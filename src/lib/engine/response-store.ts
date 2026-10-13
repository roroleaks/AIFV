/**
 * Stored ovarian response predictions.
 *
 * Persists the latest prediction per patient so the modules that follow
 * (Protocol Recommendation, Gonadotropin Selection, CONSORT, Dose Adjustment,
 * Trigger Strategy, Freeze-All) can read it without recomputing.
 * Storage only — no clinical conclusion is produced here.
 */

import { useCallback, useEffect, useState } from "react";

import {
  OVARIAN_RESPONSE_ENGINE_VERSION,
  type OvarianResponseResult,
  type ResponseCategory,
} from "./ovarian-response";

const KEY = "ivf-ai-calc.ovarian-response";
const EVENT = "ivf-ovarian-response-changed";
const LIMIT = 100;

export interface StoredResponsePrediction {
  id: string;
  patientId: string;
  patientName: string;
  category: ResponseCategory;
  riskIds: string[];
  riskLabels: string[];
  confidence: number;
  dataQuality: OvarianResponseResult["validation"]["quality"];
  missingCount: number;
  assessedAt: string;
  version: string;
}

function read(): StoredResponsePrediction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredResponsePrediction[]) : [];
  } catch {
    return [];
  }
}

function write(entries: StoredResponsePrediction[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable */
  }
}

/** Records a prediction, skipping an identical latest entry. */
export function saveResponsePrediction(
  patientId: string,
  patientName: string,
  result: OvarianResponseResult,
): StoredResponsePrediction {
  const entry: StoredResponsePrediction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId,
    patientName,
    category: result.category,
    riskIds: result.risks.map((r) => r.id),
    riskLabels: result.risks.map((r) => r.label),
    confidence: result.confidence,
    dataQuality: result.validation.quality,
    missingCount: result.validation.missing.length,
    assessedAt: result.computedAt,
    version: OVARIAN_RESPONSE_ENGINE_VERSION,
  };

  const existing = read();
  const last = existing.find((e) => e.patientId === patientId);
  const unchanged =
    last &&
    last.category === entry.category &&
    last.confidence === entry.confidence &&
    last.dataQuality === entry.dataQuality &&
    last.riskIds.join("|") === entry.riskIds.join("|");

  if (unchanged) return last;
  write([entry, ...existing]);
  return entry;
}

/** Latest stored prediction for a patient — the read path for future modules. */
export function getResponsePrediction(patientId: string): StoredResponsePrediction | null {
  return read().find((e) => e.patientId === patientId) ?? null;
}

export function useResponsePredictions(patientId?: string) {
  const [entries, setEntries] = useState<StoredResponsePrediction[]>([]);

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
