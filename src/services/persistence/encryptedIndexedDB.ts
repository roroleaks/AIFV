/**
 * Encrypted IndexedDB Persistence Service (§2.1)
 *
 * Implements AES-GCM (256-bit) encryption at rest using Web Crypto (crypto.subtle)
 * with PBKDF2 key derivation from a device PIN (>= 600,000 iterations per OWASP 2023).
 *
 * GUARANTEES:
 *  - 100% Web Crypto standard (crypto.subtle) with ZERO third-party crypto libraries.
 *  - All PHI at rest is encrypted with authenticated AES-GCM (12-byte random IV per write).
 *  - Derived CryptoKey is held in memory only; never persisted in plaintext.
 *  - In-memory key is zeroable on session lock.
 *  - Isomorphic backend: uses window.indexedDB in browsers and an in-memory/isolated
 *    store in Node.js test environments.
 */

import { isProductionEnvironment } from "../auth/pinConfig";

export type StoreName =
  "cases" | "encounters" | "reports" | "overrides" | "audit" | "syncQueue" | "preferences";

export const STORE_NAMES: readonly StoreName[] = [
  "cases",
  "encounters",
  "reports",
  "overrides",
  "audit",
  "syncQueue",
  "preferences",
] as const;

export interface EncryptedRecord {
  id: string;
  iv: string; // Base64 12-byte IV
  data: string; // Base64 ciphertext
  updatedAt: string;
}

export interface EncryptedStore {
  get<T>(storeName: StoreName, key: string): Promise<T | null>;
  set<T>(storeName: StoreName, key: string, value: T): Promise<void>;
  getAll<T>(storeName: StoreName): Promise<T[]>;
  delete(storeName: StoreName, key: string): Promise<void>;
  clear(storeName: StoreName): Promise<void>;
}

// -----------------------------------------------------------------------------
// Base64 Isomorphic Encoders
// -----------------------------------------------------------------------------

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// -----------------------------------------------------------------------------
// Key Derivation & Memory Management
// -----------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 600000;
const DB_NAME = "aifv-secure-db";
const DB_VERSION = 2;

let activeCryptoKey: CryptoKey | null = null;
let cachedDeviceSalt: Uint8Array | null = null;

/**
 * Asynchronously loads the device salt from raw IndexedDB storage.
 */
export async function initDeviceSalt(): Promise<Uint8Array | null> {
  if (cachedDeviceSalt) return cachedDeviceSalt;
  try {
    const record = await rawBackend.getRaw("preferences", "device_salt");
    if (record && record.data) {
      cachedDeviceSalt = base64ToUint8Array(record.data);
      return cachedDeviceSalt;
    }
  } catch {
    /* fallback to memory or uninitialized */
  }
  return null;
}

/**
 * Returns whether a device salt has already been initialized.
 */
export function hasDeviceSalt(): boolean {
  return cachedDeviceSalt !== null;
}

/**
 * Returns the 16-byte device-specific salt.
 * If in dev mode and not yet created, auto-generates one.
 */
export function getDeviceSalt(): Uint8Array {
  if (!cachedDeviceSalt) {
    if (!isProductionEnvironment()) {
      cachedDeviceSalt = crypto.getRandomValues(new Uint8Array(16));
      setDeviceSalt(cachedDeviceSalt);
    } else {
      throw new Error(
        "DEVICE_SALT_NOT_INITIALIZED: First-run setup required in production environment.",
      );
    }
  }
  return cachedDeviceSalt;
}

/**
 * Sets or overrides the device salt (primarily for testing and key verification).
 */
export function setDeviceSalt(salt: Uint8Array): void {
  cachedDeviceSalt = salt;
  rawBackend
    .setRaw("preferences", {
      id: "device_salt",
      iv: "",
      data: uint8ArrayToBase64(salt),
      updatedAt: new Date().toISOString(),
    })
    .catch(() => {});
}

export function resetDeviceSaltForTesting(): void {
  cachedDeviceSalt = null;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a PIN using PBKDF2 with >= 600,000 iterations.
 */
export async function deriveKeyFromPin(pin: string, customSalt?: Uint8Array): Promise<CryptoKey> {
  let salt = customSalt || cachedDeviceSalt;
  if (!salt) {
    salt = await initDeviceSalt();
  }
  if (!salt) {
    if (!isProductionEnvironment()) {
      salt = crypto.getRandomValues(new Uint8Array(16));
      setDeviceSalt(salt);
    } else {
      throw new Error("FIRST_RUN_REQUIRED: Device salt not found. Complete first-run setup.");
    }
  }
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // Never extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Initializes the in-memory active key using the provided PIN.
 */
export async function initializeEncryption(pin: string, customSalt?: Uint8Array): Promise<void> {
  activeCryptoKey = await deriveKeyFromPin(pin, customSalt);
}

/**
 * Returns the currently active in-memory key, or null if session is locked.
 */
export function getActiveKey(): CryptoKey | null {
  return activeCryptoKey;
}

/**
 * Sets the active in-memory key directly.
 */
export function setActiveKey(key: CryptoKey | null): void {
  activeCryptoKey = key;
}

/**
 * Clears the in-memory key on session lock.
 */
export function clearActiveKey(): void {
  activeCryptoKey = null;
}

/**
 * Checks if the encryption service currently has an unlocked active key.
 */
export function isEncryptionInitialized(): boolean {
  return activeCryptoKey !== null;
}

// -----------------------------------------------------------------------------
// Encryption & Decryption Primitives
// -----------------------------------------------------------------------------

export async function encryptData<T>(
  data: T,
  key: CryptoKey,
): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
    },
    key,
    plaintext,
  );

  return {
    iv: uint8ArrayToBase64(iv),
    data: uint8ArrayToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptData<T>(
  ivBase64: string,
  dataBase64: string,
  key: CryptoKey,
): Promise<T> {
  const iv = base64ToUint8Array(ivBase64);
  const ciphertext = base64ToUint8Array(dataBase64);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource,
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted)) as T;
}

// -----------------------------------------------------------------------------
// Storage Engines (IndexedDB & In-Memory Fallback)
// -----------------------------------------------------------------------------

interface RawStoreBackend {
  getRaw(storeName: StoreName, key: string): Promise<EncryptedRecord | null>;
  setRaw(storeName: StoreName, record: EncryptedRecord): Promise<void>;
  getAllRaw(storeName: StoreName): Promise<EncryptedRecord[]>;
  deleteRaw(storeName: StoreName, key: string): Promise<void>;
  clearRaw(storeName: StoreName): Promise<void>;
}

// In-Memory Fallback for Node.js / Test Runner
class MemoryStoreBackend implements RawStoreBackend {
  private stores: Map<StoreName, Map<string, EncryptedRecord>> = new Map();

  constructor() {
    for (const name of STORE_NAMES) {
      this.stores.set(name, new Map());
    }
  }

  async getRaw(storeName: StoreName, key: string): Promise<EncryptedRecord | null> {
    const store = this.stores.get(storeName);
    return store?.get(key) || null;
  }

  async setRaw(storeName: StoreName, record: EncryptedRecord): Promise<void> {
    const store = this.stores.get(storeName);
    store?.set(record.id, record);
  }

  async getAllRaw(storeName: StoreName): Promise<EncryptedRecord[]> {
    const store = this.stores.get(storeName);
    return store ? Array.from(store.values()) : [];
  }

  async deleteRaw(storeName: StoreName, key: string): Promise<void> {
    const store = this.stores.get(storeName);
    store?.delete(key);
  }

  async clearRaw(storeName: StoreName): Promise<void> {
    const store = this.stores.get(storeName);
    store?.clear();
  }
}

// Real Browser IndexedDB Backend
class IndexedDbBackend implements RawStoreBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          for (const storeName of STORE_NAMES) {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: "id" });
            }
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async getRaw(storeName: StoreName, key: string): Promise<EncryptedRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as EncryptedRecord) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async setRaw(storeName: StoreName, record: EncryptedRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllRaw(storeName: StoreName): Promise<EncryptedRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as EncryptedRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteRaw(storeName: StoreName, key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearRaw(storeName: StoreName): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

// Determine backend
const hasNativeIndexedDB =
  typeof globalThis !== "undefined" &&
  "indexedDB" in globalThis &&
  typeof (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB?.open === "function";

let rawBackend: RawStoreBackend = hasNativeIndexedDB
  ? new IndexedDbBackend()
  : new MemoryStoreBackend();

/**
 * Allows switching backend for testing (e.g. fresh memory store for test isolation).
 */
export function setRawBackendForTesting(backend: RawStoreBackend): void {
  rawBackend = backend;
}

export function createFreshMemoryBackend(): RawStoreBackend {
  return new MemoryStoreBackend();
}

/**
 * Exposes raw backend access for inspection / audit verification (e.g., verifying ciphertext at rest).
 */
export function getRawBackend(): RawStoreBackend {
  return rawBackend;
}

// -----------------------------------------------------------------------------
// High-Level EncryptedStore Implementation
// -----------------------------------------------------------------------------

export class EncryptedIndexedDBStore implements EncryptedStore {
  private ensureKey(): CryptoKey {
    if (!activeCryptoKey) {
      throw new Error(
        "ENCRYPTION_LOCKED: In-memory encryption key not available. Re-authenticate with device PIN.",
      );
    }
    return activeCryptoKey;
  }

  async get<T>(storeName: StoreName, key: string): Promise<T | null> {
    const keyInstance = this.ensureKey();
    const record = await rawBackend.getRaw(storeName, key);
    if (!record) return null;

    try {
      return await decryptData<T>(record.iv, record.data, keyInstance);
    } catch {
      throw new Error(
        `DECRYPTION_FAILED: Unable to decrypt key "${key}" in store "${storeName}". Corrupted record or mismatched key.`,
      );
    }
  }

  async set<T>(storeName: StoreName, key: string, value: T): Promise<void> {
    const keyInstance = this.ensureKey();
    const encrypted = await encryptData(value, keyInstance);

    const record: EncryptedRecord = {
      id: key,
      iv: encrypted.iv,
      data: encrypted.data,
      updatedAt: new Date().toISOString(),
    };

    await rawBackend.setRaw(storeName, record);
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const keyInstance = this.ensureKey();
    const records = await rawBackend.getAllRaw(storeName);
    const results: T[] = [];

    for (const record of records) {
      try {
        const item = await decryptData<T>(record.iv, record.data, keyInstance);
        results.push(item);
      } catch {
        throw new Error(
          `DECRYPTION_FAILED: Unable to decrypt key "${record.id}" in store "${storeName}".`,
        );
      }
    }

    return results;
  }

  async delete(storeName: StoreName, key: string): Promise<void> {
    // Delete does not require key decryption, but requires active session
    this.ensureKey();
    await rawBackend.deleteRaw(storeName, key);
  }

  async clear(storeName: StoreName): Promise<void> {
    this.ensureKey();
    await rawBackend.clearRaw(storeName);
  }
}

export const encryptedStore: EncryptedStore = new EncryptedIndexedDBStore();
