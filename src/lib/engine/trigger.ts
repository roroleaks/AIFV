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
  pendingRule(
    "hcg-trigger-criteria",
    "hCG trigger criteria and dose",
    "hcg",
    "ESHRE / ASRM ovarian stimulation guideline — final oocyte maturation chapter",
    [
      "Explicit follicular criterion (number and diameter, with units) defining when hCG may be given",
      "Explicit hormonal criteria (E2, LH, P4) with numeric thresholds and units, if any",
      "Endometrial criterion, if the source defines one",
      "Timing rule (interval between trigger and oocyte retrieval)",
      "hCG preparation, dose and route with the validated population",
      "Contraindications and exceptions",
      "Validated population and protocol the criterion was derived in",
    ],
  ),
  pendingRule(
    "gnrh-agonist-trigger-criteria",
    "GnRH agonist trigger criteria and dose",
    "gnrh-agonist",
    "Cochrane review of GnRH agonist versus hCG for final oocyte maturation / ASRM OHSS prevention guideline",
    [
      "Explicit eligibility criterion (protocol requirement, pituitary suppression state)",
      "Follicular and hormonal criteria with numeric thresholds and units",
      "Agonist preparation, dose and route",
      "Timing rule",
      "Applicable safety considerations and luteal-phase implications as stated by the source",
      "Contraindications and exceptions",
      "Validated population",
    ],
  ),
  pendingRule(
    "dual-trigger-criteria",
    "Dual trigger (GnRH agonist + hCG) criteria and dose",
    "dual",
    "Randomised trials / society statements on dual trigger",
    [
      "Explicit indication statement for dual trigger in a defined population",
      "Both component preparations with their doses and route",
      "Follicular, hormonal and timing criteria with units",
      "Contraindications and exceptions",
      "Validated population and protocol",
    ],
  ),
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

  const options: TriggerOptionAssessment[] = triggerRules.map((rule) => {
    const active = rule.activationStatus === "ACTIVE" && isTreatmentAlgorithmActive("trigger-strategy");
    return {
      rule,
      triggerType: rule.triggerType,
      triggerTypeLabel: triggerTypeLabel[rule.triggerType],
      statusLabel: active ? "Active" : "Evidence Pending",
      applicability: active ? "INSUFFICIENT DATA" : "EVIDENCE PENDING",
      applicabilityDetail: active
        ? "Rule active — applicability is determined by the transcribed population criteria."
        : "Applicability cannot be determined because the validated population and criteria have not been transcribed.",
      validatedPopulation: rule.population ?? "Not loaded",
      currentPatient: patientDescriptor,
      requiredData: rule.requiredVariables.length ? rule.requiredVariables : rule.missingComponents,
      advantages: rule.potentialAdvantages,
      limitations: rule.potentialLimitations,
      safetyConsiderations: rule.safetyConsiderations,
      sourceLabel: rule.source ?? "Not loaded",
      doseStatus: rule.doseCriteria ?? TRIGGER_DOSE_NOT_CALCULATED,
      timingStatus: rule.timingCriteria ?? TRIGGER_TIMING_NOT_CALCULATED,
      evidenceSupportedAction: active ? rule.action : null,
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
    statusLabel: anyActive ? "Evidence-supported option available" : TRIGGER_ALGORITHM_PENDING,
    algorithmStatus: anyActive ? "ACTIVE" : "EVIDENCE_PENDING",
    headline: anyActive
      ? "An activated trigger rule is available for physician review."
      : TRIGGER_ALGORITHM_PENDING,
    explanation: TRIGGER_REPORT_LANGUAGE,
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
    evidenceSummary: `${triggerRules.length} trigger rule(s) registered; ${triggerRules.filter((r) => r.activationStatus === "ACTIVE").length} active.`,
    physicianDecisionSummary:
      physicianDecision?.summary ?? "No physician trigger decision recorded.",
  };

  /* ------------------------------------------------------- guardrails */

  const guardrails = [
    "No trigger type is selected by the application. Trigger type remains a physician decision.",
    "No trigger dose is calculated, suggested or defaulted.",
    "No trigger timing is calculated or suggested.",
    "No follicle, E2, LH, P4 or endometrial threshold is applied — measured values are echoed only.",
    "Trigger type is never inferred from POSEIDON, Bologna, OHSS risk, AMH, AFC, age or previous cycles.",
    "No freeze-all, fresh-transfer, embryo-transfer-timing or luteal-support decision is generated here.",
    "No OHSS grade, OHSS threshold or OHSS treatment is generated here.",
    "Trigger options are listed, never ranked, while no source supports ranking for this population.",
  ];

  const evidenceLimitations = [
    "No validated trigger criterion (follicular, hormonal, endometrial or safety) has been transcribed into the Evidence Library.",
    "No trigger dose table for hCG, GnRH agonist or dual trigger is loaded.",
    "No trigger timing rule (trigger-to-retrieval interval) is loaded.",
    "Population applicability cannot be evaluated while the validated population of each rule is unknown.",
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
    triggerDoseStatus: TRIGGER_DOSE_NOT_CALCULATED,
    triggerTimingStatus: TRIGGER_TIMING_NOT_CALCULATED,
    triggerTypeStatus: TRIGGER_TYPE_NOT_GENERATED,
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
