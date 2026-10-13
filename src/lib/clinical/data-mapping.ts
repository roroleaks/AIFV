/**
 * Data mapping layer.
 *
 * Translates the raw assessment draft into canonical clinical variables that a
 * future decision-support engine will consume. This file performs extraction,
 * unit annotation and presence checking only — it never derives a clinical
 * conclusion, dose or recommendation.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum, computeTotals } from "@/lib/assessment/derived";
import { buildPatientDataset, type PatientDataset } from "@/lib/assessment/patient-dataset";
import {
  buildCycleIntelligence,
  type CycleIntelligenceResult,
} from "@/lib/engine/cycle-intelligence";
import type { OvarianResponseResult } from "@/lib/engine/ovarian-response";
import { knowledgeModules } from "./knowledge-model";

export type VariableKind = "number" | "text" | "boolean" | "list";

export interface ClinicalVariable {
  id: string;
  label: string;
  kind: VariableKind;
  unit?: string;
  /** Assessment field key(s) the value comes from. */
  source: string[];
  /** How the value is produced. */
  origin: "field" | "derived" | "cycles";
  note?: string;
}

export const clinicalVariables: ClinicalVariable[] = [
  {
    id: "age",
    label: "Female age",
    kind: "number",
    unit: "years",
    source: ["dob"],
    origin: "derived",
  },
  {
    id: "partnerAge",
    label: "Partner age",
    kind: "number",
    unit: "years",
    source: ["partnerAge"],
    origin: "field",
  },
  {
    id: "height",
    label: "Height",
    kind: "number",
    unit: "cm",
    source: ["height"],
    origin: "field",
  },
  {
    id: "weight",
    label: "Weight",
    kind: "number",
    unit: "kg",
    source: ["weight"],
    origin: "field",
  },
  {
    id: "bmi",
    label: "BMI",
    kind: "number",
    unit: "kg/m²",
    source: ["height", "weight"],
    origin: "derived",
  },
  { id: "amh", label: "AMH", kind: "number", unit: "ng/mL", source: ["amh"], origin: "field" },
  { id: "fsh", label: "Basal FSH", kind: "number", unit: "IU/L", source: ["fsh"], origin: "field" },
  { id: "lh", label: "Basal LH", kind: "number", unit: "IU/L", source: ["lh"], origin: "field" },
  {
    id: "estradiol",
    label: "Basal estradiol",
    kind: "number",
    unit: "pg/mL",
    source: ["estradiol"],
    origin: "field",
  },
  { id: "afcLeft", label: "AFC left", kind: "number", source: ["afcLeft"], origin: "field" },
  { id: "afcRight", label: "AFC right", kind: "number", source: ["afcRight"], origin: "field" },
  {
    id: "afcTotal",
    label: "Total AFC",
    kind: "number",
    source: ["afcLeft", "afcRight"],
    origin: "derived",
  },
  {
    id: "endometrium",
    label: "Endometrial thickness",
    kind: "number",
    unit: "mm",
    source: ["endometrium"],
    origin: "field",
  },
  {
    id: "endometrialPattern",
    label: "Endometrial pattern",
    kind: "text",
    source: ["endometrialPattern"],
    origin: "field",
  },
  {
    id: "cavityFindings",
    label: "Cavity findings",
    kind: "text",
    source: ["usCavity", "cavity"],
    origin: "field",
  },
  {
    id: "polyps",
    label: "Endometrial polyp",
    kind: "text",
    source: ["usPolyp", "polyp"],
    origin: "field",
  },
  {
    id: "fibroids",
    label: "Fibroids",
    kind: "text",
    source: ["usFibroid", "fibroids"],
    origin: "field",
  },
  {
    id: "pcos",
    label: "PCOS documented",
    kind: "boolean",
    source: ["causes", "pcos"],
    origin: "derived",
  },
  {
    id: "endometriosis",
    label: "Endometriosis documented",
    kind: "boolean",
    source: ["causes", "endometriosisStage"],
    origin: "derived",
  },
  {
    id: "recurrentLoss",
    label: "Recurrent pregnancy loss",
    kind: "boolean",
    source: ["causes", "abortions"],
    origin: "derived",
  },
  {
    id: "previousOhss",
    label: "Previous OHSS",
    kind: "boolean",
    source: ["ohssHistory", "cycles.ohss"],
    origin: "derived",
  },
  {
    id: "previousCycles",
    label: "Previous IVF / ICSI cycles",
    kind: "number",
    source: ["cycles"],
    origin: "cycles",
  },
  {
    id: "previousRetrieved",
    label: "Oocytes retrieved (last cycle)",
    kind: "number",
    source: ["cycles.retrieved"],
    origin: "cycles",
  },
  {
    id: "previousProtocol",
    label: "Previous protocol",
    kind: "text",
    source: ["cycles.protocol"],
    origin: "cycles",
  },
  {
    id: "protocolType",
    label: "Planned protocol preference",
    kind: "text",
    source: ["preferredProtocol", "protocolPreference"],
    origin: "field",
  },
  {
    id: "transferType",
    label: "Transfer strategy preference",
    kind: "text",
    source: ["transferPreference", "transferStrategy"],
    origin: "field",
  },
  {
    id: "triggerType",
    label: "Previous trigger",
    kind: "text",
    source: ["cycles.trigger"],
    origin: "cycles",
  },
  {
    id: "previousLiveBirth",
    label: "Previous live birth",
    kind: "number",
    source: ["liveBirth", "cycles.liveBirth"],
    origin: "derived",
  },
  {
    id: "semenVolume",
    label: "Semen volume",
    kind: "number",
    unit: "mL",
    source: ["semenVolume"],
    origin: "field",
  },
  {
    id: "concentration",
    label: "Sperm concentration",
    kind: "number",
    unit: "M/mL",
    source: ["concentration"],
    origin: "field",
  },
  {
    id: "progressiveMotility",
    label: "Progressive motility",
    kind: "number",
    unit: "%",
    source: ["progressiveMotility"],
    origin: "field",
  },
  {
    id: "totalMotility",
    label: "Total motility",
    kind: "number",
    unit: "%",
    source: ["totalMotility"],
    origin: "field",
  },
  {
    id: "morphology",
    label: "Normal morphology",
    kind: "number",
    unit: "%",
    source: ["morphology"],
    origin: "field",
  },
  {
    id: "dnaFragmentation",
    label: "DNA fragmentation index",
    kind: "number",
    unit: "%",
    source: ["dnaFragmentation"],
    origin: "field",
  },
  {
    id: "karyotype",
    label: "Karyotype",
    kind: "text",
    source: ["karyotypeFemale", "karyotypeMale", "karyotype"],
    origin: "field",
  },
  {
    id: "carrierStatus",
    label: "Carrier status",
    kind: "text",
    source: ["carrierScreening", "carrierStatus"],
    origin: "field",
  },
  {
    id: "pgtIndication",
    label: "PGT indication",
    kind: "text",
    source: ["pgtIndication", "pgt"],
    origin: "field",
  },
  {
    id: "ohssRiskMarkers",
    label: "OHSS risk marker set",
    kind: "list",
    source: ["amh", "afcLeft", "afcRight", "causes"],
    origin: "derived",
  },
];

export interface MappedVariable {
  variable: ClinicalVariable;
  value: string | number | boolean | string[] | null;
  present: boolean;
}

const first = (values: Record<string, FieldValue>, keys: string[]): FieldValue => {
  for (const k of keys) {
    const v = values[k];
    if (Array.isArray(v) ? v.length > 0 : v !== undefined && String(v).trim() !== "") return v;
  }
  return undefined;
};

const causesOf = (values: Record<string, FieldValue>) =>
  Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];

function ageFrom(dob: FieldValue): number | null {
  if (typeof dob !== "string" || !dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

/** Extract every canonical clinical variable from the assessment draft. */
export function buildClinicalDataset(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
): MappedVariable[] {
  const totals = computeTotals(values, cycles);
  const causes = causesOf(values);
  const last = cycles.length ? cycles[cycles.length - 1] : undefined;

  const resolve = (v: ClinicalVariable): string | number | boolean | string[] | null => {
    switch (v.id) {
      case "age":
        return ageFrom(values["dob"]);
      case "bmi": {
        const h = toNum(values["height"]);
        const w = toNum(values["weight"]);
        if (!h || !w) return null;
        return Math.round((w / (h / 100) ** 2) * 10) / 10;
      }
      case "afcTotal": {
        const l = toNum(values["afcLeft"]);
        const r = toNum(values["afcRight"]);
        if (l === null && r === null) return null;
        return (l ?? 0) + (r ?? 0);
      }
      case "pcos":
        return causes.includes("PCOS") || String(values["pcos"] ?? "") === "Yes";
      case "endometriosis":
        return (
          causes.includes("Endometriosis") ||
          String(values["endometriosisStage"] ?? "").startsWith("Stage")
        );
      case "recurrentLoss":
        return (
          causes.includes("Recurrent Pregnancy Loss") || (toNum(values["abortions"]) ?? 0) >= 2
        );
      case "previousOhss": {
        const hist = String(values["ohssHistory"] ?? "");
        const inCycles = cycles.some((c) => {
          const o = String(c["ohss"] ?? "");
          return o !== "" && o !== "No";
        });
        return (hist !== "" && !["No", "Unknown"].includes(hist)) || inCycles;
      }
      case "previousCycles":
        return cycles.length;
      case "previousRetrieved":
        return last ? toNum(last["retrieved"]) : null;
      case "previousProtocol":
        return last && last["protocol"] ? String(last["protocol"]) : null;
      case "triggerType":
        return last && last["trigger"] ? String(last["trigger"]) : null;
      case "previousLiveBirth":
        return totals.liveBirths;
      case "ohssRiskMarkers": {
        const markers: string[] = [];
        const amh = toNum(values["amh"]);
        const afc = (toNum(values["afcLeft"]) ?? 0) + (toNum(values["afcRight"]) ?? 0);
        if (amh !== null) markers.push(`AMH ${amh} ng/mL`);
        if (afc > 0) markers.push(`AFC ${afc}`);
        if (causes.includes("PCOS")) markers.push("PCOS documented");
        return markers.length ? markers : null;
      }
      default: {
        const raw = first(values, v.source);
        if (raw === undefined) return null;
        if (Array.isArray(raw)) return raw;
        if (v.kind === "number") return toNum(raw);
        return String(raw);
      }
    }
  };

  return clinicalVariables.map((variable) => {
    const value = resolve(variable);
    const present = Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined && value !== "" && value !== false;
    return { variable, value, present };
  });
}

export interface ModuleReadiness {
  moduleId: string;
  required: number;
  available: number;
  missing: ClinicalVariable[];
  percent: number;
}

/** How much of each knowledge module's input set is currently captured. */
export function moduleReadiness(dataset: MappedVariable[]): ModuleReadiness[] {
  const byId = new Map(dataset.map((d) => [d.variable.id, d]));
  return knowledgeModules.map((m) => {
    const inputs = m.inputs
      .map((id) => byId.get(id))
      .filter((d): d is MappedVariable => Boolean(d));
    const available = inputs.filter((d) => d.present).length;
    const missing = inputs.filter((d) => !d.present).map((d) => d.variable);
    return {
      moduleId: m.id,
      required: inputs.length,
      available,
      missing,
      percent: inputs.length ? Math.round((available / inputs.length) * 100) : 0,
    };
  });
}

/* --------------------------------------------------- unified patient context */

/**
 * Single entry point for downstream modules.
 *
 * Composes the existing canonical variable mapping with the structured patient
 * dataset (every captured field plus completeness) and the previous-cycle
 * intelligence layer, so no module has to re-read the raw assessment draft or
 * maintain a competing schema.
 */
export interface PatientContext {
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
  /** Canonical clinical variables consumed by the knowledge modules. */
  variables: MappedVariable[];
  /** Lookup of the canonical variables by id. */
  variable: (id: string) => MappedVariable | undefined;
  readiness: ModuleReadiness[];
  /** Full structured record of every captured field, with completeness scores. */
  dataset: PatientDataset;
  /** Descriptive previous-cycle comparison and expected vs observed surface. */
  cycleIntelligence: CycleIntelligenceResult;
}

export function buildPatientContext(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  response?: OvarianResponseResult | undefined,
): PatientContext {
  const variables = buildClinicalDataset(values, cycles);
  const byId = new Map(variables.map((v) => [v.variable.id, v]));
  return {
    values,
    cycles,
    variables,
    variable: (id: string) => byId.get(id),
    readiness: moduleReadiness(variables),
    dataset: buildPatientDataset(values, cycles),
    cycleIntelligence: buildCycleIntelligence(cycles, response),
  };
}
