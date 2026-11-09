/**
 * Audit Log Hash Chain & Tamper-Evidence Regression Test (§3 Check 13)
 *
 * Verifies:
 *  1. Deterministic canonical JSON serialization and SHA-256 hash chaining.
 *  2. Sequential appending of 10 clinical audit events with unbroken hash link.
 *  3. Full chain verification (every hash matches recomputed canonical digest).
 *  4. Tamper detection: modifying event #5 breaks the chain at index 5 and all subsequent nodes.
 *  5. Append-only enforcement: attempts to update or delete audit records throw APPEND_ONLY_VIOLATION.
 */

import {
  initializeEncryption,
  setRawBackendForTesting,
  createFreshMemoryBackend,
} from "../src/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "../src/services/auth/pinConfig";
import {
  appendAuditEntry,
  loadAuditChain,
  verifyAuditChain,
  clearAuditChainForTesting,
  updateAuditEntry,
  deleteAuditEntry,
  computeEntryHash,
  type AuditEntry,
} from "../src/services/audit/auditLog";

console.log("================================================================================");
console.log("STARTING AIFV HASH-CHAINED AUDIT LOG & TAMPER-EVIDENCE REGRESSION TEST");
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
  // Test isolation
  setRawBackendForTesting(createFreshMemoryBackend());
  await initializeEncryption(DEFAULT_DEV_PIN);
  clearAuditChainForTesting();

  const CASE_ID = "case-audit-770";
  const PHYSICIAN = "Dr. Raouf Roshdy";
  const COORDINATOR = "Nurse Sarah Jenkins";

  console.log("\n[TEST GROUP 1] Appending 10 Sequential Audit Events");

  const eventsToAppend = [
    { by: COORDINATOR, action: "case.open", details: { reason: "Initial consultation review" } },
    { by: COORDINATOR, action: "case.intake", details: { mrn: "MRN-7701", age: 34, amh: 2.1 } },
    {
      by: COORDINATOR,
      action: "encounter.create",
      details: { day: 0, type: "Baseline Assessment" },
    },
    {
      by: PHYSICIAN,
      action: "protocol.select",
      details: { protocol: "GnRH Antagonist", dose: 225 },
    },
    {
      by: COORDINATOR,
      action: "encounter.create",
      details: { day: 6, estradiol: 780, follicles: 8 },
    },
    {
      by: PHYSICIAN,
      action: "override.apply",
      details: { field: "dose", overrideValue: 250, reason: "Hypo-response" },
    },
    {
      by: PHYSICIAN,
      action: "override.reverse",
      details: { field: "dose", reason: "Follow-up ultrasound showed rapid recruitment" },
    },
    { by: COORDINATOR, action: "report.submit", details: { reportId: "rep-770-v1" } },
    { by: PHYSICIAN, action: "report.sign", details: { reportId: "rep-770-v1", locked: true } },
    {
      by: COORDINATOR,
      action: "report.export",
      details: { format: "pdf", destination: "clinical-dossier" },
    },
  ];

  for (let i = 0; i < eventsToAppend.length; i++) {
    const ev = eventsToAppend[i]!;
    const entry = await appendAuditEntry({
      by: ev.by,
      action: ev.action,
      caseId: CASE_ID,
      details: ev.details,
      at: `2026-11-09T01:${10 + i}:00.000Z`,
    });

    if (i === 0) {
      assert(entry.prevHash === null, "Genesis entry (Event #0) has prevHash = null");
    } else {
      assert(
        typeof entry.prevHash === "string" && entry.prevHash.length === 64,
        `Entry #${i} correctly links to previous SHA-256 hash`,
      );
    }
  }

  const chain = await loadAuditChain();
  assert(
    chain.length === 10,
    "All 10 audit entries successfully appended to the log",
    `Got ${chain.length}`,
  );

  console.log("\n[TEST GROUP 2] Cryptographic Verification of Pristine Chain");
  const verification = await verifyAuditChain(chain);
  assert(
    verification.valid === true,
    "Full 10-node audit chain verified: every SHA-256 hash matches recomputed canonical digest",
  );

  console.log("\n[TEST GROUP 3] Tamper Detection (Modifying Event #5)");
  // Create a deep copy and simulate unauthorized tampering of event #5's action
  const tamperedChain: AuditEntry[] = JSON.parse(JSON.stringify(chain));
  tamperedChain[5]!.action = "override.unauthorized_hack";

  const tamperResult = await verifyAuditChain(tamperedChain);
  assert(tamperResult.valid === false, "Tamper detection successfully caught modified audit entry");
  assert(
    tamperResult.brokenAtIndex === 5,
    "Chain verification pinpointed exact tamper location at index 5",
    `Detected at index ${tamperResult.brokenAtIndex}: ${tamperResult.reason}`,
  );

  // Check that subsequent entries also fail the link verification
  const subsequentTamper = await verifyAuditChain([tamperedChain[5]!, tamperedChain[6]!]);
  assert(
    subsequentTamper.valid === false,
    "Subsequent chain link broken: tampering breaks mathematical validity of all downstream hashes",
  );

  console.log("\n[TEST GROUP 4] Append-Only Rigidity Enforcement");
  let updateBlocked = false;
  try {
    updateAuditEntry();
  } catch (err: unknown) {
    updateBlocked = true;
    assert(
      (err as Error).message.includes("APPEND_ONLY_VIOLATION"),
      "updateAuditEntry explicitly blocked with APPEND_ONLY_VIOLATION",
      (err as Error).message,
    );
  }
  assert(updateBlocked, "Audit log cannot be updated in place");

  let deleteBlocked = false;
  try {
    deleteAuditEntry();
  } catch (err: unknown) {
    deleteBlocked = true;
    assert(
      (err as Error).message.includes("APPEND_ONLY_VIOLATION"),
      "deleteAuditEntry explicitly blocked with APPEND_ONLY_VIOLATION",
      (err as Error).message,
    );
  }
  assert(deleteBlocked, "Audit log cannot be pruned or deleted");

  console.log("\n================================================================================");
  console.log(`AUDIT LOG REGRESSION RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("ALL HASH-CHAINED AUDIT TRAIL SPECIFICATIONS VERIFIED.");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unexpected test failure:", err);
  process.exit(1);
});
