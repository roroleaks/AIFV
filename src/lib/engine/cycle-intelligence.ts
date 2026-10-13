/**
 * Previous-Cycle Intelligence Engine (Version 1).
 *
 * Compares the previous IVF/ICSI cycles that the physician has entered and
 * restates them as descriptive observations: recorded values, arithmetic
 * differences between cycles and a side-by-side "expected vs observed"
 * data surface.
 *
 * This module applies NO clinical threshold, generates NO recommendation and
 * makes NO judgement about whether a response was appropriate. Any statement
 * it produces is a direct restatement of entered data or a simple arithmetic
 * difference, and is labelled as such.
 */

import {
  cycleFieldGroups,
  cycleFields,
  cycleGroupFields,
  type FieldDef,
} from "@/lib/assessment/schema";
import { toNum } from "@/lib/assessment/derived";
import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { responseCategoryLabel, type OvarianResponseResult } from "./ovarian-response";

export const CYCLE_INTELLIGENCE_VERSION = "1.0.0";

export const NOT_PROVIDED = "Not provided";

export const cycleIntelligenceEvidenceIds = [
  "eshre-2025-ovarian-stimulation-update",
  "eshre-2020-ovarian-stimulation",
];

/** Descriptive observation vs validated recommendation — always explicit. */
export const DESCRIPTIVE_NOTE =
  "Every statement in this section is a descriptive restatement of the data entered by the physician or a simple arithmetic difference between cycles. No validated clinical recommendation, interpretation or treatment change is generated.";

export const EXPECTED_OBSERVED_PENDING =
  "No validated expected-yield table has been imported, so the application does not judge whether the observed yield agrees with the expected response category. Expected and observed values are displayed side by side for physician interpretation only.";

/* ------------------------------------------------------------------ types */

export interface CycleFieldView {
  key: string;
  label: string;
  value: string;
  present: boolean;
}

export interface CycleGroupView {
  id: string;
  title: string;
  fields: CycleFieldView[];
  recorded: number;
  total: number;
}

export type CycleIssueLevel = "range" | "contradiction" | "incomplete";

export interface CycleIssue {
  id: string;
  cycleId: string;
  cycleLabel: string;
  level: CycleIssueLevel;
  field: string;
  message: string;
}

export interface CycleView {
  id: string;
  index: number;
  label: string;
  groups: CycleGroupView[];
  recorded: number;
  total: number;
  percent: number;
  missing: string[];
  issues: CycleIssue[];
  outcome: string;
}

export interface CycleTrend {
  id: string;
  label: string;
  unit: string;
  values: string[];
  first: number | null;
  last: number | null;
  change: string;
  direction: "increase" | "decrease" | "unchanged" | "not-assessable";
  observation: string;
}

export interface CycleOutcomeRow {
  id: string;
  label: string;
  values: string[];
}

export interface ExpectedObserved {
  expectedCategory: string;
  expectedBasis: string[];
  observedRows: {
    label: string;
    retrieved: string;
    mii: string;
    fertilized: string;
    blastocysts: string;
    pregnancy: string;
  }[];
  observedSummary: string[];
  bestRetrieved: number | null;
  lastRetrieved: number | null;
  statements: string[];
  missing: string[];
  pendingNote: string;
}

export interface CycleIntelligenceResult {
  version: string;
  cycleCount: number;
  cycles: CycleView[];
  trends: CycleTrend[];
  outcomes: CycleOutcomeRow[];
  expectedObserved: ExpectedObserved;
  issues: CycleIssue[];
  missing: string[];
  evidence: string[];
  descriptiveNote: string;
}

/* ------------------------------------------------------------- formatting */

const isFilled = (v: FieldValue): boolean =>
  Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";

/** "Not provided" is deliberately distinct from a recorded answer of "No". */
export function cycleFieldValue(field: FieldDef, cycle: CycleRecord): string {
  if (field.type === "derived" && field.compute) {
    const computed = field.compute(cycle as Record<string, unknown>);
    return computed ? computed : NOT_PROVIDED;
  }
  const raw = cycle[field.key];
  if (!isFilled(raw)) return NOT_PROVIDED;
  const text = Array.isArray(raw) ? raw.join(", ") : String(raw);
  return field.unit ? `${text} ${field.unit}` : text;
}

const num = (cycle: CycleRecord, key: string) => toNum(cycle[key]);
const str = (cycle: CycleRecord, key: string) => {
  const raw = cycle[key];
  return isFilled(raw) ? String(raw) : "";
};

function cycleLabel(cycle: CycleRecord, index: number): string {
  const n = num(cycle, "cycleNumber") ?? index + 1;
  const year =
    str(cycle, "cycleYear") || (str(cycle, "cycleDate") ? str(cycle, "cycleDate").slice(0, 4) : "");
  const type = str(cycle, "cycleType");
  return `Cycle ${n}${year ? ` (${year})` : ""}${type ? ` · ${type}` : ""}`;
}

function outcomeLabel(cycle: CycleRecord): string {
  if (str(cycle, "liveBirth") === "Yes") return "Live birth";
  if (str(cycle, "miscarriage") === "Yes") return "Miscarriage";
  if (str(cycle, "clinicalPregnancy") === "Yes") return "Clinical pregnancy";
  if (str(cycle, "biochemicalPregnancy") === "Yes") return "Biochemical pregnancy";
  if (str(cycle, "cancelled") === "Yes") return "Cycle cancelled";
  if (str(cycle, "clinicalPregnancy") === "No") return "No pregnancy";
  return NOT_PROVIDED;
}

/* ------------------------------------------------------------ validation */

interface Comparison {
  a: string;
  b: string;
  message: string;
}

/** Arithmetic impossibilities only — never a clinical judgement. */
const COMPARISONS: Comparison[] = [
  {
    a: "mii",
    b: "retrieved",
    message: "Mature (MII) oocytes cannot exceed the number of oocytes retrieved.",
  },
  {
    a: "fertilized",
    b: "mii",
    message: "Fertilized oocytes cannot exceed the number of mature (MII) oocytes.",
  },
  {
    a: "twoPn",
    b: "fertilized",
    message: "2PN zygotes cannot exceed the number of fertilized oocytes.",
  },
  {
    a: "blastocysts",
    b: "fertilized",
    message: "Blastocysts cannot exceed the number of fertilized oocytes.",
  },
  {
    a: "day3",
    b: "fertilized",
    message: "Day 3 embryos cannot exceed the number of fertilized oocytes.",
  },
  {
    a: "follicles17",
    b: "folliclesTotal",
    message: "Follicles ≥ 17 mm cannot exceed the total follicle count.",
  },
  {
    a: "follicles14",
    b: "folliclesTotal",
    message: "Follicles ≥ 14 mm cannot exceed the total follicle count.",
  },
  {
    a: "follicles17",
    b: "follicles14",
    message: "Follicles ≥ 17 mm cannot exceed follicles ≥ 14 mm.",
  },
  {
    a: "startingDose",
    b: "maxDose",
    message: "The starting dose cannot exceed the recorded maximum daily dose.",
  },
];

export function validateCycle(cycle: CycleRecord, index: number): CycleIssue[] {
  const label = cycleLabel(cycle, index);
  const issues: CycleIssue[] = [];
  const push = (level: CycleIssueLevel, field: string, message: string) =>
    issues.push({
      id: `${cycle.id}-${field}-${issues.length}`,
      cycleId: cycle.id,
      cycleLabel: label,
      level,
      field,
      message,
    });

  // numeric range and unit plausibility, taken from the declared field limits
  for (const field of cycleFields) {
    if (field.type !== "number") continue;
    const value = num(cycle, field.key);
    if (value === null) continue;
    if (field.min !== undefined && value < field.min)
      push(
        "range",
        field.label,
        `${field.label} is ${value}${field.unit ? ` ${field.unit}` : ""}, below the plausible minimum of ${field.min}${field.unit ? ` ${field.unit}` : ""}.`,
      );
    if (field.max !== undefined && value > field.max)
      push(
        "range",
        field.label,
        `${field.label} is ${value}${field.unit ? ` ${field.unit}` : ""}, above the plausible maximum of ${field.max}${field.unit ? ` ${field.unit}` : ""}.`,
      );
    if (value < 0) push("range", field.label, `${field.label} cannot be negative.`);
  }

  for (const c of COMPARISONS) {
    const a = num(cycle, c.a);
    const b = num(cycle, c.b);
    if (a === null || b === null) continue;
    if (a > b) push("contradiction", c.a, c.message);
  }

  const retrieved = num(cycle, "retrieved");
  const total = num(cycle, "totalDose");
  const start = num(cycle, "startingDose");
  const days = num(cycle, "duration");
  if (total !== null && start !== null && days !== null && total < start) {
    push(
      "contradiction",
      "totalDose",
      "Total gonadotropin exposure is lower than a single starting dose; review the recorded units.",
    );
  }
  if (str(cycle, "cancelled") === "Yes" && retrieved !== null && retrieved > 0) {
    push(
      "contradiction",
      "cancelled",
      "The cycle is recorded as cancelled but oocytes were retrieved.",
    );
  }
  if (str(cycle, "liveBirth") === "Yes" && str(cycle, "clinicalPregnancy") === "No") {
    push(
      "contradiction",
      "liveBirth",
      "A live birth is recorded while clinical pregnancy is recorded as No.",
    );
  }
  if (str(cycle, "liveBirth") === "Yes" && str(cycle, "miscarriage") === "Yes") {
    push(
      "contradiction",
      "liveBirth",
      "Both a live birth and a miscarriage are recorded for the same cycle.",
    );
  }
  if (
    str(cycle, "clinicalPregnancy") === "Yes" &&
    str(cycle, "transferType") === "Freeze-all — no transfer"
  ) {
    push(
      "contradiction",
      "clinicalPregnancy",
      "A clinical pregnancy is recorded although the cycle is marked as freeze-all with no transfer.",
    );
  }
  if (
    str(cycle, "pgtPerformed") !== "" &&
    str(cycle, "pgtPerformed") !== "No" &&
    !str(cycle, "pgtResult")
  ) {
    push("incomplete", "pgtResult", "PGT is recorded as performed but no PGT result is entered.");
  }
  if (str(cycle, "cancelled") === "Yes" && !str(cycle, "cancellationReason")) {
    push(
      "incomplete",
      "cancellationReason",
      "The cycle is recorded as cancelled but no reason is documented.",
    );
  }
  return issues;
}

/* ---------------------------------------------------------------- trends */

interface TrendDef {
  id: string;
  label: string;
  unit: string;
  key: string;
  /** true when a higher value simply means "more", used for wording only */
  countLike?: boolean;
}

const TRENDS: TrendDef[] = [
  { id: "startingDose", label: "Starting gonadotropin dose", unit: "IU/day", key: "startingDose" },
  { id: "maxDose", label: "Maximum daily dose", unit: "IU/day", key: "maxDose" },
  { id: "totalDose", label: "Total gonadotropin exposure", unit: "IU", key: "totalDose" },
  { id: "duration", label: "Stimulation duration", unit: "days", key: "duration" },
  { id: "peakE2", label: "Peak estradiol", unit: "pg/mL", key: "peakE2" },
  {
    id: "folliclesTotal",
    label: "Follicles at trigger",
    unit: "",
    key: "folliclesTotal",
    countLike: true,
  },
  { id: "retrieved", label: "Oocytes retrieved", unit: "", key: "retrieved", countLike: true },
  { id: "mii", label: "Mature (MII) oocytes", unit: "", key: "mii", countLike: true },
  { id: "fertilized", label: "Fertilized oocytes", unit: "", key: "fertilized", countLike: true },
  { id: "twoPn", label: "2PN zygotes", unit: "", key: "twoPn", countLike: true },
  { id: "blastocysts", label: "Blastocysts", unit: "", key: "blastocysts", countLike: true },
  { id: "frozen", label: "Embryos frozen", unit: "", key: "frozen", countLike: true },
  {
    id: "transferred",
    label: "Embryos transferred",
    unit: "",
    key: "transferred",
    countLike: true,
  },
];

function buildTrends(cycles: CycleRecord[]): CycleTrend[] {
  return TRENDS.map((t) => {
    const raw = cycles.map((c) => num(c, t.key));
    const values = raw.map((v) =>
      v === null ? NOT_PROVIDED : `${v}${t.unit ? ` ${t.unit}` : ""}`,
    );
    const recorded = raw.filter((v): v is number => v !== null);
    const firstIndex = raw.findIndex((v) => v !== null);
    const lastIndex = raw.map((v) => v !== null).lastIndexOf(true);
    const first = firstIndex === -1 ? null : raw[firstIndex]!;
    const last = lastIndex === -1 ? null : raw[lastIndex]!;

    if (recorded.length < 2 || first === null || last === null || firstIndex === lastIndex) {
      return {
        id: t.id,
        label: t.label,
        unit: t.unit,
        values,
        first,
        last,
        change: NOT_PROVIDED,
        direction: "not-assessable" as const,
        observation:
          recorded.length === 0
            ? `${t.label} is not recorded in any cycle.`
            : `${t.label} is recorded in only one cycle, so no change can be computed.`,
      };
    }

    const delta = last - first;
    const rounded = Math.round(delta * 100) / 100;
    const direction = rounded > 0 ? "increase" : rounded < 0 ? "decrease" : "unchanged";
    const changeText =
      rounded === 0
        ? "No change"
        : `${rounded > 0 ? "+" : ""}${rounded}${t.unit ? ` ${t.unit}` : t.countLike ? "" : ""}`;

    return {
      id: t.id,
      label: t.label,
      unit: t.unit,
      values,
      first,
      last,
      change: changeText,
      direction,
      observation: `${t.label} changed from ${first}${t.unit ? ` ${t.unit}` : ""} to ${last}${t.unit ? ` ${t.unit}` : ""} between the first and the most recent cycle in which it was recorded (arithmetic difference only).`,
    };
  });
}

const OUTCOME_ROWS: { id: string; label: string; key: string }[] = [
  { id: "protocol", label: "Protocol", key: "protocol" },
  { id: "gonadotropinType", label: "Gonadotropin", key: "gonadotropinType" },
  { id: "trigger", label: "Trigger", key: "trigger" },
  { id: "embryoGrades", label: "Embryo grades", key: "embryoGrades" },
  { id: "pgtPerformed", label: "PGT", key: "pgtPerformed" },
  { id: "transferType", label: "Transfer", key: "transferType" },
  { id: "implantation", label: "Implantation", key: "implantation" },
  { id: "clinicalPregnancy", label: "Clinical pregnancy", key: "clinicalPregnancy" },
  { id: "miscarriage", label: "Miscarriage", key: "miscarriage" },
  { id: "liveBirth", label: "Live birth", key: "liveBirth" },
  { id: "ohss", label: "OHSS", key: "ohss" },
  { id: "cancelled", label: "Cancelled", key: "cancelled" },
];

/* ------------------------------------------------------------------ build */

export function buildCycleIntelligence(
  cycles: CycleRecord[],
  response?: OvarianResponseResult | undefined,
): CycleIntelligenceResult {
  const views: CycleView[] = cycles.map((cycle, index) => {
    const groups: CycleGroupView[] = cycleFieldGroups.map((g) => {
      const fields = cycleGroupFields(g)
        .filter((f) => (f.showIf ? f.showIf(cycle as Record<string, unknown>) : true))
        .map((f) => {
          const value = cycleFieldValue(f, cycle);
          return { key: f.key, label: f.label, value, present: value !== NOT_PROVIDED };
        });
      return {
        id: g.id,
        title: g.title,
        fields,
        recorded: fields.filter((f) => f.present).length,
        total: fields.length,
      };
    });

    const all = groups.flatMap((g) => g.fields);
    const recorded = all.filter((f) => f.present).length;
    const missing = all.filter((f) => !f.present).map((f) => f.label);

    return {
      id: cycle.id,
      index,
      label: cycleLabel(cycle, index),
      groups,
      recorded,
      total: all.length,
      percent: all.length ? Math.round((recorded / all.length) * 100) : 0,
      missing,
      issues: validateCycle(cycle, index),
      outcome: outcomeLabel(cycle),
    };
  });

  const trends = cycles.length >= 1 ? buildTrends(cycles) : [];
  const outcomes: CycleOutcomeRow[] = cycles.length
    ? OUTCOME_ROWS.map((r) => ({
        id: r.id,
        label: r.label,
        values: cycles.map((c) => str(c, r.key) || NOT_PROVIDED),
      }))
    : [];

  const retrievedValues = cycles.map((c) => num(c, "retrieved"));
  const recordedRetrieved = retrievedValues.filter((v): v is number => v !== null);

  const observedRows = cycles.map((c, i) => ({
    label: cycleLabel(c, i),
    retrieved: num(c, "retrieved") === null ? NOT_PROVIDED : String(num(c, "retrieved")),
    mii: num(c, "mii") === null ? NOT_PROVIDED : String(num(c, "mii")),
    fertilized: num(c, "fertilized") === null ? NOT_PROVIDED : String(num(c, "fertilized")),
    blastocysts: num(c, "blastocysts") === null ? NOT_PROVIDED : String(num(c, "blastocysts")),
    pregnancy: outcomeLabel(c),
  }));

  const statements: string[] = [];
  if (recordedRetrieved.length) {
    statements.push(
      `Oocyte yield recorded in ${recordedRetrieved.length} of ${cycles.length} previous cycle(s): ${recordedRetrieved.join(", ")}.`,
    );
    statements.push(
      `Highest recorded oocyte yield: ${Math.max(...recordedRetrieved)}. Most recent recorded oocyte yield: ${recordedRetrieved[recordedRetrieved.length - 1]}.`,
    );
  }
  if (response) {
    statements.push(
      `Expected ovarian response category produced by the response prediction engine from the baseline markers: ${responseCategoryLabel[response.category]}.`,
    );
  }
  statements.push(EXPECTED_OBSERVED_PENDING);

  const missingObserved: string[] = [];
  if (cycles.length === 0) missingObserved.push("No previous IVF/ICSI cycle has been recorded.");
  cycles.forEach((c, i) => {
    if (num(c, "retrieved") === null)
      missingObserved.push(`${cycleLabel(c, i)}: oocytes retrieved not provided.`);
    if (num(c, "mii") === null)
      missingObserved.push(`${cycleLabel(c, i)}: mature (MII) oocytes not provided.`);
    if (num(c, "startingDose") === null)
      missingObserved.push(`${cycleLabel(c, i)}: starting gonadotropin dose not provided.`);
  });

  const expectedObserved: ExpectedObserved = {
    expectedCategory: response ? responseCategoryLabel[response.category] : "Not assessed",
    expectedBasis: response
      ? response.variables.filter((v) => v.present).map((v) => `${v.label}: ${v.value}`)
      : [],
    observedRows,
    observedSummary: recordedRetrieved.length
      ? [
          `Total oocytes retrieved across all recorded cycles: ${recordedRetrieved.reduce((a, b) => a + b, 0)}.`,
          `Cycles with oocyte yield documented: ${recordedRetrieved.length} of ${cycles.length}.`,
        ]
      : [],
    bestRetrieved: recordedRetrieved.length ? Math.max(...recordedRetrieved) : null,
    lastRetrieved: recordedRetrieved.length
      ? recordedRetrieved[recordedRetrieved.length - 1]!
      : null,
    statements,
    missing: missingObserved,
    pendingNote: EXPECTED_OBSERVED_PENDING,
  };

  const issues = views.flatMap((v) => v.issues);
  const missing = views.flatMap((v) => v.missing.map((m) => `${v.label}: ${m}`));

  return {
    version: CYCLE_INTELLIGENCE_VERSION,
    cycleCount: cycles.length,
    cycles: views,
    trends,
    outcomes,
    expectedObserved,
    issues,
    missing,
    evidence: cycleIntelligenceEvidenceIds,
    descriptiveNote: DESCRIPTIVE_NOTE,
  };
}
