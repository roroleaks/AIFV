/**
 * Section Registry (§2.2, §3)
 *
 * Maps each of the 16 sections from buildIntelligenceReport in src/lib/report/intelligence-report.ts
 * to a typed renderer that annotates the section with presentation-layer overrides
 * without touching or re-implementing any pure clinical engine.
 */

import {
  buildIntelligenceReport,
  type IntelligenceReport,
  type IntelligenceReportInput,
  type IntelligenceSection,
} from "@/lib/report/intelligence-report";
import { buildMonitoringContext, analyzeMonitoring } from "@/lib/engine/monitoring";
import type {
  ReportSection,
  ReportSectionContent,
  ReportContext,
  ReportSectionOverride,
  SectionAdminConfig,
} from "./types";
import type { ClinicalCaseInput } from "@/services/clinical/types";

/**
 * Helper to construct the upstream IntelligenceReportInput from case state & orchestrators
 * and invoke buildIntelligenceReport (pure wrapper, zero modified logic).
 */
export function buildRawReport(
  caseInput: ClinicalCaseInput,
  stratification: ReportContext["orchestratorOutputs"]["stratification"],
  plan: ReportContext["orchestratorOutputs"]["plan"],
  trigger: ReportContext["orchestratorOutputs"]["trigger"],
): IntelligenceReport {
  const patient = caseInput.patient;
  const values = patient.values ?? {};
  const cycles = patient.cycleRecords ?? [];
  const visits = caseInput.visits ?? [];

  const mctx = buildMonitoringContext(
    patient.id,
    patient.name || "Patient",
    values,
    cycles,
    stratification.phenotype,
    stratification.ovarianResponse,
    plan.protocol,
    plan.gonadotropin,
    null,
  );
  const monitoring = analyzeMonitoring(mctx, visits);

  const input: IntelligenceReportInput = {
    patientId: patient.id,
    patientName: patient.name || "Patient",
    values,
    cycles,
    phenotype: stratification.phenotype,
    response: stratification.ovarianResponse,
    protocol: plan.protocol,
    protocolSelection: plan.selection,
    gonadotropin: plan.gonadotropin,
    startingDose: plan.startingDose,
    consort: plan.consort,
    monitoring,
    cycle: trigger.cycleCompletion,
    user: "Physician (CDSS)",
  };

  return buildIntelligenceReport(input);
}

/**
 * Inspects effective overrides to attach presentation-layer annotations to a section.
 */
function findSectionOverrides(sectionId: string, ctx: ReportContext): ReportSectionOverride[] {
  const overrides: ReportSectionOverride[] = [];

  for (const o of ctx.effectiveOverrides) {
    if (sectionId === "stimulation-plan" && o.engine === "protocol-recommendation") {
      overrides.push({
        field: o.field,
        label: "Protocol Plan",
        originalValue: String(o.fromValue ?? "Recommended"),
        overrideValue: String(o.toValue ?? ""),
        reason: o.reason,
        overriddenBy: o.by,
        overriddenAt: o.at,
      });
    }

    if (
      (sectionId === "starting-dose" || sectionId === "consort-dose") &&
      (o.engine === "starting-dose" || o.engine === "gonadotropin-selection")
    ) {
      overrides.push({
        field: o.field,
        label: o.field === "lhAddon" ? "LH Add-on" : "Starting Dose",
        originalValue: String(o.fromValue ?? "—"),
        overrideValue: String(o.toValue ?? ""),
        reason: o.reason,
        overriddenBy: o.by,
        overriddenAt: o.at,
      });
    }

    if (sectionId === "cycle-completion" && o.engine === "trigger") {
      overrides.push({
        field: o.field,
        label: "Trigger Agent",
        originalValue: String(o.fromValue ?? "Standard"),
        overrideValue: String(o.toValue ?? ""),
        reason: o.reason,
        overriddenBy: o.by,
        overriddenAt: o.at,
      });
    }
  }

  return overrides;
}

/**
 * Wrap a single section from buildIntelligenceReport into ReportSectionContent,
 * annotating it with active presentation-layer overrides if present.
 */
function createSectionRenderer(sectionId: string): (ctx: ReportContext) => ReportSectionContent {
  return (ctx: ReportContext): ReportSectionContent => {
    const rawSection: IntelligenceSection | undefined = ctx.rawIntelligenceReport.sections.find(
      (s) => s.id === sectionId,
    );

    if (!rawSection) {
      return {
        id: sectionId,
        number: 0,
        title: sectionId,
        status: "no-data",
        summary: "Section pending clinical data",
        fields: [],
        lists: [],
        tables: [],
        pendingNote: undefined,
        overrides: undefined,
      };
    }

    const sectionOverrides = findSectionOverrides(sectionId, ctx);

    // Make a copy of fields to annotate effective values
    const fields = rawSection.fields.map((f) => {
      // Check if this field was overridden
      const ov = sectionOverrides.find(
        (o) =>
          f.label.toLowerCase().includes(o.label.toLowerCase()) ||
          (o.field === "protocol" && f.label.toLowerCase().includes("protocol")) ||
          (o.field === "startingDose" && f.label.toLowerCase().includes("dose")) ||
          (o.field === "triggerType" && f.label.toLowerCase().includes("trigger")),
      );

      if (ov) {
        return {
          ...f,
          value: `${ov.overrideValue} (Physician Override: ${ov.originalValue} -> ${ov.overrideValue})`,
          detail: `Overridden by ${ov.overriddenBy}: "${ov.reason}"`,
        };
      }
      return f;
    });

    return {
      id: rawSection.id,
      number: rawSection.number,
      title: rawSection.title,
      icon: rawSection.icon,
      status: rawSection.status,
      summary:
        sectionOverrides.length > 0
          ? `${rawSection.summary} [OVERRIDDEN by Physician]`
          : rawSection.summary,
      fields,
      lists: rawSection.lists,
      tables: rawSection.tables,
      pendingNote: rawSection.pendingNote,
      overrides: sectionOverrides.length > 0 ? sectionOverrides : undefined,
    };
  };
}

/**
 * Complete 16-Section Registry matching buildIntelligenceReport output 1:1 (§2.2).
 */
export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "patient-information",
    title: "Patient Information",
    defaultOn: true,
    renderer: createSectionRenderer("patient-information"),
  },
  {
    id: "expanded-history",
    title: "Medical, Surgical & Medication History",
    defaultOn: true,
    renderer: createSectionRenderer("expanded-history"),
  },
  {
    id: "endocrine-ultrasound",
    title: "Endocrine Profile & Ultrasound Findings",
    defaultOn: true,
    renderer: createSectionRenderer("endocrine-ultrasound"),
  },
  {
    id: "baseline-reproductive",
    title: "Baseline Reproductive Assessment",
    defaultOn: true,
    renderer: createSectionRenderer("baseline-reproductive"),
  },
  {
    id: "patient-phenotype",
    title: "Patient Phenotype",
    defaultOn: true,
    renderer: createSectionRenderer("patient-phenotype"),
  },
  {
    id: "previous-cycle-records",
    title: "Previous Cycle Records",
    defaultOn: true,
    renderer: createSectionRenderer("previous-cycle-records"),
  },
  {
    id: "previous-cycle-comparison",
    title: "Previous Cycle Comparison",
    defaultOn: true,
    renderer: createSectionRenderer("previous-cycle-comparison"),
  },
  {
    id: "expected-vs-observed",
    title: "Expected vs Observed Response",
    defaultOn: true,
    renderer: createSectionRenderer("expected-vs-observed"),
  },
  {
    id: "stimulation-plan",
    title: "Protocol Selection & Ovarian Stimulation Plan",
    defaultOn: true,
    renderer: createSectionRenderer("stimulation-plan"),
  },
  {
    id: "gonadotropin-plan",
    title: "Gonadotropin Evidence Review",
    defaultOn: true,
    renderer: createSectionRenderer("gonadotropin-plan"),
  },
  {
    id: "consort-dose",
    title: "CONSORT Starting Dose",
    defaultOn: true,
    renderer: createSectionRenderer("consort-dose"),
  },
  {
    id: "starting-dose",
    title: "Starting Gonadotropin Dose",
    defaultOn: true,
    renderer: createSectionRenderer("starting-dose"),
  },
  {
    id: "monitoring-summary",
    title: "Monitoring Summary",
    defaultOn: true,
    renderer: createSectionRenderer("monitoring-summary"),
  },
  {
    id: "cycle-completion",
    title: "Cycle Completion & Safety",
    defaultOn: true,
    renderer: createSectionRenderer("cycle-completion"),
  },
  {
    id: "data-completeness",
    title: "Data Completeness & Missing-Data Register",
    defaultOn: true,
    renderer: createSectionRenderer("data-completeness"),
  },
  {
    id: "evidence-summary",
    title: "Evidence Summary",
    defaultOn: true,
    renderer: createSectionRenderer("evidence-summary"),
  },
];

/**
 * Default section configuration shape for Clinic Admin (§2.2).
 */
export const DEFAULT_SECTION_ADMIN_CONFIG: SectionAdminConfig[] = REPORT_SECTIONS.map(
  (s, index) => ({
    sectionId: s.id,
    enabled: s.defaultOn,
    order: index + 1,
  }),
);

/**
 * Compiles all enabled sections in configured order for the dossier preview or snapshot.
 */
export function compileReportSections(
  ctx: ReportContext,
  config: SectionAdminConfig[] = DEFAULT_SECTION_ADMIN_CONFIG,
): ReportSectionContent[] {
  const sortedConfig = [...config].sort((a, b) => a.order - b.order);
  const compiled: ReportSectionContent[] = [];

  for (const cfg of sortedConfig) {
    if (!cfg.enabled) continue;
    const def = REPORT_SECTIONS.find((s) => s.id === cfg.sectionId);
    if (!def) continue;
    const content = def.renderer(ctx);
    compiled.push(content);
  }

  // Ensure sequential numbering 1..N
  return compiled.map((s, idx) => ({
    ...s,
    number: idx + 1,
  }));
}
