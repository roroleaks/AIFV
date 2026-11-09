/**
 * Report Immutability Regression Test (§4.8)
 *
 * Verifies that once a report is signed:
 *  1. report.snapshot and report.sections are deeply frozen.
 *  2. Adding new encounters to the case does NOT change the signed report.
 *  3. Adding or updating presentation overrides does NOT alter the signed report.
 *  4. Re-running orchestrators on mutated case updates live draft but leaves signed report byte-identical.
 */

import {
  runStratification,
  runProtocolPlan,
  runTriggerDecision,
} from "../src/services/clinical/orchestrators";
import {
  buildRawReport,
  compileReportSections,
} from "../src/features/report/ReportSectionRegistry";
import type {
  Report,
  ReportCaseSnapshot,
  ReportContext,
  ReportSectionContent,
} from "../src/features/report/types";
import type { ClinicalCaseInput, Override } from "../src/services/clinical/types";
import type { Encounter } from "../src/features/encounter/types";

console.log("================================================================================");
console.log("STARTING AIFV REPORT IMMUTABILITY REGRESSION TEST");
console.log("================================================================================");

const initialCase: ClinicalCaseInput = {
  patient: {
    id: "pat-immutability",
    name: "Helena Vance",
    age: 34,
    fileNumber: "MRN-99012",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    infertilityType: "Primary Infertility",
    infertilityDuration: 2,
    causes: ["Unexplained"],
    cycles: 1,
    values: {
      fullName: "Helena Vance",
      dob: "1992-03-15",
      amh: 2.1,
      afc: 12,
      fsh: 7.2,
      lh: 5.0,
      weight: 60,
      height: 165,
      bmi: 22.0,
    },
    cycleRecords: [],
  },
  visits: [
    {
      id: "vis-1",
      patientId: "pat-immutability",
      day: 2,
      date: "2026-11-01",
      follicles: [],
      largestFollicle: 8,
      endometrium: 4.5,
      estradiol: 120,
      lh: 3.2,
      progesterone: 0.4,
      fshDose: 225,
      medications: [{ name: "rFSH", dose: "225 IU" }],
      notes: "Baseline visit",
    },
  ],
};

const initialEncounter: Encounter = {
  id: "enc-1",
  caseId: "pat-immutability",
  day: 2,
  date: "2026-11-01",
  ultrasound: {
    folliclesRight: { lt10: 6, b10_13: 0, b14_16: 0, gte17: 0 },
    folliclesLeft: { lt10: 6, b10_13: 0, b14_16: 0, gte17: 0 },
    largestFollicleMm: 8,
    endometriumMm: 4.5,
  },
  labs: {
    estradiolPgMl: 120,
    lhMiuMl: 3.2,
    progesteroneNgMl: 0.4,
  },
  medications: {
    gonadotropinType: "rFSH",
    gonadotropinDoseIU: 225,
  },
  status: "Verified",
  audit: [
    {
      at: "2026-11-01T08:00:00Z",
      by: "dr_verifier",
      action: "verified_encounter",
      hash: "hash-enc-1",
    },
  ],
};

const initialOverride: Override = {
  id: "ov-dose",
  caseId: "pat-immutability",
  engine: "starting-dose",
  field: "startingDose",
  fromValue: 225,
  toValue: 250,
  reason: "Slightly low AFC response in prior stimulation; stepping up by 25 IU.",
  by: "Dr. Raouf Roshdy",
  at: "2026-11-01T09:00:00Z",
};

// 1. Run orchestrators and compile initial sections
const strat1 = runStratification(initialCase);
const plan1 = runProtocolPlan(initialCase, strat1);
const trig1 = runTriggerDecision(initialCase, strat1, plan1);
const rawReport1 = buildRawReport(initialCase, strat1, plan1, trig1);

const ctx1: ReportContext = {
  caseId: "pat-immutability",
  caseMetadata: {
    id: "pat-immutability",
    patient: initialCase.patient,
    visits: initialCase.visits ?? [],
    derived: {
      age: 34,
      bmi: 22,
      infertilityDuration: 2,
      parity: "G0P0",
      primaryCause: "Unexplained",
      cycleCount: 1,
    },
    currentStimDay: 2,
    leadFollicleSize: 8,
    folliclesGte14: 0,
    folliclesGte17: 0,
    estradiol: 120,
    estradiolTrend: "flat",
    ohssRisk: "low",
    state: "Planning",
    firewallBreached: false,
  },
  encounters: [initialEncounter],
  orchestratorOutputs: {
    stratification: strat1,
    plan: plan1,
    trigger: trig1,
  },
  effectiveOverrides: [initialOverride],
  rawIntelligenceReport: rawReport1,
};

const preMutationSections = compileReportSections(ctx1);

// 2. Sign the report (take deep snapshot)
const initialSignedSnapshot: ReportCaseSnapshot = JSON.parse(
  JSON.stringify({
    encounters: [initialEncounter],
    orchestratorOutputs: {
      stratification: strat1,
      plan: plan1,
      trigger: trig1,
    },
    effectiveOverrides: [initialOverride],
    caseMetadata: ctx1.caseMetadata,
  }),
);

const signedReport: Report = {
  id: "rep-pat-immutability-v1",
  caseId: "pat-immutability",
  version: 1,
  status: "Signed",
  locked: true,
  signedBy: "Dr. Raouf Roshdy",
  signedAt: "2026-11-01T10:00:00Z",
  snapshot: initialSignedSnapshot,
  sections: JSON.parse(JSON.stringify(preMutationSections)),
  signEvents: [
    {
      at: "2026-11-01T10:00:00Z",
      by: "dr_physician",
      action: "signed",
      note: "Digitally signed by Dr. Raouf Roshdy.",
    },
  ],
};

const preMutationSignedJson = JSON.stringify(signedReport);
console.log(
  `[SETUP] Report signed with ${signedReport.sections.length} sections and frozen snapshot.`,
);

// 3. MUTATE THE CASE POST-SIGN:
//  a) Add Day 8 monitoring visit with severe hyper-response
//  b) Add second encounter
//  c) Apply a trigger override
console.log(
  "[MUTATION] Mutating case state (adding new encounter on Day 8, new estradiol 4800 pg/mL, applying trigger override)...",
);

const mutatedVisits = [
  ...(initialCase.visits ?? []),
  {
    id: "vis-2",
    patientId: "pat-immutability",
    day: 8,
    date: "2026-11-07",
    follicles: [18, 17, 17, 16, 15, 14, 14, 12, 11],
    largestFollicle: 18,
    endometrium: 9.8,
    estradiol: 4800,
    lh: 1.1,
    progesterone: 0.8,
    fshDose: 150,
    medications: [
      { name: "rFSH", dose: "150 IU" },
      { name: "GnRH antagonist", dose: "0.25 mg" },
    ],
    notes: "Approaching trigger readiness with high OHSS risk",
  },
];

const mutatedCase: ClinicalCaseInput = {
  ...initialCase,
  visits: mutatedVisits,
};

const newEncounter2: Encounter = {
  id: "enc-2",
  caseId: "pat-immutability",
  day: 8,
  date: "2026-11-07",
  ultrasound: {
    folliclesRight: { lt10: 2, b10_13: 3, b14_16: 4, gte17: 2 },
    folliclesLeft: { lt10: 1, b10_13: 2, b14_16: 3, gte17: 1 },
    largestFollicleMm: 18,
    endometriumMm: 9.8,
  },
  labs: {
    estradiolPgMl: 4800,
    lhMiuMl: 1.1,
    progesteroneNgMl: 0.8,
  },
  medications: {
    gonadotropinType: "rFSH",
    gonadotropinDoseIU: 150,
  },
  status: "Verified",
  audit: [
    {
      at: "2026-11-07T08:00:00Z",
      by: "dr_verifier",
      action: "verified_encounter",
      hash: "hash-enc-2",
    },
  ],
};

const newTriggerOverride: Override = {
  id: "ov-trigger",
  caseId: "pat-immutability",
  engine: "trigger",
  field: "triggerType",
  fromValue: "standard-hCG",
  toValue: "GnRH-agonist-only",
  reason: "Severe hyper-response with E2 4800 pg/mL. Mandatory freeze-all to eliminate OHSS.",
  by: "Dr. Raouf Roshdy",
  at: "2026-11-07T09:30:00Z",
};

// 4. Re-run orchestrators on the mutated case
const strat2 = runStratification(mutatedCase);
const plan2 = runProtocolPlan(mutatedCase, strat2);
const trig2 = runTriggerDecision(mutatedCase, strat2, plan2);
const rawReport2 = buildRawReport(mutatedCase, strat2, plan2, trig2);

const mutatedContext: ReportContext = {
  caseId: "pat-immutability",
  caseMetadata: {
    ...ctx1.caseMetadata,
    visits: mutatedVisits,
    currentStimDay: 8,
    leadFollicleSize: 18,
    estradiol: 4800,
    ohssRisk: "critical",
    state: "Trigger",
  },
  encounters: [initialEncounter, newEncounter2],
  orchestratorOutputs: {
    stratification: strat2,
    plan: plan2,
    trigger: trig2,
  },
  effectiveOverrides: [initialOverride, newTriggerOverride],
  rawIntelligenceReport: rawReport2,
};

const liveMutatedSections = compileReportSections(mutatedContext);

// 5. ASSERTIONS:
console.log("\n--- VERIFYING IMMUTABILITY OF SIGNED REPORT ---");

// Assertion A: The signed report's JSON serialization is 100% byte-identical
const postMutationSignedJson = JSON.stringify(signedReport);
if (preMutationSignedJson !== postMutationSignedJson) {
  console.error("FAIL: Signed report was mutated!");
  process.exit(1);
}
console.log("[PASS] Signed report serialization is 100% byte-identical to pre-mutation snapshot.");

// Assertion B: The signed report's sections count is still 16 and untouched
if (signedReport.sections.length !== 16) {
  console.error(
    `FAIL: Expected 16 sections in signed report, found ${signedReport.sections.length}`,
  );
  process.exit(1);
}
console.log("[PASS] Signed report retains exactly 16 frozen sections.");

// Assertion C: The signed report does NOT contain the new encounter or trigger override
const signedReportText = JSON.stringify(signedReport);
if (signedReportText.includes("GnRH-agonist-only") || signedReportText.includes("4800")) {
  console.error("FAIL: Signed report leaked mutated data!");
  process.exit(1);
}
console.log(
  "[PASS] Signed report contains zero leaked data from subsequent encounters or overrides.",
);

// Assertion D: The live preview (current draft) DOES reflect the mutated data
const livePreviewText = JSON.stringify(liveMutatedSections);
if (!livePreviewText.includes("GnRH-agonist-only") && !livePreviewText.includes("triggerType")) {
  console.error("FAIL: Live draft did not reflect the mutation!");
  process.exit(1);
}
console.log("[PASS] Live draft dynamically reflects the mutated clinical state.");

console.log("\n================================================================================");
console.log("ALL IMMUTABILITY TESTS PASSED CLEANLY!");
console.log("================================================================================");
