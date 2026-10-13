/**
 * Cycle Completion & Safety Engine (V1).
 *
 * Integrates monitoring, ultrasound, hormones, protocol, response prediction
 * and OHSS risk markers, and prepares the physician for the final stage of
 * ovarian stimulation.
 *
 * This module DOES NOT recommend a trigger, hCG, GnRH agonist trigger, dual
 * trigger, fresh transfer, freeze-all or cycle cancellation. No trigger
 * criterion, OHSS cut-off or freeze-all indication is implemented. Every
 * statement below is either a restatement of entered data, a transparent
 * arithmetic difference, or a declaration that the evidence-based algorithm
 * is not yet activated.
 */

import type { PhenotypeResult } from "./phenotype";
import type { OvarianResponseResult } from "./ovarian-response";
import { responseCategoryLabel } from "./ovarian-response";
import type { ProtocolRecommendationResult } from "./protocol-recommendation";
import type { GonadotropinSelectionResult } from "./gonadotropin-selection";
import type { StoredConsortDose } from "./consort-store";
import {
  DESCRIPTIVE_BAND_DISCLAIMER,
  type MonitoringResult,
  type MonitoringSeriesPoint,
  type MonitoringVisit,
} from "./monitoring";
import { HISTORICAL_VALUE_NOTICE, gatedTreatmentValue } from "./algorithm-status";


export const CYCLE_COMPLETION_VERSION = "1.0.0";

export const cycleCompletionEvidenceIds = [
  "eshre-2020-ovarian-stimulation",
  "asrm-2016-ohss-prevention",
];

export const CYCLE_COMPLETION_PENDING_MESSAGE =
  "Evidence-based trigger, OHSS and freeze-all algorithms are not activated. This module organises the end-of-stimulation data surface only. No trigger decision, trigger medication, OHSS classification, freeze-all indication, fresh-transfer decision or cancellation is produced until the published guideline tables are transcribed into the Evidence Library.";

export const TRIGGER_REQUIRED_EVIDENCE = [
  "ESHRE ovarian stimulation guideline — trigger chapter: the recommendation statements defining when final oocyte maturation is triggered (follicle-size and count criteria as published).",
  "ESHRE / ASRM statements on the choice between hCG, GnRH agonist and dual trigger, with the patient groups each applies to.",
  "Published trigger dose tables for each trigger agent, including the BMI or response strata if the source stratifies them.",
];

export const OHSS_REQUIRED_EVIDENCE = [
  "ASRM 2016 OHSS prevention — the oestradiol and follicle-count risk thresholds table.",
  "ASRM / ESHRE OHSS severity classification table (mild / moderate / severe criteria).",
  "Published risk-factor weighting or scoring table, if the source defines one.",
];

export const FREEZE_ALL_REQUIRED_EVIDENCE = [
  "Guideline recommendation statements listing the accepted indications for elective freeze-all.",
  "Published progesterone threshold table for premature progesterone elevation, with the assay and day it applies to.",
  "Guideline statements on fresh transfer versus freeze-all after a GnRH agonist trigger.",
];

/* ---------------------------------------------------------------- context */

export interface CycleContextItem {
  id: string;
  label: string;
  value: string;
  available: boolean;
  detail?: string | undefined;
}

const fmt = (v: number | null, unit = "") =>
  v === null ? "Not recorded" : `${v}${unit ? ` ${unit}` : ""}`;

/* --------------------------------------------------------------- progress */

export interface CycleProgress {
  currentDay: number | null;
  visits: number;
  monitoringCompleteness: number;
  latestVisitDay: number | null;
  triggerDayRecorded: number | null;
  currentDose: string;
  currentResponse: string;
  largestFollicle: number | null;
  follicles10: number | null;
  follicles14: number | null;
  follicles17: number | null;
  estradiol: number | null;
  progesterone: number | null;
  lh: number | null;
  endometrium: number | null;
}

/* ------------------------------------------------------- assessment cards */

export type PendingStatus = "pending-evidence" | "data-incomplete" | "data-ready";

export const pendingStatusLabel: Record<PendingStatus, string> = {
  "pending-evidence": "Awaiting evidence activation",
  "data-incomplete": "Data incomplete",
  "data-ready": "Data ready — algorithm locked",
};

export interface AssessmentCard {
  id: string;
  title: string;
  status: PendingStatus;
  headline: string;
  explanation: string;
  /** Entered values the future algorithm will consume. */
  supporting: { label: string; value: string; present: boolean }[];
  missing: string[];
  requiredEvidence: string[];
}

/* ------------------------------------------------------------ OHSS panel */

export interface OhssFactor {
  id: string;
  label: string;
  value: string;
  present: boolean;
  source: "historical" | "current";
}

export interface OhssPanel {
  historical: OhssFactor[];
  current: OhssFactor[];
  documentedMarkers: string[];
  status: string;
  statusDetail: string;
  requiredEvidence: string[];
}

/* ---------------------------------------------------------------- alerts */

export type CycleAlertKind =
  | "rapid-estradiol-rise"
  | "large-follicle-cohort"
  | "incomplete-monitoring"
  | "missing-hormones"
  | "incomplete-ultrasound";

export const cycleAlertLabel: Record<CycleAlertKind, string> = {
  "rapid-estradiol-rise": "Rapid estradiol rise",
  "large-follicle-cohort": "Large follicle cohort",
  "incomplete-monitoring": "Incomplete monitoring",
  "missing-hormones": "Missing hormone values",
  "incomplete-ultrasound": "Incomplete ultrasound",
};

export interface CycleAlert {
  id: string;
  kind: CycleAlertKind;
  label: string;
  observation: string;
  basis: string;
}

/**
 * Descriptive display bands. NOT guideline thresholds, NOT taken from any
 * publication, and never used to decide a trigger, an OHSS grade or a
 * freeze-all. They exist only to surface an entered number.
 */
export const cycleDescriptiveBands = {
  estradiolRiseRatio: 1.8,
  largeCohortFollicles10: 18,
} as const;

export const CYCLE_BAND_DISCLAIMER = DESCRIPTIVE_BAND_DISCLAIMER;

/* --------------------------------------------------------------- summary */

export interface CycleCompletionSummary {
  monitoring: string;
  follicular: string;
  hormone: string;
  safety: string;
  outstanding: string[];
}

export interface CycleConsumerInterface {
  id: string;
  name: string;
  receives: string[];
  status: string;
}

export const cycleConsumerInterfaces: CycleConsumerInterface[] = [
  {
    id: "embryo-transfer",
    name: "Embryo Transfer Planning",
    receives: ["Endometrial thickness series", "Progesterone series", "Freeze-all data surface"],
    status: "Interface prepared — awaiting evidence activation.",
  },
  {
    id: "luteal-support",
    name: "Luteal Support",
    receives: ["Trigger day", "Trigger data surface", "Progesterone series", "Protocol"],
    status: "Interface prepared — awaiting evidence activation.",
  },
  {
    id: "outcome-prediction",
    name: "Outcome Prediction",
    receives: ["Follicular cohort at completion", "Hormone profile", "Phenotype", "Response category"],
    status: "Interface prepared — awaiting evidence activation.",
  },
  {
    id: "report-generator",
    name: "Final Clinical Report",
    receives: ["Cycle completion summary", "Safety summary", "Outstanding information"],
    status: "Section registered in the report structure.",
  },
];

/* ---------------------------------------------------------------- result */

export type SafetyStatus = "no-data" | "assessment-pending" | "review-entered-values";

export const safetyStatusLabel: Record<SafetyStatus, string> = {
  "no-data": "No monitoring visit recorded",
  "assessment-pending": "Safety assessment pending",
  "review-entered-values": "Entered values flagged for physician review",
};

export interface CycleCompletionResult {
  patientId: string;
  patientName: string;
  context: CycleContextItem[];
  progress: CycleProgress;
  safetyStatus: SafetyStatus;
  safetyStatusDetail: string;
  trigger: AssessmentCard;
  freezeAll: AssessmentCard;
  ohss: OhssPanel;
  alerts: CycleAlert[];
  series: MonitoringSeriesPoint[];
  summary: CycleCompletionSummary;
  missingInformation: string[];
  pendingMessage: string;
  evidenceSource: string[];
  computedAt: string;
  version: string;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const present = (label: string, value: string | null, unit = "") => ({
  label,
  value: value === null || value === "" ? "Not recorded" : `${value}${unit}`,
  present: value !== null && value !== "",
});

export function buildCycleCompletion(
  patientId: string,
  patientName: string,
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
  protocol: ProtocolRecommendationResult,
  gonadotropin: GonadotropinSelectionResult,
  consort: StoredConsortDose | null,
  monitoring: MonitoringResult,
): CycleCompletionResult {
  const visits: MonitoringVisit[] = monitoring.visits;
  const latest = visits.length ? visits[visits.length - 1]! : null;
  const s = phenotype.patientSummary;
  const inputs = response.inputs;

  /* -------------------------------------------------------------- context */

  const context: CycleContextItem[] = [
    {
      id: "patient",
      label: "Patient summary",
      value:
        [s.age === null ? null : `${s.age} years`, s.bmi === null ? null : `BMI ${s.bmi}`]
          .filter(Boolean)
          .join(" · ") || "Not recorded",
      available: s.age !== null || s.bmi !== null,
      detail: s.diagnosis.length ? s.diagnosis.join(", ") : undefined,
    },
    {
      id: "protocol",
      label: "Protocol (entered)",
      value: gatedTreatmentValue("protocol-recommendation", protocol.recommendation.recommended)
        ? String(protocol.recommendation.recommended)
        : "Protocol recommendation algorithm: Evidence Pending",
      available: false,
    },
    {
      id: "gonadotropin",
      label: "Gonadotropin in use (entered)",
      value: latest && latest.medication
        ? `${latest.medication} — entered monitoring data, not a recommendation`
        : "Gonadotropin selection algorithm: Evidence Pending",
      available: Boolean(latest?.medication),
      detail: latest?.medication ? HISTORICAL_VALUE_NOTICE : undefined,
    },
    {
      id: "dose",
      label: "Dose in use (entered)",
      value:
        latest && latest.dailyDose !== null
          ? `${latest.dailyDose} IU/day (day ${latest.day}) — entered by the clinician`
          : "Not recorded",
      available: Boolean(latest && latest.dailyDose !== null),
      detail: latest && latest.dailyDose !== null ? HISTORICAL_VALUE_NOTICE : undefined,
    },

    {
      id: "monitoring",
      label: "Monitoring timeline",
      value: visits.length
        ? `${visits.length} visit(s) · latest day ${latest!.day}`
        : "No monitoring visit recorded",
      available: visits.length > 0,
    },
    {
      id: "growth",
      label: "Follicular growth",
      value: monitoring.trends.find((t) => t.id === "largest")?.perDay ?? "—",
      available: visits.length > 1,
      detail: "Arithmetic change between the last two entered measurements.",
    },
    { id: "largest", label: "Largest follicle", value: fmt(latest?.largestFollicle ?? null, "mm"), available: latest?.largestFollicle != null },
    { id: "f10", label: "Follicles ≥ 10 mm", value: fmt(latest?.follicles10 ?? null), available: latest?.follicles10 != null },
    { id: "f14", label: "Follicles ≥ 14 mm", value: fmt(latest?.follicles14 ?? null), available: latest?.follicles14 != null },
    { id: "f17", label: "Follicles ≥ 17 mm", value: fmt(latest?.follicles17 ?? null), available: latest?.follicles17 != null },
    { id: "e2", label: "Estradiol", value: fmt(latest?.estradiol ?? null, " pg/mL"), available: latest?.estradiol != null },
    { id: "lh", label: "LH", value: fmt(latest?.lh ?? null, " IU/L"), available: latest?.lh != null },
    { id: "p4", label: "Progesterone", value: fmt(latest?.progesterone ?? null, " ng/mL"), available: latest?.progesterone != null },
    { id: "endometrium", label: "Endometrium", value: fmt(latest?.endometrium ?? null, " mm"), available: latest?.endometrium != null },
    { id: "poseidon", label: "POSEIDON", value: phenotype.poseidon.groupLabel ?? "Not classified", available: true },
    { id: "bologna", label: "Bologna", value: phenotype.bologna.headline, available: true },
    {
      id: "expected-response",
      label: "Expected response",
      value: responseCategoryLabel[response.category],
      available: response.category !== "unable",
    },
  ];

  /* ------------------------------------------------------------- progress */

  const progress: CycleProgress = {
    currentDay: latest?.day ?? null,
    visits: visits.length,
    monitoringCompleteness: monitoring.completeness.percent,
    latestVisitDay: latest?.day ?? null,
    triggerDayRecorded: visits.find((v) => v.triggerDay)?.day ?? null,
    currentDose:
      latest && latest.dailyDose !== null
        ? `${latest.dailyDose} IU/day (entered by the clinician — not a recommendation)`
        : "Not recorded",

    currentResponse: responseCategoryLabel[response.category],
    largestFollicle: latest?.largestFollicle ?? null,
    follicles10: latest?.follicles10 ?? null,
    follicles14: latest?.follicles14 ?? null,
    follicles17: latest?.follicles17 ?? null,
    estradiol: latest?.estradiol ?? null,
    progesterone: latest?.progesterone ?? null,
    lh: latest?.lh ?? null,
    endometrium: latest?.endometrium ?? null,
  };

  /* --------------------------------------------------------------- alerts */

  const alerts: CycleAlert[] = [];

  const e2Points = visits
    .map((v) => ({ day: v.day, value: v.estradiol }))
    .filter((p): p is { day: number; value: number } => p.value !== null && p.value > 0);
  if (e2Points.length >= 2) {
    const a = e2Points[e2Points.length - 2]!;
    const b = e2Points[e2Points.length - 1]!;
    const ratio = round(b.value / a.value);
    if (ratio >= cycleDescriptiveBands.estradiolRiseRatio) {
      alerts.push({
        id: "e2-rise",
        kind: "rapid-estradiol-rise",
        label: cycleAlertLabel["rapid-estradiol-rise"],
        observation: `Estradiol changed from ${a.value} pg/mL (day ${a.day}) to ${b.value} pg/mL (day ${b.day}) — a factor of ${ratio}.`,
        basis: `Descriptive band ≥ ${cycleDescriptiveBands.estradiolRiseRatio}× between consecutive entries. ${CYCLE_BAND_DISCLAIMER}`,
      });
    }
  }

  if (latest && latest.follicles10 !== null && latest.follicles10 >= cycleDescriptiveBands.largeCohortFollicles10) {
    alerts.push({
      id: "cohort",
      kind: "large-follicle-cohort",
      label: cycleAlertLabel["large-follicle-cohort"],
      observation: `${latest.follicles10} follicles ≥ 10 mm recorded on stimulation day ${latest.day}.`,
      basis: `Descriptive band ≥ ${cycleDescriptiveBands.largeCohortFollicles10} follicles. ${CYCLE_BAND_DISCLAIMER}`,
    });
  }

  if (!visits.length) {
    alerts.push({
      id: "no-visits",
      kind: "incomplete-monitoring",
      label: cycleAlertLabel["incomplete-monitoring"],
      observation: "No monitoring visit has been recorded for this patient.",
      basis: "Data completeness check on the monitoring timeline.",
    });
  } else if (monitoring.completeness.percent < 100) {
    alerts.push({
      id: "incomplete",
      kind: "incomplete-monitoring",
      label: cycleAlertLabel["incomplete-monitoring"],
      observation: `Monitoring completeness is ${monitoring.completeness.percent}% across ${visits.length} visit(s).`,
      basis: "Data completeness check on the entered visits.",
    });
  }

  if (latest) {
    const missingHormones = [
      latest.estradiol === null ? "estradiol" : null,
      latest.progesterone === null ? "progesterone" : null,
      latest.lh === null ? "LH" : null,
    ].filter(Boolean) as string[];
    if (missingHormones.length) {
      alerts.push({
        id: "hormones",
        kind: "missing-hormones",
        label: cycleAlertLabel["missing-hormones"],
        observation: `Day ${latest.day} has no recorded ${missingHormones.join(", ")}.`,
        basis: "Data completeness check on the latest visit.",
      });
    }
    const missingUs = [
      latest.largestFollicle === null ? "largest follicle" : null,
      latest.follicles14 === null ? "follicles ≥ 14 mm" : null,
      latest.follicles17 === null ? "follicles ≥ 17 mm" : null,
      latest.endometrium === null ? "endometrial thickness" : null,
    ].filter(Boolean) as string[];
    if (missingUs.length) {
      alerts.push({
        id: "ultrasound",
        kind: "incomplete-ultrasound",
        label: cycleAlertLabel["incomplete-ultrasound"],
        observation: `Day ${latest.day} has no recorded ${missingUs.join(", ")}.`,
        basis: "Data completeness check on the latest visit.",
      });
    }
  }

  /* ------------------------------------------------------- trigger card */

  const triggerSupporting = [
    present("Largest follicle", latest?.largestFollicle != null ? String(latest.largestFollicle) : null, " mm"),
    present("Follicles ≥ 14 mm", latest?.follicles14 != null ? String(latest.follicles14) : null),
    present("Follicles ≥ 17 mm", latest?.follicles17 != null ? String(latest.follicles17) : null),
    present("Estradiol", latest?.estradiol != null ? String(latest.estradiol) : null, " pg/mL"),
    present("LH", latest?.lh != null ? String(latest.lh) : null, " IU/L"),
    present("Progesterone", latest?.progesterone != null ? String(latest.progesterone) : null, " ng/mL"),
    present("Endometrium", latest?.endometrium != null ? String(latest.endometrium) : null, " mm"),
    present(
      "Protocol",
      protocol.recommendation.recommended ? String(protocol.recommendation.recommended) : null,
    ),
  ];
  const triggerMissing = triggerSupporting.filter((v) => !v.present).map((v) => v.label);

  const trigger: AssessmentCard = {
    id: "trigger",
    title: "Trigger readiness",
    status: !visits.length || triggerMissing.length ? "data-incomplete" : "data-ready",
    headline: !visits.length
      ? "No monitoring data — assessment pending"
      : triggerMissing.length
        ? "Assessment pending — required variables incomplete"
        : "Variables collected — algorithm locked",
    explanation:
      "Trigger readiness is not evaluated. No trigger criterion is implemented, and no trigger agent, hCG, GnRH agonist or dual trigger is recommended. The card lists which entered variables a future validated trigger algorithm will read once the ESHRE/ASRM trigger statements and tables are transcribed into the Evidence Library.",
    supporting: triggerSupporting,
    missing: triggerMissing,
    requiredEvidence: TRIGGER_REQUIRED_EVIDENCE,
  };

  /* ----------------------------------------------------- freeze-all card */

  const freezeSupporting = [
    present("Progesterone (latest)", latest?.progesterone != null ? String(latest.progesterone) : null, " ng/mL"),
    present("Estradiol (latest)", latest?.estradiol != null ? String(latest.estradiol) : null, " pg/mL"),
    present("Follicles ≥ 10 mm", latest?.follicles10 != null ? String(latest.follicles10) : null),
    present("Endometrial thickness", latest?.endometrium != null ? String(latest.endometrium) : null, " mm"),
    present("PCOS documented", inputs.pcos ? "Yes" : null),
    present("Previous OHSS", inputs.ohssHistory),
    present("AMH", inputs.amh != null ? String(inputs.amh) : null, " ng/mL"),
    present("AFC", inputs.afc != null ? String(inputs.afc) : null),
  ];
  const freezeMissing = freezeSupporting.filter((v) => !v.present).map((v) => v.label);

  const freezeAll: AssessmentCard = {
    id: "freeze-all",
    title: "Freeze-all assessment",
    status: "pending-evidence",
    headline: "Assessment pending — no freeze-all indication is implemented",
    explanation:
      "No freeze-all indication, progesterone cut-off or fresh-transfer decision is implemented. Neither freeze-all nor fresh embryo transfer is recommended. The variables below are collected so a future validated algorithm can be applied without changing the application architecture.",
    supporting: freezeSupporting,
    missing: freezeMissing,
    requiredEvidence: FREEZE_ALL_REQUIRED_EVIDENCE,
  };

  /* ----------------------------------------------------------- OHSS panel */

  const historical: OhssFactor[] = [
    {
      id: "previous-ohss",
      label: "Previous OHSS",
      value: inputs.ohssHistory ?? "Not recorded",
      present: Boolean(inputs.ohssHistory && !/^no$/i.test(inputs.ohssHistory)),
      source: "historical",
    },
    { id: "pcos", label: "PCOS", value: inputs.pcos ? "Documented" : "Not documented", present: inputs.pcos, source: "historical" },
    { id: "amh", label: "AMH", value: fmt(inputs.amh, " ng/mL"), present: inputs.amh !== null, source: "historical" },
    { id: "afc", label: "AFC", value: fmt(inputs.afc, " follicles"), present: inputs.afc !== null, source: "historical" },
    { id: "age", label: "Age", value: fmt(inputs.age, " years"), present: inputs.age !== null, source: "historical" },
    {
      id: "hyper-history",
      label: "Previous hyper-response",
      value: inputs.hyperResponseHistory ? "Recorded in cycle history" : "Not recorded",
      present: inputs.hyperResponseHistory,
      source: "historical",
    },
  ];

  const current: OhssFactor[] = [
    { id: "e2-current", label: "Estradiol (latest visit)", value: fmt(latest?.estradiol ?? null, " pg/mL"), present: latest?.estradiol != null, source: "current" },
    { id: "f10-current", label: "Follicles ≥ 10 mm", value: fmt(latest?.follicles10 ?? null), present: latest?.follicles10 != null, source: "current" },
    { id: "f14-current", label: "Follicles ≥ 14 mm", value: fmt(latest?.follicles14 ?? null), present: latest?.follicles14 != null, source: "current" },
    { id: "count-current", label: "Total follicle count", value: fmt(latest?.follicleCount ?? null), present: latest?.follicleCount != null, source: "current" },
    { id: "trend-e2", label: "Estradiol trend", value: monitoring.trends.find((t) => t.id === "e2")?.perDay ?? "—", present: e2Points.length > 1, source: "current" },
  ];

  const documentedMarkers = [...historical, ...current].filter((f) => f.present).map((f) => f.label);

  const ohss: OhssPanel = {
    historical,
    current,
    documentedMarkers,
    status: "Evidence algorithm pending",
    statusDetail:
      "No OHSS cut-off, risk score or severity grade is implemented. The factors below are documented markers only — the ASRM/ESHRE threshold tables must be imported before any OHSS risk statement can be produced.",
    requiredEvidence: OHSS_REQUIRED_EVIDENCE,
  };

  /* -------------------------------------------------------- safety status */

  const safetyStatus: SafetyStatus = !visits.length
    ? "no-data"
    : alerts.some((a) => a.kind === "rapid-estradiol-rise" || a.kind === "large-follicle-cohort")
      ? "review-entered-values"
      : "assessment-pending";

  const safetyStatusDetail =
    safetyStatus === "no-data"
      ? "Record a monitoring visit to populate the safety data surface."
      : safetyStatus === "review-entered-values"
        ? "One or more entered values fell inside a descriptive display band and are surfaced for physician review. This is not a risk classification."
        : "Entered data is organised. No safety classification is produced because the evidence tables are not loaded.";

  /* --------------------------------------------------------------- summary */

  const missingInformation = Array.from(
    new Set([
      ...triggerMissing.map((m) => `Trigger data surface: ${m}`),
      ...freezeMissing.map((m) => `Freeze-all data surface: ${m}`),
      ...monitoring.completeness.missingByVisit
        .filter((m) => m.missing.length)
        .map((m) => `Day ${m.day}: ${m.missing.join(", ")}`),
      ...phenotype.missing.map((m) => m.label),
    ]),
  );

  const summary: CycleCompletionSummary = {
    monitoring: visits.length
      ? `${visits.length} visit(s) recorded, latest stimulation day ${latest!.day}, monitoring completeness ${monitoring.completeness.percent}%.${
          progress.triggerDayRecorded ? ` Trigger day marked on day ${progress.triggerDayRecorded}.` : ""
        }`
      : "No monitoring visit recorded.",
    follicular: latest
      ? `Largest follicle ${fmt(latest.largestFollicle, " mm")} · ≥10 mm ${fmt(latest.follicles10)} · ≥14 mm ${fmt(latest.follicles14)} · ≥17 mm ${fmt(latest.follicles17)} · total ${fmt(latest.follicleCount)}.`
      : "No ultrasound recorded.",
    hormone: latest
      ? `E2 ${fmt(latest.estradiol, " pg/mL")} · P4 ${fmt(latest.progesterone, " ng/mL")} · LH ${fmt(latest.lh, " IU/L")} · endometrium ${fmt(latest.endometrium, " mm")}.`
      : "No hormone value recorded.",
    safety: `${safetyStatusLabel[safetyStatus]}. Documented OHSS markers: ${
      documentedMarkers.length ? documentedMarkers.join(", ") : "none"
    }. Trigger, OHSS and freeze-all algorithms are locked.`,
    outstanding: missingInformation,
  };

  return {
    patientId,
    patientName,
    context,
    progress,
    safetyStatus,
    safetyStatusDetail,
    trigger,
    freezeAll,
    ohss,
    alerts,
    series: monitoring.series,
    summary,
    missingInformation,
    pendingMessage: CYCLE_COMPLETION_PENDING_MESSAGE,
    evidenceSource: cycleCompletionEvidenceIds,
    computedAt: new Date().toISOString(),
    version: CYCLE_COMPLETION_VERSION,
  };
}

/* ---------------------------------------------------------------- report */

export function cycleCompletionReportText(r: CycleCompletionResult): string {
  const lines: string[] = [
    "CYCLE COMPLETION & SAFETY REPORT",
    `Patient: ${r.patientName}`,
    `Generated: ${new Date(r.computedAt).toLocaleString()}`,
    `Engine version: ${r.version}`,
    "",
    "CYCLE CONTEXT",
    ...r.context.map((c) => `  ${c.label}: ${c.value}`),
    "",
    "MONITORING SUMMARY",
    `  ${r.summary.monitoring}`,
    "",
    "FOLLICULAR SUMMARY",
    `  ${r.summary.follicular}`,
    "",
    "HORMONE SUMMARY",
    `  ${r.summary.hormone}`,
    "",
    "SAFETY SUMMARY",
    `  ${r.summary.safety}`,
    `  ${r.safetyStatusDetail}`,
    "",
    "TRIGGER READINESS",
    `  ${r.trigger.headline}`,
    `  ${r.trigger.explanation}`,
    ...r.trigger.supporting.map((v) => `    ${v.label}: ${v.value}`),
    "",
    "OHSS PANEL",
    `  ${r.ohss.status} — ${r.ohss.statusDetail}`,
    "  Historical factors:",
    ...r.ohss.historical.map((f) => `    ${f.label}: ${f.value}`),
    "  Current monitoring:",
    ...r.ohss.current.map((f) => `    ${f.label}: ${f.value}`),
    "",
    "FREEZE-ALL PANEL",
    `  ${r.freezeAll.headline}`,
    `  ${r.freezeAll.explanation}`,
    ...r.freezeAll.supporting.map((v) => `    ${v.label}: ${v.value}`),
    "",
    "INFORMATIONAL ALERTS",
  ];

  if (!r.alerts.length) lines.push("  None.");
  else for (const a of r.alerts) lines.push(`  ${a.label}: ${a.observation} (${a.basis})`);

  lines.push(
    "",
    "OUTSTANDING INFORMATION",
    ...(r.missingInformation.length ? r.missingInformation.map((m) => `  - ${m}`) : ["  None."]),
    "",
    "EVIDENCE STATUS",
    `  ${r.pendingMessage}`,
    ...r.evidenceSource.map((id) => `  Reference: ${id}`),
    "",
    "REQUIRED TO ACTIVATE TRIGGER STRATEGY",
    ...TRIGGER_REQUIRED_EVIDENCE.map((x) => `  - ${x}`),
    "",
    "REQUIRED TO ACTIVATE OHSS RISK",
    ...OHSS_REQUIRED_EVIDENCE.map((x) => `  - ${x}`),
    "",
    "REQUIRED TO ACTIVATE FREEZE-ALL",
    ...FREEZE_ALL_REQUIRED_EVIDENCE.map((x) => `  - ${x}`),
  );

  return lines.join("\n");
}
