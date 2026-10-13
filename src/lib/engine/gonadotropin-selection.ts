/**
 * Gonadotropin Selection Engine — framework only (V1).
 *
 * Aggregates the outputs of the implemented assessment engines plus the
 * recorded previous stimulation outcomes. It produces NO medication
 * selection, NO indication, NO contraindication and NO dose.
 * `selection.status` stays "not-implemented" until validated ESHRE / ASRM
 * decision rules are imported.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import type { PhenotypeResult } from "./phenotype";
import type { OvarianResponseResult } from "./ovarian-response";
import { responseCategoryLabel } from "./ovarian-response";
import type { ProtocolRecommendationResult } from "./protocol-recommendation";
import type { GonadotropinId } from "./gonadotropin-database";

export const GONADOTROPIN_ENGINE_VERSION = "0.1.0";

export const GONADOTROPIN_PENDING_MESSAGE =
  "Evidence-based medication selection rules will be activated after importing validated ESHRE and ASRM recommendations.";

export const gonadotropinEvidenceIds = [
  "eshre-2020-ovarian-stimulation",
  "asrm-2020-ovarian-reserve-testing",
  "poseidon-2016-alviggi",
];

/* --------------------------------------------------------------- summary */

export interface GonadotropinPatientSummary {
  age: number | null;
  bmi: number | null;
  diagnosis: string[];
  amh: number | null;
  afc: number | null;
  fsh: number | null;
  lh: number | null;
  poseidonGroup: string | null;
  bolognaStatus: string;
  expectedResponse: string;
  selectedProtocol: string;
  previousGonadotropin: string | null;
  previousOocyteYield: string | null;
  poorResponseHistory: boolean;
  hyperResponseHistory: boolean;
}

/* --------------------------------------------------- previous cycle review */

export interface PreviousCycleMedicationReview {
  id: string;
  label: string;
  medication: string | null;
  dailyDose: number | null;
  stimulationDays: number | null;
  peakEstradiol: number | null;
  follicleDevelopment: string | null;
  retrieved: number | null;
  mii: number | null;
  blastocysts: number | null;
  outcome: string;
}

/* ------------------------------------------------------------- selection */

export type SelectionStatus = "not-implemented" | "insufficient-data" | "available";

export const selectionStatusLabel: Record<SelectionStatus, string> = {
  "not-implemented": "Not yet available",
  "insufficient-data": "Insufficient data",
  available: "Available",
};

/** Reserved explanation surface. Every field stays empty in this release. */
export interface GonadotropinExplanation {
  whySelected: string | null;
  supportingCharacteristics: string[];
  supportingGuideline: string | null;
  supportingPublication: string | null;
  clinicalComments: string | null;
}

export interface GonadotropinSelection {
  status: SelectionStatus;
  message: string;
  /** Reserved — no medication is selected in this release. */
  recommended: GonadotropinId | null;
  /** Reserved — no alternative is proposed in this release. */
  alternatives: GonadotropinId[];
  evidenceSource: string[];
  explanation: GonadotropinExplanation;
}

export interface GonadotropinConsumerInterface {
  id: string;
  name: string;
  consumes: string[];
  status: "pending";
}

export const gonadotropinConsumerInterfaces: GonadotropinConsumerInterface[] = [
  {
    id: "consort-dose",
    name: "CONSORT Starting Dose Calculator",
    consumes: ["Selected gonadotropin", "Age", "BMI", "FSH", "AFC"],
    status: "pending",
  },
  {
    id: "dose-adjustment",
    name: "Dose Adjustment Engine",
    consumes: ["Selected gonadotropin", "Monitoring data", "Expected ovarian response"],
    status: "pending",
  },
  {
    id: "trigger-strategy",
    name: "Trigger Strategy Engine",
    consumes: ["Selected gonadotropin", "Stimulation protocol", "OHSS risk"],
    status: "pending",
  },
  {
    id: "freeze-all",
    name: "Freeze-All Decision Engine",
    consumes: ["Selected gonadotropin", "OHSS risk", "Endometrial findings"],
    status: "pending",
  },
  {
    id: "final-report",
    name: "Final Clinical Report",
    consumes: ["Patient summary", "Medication recommendation", "Alternative options", "Evidence"],
    status: "pending",
  },
];

export interface GonadotropinSelectionResult {
  patientId: string;
  patientName: string;
  summary: GonadotropinPatientSummary;
  cycleReview: PreviousCycleMedicationReview[];
  selection: GonadotropinSelection;
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

function cycleOutcome(c: CycleRecord): string {
  if (str(c["cancelled"]) === "Yes") return "Cycle cancelled";
  const parts: string[] = [];
  if (str(c["liveBirth"]) === "Yes") parts.push("Live birth");
  if (str(c["clinicalPregnancy"]) === "Yes") parts.push("Clinical pregnancy");
  if (str(c["miscarriage"]) === "Yes") parts.push("Miscarriage");
  const ohss = str(c["ohss"]);
  if (ohss && ohss !== "No") parts.push(`OHSS ${ohss.toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "Not recorded";
}

export function buildGonadotropinSelection(
  patientId: string,
  patientName: string,
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
  protocol: ProtocolRecommendationResult,
): GonadotropinSelectionResult {
  const i = response.inputs;

  const cycleReview: PreviousCycleMedicationReview[] = cycles.map((c, index) => ({
    id: c.id,
    label: `Cycle ${str(c["cycleNumber"]) ?? toNum(c["cycleNumber"]) ?? index + 1}${
      str(c["cycleYear"]) || toNum(c["cycleYear"]) ? ` — ${c["cycleYear"]}` : ""
    }`,
    medication: str(c["medication"]),
    dailyDose: toNum(c["startingDose"]),
    stimulationDays: toNum(c["duration"]),
    peakEstradiol: toNum(c["peakEstradiol"]),
    follicleDevelopment: str(c["follicleDevelopment"]),
    retrieved: toNum(c["retrieved"]),
    mii: toNum(c["mii"]),
    blastocysts: toNum(c["blastocysts"]),
    outcome: cycleOutcome(c),
  }));

  const lastWithMedication = [...cycleReview].reverse().find((c) => c.medication);
  const lastWithYield = [...cycleReview].reverse().find((c) => c.retrieved !== null);

  const summary: GonadotropinPatientSummary = {
    age: phenotype.patientSummary.age ?? i.age,
    bmi: phenotype.patientSummary.bmi ?? i.bmi,
    diagnosis: phenotype.patientSummary.diagnosis,
    amh: phenotype.reserve.amh ?? i.amh,
    afc: phenotype.reserve.afc ?? i.afc,
    fsh: phenotype.reserve.fsh ?? i.fsh,
    lh: i.lh,
    poseidonGroup: phenotype.poseidon.groupLabel,
    bolognaStatus: phenotype.bologna.headline,
    expectedResponse: responseCategoryLabel[response.category],
    selectedProtocol:
      protocol.recommendation.recommended === null
        ? "No protocol selected — protocol rules not implemented"
        : protocol.recommendation.recommended,
    previousGonadotropin: lastWithMedication?.medication ?? null,
    previousOocyteYield:
      lastWithYield && lastWithYield.retrieved !== null
        ? `${lastWithYield.retrieved} oocyte(s) — ${lastWithYield.label}`
        : null,
    poorResponseHistory: i.poorResponseHistory,
    hyperResponseHistory: i.hyperResponseHistory,
  };

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
      label: "Ovarian reserve",
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
      id: "protocol",
      label: "Protocol recommendation",
      available: protocol.recommendation.recommended !== null,
      detail: "Awaiting validated rules",
    },
    {
      id: "cycles",
      label: "Previous IVF cycles",
      available: cycles.length > 0,
      detail: `${cycles.length} cycle record(s)`,
    },
    {
      id: "outcomes",
      label: "Previous stimulation outcomes",
      available: cycleReview.some((c) => c.retrieved !== null || c.medication),
      detail: lastWithMedication?.medication
        ? `Last medication recorded: ${lastWithMedication.medication}`
        : "Not recorded",
    },
  ];

  return {
    patientId,
    patientName,
    summary,
    cycleReview,
    selection: {
      status: "not-implemented",
      message: GONADOTROPIN_PENDING_MESSAGE,
      recommended: null,
      alternatives: [],
      evidenceSource: gonadotropinEvidenceIds,
      explanation: {
        whySelected: null,
        supportingCharacteristics: [],
        supportingGuideline: null,
        supportingPublication: null,
        clinicalComments: null,
      },
    },
    dataSources,
    computedAt: new Date().toISOString(),
    version: GONADOTROPIN_ENGINE_VERSION,
  };
}

/** Plain-text block the physician can paste into the final report. */
export function gonadotropinReportText(r: GonadotropinSelectionResult): string {
  const s = r.summary;
  const na = "Not recorded";
  return [
    "GONADOTROPIN SELECTION",
    `Patient: ${r.patientName}`,
    "",
    "Patient summary",
    `- Age: ${s.age ?? na} | BMI: ${s.bmi ?? na}`,
    `- Diagnosis: ${s.diagnosis.length ? s.diagnosis.join(", ") : na}`,
    `- AMH: ${s.amh ?? na} | AFC: ${s.afc ?? na} | Basal FSH: ${s.fsh ?? na} | Basal LH: ${s.lh ?? na}`,
    `- POSEIDON: ${s.poseidonGroup ?? "Not classified"}`,
    `- Bologna: ${s.bolognaStatus}`,
    `- Expected ovarian response: ${s.expectedResponse}`,
    `- Stimulation protocol: ${s.selectedProtocol}`,
    `- Previous gonadotropin: ${s.previousGonadotropin ?? na}`,
    `- Previous oocyte yield: ${s.previousOocyteYield ?? na}`,
    `- History of poor response: ${s.poorResponseHistory ? "Yes" : "Not recorded"}`,
    `- History of hyper response: ${s.hyperResponseHistory ? "Yes" : "Not recorded"}`,
    "",
    "Medication recommendation: Not available",
    "Alternative options: Not available",
    `Status: ${GONADOTROPIN_PENDING_MESSAGE}`,
    "",
    "Previous cycle review",
    ...(r.cycleReview.length
      ? r.cycleReview.map(
          (c) =>
            `- ${c.label}: ${c.medication ?? na}, ${c.dailyDose ?? na} IU/day, ${c.stimulationDays ?? na} day(s), retrieved ${c.retrieved ?? na}, MII ${c.mii ?? na}, blastocysts ${c.blastocysts ?? na} — ${c.outcome}`,
        )
      : ["- No previous cycle recorded."]),
    "",
    "Clinical notes: (to be completed by the consultant)",
    `Generated ${new Date(r.computedAt).toLocaleString()} · Gonadotropin Engine v${r.version}`,
  ].join("\n");
}
