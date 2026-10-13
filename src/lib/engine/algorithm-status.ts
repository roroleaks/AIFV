/**
 * Standardised algorithm status model + strict treatment-output safety gate.
 *
 * Every treatment-related engine (protocol, gonadotropin, dose, trigger,
 * freeze-all) must pass through this module before ANY value that could be
 * read as a current treatment instruction is rendered.
 *
 * A UI component existing is never sufficient for ACTIVE. An algorithm is
 * ACTIVE only when its validated published tables/rules are explicitly
 * transcribed and activated in code.
 */

import { isConsortModelLoaded } from "./consort-model";
import { guidelineRulesLoaded, type GuidelineModuleId } from "../evidence/eshre-os-2025";
import {
  TEST_OUTPUT_BADGE,
  engineActivationByGate,
  isEngineEnabled,
  isFullTestMode,
} from "./activation-registry";

export type AlgorithmStatus =
  | "ACTIVE"
  | "TEST_IMPLEMENTATION"
  | "EVIDENCE_PENDING"
  | "DATA_INCOMPLETE"
  | "VALIDATION_REQUIRED"
  | "ERROR";

export const algorithmStatusLabel: Record<AlgorithmStatus, string> = {
  ACTIVE: "Active",
  TEST_IMPLEMENTATION: "Test Implementation (Not Validated)",
  EVIDENCE_PENDING: "Evidence Pending",
  DATA_INCOMPLETE: "Data Incomplete",
  VALIDATION_REQUIRED: "Validation Required",
  ERROR: "Error",
};

export const algorithmStatusTone: Record<AlgorithmStatus, string> = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  TEST_IMPLEMENTATION:
    "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  EVIDENCE_PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DATA_INCOMPLETE: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  VALIDATION_REQUIRED: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  ERROR: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

/** Label that must accompany every patient-entered previous-cycle treatment value. */
export const HISTORICAL_VALUE_NOTICE =
  "Historical patient-entered value — NOT a current recommendation.";

export const HISTORICAL_BADGE = "Historical";

export type TreatmentAlgorithmId =
  | "protocol-recommendation"
  | "gonadotropin-selection"
  | "consort-dose"
  | "starting-dose"
  | "dose-adjustment"
  | "trigger-strategy"
  | "freeze-all";

export interface RequiredEvidenceItem {
  /** Evidence Library entry id, when one exists. */
  evidenceId?: string;
  label: string;
  /** True only when the published table/rule set is transcribed into the app. */
  loaded: boolean;
}

export interface TreatmentAlgorithmDefinition {
  id: TreatmentAlgorithmId;
  name: string;
  /** Outputs that must never appear while the algorithm is not ACTIVE. */
  suppressedOutputs: string[];
  requiredEvidence: RequiredEvidenceItem[];
  /**
   * Explicit activation switch. Flipping this to true is only permitted once
   * the validated rules for the algorithm are transcribed in code.
   */
  activated: () => boolean;
}

const pendingEvidence = (label: string, evidenceId?: string): RequiredEvidenceItem =>
  evidenceId ? { label, evidenceId, loaded: false } : { label, loaded: false };

/**
 * Evidence item satisfied by the verbatim ESHRE 2025 transcription. `loaded`
 * is true only while at least one transcribed statement is routed to the
 * module, so deleting the transcription re-closes the gate automatically.
 */
const eshre2025Evidence = (label: string, module: GuidelineModuleId): RequiredEvidenceItem => ({
  label,
  evidenceId: "eshre-2025-ovarian-stimulation-update",
  loaded: guidelineRulesLoaded(module),
});

export const treatmentAlgorithmDefinitions: Record<
  TreatmentAlgorithmId,
  TreatmentAlgorithmDefinition
> = {
  "protocol-recommendation": {
    id: "protocol-recommendation",
    name: "Protocol Recommendation Engine",
    suppressedOutputs: [],
    requiredEvidence: [
      eshre2025Evidence(
        "ESHRE 2025 ovarian stimulation guideline — protocol and pituitary-suppression recommendation statements",
        "protocol-recommendation",
      ),
    ],
    activated: () => guidelineRulesLoaded("protocol-recommendation"),
  },
  "gonadotropin-selection": {
    id: "gonadotropin-selection",
    name: "Gonadotropin Selection Engine",
    suppressedOutputs: [
      "Recommended gonadotropin (FSH, hMG, FSH + hMG or any product)",
      "Preferred product",
      "LH supplementation instruction",
      "Any dose or dose range",
    ],
    requiredEvidence: [
      eshre2025Evidence(
        "ESHRE 2025 ovarian stimulation guideline — gonadotropin preparation recommendation statements",
        "gonadotropin-selection",
      ),
    ],
    activated: () => guidelineRulesLoaded("gonadotropin-selection"),
  },
  "consort-dose": {
    id: "consort-dose",
    name: "CONSORT Individualized Starting Dose Calculator",
    suppressedOutputs: [
      "Calculated starting dose",
      "Estimated or fallback dose",
      "Dose inferred from another algorithm",
    ],
    requiredEvidence: [
      {
        label: "CONSORT published band/points tables and score-to-dose crosswalk",
        evidenceId: "rbmo-2015-consort-fsh-dose",
        loaded: isConsortModelLoaded(),
      },
    ],
    activated: () => isConsortModelLoaded(),
  },
  "starting-dose": {
    id: "starting-dose",
    name: "Starting Gonadotropin Dose Engine",
    suppressedOutputs: [],
    requiredEvidence: [
      eshre2025Evidence(
        "ESHRE 2025 ovarian stimulation guideline — starting dose recommendation statements (Rec 13, 16, 20, 121)",
        "starting-dose",
      ),
    ],
    activated: () => guidelineRulesLoaded("starting-dose"),
  },

  "dose-adjustment": {
    id: "dose-adjustment",
    name: "Dose Adjustment Engine",
    suppressedOutputs: [
      "Dose increase or decrease",
      "Cancellation instruction",
      "Coasting instruction",
    ],
    requiredEvidence: [
      eshre2025Evidence(
        "ESHRE 2025 ovarian stimulation guideline — monitoring and dose-adjustment recommendation statements",
        "dose-adjustment",
      ),
    ],
    activated: () => guidelineRulesLoaded("dose-adjustment"),
  },
  "trigger-strategy": {
    id: "trigger-strategy",
    name: "Trigger Strategy Engine",
    suppressedOutputs: [],
    requiredEvidence: [
      eshre2025Evidence(
        "ESHRE 2025 ovarian stimulation guideline — triggering and OHSS-prevention recommendation statements",
        "trigger-recommendation",
      ),
    ],
    activated: () => guidelineRulesLoaded("trigger-recommendation"),
  },
  "freeze-all": {
    id: "freeze-all",
    name: "Freeze-All Decision Engine",
    suppressedOutputs: [],
    requiredEvidence: [
      eshre2025Evidence(
        "ESHRE 2025 ovarian stimulation guideline — freeze-all and OHSS-prevention recommendation statements",
        "freeze-all",
      ),
    ],
    activated: () => guidelineRulesLoaded("freeze-all"),
  },
};

export interface TreatmentGate {
  id: TreatmentAlgorithmId;
  name: string;
  status: AlgorithmStatus;
  statusLabel: string;
  /** STATE A when true, STATE B otherwise. Never true unless explicitly activated. */
  active: boolean;
  message: string;
  suppressedOutputs: string[];
  requiredEvidence: RequiredEvidenceItem[];
  missingEvidence: string[];
  /** Descriptive list of the data the engine currently has (caller supplied). */
  dataAvailable: string[];
  dataMissing: string[];
  /** True when the gate is open only because FULL ENGINE TEST MODE is active. */
  testMode: boolean;
  /** Declared origin of the executable logic, for provenance labelling. */
  logicSource: string;
}

export interface GateOptions {
  dataAvailable?: string[];
  dataMissing?: string[];
  /** Set when the engine itself failed. */
  error?: string | null;
}

export function evaluateTreatmentGate(
  id: TreatmentAlgorithmId,
  options: GateOptions = {},
): TreatmentGate {
  const def = treatmentAlgorithmDefinitions[id];
  const missingEvidence = def.requiredEvidence.filter((e) => !e.loaded).map((e) => e.label);
  const activated = def.activated() && missingEvidence.length === 0;

  // FULL ENGINE TEST MODE never invents an algorithm. It can only unlock an
  // engine that already carries internal, non-validated executable logic.
  const record = engineActivationByGate(id);
  const testUnlocked =
    !activated && isFullTestMode() && Boolean(record?.testImplementation) && isEngineEnabled(record!.id);

  let status: AlgorithmStatus = activated
    ? "ACTIVE"
    : testUnlocked
      ? "TEST_IMPLEMENTATION"
      : "EVIDENCE_PENDING";
  if (options.error) status = "ERROR";
  else if ((activated || testUnlocked) && (options.dataMissing?.length ?? 0) > 0)
    status = "DATA_INCOMPLETE";

  const active = status === "ACTIVE" || status === "TEST_IMPLEMENTATION";

  const message = options.error
    ? options.error
    : status === "ACTIVE"
      ? `${def.name} is active: the validated algorithm is loaded and every required variable is valid.`
      : status === "TEST_IMPLEMENTATION"
        ? `${def.name} is running in FULL ENGINE TEST MODE using non-validated internal test logic. ${TEST_OUTPUT_BADGE}.`
        : status === "DATA_INCOMPLETE"
          ? `${def.name} cannot run: required patient variables are missing or invalid.`
          : `${def.name}: Evidence Pending. The validated algorithm is not activated, so no protocol, medication, dose, dose range, adjustment or trigger is produced — even when the patient data are complete.`;

  return {
    id,
    name: def.name,
    status,
    statusLabel: algorithmStatusLabel[status],
    active,
    testMode: status === "TEST_IMPLEMENTATION",
    logicSource:
      record?.logicSource ?? "No executable logic is registered for this algorithm in any mode.",
    message,
    suppressedOutputs: def.suppressedOutputs,
    requiredEvidence: def.requiredEvidence,
    missingEvidence,
    dataAvailable: options.dataAvailable ?? [],
    dataMissing: options.dataMissing ?? [],
  };
}

export function isTreatmentAlgorithmActive(id: TreatmentAlgorithmId): boolean {
  return evaluateTreatmentGate(id).active;
}

/**
 * Hard programmatic gate. Returns the value ONLY when the algorithm is ACTIVE;
 * otherwise returns null so no treatment output can reach the UI or report.
 */
export function gatedTreatmentValue<T>(id: TreatmentAlgorithmId, value: T): T | null {
  return isTreatmentAlgorithmActive(id) ? value : null;
}

/** Standard label for a treatment value that originates from patient history. */
export function historicalLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return `${value} — previous cycle, patient-entered historical treatment`;
}
