import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { usePatients } from "@/lib/assessment/patients";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "@/lib/engine/protocol-selection";
import {
  getProtocolDecision,
  protocolDecisionLabel,
} from "@/lib/engine/protocol-decision-store";
import { buildPatientContext } from "@/lib/clinical/data-mapping";
import { buildGonadotropinSelection } from "@/lib/engine/gonadotropin-selection";
import { buildGonadotropinEvidenceReview } from "@/lib/engine/gonadotropin-evidence";
import {
  gonadotropinDecisionLabel,
  useGonadotropinDecision,
  isSelectionKind,
} from "@/lib/engine/gonadotropin-decision-store";
import { buildStartingDoseAssessment } from "@/lib/engine/starting-dose";
import { useStartingDoseDecision } from "@/lib/engine/starting-dose-store";
import { getConsortDose } from "@/lib/engine/consort-store";
import { calculateConsortDose } from "@/lib/engine/consort-dose";
import { analyzeMonitoring, buildMonitoringContext } from "@/lib/engine/monitoring";
import { useMonitoringVisits } from "@/lib/engine/monitoring-store";
import { buildCycleCompletion } from "@/lib/engine/cycle-completion";
import { logAudit } from "@/lib/engine/audit";
import {
  INTELLIGENCE_REPORT_VERSION,
  buildIntelligenceReport,
  evidenceLibraryVersion,
} from "@/lib/report/intelligence-report";
import {
  ApplicationStatusPanel,
  AuditPanel,
  useMounted,
  DisclaimerPanel,
  EvidenceTable,
  ExplainablePanel,
  QualityControlCard,
  ReportActions,
  ReportSections,
  CycleDetailPanel,
  TableOfContents,
} from "@/components/report/intelligence-report-view";

const title = "IVF Clinical Intelligence Report — IVF Ai Calc";
const description =
  "Unified explainable physician report integrating patient assessment, phenotype, POSEIDON, Bologna, response prediction, protocol, gonadotropin, CONSORT, monitoring and cycle safety engines.";

export const Route = createFileRoute("/_shell/reports")({
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
  component: Reports,
});

function Reports() {
  const { draft, hydrated: draftHydrated } = useAssessment();
  const { records, hydrated: patientsHydrated } = usePatients();
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
  const { decision: gonadotropinDecision } = useGonadotropinDecision(source.id);
  const { decision: startingDoseDecision } = useStartingDoseDecision(source.id);
  const mounted = useMounted();

  const report = useMemo(() => {
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
    const storedConsort = getConsortDose(source.id);
    const consort = calculateConsortDose(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
    );
    const monitoringContext = buildMonitoringContext(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      protocol,
      gonadotropin,
      storedConsort,
    );
    const monitoring = analyzeMonitoring(monitoringContext, visits);
    const cycle = buildCycleCompletion(
      source.id,
      source.name,
      phenotype,
      response,
      protocol,
      gonadotropin,
      storedConsort,
      monitoring,
    );
    const ctx = buildPatientContext(source.values, source.cycles, response);
    const protocolSelection = buildProtocolSelection(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      ctx,
      storedConsort?.dose ?? null,
    );
    const storedDecision = getProtocolDecision(source.id);
    const gonadotropinEvidence = buildGonadotropinEvidenceReview(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      {
        protocolName: storedDecision?.protocol ?? null,
        protocolEvidenceStatus: "Evidence Pending — protocol selection rules not loaded",
        protocolDecisionStatus: storedDecision
          ? protocolDecisionLabel[storedDecision.kind]
          : "No physician protocol decision recorded",
        consortDoseFromStore: storedConsort?.dose ?? null,
      },
    );
    const startingDose = buildStartingDoseAssessment(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      {
        protocolName: storedDecision?.protocol ?? null,
        protocolEvidenceStatus: "Evidence Pending — protocol selection rules not loaded",
        protocolDecisionStatus: storedDecision
          ? protocolDecisionLabel[storedDecision.kind]
          : "No physician protocol decision recorded",
        gonadotropinName: gonadotropinDecision?.gonadotropin ?? null,
        gonadotropinSelected: gonadotropinDecision
          ? isSelectionKind(gonadotropinDecision.kind)
          : false,
        gonadotropinStatus: gonadotropinDecision
          ? gonadotropinDecisionLabel[gonadotropinDecision.kind]
          : "No physician gonadotropin decision recorded",
        consortDoseFromStore: storedConsort?.dose ?? null,
        physicianDose: startingDoseDecision?.dose
          ? {
              dose: startingDoseDecision.dose,
              unit: startingDoseDecision.unit,
              frequency: startingDoseDecision.frequency,
              gonadotropin: startingDoseDecision.gonadotropin,
            }
          : null,
      },
    );
    return buildIntelligenceReport({
      patientId: source.id,
      patientName: source.name,
      values: source.values,
      cycles: source.cycles,
      phenotype,
      response,
      protocol,
      protocolSelection,
      protocolDecision: storedDecision
        ? {
            label: protocolDecisionLabel[storedDecision.kind],
            protocol: storedDecision.protocol,
            note: storedDecision.note,
          }
        : null,
      gonadotropin,
      gonadotropinEvidence,
      gonadotropinDecision: gonadotropinDecision
        ? {
            label: gonadotropinDecisionLabel[gonadotropinDecision.kind],
            gonadotropin: gonadotropinDecision.gonadotropin,
            note: gonadotropinDecision.note,
            origin: gonadotropinDecision.origin,
            decidedAt: gonadotropinDecision.decidedAt,
          }
        : null,
      startingDose,
      consort,
      monitoring,
      cycle,
    });
  }, [source, visits, gonadotropinDecision, startingDoseDecision]);

  useEffect(() => {
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "report-generator",
      moduleName: "IVF Clinical Intelligence Report",
      action: "assessment-completed",
      version: INTELLIGENCE_REPORT_VERSION,
      detail: `${report.sections.length} sections · ${report.qualityIssues.length} quality issue(s) · ${report.evidence.length} evidence reference(s)`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, report.qualityIssues.length, report.evidence.length]);

  const dataState: "LOADING" | "LOADED" | "MISSING" =
    !draftHydrated || !patientsHydrated
      ? "LOADING"
      : Object.keys(source.values).length === 0 && records.length === 0
        ? "MISSING"
        : "LOADED";

  if (dataState !== "LOADED") {
    return (
      <>
        <PageHeader
          eyebrow="Clinical Intelligence"
          title="IVF Clinical Intelligence Report"
          description="The unified explainable output of every implemented engine."
        />
        <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          {dataState === "LOADING"
            ? "Loading the canonical patient dataset… no value is rendered until the stored assessment has been read."
            : "Patient data missing — no assessment has been recorded yet. Complete the assessment to generate the report."}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Clinical Intelligence"
        title="IVF Clinical Intelligence Report"
        description="The unified explainable output of every implemented engine, suitable for clinical documentation, multidisciplinary discussion, education and research. Modules whose validated guideline tables have not been imported are shown as “Evidence Algorithm Pending” — no recommendation, dose or clinical decision is generated for them."
        actions={<ReportActions report={report} />}
      />

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
          Report v{INTELLIGENCE_REPORT_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Evidence Library {evidenceLibraryVersion()}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {report.applicationStatus.active.length} active module(s)
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {report.applicationStatus.framework.length} awaiting evidence
        </Badge>
      </div>

      {!mounted ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-card" />
      ) : (
      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <header className="min-w-0 rounded-2xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-dashed border-border bg-muted/50 text-muted-foreground">
                <Building2 className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">Clinic Name</p>
                <p className="text-xs text-muted-foreground">Clinic branding placeholder</p>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Consultant</p>
              <p>{report.audit.user}</p>
              <p>
                {report.audit.date} · {report.audit.time}
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
            IVF Clinical Intelligence Report
          </p>
          <h2 className="mt-1 text-xl font-semibold">{report.patientName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Report v{report.version} · Evidence Library {report.audit.evidenceLibraryVersion} ·
            Application v{report.audit.applicationVersion}
          </p>
        </header>

        <TableOfContents report={report} />
        <QualityControlCard report={report} />
        <ReportSections report={report} />
        <CycleDetailPanel report={report} />
        <EvidenceTable report={report} />
        <ExplainablePanel report={report} />
        <ApplicationStatusPanel report={report} />
        <AuditPanel report={report} />
        <DisclaimerPanel report={report} />
      </article>
      )}
    </>
  );
}
