/**
 * Case-Centric Hospital Domain Types
 *
 * Models an IVF stimulation cycle as a longitudinal clinical case
 * with encounters, plans, reports, and auto-derived engine outputs.
 */

import type { PatientRecord } from "@/lib/assessment/patients";
import type { MonitoringVisit } from "@/lib/engine/monitoring";
import type { PoseidonResult } from "@/lib/engine/poseidon";
import type { BolognaResult } from "@/lib/engine/bologna";
import type { PhenotypeResult } from "@/lib/engine/phenotype";
import type { OvarianResponseResult } from "@/lib/engine/ovarian-response";
import type { ProtocolRecommendationResult } from "@/lib/engine/protocol-recommendation";
import type { StartingDoseResult } from "@/lib/engine/starting-dose";
import type { MonitoringResult } from "@/lib/engine/monitoring";
import type { CycleCompletionResult } from "@/lib/engine/cycle-completion";
import type { TriggerResult } from "@/lib/engine/trigger";

export type CaseLifecycleStatus =
  "Intake" | "Planning" | "Monitoring" | "Trigger" | "Pickup" | "Closure" | "Signed";

export type OHSSRiskCategory = "low" | "moderate" | "high" | "critical";

export interface CaseDerivedOutputs {
  poseidon: PoseidonResult;
  bologna: BolognaResult;
  phenotype: PhenotypeResult;
  response: OvarianResponseResult;
  protocol: ProtocolRecommendationResult;
  startingDose: StartingDoseResult;
  monitoring: MonitoringResult;
  cycleCompletion: CycleCompletionResult;
  trigger: TriggerResult;
  firewallAlerts: string[];
}

export interface CaseSummary {
  id: string;
  patient: PatientRecord;
  visits: MonitoringVisit[];
  derived: CaseDerivedOutputs;
  currentStimDay: number;
  leadFollicleSize: number | null;
  folliclesGte14: number;
  folliclesGte17: number;
  estradiol: number | null;
  estradiolTrend: "up" | "down" | "flat" | "none";
  ohssRisk: OHSSRiskCategory;
  state: CaseLifecycleStatus;
  firewallBreached: boolean;
  firewallMessage: string | null;
}
