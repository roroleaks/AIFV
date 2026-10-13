import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Snowflake, Timer, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { GuidelineRecommendationsPanel } from "@/components/engine/guideline-panel";
import { derivePopulationTags } from "@/lib/engine/guideline-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { usePatients } from "@/lib/assessment/patients";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { buildGonadotropinSelection } from "@/lib/engine/gonadotropin-selection";
import { getConsortDose } from "@/lib/engine/consort-store";
import { logAudit } from "@/lib/engine/audit";
import { analyzeMonitoring, buildMonitoringContext } from "@/lib/engine/monitoring";
import { useMonitoringVisits } from "@/lib/engine/monitoring-store";
import {
  CYCLE_COMPLETION_VERSION,
  buildCycleCompletion,
  safetyStatusLabel,
} from "@/lib/engine/cycle-completion";
import {
  AssessmentPanel,
  CycleAlertsCard,
  CycleCharts,
  CycleCompletionActions,
  CycleContextCard,
  CycleEvidenceCard,
  CycleIntegrationCard,
  CycleSummaryCard,
  CycleTimeline,
  OhssPanelCard,
  OutstandingCard,
  SafetyDashboard,
} from "@/components/engine/cycle-completion-panel";
import {
  ClinicalSafetyBanner,
  EvidencePendingGate,
} from "@/components/engine/clinical-safety-banner";

const title = "Cycle Completion & Safety — IVF Ai Calc";
const description =
  "End-of-stimulation data surface: safety dashboard, trigger readiness, OHSS markers, freeze-all variables, cycle completion summary and evidence status. No trigger, OHSS or freeze-all decision is produced.";

export const Route = createFileRoute("/_shell/cycle-completion")({
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
  component: CycleCompletionPage,
});

function CycleCompletionPage() {
  const { draft } = useAssessment();
  const { records } = usePatients();
  const [selected, setSelected] = useState<string>("draft");

  const source = useMemo(() => {
    const patient = records.find((r) => r.id === selected);
    if (patient)
      return {
        id: patient.id,
        name: patient.name,
        values: patient.values,
        cycles: patient.cycleRecords,
      };
    return {
      id: "draft",
      name: String(draft.values["fullName"] ?? "Current assessment draft"),
      values: draft.values,
      cycles: draft.cycles,
    };
  }, [records, selected, draft]);

  const { visits } = useMonitoringVisits(source.id);

  const result = useMemo(() => {
    const phenotype = buildPhenotype(source.values, source.cycles);
    const response = predictOvarianResponse(
      source.values,
      source.cycles,
      phenotype.poseidon,
      phenotype.bologna,
    );
    const protocol = buildProtocolRecommendation(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
    );
    const gonadotropin = buildGonadotropinSelection(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      protocol,
    );
    const consort = getConsortDose(source.id);
    const monitoringContext = buildMonitoringContext(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      protocol,
      gonadotropin,
      consort,
    );
    const monitoring = analyzeMonitoring(monitoringContext, visits);
    return buildCycleCompletion(
      source.id,
      source.name,
      phenotype,
      response,
      protocol,
      gonadotropin,
      consort,
      monitoring,
    );
  }, [source, visits]);

  useEffect(() => {
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "trigger-recommendation",
      moduleName: "Cycle Completion & Safety",
      action: "assessment-completed",
      version: CYCLE_COMPLETION_VERSION,
      detail: `${safetyStatusLabel[result.safetyStatus]} · ${result.progress.visits} monitoring visit(s)`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, result.safetyStatus, result.progress.visits]);

  const guidelinePopulations = useMemo(() => {
    const ph = buildPhenotype(source.values, source.cycles);
    const resp = predictOvarianResponse(source.values, source.cycles, ph.poseidon, ph.bologna);
    return derivePopulationTags(ph, resp, source.values);
  }, [source]);

  return (
    <>
      <PageHeader
        eyebrow="Cycle Completion Engine"
        title="Cycle Completion & Safety"
        description="Integrates monitoring, ultrasound, hormones, protocol, response prediction and OHSS markers for the final stage of ovarian stimulation. Evidence-based trigger readiness, ASRM/ESHRE OHSS risk stratification, and elective freeze-all indications are active."
        actions={<CycleCompletionActions result={result} />}
      />

      <ClinicalSafetyBanner />
      <div className="grid gap-4 xl:grid-cols-2">
        <EvidencePendingGate id="trigger-strategy" />
        <EvidencePendingGate id="freeze-all" />
      </div>

      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Users className="size-3.5" /> Data source
          </span>
          <Button
            size="sm"
            variant={selected === "draft" ? "default" : "outline"}
            onClick={() => setSelected("draft")}
          >
            Current draft
          </Button>
          {records.slice(0, 8).map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={selected === r.id ? "default" : "outline"}
              onClick={() => setSelected(r.id)}
            >
              {r.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Badge variant="outline" className="rounded-full">
          Cycle Completion Engine v{CYCLE_COMPLETION_VERSION}
        </Badge>
        <Badge
          variant="outline"
          className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          Trigger algorithm active (ESHRE 2025)
        </Badge>
        <Badge
          variant="outline"
          className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          OHSS risk stratification active (ASRM 2016)
        </Badge>
        <Badge
          variant="outline"
          className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          Freeze-all algorithm active (ESHRE 2025)
        </Badge>
      </div>

      <div className="grid gap-5">
        <SafetyDashboard result={result} />
        <CycleContextCard result={result} />
        <CycleTimeline result={result} />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <AssessmentPanel data={result.trigger} icon={Timer} />
          <AssessmentPanel data={result.freezeAll} icon={Snowflake} />
        </div>

        <OhssPanelCard result={result} />

        <GuidelineRecommendationsPanel module="ohss-risk" populations={guidelinePopulations} />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <CycleAlertsCard result={result} />
          <OutstandingCard result={result} />
        </div>

        <CycleCharts result={result} />

        <CycleSummaryCard result={result} />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <CycleEvidenceCard ids={result.evidenceSource} />
          <CycleIntegrationCard />
        </div>
      </div>
    </>
  );
}
