/**
 * Starting Gonadotropin Dose Engine (V1) — EVIDENCE-GATED FRAMEWORK.
 *
 * Determines whether a validated evidence source permits calculation or
 * selection of an individualised starting gonadotropin dose for this patient.
 *
 * HARD RULES enforced in code:
 *  - No dose is invented. A dose may only be CALCULATED when a registered
 *    algorithm reports `activated() === true` AND every required numeric
 *    component is loaded AND every required patient input is valid.
 *  - CONSORT stays frozen: consortModelTable.loaded = false, status
 *    EVIDENCE_PENDING, dose null. It is never approximated, interpolated or
 *    reconstructed from age, BMI, FSH, AFC, AMH, POSEIDON, Bologna, previous
 *    response or a historical dose.
 *  - Historical doses are reproduced as HISTORICAL patient data only, never
 *    repeated, increased or decreased by the engine.
 *  - No dose adjustment, trigger, OHSS, freeze-all or cancellation output.
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
import {
  consortModelTable,
  isConsortModelLoaded,
  CONSORT_MISSING_COMPONENTS,
  CONSORT_MODEL_PENDING_MESSAGE,
  CONSORT_FOLL_LT11_NOTE,
  CONSORT_FRAMEWORK_STATUS,
} from "./consort-model";

export const STARTING_DOSE_VERSION = "1.0.0";

export const STARTING_DOSE_NOTE =
  "This engine never invents a starting dose. A dose is calculated only when a validated published algorithm — with its complete coefficients, crosswalk, rounding rule and dose limits — is loaded in the Evidence Library and the patient falls inside its validated population. Otherwise the engine returns STARTING DOSE: NOT CALCULATED.";

export const NOT_CALCULATED = "—";
export const NOT_RECORDED = "Not recorded";
export const NOT_REPORTED = "Not reported in available source.";

export const STARTING_DOSE_REPORT_LANGUAGE =
  "An individualized starting dose was not calculated because a validated dosing algorithm with complete coefficients/tables and applicable population evidence is not currently available.";

/* --------------------------------------------------------------- states */

export type DoseOutputState =
  | "CALCULATED"
  | "EVIDENCE_SUPPORTED_RANGE"
  | "PHYSICIAN_SELECTED"
  | "EVIDENCE_PENDING"
  | "INSUFFICIENT_DATA"
  | "OUTSIDE_VALIDATED_POPULATION";

export const doseStateLabel: Record<DoseOutputState, string> = {
  CALCULATED: "Calculated",
  EVIDENCE_SUPPORTED_RANGE: "Evidence-supported range",
  PHYSICIAN_SELECTED: "Physician-selected",
  EVIDENCE_PENDING: "Evidence algorithm pending",
  INSUFFICIENT_DATA: "Insufficient data",
  OUTSIDE_VALIDATED_POPULATION: "Outside validated population",
};

export const doseStateTone: Record<DoseOutputState, string> = {
  CALCULATED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  EVIDENCE_SUPPORTED_RANGE: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  PHYSICIAN_SELECTED: "border-primary/40 bg-primary-soft text-primary",
  EVIDENCE_PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  INSUFFICIENT_DATA: "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-400",
  OUTSIDE_VALIDATED_POPULATION:
    "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export type MatchStatus =
  | "MATCH"
  | "PARTIAL_MATCH"
  | "OUTSIDE_VALIDATED_POPULATION"
  | "INSUFFICIENT_DATA"
  | "EVIDENCE_PENDING";

export const matchStatusLabel: Record<MatchStatus, string> = {
  MATCH: "Match",
  PARTIAL_MATCH: "Partial match",
  OUTSIDE_VALIDATED_POPULATION: "Outside validated population",
  INSUFFICIENT_DATA: "Insufficient data",
  EVIDENCE_PENDING: "Evidence pending",
};

export const matchStatusTone: Record<MatchStatus, string> = {
  MATCH: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PARTIAL_MATCH: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  OUTSIDE_VALIDATED_POPULATION:
    "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  INSUFFICIENT_DATA: "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-400",
  EVIDENCE_PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/* -------------------------------------------------- algorithm registry */

export interface DosingAlgorithmVariable {
  id: string;
  /** Variable name exactly as defined by the source. */
  sourceDefinition: string;
  label: string;
  /** Unit required by the source. */
  unit: string;
  /** Physiological range accepted by the source, when printed. */
  min: number | null;
  max: number | null;
  /** Assessment field that captures the variable, when one exists. */
  fieldKey: string | null;
  stepId: string;
  /**
   * True when the captured field is the variable the source validated.
   * False means the closest captured field is NOT an accepted substitution.
   */
  exactMatch: boolean;
  substitutionNote?: string;
}

export interface DosingAlgorithmComponent {
  id: string;
  label: string;
  loaded: boolean;
  detail: string;
}

export interface DosingAlgorithmDefinition {
  id: string;
  name: string;
  version: string;
  source: string;
  evidenceId: string | null;
  gonadotropin: string;
  validatedPopulation: string;
  /** Structured population bounds used only to describe the match status. */
  populationBounds: { ageMin: number | null; ageMax: number | null; note: string };
  requiredVariables: DosingAlgorithmVariable[];
  /** Every numeric element the source must supply before activation. */
  components: DosingAlgorithmComponent[];
  doseUnit: string;
  frequency: string;
  roundingRule: string;
  doseLimits: string;
  /** Explicit switch. Only true once every component is transcribed in code. */
  activated: () => boolean;
  notes: string[];
}

const consortComponents = (): DosingAlgorithmComponent[] => [
  ...CONSORT_MISSING_COMPONENTS.map((c) => ({
    id: `consort-${c.symbol}`,
    label: c.symbol,
    loaded: false,
    detail: c.detail,
  })),
  {
    id: "consort-bands",
    label: "Band / points tables for every predictor",
    loaded: consortModelTable.variables.every((v) => v.bands.length > 0),
    detail: "Printed band table for basal FSH, BMI, age and follicle count.",
  },
  {
    id: "consort-dose-steps",
    label: "Score-to-dose step table",
    loaded: consortModelTable.doseSteps.length > 0,
    detail: "Permitted r-hFSH starting doses per total score, in 37.5 IU increments.",
  },
];

/**
 * Registered dosing algorithms.
 *
 * Only algorithms whose source is held in the Evidence Library appear here.
 * None is activated: no held source supplies a complete validated dosing
 * calculation. Adding a future algorithm requires its own entry — never a
 * hard-coded formula.
 */
export const dosingAlgorithms: DosingAlgorithmDefinition[] = [
  {
    id: "consort",
    name: "CONSORT individualised r-hFSH starting-dose algorithm",
    version: "Published model — numeric components not loaded",
    source: "Olivennes et al. / Howles et al. — CONSORT dose-selection model",
    evidenceId: "rbmo-2015-consort-fsh-dose",
    gonadotropin: "Recombinant FSH (r-hFSH)",
    validatedPopulation: consortModelTable.validatedPopulation,
    populationBounds: {
      ageMin: 18,
      ageMax: 34,
      note: "Normo-ovulatory women aged 18–34 years undergoing assisted reproduction (CONSORT population).",
    },
    requiredVariables: [
      {
        id: "age",
        sourceDefinition: "AGE — age in completed years at screening",
        label: "Age",
        unit: "years",
        min: 18,
        max: 50,
        fieldKey: "age",
        stepId: "patient",
        exactMatch: true,
      },
      {
        id: "bmi",
        sourceDefinition: "BMI — body mass index at screening",
        label: "Body mass index",
        unit: "kg/m²",
        min: 14,
        max: 60,
        fieldKey: "bmi",
        stepId: "patient",
        exactMatch: true,
      },
      {
        id: "basalFsh",
        sourceDefinition: "FSH — early follicular basal serum FSH",
        label: "Basal FSH",
        unit: "IU/L",
        min: 0.5,
        max: 60,
        fieldKey: "fsh",
        stepId: "reserve",
        exactMatch: true,
      },
      {
        id: "follLt11",
        sourceDefinition: "FOLL_LT11 — number of follicles < 11 mm at baseline screening",
        label: "Follicles < 11 mm at screening",
        unit: "follicles",
        min: 0,
        max: 60,
        fieldKey: null,
        stepId: "ultrasound",
        exactMatch: false,
        substitutionNote: CONSORT_FOLL_LT11_NOTE,
      },
    ],
    components: consortComponents(),
    doseUnit: "IU/day",
    frequency: "Once daily, subcutaneous",
    roundingRule: "Not loaded — published rounding to 37.5 IU increments is not transcribed.",
    doseLimits: "Not loaded — published floor and ceiling are not transcribed.",
    activated: () => isConsortModelLoaded(),
    notes: [
      CONSORT_FRAMEWORK_STATUS.frameworkDetail,
      CONSORT_FRAMEWORK_STATUS.activeDetail,
      CONSORT_MODEL_PENDING_MESSAGE,
    ],
  },
];

/**
 * Evidence-reported starting doses / dose ranges transcribed from a source.
 *
 * Deliberately empty: no held source has had its starting-dose table
 * transcribed into the Evidence Library. A study dose may only be added here
 * with its population, design, outcome and limitations, and even then it is
 * never converted into a patient-specific recommendation.
 */
export interface EvidenceReportedDose {
  id: string;
  evidenceId: string | null;
  source: string;
  population: string;
  gonadotropin: string;
  range: string;
  studyDesign: string;
  populationCharacteristics: string;
  outcome: string;
  limitations: string[];
}

export const evidenceReportedDoses: EvidenceReportedDose[] = [];

/* ------------------------------------------------------------- results */

export interface NormalizedVariable {
  id: string;
  label: string;
  sourceDefinition: string;
  originalValue: string;
  originalUnit: string;
  normalizedValue: number | null;
  normalizedUnit: string;
  present: boolean;
  valid: boolean;
  issue: string | null;
  exactMatch: boolean;
  substitutionNote: string | null;
  stepId: string;
}

export interface AlgorithmAssessment {
  id: string;
  name: string;
  version: string;
  source: string;
  evidenceId: string | null;
  evidenceTitle: string | null;
  evidenceDoi: string | null;
  evidenceUrl: string | null;
  gonadotropin: string;
  validatedPopulation: string;
  status: AlgorithmStatus;
  statusLabel: string;
  activated: boolean;
  /** Match of THIS patient against the validated population. */
  matchStatus: MatchStatus;
  matchExplanation: string;
  patientDescription: string;
  variables: NormalizedVariable[];
  missingVariables: { id: string; label: string; stepId: string }[];
  invalidVariables: { id: string; label: string; issue: string }[];
  components: DosingAlgorithmComponent[];
  missingComponents: DosingAlgorithmComponent[];
  doseUnit: string;
  frequency: string;
  roundingRule: string;
  doseLimits: string;
  /** Always null unless the algorithm is genuinely activated and valid. */
  calculatedDose: number | null;
  calculationDetails: string[];
  blockReason: string;
  notes: string[];
}

export interface HistoricalDoseRow {
  id: string;
  label: string;
  protocol: string;
  gonadotropin: string;
  brand: string;
  startingDose: string;
  maxDose: string;
  doseChanges: string;
  totalDose: string;
  duration: string;
  follicles: string;
  retrieved: string;
  mii: string;
  fertilization: string;
  twoPn: string;
  blastocysts: string;
  embryoQuality: string;
  pregnancy: string;
  liveBirth: string;
  ohss: string;
  cancelled: string;
  complications: string;
}

export interface StartingDoseContextItem {
  id: string;
  label: string;
  value: string;
  present: boolean;
  origin: string;
}

export interface StartingDoseContextGroup {
  id: string;
  title: string;
  items: StartingDoseContextItem[];
  recorded: number;
  total: number;
}

export interface StartingDoseMissingGroup {
  id: string;
  title: string;
  items: { id: string; label: string; stepId: string }[];
}

export interface StartingDoseResult {
  patientId: string;
  patientName: string;
  contextGroups: StartingDoseContextGroup[];
  currentTreatment: {
    protocolName: string;
    protocolStatus: string;
    protocolDecisionStatus: string;
    gonadotropinName: string | null;
    gonadotropinStatus: string;
    gonadotropinSelected: boolean;
    blockingMessage: string | null;
  };
  historicalDoses: HistoricalDoseRow[];
  historicalNote: string;
  evidenceReportedDoses: EvidenceReportedDose[];
  evidenceReportedNote: string;
  algorithms: AlgorithmAssessment[];
  /** Overall engine output state. */
  state: DoseOutputState;
  stateLabel: string;
  stateExplanation: string;
  /** Dose only when state === "CALCULATED". */
  dose: number | null;
  doseDisplay: string;
  doseUnit: string | null;
  doseFrequency: string | null;
  producedByAlgorithmId: string | null;
  consortFirewall: {
    status: AlgorithmStatus;
    statusLabel: string;
    modelLoaded: boolean;
    dose: null;
    doseDisplay: string;
    frameworkIdentified: boolean;
    doseCalculationActive: boolean;
    missingComponents: { symbol: string; detail: string }[];
    statements: string[];
  };
  safetyGuardrails: string[];
  missingInformation: StartingDoseMissingGroup[];
  evidenceLimitations: string[];
  evidenceSources: string[];
  poseidonContext: string;
  bolognaContext: string;
  reserveContext: string;
  predictedResponse: string;
  observedResponse: string[];
  patientContextVersion: string;
  note: string;
  reportLanguage: string;
  computedAt: string;
  version: string;
}

/* -------------------------------------------------------------- helpers */

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

/* --------------------------------------------------------------- engine */

export function buildStartingDoseAssessment(
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
    gonadotropinName?: string | null;
    gonadotropinSelected?: boolean;
    gonadotropinStatus?: string;
    consortDoseFromStore?: number | null;
    physicianDose?: {
      dose: number;
      unit: string;
      frequency: string;
      gonadotropin: string | null;
    } | null;
  },
): StartingDoseResult {
  const i = response.inputs;
  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

  /* ------------------------------------------------------------ context */

  const item = (
    id: string,
    label: string,
    value: string | number | null | undefined,
    origin: string,
    unit?: string,
  ): StartingDoseContextItem => ({
    id,
    label,
    value: show(value ?? null, unit),
    present: value !== null && value !== undefined && value !== "",
    origin,
  });

  const group = (
    id: string,
    title: string,
    items: StartingDoseContextItem[],
  ): StartingDoseContextGroup => ({
    id,
    title,
    items,
    recorded: items.filter((x) => x.present).length,
    total: items.length,
  });

  const age = phenotype.patientSummary.age;
  const bmi = phenotype.patientSummary.bmi;

  const contextGroups: StartingDoseContextGroup[] = [
    group("demographics", "Demographics", [
      item("age", "Age", age, "Patient dataset", "years"),
      item("bmi", "BMI", bmi, "Derived (height, weight)", "kg/m²"),
      item("height", "Height", toNum(values["height"]), "Assessment", "cm"),
      item("weight", "Weight", toNum(values["weight"]), "Assessment", "kg"),
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
        cycles.length
          ? cycles
              .map((c, idx) => `Cycle ${s(c["cycleNumber"]) ?? idx + 1}: ${cell(c, "retrieved")}`)
              .join(" · ")
          : null,
        "Previous cycle records (historical)",
      ),
    ]),
    group("etiology", "Infertility characteristics", [
      item("causes", "Cause of infertility", causes.length ? causes.join(", ") : null, "Assessment"),
      item("pcos", "PCOS", i.pcos ? "Yes" : null, "Assessment"),
      item("endometriosis", "Endometriosis", i.endometriosis ? "Yes" : null, "Assessment"),
      item(
        "male-factor",
        "Male factor",
        s(values["maleFactorSeverity"]) ?? s(values["semenResult"]),
        "Assessment",
      ),
      item("tubal", "Tubal factor", causes.includes("Tubal factor") ? "Yes" : null, "Assessment"),
      item("previous-ivf", "Previous IVF/ICSI cycles", cycles.length || null, "Previous cycles"),
    ]),
    group("safety", "Medical / safety factors", [
      item("ohss-history", "Previous OHSS", i.ohssHistory, "Assessment"),
      item("ovarian-surgery", "Previous ovarian surgery", s(values["ovarianSurgery"]), "Assessment"),
      item("comorbidities", "Relevant comorbidities", s(values["medicalConditions"]), "Assessment"),
      item("smoking", "Smoking", i.smoking, "Assessment"),
    ]),
  ];

  /* --------------------------------------------------- historical doses */

  const historicalDoses: HistoricalDoseRow[] = cycles.map((c, index) => ({
    id: c.id ?? `cycle-${index + 1}`,
    label: `Cycle ${s(c["cycleNumber"]) ?? index + 1}${s(c["cycleYear"]) ? ` — ${s(c["cycleYear"])}` : ""}`,
    protocol: cell(c, "protocol"),
    gonadotropin: cell(c, "gonadotropinType"),
    brand: cell(c, "medication"),
    startingDose: s(c["startingDose"]) ? `${s(c["startingDose"])} IU/day` : NOT_RECORDED,
    maxDose: s(c["maxDose"]) ? `${s(c["maxDose"])} IU/day` : NOT_RECORDED,
    doseChanges: cell(c, "doseChanges"),
    totalDose: s(c["totalDose"]) ? `${s(c["totalDose"])} IU` : NOT_RECORDED,
    duration: s(c["duration"]) ? `${s(c["duration"])} day(s)` : NOT_RECORDED,
    follicles: cell(c, "folliclesTotal"),
    retrieved: cell(c, "retrieved"),
    mii: cell(c, "mii"),
    fertilization: cell(c, "fertilizationRate"),
    twoPn: cell(c, "twoPn"),
    blastocysts: cell(c, "blastocysts"),
    embryoQuality: cell(c, "embryoGrades"),
    pregnancy: cell(c, "clinicalPregnancy"),
    liveBirth: cell(c, "liveBirth"),
    ohss: cell(c, "ohss"),
    cancelled: cell(c, "cancelled"),
    complications: cell(c, "complications"),
  }));

  const historicalNote = historicalDoses.length
    ? `${HISTORICAL_VALUE_NOTICE} Previous starting, maximum and total doses are patient-entered history. The engine does not repeat, increase or decrease a previous dose, and never treats a historical dose as a dosing formula.`
    : "No previous stimulation cycle is recorded for this patient.";

  /* --------------------------------------------------- algorithm review */

  const normalize = (v: DosingAlgorithmVariable): NormalizedVariable => {
    let raw: number | null = null;
    if (v.fieldKey === "age") raw = age;
    else if (v.fieldKey === "bmi") raw = bmi;
    else if (v.fieldKey === "fsh") raw = i.fsh;
    else if (v.fieldKey) raw = toNum(values[v.fieldKey]);

    const present = raw !== null && Number.isFinite(raw);
    let valid = present;
    let issue: string | null = null;

    if (!present) {
      issue = "Value not recorded.";
    } else if (v.min !== null && (raw as number) < v.min) {
      valid = false;
      issue = `Below the physiological range accepted by the source (${v.min}–${v.max ?? "∞"} ${v.unit}).`;
    } else if (v.max !== null && (raw as number) > v.max) {
      valid = false;
      issue = `Above the physiological range accepted by the source (${v.min ?? "0"}–${v.max} ${v.unit}).`;
    }

    if (!v.exactMatch) {
      valid = false;
      issue =
        issue ??
        "The exact variable defined by the source is not captured; no substitution is validated.";
    }

    return {
      id: v.id,
      label: v.label,
      sourceDefinition: v.sourceDefinition,
      originalValue: present ? String(raw) : NOT_RECORDED,
      originalUnit: v.unit,
      normalizedValue: present ? (raw as number) : null,
      normalizedUnit: v.unit,
      present,
      valid,
      issue,
      exactMatch: v.exactMatch,
      substitutionNote: v.substitutionNote ?? null,
      stepId: v.stepId,
    };
  };

  const assessAlgorithm = (def: DosingAlgorithmDefinition): AlgorithmAssessment => {
    const variables = def.requiredVariables.map(normalize);
    const missingVariables = variables
      .filter((v) => !v.present)
      .map((v) => ({ id: v.id, label: v.label, stepId: v.stepId }));
    const invalidVariables = variables
      .filter((v) => v.present && !v.valid)
      .map((v) => ({ id: v.id, label: v.label, issue: v.issue ?? "Invalid value." }));

    const missingComponents = def.components.filter((c) => !c.loaded);
    const activated = def.activated() && missingComponents.length === 0;

    const bounds = def.populationBounds;
    const ageKnown = age !== null;
    const insidePopulation =
      ageKnown &&
      (bounds.ageMin === null || (age as number) >= bounds.ageMin) &&
      (bounds.ageMax === null || (age as number) <= bounds.ageMax);

    let matchStatus: MatchStatus;
    let matchExplanation: string;
    if (!activated) {
      matchStatus = "EVIDENCE_PENDING";
      matchExplanation =
        "The validated numerical algorithm is not loaded, so patient applicability cannot lead to a calculation. Population comparison is shown for information only.";
    } else if (!ageKnown) {
      matchStatus = "INSUFFICIENT_DATA";
      matchExplanation = "Age is required before population membership can be established.";
    } else if (!insidePopulation) {
      matchStatus = "OUTSIDE_VALIDATED_POPULATION";
      matchExplanation = `The patient (age ${age}) falls outside the validated population (${bounds.note}).`;
    } else if (missingVariables.length || invalidVariables.length) {
      matchStatus = "INSUFFICIENT_DATA";
      matchExplanation = "The patient matches the validated population, but required inputs are missing or invalid.";
    } else {
      matchStatus = "MATCH";
      matchExplanation = "The patient falls inside the validated population and every required input is valid.";
    }

    // Descriptive comparison is always shown, even while the algorithm is pending.
    const populationNote = ageKnown
      ? insidePopulation
        ? "Patient age lies inside the published age range."
        : "Patient age lies outside the published age range."
      : "Patient age not recorded.";

    const gate = evaluateTreatmentGate("starting-dose");
    const status: AlgorithmStatus = activated
      ? missingVariables.length || invalidVariables.length
        ? "DATA_INCOMPLETE"
        : "ACTIVE"
      : "EVIDENCE_PENDING";

    const blockReason = activated
      ? missingVariables.length || invalidVariables.length
        ? "Required patient inputs are missing or invalid, so no dose is calculated."
        : matchStatus === "OUTSIDE_VALIDATED_POPULATION"
          ? "The patient is outside the validated population; the algorithm output would not be validated for this patient."
          : ""
      : `${def.name}: the validated numerical components are not loaded (${missingComponents.length} component(s) missing). ${gate.statusLabel}.`;

    // HARD GATE: no dose can be produced unless the registered algorithm is
    // activated, the patient is inside the validated population and every
    // required variable is valid. Nothing is derived from any other source.
    const canCalculate =
      activated && matchStatus === "MATCH" && missingVariables.length === 0 && invalidVariables.length === 0;
    const calculatedDose: number | null = canCalculate
      ? gatedTreatmentValue("starting-dose", null)
      : null;

    const evidence = def.evidenceId ? findEvidence(def.evidenceId) : null;

    return {
      id: def.id,
      name: def.name,
      version: def.version,
      source: def.source,
      evidenceId: def.evidenceId,
      evidenceTitle: evidence?.title ?? null,
      evidenceDoi: evidence?.doi ?? null,
      evidenceUrl: evidence?.url ?? (evidence?.doi ? `https://doi.org/${evidence.doi}` : null),
      gonadotropin: def.gonadotropin,
      validatedPopulation: def.validatedPopulation,
      status,
      statusLabel:
        status === "ACTIVE" ? "Active" : status === "DATA_INCOMPLETE" ? "Data incomplete" : "Evidence pending",
      activated,
      matchStatus,
      matchExplanation,
      patientDescription: [
        `Age: ${show(age, "years")}`,
        `BMI: ${show(bmi, "kg/m²")}`,
        `Basal FSH: ${show(i.fsh, "IU/L")}`,
        `AFC: ${show(i.afc)}`,
        populationNote,
      ].join(" · "),
      variables,
      missingVariables,
      invalidVariables,
      components: def.components,
      missingComponents,
      doseUnit: def.doseUnit,
      frequency: def.frequency,
      roundingRule: def.roundingRule,
      doseLimits: def.doseLimits,
      calculatedDose,
      calculationDetails: canCalculate
        ? []
        : [
            "No calculation was performed.",
            "No intermediate score, band or partial result exists, because the published tables are not loaded.",
          ],
      blockReason,
      notes: def.notes,
    };
  };

  const algorithms = dosingAlgorithms.map(assessAlgorithm);

  /* ------------------------------------------------------ current treatment */

  const gonadotropinSelected = Boolean(options?.gonadotropinSelected && options?.gonadotropinName);
  const currentTreatment = {
    protocolName: options?.protocolName ?? "Protocol not yet selected.",
    protocolStatus: options?.protocolEvidenceStatus ?? "Evidence Pending",
    protocolDecisionStatus:
      options?.protocolDecisionStatus ?? "No physician protocol decision recorded",
    gonadotropinName: options?.gonadotropinName ?? null,
    gonadotropinStatus:
      options?.gonadotropinStatus ?? "No physician gonadotropin decision recorded",
    gonadotropinSelected,
    blockingMessage: gonadotropinSelected
      ? null
      : "Gonadotropin selection required before starting-dose assessment.",
  };

  /* ------------------------------------------------------------- state */

  const activeAlgorithm = algorithms.find((a) => a.calculatedDose !== null) ?? null;
  const anyActivated = algorithms.some((a) => a.activated);
  const anyOutside = algorithms.some((a) => a.matchStatus === "OUTSIDE_VALIDATED_POPULATION");
  const anyInsufficient = algorithms.some((a) => a.matchStatus === "INSUFFICIENT_DATA");
  const physician = options?.physicianDose ?? null;

  let state: DoseOutputState;
  let stateExplanation: string;

  if (activeAlgorithm && activeAlgorithm.calculatedDose !== null) {
    state = "CALCULATED";
    stateExplanation = `Calculated with ${activeAlgorithm.name} (${activeAlgorithm.version}).`;
  } else if (!anyActivated && evidenceReportedDoses.length > 0) {
    state = "EVIDENCE_SUPPORTED_RANGE";
    stateExplanation =
      "No validated individualized calculation is available. Evidence-reported starting-dose ranges are displayed for physician interpretation; they are not a recommendation for this patient.";
  } else if (!anyActivated && physician) {
    state = "PHYSICIAN_SELECTED";
    stateExplanation =
      "No validated dosing algorithm is available. The displayed dose was entered by the treating physician and is labelled PHYSICIAN-SELECTED, not AI-recommended.";
  } else if (anyActivated && anyOutside) {
    state = "OUTSIDE_VALIDATED_POPULATION";
    stateExplanation =
      "A validated algorithm exists, but this patient falls outside the population in which it was validated.";
  } else if (anyActivated && anyInsufficient) {
    state = "INSUFFICIENT_DATA";
    stateExplanation =
      "A validated algorithm exists, but required patient inputs are missing or invalid.";
  } else {
    state = "EVIDENCE_PENDING";
    stateExplanation = STARTING_DOSE_REPORT_LANGUAGE;
  }

  const dose = state === "CALCULATED" ? activeAlgorithm?.calculatedDose ?? null : null;

  /* -------------------------------------------------------- CONSORT firewall */

  const consortGate = evaluateTreatmentGate("consort-dose");
  // Any stored CONSORT dose is passed through the gate (which returns null
  // while CONSORT is EVIDENCE_PENDING) and then discarded entirely.
  void gatedTreatmentValue("consort-dose", options?.consortDoseFromStore ?? null);

  const consortFirewall = {
    status: consortGate.status,
    statusLabel: consortGate.statusLabel,
    modelLoaded: isConsortModelLoaded(),
    dose: null as null,
    doseDisplay: NOT_CALCULATED,
    frameworkIdentified: CONSORT_FRAMEWORK_STATUS.frameworkIdentified,
    doseCalculationActive: CONSORT_FRAMEWORK_STATUS.doseCalculationActive,
    missingComponents: CONSORT_MISSING_COMPONENTS.map((c) => ({
      symbol: c.symbol,
      detail: c.detail,
    })),
    statements: [
      `CONSORT status: ${consortGate.statusLabel}.`,
      "consortModelTable.loaded = false — validated coefficients and dose crosswalk are not loaded.",
      CONSORT_MODEL_PENDING_MESSAGE,
      "CONSORT dose = null. No CONSORT value enters the Starting Dose Engine.",
      "No dose is reconstructed, estimated, interpolated or reverse-engineered from age, BMI, AMH, AFC, FSH, POSEIDON, Bologna, previous response or a historical dose.",
      CONSORT_FOLL_LT11_NOTE,
    ],
  };

  /* --------------------------------------------------- missing information */

  const missing = (
    id: string,
    title: string,
    entries: { id: string; label: string; stepId: string; present: boolean }[],
  ): StartingDoseMissingGroup => ({
    id,
    title,
    items: entries
      .filter((e) => !e.present)
      .map(({ id: eid, label, stepId }) => ({ id: eid, label, stepId })),
  });

  const missingInformation: StartingDoseMissingGroup[] = [
    missing("core", "Required for any dosing algorithm", [
      { id: "sd-age", label: "Age / date of birth", stepId: "patient", present: age !== null },
      { id: "sd-bmi", label: "Height and weight (BMI)", stepId: "patient", present: bmi !== null },
      { id: "sd-fsh", label: "Basal FSH", stepId: "reserve", present: i.fsh !== null },
      { id: "sd-afc", label: "Antral follicle count", stepId: "ultrasound", present: i.afc !== null },
      { id: "sd-amh", label: "AMH", stepId: "reserve", present: i.amh !== null },
    ]),
    missing("treatment", "Required for starting-dose assessment", [
      {
        id: "sd-gonadotropin",
        label: "Physician gonadotropin selection",
        stepId: "cycles",
        present: gonadotropinSelected,
      },
      {
        id: "sd-protocol",
        label: "Physician protocol decision",
        stepId: "cycles",
        present: Boolean(options?.protocolName),
      },
    ]),
    missing("history", "Previous-cycle information", [
      { id: "sd-cycles", label: "Previous cycle records", stepId: "cycles", present: cycles.length > 0 },
      {
        id: "sd-previous-dose",
        label: "Starting dose used in previous cycles",
        stepId: "cycles",
        present: cycles.length === 0 || historicalDoses.some((h) => h.startingDose !== NOT_RECORDED),
      },
      {
        id: "sd-previous-yield",
        label: "Oocyte yield of previous cycles",
        stepId: "cycles",
        present: cycles.length === 0 || historicalDoses.some((h) => h.retrieved !== NOT_RECORDED),
      },
    ]),
    missing("safety", "Safety information", [
      { id: "sd-ohss", label: "Previous OHSS status", stepId: "medical", present: i.ohssHistory !== null },
      {
        id: "sd-surgery",
        label: "Previous ovarian surgery",
        stepId: "medical",
        present: s(values["ovarianSurgery"]) !== null,
      },
    ]),
  ].filter((g) => g.items.length > 0);

  /* ------------------------------------------------------------ summary */

  const evidenceSources = algorithms
    .map((a) => a.evidenceId)
    .filter((id): id is string => Boolean(id));

  const evidenceLimitations = [
    "No held source supplies a complete validated individualized starting-dose calculation (coefficients, crosswalk, rounding rule and dose limits).",
    "CONSORT: the model structure and predictor set are verified, but α, β1–β6 and the score-to-dose crosswalk are not published in the held texts.",
    "FOLL_LT11 (follicles < 11 mm at screening) is not captured as a distinct field, and no source validates substituting a general antral follicle count.",
    "No starting-dose range table from any indexed source has been transcribed into the Evidence Library.",
    "POSEIDON group, Bologna status, predicted response and previous response are context only; no indexed source maps any of them to a dose.",
  ];

  const safetyGuardrails = [
    "This engine does not prescribe or order medication.",
    "This engine performs no dose adjustment — Day 5, Day 7, E2-based, follicle-based, LH-based and P4-based adjustments belong to the Monitoring & Dose Adjustment Engine.",
    "This engine produces no trigger agent, trigger timing or trigger dose.",
    "This engine does not diagnose OHSS and produces no freeze-all, fresh-transfer or cancellation decision.",
    "This engine never changes the selected protocol or gonadotropin.",
  ];

  const observedResponse = historicalDoses
    .filter((h) => h.retrieved !== NOT_RECORDED)
    .map(
      (h) =>
        `${h.label}: ${h.startingDose} for ${h.duration} → ${h.retrieved} oocyte(s), MII ${h.mii}, blastocysts ${h.blastocysts}`,
    );

  return {
    patientId,
    patientName,
    contextGroups,
    currentTreatment,
    historicalDoses,
    historicalNote,
    evidenceReportedDoses,
    evidenceReportedNote:
      evidenceReportedDoses.length === 0
        ? "No starting dose or dose range has been transcribed from any indexed source. Study doses are not converted into patient-specific recommendations."
        : "Evidence-reported doses are study values, shown with their population, design, outcome and limitations. They are not a recommendation for this patient.",
    algorithms,
    state,
    stateLabel: doseStateLabel[state],
    stateExplanation,
    dose,
    doseDisplay: dose === null ? NOT_CALCULATED : String(dose),
    doseUnit: dose === null ? null : activeAlgorithm?.doseUnit ?? null,
    doseFrequency: dose === null ? null : activeAlgorithm?.frequency ?? null,
    producedByAlgorithmId: dose === null ? null : activeAlgorithm?.id ?? null,
    consortFirewall,
    safetyGuardrails,
    missingInformation,
    evidenceLimitations,
    evidenceSources,
    poseidonContext: phenotype.poseidon.groupLabel ?? phenotype.poseidon.headline,
    bolognaContext: bolognaStatusLabel[phenotype.bologna.status],
    reserveContext: reserveCategoryLabel[phenotype.reserve.category],
    predictedResponse: responseCategoryLabel[response.category],
    observedResponse,
    patientContextVersion: `${patientId}:${Object.keys(values).length}f:${cycles.length}c`,
    note: STARTING_DOSE_NOTE,
    reportLanguage: STARTING_DOSE_REPORT_LANGUAGE,
    computedAt: new Date().toISOString(),
    version: STARTING_DOSE_VERSION,
  };
}

/* ------------------------------------------------------------ report text */

export function startingDoseReportText(r: StartingDoseResult): string {
  const lines: string[] = [
    "STARTING GONADOTROPIN DOSE ASSESSMENT",
    `Patient: ${r.patientName}`,
    `Engine version: ${r.version} — generated ${new Date(r.computedAt).toLocaleString()}`,
    "",
    `Current protocol: ${r.currentTreatment.protocolName} (${r.currentTreatment.protocolStatus})`,
    `Current gonadotropin: ${r.currentTreatment.gonadotropinName ?? "Not selected"} (${r.currentTreatment.gonadotropinStatus})`,
    "",
    `STARTING DOSE: ${r.dose === null ? "NOT CALCULATED" : `${r.dose} ${r.doseUnit ?? ""}`}`,
    `State: ${r.stateLabel}`,
    r.stateExplanation,
    "",
    "HISTORICAL DOSES",
    ...(r.historicalDoses.length
      ? r.historicalDoses.map(
          (h) => `  ${h.label}: ${h.gonadotropin} ${h.startingDose} (max ${h.maxDose}) — HISTORICAL DOSE, NOT A CURRENT RECOMMENDATION`,
        )
      : ["  No previous cycle recorded."]),
    "",
    "VALIDATED ALGORITHMS",
    ...r.algorithms.map(
      (a) =>
        `  ${a.name}: ${a.statusLabel} · applicability ${matchStatusLabel[a.matchStatus]} · dose ${a.calculatedDose === null ? NOT_CALCULATED : a.calculatedDose}`,
    ),
    "",
    "CONSORT STATUS",
    ...r.consortFirewall.statements.map((x) => `  ${x}`),
    "",
    "EVIDENCE LIMITATIONS",
    ...r.evidenceLimitations.map((x) => `  • ${x}`),
  ];
  return lines.join("\n");
}
