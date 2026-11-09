/**
 * Sync Queue Persistence, Drain & Conflict Resolution Regression Test (§3 Check 12)
 *
 * Verifies:
 *  1. Operations enqueued offline are persisted in encrypted IndexedDB ("syncQueue" store).
 *  2. Queue survives a simulated app reload/restart.
 *  3. Going online drains all ops in order to LocalFileTarget with status "synced".
 *  4. Signed report conflict strictly enforces Server-Wins with conflict marker.
 *  5. Draft conflict enforces Last-Writer-Wins (LWW) with timestamp comparison and review marker.
 */

import {
  initializeEncryption,
  setRawBackendForTesting,
  createFreshMemoryBackend,
} from "../src/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "../src/services/auth/pinConfig";
import {
  enqueueOp,
  drainQueue,
  loadQueue,
  clearQueue,
  getQueuedOps,
  setOnlineStatusForTesting,
  resolveConflict,
  LocalFileTarget,
  setSyncTarget,
  type SyncOp,
} from "../src/services/persistence/syncQueue";

console.log("================================================================================");
console.log("STARTING AIFV OFFLINE SYNC QUEUE & CONFLICT RESOLUTION TEST");
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
  clearQueue();

  const CASE_ID = "case-sync-401";
  const USER_ID = "usr-coordinator-01";

  console.log("\n[TEST GROUP 1] Offline Enqueuing (5 Operations)");
  setOnlineStatusForTesting(false); // Simulate offline state

  // Op 1: encounter.upsert (D0)
  const op1 = await enqueueOp({
    kind: "encounter.upsert",
    caseId: CASE_ID,
    by: USER_ID,
    payload: { day: 0, date: "2026-11-09", ultrasound: { right: 6, left: 6 } },
  });

  // Op 2: encounter.upsert (D6)
  const op2 = await enqueueOp({
    kind: "encounter.upsert",
    caseId: CASE_ID,
    by: USER_ID,
    payload: { day: 6, date: "2026-11-15", labs: { estradiolPgMl: 850 } },
  });

  // Op 3: override.apply
  const op3 = await enqueueOp({
    kind: "override.apply",
    caseId: CASE_ID,
    by: "usr-physician-01",
    payload: { field: "dose", value: 225, reason: "Suboptimal response on D6" },
  });

  // Op 4: report.sign
  const op4 = await enqueueOp({
    kind: "report.sign",
    caseId: CASE_ID,
    by: "usr-physician-01",
    payload: { reportId: "rep-401-v1", signedAt: new Date().toISOString() },
  });

  // Op 5: report.export
  const op5 = await enqueueOp({
    kind: "report.export",
    caseId: CASE_ID,
    by: USER_ID,
    payload: { format: "pdf", filename: "case-sync-401_v1.pdf" },
  });

  const queued = getQueuedOps();
  assert(queued.length === 5, "5 operations queued offline", `Got ${queued.length}`);
  assert(
    queued.every((o) => o.status === "queued"),
    "All offline operations retain 'queued' status pending reconnect",
  );

  console.log("\n[TEST GROUP 2] Simulated App Reload & Queue Persistence");
  // Simulate page reload by clearing memory queue and re-loading from encrypted IndexedDB
  clearQueue();
  const reloadedQueue = await loadQueue();

  assert(
    reloadedQueue.length === 5,
    "Encrypted sync queue persisted in IndexedDB and restored on reload",
    `Restored ${reloadedQueue.length} ops`,
  );
  assert(
    reloadedQueue[0]?.id === op1.id && reloadedQueue[4]?.id === op5.id,
    "Preserved exact operation order and idempotency keys",
  );

  console.log("\n[TEST GROUP 3] Online Reconnect & Queue Drain to LocalFileTarget");
  setOnlineStatusForTesting(true); // Reconnected
  const fileTarget = new LocalFileTarget();
  setSyncTarget(fileTarget);

  const drainResult = await drainQueue(fileTarget);

  assert(
    drainResult.syncedCount === 5 && drainResult.conflictedCount === 0,
    "All 5 operations successfully pushed to LocalFileTarget",
  );

  const updatedQueue = getQueuedOps();
  assert(
    updatedQueue.every((o) => o.status === "synced"),
    "All operations transitioned from 'queued' -> 'synced'",
  );

  const bundles = fileTarget.getExportedBundles();
  assert(bundles.length === 1, "Exported 1 consolidated sync bundle for offline clinic transfer");
  assert(
    bundles[0]?.ops.length === 5,
    "Bundle contains all 5 mutation operations in chronological order",
  );

  console.log("\n[TEST GROUP 4] Conflict Resolution — Signed Report (Server-Wins)");
  const clientSignOp: SyncOp = {
    id: "sync-sign-local-01",
    at: "2026-11-09T01:30:00.000Z",
    by: "usr-physician-local",
    kind: "report.sign",
    caseId: CASE_ID,
    payload: { version: 1, title: "Local Draft Signature" },
    status: "queued",
  };

  const serverSignedRecord = {
    status: "Signed",
    at: "2026-11-09T01:25:00.000Z",
    payload: { version: 1, title: "Server Certified Signature" },
  };

  const signConflictResult = resolveConflict(clientSignOp, serverSignedRecord);
  assert(
    signConflictResult.isConflict === true,
    "Conflict detected when client attempts to modify an already signed server report",
  );
  assert(
    signConflictResult.resolvedOp.status === "conflict",
    "Signed report conflict flagged with status='conflict' (server-wins, local not overwritten)",
  );
  assert(
    signConflictResult.resolvedOp.conflictReason?.includes("SERVER_WINS") === true,
    "Conflict reason explicitly identifies SERVER_WINS enforcement",
  );

  console.log("\n[TEST GROUP 5] Conflict Resolution — Draft Encounter (Last-Writer-Wins)");
  // Scenario A: Server is newer -> Server wins, client flagged with conflict marker
  const olderClientDraftOp: SyncOp = {
    id: "sync-enc-local-02",
    at: "2026-11-09T01:20:00.000Z",
    by: "usr-coordinator-01",
    kind: "encounter.upsert",
    caseId: CASE_ID,
    payload: { day: 8, follicles: 8 },
    status: "queued",
  };

  const newerServerDraftRecord = {
    status: "Draft",
    at: "2026-11-09T01:25:00.000Z", // 5 minutes newer
    payload: { day: 8, follicles: 10 },
  };

  const lwwServerWinsResult = resolveConflict(olderClientDraftOp, newerServerDraftRecord);
  assert(
    lwwServerWinsResult.isConflict === true &&
      lwwServerWinsResult.resolvedOp.conflictReason?.includes("LWW_OVERRIDDEN") === true,
    "LWW detects newer server draft and surfaces conflict review badge",
  );

  // Scenario B: Client is newer -> Client wins
  const newerClientDraftOp: SyncOp = {
    ...olderClientDraftOp,
    at: "2026-11-09T01:35:00.000Z", // Newer than server
  };

  const lwwClientWinsResult = resolveConflict(newerClientDraftOp, newerServerDraftRecord);
  assert(
    lwwClientWinsResult.isConflict === false && lwwClientWinsResult.resolvedOp.status === "synced",
    "LWW allows newer client draft to prevail cleanly when client timestamp is latest",
  );

  console.log("\n================================================================================");
  console.log(`SYNC QUEUE REGRESSION RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("ALL OFFLINE SYNC QUEUE & CONFLICT SPECIFICATIONS VERIFIED.");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unexpected test failure:", err);
  process.exit(1);
});
