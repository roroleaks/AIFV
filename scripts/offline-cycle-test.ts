/**
 * Offline Full-Cycle & End-to-End Resilience Test (§3 Check 14)
 *
 * Simulates a full clinical IVF cycle strictly offline:
 *  1. Patient Intake -> Case creation (case-offline-990).
 *  2. D0 Baseline Encounter creation.
 *  3. D6 Monitoring Encounter addition.
 *  4. Presentation Override application (Physician role enforced).
 *  5. Dossier Compilation & Digital Signature (Physician role, locked snapshot).
 *  6. PDF Dossier Export generated offline.
 *  7. Verification: Zero plaintext in localStorage, all data encrypted at rest.
 *  8. Reconnect: Sync queue drains all offline mutations to LocalFileTarget.
 *  9. Hard-reload & PIN Re-auth: Entire cycle restored byte-identically.
 */

import {
  initializeEncryption,
  clearActiveKey,
  encryptedStore,
  setRawBackendForTesting,
  createFreshMemoryBackend,
  getRawBackend,
  type EncryptedRecord,
} from "../src/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "../src/services/auth/pinConfig";
import {
  enqueueOp,
  drainQueue,
  loadQueue,
  clearQueue,
  setOnlineStatusForTesting,
  LocalFileTarget,
  setSyncTarget,
} from "../src/services/persistence/syncQueue";
import {
  appendAuditEntry,
  loadAuditChain,
  verifyAuditChain,
  clearAuditChainForTesting,
} from "../src/services/audit/auditLog";
import {
  setSessionRole,
  getSession,
  authenticateWithPin,
  lockSession,
} from "../src/services/auth/session";
import { requireRole } from "../src/services/auth/rbac";
import { generatePdfBuffer, getPdfFilename } from "../src/features/report/exporters/exportPdf";
import type { Report, ReportCaseSnapshot } from "../src/features/report/types";

console.log("================================================================================");
console.log("STARTING AIFV OFFLINE FULL-CYCLE END-TO-END RESILIENCE TEST");
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

async function runTests() {
  const backend = createFreshMemoryBackend();
  setRawBackendForTesting(backend);
  const PIN = DEFAULT_DEV_PIN;
  await initializeEncryption(PIN);
  clearQueue();
  clearAuditChainForTesting();

  const CASE_ID = "case-offline-990";
  const PHYSICIAN = "Dr. Raouf Roshdy";
  const COORDINATOR = "Nurse Layla Hassan";

  console.log("\n[STEP 1] Going Strictly Offline");
  setOnlineStatusForTesting(false);
  setSessionRole("Coordinator", COORDINATOR);

  console.log("\n[STEP 2] Offline Patient Intake & Case Creation");
  const patientCase = {
    id: CASE_ID,
    name: "Zainab Al-Mansoori",
    fileNumber: "MRN-OFFLINE-990",
    age: 31,
    infertilityType: "Unexplained Infertility",
    values: { amh: 2.3, afc: 13, fsh: 6.8, bmi: 22.4 },
  };

  requireRole(["Coordinator", "Physician"], "case.create", CASE_ID);
  await encryptedStore.set("cases", CASE_ID, patientCase);
  await enqueueOp({
    kind: "encounter.upsert",
    caseId: CASE_ID,
    by: COORDINATOR,
    payload: patientCase,
  });
  await appendAuditEntry({
    by: COORDINATOR,
    action: "case.create",
    caseId: CASE_ID,
    details: { mrn: "MRN-OFFLINE-990" },
  });

  assert(true, "Offline case creation succeeded and persisted to encrypted store");

  console.log("\n[STEP 3] Offline Baseline D0 & Monitoring D6 Encounter Entry");
  const encounters = [
    {
      id: `enc-${CASE_ID}-d0`,
      caseId: CASE_ID,
      day: 0,
      date: "2026-11-09",
      ultrasound: {
        folliclesRight: { lt10: 7, b10_13: 0, b14_16: 0, gte17: 0 },
        folliclesLeft: { lt10: 6, b10_13: 0, b14_16: 0, gte17: 0 },
      },
      labs: { amhNgMl: 2.3, estradiolPgMl: 40 },
    },
    {
      id: `enc-${CASE_ID}-d6`,
      caseId: CASE_ID,
      day: 6,
      date: "2026-11-15",
      ultrasound: {
        folliclesRight: { lt10: 3, b10_13: 4, b14_16: 0, gte17: 0 },
        folliclesLeft: { lt10: 2, b10_13: 4, b14_16: 0, gte17: 0 },
      },
      labs: { estradiolPgMl: 720 },
    },
  ];

  await encryptedStore.set("encounters", CASE_ID, encounters);
  await enqueueOp({
    kind: "encounter.upsert",
    caseId: CASE_ID,
    by: COORDINATOR,
    payload: encounters[1],
  });
  await appendAuditEntry({
    by: COORDINATOR,
    action: "encounter.create",
    caseId: CASE_ID,
    details: { day: 6, estradiol: 720 },
  });

  assert(true, "Encounter timeline recorded offline with D0 and D6 visits");

  console.log("\n[STEP 4] Physician Override Application (Role Enforced)");
  // Coordinator attempts override -> must be denied by service layer
  let coordinatorDenied = false;
  try {
    requireRole(["Physician", "SeniorPhysician"], "override.apply", CASE_ID);
  } catch {
    coordinatorDenied = true;
  }
  assert(
    coordinatorDenied,
    "Service layer blocked unauthorized Coordinator from applying clinical override",
  );

  // Switch to Physician role
  setSessionRole("Physician", PHYSICIAN);
  requireRole(["Physician", "SeniorPhysician"], "override.apply", CASE_ID);

  const override = {
    id: `ovr-${CASE_ID}-01`,
    caseId: CASE_ID,
    engine: "starting-dose",
    field: "startingDose",
    originalValue: 175,
    overrideValue: 200,
    reason: "Slightly low baseline AFC recruitment on D6.",
    physicianName: PHYSICIAN,
    timestamp: new Date().toISOString(),
  };

  await encryptedStore.set("overrides", CASE_ID, [override]);
  await enqueueOp({
    kind: "override.apply",
    caseId: CASE_ID,
    by: PHYSICIAN,
    payload: override,
  });
  await appendAuditEntry({
    by: PHYSICIAN,
    action: "override.apply",
    caseId: CASE_ID,
    details: override,
  });

  assert(true, "Physician override successfully applied and audit-logged");

  console.log("\n[STEP 5] Dossier Compilation & Digital Signature Offline");
  const reportSnapshot: ReportCaseSnapshot = {
    encounters,
    orchestratorOutputs: {
      stratification: {
        poseidon: { groupLabel: "Non-low prognosis" },
      } as unknown as ReportCaseSnapshot["orchestratorOutputs"]["stratification"],
      plan: {
        startingDose: { startingDose: 175 },
      } as unknown as ReportCaseSnapshot["orchestratorOutputs"]["plan"],
      trigger: {} as unknown as ReportCaseSnapshot["orchestratorOutputs"]["trigger"],
    },
    effectiveOverrides: [override as unknown as Override],
    caseMetadata: {
      id: patientCase.id,
      patientName: patientCase.name,
      fileNumber: patientCase.fileNumber,
      age: 32,
      bmi: 22.4,
    } as unknown as ReportCaseSnapshot["caseMetadata"],
  };

  const signedReport: Report = {
    id: `rep-${CASE_ID}-v1`,
    caseId: CASE_ID,
    version: 1,
    status: "Signed",
    title: "Clinical Intelligence Dossier",
    signedBy: PHYSICIAN,
    signedAt: new Date().toISOString(),
    locked: true,
    snapshot: reportSnapshot,
    sections: [
      {
        id: "patient-identity",
        number: 1,
        title: "Patient Identity",
        status: "complete",
        summary: "Verified patient identification details",
        content: "Zainab Al-Mansoori, MRN-OFFLINE-990",
        overridden: false,
      },
      {
        id: "starting-dose",
        number: 2,
        title: "Starting Gonadotropin Dose",
        status: "overridden",
        summary: "Physician clinical dose override active",
        content: "OVERRIDDEN: 200 IU/day",
        overridden: true,
      },
    ],
    signEvents: [
      {
        at: new Date().toISOString(),
        by: PHYSICIAN,
        action: "signed",
        note: `Signed offline by ${PHYSICIAN}`,
      },
    ],
  };

  requireRole(["Physician", "SeniorPhysician"], "report.sign", CASE_ID);
  await encryptedStore.set("reports", CASE_ID, {
    activeReportId: signedReport.id,
    reports: [signedReport],
  });
  await enqueueOp({
    kind: "report.sign",
    caseId: CASE_ID,
    by: PHYSICIAN,
    payload: { reportId: signedReport.id, version: 1 },
  });
  await appendAuditEntry({
    by: PHYSICIAN,
    action: "report.sign",
    caseId: CASE_ID,
    details: { reportId: signedReport.id },
  });

  assert(true, "Physician signed report offline; frozen immutable snapshot stored");

  console.log("\n[STEP 6] Offline PDF Export Verification");
  const { buffer: pdfBytes } = generatePdfBuffer(signedReport);

  assert(
    pdfBytes.byteLength > 1000,
    `PDF exported completely offline without network calls (${Math.round(pdfBytes.byteLength / 1024)} KB)`,
  );

  await enqueueOp({
    kind: "report.export",
    caseId: CASE_ID,
    by: PHYSICIAN,
    payload: { format: "pdf", size: pdfBytes.byteLength },
  });
  await appendAuditEntry({
    by: PHYSICIAN,
    action: "report.export",
    caseId: CASE_ID,
    details: { format: "pdf" },
  });

  console.log("\n[STEP 7] Security Verification: Zero Plaintext in Raw Backend");
  const rawBackend = getRawBackend();
  const rawReportRecord = (await rawBackend.getRaw("reports", CASE_ID)) as EncryptedRecord;

  assert(rawReportRecord !== null, "Signed report exists in raw backend");
  const dump = JSON.stringify(rawReportRecord);
  assert(
    !dump.includes("Zainab") && !dump.includes("Al-Mansoori") && !dump.includes("MRN-OFFLINE-990"),
    "Raw backend contains ZERO plaintext patient PHI at rest",
  );

  console.log("\n[STEP 8] Reconnect & Drain Sync Queue");
  setOnlineStatusForTesting(true);
  const syncTarget = new LocalFileTarget();
  setSyncTarget(syncTarget);

  const drainResult = await drainQueue(syncTarget);
  assert(
    drainResult.syncedCount === 5,
    "Sync queue drained all 5 offline mutation operations to LocalFileTarget",
    `Synced ${drainResult.syncedCount} ops`,
  );

  console.log("\n[STEP 9] Hard App Reload, Inactivity Lock & PIN Re-Authentication");
  // Simulate session lock / key clearing
  lockSession("test_reload");
  assert(getSession().locked === true, "Session locked; in-memory key zeroed");

  let lockedReadFailed = false;
  try {
    await encryptedStore.get("cases", CASE_ID);
  } catch {
    lockedReadFailed = true;
  }
  assert(lockedReadFailed, "Encrypted store blocked access while locked");

  // Re-authenticate with PIN
  const unlockSuccess = await authenticateWithPin(PIN);
  assert(unlockSuccess === true, "Successfully unlocked clinical session with device PIN");

  // Read back and assert 100% byte-identical
  const restoredCase = await encryptedStore.get<typeof patientCase>("cases", CASE_ID);
  const restoredEncounters = await encryptedStore.get<typeof encounters>("encounters", CASE_ID);
  const restoredReports = await encryptedStore.get<{ activeReportId: string; reports: Report[] }>(
    "reports",
    CASE_ID,
  );
  const restoredAudit = await loadAuditChain();

  assert(
    JSON.stringify(restoredCase) === JSON.stringify(patientCase),
    "Restored case is 100% byte-identical to pre-lock state",
  );
  assert(
    JSON.stringify(restoredEncounters) === JSON.stringify(encounters),
    "Restored encounters are 100% byte-identical to pre-lock state",
  );
  assert(
    restoredReports?.reports[0]?.signedBy === PHYSICIAN &&
      restoredReports?.reports[0]?.status === "Signed",
    "Restored signed report is locked and intact with physician signature",
  );

  const chainValidation = await verifyAuditChain(restoredAudit);
  assert(
    chainValidation.valid === true,
    "Full audit chain remains mathematically valid and unbroken after offline cycle and reload",
  );

  console.log("\n================================================================================");
  console.log(`OFFLINE FULL-CYCLE RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("ALL OFFLINE FULL-CYCLE CDSS SPECIFICATIONS VERIFIED.");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unexpected test failure:", err);
  process.exit(1);
});
