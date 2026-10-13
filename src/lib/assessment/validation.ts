/**
 * Advanced data-quality validation.
 *
 * Detects missing mandatory data, duplicated cycle entries, internally
 * conflicting answers and physiologically impossible values. It reports data
 * quality only — never a diagnosis, prognosis or treatment implication.
 */

import type { CycleRecord, FieldValue } from "./use-assessment";
import { toNum } from "./derived";

export type IssueSeverity = "error" | "conflict" | "duplicate" | "missing";

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  stepId: string;
  fields: string[];
}

export const severityLabels: Record<IssueSeverity, string> = {
  error: "Impossible value",
  conflict: "Conflicting entry",
  duplicate: "Duplicate entry",
  missing: "Mandatory data missing",
};

const filled = (v: FieldValue) =>
  Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";

/** Fields required before any future clinical module can run. */
const mandatory: { key: string; label: string; stepId: string }[] = [
  { key: "fullName", label: "Patient name", stepId: "patient" },
  { key: "dob", label: "Date of birth", stepId: "patient" },
  { key: "height", label: "Height", stepId: "patient" },
  { key: "weight", label: "Weight", stepId: "patient" },
  { key: "infertilityDuration", label: "Duration of infertility", stepId: "reproductive" },
  { key: "infertilityType", label: "Type of infertility", stepId: "reproductive" },
  { key: "amh", label: "AMH", stepId: "reserve" },
  { key: "afcLeft", label: "AFC (left ovary)", stepId: "reserve" },
  { key: "afcRight", label: "AFC (right ovary)", stepId: "reserve" },
];

/** Physiologically implausible ranges — data-entry protection only. */
const plausible: { key: string; label: string; min: number; max: number; unit: string; stepId: string }[] = [
  { key: "height", label: "Height", min: 120, max: 220, unit: "cm", stepId: "patient" },
  { key: "weight", label: "Weight", min: 30, max: 250, unit: "kg", stepId: "patient" },
  { key: "partnerAge", label: "Partner age", min: 16, max: 90, unit: "years", stepId: "patient" },
  { key: "amh", label: "AMH", min: 0, max: 30, unit: "ng/mL", stepId: "reserve" },
  { key: "fsh", label: "Basal FSH", min: 0, max: 100, unit: "IU/L", stepId: "reserve" },
  { key: "lh", label: "Basal LH", min: 0, max: 100, unit: "IU/L", stepId: "reserve" },
  { key: "afcLeft", label: "AFC (left)", min: 0, max: 60, unit: "follicles", stepId: "reserve" },
  { key: "afcRight", label: "AFC (right)", min: 0, max: 60, unit: "follicles", stepId: "reserve" },
  { key: "endometrium", label: "Endometrial thickness", min: 1, max: 30, unit: "mm", stepId: "ultrasound" },
  { key: "semenVolume", label: "Semen volume", min: 0, max: 15, unit: "mL", stepId: "male" },
  { key: "concentration", label: "Sperm concentration", min: 0, max: 400, unit: "M/mL", stepId: "male" },
  { key: "progressiveMotility", label: "Progressive motility", min: 0, max: 100, unit: "%", stepId: "male" },
  { key: "totalMotility", label: "Total motility", min: 0, max: 100, unit: "%", stepId: "male" },
  { key: "morphology", label: "Normal morphology", min: 0, max: 100, unit: "%", stepId: "male" },
  { key: "dnaFragmentation", label: "DNA fragmentation", min: 0, max: 100, unit: "%", stepId: "male" },
  { key: "infertilityDuration", label: "Duration of infertility", min: 0, max: 480, unit: "months", stepId: "reproductive" },
];

export function validateAssessment(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue) => issues.push(i);

  mandatory.forEach((m) => {
    if (!filled(values[m.key])) {
      push({
        id: `mandatory-${m.key}`,
        severity: "missing",
        title: `${m.label} is required`,
        detail: "This field is required before the record can be considered complete.",
        stepId: m.stepId,
        fields: [m.key],
      });
    }
  });

  plausible.forEach((p) => {
    const v = toNum(values[p.key]);
    if (v === null) return;
    if (v < p.min || v > p.max) {
      push({
        id: `range-${p.key}`,
        severity: "error",
        title: `${p.label} is outside a possible range`,
        detail: `Entered ${v} ${p.unit}. Expected between ${p.min} and ${p.max} ${p.unit}.`,
        stepId: p.stepId,
        fields: [p.key],
      });
    }
  });

  // date of birth in the future / implausible
  const dob = values["dob"];
  if (typeof dob === "string" && dob) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) {
      const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (years < 0) {
        push({
          id: "dob-future",
          severity: "error",
          title: "Date of birth is in the future",
          detail: "Please correct the date of birth.",
          stepId: "patient",
          fields: ["dob"],
        });
      } else if (years < 16 || years > 70) {
        push({
          id: "dob-range",
          severity: "error",
          title: "Date of birth gives an implausible age",
          detail: `Derived age is ${Math.floor(years)} years.`,
          stepId: "patient",
          fields: ["dob"],
        });
      }
    }
  }

  // motility coherence
  const prog = toNum(values["progressiveMotility"]);
  const total = toNum(values["totalMotility"]);
  if (prog !== null && total !== null && prog > total) {
    push({
      id: "conflict-motility",
      severity: "conflict",
      title: "Progressive motility exceeds total motility",
      detail: `Progressive ${prog}% cannot be higher than total ${total}%.`,
      stepId: "male",
      fields: ["progressiveMotility", "totalMotility"],
    });
  }

  // obstetric coherence
  const gravidity = toNum(values["gravidity"]);
  const births = toNum(values["liveBirth"]) ?? 0;
  const abortions = toNum(values["abortions"]) ?? 0;
  const ectopic = toNum(values["ectopic"]) ?? 0;
  if (gravidity !== null && births + abortions + ectopic > gravidity) {
    push({
      id: "conflict-gravidity",
      severity: "conflict",
      title: "Obstetric history does not add up",
      detail: `Live births, miscarriages and ectopic pregnancies total ${
        births + abortions + ectopic
      }, which is more than the recorded ${gravidity} pregnancies.`,
      stepId: "reproductive",
      fields: ["gravidity", "liveBirth", "abortions", "ectopic"],
    });
  }

  // primary infertility with prior pregnancies
  if (String(values["infertilityType"] ?? "") === "Primary" && (gravidity ?? 0) > 0) {
    push({
      id: "conflict-primary",
      severity: "conflict",
      title: "Primary infertility recorded with previous pregnancies",
      detail: `Infertility type is Primary but ${gravidity} pregnancies are recorded.`,
      stepId: "reproductive",
      fields: ["infertilityType", "gravidity"],
    });
  }

  // previous cycles flag vs cycle records
  const hasPrev = String(values["hasPreviousCycles"] ?? "");
  if (hasPrev === "No" && cycles.length > 0) {
    push({
      id: "conflict-cycles-flag",
      severity: "conflict",
      title: "Previous cycles recorded but marked as none",
      detail: `${cycles.length} cycle record${cycles.length === 1 ? "" : "s"} exist while "previous cycles" is set to No.`,
      stepId: "cycles",
      fields: ["hasPreviousCycles"],
    });
  }
  if (hasPrev === "Yes" && cycles.length === 0) {
    push({
      id: "missing-cycles",
      severity: "missing",
      title: "Previous cycles indicated but not detailed",
      detail: "Add at least one cycle card so previous response data can be mapped.",
      stepId: "cycles",
      fields: ["hasPreviousCycles"],
    });
  }

  // per-cycle checks
  const seen = new Map<string, number>();
  cycles.forEach((c, index) => {
    const label = `Cycle ${c["cycleNumber"] ?? index + 1}`;
    const key = [c["cycleNumber"], c["cycleDate"] ?? c["cycleYear"], c["clinic"]]
      .map((x) => String(x ?? ""))
      .join("|");
    if (key.replace(/\|/g, "").trim()) {
      const prev = seen.get(key);
      if (prev !== undefined) {
        push({
          id: `dup-cycle-${c.id}`,
          severity: "duplicate",
          title: `${label} looks like a duplicate`,
          detail: `Same cycle number, date and clinic as cycle ${prev + 1}.`,
          stepId: "cycles",
          fields: ["cycleNumber", "cycleDate", "clinic"],
        });
      } else {
        seen.set(key, index);
      }
    }

    const retrieved = toNum(c["retrieved"]);
    const mii = toNum(c["mii"]);
    const fertilized = toNum(c["fertilized"]);
    const blast = toNum(c["blastocysts"]);
    const transferred = toNum(c["transferred"]);
    const frozen = toNum(c["frozen"]);

    const chain: [string, number | null, string, number | null][] = [
      ["MII", mii, "retrieved oocytes", retrieved],
      ["Fertilized", fertilized, "MII oocytes", mii],
      ["Blastocysts", blast, "fertilized oocytes", fertilized],
    ];
    chain.forEach(([childLabel, child, parentLabel, parent]) => {
      if (child !== null && parent !== null && child > parent) {
        push({
          id: `conflict-${c.id}-${childLabel}`,
          severity: "conflict",
          title: `${label}: ${childLabel} exceeds ${parentLabel}`,
          detail: `${childLabel} ${child} cannot be greater than ${parentLabel} ${parent}.`,
          stepId: "cycles",
          fields: ["retrieved", "mii", "fertilized", "blastocysts"],
        });
      }
    });

    if (blast !== null && transferred !== null && frozen !== null && transferred + frozen > blast) {
      push({
        id: `conflict-${c.id}-embryos`,
        severity: "conflict",
        title: `${label}: transferred plus frozen exceeds blastocysts`,
        detail: `${transferred} transferred and ${frozen} frozen exceed ${blast} blastocysts.`,
        stepId: "cycles",
        fields: ["transferred", "frozen", "blastocysts"],
      });
    }
    if (retrieved !== null && (retrieved < 0 || retrieved > 80)) {
      push({
        id: `range-${c.id}-retrieved`,
        severity: "error",
        title: `${label}: implausible oocyte count`,
        detail: `Retrieved ${retrieved} oocytes.`,
        stepId: "cycles",
        fields: ["retrieved"],
      });
    }
    if (String(c["liveBirth"] ?? "") === "Yes" && String(c["clinicalPregnancy"] ?? "") === "No") {
      push({
        id: `conflict-${c.id}-outcome`,
        severity: "conflict",
        title: `${label}: live birth without clinical pregnancy`,
        detail: "Outcome fields contradict each other.",
        stepId: "cycles",
        fields: ["liveBirth", "clinicalPregnancy"],
      });
    }
  });

  return issues;
}

export const severityTone: Record<IssueSeverity, string> = {
  error: "border-destructive/25 bg-destructive/10 text-destructive",
  conflict: "border-warning/25 bg-warning-soft text-warning",
  duplicate: "border-primary/25 bg-primary-soft text-primary",
  missing: "border-border bg-muted text-muted-foreground",
};
