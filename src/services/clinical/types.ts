/**
 * Clinical Services & Orchestration Types (§2.1, §2.3)
 *
 * Types for the headless orchestrator functions and presentation-layer
 * physician overrides.
 */

import type { PatientRecord } from "@/lib/assessment/patients";
import type { MonitoringVisit } from "@/lib/engine/monitoring";
import type { PoseidonResult } from "@/lib/engine/poseidon";
import type { BolognaResult } from "@/lib/engine/bologna";
import type { PhenotypeResult } from "@/lib/engine/phenotype";
import type { OvarianResponseResult } from "@/lib/engine/ovarian-response";
import type { ProtocolRecommendationResult } from "@/lib/engine/protocol-recommendation";
import type { ProtocolSelectionResult } from "@/lib/engine/protocol-selection";
import type { GonadotropinSelectionResult } from "@/lib/engine/gonadotropin-selection";
import type { StartingDoseResult } from "@/lib/engine/starting-dose";
import type { ConsortResult } from "@/lib/engine/consort-dose";
import type { TriggerResult } from "@/lib/engine/trigger";
import type { CycleCompletionResult, OhssPanel } from "@/lib/engine/cycle-completion";

export type EngineName =
  | "protocol-recommendation"
  | "protocol-selection"
  | "starting-dose"
  | "gonadotropin-selection"
  | "trigger"
  | "cycle-completion";

export interface Override {
  id: string;
  caseId: string;
  engine: EngineName;
  field: string;
  fromValue: unknown;
  toValue: unknown;
  reason: string; // mandatory, min 10 chars
  by: string; // e.g., "Dr. Raouf Roshdy (Physician)"
  at: string; // ISO date string
}

export interface ClinicalCaseInput {
  patient: PatientRecord;
  visits?: MonitoringVisit[];
}

export interface StratificationResult {
  poseidon: PoseidonResult;
  bologna: BolognaResult;
  phenotype: PhenotypeResult;
  ovarianResponse: OvarianResponseResult;
}

export interface ProtocolPlanResult {
  protocol: ProtocolRecommendationResult;
  selection: ProtocolSelectionResult;
  gonadotropin: GonadotropinSelectionResult;
  startingDose: StartingDoseResult;
  consort: ConsortResult;
}

export interface SafetyFirewallStatus {
  eshre300CeilingActive: boolean;
  eshre300CeilingBreached: boolean;
  coastingTriggerActive: boolean;
  coastingTriggerBreached: boolean;
  freezeAllTriggerActive: boolean;
  freezeAllTriggerBreached: boolean;
  firewallAlerts: string[];
}

export interface TriggerDecisionResult {
  trigger: TriggerResult;
  ohss: OhssPanel;
  cycleCompletion: CycleCompletionResult;
  safetyFirewalls: SafetyFirewallStatus;
}
