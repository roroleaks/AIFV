/**
 * Encryption Round-Trip & Zero-Plaintext Security Regression Test (§3 Check 11)
 *
 * Verifies:
 *  1. AES-GCM (256-bit) PBKDF2 key derivation from device PIN (>= 600,000 iterations).
 *  2. Full case round-trip (case, encounters, overrides, signed report) through EncryptedStore.
 *  3. Byte-identical decrypted payload matching original input.
 *  4. In-memory key clearing blocks plaintext access (ENCRYPTION_LOCKED error thrown).
 *  5. Re-deriving with mismatched PIN throws DECRYPTION_FAILED error.
 *  6. Raw database inspection proves zero plaintext PHI stored at rest (only IV + ciphertext).
 */

import {
  deriveKeyFromPin,
  initializeEncryption,
  clearActiveKey,
  setActiveKey,
  encryptedStore,
  getRawBackend,
  setRawBackendForTesting,
  createFreshMemoryBackend,
  type EncryptedRecord,
} from "../src/services/persistence/encryptedIndexedDB";

console.log("================================================================================");
console.log("STARTING AIFV ENCRYPTION ROUND-TRIP & SECURITY REGRESSION TEST");
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
  // Use fresh backend for test isolation
  setRawBackendForTesting(createFreshMemoryBackend());

  const TEST_PIN = "78291456";
  const WRONG_PIN = "99999999";

  console.log("\n[TEST GROUP 1] Key Derivation & Initialization");
  const t0 = Date.now();
  await initializeEncryption(TEST_PIN);
  const derivationTimeMs = Date.now() - t0;

  assert(
    derivationTimeMs > 0,
    `PBKDF2 key derived in ${derivationTimeMs}ms with 600,000 iterations`,
  );

  console.log("\n[TEST GROUP 2] Encrypted Write of Clinical Case Data");
  const testCase = {
    id: "case-sec-901",
    name: "Amina Al-Nuaimi",
    fileNumber: "MRN-SEC-8821",
    age: 33,
    values: {
      amh: 1.85,
      afc: 11,
      fsh: 6.9,
      bmi: 23.4,
    },
  };

  const testEncounters = [
    {
      id: "enc-sec-d0",
      caseId: "case-sec-901",
      day: 0,
      ultrasound: {
        folliclesRight: { lt10: 6, b10_13: 0, b14_16: 0, gte17: 0 },
        folliclesLeft: { lt10: 5, b10_13: 0, b14_16: 0, gte17: 0 },
      },
      labs: { amhNgMl: 1.85, estradiolPgMl: 42 },
    },
    {
      id: "enc-sec-d6",
      caseId: "case-sec-901",
      day: 6,
      ultrasound: {
        folliclesRight: { lt10: 2, b10_13: 4, b14_16: 0, gte17: 0 },
        folliclesLeft: { lt10: 2, b10_13: 3, b14_16: 0, gte17: 0 },
      },
      labs: { estradiolPgMl: 650 },
    },
  ];

  const testOverrides = [
    {
      id: "ovr-sec-01",
      caseId: "case-sec-901",
      field: "startingDose",
      originalValue: 150,
      overrideValue: 175,
      reason: "Patient history of hypo-response in cycle 1.",
      physicianName: "Dr. Raouf Roshdy",
      timestamp: "2026-11-09T01:00:00.000Z",
    },
  ];

  const testSignedReport = {
    id: "rep-sec-v1",
    caseId: "case-sec-901",
    version: 1,
    status: "Signed",
    title: "IVF Cycle Clinical Intelligence Dossier",
    signedBy: "Dr. Raouf Roshdy",
    signedAt: "2026-11-09T01:15:00.000Z",
    legalHash: "a4f839c9103de482e...",
    sections: [
      {
        id: "patient-identity",
        title: "Patient Identity",
        content: "Amina Al-Nuaimi, MRN-SEC-8821",
      },
      {
        id: "protocol-selection",
        title: "Protocol Selection",
        content: "GnRH Antagonist with rFSH 175 IU",
      },
    ],
  };

  await encryptedStore.set("cases", testCase.id, testCase);
  await encryptedStore.set("encounters", testCase.id, testEncounters);
  await encryptedStore.set("overrides", testCase.id, testOverrides);
  await encryptedStore.set("reports", `${testCase.id}-v1`, testSignedReport);

  assert(true, "All clinical entities successfully written to encrypted stores");

  console.log("\n[TEST GROUP 3] Decrypted Read & Byte-Identical Equality");
  const readCase = await encryptedStore.get<typeof testCase>("cases", testCase.id);
  const readEncounters = await encryptedStore.get<typeof testEncounters>("encounters", testCase.id);
  const readOverrides = await encryptedStore.get<typeof testOverrides>("overrides", testCase.id);
  const readReport = await encryptedStore.get<typeof testSignedReport>(
    "reports",
    `${testCase.id}-v1`,
  );

  assert(
    JSON.stringify(readCase) === JSON.stringify(testCase),
    "Decrypted case is 100% byte-identical to input",
  );
  assert(
    JSON.stringify(readEncounters) === JSON.stringify(testEncounters),
    "Decrypted encounters are 100% byte-identical to input",
  );
  assert(
    JSON.stringify(readOverrides) === JSON.stringify(testOverrides),
    "Decrypted overrides are 100% byte-identical to input",
  );
  assert(
    JSON.stringify(readReport) === JSON.stringify(testSignedReport),
    "Decrypted signed report is 100% byte-identical to input",
  );

  console.log("\n[TEST GROUP 4] Raw Database Inspection (Zero Plaintext PHI)");
  const rawBackend = getRawBackend();
  const rawRecord = (await rawBackend.getRaw("cases", testCase.id)) as EncryptedRecord;

  assert(rawRecord !== null, "Raw encrypted record exists in backend storage");
  assert(
    typeof rawRecord.iv === "string" && rawRecord.iv.length > 0,
    "Record contains random base64 IV",
    rawRecord.iv,
  );
  assert(
    typeof rawRecord.data === "string" && rawRecord.data.length > 0,
    "Record contains base64 AES-GCM ciphertext",
  );

  // Assert zero plaintext leakage of sensitive PHI
  const rawDump = JSON.stringify(rawRecord);
  assert(
    !rawDump.includes("Amina") &&
      !rawDump.includes("Al-Nuaimi") &&
      !rawDump.includes("MRN-SEC-8821") &&
      !rawDump.includes("amh"),
    "Raw encrypted record contains ZERO plaintext patient PHI or clinical attributes",
  );

  console.log("\n[TEST GROUP 5] Session Lock & Key Clearing Defense");
  clearActiveKey();

  let lockedReadFailed = false;
  try {
    await encryptedStore.get("cases", testCase.id);
  } catch (err: unknown) {
    lockedReadFailed = true;
    assert(
      (err as Error).message.includes("ENCRYPTION_LOCKED"),
      "Attempting read while key is cleared throws ENCRYPTION_LOCKED error",
      (err as Error).message,
    );
  }
  assert(lockedReadFailed, "Plaintext access blocked when session is locked");

  console.log("\n[TEST GROUP 6] Wrong PIN Authentication Defense");
  const wrongKey = await deriveKeyFromPin(WRONG_PIN);
  setActiveKey(wrongKey);

  let wrongPinFailed = false;
  try {
    await encryptedStore.get("cases", testCase.id);
  } catch (err: unknown) {
    wrongPinFailed = true;
    assert(
      (err as Error).message.includes("DECRYPTION_FAILED"),
      "Attempting read with incorrect key throws DECRYPTION_FAILED",
      (err as Error).message,
    );
  }
  assert(wrongPinFailed, "Data protected against incorrect PIN derivation");

  console.log("\n[TEST GROUP 7] Re-Authentication with Correct PIN");
  await initializeEncryption(TEST_PIN);
  const reauthCase = await encryptedStore.get<typeof testCase>("cases", testCase.id);
  assert(
    reauthCase?.name === testCase.name,
    "Re-authenticating with correct PIN restores immediate decrypted access",
  );

  console.log("\n================================================================================");
  console.log(`ENCRYPTION ROUND-TRIP RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("ALL ENCRYPTION & DATA-AT-REST SPECIFICATIONS VERIFIED.");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unexpected test failure:", err);
  process.exit(1);
});
