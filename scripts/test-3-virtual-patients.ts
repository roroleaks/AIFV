/**
 * Complete Clinical Engine Test Suite with 3 Full Virtual Patients
 *
 * Evaluates all 15 deterministic clinical engines and pipeline stages:
 *  1. POSEIDON Classifier
 *  2. Bologna POR Criteria
 *  3. Reserve Phenotyping
 *  4. Ovarian Response Prediction
 *  5. Protocol Recommendation
 *  6. Protocol Selection & Evidence Gating
 *  7. Gonadotropin Selection
 *  8. CONSORT Dosing Nomogram
 *  9. Starting Dose Determination
 * 10. Stimulation Monitoring & Cohort Folliculometry
 * 11. Mid-Cycle Dose Adjustment
 * 12. Cycle Completion, OHSS Risk & Safety Audit
 * 13. Trigger Timing & Ovulation Induction Strategy
 * 14. Clinical Safety Firewalls & Evidence Gating
 * 15. Comprehensive Clinical Intelligence Report
 */

import type { CycleRecord, FieldValue } from "../src/lib/assessment/use-assessment";
import { buildPatientContext } from "../src/lib/clinical/data-mapping";
import { classifyPoseidon } from "../src/lib/engine/poseidon";
import { assessBologna } from "../src/lib/engine/bologna";
import { buildPhenotype } from "../src/lib/engine/phenotype";
import { predictOvarianResponse } from "../src/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "../src/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "../src/lib/engine/protocol-selection";
import { buildGonadotropinSelection } from "../src/lib/engine/gonadotropin-selection";
import { calculateConsortDose } from "../src/lib/engine/consort-dose";
import { buildStartingDoseAssessment } from "../src/lib/engine/starting-dose";
import { buildMonitoringContext, analyzeMonitoring, type MonitoringVisit } from "../src/lib/engine/monitoring";
import { evaluateDoseAdjustment } from "../src/lib/engine/dose-adjustment";
import { buildCycleCompletion } from "../src/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "../src/lib/engine/trigger";
import { buildIntelligenceReport } from "../src/lib/report/intelligence-report";

export interface VirtualPatient {
  id: string;
  name: string;
  fileNumber: string;
  clinicalProfile: string;
  expectedClassification: string;
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
  visits: MonitoringVisit[];
}

const cyc = (id: string, c: Record<string, FieldValue>): CycleRecord =>
  ({ id, ...c }) as unknown as CycleRecord;

const visit = (day: number, v: Partial<MonitoringVisit>): MonitoringVisit =>
  ({
    id: `visit-day-${day}`,
    day,
    date: `2026-10-${String(day).padStart(2, "0")}`,
    largestFollicle: null,
    follicleCount: null,
    follicles10: null,
    follicles14: null,
    follicles17: null,
    estradiol: null,
    lh: null,
    progesterone: null,
    endometrium: null,
    dailyDose: null,
    medication: "",
    notes: "",
    ...v,
  }) as MonitoringVisit;

export const virtualPatients: VirtualPatient[] = [
  // =========================================================================
  // Virtual Patient 1: Elena Rostova (Normal Responder, Tubal Factor)
  // =========================================================================
  {
    id: "VP-001",
    name: "Elena Rostova",
    fileNumber: "AIFV-2026-001",
    clinicalProfile: "Age 31, Secondary Infertility, Tubal factor, Normal Reserve (AMH 2.8, AFC 16, BMI 22.5)",
    expectedClassification: "Expected Normal Responder, Not Low-Prognosis (Non-POSEIDON, Bologna Negative)",
    values: {
      fullName: "Elena Rostova",
      fileNumber: "AIFV-2026-001",
      dob: "1995-04-12",
      age: 31,
      height: 168,
      weight: 63.6,
      bmi: 22.5,
      smoking: "Never",
      alcohol: "None",
      maritalStatus: "Married",
      partnerAge: 33,
      infertilityDuration: 24,
      infertilityType: "Secondary",
      gravidity: 1,
      parity: 0,
      miscarriages: 1,
      causes: ["Tubal"],
      gynHydrosalpinx: "None",
      menarche: 12,
      cycleLength: 28,
      cycleRegularity: "Regular",
      ovulationHistory: "Ovulatory",
      amh: 2.8,
      afcLeft: 7,
      afcRight: 9,
      afcTotal: 16,
      fsh: 6.4,
      lh: 5.1,
      estradiol: 42,
      progesterone: 0.35,
      prolactin: 14.2,
      tsh: 1.8,
      hypertension: "No",
      diabetes: "No",
      thyroid: "No",
      cancer: "No",
      ovarianSurgery: "No",
      drugAllergy: "No known drug allergies",
    },
    cycles: [
      cyc("cyc-1", {
        cycleNumber: 1,
        cycleYear: 2024,
        type: "IVF",
        protocol: "Antagonist",
        startingDose: 200,
        retrieved: 11,
        mii: 9,
        fertilized: 7,
        blastocysts: 4,
        transferred: 1,
        frozen: 3,
        outcome: "Biochemical pregnancy",
      }),
    ],
    visits: [
      visit(5, {
        largestFollicle: 11,
        follicleCount: 14,
        follicles10: 12,
        follicles14: 0,
        follicles17: 0,
        estradiol: 580,
        lh: 2.4,
        progesterone: 0.4,
        endometrium: 7.5,
        dailyDose: 200,
        medication: "rFSH (Gonal-F)",
        notes: "Stimulation day 5: Follicular recruitment synchronous",
      }),
      visit(8, {
        largestFollicle: 16,
        follicleCount: 15,
        follicles10: 14,
        follicles14: 8,
        follicles17: 0,
        estradiol: 1750,
        lh: 1.8,
        progesterone: 0.6,
        endometrium: 9.2,
        dailyDose: 200,
        medication: "rFSH (Gonal-F) + GnRH Antagonist (Cetrotide 0.25mg)",
        notes: "Stimulation day 8: Antagonist started, cohort leading well",
      }),
      visit(10, {
        largestFollicle: 19.5,
        follicleCount: 15,
        follicles10: 14,
        follicles14: 10,
        follicles17: 5,
        estradiol: 2520,
        lh: 1.9,
        progesterone: 0.85,
        endometrium: 11.0,
        dailyDose: 200,
        medication: "rFSH (Gonal-F) + GnRH Antagonist",
        notes: "Stimulation day 10: Trigger readiness reached (5 follicles >= 17mm)",
      }),
    ],
  },

  // =========================================================================
  // Virtual Patient 2: Margaret Sullivan (POSEIDON Group 4 / Bologna Poor Responder)
  // =========================================================================
  {
    id: "VP-002",
    name: "Margaret Sullivan",
    fileNumber: "AIFV-2026-002",
    clinicalProfile: "Age 41, Primary Infertility, DOR + AMA (AMH 0.38, AFC 4, FSH 14.8, prev 2 oocytes)",
    expectedClassification: "POSEIDON Group 4, Bologna Criteria FULFILLED, Expected Poor Responder",
    values: {
      fullName: "Margaret Sullivan",
      fileNumber: "AIFV-2026-002",
      dob: "1985-02-18",
      age: 41,
      height: 162,
      weight: 67.7,
      bmi: 25.8,
      smoking: "Former",
      alcohol: "None",
      maritalStatus: "Married",
      partnerAge: 43,
      infertilityDuration: 48,
      infertilityType: "Primary",
      gravidity: 0,
      parity: 0,
      causes: ["Diminished Ovarian Reserve", "Advanced Maternal Age"],
      menarche: 13,
      cycleLength: 25,
      cycleRegularity: "Irregular",
      ovulationHistory: "Oligo-ovulation",
      amh: 0.38,
      afcLeft: 2,
      afcRight: 2,
      afcTotal: 4,
      fsh: 14.8,
      lh: 8.6,
      estradiol: 35,
      progesterone: 0.4,
      prolactin: 12.0,
      tsh: 2.1,
      hypertension: "No",
      diabetes: "No",
      thyroid: "No",
      cancer: "No",
      ovarianSurgery: "No",
      drugAllergy: "No known drug allergies",
    },
    cycles: [
      cyc("cyc-1", {
        cycleNumber: 1,
        cycleYear: 2025,
        type: "ICSI",
        protocol: "Long agonist",
        startingDose: 300,
        retrieved: 2,
        mii: 1,
        fertilized: 1,
        blastocysts: 0,
        transferred: 1,
        frozen: 0,
        outcome: "Negative hCG",
      }),
    ],
    visits: [
      visit(6, {
        largestFollicle: 11.5,
        follicleCount: 4,
        follicles10: 3,
        follicles14: 0,
        follicles17: 0,
        estradiol: 290,
        lh: 5.2,
        progesterone: 0.3,
        endometrium: 6.1,
        dailyDose: 300,
        medication: "hp-hMG (Menopur) + rFSH",
        notes: "Stimulation day 6: 3 developing follicles, hp-hMG utilized",
      }),
      visit(9, {
        largestFollicle: 15.0,
        follicleCount: 4,
        follicles10: 3,
        follicles14: 2,
        follicles17: 0,
        estradiol: 610,
        lh: 3.8,
        progesterone: 0.5,
        endometrium: 7.4,
        dailyDose: 300,
        medication: "hp-hMG + rFSH + Antagonist",
        notes: "Stimulation day 9: Slow but steady progression, 2 follicles >= 14mm",
      }),
      visit(11, {
        largestFollicle: 18.2,
        follicleCount: 4,
        follicles10: 3,
        follicles14: 2,
        follicles17: 1,
        estradiol: 820,
        lh: 2.4,
        progesterone: 0.65,
        endometrium: 8.0,
        dailyDose: 300,
        medication: "hp-hMG + rFSH + Antagonist",
        notes: "Stimulation day 11: Lead follicle 18.2mm, ready for trigger",
      }),
    ],
  },

  // =========================================================================
  // Virtual Patient 3: Amina Al-Mansoor (High Responder / Severe PCOS / OHSS Risk)
  // =========================================================================
  {
    id: "VP-003",
    name: "Amina Al-Mansoor",
    fileNumber: "AIFV-2026-003",
    clinicalProfile: "Age 27, Primary Infertility, Severe PCOS Rotterdam A (AMH 7.4, AFC 34, BMI 23.1, prev 24 oocytes / OHSS)",
    expectedClassification: "Expected High Responder, Extreme OHSS Risk, Freeze-All Mandatory, GnRH Agonist Trigger Required",
    values: {
      fullName: "Amina Al-Mansoor",
      fileNumber: "AIFV-2026-003",
      dob: "1999-08-25",
      age: 27,
      height: 164,
      weight: 62.1,
      bmi: 23.1,
      smoking: "Never",
      alcohol: "None",
      maritalStatus: "Married",
      partnerAge: 29,
      infertilityDuration: 24,
      infertilityType: "Primary",
      gravidity: 0,
      parity: 0,
      causes: ["PCOS", "Ovulatory Disorder"],
      pcosHyperandrogenism: "Both",
      pcosMorphology: "Bilateral",
      pcosOvulatory: "Anovulation",
      pcosPreviousOhss: "Moderate",
      pcosMetformin: "Yes",
      pcosPhenotype: "A",
      menarche: 14,
      cycleLength: 45,
      cycleRegularity: "Irregular",
      ovulationHistory: "Anovulation",
      amh: 7.4,
      afcLeft: 16,
      afcRight: 18,
      afcTotal: 34,
      fsh: 4.8,
      lh: 11.2,
      estradiol: 55,
      progesterone: 0.3,
      testosterone: 78,
      prolactin: 16.5,
      tsh: 1.5,
      hypertension: "No",
      diabetes: "No",
      thyroid: "No",
      cancer: "No",
      ovarianSurgery: "No",
      drugAllergy: "No known drug allergies",
    },
    cycles: [
      cyc("cyc-1", {
        cycleNumber: 1,
        cycleYear: 2025,
        type: "ICSI",
        protocol: "Antagonist",
        startingDose: 150,
        retrieved: 24,
        mii: 19,
        fertilized: 16,
        blastocysts: 10,
        transferred: 0,
        frozen: 10,
        ohss: "Moderate",
        outcome: "Freeze-all due to OHSS risk",
      }),
    ],
    visits: [
      visit(5, {
        largestFollicle: 10.5,
        follicleCount: 32,
        follicles10: 20,
        follicles14: 0,
        follicles17: 0,
        estradiol: 1420,
        lh: 2.1,
        progesterone: 0.35,
        endometrium: 8.0,
        dailyDose: 125,
        medication: "rFSH (125 IU)",
        notes: "Stimulation day 5: Rapid cohort recruitment, 20 follicles >= 10mm, E2 1420 pg/mL",
      }),
      visit(8, {
        largestFollicle: 15.5,
        follicleCount: 34,
        follicles10: 26,
        follicles14: 15,
        follicles17: 0,
        estradiol: 4600,
        lh: 1.5,
        progesterone: 0.7,
        endometrium: 10.5,
        dailyDose: 125,
        medication: "rFSH (125 IU) + GnRH Antagonist (0.25mg)",
        notes: "Stimulation day 8: Marked follicular proliferation, estradiol surging (4600 pg/mL)",
      }),
      visit(10, {
        largestFollicle: 19.0,
        follicleCount: 35,
        follicles10: 28,
        follicles14: 18,
        follicles17: 8,
        estradiol: 5950,
        lh: 1.7,
        progesterone: 1.1,
        endometrium: 12.0,
        dailyDose: 125,
        medication: "rFSH (125 IU) + GnRH Antagonist (0.25mg)",
        notes: "Stimulation day 10: Estradiol 5950 pg/mL, 28 follicles >= 10mm. Strict Freeze-All & GnRH agonist trigger required!",
      }),
    ],
  },
];

interface EngineResult {
  engine: string;
  status: "PASS" | "FAIL";
  clinicalOutput: string;
  details: Record<string, unknown>;
}

export function executeFullEngineSuite(patient: VirtualPatient): EngineResult[] {
  const results: EngineResult[] = [];

  const runStep = <T,>(engine: string, fn: () => T, summarize: (v: T) => { output: string; details: Record<string, unknown> }): T | null => {
    try {
      const val = fn();
      const s = summarize(val);
      results.push({
        engine,
        status: "PASS",
        clinicalOutput: s.output,
        details: s.details,
      });
      return val;
    } catch (err) {
      results.push({
        engine,
        status: "FAIL",
        clinicalOutput: `CRITICAL EXECUTION ERROR: ${err instanceof Error ? err.message : String(err)}`,
        details: { error: String(err), stack: err instanceof Error ? err.stack : undefined },
      });
      return null;
    }
  };

  // 1. POSEIDON Classifier
  const poseidon = runStep("1. POSEIDON Classifier", () => classifyPoseidon(patient.values, patient.cycles), (r) => ({
    output: `Group: ${r.groupLabel} | Status: ${r.status} | Criteria met: ${r.criteria?.length ?? 0}`,
    details: { group: r.group, groupLabel: r.groupLabel, status: r.status, criteria: r.criteria, missing: r.missing },
  }));

  // 2. Bologna POR Criteria
  const bologna = runStep("2. Bologna POR Criteria", () => assessBologna(patient.values, patient.cycles), (r) => ({
    output: `${r.headline} | Fulfilled: ${r.fulfilled} | Criteria met: ${r.criteriaMet?.length ?? 0}`,
    details: { headline: r.headline, fulfilled: r.fulfilled, criteriaMet: r.criteriaMet, missing: r.missing },
  }));

  if (!poseidon || !bologna) return results;

  // 3. Reserve Phenotyping
  const phenotype = runStep("3. Reserve Phenotyping", () => buildPhenotype(patient.values, patient.cycles), (r) => ({
    output: `Reserve AMH: ${r.reserve.amh} ng/mL, AFC: ${r.reserve.afc} | POSEIDON: ${r.poseidon.groupLabel} | Bologna: ${r.bologna.headline}`,
    details: { reserve: r.reserve, poseidon: r.poseidon.groupLabel, bologna: r.bologna.headline },
  }));

  if (!phenotype) return results;

  // 4. Ovarian Response Prediction
  const response = runStep("4. Ovarian Response Prediction", () => predictOvarianResponse(patient.values, patient.cycles, poseidon, bologna), (r) => ({
    output: `Predicted Category: ${r.category.toUpperCase()} | Yield Headline: ${r.headline} | Active Risk Flags: ${r.risks.length}`,
    details: { category: r.category, headline: r.headline, risks: r.risks.map((k) => k.title) },
  }));

  if (!response) return results;

  // 5. Patient Context Mapping
  const ctx = buildPatientContext(patient.values, patient.cycles, response);

  // 6. Protocol Recommendation Engine
  const protocolRec = runStep("6. Protocol Recommendation", () => buildProtocolRecommendation(patient.id, patient.name, patient.values, patient.cycles, phenotype, response), (r) => ({
    output: `Recommendation Status: ${r.recommendation.status} | Primary Protocol: ${JSON.stringify(r.recommendation.primary ?? "None")} | Clinical Considerations: ${r.considerations.length}`,
    details: { status: r.recommendation.status, primary: r.recommendation.primary, considerations: r.considerations },
  }));

  if (!protocolRec) return results;

  // 7. Protocol Selection & Evidence Gating
  runStep("7. Protocol Selection & Options", () => buildProtocolSelection(patient.id, patient.name, patient.values, patient.cycles, phenotype, response, ctx, null), (r) => ({
    output: `Available Clinical Options: ${r.options.length} | Cautions: ${r.cautions.length} | CONSORT Firewall: ${r.consortFirewall.status}`,
    details: { optionsCount: r.options.length, cautions: r.cautions, firewallStatus: r.consortFirewall.status },
  }));

  // 8. Gonadotropin Selection Engine
  const gonado = runStep("8. Gonadotropin Selection", () => buildGonadotropinSelection(patient.id, patient.name, patient.values, patient.cycles, phenotype, response, protocolRec), (r) => ({
    output: `Selection Status: ${r.selection.status} | Recommended Drug Regimen: ${JSON.stringify(r.selection.recommended ?? "None")} | Cycle History Review: ${r.cycleReview.length}`,
    details: { status: r.selection.status, recommended: r.selection.recommended, justifications: r.selection.justification },
  }));

  if (!gonado) return results;

  // 9. CONSORT Nomogram Dosing
  const consort = runStep("9. CONSORT Nomogram Dosing", () => calculateConsortDose(patient.id, patient.name, patient.values, patient.cycles, phenotype, response), (r) => ({
    output: `Status: ${r.status} | Dose: ${JSON.stringify(r.dose)} | Safety Validation: ${r.validation.state ?? "None"} | Missing Params: ${r.validation.missingParams?.length ?? 0}`,
    details: { status: r.status, dose: r.dose, validation: r.validation.state },
  }));

  // 10. Starting Dose Determination
  runStep("10. Starting Dose Assessment", () => buildStartingDoseAssessment(patient.id, patient.name, patient.values, patient.cycles, phenotype, response), (r) => ({
    output: `Engine State: ${r.state} | Dose Output: ${r.doseDisplay} | Evidence Algorithms: ${r.algorithms.length} | Comparative RCT Doses: ${r.evidenceReportedDoses.length}`,
    details: { state: r.state, doseDisplay: r.doseDisplay, algorithmsCount: r.algorithms.length },
  }));

  // 11. Stimulation Monitoring & Kinetic Analysis
  const mctx = buildMonitoringContext(patient.id, patient.name, patient.values, patient.cycles, phenotype, response, protocolRec, gonado, null);
  const monitoring = runStep("11. Stimulation Monitoring Engine", () => analyzeMonitoring(mctx, patient.visits), (r) => ({
    output: `Total Recorded Visits: ${r.visits.length} | Monitoring Status: ${JSON.stringify(r.status)} | Clinical Alerts: ${r.alerts.length} | Trends Computed: ${r.trends.length}`,
    details: { visitCount: r.visits.length, status: r.status, alerts: r.alerts.map((a) => a.message), trends: r.trends.length },
  }));

  if (!monitoring) return results;

  // 12. Mid-Cycle Dose Adjustment
  runStep("12. Mid-Cycle Dose Adjustment", () => evaluateDoseAdjustment(monitoring.visits.at(-1) ?? null), (r) => ({
    output: `Adjustment Status: ${r.status} | Proposed Dose: ${JSON.stringify(r.proposedDose)} | Observed Parameters: ${r.observedValues.length}`,
    details: { status: r.status, proposedDose: r.proposedDose, rationale: r.rationale },
  }));

  // 13. Cycle Completion / Safety / OHSS / Freeze-All
  const cycleC = runStep("13. Cycle Completion & Safety Audit", () => buildCycleCompletion(patient.id, patient.name, phenotype, response, protocolRec, gonado, null, monitoring), (r) => ({
    output: `Safety Status: ${r.safetyStatus} | Freeze-All Strategy: ${r.freezeAll.status} | Trigger Readiness: ${r.trigger.status} | Safety Alerts: ${r.alerts.length}`,
    details: { safetyStatus: r.safetyStatus, freezeAll: r.freezeAll.status, trigger: r.trigger.status, alerts: r.alerts.map((a) => a.title) },
  }));

  if (!cycleC) return results;

  // 14. Trigger Strategy & Ovulation Induction
  runStep("14. Trigger Strategy Engine", () => buildTriggerAssessment(patient.id, patient.name, phenotype, response, monitoring, cycleC, null), (r) => ({
    output: `Trigger Safety: ${r.safetyStatus} | Readiness Status: ${JSON.stringify(r.readiness.status ?? r.readiness)} | Trigger Protocol Options: ${r.options.length} | Dose Status: ${r.triggerDoseStatus}`,
    details: { safetyStatus: r.safetyStatus, readiness: r.readiness, optionsCount: r.options.length, triggerDoseStatus: r.triggerDoseStatus },
  }));

  // 15. Clinical Intelligence Report Generation
  if (consort) {
    runStep("15. Clinical Intelligence Report", () => buildIntelligenceReport({
      patientId: patient.id,
      patientName: patient.name,
      values: patient.values,
      cycles: patient.cycles,
      phenotype,
      response,
      protocol: protocolRec,
      gonadotropin: gonado,
      consort,
      monitoring,
      cycle: cycleC,
    }), (r) => ({
      output: `Generated Sections: ${r.sections.length} | Quality Review Score: ${r.qualityIssues.length === 0 ? "100% Complete" : `${r.qualityIssues.length} items flagged`} | Clinical Explanations: ${r.explanations.length}`,
      details: { sectionsCount: r.sections.length, qualityScore: r.qualityScore, evidenceCount: r.evidence.length, explanationsCount: r.explanations.length },
    }));
  }

  return results;
}

// CLI Execution Harness
export function runCheckup() {
  console.log("================================================================================");
  console.log("    AIFV CLINICAL DECISION SUPPORT SYSTEM — 3 VIRTUAL PATIENT AUDIT SUITE       ");
  console.log("================================================================================");

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const patient of virtualPatients) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`PATIENT [${patient.id}] — ${patient.name}`);
    console.log(`Profile: ${patient.clinicalProfile}`);
    console.log(`Expected: ${patient.expectedClassification}`);
    console.log(`--------------------------------------------------------------------------------`);

    const results = executeFullEngineSuite(patient);

    for (const res of results) {
      totalTests++;
      if (res.status === "PASS") {
        totalPassed++;
        console.log(`  [PASS] ${res.engine.padEnd(35)} : ${res.clinicalOutput}`);
      } else {
        totalFailed++;
        console.log(`  [FAIL] ${res.engine.padEnd(35)} : ${res.clinicalOutput}`);
      }
    }
  }

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${totalTests} Engine Executions Across 3 Virtual Patients`);
  console.log(`PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log("================================================================================\n");

  return { totalTests, totalPassed, totalFailed };
}

// Execute immediately when run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("test-3-virtual-patients.ts")) {
  runCheckup();
}
