/**
 * Ovarian Response Prediction & Risk Stratification Engine (v1).
 *
 * Characterises the patient's EXPECTED ovarian response to stimulation using
 * the biomarkers and cycle history already recorded in the assessment, and the
 * response categories already used by the published frameworks indexed in the
 * Evidence Engine (POSEIDON — Alviggi 2016 / Humaidan 2016; Bologna — Ferraretti
 * 2011; ESHRE ovarian stimulation guideline 2020; ASRM ovarian reserve testing
 * 2020; ASRM OHSS prevention 2016).
 *
 * ASSESSMENT ONLY. This module produces NO protocol, medication, gonadotropin,
 * dose or trigger recommendation, and NO pregnancy / live-birth prediction.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import {
  POSEIDON_AFC_THRESHOLD,
  POSEIDON_AMH_THRESHOLD,
  POSEIDON_POOR_OOCYTES,
  POSEIDON_SUBOPTIMAL_MAX,
  type PoseidonResult,
} from "./poseidon";
import { BOLOGNA_AFC_THRESHOLD, BOLOGNA_AMH_THRESHOLD, type BolognaResult } from "./bologna";

export const OVARIAN_RESPONSE_ENGINE_VERSION = "1.0.0";

export const ovarianResponseEvidenceIds = [
  "eshre-2020-ovarian-stimulation",
  "asrm-2020-ovarian-reserve-testing",
  "asrm-2016-ohss-prevention",
  "poseidon-2016-alviggi",
  "bologna-2011-ferraretti",
];

/* ------------------------------------------------------------ categories */

export type ResponseCategory =
  "very-poor" | "poor" | "suboptimal" | "normal" | "high" | "hyper" | "unable";

export const responseSpectrum: Exclude<ResponseCategory, "unable">[] = [
  "very-poor",
  "poor",
  "suboptimal",
  "normal",
  "high",
  "hyper",
];

export const responseCategoryLabel: Record<ResponseCategory, string> = {
  "very-poor": "Very Poor Response",
  poor: "Poor Response",
  suboptimal: "Suboptimal Response",
  normal: "Normal Response",
  high: "High Response",
  hyper: "Hyper Response",
  unable: "Unable to Assess",
};

export const responseCategoryTone: Record<
  ResponseCategory,
  "red" | "amber" | "green" | "violet" | "blue"
> = {
  "very-poor": "red",
  poor: "red",
  suboptimal: "amber",
  normal: "green",
  high: "violet",
  hyper: "violet",
  unable: "blue",
};

/* ----------------------------------------------------------------- risks */

export type RiskSeverity = "info" | "moderate" | "high";

export interface ResponseRisk {
  id: string;
  label: string;
  severity: RiskSeverity;
  /** Which recorded information supports showing this risk. */
  basis: string;
}

/* ---------------------------------------------------------------- inputs */

export interface PreviousCycleSignal {
  cycleLabel: string;
  protocol: string | null;
  startingDose: number | null;
  retrieved: number | null;
  mature: number | null;
  fertilizationRate: number | null;
  blastocysts: number | null;
  ohss: string | null;
  cancelled: boolean;
}

export interface ResponseInputs {
  age: number | null;
  bmi: number | null;
  amh: number | null;
  afc: number | null;
  fsh: number | null;
  lh: number | null;
  estradiol: number | null;
  previousCycles: number;
  cycleSignals: PreviousCycleSignal[];
  poorResponseHistory: boolean;
  hyperResponseHistory: boolean;
  ohssHistory: string | null;
  pcos: boolean;
  endometriosis: boolean;
  smoking: string | null;
}

export interface ResponseVariable {
  id: string;
  label: string;
  value: string;
  present: boolean;
  /** Assessment step to open when the value is missing. */
  stepId: string;
}

export type ResponseDataQuality = "complete" | "partial" | "insufficient";

export interface ResponseValidation {
  missing: ResponseVariable[];
  conflicting: string[];
  abnormal: string[];
  incompleteHistory: string[];
  quality: ResponseDataQuality;
}

export interface ResponseExplanation {
  contributingVariables: string[];
  previousCycleFindings: string[];
  biomarkersConsidered: string[];
  missingInformation: string[];
}

export interface OvarianResponseResult {
  category: ResponseCategory;
  headline: string;
  /** Data completeness only — never clinical certainty. */
  confidence: number;
  inputs: ResponseInputs;
  variables: ResponseVariable[];
  validation: ResponseValidation;
  risks: ResponseRisk[];
  explanation: ResponseExplanation;
  evidence: string[];
  computedAt: string;
  version: string;
}

/* ------------------------------------------------------------- extraction */

const str = (v: FieldValue): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

function ageFromDob(dob: FieldValue): number | null {
  if (typeof dob !== "string" || !dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

const isStimulationCycle = (c: CycleRecord) => {
  const type = String(c["cycleType"] ?? "");
  if (type === "IUI" || type === "Frozen transfer only") return false;
  return toNum(c["retrieved"]) !== null || Boolean(c["protocol"]) || Boolean(c["startingDose"]);
};

export function extractResponseInputs(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): ResponseInputs {
  const afcL = toNum(values["afcLeft"]);
  const afcR = toNum(values["afcRight"]);
  const afc = afcL === null && afcR === null ? null : (afcL ?? 0) + (afcR ?? 0);

  const heightCm = toNum(values["height"]);
  const weightKg = toNum(values["weight"]);
  const bmi =
    heightCm && weightKg ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null;

  const stim = cycles.filter(isStimulationCycle);
  const cycleSignals: PreviousCycleSignal[] = stim.map((c, i) => {
    const mature = toNum(c["mii"]);
    const fertilized = toNum(c["fertilized"]);
    const ohss = str(c["ohss"]);
    return {
      cycleLabel: `Cycle ${toNum(c["cycleNumber"]) ?? i + 1}${
        toNum(c["cycleYear"]) ? ` (${toNum(c["cycleYear"])})` : ""
      }`,
      protocol: str(c["protocol"]),
      startingDose: toNum(c["startingDose"]),
      retrieved: toNum(c["retrieved"]),
      mature,
      fertilizationRate:
        mature && fertilized !== null && mature > 0
          ? Math.round((fertilized / mature) * 100)
          : null,
      blastocysts: toNum(c["blastocysts"]),
      ohss: ohss && ohss !== "No" ? ohss : null,
      cancelled: c["cancelled"] === "Yes",
    };
  });

  const yields = cycleSignals
    .map((c) => c.retrieved)
    .filter((n): n is number => n !== null && n >= 0);

  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];
  const pcos =
    causes.includes("PCOS") ||
    values["rightOvary"] === "Polycystic morphology" ||
    values["leftOvary"] === "Polycystic morphology";
  const endometriosis =
    causes.includes("Endometriosis") ||
    (str(values["endometriosisStage"]) !== null &&
      values["endometriosisStage"] !== "None" &&
      values["endometriosisStage"] !== "Unknown") ||
    (str(values["usEndometrioma"]) !== null && values["usEndometrioma"] !== "None");

  return {
    age: toNum(values["age"]) ?? ageFromDob(values["dob"]),
    bmi,
    amh: toNum(values["amh"]),
    afc,
    fsh: toNum(values["fsh"]),
    lh: toNum(values["lh"]),
    estradiol: toNum(values["estradiol"]),
    previousCycles: stim.length,
    cycleSignals,
    poorResponseHistory: yields.some((y) => y < POSEIDON_POOR_OOCYTES),
    hyperResponseHistory: yields.some((y) => y >= 20) || cycleSignals.some((c) => c.ohss !== null),
    ohssHistory: cycleSignals.map((c) => c.ohss).find((o): o is string => o !== null) ?? null,
    pcos,
    endometriosis,
    smoking: str(values["smoking"]),
  };
}

/* ------------------------------------------------------------- validation */

const fmt = (n: number | null, unit = "") =>
  n === null ? "Not recorded" : `${n}${unit ? ` ${unit}` : ""}`;

function buildVariables(i: ResponseInputs): ResponseVariable[] {
  return [
    { id: "age", label: "Age", value: fmt(i.age, "y"), present: i.age !== null, stepId: "patient" },
    {
      id: "bmi",
      label: "BMI",
      value: fmt(i.bmi, "kg/m²"),
      present: i.bmi !== null,
      stepId: "patient",
    },
    {
      id: "amh",
      label: "AMH",
      value: fmt(i.amh, "ng/mL"),
      present: i.amh !== null,
      stepId: "reserve",
    },
    {
      id: "afc",
      label: "Antral follicle count",
      value: fmt(i.afc),
      present: i.afc !== null,
      stepId: "reserve",
    },
    {
      id: "fsh",
      label: "Basal FSH",
      value: fmt(i.fsh, "IU/L"),
      present: i.fsh !== null,
      stepId: "reserve",
    },
    {
      id: "lh",
      label: "Basal LH",
      value: fmt(i.lh, "IU/L"),
      present: i.lh !== null,
      stepId: "reserve",
    },
    {
      id: "estradiol",
      label: "Estradiol",
      value: fmt(i.estradiol, "pg/mL"),
      present: i.estradiol !== null,
      stepId: "reserve",
    },
    {
      id: "previousCycles",
      label: "Previous IVF/ICSI cycles",
      value: i.previousCycles === 0 ? "None recorded" : String(i.previousCycles),
      present: i.previousCycles > 0,
      stepId: "cycles",
    },
    {
      id: "protocol",
      label: "Previous stimulation protocol",
      value:
        i.cycleSignals
          .map((c) => c.protocol)
          .filter(Boolean)
          .join(", ") || "Not recorded",
      present: i.cycleSignals.some((c) => c.protocol),
      stepId: "cycles",
    },
    {
      id: "dose",
      label: "Previous gonadotropin dose",
      value:
        i.cycleSignals
          .map((c) => (c.startingDose === null ? null : `${c.startingDose} IU`))
          .filter(Boolean)
          .join(", ") || "Not recorded",
      present: i.cycleSignals.some((c) => c.startingDose !== null),
      stepId: "cycles",
    },
    {
      id: "retrieved",
      label: "Previous oocyte yield",
      value:
        i.cycleSignals
          .map((c) => (c.retrieved === null ? null : String(c.retrieved)))
          .filter(Boolean)
          .join(", ") || "Not recorded",
      present: i.cycleSignals.some((c) => c.retrieved !== null),
      stepId: "cycles",
    },
    {
      id: "mature",
      label: "Previous mature (MII) oocytes",
      value:
        i.cycleSignals
          .map((c) => (c.mature === null ? null : String(c.mature)))
          .filter(Boolean)
          .join(", ") || "Not recorded",
      present: i.cycleSignals.some((c) => c.mature !== null),
      stepId: "cycles",
    },
    {
      id: "fertilization",
      label: "Previous fertilization rate",
      value:
        i.cycleSignals
          .map((c) => (c.fertilizationRate === null ? null : `${c.fertilizationRate}%`))
          .filter(Boolean)
          .join(", ") || "Not recorded",
      present: i.cycleSignals.some((c) => c.fertilizationRate !== null),
      stepId: "cycles",
    },
    {
      id: "blastocysts",
      label: "Previous blastocyst development",
      value:
        i.cycleSignals
          .map((c) => (c.blastocysts === null ? null : String(c.blastocysts)))
          .filter(Boolean)
          .join(", ") || "Not recorded",
      present: i.cycleSignals.some((c) => c.blastocysts !== null),
      stepId: "cycles",
    },
    {
      id: "poorResponse",
      label: "History of poor response",
      value: i.previousCycles === 0 ? "No cycle recorded" : i.poorResponseHistory ? "Yes" : "No",
      present: i.previousCycles > 0,
      stepId: "cycles",
    },
    {
      id: "hyperResponse",
      label: "History of hyper response",
      value: i.previousCycles === 0 ? "No cycle recorded" : i.hyperResponseHistory ? "Yes" : "No",
      present: i.previousCycles > 0,
      stepId: "cycles",
    },
    {
      id: "ohss",
      label: "History of OHSS",
      value: i.ohssHistory ?? (i.previousCycles === 0 ? "No cycle recorded" : "No"),
      present: i.previousCycles > 0,
      stepId: "cycles",
    },
    {
      id: "pcos",
      label: "PCOS",
      value: i.pcos ? "Documented" : "Not documented",
      present: true,
      stepId: "cause",
    },
    {
      id: "endometriosis",
      label: "Endometriosis",
      value: i.endometriosis ? "Documented" : "Not documented",
      present: true,
      stepId: "cause",
    },
    {
      id: "smoking",
      label: "Smoking",
      value: i.smoking ?? "Not recorded",
      present: i.smoking !== null,
      stepId: "patient",
    },
  ];
}

function validate(i: ResponseInputs, variables: ResponseVariable[]): ResponseValidation {
  const missing = variables.filter((v) => !v.present);

  const conflicting: string[] = [];
  if (i.amh !== null && i.afc !== null) {
    if (i.amh >= 3.5 && i.afc < POSEIDON_AFC_THRESHOLD)
      conflicting.push(
        `AMH ${i.amh} ng/mL is in the high range while the antral follicle count is only ${i.afc}. Confirm the assay and the ultrasound before relying on either marker.`,
      );
    if (i.amh < BOLOGNA_AMH_THRESHOLD && i.afc >= 15)
      conflicting.push(
        `AMH ${i.amh} ng/mL suggests a very low reserve while the antral follicle count of ${i.afc} does not. Repeat one of the two measurements.`,
      );
  }
  if (i.fsh !== null && i.fsh >= 12 && i.amh !== null && i.amh >= 3.5)
    conflicting.push(
      `Basal FSH ${i.fsh} IU/L and AMH ${i.amh} ng/mL point in opposite directions. Check the cycle day on which FSH was sampled.`,
    );
  if (i.pcos && i.afc !== null && i.afc < POSEIDON_AFC_THRESHOLD)
    conflicting.push(
      `PCOS is documented but the antral follicle count is ${i.afc}. Re-check the ultrasound or the diagnosis entry.`,
    );
  if (i.poorResponseHistory && i.hyperResponseHistory)
    conflicting.push(
      "Both a poor-response cycle and a hyper-response cycle are recorded. Review which cycle reflects the current ovarian status.",
    );

  const abnormal: string[] = [];
  if (i.amh !== null && i.amh > 20)
    abnormal.push(`AMH ${i.amh} ng/mL is outside the usual measurable range.`);
  if (i.afc !== null && i.afc > 50)
    abnormal.push(`Antral follicle count ${i.afc} is implausibly high.`);
  if (i.fsh !== null && i.fsh > 40)
    abnormal.push(`Basal FSH ${i.fsh} IU/L is in the menopausal range.`);
  if (i.estradiol !== null && i.estradiol > 80)
    abnormal.push(
      `Baseline estradiol ${i.estradiol} pg/mL is above the usual early-follicular range, which can artificially suppress the FSH value.`,
    );
  if (i.bmi !== null && (i.bmi < 16 || i.bmi > 45))
    abnormal.push(
      `BMI ${i.bmi} kg/m² is outside the usual clinical range — confirm height and weight.`,
    );
  if (i.age !== null && (i.age < 18 || i.age > 55))
    abnormal.push(
      `Age ${i.age} years is outside the usual treatment range — confirm the date of birth.`,
    );

  const incompleteHistory: string[] = [];
  if (i.previousCycles > 0) {
    if (!i.cycleSignals.some((c) => c.retrieved !== null))
      incompleteHistory.push("Previous cycles are recorded but no oocyte yield is entered.");
    if (!i.cycleSignals.some((c) => c.startingDose !== null))
      incompleteHistory.push("No starting gonadotropin dose is recorded for the previous cycles.");
    if (!i.cycleSignals.some((c) => c.protocol))
      incompleteHistory.push("No stimulation protocol is recorded for the previous cycles.");
    if (!i.cycleSignals.some((c) => c.mature !== null))
      incompleteHistory.push(
        "Mature (MII) oocyte counts are not recorded for the previous cycles.",
      );
  }

  const essentialPresent = i.age !== null && (i.amh !== null || i.afc !== null);
  const quality: ResponseDataQuality = !essentialPresent
    ? "insufficient"
    : missing.length === 0
      ? "complete"
      : "partial";

  return { missing, conflicting, abnormal, incompleteHistory, quality };
}

/* ------------------------------------------------------------ prediction */

interface Prediction {
  category: ResponseCategory;
  headline: string;
  contributing: string[];
}

function predict(
  i: ResponseInputs,
  validation: ResponseValidation,
  poseidon: PoseidonResult,
  bologna: BolognaResult,
): Prediction {
  const contributing: string[] = [];

  if (validation.quality === "insufficient") {
    return {
      category: "unable",
      headline:
        "Age together with AMH or antral follicle count is required before an expected response can be described.",
      contributing: [
        "No conclusion is generated because the essential baseline variables are not recorded.",
      ],
    };
  }

  const severeReserve =
    (i.amh !== null && i.amh < BOLOGNA_AMH_THRESHOLD) ||
    (i.afc !== null && i.afc < BOLOGNA_AFC_THRESHOLD);
  const lowReserve =
    (i.amh !== null && i.amh < POSEIDON_AMH_THRESHOLD) ||
    (i.afc !== null && i.afc < POSEIDON_AFC_THRESHOLD);
  const highReserve = (i.amh !== null && i.amh > 3.5) || (i.afc !== null && i.afc >= 18);
  const veryHighReserve = (i.amh !== null && i.amh > 5) || (i.afc !== null && i.afc >= 24);

  // Recorded previous yields are the strongest recorded observation available.
  const yields = i.cycleSignals
    .map((c) => c.retrieved)
    .filter((n): n is number => n !== null && n >= 0);
  const lowestYield = yields.length ? Math.min(...yields) : null;
  const highestYield = yields.length ? Math.max(...yields) : null;

  let category: ResponseCategory;

  if (
    (severeReserve && (i.age === null || i.age >= 40)) ||
    (lowestYield !== null && lowestYield <= 1 && severeReserve)
  ) {
    category = "very-poor";
  } else if (
    severeReserve ||
    bologna.status === "positive" ||
    (lowestYield !== null && lowestYield < POSEIDON_POOR_OOCYTES)
  ) {
    category = "poor";
  } else if (
    lowReserve ||
    (lowestYield !== null && lowestYield <= POSEIDON_SUBOPTIMAL_MAX) ||
    poseidon.group === "1b" ||
    poseidon.group === "2b"
  ) {
    category = "suboptimal";
  } else if (veryHighReserve || (highestYield !== null && highestYield >= 20) || i.ohssHistory) {
    category = "hyper";
  } else if (highReserve || i.pcos) {
    category = "high";
  } else {
    category = "normal";
  }

  // ---- contributing variables, in physician language ---------------------
  if (i.age !== null)
    contributing.push(
      i.age >= 40
        ? `Age ${i.age} years is in the advanced reproductive age range, which the published frameworks associate with a lower oocyte yield.`
        : `Age ${i.age} years is recorded and used together with the reserve markers.`,
    );
  if (i.amh !== null)
    contributing.push(
      i.amh < BOLOGNA_AMH_THRESHOLD
        ? `AMH ${i.amh} ng/mL is below the Bologna abnormal-test range (0.5–1.1 ng/mL).`
        : i.amh < POSEIDON_AMH_THRESHOLD
          ? `AMH ${i.amh} ng/mL is below the POSEIDON adequate-reserve threshold of 1.2 ng/mL.`
          : i.amh > 3.5
            ? `AMH ${i.amh} ng/mL is in the high range, which is associated with a larger follicular cohort.`
            : `AMH ${i.amh} ng/mL is at or above the POSEIDON adequate-reserve threshold of 1.2 ng/mL.`,
    );
  if (i.afc !== null)
    contributing.push(
      i.afc < BOLOGNA_AFC_THRESHOLD
        ? `Antral follicle count ${i.afc} is below the Bologna abnormal-test range (5–7 follicles).`
        : i.afc < POSEIDON_AFC_THRESHOLD
          ? `Antral follicle count ${i.afc} is below the POSEIDON threshold of 5 follicles.`
          : i.afc >= 24
            ? `Antral follicle count ${i.afc} indicates a large antral cohort.`
            : `Antral follicle count ${i.afc} is at or above the POSEIDON threshold of 5 follicles.`,
    );
  if (i.bmi !== null)
    contributing.push(
      `BMI ${i.bmi} kg/m² is recorded and shown for context alongside the reserve markers.`,
    );
  if (i.pcos)
    contributing.push(
      "PCOS is documented, which is associated with a larger antral follicle cohort.",
    );
  if (i.endometriosis)
    contributing.push(
      "Endometriosis is documented and is shown for context in the reserve assessment.",
    );
  if (i.smoking && i.smoking.startsWith("Current"))
    contributing.push(`Smoking status recorded as “${i.smoking}”, shown for context.`);
  if (poseidon.group)
    contributing.push(`POSEIDON classified this patient as Group ${poseidon.group}.`);
  if (bologna.status === "positive")
    contributing.push("The Bologna criteria for poor ovarian response are fulfilled.");

  const headline =
    category === "very-poor"
      ? "A very low oocyte yield is expected from the recorded baseline markers."
      : category === "poor"
        ? "A poor response is expected from the recorded baseline markers and cycle history."
        : category === "suboptimal"
          ? "A suboptimal oocyte yield is expected from the recorded information."
          : category === "normal"
            ? "The recorded markers are consistent with a normal expected response."
            : category === "high"
              ? "The recorded markers indicate a larger than average follicular cohort."
              : "The recorded markers indicate an excessive response potential.";

  return { category, headline, contributing };
}

/* ------------------------------------------------------------------ risks */

function buildRisks(
  i: ResponseInputs,
  category: ResponseCategory,
  bologna: BolognaResult,
): ResponseRisk[] {
  const risks: ResponseRisk[] = [];
  const push = (r: ResponseRisk) => {
    if (!risks.some((x) => x.id === r.id)) risks.push(r);
  };

  if (category === "very-poor" || category === "poor")
    push({
      id: "expected-poor",
      label: "Expected Poor Response",
      severity: "high",
      basis:
        "Recorded reserve markers and/or the Bologna assessment support a poor expected yield.",
    });
  if (category === "suboptimal")
    push({
      id: "expected-suboptimal",
      label: "Expected Suboptimal Response",
      severity: "moderate",
      basis: "Reserve markers or a previous yield of 4–9 oocytes are recorded.",
    });
  if (category === "high" || category === "hyper")
    push({
      id: "expected-excessive",
      label: "Expected Excessive Response",
      severity: "moderate",
      basis: "High reserve markers, PCOS or a previous high yield are recorded.",
    });

  const ohssMarkers =
    (i.amh !== null && i.amh > 3.5) || (i.afc !== null && i.afc >= 24) || i.pcos || !!i.ohssHistory;
  if (ohssMarkers)
    push({
      id: "ohss",
      label: "Possible OHSS Risk",
      severity: i.ohssHistory ? "high" : "moderate",
      basis: i.ohssHistory
        ? `OHSS (${i.ohssHistory}) is documented in a previous cycle.`
        : "High reserve markers and/or PCOS are recorded, which the ASRM OHSS prevention document lists as patient risk factors.",
    });

  if (
    (i.amh !== null && i.amh < POSEIDON_AMH_THRESHOLD) ||
    (i.afc !== null && i.afc < POSEIDON_AFC_THRESHOLD)
  )
    push({
      id: "reduced-reserve",
      label: "Reduced Ovarian Reserve",
      severity: "high",
      basis:
        "AMH and/or antral follicle count are below the published adequate-reserve thresholds.",
    });

  if (i.age !== null && i.age >= 40)
    push({
      id: "advanced-age",
      label: "Advanced Reproductive Age",
      severity: "high",
      basis: `Age ${i.age} years is recorded.`,
    });

  if (i.poorResponseHistory)
    push({
      id: "previous-poor",
      label: "Previous Unexpected Poor Response",
      severity: "high",
      basis: "At least one previous stimulation cycle yielded fewer than 4 oocytes.",
    });

  if (i.hyperResponseHistory)
    push({
      id: "previous-hyper",
      label: "Previous Hyper Response",
      severity: "moderate",
      basis: i.ohssHistory
        ? `A previous cycle is recorded with OHSS (${i.ohssHistory}).`
        : "At least one previous cycle yielded 20 or more oocytes.",
    });

  if (bologna.status === "positive")
    push({
      id: "bologna-por",
      label: "Bologna Poor Ovarian Response",
      severity: "high",
      basis: "The ESHRE Bologna definition of poor ovarian response is fulfilled.",
    });

  if (i.cycleSignals.some((c) => c.cancelled))
    push({
      id: "previous-cancellation",
      label: "Previous Cycle Cancellation",
      severity: "moderate",
      basis: "At least one previous stimulation cycle is recorded as cancelled.",
    });

  return risks;
}

/* ------------------------------------------------------------------ build */

export function predictOvarianResponse(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  poseidon: PoseidonResult,
  bologna: BolognaResult,
): OvarianResponseResult {
  const inputs = extractResponseInputs(values, cycles);
  const variables = buildVariables(inputs);
  const validation = validate(inputs, variables);
  const { category, headline, contributing } = predict(inputs, validation, poseidon, bologna);
  const risks = category === "unable" ? [] : buildRisks(inputs, category, bologna);

  const previousCycleFindings: string[] =
    inputs.previousCycles === 0
      ? [
          "No previous stimulation cycle is recorded, so the assessment rests on baseline markers only.",
        ]
      : inputs.cycleSignals.map((c) => {
          const parts = [
            c.protocol ? `${c.protocol} protocol` : null,
            c.startingDose !== null ? `${c.startingDose} IU starting dose` : null,
            c.retrieved !== null ? `${c.retrieved} oocytes retrieved` : null,
            c.mature !== null ? `${c.mature} mature` : null,
            c.fertilizationRate !== null ? `${c.fertilizationRate}% fertilization` : null,
            c.blastocysts !== null ? `${c.blastocysts} blastocysts` : null,
            c.ohss ? `OHSS ${c.ohss}` : null,
            c.cancelled ? "cycle cancelled" : null,
          ].filter(Boolean);
          return `${c.cycleLabel}: ${parts.length ? parts.join(", ") : "no outcome detail recorded"}.`;
        });

  const biomarkersConsidered = [
    inputs.amh !== null ? `AMH ${inputs.amh} ng/mL` : null,
    inputs.afc !== null ? `Antral follicle count ${inputs.afc}` : null,
    inputs.fsh !== null ? `Basal FSH ${inputs.fsh} IU/L` : null,
    inputs.lh !== null ? `Basal LH ${inputs.lh} IU/L` : null,
    inputs.estradiol !== null ? `Estradiol ${inputs.estradiol} pg/mL` : null,
  ].filter((s): s is string => s !== null);

  const present = variables.filter((v) => v.present).length;
  const confidence = Math.round((present / variables.length) * 100);

  return {
    category,
    headline,
    confidence,
    inputs,
    variables,
    validation,
    risks,
    explanation: {
      contributingVariables: contributing,
      previousCycleFindings,
      biomarkersConsidered:
        biomarkersConsidered.length > 0
          ? biomarkersConsidered
          : ["No baseline biomarker is recorded."],
      missingInformation: validation.missing.map((m) => m.label),
    },
    evidence: ovarianResponseEvidenceIds,
    computedAt: new Date().toISOString(),
    version: OVARIAN_RESPONSE_ENGINE_VERSION,
  };
}

/** Modules that will consume the stored response prediction. */
export const responseConsumerModules = [
  { id: "protocol-recommendation", name: "Protocol Recommendation Engine" },
  { id: "gonadotropin-selection", name: "Gonadotropin Selection Engine" },
  { id: "consort", name: "CONSORT Starting Dose Calculator" },
  { id: "dose-adjustment", name: "Dose Adjustment Engine" },
  { id: "trigger", name: "Trigger Strategy Engine" },
  { id: "freeze-all", name: "Freeze-All Decision Engine" },
];
