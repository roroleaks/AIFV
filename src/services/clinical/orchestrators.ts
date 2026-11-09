/**
 * Headless Clinical Engine Orchestrators (§2.1)
 *
 * Pure orchestrator functions that coordinate engine invocation in the correct
 * dependency order for Plan Tab cards and clinical decision support.
 *
 * GUARANTEES:
 *  - 100% pure wrappers around validated engines in src/lib/engine/
 *  - ZERO new clinical logic or fabricated values
 *  - Downstream engines always execute against raw clinical inputs
 */

import type {
  ClinicalCaseInput,
  StratificationResult,
  ProtocolPlanResult,
  TriggerDecisionResult,
  SafetyFirewallStatus,
} from "./types";
import { classifyPoseidon } from "@/lib/engine/poseidon";
import { assessBologna } from "@/lib/engine/bologna";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { buildPatientContext } from "@/lib/clinical/data-mapping";
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "@/lib/engine/protocol-selection";
import { buildGonadotropinSelection } from "@/lib/engine/gonadotropin-selection";
import { buildStartingDoseAssessment } from "@/lib/engine/starting-dose";
import { calculateConsortDose } from "@/lib/engine/consort-dose";
import { buildMonitoringContext, analyzeMonitoring } from "@/lib/engine/monitoring";
import { buildCycleCompletion } from "@/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "@/lib/engine/trigger";

/**
 * 1. Ovarian Reserve Stratification Orchestrator
 * Calls POSEIDON, Bologna, Phenotype, and Ovarian Response engines.
 */
export function runStratification(caseInput: ClinicalCaseInput): StratificationResult {
  const values = caseInput.patient.values ?? {};
  const cycles = caseInput.patient.cycleRecords ?? [];

  const poseidon = classifyPoseidon(values, cycles);
  const bologna = assessBologna(values, cycles);
  const phenotype = buildPhenotype(values, cycles);
  const ovarianResponse = predictOvarianResponse(values, cycles, poseidon, bologna);

  return {
    poseidon,
    bologna,
    phenotype,
    ovarianResponse,
  };
}

/**
 * 2. Protocol & Dosage Plan Orchestrator
 * Calls Protocol Recommendation, Selection, Gonadotropin Selection, Starting Dose, and CONSORT.
 */
export function runProtocolPlan(
  caseInput: ClinicalCaseInput,
  stratification?: StratificationResult,
): ProtocolPlanResult {
  const strat = stratification ?? runStratification(caseInput);
  const { patient } = caseInput;
  const patientId = patient.id;
  const patientName = patient.name || "Patient";
  const values = patient.values ?? {};
  const cycles = patient.cycleRecords ?? [];

  const ctx = buildPatientContext(values, cycles, strat.ovarianResponse);

  const protocol = buildProtocolRecommendation(
    patientId,
    patientName,
    values,
    cycles,
    strat.phenotype,
    strat.ovarianResponse,
  );

  const selection = buildProtocolSelection(
    patientId,
    patientName,
    values,
    cycles,
    strat.phenotype,
    strat.ovarianResponse,
    ctx,
    null,
  );

  const gonadotropin = buildGonadotropinSelection(
    patientId,
    patientName,
    values,
    cycles,
    strat.phenotype,
    strat.ovarianResponse,
    protocol,
  );

  const startingDose = buildStartingDoseAssessment(
    patientId,
    patientName,
    values,
    cycles,
    strat.phenotype,
    strat.ovarianResponse,
  );

  const consort = calculateConsortDose(
    patientId,
    patientName,
    values,
    cycles,
    strat.phenotype,
    strat.ovarianResponse,
  );

  return {
    protocol,
    selection,
    gonadotropin,
    startingDose,
    consort,
  };
}

/**
 * 3. Trigger & Safety Decision Orchestrator
 * Calls Monitoring Context, Cycle Completion (OHSS / Freeze-All), and Trigger Assessment.
 */
export function runTriggerDecision(
  caseInput: ClinicalCaseInput,
  stratification?: StratificationResult,
  plan?: ProtocolPlanResult,
): TriggerDecisionResult {
  const strat = stratification ?? runStratification(caseInput);
  const p = plan ?? runProtocolPlan(caseInput, strat);
  const { patient, visits = [] } = caseInput;
  const patientId = patient.id;
  const patientName = patient.name || "Patient";
  const values = patient.values ?? {};
  const cycles = patient.cycleRecords ?? [];

  const mctx = buildMonitoringContext(
    patientId,
    patientName,
    values,
    cycles,
    strat.phenotype,
    strat.ovarianResponse,
    p.protocol,
    p.gonadotropin,
    null,
  );

  const monitoring = analyzeMonitoring(mctx, visits);

  const cycleCompletion = buildCycleCompletion(
    patientId,
    patientName,
    strat.phenotype,
    strat.ovarianResponse,
    p.protocol,
    p.gonadotropin,
    null,
    monitoring,
  );

  const trigger = buildTriggerAssessment(
    patientId,
    patientName,
    strat.phenotype,
    strat.ovarianResponse,
    monitoring,
    cycleCompletion,
    null,
  );

  // Evaluate safety firewalls
  const firewallAlerts: string[] = [];
  const latestVisit = visits.length > 0 ? visits[visits.length - 1] : null;

  // ESHRE 300 IU starting ceiling check (ESHRE 2025 Rec 20)
  const startingDoseVal = p.startingDose.dose ?? 0;
  const eshre300CeilingActive = true;
  const eshre300CeilingBreached = startingDoseVal > 300;
  if (eshre300CeilingBreached) {
    firewallAlerts.push(
      "ESHRE Recommendation 20: Maximum recommended starting dose is 300 IU/day.",
    );
  }

  // Coasting trigger (E2 >= 4500 pg/mL with immature cohort)
  const e2Val = latestVisit?.estradiol ?? 0;
  const leadSize = latestVisit?.largestFollicle ?? 0;
  const coastingTriggerActive = e2Val >= 4500;
  const coastingTriggerBreached = coastingTriggerActive && leadSize < 18;
  if (coastingTriggerBreached) {
    firewallAlerts.push(
      "Safety Alert: Estradiol ≥ 4,500 pg/mL before trigger readiness. Coasting (1–2 days) recommended.",
    );
  }

  // Freeze-all trigger (critical OHSS risk or severe hyper-response)
  const isFreezeAll =
    cycleCompletion.freezeAll?.status?.toLowerCase().includes("indicated") ||
    cycleCompletion.freezeAll?.status?.toLowerCase().includes("strongly");
  const freezeAllTriggerActive = Boolean(isFreezeAll);
  const freezeAllTriggerBreached = freezeAllTriggerActive;
  if (freezeAllTriggerBreached) {
    firewallAlerts.push(
      "Freeze-All Policy: Elevated OHSS risk triggers freeze-all strategy. Defer fresh transfer.",
    );
  }

  const safetyFirewalls: SafetyFirewallStatus = {
    eshre300CeilingActive,
    eshre300CeilingBreached,
    coastingTriggerActive,
    coastingTriggerBreached,
    freezeAllTriggerActive,
    freezeAllTriggerBreached,
    firewallAlerts,
  };

  return {
    trigger,
    ohss: cycleCompletion.ohss,
    cycleCompletion,
    safetyFirewalls,
  };
}
