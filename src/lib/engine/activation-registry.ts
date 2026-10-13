/**
 * PROMPT 30 — Engine Activation Registry & Execution Mode control.
 *
 * This module does NOT create clinical knowledge. It only records, for every
 * engine, whether its logic is backed by transcribed published evidence
 * (PRODUCTION-safe) or by a non-validated internal test implementation that
 * may only run inside FULL ENGINE TEST MODE.
 *
 * Rules enforced here:
 *  - PRODUCTION is the default mode on every load. FULL_TEST is never sticky
 *    across a browser session restart unless the physician re-acknowledges it.
 *  - FULL_TEST never converts a missing algorithm into a real recommendation;
 *    it only unlocks internally implemented, clearly labelled test logic.
 *  - Every engine output produced in FULL_TEST must carry the TEST label and
 *    its logic-source declaration.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { TreatmentAlgorithmId } from "./algorithm-status";

export type ExecutionMode = "PRODUCTION" | "FULL_TEST";

export const executionModeLabel: Record<ExecutionMode, string> = {
  PRODUCTION: "Production (Evidence-Gated)",
  FULL_TEST: "Full Engine Test Mode",
};

export type EngineCategory = "classification" | "prediction" | "treatment" | "reporting";

export type EngineEvidenceStatus =
  | "EVIDENCE_TRANSCRIBED"
  | "EVIDENCE_PENDING"
  | "PARTIAL_EVIDENCE";

export const engineEvidenceStatusLabel: Record<EngineEvidenceStatus, string> = {
  EVIDENCE_TRANSCRIBED: "Published algorithm transcribed",
  PARTIAL_EVIDENCE: "Partially transcribed",
  EVIDENCE_PENDING: "Evidence pending",
};

export interface EngineActivationRecord {
  id: string;
  name: string;
  route: string;
  category: EngineCategory;
  /** Treatment gate this engine feeds, when it produces treatment output. */
  gateId?: TreatmentAlgorithmId;
  /** True when the engine has internal logic that can execute in TEST mode. */
  testImplementation: boolean;
  /** Plain declaration of where the executable logic comes from. */
  logicSource: string;
  evidenceStatus: EngineEvidenceStatus;
  evidenceIds: string[];
  outputs: string[];
  /** Everything that is still missing before PRODUCTION activation. */
  missingForProduction: string[];
  version: string;
}

export const engineActivationRegistry: EngineActivationRecord[] = [
  {
    id: "poseidon",
    name: "POSEIDON Classification Engine",
    route: "/poseidon",
    category: "classification",
    testImplementation: true,
    logicSource: "Published POSEIDON criteria transcribed verbatim (Alviggi 2016; Humaidan 2016).",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["poseidon-2016-alviggi", "poseidon-2016-humaidan"],
    outputs: ["POSEIDON group", "Criteria trace", "Data-quality report"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "bologna",
    name: "ESHRE Bologna Criteria Engine",
    route: "/decision-support",
    category: "classification",
    testImplementation: true,
    logicSource: "Published Bologna criteria transcribed verbatim (Ferraretti 2011).",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["eshre-2011-bologna"],
    outputs: ["Poor-responder classification", "Criteria trace"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "phenotype",
    name: "Patient Phenotype Engine",
    route: "/decision-support",
    category: "classification",
    testImplementation: true,
    logicSource: "Aggregation of POSEIDON, Bologna and recorded reserve markers. No new rule.",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["poseidon-2016-alviggi", "eshre-2011-bologna"],
    outputs: ["Phenotype snapshot", "Reserve panel", "Missing-data panel"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "ovarian-response",
    name: "Ovarian Response Prediction Engine",
    route: "/decision-support",
    category: "prediction",
    testImplementation: true,
    logicSource:
      "Internal descriptive stratification of recorded reserve markers. NOT a validated published prediction model.",
    evidenceStatus: "PARTIAL_EVIDENCE",
    evidenceIds: ["eshre-2025-ovarian-stimulation-update"],
    outputs: ["Response category", "Risk stratification", "Response spectrum"],
    missingForProduction: [
      "A validated published response-prediction model with explicit thresholds and outcome definitions",
    ],
    version: "1.0.0",
  },
  {
    id: "protocol-selection",
    name: "Protocol Selection Engine",
    route: "/protocols",
    category: "treatment",
    gateId: "protocol-recommendation",
    testImplementation: true,
    logicSource: "ESHRE 2025 (Rec 14, 18, 19, 21, 22, 23, 24) and Cochrane 2016 protocol recommendation rules.",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["eshre-2025-ovarian-stimulation-update", "asrm-2016-ohss-prevention"],
    outputs: ["Recommended protocol", "Alternative protocols", "Clinical rationale"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "gonadotropin-selection",
    name: "Gonadotropin Selection Engine",
    route: "/gonadotropins",
    category: "treatment",
    gateId: "gonadotropin-selection",
    testImplementation: false,
    logicSource: "No executable preparation-selection rule exists in the app.",
    evidenceStatus: "EVIDENCE_PENDING",
    evidenceIds: ["eshre-2025-ovarian-stimulation-update", "poseidon-2016-alviggi"],
    outputs: ["Recommended gonadotropin", "LH supplementation statement"],
    missingForProduction: [
      "Guideline gonadotropin-preparation recommendation statements with explicit patient groups",
    ],
    version: "1.0.0",
  },
  {
    id: "starting-dose",
    name: "Starting Gonadotropin Dose Engine",
    route: "/starting-dose",
    category: "treatment",
    gateId: "starting-dose",
    testImplementation: true,
    logicSource: "ESHRE 2025 (Rec 13, 16, 20, 121) stratified starting gonadotropin dose matrix.",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["eshre-2025-ovarian-stimulation-update"],
    outputs: ["Starting dose", "Dose range", "Stratification tier"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "consort-dose",
    name: "CONSORT Individualized Starting Dose Calculator",
    route: "/consort",
    category: "treatment",
    gateId: "consort-dose",
    testImplementation: false,
    logicSource:
      "Calculator scaffold only. The published CONSORT band/points tables are not transcribed, so no dose can be produced in any mode.",
    evidenceStatus: "EVIDENCE_PENDING",
    evidenceIds: ["rbmo-2015-consort-fsh-dose"],
    outputs: ["Calculated rFSH starting dose"],
    missingForProduction: ["CONSORT published band/points tables and score-to-dose crosswalk"],
    version: "1.0.0",
  },
  {
    id: "monitoring",
    name: "Dynamic Monitoring Engine",
    route: "/monitoring",
    category: "prediction",
    testImplementation: true,
    logicSource:
      "Descriptive longitudinal presentation of physician-entered monitoring visits. No adjustment rule.",
    evidenceStatus: "PARTIAL_EVIDENCE",
    evidenceIds: ["eshre-2025-ovarian-stimulation-update"],
    outputs: ["Visit timeline", "Follicle trajectory", "Hormone trends"],
    missingForProduction: ["Guideline monitoring thresholds with explicit actions"],
    version: "2.0.0",
  },
  {
    id: "dose-adjustment",
    name: "Dose Adjustment Engine",
    route: "/monitoring",
    category: "treatment",
    gateId: "dose-adjustment",
    testImplementation: false,
    logicSource: "No adjustment rule set is transcribed. Nothing executable.",
    evidenceStatus: "EVIDENCE_PENDING",
    evidenceIds: ["eshre-2025-ovarian-stimulation-update"],
    outputs: ["Dose increase / decrease", "Coasting", "Cancellation"],
    missingForProduction: ["ESHRE monitoring & dose-adjustment recommendation tables"],
    version: "1.0.0",
  },
  {
    id: "trigger",
    name: "Trigger Decision & Trigger-Safety Engine",
    route: "/trigger",
    category: "treatment",
    gateId: "trigger-strategy",
    testImplementation: true,
    logicSource: "Evidence-based trigger readiness criteria and selection matrix (ESHRE 2025 / ASRM 2016 / Cochrane 2014).",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["cochrane-2014-agonist-trigger", "asrm-2016-ohss-prevention", "eshre-2025-ovarian-stimulation-update"],
    outputs: ["Trigger agent", "Trigger timing", "Trigger dose"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "cycle-completion",
    name: "Cycle Completion & Safety Engine",
    route: "/cycle-completion",
    category: "treatment",
    gateId: "freeze-all",
    testImplementation: true,
    logicSource: "ASRM 2016 and ESHRE 2025 OHSS risk stratification cutoffs and elective freeze-all decision algorithm.",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: ["asrm-2016-ohss-prevention", "nejm-2016-freeze-all-pcos", "eshre-2025-ovarian-stimulation-update"],
    outputs: ["Freeze-all indication", "OHSS risk decision"],
    missingForProduction: [],
    version: "1.0.0",
  },
  {
    id: "intelligence-report",
    name: "Clinical Intelligence Report",
    route: "/reports",
    category: "reporting",
    testImplementation: true,
    logicSource: "Assembles the output of the engines above. Adds no clinical rule of its own.",
    evidenceStatus: "EVIDENCE_TRANSCRIBED",
    evidenceIds: [],
    outputs: ["Full explainable report"],
    missingForProduction: [],
    version: "1.0.0",
  },
];

export const engineActivationById = (id: string): EngineActivationRecord | undefined =>
  engineActivationRegistry.find((e) => e.id === id);

export const engineActivationByGate = (gate: TreatmentAlgorithmId): EngineActivationRecord | undefined =>
  engineActivationRegistry.find((e) => e.gateId === gate);

/* ------------------------------------------------------------------ store */

export interface ActivationState {
  mode: ExecutionMode;
  /** Physician acknowledgement of the test-mode disclaimer. */
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  /** Engine ids explicitly switched off for testing. */
  disabled: string[];
}

const initial: ActivationState = {
  mode: "PRODUCTION",
  acknowledgedAt: null,
  acknowledgedBy: null,
  disabled: [],
};

/** Session-scoped only: production is always restored on a new session. */
const KEY = "ivf-ai-calc.engine-activation.session";

let state: ActivationState = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(JSON.parse(raw) as Partial<ActivationState>) };
  } catch {
    state = initial;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function getActivationState(): ActivationState {
  hydrate();
  return state;
}

export function getExecutionMode(): ExecutionMode {
  return getActivationState().mode;
}

export function isFullTestMode(): boolean {
  return getExecutionMode() === "FULL_TEST";
}

export function setExecutionMode(mode: ExecutionMode, acknowledgedBy?: string) {
  hydrate();
  state =
    mode === "FULL_TEST"
      ? {
          ...state,
          mode,
          acknowledgedAt: new Date().toISOString(),
          acknowledgedBy: acknowledgedBy ?? "Physician (local session)",
        }
      : { ...state, mode, acknowledgedAt: null, acknowledgedBy: null };
  emit();
}

export function setEngineEnabled(id: string, enabled: boolean) {
  hydrate();
  const disabled = enabled
    ? state.disabled.filter((d) => d !== id)
    : Array.from(new Set([...state.disabled, id]));
  state = { ...state, disabled };
  emit();
}

export function isEngineEnabled(id: string): boolean {
  return !getActivationState().disabled.includes(id);
}

/**
 * A treatment engine may only execute in test mode when it actually has
 * internal logic. Missing algorithms stay blocked in every mode.
 */
export function canExecuteInTestMode(id: string): boolean {
  const record = engineActivationById(id);
  return Boolean(record?.testImplementation) && isEngineEnabled(id);
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEngineActivation() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getActivationState(),
    () => initial,
  );

  const setMode = useCallback(
    (mode: ExecutionMode, by?: string) => setExecutionMode(mode, by),
    [],
  );
  const toggleEngine = useCallback(
    (id: string, enabled: boolean) => setEngineEnabled(id, enabled),
    [],
  );

  return {
    state: snapshot,
    mode: snapshot.mode,
    testMode: snapshot.mode === "FULL_TEST",
    registry: engineActivationRegistry,
    setMode,
    toggleEngine,
    isEnabled: (id: string) => !snapshot.disabled.includes(id),
  };
}

export const TEST_MODE_DISCLAIMER =
  "FULL ENGINE TEST MODE — outputs are produced by non-validated internal test logic for system testing only. They are NOT clinical recommendations and must never be used for patient care.";

export const TEST_OUTPUT_BADGE = "TEST OUTPUT — NOT FOR CLINICAL USE";
