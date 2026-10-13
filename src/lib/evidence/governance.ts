/**
 * PROMPT 30 — Continuous Evidence Update & Governance System.
 *
 * Handles the lifecycle of an evidence document from ingestion to algorithm
 * activation. It performs NO clinical interpretation: no rule, threshold,
 * dose or recommendation is ever derived automatically. Every stage that
 * touches clinical meaning requires an explicit physician action that is
 * recorded in the governance log.
 */

import { useCallback, useEffect, useState } from "react";

import { engineActivationRegistry } from "@/lib/engine/activation-registry";
import { evidenceLibrary } from "./library";

/* ------------------------------------------------------- lifecycle model */

export type LifecycleStage =
  "E0" | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8" | "E9" | "E10";

export interface LifecycleStep {
  id: LifecycleStage;
  label: string;
  description: string;
  /** True when the step may be completed by the system without a physician. */
  automatic: boolean;
}

export const evidenceLifecycle: LifecycleStep[] = [
  {
    id: "E0",
    label: "Captured",
    description: "Document uploaded, fetched or entered manually.",
    automatic: true,
  },
  {
    id: "E1",
    label: "Fingerprinted",
    description: "SHA-256 content hash computed; duplicates detected.",
    automatic: true,
  },
  {
    id: "E2",
    label: "Metadata extracted",
    description: "Title, society, year, type and source recorded.",
    automatic: true,
  },
  {
    id: "E3",
    label: "Source verified",
    description: "Physician confirms publisher, authenticity and version.",
    automatic: false,
  },
  {
    id: "E4",
    label: "Priority assigned",
    description: "Placed in the 7-level source hierarchy.",
    automatic: false,
  },
  {
    id: "E5",
    label: "Clinically reviewed",
    description: "Physician reads the full text and records scope.",
    automatic: false,
  },
  {
    id: "E6",
    label: "Rules transcribed",
    description: "Tables and statements transcribed verbatim into code.",
    automatic: false,
  },
  {
    id: "E7",
    label: "Impact analysed",
    description: "Affected engines and superseded versions identified.",
    automatic: false,
  },
  {
    id: "E8",
    label: "Validated",
    description: "Transcription checked against the source, line by line.",
    automatic: false,
  },
  {
    id: "E9",
    label: "Approved",
    description: "Named physician approves activation.",
    automatic: false,
  },
  {
    id: "E10",
    label: "Activated",
    description: "Algorithm version published and logged.",
    automatic: false,
  },
];

export const lifecycleIndex = (stage: LifecycleStage) =>
  evidenceLifecycle.findIndex((s) => s.id === stage);

export const lifecycleLabel = (stage: LifecycleStage) =>
  evidenceLifecycle.find((s) => s.id === stage)?.label ?? stage;

/* ------------------------------------------------------------ data model */

export type IngestionChannel = "PDF_UPLOAD" | "URL_IMPORT" | "MANUAL_ENTRY" | "ASSISTED_SEARCH";

export const ingestionChannelLabel: Record<IngestionChannel, string> = {
  PDF_UPLOAD: "PDF upload",
  URL_IMPORT: "URL / DOI import",
  MANUAL_ENTRY: "Manual entry",
  ASSISTED_SEARCH: "Assisted search candidate",
};

export type ReviewDecision = "pending" | "accepted" | "rejected" | "superseded";

export interface EvidenceVersionRecord {
  id: string;
  /** Evidence Library entry id, when the record has been linked to one. */
  entryId?: string | undefined;
  title: string;
  society?: string | undefined;
  year?: number | undefined;
  version: string;
  channel: IngestionChannel;
  sourceRef: string;
  /** SHA-256 of the file bytes or of the normalised source reference. */
  contentHash: string;
  fileName?: string | undefined;
  fileSize?: number | undefined;
  stage: LifecycleStage;
  decision: ReviewDecision;
  /** Ids of records this one supersedes. */
  supersedes: string[];
  /** Engine ids that will need re-validation if this record is activated. */
  impactedEngines: string[];
  duplicateOf?: string | undefined;
  notes: string;
  capturedAt: string;
  updatedAt: string;
}

export interface GovernanceLogItem {
  id: string;
  at: string;
  actor: string;
  action: string;
  recordId: string;
  detail: string;
}

export interface GovernanceState {
  records: EvidenceVersionRecord[];
  log: GovernanceLogItem[];
}

const empty: GovernanceState = { records: [], log: [] };
const KEY = "ivf-ai-calc.evidence-governance.v1";

export function readGovernance(): GovernanceState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<GovernanceState>) };
  } catch {
    return empty;
  }
}

export function writeGovernance(state: GovernanceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function appendLog(
  state: GovernanceState,
  record: EvidenceVersionRecord,
  action: string,
  detail: string,
  actor = "Physician (local session)",
): GovernanceState {
  const item: GovernanceLogItem = {
    id: uid(),
    at: new Date().toISOString(),
    actor,
    action,
    recordId: record.id,
    detail,
  };
  return { ...state, log: [item, ...state.log].slice(0, 500) };
}

/* ------------------------------------------------------------ hashing */

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    // Deterministic non-cryptographic fallback, clearly marked.
    let h = 0;
    for (let i = 0; i < bytes.length; i += 1) h = (h * 31 + bytes[i]!) | 0;
    return `fallback-${(h >>> 0).toString(16)}`;
  }
  const digest = await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* -------------------------------------------------- duplicate detection */

export function findDuplicate(
  state: GovernanceState,
  hash: string,
  title: string,
): EvidenceVersionRecord | undefined {
  const normalised = title.trim().toLowerCase();
  return state.records.find(
    (r) => r.contentHash === hash || r.title.trim().toLowerCase() === normalised,
  );
}

/** Records for the same publication family, used to propose supersession. */
export function findPriorVersions(
  state: GovernanceState,
  title: string,
  society?: string,
): EvidenceVersionRecord[] {
  const key = title.replace(/\d{4}/g, "").trim().toLowerCase().slice(0, 40);
  return state.records.filter(
    (r) =>
      r.title.replace(/\d{4}/g, "").trim().toLowerCase().slice(0, 40) === key ||
      (Boolean(society) && r.society === society && r.title.slice(0, 20) === title.slice(0, 20)),
  );
}

/* ---------------------------------------------------- impact analysis */

export interface ImpactReport {
  engines: { id: string; name: string; reason: string; revalidationRequired: boolean }[];
  supersededEntries: { id: string; title: string; year: number }[];
  summary: string;
}

/**
 * Purely structural: matches the new document's declared topics/keywords to
 * engines that already cite related evidence. It never infers clinical content.
 */
export function analyseImpact(
  record: Pick<EvidenceVersionRecord, "title" | "society" | "notes">,
  linkedEvidenceIds: string[],
): ImpactReport {
  const haystack = `${record.title} ${record.society ?? ""} ${record.notes}`.toLowerCase();

  const keywordMap: { key: string; engineIds: string[] }[] = [
    {
      key: "stimulation",
      engineIds: ["protocol-selection", "starting-dose", "monitoring", "dose-adjustment"],
    },
    { key: "protocol", engineIds: ["protocol-selection"] },
    { key: "antagonist", engineIds: ["protocol-selection"] },
    { key: "agonist", engineIds: ["protocol-selection", "trigger"] },
    { key: "gonadotrop", engineIds: ["gonadotropin-selection", "starting-dose"] },
    { key: "dose", engineIds: ["starting-dose", "consort-dose", "dose-adjustment"] },
    { key: "consort", engineIds: ["consort-dose"] },
    { key: "trigger", engineIds: ["trigger"] },
    { key: "ohss", engineIds: ["cycle-completion", "trigger", "ovarian-response"] },
    { key: "freeze", engineIds: ["cycle-completion"] },
    { key: "poseidon", engineIds: ["poseidon", "phenotype"] },
    { key: "bologna", engineIds: ["bologna", "phenotype"] },
    { key: "poor respon", engineIds: ["bologna", "ovarian-response"] },
    { key: "monitor", engineIds: ["monitoring", "dose-adjustment"] },
  ];

  const hits = new Set<string>();
  keywordMap.forEach((m) => {
    if (haystack.includes(m.key)) m.engineIds.forEach((id) => hits.add(id));
  });
  engineActivationRegistry.forEach((e) => {
    if (e.evidenceIds.some((id) => linkedEvidenceIds.includes(id))) hits.add(e.id);
  });

  const engines = Array.from(hits)
    .map((id) => engineActivationRegistry.find((e) => e.id === id))
    .filter((e): e is (typeof engineActivationRegistry)[number] => Boolean(e))
    .map((e) => ({
      id: e.id,
      name: e.name,
      reason:
        e.evidenceStatus === "EVIDENCE_PENDING"
          ? "Engine is evidence-pending — this document may supply the missing algorithm."
          : "Engine already cites related evidence — transcription must be re-checked.",
      revalidationRequired: e.evidenceStatus !== "EVIDENCE_PENDING",
    }));

  const supersededEntries = evidenceLibrary
    .filter((e) => linkedEvidenceIds.includes(e.id))
    .map((e) => ({ id: e.id, title: e.title, year: e.year }));

  return {
    engines,
    supersededEntries,
    summary: engines.length
      ? `${engines.length} engine(s) are structurally linked to this document. No rule is applied until a physician transcribes and approves it (stages E6–E10).`
      : "No engine is structurally linked to this document yet. A physician must map it manually during clinical review (stage E5).",
  };
}

/* ---------------------------------------------------------- operations */

export interface NewRecordInput {
  title: string;
  society?: string | undefined;
  year?: number | undefined;
  version?: string | undefined;
  channel: IngestionChannel;
  sourceRef: string;
  contentHash: string;
  fileName?: string | undefined;
  fileSize?: number | undefined;
  notes?: string | undefined;
  linkedEvidenceIds?: string[] | undefined;
}

export function createRecord(
  state: GovernanceState,
  input: NewRecordInput,
): { state: GovernanceState; record: EvidenceVersionRecord; duplicate?: EvidenceVersionRecord } {
  const duplicate = findDuplicate(state, input.contentHash, input.title);
  const impact = analyseImpact(
    { title: input.title, society: input.society, notes: input.notes ?? "" },
    input.linkedEvidenceIds ?? [],
  );
  const prior = findPriorVersions(state, input.title, input.society);
  const now = new Date().toISOString();

  const record: EvidenceVersionRecord = {
    id: uid(),
    title: input.title,
    society: input.society,
    year: input.year,
    version: input.version ?? "v1",
    channel: input.channel,
    sourceRef: input.sourceRef,
    contentHash: input.contentHash,
    fileName: input.fileName,
    fileSize: input.fileSize,
    stage: "E2",
    decision: "pending",
    supersedes: prior.map((p) => p.id),
    impactedEngines: impact.engines.map((e) => e.id),
    duplicateOf: duplicate?.id,
    notes: input.notes ?? "",
    capturedAt: now,
    updatedAt: now,
  };

  let next: GovernanceState = { ...state, records: [record, ...state.records] };
  next = appendLog(
    next,
    record,
    "captured",
    `${ingestionChannelLabel[input.channel]} — hash ${record.contentHash.slice(0, 12)}…${
      duplicate ? ` (duplicate of “${duplicate.title}”)` : ""
    }`,
  );
  return duplicate ? { state: next, record, duplicate } : { state: next, record };
}

export function advanceStage(
  state: GovernanceState,
  recordId: string,
  stage: LifecycleStage,
  detail: string,
): GovernanceState {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return state;
  const updated: EvidenceVersionRecord = { ...record, stage, updatedAt: new Date().toISOString() };
  const next: GovernanceState = {
    ...state,
    records: state.records.map((r) => (r.id === recordId ? updated : r)),
  };
  return appendLog(next, updated, `stage:${stage}`, `${lifecycleLabel(stage)} — ${detail}`);
}

export function setDecision(
  state: GovernanceState,
  recordId: string,
  decision: ReviewDecision,
  detail: string,
): GovernanceState {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return state;
  const updated: EvidenceVersionRecord = {
    ...record,
    decision,
    updatedAt: new Date().toISOString(),
  };
  const next: GovernanceState = {
    ...state,
    records: state.records.map((r) => (r.id === recordId ? updated : r)),
  };
  return appendLog(next, updated, `decision:${decision}`, detail);
}

export function removeRecord(state: GovernanceState, recordId: string): GovernanceState {
  const record = state.records.find((r) => r.id === recordId);
  if (!record) return state;
  const next: GovernanceState = {
    ...state,
    records: state.records.filter((r) => r.id !== recordId),
  };
  return appendLog(next, record, "removed", `Record “${record.title}” removed from the queue.`);
}

/* ------------------------------------------------------------- hook */

export function useEvidenceGovernance() {
  const [state, setState] = useState<GovernanceState>(empty);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readGovernance());
    setHydrated(true);
  }, []);

  const commit = useCallback((next: GovernanceState) => {
    setState(next);
    writeGovernance(next);
  }, []);

  const add = useCallback(
    (input: NewRecordInput) => {
      const result = createRecord(readGovernance(), input);
      commit(result.state);
      return result;
    },
    [commit],
  );

  const advance = useCallback(
    (id: string, stage: LifecycleStage, detail: string) =>
      commit(advanceStage(readGovernance(), id, stage, detail)),
    [commit],
  );

  const decide = useCallback(
    (id: string, decision: ReviewDecision, detail: string) =>
      commit(setDecision(readGovernance(), id, decision, detail)),
    [commit],
  );

  const remove = useCallback((id: string) => commit(removeRecord(readGovernance(), id)), [commit]);

  return { state, hydrated, add, advance, decide, remove };
}
