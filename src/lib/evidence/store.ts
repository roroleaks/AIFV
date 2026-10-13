/**
 * Evidence Manager local store.
 *
 * Persists physician-owned state only: favorites, clinical notes, archive
 * status and manually imported references. It performs no parsing, no
 * interpretation and no AI summarisation of any imported document.
 */

import { evidenceLibrary, type EvidenceEntry } from "./library";

const KEY = "ivf-ai-calc.evidence-store.v1";

export interface EvidenceUserState {
  favorites: string[];
  archived: string[];
  notes: Record<string, string>;
  imported: EvidenceEntry[];
  /** Append-only log of library changes, newest first. */
  history: EvidenceHistoryItem[];
}

export interface EvidenceHistoryItem {
  id: string;
  at: string;
  action: "imported" | "favorited" | "unfavorited" | "archived" | "restored" | "note-updated";
  entryId: string;
  entryTitle: string;
}

const empty: EvidenceUserState = {
  favorites: [],
  archived: [],
  notes: {},
  imported: [],
  history: [],
};

export function readEvidenceState(): EvidenceUserState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<EvidenceUserState>;
    return { ...empty, ...parsed };
  } catch {
    return empty;
  }
}

export function writeEvidenceState(state: EvidenceUserState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export function logHistory(
  state: EvidenceUserState,
  action: EvidenceHistoryItem["action"],
  entry: { id: string; title: string },
): EvidenceUserState {
  const item: EvidenceHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    action,
    entryId: entry.id,
    entryTitle: entry.title,
  };
  return { ...state, history: [item, ...state.history].slice(0, 200) };
}

/** Built-in references merged with manually imported ones. */
export function mergedLibrary(state: EvidenceUserState): EvidenceEntry[] {
  return [...evidenceLibrary, ...state.imported];
}

export const historyLabels: Record<EvidenceHistoryItem["action"], string> = {
  imported: "Reference imported",
  favorited: "Added to favorites",
  unfavorited: "Removed from favorites",
  archived: "Archived",
  restored: "Restored to active",
  "note-updated": "Clinical note updated",
};

export interface ImportDraft {
  sourceKind: "PDF" | "DOI" | "PubMed" | "Journal URL" | "Conference Statement" | "Clinical Guideline";
  title: string;
  authors: string;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  pmid: string;
  publisher: string;
  type: EvidenceEntry["type"];
  level: EvidenceEntry["level"];
  priority: string;
  quality: EvidenceEntry["quality"];
  topics: string[];
  keywords: string;
  abstract: string;
  url: string;
  fileName?: string;
}

export const emptyImportDraft: ImportDraft = {
  sourceKind: "DOI",
  title: "",
  authors: "",
  journal: "",
  year: "",
  volume: "",
  issue: "",
  pages: "",
  doi: "",
  pmid: "",
  publisher: "",
  type: "Guideline",
  level: "Not graded",
  priority: "3",
  quality: "Not rated",
  topics: [],
  keywords: "",
  abstract: "",
  url: "",
};

export function draftToEntry(draft: ImportDraft): EvidenceEntry {
  const slug =
    draft.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "imported-reference";
  return {
    id: `custom-${slug}-${Date.now().toString(36)}`,
    title: draft.title.trim(),
    authors: draft.authors
      .split(/[;\n]|,(?![^(]*\))/)
      .map((a) => a.trim())
      .filter(Boolean),
    journal: draft.journal.trim(),
    year: Number(draft.year) || new Date().getFullYear(),
    volume: draft.volume.trim() || undefined,
    issue: draft.issue.trim() || undefined,
    pages: draft.pages.trim() || undefined,
    doi: draft.doi.trim() || undefined,
    pmid: draft.pmid.trim() || undefined,
    publisher: draft.publisher.trim() || undefined,
    url: draft.url.trim() || undefined,
    type: draft.type,
    level: draft.level,
    priority: (Number(draft.priority) || 3) as EvidenceEntry["priority"],
    quality: draft.quality,
    abstract: draft.abstract.trim() || undefined,
    summary: "",
    clinicalNotes: "",
    keywords: draft.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    topics: draft.topics,
    modules: [],
    status: "pending-review",
    sourceKind: draft.sourceKind,
    fileName: draft.fileName,
    addedAt: new Date().toISOString().slice(0, 10),
  };
}
