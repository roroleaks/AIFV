/**
 * Offline Sync Queue & Conflict Resolution Service (§2.2)
 *
 * Implements:
 *  - Queue of operations with client-generated idempotency keys.
 *  - Encrypted persistence of the queue in IndexedDB (store: "syncQueue").
 *  - LocalFileTarget (USB/File bundle drain) & HttpTarget (REST stub).
 *  - Online/offline detection with debounced automatic queue draining.
 *  - Conflict resolution: Server-wins for signed reports; LWW for drafts with conflict marker.
 */

import {
  encryptedStore,
  isEncryptionInitialized,
  initializeEncryption,
} from "./encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "../auth/pinConfig";

export type SyncOpKind =
  | "encounter.upsert"
  | "encounter.delete"
  | "override.apply"
  | "override.reverse"
  | "report.sign"
  | "report.cosign"
  | "report.addendum"
  | "report.export";

export type SyncStatus = "queued" | "syncing" | "synced" | "conflict";

export interface SyncOp {
  id: string; // Idempotency key
  at: string; // ISO timestamp
  by: string; // UserId
  kind: SyncOpKind;
  caseId: string;
  payload: unknown;
  status: SyncStatus;
  conflictReason?: string;
  serverVersion?: unknown;
}

export interface SyncResult {
  syncedCount: number;
  conflictedCount: number;
  syncedOpIds: string[];
  conflictedOps: Array<{ id: string; reason: string }>;
}

export interface SyncTarget {
  name: string;
  push(ops: SyncOp[]): Promise<SyncResult>;
  pull(since: string): Promise<SyncOp[]>;
}

// -----------------------------------------------------------------------------
// Sync Targets: LocalFileTarget & HttpTarget
// -----------------------------------------------------------------------------

export class LocalFileTarget implements SyncTarget {
  name = "LocalFileTarget";
  private exportedBundles: Array<{ exportedAt: string; ops: SyncOp[] }> = [];

  async push(ops: SyncOp[]): Promise<SyncResult> {
    const bundle = {
      exportedAt: new Date().toISOString(),
      ops: JSON.parse(JSON.stringify(ops)) as SyncOp[],
    };
    this.exportedBundles.push(bundle);

    return {
      syncedCount: ops.length,
      conflictedCount: 0,
      syncedOpIds: ops.map((o) => o.id),
      conflictedOps: [],
    };
  }

  async pull(_since: string): Promise<SyncOp[]> {
    return this.exportedBundles.flatMap((b) => b.ops);
  }

  getExportedBundles() {
    return this.exportedBundles;
  }

  getLatestBundleJson(): string {
    const latest = this.exportedBundles[this.exportedBundles.length - 1];
    return latest ? JSON.stringify(latest, null, 2) : "{}";
  }
}

export class HttpTarget implements SyncTarget {
  name = "HttpTarget";
  private endpointUrl: string | null;

  constructor(endpointUrl: string | null = null) {
    this.endpointUrl = endpointUrl;
  }

  async push(_ops: SyncOp[]): Promise<SyncResult> {
    if (!this.endpointUrl) {
      throw new Error("NOT_IMPLEMENTED: HttpTarget requires a configured clinic endpoint URL.");
    }
    throw new Error("NOT_IMPLEMENTED: Hospital EHR write-back integration is clinic-specific.");
  }

  async pull(_since: string): Promise<SyncOp[]> {
    if (!this.endpointUrl) {
      throw new Error("NOT_IMPLEMENTED: HttpTarget requires a configured clinic endpoint URL.");
    }
    return [];
  }
}

// -----------------------------------------------------------------------------
// Sync Queue Manager
// -----------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = "pending_ops";
let inMemoryQueue: SyncOp[] = [];
let simulatedOnlineOverride: boolean | null = null;
let currentSyncTarget: SyncTarget = new LocalFileTarget();
let drainDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function isOnline(): boolean {
  if (simulatedOnlineOverride !== null) {
    return simulatedOnlineOverride;
  }
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

export function setOnlineStatusForTesting(online: boolean | null): void {
  simulatedOnlineOverride = online;
}

export function setSyncTarget(target: SyncTarget): void {
  currentSyncTarget = target;
}

export function getSyncTarget(): SyncTarget {
  return currentSyncTarget;
}

/**
 * Loads the encrypted sync queue from IndexedDB.
 */
export async function loadQueue(): Promise<SyncOp[]> {
  if (!isEncryptionInitialized()) {
    try {
      await initializeEncryption(DEFAULT_DEV_PIN);
    } catch {
      /* ignore */
    }
  }

  try {
    const persisted = await encryptedStore.get<SyncOp[]>("syncQueue", QUEUE_STORAGE_KEY);
    if (persisted && Array.isArray(persisted)) {
      inMemoryQueue = persisted;
    }
  } catch {
    /* fallback to memory */
  }

  return inMemoryQueue;
}

/**
 * Persists the sync queue to encrypted IndexedDB.
 */
export async function persistQueue(): Promise<void> {
  if (!isEncryptionInitialized()) {
    try {
      await initializeEncryption(DEFAULT_DEV_PIN);
    } catch {
      return;
    }
  }

  try {
    await encryptedStore.set("syncQueue", QUEUE_STORAGE_KEY, inMemoryQueue);
  } catch {
    /* ignore */
  }
}

/**
 * Generates an internal unique idempotency key.
 */
export function generateIdempotencyKey(kind: SyncOpKind, caseId: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `sync-${kind.replace(".", "-")}-${caseId}-${ts}-${rand}`;
}

/**
 * Enqueues a new mutating operation with an idempotency key.
 */
export async function enqueueOp(params: {
  kind: SyncOpKind;
  caseId: string;
  by: string;
  payload: unknown;
  id?: string;
}): Promise<SyncOp> {
  const id = params.id || generateIdempotencyKey(params.kind, params.caseId);
  const op: SyncOp = {
    id,
    at: new Date().toISOString(),
    by: params.by,
    kind: params.kind,
    caseId: params.caseId,
    payload: params.payload,
    status: "queued",
  };

  inMemoryQueue.push(op);
  await persistQueue();

  // If online, schedule debounced automatic drain (2 seconds)
  if (isOnline()) {
    scheduleDebouncedDrain();
  }

  return op;
}

export function getQueuedOps(): SyncOp[] {
  return [...inMemoryQueue];
}

export function clearQueue(): void {
  inMemoryQueue = [];
}

/**
 * Conflict Resolution Logic (§2.2):
 *  - Signed reports: Server-wins. Local signed version cannot overwrite server signed version;
 *    marked with status="conflict".
 *  - Drafts: Last-writer-wins by timestamp, flagged with conflictReason for UI review.
 */
export function resolveConflict(
  clientOp: SyncOp,
  serverRecord: { status?: string; at?: string; payload?: unknown },
): { resolvedOp: SyncOp; isConflict: boolean } {
  // 1. Signed Reports: Strict Server-Wins
  if (
    clientOp.kind === "report.sign" ||
    clientOp.kind === "report.cosign" ||
    clientOp.kind === "report.addendum"
  ) {
    if (serverRecord.status === "Signed") {
      return {
        resolvedOp: {
          ...clientOp,
          status: "conflict",
          conflictReason:
            "SERVER_WINS: Report is already signed on server. Local modification flagged as conflict.",
          serverVersion: serverRecord,
        },
        isConflict: true,
      };
    }
  }

  // 2. Drafts: Last-Writer-Wins by Timestamp
  const serverTime = serverRecord.at ? new Date(serverRecord.at).getTime() : 0;
  const clientTime = new Date(clientOp.at).getTime();

  if (serverTime > clientTime) {
    return {
      resolvedOp: {
        ...clientOp,
        status: "conflict",
        conflictReason: `LWW_OVERRIDDEN: Server modification (${serverRecord.at}) is newer than client (${clientOp.at}). Review required.`,
        serverVersion: serverRecord,
      },
      isConflict: true,
    };
  }

  // Client wins LWW
  return {
    resolvedOp: {
      ...clientOp,
      status: "synced",
    },
    isConflict: false,
  };
}

/**
 * Drains the queue against the active SyncTarget.
 */
export async function drainQueue(target: SyncTarget = currentSyncTarget): Promise<SyncResult> {
  const pending = inMemoryQueue.filter((o) => o.status === "queued" || o.status === "syncing");
  if (pending.length === 0) {
    return {
      syncedCount: 0,
      conflictedCount: 0,
      syncedOpIds: [],
      conflictedOps: [],
    };
  }

  // Mark in-flight
  pending.forEach((o) => (o.status = "syncing"));

  try {
    const result = await target.push(pending);

    // Update statuses based on target results
    for (const op of inMemoryQueue) {
      if (result.syncedOpIds.includes(op.id)) {
        op.status = "synced";
      }
      const conflicted = result.conflictedOps.find((c) => c.id === op.id);
      if (conflicted) {
        op.status = "conflict";
        op.conflictReason = conflicted.reason;
      }
    }

    await persistQueue();
    return result;
  } catch (err: unknown) {
    pending.forEach((o) => (o.status = "queued"));
    await persistQueue();
    throw err;
  }
}

function scheduleDebouncedDrain() {
  if (drainDebounceTimer) {
    clearTimeout(drainDebounceTimer);
  }
  drainDebounceTimer = setTimeout(() => {
    drainQueue().catch(() => {
      /* retry on next trigger */
    });
  }, 2000);
}
