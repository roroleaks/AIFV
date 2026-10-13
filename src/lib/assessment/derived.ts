import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  CalendarClock,
  CircleAlert,
  Droplets,
  HeartCrack,
  Scissors,
  Snowflake,
  Syringe,
  TestTube,
} from "lucide-react";

import type { CycleRecord, FieldValue } from "./use-assessment";

export const toNum = (v: unknown): number | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
};

const sumCycles = (cycles: CycleRecord[], key: string) =>
  cycles.reduce((acc, c) => acc + (toNum(c[key]) ?? 0), 0);

const countCycles = (cycles: CycleRecord[], key: string, match: string) =>
  cycles.filter((c) => String(c[key] ?? "") === match).length;

export interface DerivedTotals {
  totalCycles: number;
  ivfCycles: number;
  icsiCycles: number;
  transfers: number;
  blastocysts: number;
  frozen: number;
  retrieved: number;
  pregnancies: number;
  liveBirths: number;
  miscarriages: number;
  ohssEpisodes: number;
  infertilityMonths: number | null;
}

export function computeTotals(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): DerivedTotals {
  const pregnanciesRecorded = toNum(values["gravidity"]);
  const cyclePregnancies = countCycles(cycles, "clinicalPregnancy", "Yes");
  const cycleLiveBirths = countCycles(cycles, "liveBirth", "Yes");
  const cycleMiscarriages = countCycles(cycles, "miscarriage", "Yes");

  return {
    totalCycles: cycles.length,
    ivfCycles: countCycles(cycles, "cycleType", "IVF"),
    icsiCycles: countCycles(cycles, "cycleType", "ICSI"),
    transfers: sumCycles(cycles, "transferred"),
    blastocysts: sumCycles(cycles, "blastocysts"),
    frozen: sumCycles(cycles, "frozen"),
    retrieved: sumCycles(cycles, "retrieved"),
    pregnancies: Math.max(pregnanciesRecorded ?? 0, cyclePregnancies),
    liveBirths: Math.max(toNum(values["liveBirth"]) ?? 0, cycleLiveBirths),
    miscarriages: Math.max(toNum(values["miscarriages"]) ?? 0, cycleMiscarriages),
    ohssEpisodes: cycles.filter((c) => {
      const o = String(c["ohss"] ?? "");
      return o !== "" && o !== "No";
    }).length,
    infertilityMonths: toNum(values["infertilityDuration"]),
  };
}

export function formatDuration(months: number | null): string {
  if (months === null) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m === 1 ? "" : "s"}`;
  if (m === 0) return `${y} year${y === 1 ? "" : "s"}`;
  return `${y}y ${m}m`;
}

/* ------------------------------- timeline ------------------------------- */

export interface TimelineEvent {
  id: string;
  title: string;
  date: string | null;
  category: string;
  icon: LucideIcon;
  tone: "primary" | "emerald" | "warning" | "purple" | "muted";
  details: { label: string; value: string }[];
}

export function buildTimeline(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const push = (e: TimelineEvent) => events.push(e);
  const count = (key: string) => toNum(values[key]) ?? 0;

  cycles.forEach((cycle, i) => {
    const date = typeof cycle["cycleDate"] === "string" ? cycle["cycleDate"] : null;
    const label = String(cycle["cycleType"] ?? "IVF / ICSI");
    push({
      id: `cycle-${cycle.id}`,
      title: `${label} Cycle ${cycle["cycleNumber"] ?? i + 1}`,
      date,
      category: "Stimulation cycle",
      icon: Syringe,
      tone: "primary",
      details: [
        { label: "Clinic", value: String(cycle["clinic"] ?? "—") },
        { label: "Protocol", value: String(cycle["protocol"] ?? "—") },
        { label: "Retrieved", value: String(cycle["retrieved"] ?? "—") },
        { label: "MII", value: String(cycle["mii"] ?? "—") },
        { label: "Blastocysts", value: String(cycle["blastocysts"] ?? "—") },
        { label: "Frozen", value: String(cycle["frozen"] ?? "—") },
      ],
    });

    if (toNum(cycle["transferred"])) {
      push({
        id: `transfer-${cycle.id}`,
        title: `Embryo Transfer — ${cycle["transferred"]} embryo(s)`,
        date,
        category: "Transfer",
        icon: TestTube,
        tone: "purple",
        details: [
          { label: "Transfer type", value: String(cycle["transferType"] ?? "—") },
          { label: "Implantation", value: String(cycle["implantation"] ?? "—") },
          { label: "Clinical pregnancy", value: String(cycle["clinicalPregnancy"] ?? "—") },
        ],
      });
    }
    if (String(cycle["frozenTransfer"] ?? "") === "Yes") {
      push({
        id: `fet-${cycle.id}`,
        title: "Frozen Embryo Transfer",
        date,
        category: "Frozen transfer",
        icon: Snowflake,
        tone: "primary",
        details: [{ label: "Cycle", value: String(cycle["cycleNumber"] ?? i + 1) }],
      });
    }
    const ohss = String(cycle["ohss"] ?? "");
    if (ohss && ohss !== "No") {
      push({
        id: `ohss-${cycle.id}`,
        title: `OHSS episode — ${ohss}`,
        date,
        category: "Complication",
        icon: CircleAlert,
        tone: "warning",
        details: [{ label: "Cycle", value: String(cycle["cycleNumber"] ?? i + 1) }],
      });
    }
    if (String(cycle["liveBirth"] ?? "") === "Yes") {
      push({
        id: `lb-${cycle.id}`,
        title: "Live Birth",
        date,
        category: "Outcome",
        icon: Baby,
        tone: "emerald",
        details: [{ label: "From cycle", value: String(cycle["cycleNumber"] ?? i + 1) }],
      });
    }
    if (String(cycle["miscarriage"] ?? "") === "Yes") {
      push({
        id: `mc-${cycle.id}`,
        title: "Miscarriage",
        date,
        category: "Outcome",
        icon: HeartCrack,
        tone: "warning",
        details: [{ label: "From cycle", value: String(cycle["cycleNumber"] ?? i + 1) }],
      });
    }
  });

  const historic: {
    key: string;
    title: string;
    icon: LucideIcon;
    tone: TimelineEvent["tone"];
    category: string;
  }[] = [
    {
      key: "gravidity",
      title: "Pregnancy",
      icon: Baby,
      tone: "emerald",
      category: "Obstetric history",
    },
    {
      key: "liveBirth",
      title: "Delivery — live birth",
      icon: Baby,
      tone: "emerald",
      category: "Obstetric history",
    },
    {
      key: "abortions",
      title: "Miscarriage",
      icon: HeartCrack,
      tone: "warning",
      category: "Obstetric history",
    },
    {
      key: "ectopic",
      title: "Ectopic pregnancy",
      icon: Droplets,
      tone: "warning",
      category: "Obstetric history",
    },
    {
      key: "cesarean",
      title: "Cesarean delivery",
      icon: Scissors,
      tone: "purple",
      category: "Surgical history",
    },
  ];

  historic.forEach(({ key, title, icon, tone, category }) => {
    const total = count(key);
    for (let i = 0; i < Math.min(total, 12); i += 1) {
      push({
        id: `${key}-${i}`,
        title: total > 1 ? `${title} (${i + 1} of ${total})` : title,
        date: null,
        category,
        icon,
        tone,
        details: [{ label: "Recorded in", value: "Reproductive history" }],
      });
    }
  });

  const procedures: { key: string; title: string }[] = [
    { key: "hysteroscopy", title: "Hysteroscopy" },
    { key: "laparoscopy", title: "Laparoscopy" },
    { key: "ovarianSurgery", title: "Ovarian surgery" },
    { key: "endometriosisSurgery", title: "Endometriosis surgery" },
    { key: "myomectomy", title: "Myomectomy" },
    { key: "cervicalSurgery", title: "Cervical surgery" },
  ];
  procedures.forEach(({ key, title }) => {
    if (String(values[key] ?? "") === "Yes") {
      push({
        id: `proc-${key}`,
        title,
        date: null,
        category: "Procedure",
        icon: Scissors,
        tone: "purple",
        details: [{ label: "Documented", value: "Yes" }],
      });
    }
  });

  const ohssHistory = String(values["ohssHistory"] ?? "");
  if (ohssHistory && !["No", "Unknown"].includes(ohssHistory)) {
    push({
      id: "ohss-history",
      title: `Documented OHSS — ${ohssHistory}`,
      date: null,
      category: "Complication",
      icon: CircleAlert,
      tone: "warning",
      details: [{ label: "Source", value: "Reproductive history" }],
    });
  }

  return events.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

export const timelineFallbackIcon = CalendarClock;
export const timelineActivityIcon = Activity;

/* --------------------------- clinical alerts ---------------------------- */

export interface ClinicalAlert {
  id: string;
  title: string;
  detail: string;
  severity: "missing" | "documented";
  stepId: string;
}

const filled = (v: FieldValue) =>
  Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";

export function buildAlerts(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

  const missing: { key: string; title: string; stepId: string; detail: string }[] = [
    {
      key: "amh",
      title: "Missing AMH",
      stepId: "reserve",
      detail: "Anti-Müllerian hormone not recorded.",
    },
    {
      key: "afcLeft",
      title: "Missing AFC (left)",
      stepId: "reserve",
      detail: "Left antral follicle count not recorded.",
    },
    {
      key: "afcRight",
      title: "Missing AFC (right)",
      stepId: "reserve",
      detail: "Right antral follicle count not recorded.",
    },
    {
      key: "fsh",
      title: "Missing basal FSH",
      stepId: "reserve",
      detail: "Basal FSH not recorded.",
    },
    {
      key: "tsh",
      title: "Missing TSH",
      stepId: "reserve",
      detail: "Thyroid-stimulating hormone not recorded.",
    },
    {
      key: "concentration",
      title: "Missing semen analysis",
      stepId: "male",
      detail: "Sperm concentration not recorded.",
    },
    {
      key: "dob",
      title: "Missing date of birth",
      stepId: "patient",
      detail: "Age cannot be derived.",
    },
    { key: "height", title: "Missing height", stepId: "patient", detail: "BMI cannot be derived." },
    { key: "weight", title: "Missing weight", stepId: "patient", detail: "BMI cannot be derived." },
    {
      key: "endometrium",
      title: "Missing endometrial thickness",
      stepId: "ultrasound",
      detail: "Baseline endometrial measurement not recorded.",
    },
  ];

  missing.forEach((m) => {
    if (!filled(values[m.key])) {
      alerts.push({
        id: `missing-${m.key}`,
        title: m.title,
        detail: m.detail,
        severity: "missing",
        stepId: m.stepId,
      });
    }
  });

  const documented = (id: string, title: string, detail: string, stepId: string) =>
    alerts.push({ id, title, detail, severity: "documented", stepId });

  const ohssHistory = String(values["ohssHistory"] ?? "");
  if (ohssHistory && !["No", "Unknown"].includes(ohssHistory)) {
    documented(
      "doc-ohss",
      "Previous OHSS documented",
      `Severity recorded as ${ohssHistory}.`,
      "reproductive",
    );
  }
  if (cycles.some((c) => String(c["ohss"] ?? "") !== "" && String(c["ohss"]) !== "No")) {
    documented(
      "doc-ohss-cycle",
      "OHSS in a previous cycle",
      "At least one previous cycle records OHSS.",
      "cycles",
    );
  }
  const hydro = [values["gynHydrosalpinx"], values["usHydrosalpinx"]].map((v) => String(v ?? ""));
  if (hydro.some((v) => v && v !== "None" && v !== "Unknown")) {
    documented(
      "doc-hydro",
      "Hydrosalpinx documented",
      "Recorded in gynecological or ultrasound findings.",
      "gynecological",
    );
  }
  if (
    causes.includes("Endometriosis") ||
    String(values["endometriosisStage"] ?? "").startsWith("Stage")
  ) {
    documented(
      "doc-endo",
      "History of endometriosis",
      "Documented in cause of infertility or gynecological history.",
      "gynecological",
    );
  }
  if (String(values["ovarianSurgery"] ?? "") === "Yes") {
    documented(
      "doc-ovsurg",
      "History of ovarian surgery",
      "Previous ovarian surgery recorded.",
      "medical",
    );
  }
  if (causes.includes("PCOS")) {
    documented("doc-pcos", "PCOS documented", "Selected as a contributing factor.", "cause");
  }
  if (causes.includes("Recurrent Pregnancy Loss")) {
    documented(
      "doc-rpl",
      "Recurrent pregnancy loss documented",
      "Selected as a contributing factor.",
      "cause",
    );
  }
  const poor = cycles.some((c) => {
    const r = toNum(c["retrieved"]);
    return r !== null && r > 0 && r <= 3;
  });
  if (poor)
    documented(
      "doc-poor",
      "Previous poor response",
      "A previous cycle recorded ≤3 oocytes retrieved.",
      "cycles",
    );
  const hyper = cycles.some((c) => {
    const r = toNum(c["retrieved"]);
    return r !== null && r >= 20;
  });
  if (hyper)
    documented(
      "doc-hyper",
      "Previous hyper response",
      "A previous cycle recorded ≥20 oocytes retrieved.",
      "cycles",
    );

  const dob = values["dob"];
  if (typeof dob === "string" && dob) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) {
      const age = new Date().getFullYear() - d.getFullYear();
      if (age >= 38)
        documented("doc-age", "Advanced maternal age", `Age recorded as ${age} years.`, "patient");
    }
  }
  const smoking = String(values["smoking"] ?? "");
  if (smoking.startsWith("Current") || smoking === "Former") {
    documented("doc-smoke", "Smoking history", `Smoking status recorded as ${smoking}.`, "patient");
  }

  return alerts;
}
