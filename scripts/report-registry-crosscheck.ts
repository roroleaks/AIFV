/**
 * Report Registry Cross-Check Script (Phase 4 Commit 1 verification)
 *
 * Asserts that:
 * 1. buildIntelligenceReport produces 16 sections.
 * 2. ReportSectionRegistry wraps all 16 sections 1-to-1 without dropping or inventing any.
 * 3. Section IDs, titles, and order match exactly.
 */

import { buildIntelligenceReport } from "../src/lib/report/intelligence-report";
import {
  REPORT_SECTIONS,
  compileReportSections,
  buildRawReport,
} from "../src/features/report/ReportSectionRegistry";
import {
  runStratification,
  runProtocolPlan,
  runTriggerDecision,
} from "../src/services/clinical/orchestrators";
import type { ClinicalCaseInput } from "../src/services/clinical/types";

const mockCase: ClinicalCaseInput = {
  patient: {
    id: "pat-crosscheck",
    name: "Sarah Jenkins",
    age: 32,
    fileNumber: "MRN-00482",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    infertilityType: "Primary Infertility",
    infertilityDuration: 3,
    causes: ["Tubal factor"],
    cycles: 1,
    values: {
      fullName: "Sarah Jenkins",
      dob: "1994-05-12",
      amh: 2.4,
      afc: 14,
      fsh: 6.8,
      lh: 4.5,
      weight: 62,
      height: 168,
      bmi: 22.0,
    },
    cycleRecords: [],
  },
  visits: [],
};

const strat = runStratification(mockCase);
const plan = runProtocolPlan(mockCase, strat);
const trig = runTriggerDecision(mockCase, strat, plan);

const rawReport = buildRawReport(mockCase, strat, plan, trig);

console.log(`Raw buildIntelligenceReport section count: ${rawReport.sections.length}`);
if (rawReport.sections.length !== 16) {
  console.error(`FAIL: Expected 16 raw sections, got ${rawReport.sections.length}`);
  process.exit(1);
}

console.log(`ReportSectionRegistry section definitions: ${REPORT_SECTIONS.length}`);
if (REPORT_SECTIONS.length !== 16) {
  console.error(`FAIL: Expected 16 registry sections, got ${REPORT_SECTIONS.length}`);
  process.exit(1);
}

const reportCtx = {
  caseId: mockCase.patient.id,
  caseMetadata: {
    id: mockCase.patient.id,
    patient: mockCase.patient,
    visits: [],
    derived: {
      age: 32,
      bmi: 22,
      infertilityDuration: 3,
      parity: "G0P0",
      primaryCause: "Tubal factor",
      cycleCount: 1,
    },
    currentStimDay: 0,
    leadFollicleSize: 0,
    folliclesGte14: 0,
    folliclesGte17: 0,
    estradiol: null,
    estradiolTrend: "flat" as const,
    ohssRisk: "low" as const,
    state: "Draft" as const,
    firewallBreached: false,
  },
  encounters: [],
  orchestratorOutputs: {
    stratification: strat,
    plan,
    trigger: trig,
  },
  effectiveOverrides: [],
  rawIntelligenceReport: rawReport,
};

const compiledSections = compileReportSections(reportCtx);

console.log(`Compiled sections count: ${compiledSections.length}`);
if (compiledSections.length !== 16) {
  console.error(`FAIL: Expected 16 compiled sections, got ${compiledSections.length}`);
  process.exit(1);
}

for (let i = 0; i < 16; i++) {
  const raw = rawReport.sections[i];
  const compiled = compiledSections[i];
  const def = REPORT_SECTIONS[i];

  if (raw.id !== def.id || raw.id !== compiled.id) {
    console.error(
      `FAIL: Section ${i + 1} ID mismatch: raw=${raw.id}, def=${def.id}, compiled=${compiled.id}`,
    );
    process.exit(1);
  }

  if (raw.title !== def.title || raw.title !== compiled.title) {
    console.error(
      `FAIL: Section ${i + 1} Title mismatch: raw="${raw.title}", def="${def.title}", compiled="${compiled.title}"`,
    );
    process.exit(1);
  }

  console.log(`  OK [${i + 1}/16] Section: "${compiled.id}" -> "${compiled.title}"`);
}

console.log(
  "\n[CROSS-CHECK PASS] All 16 sections match buildIntelligenceReport 1:1 in ID, title, and sequence!",
);
