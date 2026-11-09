import { useState, useMemo } from "react";
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

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Zone 1: Persistent Top Bar */}
      <TopBar activeRole={activeRole} onRoleChange={setActiveRole} />

      {/* Zone 2, 3, 4: Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Zone 2: Persistent Left Rail Worklist */}
        <LeftRail
          patients={allPatients}
          activeCaseId={caseSummary?.id ?? caseId}
          onNewCase={() => setIsIntakeOpen(true)}
        />

        {/* Zone 3: Main Clinical Workspace */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          <TestModeBanner />

          {isLoading || !effectiveSummary ? (
            <div className="flex flex-1 items-center justify-center p-8 text-xs text-muted-foreground">
              Loading patient case...
            </div>
          ) : (
            <>
              {/* Persistent Case Header */}
              <CaseHeader caseSummary={effectiveSummary} />

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

        {/* Zone 4: Contextual Decision Sidebar */}
        {caseSummary && <DecisionSidebar caseSummary={caseSummary} />}
      </div>

      {/* Intake Drawer (§2.1 - §2.6) */}
      <IntakeDrawer open={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />

      {/* Session Lock Screen Overlay (§2.5) */}
      <LockOverlay />
    </div>
  );
}
