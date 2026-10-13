import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, Plus, Users } from "lucide-react";

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
import {
  MONITORING_ENGINE_VERSION,
  analyzeMonitoring,
  buildMonitoringContext,
  monitoringStatusLabel,
  type MonitoringVisit,
} from "@/lib/engine/monitoring";
import { newVisitId, useMonitoringVisits } from "@/lib/engine/monitoring-store";
import {
  DOSE_ADJUSTMENT_ENGINE_VERSION,
  evaluateDoseAdjustment,
} from "@/lib/engine/dose-adjustment";
import { useDoseEvents } from "@/lib/engine/dose-adjustment-store";
import {
  SIMULATED_DATA_LABEL,
  SIMULATED_DATA_NOTICE,
  simulatedHyperResponseVisits,
  simulatedPoorResponderVisits,
} from "@/lib/engine/monitoring-simulation";
import {
  DoseAdjustmentCard,
  DoseAuditCard,
  DoseDecisionCard,
  DoseTimelineCard,
} from "@/components/engine/dose-adjustment-panel";
import {
  CycleComparisonCard,
  ExpectedVsObservedCard,
  FollicleTrajectoryCard,
  MonitoringValidationCard,
  ResponseDescriptorsCard,
  VisitCompletenessCard,
} from "@/components/engine/monitoring-extras";
import {
  MonitoringActions,
  MonitoringAlertsCard,
  MonitoringCharts,
  MonitoringContextCard,
  MonitoringEvidenceCard,
  MonitoringIntegrationCard,
  MonitoringStatusCard,
  MonitoringSummaryCard,
  MonitoringTrendsCard,
  StimulationTimeline,
  VisitCards,
  VisitForm,
} from "@/components/engine/monitoring-panel";
import {
  ClinicalSafetyBanner,
  EvidencePendingGate,
} from "@/components/engine/clinical-safety-banner";

const title = "Dynamic Monitoring & Dose Adjustment — IVF Ai Calc";
const description =
  "Track ovarian stimulation from day 1 to trigger: follow-up visits, follicle and hormone trends, dose timeline, informational alerts and a physician summary. Dose adjustment activates only after the published guideline tables are imported.";

export const Route = createFileRoute("/_shell/monitoring")({
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
  component: MonitoringPage,
});

function MonitoringPage() {
  const { draft } = useAssessment();
  const { records } = usePatients();
  const [selected, setSelected] = useState<string>("draft");
  const [editing, setEditing] = useState<{ day: number; id?: string } | null>(null);

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

  const { visits: storedVisits, save, remove } = useMonitoringVisits(source.id);
  const [simulation, setSimulation] = useState<"off" | "poor" | "hyper">("off");
  const visits =
    simulation === "poor"
      ? simulatedPoorResponderVisits
      : simulation === "hyper"
        ? simulatedHyperResponseVisits
        : storedVisits;
  const { events: doseEvents, record: recordDoseEvent, remove: removeDoseEvent } = useDoseEvents(
    source.id,
  );

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
    const context = buildMonitoringContext(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      protocol,
      gonadotropin,
      getConsortDose(source.id),
    );
    return analyzeMonitoring(context, visits);
  }, [source, visits]);

  const doseEvaluation = useMemo(
    () => evaluateDoseAdjustment(result.visits[result.visits.length - 1] ?? null),
    [result.visits],
  );

  useEffect(() => {
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "dose-adjustment",
      moduleName: "Dynamic Monitoring & Dose Adjustment",
      action: "assessment-completed",
      version: MONITORING_ENGINE_VERSION,
      detail: `${monitoringStatusLabel[result.status]} · ${result.visits.length} visit(s)`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, result.status, result.visits.length]);

  const maxRecordedDay = visits.reduce((m, v) => Math.max(m, v.day), 0);
  const maxDay = Math.max(14, maxRecordedDay + 1);
  const nextDay = maxRecordedDay + 1;

  const startEdit = (visit: MonitoringVisit) => setEditing({ day: visit.day, id: visit.id });
  const existing = editing
    ? (visits.find((v) => (editing.id ? v.id === editing.id : v.day === editing.day)) ?? undefined)
    : undefined;


  const guidelinePopulations = useMemo(() => {
    const ph = buildPhenotype(source.values, source.cycles);
    const resp = predictOvarianResponse(source.values, source.cycles, ph.poseidon, ph.bologna);
    return derivePopulationTags(ph, resp, source.values);
  }, [source]);

  return (
    <>
      <PageHeader
        eyebrow="Monitoring Engine"
        title="Dynamic Monitoring & Dose Adjustment"
        description="Organises the stimulation cycle from day 1 until trigger: follow-up entry, follicle and hormone trends, dose history and a physician summary after every visit. No dose change, cancellation, trigger timing or freeze-all decision is produced — those activate only once the published ESHRE and ASRM tables are imported into the Evidence Library."
        actions={<MonitoringActions result={result} />}
      />

      <ClinicalSafetyBanner />
      <EvidencePendingGate id="dose-adjustment" />



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
          Monitoring Engine v{MONITORING_ENGINE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Adjustment Engine v{DOSE_ADJUSTMENT_ENGINE_VERSION} — locked
        </Badge>
        <Button size="sm" className="rounded-xl" onClick={() => setEditing({ day: nextDay })}>
          <Plus className="size-4" /> Add visit (day {nextDay})
        </Button>
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <FlaskConical className="size-3.5" /> Regression dataset
        </span>
        {(
          [
            ["off", "Off"],
            ["poor", "Poor responder"],
            ["hyper", "Hyper-response"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={simulation === id ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => {
              setSimulation(id);
              setEditing(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {simulation !== "off" && (
        <div className="animate-rise rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {SIMULATED_DATA_LABEL}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{SIMULATED_DATA_NOTICE}</p>
        </div>
      )}

      <div className="grid gap-5">
        <MonitoringContextCard result={result} />

        <StimulationTimeline
          result={result}
          maxDay={maxDay}
          activeDay={editing?.day ?? null}
          onSelectDay={(day) => {
            const visit = visits.find((v) => v.day === day);
            setEditing(visit ? { day, id: visit.id } : { day });
          }}
        />

        {editing && (
          <VisitForm
            key={`${editing.day}-${editing.id ?? "new"}`}
            day={editing.day}
            existing={existing}
            onCancel={() => setEditing(null)}
            onSave={(visit) => {
              save({
                ...visit,
                id: existing?.id ?? newVisitId(),
                recordedAt: new Date().toISOString(),
              });
              setEditing(null);
            }}
          />
        )}

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <MonitoringStatusCard result={result} />
          <MonitoringAlertsCard result={result} />
        </div>

        <MonitoringCharts result={result} />

        <VisitCards
          result={result}
          onEdit={startEdit}
          onDelete={(id) => {
            remove(id);
            setEditing(null);
          }}
        />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <VisitCompletenessCard result={result} />
          <MonitoringValidationCard result={result} />
        </div>

        <FollicleTrajectoryCard result={result} />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <ResponseDescriptorsCard result={result} />
          <ExpectedVsObservedCard result={result} />
        </div>

        <DoseTimelineCard result={result} />
        <DoseAdjustmentCard evaluation={doseEvaluation} />

      <GuidelineRecommendationsPanel module="dose-adjustment" populations={guidelinePopulations} />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <DoseDecisionCard
            evaluation={doseEvaluation}
            onRecord={({ newDose, reason, decision, note }) => {
              recordDoseEvent({
                stimulationDay: doseEvaluation.stimulationDay,
                previousDose: doseEvaluation.currentDose,
                newDose,
                medication: doseEvaluation.currentMedication,
                reason,
                origin: "PHYSICIAN-ENTERED",
                evidenceRuleId: doseEvaluation.firedRule?.ruleId ?? null,
                evidenceDerivedDose: doseEvaluation.proposedDose,
                evidenceVersion: doseEvaluation.firedRule?.version ?? "Not loaded",
                physicianDecision: decision,
                physicianNote: note,
                engineVersion: DOSE_ADJUSTMENT_ENGINE_VERSION,
              });
              logAudit({
                user: "Clinician (local session)",
                patient: source.name,
                moduleId: "dose-adjustment",
                moduleName: "Dynamic Monitoring & Dose Adjustment",
                action: "physician-decision",
                version: DOSE_ADJUSTMENT_ENGINE_VERSION,
                detail: `Physician dose decision (${decision}) recorded — PHYSICIAN-ENTERED`,
              });
            }}
          />
          <DoseAuditCard events={doseEvents} onDelete={removeDoseEvent} />
        </div>

        <CycleComparisonCard result={result} />

        <MonitoringTrendsCard result={result} />
        <MonitoringSummaryCard result={result} />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <MonitoringEvidenceCard ids={result.evidenceSource} />
          <MonitoringIntegrationCard />
        </div>
      </div>
    </>
  );
}
