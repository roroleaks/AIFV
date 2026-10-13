# AIFV — Complete Clinical Engine Functional Audit, Repair & End-to-End Verification

Scope: technical execution audit of every clinical engine, data path, safety gate and
route in IVF Ai Calc. **This is a software audit, not a clinical validation.** No
formula, threshold, dose, protocol rule or trigger criterion was created, inferred or
modified during this audit.

---

## 1. System inventory

**Engine layer — `src/lib/engine/` (37 modules)**

| Domain | Modules |
| --- | --- |
| Classification | `poseidon.ts`, `bologna.ts`, `phenotype.ts`, `ovarian-response.ts` |
| Treatment framework | `protocol-recommendation.ts`, `protocol-selection.ts`, `protocol-database.ts`, `gonadotropin-selection.ts`, `gonadotropin-evidence.ts`, `gonadotropin-database.ts` |
| Dose | `consort-dose.ts`, `consort-model.ts`, `starting-dose.ts`, `dose-adjustment.ts` |
| Cycle | `monitoring.ts`, `monitoring-simulation.ts`, `cycle-completion.ts`, `cycle-intelligence.ts`, `trigger.ts` |
| Governance / infrastructure | `algorithm-status.ts`, `activation-registry.ts`, `guideline-context.ts`, `registry.ts`, `runtime.ts`, `types.ts`, `audit.ts`, `settings.ts`, `report-structure.ts`, `test-battery.ts` |
| Physician decision stores | `poseidon-store`, `phenotype-store`, `response-store`, `protocol-decision-store`, `gonadotropin-decision-store`, `starting-dose-store`, `consort-store`, `dose-adjustment-store`, `monitoring-store`, `trigger-decision-store` |

**Evidence layer — `src/lib/evidence/` (13 modules)**, including the verbatim
`eshre-os-2025.ts` transcription (recommendations 12–121, list of all recommendations, pp. 15–24).

**UI layer — 25 routes** under `src/routes/`, all rendered through `_shell`.

---

## 2. Execution test — synthetic cases A–E

Harness: `scripts/engine-audit.ts` (headless, runs every engine in dependency order).

| Case | Profile |
| --- | --- |
| A | 30 y, AMH 2.5, AFC 15, BMI 24, FSH 7, previous 10 oocytes |
| B | 42 y, AMH 0.5, AFC 3, FSH 12, previous 2 oocytes |
| C | 29 y, AMH 5.0, AFC 28, BMI 23, previous 18 oocytes |
| D | 36 y, AMH 1.5, AFC 8, BMI 27, previous 7 oocytes |
| E | Incomplete record — no DOB, no AMH, no AFC, no cycles, no visits |

**Result: 0 failures across all engines and all five cases** after the repair in §3.

Representative outputs:

- Monitoring executes for 0–3 visits (`no-data`, `assessment-pending`, `additional-monitoring-required`).
- Dose adjustment: `status=EVIDENCE_PENDING`, `proposedDose=null` in every case.
- Cycle completion: `freezeAll=pending-evidence`, `ohssLevel=null` in every case.
- Trigger: `TRIGGER ALGORITHM PENDING`, `TRIGGER DOSE = NOT CALCULATED` in every case.
- Intelligence report: 16 sections, 8 evidence records, 9 explanation blocks, quality score 39–70 depending on data completeness — including the incomplete Case E, which degrades gracefully instead of failing.

---

## 3. Defects found and repaired

**D1 — Crash in the monitoring engine (critical, fixed).**
`analyzeMonitoring` assumed every stored visit carried a `follicleSizes` array. Visits
written by an earlier build lack it, producing
`TypeError: undefined is not an object (evaluating 'v.follicleSizes.some')`, which took
down monitoring, trigger, cycle completion and the intelligence report for that patient.
Repair: `normalizeVisit()` in `src/lib/engine/monitoring.ts` restores missing fields to
their **empty** defaults (never a value), applied on every analysis pass and on every
read in `monitoring-store.ts`, so legacy records self-heal.

**D2 — Transcribed guideline evidence was gated but never displayed (fixed).**
`eshre-os-2025.ts` was consumed only by `algorithm-status.ts`, so the nine unblocked
modules opened their gates without showing the physician the statements behind them.
Repair: `src/lib/engine/guideline-context.ts` derives the guideline's own population
tags from already-computed engine outputs (predicted response, age, recorded PCOS), and
`src/components/engine/guideline-panel.tsx` renders the applicable statements verbatim
with printed strength and evidence-quality symbol. Mounted on Protocols, Gonadotropins,
Monitoring (dose adjustment), Cycle completion (OHSS) and Trigger.

**Non-defects confirmed by design:**
- POSEIDON returns no group for patients who are not low-prognosis — correct, the framework classifies low-prognosis patients only.
- `protocol-recommendation.ts` reports `not-implemented` — it is the legacy framework container; the live evidence-matched engine is `protocol-selection.ts`.

---

## 4. Firewall verification (unchanged, re-verified)

| Engine | Status | Output |
| --- | --- | --- |
| CONSORT dose calculator | METHODOLOGY NOT LOADED | no dose, no score, no crosswalk |
| Individualized starting dose | EVIDENCE PENDING | no dose, no range |
| Dose adjustment | EVIDENCE PENDING | no increment, no decrement |
| Trigger readiness | TRIGGER ALGORITHM PENDING | no type, dose or timing |
| Freeze-all / OHSS level | PENDING EVIDENCE | no threshold, no indication |

`consort-model.ts` still holds empty coefficient tables (α, β1–β6 and the score-to-dose
crosswalk are absent from every held source), and nothing in the audit populated them.
No engine reads a CONSORT value.

---

## 5. UI verification

All 25 routes were loaded in a headless browser with console and page-error capture:
**0 console errors and 0 uncaught exceptions on every route** (`/`, dashboard, patients,
assessment, engine, poseidon, decision-support, protocols, gonadotropins, starting-dose,
consort, monitoring, cycle-completion, trigger, reports, evidence, evidence-governance,
evidence-requirements, evidence-updates, evidence-master, system-test, settings, help,
calculator, favorites).

---

## 6. Technical execution vs clinical validation

| Dimension | Status |
| --- | --- |
| Technical execution | Verified — every engine runs, no crashes, no undefined output, graceful degradation on incomplete data |
| Data propagation | Verified — assessment → phenotype → response → protocol/gonadotropin → monitoring → trigger → report |
| Safety gating | Verified — no dose, protocol, medication or trigger instruction is emitted while its evidence is pending |
| Clinical validation | **Not performed and not claimed.** All output is physician decision support and is not validated for automated clinical prescription. |

---

## 7. Outstanding evidence requirements

1. CONSORT regression coefficients (α, β1–β6) and the validated score-to-dose crosswalk — Howles 2006 / Olivennes appendix.
2. Numeric in-cycle dose-adjustment rules (threshold, increment, floor, ceiling, timing).
3. Numeric OHSS and freeze-all decision thresholds.
4. Numeric trigger criteria (follicle diameter/count, E2, P4 cut-offs).

Until each is supplied verbatim, the corresponding engine stays locked by design.
