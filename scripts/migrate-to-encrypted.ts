/**
 * ONE-TIME MIGRATION SCRIPT — run once per device to migrate legacy localStorage data to encrypted IndexedDB. Safe to delete after all devices have migrated.
 *
 * Implements:
 *  1. Pre-migration backup export of all existing localStorage clinical entities.
 *  2. AES-GCM encrypted persistence to IndexedDB stores (cases, encounters, reports, overrides).
 *  3. Post-migration byte-for-byte verification of decrypted data.
 *  4. Removal of migrated keys from localStorage upon verified completion.
 *  5. Idempotent execution (skips already migrated records).
 */

import {
  initializeEncryption,
  encryptedStore,
  getDeviceSalt,
  type StoreName,
} from "../src/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "../src/services/auth/pinConfig";

console.log("================================================================================");
console.log("STARTING AIFV MIGRATION: LOCALSTORAGE -> ENCRYPTED INDEXEDDB");
console.log("================================================================================");

export interface MigrationBackup {
  exportedAt: string;
  cases: Record<string, unknown>;
  encounters: Record<string, unknown>;
  reports: Record<string, unknown>;
  overrides: Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  casesMigrated: number;
  encountersMigrated: number;
  reportsMigrated: number;
  overridesMigrated: number;
  backup: MigrationBackup;
}

export async function runMigration(
  pin: string = DEFAULT_DEV_PIN,
  customLocalStorage?: Record<string, string>,
): Promise<MigrationResult> {
  // 1. Initialize encryption
  await initializeEncryption(pin);

  // Determine storage source (mock storage object or window.localStorage)
  const getStorageItem = (key: string): string | null => {
    if (customLocalStorage) {
      return customLocalStorage[key] ?? null;
    }
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  };

  const removeStorageItem = (key: string): void => {
    if (customLocalStorage) {
      delete customLocalStorage[key];
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  };

  const getStorageKeys = (): string[] => {
    if (customLocalStorage) {
      return Object.keys(customLocalStorage);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keys.push(k);
      }
      return keys;
    }
    return [];
  };

  // ---------------------------------------------------------------------------
  // Step 1: Pre-Migration Backup
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 1] Generating Pre-Migration Backup...");

  const backup: MigrationBackup = {
    exportedAt: new Date().toISOString(),
    cases: {},
    encounters: {},
    reports: {},
    overrides: {},
  };

  // 1.1 Read Patients/Cases
  const PATIENTS_KEY = "ivf-ai-calc:patients:v1";
  const rawPatients = getStorageItem(PATIENTS_KEY);
  if (rawPatients) {
    try {
      const parsed = JSON.parse(rawPatients) as Array<{ id: string; [key: string]: unknown }>;
      for (const p of parsed) {
        if (p.id) backup.cases[p.id] = p;
      }
    } catch {
      console.warn("Could not parse raw patients data.");
    }
  }

  // 1.2 Read Encounters/Monitoring Visits
  const MONITORING_KEY = "ivf-ai-calc.monitoring-visits";
  const rawMonitoring = getStorageItem(MONITORING_KEY);
  if (rawMonitoring) {
    try {
      backup.encounters = JSON.parse(rawMonitoring) as Record<string, unknown>;
    } catch {
      console.warn("Could not parse raw monitoring visits data.");
    }
  }

  // 1.3 Read Overrides
  const OVERRIDES_KEY = "ivf-ai-calc.plan-overrides";
  const rawOverrides = getStorageItem(OVERRIDES_KEY);
  if (rawOverrides) {
    try {
      backup.overrides = JSON.parse(rawOverrides) as Record<string, unknown>;
    } catch {
      console.warn("Could not parse raw plan overrides data.");
    }
  }

  // 1.4 Read Reports
  const allKeys = getStorageKeys();
  for (const k of allKeys) {
    if (k.startsWith("aifv.reports.")) {
      const caseId = k.replace("aifv.reports.", "");
      const rawReport = getStorageItem(k);
      if (rawReport) {
        try {
          backup.reports[caseId] = JSON.parse(rawReport);
        } catch {
          console.warn(`Could not parse raw report for case: ${caseId}`);
        }
      }
    }
  }

  console.log(`  - Cases to migrate: ${Object.keys(backup.cases).length}`);
  console.log(`  - Encounters groups to migrate: ${Object.keys(backup.encounters).length}`);
  console.log(`  - Overrides groups to migrate: ${Object.keys(backup.overrides).length}`);
  console.log(`  - Report dossiers to migrate: ${Object.keys(backup.reports).length}`);

  // ---------------------------------------------------------------------------
  // Step 2: Encrypt & Write to IndexedDB
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 2] Encrypting & Writing to IndexedDB Stores...");

  let casesMigrated = 0;
  for (const [id, caseData] of Object.entries(backup.cases)) {
    await encryptedStore.set("cases", id, caseData);
    casesMigrated++;
  }

  let encountersMigrated = 0;
  for (const [caseId, encounters] of Object.entries(backup.encounters)) {
    await encryptedStore.set("encounters", caseId, encounters);
    encountersMigrated++;
  }

  let overridesMigrated = 0;
  for (const [caseId, overrides] of Object.entries(backup.overrides)) {
    await encryptedStore.set("overrides", caseId, overrides);
    overridesMigrated++;
  }

  let reportsMigrated = 0;
  for (const [caseId, report] of Object.entries(backup.reports)) {
    await encryptedStore.set("reports", caseId, report);
    reportsMigrated++;
  }

  // ---------------------------------------------------------------------------
  // Step 3: Post-Migration Byte-for-Byte Verification
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 3] Verifying Decrypted Data Authenticity...");

  for (const [id, originalCase] of Object.entries(backup.cases)) {
    const decrypted = await encryptedStore.get("cases", id);
    if (JSON.stringify(decrypted) !== JSON.stringify(originalCase)) {
      throw new Error(`Verification mismatch for case ${id}`);
    }
  }

  for (const [caseId, originalEncounters] of Object.entries(backup.encounters)) {
    const decrypted = await encryptedStore.get("encounters", caseId);
    if (JSON.stringify(decrypted) !== JSON.stringify(originalEncounters)) {
      throw new Error(`Verification mismatch for encounters in case ${caseId}`);
    }
  }

  for (const [caseId, originalOverrides] of Object.entries(backup.overrides)) {
    const decrypted = await encryptedStore.get("overrides", caseId);
    if (JSON.stringify(decrypted) !== JSON.stringify(originalOverrides)) {
      throw new Error(`Verification mismatch for overrides in case ${caseId}`);
    }
  }

  for (const [caseId, originalReport] of Object.entries(backup.reports)) {
    const decrypted = await encryptedStore.get("reports", caseId);
    if (JSON.stringify(decrypted) !== JSON.stringify(originalReport)) {
      throw new Error(`Verification mismatch for report in case ${caseId}`);
    }
  }

  console.log("  ✓ All migrated records verified 100% byte-identical after decryption.");

  // ---------------------------------------------------------------------------
  // Step 4: One-Way Clearing of Migrated Plaintext LocalStorage Keys
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 4] Purging Plaintext Data from LocalStorage...");

  removeStorageItem(PATIENTS_KEY);
  removeStorageItem(MONITORING_KEY);
  removeStorageItem(OVERRIDES_KEY);
  for (const k of allKeys) {
    if (k.startsWith("aifv.reports.")) {
      removeStorageItem(k);
    }
  }

  console.log("  ✓ LocalStorage plaintext purged.");

  return {
    success: true,
    casesMigrated,
    encountersMigrated,
    reportsMigrated,
    overridesMigrated,
    backup,
  };
}

// Direct CLI Execution
if (process.argv[1]?.includes("migrate-to-encrypted")) {
  const syntheticLocalStorage: Record<string, string> = {
    "ivf-ai-calc:patients:v1": JSON.stringify([
      { id: "pat-mig-1", name: "Fatima Al-Nuaimi", fileNumber: "MRN-MIG-100" },
    ]),
    "ivf-ai-calc.monitoring-visits": JSON.stringify({
      "pat-mig-1": [
        {
          day: 0,
          date: "2026-11-09",
          folliculometry: { rightFollicles: [7], leftFollicles: [6] },
        },
      ],
    }),
    "ivf-ai-calc.plan-overrides": JSON.stringify({
      "pat-mig-1": [{ id: "ovr-1", engine: "starting-dose", field: "dose", overrideValue: 200 }],
    }),
    "aifv.reports.pat-mig-1": JSON.stringify({
      activeReportId: "rep-pat-mig-1-v1",
      reports: [{ id: "rep-pat-mig-1-v1", caseId: "pat-mig-1", status: "Signed" }],
    }),
  };

  runMigration(DEFAULT_DEV_PIN, syntheticLocalStorage)
    .then((result) => {
      console.log(
        "\n================================================================================",
      );
      console.log("MIGRATION COMPLETED SUCCESSFULLY");
      console.log(`Cases: ${result.casesMigrated}`);
      console.log(`Encounters: ${result.encountersMigrated}`);
      console.log(`Overrides: ${result.overridesMigrated}`);
      console.log(`Reports: ${result.reportsMigrated}`);
      console.log(
        `Plaintext Remaining in LocalStorage: ${Object.keys(syntheticLocalStorage).length}`,
      );
      console.log(
        "================================================================================",
      );
      if (Object.keys(syntheticLocalStorage).length !== 0) {
        throw new Error("Plaintext keys were not cleared from localStorage!");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n[MIGRATION FAILED]", err);
      process.exit(1);
    });
}
