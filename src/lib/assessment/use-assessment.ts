import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allStepFields, steps } from "./schema";

export type FieldValue = string | number | string[] | undefined;
export type AssessmentValues = Record<string, FieldValue>;
export type CycleRecord = { id: string } & Record<string, FieldValue>;

export interface DocumentRecord {
  id: string;
  name: string;
  category: string;
  size: number;
  mime: string;
  addedAt: string;
  /** in-session object URL — not persisted */
  url?: string | undefined;
}

export interface AssessmentDraft {
  values: AssessmentValues;
  cycles: CycleRecord[];
  documents: DocumentRecord[];
  currentStep: number;
  updatedAt: string | null;
}

const STORAGE_KEY = "ivf-ai-calc:assessment-draft:v1";

const emptyDraft: AssessmentDraft = {
  values: {},
  cycles: [],
  documents: [],
  currentStep: 0,
  updatedAt: null,
};

function readDraft(): AssessmentDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft;
    const parsed = JSON.parse(raw) as Partial<AssessmentDraft>;
    return {
      values: parsed.values ?? {},
      cycles: parsed.cycles ?? [],
      documents: parsed.documents ?? [],
      currentStep: parsed.currentStep ?? 0,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return emptyDraft;
  }
}

/** object URLs cannot be serialised — strip before persisting */
const serialise = (draft: AssessmentDraft, updatedAt: string) =>
  JSON.stringify({
    ...draft,
    documents: draft.documents.map(({ url: _url, ...rest }) => rest),
    updatedAt,
  });


const isFilled = (v: FieldValue) =>
  Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";

export function useAssessment() {
  const [draft, setDraft] = useState<AssessmentDraft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const skipPersist = useRef(true);

  useEffect(() => {
    const stored = readDraft();
    setDraft(stored);
    setSavedAt(stored.updatedAt);
    setHydrated(true);
  }, []);

  // autosave — every change is persisted, no manual save required
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    setSaving(true);
    const t = setTimeout(() => {
      const updatedAt = new Date().toISOString();
      try {
        window.localStorage.setItem(STORAGE_KEY, serialise(draft, updatedAt));
        setSavedAt(updatedAt);
      } catch {
        /* storage unavailable */
      }
      setSaving(false);
    }, 500);
    return () => clearTimeout(t);
  }, [draft, hydrated]);

  const setValue = useCallback((key: string, value: FieldValue) => {
    setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } }));
  }, []);

  const setStep = useCallback((index: number) => {
    setDraft((d) => ({ ...d, currentStep: Math.min(Math.max(index, 0), steps.length - 1) }));
  }, []);

  const addCycle = useCallback(() => {
    setDraft((d) => ({
      ...d,
      values: { ...d.values, hasPreviousCycles: "Yes" },
      cycles: [
        ...d.cycles,
        { id: `${Date.now()}-${d.cycles.length + 1}`, cycleNumber: d.cycles.length + 1 },
      ],
    }));
  }, []);

  const removeCycle = useCallback((id: string) => {
    setDraft((d) => ({ ...d, cycles: d.cycles.filter((c) => c.id !== id) }));
  }, []);

  const setCycleValue = useCallback((id: string, key: string, value: FieldValue) => {
    setDraft((d) => ({
      ...d,
      cycles: d.cycles.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    }));
  }, []);

  const addDocuments = useCallback((files: File[], category: string) => {
    const docs: DocumentRecord[] = files.map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      name: file.name,
      category,
      size: file.size,
      mime: file.type,
      addedAt: new Date().toISOString(),
      url: typeof URL === "undefined" ? undefined : URL.createObjectURL(file),
    }));
    setDraft((d) => ({ ...d, documents: [...d.documents, ...docs] }));
    return docs.length;
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDraft((d) => ({ ...d, documents: d.documents.filter((doc) => doc.id !== id) }));
  }, []);

  const renameDocument = useCallback((id: string, name: string) => {
    setDraft((d) => ({
      ...d,
      documents: d.documents.map((doc) => (doc.id === id ? { ...doc, name } : doc)),
    }));
  }, []);

  const saveNow = useCallback(() => {
    const updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, serialise(draft, updatedAt));
      setSavedAt(updatedAt);
    } catch {
      /* storage unavailable */
    }
    return updatedAt;
  }, [draft]);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setDraft(emptyDraft);
    setSavedAt(null);
  }, []);

  const stepProgress = useMemo(
    () =>
      steps.map((step) => {
        if (step.custom === "cycles") {
          const answered = isFilled(draft.values["hasPreviousCycles"]);
          const filled = answered ? 1 : 0;
          return { id: step.id, total: 1, filled, percent: filled };
        }
        if (step.custom) {
          return { id: step.id, total: 0, filled: 0, percent: 1 };
        }
        const fields = allStepFields(step, draft.values);
        const filled = fields.filter((f) => isFilled(draft.values[f.key])).length;
        return {
          id: step.id,
          total: fields.length,
          filled,
          percent: fields.length ? filled / fields.length : 1,
        };
      }),
    [draft],
  );

  const completion = useMemo(() => {
    const scored = stepProgress.filter((s) => s.total > 0);
    const total = scored.reduce((a, s) => a + s.total, 0);
    const filled = scored.reduce((a, s) => a + s.filled, 0);
    return total ? Math.round((filled / total) * 100) : 0;
  }, [stepProgress]);

  const missingByStep = useMemo(
    () =>
      steps
        .filter((s) => !s.custom)
        .map((step) => ({
          step,
          missing: allStepFields(step, draft.values).filter((f) => !isFilled(draft.values[f.key])),
        }))
        .filter((s) => s.missing.length > 0),
    [draft.values],
  );

  return {
    draft,
    hydrated,
    savedAt,
    saving,
    completion,
    stepProgress,
    missingByStep,
    setValue,
    setStep,
    addCycle,
    removeCycle,
    setCycleValue,
    addDocuments,
    removeDocument,
    renameDocument,
    saveNow,
    reset,
    isFilled,
  };
}

