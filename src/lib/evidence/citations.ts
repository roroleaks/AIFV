/**
 * Citation formatting, export builders and module routing for the Evidence
 * module.
 *
 * Formatting and file generation only. Nothing here interprets a publication,
 * derives a clinical rule or produces a recommendation.
 */

import type { EvidenceEntry } from "./library";
import { formatCitation } from "./library";
import { engineModules } from "@/lib/engine/registry";
import { knowledgeModules } from "@/lib/clinical/knowledge-model";
import { blockedModules } from "./requirements";

/* ------------------------------------------------------------------ */
/* Citation formats                                                     */
/* ------------------------------------------------------------------ */

export const doiUrl = (doi?: string) => (doi ? `https://doi.org/${doi}` : undefined);

export const pubmedUrl = (pmid?: string) =>
  pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined;

/** Journal landing page: publisher URL when stored, otherwise the DOI resolver. */
export const journalUrl = (e: EvidenceEntry) => e.url ?? doiUrl(e.doi);

export function formatApa(e: EvidenceEntry): string {
  const authors =
    e.authors.length > 1
      ? `${e.authors.slice(0, -1).join(", ")}, & ${e.authors[e.authors.length - 1]}`
      : (e.authors[0] ?? "");
  const loc = [e.volume && `${e.volume}${e.issue ? `(${e.issue})` : ""}`, e.pages]
    .filter(Boolean)
    .join(", ");
  return `${authors} (${e.year}). ${e.title}. ${e.journal}${loc ? `, ${loc}` : ""}.${
    e.doi ? ` https://doi.org/${e.doi}` : ""
  }`;
}

export const formatVancouver = formatCitation;

const bibKey = (e: EvidenceEntry) => {
  const first = (e.authors[0] ?? "anon").split(/\s+/).pop() ?? "anon";
  return `${first.replace(/[^A-Za-z]/g, "")}${e.year}`.toLowerCase();
};

export function formatBibtex(e: EvidenceEntry): string {
  const fields: [string, string | undefined][] = [
    ["title", e.title],
    ["author", e.authors.join(" and ")],
    ["journal", e.journal],
    ["year", String(e.year)],
    ["volume", e.volume],
    ["number", e.issue],
    ["pages", e.pages],
    ["doi", e.doi],
    ["publisher", e.publisher],
    ["note", e.pmid ? `PMID: ${e.pmid}` : undefined],
    ["url", journalUrl(e)],
  ];
  const body = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(",\n");
  return `@article{${bibKey(e)},\n${body}\n}`;
}

export function formatRis(e: EvidenceEntry): string {
  const lines = ["TY  - JOUR", ...e.authors.map((a) => `AU  - ${a}`), `TI  - ${e.title}`];
  lines.push(`JO  - ${e.journal}`, `PY  - ${e.year}`);
  if (e.volume) lines.push(`VL  - ${e.volume}`);
  if (e.issue) lines.push(`IS  - ${e.issue}`);
  if (e.pages) lines.push(`SP  - ${e.pages}`);
  if (e.doi) lines.push(`DO  - ${e.doi}`);
  if (e.pmid) lines.push(`AN  - ${e.pmid}`);
  if (e.abstract) lines.push(`AB  - ${e.abstract.replace(/\s+/g, " ")}`);
  (e.keywords ?? []).forEach((k) => lines.push(`KW  - ${k}`));
  const url = journalUrl(e);
  if (url) lines.push(`UR  - ${url}`);
  lines.push("ER  - ", "");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Exports                                                              */
/* ------------------------------------------------------------------ */

const csvCell = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function evidenceToCsv(entries: EvidenceEntry[]): string {
  const head = [
    "id",
    "title",
    "authors",
    "journal",
    "year",
    "volume",
    "issue",
    "pages",
    "doi",
    "pmid",
    "type",
    "level",
    "priority",
    "quality",
    "society",
    "topics",
    "keywords",
    "modules",
    "status",
    "addedAt",
  ];
  const rows = entries.map((e) =>
    [
      e.id,
      e.title,
      e.authors.join("; "),
      e.journal,
      e.year,
      e.volume,
      e.issue,
      e.pages,
      e.doi,
      e.pmid,
      e.type,
      e.level,
      e.priority,
      e.quality,
      e.society,
      e.topics.join("; "),
      (e.keywords ?? []).join("; "),
      e.modules.join("; "),
      e.status,
      e.addedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

export const evidenceToJson = (entries: EvidenceEntry[]) =>
  JSON.stringify(
    { generatedAt: new Date().toISOString(), count: entries.length, entries },
    null,
    2,
  );

export const evidenceToBibtex = (entries: EvidenceEntry[]) =>
  entries.map(formatBibtex).join("\n\n");

export const evidenceToRis = (entries: EvidenceEntry[]) => entries.map(formatRis).join("\n");

export function downloadText(filename: string, text: string, mime = "text/plain") {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Module linkage / routing                                             */
/* ------------------------------------------------------------------ */

export type AppRoute =
  | "/assessment"
  | "/poseidon"
  | "/decision-support"
  | "/protocols"
  | "/gonadotropins"
  | "/consort"
  | "/monitoring"
  | "/cycle-completion"
  | "/reports"
  | "/engine";

const routeById: Record<string, AppRoute> = {
  "patient-classification": "/assessment",
  assessment: "/assessment",
  validation: "/assessment",
  "ovarian-reserve": "/decision-support",
  poseidon: "/poseidon",
  bologna: "/decision-support",
  "response-prediction": "/decision-support",
  "poor-response": "/decision-support",
  "hyper-response": "/decision-support",
  "protocol-selection": "/protocols",
  "protocol-recommendation": "/protocols",
  "stimulation-dose": "/consort",
  "consort-dose": "/consort",
  "gonadotropin-selection": "/gonadotropins",
  monitoring: "/monitoring",
  "dose-adjustment": "/monitoring",
  "trigger-selection": "/cycle-completion",
  "trigger-recommendation": "/cycle-completion",
  "ohss-risk": "/cycle-completion",
  "freeze-all": "/cycle-completion",
  "transfer-strategy": "/cycle-completion",
  "embryo-transfer": "/cycle-completion",
  "luteal-support": "/engine",
  "report-generator": "/reports",
  "evidence-explanation": "/reports",
};

export const moduleRoute = (id: string): AppRoute => routeById[id] ?? "/engine";

export type AlgorithmStatus =
  "Validated" | "Active" | "Framework" | "Waiting for Evidence" | "Blocked";

export interface ModuleRef {
  id: string;
  name: string;
  kind: "knowledge" | "engine";
  route: AppRoute;
  status: AlgorithmStatus;
  statusDetail: string;
  /** Requirement items still missing before this module can be activated. */
  missing: { item: string; kind: string; source: string; locator?: string | undefined }[];
}

const statusFor = (impl: string): { status: AlgorithmStatus; detail: string } => {
  switch (impl) {
    case "implemented":
      return {
        status: "Validated",
        detail: "Published criteria transcribed and running against patient data.",
      };
    case "awaiting-evidence":
      return {
        status: "Waiting for Evidence",
        detail:
          "Interface and data flow complete; the published table or rule set is not yet imported.",
      };
    case "not-implemented":
      return { status: "Framework", detail: "Data contract registered; no algorithm activated." };
    case "planned":
      return { status: "Blocked", detail: "Scheduled module — no data contract activated yet." };
    default:
      return { status: "Framework", detail: "Registered module." };
  }
};

/** Every module (knowledge + engine) that cites the given evidence entry. */
export function modulesUsingEvidence(entryId: string, entryModules: string[]): ModuleRef[] {
  const refs = new Map<string, ModuleRef>();

  const add = (id: string, name: string, kind: ModuleRef["kind"], impl: string) => {
    if (refs.has(`${kind}:${id}`)) return;
    const { status, detail } = statusFor(impl);
    const blocked = blockedModules.find((b) => b.engineId === id);
    refs.set(`${kind}:${id}`, {
      id,
      name,
      kind,
      route: moduleRoute(id),
      status,
      statusDetail: blocked ? `${detail} ${blocked.implemented}` : detail,
      missing:
        blocked?.requirements.map((r) => ({
          item: r.item,
          kind: r.kind,
          source: r.source,
          locator: r.locator,
        })) ?? [],
    });
  };

  for (const m of knowledgeModules) {
    if (entryModules.includes(m.id) || m.evidence.includes(entryId)) {
      const engine = engineModules.find((e) => e.knowledgeModuleId === m.id || e.id === m.id);
      add(m.id, m.name, "knowledge", engine?.implementation ?? "not-implemented");
    }
  }
  for (const m of engineModules) {
    const viaKnowledge = m.knowledgeModuleId && entryModules.includes(m.knowledgeModuleId);
    if (m.evidence.includes(entryId) || entryModules.includes(m.id) || viaKnowledge) {
      add(m.id, m.name, "engine", m.implementation);
    }
  }
  return [...refs.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Library statistics                                                   */
/* ------------------------------------------------------------------ */

export interface LibraryStats {
  total: number;
  guidelines: number;
  rcts: number;
  metaAnalyses: number;
  systematicReviews: number;
  cohort: number;
  algorithmsActivated: number;
  algorithmsWaiting: number;
  algorithmsTotal: number;
  completeness: number;
  indexed: number;
  pending: number;
}

export function libraryStats(entries: EvidenceEntry[]): LibraryStats {
  const count = (t: string) => entries.filter((e) => e.type === t).length;
  const activated = engineModules.filter((m) => m.implementation === "implemented").length;
  const waiting = engineModules.filter(
    (m) => m.implementation === "awaiting-evidence" || m.implementation === "planned",
  ).length;
  return {
    total: entries.length,
    guidelines: count("Guideline") + count("Consensus"),
    rcts: count("RCT"),
    metaAnalyses: count("Meta-analysis"),
    systematicReviews: count("Systematic review"),
    cohort: count("Cohort study") + count("Observational study"),
    algorithmsActivated: activated,
    algorithmsWaiting: waiting,
    algorithmsTotal: engineModules.length,
    completeness: Math.round((activated / Math.max(1, engineModules.length)) * 100),
    indexed: entries.filter((e) => e.status === "indexed").length,
    pending: entries.filter((e) => e.status === "pending-review").length,
  };
}
