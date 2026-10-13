/**
 * Patient Dataset & Completeness layer.
 *
 * Builds a complete, structured view of EVERY value captured by the
 * assessment wizard so that downstream engines and the Clinical Intelligence
 * Report can display and trace all entered information.
 *
 * This module performs NO clinical calculation, applies NO threshold and
 * produces NO recommendation. It only restates recorded data and reports
 * which items are missing.
 */

import { cycleFields, steps, type FieldDef } from "./schema";
import type { CycleRecord, FieldValue } from "./use-assessment";

export interface DatasetField {
  key: string;
  label: string;
  value: string;
  present: boolean;
  optional: boolean;
  group: string;
  stepId: string;
  stepTitle: string;
}

export interface DatasetGroup {
  title: string;
  fields: DatasetField[];
  recorded: number;
  total: number;
}

export interface DatasetSection {
  stepId: string;
  title: string;
  groups: DatasetGroup[];
  recorded: number;
  total: number;
  percent: number;
}

export interface CycleDatasetField {
  key: string;
  label: string;
  value: string;
  present: boolean;
}

export interface CycleDataset {
  id: string;
  index: number;
  label: string;
  fields: CycleDatasetField[];
  recorded: number;
  total: number;
  percent: number;
  missing: string[];
}

export type MissingCategory =
  | "core-assessment"
  | "classification"
  | "treatment"
  | "previous-cycle"
  | "optional";

export const missingCategoryLabel: Record<MissingCategory, string> = {
  "core-assessment": "Required for a complete assessment record",
  classification: "Required for classification engines (POSEIDON, Bologna, response)",
  treatment: "Required for treatment-level modules once their evidence is activated",
  "previous-cycle": "Required for previous-cycle intelligence",
  optional: "Optional — improves documentation only",
};

export interface MissingItem {
  key: string;
  label: string;
  category: MissingCategory;
  detail: string;
}

export interface CompletenessScore {
  id: string;
  label: string;
  recorded: number;
  total: number;
  percent: number;
  detail: string;
}

export interface PatientDataset {
  sections: DatasetSection[];
  /** Flat lookup of every non-cycle field. */
  fields: Record<string, DatasetField>;
  cycles: CycleDataset[];
  recorded: number;
  total: number;
  percent: number;
  missing: MissingItem[];
  scores: CompletenessScore[];
  /** Overall data-completeness score (0-100), an average of the sub-scores. */
  overall: number;
}

const isFilled = (v: FieldValue): boolean =>
  Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";

function display(field: FieldDef, values: Record<string, FieldValue>): string {
  if (field.type === "derived" && field.compute) {
    const computed = field.compute(values as Record<string, unknown>);
    return computed ? computed : "Not recorded";
  }
  const raw = values[field.key];
  if (!isFilled(raw)) return "Not recorded";
  const text = Array.isArray(raw) ? raw.join(", ") : String(raw);
  return field.unit ? `${text} ${field.unit}` : text;
}

function visible(field: FieldDef, values: Record<string, FieldValue>): boolean {
  return field.showIf ? field.showIf(values as Record<string, unknown>) : true;
}

/* --------------------------------------------------- classification needs */

const CLASSIFICATION_KEYS: { key: string; label: string; detail: string }[] = [
  { key: "dob", label: "Date of birth", detail: "Maternal age is required by POSEIDON and Bologna." },
  { key: "amh", label: "AMH", detail: "Ovarian reserve marker used by POSEIDON, Bologna and the response engine." },
  { key: "afcRight", label: "Right antral follicle count", detail: "Antral follicle count is an alternative reserve marker." },
  { key: "afcLeft", label: "Left antral follicle count", detail: "Antral follicle count is an alternative reserve marker." },
  { key: "fsh", label: "FSH", detail: "Supplementary endocrine marker used in the response assessment." },
];

const TREATMENT_KEYS: { key: string; label: string; detail: string }[] = [
  { key: "height", label: "Height", detail: "Required to derive BMI for dose-related modules." },
  { key: "weight", label: "Weight", detail: "Required to derive BMI for dose-related modules." },
  { key: "cycleRegularity", label: "Cycle regularity", detail: "Recorded for protocol-level modules." },
  { key: "causes", label: "Cause of infertility", detail: "Recorded for protocol-level modules." },
  { key: "drugAllergy", label: "Drug allergy", detail: "Recorded before any medication module is activated." },
  { key: "currentMedications", label: "Current medications", detail: "Recorded before any medication module is activated." },
];

const CYCLE_CORE_KEYS = [
  "cycleType",
  "protocol",
  "gonadotropinType",
  "startingDose",
  "totalDose",
  "duration",
  "trigger",
  "peakE2",
  "folliclesTotal",
  "retrieved",
  "mii",
  "fertilized",
  "blastocysts",
  "transferType",
  "clinicalPregnancy",
  "ohss",
];

/* ------------------------------------------------------------------ build */

export function buildPatientDataset(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): PatientDataset {
  const sections: DatasetSection[] = [];
  const flat: Record<string, DatasetField> = {};

  for (const step of steps) {
    if (step.custom) continue;
    const groups: DatasetGroup[] = [];
    for (const group of step.groups) {
      if (group.showIf && !group.showIf(values as Record<string, unknown>)) continue;
      const fields: DatasetField[] = group.fields
        .filter((f) => visible(f, values))
        .map((f) => {
          const value = display(f, values);
          const entry: DatasetField = {
            key: f.key,
            label: f.label,
            value,
            present: value !== "Not recorded",
            optional: Boolean(f.optional),
            group: group.title,
            stepId: step.id,
            stepTitle: step.title,
          };
          flat[f.key] = entry;
          return entry;
        });
      if (fields.length === 0) continue;
      const counted = fields.filter((f) => !f.optional);
      groups.push({
        title: group.title,
        fields,
        recorded: counted.filter((f) => f.present).length,
        total: counted.length,
      });
    }
    if (groups.length === 0) continue;
    const recorded = groups.reduce((a, g) => a + g.recorded, 0);
    const total = groups.reduce((a, g) => a + g.total, 0);
    sections.push({
      stepId: step.id,
      title: step.title,
      groups,
      recorded,
      total,
      percent: total === 0 ? 0 : Math.round((recorded / total) * 100),
    });
  }

  const recorded = sections.reduce((a, s) => a + s.recorded, 0);
  const total = sections.reduce((a, s) => a + s.total, 0);

  /* ------------------------------------------------------------- cycles */
  const cycleData: CycleDataset[] = cycles.map((cycle, index) => {
    const fields: CycleDatasetField[] = cycleFields
      .filter((f) => visible(f, cycle))
      .map((f) => {
        const value = display(f, cycle);
        return { key: f.key, label: f.label, value, present: value !== "Not recorded" };
      });
    const counted = fields.filter(
      (f) => !cycleFields.find((c) => c.key === f.key)?.optional,
    );
    const rec = counted.filter((f) => f.present).length;
    const missing = CYCLE_CORE_KEYS.filter(
      (k) => !fields.find((f) => f.key === k)?.present,
    ).map((k) => cycleFields.find((f) => f.key === k)?.label ?? k);
    return {
      id: cycle.id,
      index: index + 1,
      label: `Cycle ${index + 1}${cycle["cycleYear"] ? ` (${String(cycle["cycleYear"])})` : cycle["cycleDate"] ? ` (${String(cycle["cycleDate"])})` : ""}`,
      fields,
      recorded: rec,
      total: counted.length,
      percent: counted.length === 0 ? 0 : Math.round((rec / counted.length) * 100),
      missing,
    };
  });

  /* ------------------------------------------------------------ missing */
  const missing: MissingItem[] = [];

  for (const section of sections) {
    for (const group of section.groups) {
      for (const f of group.fields) {
        if (f.present) continue;
        missing.push({
          key: f.key,
          label: `${f.label} — ${section.title}`,
          category: f.optional ? "optional" : "core-assessment",
          detail: `Recorded in the “${group.title}” group of the ${section.title} step.`,
        });
      }
    }
  }

  const afcRecorded = isFilled(values["afcRight"]) || isFilled(values["afcLeft"]);
  for (const c of CLASSIFICATION_KEYS) {
    const filled = c.key.startsWith("afc") ? afcRecorded : isFilled(values[c.key]);
    if (filled) continue;
    const existing = missing.find((m) => m.key === c.key);
    if (existing) {
      existing.category = "classification";
      existing.detail = c.detail;
    } else {
      missing.push({ key: c.key, label: c.label, category: "classification", detail: c.detail });
    }
  }

  for (const t of TREATMENT_KEYS) {
    if (isFilled(values[t.key])) continue;
    const existing = missing.find((m) => m.key === t.key);
    if (existing) {
      if (existing.category === "core-assessment" || existing.category === "optional") {
        existing.category = "treatment";
        existing.detail = t.detail;
      }
    } else {
      missing.push({ key: t.key, label: t.label, category: "treatment", detail: t.detail });
    }
  }

  cycleData.forEach((c) => {
    c.missing.forEach((label) =>
      missing.push({
        key: `${c.id}:${label}`,
        label: `${c.label} — ${label}`,
        category: "previous-cycle",
        detail: "Required before this cycle can be compared with the other recorded cycles.",
      }),
    );
  });

  /* ------------------------------------------------------------- scores */
  const classificationTotal = CLASSIFICATION_KEYS.length;
  const classificationRecorded = CLASSIFICATION_KEYS.filter((c) =>
    c.key.startsWith("afc") ? afcRecorded : isFilled(values[c.key]),
  ).length;

  const treatmentTotal = TREATMENT_KEYS.length;
  const treatmentRecorded = TREATMENT_KEYS.filter((t) => isFilled(values[t.key])).length;

  const cycleRecorded = cycleData.reduce((a, c) => a + c.recorded, 0);
  const cycleTotal = cycleData.reduce((a, c) => a + c.total, 0);

  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

  const scores: CompletenessScore[] = [
    {
      id: "assessment",
      label: "Assessment record",
      recorded,
      total,
      percent: pct(recorded, total),
      detail: "All non-optional fields across every assessment step.",
    },
    {
      id: "classification",
      label: "Classification readiness",
      recorded: classificationRecorded,
      total: classificationTotal,
      percent: pct(classificationRecorded, classificationTotal),
      detail: "Variables the implemented classification engines read.",
    },
    {
      id: "previous-cycle",
      label: "Previous-cycle record",
      recorded: cycleRecorded,
      total: cycleTotal,
      percent: pct(cycleRecorded, cycleTotal),
      detail:
        cycleData.length === 0
          ? "No previous cycle recorded."
          : `${cycleData.length} cycle(s) recorded.`,
    },
    {
      id: "treatment",
      label: "Treatment-module data",
      recorded: treatmentRecorded,
      total: treatmentTotal,
      percent: pct(treatmentRecorded, treatmentTotal),
      detail:
        "Data availability only. Treatment algorithms remain inactive until their evidence is imported.",
    },
  ];

  const overall = Math.round(scores.reduce((a, s) => a + s.percent, 0) / scores.length);

  return {
    sections,
    fields: flat,
    cycles: cycleData,
    recorded,
    total,
    percent: pct(recorded, total),
    missing,
    scores,
    overall,
  };
}
