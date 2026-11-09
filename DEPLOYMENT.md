# AiFV Clinical Decision Support System (CDSS) — Deployment Guide

> **Target Release:** v1.0.0-rc  
> **Repository:** [https://github.com/roroleaks/AIFV](https://github.com/roroleaks/AIFV)  
> **Classification:** Clinician-Facing Clinical Decision Support Software (CDSS)  
> **Regulatory Notice:** Non-diagnostic clinical calculator and stimulation planner. All calculations are advisory; final medical authority remains with the treating reproductive endocrinologist.

---

## 1. Architectural Architecture & Deployment Topology

### 1.1 Single-Device Standalone Model
- **Device-Bound Key Derivation:** Patient health information (PHI) at rest is encrypted with authenticated **AES-GCM (256-bit)** using keys derived via PBKDF2 (600,000 iterations of SHA-256) from a user-supplied PIN and a device-unique cryptographic salt (16 random bytes).
- **Standalone Encryption Scope:** Encryption keys are per-device. Each clinical tablet, workstation, or consultation cart maintains its own independent cryptographic boundary.
- **Cross-Device Data Replication:** Encrypted clinical records can be exported and transferred across clinic devices via the offline sync queue (`LocalFileTarget` bundle or HTTPS sync target). However, decryption on another device requires that device's own authenticated key or a secure key export/import cycle (multi-device key escrow and synchronizer are scheduled for post-launch release v1.1).

---

## 2. First-Run Setup & Device Authentication

### 2.1 First-Run Initialization
- **Mandatory Production Setup:** In production environments (`NODE_ENV === 'production'`), the system initializes in a locked first-run state.
- **Zero Default PIN:** There is **NO default PIN** in production. The clinician or clinic administrator must set a new device PIN or passphrase before accessing patient records or entering new cases.
- **Development Fallback:** In development mode (`NODE_ENV !== 'production'`), the system permits `DEFAULT_DEV_PIN = "12345678"` as a fallback to facilitate continuous integration and automated benchmarks.

### 2.2 PIN Entropy & Passphrase Policy
- **Minimum Length:** Enforced minimum length is **8 characters** (`MIN_PIN_LENGTH = 8`). 4-digit and 6-digit PINs are rejected at input time.
- **Entropy & Strength Heuristic:** The interactive setup and lock screen evaluate live character diversity (numeric, alphabetic uppercase/lowercase, and special characters).
  - *Weak:* Under 8 characters or single character set.
  - *Fair:* Satisfies minimum 8 characters with dual diversity.
  - *Strong:* 10+ characters with multi-character diversity (recommended: clinical passphrase).
- **Post-Launch Roadmap:** Implementation of a common-PIN blocklist (e.g., rejecting repetitive or sequential patterns like "11111111" or "password123") is scheduled for the v1.0.1 maintenance release.

### 2.3 Session Lifecycle & Rate-Limiting
- **Inactivity Timeout:** Sessions automatically lock after **5 minutes** of clinician inactivity.
- **Cryptographic Memory Zeroing:** Upon session lock, the in-memory `CryptoKey` reference is immediately zeroed (`clearActiveKey()`). Plaintext reads from IndexedDB become impossible until the clinician re-authenticates.
- **Rate-Limiting Protection:** 5 consecutive failed PIN attempts trigger an enforced **60-second lockout**, backed by immutable audit trail logging (`session.pin_failed`).

---

## 3. Offline-First Operation & Synchronization

### 3.1 Air-Gapped Operation
- AiFV is fully capable of running 100% offline in air-gapped operating rooms, embryology labs, and ultrasound cart tablets.
- Application logic, rule engines, nomograms, evidence libraries, and cryptographic primitives are bundled locally in the client application. Zero external CDNs or remote APIs are called for clinical computations.

### 3.2 Sync Queue & Targets
- Changes made while offline (case updates, ultrasound monitoring encounters, overrides, signed reports) are queued in an append-only, encrypted `syncQueue` IndexedDB store.
- **LocalFileTarget (Air-Gapped Clinics):** Clinicians can export the queued operations as an encrypted JSON bundle to encrypted USB media for hospital server ingestion.
- **HttpTarget (Hospital EHR Connector):** Stub target ready for hospital REST/FHIR endpoints. Real write-back integration is clinic-specific and subject to local hospital network policies.
- **Conflict Resolution Rules:**
  - *Signed Clinical Reports:* Server-wins / Immutable. Once a physician signs a report, it cannot be overwritten by concurrent edits.
  - *Draft Encounters / Overrides:* Last-Write-Wins (LWW) with non-destructive version history and audit chain logging.

---

## 4. Tamper-Evident Audit Logging

- **SHA-256 Hash Chain:** Every auditable event (case intake, encounter entry, dose override, signature, lock/unlock, PIN failure) is chained to the previous entry via:
  $$\text{hash}_n = \text{SHA-256}(\text{hash}_{n-1} + \text{canonicalJSON}(\text{payload}_n))$$
- **Append-Only Store:** The IndexedDB `audit` store rejects updates and deletes.
- **Offline Verifiability:** Clinic compliance officers can verify the integrity of the audit chain at any time using `verifyAuditChain()`. Any tampered record invalidates all subsequent hashes in the chain.
- **Export Recommendation:** Export the audit chain weekly to an archival, write-once-read-many (WORM) storage system per HIPAA §164.312(b).

---

## 5. Backup, Disaster Recovery & PIN Escrow

- **Encrypted Store Backup:** Before decommissioning a tablet or updating browser storage, clinic staff should trigger a complete export of the encrypted IndexedDB stores.
- **PIN Escrow Requirement:** Because the AES-GCM data is derived using PBKDF2 with no backdoor or master recovery key, **loss of the device PIN results in permanent, irrecoverable loss of stored clinical records**. Clinics must establish a secure dual-custody PIN escrow policy in accordance with local healthcare compliance regulations.
- **Legacy Migration:** Clinics upgrading from pre-v1.0 localStorage versions can execute `scripts/migrate-to-encrypted.ts` once per device to migrate legacy records to encrypted IndexedDB with byte-for-byte verification.

---

## 6. Pre-Clinical Human Review Gates

Before piloting with real patient data in a clinical environment, the following three human review gates must be formally completed:

### Gate 1: Security Code Review
- [ ] Review cryptographic implementations in `src/services/persistence/encryptedIndexedDB.ts` (Web Crypto AES-GCM 256-bit, PBKDF2 600K iterations, 12-byte random IV per write).
- [ ] Review session key zeroing and memory sanitization in `src/services/auth/session.ts`.
- [ ] Verify timing attack resilience and rate-limit counters in PIN authentication.
- [ ] Review role-based authorization gates in `src/services/auth/rbac.ts`.

### Gate 2: Clinical Accessibility & Cognitive Review
- [ ] Human review of high-stress clinical workflows (e.g., rapid ultrasound folliculometry entry during busy morning monitoring rounds).
- [ ] Cognitive verification of high-contrast theme under bright OR / procedure room surgical lighting.
- [ ] Multi-lingual RTL alignment validation on iPad / tablet touch interfaces.

### Gate 3: Clinical Board Governance Review
The medical director and clinical advisory board must review and sign off on all pending clinical markers documented below.

---

## 7. Remaining `TODO(clinical-review)` Items

The following clinical decision points are tracked with `TODO(clinical-review)` markers in the codebase and require formal clinical board sign-off:

| File Location | Item Description | Clinical Decision Required | Current Placeholder Behavior |
|:---|:---|:---|:---|
| `src/features/report/exporters/exportFhir.ts:87` | SNOMED CT Infertility Condition Coding | Approve primary diagnostic SNOMED CT concept: `8619003` (*Female infertility*) vs. `89348004` (*Infertility*). | Uses `8619003` with a governance comment. |

*Note: Pure engine calculations (`src/lib/engine/**`, `src/lib/report/**`) have been verified against golden snapshot fixtures across test cases A–E and match ESHRE 2025 nomograms byte-for-byte.*

---

## 8. Browser & Hardware Platform Support

| Platform / Browser | Version Requirement | Support Status | Notes |
|:---|:---|:---|:---|
| **Google Chrome / Chromium** | ≥ 120 | Primary Target | Full Web Crypto, IndexedDB 2.0, CSS Logical Properties |
| **Microsoft Edge** | ≥ 120 | Supported | Hospital standard workstations |
| **Apple Safari (macOS)** | ≥ 17.0 | Supported | Desktop consultation workstations |
| **Mobile Safari (iPadOS / iOS)** | ≥ 17.0 | Supported | Ultrasound cart iPads (touch targets ≥ 44px verified) |
| **Firefox** | ≥ 120 | Compatible | Standard Web Crypto support |

---

## 9. Protected Health Information (PHI) Hygiene

AiFV strictly enforces zero-plaintext PHI exposure:
- **Zero PHI in URLs:** Routes use synthetic identifiers (`/case/case-m3k8...`), never patient names, dates of birth, or Medical Record Numbers (MRN).
- **Zero PHI in Browser Storage:** No PHI is ever written to `localStorage` or `sessionStorage`. All entities reside in AES-GCM-256 encrypted IndexedDB tables.
- **Zero PHI in Logs or Telemetry:** Audit trails store hashed or encrypted descriptors; `console.log` and `console.debug` are completely eliminated from production runtime code.
