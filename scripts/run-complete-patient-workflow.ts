import type { CycleRecord, FieldValue } from "../src/lib/assessment/use-assessment";
import { buildPatientContext } from "../src/lib/clinical/data-mapping";
import { classifyPoseidon } from "../src/lib/engine/poseidon";
import { assessBologna } from "../src/lib/engine/bologna";
import { buildPhenotype } from "../src/lib/engine/phenotype";
import { predictOvarianResponse } from "../src/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "../src/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "../src/lib/engine/protocol-selection";
import { buildGonadotropinSelection } from "../src/lib/engine/gonadotropin-selection";
import { buildGonadotropinEvidenceReview } from "../src/lib/engine/gonadotropin-evidence";
import { calculateConsortDose } from "../src/lib/engine/consort-dose";
import { buildStartingDoseAssessment } from "../src/lib/engine/starting-dose";
import {
  buildMonitoringContext,
  analyzeMonitoring,
  type MonitoringVisit,
} from "../src/lib/engine/monitoring";
import { evaluateDoseAdjustment } from "../src/lib/engine/dose-adjustment";
import { buildCycleCompletion } from "../src/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "../src/lib/engine/trigger";
import { buildIntelligenceReport } from "../src/lib/report/intelligence-report";

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

export const newPatient = {
  id: "PAT-2026-004",
  name: "Dr. Sophia Laurent",
  fileNumber: "AIFV-2026-004",
  values: {
    fullName: "Dr. Sophia Laurent",
    fileNumber: "AIFV-2026-004",
    dob: "1990-04-15",
    age: 36,
    height: 165,
    weight: 64.0,
    bmi: 23.5,
    smoking: "Never",
    alcohol: "None",
    maritalStatus: "Married",
    partnerAge: 38,
    infertilityDuration: 36,
    infertilityType: "Primary",
    gravidity: 0,
    parity: 0,
    miscarriages: 0,
    causes: ["Unexplained", "Mild Male Factor"],
    gynHydrosalpinx: "None",
    menarche: 13,
    cycleLength: 28,
    cycleRegularity: "Regular",
    ovulationHistory: "Ovulatory",
    amh: 1.55,
    afcLeft: 5,
    afcRight: 6,
    afcTotal: 11,
    fsh: 8.1,
    lh: 4.8,
    estradiol: 38,
    progesterone: 0.35,
    prolactin: 14.5,
    tsh: 1.82,
    hypertension: "No",
    diabetes: "No",
    thyroid: "No",
    cancer: "No",
    ovarianSurgery: "No",
    drugAllergy: "No known drug allergies",
    hasPreviousCycles: "Yes",
    pcos: "No",
  },
  cycles: [
    cyc("cyc-1", {
      cycleNumber: 1,
      cycleYear: 2025,
      type: "IVF",
      protocol: "Antagonist",
      startingDose: 150,
      retrieved: 6,
      mii: 5,
      fertilized: 4,
      blastocysts: 2,
      transferred: 1,
      frozen: 1,
      outcome: "Negative pregnancy test",
    }),
  ],
  visits: [
    visit(1, {
      largestFollicle: 8.0,
      follicleCount: 11,
      follicles10: 0,
      follicles14: 0,
      follicles17: 0,
      estradiol: 38,
      lh: 4.8,
      progesterone: 0.35,
      endometrium: 3.5,
      dailyDose: 187.5,
      medication: "rFSH (Gonal-F) 187.5 IU + Menopur 75 IU",
      notes: "Day 1 baseline: Ovarian reserve concordant, stimulation initiated at CONSORT dose",
    }),
    visit(6, {
      largestFollicle: 11.2,
      follicleCount: 11,
      follicles10: 6,
      follicles14: 0,
      follicles17: 0,
      estradiol: 360,
      lh: 2.6,
      progesterone: 0.42,
      endometrium: 7.4,
      dailyDose: 187.5,
      medication: "rFSH (Gonal-F) 187.5 IU + Menopur 75 IU",
      notes:
        "Stimulation Day 6: Follicular recruitment synchronous, estradiol progressing adequately",
    }),
    visit(9, {
      largestFollicle: 15.6,
      follicleCount: 11,
      follicles10: 9,
      follicles14: 6,
      follicles17: 0,
      estradiol: 1080,
      lh: 2.1,
      progesterone: 0.62,
      endometrium: 9.6,
      dailyDose: 187.5,
      medication: "rFSH 187.5 IU + Menopur 75 IU + Ganirelix 0.25 mg",
      notes: "Stimulation Day 9: Antagonist introduced, lead cohort 15.6 mm",
    }),
    visit(11, {
      largestFollicle: 19.4,
      follicleCount: 11,
      follicles10: 10,
      follicles14: 8,
      follicles17: 3,
      estradiol: 1820,
      lh: 1.9,
      progesterone: 0.88,
      endometrium: 10.8,
      dailyDose: 187.5,
      medication: "rFSH 187.5 IU + Menopur 75 IU + Ganirelix 0.25 mg",
      notes:
        "Stimulation Day 11: Trigger criteria fulfilled (3 follicles >= 17 mm: 19.4, 18.2, 17.5 mm; E2 1820 pg/mL, P4 0.88 ng/mL)",
    }),
  ],
};

async function main() {
  console.log("===============================================================================");
  console.log("AIFV CLINICAL DECISION SUPPORT SYSTEM — COMPLETE WORKFLOW EXECUTION");
  console.log(`Patient: ${newPatient.name} | File: ${newPatient.fileNumber}`);
  console.log("===============================================================================\n");

  // Step 1: POSEIDON & Bologna
  const poseidon = classifyPoseidon(newPatient.values, newPatient.cycles);
  console.log("--- STEP 1: POSEIDON CLASSIFICATION ---");
  console.log("Group:", poseidon.group, "(", poseidon.groupLabel, ")");
  console.log("Status:", poseidon.status);
  console.log("Rationale:", poseidon.rationale);
  console.log("Criteria:", poseidon.criteria);

  const bologna = assessBologna(newPatient.values, newPatient.cycles);
  console.log("\n--- STEP 2: BOLOGNA CRITERIA ---");
  console.log("Status:", bologna.status, "| Headline:", bologna.headline);
  console.log("Fulfilled:", bologna.fulfilled);
  console.log("Rationale:", bologna.rationale);

  // Step 3: Phenotype
  const phenotype = buildPhenotype(newPatient.values, newPatient.cycles);
  console.log("\n--- STEP 3: OVARIAN RESERVE PHENOTYPE ---");
  console.log("Reserve category:", phenotype.reserve.category);
  console.log(
    "AMH:",
    phenotype.reserve.amh,
    "ng/mL | AFC:",
    phenotype.reserve.afc,
    "| FSH:",
    phenotype.reserve.fsh,
    "IU/L",
  );
  console.log("Contributors:", phenotype.reserve.contributors);

  // Step 4: Ovarian Response Prediction
  const response = predictOvarianResponse(newPatient.values, newPatient.cycles, poseidon, bologna);
  console.log("\n--- STEP 4: OVARIAN RESPONSE PREDICTION ---");
  console.log("Predicted Category:", response.category);
  console.log("Headline:", response.headline);
  console.log("Expected Oocyte Yield:", response.expectedOocyteYield);
  console.log(
    "Risks:",
    response.risks.map((r) => `${r.title}: ${r.basis}`),
  );

  // Step 5: Protocol Recommendation & Selection
  const ctx = buildPatientContext(newPatient.values, newPatient.cycles, response);
  const protocolRec = buildProtocolRecommendation(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
  );
  console.log("\n--- STEP 5: PROTOCOL RECOMMENDATION ---");
  console.log("Protocol Status:", protocolRec.recommendation.status);
  console.log("Primary Protocol:", protocolRec.recommendation.primary);
  console.log("Message:", protocolRec.recommendation.message);
  console.log("Considerations:", protocolRec.considerations);

  const protocolSel = buildProtocolSelection(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
    ctx,
    null,
  );
  console.log(
    "Available Options:",
    protocolSel.options.map((o) => o.title),
  );

  // Step 6: Gonadotropin Selection
  const gonado = buildGonadotropinSelection(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
    protocolRec,
  );
  console.log("\n--- STEP 6: GONADOTROPIN SELECTION ---");
  console.log("Selection Status:", gonado.selection.status);
  console.log("Recommended:", gonado.selection.recommended);
  console.log("Justification:", gonado.selection.justification);

  // Step 7: CONSORT Starting Dose
  const consort = calculateConsortDose(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
  );
  console.log("\n--- STEP 7: CONSORT INDIVIDUALIZED STARTING DOSE ---");
  console.log("Status:", consort.status);
  console.log("Calculated Dose:", consort.dose, "IU/day");
  console.log("Medication:", consort.medication);
  console.log("Contributions / Points breakdown:");
  consort.contributions.forEach((c) => {
    console.log(`  - ${c.label}: ${c.value} -> Band: ${c.band} | ${c.influence}`);
  });

  // Step 8: Starting Dose Assessment
  const startingDose = buildStartingDoseAssessment(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
  );
  console.log("\n--- STEP 8: STARTING DOSE OVERALL ASSESSMENT ---");
  console.log("State:", startingDose.state);
  console.log("Dose Display:", startingDose.doseDisplay);
  console.log("Selected Algorithm:", startingDose.selectedAlgorithm?.name);
  console.log("Guideline Rec:", startingDose.guidelineStartingDose);

  // Step 9: Longitudinal Stimulation Monitoring
  const mctx = buildMonitoringContext(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
    protocolRec,
    gonado,
    null,
  );
  const monitoring = analyzeMonitoring(mctx, newPatient.visits);
  console.log("\n--- STEP 9: LONGITUDINAL MONITORING ANALYSIS ---");
  console.log("Status:", monitoring.status);
  console.log("Visits recorded:", monitoring.visits.length);
  console.log(
    "Alerts:",
    monitoring.alerts.map((a) => a.message),
  );
  console.log("Latest Follicular Status:");
  const lastVisit = monitoring.visits.at(-1)!;
  console.log(
    `  Day ${lastVisit.day}: Lead ${lastVisit.largestFollicle} mm, >=17mm: ${lastVisit.follicles17}, >=14mm: ${lastVisit.follicles14}, E2: ${lastVisit.estradiol} pg/mL, P4: ${lastVisit.progesterone} ng/mL, Endometrium: ${lastVisit.endometrium} mm`,
  );

  // Step 10: Dose Adjustment Evaluation
  const doseAdjD6 = evaluateDoseAdjustment(monitoring.visits[1] ?? null);
  console.log("\n--- STEP 10: MID-CYCLE DOSE ADJUSTMENT (DAY 6) ---");
  console.log("Status:", doseAdjD6.status);
  console.log("Proposed Dose:", doseAdjD6.proposedDose);
  console.log("Rationale:", doseAdjD6.rationale);
  console.log("Rule applied:", doseAdjD6.ruleApplied);

  const doseAdjD11 = evaluateDoseAdjustment(monitoring.visits.at(-1) ?? null);
  console.log("\n--- STEP 10b: DOSE ADJUSTMENT AT TRIGGER (DAY 11) ---");
  console.log("Status:", doseAdjD11.status);
  console.log("Proposed Dose:", doseAdjD11.proposedDose);
  console.log("Rationale:", doseAdjD11.rationale);
  console.log("Rule applied:", doseAdjD11.ruleApplied);

  // Step 11: Cycle Completion & Safety Audit
  const cycleC = buildCycleCompletion(
    newPatient.id,
    newPatient.name,
    phenotype,
    response,
    protocolRec,
    gonado,
    null,
    monitoring,
  );
  console.log("\n--- STEP 11: CYCLE COMPLETION & OHSS SAFETY ---");
  console.log("Safety Status:", cycleC.safetyStatus);
  console.log("Freeze-All Status:", cycleC.freezeAll.headline);
  console.log("Freeze-All Explanation:", cycleC.freezeAll.explanation);
  console.log("Trigger Status in CycleCompletion:", cycleC.trigger.headline);
  console.log("Trigger Explanation:", cycleC.trigger.explanation);
  console.log("OHSS Risk Level:", cycleC.ohss.level);
  console.log("OHSS Status:", cycleC.ohss.status);
  console.log("OHSS Details:", cycleC.ohss.statusDetail);

  // Step 12: Trigger Strategy Engine
  const triggerAssessment = buildTriggerAssessment(
    newPatient.id,
    newPatient.name,
    phenotype,
    response,
    monitoring,
    cycleC,
    null,
  );
  console.log("\n--- STEP 12: TRIGGER STRATEGY & SELECTION ---");
  console.log("Readiness Status Label:", triggerAssessment.readiness.statusLabel);
  console.log("Readiness Headline:", triggerAssessment.readiness.headline);
  console.log("Readiness Explanation:", triggerAssessment.readiness.explanation);
  console.log("Follicular Summary:", triggerAssessment.readiness.follicularSummary);
  console.log("Hormonal Summary:", triggerAssessment.readiness.hormonalSummary);
  console.log("Endometrial Summary:", triggerAssessment.readiness.endometrialSummary);
  console.log("Trigger Safety Status:", triggerAssessment.safetyStatus);
  console.log("Options count:", triggerAssessment.options.length);
  triggerAssessment.options.forEach((opt) => {
    console.log(`  * Option: ${opt.triggerTypeLabel} (${opt.rule.triggerRuleName})`);
    console.log(`    Applicability: ${opt.applicability} | Status: ${opt.statusLabel}`);
    console.log(`    Dose Status: ${opt.doseStatus} | Timing: ${opt.timingStatus}`);
    console.log(`    Action: ${opt.evidenceSupportedAction ?? "Physician decision"}`);
  });

  // Step 6b: Gonadotropin Evidence Review
  const gonadoEvidence = buildGonadotropinEvidenceReview(
    newPatient.id,
    newPatient.name,
    newPatient.values,
    newPatient.cycles,
    phenotype,
    response,
    {
      protocolName: "GnRH antagonist protocol",
      protocolEvidenceStatus: "Active",
      protocolDecisionStatus: "Selected",
      consortDoseFromStore: consort.dose,
    },
  );

  // Step 13: Clinical Intelligence Report
  const report = buildIntelligenceReport({
    patientId: newPatient.id,
    patientName: newPatient.name,
    values: newPatient.values,
    cycles: newPatient.cycles,
    phenotype,
    response,
    protocol: protocolRec,
    protocolSelection: protocolSel,
    protocolDecision: {
      label: "GnRH Antagonist Protocol",
      protocol: "gnrh-antagonist",
      note: "Standard first-line protocol for POSEIDON Group 2b suboptimal responder.",
    },
    gonadotropin: gonado,
    gonadotropinEvidence: gonadoEvidence,
    gonadotropinDecision: {
      label: "Highly Purified hMG (Menopur) + rFSH (Gonal-F)",
      gonadotropin: "hp-hmg",
      note: "Combined LH activity and FSH for advanced reproductive age (36yo) with prior hypo-response.",
      origin: "Physician Prescribed per ESHRE 2025 Rec 29-30",
      decidedAt: new Date().toISOString(),
    },
    startingDose: startingDose,
    consort,
    monitoring,
    cycle: cycleC,
  });
  console.log("\n--- STEP 13: CLINICAL INTELLIGENCE REPORT ---");
  console.log("Sections Generated:", report.sections.length);
  report.sections.forEach((sec, idx) => {
    console.log(`\n=================================================================`);
    console.log(`SECTION ${idx + 1}: ${sec.title.toUpperCase()} [${sec.status}]`);
    console.log(`=================================================================`);
    if (sec.narrative && sec.narrative.length > 0) {
      console.log("Narrative:\n" + sec.narrative.join("\n"));
    }
    if (sec.fields && sec.fields.length > 0) {
      console.log("Fields:");
      sec.fields.forEach((f) => console.log(`  - ${f.label}: ${f.value}`));
    }
    if (sec.lists && sec.lists.length > 0) {
      sec.lists.forEach((l) => {
        console.log(`List: ${l.title}`);
        l.items.forEach((it) => console.log(`  * ${it}`));
      });
    }
  });

  console.log("\n===============================================================================");
  console.log("ALL ENGINES EXECUTED SUCCESSFULLY WITHOUT RUNTIME DEFECTS!");
  console.log("===============================================================================\n");
}

main().catch((err) => {
  console.error("FATAL ERROR IN SCRIPT:", err);
  process.exit(1);
});
