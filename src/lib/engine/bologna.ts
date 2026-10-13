/**
 * Bologna Criteria Engine.
 *
 * Implements the published ESHRE consensus definition of poor ovarian response
 * (Ferraretti AP, La Marca A, Fauser BCJM, Tarlatzis B, Nargund G, Gianaroli L;
 * ESHRE working group on Poor Ovarian Response Definition. Hum Reprod
 * 2011;26(7):1616-1624) and nothing else.
 *
 * Classification only. This module produces NO treatment, protocol, medication,
 * dose or trigger recommendation and NO pregnancy / live-birth prediction.
 *
 * Published definition applied verbatim:
 *   At least two of the following three features must be present:
 *     (i)   Advanced maternal age (>= 40 years) or any other risk factor for POR
 *     (ii)  A previous POR (<= 3 oocytes with a conventional stimulation protocol)
 *     (iii) An abnormal ovarian reserve test (AFC < 5-7 follicles or AMH < 0.5-1.1 ng/mL)
 *   Two episodes of POR after maximal stimulation are sufficient to define a
 *   patient as a poor responder in the absence of advanced age or an abnormal ORT.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import { extractPoseidonContext, extractPoseidonInputs } from "./poseidon";

export const BOLOGNA_AGE_THRESHOLD = 40; // years
export const BOLOGNA_POOR_OOCYTES = 3; // <= 3 oocytes retrieved
export const BOLOGNA_AFC_THRESHOLD = 7; // AFC < 5-7 (upper bound of published range)
export const BOLOGNA_AFC_STRICT = 5;
export const BOLOGNA_AMH_THRESHOLD = 1.1; // AMH < 0.5-1.1 ng/mL (upper bound)
export const BOLOGNA_AMH_STRICT = 0.5;

export const bolognaEvidenceIds = ["bologna-2011-ferraretti"];

export type BolognaStatus = "positive" | "negative" | "incomplete";

export type BolognaCriterionState = "met" | "not-met" | "unknown";

export interface BolognaCriterion {
  id: string;
  label: string;
  /** The published rule being tested. */
  rule: string;
  state: BolognaCriterionState;
  /** What the patient's recorded data showed. */
  detail: string;
}

export interface BolognaInputs {
  age: number | null;
  amh: number | null;
  afc: number | null;
  /** Risk factors for poor response recorded in the assessment. */
  riskFactors: string[];
  /** Number of conventional stimulation cycles recorded. */
  stimulationCycles: number;
  /** Number of recorded cycles yielding <= 3 oocytes. */
  poorResponseEpisodes: number;
  lowestRetrieved: number | null;
}

export interface BolognaResult {
  status: BolognaStatus;
  headline: string;
  tone: "green" | "amber" | "red" | "blue";
  /** Number of published features satisfied (0-3). */
  featuresMet: number;
  satisfied: BolognaCriterion[];
  notSatisfied: BolognaCriterion[];
  unknown: BolognaCriterion[];
  rationale: string[];
  missing: string[];
  inputs: BolognaInputs;
  evidence: string[];
  computedAt: string;
}

const RISK_FACTOR_CAUSES = [
  "Endometriosis",
  "Diminished ovarian reserve",
  "Premature ovarian insufficiency",
];

export function extractBolognaInputs(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): BolognaInputs {
  const p = extractPoseidonInputs(values, cycles);
  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

  const riskFactors: string[] = [];
  causes.forEach((c) => {
    if (RISK_FACTOR_CAUSES.some((r) => c.toLowerCase().includes(r.toLowerCase()))) {
      riskFactors.push(c);
    }
  });
  if (values["ovarianSurgery"] === "Yes") riskFactors.push("Previous ovarian surgery");
  if (values["chemotherapy"] === "Yes") riskFactors.push("Previous chemotherapy");
  if (values["radiotherapy"] === "Yes") riskFactors.push("Previous radiotherapy");
  const genetic = String(values["karyotype"] ?? "");
  if (genetic.startsWith("Abnormal — female") || genetic.startsWith("Abnormal — both")) {
    riskFactors.push(`Female karyotype abnormality (${genetic})`);
  }

  const poorEpisodes = cycles.filter((c) => {
    const r = toNum(c["retrieved"]);
    return r !== null && r <= BOLOGNA_POOR_OOCYTES;
  }).length;

  return {
    age: p.age,
    amh: p.amh,
    afc: p.afc,
    riskFactors,
    stimulationCycles: p.previousCycles,
    poorResponseEpisodes: poorEpisodes,
    lowestRetrieved: p.lowestRetrieved,
  };
}

/** Evaluate the patient against the published Bologna criteria. */
export function assessBologna(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): BolognaResult {
  const inputs = extractBolognaInputs(values, cycles);
  const computedAt = new Date().toISOString();
  const { age, amh, afc, riskFactors, poorResponseEpisodes, stimulationCycles, lowestRetrieved } =
    inputs;

  const missing: string[] = [];

  // --- Feature (i): advanced maternal age or another risk factor ------------
  let ageState: BolognaCriterionState;
  let ageDetail: string;
  if (age === null && riskFactors.length === 0) {
    ageState = "unknown";
    ageDetail = "Date of birth not recorded and no risk factor documented.";
    missing.push("date of birth (to derive maternal age)");
  } else if ((age !== null && age >= BOLOGNA_AGE_THRESHOLD) || riskFactors.length > 0) {
    ageState = "met";
    ageDetail =
      age !== null && age >= BOLOGNA_AGE_THRESHOLD
        ? `Maternal age ${age} years — at or above the 40-year threshold.${riskFactors.length ? ` Additional risk factors recorded: ${riskFactors.join(", ")}.` : ""}`
        : `Maternal age ${age === null ? "not recorded" : `${age} years`}, but risk factors for poor response are documented: ${riskFactors.join(", ")}.`;
  } else {
    ageState = "not-met";
    ageDetail = `Maternal age ${age} years — below 40, and no risk factor for poor response is documented.`;
  }

  // --- Feature (ii): previous poor ovarian response -------------------------
  let responseState: BolognaCriterionState;
  let responseDetail: string;
  if (stimulationCycles === 0) {
    responseState = "unknown";
    responseDetail =
      "No previous conventional stimulation cycle is recorded, so a previous poor response cannot be established.";
    missing.push("previous IVF / stimulation cycle history");
  } else if (lowestRetrieved === null) {
    responseState = "unknown";
    responseDetail = `${stimulationCycles} stimulation cycle(s) recorded but no retrieved oocyte count is available.`;
    missing.push("previous oocyte yield (retrieved oocytes per cycle)");
  } else if (poorResponseEpisodes > 0) {
    responseState = "met";
    responseDetail = `${poorResponseEpisodes} recorded cycle(s) with ≤ 3 oocytes retrieved (lowest yield ${lowestRetrieved}).`;
  } else {
    responseState = "not-met";
    responseDetail = `Lowest recorded oocyte yield is ${lowestRetrieved} — above the ≤ 3 oocyte threshold.`;
  }

  // --- Feature (iii): abnormal ovarian reserve test -------------------------
  let ortState: BolognaCriterionState;
  let ortDetail: string;
  if (amh === null && afc === null) {
    ortState = "unknown";
    ortDetail = "Neither AMH nor antral follicle count is recorded.";
    missing.push("AMH or antral follicle count");
  } else {
    const amhAbnormal = amh !== null && amh < BOLOGNA_AMH_THRESHOLD;
    const afcAbnormal = afc !== null && afc < BOLOGNA_AFC_THRESHOLD;
    const parts: string[] = [];
    if (amh !== null)
      parts.push(
        `AMH ${amh} ng/mL (${amhAbnormal ? "below" : "at or above"} the 0.5–1.1 ng/mL range)`,
      );
    if (afc !== null)
      parts.push(`AFC ${afc} (${afcAbnormal ? "below" : "at or above"} the 5–7 follicle range)`);
    if (amhAbnormal || afcAbnormal) {
      ortState = "met";
      ortDetail = `Abnormal ovarian reserve test: ${parts.join("; ")}.`;
    } else {
      ortState = "not-met";
      ortDetail = `Ovarian reserve testing is not abnormal by the published range: ${parts.join("; ")}.`;
      if (amh === null) missing.push("AMH");
      if (afc === null) missing.push("antral follicle count");
    }
  }

  const criteria: BolognaCriterion[] = [
    {
      id: "age-risk",
      label: "Advanced maternal age or a risk factor for poor response",
      rule: "Feature (i): maternal age ≥ 40 years, or any other risk factor for poor ovarian response.",
      state: ageState,
      detail: ageDetail,
    },
    {
      id: "previous-por",
      label: "Previous poor ovarian response",
      rule: "Feature (ii): ≤ 3 oocytes retrieved with a conventional stimulation protocol.",
      state: responseState,
      detail: responseDetail,
    },
    {
      id: "abnormal-ort",
      label: "Abnormal ovarian reserve test",
      rule: "Feature (iii): AFC < 5–7 follicles or AMH < 0.5–1.1 ng/mL.",
      state: ortState,
      detail: ortDetail,
    },
  ];

  const satisfied = criteria.filter((c) => c.state === "met");
  const notSatisfied = criteria.filter((c) => c.state === "not-met");
  const unknown = criteria.filter((c) => c.state === "unknown");

  // Published shortcut: two episodes of POR after maximal stimulation define a
  // poor responder even without advanced age or an abnormal ORT.
  const twoEpisodeRule = poorResponseEpisodes >= 2;

  const rationale: string[] = [];
  let status: BolognaStatus;
  let headline: string;
  let tone: BolognaResult["tone"];

  if (satisfied.length >= 2) {
    status = "positive";
    tone = "red";
    headline = "Bologna criteria fulfilled — poor ovarian response";
    rationale.push(
      `${satisfied.length} of the three published features are present, meeting the ESHRE requirement of at least two.`,
      ...satisfied.map((c) => `${c.label}: ${c.detail}`),
    );
  } else if (twoEpisodeRule) {
    status = "positive";
    tone = "red";
    headline = "Bologna criteria fulfilled — two episodes of poor response";
    rationale.push(
      `The consensus states that two episodes of poor ovarian response after maximal stimulation are sufficient to define a poor responder in the absence of advanced age or an abnormal ovarian reserve test. ${poorResponseEpisodes} such episodes are recorded.`,
    );
  } else if (unknown.length > 0 && satisfied.length + unknown.length >= 2) {
    status = "incomplete";
    tone = "amber";
    headline = "Incomplete assessment — the definition cannot be applied";
    rationale.push(
      `${satisfied.length} feature(s) confirmed and ${unknown.length} feature(s) cannot be evaluated with the data recorded. The published definition requires at least two confirmed features, so no classification is issued.`,
      ...unknown.map((c) => `${c.label}: ${c.detail}`),
    );
  } else {
    status = "negative";
    tone = "green";
    headline = "Bologna criteria not fulfilled";
    rationale.push(
      `Only ${satisfied.length} of the three published features is present; the consensus requires at least two, and fewer than two episodes of poor response are recorded.`,
      ...notSatisfied.map((c) => `${c.label}: ${c.detail}`),
    );
  }

  return {
    status,
    headline,
    tone,
    featuresMet: satisfied.length,
    satisfied,
    notSatisfied,
    unknown,
    rationale,
    missing: Array.from(new Set(missing)),
    inputs,
    evidence: bolognaEvidenceIds,
    computedAt,
  };
}

export const bolognaStatusLabel: Record<BolognaStatus, string> = {
  positive: "Positive",
  negative: "Negative",
  incomplete: "Incomplete assessment",
};

/** Context values shown alongside the criteria (never used for classification). */
export const bolognaContext = extractPoseidonContext;
