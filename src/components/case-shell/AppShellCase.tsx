import { useState, useMemo, useEffect, useCallback } from "react";
import { useCase } from "@/features/case/useCase";
import { useReports } from "@/features/report/useReports";
import { IntakeDrawer } from "@/features/intake/IntakeDrawer";
import { TopBar } from "./TopBar";
import { LeftRail } from "./LeftRail";
import { CaseHeader } from "./CaseHeader";
import { CaseTabs } from "./CaseTabs";
import { DecisionSidebar } from "./DecisionSidebar";
import { LockOverlay } from "./LockOverlay";
import { TestModeBanner } from "@/components/engine/test-mode-banner";

interface AppShellCaseProps {
  caseId?: string;
}

export function AppShellCase({ caseId }: AppShellCaseProps) {
  const { caseSummary, allPatients, isLoading } = useCase(caseId);
  const [activeRole, setActiveRole] = useState("Physician");
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDecisionSidebarOpen, setIsDecisionSidebarOpen] = useState(false);
  const [decisionTargetSection, setDecisionTargetSection] = useState<string | null>(null);
  const [hasAcknowledgedAlert, setHasAcknowledgedAlert] = useState(false);

  const effectiveCaseId = caseSummary?.id ?? caseId ?? "draft";
  const { currentReport } = useReports(effectiveCaseId);

  const effectiveSummary = useMemo(() => {
    if (!caseSummary) return null;
    if (currentReport.status === "Signed") {
      return {
        ...caseSummary,
        state: "Signed" as const,
      };
    }
    return caseSummary;
  }, [caseSummary, currentReport.status]);

  // Auto-open DecisionSidebar if safety firewall is breached or severe OHSS risk escalates (§2.2)
  useEffect(() => {
    if (caseSummary && !hasAcknowledgedAlert) {
      const isSevereRisk = caseSummary.ohssRisk === "high" || caseSummary.ohssRisk === "critical";
      if (caseSummary.firewallBreached || isSevereRisk) {
        setIsDecisionSidebarOpen(true);
        setDecisionTargetSection("firewalls");
      }
    }
  }, [caseSummary, hasAcknowledgedAlert]);

  // Keyboard shortcut: Alt+D toggles sidebar, Esc closes (§2.2)
  const toggleDecisionSidebar = useCallback(() => {
    setIsDecisionSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        toggleDecisionSidebar();
      } else if (e.key === "Escape" && isDecisionSidebarOpen) {
        e.preventDefault();
        setIsDecisionSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDecisionSidebarOpen, toggleDecisionSidebar]);

  const handleOpenDecisionSection = (sectionId?: string) => {
    setDecisionTargetSection(sectionId || null);
    setIsDecisionSidebarOpen(true);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Zone 1: Persistent Top Bar */}
      <TopBar
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        isDecisionOpen={isDecisionSidebarOpen}
        onToggleDecision={toggleDecisionSidebar}
      />

      {/* Zone 2, 3, 4: Main Layout (Main Content expands to full width when sidebar is overlay) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Zone 2: Persistent Left Rail Worklist */}
        <LeftRail
          patients={allPatients}
          activeCaseId={caseSummary?.id ?? caseId}
          onNewCase={() => setIsIntakeOpen(true)}
        />

        {/* Zone 3: Main Clinical Workspace (Reclaims ~300px horizontal space) */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          <TestModeBanner />

          {isLoading || !effectiveSummary ? (
            <div className="flex flex-1 items-center justify-center p-8 text-xs text-muted-foreground">
              Loading patient case...
            </div>
          ) : (
            <>
              {/* Persistent Case Header */}
              <CaseHeader
                caseSummary={effectiveSummary}
                activeRole={activeRole}
                onOpenDecision={handleOpenDecisionSection}
              />

              {/* Case Tabs (Encounters / Plan / Report) */}
              <CaseTabs caseSummary={effectiveSummary} activeRole={activeRole} />

              {/* Dr Raouf Roshdy Footer */}
              <footer className="mt-auto flex items-center justify-between border-t border-border/60 bg-muted/10 px-6 py-2.5 text-xs text-muted-foreground shrink-0">
                <div className="flex items-center gap-3">
                  <img
                    src="/dr-raouf-roshdy.jpg"
                    alt="Dr Raouf Roshdy"
                    className="size-7 rounded-full object-cover ring-1 ring-primary/30"
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Created by Dr Raouf Roshdy
                    </span>
                    <span>·</span>
                    <span className="text-[11px]">All copyrights reserved 2026</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono">
                  AiFV Precision Hospital CDSS · Phase 1 Case Shell
                </div>
              </footer>
            </>
          )}
        </main>

        {/* Zone 4: Contextual Decision Sidebar (On-Demand Slide-In Overlay §2.2) */}
        {caseSummary && (
          <DecisionSidebar
            caseSummary={caseSummary}
            open={isDecisionSidebarOpen}
            onClose={() => setIsDecisionSidebarOpen(false)}
            onAcknowledgeAlert={() => {
              setHasAcknowledgedAlert(true);
              setIsDecisionSidebarOpen(false);
            }}
            targetSection={decisionTargetSection}
          />
        )}
      </div>

      {/* Intake Drawer (§2.1 - §2.6) */}
      <IntakeDrawer open={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />

      {/* Session Lock Screen Overlay (§2.5) */}
      <LockOverlay />
    </div>
  );
}
