/**
 * POSEIDON Classification Engine.
 *
 * Implements the published POSEIDON criteria (Alviggi et al., Fertil Steril 2016;
 * Humaidan et al., F1000Research 2016) and nothing else.
 *
 * This module classifies only. It produces NO treatment, protocol, medication,
 * dose, trigger or transfer recommendation and NO pregnancy / live-birth
 * prediction.
 *
 * Published criteria applied:
 *  - Adequate ovarian reserve = AFC >= 5 AND AMH >= 1.2 ng/mL
 *  - Poor ovarian reserve     = AFC <  5 AND AMH <  1.2 ng/mL
 *  - Unexpected response after conventional stimulation:
 *      poor        = < 4 oocytes retrieved
 *      suboptimal  = 4-9 oocytes retrieved
 *  - Group 1: age < 35, adequate reserve, unexpected poor (1a) / suboptimal (1b)
 *  - Group 2: age >= 35, adequate reserve, unexpected poor (2a) / suboptimal (2b)
 *  - Group 3: age < 35, poor reserve
 *  - Group 4: age >= 35, poor reserve
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";

export const POSEIDON_AMH_THRESHOLD = 1.2; // ng/mL
export const POSEIDON_AFC_THRESHOLD = 5;
export const POSEIDON_AGE_THRESHOLD = 35; // years
export const POSEIDON_POOR_OOCYTES = 4; // < 4 retrieved
export const POSEIDON_SUBOPTIMAL_MAX = 9; // 4-9 retrieved

export const poseidonEvidenceIds = ["poseidon-2016-alviggi", "poseidon-2016-humaidan"];

export type PoseidonGroup = "1a" | "1b" | "2a" | "2b" | "3" | "4";

export type PoseidonStatus =
  "classified" | "not-low-prognosis" | "insufficient-data" | "inconsistent-data";

export type PoseidonTone = "green" | "amber" | "red" | "blue";

export type CriterionState = "met" | "not-met" | "unknown";

export interface PoseidonCriterion {
  id: string;
  label: string;
  /** The published rule being tested. */
  rule: string;
  state: CriterionState;
  /** What the patient's data showed. */
  detail: string;
}

export interface PoseidonInputs {
  age: number | null;
  amh: number | null;
  afc: number | null;
  previousCycles: number;
  /** Lowest oocyte yield among recorded stimulation cycles. */
  lowestRetrieved: number | null;
  /** Yield of the most recent stimulation cycle. */
  latestRetrieved: number | null;
  latestOutcome: string | null;
  documentedPoorResponse: boolean;
}

/**
 * Additional recorded variables displayed for the physician.
 * They are NOT part of the published POSEIDON criteria and never change the group.
 */
export interface PoseidonContext {
  bmi: number | null;
  fsh: number | null;
  retrievalsPerformed: number;
  cancelledCycles: number;
  hyperResponseHistory: boolean;
  ohssHistory: string | null;
}

export type PoseidonDataQuality = "complete" | "missing" | "invalid";

export interface PoseidonResult {
  status: PoseidonStatus;
  group: PoseidonGroup | null;
  groupLabel: string | null;
  groupTitle: string | null;
  tone: PoseidonTone;
  /** Data-completeness confidence only — never clinical certainty. */
  confidence: number;
  completeness: { available: number; required: number; labels: string[] };
  headline: string;
  rationale: string[];
  satisfied: PoseidonCriterion[];
  notSatisfied: PoseidonCriterion[];
  unknown: PoseidonCriterion[];
  missing: string[];
  validation: string[];
  inputs: PoseidonInputs;
  context: PoseidonContext;
  dataQuality: PoseidonDataQuality;
  evidence: string[];
  computedAt: string;
}

export const poseidonGroupTitles: Record<PoseidonGroup, string> = {
  "1a": "Group 1a — young, adequate reserve, unexpected poor response (<4 oocytes)",
  "1b": "Group 1b — young, adequate reserve, unexpected suboptimal response (4-9 oocytes)",
  "2a": "Group 2a — age ≥35, adequate reserve, unexpected poor response (<4 oocytes)",
  "2b": "Group 2b — age ≥35, adequate reserve, unexpected suboptimal response (4-9 oocytes)",
  "3": "Group 3 — age <35 with poor ovarian reserve markers",
  "4": "Group 4 — age ≥35 with poor ovarian reserve markers",
};

export const poseidonToneClass: Record<PoseidonTone, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export const poseidonToneRing: Record<PoseidonTone, string> = {
  green: "from-emerald-500/25 to-emerald-500/0",
  amber: "from-amber-500/25 to-amber-500/0",
  red: "from-rose-500/25 to-rose-500/0",
  blue: "from-sky-500/25 to-sky-500/0",
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

export function extractPoseidonInputs(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): PoseidonInputs {
  const stim = cycles.filter(isStimulationCycle);
  const yields = stim
    .map((c) => toNum(c["retrieved"]))
    .filter((n): n is number => n !== null && n >= 0);
  const latest = stim.length ? stim[stim.length - 1] : undefined;
  const afcL = toNum(values["afcLeft"]);
  const afcR = toNum(values["afcRight"]);
  const afc = afcL === null && afcR === null ? null : (afcL ?? 0) + (afcR ?? 0);
  const outcomeParts = latest
    ? [
        latest["liveBirth"] === "Yes"
          ? "live birth"
          : latest["clinicalPregnancy"] === "Yes"
            ? "clinical pregnancy"
            : latest["clinicalPregnancy"] === "No"
              ? "no pregnancy"
              : null,
        latest["cancelled"] === "Yes" ? "cycle cancelled" : null,
      ].filter(Boolean)
    : [];

  return {
    age: ageFromDob(values["dob"]),
    amh: toNum(values["amh"]),
    afc,
    previousCycles: stim.length,
    lowestRetrieved: yields.length ? Math.min(...yields) : null,
    latestRetrieved: latest ? toNum(latest["retrieved"]) : null,
    latestOutcome: outcomeParts.length ? (outcomeParts.join(", ") as string) : null,
    documentedPoorResponse: yields.some((n) => n <= POSEIDON_SUBOPTIMAL_MAX),
  };
}

/** Recorded context variables shown to the physician (never used for grouping). */
export function extractPoseidonContext(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): PoseidonContext {
  const stim = cycles.filter(isStimulationCycle);
  const h = toNum(values["height"]);
  const w = toNum(values["weight"]);
  const bmi = h && w && h > 0 ? Number((w / (h / 100) ** 2).toFixed(1)) : null;
  const ohssHistory =
    typeof values["ohssHistory"] === "string" && values["ohssHistory"]
      ? String(values["ohssHistory"])
      : null;
  return {
    bmi,
    fsh: toNum(values["fsh"]),
    retrievalsPerformed: stim.filter((c) => toNum(c["retrieved"]) !== null).length,
    cancelledCycles: stim.filter((c) => c["cancelled"] === "Yes").length,
    hyperResponseHistory:
      stim.some((c) => {
        const r = toNum(c["retrieved"]);
        return (r !== null && r >= 20) || (c["ohss"] !== undefined && c["ohss"] !== "No");
      }) ||
      (ohssHistory !== null && ohssHistory !== "No" && ohssHistory !== "Unknown"),
    ohssHistory,
  };
}

const fmt = (n: number | null, unit = "") =>
  n === null ? "not recorded" : `${n}${unit ? ` ${unit}` : ""}`;

/** Classify a patient against the published POSEIDON criteria. */
export function classifyPoseidon(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): PoseidonResult {
  const inputs = extractPoseidonInputs(values, cycles);
  const context = extractPoseidonContext(values, cycles);

  const { age, amh, afc } = inputs;
  const computedAt = new Date().toISOString();
  const evidence = poseidonEvidenceIds;

  // ---- data-quality gate -------------------------------------------------
  const validation: string[] = [];
  if (age !== null && (age < 15 || age > 60))
    validation.push(
      `Female age of ${age} years is outside the plausible range for classification.`,
    );
  if (amh !== null && (amh < 0 || amh > 40))
    validation.push(
      `AMH of ${amh} ng/mL is outside the plausible assay range — verify units (ng/mL expected).`,
    );
  if (afc !== null && (afc < 0 || afc > 80))
    validation.push(`Total antral follicle count of ${afc} is outside the plausible range.`);
  cycles.forEach((c, i) => {
    const r = toNum(c["retrieved"]);
    if (r !== null && (r < 0 || r > 80))
      validation.push(`Cycle ${i + 1}: retrieved oocyte count of ${r} is implausible.`);
  });

  const markersDiscordant =
    amh !== null &&
    afc !== null &&
    ((amh >= POSEIDON_AMH_THRESHOLD && afc < POSEIDON_AFC_THRESHOLD) ||
      (amh < POSEIDON_AMH_THRESHOLD && afc >= POSEIDON_AFC_THRESHOLD));
  if (markersDiscordant)
    validation.push(
      `AMH (${amh} ng/mL) and AFC (${afc}) fall on opposite sides of the POSEIDON reserve thresholds (AMH 1.2 ng/mL, AFC 5). The published criteria require both markers to agree, so ovarian reserve cannot be categorised.`,
    );

  // ---- criteria ----------------------------------------------------------
  const ageState: CriterionState = age === null ? "unknown" : "met";
  const adequateReserve =
    amh !== null && afc !== null && !markersDiscordant
      ? amh >= POSEIDON_AMH_THRESHOLD && afc >= POSEIDON_AFC_THRESHOLD
      : null;
  const poorReserve =
    amh !== null && afc !== null && !markersDiscordant
      ? amh < POSEIDON_AMH_THRESHOLD && afc < POSEIDON_AFC_THRESHOLD
      : null;

  const lowest = inputs.lowestRetrieved;
  const poorResponse = lowest === null ? null : lowest < POSEIDON_POOR_OOCYTES;
  const suboptimalResponse =
    lowest === null ? null : lowest >= POSEIDON_POOR_OOCYTES && lowest <= POSEIDON_SUBOPTIMAL_MAX;

  const criteria: PoseidonCriterion[] = [
    {
      id: "age",
      label: "Female age band",
      rule: "POSEIDON separates patients at 35 years of age.",
      state: ageState,
      detail:
        age === null
          ? "Date of birth not recorded — age band cannot be assigned."
          : age < POSEIDON_AGE_THRESHOLD
            ? `Age ${age} years — below 35 (Groups 1 / 3 band).`
            : `Age ${age} years — 35 or above (Groups 2 / 4 band).`,
    },
    {
      id: "amh",
      label: "AMH threshold",
      rule: "Adequate reserve requires AMH ≥ 1.2 ng/mL.",
      state: amh === null ? "unknown" : amh >= POSEIDON_AMH_THRESHOLD ? "met" : "not-met",
      detail: `AMH ${fmt(amh, "ng/mL")}.`,
    },
    {
      id: "afc",
      label: "AFC threshold",
      rule: "Adequate reserve requires AFC ≥ 5.",
      state: afc === null ? "unknown" : afc >= POSEIDON_AFC_THRESHOLD ? "met" : "not-met",
      detail: `Total antral follicle count ${fmt(afc)}.`,
    },
    {
      id: "reserve",
      label: "Ovarian reserve category",
      rule: "Both markers must agree: adequate (AMH ≥ 1.2 and AFC ≥ 5) or poor (AMH < 1.2 and AFC < 5).",
      state: adequateReserve === null ? "unknown" : adequateReserve ? "met" : "not-met",
      detail: markersDiscordant
        ? "Markers discordant — reserve category cannot be assigned."
        : adequateReserve === null
          ? "Both AMH and AFC are required."
          : adequateReserve
            ? "Adequate ovarian reserve by both markers."
            : "Poor ovarian reserve by both markers.",
    },
    {
      id: "previous-stimulation",
      label: "Previous ovarian stimulation",
      rule: "Groups 1 and 2 require a completed conventional stimulation cycle with a known oocyte yield.",
      state: inputs.previousCycles === 0 ? "not-met" : lowest === null ? "unknown" : "met",
      detail:
        inputs.previousCycles === 0
          ? "No previous stimulation cycle recorded."
          : lowest === null
            ? `${inputs.previousCycles} previous cycle(s) recorded, but no oocyte yield captured.`
            : `${inputs.previousCycles} previous cycle(s); lowest yield ${lowest} oocyte(s)${
                inputs.latestRetrieved !== null ? `, most recent ${inputs.latestRetrieved}` : ""
              }.`,
    },
    {
      id: "response",
      label: "Unexpected poor or suboptimal response",
      rule: "Poor response < 4 oocytes retrieved; suboptimal response 4-9 oocytes retrieved.",
      state: lowest === null ? "unknown" : poorResponse || suboptimalResponse ? "met" : "not-met",
      detail:
        lowest === null
          ? "No retrieved oocyte count available."
          : poorResponse
            ? `Lowest yield ${lowest} oocyte(s) — poor response.`
            : suboptimalResponse
              ? `Lowest yield ${lowest} oocyte(s) — suboptimal response.`
              : `Lowest yield ${lowest} oocyte(s) — above the suboptimal range.`,
    },
  ];

  const requiredLabels = ["Female age", "AMH", "Antral follicle count"];
  const availableCore = [age, amh, afc].filter((v) => v !== null).length;
  const historyKnown = inputs.previousCycles === 0 || lowest !== null;
  const completeness = {
    available: availableCore + (historyKnown ? 1 : 0),
    required: 4,
    labels: [...requiredLabels, "Previous response history"],
  };
  const missing: string[] = [];
  if (age === null) missing.push("Date of birth (female age)");
  if (amh === null) missing.push("AMH (ng/mL)");
  if (afc === null) missing.push("Antral follicle count (left / right)");
  if (inputs.previousCycles > 0 && lowest === null)
    missing.push("Retrieved oocyte count for the recorded cycle(s)");

  const confidence = Math.round((completeness.available / completeness.required) * 100);

  // ---- decision ----------------------------------------------------------
  let status: PoseidonStatus = "insufficient-data";
  let group: PoseidonGroup | null = null;
  const rationale: string[] = [];

  if (validation.length > 0) {
    status = "inconsistent-data";
    rationale.push(
      "Classification was not attempted because the available data failed the internal consistency check.",
    );
  } else if (age === null || adequateReserve === null) {
    status = "insufficient-data";
    rationale.push(
      "POSEIDON requires female age together with both AMH and AFC. Classification is incomplete until these are recorded.",
    );
  } else if (poorReserve) {
    group = age < POSEIDON_AGE_THRESHOLD ? "3" : "4";
    status = "classified";
    rationale.push(
      `Both reserve markers are below the POSEIDON thresholds (AMH ${amh} ng/mL < 1.2 and AFC ${afc} < 5), which defines expected poor reserve.`,
      `Female age ${age} years places the patient in Group ${group}.`,
    );
  } else if (adequateReserve) {
    if (lowest === null) {
      if (inputs.previousCycles === 0) {
        status = "not-low-prognosis";
        rationale.push(
          `Ovarian reserve markers are adequate (AMH ${amh} ng/mL, AFC ${afc}) and no previous stimulation cycle is recorded.`,
          "Groups 1 and 2 can only be assigned after an unexpected poor or suboptimal response to conventional stimulation, so no POSEIDON group applies at present.",
        );
      } else {
        status = "insufficient-data";
        rationale.push(
          "Reserve markers are adequate, but the oocyte yield of the previous cycle(s) is missing, so an unexpected poor or suboptimal response cannot be confirmed.",
        );
      }
    } else if (poorResponse) {
      group = age < POSEIDON_AGE_THRESHOLD ? "1a" : "2a";
      status = "classified";
      rationale.push(
        `Reserve markers are adequate (AMH ${amh} ng/mL, AFC ${afc}) yet only ${lowest} oocyte(s) were retrieved — an unexpected poor response.`,
        `Female age ${age} years places the patient in Group ${group}.`,
      );
    } else if (suboptimalResponse) {
      group = age < POSEIDON_AGE_THRESHOLD ? "1b" : "2b";
      status = "classified";
      rationale.push(
        `Reserve markers are adequate (AMH ${amh} ng/mL, AFC ${afc}) yet only ${lowest} oocyte(s) were retrieved — an unexpected suboptimal response.`,
        `Female age ${age} years places the patient in Group ${group}.`,
      );
    } else {
      status = "not-low-prognosis";
      rationale.push(
        `Reserve markers are adequate (AMH ${amh} ng/mL, AFC ${afc}) and the recorded yield of ${lowest} oocyte(s) exceeds the suboptimal range.`,
        "No POSEIDON group criteria are fulfilled.",
      );
    }
  }

  if (status === "insufficient-data" && missing.length)
    rationale.push(`Missing: ${missing.join("; ")}.`);

  const tone: PoseidonTone =
    status === "not-low-prognosis"
      ? "green"
      : status === "classified"
        ? group === "3" || group === "4"
          ? "red"
          : "amber"
        : "blue";

  const headline =
    status === "classified"
      ? `POSEIDON Group ${group}`
      : status === "not-low-prognosis"
        ? "No POSEIDON group criteria fulfilled"
        : status === "inconsistent-data"
          ? "Classification withheld — data inconsistency"
          : "Classification incomplete — insufficient data";

  return {
    status,
    group,
    groupLabel: group ? `Group ${group}` : null,
    groupTitle: group ? poseidonGroupTitles[group] : null,
    tone,
    confidence,
    completeness,
    headline,
    rationale,
    satisfied: criteria.filter((c) => c.state === "met"),
    notSatisfied: criteria.filter((c) => c.state === "not-met"),
    unknown: criteria.filter((c) => c.state === "unknown"),
    missing,
    validation,
    inputs,
    context,
    dataQuality: validation.length ? "invalid" : missing.length ? "missing" : "complete",
    evidence,
    computedAt,
  };
}

export const poseidonStatusLabels: Record<PoseidonStatus, string> = {
  classified: "Classified",
  "not-low-prognosis": "Criteria not fulfilled",
  "insufficient-data": "Insufficient data",
  "inconsistent-data": "Validation required",
};

/** Structured section prepared for the future clinical report. */
export interface PoseidonReportSection {
  id: "poseidon";
  title: string;
  result: string;
  group: string | null;
  explanation: string[];
  criteriaSatisfied: string[];
  criteriaNotSatisfied: string[];
  missingInformation: string[];
  validation: string[];
  dataCompleteness: string;
  evidence: string[];
  generatedAt: string;
}

export function buildPoseidonReportSection(result: PoseidonResult): PoseidonReportSection {
  return {
    id: "poseidon",
    title: "POSEIDON Classification",
    result: result.headline,
    group: result.groupTitle,
    explanation: result.rationale,
    criteriaSatisfied: result.satisfied.map((c) => `${c.label}: ${c.detail}`),
    criteriaNotSatisfied: result.notSatisfied.map((c) => `${c.label}: ${c.detail}`),
    missingInformation: result.missing,
    validation: result.validation,
    dataCompleteness: `${result.confidence}% (${result.completeness.available}/${result.completeness.required} required variables available)`,
    evidence: result.evidence,
    generatedAt: result.computedAt,
  };
}

/** Plain-text rendering used by "Copy to report". */
export function poseidonReportText(section: PoseidonReportSection, citations: string[]): string {
  const block = (label: string, lines: string[]) =>
    lines.length ? `${label}:\n${lines.map((l) => `  - ${l}`).join("\n")}\n` : "";
  return [
    `POSEIDON CLASSIFICATION`,
    `Result: ${section.result}`,
    section.group ? `Group: ${section.group}` : "",
    `Data completeness: ${section.dataCompleteness}`,
    "",
    block("Explanation", section.explanation),
    block("Criteria satisfied", section.criteriaSatisfied),
    block("Criteria not satisfied", section.criteriaNotSatisfied),
    block("Missing information", section.missingInformation),
    block("Validation", section.validation),
    block("Evidence", citations),
    `Generated ${new Date(section.generatedAt).toLocaleString()} — classification only; no treatment recommendation is implied.`,
  ]
    .filter(Boolean)
    .join("\n");
}
