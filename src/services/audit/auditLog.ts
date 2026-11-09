/**
 * Hash-Chained Tamper-Evident Clinical Audit Log (§2.3)
 *
 * Implements:
 *  - Append-only cryptographic audit trail.
 *  - SHA-256 hash chaining: hash = SHA-256(prevHash + canonical(event)).
 *  - Canonical JSON serialization (deterministic key sorting, zero whitespace).
 *  - Encrypted storage at rest in IndexedDB "audit" store.
 *  - Append-only enforcement (update and delete operations rejected).
 *  - Tamper detection and chain validation.
 */

import {
  encryptedStore,
  isEncryptionInitialized,
  initializeEncryption,
} from "../persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "../auth/pinConfig";

export interface AuditEntry {
  id: string;
  at: string; // ISO timestamp
  by: string; // UserId
  action: string;
  caseId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  hash: string;
  prevHash: string | null;
}

const AUDIT_INDEX_KEY = "audit_log_chain";
let inMemoryChain: AuditEntry[] = [];

// -----------------------------------------------------------------------------
// Canonical JSON Serializer & SHA-256 Cryptographic Hash
// -----------------------------------------------------------------------------

/**
 * Deterministic JSON stringifier (recursively sorted keys, no whitespace).
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalJson((obj as Record<string, unknown>)[k]),
  );
  return "{" + parts.join(",") + "}";
}

/**
 * Computes SHA-256 digest formatted as a hex string via Web Crypto.
 */
export async function sha256(message: string): Promise<string> {
  const enc = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", enc.encode(message));
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Computes the cryptographic hash for an audit entry from prevHash and canonical payload.
 */
export async function computeEntryHash(
  prevHash: string | null,
  event: {
    at: string;
    by: string;
    action: string;
    caseId?: string | undefined;
    details?: Record<string, unknown> | undefined;
  },
): Promise<string> {
  const payloadStr = canonicalJson({
    action: event.action,
    at: event.at,
    by: event.by,
    caseId: event.caseId || "",
    details: event.details || {},
  });

  const chainPayload = `${prevHash || "GENESIS"}::${payloadStr}`;
  return sha256(chainPayload);
}

// -----------------------------------------------------------------------------
// Audit Log Append & Storage
// -----------------------------------------------------------------------------

/**
 * Loads the audit chain from encrypted IndexedDB.
 */
export async function loadAuditChain(): Promise<AuditEntry[]> {
  if (!isEncryptionInitialized()) {
    try {
      await initializeEncryption(DEFAULT_DEV_PIN);
    } catch {
      /* ignore */
    }
  }

  try {
    const stored = await encryptedStore.get<AuditEntry[]>("audit", AUDIT_INDEX_KEY);
    if (stored && Array.isArray(stored)) {
      inMemoryChain = stored;
    }
  } catch {
    /* fallback to memory */
  }

  return [...inMemoryChain];
}

/**
 * Appends a new auditable event to the tamper-evident chain.
 */
export async function appendAuditEntry(params: {
  by: string;
  action: string;
  caseId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  at?: string | undefined;
}): Promise<AuditEntry> {
  const at = params.at || new Date().toISOString();
  const prevEntry = inMemoryChain[inMemoryChain.length - 1];
  const prevHash = prevEntry ? prevEntry.hash : null;

  const eventPayload = {
    action: params.action,
    at,
    by: params.by,
    caseId: params.caseId,
    details: params.details,
  };

  const hash = await computeEntryHash(prevHash, eventPayload);
  const id = `audit-${Date.now()}-${hash.slice(0, 10)}`;

  const entry: AuditEntry = {
    id,
    at,
    by: params.by,
    action: params.action,
    caseId: params.caseId,
    details: params.details,
    hash,
    prevHash,
  };

  inMemoryChain.push(entry);

  // Persist to encrypted IndexedDB
  if (!isEncryptionInitialized()) {
    try {
      await initializeEncryption(DEFAULT_DEV_PIN);
    } catch {
      return entry;
    }
  }

  try {
    await encryptedStore.set("audit", AUDIT_INDEX_KEY, inMemoryChain);
  } catch {
    /* storage unavailable */
  }

  return entry;
}

/**
 * Append-Only Enforcement Defense:
 * Explicitly rejects any update or delete attempts on the audit log.
 */
export function updateAuditEntry(): never {
  throw new Error("APPEND_ONLY_VIOLATION: Audit log entries are immutable and cannot be updated.");
}

export function deleteAuditEntry(): never {
  throw new Error("APPEND_ONLY_VIOLATION: Audit log entries are immutable and cannot be deleted.");
}

/**
 * Verifies the integrity of the audit chain.
 * Returns true if every hash matches the canonical chain, or false with the broken index.
 */
export async function verifyAuditChain(chain: AuditEntry[] = inMemoryChain): Promise<{
  valid: boolean;
  brokenAtIndex?: number;
  reason?: string;
}> {
  if (chain.length === 0) {
    return { valid: true };
  }

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    if (!current) continue;

    // Check link to previous entry
    if (i === 0) {
      if (current.prevHash !== null) {
        return {
          valid: false,
          brokenAtIndex: 0,
          reason: "Genesis entry prevHash must be null.",
        };
      }
    } else {
      const prev = chain[i - 1];
      if (!prev || current.prevHash !== prev.hash) {
        return {
          valid: false,
          brokenAtIndex: i,
          reason: `Chain link broken at entry #${i}: prevHash does not match entry #${i - 1} hash.`,
        };
      }
    }

    // Recompute and verify current entry's hash
    const expectedHash = await computeEntryHash(current.prevHash, {
      action: current.action,
      at: current.at,
      by: current.by,
      caseId: current.caseId,
      details: current.details,
    });

    if (expectedHash !== current.hash) {
      return {
        valid: false,
        brokenAtIndex: i,
        reason: `Cryptographic tamper detected at entry #${i}: recorded hash does not match canonical payload.`,
      };
    }
  }

  return { valid: true };
}

export function getAuditChain(): AuditEntry[] {
  return [...inMemoryChain];
}

export function clearAuditChainForTesting(): void {
  inMemoryChain = [];
}
