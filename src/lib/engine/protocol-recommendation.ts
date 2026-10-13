/**
 * Protocol Recommendation Engine — framework only (V1).
 *
 * This module aggregates the outputs of the already-implemented assessment
 * engines and presents them in one explainable structure. It deliberately
 * produces NO protocol selection, NO contraindication, NO medication, NO
 * gonadotropin and NO dose. `recommendation.status` stays "not-implemented"
 * until validated ESHRE / ASRM decision rules are imported.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import type { PhenotypeResult } from "./phenotype";
import type { OvarianResponseResult } from "./ovarian-response";
import { responseCategoryLabel } from "./ovarian-response";
import type { ProtocolId } from "./protocol-database";

export const PROTOCOL_ENGINE_VERSION = "0.1.0";

export const PROTOCOL_PENDING_MESSAGE =
  "Evidence-based protocol rules will be activated after importing validated clinical algorithms.";

export const protocolEvidenceIds = [
  "eshre-2020-ovarian-stimulation",
  "cochrane-2016-antagonist",
  "asrm-2016-ohss-prevention",
];

/* --------------------------------------------------------------- sections */

export interface ProtocolClinicalSummary {
  age: number | null;
  diagnosis: string[];
  amh: number | null;
  afc: number | null;
  bmi: number | null;
  poseidonGroup: string | null;
  poseidonStatus: string;
  bolognaStatus: string;
  expectedResponse: string;
  majorRisks: string[];
}

export type ConsiderationSeverity = "info" | "moderate" | "high";

export interface ClinicalConsideration {
  id: string;
  label: string;
  severity: ConsiderationSeverity;
  /** Where the consideration came from — always a recorded value or a published framework. */
  source: string;
}

export type RecommendationStatus = "not-implemented" | "insufficient-data" | "available";

export const recommendationStatusLabel: Record<RecommendationStatus, string> = {
  "not-implemented": "Awaiting validated rules",
  "insufficient-data": "Insufficient data",
  available: "Available",
};

/** Reserved explanation surface. Every field stays empty in this release. */
export interface ProtocolExplanation {
  clinicalRationale: string | null;
  supportingVariables: string[];
  evidenceUsed: string[];
  guideline: string | null;
  publication: string | null;
  notes: string | null;
}

export interface ProtocolRecommendation {
  status: RecommendationStatus;
  message: string;
  /** Reserved — no protocol is selected in this release. */
  recommended: ProtocolId | null;
  /** Reserved — no alternative is proposed in this release. */
  alternatives: ProtocolId[];
  evidenceSource: string[];
  explanation: ProtocolExplanation;
}

/** Downstream engines that will consume this module's future output. */
export interface ProtocolConsumerInterface {
  id: string;
  name: string;
  consumes: string[];
  status: "pending";
}

export const protocolConsumerInterfaces: ProtocolConsumerInterface[] = [
  {
    id: "gonadotropin-selection",
    name: "Gonadotropin Selection Engine",
    consumes: ["Recommended protocol", "Patient clinical summary", "Clinical considerations"],
    status: "pending",
  },
  {
    id: "consort-dose",
    name: "CONSORT Starting Dose Calculator",
    consumes: ["Recommended protocol", "Age", "BMI", "FSH", "AFC"],
    status: "pending",
  },
  {
    id: "dose-adjustment",
    name: "Dose Adjustment Engine",
    consumes: ["Recommended protocol", "Expected ovarian response", "Monitoring data"],
    status: "pending",
  },
  {
    id: "trigger-strategy",
    name: "Trigger Strategy Engine",
    consumes: ["Recommended protocol", "OHSS risk", "Expected ovarian response"],
    status: "pending",
  },
  {
    id: "freeze-all",
    name: "Freeze-All Decision Engine",
    consumes: ["Recommended protocol", "OHSS risk", "Endometrial findings"],
    status: "pending",
  },
];

export interface ProtocolRecommendationResult {
  patientId: string;
  patientName: string;
  summary: ProtocolClinicalSummary;
  considerations: ClinicalConsideration[];
  recommendation: ProtocolRecommendation;
  /** Modules whose output fed this view. */
  dataSources: { id: string; label: string; available: boolean; detail: string }[];
  computedAt: string;
  version: string;
}

/* ---------------------------------------------------------------- builder */

const str = (v: FieldValue): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

export function buildProtocolRecommendation(
  patientId: string,
  patientName: string,
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
): ProtocolRecommendationResult {
  const i = response.inputs;

  const summary: ProtocolClinicalSummary = {
    age: phenotype.patientSummary.age ?? i.age,
    diagnosis: phenotype.patientSummary.diagnosis,
    amh: phenotype.reserve.amh ?? i.amh,
    afc: phenotype.reserve.afc ?? i.afc,
    bmi: phenotype.patientSummary.bmi ?? i.bmi,
    poseidonGroup: phenotype.poseidon.groupLabel,
    poseidonStatus: phenotype.poseidon.headline,
    bolognaStatus: phenotype.bologna.headline,
    expectedResponse: responseCategoryLabel[response.category],
    majorRisks: response.risks
      .filter((r) => r.severity !== "info")
      .map((r) => r.label),
  };

  /* Considerations are restatements of recorded data or of an already
     published classification. No new clinical judgement is added. */
  const considerations: ClinicalConsideration[] = [];
  const add = (c: ClinicalConsideration) => {
    if (!considerations.some((x) => x.id === c.id)) considerations.push(c);
  };

  for (const r of response.risks)
    add({ id: `risk-${r.id}`, label: r.label, severity: r.severity, source: r.basis });

  if (phenotype.bologna.status === "positive")
    add({
      id: "bologna",
      label: "Reduced Ovarian Reserve / Bologna poor responder",
      severity: "high",
      source: "ESHRE Bologna criteria are fulfilled on the recorded data.",
    });

  if (phenotype.reserve.category === "reduced" || phenotype.reserve.category === "severely-reduced")
    add({
      id: "reserve",
      label: "Reduced Ovarian Reserve",
      severity: "moderate",
      source: `Recorded ovarian reserve markers are classified as ${phenotype.reserve.category.replace("-", " ")}.`,
    });

  if (i.pcos)
    add({
      id: "pcos",
      label: "PCOS",
      severity: "moderate",
      source: "PCOS is recorded in the cause of infertility.",
    });

  if (i.endometriosis)
    add({
      id: "endometriosis",
      label: "Endometriosis",
      severity: "info",
      source: "Endometriosis is recorded in the cause of infertility.",
    });

  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];
  const who = str(values["whoOverall"]);
  const azoo = str(values["azoospermia"]);
  if (causes.includes("Male Factor") || (azoo && azoo !== "No") || who)
    add({
      id: "male-factor",
      label: "Male Factor",
      severity: "info",
      source: [
        causes.includes("Male Factor") ? "Male factor recorded as a cause of infertility" : null,
        who ? `WHO classification ${who}` : null,
        azoo && azoo !== "No" ? `Azoospermia: ${azoo}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });

  if (i.ohssHistory)
    add({
      id: "ohss-history",
      label: "History of OHSS",
      severity: "high",
      source: `A previous cycle is recorded with OHSS (${i.ohssHistory}).`,
    });

  if (i.cycleSignals.some((c) => c.cancelled))
    add({
      id: "cancellation",
      label: "Previous Cycle Cancellation",
      severity: "moderate",
      source: "At least one previous stimulation cycle is recorded as cancelled.",
    });

  const endoThickness = toNum(values["endometrium"]);
  const dataSources = [
    {
      id: "assessment",
      label: "Patient assessment",
      available: Object.keys(values).length > 0,
      detail: `${Object.values(values).filter((v) => v !== "" && v !== null && v !== undefined).length} field(s) recorded`,
    },
    {
      id: "phenotype",
      label: "Patient Phenotype Engine",
      available: phenotype.phenotype !== "insufficient-data",
      detail: phenotype.phenotype.replace(/-/g, " "),
    },
    {
      id: "poseidon",
      label: "POSEIDON assessment",
      available: phenotype.poseidon.group !== null,
      detail: phenotype.poseidon.groupLabel ?? "Not classified",
    },
    {
      id: "bologna",
      label: "Bologna assessment",
      available: phenotype.bologna.status !== "incomplete",
      detail: phenotype.bologna.headline,
    },
    {
      id: "reserve",
      label: "Ovarian reserve assessment",
      available: phenotype.reserve.category !== "insufficient-data",
      detail: phenotype.reserve.category.replace(/-/g, " "),
    },
    {
      id: "response",
      label: "Ovarian response prediction",
      available: response.category !== "unable",
      detail: responseCategoryLabel[response.category],
    },
    {
      id: "cycles",
      label: "Previous IVF cycles",
      available: cycles.length > 0,
      detail: `${cycles.length} cycle record(s)`,
    },
    {
      id: "labs",
      label: "Laboratory results",
      available: i.amh !== null || i.fsh !== null || i.lh !== null || i.estradiol !== null,
      detail: [
        i.amh !== null ? `AMH ${i.amh}` : null,
        i.fsh !== null ? `FSH ${i.fsh}` : null,
        i.lh !== null ? `LH ${i.lh}` : null,
        i.estradiol !== null ? `E2 ${i.estradiol}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not recorded",
    },
    {
      id: "ultrasound",
      label: "Ultrasound findings",
      available: i.afc !== null || endoThickness !== null,
      detail: [
        i.afc !== null ? `AFC ${i.afc}` : null,
        endoThickness !== null ? `Endometrium ${endoThickness} mm` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Not recorded",
    },
  ];

  return {
    patientId,
    patientName,
    summary,
    considerations,
    recommendation: {
      status: "not-implemented",
      message: PROTOCOL_PENDING_MESSAGE,
      recommended: null,
      alternatives: [],
      evidenceSource: protocolEvidenceIds,
      explanation: {
        clinicalRationale: null,
        supportingVariables: [],
        evidenceUsed: [],
        guideline: null,
        publication: null,
        notes: null,
      },
    },
    dataSources,
    computedAt: new Date().toISOString(),
    version: PROTOCOL_ENGINE_VERSION,
  };
}

/** Plain-text block the physician can paste into the final report. */
export function protocolReportText(r: ProtocolRecommendationResult): string {
  const s = r.summary;
  return [
    "PROTOCOL RECOMMENDATION",
    `Patient: ${r.patientName}`,
    "",
    "Patient summary",
    `- Age: ${s.age ?? "Not recorded"}`,
    `- Diagnosis: ${s.diagnosis.length ? s.diagnosis.join(", ") : "Not recorded"}`,
    `- AMH: ${s.amh ?? "Not recorded"} | AFC: ${s.afc ?? "Not recorded"} | BMI: ${s.bmi ?? "Not recorded"}`,
    `- POSEIDON: ${s.poseidonGroup ?? s.poseidonStatus}`,
    `- Bologna: ${s.bolognaStatus}`,
    `- Expected ovarian response: ${s.expectedResponse}`,
    `- Major risks: ${s.majorRisks.length ? s.majorRisks.join(", ") : "None identified"}`,
    "",
    "Recommended protocol: Not available",
    "Alternative protocols: Not available",
    `Status: ${PROTOCOL_PENDING_MESSAGE}`,
    "",
    "Clinical considerations",
    ...(r.considerations.length
      ? r.considerations.map((c) => `- ${c.label} — ${c.source}`)
      : ["- None identified from the recorded data."]),
    "",
    "Clinical notes: (to be completed by the consultant)",
    `Generated ${new Date(r.computedAt).toLocaleString()} · Protocol Engine v${r.version}`,
  ].join("\n");
}
