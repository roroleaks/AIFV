/**
 * Value-category indicators only.
 * These functions describe WHERE an entered value sits relative to commonly used
 * laboratory / anthropometric reference ranges. They never recommend, suggest or
 * imply any treatment, protocol, medication or prognosis.
 */

export type Tone = "normal" | "low" | "high" | "warn" | "neutral";

export interface Interpretation {
  label: string;
  tone: Tone;
}

const n = (v: unknown): number | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
};

type Rule = (value: number, values: Record<string, unknown>) => Interpretation | null;

const rules: Record<string, Rule> = {
  amh: (v) => {
    if (v < 0.3) return { label: "Very low", tone: "warn" };
    if (v < 1.1) return { label: "Low", tone: "low" };
    if (v <= 3.5) return { label: "Normal", tone: "normal" };
    return { label: "High", tone: "high" };
  },
  fsh: (v) =>
    v > 10
      ? { label: "Elevated", tone: "warn" }
      : { label: "Within expected range", tone: "normal" },
  tsh: (v) => {
    if (v < 0.4) return { label: "Below expected laboratory range", tone: "warn" };
    if (v > 4.0) return { label: "Above expected laboratory range", tone: "warn" };
    return { label: "Within expected range", tone: "normal" };
  },
  prolactin: (v) =>
    v > 25
      ? { label: "Above expected range", tone: "warn" }
      : { label: "Within expected range", tone: "normal" },
  hba1c: (v) => {
    if (v < 5.7) return { label: "Within expected range", tone: "normal" };
    if (v < 6.5) return { label: "Above expected range", tone: "high" };
    return { label: "Markedly above range", tone: "warn" };
  },
  vitaminD: (v) => {
    if (v < 20) return { label: "Deficient range", tone: "warn" };
    if (v < 30) return { label: "Insufficient range", tone: "low" };
    return { label: "Within expected range", tone: "normal" };
  },
  partnerAge: (v) =>
    v >= 45
      ? { label: "Advanced paternal age", tone: "warn" }
      : { label: "Within usual range", tone: "normal" },
  semenVolume: (v) =>
    v < 1.4
      ? { label: "Below WHO reference", tone: "warn" }
      : { label: "Within WHO reference", tone: "normal" },
  concentration: (v) =>
    v < 16
      ? { label: "Below WHO reference", tone: "warn" }
      : { label: "Within WHO reference", tone: "normal" },
  progressiveMotility: (v) =>
    v < 30
      ? { label: "Below WHO reference", tone: "warn" }
      : { label: "Within WHO reference", tone: "normal" },
  totalMotility: (v) =>
    v < 42
      ? { label: "Below WHO reference", tone: "warn" }
      : { label: "Within WHO reference", tone: "normal" },
  morphology: (v) =>
    v < 4
      ? { label: "Below WHO reference", tone: "warn" }
      : { label: "Within WHO reference", tone: "normal" },
  dnaFragmentation: (v) => {
    if (v < 15) return { label: "Low fragmentation", tone: "normal" };
    if (v <= 30) return { label: "Intermediate fragmentation", tone: "low" };
    return { label: "High fragmentation", tone: "warn" };
  },
  endometrium: (v) =>
    v < 7
      ? { label: "Thin measurement", tone: "low" }
      : { label: "Within usual range", tone: "normal" },
  cycleLength: (v) => {
    if (v < 21) return { label: "Short cycle", tone: "low" };
    if (v > 35) return { label: "Long cycle", tone: "warn" };
    return { label: "Regular length", tone: "normal" };
  },
};

export function interpretField(
  key: string,
  raw: unknown,
  values: Record<string, unknown>,
): Interpretation | null {
  const value = n(raw);
  if (value === null) return null;
  const rule = rules[key];
  return rule ? rule(value, values) : null;
}

/** Age category from a numeric age in years. */
export function interpretAge(age: number | null): Interpretation | null {
  if (age === null) return null;
  if (age < 35) return { label: "Young reproductive age", tone: "normal" };
  if (age < 38) return { label: "Intermediate reproductive age", tone: "low" };
  return { label: "Advanced reproductive age", tone: "warn" };
}

export function interpretBmi(bmi: number | null): Interpretation | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return { label: "Underweight", tone: "low" };
  if (bmi < 25) return { label: "Normal", tone: "normal" };
  if (bmi < 30) return { label: "Overweight", tone: "high" };
  return { label: "Obesity", tone: "warn" };
}

export function interpretAfc(total: number | null): Interpretation | null {
  if (total === null) return null;
  if (total < 7) return { label: "Low reserve range", tone: "warn" };
  if (total <= 20) return { label: "Normal reserve range", tone: "normal" };
  return { label: "High reserve range", tone: "high" };
}

/** Indicator for auto-derived fields, keyed by field key. */
export function interpretDerived(
  key: string,
  values: Record<string, unknown>,
): Interpretation | null {
  if (key === "age") {
    const dob = values["dob"];
    if (typeof dob !== "string" || !dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return interpretAge(age >= 0 && age <= 120 ? age : null);
  }
  if (key === "bmi") {
    const h = n(values["height"]);
    const w = n(values["weight"]);
    if (!h || !w) return null;
    return interpretBmi(w / (h / 100) ** 2);
  }
  if (key === "afcTotal") {
    const l = n(values["afcLeft"]);
    const r = n(values["afcRight"]);
    if (l === null && r === null) return null;
    return interpretAfc((l ?? 0) + (r ?? 0));
  }
  return null;
}

export const toneClasses: Record<Tone, string> = {
  normal: "bg-emerald-soft text-emerald border-emerald/25",
  low: "bg-warning-soft text-warning border-warning/25",
  high: "bg-primary-soft text-primary border-primary/25",
  warn: "bg-destructive/10 text-destructive border-destructive/25",
  neutral: "bg-muted text-muted-foreground border-border",
};
