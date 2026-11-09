import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Layers, FileText } from "lucide-react";
import type { CaseSummary } from "@/features/case/types";
import type { Encounter } from "@/features/encounter/types";
import {
  monitoringVisitToEncounter,
  encounterToMonitoringVisit,
} from "@/features/encounter/adapter";
import { EncounterTimeline } from "@/features/encounter/EncounterTimeline";
import { EncounterForm } from "@/features/encounter/EncounterForm";
import { useMonitoringVisits } from "@/lib/engine/monitoring-store";
import { useOverrides } from "@/features/plan/useOverrides";
import {
  runStratification,
  runProtocolPlan,
  runTriggerDecision,
} from "@/services/clinical/orchestrators";
import { StratificationCard } from "@/features/plan/StratificationCard";
import { ProtocolCard } from "@/features/plan/ProtocolCard";
import { DoseCard } from "@/features/plan/DoseCard";
import { TriggerSafetyCard } from "@/features/plan/TriggerSafetyCard";
import { useReports } from "@/features/report/useReports";
import { ReportPreview } from "@/features/report/ReportPreview";
import { buildRawReport, compileReportSections } from "@/features/report/ReportSectionRegistry";
import type { ReportContext, ReportCaseSnapshot } from "@/features/report/types";
import type { Override } from "@/services/clinical/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface CaseTabsProps {
  caseSummary: CaseSummary;
  onNewVisit?: () => void;
  activeRole?: string;
}

export function CaseTabs({ caseSummary, onNewVisit, activeRole = "Physician" }: CaseTabsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"encounters" | "plan" | "report">("encounters");
  const [isAddingEncounter, setIsAddingEncounter] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | null>(null);

  const { patient, visits } = caseSummary;
  const { save: saveMonitoringVisit } = useMonitoringVisits(caseSummary.id);
  const { addOverride, removeOverride, getOverrideFor } = useOverrides(caseSummary.id);

  // Pure headless clinical engine orchestration
  const caseInput = useMemo(() => ({ patient, visits }), [patient, visits]);
  const stratification = useMemo(() => runStratification(caseInput), [caseInput]);
  const protocolPlan = useMemo(
    () => runProtocolPlan(caseInput, stratification),
    [caseInput, stratification],
  );
  const triggerDecision = useMemo(
    () => runTriggerDecision(caseInput, stratification, protocolPlan),
    [caseInput, stratification, protocolPlan],
  );

  // Active overrides from store
  const protocolOverride = getOverrideFor("protocol-recommendation", "primary");
  const startingDoseOverride = getOverrideFor("starting-dose", "startingDose");
  const lhAddonOverride = getOverrideFor("gonadotropin-selection", "lhAddon");
  const triggerOverride = getOverrideFor("trigger", "triggerType");

  const effectiveOverrides = useMemo(() => {
    return [protocolOverride, startingDoseOverride, lhAddonOverride, triggerOverride].filter(
      (o): o is Override => Boolean(o),
    );
  }, [protocolOverride, startingDoseOverride, lhAddonOverride, triggerOverride]);

  // Reports state hook (§2.4, §2.5)
  const { currentReport, signReport, submitForSign, cosignReport, openAddendum } = useReports(
    caseSummary.id,
  );

  // Map pure engine MonitoringVisits into case-centric Encounters
  const encounters = useMemo(() => {
    return visits.map((v) => monitoringVisitToEncounter(v, caseSummary.id));
  }, [visits, caseSummary.id]);

  const rawIntelligenceReport = useMemo(() => {
    return buildRawReport(caseInput, stratification, protocolPlan, triggerDecision);
  }, [caseInput, stratification, protocolPlan, triggerDecision]);

  const reportContext: ReportContext = useMemo(
    () => ({
      caseId: caseSummary.id,
      caseMetadata: caseSummary,
      encounters,
      orchestratorOutputs: {
        stratification,
        plan: protocolPlan,
        trigger: triggerDecision,
      },
      effectiveOverrides,
      rawIntelligenceReport,
    }),
    [
      caseSummary,
      encounters,
      stratification,
      protocolPlan,
      triggerDecision,
      effectiveOverrides,
      rawIntelligenceReport,
    ],
  );

  // If report is locked (Signed), display its frozen snapshot sections.
  // Otherwise, display live compiled sections!
  const displaySections = useMemo(() => {
    if (currentReport.locked && currentReport.sections.length > 0) {
      return currentReport.sections;
    }
    return compileReportSections(reportContext);
  }, [currentReport, reportContext]);

  const handleSignReport = useCallback(
    (physicianName: string) => {
      const liveSections = compileReportSections(reportContext);
      const snapshot: ReportCaseSnapshot = {
        encounters,
        orchestratorOutputs: {
          stratification,
          plan: protocolPlan,
          trigger: triggerDecision,
        },
        effectiveOverrides,
        caseMetadata: caseSummary,
      };
      signReport("dr_physician", physicianName, snapshot, liveSections);
    },
    [
      reportContext,
      encounters,
      stratification,
      protocolPlan,
      triggerDecision,
      effectiveOverrides,
      caseSummary,
      signReport,
    ],
  );

  const handleSubmitForSign = useCallback(() => {
    submitForSign(activeRole);
  }, [submitForSign, activeRole]);

  const handleCosign = useCallback(
    (seniorPhysicianName: string) => {
      cosignReport("dr_senior", seniorPhysicianName);
    },
    [cosignReport],
  );

  const handleOpenAddendum = useCallback(
    (reason: string) => {
      const snapshot: ReportCaseSnapshot = {
        encounters,
        orchestratorOutputs: {
          stratification,
          plan: protocolPlan,
          trigger: triggerDecision,
        },
        effectiveOverrides,
        caseMetadata: caseSummary,
      };
      openAddendum("dr_physician", reason, snapshot);
    },
    [
      encounters,
      stratification,
      protocolPlan,
      triggerDecision,
      effectiveOverrides,
      caseSummary,
      openAddendum,
    ],
  );

  const latestEncounter = useMemo(() => {
    if (encounters.length === 0) return null;
    return [...encounters].sort((a, b) => a.day - b.day)[encounters.length - 1];
  }, [encounters]);

  // Save handler for EncounterForm (both single save and save-and-new)
  const handleSaveEncounter = (savedEncounter: Encounter, isNewAndNext: boolean) => {
    const monitoringVisit = encounterToMonitoringVisit(savedEncounter);
    saveMonitoringVisit(monitoringVisit);

    if (!isNewAndNext) {
      setIsAddingEncounter(false);
      setEditingEncounter(null);
    }
  };

  // Verification workflow (Draft -> Entered -> Verified)
  const handleVerifyEncounter = (encounterId: string) => {
    const target = encounters.find((e) => e.id === encounterId);
    if (!target) return;
    const verified: Encounter = {
      ...target,
      status: "Verified",
      audit: [
        ...target.audit,
        {
          at: new Date().toISOString(),
          by: "physician_verifier",
          action: "verified_encounter",
          hash: `ver-${encounterId}-${Date.now()}`,
        },
      ],
    };
    saveMonitoringVisit(encounterToMonitoringVisit(verified));
  };

  const handleOpenAdd = useCallback(() => {
    setActiveTab("encounters");
    setEditingEncounter(null);
    setIsAddingEncounter(true);
    if (onNewVisit) onNewVisit();
  }, [onNewVisit]);

  // Global Keyboard Map (§3 & §5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+E -> Encounters Tab
      if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setActiveTab("encounters");
      }
      // Alt+P -> Plan Tab
      else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setActiveTab("plan");
      }
      // Alt+R -> Report Tab
      else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setActiveTab("report");
      }
      // Alt+V -> New Visit (opens encounter form)
      else if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handleOpenAdd();
      }
      // F2 -> Edit latest encounter if not in form
      else if (e.key === "F2" && !isAddingEncounter && !editingEncounter) {
        e.preventDefault();
        if (latestEncounter) {
          setActiveTab("encounters");
          setEditingEncounter(latestEncounter);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenAdd, isAddingEncounter, editingEncounter, latestEncounter]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        {/* Persistent Tab Navigation with Academic Navy Active State */}
        <div className="border-b border-border-subtle bg-bg-surface px-6 pt-2">
          <TabsList className="h-10 bg-bg-surface-muted p-1 border border-border-subtle rounded-lg">
            <TabsTrigger
              value="encounters"
              className="gap-2 px-4 text-xs font-semibold data-[state=active]:bg-accent-primary data-[state=active]:text-text-on-accent data-[state=active]:shadow-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <Activity className="size-4" />
              <span>{t("tabs.encounters")}</span>
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] bg-bg-surface text-text-muted"
              >
                {encounters.length}
              </Badge>
              <kbd className="ms-1 hidden rounded bg-bg-surface/80 px-1 text-[9px] text-text-muted lg:inline">
                Alt+E
              </kbd>
            </TabsTrigger>

            <TabsTrigger
              value="plan"
              className="gap-2 px-4 text-xs font-semibold data-[state=active]:bg-accent-primary data-[state=active]:text-text-on-accent data-[state=active]:shadow-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <Layers className="size-4" />
              <span>{t("tabs.plan")}</span>
              <kbd className="ms-1 hidden rounded bg-bg-surface/80 px-1 text-[9px] text-text-muted lg:inline">
                Alt+P
              </kbd>
            </TabsTrigger>

            <TabsTrigger
              value="report"
              className="gap-2 px-4 text-xs font-semibold data-[state=active]:bg-accent-primary data-[state=active]:text-text-on-accent data-[state=active]:shadow-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <FileText className="size-4" />
              <span>{t("tabs.report")}</span>
              <kbd className="ms-1 hidden rounded bg-bg-surface/80 px-1 text-[9px] text-text-muted lg:inline">
                Alt+R
              </kbd>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab A: Encounters (Longitudinal Timeline & Fast Entry Form) */}
        <TabsContent
          value="encounters"
          className="flex-1 overflow-y-auto p-8 focus-visible:outline-hidden"
        >
          <div className="mx-auto max-w-5xl">
            {isAddingEncounter || editingEncounter ? (
              <EncounterForm
                caseId={caseSummary.id}
                patient={patient}
                initialEncounter={editingEncounter}
                previousEncounter={editingEncounter ? undefined : latestEncounter}
                onSave={handleSaveEncounter}
                onCancel={() => {
                  setIsAddingEncounter(false);
                  setEditingEncounter(null);
                }}
              />
            ) : (
              <EncounterTimeline
                encounters={encounters}
                patient={patient}
                onAddEncounter={() => handleOpenAdd()}
                onEditEncounter={(enc) => {
                  setEditingEncounter(enc);
                  setIsAddingEncounter(false);
                }}
                onVerifyEncounter={handleVerifyEncounter}
              />
            )}
          </div>
        </TabsContent>

        {/* Tab B: Plan (Consolidated 4 Decision Cards with Orchestrators & Overrides) */}
        <TabsContent
          value="plan"
          className="flex-1 overflow-y-auto p-8 focus-visible:outline-hidden"
        >
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border-subtle">
              <div>
                <h2 className="text-base font-bold text-text-primary">Clinical Stimulation Plan</h2>
                <p className="text-xs text-text-muted">
                  Consolidated reserve stratification, protocol planning, dose nomograms, and
                  trigger strategy.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs font-mono border-border-default text-text-muted"
                >
                  Role: {activeRole}
                </Badge>
                {activeRole !== "Physician" && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] text-safety-warning bg-safety-warning-bg border-safety-warning/30"
                  >
                    Overrides Physician-Only
                  </Badge>
                )}
              </div>
            </div>

            {/* The 4 Consolidated Decision Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Stratification (Read-Only) */}
              <StratificationCard stratification={stratification} />

              {/* Card 2: Protocol (Overridable) */}
              <ProtocolCard
                caseId={caseSummary.id}
                plan={protocolPlan}
                override={protocolOverride}
                activeRole={activeRole}
                onSaveOverride={addOverride}
                onRemoveOverride={removeOverride}
              />

              {/* Card 3: Dose & LH Add-on (Overridable) */}
              <DoseCard
                caseId={caseSummary.id}
                plan={protocolPlan}
                visits={visits}
                startingDoseOverride={startingDoseOverride}
                lhAddonOverride={lhAddonOverride}
                activeRole={activeRole}
                onSaveOverride={addOverride}
                onRemoveOverride={removeOverride}
              />

              {/* Card 4: Trigger Strategy & Firewalls (Trigger Choice Overridable) */}
              <TriggerSafetyCard
                caseId={caseSummary.id}
                decision={triggerDecision}
                override={triggerOverride}
                activeRole={activeRole}
                onSaveOverride={addOverride}
                onRemoveOverride={removeOverride}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab C: Report (Deliverable Dossier) */}
        <TabsContent
          value="report"
          className="flex-1 overflow-y-auto p-8 focus-visible:outline-hidden"
        >
          <div className="mx-auto max-w-5xl">
            <ReportPreview
              report={currentReport}
              sections={displaySections}
              activeRole={activeRole}
              onSign={handleSignReport}
              onSubmitForSign={handleSubmitForSign}
              onCosign={handleCosign}
              onOpenAddendum={handleOpenAddendum}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
