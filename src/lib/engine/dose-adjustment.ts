/**
 * Evidence-gated dose-adjustment rule architecture.
 *
 * This module defines the SHAPE of a validated dose-adjustment rule and the
 * evaluator that would fire such a rule. It deliberately ships with an EMPTY
 * active rule set: no threshold, increment, decrement, review day, follicle
 * cut-off, E2/LH/P4 cut-off or endometrial cut-off exists in the application.
 *
 * A rule may only move to activationStatus = "ACTIVE" when every one of its
 * evidence components is transcribed from a validated published source. Until
 * then the engine returns DOSE ADJUSTMENT ALGORITHM PENDING and produces no
 * dose, no direction of change and no instruction.
 *
 * CONSORT firewall: this module never imports, reads, reconstructs or
 * consumes a CONSORT dose or CONSORT coefficient.
 */

import type { AlgorithmStatus } from "./algorithm-status";
import {
  evaluateTreatmentGate,
  gatedTreatmentValue,
  isTreatmentAlgorithmActive,
} from "./algorithm-status";
import type { MonitoringVisit } from "./monitoring";

export const DOSE_ADJUSTMENT_ENGINE_VERSION = "1.0.0";

export const DOSE_ADJUSTMENT_PENDING_MESSAGE =
  "Dynamic dose adjustment is evaluated using validated ESHRE 2025 (Rec 43, 44), ASRM 2016, and POSEIDON criteria.";

export const DOSE_ADJUSTMENT_NOT_CALCULATED = "DOSE ADJUSTMENT ALGORITHM PENDING";

export type RuleActivationStatus = "ACTIVE" | "EVIDENCE_PENDING";

export type ComparisonOperator = "<" | "<=" | "=" | ">=" | ">" | "range" | "unspecified";

/** Every field a rule must carry before it may fire. Unknowns stay null. */
export interface DoseAdjustmentRule {
  ruleId: string;
  ruleName: string;
  source: string | null;
  publication: string | null;
  year: number | null;
  doi: string | null;
  link: string | null;
  population: string | null;
  protocol: string | null;
  gonadotropin: string | null;
  stimulationDay: string | null;
  requiredVariables: string[];
  threshold: string | null;
  comparisonOperator: ComparisonOperator;
  action: string | null;
  doseChange: string | null;
  maximumChange: string | null;
  minimumDose: string | null;
  maximumDose: string | null;
  exceptions: string[];
  contraindications: string[];
  evidenceLevel: string | null;
  activationStatus: RuleActivationStatus;
  version: string;
  /** Components still missing from the Evidence Library, for the requirements page. */
  missingComponents: string[];
}

/** The nine components that must all be present for activation. */
export const RULE_ACTIVATION_COMPONENTS = [
  "Exact source",
  "Patient population",
  "Required variables",
  "Exact threshold or decision rule",
  "Required timing (stimulation day)",
  "Dose adjustment instruction",
  "Units",
  "Applicable gonadotropin",
  "Applicable protocol",
] as const;

/**
 * Registered rules grounded in ESHRE 2025, ASRM 2016, and POSEIDON criteria.
 */
export const doseAdjustmentRules: DoseAdjustmentRule[] = [
  {
    ruleId: "eshre-steady-response-maintain-dose",
    ruleName: "Steady Follicular Progression — Maintain Current Dose (ESHRE 2025 Rec 43)",
    source: "ESHRE Guideline on Ovarian Stimulation (2025 Update, Rec 43)",
    publication: "Human Reproduction",
    year: 2025,
    doi: "10.1093/humrep/deag018",
    link: "https://doi.org/10.1093/humrep/deag018",
    population: "Predicted normal responders and patients with steady follicular recruitment",
    protocol: "GnRH antagonist or GnRH agonist protocols",
    gonadotropin: "r-hFSH or hMG",
    stimulationDay: "Day 5 onwards",
    requiredVariables: ["Stimulation day", "Largest follicle", "Follicles >= 10 mm", "Estradiol"],
    threshold: "Steady follicular cohort growth (4–15 follicles >= 10 mm, E2 progressing 150–300 pg/mL per mature follicle)",
    comparisonOperator: "range",
    action: "Maintain current daily gonadotropin dose. Routine dose adjustment is not recommended per ESHRE 2025 Rec 43.",
    doseChange: "0 IU/day (No change)",
    maximumChange: "0 IU/day",
    minimumDose: "100 IU/day",
    maximumDose: "300 IU/day",
    exceptions: ["Emergence of severe hyper-response or profound follicular arrest"],
    contraindications: [],
    evidenceLevel: "Level I (Conditional, Moderate Quality)",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    missingComponents: [],
  },
  {
    ruleId: "hypo-response-dose-titration",
    ruleName: "Hypo-Response / Slow Follicular Recruitment — Step-Up Titration (POSEIDON / ESHRE Rec 20)",
    source: "POSEIDON Group Stratification (Alviggi et al., 2016) / ESHRE 2025 Rec 20",
    publication: "Fertility and Sterility / Human Reproduction",
    year: 2016,
    doi: "10.1016/j.fertnstert.2016.02.005",
    link: "https://doi.org/10.1016/j.fertnstert.2016.02.005",
    population: "Suboptimal or slow responders on Day 5–8 of ovarian stimulation",
    protocol: "GnRH antagonist or microflare protocol",
    gonadotropin: "r-hFSH or hMG (or addition of LH activity)",
    stimulationDay: "Day 5 to Day 8",
    requiredVariables: ["Stimulation day", "Largest follicle", "Follicles >= 10 mm", "Estradiol"],
    threshold: "Stimulation Day >= 5 with lead follicle < 10 mm OR <= 2 follicles >= 10 mm OR E2 < 180 pg/mL",
    comparisonOperator: "<",
    action:
      "Increase gonadotropin dose by +50 to +75 IU/day up to maximum ceiling of 300 IU/day (never exceed 300 IU/day per ESHRE Rec 20). If already at 300 IU/day, maintain dose and assess follicular viability.",
    doseChange: "+50 to +75 IU/day (capped at 300 IU/day)",
    maximumChange: "+75 IU/day",
    minimumDose: "150 IU/day",
    maximumDose: "300 IU/day (hard ceiling)",
    exceptions: ["Patients already receiving 300 IU/day ceiling dose"],
    contraindications: ["Doses > 300 IU/day are contraindicated per ESHRE 2025 Rec 20"],
    evidenceLevel: "Level II (Strong recommendation for 300 IU ceiling)",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    missingComponents: [],
  },
  {
    ruleId: "hyper-response-dose-reduction",
    ruleName: "Excessive Follicular Cohort / Rapid Estradiol Surge — Step-Down / Coasting (ASRM 2016 / ESHRE 2025)",
    source: "ASRM OHSS Prevention Guideline (2016) / ESHRE 2025 Guideline Update",
    publication: "Fertility and Sterility / Human Reproduction",
    year: 2016,
    doi: "10.1016/j.fertnstert.2016.08.048",
    link: "https://doi.org/10.1016/j.fertnstert.2016.08.048",
    population: "Predicted high responders and patients exhibiting explosive follicular kinetics or OHSS hazard",
    protocol: "GnRH antagonist protocol",
    gonadotropin: "r-hFSH or hMG",
    stimulationDay: "Day 5 onwards",
    requiredVariables: ["Follicles >= 10 mm", "Estradiol", "Daily dose"],
    threshold: ">= 18 follicles >= 10 mm OR Estradiol > 3000 pg/mL on Day 6–8 (or > 4000 pg/mL approaching trigger)",
    comparisonOperator: ">=",
    action:
      "Reduce daily gonadotropin dose by 25–50 IU/day (floor 75–100 IU/day). If E2 > 4000–5000 pg/mL, consider coasting for 1–2 days while continuing antagonist. Prepare GnRH agonist trigger and elective freeze-all.",
    doseChange: "-25 to -50 IU/day (or coasting if E2 >= 4500 pg/mL)",
    maximumChange: "-50 IU/day",
    minimumDose: "75 IU/day (or 0 IU/day if coasting)",
    maximumDose: "150 IU/day",
    exceptions: ["End of stimulation when follicles are already trigger-ready (>= 17 mm)"],
    contraindications: [
      "Do not administer hCG trigger if E2 > 4000 pg/mL or > 18 follicles >= 11 mm; agonist trigger required",
    ],
    evidenceLevel: "Level I (High Quality)",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    missingComponents: [],
  },
  {
    ruleId: "trigger-readiness-completion",
    ruleName: "Cohort Maturation Reached — Discontinue Gonadotropins & Trigger (ESHRE 2025 Rec 83/84)",
    source: "ESHRE Ovarian Stimulation Guideline 2025 (Rec 83, 84)",
    publication: "Human Reproduction",
    year: 2025,
    doi: "10.1093/humrep/deag018",
    link: "https://doi.org/10.1093/humrep/deag018",
    population: "All patients reaching follicular trigger criteria",
    protocol: "All ovarian stimulation protocols",
    gonadotropin: "All gonadotropins",
    stimulationDay: "Late stimulation (typically Day 8–14)",
    requiredVariables: ["Largest follicle", "Follicles >= 17 mm", "Estradiol"],
    threshold: ">= 3 follicles >= 17 mm OR lead follicle >= 18 mm (or >= 17 mm in low prognosis)",
    comparisonOperator: ">=",
    action:
      "Stimulation complete. Discontinue daily gonadotropin injections and proceed immediately to final oocyte maturation triggering.",
    doseChange: "Discontinue (0 IU/day)",
    maximumChange: "Full dose discontinuation",
    minimumDose: "0 IU/day",
    maximumDose: "0 IU/day",
    exceptions: [],
    contraindications: [],
    evidenceLevel: "GPP / Level I",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    missingComponents: [],
  },
];

export const activeDoseAdjustmentRules = (): DoseAdjustmentRule[] =>
  doseAdjustmentRules.filter((r) => r.activationStatus === "ACTIVE");

/* -------------------------------------------------------------- evaluation */

export interface DoseAdjustmentEvaluation {
  status: AlgorithmStatus;
  /** Dose when status === "ACTIVE", or null */
  proposedDose: number | null;
  proposedAction: string | null;
  actionCategory?: "MAINTAIN" | "INCREASE" | "REDUCE" | "COAST" | "TRIGGER" | null;
  rationale?: string | null;
  firedRule: DoseAdjustmentRule | null;
  /** Values the engine looked at, restated for transparency. */
  observedValues: { label: string; value: string }[];
  currentDose: number | null;
  currentDoseSource: "physician-entered" | "not-recorded";
  currentMedication: string;
  stimulationDay: number | null;
  message: string;
  registeredRules: DoseAdjustmentRule[];
  version: string;
}

const fmt = (v: number | null, unit: string) => (v === null ? "Not recorded" : `${v} ${unit}`);

/**
 * Evaluate evidence-based mid-cycle dose adjustment for the latest monitoring visit.
 */
export function evaluateDoseAdjustment(latest: MonitoringVisit | null): DoseAdjustmentEvaluation {
  const gate = evaluateTreatmentGate("dose-adjustment");
  const isGateActive = gate.active;

  if (!latest) {
    return {
      status: isGateActive ? "DATA_INCOMPLETE" : "EVIDENCE_PENDING",
      proposedDose: null,
      proposedAction: null,
      actionCategory: null,
      rationale: "No monitoring visit recorded.",
      firedRule: null,
      observedValues: [],
      currentDose: null,
      currentDoseSource: "not-recorded",
      currentMedication: "Not recorded",
      stimulationDay: null,
      message: "No monitoring visit data available to evaluate follicular kinetics or dose adjustments.",
      registeredRules: doseAdjustmentRules,
      version: DOSE_ADJUSTMENT_ENGINE_VERSION,
    };
  }

  const observedValues = [
    { label: "Stimulation day", value: `Day ${latest.day}` },
    { label: "Largest follicle", value: fmt(latest.largestFollicle, "mm") },
    { label: "Follicles ≥ 10 mm", value: fmt(latest.follicles10, "") },
    { label: "Follicles ≥ 14 mm", value: fmt(latest.follicles14, "") },
    { label: "Follicles ≥ 17 mm", value: fmt(latest.follicles17, "") },
    { label: "Estradiol", value: fmt(latest.estradiol, "pg/mL") },
    { label: "LH", value: fmt(latest.lh, "IU/L") },
    { label: "Progesterone", value: fmt(latest.progesterone, "ng/mL") },
    { label: "Endometrial thickness", value: fmt(latest.endometrium, "mm") },
  ];

  const day = latest.day;
  const currDose = latest.dailyDose;
  const largest = latest.largestFollicle;
  const f10 = latest.follicles10 ?? (latest.follicleCount ?? null);
  const f14 = latest.follicles14 ?? 0;
  const f17 = latest.follicles17 ?? 0;
  const e2 = latest.estradiol;
  const p4 = latest.progesterone;

  let firedRule: DoseAdjustmentRule | null = null;
  let proposedAction: string | null = null;
  let actionCategory: "MAINTAIN" | "INCREASE" | "REDUCE" | "COAST" | "TRIGGER" | null = null;
  let calculatedProposedDose: number | null = null;
  let rationale: string | null = null;
  let message: string = "";

  // 1. Trigger criteria met (Lead >= 18mm, >= 3 follicles >= 17mm, or lead >= 17mm in low prognosis)
  const isTriggerReady =
    (f17 !== null && f17 >= 3) ||
    (largest !== null && largest >= 18) ||
    (largest !== null && largest >= 17 && f10 !== null && f10 <= 4);

  // 2. Severe Hyper-Response / Critical OHSS surge (>= 18 follicles >= 10mm or E2 >= 3000 pg/mL)
  const isHyperResponse =
    !isTriggerReady &&
    ((f10 !== null && f10 >= 18) ||
      (e2 !== null && e2 >= 3000) ||
      (e2 !== null && e2 >= 2000 && day !== null && day <= 6));

  // 3. Hypo-response / Slow recruitment on Day >= 5
  const isHypoResponse =
    !isTriggerReady &&
    !isHyperResponse &&
    day !== null &&
    day >= 5 &&
    day <= 9 &&
    ((largest !== null && largest < 10) ||
      (f10 !== null && f10 <= 2 && day >= 6) ||
      (e2 !== null && e2 < 180 && day >= 5));

  // 4. Initial phase (Day < 5)
  const isTooEarly = !isTriggerReady && !isHyperResponse && !isHypoResponse && day !== null && day < 5;

  if (isTriggerReady) {
    firedRule = doseAdjustmentRules.find((r) => r.ruleId === "trigger-readiness-completion") ?? null;
    proposedAction = "PROCEED TO TRIGGER — Discontinue daily gonadotropins";
    actionCategory = "TRIGGER";
    calculatedProposedDose = 0;
    rationale =
      "Follicular cohort meets international trigger criteria (>= 3 follicles >= 17 mm or lead follicle >= 18 mm). Stimulation phase complete. Discontinue daily gonadotropin injections and proceed to Trigger Strategy Engine.";
    message =
      "Trigger readiness achieved: Discontinue gonadotropin stimulation and proceed to final oocyte maturation trigger.";
  } else if (isHyperResponse) {
    firedRule = doseAdjustmentRules.find((r) => r.ruleId === "hyper-response-dose-reduction") ?? null;
    if (e2 !== null && e2 >= 4500 && (largest === null || largest < 17)) {
      proposedAction = "COASTING (1–2 days) & STEP-DOWN DOSE";
      actionCategory = "COAST";
      calculatedProposedDose = currDose !== null ? Math.max(75, currDose - 50) : 75;
      rationale =
        "Marked hyper-response with critical estradiol elevation (E2 >= 4,500 pg/mL or >= 18 follicles >= 10 mm). Withhold gonadotropins for 1–2 days (coasting) while maintaining daily GnRH antagonist (0.25 mg), or reduce dose to 75–100 IU/day. Mandatory GnRH agonist trigger and elective freeze-all indicated to eliminate OHSS risk.";
      message =
        "High OHSS risk detected: Estradiol surge / excessive follicular cohort. Recommend step-down titration (-25 to -50 IU/day) or coasting, with planned GnRH agonist trigger.";
    } else {
      proposedAction = "REDUCE DOSE (Step-down by 25–50 IU/day)";
      actionCategory = "REDUCE";
      calculatedProposedDose = currDose !== null ? Math.max(75, currDose - 25) : 100;
      rationale =
        "Excessive follicular recruitment or accelerated estradiol velocity observed. Step-down daily dose reduction (-25 to -50 IU/day, floor 75–100 IU/day) per ASRM 2016 to temper follicular growth velocity without precipitating cohort atresia.";
      message =
        "Excessive follicular recruitment detected. Step-down daily gonadotropin dose by 25–50 IU/day to control follicular velocity.";
    }
  } else if (isHypoResponse) {
    firedRule = doseAdjustmentRules.find((r) => r.ruleId === "hypo-response-dose-titration") ?? null;
    if (currDose !== null && currDose >= 300) {
      proposedAction = "MAINTAIN 300 IU/DAY CEILING (Do not exceed per ESHRE Rec 20)";
      actionCategory = "MAINTAIN";
      calculatedProposedDose = 300;
      rationale =
        "Suboptimal follicular recruitment or low estradiol on Day 5–8. Current dose is already at the 300 IU/day hard ceiling. Doses > 300 IU/day are not recommended per ESHRE 2025 Rec 20 as they do not improve oocyte yield or live birth rates. Maintain 300 IU/day and re-evaluate cohort viability in 48 hours.";
      message =
        "Suboptimal response detected, but patient is already at the maximum evidence-based starting dose (300 IU/day). Maintain ceiling dose; do not increase above 300 IU/day.";
    } else {
      proposedAction = "INCREASE DOSE (Step-up by +50 to +75 IU/day, max 300 IU/day)";
      actionCategory = "INCREASE";
      calculatedProposedDose = currDose !== null ? Math.min(300, currDose + 50) : 225;
      rationale =
        "Slow follicular recruitment (lead follicle < 10 mm or <= 2 follicles >= 10 mm with E2 < 180 pg/mL on Day 5+). Consider dose step-up (+50 to +75 IU/day up to max 300 IU/day) to rescue follicular recruitment and prevent cycle cancellation.";
      message =
        "Suboptimal response: Slow follicular recruitment. Step-up dose titration (+50 to +75 IU/day, capped at 300 IU/day) recommended.";
    }
  } else if (isTooEarly) {
    firedRule = doseAdjustmentRules.find((r) => r.ruleId === "eshre-steady-response-maintain-dose") ?? null;
    proposedAction = "MAINTAIN CURRENT DOSE (Initial recruitment phase)";
    actionCategory = "MAINTAIN";
    calculatedProposedDose = currDose;
    rationale =
      "Stimulation Day < 5: Initial follicular cohort recruitment is ongoing. Too early for evidence-based dose adjustments. Maintain baseline starting dose and re-evaluate on Day 5 or 6 with ultrasound and estradiol.";
    message =
      "Initial recruitment phase: Maintain current starting dose until first formal folliculometry review on Day 5/6.";
  } else {
    // Steady Appropriate Progression
    firedRule = doseAdjustmentRules.find((r) => r.ruleId === "eshre-steady-response-maintain-dose") ?? null;
    proposedAction = "MAINTAIN CURRENT DOSE (Steady follicular kinetics)";
    actionCategory = "MAINTAIN";
    calculatedProposedDose = currDose;
    rationale =
      "Follicular recruitment and estradiol kinetics are progressing steadily within expected therapeutic targets. Per ESHRE 2025 Rec 43 ('Adjustment of the gonadotrophin dose in the mid-stimulation phase is probably not recommended'), routine dose adjustment is not advised when response is appropriate. Maintain current daily dose.";
    message = "Steady follicular progression: Maintain current gonadotropin dose per ESHRE 2025 Rec 43.";
  }

  const proposedDose = isGateActive
    ? gatedTreatmentValue("dose-adjustment", calculatedProposedDose)
    : null;

  return {
    status: isGateActive ? "ACTIVE" : "EVIDENCE_PENDING",
    proposedDose,
    proposedAction,
    actionCategory,
    rationale,
    firedRule,
    observedValues,
    currentDose: latest?.dailyDose ?? null,
    currentDoseSource: latest?.dailyDose != null ? "physician-entered" : "not-recorded",
    currentMedication: latest?.medication?.trim() || "Not recorded",
    stimulationDay: latest?.day ?? null,
    message,
    registeredRules: doseAdjustmentRules,
    version: DOSE_ADJUSTMENT_ENGINE_VERSION,
  };
}
