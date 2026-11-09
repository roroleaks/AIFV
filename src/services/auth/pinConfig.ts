/**
 * Clinical Device PIN Configuration & Policy (§2.2)
 *
 * Single Source of Truth for:
 *  - Minimum PIN / passphrase length (8 characters).
 *  - Development-only fallback PIN ("12345678").
 *  - First-run production setup enforcement.
 */

/** Standard clinical default PIN for cryptographic derivation. */
export const DEFAULT_DEV_PIN = "12345678";

/** Enforced minimum entropy length for real brute-force resistance across PBKDF2 600K derivation. */
export const MIN_PIN_LENGTH = 8;

/**
 * Checks whether the current runtime environment is production.
 */
export function isProductionEnvironment(): boolean {
  if (typeof process !== "undefined" && process.env?.["NODE_ENV"] === "production") {
    return true;
  }
  // Vite client import.meta.env check
  if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
    return true;
  }
  return false;
}
