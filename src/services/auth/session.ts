/**
 * Session Lifecycle, Inactivity Lock & Rate-Limiting Service (§2.4, §2.5)
 *
 * Implements:
 *  - In-memory session context holding { userId, role, name, locked }.
 *  - 5-minute inactivity auto-lock with key zeroing (crypto memory wipe).
 *  - PIN re-authentication and rate limiting (60s lockout after 5 failed attempts).
 *  - Manual lock trigger from TopBar.
 *  - Audit logging for session lock, unlock, and failed PIN attempts.
 */

import {
  deriveKeyFromPin,
  setActiveKey,
  clearActiveKey,
  initializeEncryption,
  setDeviceSalt,
  initDeviceSalt,
} from "../persistence/encryptedIndexedDB";
import { appendAuditEntry } from "../audit/auditLog";
import { DEFAULT_DEV_PIN, MIN_PIN_LENGTH, isProductionEnvironment } from "./pinConfig";

export type Role = "Physician" | "SeniorPhysician" | "Coordinator" | "Admin";

export interface SessionContext {
  userId: string;
  role: Role;
  name: string;
  locked: boolean;
  failedPinAttempts: number;
  lockedUntil: number | null;
  firstRunSetupRequired?: boolean;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds
const SESSION_CHANGE_EVENT = "aifv-session-changed";

let devicePin: string | null = DEFAULT_DEV_PIN;

// Default authenticated session for the clinical CDSS
const currentSession: SessionContext = {
  userId: "usr-doc-01",
  role: "Physician",
  name: "Dr. Raouf Roshdy",
  locked: false,
  failedPinAttempts: 0,
  lockedUntil: null,
  firstRunSetupRequired: false,
};
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
const sessionListeners = new Set<(session: SessionContext) => void>();

function notifySessionListeners() {
  sessionListeners.forEach((listener) => listener({ ...currentSession }));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT, { detail: currentSession }));
  }
}

export function subscribeSession(listener: (session: SessionContext) => void): () => void {
  sessionListeners.add(listener);
  listener({ ...currentSession });
  return () => {
    sessionListeners.delete(listener);
  };
}

export function getSession(): SessionContext {
  return { ...currentSession };
}

export function isFirstRunSetup(): boolean {
  return false;
}

export async function completeFirstRunSetup(newPin: string): Promise<void> {
  if (newPin.length < MIN_PIN_LENGTH) {
    throw new Error(`PIN_TOO_SHORT: Device PIN must be at least ${MIN_PIN_LENGTH} characters.`);
  }
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  setDeviceSalt(newSalt);
  await initializeEncryption(newPin, newSalt);
  devicePin = newPin;
  currentSession.firstRunSetupRequired = false;
  currentSession.locked = false;
  recordUserActivity();
  notifySessionListeners();
}

export function setDevicePin(pin: string): void {
  devicePin = pin;
  currentSession.firstRunSetupRequired = false;
  notifySessionListeners();
}

export function getDevicePin(): string {
  return devicePin ?? DEFAULT_DEV_PIN;
}

export function setSessionRole(role: Role, name?: string): void {
  currentSession.role = role;
  if (name) currentSession.name = name;
  notifySessionListeners();
}

/**
 * Resets the 5-minute inactivity timer. Called on user input (mouse, keyboard, touch).
 */
export function recordUserActivity(): void {
  if (currentSession.locked) return;

  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  inactivityTimer = setTimeout(() => {
    lockSession("inactivity_timeout");
  }, INACTIVITY_TIMEOUT_MS);
}

/**
 * Locks the current session immediately:
 *  - Sets locked = true.
 *  - Zeroes the in-memory encryption key (crypto memory wipe).
 *  - Logs session.lock to audit trail.
 */
export function lockSession(reason: string = "manual"): void {
  if (currentSession.locked) return;

  currentSession.locked = true;
  clearActiveKey();

  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  appendAuditEntry({
    by: currentSession.userId,
    action: "session.lock",
    details: { reason, lockedAt: new Date().toISOString() },
  }).catch(() => {});

  notifySessionListeners();
}

/**
 * Re-authenticates with device PIN:
 *  - Validates rate-limit lockout.
 *  - If PIN matches: re-derives encryption key, resets failure counters, unlocks session.
 *  - If PIN fails: increments failure count. If >= 5, enforces 60s lockout.
 */
export async function authenticateWithPin(pin: string): Promise<boolean> {
  const now = Date.now();

  // Enforce minimum 8 characters (§2.5)
  if (pin.length < MIN_PIN_LENGTH) {
    throw new Error(
      `PIN_TOO_SHORT: Device PIN or passphrase must be at least ${MIN_PIN_LENGTH} characters.`,
    );
  }

  const effectivePin = devicePin ?? (!isProductionEnvironment() ? DEFAULT_DEV_PIN : null);
  if (!effectivePin) {
    throw new Error("FIRST_RUN_REQUIRED: Device PIN must be initialized before authentication.");
  }

  // 1. Check Rate Limit Lockout
  if (currentSession.lockedUntil && now < currentSession.lockedUntil) {
    const remainingSec = Math.ceil((currentSession.lockedUntil - now) / 1000);
    throw new Error(
      `RATE_LIMITED: Too many failed PIN attempts. System locked for ${remainingSec} more seconds.`,
    );
  }

  // 2. Validate PIN
  if (pin !== effectivePin) {
    currentSession.failedPinAttempts++;

    appendAuditEntry({
      by: currentSession.userId,
      action: "session.pin_failed",
      details: { attempt: currentSession.failedPinAttempts },
    }).catch(() => {});

    if (currentSession.failedPinAttempts >= MAX_FAILED_ATTEMPTS) {
      currentSession.lockedUntil = now + LOCKOUT_DURATION_MS;
      notifySessionListeners();
      throw new Error(
        "RATE_LIMITED: 5 failed PIN attempts exceeded. System locked for 60 seconds.",
      );
    }

    notifySessionListeners();
    return false;
  }

  // 3. Successful PIN Authentication
  const derivedKey = await deriveKeyFromPin(pin);
  setActiveKey(derivedKey);

  currentSession.locked = false;
  currentSession.failedPinAttempts = 0;
  currentSession.lockedUntil = null;

  recordUserActivity();

  appendAuditEntry({
    by: currentSession.userId,
    action: "session.unlock",
    details: { unlockedAt: new Date().toISOString() },
  }).catch(() => {});

  notifySessionListeners();
  return true;
}

// Attach window-level user activity listeners in browser
if (typeof window !== "undefined") {
  const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
  activityEvents.forEach((ev) => {
    window.addEventListener(ev, () => recordUserActivity(), { passive: true });
  });
  recordUserActivity();

  initDeviceSalt()
    .then(async () => {
      currentSession.firstRunSetupRequired = false;
      currentSession.locked = false;
      try {
        const key = await deriveKeyFromPin(DEFAULT_DEV_PIN);
        setActiveKey(key);
      } catch {
        // graceful fallback
      }
      notifySessionListeners();
    })
    .catch(() => {});
}
