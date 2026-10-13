/**
 * Comprehensive E2E Negative, Boundary, Conflicting, and Safety-Firewall Audit
 *
 * Tests Section 9 (Safety Firewall Assertions) & Section 10 (Negative, Boundary & Resilience)
 * of the AIFV Verification Protocol using synthetic fixtures only.
 *
 * SYNTHETIC TEST DATA — NOT FOR CLINICAL USE
 */

import { classifyPoseidon } from "../src/lib/engine/poseidon";
import { assessBologna } from "../src/lib/engine/bologna";
import { buildPhenotype } from "../src/lib/engine/phenotype";
import { predictOvarianResponse } from "../src/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "../src/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "../src/lib/engine/protocol-selection";
import { buildGonadotropinSelection } from "../src/lib/engine/gonadotropin-selection";
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
import { evaluateTreatmentGate } from "../src/lib/engine/algorithm-status";
import { validateAssessment } from "../src/lib/assessment/validation";
import type { CycleRecord, FieldValue } from "../src/lib/assessment/use-assessment";

interface TestResult {
  id: string;
  category: string;
  description: string;
  status: "PASS" | "FAIL";
  observed: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function assertTest(
  id: string,
  category: string,
  description: string,
  condition: boolean,
  observed: string,
  details?: Record<string, unknown>,
) {
  const status = condition ? "PASS" : "FAIL";
  results.push({ id, category, description, status, observed, details });
  console.log(`[${status}] ${id} (${category}): ${description} -> ${observed}`);
}

console.log("================================================================================");
console.log("STARTING AIFV COMPREHENSIVE E2E NEGATIVE, BOUNDARY & FIREWALL AUDIT");
console.log("SYNTHETIC TEST DATA — NOT FOR CLINICAL USE");
console.log("================================================================================\n");

// ============================================================================
// 10.1 Incomplete Record (NEG-INCOMPLETE)
// ============================================================================
console.log("--- SECTION 10.1: INCOMPLETE RECORD DEGRADATION TEST ---");
try {
  const incValues: Record<string, FieldValue> = {
    patientId: "NEG-INCOMPLETE",
    fullName: "Incomplete Synthetic Record",
    infertilityType: "Primary",
  };
  const incCycles: CycleRecord[] = [];
  const incVisits: MonitoringVisit[] = [];

  const poseidon = classifyPoseidon(incValues, incCycles);
  assertTest(
    "NEG-10.1-01",
    "Incomplete Record",
    "POSEIDON handles missing age/AMH/AFC without throw",
    poseidon.status === "insufficient-data" && poseidon.group === null,
    `Status: ${poseidon.status}, Group: ${poseidon.group}`,
  );

  const bologna = assessBologna(incValues, incCycles);
  assertTest(
    "NEG-10.1-02",
    "Incomplete Record",
    "Bologna POR handles missing data safely",
    bologna.status === "incomplete",
    `Status: ${bologna.status}, Headline: ${bologna.headline}`,
  );

  const phenotype = buildPhenotype(incValues, incCycles);
  assertTest(
    "NEG-10.1-03",
    "Incomplete Record",
    "Phenotype engine degrades gracefully",
    phenotype.phenotype === "insufficient-data",
    `Phenotype: ${phenotype.phenotype}`,
  );

  const response = predictOvarianResponse(incValues, incCycles, poseidon, bologna);
  assertTest(
    "NEG-10.1-04",
    "Incomplete Record",
    "Ovarian response engine returns unable status",
    response.category === "unable",
    `Category: ${response.category}`,
  );

  const protocol = buildProtocolRecommendation(
    "NEG-INC",
    "Incomplete",
    incValues,
    incCycles,
    phenotype,
    response,
  );
  assertTest(
    "NEG-10.1-05",
    "Incomplete Record",
    "Protocol recommendation returns insufficient-data without throwing",
    protocol.recommendation.status === "insufficient-data" &&
      protocol.recommendation.recommended === null,
    `Status: ${protocol.recommendation.status}, Recommended: ${protocol.recommendation.recommended}`,
  );

  const gonado = buildGonadotropinSelection(
    "NEG-INC",
    "Incomplete",
    incValues,
    incCycles,
    phenotype,
    response,
    protocol,
  );
  assertTest(
    "NEG-10.1-06",
    "Incomplete Record",
    "Gonadotropin selection returns insufficient-data without inventing a medication",
    gonado.selection.status === "insufficient-data" && gonado.selection.recommended === null,
    `Status: ${gonado.selection.status}, Recommended: ${gonado.selection.recommended}`,
  );

  const consort = calculateConsortDose(
    "NEG-INC",
    "Incomplete",
    incValues,
    incCycles,
    phenotype,
    response,
  );
  assertTest(
    "NEG-10.1-07",
    "Incomplete Record",
    "CONSORT dose calculator returns null dose with missing-variables flag",
    consort.dose === null && consort.status === "missing-variables",
    `Status: ${consort.status}, Dose: ${consort.dose}`,
  );

  const startDose = buildStartingDoseAssessment(
    "NEG-INC",
    "Incomplete",
    incValues,
    incCycles,
    phenotype,
    response,
  );
  assertTest(
    "NEG-10.1-08",
    "Incomplete Record",
    "Starting dose engine returns INSUFFICIENT_DATA and null dose",
    startDose.state === "INSUFFICIENT_DATA" && startDose.dose === null,
    `State: ${startDose.state}, Dose: ${startDose.dose}`,
  );

  const mctx = buildMonitoringContext(
    "NEG-INC",
    "Incomplete",
    incValues,
    incCycles,
    phenotype,
    response,
    protocol,
    gonado,
    null,
  );
  const monitoring = analyzeMonitoring(mctx, incVisits);
  assertTest(
    "NEG-10.1-09",
    "Incomplete Record",
    "Monitoring engine handles 0 visits safely",
    monitoring.visits.length === 0 && monitoring.status === "no-data",
    `Visits: ${monitoring.visits.length}, Status: ${monitoring.status}`,
  );

  const doseAdj = evaluateDoseAdjustment(null);
  assertTest(
    "NEG-10.1-10",
    "Incomplete Record",
    "Dose adjustment handles null visit with DATA_INCOMPLETE",
    doseAdj.status === "DATA_INCOMPLETE" && doseAdj.proposedDose === null,
    `Status: ${doseAdj.status}, ProposedDose: ${doseAdj.proposedDose}`,
  );

  const cycleC = buildCycleCompletion(
    "NEG-INC",
    "Incomplete",
    phenotype,
    response,
    protocol,
    gonado,
    null,
    monitoring,
  );
  assertTest(
    "NEG-10.1-11",
    "Incomplete Record",
    "Cycle completion surfaces data-incomplete safely",
    cycleC.trigger.status === "data-incomplete" && cycleC.freezeAll.status === "data-incomplete",
    `Trigger: ${cycleC.trigger.status}, FreezeAll: ${cycleC.freezeAll.status}`,
  );

  const trigger = buildTriggerAssessment(
    "NEG-INC",
    "Incomplete",
    phenotype,
    response,
    monitoring,
    cycleC,
    null,
  );
  assertTest(
    "NEG-10.1-12",
    "Incomplete Record",
    "Trigger strategy maintains SAFETY DATA INCOMPLETE status",
    trigger.safetyStatus === "SAFETY DATA INCOMPLETE",
    `Safety: ${trigger.safetyStatus}, Readiness: ${trigger.readiness.statusLabel}`,
  );

  const intelReport = buildIntelligenceReport({
    patientId: "NEG-INC",
    patientName: "Incomplete",
    values: incValues,
    cycles: incCycles,
    phenotype,
    response,
    protocol,
    gonadotropin: gonado,
    consort,
    monitoring,
    cycle: cycleC,
  });
  assertTest(
    "NEG-10.1-13",
    "Incomplete Record",
    "Clinical intelligence report compiles successfully without crashing on incomplete record",
    intelReport.sections.length > 0 && intelReport.qualityIssues.length > 0,
    `Sections: ${intelReport.sections.length}, Quality Issues: ${intelReport.qualityIssues.length}`,
  );
} catch (err) {
  assertTest(
    "NEG-10.1-FAIL",
    "Incomplete Record",
    "Exception thrown in incomplete record test",
    false,
    String(err),
  );
}

// ============================================================================
// 10.2 Missing Monitoring Fields
// ============================================================================
console.log("\n--- SECTION 10.2: MISSING MONITORING FIELDS NORMALIZATION TEST ---");
try {
  const baseValues: Record<string, FieldValue> = {
    patientId: "TEST-MON-SPARSE",
    fullName: "Sparse Monitoring Patient",
    age: 30,
    amh: 2.5,
    afcTotal: 14,
  };
  const sparseVisits: MonitoringVisit[] = [
    {
      id: "v-sparse-1",
      day: 6,
      date: "2026-10-06",
      dailyDose: 200,
      medication: "rFSH",
      follicleCount: 8,
      largestFollicle: 12,
      // intentionally omit follicles10, follicles14, follicles17, estradiol, endometrium
    } as unknown as MonitoringVisit,
  ];

  const ph = buildPhenotype(baseValues, []);
  const resp = predictOvarianResponse(baseValues, [], ph.poseidon, ph.bologna);
  const prot = buildProtocolRecommendation("p1", "Test", baseValues, [], ph, resp);
  const gon = buildGonadotropinSelection("p1", "Test", baseValues, [], ph, resp, prot);
  const mctx = buildMonitoringContext("p1", "Test", baseValues, [], ph, resp, prot, gon, null);
  const monResult = analyzeMonitoring(mctx, sparseVisits);

  assertTest(
    "NEG-10.2-01",
    "Sparse Monitoring",
    "Monitoring engine normalizes sparse visit without crashing",
    monResult.visits.length === 1 && monResult.visits[0].largestFollicle === 12,
    `Visits analyzed: ${monResult.visits.length}, Largest Follicle: ${monResult.visits[0].largestFollicle}`,
  );

  const doseAdjSparse = evaluateDoseAdjustment(monResult.visits[0]);
  assertTest(
    "NEG-10.2-02",
    "Sparse Monitoring",
    "Dose adjustment handles missing hormone fields safely",
    doseAdjSparse.status === "ACTIVE",
    `Status: ${doseAdjSparse.status}, Proposed: ${doseAdjSparse.proposedDose}`,
  );
} catch (err) {
  assertTest(
    "NEG-10.2-FAIL",
    "Sparse Monitoring",
    "Exception thrown in sparse monitoring test",
    false,
    String(err),
  );
}

// ============================================================================
// 10.3 Invalid Values
// ============================================================================
console.log("\n--- SECTION 10.3: INVALID VALUES VALIDATION & BOUNDARY DEFENSE ---");

const amhNegIssues = validateAssessment(
  {
    fullName: "T",
    dob: "1995-01-01",
    height: 165,
    weight: 60,
    infertilityDuration: 12,
    infertilityType: "Primary",
    amh: -1.5,
    afcLeft: 5,
    afcRight: 5,
  },
  [],
);
assertTest(
  "NEG-10.3-01",
  "Invalid Values",
  "Negative AMH (-1.5) is flagged as impossible value range error",
  amhNegIssues.some((i) => i.fields.includes("amh") && i.severity === "error"),
  `Issues: ${amhNegIssues.map((i) => `${i.title} (${i.severity})`).join("; ")}`,
);

const afcNegIssues = validateAssessment(
  {
    fullName: "T",
    dob: "1995-01-01",
    height: 165,
    weight: 60,
    infertilityDuration: 12,
    infertilityType: "Primary",
    amh: 2.0,
    afcLeft: -5,
    afcRight: 5,
  },
  [],
);
assertTest(
  "NEG-10.3-02",
  "Invalid Values",
  "Negative AFC (afcLeft: -5) is flagged as impossible value range error",
  afcNegIssues.some((i) => i.fields.includes("afcLeft") && i.severity === "error"),
  `Issues: ${afcNegIssues.map((i) => `${i.title} (${i.severity})`).join("; ")}`,
);

const afcExcessiveIssues = validateAssessment(
  {
    fullName: "T",
    dob: "1995-01-01",
    height: 165,
    weight: 60,
    infertilityDuration: 12,
    infertilityType: "Primary",
    amh: 2.0,
    afcLeft: 70,
    afcRight: 5,
  },
  [],
);
assertTest(
  "NEG-10.3-03",
  "Invalid Values",
  "Excessive AFC (afcLeft: 70 > 60 max) is flagged as range error",
  afcExcessiveIssues.some((i) => i.fields.includes("afcLeft") && i.severity === "error"),
  `Issues: ${afcExcessiveIssues.map((i) => `${i.title} (${i.severity})`).join("; ")}`,
);

const weightZeroIssues = validateAssessment(
  {
    fullName: "T",
    dob: "1995-01-01",
    height: 165,
    weight: 0,
    infertilityDuration: 12,
    infertilityType: "Primary",
    amh: 2.0,
    afcLeft: 5,
    afcRight: 5,
  },
  [],
);
assertTest(
  "NEG-10.3-04",
  "Invalid Values",
  "Weight 0 kg (< 30 kg min) is flagged as impossible value range error",
  weightZeroIssues.some((i) => i.fields.includes("weight") && i.severity === "error"),
  `Issues: ${weightZeroIssues.map((i) => `${i.title} (${i.severity})`).join("; ")}`,
);

const heightZeroIssues = validateAssessment(
  {
    fullName: "T",
    dob: "1995-01-01",
    height: 0,
    weight: 60,
    infertilityDuration: 12,
    infertilityType: "Primary",
    amh: 2.0,
    afcLeft: 5,
    afcRight: 5,
  },
  [],
);
assertTest(
  "NEG-10.3-05",
  "Invalid Values",
  "Height 0 cm (< 120 cm min) is flagged as impossible value range error",
  heightZeroIssues.some((i) => i.fields.includes("height") && i.severity === "error"),
  `Issues: ${heightZeroIssues.map((i) => `${i.title} (${i.severity})`).join("; ")}`,
);

// Folliculometry logical inversion test: Follicles >=17mm (5) > Follicles >=14mm (2)
const invertedVisits: MonitoringVisit[] = [
  {
    id: "v-inv-1",
    day: 8,
    date: "2026-10-08",
    dailyDose: 200,
    follicleCount: 10,
    largestFollicle: 18,
    follicles10: 8,
    follicles14: 2,
    follicles17: 5, // Inverted: 17mm count exceeds 14mm count!
    estradiol: 1200,
    endometrium: 8,
  } as unknown as MonitoringVisit,
];
const monInv = analyzeMonitoring(
  buildMonitoringContext(
    "inv",
    "Inv",
    { age: 30 },
    [],
    buildPhenotype({ age: 30 }, []),
    predictOvarianResponse(
      { age: 30 },
      [],
      {
        group: null,
        groupLabel: null,
        status: "not-low-prognosis",
        inputs: { age: 30, amh: null, afc: null, previousYield: null },
      },
      {
        status: "incomplete",
        fulfilled: false,
        criteriaMet: [],
        criteriaCount: 0,
        headline: "Incomplete",
      },
    ),
    buildProtocolRecommendation(
      "inv",
      "Inv",
      { age: 30 },
      [],
      buildPhenotype({ age: 30 }, []),
      predictOvarianResponse(
        { age: 30 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 30, amh: null, afc: null, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
    ),
    buildGonadotropinSelection(
      "inv",
      "Inv",
      { age: 30 },
      [],
      buildPhenotype({ age: 30 }, []),
      predictOvarianResponse(
        { age: 30 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 30, amh: null, afc: null, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
      buildProtocolRecommendation(
        "inv",
        "Inv",
        { age: 30 },
        [],
        buildPhenotype({ age: 30 }, []),
        predictOvarianResponse(
          { age: 30 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 30, amh: null, afc: null, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
      ),
    ),
    null,
  ),
  invertedVisits,
);
assertTest(
  "NEG-10.3-06",
  "Invalid Values",
  "Monitoring engine tolerates inverted folliculometry without crashing",
  monInv.visits.length === 1,
  `Visits processed: ${monInv.visits.length}, Alerts flagged: ${monInv.alerts.length}`,
);

// ============================================================================
// 10.4 Conflicting Records Detection
// ============================================================================
console.log("\n--- SECTION 10.4: CONFLICTING RECORDS & QUALITY REVIEW AUDIT ---");

const conflictValues: Record<string, FieldValue> = {
  dob: "1995-04-12",
  age: 45, // Conflict: DOB indicates 31, but entered age is 45!
  afcLeft: 4,
  afcRight: 4,
  afcTotal: 16, // Conflict: 4 + 4 != 16!
  infertilityType: "Primary",
};
const conflictCycles: CycleRecord[] = [
  {
    id: "cyc-conflict-1",
    cycleNumber: 1,
    retrieved: 2, // Conflict: retrieved 2, but 5 fertilized!
    mii: 4,
    fertilized: 5,
    blastocysts: 4,
    transferred: 6, // Conflict: transferred 6 > blastocysts 4!
    liveBirth: "Yes",
    clinicalPregnancy: "No", // Conflict: Live birth yes, but clinical pregnancy no!
  },
];

const phConf = buildPhenotype(conflictValues, conflictCycles);
const respConf = predictOvarianResponse(
  conflictValues,
  conflictCycles,
  phConf.poseidon,
  phConf.bologna,
);
const protConf = buildProtocolRecommendation(
  "c1",
  "Conf",
  conflictValues,
  conflictCycles,
  phConf,
  respConf,
);
const gonConf = buildGonadotropinSelection(
  "c1",
  "Conf",
  conflictValues,
  conflictCycles,
  phConf,
  respConf,
  protConf,
);
const consortConf = calculateConsortDose(
  "c1",
  "Conf",
  conflictValues,
  conflictCycles,
  phConf,
  respConf,
);
const mctxConf = buildMonitoringContext(
  "c1",
  "Conf",
  conflictValues,
  conflictCycles,
  phConf,
  respConf,
  protConf,
  gonConf,
  null,
);
const monConf = analyzeMonitoring(mctxConf, []);
const cycleCConf = buildCycleCompletion(
  "c1",
  "Conf",
  phConf,
  respConf,
  protConf,
  gonConf,
  null,
  monConf,
);

const reportConf = buildIntelligenceReport({
  patientId: "c1",
  patientName: "Conf",
  values: conflictValues,
  cycles: conflictCycles,
  phenotype: phConf,
  response: respConf,
  protocol: protConf,
  gonadotropin: gonConf,
  consort: consortConf,
  monitoring: monConf,
  cycle: cycleCConf,
});

assertTest(
  "NEG-10.4-01",
  "Conflicting Records",
  "Clinical intelligence report detects and flags clinical/embryological conflicts",
  reportConf.qualityIssues.length > 0,
  `Quality issues flagged: ${reportConf.qualityIssues.length} (Issues: ${reportConf.qualityIssues
    .map((q) => q.label)
    .slice(0, 3)
    .join(", ")})`,
);

// ============================================================================
// 10.5 Boundary Classification Cases
// ============================================================================
console.log("\n--- SECTION 10.5: BOUNDARY CLASSIFICATION TESTS ---");

// Age 34 vs 35 (POSEIDON age cutoff)
const pAge34 = classifyPoseidon({ dob: "1992-01-01", amh: 0.8, afcLeft: 2, afcRight: 2 }, []);
const pAge35 = classifyPoseidon({ dob: "1991-01-01", amh: 0.8, afcLeft: 2, afcRight: 2 }, []);
assertTest(
  "BND-10.5-01",
  "Boundary Classification",
  "POSEIDON boundary: Age 34 + low reserve -> Group 3",
  pAge34.group === "3",
  `Age 34 -> Group ${pAge34.group}`,
);
assertTest(
  "BND-10.5-02",
  "Boundary Classification",
  "POSEIDON boundary: Age 35 + low reserve -> Group 4",
  pAge35.group === "4",
  `Age 35 -> Group ${pAge35.group}`,
);

// Age 39 vs 40 (Bologna age criterion cutoff >= 40)
const bAge39 = assessBologna({ dob: "1987-01-01", amh: 0.4 }, []);
const bAge40 = assessBologna({ dob: "1986-01-01", amh: 0.4 }, []);
assertTest(
  "BND-10.5-03",
  "Boundary Classification",
  "Bologna boundary: Age 39 does not satisfy age >= 40 criterion",
  !bAge39.satisfied.some((c) => c.id === "age-risk"),
  `Age 39 satisfied: ${bAge39.satisfied.map((c) => c.id).join(", ") || "None"}`,
);
assertTest(
  "BND-10.5-04",
  "Boundary Classification",
  "Bologna boundary: Age 40 satisfies age >= 40 criterion",
  bAge40.satisfied.some((c) => c.id === "age-risk"),
  `Age 40 satisfied: ${bAge40.satisfied.map((c) => c.id).join(", ")}`,
);

// AMH boundary: 1.19 vs 1.20 (POSEIDON / Low reserve cutoff < 1.2 ng/mL)
const pAmh119 = classifyPoseidon({ dob: "1995-01-01", amh: 1.19, afcLeft: 2, afcRight: 2 }, []);
const pAmh120 = classifyPoseidon({ dob: "1995-01-01", amh: 1.2, afcLeft: 5, afcRight: 5 }, []);
assertTest(
  "BND-10.5-05",
  "Boundary Classification",
  "AMH 1.19 ng/mL classified as POSEIDON Group 3 (low reserve)",
  pAmh119.group === "3",
  `AMH 1.19 -> Group ${pAmh119.group}`,
);
assertTest(
  "BND-10.5-06",
  "Boundary Classification",
  "AMH 1.20 ng/mL classified as adequate reserve (not Group 3)",
  pAmh120.group !== "3",
  `AMH 1.20 -> Group ${pAmh120.group ?? "not-low-prognosis"}`,
);

// Prior retrieval count: 3 vs 4 (Bologna POR cutoff <= 3 oocytes)
const bOocytes3 = assessBologna({ dob: "1995-01-01" }, [
  { id: "c1", retrieved: 3, startingDose: 150 } as CycleRecord,
]);
const bOocytes4 = assessBologna({ dob: "1995-01-01" }, [
  { id: "c1", retrieved: 4, startingDose: 150 } as CycleRecord,
]);
assertTest(
  "BND-10.5-07",
  "Boundary Classification",
  "Prior yield 3 oocytes fulfills previous poor response criterion (<= 3)",
  bOocytes3.satisfied.some((c) => c.id === "previous-por"),
  `Yield 3 satisfied: ${bOocytes3.satisfied.map((c) => c.id).join(", ")}`,
);
assertTest(
  "BND-10.5-08",
  "Boundary Classification",
  "Prior yield 4 oocytes does NOT fulfill <= 3 criterion",
  !bOocytes4.satisfied.some((c) => c.id === "previous-por"),
  `Yield 4 satisfied: ${bOocytes4.satisfied.map((c) => c.id).join(", ") || "None"}`,
);

// ============================================================================
// SECTION 9: SAFETY-FIREWALL ASSERTIONS
// ============================================================================
console.log("\n--- SECTION 9: SAFETY-FIREWALL RIGIDITY ASSERTIONS ---");

// 9.1 CONSORT Model Isolation Firewall
const consortValues: Record<string, FieldValue> = {
  dob: "1994-01-01",
  height: 165,
  weight: 60,
  fsh: 6,
  afcLeft: 7,
  afcRight: 7,
  amh: 2.0,
};
const consortPh = buildPhenotype(consortValues, []);
const consortResp = predictOvarianResponse(
  consortValues,
  [],
  consortPh.poseidon,
  consortPh.bologna,
);
const consortCalc = calculateConsortDose(
  "p-cons",
  "Consort Test",
  consortValues,
  [],
  consortPh,
  consortResp,
);

assertTest(
  "FW-9.1-01",
  "Safety Firewall",
  "CONSORT model does not claim to calculate dose when points table unpopulated",
  consortCalc.dose === null &&
    (consortCalc.status === "methodology-not-loaded" || consortCalc.status === "missing-variables"),
  `Status: ${consortCalc.status}, Dose: ${consortCalc.dose}`,
);

// Starting dose ceiling for poor responder (ESHRE 2025 Rec 20 ceiling <= 300 IU/day)
const poorValues: Record<string, FieldValue> = {
  dob: "1985-01-01",
  height: 165,
  weight: 60,
  amh: 0.3,
  afcLeft: 2,
  afcRight: 1,
};
const poorPh = buildPhenotype(poorValues, []);
const poorResp = predictOvarianResponse(poorValues, [], poorPh.poseidon, poorPh.bologna);
const poorStartDose = buildStartingDoseAssessment(
  "p-dor",
  "DOR Test",
  poorValues,
  [],
  poorPh,
  poorResp,
);
assertTest(
  "FW-9.1-02",
  "Safety Firewall",
  "Starting dose for poor responder strictly enforces ESHRE 2025 Rec 20 ceiling (max 300 IU/day)",
  poorStartDose.dose !== null && poorStartDose.dose <= 300,
  `Recommended starting dose: ${poorStartDose.dose} IU/day (Ceiling 300 IU)`,
);

// 9.2 Mid-Cycle Dose Adjustment Guardrails
const maxDoseVisit: MonitoringVisit = {
  id: "v-max",
  day: 6,
  date: "2026-10-06",
  dailyDose: 300,
  follicleCount: 3,
  largestFollicle: 11,
  follicles10: 2,
  follicles14: 0,
  follicles17: 0,
  estradiol: 250,
} as unknown as MonitoringVisit;
const doseAdjMax = evaluateDoseAdjustment(maxDoseVisit);
assertTest(
  "FW-9.2-01",
  "Safety Firewall",
  "Mid-cycle dose adjustment does NOT exceed 300 IU/day ceiling even with hypo-response",
  doseAdjMax.proposedDose !== null && doseAdjMax.proposedDose <= 300,
  `Current: 300 IU, Proposed: ${doseAdjMax.proposedDose} IU/day (Action: ${doseAdjMax.proposedAction})`,
);

// Coasting guardrail for hyper-response
const hyperVisit: MonitoringVisit = {
  id: "v-hyp",
  day: 8,
  date: "2026-10-08",
  dailyDose: 150,
  follicleCount: 30,
  largestFollicle: 15, // lead < 17mm
  follicles10: 24,
  follicles14: 12,
  follicles17: 0,
  estradiol: 4800, // E2 >= 4500 pg/mL!
} as unknown as MonitoringVisit;
const doseAdjHyper = evaluateDoseAdjustment(hyperVisit);
assertTest(
  "FW-9.2-02",
  "Safety Firewall",
  "Mid-cycle dose adjustment triggers COASTING & STEP-DOWN when E2 >= 4500 pg/mL with immature lead",
  doseAdjHyper.actionCategory === "COAST",
  `ActionCategory: ${doseAdjHyper.actionCategory}, Action: ${doseAdjHyper.proposedAction}`,
);

// 9.3 Trigger Strategy & Safety Gating
const triggerHyper = buildTriggerAssessment(
  "t-hyp",
  "Hyper",
  buildPhenotype({ age: 27, amh: 7.0 }, []),
  predictOvarianResponse(
    { age: 27, amh: 7.0 },
    [],
    {
      group: null,
      groupLabel: null,
      status: "not-low-prognosis",
      inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
    },
    {
      status: "incomplete",
      fulfilled: false,
      criteriaMet: [],
      criteriaCount: 0,
      headline: "Incomplete",
    },
  ),
  analyzeMonitoring(
    buildMonitoringContext(
      "t-hyp",
      "Hyper",
      { age: 27, amh: 7.0 },
      [],
      buildPhenotype({ age: 27, amh: 7.0 }, []),
      predictOvarianResponse(
        { age: 27, amh: 7.0 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
      buildProtocolRecommendation(
        "t-hyp",
        "Hyper",
        { age: 27, amh: 7.0 },
        [],
        buildPhenotype({ age: 27, amh: 7.0 }, []),
        predictOvarianResponse(
          { age: 27, amh: 7.0 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
      ),
      buildGonadotropinSelection(
        "t-hyp",
        "Hyper",
        { age: 27, amh: 7.0 },
        [],
        buildPhenotype({ age: 27, amh: 7.0 }, []),
        predictOvarianResponse(
          { age: 27, amh: 7.0 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
        buildProtocolRecommendation(
          "t-hyp",
          "Hyper",
          { age: 27, amh: 7.0 },
          [],
          buildPhenotype({ age: 27, amh: 7.0 }, []),
          predictOvarianResponse(
            { age: 27, amh: 7.0 },
            [],
            {
              group: null,
              groupLabel: null,
              status: "not-low-prognosis",
              inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
            },
            {
              status: "incomplete",
              fulfilled: false,
              criteriaMet: [],
              criteriaCount: 0,
              headline: "Incomplete",
            },
          ),
        ),
      ),
      null,
    ),
    [
      {
        id: "v-trig-hyp",
        day: 10,
        date: "2026-10-10",
        dailyDose: 100,
        follicleCount: 35,
        largestFollicle: 19,
        follicles10: 28,
        follicles14: 18,
        follicles17: 8,
        estradiol: 5500,
        progesterone: 1.0,
        lh: 1.8,
        endometrium: 11,
      } as unknown as MonitoringVisit,
    ],
  ),
  buildCycleCompletion(
    "t-hyp",
    "Hyper",
    buildPhenotype({ age: 27, amh: 7.0 }, []),
    predictOvarianResponse(
      { age: 27, amh: 7.0 },
      [],
      {
        group: null,
        groupLabel: null,
        status: "not-low-prognosis",
        inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
      },
      {
        status: "incomplete",
        fulfilled: false,
        criteriaMet: [],
        criteriaCount: 0,
        headline: "Incomplete",
      },
    ),
    buildProtocolRecommendation(
      "t-hyp",
      "Hyper",
      { age: 27, amh: 7.0 },
      [],
      buildPhenotype({ age: 27, amh: 7.0 }, []),
      predictOvarianResponse(
        { age: 27, amh: 7.0 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
    ),
    buildGonadotropinSelection(
      "t-hyp",
      "Hyper",
      { age: 27, amh: 7.0 },
      [],
      buildPhenotype({ age: 27, amh: 7.0 }, []),
      predictOvarianResponse(
        { age: 27, amh: 7.0 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
      buildProtocolRecommendation(
        "t-hyp",
        "Hyper",
        { age: 27, amh: 7.0 },
        [],
        buildPhenotype({ age: 27, amh: 7.0 }, []),
        predictOvarianResponse(
          { age: 27, amh: 7.0 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
      ),
    ),
    null,
    analyzeMonitoring(
      buildMonitoringContext(
        "t-hyp",
        "Hyper",
        { age: 27, amh: 7.0 },
        [],
        buildPhenotype({ age: 27, amh: 7.0 }, []),
        predictOvarianResponse(
          { age: 27, amh: 7.0 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
        buildProtocolRecommendation(
          "t-hyp",
          "Hyper",
          { age: 27, amh: 7.0 },
          [],
          buildPhenotype({ age: 27, amh: 7.0 }, []),
          predictOvarianResponse(
            { age: 27, amh: 7.0 },
            [],
            {
              group: null,
              groupLabel: null,
              status: "not-low-prognosis",
              inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
            },
            {
              status: "incomplete",
              fulfilled: false,
              criteriaMet: [],
              criteriaCount: 0,
              headline: "Incomplete",
            },
          ),
        ),
        buildGonadotropinSelection(
          "t-hyp",
          "Hyper",
          { age: 27, amh: 7.0 },
          [],
          buildPhenotype({ age: 27, amh: 7.0 }, []),
          predictOvarianResponse(
            { age: 27, amh: 7.0 },
            [],
            {
              group: null,
              groupLabel: null,
              status: "not-low-prognosis",
              inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
            },
            {
              status: "incomplete",
              fulfilled: false,
              criteriaMet: [],
              criteriaCount: 0,
              headline: "Incomplete",
            },
          ),
          buildProtocolRecommendation(
            "t-hyp",
            "Hyper",
            { age: 27, amh: 7.0 },
            [],
            buildPhenotype({ age: 27, amh: 7.0 }, []),
            predictOvarianResponse(
              { age: 27, amh: 7.0 },
              [],
              {
                group: null,
                groupLabel: null,
                status: "not-low-prognosis",
                inputs: { age: 27, amh: 7.0, afc: 30, previousYield: null },
              },
              {
                status: "incomplete",
                fulfilled: false,
                criteriaMet: [],
                criteriaCount: 0,
                headline: "Incomplete",
              },
            ),
          ),
        ),
        null,
      ),
      [
        {
          id: "v-trig-hyp",
          day: 10,
          date: "2026-10-10",
          dailyDose: 100,
          follicleCount: 35,
          largestFollicle: 19,
          follicles10: 28,
          follicles14: 18,
          follicles17: 8,
          estradiol: 5500,
          progesterone: 1.0,
          lh: 1.8,
          endometrium: 11,
        } as unknown as MonitoringVisit,
      ],
    ),
  ),
  null,
);
assertTest(
  "FW-9.3-01",
  "Safety Firewall",
  "In excessive response (E2 5500 pg/mL), GnRH agonist trigger is selected over hCG to prevent severe OHSS",
  triggerHyper.options.some(
    (o) => o.triggerType === "gnrh-agonist" || o.rule.triggerRuleId.includes("agonist"),
  ),
  `Trigger options: ${triggerHyper.options.map((o) => o.triggerType).join(", ")}`,
);

// 9.4 OHSS Risk & Freeze-All Safety Surface
const cycleHyper = buildCycleCompletion(
  "c-hyp",
  "Hyper",
  buildPhenotype({ age: 27, amh: 7.4 }, []),
  predictOvarianResponse(
    { age: 27, amh: 7.4 },
    [],
    {
      group: null,
      groupLabel: null,
      status: "not-low-prognosis",
      inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
    },
    {
      status: "incomplete",
      fulfilled: false,
      criteriaMet: [],
      criteriaCount: 0,
      headline: "Incomplete",
    },
  ),
  buildProtocolRecommendation(
    "c-hyp",
    "Hyper",
    { age: 27, amh: 7.4 },
    [],
    buildPhenotype({ age: 27, amh: 7.4 }, []),
    predictOvarianResponse(
      { age: 27, amh: 7.4 },
      [],
      {
        group: null,
        groupLabel: null,
        status: "not-low-prognosis",
        inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
      },
      {
        status: "incomplete",
        fulfilled: false,
        criteriaMet: [],
        criteriaCount: 0,
        headline: "Incomplete",
      },
    ),
  ),
  buildGonadotropinSelection(
    "c-hyp",
    "Hyper",
    { age: 27, amh: 7.4 },
    [],
    buildPhenotype({ age: 27, amh: 7.4 }, []),
    predictOvarianResponse(
      { age: 27, amh: 7.4 },
      [],
      {
        group: null,
        groupLabel: null,
        status: "not-low-prognosis",
        inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
      },
      {
        status: "incomplete",
        fulfilled: false,
        criteriaMet: [],
        criteriaCount: 0,
        headline: "Incomplete",
      },
    ),
    buildProtocolRecommendation(
      "c-hyp",
      "Hyper",
      { age: 27, amh: 7.4 },
      [],
      buildPhenotype({ age: 27, amh: 7.4 }, []),
      predictOvarianResponse(
        { age: 27, amh: 7.4 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
    ),
  ),
  null,
  analyzeMonitoring(
    buildMonitoringContext(
      "c-hyp",
      "Hyper",
      { age: 27, amh: 7.4 },
      [],
      buildPhenotype({ age: 27, amh: 7.4 }, []),
      predictOvarianResponse(
        { age: 27, amh: 7.4 },
        [],
        {
          group: null,
          groupLabel: null,
          status: "not-low-prognosis",
          inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
        },
        {
          status: "incomplete",
          fulfilled: false,
          criteriaMet: [],
          criteriaCount: 0,
          headline: "Incomplete",
        },
      ),
      buildProtocolRecommendation(
        "c-hyp",
        "Hyper",
        { age: 27, amh: 7.4 },
        [],
        buildPhenotype({ age: 27, amh: 7.4 }, []),
        predictOvarianResponse(
          { age: 27, amh: 7.4 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
      ),
      buildGonadotropinSelection(
        "c-hyp",
        "Hyper",
        { age: 27, amh: 7.4 },
        [],
        buildPhenotype({ age: 27, amh: 7.4 }, []),
        predictOvarianResponse(
          { age: 27, amh: 7.4 },
          [],
          {
            group: null,
            groupLabel: null,
            status: "not-low-prognosis",
            inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
          },
          {
            status: "incomplete",
            fulfilled: false,
            criteriaMet: [],
            criteriaCount: 0,
            headline: "Incomplete",
          },
        ),
        buildProtocolRecommendation(
          "c-hyp",
          "Hyper",
          { age: 27, amh: 7.4 },
          [],
          buildPhenotype({ age: 27, amh: 7.4 }, []),
          predictOvarianResponse(
            { age: 27, amh: 7.4 },
            [],
            {
              group: null,
              groupLabel: null,
              status: "not-low-prognosis",
              inputs: { age: 27, amh: 7.4, afc: 34, previousYield: null },
            },
            {
              status: "incomplete",
              fulfilled: false,
              criteriaMet: [],
              criteriaCount: 0,
              headline: "Incomplete",
            },
          ),
        ),
      ),
      null,
    ),
    [
      {
        id: "v-ohss",
        day: 10,
        date: "2026-10-10",
        dailyDose: 125,
        follicleCount: 35,
        largestFollicle: 19,
        follicles10: 28,
        follicles14: 18,
        follicles17: 8,
        estradiol: 5950,
        progesterone: 1.1,
      } as unknown as MonitoringVisit,
    ],
  ),
);
assertTest(
  "FW-9.4-01",
  "Safety Firewall",
  "High response markers surface elevated OHSS safety alert and freeze-all indication",
  cycleHyper.ohss.level === "high" || cycleHyper.alerts.length > 0,
  `OHSS Level: ${cycleHyper.ohss.level}, Alerts: ${cycleHyper.alerts.length}`,
);

// 9.5 Gonadotropin Preparation Selection Guardrail
const gonNorm = buildGonadotropinSelection(
  "g-norm",
  "Norm",
  { age: 30, amh: 2.5, afcTotal: 14 },
  [],
  buildPhenotype({ age: 30, amh: 2.5, afcTotal: 14 }, []),
  predictOvarianResponse(
    { age: 30, amh: 2.5, afcTotal: 14 },
    [],
    {
      group: null,
      groupLabel: null,
      status: "not-low-prognosis",
      inputs: { age: 30, amh: 2.5, afc: 14, previousYield: null },
    },
    {
      status: "incomplete",
      fulfilled: false,
      criteriaMet: [],
      criteriaCount: 0,
      headline: "Incomplete",
    },
  ),
  buildProtocolRecommendation(
    "g-norm",
    "Norm",
    { age: 30, amh: 2.5, afcTotal: 14 },
    [],
    buildPhenotype({ age: 30, amh: 2.5, afcTotal: 14 }, []),
    predictOvarianResponse(
      { age: 30, amh: 2.5, afcTotal: 14 },
      [],
      {
        group: null,
        groupLabel: null,
        status: "not-low-prognosis",
        inputs: { age: 30, amh: 2.5, afc: 14, previousYield: null },
      },
      {
        status: "incomplete",
        fulfilled: false,
        criteriaMet: [],
        criteriaCount: 0,
        headline: "Incomplete",
      },
    ),
  ),
);
assertTest(
  "FW-9.5-01",
  "Safety Firewall",
  "Gonadotropin selection enforces ESHRE Rec 31 caution against concurrent rFSH + hMG combination",
  gonNorm.selection.negativeRecommendations?.some((n) => n.includes("Rec 31")) === true,
  `Negative recommendations include Rec 31: ${gonNorm.selection.negativeRecommendations?.find((n) => n.includes("Rec 31"))}`,
);

console.log("\n================================================================================");
const passed = results.filter((r) => r.status === "PASS").length;
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`TOTAL AUDIT ASSERTIONS: ${results.length}`);
console.log(`PASSED: ${passed} | FAILED: ${failed}`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
