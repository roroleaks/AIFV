/**
 * Patient Phenotype Engine.
 *
 * Aggregates the outputs of the implemented assessment engines (POSEIDON,
 * Bologna) plus the recorded ovarian-reserve biomarkers into a single
 * descriptive phenotype for the physician.
 *
 * Assessment only. This module produces NO treatment, protocol, medication,
 * dose or trigger recommendation, and NO pregnancy / live-birth prediction.
 * Every statement it emits is derived from an already-published framework or
 * from a value the physician recorded. Nothing is inferred beyond that.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import {
  POSEIDON_AFC_THRESHOLD,
  POSEIDON_AMH_THRESHOLD,
  classifyPoseidon,
  extractPoseidonContext,
  type PoseidonResult,
} from "./poseidon";
import {
  BOLOGNA_AFC_THRESHOLD,
  BOLOGNA_AMH_THRESHOLD,
  assessBologna,
  type BolognaResult,
} from "./bologna";

export const PHENOTYPE_ENGINE_VERSION = "1.0.0";

export type ReserveCategory =
  | "high"
  | "normal"
  | "reduced"
  | "severely-reduced"
  | "insufficient-data";

export const reserveCategoryLabel: Record<ReserveCategory, string> = {
  high: "High ovarian reserve markers",
  normal: "Normal ovarian reserve markers",
  reduced: "Reduced ovarian reserve markers",
  "severely-reduced": "Severely reduced ovarian reserve markers",
  "insufficient-data": "Insufficient data",
};

export interface ReservePanel {
  age: number | null;
  amh: number | null;
  afc: number | null;
  fsh: number | null;
  category: ReserveCategory;
  /** Which recorded variables produced the category. */
  contributors: string[];
  missing: string[];
}

export type PhenotypeLabel =
  | "normal-prognosis"
  | "low-prognosis"
  | "reduced-reserve"
  | "expected-poor-response"
  | "high-response-risk"
  | "insufficient-data";

export const phenotypeLabels: Record<PhenotypeLabel, string> = {
  "normal-prognosis": "Normal Prognosis",
  "low-prognosis": "Low Prognosis",
  "reduced-reserve": "Reduced Ovarian Reserve",
  "expected-poor-response": "Expected Poor Response",
  "high-response-risk": "High Response Risk",
  "insufficient-data": "Insufficient Data",
};

export const phenotypeTone: Record<PhenotypeLabel, "green" | "amber" | "red" | "blue" | "violet"> = {
  "normal-prognosis": "green",
  "low-prognosis": "amber",
  "reduced-reserve": "amber",
  "expected-poor-response": "red",
  "high-response-risk": "violet",
  "insufficient-data": "blue",
};

export interface PhenotypeMissingItem {
  id: string;
  label: string;
  /** Assessment step to open so the physician can complete the value. */
  stepId: string;
}

export interface PatientSummaryPanel {
  age: number | null;
  bmi: number | null;
  infertilityDurationMonths: number | null;
  infertilityType: string | null;
  diagnosis: string[];
  previousCycles: number;
}

export interface PhenotypeResult {
  patientSummary: PatientSummaryPanel;
  reserve: ReservePanel;
  poseidon: PoseidonResult;
  bologna: BolognaResult;
  phenotype: PhenotypeLabel;
  phenotypeRationale: string[];
  missing: PhenotypeMissingItem[];
  completedAssessments: string[];
  pendingAssessments: string[];
  evidence: string[];
  computedAt: string;
  version: string;
}

const str = (v: FieldValue): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

function buildReservePanel(
  values: Record<string, FieldValue>,
  poseidon: PoseidonResult,
): ReservePanel {
  const { age, amh, afc } = poseidon.inputs;
  const fsh = toNum(values["fsh"]);

  const missing: string[] = [];
  if (age === null) missing.push("Age");
  if (amh === null) missing.push("AMH");
  if (afc === null) missing.push("AFC");
  if (fsh === null) missing.push("Basal FSH");

  const contributors: string[] = [];
  let category: ReserveCategory = "insufficient-data";

  if (amh === null && afc === null) {
    return { age, amh, afc, fsh, category, contributors, missing };
  }

  const severe =
    (amh !== null && amh < BOLOGNA_AMH_THRESHOLD) || (afc !== null && afc < BOLOGNA_AFC_THRESHOLD);
  const reduced =
    (amh !== null && amh < POSEIDON_AMH_THRESHOLD) || (afc !== null && afc < POSEIDON_AFC_THRESHOLD);
  const high = (amh !== null && amh > 3.5) || (afc !== null && afc >= 24);

  if (severe) {
    category = "severely-reduced";
    if (amh !== null && amh < BOLOGNA_AMH_THRESHOLD)
      contributors.push(`AMH ${amh} ng/mL is below the Bologna abnormal-ORT range (0.5–1.1 ng/mL).`);
    if (afc !== null && afc < BOLOGNA_AFC_THRESHOLD)
      contributors.push(`AFC ${afc} is below the Bologna abnormal-ORT range (5–7 follicles).`);
  } else if (reduced) {
    category = "reduced";
    if (amh !== null && amh < POSEIDON_AMH_THRESHOLD)
      contributors.push(`AMH ${amh} ng/mL is below the POSEIDON threshold of 1.2 ng/mL.`);
    if (afc !== null && afc < POSEIDON_AFC_THRESHOLD)
      contributors.push(`AFC ${afc} is below the POSEIDON threshold of 5 follicles.`);
  } else if (high) {
    category = "high";
    if (amh !== null && amh > 3.5) contributors.push(`AMH ${amh} ng/mL is above 3.5 ng/mL.`);
    if (afc !== null && afc >= 24) contributors.push(`AFC ${afc} is 24 or above.`);
  } else {
    category = "normal";
    if (amh !== null) contributors.push(`AMH ${amh} ng/mL is at or above the POSEIDON threshold of 1.2 ng/mL.`);
    if (afc !== null) contributors.push(`AFC ${afc} is at or above the POSEIDON threshold of 5 follicles.`);
  }

  if (fsh !== null) {
    contributors.push(
      fsh >= 10
        ? `Basal FSH ${fsh} IU/L is recorded (shown for context; it does not change the category).`
        : `Basal FSH ${fsh} IU/L is recorded (shown for context).`,
    );
  }
  if (age !== null) contributors.push(`Female age ${age} years is recorded alongside the biomarkers.`);

  return { age, amh, afc, fsh, category, contributors, missing };
}

const MISSING_MAP: { id: string; label: string; stepId: string }[] = [
  { id: "dob", label: "Missing Age (date of birth)", stepId: "patient" },
  { id: "amh", label: "Missing AMH", stepId: "reserve" },
  { id: "afc", label: "Missing AFC", stepId: "reserve" },
  { id: "fsh", label: "Missing Basal FSH", stepId: "reserve" },
  { id: "previousCycles", label: "Missing Previous IVF cycle history", stepId: "cycles" },
  { id: "previousYield", label: "Missing Previous Oocyte Yield", stepId: "cycles" },
  { id: "bmi", label: "Missing Height / Weight (BMI)", stepId: "patient" },
  { id: "diagnosis", label: "Missing Cause of Infertility", stepId: "cause" },
];

/** Build the unified phenotype view from the recorded assessment data. */
export function buildPhenotype(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): PhenotypeResult {
  const poseidon = classifyPoseidon(values, cycles);
  const bologna = assessBologna(values, cycles);
  const context = extractPoseidonContext(values, cycles);
  const reserve = buildReservePanel(values, poseidon);

  const diagnosis = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

  const patientSummary: PatientSummaryPanel = {
    age: poseidon.inputs.age,
    bmi: context.bmi,
    infertilityDurationMonths: toNum(values["infertilityDuration"]),
    infertilityType: str(values["infertilityType"]),
    diagnosis,
    previousCycles: poseidon.inputs.previousCycles,
  };

  // ---- centralized missing data ------------------------------------------
  const missingIds = new Set<string>();
  if (poseidon.inputs.age === null) missingIds.add("dob");
  if (poseidon.inputs.amh === null) missingIds.add("amh");
  if (poseidon.inputs.afc === null) missingIds.add("afc");
  if (reserve.fsh === null) missingIds.add("fsh");
  if (poseidon.inputs.previousCycles === 0) missingIds.add("previousCycles");
  else if (poseidon.inputs.lowestRetrieved === null) missingIds.add("previousYield");
  if (context.bmi === null) missingIds.add("bmi");
  if (diagnosis.length === 0) missingIds.add("diagnosis");

  const missing = MISSING_MAP.filter((m) => missingIds.has(m.id));

  // ---- overall phenotype --------------------------------------------------
  const rationale: string[] = [];
  let phenotype: PhenotypeLabel = "insufficient-data";

  const poseidonClassified = poseidon.status === "classified";
  const poseidonNotLow = poseidon.status === "not-low-prognosis";

  if (bologna.status === "positive") {
    phenotype = "expected-poor-response";
    rationale.push(`Bologna criteria: ${bologna.headline}.`);
    if (poseidonClassified) rationale.push(`POSEIDON: ${poseidon.headline}.`);
  } else if (poseidonClassified) {
    phenotype = "low-prognosis";
    rationale.push(
      `POSEIDON classified this patient as ${poseidon.groupLabel ?? poseidon.group}, which the published framework defines as a low-prognosis patient.`,
    );
    if (bologna.status === "negative") rationale.push("Bologna criteria are not fulfilled.");
  } else if (reserve.category === "severely-reduced" || reserve.category === "reduced") {
    phenotype = "reduced-reserve";
    rationale.push(
      `Recorded ovarian reserve biomarkers fall below the published thresholds: ${reserve.contributors[0] ?? "see the ovarian reserve panel"}`,
    );
    if (bologna.status === "incomplete")
      rationale.push("The Bologna assessment is incomplete, so poor-responder status is not assigned.");
  } else if (context.hyperResponseHistory || reserve.category === "high") {
    phenotype = "high-response-risk";
    if (reserve.category === "high")
      rationale.push(`Ovarian reserve markers are in the high range: ${reserve.contributors[0] ?? ""}`);
    if (context.hyperResponseHistory)
      rationale.push(
        "A previous hyper-response or OHSS episode is documented in the recorded cycle history.",
      );
  } else if (poseidonNotLow && reserve.category === "normal") {
    phenotype = "normal-prognosis";
    rationale.push(
      "POSEIDON does not classify this patient as low prognosis, Bologna criteria are not fulfilled, and the recorded ovarian reserve biomarkers are within the normal range.",
    );
  } else {
    phenotype = "insufficient-data";
    rationale.push(
      "The recorded data is not sufficient to describe a phenotype using the published frameworks. Complete the missing variables listed below.",
    );
  }

  if (phenotype !== "insufficient-data" && missing.length > 0) {
    rationale.push(
      `${missing.length} variable(s) are still missing; the phenotype reflects only the data currently recorded.`,
    );
  }

  const completedAssessments: string[] = [];
  const pendingAssessments: string[] = [];
  (poseidon.status === "insufficient-data" || poseidon.status === "inconsistent-data"
    ? pendingAssessments
    : completedAssessments
  ).push("POSEIDON Clinical Assessment");
  (bologna.status === "incomplete" ? pendingAssessments : completedAssessments).push(
    "Bologna Criteria Assessment",
  );
  (reserve.category === "insufficient-data" ? pendingAssessments : completedAssessments).push(
    "Ovarian Reserve Panel",
  );

  return {
    patientSummary,
    reserve,
    poseidon,
    bologna,
    phenotype,
    phenotypeRationale: rationale,
    missing,
    completedAssessments,
    pendingAssessments,
    evidence: Array.from(new Set([...poseidon.evidence, ...bologna.evidence])),
    computedAt: new Date().toISOString(),
    version: PHENOTYPE_ENGINE_VERSION,
  };
}

/** Modules prepared but deliberately not implemented in this release. */
export const futurePhenotypeModules = [
  { id: "protocol-recommendation", name: "Protocol Recommendation Engine" },
  { id: "ohss-risk", name: "OHSS Risk Engine" },
  { id: "gonadotropin-selection", name: "Gonadotropin Selection Engine" },
  { id: "consort", name: "CONSORT Calculator" },
  { id: "dose-adjustment", name: "Dose Adjustment Engine" },
  { id: "trigger", name: "Trigger Engine" },
  { id: "freeze-all", name: "Freeze-All Engine" },
];
