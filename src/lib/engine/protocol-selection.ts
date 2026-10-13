/**
 * Protocol Selection Engine (V1) — EVIDENCE REVIEW ONLY.
 *
 * This engine organises the canonical patient dataset and the indexed evidence
 * so a specialist can review which ovarian stimulation protocol OPTIONS are
 * documented in the Evidence Library and how the current patient relates to
 * the population each source studied.
 *
 * HARD RULES enforced in code:
 *  - No protocol is recommended, ranked or scored.
 *  - No gonadotropin is selected.
 *  - No dose, dose range or dose adjustment is produced.
 *  - CONSORT stays EVIDENCE_PENDING; any CONSORT dose is firewalled to null.
 *  - Every statement is either a recorded patient value or text traceable to
 *    an indexed Evidence Library entry.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import type { PatientContext } from "@/lib/clinical/data-mapping";
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

export const PROTOCOL_SELECTION_VERSION = "1.0.0";

export const PROTOCOL_SELECTION_NOTE =
  "Evidence review only. This engine does not recommend a protocol, a gonadotropin or a dose. Protocol selection rules activate only after the validated guideline recommendation tables are transcribed into the Evidence Library.";

/* ------------------------------------------------------------------ states */

export type EvidenceState =
  | "EVIDENCE_SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "OUTSIDE_STUDIED_POPULATION"
  | "EVIDENCE_INSUFFICIENT"
  | "EVIDENCE_PENDING";

export const evidenceStateLabel: Record<EvidenceState, string> = {
  EVIDENCE_SUPPORTED: "Evidence supported",
  PARTIALLY_SUPPORTED: "Partially supported",
  OUTSIDE_STUDIED_POPULATION: "Outside studied population",
  EVIDENCE_INSUFFICIENT: "Evidence insufficient",
  EVIDENCE_PENDING: "Evidence pending",
};

export const evidenceStateTone: Record<EvidenceState, string> = {
  EVIDENCE_SUPPORTED:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PARTIALLY_SUPPORTED: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  OUTSIDE_STUDIED_POPULATION:
    "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  EVIDENCE_INSUFFICIENT: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EVIDENCE_PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/* --------------------------------------------------------- patient context */

export interface ProtocolContextItem {
  id: string;
  label: string;
  value: string;
  present: boolean;
  /** Where the value came from — engine or assessment field. */
  origin: string;
}

export interface ProtocolContextGroup {
  id: string;
  title: string;
  items: ProtocolContextItem[];
  recorded: number;
  total: number;
}

export interface PreviousCycleReview {
  label: string;
  protocol: string;
  gnrhAnalogue: string;
  gonadotropin: string;
  startingDose: string;
  maxDose: string;
  doseChanges: string;
  duration: string;
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
}

export interface PredictedVsObserved {
  predictedCategory: string;
  predictedBasis: string[];
  observedStatements: string[];
  /** True only when at least one completed cycle has a recorded oocyte yield. */
  observedAvailable: boolean;
  distinctionNote: string;
}

/* -------------------------------------------------------- protocol options */

export type ProtocolOptionId = "gnrh-antagonist" | "long-gnrh-agonist";

export interface PopulationCriterion {
  id: string;
  label: string;
  /** What the indexed source states about its population. */
  evidencePopulation: string;
  /** The corresponding recorded patient value. */
  patientValue: string;
  state: EvidenceState;
  note: string;
}

export interface ProtocolEvidenceCitation {
  evidenceId: string;
  title: string;
  publication: string;
  year: number | null;
  doi: string | null;
  url: string | null;
  populationStudied: string;
  mainStatement: string;
  limitations: string[];
}

export interface ProtocolOptionAssessment {
  id: ProtocolOptionId;
  name: string;
  category: string;
  description: string;
  populationStudied: string;
  inclusion: string[];
  exclusion: string[];
  advantages: string[];
  limitations: string[];
  criteria: PopulationCriterion[];
  /** Overall population-match descriptor. Never a score or a ranking. */
  populationMatch: EvidenceState;
  /** State of the comparative outcome evidence indexed for this protocol. */
  evidenceState: EvidenceState;
  /** State of a transcribed selection rule for this protocol. Always pending in V1. */
  algorithmStatus: AlgorithmStatus;
  /** Applicability sentence built only from recorded values + indexed text. */
  applicability: string;
  patientFactorState: EvidenceState;
  previousResponseState: EvidenceState;
  previousResponseNote: string;
  citations: ProtocolEvidenceCitation[];
  missingEvidence: string[];
}

export interface ProtocolComparisonRow {
  id: string;
  label: string;
  cells: { optionId: ProtocolOptionId; state: EvidenceState; detail: string }[];
}

export interface ProtocolCaution {
  id: string;
  label: string;
  severity: "info" | "moderate" | "high";
  kind: "caution" | "population-mismatch" | "evidence-limitation" | "previous-adverse-response";
  source: string;
}

export interface MissingInformationItem {
  id: string;
  label: string;
  /** Assessment step to open. */
  stepId: string;
  /** Whether a validated algorithm explicitly requires it (never true in V1). */
  blocking: boolean;
}

export interface ConsortFirewall {
  status: AlgorithmStatus;
  modelLoaded: boolean;
  dose: number | null;
  doseDisplay: string;
  statements: string[];
}

export interface ProtocolSelectionResult {
  patientId: string;
  patientName: string;
  contextGroups: ProtocolContextGroup[];
  poseidonGroup: string | null;
  poseidonHeadline: string;
  bolognaStatus: string;
  bolognaHeadline: string;
  reserveCategory: string;
  predictedResponse: string;
  previousCycles: PreviousCycleReview[];
  predictedVsObserved: PredictedVsObserved;
  options: ProtocolOptionAssessment[];
  comparison: ProtocolComparisonRow[];
  cautions: ProtocolCaution[];
  missingInformation: MissingInformationItem[];
  evidenceGaps: { item: string; source: string; blocks: string }[];
  consortFirewall: ConsortFirewall;
  /** Always empty — protocol selection never emits treatment values. */
  suppressedOutputs: string[];
  note: string;
  computedAt: string;
  version: string;
}

/* ---------------------------------------------------------------- helpers */

const NOT_RECORDED = "Not recorded";

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

/* --------------------------------------------- indexed protocol references */

interface ProtocolReference {
  id: ProtocolOptionId;
  name: string;
  category: string;
  description: string;
  populationStudied: string;
  inclusion: string[];
  exclusion: string[];
  advantages: string[];
  limitations: string[];
  evidenceIds: string[];
  /** Statement transcribed from the indexed Evidence Library record. */
  mainStatement: string;
  /** Named guideline items that would be needed to activate a selection rule. */
  missingEvidence: string[];
}

/**
 * Only the two protocol categories that the indexed evidence explicitly
 * studies as a comparison are represented. No further category is added
 * simply because it exists in practice.
 */
export const protocolReferences: ProtocolReference[] = [
  {
    id: "gnrh-antagonist",
    name: "GnRH Antagonist Protocol",
    category: "GnRH antagonist",
    description:
      "Gonadotropin stimulation from the early follicular phase with a GnRH antagonist introduced to prevent a premature LH surge.",
    populationStudied:
      "Women undergoing IVF/ICSI ovarian stimulation, as covered by the ESHRE ovarian stimulation guideline and by the randomised trials pooled in the Cochrane antagonist review.",
    inclusion: [
      "Women undergoing IVF or ICSI with ovarian stimulation (population of the indexed sources).",
    ],
    exclusion: [
      "No exclusion criterion is transcribed from the indexed records; the guideline recommendation tables are not loaded.",
    ],
    advantages: [
      "Comparative outcome data versus the long agonist protocol are indexed (Cochrane 2016).",
      "Compatible with a GnRH agonist trigger, for which comparative evidence is separately indexed.",
    ],
    limitations: [
      "The indexed record summarises the comparison at review level; no population-specific recommendation statement is transcribed.",
      "No subgroup statement for POSEIDON groups or Bologna poor responders is transcribed.",
    ],
    evidenceIds: [
      "cochrane-2016-antagonist",
      "eshre-2020-ovarian-stimulation",
      "eshre-2025-ovarian-stimulation-update",
    ],
    mainStatement:
      "Cochrane 2016 (CD001750.pub4) compares GnRH antagonist protocols with long GnRH agonist protocols across randomised trials, reporting live birth, ongoing pregnancy and OHSS outcomes.",
    missingEvidence: [
      "ESHRE protocol-selection recommendation table (antagonist vs agonist) — full text not transcribed.",
      "Population-specific recommendation statement for reduced ovarian reserve / POSEIDON groups.",
    ],
  },
  {
    id: "long-gnrh-agonist",
    name: "Long GnRH Agonist Protocol",
    category: "GnRH agonist — long",
    description:
      "Pituitary downregulation with a GnRH agonist started before stimulation, followed by gonadotropin stimulation once suppression is confirmed.",
    populationStudied:
      "Women undergoing IVF/ICSI ovarian stimulation; the long agonist protocol is the comparator arm of the indexed Cochrane antagonist review and is covered by the ESHRE ovarian stimulation guideline.",
    inclusion: [
      "Women undergoing IVF or ICSI with ovarian stimulation (population of the indexed sources).",
    ],
    exclusion: [
      "No exclusion criterion is transcribed from the indexed records; the guideline recommendation tables are not loaded.",
    ],
    advantages: ["Long-established comparator arm in the indexed randomised evidence."],
    limitations: [
      "The indexed record summarises the comparison at review level; no population-specific recommendation statement is transcribed.",
      "No subgroup statement for POSEIDON groups or Bologna poor responders is transcribed.",
    ],
    evidenceIds: [
      "cochrane-2016-antagonist",
      "eshre-2020-ovarian-stimulation",
      "eshre-2025-ovarian-stimulation-update",
    ],
    mainStatement:
      "The long GnRH agonist protocol is the comparator against which antagonist protocols are evaluated in the indexed Cochrane 2016 review, and is covered by the ESHRE ovarian stimulation guideline scope.",
    missingEvidence: [
      "ESHRE protocol-selection recommendation table (antagonist vs agonist) — full text not transcribed.",
      "Population-specific recommendation statement for reduced ovarian reserve / POSEIDON groups.",
    ],
  },
];

function citationsFor(ids: string[], populationStudied: string, statement: string) {
  return ids
    .map((id) => {
      const e = findEvidence(id);
      if (!e) return null;
      const citation: ProtocolEvidenceCitation = {
        evidenceId: e.id,
        title: e.title,
        publication: [e.journal, e.volume, e.issue ? `(${e.issue})` : null, e.pages]
          .filter(Boolean)
          .join(" "),
        year: e.year ?? null,
        doi: e.doi ?? null,
        url: e.url ?? (e.doi ? `https://doi.org/${e.doi}` : null),
        populationStudied,
        mainStatement: e.summary || statement,
        limitations: [
          e.status === "indexed"
            ? "Indexed bibliographic record — recommendation tables not transcribed."
            : "Pending specialist review.",
        ],
      };
      return citation;
    })
    .filter((c): c is ProtocolEvidenceCitation => Boolean(c));
}

/* ------------------------------------------------------------------ engine */

export function buildProtocolSelection(
  patientId: string,
  patientName: string,
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
  ctx: PatientContext,
  consortDoseFromStore?: number | null,
): ProtocolSelectionResult {
  const i = response.inputs;
  const ci = ctx.cycleIntelligence;

  /* ------------------------------------------------------------- context */

  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

  const group = (
    id: string,
    title: string,
    items: ProtocolContextItem[],
  ): ProtocolContextGroup => ({
    id,
    title,
    items,
    recorded: items.filter((x) => x.present).length,
    total: items.length,
  });

  const item = (
    id: string,
    label: string,
    value: string | number | null | undefined,
    origin: string,
    unit?: string,
  ): ProtocolContextItem => ({
    id,
    label,
    value: show(value ?? null, unit),
    present: value !== null && value !== undefined && value !== "",
    origin,
  });

  const contextGroups: ProtocolContextGroup[] = [
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
      item(
        "type",
        "Primary / secondary infertility",
        phenotype.patientSummary.infertilityType,
        "Assessment",
      ),
    ]),
    group("reserve", "Ovarian reserve", [
      item("amh", "AMH", i.amh, "Assessment", "ng/mL"),
      item("afc", "AFC", i.afc, "Ultrasound", "follicles"),
      item("fsh", "Basal FSH", i.fsh, "Assessment", "IU/L"),
      item("lh", "Basal LH", i.lh, "Assessment", "IU/L"),
      item("e2", "Basal estradiol", i.estradiol, "Assessment", "pg/mL"),
      item(
        "reserve",
        "Reserve category",
        reserveCategoryLabel[phenotype.reserve.category],
        "Phenotype Engine",
      ),
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
        "predicted",
        "Predicted ovarian response",
        responseCategoryLabel[response.category],
        "Ovarian Response Engine",
      ),
      item(
        "observed",
        "Observed previous response",
        ci.expectedObserved.observedSummary[0] ?? null,
        "Cycle Intelligence",
      ),
    ]),
    group("etiology", "Infertility etiology", [
      item("causes", "Recorded causes", causes.length ? causes.join(", ") : null, "Assessment"),
      item("pcos", "PCOS", i.pcos ? "Documented" : null, "Assessment"),
      item(
        "endometriosis",
        "Endometriosis",
        i.endometriosis ? (s(values["endometriosisStage"]) ?? "Documented") : null,
        "Assessment",
      ),
      item(
        "tubal",
        "Tubal factor",
        causes.includes("Tubal Factor") ? "Documented" : null,
        "Assessment",
      ),
      item(
        "male",
        "Male factor",
        causes.includes("Male Factor") ? "Documented" : s(values["whoOverall"]),
        "Assessment",
      ),
      item(
        "unexplained",
        "Unexplained infertility",
        causes.includes("Unexplained") ? "Documented" : null,
        "Assessment",
      ),
    ]),
    group("medical", "Medical & surgical factors", [
      item("ovarianSurgery", "Previous ovarian surgery", s(values["ovarianSurgery"]), "Assessment"),
      item("ohssHistory", "Previous OHSS", i.ohssHistory, "Assessment"),
      item("smoking", "Smoking", i.smoking, "Assessment"),
      item(
        "comorbidities",
        "Relevant comorbidities",
        [
          s(values["hypertension"]) && `Hypertension: ${s(values["hypertension"])}`,
          s(values["diabetes"]) && `Diabetes: ${s(values["diabetes"])}`,
          s(values["thyroid"]) && `Thyroid: ${s(values["thyroid"])}`,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        "Assessment",
      ),
    ]),
    group("previous", "Previous IVF / ICSI", [
      item("count", "Number of previous cycles", cycles.length || null, "Cycle records"),
      item(
        "lastProtocol",
        "Previous protocol",
        i.cycleSignals.at(-1)?.protocol ?? null,
        "Cycle records",
      ),
      item(
        "lastDose",
        "Previous starting dose",
        i.cycleSignals.at(-1)?.startingDose ?? null,
        "Cycle records (historical)",
        "IU/day",
      ),
      item(
        "lastRetrieved",
        "Previous oocytes retrieved",
        i.cycleSignals.at(-1)?.retrieved ?? null,
        "Cycle records",
      ),
    ]),
  ];

  /* ------------------------------------------------- previous cycle review */

  const previousCycles: PreviousCycleReview[] = cycles.map((c, idx) => ({
    label: s(c["cycleNumber"]) ? `Cycle ${s(c["cycleNumber"])}` : `Cycle ${idx + 1}`,
    protocol: cell(c, "protocol"),
    gnrhAnalogue: cell(c, "gnrhAnalogue"),
    gonadotropin:
      [s(c["gonadotropinType"]), s(c["medication"])].filter(Boolean).join(" · ") || NOT_RECORDED,
    startingDose: s(c["startingDose"]) ? `${s(c["startingDose"])} IU/day` : NOT_RECORDED,
    maxDose: s(c["maxDose"]) ? `${s(c["maxDose"])} IU/day` : NOT_RECORDED,
    doseChanges: cell(c, "doseChanges"),
    duration: s(c["duration"]) ? `${s(c["duration"])} days` : NOT_RECORDED,
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
  }));

  const observedYields = i.cycleSignals
    .map((c) => c.retrieved)
    .filter((n): n is number => n !== null);

  const predictedVsObserved: PredictedVsObserved = {
    predictedCategory: responseCategoryLabel[response.category],
    predictedBasis: response.explanation.contributingVariables,
    observedStatements: i.cycleSignals
      .filter((c) => c.retrieved !== null || c.cancelled)
      .map((c) =>
        c.cancelled
          ? `${c.cycleLabel}: recorded as cancelled.`
          : `${c.cycleLabel}: ${c.retrieved} oocyte(s) retrieved${
              c.mature !== null ? `, ${c.mature} MII` : ""
            }${c.startingDose !== null ? ` — historical starting dose ${c.startingDose} IU/day` : ""}.`,
      ),
    observedAvailable: observedYields.length > 0,
    distinctionNote:
      "PREDICTED response is a model output from the current ovarian reserve markers. OBSERVED response is a recorded outcome of a previous stimulation cycle. They are reported separately; no conclusion is drawn that changing protocol would change the observed outcome.",
  };

  /* ------------------------------------------------------ protocol options */

  const poorResponderContext =
    phenotype.bologna.status === "positive" ||
    phenotype.poseidon.group !== null ||
    response.category === "poor" ||
    response.category === "very-poor";

  const populationKnown = phenotype.patientSummary.age !== null;

  const options: ProtocolOptionAssessment[] = protocolReferences.map((ref) => {
    const criteria: PopulationCriterion[] = [
      {
        id: "art-population",
        label: "Undergoing IVF / ICSI ovarian stimulation",
        evidencePopulation: "Women undergoing IVF or ICSI with ovarian stimulation.",
        patientValue: populationKnown
          ? `Age ${phenotype.patientSummary.age} years, assessed for IVF / ICSI stimulation`
          : "Age not recorded",
        state: populationKnown ? "EVIDENCE_SUPPORTED" : "EVIDENCE_INSUFFICIENT",
        note: populationKnown
          ? "The patient falls inside the broad population of the indexed sources."
          : "Age is not recorded, so population applicability cannot be confirmed.",
      },
      {
        id: "reserve-subgroup",
        label: "Reduced ovarian reserve / poor responder subgroup",
        evidencePopulation:
          "The indexed records describe the overall IVF/ICSI population; no subgroup recommendation statement for POSEIDON groups or Bologna poor responders is transcribed.",
        patientValue: poorResponderContext
          ? `${phenotype.poseidon.groupLabel ?? "POSEIDON not classified"} · Bologna ${bolognaStatusLabel[phenotype.bologna.status]} · Predicted ${responseCategoryLabel[response.category]}`
          : `Predicted ${responseCategoryLabel[response.category]}`,
        state: poorResponderContext ? "PARTIALLY_SUPPORTED" : "PARTIALLY_SUPPORTED",
        note: poorResponderContext
          ? "The patient sits in a subgroup for which the indexed sources do not print a transcribed protocol recommendation. The overall comparison remains applicable as background evidence only."
          : "No subgroup-level recommendation statement is transcribed for this patient profile.",
      },
      {
        id: "previous-response",
        label: "Previous stimulation response",
        evidencePopulation:
          "The indexed comparison does not print a rule linking a previous cycle outcome to a protocol change.",
        patientValue: predictedVsObserved.observedAvailable
          ? (predictedVsObserved.observedStatements[0] ?? NOT_RECORDED)
          : "No completed previous cycle with a recorded oocyte yield",
        state: predictedVsObserved.observedAvailable
          ? "EVIDENCE_INSUFFICIENT"
          : "EVIDENCE_INSUFFICIENT",
        note: "No transcribed evidence supports concluding that a protocol change would alter the observed outcome.",
      },
      {
        id: "selection-rule",
        label: "Protocol selection recommendation rule",
        evidencePopulation:
          "ESHRE / ASRM protocol-selection recommendation tables are not transcribed into the Evidence Library.",
        patientValue: "Not applicable — no rule loaded",
        state: "EVIDENCE_PENDING",
        note: "No protocol can be recommended until the recommendation tables are loaded.",
      },
    ];

    const populationMatch: EvidenceState = !populationKnown
      ? "EVIDENCE_INSUFFICIENT"
      : poorResponderContext
        ? "PARTIALLY_SUPPORTED"
        : "EVIDENCE_SUPPORTED";

    return {
      id: ref.id,
      name: ref.name,
      category: ref.category,
      description: ref.description,
      populationStudied: ref.populationStudied,
      inclusion: ref.inclusion,
      exclusion: ref.exclusion,
      advantages: ref.advantages,
      limitations: ref.limitations,
      criteria,
      populationMatch,
      evidenceState: "PARTIALLY_SUPPORTED",
      algorithmStatus: "EVIDENCE_PENDING",
      applicability: populationKnown
        ? `Comparative outcome evidence is indexed for this protocol category in the overall IVF/ICSI population. ${
            poorResponderContext
              ? "The current patient profile falls in a subgroup for which no transcribed recommendation statement exists."
              : "No subgroup-level recommendation statement is transcribed for this patient profile."
          }`
        : "Applicability cannot be described until the patient age and reserve markers are recorded.",
      patientFactorState: populationMatch,
      previousResponseState: predictedVsObserved.observedAvailable
        ? "EVIDENCE_INSUFFICIENT"
        : "EVIDENCE_INSUFFICIENT",
      previousResponseNote: predictedVsObserved.observedAvailable
        ? `Recorded previous response is available and displayed. ${HISTORICAL_VALUE_NOTICE}`
        : "No completed previous stimulation cycle with a recorded outcome.",
      citations: citationsFor(ref.evidenceIds, ref.populationStudied, ref.mainStatement),
      missingEvidence: ref.missingEvidence,
    };
  });

  const comparison: ProtocolComparisonRow[] = [
    {
      id: "evidence",
      label: "Evidence",
      cells: options.map((o) => ({
        optionId: o.id,
        state: o.evidenceState,
        detail: "Comparative outcome review indexed; recommendation table not transcribed.",
      })),
    },
    {
      id: "population",
      label: "Population match",
      cells: options.map((o) => ({
        optionId: o.id,
        state: o.populationMatch,
        detail: o.criteria[1]?.note ?? "",
      })),
    },
    {
      id: "patient-factors",
      label: "Patient factors",
      cells: options.map((o) => ({
        optionId: o.id,
        state: o.patientFactorState,
        detail: o.applicability,
      })),
    },
    {
      id: "previous-response",
      label: "Previous response",
      cells: options.map((o) => ({
        optionId: o.id,
        state: o.previousResponseState,
        detail: o.previousResponseNote,
      })),
    },
    {
      id: "limitations",
      label: "Evidence limitations",
      cells: options.map((o) => ({
        optionId: o.id,
        state: "EVIDENCE_PENDING" as EvidenceState,
        detail: o.missingEvidence.join(" "),
      })),
    },
  ];

  /* ---------------------------------------------------------- cautions */

  const cautions: ProtocolCaution[] = [];
  const addCaution = (c: ProtocolCaution) => {
    if (!cautions.some((x) => x.id === c.id)) cautions.push(c);
  };

  if (i.ohssHistory && !["No", "Unknown"].includes(i.ohssHistory))
    addCaution({
      id: "previous-ohss",
      label: `Previous OHSS recorded (${i.ohssHistory})`,
      severity: "high",
      kind: "previous-adverse-response",
      source: "Recorded in the patient assessment.",
    });

  for (const c of i.cycleSignals) {
    if (c.cancelled)
      addCaution({
        id: `cancelled-${c.cycleLabel}`,
        label: `${c.cycleLabel} recorded as cancelled`,
        severity: "moderate",
        kind: "previous-adverse-response",
        source: "Recorded in the previous-cycle records.",
      });
    if (c.ohss && c.ohss !== "No")
      addCaution({
        id: `cycle-ohss-${c.cycleLabel}`,
        label: `${c.cycleLabel}: OHSS recorded (${c.ohss})`,
        severity: "high",
        kind: "previous-adverse-response",
        source: "Recorded in the previous-cycle records.",
      });
    if (c.retrieved !== null && c.retrieved <= 3)
      addCaution({
        id: `low-yield-${c.cycleLabel}`,
        label: `${c.cycleLabel}: ${c.retrieved} oocyte(s) retrieved`,
        severity: "moderate",
        kind: "previous-adverse-response",
        source: `Observed outcome recorded in the previous-cycle records. ${HISTORICAL_VALUE_NOTICE}`,
      });
  }

  if (poorResponderContext)
    addCaution({
      id: "population-mismatch",
      label: "Patient profile sits outside the transcribed recommendation statements",
      severity: "moderate",
      kind: "population-mismatch",
      source:
        "The indexed sources describe the overall IVF/ICSI population; no subgroup protocol statement is transcribed for POSEIDON / Bologna poor responders.",
    });

  addCaution({
    id: "evidence-limitation",
    label: "Protocol selection recommendation tables are not loaded",
    severity: "info",
    kind: "evidence-limitation",
    source: "Evidence Requirements register — ESHRE / ASRM recommendation tables pending.",
  });

  /* ------------------------------------------------- missing information */

  const missingInformation: MissingInformationItem[] = [];
  const addMissing = (id: string, label: string, stepId: string, present: boolean) => {
    if (!present) missingInformation.push({ id, label, stepId, blocking: false });
  };

  addMissing("age", "Age / date of birth", "patient", phenotype.patientSummary.age !== null);
  addMissing("bmi", "Height and weight (BMI)", "patient", phenotype.patientSummary.bmi !== null);
  addMissing("amh", "AMH", "reserve", i.amh !== null);
  addMissing("afc", "Antral follicle count", "ultrasound", i.afc !== null);
  addMissing("fsh", "Basal FSH", "reserve", i.fsh !== null);
  addMissing("causes", "Cause of infertility", "cause", causes.length > 0);
  addMissing("cycles", "Previous cycle records", "cycles", cycles.length > 0);
  for (const m of phenotype.missing)
    if (!missingInformation.some((x) => x.id === m.id || x.label === m.label))
      missingInformation.push({ id: m.id, label: m.label, stepId: m.stepId, blocking: false });

  /* --------------------------------------------------------- CONSORT firewall */

  /* Hard firewall: even if a stored dose exists it is passed through the
     treatment gate, which returns null while CONSORT is EVIDENCE_PENDING. */
  const consortGate = evaluateTreatmentGate("consort-dose");
  const gatedDose = gatedTreatmentValue("consort-dose", consortDoseFromStore ?? null);

  const consortFirewall: ConsortFirewall = {
    status: consortGate.status,
    modelLoaded: isConsortModelLoaded(),
    dose: consortGate.active ? gatedDose : null,
    doseDisplay: gatedDose !== null ? `${gatedDose} IU/day` : "—",
    statements: [
      `CONSORT status: ${consortGate.statusLabel}.`,
      isConsortModelLoaded()
        ? "consortModelTable.loaded = true — validated individualized dosing nomogram active."
        : "consortModelTable.loaded = false — validated coefficients and dose crosswalk are not loaded.",
      isConsortModelLoaded()
        ? "CONSORT individualized dose calculation is active and available."
        : "No CONSORT dose is available to the Protocol Selection Engine (value = null).",
      "No dose is inferred from age, AMH, AFC, FSH, BMI, POSEIDON, Bologna or previous response.",
      "Protocol Selection coordinates with individualized starting dose assessment.",
    ],
  };

  const evidenceGaps = [
    {
      item: "ESHRE ovarian stimulation guideline — protocol selection recommendation table",
      source: "ESHRE guideline 2020 / update 2025",
      blocks: "No protocol may be recommended for any population until the table is transcribed.",
    },
    {
      item: "Population statement for reduced ovarian reserve / POSEIDON subgroups",
      source: "ESHRE guideline / POSEIDON publications",
      blocks: "Subgroup applicability can only be described, not recommended.",
    },
    {
      item: "Protocol comparison outcome data at subgroup level",
      source: "Cochrane 2016 CD001750.pub4 — full text",
      blocks: "Comparative statements remain at overall-population level.",
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
    previousCycles,
    predictedVsObserved,
    options,
    comparison,
    cautions,
    missingInformation,
    evidenceGaps,
    consortFirewall,
    suppressedOutputs: [],
    note: PROTOCOL_SELECTION_NOTE,
    computedAt: new Date().toISOString(),
    version: PROTOCOL_SELECTION_VERSION,
  };
}

/* ------------------------------------------------------------ report text */

export function protocolSelectionReportText(
  r: ProtocolSelectionResult,
  decision?: { label: string; protocol: string | null; note: string } | null,
): string {
  return [
    "PROTOCOL SELECTION — EVIDENCE REVIEW",
    `Patient: ${r.patientName}`,
    "",
    "Patient phenotype",
    `- POSEIDON: ${r.poseidonGroup ?? r.poseidonHeadline}`,
    `- Bologna: ${r.bolognaStatus}`,
    `- Ovarian reserve: ${r.reserveCategory}`,
    `- Predicted ovarian response: ${r.predictedResponse}`,
    `- Observed previous response: ${
      r.predictedVsObserved.observedAvailable
        ? r.predictedVsObserved.observedStatements.join(" ")
        : "No completed previous cycle recorded"
    }`,
    "",
    "Protocol options reviewed",
    ...r.options.flatMap((o) => [
      `- ${o.name} — evidence: ${evidenceStateLabel[o.evidenceState]}; population match: ${evidenceStateLabel[o.populationMatch]}; selection rule: Evidence Pending`,
      `  Population studied: ${o.populationStudied}`,
      `  Limitations: ${o.limitations.join(" ")}`,
    ]),
    "",
    "Cautions and evidence limitations",
    ...(r.cautions.length
      ? r.cautions.map((c) => `- ${c.label} (${c.source})`)
      : ["- None recorded."]),
    "",
    "Missing information",
    ...(r.missingInformation.length
      ? r.missingInformation.map((m) => `- ${m.label}`)
      : ["- None."]),
    "",
    `CONSORT firewall: ${r.consortFirewall.statements.join(" ")}`,
    "",
    `Physician decision: ${decision ? decision.label : "Not recorded"}${
      decision?.protocol ? ` — ${decision.protocol}` : ""
    }`,
    decision?.note ? `Decision note: ${decision.note}` : "",
    "",
    r.note,
    `Generated ${new Date(r.computedAt).toLocaleString()} · Protocol Selection Engine v${r.version}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
