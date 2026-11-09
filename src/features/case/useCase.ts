import { useMemo } from "react";
import { usePatients, type PatientRecord } from "@/lib/assessment/patients";
import { DEFAULT_VIRTUAL_PATIENTS } from "@/lib/assessment/virtual-patients-data";
import { useMonitoringVisits } from "@/lib/engine/monitoring-store";
import { classifyPoseidon } from "@/lib/engine/poseidon";
import { assessBologna } from "@/lib/engine/bologna";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { buildGonadotropinSelection } from "@/lib/engine/gonadotropin-selection";
import { buildStartingDoseAssessment } from "@/lib/engine/starting-dose";
import { buildMonitoringContext, analyzeMonitoring } from "@/lib/engine/monitoring";
import { buildCycleCompletion } from "@/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "@/lib/engine/trigger";
import type { CaseSummary, CaseLifecycleStatus, OHSSRiskCategory } from "./types";

export function useCase(caseId: string | undefined): {
  caseSummary: CaseSummary | null;
  patient: PatientRecord | null;
  allPatients: PatientRecord[];
  isLoading: boolean;
} {
  const { records, hydrated } = usePatients();

  // If caseId is provided, find that patient; otherwise fall back to first patient
  const targetPatient = useMemo(() => {
    if (!hydrated && records.length === 0) {
      return DEFAULT_VIRTUAL_PATIENTS[0] ?? null;
    }
    if (!caseId) {
      return records[0] ?? DEFAULT_VIRTUAL_PATIENTS[0] ?? null;
    }
    const found = records.find(
      (p) =>
        p.id === caseId ||
        p.fileNumber === caseId ||
        p.fileNumber?.toLowerCase() === caseId.toLowerCase(),
    );
    return found ?? records[0] ?? DEFAULT_VIRTUAL_PATIENTS[0] ?? null;
  }, [caseId, records, hydrated]);

  const { visits } = useMonitoringVisits(targetPatient?.id ?? "");

  const caseSummary = useMemo<CaseSummary | null>(() => {
    if (!targetPatient) return null;

    const values = targetPatient.values ?? {};
    const cycles = targetPatient.cycleRecords ?? [];
    const patientId = targetPatient.id;
    const patientName = targetPatient.name || "Patient";

    // Pure Clinical Engines invocation (headless)
    const poseidon = classifyPoseidon(values, cycles);
    const bologna = assessBologna(values, cycles);
    const phenotype = buildPhenotype(values, cycles);
    const response = predictOvarianResponse(values, cycles, poseidon, bologna);
    const protocol = buildProtocolRecommendation(
      patientId,
      patientName,
      values,
      cycles,
      phenotype,
      response,
    );
    const gonado = buildGonadotropinSelection(
      patientId,
      patientName,
      values,
      cycles,
      phenotype,
      response,
      protocol,
    );
    const startingDose = buildStartingDoseAssessment(
      patientId,
      patientName,
      values,
      cycles,
      phenotype,
      response,
    );

    const mctx = buildMonitoringContext(
      patientId,
      patientName,
      values,
      cycles,
      phenotype,
      response,
      protocol,
      gonado,
      null,
    );
    const monitoring = analyzeMonitoring(mctx, visits);

    const cycleCompletion = buildCycleCompletion(
      patientId,
      patientName,
      phenotype,
      response,
      protocol,
      gonado,
      null,
      monitoring,
    );

    const trigger = buildTriggerAssessment(
      patientId,
      patientName,
      phenotype,
      response,
      monitoring,
      cycleCompletion,
      null,
    );

    // Derived monitoring kinematics
    const latestVisit = visits.length > 0 ? visits[visits.length - 1] : null;
    const priorVisit = visits.length > 1 ? visits[visits.length - 2] : null;

    const currentStimDay = latestVisit?.day ?? 0;
    const leadFollicleSize = latestVisit?.largestFollicle ?? null;
    const folliclesGte14 = latestVisit?.follicles14 ?? 0;
    const folliclesGte17 = latestVisit?.follicles17 ?? 0;
    const estradiol = latestVisit?.estradiol ?? null;

    let estradiolTrend: "up" | "down" | "flat" | "none" = "none";
    if (latestVisit && priorVisit && latestVisit.estradiol && priorVisit.estradiol) {
      if (latestVisit.estradiol > priorVisit.estradiol * 1.05) estradiolTrend = "up";
      else if (latestVisit.estradiol < priorVisit.estradiol * 0.95) estradiolTrend = "down";
      else estradiolTrend = "flat";
    }

    // Auto-derived OHSS risk category
    let ohssRisk: OHSSRiskCategory = "low";
    const ohssRaw = cycleCompletion.ohss.level?.toLowerCase() ?? "low";
    if (ohssRaw.includes("critical")) ohssRisk = "critical";
    else if (ohssRaw.includes("high") || ohssRaw.includes("severe")) ohssRisk = "high";
    else if (ohssRaw.includes("mod")) ohssRisk = "moderate";
    else ohssRisk = "low";

    // Auto-derived case lifecycle status
    let state: CaseLifecycleStatus = "Intake";
    if (visits.length > 0) {
      if (trigger.readiness?.statusLabel?.includes("READY")) {
        state = "Trigger";
      } else {
        state = "Monitoring";
      }
    } else if (protocol.recommendation?.primary) {
      state = "Planning";
    } else {
      state = "Intake";
    }

    // Safety firewalls check
    const firewallAlerts: string[] = [];
    let firewallBreached = false;
    let firewallMessage: string | null = null;

    // Check ESHRE starting dose ceiling
    if (startingDose.dose && startingDose.dose > 300) {
      firewallBreached = true;
      firewallMessage =
        "ESHRE 2025 Rec 20 Ceiling Breached: Starting dose cannot exceed 300 IU/day.";
      firewallAlerts.push(firewallMessage);
    }

    // Check E2 hyper-response threshold
    if (estradiol && estradiol >= 4500) {
      firewallBreached = true;
      firewallMessage =
        "Critical OHSS Risk Threshold: E2 >= 4500 pg/mL requires coasting / GnRH agonist trigger.";
      firewallAlerts.push(firewallMessage);
    }

    return {
      id: patientId,
      patient: targetPatient,
      visits,
      derived: {
        poseidon,
        bologna,
        phenotype,
        response,
        protocol,
        startingDose,
        monitoring,
        cycleCompletion,
        trigger,
        firewallAlerts,
      },
      currentStimDay,
      leadFollicleSize,
      folliclesGte14,
      folliclesGte17,
      estradiol,
      estradiolTrend,
      ohssRisk,
      state,
      firewallBreached,
      firewallMessage,
    };
  }, [targetPatient, visits]);

  return {
    caseSummary,
    patient: targetPatient,
    allPatients: records.length > 0 ? records : DEFAULT_VIRTUAL_PATIENTS,
    isLoading: !hydrated,
  };
}
