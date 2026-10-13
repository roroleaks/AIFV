/**
 * Gonadotropin Selection Engine (V1) — EVIDENCE REVIEW ONLY.
 *
 * Purpose: present, for the current patient, which gonadotropin PREPARATIONS
 * have an indexed evidence record, what those records studied, and how the
 * patient relates to the studied population — so the treating physician can
 * make and record the selection.
 *
 * HARD RULES enforced in code:
 *  - No gonadotropin is recommended, ranked or scored.
 *  - No dose, dose range, maximum dose, total dose or dose adjustment is
 *    produced. Previous doses are reproduced as HISTORICAL data only.
 *  - No trigger, OHSS, freeze-all or probability output is produced.
 *  - CONSORT stays EVIDENCE_PENDING; any CONSORT dose is firewalled to null
 *    and never re-derived from age, BMI, AMH, AFC, FSH, POSEIDON, Bologna,
 *    previous response or previous gonadotropin.
 *  - POSEIDON and Bologna are context only; neither is mapped to a medication.
 *  - Every clinical statement is either a recorded patient value or text
 *    traceable to an indexed Evidence Library entry.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import type { PhenotypeResult } from "./phenotype";
import { reserveCategoryLabel } from "./phenotype";
import type { OvarianResponseResult } from "./ovarian-response";
import { responseCategoryLabel } from "./ovarian-response";
import { bolognaStatusLabel } from "./bologna";
import { findEvidence } from "@/lib/evidence/library";
import {
  evaluateTreatmentGate,
  gatedTreatmentValue,
  HISTORICAL_VALUE_NOTICE,
  type AlgorithmStatus,
} from "./algorithm-status";
import { isConsortModelLoaded } from "./consort-model";
import type { EvidenceState } from "./protocol-selection";
import { evidenceStateLabel } from "./protocol-selection";

export const GONADOTROPIN_EVIDENCE_VERSION = "1.0.0";

export const GONADOTROPIN_EVIDENCE_NOTE =
  "Evidence review only. This engine does not recommend a gonadotropin, does not calculate any dose and does not adjust any dose. The medication decision is made and recorded by the treating physician.";

export const NOT_REPORTED = "Not reported in available source.";

const NOT_RECORDED = "Not recorded";

/* ---------------------------------------------------------- applicability */

export type Applicability =
  | "FULL_MATCH"
  | "PARTIAL_MATCH"
  | "LIMITED_APPLICABILITY"
  | "OUTSIDE_STUDIED_POPULATION"
  | "INSUFFICIENT_INFORMATION";

export const applicabilityLabel: Record<Applicability, string> = {
  FULL_MATCH: "Full match",
  PARTIAL_MATCH: "Partial match",
  LIMITED_APPLICABILITY: "Limited applicability",
  OUTSIDE_STUDIED_POPULATION: "Outside studied population",
  INSUFFICIENT_INFORMATION: "Insufficient information",
};

export const applicabilityTone: Record<Applicability, string> = {
  FULL_MATCH: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PARTIAL_MATCH: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  LIMITED_APPLICABILITY: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  OUTSIDE_STUDIED_POPULATION:
    "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  INSUFFICIENT_INFORMATION:
    "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

/* ---------------------------------------------------------------- options */

export type GonadotropinOptionId =
  | "recombinant-fsh"
  | "urinary-fsh"
  | "hp-urinary-fsh"
  | "hmg-menotropins";

export interface GonadotropinOutcomeRow {
  id: string;
  label: string;
  /** Only text transcribed from the indexed record, or NOT_REPORTED. */
  finding: string;
  reported: boolean;
}

export interface GonadotropinCitation {
  evidenceId: string;
  title: string;
  publication: string;
  year: number | null;
  doi: string | null;
  url: string | null;
  studyDesign: string;
  populationStudied: string;
  comparator: string;
  mainStatement: string;
  limitations: string[];
}

export interface GonadotropinApplicabilityCriterion {
  id: string;
  label: string;
  evidencePopulation: string;
  patientValue: string;
  state: EvidenceState;
  note: string;
}

export interface GonadotropinOptionAssessment {
  id: GonadotropinOptionId;
  name: string;
  category: string;
  preparation: string;
  description: string;
  populationStudied: string;
  studyDesigns: string[];
  comparator: string;
  primaryOutcomes: GonadotropinOutcomeRow[];
  secondaryOutcomes: GonadotropinOutcomeRow[];
  safetyOutcomes: GonadotropinOutcomeRow[];
  /** Only statements with a traceable source; empty when none is transcribed. */
  cautions: { text: string; source: string }[];
  limitations: string[];
  criteria: GonadotropinApplicabilityCriterion[];
  applicability: Applicability;
  applicabilityExplanation: string;
  /** Why this option appears in the review — never a recommendation. */
  whyConsidered: string[];
  evidenceState: EvidenceState;
  /** A transcribed selection rule. Always EVIDENCE_PENDING in V1. */
  algorithmStatus: AlgorithmStatus;
  previousExposureNote: string;
  citations: GonadotropinCitation[];
  missingEvidence: string[];
}

export interface GonadotropinComparisonRow {
  id: string;
  optionId: GonadotropinOptionId;
  name: string;
  evidencePopulation: string;
  studyType: string;
  clinicalOutcomes: string;
  safety: string;
  applicability: Applicability;
  evidenceState: EvidenceState;
}

/* --------------------------------------------------------------- context */

export interface GonadotropinContextItem {
  id: string;
  label: string;
  value: string;
  present: boolean;
  origin: string;
}

export interface GonadotropinContextGroup {
  id: string;
  title: string;
  items: GonadotropinContextItem[];
  recorded: number;
  total: number;
}

export interface PreviousGonadotropinExposure {
  id: string;
  label: string;
  gonadotropinType: string;
  brand: string;
  /** HISTORICAL values — never a recommendation. */
  startingDose: string;
  maxDose: string;
  doseChanges: string;
  totalDose: string;
  duration: string;
  protocol: string;
  follicles: string;
  retrieved: string;
  mii: string;
  twoPn: string;
  blastocysts: string;
  embryoQuality: string;
  pregnancy: string;
  liveBirth: string;
  ohss: string;
  cancelled: string;
  complications: string;
  outcome: string;
}

export interface GonadotropinMissingGroup {
  id: string;
  title: string;
  items: { id: string; label: string; stepId: string }[];
}

export interface GonadotropinDoseFirewall {
  startingDose: null;
  maximumDose: null;
  dailyDose: null;
  doseAdjustment: null;
  totalDose: null;
  statements: string[];
}

export interface GonadotropinConsortFirewall {
  status: AlgorithmStatus;
  modelLoaded: boolean;
  dose: null;
  doseDisplay: string;
  statements: string[];
}

export interface GonadotropinProtocolIntegration {
  protocolSelected: boolean;
  protocolName: string;
  protocolEvidenceStatus: string;
  protocolDecisionStatus: string;
  note: string;
}

export interface GonadotropinEvidenceResult {
  patientId: string;
  patientName: string;
  contextGroups: GonadotropinContextGroup[];
  poseidonGroup: string | null;
  poseidonHeadline: string;
  bolognaStatus: string;
  bolognaHeadline: string;
  reserveCategory: string;
  predictedResponse: string;
  observedResponse: string[];
  observedAvailable: boolean;
  previousExposure: PreviousGonadotropinExposure[];
  previousExposureNote: string;
  options: GonadotropinOptionAssessment[];
  comparison: GonadotropinComparisonRow[];
  patientEvidenceSummary: {
    phenotype: string[];
    relevantEvidence: string[];
    applicability: string[];
    limitations: string[];
  };
  missingInformation: GonadotropinMissingGroup[];
  evidenceGaps: { item: string; source: string; blocks: string }[];
  doseFirewall: GonadotropinDoseFirewall;
  consortFirewall: GonadotropinConsortFirewall;
  protocolIntegration: GonadotropinProtocolIntegration;
  evidenceSources: string[];
  /** Always empty — this engine emits no treatment value. */
  suppressedOutputs: string[];
  note: string;
  computedAt: string;
  version: string;
}

/* ---------------------------------------------------------------- helpers */

const s = (v: FieldValue): string | null => {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  const t = String(v).trim();
  return t === "" ? null : t;
};

const show = (v: string | number | null | undefined, unit?: string): string => {
  if (v === null || v === undefined || v === "") return NOT_RECORDED;
  return unit ? `${v} ${unit}` : String(v);
};

const cell = (c: CycleRecord, key: string): string => s(c[key]) ?? NOT_RECORDED;

/* ------------------------------------------- indexed gonadotropin records */

interface GonadotropinReference {
  id: GonadotropinOptionId;
  name: string;
  category: string;
  preparation: string;
  description: string;
  populationStudied: string;
  studyDesigns: string[];
  comparator: string;
  evidenceIds: string[];
  mainStatement: string;
  /** Cycle "Gonadotropin Type" values that map to this category. */
  recordedTypeMatches: string[];
  missingEvidence: string[];
}

/**
 * Only preparations that have at least one indexed evidence record are
 * offered. Recombinant LH, fixed FSH+LH combinations and corifollitropin
 * alfa are deliberately NOT offered as selectable categories: no comparative
 * record for them is indexed in the Evidence Library.
 */
export const gonadotropinReferences: GonadotropinReference[] = [
  {
    id: "recombinant-fsh",
    name: "Recombinant FSH (rFSH)",
    category: "Recombinant FSH",
    preparation: "Recombinant follitropin for subcutaneous injection",
    description:
      "Recombinant follicle stimulating hormone without LH activity, used for multifollicular stimulation in IVF/ICSI.",
    populationStudied:
      "Women undergoing IVF/ICSI ovarian stimulation, as covered by the scope of the indexed ESHRE ovarian stimulation guideline records.",
    studyDesigns: ["Guideline (scope record indexed)"],
    comparator:
      "Urinary FSH and hMG preparations are named within the guideline scope; the head-to-head comparison tables are not transcribed.",
    evidenceIds: ["eshre-2020-ovarian-stimulation", "eshre-2025-ovarian-stimulation-update"],
    mainStatement:
      "The indexed ESHRE ovarian stimulation guideline records cover gonadotrophin preparations including recombinant FSH within their stated scope. The recommendation and comparison tables are not transcribed into the Evidence Library.",
    recordedTypeMatches: ["Recombinant FSH", "Recombinant FSH + hMG", "Recombinant FSH + LH"],
    missingEvidence: [
      "ESHRE ovarian stimulation guideline — gonadotrophin preparation recommendation table (full text not transcribed).",
      "Head-to-head rFSH vs hMG comparative outcome data (e.g. a systematic review / meta-analysis record) — not indexed.",
      "Population-specific statement for POSEIDON groups or Bologna poor responders — not transcribed.",
    ],
  },
  {
    id: "urinary-fsh",
    name: "Urinary FSH (uFSH)",
    category: "Urinary FSH",
    preparation: "Urine-derived follitropin (purified) for subcutaneous or intramuscular injection",
    description:
      "Urine-derived follicle stimulating hormone used for multifollicular stimulation in IVF/ICSI.",
    populationStudied:
      "Women undergoing IVF/ICSI ovarian stimulation, as covered by the scope of the indexed ESHRE ovarian stimulation guideline records.",
    studyDesigns: ["Guideline (scope record indexed)"],
    comparator:
      "Recombinant FSH; the head-to-head comparison tables are not transcribed into the Evidence Library.",
    evidenceIds: ["eshre-2020-ovarian-stimulation", "eshre-2025-ovarian-stimulation-update"],
    mainStatement:
      "The indexed ESHRE ovarian stimulation guideline records cover urinary gonadotrophin preparations within their stated scope. No comparative outcome table is transcribed.",
    recordedTypeMatches: ["Urinary FSH"],
    missingEvidence: [
      "ESHRE ovarian stimulation guideline — gonadotrophin preparation recommendation table (full text not transcribed).",
      "Comparative uFSH vs rFSH outcome data — not indexed.",
    ],
  },
  {
    id: "hp-urinary-fsh",
    name: "Highly purified urinary FSH (HP-uFSH)",
    category: "Highly purified urinary FSH",
    preparation: "Highly purified urine-derived follitropin for subcutaneous injection",
    description:
      "Highly purified urine-derived follicle stimulating hormone used for multifollicular stimulation in IVF/ICSI.",
    populationStudied:
      "Women undergoing IVF/ICSI ovarian stimulation, as covered by the scope of the indexed ESHRE ovarian stimulation guideline records.",
    studyDesigns: ["Guideline (scope record indexed)"],
    comparator:
      "Recombinant FSH and hMG; the head-to-head comparison tables are not transcribed into the Evidence Library.",
    evidenceIds: ["eshre-2020-ovarian-stimulation", "eshre-2025-ovarian-stimulation-update"],
    mainStatement:
      "The indexed ESHRE ovarian stimulation guideline records cover highly purified urinary gonadotrophin preparations within their stated scope. No comparative outcome table is transcribed.",
    recordedTypeMatches: ["Urinary FSH"],
    missingEvidence: [
      "ESHRE ovarian stimulation guideline — gonadotrophin preparation recommendation table (full text not transcribed).",
      "Comparative HP-uFSH outcome data — not indexed.",
    ],
  },
  {
    id: "hmg-menotropins",
    name: "hMG / menotropins",
    category: "Human menopausal gonadotropin",
    preparation: "Menotropins (FSH + LH activity), including highly purified hMG",
    description:
      "Human menopausal gonadotropin containing both FSH and LH activity, used for multifollicular stimulation in IVF/ICSI.",
    populationStudied:
      "Women undergoing IVF/ICSI ovarian stimulation, as covered by the scope of the indexed ESHRE ovarian stimulation guideline records (HMG is an indexed topic tag of those records).",
    studyDesigns: ["Guideline (scope record indexed)"],
    comparator:
      "Recombinant FSH; the head-to-head comparison tables are not transcribed into the Evidence Library.",
    evidenceIds: ["eshre-2020-ovarian-stimulation", "eshre-2025-ovarian-stimulation-update"],
    mainStatement:
      "The indexed ESHRE ovarian stimulation guideline records list HMG within their indexed topics and cover it in scope. No comparative outcome table or preparation recommendation is transcribed.",
    recordedTypeMatches: ["hMG", "Recombinant FSH + hMG"],
    missingEvidence: [
      "ESHRE ovarian stimulation guideline — gonadotrophin preparation recommendation table (full text not transcribed).",
      "Head-to-head hMG vs rFSH comparative outcome data (systematic review / meta-analysis) — not indexed.",
      "Any statement mapping POSEIDON group or Bologna poor-responder status to a preparation — not indexed.",
    ],
  },
];

const outcomeRows = (labels: [string, string][]): GonadotropinOutcomeRow[] =>
  labels.map(([id, label]) => ({ id, label, finding: NOT_REPORTED, reported: false }));

const PRIMARY_OUTCOME_LABELS: [string, string][] = [
  ["live-birth", "Live birth"],
  ["ongoing-pregnancy", "Ongoing pregnancy"],
  ["clinical-pregnancy", "Clinical pregnancy"],
];

const SECONDARY_OUTCOME_LABELS: [string, string][] = [
  ["oocytes", "Number of oocytes retrieved"],
  ["mature-oocytes", "Mature (MII) oocytes"],
  ["embryology", "Embryological outcomes"],
  ["total-gonadotropin", "Total gonadotropin consumption"],
  ["duration", "Duration of stimulation"],
  ["cancellation", "Cycle cancellation"],
];

const SAFETY_OUTCOME_LABELS: [string, string][] = [
  ["ohss", "OHSS"],
  ["adverse-events", "Adverse events"],
  ["local-reactions", "Local / systemic reactions"],
];

function citationsFor(ref: GonadotropinReference): GonadotropinCitation[] {
  return ref.evidenceIds
    .map((id) => {
      const e = findEvidence(id);
      if (!e) return null;
      const citation: GonadotropinCitation = {
        evidenceId: e.id,
        title: e.title,
        publication: [e.journal, e.volume, e.issue ? `(${e.issue})` : null, e.pages]
          .filter(Boolean)
          .join(" "),
        year: e.year ?? null,
        doi: e.doi ?? null,
        url: e.url ?? (e.doi ? `https://doi.org/${e.doi}` : null),
        studyDesign: e.type,
        populationStudied: ref.populationStudied,
        comparator: ref.comparator,
        mainStatement: e.summary || ref.mainStatement,
        limitations: [
          "Bibliographic record indexed; preparation-level recommendation tables are not transcribed.",
          "No outcome estimate for this preparation is available in the Evidence Library.",
        ],
      };
      return citation;
    })
    .filter((c): c is GonadotropinCitation => Boolean(c));
}

/* ------------------------------------------------------------------ engine */

export function buildGonadotropinEvidenceReview(
  patientId: string,
  patientName: string,
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
  options?: {
    protocolName?: string | null;
    protocolEvidenceStatus?: string;
    protocolDecisionStatus?: string;
    consortDoseFromStore?: number | null;
  },
): GonadotropinEvidenceResult {
  const i = response.inputs;
  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

  /* ------------------------------------------------------------- context */

  const item = (
    id: string,
    label: string,
    value: string | number | null | undefined,
    origin: string,
    unit?: string,
  ): GonadotropinContextItem => ({
    id,
    label,
    value: show(value ?? null, unit),
    present: value !== null && value !== undefined && value !== "",
    origin,
  });

  const group = (
    id: string,
    title: string,
    items: GonadotropinContextItem[],
  ): GonadotropinContextGroup => ({
    id,
    title,
    items,
    recorded: items.filter((x) => x.present).length,
    total: items.length,
  });

  const contextGroups: GonadotropinContextGroup[] = [
    group("demographics", "Demographics", [
      item("age", "Age", phenotype.patientSummary.age, "Patient dataset", "years"),
      item("bmi", "BMI", phenotype.patientSummary.bmi, "Derived (height, weight)", "kg/m²"),
      item("height", "Height", toNum(values["height"]), "Assessment", "cm"),
      item("weight", "Weight", toNum(values["weight"]), "Assessment", "kg"),
      item(
        "duration",
        "Infertility duration",
        phenotype.patientSummary.infertilityDurationMonths,
        "Assessment",
        "months",
      ),
      item("infertility-type", "Infertility type", s(values["infertilityType"]), "Assessment"),
    ]),
    group("reserve", "Ovarian reserve", [
      item("amh", "AMH", i.amh, "Assessment", "ng/mL"),
      item("afc", "Antral follicle count", i.afc, "Ultrasound"),
      item("fsh", "Basal FSH", i.fsh, "Assessment", "IU/L"),
      item("lh", "Basal LH", i.lh, "Assessment", "IU/L"),
      item("e2", "Basal estradiol", i.estradiol, "Assessment", "pg/mL"),
    ]),
    group("phenotype", "Ovarian phenotype", [
      item("poseidon", "POSEIDON group", phenotype.poseidon.groupLabel, "POSEIDON Engine"),
      item(
        "bologna",
        "Bologna status",
        bolognaStatusLabel[phenotype.bologna.status],
        "Bologna Engine",
      ),
      item(
        "reserve-category",
        "Ovarian reserve category",
        reserveCategoryLabel[phenotype.reserve.category],
        "Phenotype Engine",
      ),
      item(
        "predicted",
        "Predicted ovarian response",
        responseCategoryLabel[response.category],
        "Ovarian Response Engine",
      ),
      item(
        "observed",
        "Previous observed response",
        i.cycleSignals.some((c) => c.retrieved !== null)
          ? i.cycleSignals
              .filter((c) => c.retrieved !== null)
              .map((c) => `${c.cycleLabel}: ${c.retrieved} oocyte(s)`)
              .join(" · ")
          : null,
        "Previous cycle records (historical)",
      ),
    ]),
    group("etiology", "Infertility etiology", [
      item("causes", "Recorded causes", causes.length ? causes.join(", ") : null, "Assessment"),
      item("male-factor", "Male factor", s(values["maleFactorSeverity"]) ?? s(values["semenResult"]), "Assessment"),
      item("pcos", "PCOS", i.pcos ? "Yes" : null, "Assessment"),
      item("endometriosis", "Endometriosis", i.endometriosis ? "Yes" : null, "Assessment"),
    ]),
    group("medical", "Medical factors", [
      item("ohss-history", "Previous OHSS", i.ohssHistory, "Assessment"),
      item("ovarian-surgery", "Previous ovarian surgery", s(values["ovarianSurgery"]), "Assessment"),
      item("comorbidities", "Relevant comorbidities", s(values["medicalConditions"]), "Assessment"),
      item("smoking", "Smoking", i.smoking, "Assessment"),
    ]),
  ];

  /* -------------------------------------------- previous exposure (history) */

  const previousExposure: PreviousGonadotropinExposure[] = cycles.map((c, index) => {
    const cancelled = s(c["cancelled"]) === "Yes";
    const parts: string[] = [];
    if (cancelled) parts.push("Cycle cancelled");
    if (s(c["liveBirth"]) === "Yes") parts.push("Live birth");
    if (s(c["clinicalPregnancy"]) === "Yes") parts.push("Clinical pregnancy");
    if (s(c["miscarriage"]) === "Yes") parts.push("Miscarriage");
    const ohss = s(c["ohss"]);
    if (ohss && ohss !== "No") parts.push(`OHSS ${ohss.toLowerCase()}`);

    return {
      id: c.id ?? `cycle-${index + 1}`,
      label: `Cycle ${s(c["cycleNumber"]) ?? index + 1}${s(c["cycleYear"]) ? ` — ${s(c["cycleYear"])}` : ""}`,
      gonadotropinType: cell(c, "gonadotropinType"),
      brand: cell(c, "medication"),
      startingDose: s(c["startingDose"]) ? `${s(c["startingDose"])} IU/day` : NOT_RECORDED,
      maxDose: s(c["maxDose"]) ? `${s(c["maxDose"])} IU/day` : NOT_RECORDED,
      doseChanges: cell(c, "doseChanges"),
      totalDose: s(c["totalDose"]) ? `${s(c["totalDose"])} IU` : NOT_RECORDED,
      duration: s(c["duration"]) ? `${s(c["duration"])} day(s)` : NOT_RECORDED,
      protocol: cell(c, "protocol"),
      follicles: cell(c, "folliclesTotal"),
      retrieved: cell(c, "retrieved"),
      mii: cell(c, "mii"),
      twoPn: cell(c, "twoPn"),
      blastocysts: cell(c, "blastocysts"),
      embryoQuality: cell(c, "embryoGrades"),
      pregnancy: cell(c, "clinicalPregnancy"),
      liveBirth: cell(c, "liveBirth"),
      ohss: cell(c, "ohss"),
      cancelled: cell(c, "cancelled"),
      complications: cell(c, "complications"),
      outcome: parts.length ? parts.join(" · ") : NOT_RECORDED,
    };
  });

  const recordedTypes = previousExposure
    .map((p) => p.gonadotropinType)
    .filter((t) => t !== NOT_RECORDED);

  const previousExposureNote = previousExposure.length
    ? `${HISTORICAL_VALUE_NOTICE} Previous doses shown here are historical patient data, not a recommended dose. Differences between cycles are described only; no causal effect of a preparation on the observed response is inferred, because no transcribed evidence supports such an inference for an individual patient.`
    : "No previous stimulation cycle is recorded for this patient.";

  /* ----------------------------------------------------------- applicability */

  const populationKnown = phenotype.patientSummary.age !== null;
  const poorResponderContext =
    phenotype.poseidon.group !== null || phenotype.bologna.status === "positive";

  const buildOption = (ref: GonadotropinReference): GonadotropinOptionAssessment => {
    const usedPreviously = recordedTypes.some((t) => ref.recordedTypeMatches.includes(t));

    const criteria: GonadotropinApplicabilityCriterion[] = [
      {
        id: "population",
        label: "Population studied",
        evidencePopulation: ref.populationStudied,
        patientValue: populationKnown
          ? `Woman aged ${phenotype.patientSummary.age} planned for IVF/ICSI stimulation`
          : "Age not recorded",
        state: populationKnown ? "EVIDENCE_SUPPORTED" : "EVIDENCE_INSUFFICIENT",
        note: populationKnown
          ? "The patient falls within the broad IVF/ICSI population covered by the indexed records."
          : "Age is required before population membership can be described.",
      },
      {
        id: "subgroup",
        label: "Subgroup statement (POSEIDON / Bologna)",
        evidencePopulation:
          "No preparation-level subgroup statement for POSEIDON groups or Bologna poor responders is transcribed.",
        patientValue: `POSEIDON: ${phenotype.poseidon.groupLabel ?? "Not classified"} · Bologna: ${bolognaStatusLabel[phenotype.bologna.status]}`,
        state: poorResponderContext ? "OUTSIDE_STUDIED_POPULATION" : "EVIDENCE_INSUFFICIENT",
        note: "POSEIDON and Bologna are shown as patient context; neither is mapped to a preparation.",
      },
      {
        id: "comparative-outcome",
        label: "Comparative outcome evidence for this preparation",
        evidencePopulation:
          "No head-to-head comparative outcome table for this preparation is transcribed in the Evidence Library.",
        patientValue: "Not applicable — no comparative estimate loaded",
        state: "EVIDENCE_PENDING",
        note: "Outcome comparisons remain unavailable until the comparative source is indexed.",
      },
      {
        id: "previous-exposure",
        label: "Previous exposure to this preparation",
        evidencePopulation:
          "No evidence statement links a previous individual response to a subsequent preparation choice.",
        patientValue: usedPreviously
          ? `Recorded in a previous cycle (${recordedTypes.join(", ")})`
          : recordedTypes.length
            ? `Not recorded for this patient; previously recorded: ${recordedTypes.join(", ")}`
            : "No previous gonadotropin recorded",
        state: "EVIDENCE_INSUFFICIENT",
        note: "Previous exposure is descriptive history. No conclusion that a medication should be changed or repeated is drawn.",
      },
      {
        id: "selection-rule",
        label: "Gonadotropin selection recommendation rule",
        evidencePopulation:
          "ESHRE / ASRM gonadotrophin preparation recommendation tables are not transcribed.",
        patientValue: "Not applicable — no rule loaded",
        state: "EVIDENCE_PENDING",
        note: "No preparation can be recommended until the recommendation tables are loaded.",
      },
    ];

    const applicability: Applicability = !populationKnown
      ? "INSUFFICIENT_INFORMATION"
      : poorResponderContext
        ? "LIMITED_APPLICABILITY"
        : "PARTIAL_MATCH";

    const applicabilityExplanation = !populationKnown
      ? "Applicability cannot be described: the core patient variables (age) are not recorded."
      : poorResponderContext
        ? `The patient belongs to the broad IVF/ICSI population covered by the indexed records, but her profile (${phenotype.poseidon.groupLabel ?? "no POSEIDON group"}; Bologna ${bolognaStatusLabel[phenotype.bologna.status]}) sits in a subgroup for which no preparation-level statement is transcribed. Applicability is therefore limited.`
        : "The patient belongs to the broad IVF/ICSI population covered by the indexed records, but no preparation-level comparison is transcribed, so applicability is partial only.";

    const whyConsidered = [
      `${ref.name} has an indexed Evidence Library record covering it within the scope of the indexed source(s).`,
      populationKnown
        ? "The patient is planned for IVF/ICSI ovarian stimulation, which is the population of those records."
        : "Patient population membership cannot be confirmed until age is recorded.",
      usedPreviously
        ? "A previous cycle recorded this preparation category — shown as history only."
        : "No previous cycle recorded this preparation category.",
      options?.protocolName
        ? `Current protocol context: ${options.protocolName}.`
        : "Protocol not yet selected — the review is not protocol-specific.",
    ];

    return {
      id: ref.id,
      name: ref.name,
      category: ref.category,
      preparation: ref.preparation,
      description: ref.description,
      populationStudied: ref.populationStudied,
      studyDesigns: ref.studyDesigns,
      comparator: ref.comparator,
      primaryOutcomes: outcomeRows(PRIMARY_OUTCOME_LABELS),
      secondaryOutcomes: outcomeRows(SECONDARY_OUTCOME_LABELS),
      safetyOutcomes: outcomeRows(SAFETY_OUTCOME_LABELS),
      cautions: [],
      limitations: [
        "Bibliographic scope record only — no preparation-level recommendation or outcome estimate is transcribed.",
        "No subgroup statement for POSEIDON groups, Bologna poor responders, PCOS or previous OHSS is transcribed.",
        "No contraindication or caution is displayed because none is transcribed from an indexed source.",
      ],
      criteria,
      applicability,
      applicabilityExplanation,
      whyConsidered,
      evidenceState: "EVIDENCE_PENDING",
      algorithmStatus: "EVIDENCE_PENDING",
      previousExposureNote: usedPreviously
        ? "This preparation category appears in the patient's previous cycle records (historical data)."
        : "This preparation category does not appear in the patient's previous cycle records.",
      citations: citationsFor(ref),
      missingEvidence: ref.missingEvidence,
    };
  };

  const optionList = gonadotropinReferences.map(buildOption);

  const comparison: GonadotropinComparisonRow[] = optionList.map((o) => ({
    id: `cmp-${o.id}`,
    optionId: o.id,
    name: o.name,
    evidencePopulation: o.populationStudied,
    studyType: o.studyDesigns.join(", "),
    clinicalOutcomes: NOT_REPORTED,
    safety: NOT_REPORTED,
    applicability: o.applicability,
    evidenceState: o.evidenceState,
  }));

  /* ------------------------------------------------- missing information */

  const missing = (
    id: string,
    title: string,
    entries: { id: string; label: string; stepId: string; present: boolean }[],
  ): GonadotropinMissingGroup => ({
    id,
    title,
    items: entries.filter((e) => !e.present).map(({ id: eid, label, stepId }) => ({ id: eid, label, stepId })),
  });

  const missingInformation: GonadotropinMissingGroup[] = [
    missing("applicability", "Required for evidence applicability", [
      { id: "m-age", label: "Age / date of birth", stepId: "patient", present: phenotype.patientSummary.age !== null },
      { id: "m-bmi", label: "Height and weight (BMI)", stepId: "patient", present: phenotype.patientSummary.bmi !== null },
    ]),
    missing("context", "Required for patient context", [
      { id: "m-amh", label: "AMH", stepId: "reserve", present: i.amh !== null },
      { id: "m-afc", label: "Antral follicle count", stepId: "ultrasound", present: i.afc !== null },
      { id: "m-fsh", label: "Basal FSH", stepId: "reserve", present: i.fsh !== null },
      { id: "m-causes", label: "Cause of infertility", stepId: "cause", present: causes.length > 0 },
    ]),
    missing("previous-cycles", "Previous-cycle information", [
      { id: "m-cycles", label: "Previous cycle records", stepId: "cycles", present: cycles.length > 0 },
      {
        id: "m-gonadotropin-type",
        label: "Gonadotropin type used in previous cycles",
        stepId: "cycles",
        present: cycles.length === 0 || recordedTypes.length > 0,
      },
      {
        id: "m-previous-yield",
        label: "Oocyte yield of previous cycles",
        stepId: "cycles",
        present: cycles.length === 0 || previousExposure.some((p) => p.retrieved !== NOT_RECORDED),
      },
    ]),
    missing("safety", "Safety information", [
      { id: "m-ohss-history", label: "Previous OHSS status", stepId: "medical", present: i.ohssHistory !== null },
      {
        id: "m-complications",
        label: "Complications recorded for previous cycles",
        stepId: "cycles",
        present: cycles.length === 0 || previousExposure.some((p) => p.complications !== NOT_RECORDED),
      },
    ]),
    missing("optional", "Optional information", [
      { id: "m-lh", label: "Basal LH", stepId: "reserve", present: i.lh !== null },
      { id: "m-e2", label: "Basal estradiol", stepId: "reserve", present: i.estradiol !== null },
      {
        id: "m-total-dose",
        label: "Total gonadotropin exposure of previous cycles",
        stepId: "cycles",
        present: cycles.length === 0 || previousExposure.some((p) => p.totalDose !== NOT_RECORDED),
      },
    ]),
  ].filter((g) => g.items.length > 0);

  /* -------------------------------------------------------- dose firewall */

  const doseFirewall: GonadotropinDoseFirewall = {
    startingDose: null,
    maximumDose: null,
    dailyDose: null,
    doseAdjustment: null,
    totalDose: null,
    statements: [
      "The Gonadotropin Selection Engine never calculates a starting dose, maximum dose, daily dose, total dose or dose adjustment.",
      "Doses displayed in the previous-exposure panel are HISTORICAL patient-entered values, not recommendations.",
      "No trigger, OHSS, freeze-all, pregnancy probability or success probability is produced here.",
    ],
  };

  const consortGate = evaluateTreatmentGate("consort-dose");
  // Hard firewall: any stored dose is passed through the treatment gate,
  // which returns null while CONSORT is EVIDENCE_PENDING, and is then
  // discarded entirely — no CONSORT value enters this engine.
  void gatedTreatmentValue("consort-dose", options?.consortDoseFromStore ?? null);

  const consortFirewall: GonadotropinConsortFirewall = {
    status: consortGate.status,
    modelLoaded: isConsortModelLoaded(),
    dose: null,
    doseDisplay: "—",
    statements: [
      `CONSORT status: ${consortGate.statusLabel}.`,
      "consortModelTable.loaded = false — validated coefficients and dose crosswalk are not loaded.",
      "CONSORT dose = null; recommended dose = null.",
      "No dose is reverse-engineered from age, BMI, AMH, AFC, FSH, POSEIDON, Bologna, previous response or previous gonadotropin.",
    ],
  };

  /* --------------------------------------------------- protocol integration */

  const protocolIntegration: GonadotropinProtocolIntegration = {
    protocolSelected: Boolean(options?.protocolName),
    protocolName: options?.protocolName ?? "Protocol not yet selected.",
    protocolEvidenceStatus: options?.protocolEvidenceStatus ?? "Evidence Pending",
    protocolDecisionStatus: options?.protocolDecisionStatus ?? "No physician protocol decision recorded",
    note: "Gonadotropin review never changes the protocol. The protocol is set only in the Protocol Selection Engine.",
  };

  /* ------------------------------------------------------- summary panel */

  const observedResponse = previousExposure
    .filter((p) => p.retrieved !== NOT_RECORDED)
    .map((p) => `${p.label}: ${p.retrieved} oocyte(s) retrieved, MII ${p.mii}, blastocysts ${p.blastocysts} — ${p.outcome}`);

  const evidenceSources = Array.from(
    new Set(optionList.flatMap((o) => o.citations.map((c) => c.evidenceId))),
  );

  const patientEvidenceSummary = {
    phenotype: [
      `POSEIDON: ${phenotype.poseidon.groupLabel ?? phenotype.poseidon.headline}`,
      `Bologna: ${bolognaStatusLabel[phenotype.bologna.status]}`,
      `Ovarian reserve: ${reserveCategoryLabel[phenotype.reserve.category]}`,
      `Predicted ovarian response: ${responseCategoryLabel[response.category]}`,
      recordedTypes.length
        ? `Previous gonadotropin exposure (historical): ${recordedTypes.join(", ")}`
        : "No previous gonadotropin exposure recorded",
    ],
    relevantEvidence: evidenceSources.map((id) => findEvidence(id)?.title ?? id),
    applicability: optionList.map(
      (o) => `${o.name}: ${applicabilityLabel[o.applicability]} — ${o.applicabilityExplanation}`,
    ),
    limitations: [
      "No gonadotropin preparation recommendation table is transcribed into the Evidence Library.",
      "No head-to-head comparative outcome data for gonadotropin preparations is indexed; every outcome cell reads “Not reported in available source.”",
      "POSEIDON group and Bologna status are context only; no indexed source maps them to a preparation.",
      "Physician decision required: the application does not select a medication.",
    ],
  };

  const evidenceGaps = [
    {
      item: "ESHRE ovarian stimulation guideline — gonadotrophin preparation recommendation table",
      source: "ESHRE guideline 2020 / update 2025 (full text)",
      blocks: "No preparation may be recommended for any population until the table is transcribed.",
    },
    {
      item: "Head-to-head comparative outcome data (rFSH vs hMG vs uFSH / HP-uFSH)",
      source: "Systematic review / meta-analysis — not indexed",
      blocks: "All outcome cells remain “Not reported in available source.”",
    },
    {
      item: "Preparation statement for POSEIDON groups and Bologna poor responders",
      source: "POSEIDON / ESHRE publications — not transcribed",
      blocks: "Subgroup applicability can only be described, not recommended.",
    },
  ];

  return {
    patientId,
    patientName,
    contextGroups,
    poseidonGroup: phenotype.poseidon.groupLabel,
    poseidonHeadline: phenotype.poseidon.headline,
    bolognaStatus: bolognaStatusLabel[phenotype.bologna.status],
    bolognaHeadline: phenotype.bologna.headline,
    reserveCategory: reserveCategoryLabel[phenotype.reserve.category],
    predictedResponse: responseCategoryLabel[response.category],
    observedResponse,
    observedAvailable: observedResponse.length > 0,
    previousExposure,
    previousExposureNote,
    options: optionList,
    comparison,
    patientEvidenceSummary,
    missingInformation,
    evidenceGaps,
    doseFirewall,
    consortFirewall,
    protocolIntegration,
    evidenceSources,
    suppressedOutputs: [],
    note: GONADOTROPIN_EVIDENCE_NOTE,
    computedAt: new Date().toISOString(),
    version: GONADOTROPIN_EVIDENCE_VERSION,
  };
}

/* ------------------------------------------------------------ report text */

export function gonadotropinEvidenceReportText(
  r: GonadotropinEvidenceResult,
  decision?: { label: string; gonadotropin: string | null; note: string } | null,
): string {
  return [
    "GONADOTROPIN EVIDENCE REVIEW",
    `Patient: ${r.patientName}`,
    "",
    "Patient phenotype",
    ...r.patientEvidenceSummary.phenotype.map((p) => `- ${p}`),
    "",
    `Current protocol: ${r.protocolIntegration.protocolName} (protocol evidence: ${r.protocolIntegration.protocolEvidenceStatus}; decision: ${r.protocolIntegration.protocolDecisionStatus})`,
    "",
    "Previous gonadotropin exposure (historical patient-entered values — NOT recommendations)",
    ...(r.previousExposure.length
      ? r.previousExposure.map(
          (p) =>
            `- ${p.label}: ${p.gonadotropinType} (${p.brand}), starting ${p.startingDose}, max ${p.maxDose}, duration ${p.duration}, retrieved ${p.retrieved}, MII ${p.mii}, blastocysts ${p.blastocysts} — ${p.outcome}`,
        )
      : ["- No previous stimulation cycle recorded."]),
    "",
    "Gonadotropin options reviewed",
    ...r.options.flatMap((o) => [
      `- ${o.name} — evidence: ${evidenceStateLabel[o.evidenceState]}; applicability: ${applicabilityLabel[o.applicability]}; selection rule: Evidence Pending`,
      `  Population studied: ${o.populationStudied}`,
      `  Clinical outcomes: ${NOT_REPORTED} · Safety: ${NOT_REPORTED}`,
    ]),
    "",
    "Evidence limitations",
    ...r.patientEvidenceSummary.limitations.map((l) => `- ${l}`),
    "",
    "Missing information",
    ...(r.missingInformation.length
      ? r.missingInformation.flatMap((g) => [`- ${g.title}:`, ...g.items.map((it) => `  · ${it.label}`)])
      : ["- None."]),
    "",
    `Dose firewall: ${r.doseFirewall.statements.join(" ")}`,
    `CONSORT firewall: ${r.consortFirewall.statements.join(" ")}`,
    "",
    `Physician gonadotropin decision: ${decision ? decision.label : "Not recorded"}${
      decision?.gonadotropin ? ` — ${decision.gonadotropin}` : ""
    }`,
    decision?.note ? `Decision note: ${decision.note}` : "",
    "",
    r.note,
    `Generated ${new Date(r.computedAt).toLocaleString()} · Gonadotropin Evidence Review v${r.version}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
