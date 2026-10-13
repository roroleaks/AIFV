/**
 * IVF Clinical Intelligence Report (V1).
 *
 * Unified, explainable output of every implemented engine. This module
 * produces NO recommendation, NO treatment advice and NO clinical decision of
 * its own: it restates values that were entered, results that implemented
 * engines produced, and — wherever a validated algorithm has not been
 * transcribed into the Evidence Library — the literal string
 * "Evidence Algorithm Pending".
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import {
  phenotypeLabels,
  reserveCategoryLabel,
  type PhenotypeResult,
} from "@/lib/engine/phenotype";
import { poseidonStatusLabels } from "@/lib/engine/poseidon";
import { bolognaStatusLabel } from "@/lib/engine/bologna";
import { responseCategoryLabel, type OvarianResponseResult } from "@/lib/engine/ovarian-response";
import {
  recommendationStatusLabel,
  type ProtocolRecommendationResult,
} from "@/lib/engine/protocol-recommendation";
import { protocolDatabase } from "@/lib/engine/protocol-database";
import { evidenceStateLabel, type ProtocolSelectionResult } from "@/lib/engine/protocol-selection";
import {
  selectionStatusLabel,
  type GonadotropinSelectionResult,
} from "@/lib/engine/gonadotropin-selection";
import { gonadotropinDatabase } from "@/lib/engine/gonadotropin-database";
import {
  applicabilityLabel,
  NOT_REPORTED,
  type GonadotropinEvidenceResult,
} from "@/lib/engine/gonadotropin-evidence";
import { consortStatusLabel, type ConsortResult } from "@/lib/engine/consort-dose";
import { monitoringStatusLabel, type MonitoringResult } from "@/lib/engine/monitoring";
import {
  pendingStatusLabel,
  safetyStatusLabel,
  type CycleCompletionResult,
} from "@/lib/engine/cycle-completion";
import {
  NOT_PROVIDED,
  type CycleIntelligenceResult,
  type CycleView,
} from "@/lib/engine/cycle-intelligence";
import { buildPatientContext, type PatientContext } from "@/lib/clinical/data-mapping";
import { engineModules } from "@/lib/engine/registry";
import { engineStatusLabels } from "@/lib/engine/types";
import { blockedModules, totalRequirementCount } from "@/lib/evidence/requirements";
import { evidenceLibrary, findEvidence, type EvidenceEntry } from "@/lib/evidence/library";
import { algorithmStatusLabel, evaluateTreatmentGate } from "@/lib/engine/algorithm-status";

export const INTELLIGENCE_REPORT_VERSION = "1.0.0";
export const APPLICATION_VERSION = "1.0.0";

export const PENDING_LABEL = "Evidence Algorithm Pending";
export const CONSORT_PENDING_LABEL =
  "CONSORT calculation unavailable — validated coefficients and dose crosswalk not loaded.";

export const REPORT_DISCLAIMER = [
  "This application is an Evidence-Based Clinical Decision Support System.",
  "It assists qualified fertility specialists by organizing clinical information, applying validated evidence-based algorithms where available, and presenting explainable outputs.",
  "Clinical responsibility remains with the treating physician.",
  'Algorithms that are marked "Evidence Algorithm Pending" have intentionally not been activated because the corresponding validated guideline tables or published algorithms have not yet been incorporated into the Evidence Library.',
];

/** Evidence Library version — derived from the indexed corpus, not invented. */
export const evidenceLibraryVersion = (): string => {
  const latest = evidenceLibrary
    .map((e) => e.addedAt)
    .sort()
    .at(-1);
  const year = latest ? new Date(latest).getFullYear() : new Date().getFullYear();
  return `${year}.${evidenceLibrary.length}`;
};

/* ------------------------------------------------------------------ model */

export interface ReportField {
  label: string;
  value: string;
  present: boolean;
  detail?: string;
}

export interface ReportList {
  title: string;
  items: string[];
  emptyLabel?: string;
}

export type SectionStatus = "complete" | "partial" | "pending-evidence" | "no-data";

export const sectionStatusLabel: Record<SectionStatus, string> = {
  complete: "Complete",
  partial: "Partially documented",
  "pending-evidence": PENDING_LABEL,
  "no-data": "No data recorded",
};

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
  emptyLabel?: string;
}

export interface IntelligenceSection {
  id: string;
  number: number;
  title: string;
  /** Lucide icon key resolved by the view layer. */
  icon: string;
  status: SectionStatus;
  summary: string;
  fields: ReportField[];
  lists: ReportList[];
  tables: ReportTable[];
  /** Set only when the section's algorithm is deliberately not activated. */
  pendingNote?: string | undefined;
}

export type QualityIssueKind = "missing" | "duplicate" | "conflict" | "incomplete";

export const qualityIssueLabel: Record<QualityIssueKind, string> = {
  missing: "Missing variable",
  duplicate: "Duplicate value",
  conflict: "Conflicting information",
  incomplete: "Incomplete assessment",
};

export interface QualityIssue {
  id: string;
  kind: QualityIssueKind;
  label: string;
  detail: string;
}

export type ModuleAlgorithmStatus = "active" | "framework" | "pending-evidence";

export const moduleAlgorithmStatusLabel: Record<ModuleAlgorithmStatus, string> = {
  active: "Algorithm active",
  framework: "Framework only",
  "pending-evidence": PENDING_LABEL,
};

export interface ModuleExplanation {
  moduleId: string;
  name: string;
  /** What the module evaluated, in physician language. */
  evaluated: string;
  /** Which variables were analysed. */
  inputs: string[];
  /** Why the module produced its output. */
  reasoning: string[];
  /** Evidence entry ids the module cites. */
  evidence: string[];
  /** Variables that were unavailable. */
  unavailable: string[];
  /** Future algorithms that remain inactive inside this module. */
  inactive: string[];
  status: ModuleAlgorithmStatus;
  /** Data-completeness confidence only — never clinical certainty. */
  confidence: number | null;
}

export interface ActivationProgress {
  id: string;
  label: string;
  complete: number;
  total: number;
  percent: number;
  detail: string;
}

export interface AuditTrail {
  date: string;
  time: string;
  applicationVersion: string;
  algorithmVersions: { label: string; version: string }[];
  evidenceLibraryVersion: string;
  reportVersion: string;
  user: string;
  calculationTimestamp: string;
}

export interface ApplicationStatus {
  active: { id: string; name: string }[];
  framework: { id: string; name: string }[];
  pending: { id: string; name: string }[];
  missingEvidence: { module: string; items: string[] }[];
  requirementCount: number;
  progress: ActivationProgress[];
}

export interface IntelligenceReport {
  patientId: string;
  patientName: string;
  sections: IntelligenceSection[];
  /** Full, group-by-group record of each previous cycle (rendered expandable). */
  cycleDetails: CycleView[];
  qualityIssues: QualityIssue[];
  explanations: ModuleExplanation[];
  applicationStatus: ApplicationStatus;
  evidence: EvidenceEntry[];
  audit: AuditTrail;
  disclaimer: string[];
  generatedAt: string;
  version: string;
}

/* ---------------------------------------------------------------- helpers */

const str = (v: FieldValue): string | null => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

const list = (v: FieldValue): string[] => (Array.isArray(v) ? v.filter(Boolean) : []);

const field = (label: string, value: string | number | null, unit = ""): ReportField => {
  const present = value !== null && value !== "" && value !== undefined;
  return {
    label,
    value: present ? `${value}${unit ? ` ${unit}` : ""}` : "Not recorded",
    present,
  };
};

const textField = (label: string, value: string | null): ReportField => ({
  label,
  value: value ?? "Not recorded",
  present: value !== null,
});

const positive = (v: FieldValue): boolean => {
  const s = str(v);
  if (!s) return false;
  return !["No", "None", "Not done", "Unknown", "Negative", "Never", "Normal"].includes(s);
};

const percent = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

/* ------------------------------------------------------------------ input */

import type { StartingDoseResult } from "@/lib/engine/starting-dose";
import { matchStatusLabel } from "@/lib/engine/starting-dose";

export interface IntelligenceReportInput {
  patientId: string;
  patientName: string;
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
  phenotype: PhenotypeResult;
  response: OvarianResponseResult;
  protocol: ProtocolRecommendationResult;
  /** Protocol Selection Engine — evidence review only. */
  protocolSelection?: ProtocolSelectionResult | undefined;
  /** Physician-recorded protocol decision, when one exists. */
  protocolDecision?: { label: string; protocol: string | null; note: string } | null | undefined;
  gonadotropin: GonadotropinSelectionResult;
  /** Gonadotropin Selection Engine — evidence review only. */
  gonadotropinEvidence?: GonadotropinEvidenceResult | undefined;
  /** Physician-recorded gonadotropin decision, when one exists. */
  gonadotropinDecision?:
    | {
        label: string;
        gonadotropin: string | null;
        note: string;
        origin: string;
        decidedAt: string;
      }
    | null
    | undefined;
  /** Starting Gonadotropin Dose Engine — evidence-gated framework. */
  startingDose?: StartingDoseResult | undefined;
  consort: ConsortResult;
  monitoring: MonitoringResult;
  cycle: CycleCompletionResult;
  user?: string;
}

/* --------------------------------------------------------------- sections */

function section1(input: IntelligenceReportInput): IntelligenceSection {
  const { values, phenotype } = input;
  const causes = list(values["causes"]);
  const duration = toNum(values["infertilityDuration"]);

  const medical: string[] = [];
  const medicalMap: [string, string][] = [
    ["hypertension", "Hypertension"],
    ["diabetes", "Diabetes"],
    ["thyroid", "Thyroid disease"],
    ["hyperprolactinemia", "Hyperprolactinemia"],
    ["autoimmune", "Autoimmune disease"],
    ["thrombophilia", "Thrombophilia"],
    ["cancer", "Cancer"],
    ["chemotherapy", "Previous chemotherapy"],
    ["radiotherapy", "Previous radiotherapy"],
  ];
  for (const [key, label] of medicalMap) {
    if (positive(values[key])) medical.push(`${label}: ${str(values[key])}`);
  }
  const meds = str(values["currentMedications"]);
  if (meds) medical.push(`Current medications: ${meds}`);
  const allergy = str(values["drugAllergy"]);
  if (allergy) medical.push(`Drug allergy: ${allergy}`);

  const surgical: string[] = [];
  const surgicalMap: [string, string][] = [
    ["ovarianSurgery", "Previous ovarian surgery"],
    ["endometriosisSurgery", "Endometriosis surgery"],
    ["myomectomy", "Myomectomy"],
    ["bariatric", "Bariatric surgery"],
    ["hysteroscopy", "Previous hysteroscopy"],
    ["laparoscopy", "Previous laparoscopy"],
    ["cervicalSurgery", "Cervical surgery"],
    ["cesarean", "Previous cesarean"],
  ];
  for (const [key, label] of surgicalMap) {
    if (positive(values[key])) surgical.push(`${label}: ${str(values[key])}`);
  }

  const fields: ReportField[] = [
    textField("Patient identifier", str(values["patientId"]) ?? input.patientName),
    field("Age", phenotype.patientSummary.age, "years"),
    field("BMI", phenotype.patientSummary.bmi, "kg/m²"),
    field("Infertility duration", duration, "months"),
    textField("Primary diagnosis", causes[0] ?? null),
    textField("Secondary diagnosis", causes.length > 1 ? causes.slice(1).join(", ") : null),
    textField("Cause of infertility", causes.length ? causes.join(", ") : null),
    textField("Infertility type", str(values["infertilityType"])),
    field("Previous pregnancies", toNum(values["gravidity"])),
    field("Previous miscarriages", toNum(values["miscarriages"])),
    field("Previous IVF / ICSI cycles", phenotype.patientSummary.previousCycles),
    field("Previous live birth", toNum(values["liveBirth"])),
  ];

  const recorded = fields.filter((f) => f.present).length;
  return {
    id: "patient-information",
    number: 1,
    title: "Patient Information",
    icon: "user",
    status: recorded === fields.length ? "complete" : recorded === 0 ? "no-data" : "partial",
    summary: `${recorded} of ${fields.length} identification and history items are recorded.`,
    fields,
    lists: [
      {
        title: "Relevant medical history",
        items: medical,
        emptyLabel: "No positive medical history recorded.",
      },
      {
        title: "Relevant surgical history",
        items: surgical,
        emptyLabel: "No surgical history recorded.",
      },
    ],
    tables: [],
  };
}

function section2(input: IntelligenceReportInput): IntelligenceSection {
  const { phenotype, response, values } = input;
  const r = phenotype.reserve;
  const fields: ReportField[] = [
    field("AMH", r.amh, "ng/mL"),
    field("Antral follicle count", r.afc, "follicles"),
    field("Basal FSH", r.fsh, "IU/L"),
    field("Basal LH", response.inputs.lh, "IU/L"),
    field("Estradiol", response.inputs.estradiol, "pg/mL"),
    field("BMI", phenotype.patientSummary.bmi, "kg/m²"),
    field("Endometrial thickness (baseline)", toNum(values["endometrium"]), "mm"),
  ];
  const recorded = fields.filter((f) => f.present).length;
  return {
    id: "baseline-reproductive",
    number: 2,
    title: "Baseline Reproductive Assessment",
    icon: "flask",
    status: recorded === fields.length ? "complete" : recorded === 0 ? "no-data" : "partial",
    summary: `Ovarian reserve summary: ${reserveCategoryLabel[r.category]}.`,
    fields,
    lists: [
      {
        title: "Ovarian reserve summary",
        items: r.contributors,
        emptyLabel: "Insufficient baseline data to summarise ovarian reserve.",
      },
      {
        title: "Missing baseline variables",
        items: r.missing,
        emptyLabel: "All baseline reserve variables are recorded.",
      },
    ],
    tables: [],
  };
}

function section3(input: IntelligenceReportInput): IntelligenceSection {
  const { phenotype, response } = input;
  const p = phenotype.poseidon;
  const b = phenotype.bologna;
  const fields: ReportField[] = [
    textField(
      "POSEIDON classification",
      p.group ? `${p.groupLabel} — ${p.groupTitle}` : poseidonStatusLabels[p.status],
    ),
    textField("Bologna assessment", `${bolognaStatusLabel[b.status]} — ${b.headline}`),
    textField("Expected ovarian response", responseCategoryLabel[response.category]),
    textField("Overall patient phenotype", phenotypeLabels[phenotype.phenotype]),
    field("Data completeness (POSEIDON)", p.confidence, "%"),
    field("Data completeness (response)", response.confidence, "%"),
  ];
  return {
    id: "patient-phenotype",
    number: 3,
    title: "Patient Phenotype",
    icon: "dna",
    status: phenotype.missing.length === 0 ? "complete" : "partial",
    summary: `${phenotypeLabels[phenotype.phenotype]} · ${responseCategoryLabel[response.category]}.`,
    fields,
    lists: [
      {
        title: "Clinical summary",
        items: phenotype.phenotypeRationale,
        emptyLabel: "No phenotype rationale available.",
      },
      {
        title: "Completed assessments",
        items: phenotype.completedAssessments,
        emptyLabel: "No assessment completed.",
      },
      {
        title: "Missing information",
        items: phenotype.missing.map((m) => m.label),
        emptyLabel: "No missing phenotype variable.",
      },
    ],
    tables: [],
  };
}

function section4(input: IntelligenceReportInput): IntelligenceSection {
  const { protocol } = input;
  const rec = protocol.recommendation;
  const gate = evaluateTreatmentGate("protocol-recommendation");
  const inactive = !gate.active || rec.status !== "available";
  const protocolName = (id: string) => protocolDatabase.find((p) => p.id === id)?.name ?? id;

  const sel = input.protocolSelection;
  const decision = input.protocolDecision ?? null;

  const fields: ReportField[] = [
    textField(
      "Treatment recommendation algorithm",
      inactive ? "Evidence Pending" : algorithmStatusLabel[gate.status],
    ),
    textField(
      "Selected protocol",
      inactive || !rec.recommended ? null : protocolName(rec.recommended),
    ),
    textField("Protocol status", recommendationStatusLabel[rec.status]),
    textField(
      "Primary recommendation",
      inactive ? PENDING_LABEL : rec.explanation.clinicalRationale,
    ),
    textField(
      "Alternative protocols",
      inactive ? PENDING_LABEL : rec.alternatives.map(protocolName).join(", ") || null,
    ),
    textField(
      "Patient phenotype",
      sel ? `${phenotypeLabels[input.phenotype.phenotype]} · ${sel.reserveCategory}` : null,
    ),
    textField("POSEIDON (input to the evidence review)", sel?.poseidonGroup ?? null),
    textField("Bologna (input to the evidence review)", sel?.bolognaStatus ?? null),
    textField("Predicted ovarian response", sel?.predictedResponse ?? null),
    textField(
      "Observed previous response",
      sel
        ? sel.predictedVsObserved.observedAvailable
          ? sel.predictedVsObserved.observedStatements.join(" ")
          : "No completed previous cycle with a recorded oocyte yield"
        : null,
    ),
    textField(
      "Physician protocol decision",
      decision
        ? [decision.label, decision.protocol, decision.note].filter(Boolean).join(" — ")
        : null,
    ),
    textField("CONSORT dose entering protocol selection", sel ? "— (firewalled, null)" : null),
  ];

  return {
    id: "stimulation-plan",
    number: 4,
    title: "Protocol Selection & Ovarian Stimulation Plan",
    icon: "route",
    status: inactive ? "pending-evidence" : "complete",
    summary: inactive ? PENDING_LABEL : recommendationStatusLabel[rec.status],
    fields,
    lists: [
      {
        title: "Clinical considerations documented from recorded data",
        items: protocol.considerations.map((c) => `${c.label} (${c.source})`),
        emptyLabel: "No clinical consideration derived from the recorded data.",
      },
      {
        title: "Protocol options reviewed (evidence review, not a recommendation)",
        items: sel
          ? sel.options.map(
              (o) =>
                `${o.name} — evidence: ${evidenceStateLabel[o.evidenceState]}; population applicability: ${evidenceStateLabel[o.populationMatch]}; selection rule: ${PENDING_LABEL}`,
            )
          : [],
        emptyLabel: "Protocol Selection Engine output not attached.",
      },
      {
        title: "Population applicability and evidence limitations",
        items: sel
          ? sel.options.flatMap((o) => [
              `${o.name}: ${o.populationStudied}`,
              `${o.name} limitations: ${o.limitations.join(" ")}`,
            ])
          : [],
        emptyLabel: "No applicability statement available.",
      },
      {
        title: "Cautions, population mismatch and previous adverse response",
        items: sel ? sel.cautions.map((c) => `${c.label} — ${c.source}`) : [],
        emptyLabel: "No caution derived from the recorded data.",
      },
      {
        title: "Missing information for the protocol evidence review",
        items: sel ? sel.missingInformation.map((m) => m.label) : [],
        emptyLabel: "No missing field identified.",
      },
      {
        title: "Supporting evidence",
        items: rec.evidenceSource.map((id) => findEvidence(id)?.title ?? id),
        emptyLabel: "No evidence linked.",
      },
    ],
    tables: sel
      ? [
          {
            title: "Protocol comparison — evidence states (no ranking)",
            columns: ["Dimension", ...sel.options.map((o) => o.name)],
            rows: sel.comparison.map((row) => [
              row.label,
              ...row.cells.map((c) => evidenceStateLabel[c.state]),
            ]),
          },
        ]
      : [],
    pendingNote: inactive ? rec.message : undefined,
  };
}

function section5(input: IntelligenceReportInput): IntelligenceSection {
  const { gonadotropin } = input;
  const sel = gonadotropin.selection;
  const gonGate = evaluateTreatmentGate("gonadotropin-selection");
  const inactive = !gonGate.active || sel.status !== "available";
  const medName = (id: string) => gonadotropinDatabase.find((g) => g.id === id)?.name ?? id;
  const medType = (id: string) => gonadotropinDatabase.find((g) => g.id === id)?.type ?? null;

  const ev = input.gonadotropinEvidence;
  const dec = input.gonadotropinDecision ?? null;

  const fields: ReportField[] = [
    textField(
      "Gonadotropin selection algorithm",
      inactive ? "Evidence Pending" : algorithmStatusLabel[gonGate.status],
    ),
    textField(
      "Selected medication (algorithm)",
      inactive || !sel.recommended ? null : medName(sel.recommended),
    ),
    textField(
      "Medication type (algorithm)",
      inactive || !sel.recommended ? null : medType(sel.recommended),
    ),
    textField("Selection status", selectionStatusLabel[sel.status]),
    textField("Primary recommendation", inactive ? PENDING_LABEL : sel.explanation.whySelected),
    textField("Patient phenotype", ev ? ev.patientEvidenceSummary.phenotype.join(" · ") : null),
    textField("Current protocol", ev ? ev.protocolIntegration.protocolName : null),
    textField(
      "Protocol decision status",
      ev ? ev.protocolIntegration.protocolDecisionStatus : null,
    ),
    textField(
      "Previous gonadotropin exposure (historical)",
      ev
        ? ev.previousExposure.length
          ? ev.previousExposure
              .map((p) => `${p.label}: ${p.gonadotropinType} (${p.brand}), start ${p.startingDose}`)
              .join(" · ")
          : "No previous stimulation cycle recorded"
        : null,
    ),
    textField(
      "Physician gonadotropin selection",
      dec
        ? `${dec.label}${dec.gonadotropin ? ` — ${dec.gonadotropin}` : ""} (${dec.origin})`
        : null,
    ),
    textField("Physician decision note", dec?.note ? dec.note : null),
    textField(
      "Recommended dose generated by this engine",
      ev ? "— (no dose is produced; dose firewall active)" : null,
    ),
    textField("CONSORT dose entering gonadotropin review", ev ? "— (firewalled, null)" : null),
    textField("Evidence review version", ev ? ev.version : null),
  ];

  return {
    id: "gonadotropin-plan",
    number: 5,
    title: "Gonadotropin Evidence Review",
    icon: "syringe",
    status: inactive ? "pending-evidence" : "complete",
    summary: inactive ? PENDING_LABEL : selectionStatusLabel[sel.status],
    fields,
    lists: [
      {
        title: "Supporting evidence",
        items: (ev ? ev.evidenceSources : sel.evidenceSource).map(
          (id) => findEvidence(id)?.title ?? id,
        ),
        emptyLabel: "No evidence linked.",
      },
      {
        title: "Gonadotropin options reviewed (no ranking)",
        items: ev
          ? ev.options.map(
              (o) =>
                `${o.name} — applicability: ${applicabilityLabel[o.applicability]}; evidence: ${evidenceStateLabel[o.evidenceState]}; selection rule: ${PENDING_LABEL}`,
            )
          : [],
        emptyLabel: "Gonadotropin evidence review not available.",
      },
      {
        title: "Safety information",
        items: ev
          ? ev.options.map(
              (o) =>
                `${o.name}: ${
                  o.safetyOutcomes.every((sx) => !sx.reported)
                    ? NOT_REPORTED
                    : o.safetyOutcomes
                        .filter((sx) => sx.reported)
                        .map((sx) => `${sx.label} — ${sx.finding}`)
                        .join("; ")
                }`,
            )
          : [],
        emptyLabel: "No safety outcome transcribed for any preparation.",
      },
      {
        title: "Evidence limitations",
        items: ev ? ev.patientEvidenceSummary.limitations : [],
        emptyLabel: "Not assessed.",
      },
      {
        title: "Missing information",
        items: ev
          ? ev.missingInformation.flatMap((g) => g.items.map((it) => `${g.title}: ${it.label}`))
          : [],
        emptyLabel: "No missing information recorded.",
      },
    ],
    tables: [
      {
        title: "Previous gonadotropin exposure — historical patient-entered values",
        columns: [
          "Cycle",
          "Gonadotropin",
          "Brand",
          "Starting dose (historical)",
          "Max dose (historical)",
          "Duration",
          "Retrieved",
          "MII",
          "Blastocysts",
          "Outcome",
        ],
        rows: ev
          ? ev.previousExposure.map((p) => [
              p.label,
              p.gonadotropinType,
              p.brand,
              p.startingDose,
              p.maxDose,
              p.duration,
              p.retrieved,
              p.mii,
              p.blastocysts,
              p.outcome,
            ])
          : gonadotropin.cycleReview.map((c) => [
              c.label,
              c.medication ?? "Not recorded",
              "Not recorded",
              c.dailyDose === null ? "Not recorded" : `${c.dailyDose} IU/day`,
              "Not recorded",
              c.stimulationDays === null ? "Not recorded" : `${c.stimulationDays} day(s)`,
              c.retrieved === null ? "Not recorded" : String(c.retrieved),
              c.mii === null ? "Not recorded" : String(c.mii),
              c.blastocysts === null ? "Not recorded" : String(c.blastocysts),
              c.outcome,
            ]),
        emptyLabel: "No previous stimulation cycle recorded.",
      },
      ...(ev
        ? [
            {
              title: "Gonadotropin comparison — evidence states (no ranking)",
              columns: [
                "Gonadotropin",
                "Study type",
                "Clinical outcomes",
                "Safety",
                "Applicability",
                "Evidence status",
              ],
              rows: ev.comparison.map((row) => [
                row.name,
                row.studyType,
                row.clinicalOutcomes,
                row.safety,
                applicabilityLabel[row.applicability],
                evidenceStateLabel[row.evidenceState],
              ]),
              emptyLabel: "No gonadotropin option reviewed.",
            },
          ]
        : []),
    ],
    pendingNote: inactive ? sel.message : undefined,
  };
}

function section6(input: IntelligenceReportInput): IntelligenceSection {
  const { consort } = input;
  const completed =
    evaluateTreatmentGate("consort-dose").active &&
    consort.status === "completed" &&
    consort.dose !== null;

  const used = consort.variables.filter((v) => v.usedInCalculation);
  const availableInputs = consort.variables
    .filter((v) => v.usedInCalculation && v.status === "available")
    .map((v) => v.label);

  const fields: ReportField[] = [
    textField("CONSORT status", completed ? "Active" : "Evidence Pending"),
    textField(
      "Inputs available",
      availableInputs.length ? availableInputs.join(" / ") : "None captured",
    ),
    textField("Dose", completed ? `${consort.dose} IU/day` : "Not calculated"),
    textField(
      "Reason",
      completed
        ? "Validated coefficients and dose crosswalk loaded."
        : "Original validated coefficients and dose crosswalk unavailable.",
    ),
    textField("Calculation version", `v${consort.version} — ${consort.modelName}`),
    textField("Medication", consort.medication),
    textField("Calculation status", consortStatusLabel[consort.status]),
    textField("Validated population", consort.validatedPopulation),
  ];

  return {
    id: "consort-dose",
    number: 6,
    title: "CONSORT Starting Dose",
    icon: "calculator",
    status: completed ? "complete" : "pending-evidence",
    summary: completed ? `${consort.dose} IU/day` : CONSORT_PENDING_LABEL,
    fields,
    lists: [
      {
        title: "Variables used",
        items: used.map((v) => `${v.label}: ${v.display}`),
        emptyLabel: "No variable available for the calculation.",
      },
      {
        title: "Missing or invalid variables",
        items: [
          ...consort.validation.missing.map((v) => `${v.label}: missing`),
          ...consort.validation.invalid.map((v) => `${v.label}: ${v.issue ?? "invalid"}`),
        ],
        emptyLabel: "All mandatory variables are valid.",
      },
      {
        title: "Clinical notes",
        items: consort.clinicalNotes,
        emptyLabel: "No clinical note recorded.",
      },
    ],
    tables: [],
    pendingNote: completed ? undefined : (consort.reason ?? CONSORT_PENDING_LABEL),
  };
}

function sectionStartingDose(input: IntelligenceReportInput): IntelligenceSection {
  const sd = input.startingDose;

  if (!sd) {
    return {
      id: "starting-dose",
      number: 0,
      title: "Starting Gonadotropin Dose",
      icon: "syringe",
      status: "pending-evidence",
      summary: "STARTING DOSE: NOT CALCULATED — Evidence Algorithm Pending.",
      fields: [
        textField("Starting dose", "NOT CALCULATED"),
        textField("State", "Evidence algorithm pending"),
      ],
      lists: [],
      tables: [],
      pendingNote:
        "An individualized starting dose was not calculated because a validated dosing algorithm with complete coefficients/tables and applicable population evidence is not currently available.",
    };
  }

  const calculated = sd.dose !== null;

  const fields: ReportField[] = [
    textField("Starting dose", calculated ? `${sd.dose} ${sd.doseUnit ?? ""}` : "NOT CALCULATED"),
    textField("Dose state", sd.stateLabel),
    textField("Selected protocol", sd.currentTreatment.protocolName),
    textField("Selected gonadotropin", sd.currentTreatment.gonadotropinName ?? "Not selected"),
    textField("Predicted ovarian response", sd.predictedResponse),
    textField("POSEIDON context", sd.poseidonContext),
    textField("Bologna context", sd.bolognaContext),
    textField("CONSORT status", sd.consortFirewall.statusLabel),
    textField("CONSORT dose used by this engine", "None — CONSORT is frozen and firewalled"),
  ];

  return {
    id: "starting-dose",
    number: 0,
    title: "Starting Gonadotropin Dose",
    icon: "syringe",
    status: calculated ? "complete" : "pending-evidence",
    summary: calculated
      ? `${sd.dose} ${sd.doseUnit ?? ""} — ${sd.stateLabel}`
      : "STARTING DOSE: NOT CALCULATED — Evidence Algorithm Pending.",
    fields,
    lists: [
      {
        title: "Dosing algorithms reviewed",
        items: sd.algorithms.map(
          (a) =>
            `${a.name}: ${a.statusLabel} · applicability ${matchStatusLabel[a.matchStatus]} · dose ${
              a.calculatedDose === null ? "not calculated" : a.calculatedDose
            }`,
        ),
        emptyLabel: "No dosing algorithm registered.",
      },
      {
        title: "Historical doses (patient-entered, not a recommendation)",
        items: sd.historicalDoses.map(
          (h) =>
            `${h.label}: ${h.gonadotropin} ${h.startingDose} (max ${h.maxDose}, total ${h.totalDose})`,
        ),
        emptyLabel: "No previous stimulation cycle recorded.",
      },
      {
        title: "Evidence-reported dose ranges",
        items: sd.evidenceReportedDoses.map((d) => `${d.source}: ${d.range} (${d.population})`),
        emptyLabel: sd.evidenceReportedNote,
      },
      {
        title: "Missing information",
        items: sd.missingInformation.flatMap((g) => g.items.map((i) => `${g.title}: ${i.label}`)),
        emptyLabel: "All information tracked by this engine has been recorded.",
      },
      {
        title: "Evidence limitations",
        items: sd.evidenceLimitations,
        emptyLabel: "No limitation recorded.",
      },
      {
        title: "Scope and safety guardrails",
        items: sd.safetyGuardrails,
        emptyLabel: "No guardrail recorded.",
      },
      {
        title: "CONSORT firewall",
        items: sd.consortFirewall.statements,
        emptyLabel: "No CONSORT statement recorded.",
      },
    ],
    tables: [],
    pendingNote: calculated ? undefined : sd.reportLanguage,
  };
}

function section7(input: IntelligenceReportInput): IntelligenceSection {
  const { monitoring } = input;
  const s = monitoring.summary;
  const fields: ReportField[] = [
    textField("Monitoring status", monitoringStatusLabel[monitoring.status]),
    field("Recorded visits", monitoring.visits.length),
    textField("Current stimulation day", s.currentDay === null ? null : `Day ${s.currentDay}`),
    textField("Current dose", s.currentDose),
    textField("Follicular development", s.follicularDevelopment),
    textField("Hormone results", s.hormoneResults),
    textField("Response trend", s.responseTrend),
    textField("Monitoring completeness", `${monitoring.completeness.percent}%`),
  ];

  return {
    id: "monitoring-summary",
    number: 7,
    title: "Monitoring Summary",
    icon: "activity",
    status:
      monitoring.visits.length === 0
        ? "no-data"
        : monitoring.completeness.percent === 100
          ? "complete"
          : "partial",
    summary: `${monitoring.visits.length} visit(s), ${monitoring.completeness.percent}% of expected fields recorded.`,
    fields,
    lists: [
      {
        title: "Informational observations",
        items: monitoring.alerts.map((a) => `${a.label}: ${a.observation} (${a.basis})`),
        emptyLabel: "No informational observation generated.",
      },
      {
        title: "Observed response (descriptive only)",
        items: monitoring.descriptors.map((d) => `${d.label}: ${d.detail}`),
        emptyLabel: "Not enough measurements to describe a direction.",
      },
      {
        title: "Visit completeness",
        items: monitoring.visitCompleteness.map((v) => `Day ${v.day}: ${v.level}`),
        emptyLabel: "No visit recorded.",
      },
    ],
    tables: [
      {
        title: "Stimulation timeline",
        columns: [
          "Day",
          "Dose",
          "Largest follicle",
          "≥10 mm",
          "≥14 mm",
          "≥17 mm",
          "Estradiol",
          "Endometrium",
        ],
        rows: monitoring.visits.map((v) => [
          `Day ${v.day}`,
          v.dailyDose === null ? "—" : `${v.dailyDose} IU`,
          v.largestFollicle === null ? "—" : `${v.largestFollicle} mm`,
          v.follicles10 === null ? "—" : String(v.follicles10),
          v.follicles14 === null ? "—" : String(v.follicles14),
          v.follicles17 === null ? "—" : String(v.follicles17),
          v.estradiol === null ? "—" : `${v.estradiol} pg/mL`,
          v.endometrium === null ? "—" : `${v.endometrium} mm`,
        ]),
        emptyLabel: "No monitoring visit recorded.",
      },
      {
        title: "Hormone and follicular trends",
        columns: ["Measurement", "Latest", "Previous", "Change", "Per day"],
        rows: monitoring.trends.map((t) => [t.label, t.latest, t.previous, t.change, t.perDay]),
        emptyLabel: "At least two visits are required to compute a trend.",
      },
      {
        title: "Dose timeline (all doses physician-entered)",
        columns: ["Day", "Dose", "Medication", "Change", "Reason", "Source"],
        rows: monitoring.doseTimeline.map((d) => [
          `Day ${d.day}`,
          d.dose,
          d.medication,
          d.change,
          d.reason,
          d.physicianDecision,
        ]),
        emptyLabel: "No dose recorded.",
      },
      {
        title: "Individual follicle trajectories (physician-supplied identifiers)",
        columns: ["Follicle", "Side", "Baseline", "Current", "Change"],
        rows: monitoring.follicleTrajectories.map((t) => [
          t.followId,
          t.side,
          t.baseline === null ? "—" : `${t.baseline} mm`,
          t.current === null ? "—" : `${t.current} mm`,
          t.change,
        ]),
        emptyLabel: "No follicle identifier supplied; follicle identity is never inferred.",
      },
      {
        title: "Expected vs observed response (descriptive)",
        columns: ["Expected", "Source", "Observed", "Difference", "Evidence status"],
        rows: [
          [
            monitoring.expectedVsObserved.expected,
            monitoring.expectedVsObserved.expectedSource,
            monitoring.expectedVsObserved.observed,
            monitoring.expectedVsObserved.difference,
            monitoring.expectedVsObserved.evidenceStatus,
          ],
        ],
        emptyLabel: "Not available.",
      },
      {
        title: "Data validation flags",
        columns: ["Day", "Field", "Severity", "Message"],
        rows: monitoring.validation.map((v) => [
          v.day === null ? "Cycle" : `Day ${v.day}`,
          v.field,
          v.severity,
          v.message,
        ]),
        emptyLabel: "No validation flag.",
      },
    ],
    pendingNote: `${monitoring.pendingMessage} Dose adjustment status: DOSE ADJUSTMENT ALGORITHM PENDING — no dose increase, decrease, stop, trigger, freeze-all or cancellation is produced. Every dose shown is physician-entered and descriptive trends are not clinical interpretations.`,
  };
}

function section8(input: IntelligenceReportInput): IntelligenceSection {
  const { cycle } = input;
  const fields: ReportField[] = [
    textField(
      "Trigger readiness",
      `${pendingStatusLabel[cycle.trigger.status]} — ${PENDING_LABEL}`,
    ),
    textField("OHSS assessment", `${cycle.ohss.status} — ${PENDING_LABEL}`),
    textField(
      "Freeze-all assessment",
      `${pendingStatusLabel[cycle.freezeAll.status]} — ${PENDING_LABEL}`,
    ),
    textField("Safety status", safetyStatusLabel[cycle.safetyStatus]),
    textField("Monitoring summary", cycle.summary.monitoring),
    textField("Follicular summary", cycle.summary.follicular),
    textField("Hormone summary", cycle.summary.hormone),
  ];

  return {
    id: "cycle-completion",
    number: 8,
    title: "Cycle Completion & Safety",
    icon: "shield",
    status: "pending-evidence",
    summary: `${safetyStatusLabel[cycle.safetyStatus]} · trigger, OHSS and freeze-all algorithms locked.`,
    fields,
    lists: [
      {
        title: "Safety summary",
        items: [cycle.summary.safety],
      },
      {
        title: "Documented OHSS markers",
        items: cycle.ohss.documentedMarkers,
        emptyLabel: "No OHSS marker recorded.",
      },
      {
        title: "Outstanding monitoring items",
        items: cycle.summary.outstanding,
        emptyLabel: "No outstanding monitoring item.",
      },
    ],
    tables: [],
    pendingNote: cycle.pendingMessage,
  };
}

function section9(evidence: EvidenceEntry[]): IntelligenceSection {
  return {
    id: "evidence-summary",
    number: 9,
    title: "Evidence Summary",
    icon: "book",
    status: evidence.length ? "complete" : "no-data",
    summary: `${evidence.length} guideline or publication referenced by the engines used in this report.`,
    fields: [
      textField("Evidence Library version", evidenceLibraryVersion()),
      textField("Report version", `v${INTELLIGENCE_REPORT_VERSION}`),
    ],
    lists: [],
    tables: [
      {
        title: "Guidelines and publications used",
        columns: ["Title", "Source", "Year", "Level", "DOI"],
        rows: evidence.map((e) => [
          e.title,
          e.society ?? e.journal,
          String(e.year),
          e.level,
          e.doi ?? "Not stated",
        ]),
        emptyLabel: "No evidence reference linked.",
      },
    ],
  };
}

/* ------------------------------------------- expanded dataset sections */

const datasetFields = (ctx: PatientContext, keys: string[]): ReportField[] =>
  keys
    .map((k) => ctx.dataset.fields[k])
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .map((f) => ({
      label: f.label,
      value: f.present ? f.value : "Not provided",
      present: f.present,
    }));

const sectionShell = (
  id: string,
  title: string,
  icon: string,
  fields: ReportField[],
  extra?: Partial<IntelligenceSection>,
): IntelligenceSection => {
  const recorded = fields.filter((f) => f.present).length;
  return {
    id,
    number: 0,
    title,
    icon,
    status: recorded === 0 ? "no-data" : recorded === fields.length ? "complete" : "partial",
    summary: `${recorded} of ${fields.length} items recorded.`,
    fields,
    lists: [],
    tables: [],
    ...extra,
  };
};

const HISTORY_KEYS = [
  "hypertension",
  "diabetes",
  "thyroid",
  "hyperprolactinemia",
  "autoimmune",
  "thrombophilia",
  "thromboembolic",
  "cardiovascular",
  "renalDisease",
  "liverDisease",
  "neurologicalDisease",
  "geneticDiseaseHistory",
  "otherMedicalConditions",
  "cancer",
  "cancerDetail",
  "chemotherapy",
  "radiotherapy",
];

const SURGICAL_KEYS = [
  "ovarianSurgery",
  "tubalSurgery",
  "endometriosisSurgery",
  "myomectomy",
  "uterineSurgery",
  "cesareanSection",
  "otherPelvicSurgery",
  "bariatric",
];

const MEDICATION_KEYS = [
  "drugAllergy",
  "currentMedications",
  "previousFertilityMedication",
  "ivfCycleMedication",
  "fertilityMedicationDose",
  "fertilityMedicationRoute",
  "fertilityMedicationDuration",
  "fertilityMedicationReason",
];

const ENDOCRINE_KEYS = [
  "amh",
  "fsh",
  "lh",
  "estradiol",
  "progesterone",
  "prolactin",
  "tsh",
  "testosterone",
  "shbg",
  "dheas",
  "insulin",
  "hba1c",
  "vitaminD",
  "otherEndocrine",
];

const ULTRASOUND_KEYS = [
  "afcRight",
  "afcLeft",
  "ovarianVolumeRight",
  "ovarianVolumeLeft",
  "endometrium",
  "endometrialPattern",
  "usEndometrioma",
  "ovarianCysts",
  "ovarianCystSize",
  "usFibroid",
  "usFibroidSize",
  "usPolyp",
  "usAdenomyosis",
  "usHydrosalpinx",
  "usCavity",
  "otherPelvicFindings",
];

function sectionHistory(ctx: PatientContext): IntelligenceSection {
  const fields = [
    ...datasetFields(ctx, HISTORY_KEYS),
    ...datasetFields(ctx, SURGICAL_KEYS),
    ...datasetFields(ctx, MEDICATION_KEYS),
  ];
  return sectionShell(
    "expanded-history",
    "Medical, Surgical & Medication History",
    "clipboard",
    fields,
    {
      summary: `Complete documented history as entered: ${fields.filter((f) => f.present).length} of ${fields.length} items recorded. "Not provided" is shown for items that were never answered and is distinct from a recorded answer of "No".`,
      lists: [
        {
          title: "Documented surgical history",
          items: datasetFields(ctx, SURGICAL_KEYS)
            .filter((f) => f.present)
            .map((f) => `${f.label}: ${f.value}`),
          emptyLabel: "No surgical history recorded.",
        },
        {
          title: "Documented medication history",
          items: datasetFields(ctx, MEDICATION_KEYS)
            .filter((f) => f.present)
            .map((f) => `${f.label}: ${f.value}`),
          emptyLabel: "No medication history recorded.",
        },
      ],
    },
  );
}

function sectionEndocrineUltrasound(ctx: PatientContext): IntelligenceSection {
  const endocrine = datasetFields(ctx, ENDOCRINE_KEYS);
  const ultrasound = datasetFields(ctx, ULTRASOUND_KEYS);
  const fields = [...endocrine, ...ultrasound];
  return sectionShell(
    "endocrine-ultrasound",
    "Endocrine Profile & Ultrasound Findings",
    "flask",
    fields,
    {
      summary: `${endocrine.filter((f) => f.present).length} endocrine result(s) and ${ultrasound.filter((f) => f.present).length} ultrasound finding(s) recorded. Values are restated exactly as entered; no threshold is applied here.`,
      tables: [
        {
          title: "Endocrine profile",
          columns: ["Investigation", "Recorded value"],
          rows: endocrine.map((f) => [f.label, f.value]),
          emptyLabel: "No endocrine result recorded.",
        },
        {
          title: "Detailed ultrasound findings",
          columns: ["Finding", "Recorded value"],
          rows: ultrasound.map((f) => [f.label, f.value]),
          emptyLabel: "No ultrasound finding recorded.",
        },
      ],
    },
  );
}

function sectionCycleRecords(ci: CycleIntelligenceResult): IntelligenceSection {
  const recorded = ci.cycles.reduce((a, c) => a + c.recorded, 0);
  const total = ci.cycles.reduce((a, c) => a + c.total, 0);
  return {
    id: "previous-cycle-records",
    number: 0,
    title: "Previous Cycle Records",
    icon: "history",
    status: ci.cycleCount === 0 ? "no-data" : recorded === total ? "complete" : "partial",
    summary:
      ci.cycleCount === 0
        ? "No previous IVF/ICSI cycle has been recorded."
        : `${ci.cycleCount} previous cycle(s) recorded · ${recorded} of ${total} cycle fields documented. Each cycle is reproduced in full below.`,
    fields: ci.cycles.map((c) => ({
      label: c.label,
      value: `${c.outcome} · ${c.percent}% documented`,
      present: true,
    })),
    lists: [
      {
        title: "Data validation flags",
        items: ci.issues.map((i) => `${i.cycleLabel} — ${i.message}`),
        emptyLabel: "No impossible or contradictory value detected in the recorded cycles.",
      },
    ],
    tables: [
      {
        title: "Cycle overview",
        columns: [
          "Cycle",
          "Protocol",
          "Gonadotropin",
          "Start dose",
          "Days",
          "Retrieved",
          "MII",
          "Blastocysts",
          "Outcome",
        ],
        rows: ci.cycles.map((c) => {
          const get = (key: string) =>
            c.groups.flatMap((g) => g.fields).find((f) => f.key === key)?.value ?? NOT_PROVIDED;
          return [
            c.label,
            get("protocol"),
            get("gonadotropinType"),
            get("startingDose"),
            get("duration"),
            get("retrieved"),
            get("mii"),
            get("blastocysts"),
            c.outcome,
          ];
        }),
        emptyLabel: "No previous cycle recorded.",
      },
    ],
  };
}

function sectionCycleComparison(ci: CycleIntelligenceResult): IntelligenceSection {
  const header = ["Variable", ...ci.cycles.map((c) => c.label)];
  return {
    id: "previous-cycle-comparison",
    number: 0,
    title: "Previous Cycle Comparison",
    icon: "activity",
    status: ci.cycleCount === 0 ? "no-data" : ci.cycleCount === 1 ? "partial" : "complete",
    summary:
      ci.cycleCount === 0
        ? "No previous cycle is available for comparison."
        : ci.cycleCount === 1
          ? "Only one previous cycle is recorded; trends require at least two cycles."
          : `${ci.cycleCount} cycles compared. All statements are descriptive restatements or arithmetic differences.`,
    fields: [],
    lists: [
      {
        title: "Descriptive observations",
        items: ci.trends.filter((t) => t.direction !== "not-assessable").map((t) => t.observation),
        emptyLabel: "No arithmetic comparison can be computed from the recorded cycles.",
      },
      { title: "Scope of this section", items: [ci.descriptiveNote] },
    ],
    tables: [
      {
        title: "Stimulation and laboratory trends",
        columns: [...header, "Change (first → latest)"],
        rows: ci.trends.map((t) => [t.label, ...t.values, t.change]),
        emptyLabel: "No previous cycle recorded.",
      },
      {
        title: "Protocol and outcome comparison",
        columns: header,
        rows: ci.outcomes.map((o) => [o.label, ...o.values]),
        emptyLabel: "No previous cycle recorded.",
      },
    ],
  };
}

function sectionExpectedObserved(ci: CycleIntelligenceResult): IntelligenceSection {
  const eo = ci.expectedObserved;
  return {
    id: "expected-vs-observed",
    number: 0,
    title: "Expected vs Observed Response",
    icon: "scale",
    status: "pending-evidence",
    summary: `Expected category: ${eo.expectedCategory}. Observed oocyte yield is displayed for every recorded cycle; no concordance verdict is generated.`,
    fields: [
      textField("Expected ovarian response (prediction engine)", eo.expectedCategory),
      textField(
        "Observed oocyte yield — most recent recorded cycle",
        eo.lastRetrieved === null ? null : `${eo.lastRetrieved} oocyte(s)`,
      ),
      textField(
        "Observed oocyte yield — highest recorded cycle",
        eo.bestRetrieved === null ? null : `${eo.bestRetrieved} oocyte(s)`,
      ),
    ],
    lists: [
      {
        title: "Basis of the expected category",
        items: eo.expectedBasis,
        emptyLabel: "No baseline variable recorded.",
      },
      {
        title: "Observed summary",
        items: eo.observedSummary,
        emptyLabel: "No observed oocyte yield recorded.",
      },
      { title: "Descriptive statements", items: eo.statements },
      {
        title: "Missing historical information",
        items: eo.missing,
        emptyLabel: "No missing previous-cycle item.",
      },
    ],
    tables: [
      {
        title: "Observed response per cycle",
        columns: ["Cycle", "Retrieved", "MII", "Fertilized", "Blastocysts", "Outcome"],
        rows: eo.observedRows.map((r) => [
          r.label,
          r.retrieved,
          r.mii,
          r.fertilized,
          r.blastocysts,
          r.pregnancy,
        ]),
        emptyLabel: "No previous cycle recorded.",
      },
    ],
    pendingNote: eo.pendingNote,
  };
}

function sectionCompleteness(
  ctx: PatientContext,
  ci: CycleIntelligenceResult,
): IntelligenceSection {
  const d = ctx.dataset;
  return {
    id: "data-completeness",
    number: 0,
    title: "Data Completeness & Missing-Data Register",
    icon: "listChecks",
    status: d.overall === 100 ? "complete" : d.overall === 0 ? "no-data" : "partial",
    summary: `Overall data-completeness score ${d.overall}% · ${d.recorded} of ${d.total} assessment fields recorded · ${d.missing.length} item(s) in the missing-data register.`,
    fields: d.scores.map((s) => ({
      label: s.label,
      value: `${s.percent}% (${s.recorded}/${s.total})`,
      present: s.percent > 0,
    })),
    lists: [
      {
        title: "Previous-cycle data validation",
        items: ci.issues.map((i) => `${i.cycleLabel} — ${i.message}`),
        emptyLabel: "No previous-cycle validation flag.",
      },
    ],
    tables: [
      {
        title: "Missing-data register",
        columns: ["Item", "Why it is needed"],
        rows: d.missing.map((m) => [m.label, m.detail]),
        emptyLabel: "No outstanding assessment item.",
      },
      {
        title: "Completeness by assessment step",
        columns: ["Step", "Recorded", "Total", "Percent"],
        rows: d.sections.map((s) => [
          s.title,
          String(s.recorded),
          String(s.total),
          `${s.percent}%`,
        ]),
        emptyLabel: "No assessment data recorded.",
      },
    ],
  };
}

/* ----------------------------------------------------------- explanations */

function buildExplanations(input: IntelligenceReportInput): ModuleExplanation[] {
  const { phenotype, response, protocol, gonadotropin, consort, monitoring, cycle } = input;
  const p = phenotype.poseidon;
  const b = phenotype.bologna;

  return [
    {
      moduleId: "poseidon",
      name: "POSEIDON Classification Engine",
      evaluated:
        "Whether the recorded age, ovarian reserve markers and previous ovarian response place the patient in one of the published POSEIDON groups.",
      inputs: p.completeness.labels,
      reasoning: p.rationale,
      evidence: p.evidence,
      unavailable: p.missing,
      inactive: [],
      status: "active",
      confidence: p.confidence,
    },
    {
      moduleId: "bologna",
      name: "Bologna Poor-Responder Engine",
      evaluated:
        "Whether the recorded data satisfy the ESHRE Bologna definition of poor ovarian response (Ferraretti 2011).",
      inputs: [
        ...b.satisfied.map((c) => c.label),
        ...b.notSatisfied.map((c) => c.label),
        ...b.unknown.map((c) => c.label),
      ],
      reasoning: b.rationale,
      evidence: b.evidence,
      unavailable: b.missing,
      inactive: [],
      status: "active",
      confidence: null,
    },
    {
      moduleId: "ovarian-reserve",
      name: "Ovarian Reserve Panel",
      evaluated:
        "The recorded AMH, antral follicle count, basal FSH and age, categorised against the thresholds already published in the POSEIDON and Bologna definitions.",
      inputs: ["AMH", "Antral follicle count", "Basal FSH", "Age"],
      reasoning: phenotype.reserve.contributors,
      evidence: phenotype.evidence,
      unavailable: phenotype.reserve.missing,
      inactive: [],
      status: "active",
      confidence: null,
    },
    {
      moduleId: "poor-response",
      name: "Ovarian Response Prediction Engine",
      evaluated:
        "The expected ovarian response phenotype and the stimulation risks that follow from the recorded baseline markers and previous cycle outcomes.",
      inputs: response.variables.filter((v) => v.present).map((v) => `${v.label}: ${v.value}`),
      reasoning: [
        response.headline,
        ...response.explanation.contributingVariables,
        ...response.risks.map((r) => `${r.label}: ${r.basis}`),
      ],
      evidence: response.evidence,
      unavailable: response.explanation.missingInformation,
      inactive: [],
      status: "active",
      confidence: response.confidence,
    },
    {
      moduleId: "protocol-recommendation",
      name: "Protocol Recommendation Engine",
      evaluated:
        "The patient summary and clinical considerations that a future protocol rule set will consume. No protocol was selected.",
      inputs: protocol.dataSources.filter((d) => d.available).map((d) => `${d.label}: ${d.detail}`),
      reasoning: [protocol.recommendation.message],
      evidence: protocol.recommendation.evidenceSource,
      unavailable: protocol.dataSources.filter((d) => !d.available).map((d) => d.label),
      inactive: ["Protocol selection rules", "Contraindication rules", "Alternative ranking"],
      status: "pending-evidence",
      confidence: null,
    },
    {
      moduleId: "gonadotropin-selection",
      name: "Gonadotropin Selection Engine",
      evaluated:
        "The patient summary, previous medication exposure and previous cycle outcomes that a future medication rule set will consume. No medication was selected.",
      inputs: gonadotropin.dataSources
        .filter((d) => d.available)
        .map((d) => `${d.label}: ${d.detail}`),
      reasoning: [gonadotropin.selection.message],
      evidence: gonadotropin.selection.evidenceSource,
      unavailable: gonadotropin.dataSources.filter((d) => !d.available).map((d) => d.label),
      inactive: ["Medication selection rules", "Indication and contraindication tables"],
      status: "pending-evidence",
      confidence: null,
    },
    {
      moduleId: "consort-dose",
      name: "CONSORT Starting Dose Calculator",
      evaluated:
        "Whether every mandatory CONSORT variable is present and valid, and — when the published band table is loaded — the individualised recombinant FSH starting dose.",
      inputs: consort.variables
        .filter((v) => v.status === "available")
        .map((v) => `${v.label}: ${v.display}`),
      reasoning: consort.narrative,
      evidence: consort.evidenceSource,
      unavailable: [
        ...consort.validation.missing.map((v) => v.label),
        ...consort.validation.invalid.map((v) => v.label),
      ],
      inactive: consort.status === "completed" ? [] : ["CONSORT dose band table not transcribed"],
      status: consort.status === "completed" ? "active" : "pending-evidence",
      confidence: null,
    },
    {
      moduleId: "dose-adjustment",
      name: "Stimulation Monitoring Engine",
      evaluated:
        "The entered monitoring visits, the arithmetic change between consecutive measurements and the completeness of the monitoring record. No dose adjustment was produced.",
      inputs: monitoring.context.items
        .filter((i) => i.available)
        .map((i) => `${i.label}: ${i.value}`),
      reasoning: [
        monitoring.statusDetail,
        ...monitoring.trends.map((t) => `${t.label}: ${t.change}`),
      ],
      evidence: monitoring.evidenceSource,
      unavailable: monitoring.completeness.missingByVisit.flatMap((v) =>
        v.missing.map((m) => `Day ${v.day}: ${m}`),
      ),
      inactive: ["Dose adjustment rules", "Cancellation criteria"],
      status: "pending-evidence",
      confidence: monitoring.completeness.percent,
    },
    {
      moduleId: "trigger-recommendation",
      name: "Cycle Completion & Safety Engine",
      evaluated:
        "The end-of-stimulation data surface: trigger variables, OHSS markers and freeze-all variables. No trigger, OHSS classification or freeze-all indication was produced.",
      inputs: cycle.context.filter((c) => c.available).map((c) => `${c.label}: ${c.value}`),
      reasoning: [
        cycle.safetyStatusDetail,
        ...cycle.alerts.map((a) => `${a.label}: ${a.observation}`),
      ],
      evidence: cycle.evidenceSource,
      unavailable: cycle.missingInformation,
      inactive: [
        "Trigger criteria",
        "OHSS risk thresholds and severity classification",
        "Freeze-all indications",
      ],
      status: "pending-evidence",
      confidence: cycle.progress.monitoringCompleteness,
    },
  ];
}

/* ------------------------------------------------------- quality control */

function buildQualityIssues(input: IntelligenceReportInput): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const { phenotype, response, consort, monitoring, cycle } = input;

  for (const m of phenotype.missing) {
    issues.push({
      id: `missing-${m.id}`,
      kind: "missing",
      label: m.label,
      detail: `Complete the "${m.stepId}" step of the patient assessment.`,
    });
  }
  for (const v of response.validation.missing) {
    if (issues.some((i) => i.label.includes(v.label))) continue;
    issues.push({
      id: `missing-response-${v.id}`,
      kind: "missing",
      label: `Missing ${v.label}`,
      detail: "Required by the ovarian response prediction engine.",
    });
  }
  for (const c of response.validation.conflicting) {
    issues.push({
      id: `conflict-response-${issues.length}`,
      kind: "conflict",
      label: "Conflicting information",
      detail: c,
    });
  }
  for (const d of consort.validation.duplicates) {
    issues.push({
      id: `duplicate-${d.id}`,
      kind: "duplicate",
      label: d.label,
      detail: d.detail,
    });
  }
  for (const c of consort.validation.conflicts) {
    issues.push({ id: `conflict-${c.id}`, kind: "conflict", label: c.label, detail: c.detail });
  }
  for (const v of consort.validation.invalid) {
    issues.push({
      id: `invalid-${v.id}`,
      kind: "conflict",
      label: `${v.label} is outside the possible range`,
      detail: v.issue ?? "Value could not be validated.",
    });
  }
  for (const h of response.validation.incompleteHistory) {
    issues.push({
      id: `incomplete-history-${issues.length}`,
      kind: "incomplete",
      label: "Incomplete cycle history",
      detail: h,
    });
  }
  if (phenotype.pendingAssessments.length) {
    issues.push({
      id: "incomplete-assessments",
      kind: "incomplete",
      label: "Incomplete assessments",
      detail: phenotype.pendingAssessments.join("; "),
    });
  }
  if (monitoring.visits.length > 0 && monitoring.completeness.percent < 100) {
    issues.push({
      id: "incomplete-monitoring",
      kind: "incomplete",
      label: "Incomplete monitoring record",
      detail: `${monitoring.completeness.recordedFields} of ${monitoring.completeness.expectedFields} expected monitoring fields are recorded.`,
    });
  }
  const days = monitoring.visits.map((v) => v.day);
  const duplicateDays = days.filter((d, i) => days.indexOf(d) !== i);
  for (const d of Array.from(new Set(duplicateDays))) {
    issues.push({
      id: `duplicate-day-${d}`,
      kind: "duplicate",
      label: `Duplicate monitoring visit on stimulation day ${d}`,
      detail: "Two visits share the same stimulation day; review the monitoring record.",
    });
  }
  cycle.missingInformation.forEach((item, index) => {
    if (issues.some((i) => i.detail === item || i.label === item)) return;
    issues.push({
      id: `missing-cycle-${index}`,
      kind: "missing",
      label: item,
      detail: "Required by the cycle completion data surface.",
    });
  });
  return issues;
}

/* --------------------------------------------------- application status */

function buildApplicationStatus(input: IntelligenceReportInput): ApplicationStatus {
  const active = engineModules
    .filter((m) => m.implementation === "implemented")
    .map((m) => ({ id: m.id, name: m.name }));
  const framework = engineModules
    .filter((m) => m.implementation === "awaiting-evidence")
    .map((m) => ({ id: m.id, name: m.name }));
  const pending = engineModules
    .filter((m) => m.implementation === "planned" || m.implementation === "not-implemented")
    .map((m) => ({ id: m.id, name: m.name }));

  const missingEvidence = blockedModules
    .filter((b) => b.status !== "ACTIVE")
    .map((b) => ({
      module: b.name,
      items: b.requirements
        .filter((r) => r.status !== "satisfied")
        .map((r) => `${r.item} — ${r.source}${r.locator ? ` (${r.locator})` : ""}`),
    }));

  const { phenotype, response, protocol, gonadotropin, consort, monitoring, cycle } = input;
  const totalFields = 12;
  const assessmentComplete = totalFields - Math.min(phenotype.missing.length, totalFields);

  const progress: ActivationProgress[] = [
    {
      id: "assessment",
      label: "Assessment",
      complete: assessmentComplete,
      total: totalFields,
      percent: percent(assessmentComplete, totalFields),
      detail: `${phenotype.missing.length} core variable(s) outstanding.`,
    },
    {
      id: "phenotype",
      label: "Phenotype",
      complete: phenotype.completedAssessments.length,
      total: phenotype.completedAssessments.length + phenotype.pendingAssessments.length || 1,
      percent: percent(
        phenotype.completedAssessments.length,
        phenotype.completedAssessments.length + phenotype.pendingAssessments.length || 1,
      ),
      detail: `POSEIDON, Bologna, ovarian reserve and response prediction are active. Expected response: ${responseCategoryLabel[response.category]}.`,
    },
    {
      id: "clinical-decisions",
      label: "Clinical Decisions",
      complete:
        (protocol.recommendation.status === "available" ? 1 : 0) +
        (gonadotropin.selection.status === "available" ? 1 : 0) +
        (consort.status === "completed" ? 1 : 0),
      total: 3,
      percent: percent(
        (protocol.recommendation.status === "available" ? 1 : 0) +
          (gonadotropin.selection.status === "available" ? 1 : 0) +
          (consort.status === "completed" ? 1 : 0),
        3,
      ),
      detail:
        "Protocol, gonadotropin and starting-dose rules activate once the published tables are transcribed into the Evidence Library.",
    },
    {
      id: "monitoring",
      label: "Monitoring",
      complete: monitoring.completeness.recordedFields,
      total: monitoring.completeness.expectedFields || 1,
      percent: monitoring.completeness.percent,
      detail: `${monitoring.visits.length} visit(s) recorded. Dose adjustment rules remain inactive.`,
    },
    {
      id: "safety",
      label: "Safety",
      complete: 0,
      total: 3,
      percent: 0,
      detail: `Trigger, OHSS and freeze-all algorithms are locked. ${cycle.summary.outstanding.length} outstanding monitoring item(s).`,
    },
    {
      id: "reporting",
      label: "Reporting",
      complete: 1,
      total: 1,
      percent: 100,
      detail:
        "The IVF Clinical Intelligence Report is active and aggregates every implemented engine.",
    },
  ];

  return {
    active,
    framework,
    pending,
    missingEvidence,
    requirementCount: totalRequirementCount,
    progress,
  };
}

/* ----------------------------------------------------------------- build */

export function buildIntelligenceReport(input: IntelligenceReportInput): IntelligenceReport {
  const evidenceIds = Array.from(
    new Set([
      ...input.phenotype.evidence,
      ...input.phenotype.poseidon.evidence,
      ...input.phenotype.bologna.evidence,
      ...input.response.evidence,
      ...input.protocol.recommendation.evidenceSource,
      ...input.gonadotropin.selection.evidenceSource,
      ...input.consort.evidenceSource,
      ...input.monitoring.evidenceSource,
      ...input.cycle.evidenceSource,
    ]),
  );
  const evidence = evidenceIds
    .map((id) => findEvidence(id))
    .filter((e): e is EvidenceEntry => Boolean(e));

  const now = new Date();
  const audit: AuditTrail = {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    applicationVersion: APPLICATION_VERSION,
    algorithmVersions: [
      { label: "Patient Phenotype Engine", version: input.phenotype.version },
      { label: "Ovarian Response Engine", version: input.response.version },
      { label: "Protocol Recommendation Engine", version: input.protocol.version },
      { label: "Gonadotropin Selection Engine", version: input.gonadotropin.version },
      { label: "CONSORT Starting Dose Calculator", version: input.consort.version },
      { label: "Monitoring Engine", version: input.monitoring.version },
      { label: "Cycle Completion & Safety Engine", version: input.cycle.version },
    ],
    evidenceLibraryVersion: evidenceLibraryVersion(),
    reportVersion: INTELLIGENCE_REPORT_VERSION,
    user: input.user ?? "Clinician (local session)",
    calculationTimestamp: now.toISOString(),
  };

  const ctx = buildPatientContext(input.values, input.cycles, input.response);
  const ci = ctx.cycleIntelligence;

  const sections = [
    section1(input),
    sectionHistory(ctx),
    sectionEndocrineUltrasound(ctx),
    section2(input),
    section3(input),
    sectionCycleRecords(ci),
    sectionCycleComparison(ci),
    sectionExpectedObserved(ci),
    section4(input),
    section5(input),
    section6(input),
    sectionStartingDose(input),
    section7(input),
    section8(input),
    sectionCompleteness(ctx, ci),
    section9(evidence),
  ].map((s, i) => ({ ...s, number: i + 1 }));

  const cycleIssues: QualityIssue[] = ci.issues.map((i) => ({
    id: `cycle-${i.id}`,
    kind: i.level === "incomplete" ? "incomplete" : "conflict",
    label: `${i.cycleLabel} — ${i.field}`,
    detail: i.message,
  }));

  const datasetMissing: QualityIssue[] = ctx.dataset.missing
    .filter((m) => m.category !== "optional")
    .map((m) => ({
      id: `dataset-missing-${m.key}`,
      kind: "missing" as const,
      label: `Missing ${m.label}`,
      detail: m.detail,
    }));

  const issues = [...buildQualityIssues(input), ...cycleIssues];
  for (const m of datasetMissing) {
    if (!issues.some((i) => i.label === m.label || i.detail === m.detail)) issues.push(m);
  }

  return {
    patientId: input.patientId,
    patientName: input.patientName,
    sections,
    cycleDetails: ci.cycles,
    qualityIssues: issues,
    explanations: buildExplanations(input),
    applicationStatus: buildApplicationStatus(input),
    evidence,
    audit,
    disclaimer: REPORT_DISCLAIMER,
    generatedAt: now.toISOString(),
    version: INTELLIGENCE_REPORT_VERSION,
  };
}

/* ------------------------------------------------------------- exporters */

export function intelligenceReportText(r: IntelligenceReport): string {
  const out: string[] = [
    "IVF CLINICAL INTELLIGENCE REPORT",
    `Patient: ${r.patientName}`,
    `Generated: ${new Date(r.generatedAt).toLocaleString()}`,
    `Report version: v${r.version} · Evidence Library ${r.audit.evidenceLibraryVersion}`,
    "",
  ];

  for (const s of r.sections) {
    out.push(`SECTION ${s.number} — ${s.title.toUpperCase()}`);
    out.push(s.summary);
    for (const f of s.fields) out.push(`- ${f.label}: ${f.value}`);
    for (const l of s.lists) {
      out.push(`  ${l.title}`);
      if (l.items.length === 0) out.push(`  · ${l.emptyLabel ?? "None recorded."}`);
      for (const i of l.items) out.push(`  · ${i}`);
    }
    for (const t of s.tables) {
      out.push(`  ${t.title}`);
      if (t.rows.length === 0) out.push(`  · ${t.emptyLabel ?? "No data."}`);
      for (const row of t.rows) out.push(`  · ${row.join(" | ")}`);
    }
    if (s.pendingNote) out.push(`  Note: ${s.pendingNote}`);
    out.push("");
  }

  if (r.cycleDetails.length) {
    out.push("PREVIOUS CYCLE RECORDS — FULL DETAIL");
    for (const c of r.cycleDetails) {
      out.push(`${c.label} — ${c.outcome} · ${c.percent}% documented`);
      for (const g of c.groups) {
        out.push(`  ${g.title}`);
        for (const f of g.fields) out.push(`    - ${f.label}: ${f.value}`);
      }
      if (c.issues.length) {
        out.push("  Data validation");
        for (const i of c.issues) out.push(`    - ${i.message}`);
      }
      out.push("");
    }
  }

  out.push(`SECTION ${r.sections.length + 1} — CLINICAL EXPLANATION`);
  for (const e of r.explanations) {
    out.push(`${e.name} — ${moduleAlgorithmStatusLabel[e.status]}`);
    out.push(`  What was evaluated: ${e.evaluated}`);
    out.push(`  Variables analysed: ${e.inputs.length ? e.inputs.join("; ") : "None available."}`);
    out.push(`  Why this output: ${e.reasoning.filter(Boolean).join(" ") || "Not applicable."}`);
    out.push(
      `  Evidence used: ${
        e.evidence.map((id) => findEvidence(id)?.title ?? id).join("; ") || "None linked."
      }`,
    );
    out.push(
      `  Variables unavailable: ${e.unavailable.length ? e.unavailable.join("; ") : "None."}`,
    );
    out.push(`  Inactive algorithms: ${e.inactive.length ? e.inactive.join("; ") : "None."}`);
    out.push("");
  }

  out.push(`SECTION ${r.sections.length + 2} — APPLICATION STATUS`);
  out.push(`Active modules: ${r.applicationStatus.active.map((m) => m.name).join(", ")}`);
  out.push(`Framework modules: ${r.applicationStatus.framework.map((m) => m.name).join(", ")}`);
  out.push(`Pending algorithms: ${r.applicationStatus.pending.map((m) => m.name).join(", ")}`);
  out.push(`Outstanding evidence requirements: ${r.applicationStatus.requirementCount}`);
  for (const p of r.applicationStatus.progress)
    out.push(`- ${p.label}: ${p.percent}% — ${p.detail}`);
  out.push("");

  out.push(`SECTION ${r.sections.length + 3} — AUDIT TRAIL`);
  out.push(`Date: ${r.audit.date}`);
  out.push(`Time: ${r.audit.time}`);
  out.push(`Application version: v${r.audit.applicationVersion}`);
  for (const a of r.audit.algorithmVersions)
    out.push(`Algorithm version — ${a.label}: v${a.version}`);
  out.push(`Evidence Library version: ${r.audit.evidenceLibraryVersion}`);
  out.push(`Report version: v${r.audit.reportVersion}`);
  out.push(`User: ${r.audit.user}`);
  out.push(`Calculation timestamp: ${r.audit.calculationTimestamp}`);
  out.push("");

  out.push("QUALITY CONTROL");
  if (r.qualityIssues.length === 0) out.push("- No data-quality issue detected.");
  for (const q of r.qualityIssues)
    out.push(`- ${qualityIssueLabel[q.kind]}: ${q.label} — ${q.detail}`);
  out.push("");

  out.push("DISCLAIMER");
  out.push(...r.disclaimer);

  return out.join("\n");
}

/** Full report object for research archives and future validation studies. */
export function intelligenceReportJson(r: IntelligenceReport): string {
  return JSON.stringify(r, null, 2);
}

/** Flat, analysis-ready clinical data export (one key per documented variable). */
export function structuredClinicalData(r: IntelligenceReport): string {
  const rows: { key: string; value: string; source: string }[] = [];
  for (const s of r.sections) {
    for (const f of s.fields) {
      rows.push({ key: f.label, value: f.value, source: `Section ${s.number} — ${s.title}` });
    }
    for (const t of s.tables) {
      t.rows.forEach((row, i) => {
        rows.push({
          key: `${t.title} · row ${i + 1}`,
          value: row.join(" | "),
          source: `Section ${s.number} — ${s.title}`,
        });
      });
    }
  }
  for (const c of r.cycleDetails) {
    for (const g of c.groups) {
      for (const f of g.fields) {
        rows.push({
          key: `${c.label} · ${f.label}`,
          value: f.value,
          source: `Previous cycle — ${g.title}`,
        });
      }
    }
  }
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    ["variable", "value", "section"].join(","),
    ...rows.map((r2) => [escape(r2.key), escape(r2.value), escape(r2.source)].join(",")),
  ].join("\n");
}
