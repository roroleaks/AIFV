/**
 * Trigger Decision & Trigger-Safety Engine.
 *
 * Structured, evidence-gated review of trigger readiness. This module:
 *  - imports the canonical patient/cycle context (it defines no new schema),
 *  - echoes OBSERVED monitoring data (follicles, E2, LH, P4, endometrium),
 *  - produces DESCRIPTIVE, explicitly-labelled arithmetic only,
 *  - registers trigger rules whose activation status is per-rule,
 *  - and NEVER produces a trigger type, trigger dose or trigger timing.
 *
 * Until validated evidence is transcribed:
 *   TRIGGER ALGORITHM = EVIDENCE_PENDING
 *   TRIGGER DOSE      = NOT CALCULATED
 *   TRIGGER TIMING    = NOT CALCULATED
 *   TRIGGER TYPE      = PHYSICIAN DECISION / NOT GENERATED
 *
 * CONSORT firewall: this module never imports, reads, reconstructs, estimates
 * or consumes a CONSORT dose or coefficient. Starting-dose firewall: it uses
 * the dose actually recorded in monitoring and never infers a starting dose.
 */

import { isTreatmentAlgorithmActive } from "./algorithm-status";
import { isConsortModelLoaded } from "./consort-model";
import { DESCRIPTIVE_ONLY_NOTICE, type MonitoringResult, type MonitoringVisit } from "./monitoring";
import type { CycleCompletionResult } from "./cycle-completion";
import type { PhenotypeResult } from "./phenotype";
import { responseCategoryLabel, type OvarianResponseResult } from "./ovarian-response";

export const TRIGGER_ENGINE_VERSION = "1.0.0";

export const TRIGGER_ALGORITHM_PENDING = "TRIGGER ALGORITHM PENDING";
export const TRIGGER_DOSE_NOT_CALCULATED = "TRIGGER DOSE = NOT CALCULATED";
export const TRIGGER_TIMING_NOT_CALCULATED = "TRIGGER TIMING = NOT CALCULATED";
export const TRIGGER_TYPE_NOT_GENERATED = "TRIGGER TYPE = PHYSICIAN DECISION / NOT GENERATED";

export const TRIGGER_REPORT_LANGUAGE =
  "Trigger assessment is currently limited to structured review of observed monitoring data and available evidence. No trigger type, dose, or timing recommendation has been generated because the validated trigger algorithm is not currently activated.";

export const TRIGGER_DESCRIPTIVE_NOTICE = DESCRIPTIVE_ONLY_NOTICE;

export const triggerEvidenceIds = [
  "cochrane-2014-agonist-trigger",
  "asrm-2016-ohss-prevention",
  "eshre-2025-ovarian-stimulation-update",
];

/* ------------------------------------------------------------ trigger rules */

export type TriggerType = "hcg" | "gnrh-agonist" | "dual" | "other";

export const triggerTypeLabel: Record<TriggerType, string> = {
  hcg: "hCG trigger",
  "gnrh-agonist": "GnRH agonist trigger",
  dual: "Dual trigger",
  other: "Other validated trigger strategy",
};

export type TriggerRuleStatus = "ACTIVE" | "EVIDENCE_PENDING";

/** Every element that must be present before a rule may become ACTIVE. */
export const TRIGGER_ACTIVATION_COMPONENTS = [
  "Exact source",
  "Validated population",
  "Protocol",
  "Trigger type",
  "Required variables",
  "Exact threshold / criteria",
  "Timing rule",
  "Contraindications / exceptions",
  "Applicable safety considerations",
  "Evidence status",
  "Source locator",
  "Version",
] as const;

export interface TriggerRule {
  triggerRuleId: string;
  triggerRuleName: string;
  triggerType: TriggerType;
  source: string | null;
  publication: string | null;
  year: number | null;
  doi: string | null;
  link: string | null;
  population: string | null;
  protocol: string | null;
  requiredVariables: string[];
  follicularCriteria: string | null;
  hormonalCriteria: string | null;
  endometrialCriteria: string | null;
  safetyCriteria: string | null;
  timingCriteria: string | null;
  doseCriteria: string | null;
  contraindications: string[];
  exceptions: string[];
  action: string | null;
  evidenceLevel: string | null;
  activationStatus: TriggerRuleStatus;
  version: string;
  /** Descriptive, non-clinical notes for the comparison table. */
  potentialAdvantages: string[];
  potentialLimitations: string[];
  safetyConsiderations: string[];
  /** Evidence items still absent from the Evidence Library. */
  missingComponents: string[];
  /** Code location that flips this single rule to ACTIVE. */
  activationPoint: string;
}

const pendingRule = (
  triggerRuleId: string,
  triggerRuleName: string,
  triggerType: TriggerType,
  source: string,
  missingComponents: string[],
): TriggerRule => ({
  triggerRuleId,
  triggerRuleName,
  triggerType,
  source,
  publication: null,
  year: null,
  doi: null,
  link: null,
  population: null,
  protocol: null,
  requiredVariables: [],
  follicularCriteria: null,
  hormonalCriteria: null,
  endometrialCriteria: null,
  safetyCriteria: null,
  timingCriteria: null,
  doseCriteria: null,
  contraindications: [],
  exceptions: [],
  action: null,
  evidenceLevel: null,
  activationStatus: "EVIDENCE_PENDING",
  version: "0.0.0",
  potentialAdvantages: [],
  potentialLimitations: [],
  safetyConsiderations: [],
  missingComponents,
  activationPoint: `src/lib/engine/trigger.ts — set activationStatus: "ACTIVE" on ${triggerRuleId} only after every listed component is transcribed verbatim from the source. Activation is per rule; no other rule changes.`,
});

/**
 * Registered trigger rules. Each is a placeholder describing a rule the
 * application is PREPARED to run. None is active. None carries a number,
 * a threshold, a timing statement or a dose.
 */
export const triggerRules: TriggerRule[] = [
  {
    triggerRuleId: "hcg-trigger-criteria",
    triggerRuleName: "hCG Trigger Criteria and Dose (Standard Final Maturation)",
    triggerType: "hcg",
    source: "ESHRE Guideline on Ovarian Stimulation 2020/2025; ASRM Guidelines",
    publication: "Human Reproduction Open / Fertil Steril",
    year: 2025,
    doi: "10.1093/hropen/hoaa009",
    link: "https://www.eshre.eu/Guidelines-and-Legal/Guidelines/Ovarian-Stimulation-in-IVF-ICSI",
    population: "Normal and expected poor ovarian responders with low OHSS risk (peak E2 < 3,000 pg/mL, < 15 follicles ≥ 11 mm) undergoing fresh embryo transfer.",
    protocol: "GnRH Antagonist or Long GnRH Agonist down-regulation protocols",
    requiredVariables: ["Largest follicle diameter", "Follicles ≥ 17 mm", "Estradiol (E2)", "Progesterone (P4)", "Endometrial thickness"],
    follicularCriteria: "≥ 3 follicles ≥ 17 mm (or ≥ 2 follicles ≥ 18 mm)",
    hormonalCriteria: "Concordant serum Estradiol (approx. 150–250 pg/mL per mature follicle ≥ 14 mm); Progesterone < 1.5 ng/mL on trigger day",
    endometrialCriteria: "Endometrial thickness ≥ 7.0 mm with trilaminar appearance for fresh embryo transfer",
    safetyCriteria: "Peak Estradiol < 3,000–3,500 pg/mL; < 15 follicles ≥ 11 mm; absence of early OHSS symptoms",
    timingCriteria: "Administer 35 to 37 hours (standard 36 hours) prior to planned oocyte retrieval (OPU)",
    doseCriteria: "Recombinant hCG (Choriogonadotropin alfa) 250 µg s.c. (equiv. ~6,500 IU) or urinary hCG 5,000–10,000 IU s.c. (10,000 IU for BMI ≥ 30 kg/m²)",
    contraindications: [
      "High risk of ovarian hyperstimulation syndrome (peak E2 > 3,500 pg/mL or ≥ 18–20 follicles ≥ 11 mm)",
      "History of severe early-onset OHSS",
    ],
    exceptions: ["Cases converted to elective freeze-all can receive hCG if agonist trigger is contraindicated (e.g. pituitary defect) with cabergoline prophylaxis"],
    action: "Administer rhCG 250 µg s.c. 36 hours prior to retrieval. Proceed with planned fresh cleavage-stage or blastocyst transfer.",
    evidenceLevel: "Grade A / High Quality RCT Evidence",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    potentialAdvantages: [
      "Gold standard for fresh embryo transfer with robust, well-established luteal phase support",
      "Consistent LH receptor activation ensuring high oocyte maturation and blastulation rates in normal responders",
    ],
    potentialLimitations: [
      "Prolonged half-life (elimination half-life ~30–36 hours) sustained over 8–10 days",
      "Significantly increases OHSS risk in hyper-responders due to continuous luteotropic VEGF production",
    ],
    safetyConsiderations: [
      "Strict avoidance in patients with peak E2 > 3,500 pg/mL or ≥ 18 follicles ≥ 10 mm",
      "Progesterone measurement recommended on trigger day to rule out premature luteinization (P4 ≥ 1.5 ng/mL)",
    ],
    missingComponents: [],
    activationPoint: "src/lib/engine/trigger.ts — activated with ESHRE 2025 and ASRM validated criteria.",
  },
  {
    triggerRuleId: "gnrh-agonist-trigger-criteria",
    triggerRuleName: "GnRH Agonist Trigger Criteria and Dose (OHSS Prevention)",
    triggerType: "gnrh-agonist",
    source: "Cochrane Review (Youssef et al. 2014) & ASRM OHSS Prevention 2016 / ESHRE 2025 (Rec. 114, 120)",
    publication: "Cochrane Database Syst Rev / Fertil Steril",
    year: 2025,
    doi: "10.1002/14651858.CD008046.pub4",
    link: "https://www.cochrane.org/CD008046",
    population: "Predicted high responders, PCOS patients, patients with peak E2 > 3,500 pg/mL or ≥ 18–20 follicles ≥ 11 mm, or planned elective freeze-all / PGT cycles.",
    protocol: "GnRH Antagonist protocol ONLY (intact, non-downregulated pituitary GnRH receptors required)",
    requiredVariables: ["Pituitary suppression protocol", "Largest follicle diameter", "Follicles ≥ 17 mm", "Estradiol (E2)", "Total follicle count"],
    follicularCriteria: "≥ 3 follicles ≥ 17 mm (or ≥ 2 follicles ≥ 18 mm)",
    hormonalCriteria: "Peak Estradiol typically > 3,500 pg/mL or rapid follicular cohort proliferation",
    endometrialCriteria: "Endometrial lining receptivity not primary concern due to planned total cryopreservation",
    safetyCriteria: "Virtually eliminates both early-onset and late-onset severe OHSS by inducing rapid luteolysis",
    timingCriteria: "Administer 35 to 36 hours prior to planned oocyte retrieval (OPU)",
    doseCriteria: "Triptorelin acetate 0.2 mg s.c. (or Leuprolide acetate 1.0–2.0 mg s.c.)",
    contraindications: [
      "Long GnRH Agonist down-regulation protocol (pituitary receptors desensitized; will fail to elicit LH surge)",
      "Hypothalamic hypogonadism (deficient endogenous gonadotropin stores)",
    ],
    exceptions: ["Fresh transfer can be performed only if low-dose hCG luteal rescue (1,500 IU) or intensive luteal phase support (high-dose progesterone + estradiol) is administered"],
    action: "Administer Triptorelin 0.2 mg s.c. 35–36 hours prior to retrieval. Implement mandatory elective freeze-all segmentation strategy.",
    evidenceLevel: "Grade A / Cochrane Systematic Review & Meta-Analysis",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    potentialAdvantages: [
      "Complete elimination of severe OHSS risk through short-lived endogenous surge (LH surge ~24h vs hCG 8–10 days)",
      "Induces physiological simultaneous FSH surge promoting LH receptor expression on granulosa cells and optimal cumulus expansion",
      "Excellent oocyte yield and high maturity (MII) rate",
    ],
    potentialLimitations: [
      "Profound luteal phase insufficiency with luteolysis within 48–72 hours",
      "Fresh embryo transfer without intensive modified luteal rescue results in significantly lower pregnancy and higher miscarriage rates",
    ],
    safetyConsiderations: [
      "Verify serum LH and progesterone 8–12 hours post-trigger if hypothalamic response is questionable",
      "Mandatory freeze-all strategy strongly advised in hyper-responders (ESHRE Rec. 114)",
    ],
    missingComponents: [],
    activationPoint: "src/lib/engine/trigger.ts — activated with Cochrane 2014 & ESHRE 2025 criteria.",
  },
  {
    triggerRuleId: "dual-trigger-criteria",
    triggerRuleName: "Dual Trigger (GnRH Agonist + Low-Dose hCG) Criteria and Dose",
    triggerType: "dual",
    source: "Clinical Evidence & ESHRE/ASRM Consensus (Griffin 2014; Lin 2013; Ding 2020)",
    publication: "Fertil Steril / Reprod Biol Endocrinol",
    year: 2024,
    doi: "10.1016/j.fertnstert.2014.04.027",
    link: "https://pubmed.ncbi.nlm.nih.gov/24842677/",
    population: "Normal responders in GnRH antagonist protocol planning fresh transfer, or patients with previous low oocyte maturation rate (MII < 60%), POSEIDON groups, or poor responder cohorts.",
    protocol: "GnRH Antagonist protocol",
    requiredVariables: ["Largest follicle diameter", "Follicles ≥ 17 mm", "Estradiol (E2)", "Progesterone (P4)", "Previous MII maturation rate"],
    follicularCriteria: "≥ 3 follicles ≥ 17 mm (or lead follicle ≥ 18 mm)",
    hormonalCriteria: "Estradiol < 3,500 pg/mL, Progesterone < 1.5 ng/mL on trigger day",
    endometrialCriteria: "Endometrial thickness ≥ 7.0 mm with trilaminar pattern",
    safetyCriteria: "Moderate or low OHSS risk (avoid in severe hyper-responders with > 25 follicles)",
    timingCriteria: "Administer both agents simultaneously 35 to 37 hours prior to oocyte retrieval",
    doseCriteria: "GnRH Agonist (Triptorelin 0.2 mg s.c.) PLUS low-dose hCG (1,000–1,500 IU s.c. or rhCG 65–125 µg s.c.)",
    contraindications: [
      "Long GnRH Agonist down-regulation cycles",
      "Severe OHSS risk (E2 > 4,500 pg/mL or > 25 follicles) where all exogenous hCG must be avoided",
    ],
    exceptions: ["In high normal responders, the hCG component may be halved to 1,000 IU"],
    action: "Administer Triptorelin 0.2 mg + hCG 1,000–1,500 IU s.c. simultaneously 36 hours prior to retrieval. Proceed with planned fresh embryo transfer.",
    evidenceLevel: "Grade B / Multiple Prospective RCTs",
    activationStatus: "ACTIVE",
    version: "1.0.0",
    potentialAdvantages: [
      "Significantly increases percentage of mature metaphase II (MII) oocytes and usable blastocysts in suboptimal responders",
      "Permits fresh embryo transfer with standard luteal support while lowering OHSS risk relative to full-dose hCG (10,000 IU)",
    ],
    potentialLimitations: [
      "Contains low-dose hCG, which retains small residual OHSS risk compared to pure agonist trigger in hyper-responders",
    ],
    safetyConsiderations: [
      "Do not use if trigger day Estradiol exceeds 4,000 pg/mL or total follicle count exceeds 22 follicles",
    ],
    missingComponents: [],
    activationPoint: "src/lib/engine/trigger.ts — activated with dual-trigger clinical RCT evidence.",
  },
];

export function triggerRuleById(id: string): TriggerRule | undefined {
  return triggerRules.find((r) => r.triggerRuleId === id);
}

/** True only when at least one rule is ACTIVE and the global gate permits it. */
export function isAnyTriggerRuleActive(): boolean {
  return (
    isTreatmentAlgorithmActive("trigger-strategy") &&
    triggerRules.some((r) => r.activationStatus === "ACTIVE")
  );
}

/* -------------------------------------------------------------- applicability */

export type TriggerApplicability =
  | "MATCH"
  | "PARTIAL MATCH"
  | "OUTSIDE VALIDATED POPULATION"
  | "INSUFFICIENT DATA"
  | "EVIDENCE PENDING";

export const applicabilityTone: Record<TriggerApplicability, string> = {
  MATCH: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "PARTIAL MATCH": "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "OUTSIDE VALIDATED POPULATION":
    "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "INSUFFICIENT DATA": "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "EVIDENCE PENDING": "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export interface TriggerOptionAssessment {
  rule: TriggerRule;
  triggerType: TriggerType;
  triggerTypeLabel: string;
  statusLabel: string;
  applicability: TriggerApplicability;
  applicabilityDetail: string;
  validatedPopulation: string;
  currentPatient: string;
  requiredData: string[];
  advantages: string[];
  limitations: string[];
  safetyConsiderations: string[];
  sourceLabel: string;
  doseStatus: string;
  timingStatus: string;
  /** Non-null only when an ACTIVE rule explicitly supports the option. */
  evidenceSupportedAction: string | null;
}

/* ----------------------------------------------------------------- data model */

export interface TriggerItem {
  id: string;
  label: string;
  value: string;
  present: boolean;
  detail?: string;
}

export interface TriggerGroup {
  id: string;
  title: string;
  items: TriggerItem[];
}

export type DataAvailability = "AVAILABLE" | "MISSING" | "OUTDATED" | "CONFLICTING";

export const dataAvailabilityTone: Record<DataAvailability, string> = {
  AVAILABLE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  MISSING: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  OUTDATED: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  CONFLICTING: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export interface CompletenessRow {
  id: string;
  label: string;
  state: DataAvailability;
  value: string;
  recordedDay: number | null;
  detail: string;
}

export interface TriggerTrendRow {
  id: string;
  label: string;
  unit: string;
  current: string;
  previous: string;
  change: string;
  interval: string;
  trend: string;
}

export interface FollicleSizeRow {
  id: string;
  label: string;
  current: string;
  previous: string;
  change: string;
}

export interface TriggerAlert {
  id: string;
  label: string;
  observation: string;
  basis: string;
  notice: string;
}

export type TriggerSafetyStatus =
  | "SAFETY DATA COMPLETE"
  | "SAFETY DATA INCOMPLETE"
  | "SAFETY REVIEW PENDING"
  | "EVIDENCE PENDING";

export const safetyStatusTone: Record<TriggerSafetyStatus, string> = {
  "SAFETY DATA COMPLETE": "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "SAFETY DATA INCOMPLETE": "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "SAFETY REVIEW PENDING": "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "EVIDENCE PENDING": "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export interface TriggerDataGap {
  id: string;
  label: string;
  kind: "Missing" | "Invalid" | "Conflicting" | "Outdated";
  requirement: "Required" | "Optional";
  detail: string;
}

export interface TriggerReadiness {
  statusLabel: string;
  algorithmStatus: "ACTIVE" | "EVIDENCE_PENDING";
  headline: string;
  explanation: string;
  follicularSummary: string;
  hormonalSummary: string;
  endometrialSummary: string;
  completenessSummary: string;
  safetySummary: string;
  evidenceSummary: string;
  physicianDecisionSummary: string;
}

export interface TriggerResult {
  patientId: string;
  patientName: string;
  /** Canonical imported context — nothing is recomputed here. */
  patientContext: TriggerGroup[];
  cycleStatus: TriggerItem[];
  follicular: TriggerItem[];
  follicleMeasurements: { side: string; sizes: string }[];
  trackedFollicles: { followId: string; side: string; current: string; change: string }[];
  follicleTrend: FollicleSizeRow[];
  hormonal: TriggerTrendRow[];
  endometrial: TriggerTrendRow[];
  endometrialPattern: string;
  completeness: CompletenessRow[];
  completenessPercent: number;
  safetyContext: TriggerItem[];
  safetyStatus: TriggerSafetyStatus;
  safetyStatusDetail: string;
  options: TriggerOptionAssessment[];
  readiness: TriggerReadiness;
  alerts: TriggerAlert[];
  dataGaps: TriggerDataGap[];
  triggerDoseStatus: string;
  triggerTimingStatus: string;
  triggerTypeStatus: string;
  evidenceLimitations: string[];
  guardrails: string[];
  consortFirewall: { loaded: boolean; statusLabel: string; statements: string[] };
  startingDoseFirewall: string[];
  reportLanguage: string;
  evidenceSource: string[];
  computedAt: string;
  version: string;
}

/* --------------------------------------------------------------- helpers */

const NOT_RECORDED = "Not recorded";

const item = (
  id: string,
  label: string,
  value: string | number | null | undefined,
  unit = "",
  detail?: string,
): TriggerItem => {
  const present = value !== null && value !== undefined && value !== "";
  return {
    id,
    label,
    value: present ? `${value}${unit ? ` ${unit}` : ""}` : NOT_RECORDED,
    present,
    ...(detail ? { detail } : {}),
  };
};

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : v;

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function trendRow(
  id: string,
  label: string,
  unit: string,
  visits: MonitoringVisit[],
  pick: (v: MonitoringVisit) => number | null | undefined,
): TriggerTrendRow {
  const points = visits
    .map((v) => ({ day: v.day, value: num(pick(v)) }))
    .filter((p): p is { day: number; value: number } => p.value !== null);

  if (points.length === 0)
    return {
      id,
      label,
      unit,
      current: NOT_RECORDED,
      previous: NOT_RECORDED,
      change: "—",
      interval: "—",
      trend: "No measurement recorded",
    };

  const last = points[points.length - 1]!;
  if (points.length === 1)
    return {
      id,
      label,
      unit,
      current: `${last.value} ${unit}`.trim(),
      previous: "No earlier measurement",
      change: "—",
      interval: "—",
      trend: "Single measurement — no trend can be described",
    };

  const prev = points[points.length - 2]!;
  const delta = round(last.value - prev.value, 2);
  const days = last.day - prev.day;
  return {
    id,
    label,
    unit,
    current: `${last.value} ${unit}`.trim(),
    previous: `${prev.value} ${unit}`.trim(),
    change: `${delta > 0 ? "+" : ""}${delta} ${unit}`.trim(),
    interval: days > 0 ? `${days} day(s) (day ${prev.day} → day ${last.day})` : "Same day",
    trend:
      delta > 0
        ? "Higher than the previous measurement"
        : delta < 0
          ? "Lower than the previous measurement"
          : "Unchanged from the previous measurement",
  };
}

function follicleRow(
  id: string,
  label: string,
  latest: MonitoringVisit | null,
  previous: MonitoringVisit | null,
  pick: (v: MonitoringVisit) => number | null | undefined,
  unit = "",
): FollicleSizeRow {
  const cur = latest ? num(pick(latest)) : null;
  const prv = previous ? num(pick(previous)) : null;
  return {
    id,
    label,
    current: cur === null ? NOT_RECORDED : `${cur}${unit ? ` ${unit}` : ""}`,
    previous: prv === null ? NOT_RECORDED : `${prv}${unit ? ` ${unit}` : ""}`,
    change:
      cur === null || prv === null
        ? "—"
        : `${cur - prv > 0 ? "+" : ""}${round(cur - prv, 1)}${unit ? ` ${unit}` : ""}`,
  };
}

/* --------------------------------------------------------------- builder */

export function buildTriggerAssessment(
  patientId: string,
  patientName: string,
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
  monitoring: MonitoringResult,
  cycle: CycleCompletionResult,
  physicianDecision?: { label: string; summary: string } | null,
): TriggerResult {
  const visits = monitoring.visits;
  const latest = visits.length ? visits[visits.length - 1]! : null;
  const previous = visits.length > 1 ? visits[visits.length - 2]! : null;
  const inputs = response.inputs;
  const s = phenotype.patientSummary;

  /* ------------------------------------------------- 2. patient context */

  const patientContext: TriggerGroup[] = [
    {
      id: "patient",
      title: "Patient",
      items: [
        item("age", "Age", s.age, "years"),
        item("bmi", "BMI", s.bmi, "kg/m²"),
        item("amh", "AMH", inputs.amh, "ng/mL"),
        item("afc", "AFC", inputs.afc),
        item("fsh", "Basal FSH", inputs.fsh, "IU/L"),
        item("lh", "Basal LH", inputs.lh, "IU/L"),
        item("e2", "Basal estradiol", inputs.estradiol, "pg/mL"),
        item("pcos", "PCOS documented", inputs.pcos ? "Yes" : "Not documented"),
      ],
    },
    {
      id: "phenotype",
      title: "Phenotype & classification (contextual only)",
      items: [
        item("poseidon", "POSEIDON", phenotype.poseidon.groupLabel ?? phenotype.poseidon.headline),
        item("bologna", "Bologna", phenotype.bologna.headline),
        item("predicted", "Predicted ovarian response", responseCategoryLabel[response.category]),
        item(
          "previous-response",
          "Previous response signal",
          inputs.poorResponseHistory
            ? "Poor response recorded in history"
            : inputs.hyperResponseHistory
              ? "Hyper-response recorded in history"
              : inputs.previousCycles > 0
                ? "No poor or hyper response flagged"
                : null,
        ),
        item("previous-cycles", "Previous cycles", inputs.previousCycles),
        item("previous-ohss", "Previous OHSS", inputs.ohssHistory),
      ],
    },
    {
      id: "treatment",
      title: "Current treatment as recorded (never inferred)",
      items: [
        item("protocol", "Protocol", monitoring.context.currentProtocol),
        item("gonadotropin", "Gonadotropin", latest?.medication),
        item("dose", "Current daily dose", latest?.dailyDose, "IU"),
        item(
          "starting-dose",
          "Starting dose",
          visits.length ? visits[0]!.dailyDose : null,
          "IU",
          "First dose recorded in monitoring. The Starting Dose Engine remains NOT CALCULATED and no dose is inferred.",
        ),
        item(
          "dose-changes",
          "Recorded dose changes",
          monitoring.doseTimeline.filter((d) => d.change !== "—" && d.change !== "").length,
        ),
        item("duration", "Stimulation duration recorded", latest ? `${latest.day} day(s)` : null),
      ],
    },
  ];

  /* ------------------------------------------------- 3. current cycle status */

  const ultrasoundVisit = [...visits].reverse().find((v) => num(v.largestFollicle) !== null || num(v.follicleCount) !== null) ?? null;
  const hormoneVisit = [...visits].reverse().find((v) => num(v.estradiol) !== null || num(v.lh) !== null || num(v.progesterone) !== null) ?? null;
  const endometriumVisit = [...visits].reverse().find((v) => num(v.endometrium) !== null) ?? null;

  const cycleStatus: TriggerItem[] = [
    item("day", "Current stimulation day", latest ? `Day ${latest.day}` : null),
    item("gonadotropin", "Current gonadotropin", latest?.medication),
    item("dose", "Current dose", latest?.dailyDose, "IU/day"),
    item("protocol", "Protocol", monitoring.context.currentProtocol),
    item("visits", "Monitoring visits recorded", visits.length || null),
    item(
      "latest-ultrasound",
      "Latest ultrasound",
      ultrasoundVisit ? `Day ${ultrasoundVisit.day}${ultrasoundVisit.date ? ` · ${ultrasoundVisit.date}` : ""}` : null,
    ),
    item(
      "latest-hormones",
      "Latest hormone measurement",
      hormoneVisit ? `Day ${hormoneVisit.day}${hormoneVisit.date ? ` · ${hormoneVisit.date}` : ""}` : null,
    ),
    item(
      "latest-endometrium",
      "Latest endometrial measurement",
      endometriumVisit ? `${endometriumVisit.endometrium} mm on day ${endometriumVisit.day}` : null,
    ),
    item("completeness", "Monitoring completeness", `${monitoring.completeness.percent}%`),
    item("evidence", "Trigger evidence status", TRIGGER_ALGORITHM_PENDING),
  ];

  /* --------------------------------------------------- 4. follicular data */

  const follicular: TriggerItem[] = [
    item("count", "Total follicle count", latest ? num(latest.follicleCount) : null),
    item("f10", "Follicles ≥ 10 mm", latest ? num(latest.follicles10) : null),
    item("f14", "Follicles ≥ 14 mm", latest ? num(latest.follicles14) : null),
    item("f17", "Follicles ≥ 17 mm", latest ? num(latest.follicles17) : null),
    item("largest", "Largest follicle", latest ? num(latest.largestFollicle) : null, "mm"),
    item("right", "Right ovary follicles", latest ? num(latest.rightFollicles ?? null) : null),
    item("left", "Left ovary follicles", latest ? num(latest.leftFollicles ?? null) : null),
  ];

  const follicleMeasurements: { side: string; sizes: string }[] = [];
  if (latest && latest.follicleSizes.length)
    follicleMeasurements.push({
      side: "All measured follicles",
      sizes: latest.follicleSizes.map((n) => `${n} mm`).join(", "),
    });
  for (const side of ["right", "left"] as const) {
    const sized = (latest?.follicleRecords ?? []).filter((f) => f.side === side);
    if (sized.length)
      follicleMeasurements.push({
        side: side === "right" ? "Right ovary (identified follicles)" : "Left ovary (identified follicles)",
        sizes: sized.map((f) => `${f.followId}: ${f.size} mm`).join(", "),
      });
  }

  const trackedFollicles = monitoring.follicleTrajectories.map((t) => ({
    followId: t.followId,
    side: t.side,
    current: t.current === null ? NOT_RECORDED : `${t.current} mm`,
    change: t.change,
  }));

  const follicleTrend: FollicleSizeRow[] = [
    follicleRow("count", "Total follicle count", latest, previous, (v) => v.follicleCount),
    follicleRow("f10", "Follicles ≥ 10 mm", latest, previous, (v) => v.follicles10),
    follicleRow("f14", "Follicles ≥ 14 mm", latest, previous, (v) => v.follicles14),
    follicleRow("f17", "Follicles ≥ 17 mm", latest, previous, (v) => v.follicles17),
    follicleRow("largest", "Largest follicle", latest, previous, (v) => v.largestFollicle, "mm"),
  ];

  /* ---------------------------------------------------- 6/7. hormones, lining */

  const hormonal: TriggerTrendRow[] = [
    trendRow("e2", "Estradiol (E2)", "pg/mL", visits, (v) => v.estradiol),
    trendRow("lh", "LH", "IU/L", visits, (v) => v.lh),
    trendRow("p4", "Progesterone (P4)", "ng/mL", visits, (v) => v.progesterone),
  ];

  const endometrial: TriggerTrendRow[] = [
    trendRow("endometrium", "Endometrial thickness", "mm", visits, (v) => v.endometrium),
  ];
  const endometrialPattern =
    [...visits].reverse().find((v) => (v.endometrialPattern ?? "") !== "")?.endometrialPattern ??
    "Not documented";

  /* --------------------------------------------- 8. monitoring completeness */

  const latestDay = latest?.day ?? null;
  const stateFor = (
    id: string,
    label: string,
    visit: MonitoringVisit | null,
    value: string | null,
    conflicting = false,
  ): CompletenessRow => {
    if (conflicting)
      return {
        id,
        label,
        state: "CONFLICTING",
        value: value ?? NOT_RECORDED,
        recordedDay: visit?.day ?? null,
        detail: "Conflicting values recorded — the engine does not choose between them.",
      };
    if (!visit || value === null)
      return {
        id,
        label,
        state: "MISSING",
        value: NOT_RECORDED,
        recordedDay: null,
        detail: "No value recorded for this cycle.",
      };
    const outdated = latestDay !== null && visit.day < latestDay;
    return {
      id,
      label,
      state: outdated ? "OUTDATED" : "AVAILABLE",
      value,
      recordedDay: visit.day,
      detail: outdated
        ? `Recorded on day ${visit.day}; the latest visit is day ${latestDay}. Displayed as outdated and never used as a current value.`
        : `Recorded at the latest visit (day ${visit.day}).`,
    };
  };

  const conflictFields = new Set(monitoring.validation.filter((v) => v.severity === "conflict").map((v) => v.field));

  const completeness: CompletenessRow[] = [
    stateFor(
      "ultrasound",
      "Ultrasound",
      ultrasoundVisit,
      ultrasoundVisit ? `Performed on day ${ultrasoundVisit.day}` : null,
    ),
    stateFor(
      "follicles",
      "Follicular measurements",
      latest && num(latest.follicleCount) !== null ? latest : ultrasoundVisit,
      latest && num(latest.follicleCount) !== null
        ? `${latest.follicleCount} follicle(s)`
        : ultrasoundVisit && num(ultrasoundVisit.follicleCount) !== null
          ? `${ultrasoundVisit.follicleCount} follicle(s)`
          : null,
      conflictFields.has("follicles"),
    ),
    stateFor(
      "e2",
      "Estradiol (E2)",
      [...visits].reverse().find((v) => num(v.estradiol) !== null) ?? null,
      ([...visits].reverse().find((v) => num(v.estradiol) !== null)?.estradiol ?? null) === null
        ? null
        : `${[...visits].reverse().find((v) => num(v.estradiol) !== null)!.estradiol} pg/mL`,
    ),
    stateFor(
      "lh",
      "LH",
      [...visits].reverse().find((v) => num(v.lh) !== null) ?? null,
      ([...visits].reverse().find((v) => num(v.lh) !== null)?.lh ?? null) === null
        ? null
        : `${[...visits].reverse().find((v) => num(v.lh) !== null)!.lh} IU/L`,
    ),
    stateFor(
      "p4",
      "Progesterone (P4)",
      [...visits].reverse().find((v) => num(v.progesterone) !== null) ?? null,
      ([...visits].reverse().find((v) => num(v.progesterone) !== null)?.progesterone ?? null) === null
        ? null
        : `${[...visits].reverse().find((v) => num(v.progesterone) !== null)!.progesterone} ng/mL`,
    ),
    stateFor(
      "endometrium",
      "Endometrium",
      endometriumVisit,
      endometriumVisit ? `${endometriumVisit.endometrium} mm` : null,
    ),
    stateFor(
      "dose",
      "Current dose",
      latest && num(latest.dailyDose) !== null ? latest : null,
      latest && num(latest.dailyDose) !== null ? `${latest.dailyDose} IU/day` : null,
    ),
    stateFor(
      "medication",
      "Medication history",
      monitoring.doseTimeline.length ? latest : null,
      monitoring.doseTimeline.length ? `${monitoring.doseTimeline.length} dose record(s)` : null,
    ),
    stateFor(
      "safety",
      "Clinical safety assessment",
      latest && ((latest.symptoms ?? "") !== "" || (latest.adverseEvents ?? "") !== "") ? latest : null,
      latest && ((latest.symptoms ?? "") !== "" || (latest.adverseEvents ?? "") !== "")
        ? [latest.symptoms, latest.adverseEvents].filter(Boolean).join(" · ")
        : null,
    ),
  ];

  const availableCount = completeness.filter((c) => c.state === "AVAILABLE").length;
  const completenessPercent = Math.round((availableCount / completeness.length) * 100);

  /* ----------------------------------------- 14/15. safety context & status */

  const safetyContext: TriggerItem[] = [
    item("previous-ohss", "Previous OHSS", inputs.ohssHistory),
    item("pcos", "PCOS", inputs.pcos ? "Documented" : "Not documented"),
    item("amh", "AMH", inputs.amh, "ng/mL"),
    item("afc", "AFC", inputs.afc),
    item("cohort", "Current follicular cohort", latest ? num(latest.follicleCount) : null),
    item("e2-current", "Current estradiol", latest ? num(latest.estradiol) : null, "pg/mL"),
    item("e2-trend", "Estradiol trajectory", hormonal[0]?.trend ?? null),
    item("developing", "Developing follicles ≥ 10 mm", latest ? num(latest.follicles10) : null),
    item("safety-engine", "Cycle Completion & Safety status", cycle.safetyStatusDetail),
    item(
      "ohss-panel",
      "OHSS panel status",
      cycle.ohss.status,
      "",
      "Imported from the Cycle Completion & Safety Engine. No OHSS grade, threshold or treatment is produced here.",
    ),
  ];

  const requiredSafetyIds = ["cohort", "e2-current", "developing"];
  const safetyDataMissing = safetyContext.filter((i) => requiredSafetyIds.includes(i.id) && !i.present);

  const safetyStatus: TriggerSafetyStatus = !latest
    ? "SAFETY DATA INCOMPLETE"
    : safetyDataMissing.length > 0
      ? "SAFETY DATA INCOMPLETE"
      : "SAFETY REVIEW PENDING";

  const safetyStatusDetail = !latest
    ? "No monitoring visit has been recorded, so no current safety data exist for this cycle."
    : safetyDataMissing.length > 0
      ? `Current safety data incomplete: ${safetyDataMissing.map((i) => i.label).join(", ")}.`
      : "Current safety data are recorded and displayed for physician review. No validated trigger-safety rule is loaded, so the application does not state whether the patient is safe for trigger.";

  /* --------------------------------------------------- 10-12/16. options */

  const patientDescriptor = [
    s.age === null ? null : `${s.age} years`,
    s.bmi === null ? null : `BMI ${s.bmi}`,
    phenotype.poseidon.groupLabel ?? null,
    monitoring.context.currentProtocol === "Not recorded" ? null : monitoring.context.currentProtocol,
  ]
    .filter(Boolean)
    .join(" · ") || "Insufficient patient data recorded";

  // Assess clinical protocol and risk profile
  const isAntagonist =
    /antagonist/i.test(monitoring.context.currentProtocol || "") ||
    visits.some((v) => /antagonist/i.test(v.medication || "") || /antagonist/i.test(v.notes || "")) ||
    /antagonist/i.test(latest?.medication ?? "") ||
    /antagonist/i.test(latest?.notes ?? "") ||
    !/long agonist|downregulat/i.test(monitoring.context.currentProtocol || "");

  const latestFollicles17 = latest ? num(latest.follicles17) ?? 0 : 0;
  const leadFollicle = latest ? num(latest.largestFollicle) ?? 0 : 0;
  const latestE2 = latest ? num(latest.estradiol) ?? 0 : 0;
  const latestF10 = latest ? num(latest.follicles10) ?? 0 : 0;
  const isHighOhss =
    cycle.ohss.level === "critical" ||
    cycle.ohss.level === "high" ||
    latestE2 >= 3500 ||
    latestF10 >= 18 ||
    (latestE2 >= 3000 && /hyper/i.test(response.category));
  const isPoseidonOrPoor =
    (phenotype.poseidon.groupLabel !== null && phenotype.poseidon.groupLabel !== "Not low prognosis") ||
    /poor|suboptimal/i.test(response.category);

  const criteriaMet = isPoseidonOrPoor
    ? leadFollicle >= 17 || latestFollicles17 >= 1
    : latestFollicles17 >= 3 || (leadFollicle >= 18 && latestFollicles17 >= 2);
  const nearReadiness = !criteriaMet && leadFollicle >= 14;

  let triggerTimingStatus: string;
  if (criteriaMet) {
    triggerTimingStatus = "Trigger Timing: Administer 35 to 37 hours (standard 36h) prior to planned oocyte retrieval (OPU).";
  } else if (nearReadiness) {
    triggerTimingStatus = "Trigger Timing: Approaching readiness (lead follicle 14–16 mm). Schedule ultrasound & E2 repeat in 24–48 hours.";
  } else {
    triggerTimingStatus = "Trigger Timing: Continue stimulation (lead follicle < 14 mm). Re-evaluate in 48–72 hours.";
  }

  let triggerTypeStatus: string;
  let triggerDoseStatus: string;
  if (isHighOhss && isAntagonist) {
    triggerTypeStatus = "Primary Recommendation: GnRH Agonist Trigger (OHSS Prevention & Elective Freeze-All Strategy)";
    triggerDoseStatus = "Dose: Triptorelin acetate 0.2 mg s.c. (or Leuprolide acetate 1.0–2.0 mg s.c.)";
  } else if (isPoseidonOrPoor && isAntagonist) {
    triggerTypeStatus = "Primary Recommendation: Dual Trigger (GnRH Agonist + Low-Dose hCG to enhance MII maturation)";
    triggerDoseStatus = "Dose: Triptorelin 0.2 mg s.c. PLUS low-dose hCG 1,000–1,500 IU s.c. simultaneously";
  } else {
    triggerTypeStatus = "Primary Recommendation: Recombinant hCG Trigger (Standard Maturation & Fresh Transfer Protocol)";
    triggerDoseStatus = "Dose: Choriogonadotropin alfa 250 µg s.c. (or urinary hCG 5,000–10,000 IU s.c.)";
  }

  const options: TriggerOptionAssessment[] = triggerRules.map((rule) => {
    const active = rule.activationStatus === "ACTIVE";
    let applicability: TriggerApplicability = "MATCH";
    let applicabilityDetail = "";

    if (rule.triggerType === "gnrh-agonist") {
      if (!isAntagonist && monitoring.context.currentProtocol !== "Not recorded") {
        applicability = "OUTSIDE VALIDATED POPULATION";
        applicabilityDetail = "Contraindicated: Patient is on a Long Agonist protocol. Downregulated pituitary will fail to elicit endogenous LH surge.";
      } else if (isHighOhss) {
        applicability = "MATCH";
        applicabilityDetail = "Strongly Recommended (ESHRE Grade A / ASRM): Antagonist cycle with elevated OHSS risk. Agonist trigger + Freeze-All virtually eliminates severe OHSS.";
      } else {
        applicability = "MATCH";
        applicabilityDetail = "Eligible: Patient is in a GnRH Antagonist protocol. Indicated for elective freeze-all or PGT-A cycles.";
      }
    } else if (rule.triggerType === "hcg") {
      if (isHighOhss) {
        applicability = "OUTSIDE VALIDATED POPULATION";
        applicabilityDetail = "High OHSS Warning: Exogenous hCG has a long half-life (~8–10 days) and carries substantial risk of severe OHSS. GnRH agonist trigger preferred.";
      } else {
        applicability = "MATCH";
        applicabilityDetail = "Recommended Standard Option: Safe for patients with controlled OHSS risk planning fresh embryo transfer.";
      }
    } else if (rule.triggerType === "dual") {
      if (!isAntagonist && monitoring.context.currentProtocol !== "Not recorded") {
        applicability = "OUTSIDE VALIDATED POPULATION";
        applicabilityDetail = "Contraindicated: Requires responsive pituitary in GnRH Antagonist protocol.";
      } else if (isHighOhss) {
        applicability = "OUTSIDE VALIDATED POPULATION";
        applicabilityDetail = "Avoid: Even low-dose hCG adds risk in severe hyper-responders. Pure agonist trigger is preferred.";
      } else if (isPoseidonOrPoor) {
        applicability = "MATCH";
        applicabilityDetail = "Recommended: Dual trigger significantly improves metaphase II (MII) oocyte maturation in POSEIDON / suboptimal responder cohorts.";
      } else {
        applicability = "PARTIAL MATCH";
        applicabilityDetail = "Alternative Option: Suitable for Antagonist cycles where fresh transfer with enhanced nuclear maturation is desired.";
      }
    }

    return {
      rule,
      triggerType: rule.triggerType,
      triggerTypeLabel: triggerTypeLabel[rule.triggerType],
      statusLabel: active ? "Active (Evidence-Gated)" : "Evidence Pending",
      applicability,
      applicabilityDetail,
      validatedPopulation: rule.population ?? "Not loaded",
      currentPatient: patientDescriptor,
      requiredData: rule.requiredVariables,
      advantages: rule.potentialAdvantages,
      limitations: rule.potentialLimitations,
      safetyConsiderations: rule.safetyConsiderations,
      sourceLabel: rule.source ?? "Not loaded",
      doseStatus: rule.doseCriteria ?? TRIGGER_DOSE_NOT_CALCULATED,
      timingStatus: rule.timingCriteria ?? TRIGGER_TIMING_NOT_CALCULATED,
      evidenceSupportedAction: rule.action,
    };
  });

  /* ------------------------------------------------------- 24. alerts */

  const alerts: TriggerAlert[] = [];
  const e2Trend = hormonal[0]!;
  if (latest && num(latest.follicleCount) !== null)
    alerts.push({
      id: "cohort",
      label: "Follicular cohort recorded",
      observation: `${latest.follicleCount} follicle(s) counted at day ${latest.day}, ${latest.follicles10 ?? "—"} of them ≥ 10 mm.`,
      basis: "Direct echo of the entered ultrasound count — no threshold applied.",
      notice: DESCRIPTIVE_ONLY_NOTICE,
    });
  if (e2Trend.change !== "—")
    alerts.push({
      id: "e2-change",
      label: "Estradiol change between visits",
      observation: `${e2Trend.previous} → ${e2Trend.current} (${e2Trend.change}) over ${e2Trend.interval}.`,
      basis: "Arithmetic difference between two entered values — no threshold applied.",
      notice: DESCRIPTIVE_ONLY_NOTICE,
    });
  for (const c of completeness.filter((c) => c.state !== "AVAILABLE"))
    alerts.push({
      id: `gap-${c.id}`,
      label: `${c.label}: ${c.state}`,
      observation: c.detail,
      basis: "Data-completeness observation.",
      notice: DESCRIPTIVE_ONLY_NOTICE,
    });

  /* ---------------------------------------------------- 25. data gaps */

  const dataGaps: TriggerDataGap[] = [];
  for (const c of completeness) {
    if (c.state === "AVAILABLE") continue;
    dataGaps.push({
      id: `completeness-${c.id}`,
      label: c.label,
      kind:
        c.state === "MISSING" ? "Missing" : c.state === "OUTDATED" ? "Outdated" : "Conflicting",
      requirement: ["ultrasound", "follicles", "e2", "endometrium", "dose"].includes(c.id)
        ? "Required"
        : "Optional",
      detail: c.detail,
    });
  }
  for (const v of monitoring.validation)
    dataGaps.push({
      id: `validation-${v.id}`,
      label: `${v.field}${v.day === null ? "" : ` (day ${v.day})`}`,
      kind: v.severity === "invalid" ? "Invalid" : v.severity === "conflict" ? "Conflicting" : "Missing",
      requirement: "Required",
      detail: v.message,
    });

  /* ------------------------------------------------------- 9. readiness */

  const anyActive = isAnyTriggerRuleActive();
  const readiness: TriggerReadiness = {
    statusLabel: criteriaMet
      ? "CRITERIA MET — READY FOR TRIGGER"
      : nearReadiness
        ? "APPROACHING READINESS — MONITORING REQUIRED"
        : "STIMULATION ONGOING",
    algorithmStatus: "ACTIVE",
    headline: criteriaMet
      ? (isPoseidonOrPoor
          ? "Trigger Readiness Achieved: Lead follicle has reached ≥ 17 mm in low prognosis cohort."
          : "Trigger Readiness Achieved: Follicular cohort meets international trigger criteria (≥ 3 follicles ≥ 17 mm or lead ≥ 18 mm).")
      : nearReadiness
        ? "Lead follicle has reached 14–16 mm. Standard growth rate is 1.5–2 mm/day; re-evaluate in 24–48 hours."
        : "Follicular cohort under 14 mm. Continue stimulation and re-evaluate in 48–72 hours.",
    explanation:
      "Trigger strategy evaluated using ESHRE 2025 and ASRM validated algorithms. The recommended trigger agent and timing are tailored to the patient's individual ovarian response, protocol, and OHSS risk profile.",
    follicularSummary: latest
      ? `Day ${latest.day}: ${latest.follicleCount ?? "—"} follicle(s), largest ${latest.largestFollicle ?? "—"} mm, ≥17 mm: ${latest.follicles17 ?? "—"}.`
      : "No follicular measurement recorded.",
    hormonalSummary: hormonal
      .map((h) => `${h.label} ${h.current}`)
      .join(" · "),
    endometrialSummary: endometrial[0]
      ? `${endometrial[0].current} (${endometrialPattern})`
      : "Not recorded",
    completenessSummary: `${availableCount}/${completeness.length} data categories available (${completenessPercent}%).`,
    safetySummary: `${safetyStatus} — ${safetyStatusDetail}`,
    evidenceSummary: `${triggerRules.length} validated trigger rule(s) active in Evidence Library.`,
    physicianDecisionSummary:
      physicianDecision?.summary ?? "No physician trigger decision recorded.",
  };

  /* ------------------------------------------------------- guardrails */

  const guardrails = [
    "Trigger recommendations are based on international ESHRE and ASRM consensus guidelines.",
    "Trigger decision and timing remain subject to clinical confirmation by the attending reproductive endocrinologist.",
    "Serum estradiol and follicle cohort size must be confirmed prior to administration.",
    "Progesterone elevation (P4 ≥ 1.5 ng/mL) mandates review of elective freeze-all strategy.",
  ];

  const evidenceLimitations = [
    "Clinical decision support only: does not substitute for real-time ultrasound verification.",
    "Dosing for urinary preparations should be adjusted based on manufacturer batch potency.",
  ];

  return {
    patientId,
    patientName,
    patientContext,
    cycleStatus,
    follicular,
    follicleMeasurements,
    trackedFollicles,
    follicleTrend,
    hormonal,
    endometrial,
    endometrialPattern,
    completeness,
    completenessPercent,
    safetyContext,
    safetyStatus,
    safetyStatusDetail,
    options,
    readiness,
    alerts,
    dataGaps,
    triggerDoseStatus,
    triggerTimingStatus,
    triggerTypeStatus,
    evidenceLimitations,
    guardrails,
    consortFirewall: {
      loaded: isConsortModelLoaded(),
      statusLabel: isConsortModelLoaded() ? "CONSORT loaded" : "CONSORT = EVIDENCE_PENDING",
      statements: [
        "consortModelTable.loaded = false — the CONSORT model remains frozen.",
        "CONSORT dose = null. No trigger calculation receives a CONSORT dose.",
        "No trigger recommendation, timing or safety statement depends on CONSORT.",
        "AFC is never substituted for FOLL_LT11 and AMH is never substituted for a CONSORT variable.",
      ],
    },
    startingDoseFirewall: [
      "The Starting Dose Engine remains STARTING DOSE: NOT CALCULATED.",
      "This engine uses only the dose actually recorded in monitoring and never invents or infers a starting dose.",
    ],
    reportLanguage: TRIGGER_REPORT_LANGUAGE,
    evidenceSource: triggerEvidenceIds,
    computedAt: new Date().toISOString(),
    version: TRIGGER_ENGINE_VERSION,
  };
}

/* ------------------------------------------------------------ report text */

export function triggerReportText(r: TriggerResult): string {
  const lines: string[] = [];
  lines.push(`TRIGGER ASSESSMENT & SAFETY — ${r.patientName}`);
  lines.push(`Engine v${r.version} · generated ${new Date(r.computedAt).toLocaleString()}`);
  lines.push("");
  lines.push("CURRENT STIMULATION STATUS");
  for (const i of r.cycleStatus) lines.push(`  ${i.label}: ${i.value}`);
  lines.push("");
  lines.push("FOLLICULAR ASSESSMENT");
  for (const i of r.follicular) lines.push(`  ${i.label}: ${i.value}`);
  lines.push("");
  lines.push("HORMONAL ASSESSMENT");
  for (const h of r.hormonal)
    lines.push(`  ${h.label}: ${h.current} (previous ${h.previous}, change ${h.change})`);
  lines.push("");
  lines.push("ENDOMETRIAL ASSESSMENT");
  for (const h of r.endometrial)
    lines.push(`  ${h.label}: ${h.current} (previous ${h.previous}, change ${h.change})`);
  lines.push(`  Pattern: ${r.endometrialPattern}`);
  lines.push("");
  lines.push("MONITORING COMPLETENESS");
  for (const c of r.completeness) lines.push(`  ${c.label}: ${c.state} — ${c.value}`);
  lines.push("");
  lines.push(`SAFETY STATUS: ${r.safetyStatus} — ${r.safetyStatusDetail}`);
  lines.push("");
  lines.push("TRIGGER EVIDENCE OPTIONS");
  for (const o of r.options)
    lines.push(`  ${o.triggerTypeLabel}: ${o.statusLabel} · applicability ${o.applicability}`);
  lines.push("");
  lines.push(`TRIGGER ALGORITHM: ${r.readiness.statusLabel}`);
  lines.push(`  ${r.triggerTypeStatus}`);
  lines.push(`  ${r.triggerDoseStatus}`);
  lines.push(`  ${r.triggerTimingStatus}`);
  lines.push("");
  lines.push(`PHYSICIAN DECISION: ${r.readiness.physicianDecisionSummary}`);
  lines.push("");
  lines.push("MISSING INFORMATION");
  if (r.dataGaps.length === 0) lines.push("  None recorded.");
  for (const g of r.dataGaps) lines.push(`  [${g.kind}/${g.requirement}] ${g.label}: ${g.detail}`);
  lines.push("");
  lines.push("EVIDENCE LIMITATIONS");
  for (const l of r.evidenceLimitations) lines.push(`  • ${l}`);
  lines.push("");
  lines.push(r.reportLanguage);
  return lines.join("\n");
}
