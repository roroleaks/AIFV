/**
 * Intake Auto-Stratification & Case Creation Regression Test (§3 Check 10)
 *
 * Verifies:
 *  1. Age + AMH + AFC entered -> POSEIDON, Bologna, Phenotype chips appear automatically
 *     with ZERO "Calculate" button press.
 *  2. Incomplete intake (Identity only) -> "Stratification incomplete" status.
 *  3. Reactive completion -> chips appear reactively and incomplete status clears.
 *  4. Save & Open Case -> Baseline D0 encounter pre-drafted, internal non-MRN caseId created,
 *     CaseHeader chips match runStratification byte-identical.
 *  5. Hard range validation blocks invalid saves; soft warnings trigger confirm-on-save.
 */

import { validateIntake } from "../src/features/encounter/validation";
import { INITIAL_INTAKE_DATA, type IntakeData } from "../src/features/intake/types";
import {
  generateCaseId,
  intakeToPatientRecord,
  intakeToBaselineEncounter,
  saveCaseFromIntake,
  computeStratificationPreview,
} from "../src/features/intake/intakeAdapter";
import { runStratification } from "../src/services/clinical/orchestrators";

console.log("================================================================================");
console.log("STARTING INTAKE AUTO-STRATIFICATION & ZERO-BUTTON REGRESSION TEST");
console.log("================================================================================");

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (errorDetail) console.error(`    Detail: ${errorDetail}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// Test 1: Complete Minimum Data (Age + AMH + AFC) Auto-Stratification
// -----------------------------------------------------------------------------
console.log("\n[TEST GROUP 1] Reactive Auto-Stratification (Zero Calculate Button)");

const completeIntake: IntakeData = {
  ...INITIAL_INTAKE_DATA,
  identity: {
    mrn: "MRN-55201",
    fullName: "Nora Al-Mansoor",
    dob: "1994-06-15",
    age: 32,
    sex: "female",
    partnerName: "Tariq Al-Mansoor",
    contactPhone: "+971-50-1234567",
    allergyBand: "No known allergies",
  },
  anthropometrics: {
    heightCm: 165,
    weightKg: 62,
    bmi: 22.8,
    parity: 0,
    gravidity: 0,
    previousIvfAttempts: 0,
    previousOhss: false,
    smokingStatus: "never",
    comorbidities: [],
    currentMedications: "Prenatal multivitamins",
    allergies: "None",
  },
  reserveMarkers: {
    amh: 2.4,
    afcRight: 7,
    afcLeft: 7,
    afcTotal: 14,
    basalFsh: 6.8,
    basalE2: 45,
    basalLh: 5.2,
    antralFolliclePattern: "Normal bilateral distribution",
  },
  diagnosis: {
    primaryCause: "male-factor",
    secondaryFlags: [],
    infertilityDuration: 24,
    previousTreatments: "2x IUI negative",
  },
  cycleIntent: {
    cycleType: "ICSI",
    transferPolicy: "fresh",
    cycleNumber: 1,
  },
};

const preview1 = computeStratificationPreview(completeIntake);

assert(
  preview1.isComplete === true,
  "Stratification preview marks isComplete=true when age + AMH + AFC are present",
);

assert(
  preview1.chips.length === 3,
  "Drawer surfaces 3 stratification chips (POSEIDON, Bologna, Response)",
  `Got ${preview1.chips.length} chips`,
);

const poseidonChip = preview1.chips.find((c) => c.label.includes("POSEIDON"));
assert(
  poseidonChip !== undefined && poseidonChip.label.length > 0,
  "POSEIDON chip is present without button press",
  poseidonChip?.label,
);

const bolognaChip = preview1.chips.find((c) => c.label.includes("Bologna"));
assert(
  bolognaChip !== undefined && bolognaChip.label.includes("Negative"),
  "Bologna chip correctly indicates Negative for normal reserve patient",
  bolognaChip?.label,
);

const responseChip = preview1.chips.find((c) => c.label.includes("Response"));
assert(
  responseChip !== undefined &&
    (responseChip.label.includes("NORMAL") || responseChip.label.includes("HIGH")),
  "Ovarian response chip is classified",
  responseChip?.label,
);

// -----------------------------------------------------------------------------
// Test 2: Incomplete Intake (Identity Only) Degradation
// -----------------------------------------------------------------------------
console.log("\n[TEST GROUP 2] Incomplete Data Degradation");

const identityOnlyIntake: IntakeData = {
  ...INITIAL_INTAKE_DATA,
  identity: {
    mrn: "MRN-90214",
    fullName: "Mariam Khalil",
    dob: "1990-01-20",
    age: 36,
    sex: "female",
    partnerName: "",
    contactPhone: "",
    allergyBand: "",
  },
  reserveMarkers: {
    amh: null,
    afcRight: null,
    afcLeft: null,
    afcTotal: null,
    basalFsh: null,
    basalE2: null,
    basalLh: null,
    antralFolliclePattern: "",
  },
};

const preview2 = computeStratificationPreview(identityOnlyIntake);

assert(
  preview2.isComplete === false,
  "Stratification preview marks isComplete=false when reserve markers are pending",
);

assert(
  preview2.chips.length === 0,
  "Stratification chips are empty for incomplete intake (neutral badge shown)",
);

// -----------------------------------------------------------------------------
// Test 3: Reactive Completion of Partial Intake
// -----------------------------------------------------------------------------
console.log("\n[TEST GROUP 3] Reactive Completion of Reserve Markers");

const completedIntake: IntakeData = {
  ...identityOnlyIntake,
  reserveMarkers: {
    amh: 0.7,
    afcRight: 2,
    afcLeft: 2,
    afcTotal: 4,
    basalFsh: 11.2,
    basalE2: 38,
    basalLh: 6.1,
    antralFolliclePattern: "Reduced bilateral antral count",
  },
};

const preview3 = computeStratificationPreview(completedIntake);

assert(
  preview3.isComplete === true,
  "Stratification preview updates reactively to isComplete=true when reserve markers filled",
);

const completedPoseidon = preview3.chips.find((c) => c.label.includes("POSEIDON"));
assert(
  completedPoseidon !== undefined &&
    (completedPoseidon.label.includes("Group 3") || completedPoseidon.label.includes("Group 4")),
  "POSEIDON correctly classifies low prognosis (Group 3/4) for AMH=0.7, AFC=4",
  completedPoseidon?.label,
);

// -----------------------------------------------------------------------------
// Test 4: Save Case & Baseline D0 Encounter Pre-Drafting
// -----------------------------------------------------------------------------
console.log("\n[TEST GROUP 4] Case Creation & Baseline D0 Encounter Pre-Drafting");

const newCaseId = generateCaseId();

// Assert zero PHI in caseId
assert(
  !newCaseId.includes(completeIntake.identity.mrn) &&
    !newCaseId.includes("Nora") &&
    !newCaseId.includes("Mansoor") &&
    newCaseId.startsWith("case-"),
  "Generated caseId is internal random slug/UUID (ZERO PHI in URLs/IDs)",
  newCaseId,
);

const patientRecord = intakeToPatientRecord(completeIntake, newCaseId);
assert(patientRecord.id === newCaseId, "PatientRecord id matches generated caseId");
assert(
  patientRecord.values.amh === 2.4 && patientRecord.values.afc === 14,
  "PatientRecord values contain reserve markers from intake",
);

const baselineEncounter = intakeToBaselineEncounter(completeIntake, newCaseId);
assert(
  baselineEncounter.day === 0,
  "Baseline encounter is Day 0 (D0)",
  `Day: ${baselineEncounter.day}`,
);
assert(
  baselineEncounter.ultrasound.folliclesRight.lt10 === 7 &&
    baselineEncounter.ultrasound.folliclesLeft.lt10 === 7,
  "Baseline ultrasound follicles match intake AFC (Right: 7, Left: 7)",
);
assert(
  baselineEncounter.labs.amhNgMl === 2.4 &&
    baselineEncounter.labs.estradiolPgMl === 45 &&
    baselineEncounter.labs.lhMiuMl === 5.2,
  "Baseline labs match intake AMH, E2, LH",
);
assert(
  baselineEncounter.medications.gonadotropinType === "Baseline Assessment",
  "Baseline encounter labeled as Baseline Assessment",
);

// Check byte-identical orchestrator output between drawer preview and saved case
const savedCaseInput = {
  patient: patientRecord,
  visits: [],
};
const directStrat = runStratification(savedCaseInput);

function stripTimestamp(obj: Record<string, unknown> | null | undefined) {
  if (!obj) return obj;
  const copy = { ...obj };
  delete copy.computedAt;
  return copy;
}

assert(
  JSON.stringify(stripTimestamp(preview1.strat?.poseidon)) ===
    JSON.stringify(stripTimestamp(directStrat.poseidon)),
  "Drawer preview POSEIDON matches saved case runStratification byte-identically",
);
assert(
  JSON.stringify(stripTimestamp(preview1.strat?.bologna)) ===
    JSON.stringify(stripTimestamp(directStrat.bologna)),
  "Drawer preview Bologna matches saved case runStratification byte-identically",
);
assert(
  JSON.stringify(stripTimestamp(preview1.strat?.ovarianResponse)) ===
    JSON.stringify(stripTimestamp(directStrat.ovarianResponse)),
  "Drawer preview Ovarian Response matches saved case runStratification byte-identically",
);

// -----------------------------------------------------------------------------
// Test 5: Validation - Hard Ranges & Soft Warnings
// -----------------------------------------------------------------------------
console.log("\n[TEST GROUP 5] Validation (Hard Range Block & Soft Warnings)");

// Valid intake
const validResult = validateIntake(completeIntake);
assert(
  validResult.isValid === true && validResult.hardIssues.length === 0,
  "Standard intake passes validation with 0 hard errors",
);

// Hard range error: AMH 25 ng/mL (> 20)
const invalidAmhIntake: IntakeData = {
  ...completeIntake,
  reserveMarkers: { ...completeIntake.reserveMarkers, amh: 25 },
};
const invalidAmhResult = validateIntake(invalidAmhIntake);
assert(
  invalidAmhResult.isValid === false &&
    invalidAmhResult.hardIssues.some((e) => e.field.includes("amh")),
  "Hard range: AMH = 25 ng/mL (> 20) blocks save with hard error",
);

// Hard range error: Age 16 (< 18)
const invalidAgeIntake: IntakeData = {
  ...completeIntake,
  identity: { ...completeIntake.identity, age: 16 },
};
const invalidAgeResult = validateIntake(invalidAgeIntake);
assert(
  invalidAgeResult.isValid === false &&
    invalidAgeResult.hardIssues.some((e) => e.field.includes("age")),
  "Hard range: Age = 16 (< 18) blocks save with hard error",
);

// Hard range error: BMI 55 (> 50)
const invalidBmiIntake: IntakeData = {
  ...completeIntake,
  anthropometrics: { ...completeIntake.anthropometrics, bmi: 55 },
};
const invalidBmiResult = validateIntake(invalidBmiIntake);
assert(
  invalidBmiResult.isValid === false &&
    invalidBmiResult.hardIssues.some((e) => e.field.includes("bmi")),
  "Hard range: BMI = 55 (> 50) blocks save with hard error",
);

// Soft warning: AMH 0.4 ng/mL (< 0.5)
const lowReserveIntake: IntakeData = {
  ...completeIntake,
  reserveMarkers: { ...completeIntake.reserveMarkers, amh: 0.4 },
};
const lowReserveResult = validateIntake(lowReserveIntake);
assert(
  lowReserveResult.isValid === true &&
    lowReserveResult.softWarnings.some(
      (w) => w.triggerCondition === "amh < 0.5" || w.message.includes("depleted ovarian reserve"),
    ),
  "Soft warning: AMH = 0.4 ng/mL triggers 'depleted ovarian reserve' confirm-on-save warning",
);

// Soft warning: AMH 6.5 ng/mL (> 5.0)
const highReserveIntake: IntakeData = {
  ...completeIntake,
  reserveMarkers: { ...completeIntake.reserveMarkers, amh: 6.5 },
};
const highReserveResult = validateIntake(highReserveIntake);
assert(
  highReserveResult.isValid === true &&
    highReserveResult.softWarnings.some(
      (w) => w.triggerCondition === "amh > 5.0" || w.message.includes("PCOS spectrum"),
    ),
  "Soft warning: AMH = 6.5 ng/mL triggers 'PCOS spectrum' warning",
);

// Soft warning: Age 44 (> 42)
const olderAgeIntake: IntakeData = {
  ...completeIntake,
  identity: { ...completeIntake.identity, age: 44 },
};
const olderAgeResult = validateIntake(olderAgeIntake);
assert(
  olderAgeResult.isValid === true &&
    olderAgeResult.softWarnings.some(
      (w) => w.triggerCondition === "age > 42" || w.message.includes("Advanced maternal age"),
    ),
  "Soft warning: Maternal age = 44 triggers age-related warning",
);

// -----------------------------------------------------------------------------
// Final Verdict
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(
  `INTAKE AUTO-STRATIFICATION REGRESSION RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`,
);
console.log("================================================================================");

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log("ALL INTAKE STRATIFICATION & ZERO-BUTTON SPECIFICATIONS VERIFIED.");
  process.exit(0);
}
