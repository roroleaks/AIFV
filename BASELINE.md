# AIVF Precision v3.1 — Stage 0 Baseline Record

**Date:** 2026-11-09  
**Branch:** `staged-visual-redesign-rc2`  
**Base Commit (HEAD):** `c24c332d9ff7606373299ec09ebb4c03c2aa1a9d` (`v2.0.0-rc2`)  
**Working Tree:** Clean (excluding tooling `scripts/run-all-19-checks.cjs` and `BASELINE.md`)

---

## 1. 19-Check Regression Baseline Results

All 19 checks confirmed passing at baseline prior to any visual redesign modifications:

| Check #      | Regression Gate Test                   |  Result  | Duration | Detail                                               |
| ------------ | -------------------------------------- | :------: | :------: | ---------------------------------------------------- |
| **Check 01** | Engine Snapshot Test                   | **PASS** |   4.4s   | Byte-identical outputs across 10 golden fixtures     |
| **Check 02** | E2E Negative Boundary & Firewall Audit | **PASS** |   4.2s   | 37/37 negative boundary tests passed                 |
| **Check 03** | TypeScript Typecheck                   | **PASS** |  28.2s   | `npx tsc --noEmit` clean (0 errors)                  |
| **Check 04** | ESLint                                 | **PASS** |  21.9s   | 0 errors across entire codebase                      |
| **Check 05** | Production Build                       | **PASS** |  22.3s   | Clean build                                          |
| **Check 06** | Engine Zero-Drift Check                | **PASS** |   0.3s   | Empty diff (0 bytes)                                 |
| **Check 07** | Scoped Diff Check                      | **PASS** |   0.1s   | Clean                                                |
| **Check 08** | Report Immutability Test               | **PASS** |   3.9s   | Cryptographically verified                           |
| **Check 09** | PDF Export Test                        | **PASS** |   4.1s   | Publication-grade A4 export verified                 |
| **Check 10** | Intake Auto-Stratification Test        | **PASS** |   4.2s   | Deterministic reserve stratification verified        |
| **Check 11** | Encryption Round-Trip Test             | **PASS** |   4.6s   | AES-GCM-256 + PBKDF2 round-trip clean                |
| **Check 12** | Sync Drain Test                        | **PASS** |   3.8s   | Offline sync queue FIFO drain clean                  |
| **Check 13** | Audit Chain Test                       | **PASS** |   3.6s   | SHA-256 tamper-evident hash chain verified           |
| **Check 14** | Offline Cycle Test                     | **PASS** |   4.3s   | Full offline encounter & report cycle verified       |
| **Check 15** | i18n Completeness Test                 | **PASS** |   3.5s   | 100% 1:1 key parity between en.json and ar.json      |
| **Check 16** | RTL Layout & Logical Properties Test   | **PASS** |   3.7s   | 100% logical properties maintained                   |
| **Check 17** | axe-core Accessibility Audit           | **PASS** |   7.6s   | 0 critical / 0 serious violations across 6 scenarios |
| **Check 18** | Bundle Size & Code Splitting Test      | **PASS** |   3.8s   | Initial chunk < 350 KB gz                            |
| **Check 19** | Dead Code & Cleanliness Scan           | **PASS** |  32.2s   | 0 `localStorage`, 0 raw PINs, 0 legacy routes        |

---

## 2. Route & Component Dependency Map

### Route Hierarchy

- `/` (`src/routes/index.tsx`) → Landing / redirect to `/worklist`
- `/worklist` (`src/routes/worklist.tsx`) → Renders `AppShellCase`
- `/case/$caseId` (`src/routes/case.$caseId.tsx`) → Renders `AppShellCase` with `caseId` parameter

### Core Shell Dependency Graph

- `AppShellCase` (`src/components/case-shell/AppShellCase.tsx`)
  - **Zone 1:** `TopBar` (`src/components/case-shell/TopBar.tsx`)
    - Shared BrandMark, Global Search (`Ctrl+K`), Role Selector, Session Lock, Decision Toggle
  - **Zone 2:** `LeftRail` (`src/components/case-shell/LeftRail.tsx`)
    - Worklist search, 5 filters (`Today`, `Active`, `Flagged`, `Signed`, `All`), row context menu (`Print`, `Flag`), `+ New Case` trigger
  - **Zone 3 (Main Content):**
    - `CaseHeader` (`src/components/case-shell/CaseHeader.tsx`)
      - Tier 1: Patient identity + MRN + age + parity + BMI
      - Tier 2: Stimulation Day + leading follicle size
      - Tier 3: Collapsible stratification summary (POSEIDON, Bologna, Protocol) + OHSS Risk Badge (Shape + Color + Text) + Action Toolbar (`+ New Visit`, `Sign Report`, `•••` overflow)
    - `CaseTabs` (`src/components/case-shell/CaseTabs.tsx`)
      - Tab 1: `EncountersTimeline`, `EncounterCard`, `EncounterForm` (`src/features/encounter/`)
      - Tab 2: `StratificationCard`, `ProtocolCard`, `DoseCard`, `TriggerSafetyCard`, `OverrideDialog` (`src/features/plan/`)
      - Tab 3: `ReportPreview` (`src/features/report/`)
  - **Zone 4 (On-Demand Overlay):**
    - `DecisionSidebar` (`src/components/case-shell/DecisionSidebar.tsx`)
      - Slide-in overlay on inline-end (never in main layout flow); auto-opens on active firewalls or critical OHSS
  - **Overlays:**
    - `IntakeDrawer` (`src/features/intake/IntakeDrawer.tsx`)
    - `LockOverlay` (`src/components/case-shell/LockOverlay.tsx`)

---

## 3. Baseline Screenshots Captured

Stored in `screenshots/baseline/`:

- `encounters-light.png`
- `encounters-dark.png`
- `plan-dark.png`
- `plan-light.png`
- `report-light.png`
- `report-dark.png`
