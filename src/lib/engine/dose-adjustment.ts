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
import { isTreatmentAlgorithmActive } from "./algorithm-status";
import type { MonitoringVisit } from "./monitoring";

export const DOSE_ADJUSTMENT_ENGINE_VERSION = "1.0.0";

export const DOSE_ADJUSTMENT_PENDING_MESSAGE =
  "Dynamic dose adjustment is not currently activated because validated adjustment rules and their applicable evidence thresholds have not been loaded.";

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
 * Registered rules. Each entry is a placeholder describing a rule the
 * application is PREPARED to run — none is active, none carries a number.
 */
export const doseAdjustmentRules: DoseAdjustmentRule[] = [
  {
    ruleId: "eshre-monitoring-dose-adjustment",
    ruleName: "Mid-stimulation gonadotropin dose adjustment (ESHRE ovarian stimulation guideline)",
    source: "ESHRE ovarian stimulation guideline — monitoring / dose adjustment chapter",
    publication: null,
    year: null,
    doi: null,
    link: null,
    population: null,
    protocol: null,
    gonadotropin: null,
    stimulationDay: null,
    requiredVariables: [],
    threshold: null,
    comparisonOperator: "unspecified",
    action: null,
    doseChange: null,
    maximumChange: null,
    minimumDose: null,
    maximumDose: null,
    exceptions: [],
    contraindications: [],
    evidenceLevel: null,
    activationStatus: "EVIDENCE_PENDING",
    version: "0.0.0",
    missingComponents: [
      "Explicit actionable statement (not narrative text) permitting a dose change",
      "Stimulation day / review timing at which the rule applies",
      "Measured variable and its exact numeric threshold with units",
      "Permitted increment or decrement in IU, with maximum change",
      "Dose floor and ceiling",
      "Applicable protocol and gonadotropin preparation",
    ],
  },
  {
    ruleId: "poseidon-suboptimal-response-adjustment",
    ruleName: "Dose adjustment for suboptimal response (POSEIDON framework)",
    source: "POSEIDON group publications",
    publication: null,
    year: null,
    doi: null,
    link: null,
    population: null,
    protocol: null,
    gonadotropin: null,
    stimulationDay: null,
    requiredVariables: [],
    threshold: null,
    comparisonOperator: "unspecified",
    action: null,
    doseChange: null,
    maximumChange: null,
    minimumDose: null,
    maximumDose: null,
    exceptions: [],
    contraindications: [],
    evidenceLevel: null,
    activationStatus: "EVIDENCE_PENDING",
    version: "0.0.0",
    missingComponents: [
      "Group-specific in-cycle adjustment rule stated as an action, not an observation",
      "Required in-cycle measurements and their thresholds",
      "Dose change magnitude and units",
    ],
  },
  {
    ruleId: "hyper-response-dose-reduction",
    ruleName: "Dose reduction in excessive follicular response (ASRM OHSS prevention)",
    source: "ASRM OHSS prevention guideline",
    publication: null,
    year: null,
    doi: null,
    link: null,
    population: null,
    protocol: null,
    gonadotropin: null,
    stimulationDay: null,
    requiredVariables: [],
    threshold: null,
    comparisonOperator: "unspecified",
    action: null,
    doseChange: null,
    maximumChange: null,
    minimumDose: null,
    maximumDose: null,
    exceptions: [],
    contraindications: [],
    evidenceLevel: null,
    activationStatus: "EVIDENCE_PENDING",
    version: "0.0.0",
    missingComponents: [
      "Follicle-count and oestradiol thresholds stated as an actionable dose rule",
      "Permitted dose reduction with units and dose floor",
      "Population and protocol in which the reduction was validated",
    ],
  },
];

export const activeDoseAdjustmentRules = (): DoseAdjustmentRule[] =>
  doseAdjustmentRules.filter((r) => r.activationStatus === "ACTIVE");

/* -------------------------------------------------------------- evaluation */

export interface DoseAdjustmentEvaluation {
  status: AlgorithmStatus;
  /** Never a dose while status !== ACTIVE. */
  proposedDose: number | null;
  proposedAction: string | null;
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
 * Evaluate dose adjustment for the latest visit.
 *
 * Because no rule is ACTIVE, this always returns EVIDENCE_PENDING with a null
 * dose. The observed values are echoed so the physician can see exactly what
 * the engine had available — they are NOT interpreted.
 */
export function evaluateDoseAdjustment(latest: MonitoringVisit | null): DoseAdjustmentEvaluation {
  const observedValues = latest
    ? [
        { label: "Stimulation day", value: `Day ${latest.day}` },
        { label: "Largest follicle", value: fmt(latest.largestFollicle, "mm") },
        { label: "Follicles ≥ 10 mm", value: fmt(latest.follicles10, "") },
        { label: "Follicles ≥ 14 mm", value: fmt(latest.follicles14, "") },
        { label: "Follicles ≥ 17 mm", value: fmt(latest.follicles17, "") },
        { label: "Estradiol", value: fmt(latest.estradiol, "pg/mL") },
        { label: "LH", value: fmt(latest.lh, "IU/L") },
        { label: "Progesterone", value: fmt(latest.progesterone, "ng/mL") },
        { label: "Endometrial thickness", value: fmt(latest.endometrium, "mm") },
      ]
    : [];

  const active = activeDoseAdjustmentRules();
  const status: AlgorithmStatus =
    active.length > 0 && isTreatmentAlgorithmActive("dose-adjustment")
      ? "ACTIVE"
      : "EVIDENCE_PENDING";

  return {
    status,
    proposedDose: null,
    proposedAction: null,
    firedRule: null,
    observedValues,
    currentDose: latest?.dailyDose ?? null,
    currentDoseSource: latest?.dailyDose != null ? "physician-entered" : "not-recorded",
    currentMedication: latest?.medication?.trim() || "Not recorded",
    stimulationDay: latest?.day ?? null,
    message: DOSE_ADJUSTMENT_PENDING_MESSAGE,
    registeredRules: doseAdjustmentRules,
    version: DOSE_ADJUSTMENT_ENGINE_VERSION,
  };
}
