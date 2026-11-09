/**
 * PDF Export Regression Test (§4.9)
 *
 * Asserts that:
 *  1. File exists and is non-empty.
 *  2. File size is > 10 KB (full multi-page clinical dossier, not blank).
 *  3. Filename strictly matches {caseId}_v{version}_{ISOdate}.pdf (Zero PHI).
 *  4. PDF text contains the SIGNED footer + signatory + timestamp.
 *  5. PDF text contains ZERO Markdown artifacts (**, |---|, # headings).
 *  6. Export duration < 3s.
 */

import fs from "fs";
import path from "path";
import { generatePdfBuffer, getPdfFilename } from "../src/features/report/exporters/exportPdf";
import {
  runStratification,
  runProtocolPlan,
  runTriggerDecision,
} from "../src/services/clinical/orchestrators";
import {
  buildRawReport,
  compileReportSections,
} from "../src/features/report/ReportSectionRegistry";
import type { Report, ReportContext } from "../src/features/report/types";
import type { ClinicalCaseInput } from "../src/services/clinical/types";

console.log("================================================================================");
console.log("STARTING AIFV PDF EXPORT REGRESSION TEST");
console.log("================================================================================");

const startTime = Date.now();

const mockCase: ClinicalCaseInput = {
  patient: {
    id: "case-alpha-847",
    name: "Eleanor Vance",
    age: 33,
    fileNumber: "MRN-00847",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    infertilityType: "Primary Infertility",
    infertilityDuration: 3,
    causes: ["Tubal factor"],
    cycles: 1,
    values: {
      fullName: "Eleanor Vance",
      dob: "1993-08-20",
      amh: 2.8,
      afc: 16,
      fsh: 6.2,
      lh: 4.8,
      weight: 64,
      height: 170,
      bmi: 22.1,
    },
    cycleRecords: [],
  },
  visits: [
    {
      id: "v-1",
      patientId: "case-alpha-847",
      day: 6,
      date: "2026-11-04",
      follicles: [13, 12, 11, 11, 10],
      largestFollicle: 13,
      endometrium: 7.2,
      estradiol: 540,
      lh: 2.1,
      progesterone: 0.5,
      fshDose: 200,
      medications: [{ name: "rFSH", dose: "200 IU" }],
      notes: "Steady follicular cohort response",
    },
  ],
};

const strat = runStratification(mockCase);
const plan = runProtocolPlan(mockCase, strat);
const trig = runTriggerDecision(mockCase, strat, plan);
const rawReport = buildRawReport(mockCase, strat, plan, trig);

const ctx: ReportContext = {
  caseId: "case-alpha-847",
  caseMetadata: {
    id: "case-alpha-847",
    patient: mockCase.patient,
    visits: mockCase.visits ?? [],
    derived: {
      age: 33,
      bmi: 22.1,
      infertilityDuration: 3,
      parity: "G0P0",
      primaryCause: "Tubal factor",
      cycleCount: 1,
    },
    currentStimDay: 6,
    leadFollicleSize: 13,
    folliclesGte14: 0,
    folliclesGte17: 0,
    estradiol: 540,
    estradiolTrend: "up",
    ohssRisk: "low",
    state: "Signed",
    firewallBreached: false,
  },
  encounters: [],
  orchestratorOutputs: {
    stratification: strat,
    plan,
    trigger: trig,
  },
  effectiveOverrides: [
    {
      id: "ov-protocol",
      caseId: "case-alpha-847",
      engine: "protocol-recommendation",
      field: "protocol",
      fromValue: "standard-antagonist",
      toValue: "flexible-antagonist",
      reason: "Patient preference and clinic operational schedule alignment.",
      by: "Dr. Raouf Roshdy",
      at: "2026-11-04T11:00:00Z",
    },
  ],
  rawIntelligenceReport: rawReport,
};

const compiledSections = compileReportSections(ctx);

const signedTimestamp = "2026-11-04T12:30:00.000Z";
const signedReport: Report = {
  id: "rep-case-alpha-847-v1",
  caseId: "case-alpha-847",
  version: 1,
  status: "Signed",
  locked: true,
  signedBy: "Raouf Roshdy",
  signedAt: signedTimestamp,
  snapshot: {
    encounters: [],
    orchestratorOutputs: {
      stratification: strat,
      plan,
      trigger: trig,
    },
    effectiveOverrides: ctx.effectiveOverrides,
    caseMetadata: ctx.caseMetadata,
  },
  sections: compiledSections,
  signEvents: [
    {
      at: signedTimestamp,
      by: "dr_roshdy",
      action: "signed",
      note: "Formal clinical sign-off.",
    },
  ],
};

// 1. Generate PDF
const filename = getPdfFilename(signedReport);
const { buffer, extractedText } = generatePdfBuffer(signedReport);
const durationMs = Date.now() - startTime;

console.log(`[GENERATED] PDF generated in ${durationMs}ms`);
if (durationMs > 3000) {
  console.error(`FAIL: PDF generation took ${durationMs}ms (> 3000ms target)`);
  process.exit(1);
}
console.log(`[PASS] Export speed target satisfied (< 3s): ${durationMs}ms`);

// 2. Write file to disk for inspection
const outDir = path.resolve(process.cwd(), "scripts/fixtures");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, filename);
fs.writeFileSync(outPath, buffer);

// Assert 1: File exists and is non-empty
if (!fs.existsSync(outPath)) {
  console.error("FAIL: PDF output file does not exist on disk.");
  process.exit(1);
}
const stats = fs.statSync(outPath);
if (stats.size === 0) {
  console.error("FAIL: PDF file is empty (0 bytes).");
  process.exit(1);
}
console.log(`[PASS] File exists on disk: ${filename} (${stats.size} bytes).`);

// Assert 2: Size > 10 KB
const minBytes = 10 * 1024;
if (stats.size < minBytes) {
  console.error(`FAIL: PDF size is ${stats.size} bytes, expected > ${minBytes} bytes (> 10 KB).`);
  process.exit(1);
}
console.log(
  `[PASS] PDF file size satisfies > 10 KB requirement: ${(stats.size / 1024).toFixed(1)} KB.`,
);

// Assert 3: Filename matching {caseId}_v{version}_{ISOdate}.pdf with NO patient name (No PHI)
const expectedPattern = /^[\w-]+_v\d+_\d{4}-\d{2}-\d{2}\.pdf$/;
if (!expectedPattern.test(filename)) {
  console.error(
    `FAIL: Filename "${filename}" does not match pattern {caseId}_v{version}_{ISOdate}.pdf`,
  );
  process.exit(1);
}
if (filename.toLowerCase().includes("eleanor") || filename.toLowerCase().includes("vance")) {
  console.error(`FAIL: Filename contains patient name (PHI violation): "${filename}"`);
  process.exit(1);
}
console.log(`[PASS] Filename conforms to strict zero-PHI specification: "${filename}"`);

// Assert 4: PDF text contains SIGNED footer + signatory + timestamp
const expectedSignatory = "Raouf Roshdy";
const expectedFooterSnippet = `SIGNED — Dr. ${expectedSignatory} — ${signedTimestamp}`;
if (!extractedText.includes(expectedFooterSnippet)) {
  console.error(
    `FAIL: Extracted text does not contain signed footer. Expected "${expectedFooterSnippet}"`,
  );
  process.exit(1);
}
console.log(`[PASS] PDF text contains exact SIGNED footer: "${expectedFooterSnippet}"`);

// Assert 5: PDF text does NOT contain Markdown artifacts
const markdownArtifacts = ["**", "|---|", "|:---|", "# SECTION", "## ", "### ", "```"];

for (const artifact of markdownArtifacts) {
  if (extractedText.includes(artifact)) {
    console.error(`FAIL: PDF text contains Markdown artifact: "${artifact}"`);
    process.exit(1);
  }
}
console.log("[PASS] PDF text is 100% free of Markdown artifacts (**, |---|, #).");

// Clean up generated test file
try {
  fs.unlinkSync(outPath);
} catch {
  /* ignore */
}

console.log("\n================================================================================");
console.log("ALL PDF EXPORT REGRESSION TESTS PASSED CLEANLY!");
console.log("================================================================================");
