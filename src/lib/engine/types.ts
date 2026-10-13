/**
 * Clinical Decision Support System — core engine contracts.
 *
 * This file defines the shared interfaces every calculation engine must
 * implement. It contains NO clinical logic, NO formula, NO threshold and NO
 * recommendation. Future prompts implement individual engines against these
 * contracts after scientific validation.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import type { MappedVariable } from "@/lib/clinical/data-mapping";

/** Lifecycle state surfaced in the Clinical Intelligence Engine dashboard. */
export type EngineStatus = "ready" | "waiting-data" | "running" | "completed" | "locked" | "future";

export const engineStatusLabels: Record<EngineStatus, string> = {
  ready: "Ready",
  "waiting-data": "Waiting for Data",
  running: "Running",
  completed: "Completed",
  locked: "Locked",
  future: "Future Module",
};

export const engineStatusTone: Record<EngineStatus, string> = {
  ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "waiting-data": "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  completed: "border-primary/40 bg-primary/10 text-primary",
  locked: "border-border bg-muted text-muted-foreground",
  future: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

/** Where a module sits in the execution pipeline. */
export type EngineStage = "validation" | "classification" | "risk" | "planning" | "output";

export const engineStages: { id: EngineStage; label: string; description: string }[] = [
  {
    id: "validation",
    label: "Patient Validation",
    description: "Data completeness, plausibility and conflict checks.",
  },
  {
    id: "classification",
    label: "Patient Classification",
    description: "Descriptive patient and ovarian reserve grouping.",
  },
  {
    id: "risk",
    label: "Risk Assessment",
    description: "Documented response and safety risk factors.",
  },
  {
    id: "planning",
    label: "Future Clinical Algorithms",
    description: "Protocol, medication and transfer frameworks.",
  },
  {
    id: "output",
    label: "Output & Explanation",
    description: "Report assembly and evidence explanation.",
  },
];

/** Implementation maturity of the engine itself (separate from patient data). */
export type EngineImplementation =
  "implemented" | "not-implemented" | "awaiting-evidence" | "planned";

export interface EngineModuleDefinition {
  id: string;
  /** Display index used by the dashboard and execution queue. */
  order: number;
  name: string;
  description: string;
  stage: EngineStage;
  /** Canonical clinical variable ids (see lib/clinical/data-mapping). */
  requiredInputs: string[];
  optionalInputs: string[];
  /** Module ids that must resolve before this one executes. */
  dependsOn: string[];
  /** Evidence entry ids that must back every future rule in this module. */
  evidence: string[];
  version: string;
  lastUpdated: string;
  implementation: EngineImplementation;
  futureExpansion: string;
  /** Linked declarative knowledge-model entry, when one exists. */
  knowledgeModuleId?: string;
}

/** Input every engine will receive once implemented. */
export interface EngineContext {
  patientId?: string | undefined;
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
  dataset: MappedVariable[];
}

export type EngineIssueKind = "missing" | "invalid" | "conflict" | "incomplete-history";

export interface EngineIssue {
  kind: EngineIssueKind;
  message: string;
  variableId?: string;
}

export const engineIssueLabels: Record<EngineIssueKind, string> = {
  missing: "Missing variable",
  invalid: "Invalid value",
  conflict: "Conflicting data",
  "incomplete-history": "Incomplete history",
};

/** Reserved explanation surface — populated only by future validated engines. */
export interface EngineExplanation {
  rationale: string | null;
  variablesUsed: string[];
  variablesMissing: string[];
  evidence: string[];
  interpretation: string | null;
}

/** Reserved result envelope. `results` stays null until an engine is validated. */
export interface EngineResult {
  moduleId: string;
  version: string;
  status: EngineStatus;
  /** Placeholder — no engine produces a score in this release. */
  confidence: number | null;
  /** Placeholder — no engine produces clinical output in this release. */
  results: null;
  explanation: EngineExplanation;
  completion: number;
  issues: EngineIssue[];
  computedAt: string | null;
}

/** Contract a future engine implementation will satisfy. */
export interface EngineImplementationContract {
  definition: EngineModuleDefinition;
  /** Reserved. Returns a result envelope with `results: null` today. */
  evaluate: (context: EngineContext) => EngineResult;
}
