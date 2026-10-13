import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { GuidelineRecommendationsPanel } from "@/components/engine/guideline-panel";
import { derivePopulationTags } from "@/lib/engine/guideline-context";
import { ClinicalSafetyBanner } from "@/components/engine/clinical-safety-banner";
import { WorkflowStepper } from "@/components/workflow-stepper";
import {
  TriggerAlertsCard,
  TriggerCompletenessCard,
  TriggerContextCard,
  TriggerCycleStatusCard,
  TriggerDecisionCard,
  TriggerEndometrialCard,
  TriggerFollicularCard,
  TriggerGapsCard,
  TriggerGuardrailCard,
  TriggerHormonalCard,
  TriggerOptionsCard,
  TriggerReadinessCard,
  TriggerSafetyCard,
} from "@/components/engine/trigger-panel";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { buildGonadotropinSelection } from "@/lib/engine/gonadotropin-selection";
import { getConsortDose } from "@/lib/engine/consort-store";
import { analyzeMonitoring, buildMonitoringContext } from "@/lib/engine/monitoring";
import { useMonitoringVisits } from "@/lib/engine/monitoring-store";
import { buildCycleCompletion } from "@/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "@/lib/engine/trigger";
import {
  triggerDecisionSummary,
  triggerDecisionLabel,
  useTriggerDecision,
} from "@/lib/engine/trigger-decision-store";
import { logAudit } from "@/lib/engine/audit";

const title = "Trigger Decision & Safety Engine — IVF Ai Calc";
const description =
  "Evidence-gated review of trigger readiness: observed follicular, hormonal, endometrial and safety data with a physician trigger decision layer. No trigger type, dose or timing is generated.";

export const Route = createFileRoute("/_shell/trigger")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TriggerPage,
});

function TriggerPage() {
  const { draft } = useAssessment();
  const patientId = "draft";
  const patientName = String(draft.values["fullName"] ?? "Current assessment draft");
  const { visits } = useMonitoringVisits(patientId);
  const { decision, audit, save, clear } = useTriggerDecision(patientId);

  const result = useMemo(() => {
    const phenotype = buildPhenotype(draft.values, draft.cycles);
    const response = predictOvarianResponse(
      draft.values,
      draft.cycles,
      phenotype.poseidon,
      phenotype.bologna,
    );
    const protocol = buildProtocolRecommendation(
      patientId,
      patientName,
      draft.values,
      draft.cycles,
      phenotype,
      response,
    );
    const gonadotropin = buildGonadotropinSelection(
      patientId,
      patientName,
      draft.values,
      draft.cycles,
      phenotype,
      response,
      protocol,
    );
    const storedConsort = getConsortDose(patientId);
    const monitoring = analyzeMonitoring(
      buildMonitoringContext(
        patientId,
        patientName,
        draft.values,
        draft.cycles,
        phenotype,
        response,
        protocol,
        gonadotropin,
        storedConsort,
      ),
      visits,
    );
    const cycle = buildCycleCompletion(
      patientId,
      patientName,
      phenotype,
      response,
      protocol,
      gonadotropin,
      storedConsort,
      monitoring,
    );
    return buildTriggerAssessment(
      patientId,
      patientName,
      phenotype,
      response,
      monitoring,
      cycle,
      decision
        ? { label: triggerDecisionLabel[decision.kind], summary: triggerDecisionSummary(decision) }
        : null,
    );
  }, [draft, visits, decision, patientName]);

  const guidelinePopulations = useMemo(() => {
    const ph = buildPhenotype(draft.values, draft.cycles);
    const resp = predictOvarianResponse(draft.values, draft.cycles, ph.poseidon, ph.bologna);
    return derivePopulationTags(ph, resp, draft.values);
  }, [draft]);

  return (
    <>
      <PageHeader
        eyebrow="Workflow Stage 6 of 8 · Trigger Strategy"
        title="6. Trigger Decision & Final Oocyte Maturation"
        description="Stage 6 of the clinical workflow: Evaluates pre-ovulatory trigger criteria (lead follicle ≥ 17–18 mm), trigger drug selection (rhCG vs GnRH agonist vs dual trigger), and 36-hour retrieval timing."
      />

      <WorkflowStepper currentStage={6} className="my-4" />

      <ClinicalSafetyBanner />

      <div className="grid gap-4">
        <TriggerReadinessCard result={result} />
        <TriggerContextCard groups={result.patientContext} />
        <TriggerCycleStatusCard result={result} />
        <TriggerFollicularCard result={result} />
        <TriggerHormonalCard result={result} />
        <TriggerEndometrialCard result={result} />
        <TriggerCompletenessCard result={result} />
        <TriggerSafetyCard result={result} />
        <TriggerOptionsCard result={result} />
        <TriggerDecisionCard
          result={result}
          decision={decision}
          audit={audit}
          onSave={(d) => {
            save(d);
            logAudit({
              user: d.decidedBy,
              patient: patientName,
              moduleId: "trigger-strategy",
              moduleName: "Trigger Decision & Safety Engine",
              action: "physician-decision",
              version: result.version,
              detail: triggerDecisionSummary(d),
            });
          }}
          onClear={clear}
        />
        <TriggerAlertsCard result={result} />
        <TriggerGapsCard result={result} />
        <TriggerGuardrailCard result={result} />
        <GuidelineRecommendationsPanel
          module="trigger-recommendation"
          populations={guidelinePopulations}
        />
      </div>
    </>
  );
}
