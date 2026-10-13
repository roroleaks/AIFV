/**
 * CONSORT Individualized Starting Dose Calculator (V1).
 *
 * Imports the variables the published CONSORT algorithm consumes, validates
 * them, and computes the starting recombinant FSH dose ONLY through the
 * transcribed published tables in `consort-model.ts`. No equation is invented,
 * no coefficient is modified, no missing value is estimated.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import type { PhenotypeResult } from "./phenotype";
import type { OvarianResponseResult } from "./ovarian-response";
import { responseCategoryLabel } from "./ovarian-response";
import {
  CONSORT_MODEL_PENDING_MESSAGE,
  consortModelTable,
  doseForScore,
  isConsortModelLoaded,
  scoreVariable,
  type ConsortVariableId,
} from "./consort-model";

export const CONSORT_CALCULATOR_VERSION = "1.0.0";

export const consortEvidenceIds = ["rbmo-2015-consort-fsh-dose", "eshre-2020-ovarian-stimulation"];

export const CONSORT_MEDICATION = "Recombinant FSH (follitropin alfa)";

export const consortClinicalNotes = [
  "This is the suggested starting dose according to the validated CONSORT methodology.",
  "Final prescribing decisions remain the responsibility of the treating physician.",
];

/* ------------------------------------------------------------- variables */

export type ConsortVariableStatus = "available" | "missing" | "invalid";

export interface ConsortVariable {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  display: string;
  /** Required by the published model. */
  mandatory: boolean;
  /** Consumed by the published calculation itself. */
  usedInCalculation: boolean;
  status: ConsortVariableStatus;
  issue?: string | undefined;
  /** Assessment step to open when the value is missing. */
  stepId: string;
}

export interface ConsortHistoryItem {
  id: string;
  label: string;
  value: string;
  available: boolean;
}

/* ------------------------------------------------------------ validation */

export interface ConsortConflict {
  id: string;
  label: string;
  detail: string;
}

export interface ConsortValidation {
  missing: ConsortVariable[];
  invalid: ConsortVariable[];
  duplicates: ConsortConflict[];
  conflicts: ConsortConflict[];
  ready: boolean;
}

/* --------------------------------------------------------------- outcome */

export type ConsortStatus =
  | "completed"
  | "missing-variables"
  | "invalid-data"
  | "data-conflict"
  | "methodology-not-loaded"
  | "out-of-model-range";

export const consortStatusLabel: Record<ConsortStatus, string> = {
  completed: "Completed",
  "missing-variables": "Not calculated — missing variables",
  "invalid-data": "Not calculated — incorrect data",
  "data-conflict": "Not calculated — data conflict",
  "methodology-not-loaded": "Not calculated — methodology not loaded",
  "out-of-model-range": "Not calculated — outside published model range",
};

export interface ConsortContribution {
  id: ConsortVariableId;
  label: string;
  value: string;
  band: string;
  influence: string;
}

export interface ConsortResult {
  patientId: string;
  patientName: string;
  status: ConsortStatus;
  /** Starting dose in IU/day. Null unless status is "completed". */
  dose: number | null;
  medication: string;
  reason: string | null;
  variables: ConsortVariable[];
  history: ConsortHistoryItem[];
  validation: ConsortValidation;
  contributions: ConsortContribution[];
  narrative: string[];
  clinicalNotes: string[];
  evidenceSource: string[];
  modelName: string;
  validatedPopulation: string;
  computedAt: string;
  version: string;
}

/* ---------------------------------------------------------------- helpers */

const num = (v: FieldValue): number | null => toNum(v);

interface Range {
  min: number;
  max: number;
}

const ranges: Record<string, Range> = {
  age: { min: 16, max: 60 },
  bmi: { min: 12, max: 70 },
  amh: { min: 0, max: 40 },
  afc: { min: 0, max: 80 },
  fsh: { min: 0.1, max: 60 },
};

function makeVariable(
  id: keyof typeof ranges,
  label: string,
  unit: string,
  value: number | null,
  mandatory: boolean,
  usedInCalculation: boolean,
  stepId: string,
): ConsortVariable {
  const range = ranges[id]!;
  let status: ConsortVariableStatus = "available";
  let issue: string | undefined;
  if (value === null) {
    status = "missing";
  } else if (!Number.isFinite(value) || value < range.min || value > range.max) {
    status = "invalid";
    issue = `Outside the physiologically possible range (${range.min}–${range.max} ${unit}).`;
  }
  return {
    id,
    label,
    unit,
    value,
    display: value === null ? "Not recorded" : `${value} ${unit}`.trim(),
    mandatory,
    usedInCalculation,
    status,
    issue,
    stepId,
  };
}

/* ---------------------------------------------------------------- builder */

export function calculateConsortDose(
  patientId: string,
  patientName: string,
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
): ConsortResult {
  const i = response.inputs;

  const age = phenotype.patientSummary.age ?? i.age;
  const bmi = phenotype.patientSummary.bmi ?? i.bmi;
  const amh = phenotype.reserve.amh ?? i.amh;
  const afc = phenotype.reserve.afc ?? i.afc;
  const fsh = phenotype.reserve.fsh ?? i.fsh;

  const variables: ConsortVariable[] = [
    makeVariable("age", "Age", "years", age, true, true, "patient"),
    makeVariable("bmi", "Body mass index", "kg/m²", bmi, true, true, "patient"),
    makeVariable("fsh", "Basal FSH", "IU/L", fsh, true, true, "reserve"),
    makeVariable("afc", "Antral follicle count", "follicles", afc, true, true, "ultrasound"),
    makeVariable("amh", "AMH", "ng/mL", amh, false, false, "reserve"),
  ];

  /* --------------------------------------------------- previous IVF history */

  const retrievedPerCycle = cycles
    .map((c) => num(c["retrieved"]))
    .filter((v): v is number => v !== null);
  const lastRetrieved = retrievedPerCycle.length
    ? retrievedPerCycle[retrievedPerCycle.length - 1]!
    : null;

  const history: ConsortHistoryItem[] = [
    {
      id: "previous-ivf",
      label: "Previous IVF history",
      value: cycles.length ? `${cycles.length} recorded cycle(s)` : "No previous cycle recorded",
      available: cycles.length > 0,
    },
    {
      id: "previous-response",
      label: "Previous ovarian response",
      value: i.poorResponseHistory
        ? "Poor response reported"
        : i.hyperResponseHistory
          ? "Hyper response reported"
          : `Predicted: ${responseCategoryLabel[response.category]}`,
      available: i.poorResponseHistory || i.hyperResponseHistory || response.category !== "unable",
    },
    {
      id: "previous-retrieved",
      label: "Previous retrieved oocytes",
      value:
        lastRetrieved === null ? "Not recorded" : `${lastRetrieved} oocyte(s) in the last cycle`,
      available: lastRetrieved !== null,
    },
  ];

  /* ------------------------------------------------------------ validation */

  const missing = variables.filter((v) => v.mandatory && v.status === "missing");
  const invalid = variables.filter((v) => v.status === "invalid");

  const duplicates: ConsortConflict[] = [];
  const seenCycleKeys = new Map<string, number>();
  cycles.forEach((c) => {
    const key = [c["cycleNumber"], c["cycleYear"], c["retrieved"]].join("|");
    if (key.replace(/\|/g, "").trim() === "") return;
    seenCycleKeys.set(key, (seenCycleKeys.get(key) ?? 0) + 1);
  });
  seenCycleKeys.forEach((count, key) => {
    if (count > 1)
      duplicates.push({
        id: `dup-${key}`,
        label: "Duplicate cycle entry",
        detail: `${count} previous-cycle records share the same cycle number, year and oocyte yield.`,
      });
  });

  const conflicts: ConsortConflict[] = [];
  if (afc !== null && amh !== null) {
    if (afc <= 4 && amh >= 3)
      conflicts.push({
        id: "afc-amh",
        label: "AFC and AMH disagree",
        detail: `AFC ${afc} indicates a low antral cohort while AMH ${amh} ng/mL indicates a high reserve. Confirm both values before dosing.`,
      });
    if (afc >= 20 && amh <= 0.5)
      conflicts.push({
        id: "afc-amh-high",
        label: "AFC and AMH disagree",
        detail: `AFC ${afc} indicates a high antral cohort while AMH ${amh} ng/mL indicates a very low reserve. Confirm both values before dosing.`,
      });
  }
  if (fsh !== null && afc !== null && fsh >= 15 && afc >= 20)
    conflicts.push({
      id: "fsh-afc",
      label: "Basal FSH and AFC disagree",
      detail: `Basal FSH ${fsh} IU/L with an AFC of ${afc} is an unusual combination. Confirm the sampling day of the FSH assay.`,
    });
  if (String(values["hasPreviousCycles"] ?? "") === "No" && cycles.length > 0)
    conflicts.push({
      id: "cycles-flag",
      label: "Previous cycle answer conflicts with cycle records",
      detail: `The assessment records "no previous cycles" while ${cycles.length} cycle record(s) exist.`,
    });

  const validation: ConsortValidation = {
    missing,
    invalid,
    duplicates,
    conflicts,
    ready: missing.length === 0 && invalid.length === 0 && conflicts.length === 0,
  };

  /* ----------------------------------------------------------- calculation */

  let status: ConsortStatus = "completed";
  let reason: string | null = null;
  let dose: number | null = null;
  const contributions: ConsortContribution[] = [];
  const narrative: string[] = [];

  if (invalid.length > 0) {
    status = "invalid-data";
    reason = `Incorrect data: ${invalid.map((v) => v.label).join(", ")}. Correct the value(s) in the assessment before calculating.`;
  } else if (missing.length > 0) {
    status = "missing-variables";
    reason = `Calculation cannot be completed. The published CONSORT model requires: ${missing.map((v) => v.label).join(", ")}.`;
  } else if (conflicts.length > 0) {
    status = "data-conflict";
    reason = `Data conflict detected: ${conflicts.map((c) => c.label).join("; ")}. Resolve the conflict before calculating.`;
  } else if (!isConsortModelLoaded()) {
    status = "methodology-not-loaded";
    reason = CONSORT_MODEL_PENDING_MESSAGE;
  } else {
    const inputById: Record<ConsortVariableId, number> = {
      basalFsh: fsh as number,
      bmi: bmi as number,
      age: age as number,
      afc: afc as number,
    };
    let total = 0;
    let outOfRange: string | null = null;

    for (const variable of consortModelTable.variables) {
      const value = inputById[variable.id];
      const scored = scoreVariable(variable, value);
      if (!scored) {
        outOfRange = `${variable.label} (${value} ${variable.unit}) falls outside the bands published for the CONSORT model. No dose is produced outside the validated range.`;
        break;
      }
      total += scored.points;
      contributions.push({
        id: variable.id,
        label: variable.label,
        value: `${value} ${variable.unit}`,
        band: scored.band.label,
        influence:
          scored.points > 0
            ? `Increases the calculated starting dose (${variable.label.toLowerCase()} band ${scored.band.label}).`
            : `Does not increase the calculated starting dose (${variable.label.toLowerCase()} band ${scored.band.label}).`,
      });
    }

    if (outOfRange) {
      status = "out-of-model-range";
      reason = outOfRange;
      contributions.length = 0;
    } else {
      const computed = doseForScore(total);
      if (computed === null) {
        status = "out-of-model-range";
        reason =
          "The combination of patient characteristics maps outside the dose range published for the CONSORT model. No dose is produced.";
        contributions.length = 0;
      } else {
        dose = computed;
        narrative.push(
          `The starting dose was derived from the four baseline characteristics the CONSORT model consumes: age, body mass index, basal FSH and antral follicle count.`,
          `Values outside these four variables — including AMH, previous cycles and predicted response — are displayed for context and did not modify the calculated dose.`,
        );
      }
    }
  }

  return {
    patientId,
    patientName,
    status,
    dose,
    medication: CONSORT_MEDICATION,
    reason,
    variables,
    history,
    validation,
    contributions,
    narrative,
    clinicalNotes:
      dose === null
        ? [
            "CONSORT dose calculation pending complete patient variables. No starting dose, estimate or fallback is produced.",
            "Final prescribing decisions remain the responsibility of the treating physician.",
          ]
        : consortClinicalNotes,

    evidenceSource: consortEvidenceIds,
    modelName: consortModelTable.name,
    validatedPopulation: consortModelTable.validatedPopulation,
    computedAt: new Date().toISOString(),
    version: CONSORT_CALCULATOR_VERSION,
  };
}

/** Plain-text starting-dose section for the final clinical report. */
export function consortReportText(r: ConsortResult): string {
  const used = r.variables.filter((v) => v.usedInCalculation);
  return [
    "INDIVIDUALIZED STARTING DOSE (CONSORT)",
    `Patient: ${r.patientName}`,
    `Calculation date: ${new Date(r.computedAt).toLocaleString()}`,
    "",
    "Variables used",
    ...used.map((v) => `- ${v.label}: ${v.display}`),
    `- AMH (context only): ${r.variables.find((v) => v.id === "amh")?.display ?? "Not recorded"}`,
    ...r.history.map((h) => `- ${h.label}: ${h.value}`),
    "",
    r.dose === null
      ? "Starting dose: Not calculated — complete patient variables required (Age, BMI, Basal FSH, AFC)."
      : `Calculated starting dose (validated CONSORT methodology): ${r.dose} IU/day`,
    `Medication: ${r.medication}`,
    `Calculation status: ${consortStatusLabel[r.status]}`,

    ...(r.reason ? [`Reason: ${r.reason}`] : []),
    "",
    `Calculation method: ${r.modelName}`,
    `Validated population: ${r.validatedPopulation}`,
    "Evidence reference: CONSORT individualised FSH starting-dose methodology (Reproductive BioMedicine Online).",
    `Calculation version: v${r.version}`,
    "",
    "Clinical notes",
    ...r.clinicalNotes.map((n) => `- ${n}`),
  ].join("\n");
}
