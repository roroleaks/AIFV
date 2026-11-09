/**
 * DoseCard Component (§2.2, §3, §2.4)
 *
 * Displays starting gonadotropin dose (CONSORT + ESHRE 2025 nomogram),
 * current encounter dose, cumulative cycle dose, and LH add-on strategy.
 *
 * OVERRIDES:
 *  - Overridable: Starting Dose and LH Add-on
 *  - NOT Overridable: Cumulative dose (derived math) and 300 IU ceiling (safety rule)
 *
 * Progressive disclosure: primary dose and cumulative counters prominent;
 * nomogram parameters, model explanations, and LH add-on behind on-demand toggle.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Syringe, UserCheck, AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import type { ProtocolPlanResult, Override } from "@/services/clinical/types";
import type { MonitoringVisit } from "@/lib/engine/monitoring";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RationalePopover } from "@/features/encounter/RationalePopover";
import { OverrideDialog, type OverrideOption } from "./OverrideDialog";

interface DoseCardProps {
  caseId: string;
  plan: ProtocolPlanResult;
  visits?: MonitoringVisit[] | undefined;
  startingDoseOverride?: Override | undefined;
  lhAddonOverride?: Override | undefined;
  activeRole?: string | undefined;
  onSaveOverride: (override: Omit<Override, "id" | "at">) => void;
  onRemoveOverride: (id: string) => void;
}

const LH_ADDON_OPTIONS: OverrideOption[] = [
  {
    value: "none",
    label: "None (Pure rFSH Monotherapy)",
    description: "Standard monotherapy for normal responders under 35 years",
  },
  {
    value: "r-hlh-75",
    label: "r-hLH 75 IU/day Add-on",
    description: "Recommended in advanced maternal age (≥35) or poor/hypo-response (ESHRE Rec 29)",
  },
  {
    value: "r-hlh-150",
    label: "r-hLH 150 IU/day Add-on",
    description:
      "Higher dose LH supplementation for severe hypo-response or profound downregulation",
  },
  {
    value: "hp-hmg",
    label: "Convert to hp-hMG (contains hCG LH-activity)",
    description: "Urinary menotropin formulation providing combined FSH + LH activity",
  },
];

export function DoseCard({
  caseId,
  plan,
  visits = [],
  startingDoseOverride,
  lhAddonOverride,
  activeRole = "Physician",
  onSaveOverride,
  onRemoveOverride,
}: DoseCardProps) {
  const [activeDialog, setActiveDialog] = useState<"dose" | "lh" | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();
  const isPhysician = activeRole.toLowerCase() === "physician";

  const { startingDose, consort, gonadotropin } = plan;

  // Raw starting dose and display
  const rawStartingDoseNum = startingDose.dose ?? (consort.dose ? Math.round(consort.dose) : 225);
  const rawStartingDoseDisplay = `${rawStartingDoseNum} IU/day`;

  const currentStartingDoseNum = startingDoseOverride
    ? Number(startingDoseOverride.toValue)
    : rawStartingDoseNum;
  const currentStartingDoseDisplay = `${currentStartingDoseNum} IU/day`;

  // Raw LH add-on recommendation
  const rawLhKey =
    gonadotropin.selection?.recommended === "hp-hmg"
      ? "hp-hmg"
      : gonadotropin.selection?.lhStrategy?.toLowerCase().includes("add")
        ? "r-hlh-75"
        : "none";
  const rawLhDisplay =
    LH_ADDON_OPTIONS.find((o) => o.value === rawLhKey)?.label ?? "None (Pure rFSH)";

  const currentLhKey = lhAddonOverride ? String(lhAddonOverride.toValue) : rawLhKey;
  const currentLhDisplay =
    LH_ADDON_OPTIONS.find((o) => o.value === currentLhKey)?.label ?? currentLhKey;

  // Latest encounter daily dose
  const latestVisit = visits.length > 0 ? visits[visits.length - 1] : null;
  const currentVisitDose = latestVisit?.dailyDose ?? currentStartingDoseNum;

  // Cumulative total gonadotropin dose across cycle (derived math)
  const cumulativeTotalDose = visits.reduce((acc, v) => acc + (v.dailyDose ?? 0), 0);

  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
            <Syringe className="size-4 text-primary" />
            <span>3. Starting Dose &amp; Gonadotropins</span>
          </CardTitle>

          {/* Starting Dose Override Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={!isPhysician}
            onClick={() => setActiveDialog("dose")}
            className={`h-7 px-2.5 text-xs gap-1 shadow-2xs font-semibold ${
              startingDoseOverride
                ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                : "border-border/80 text-foreground hover:bg-muted"
            }`}
            title={
              isPhysician
                ? "Override starting dose"
                : "Physician only: coordinators cannot override dose"
            }
          >
            {startingDoseOverride ? (
              <>
                <AlertTriangle className="size-3 text-amber-600" />
                <span>Dose Overridden</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3 text-primary" />
                <span>Override Dose</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Section A: Starting Dose Calculation (Primary Focus) */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Starting Dose (Nomogram)
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-mono">
                Ceiling: 300 IU/day
              </Badge>
              <RationalePopover
                engine="CONSORT"
                title="Starting Dose Nomogram Rationale"
                rationale={
                  startingDose.stateExplanation ||
                  "Starting dose calculated using the validated CONSORT nomogram integrating age, BMI, basal FSH, and ovarian reserve markers."
                }
                guidelineRule="ESHRE 2025 Rec 20: Starting dose above 300 IU/day is not recommended (Strong, ⊕⊕⊕⊕)"
                citationText="Nyboe Andersen A, et al. Individualized versus conventional ovarian stimulation for in vitro fertilization (CONSORT): a multicentre randomised controlled trial. Hum Reprod. 2017;32(7):1405-1414."
                details={
                  <div className="space-y-1">
                    <span className="font-bold text-[10px] block uppercase text-muted-foreground">
                      Algorithm Outputs:
                    </span>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CONSORT raw:</span>
                      <span className="font-mono font-bold text-foreground">
                        {consort.dose ? `${consort.dose} IU/day` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Safety Ceiling:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        300 IU/day max
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </div>

          {/* Overridden vs Raw Starting Dose */}
          {startingDoseOverride ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs line-through text-muted-foreground">
                  {rawStartingDoseDisplay}
                </span>
                <ArrowRight className="size-3 text-amber-600 shrink-0" />
                <span className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {currentStartingDoseDisplay}
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-400 text-[9px] font-bold"
                >
                  OVERRIDDEN
                </Badge>
              </div>

              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
                <div className="flex justify-between items-center text-[10px] font-semibold">
                  <span>By: {startingDoseOverride.by}</span>
                  <span>{new Date(startingDoseOverride.at).toLocaleDateString()}</span>
                </div>
                <p className="italic">"{startingDoseOverride.reason}"</p>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-primary font-mono">
                {rawStartingDoseDisplay}
              </span>
              <span className="text-muted-foreground text-[11px]">
                ({gonadotropin.selection?.recommended || "rFSH"})
              </span>
            </div>
          )}
        </div>

        {/* Section B: Current vs Cumulative Dose (Derived Math) */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Current Encounter Dose
            </span>
            <span className="text-foreground font-bold text-sm font-mono block">
              {currentVisitDose} IU/day
            </span>
            <span className="text-muted-foreground text-[10px]">
              {latestVisit ? `Encounter Day ${latestVisit.day}` : "Pre-stimulation"}
            </span>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Cumulative Total Dose
            </span>
            <span className="text-foreground font-bold text-sm font-mono block">
              {cumulativeTotalDose > 0 ? `${cumulativeTotalDose} IU` : "0 IU"}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {visits.length} visit{visits.length === 1 ? "" : "s"} recorded
            </span>
          </div>
        </div>

        {/* Progressive Disclosure Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground border border-border/40 hover:bg-muted/40"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? t("plan.hideDetails") : t("plan.showDetails")}</span>
          <ChevronDown
            className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </Button>

        {/* Expandable Section C: LH Activity Supplementation */}
        {isExpanded && (
          <div className="space-y-2 pt-1 border-t border-border/40">
            <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                  LH Activity Supplementation
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!isPhysician}
                  onClick={() => setActiveDialog("lh")}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                >
                  {lhAddonOverride ? (
                    <span className="text-amber-600 font-bold">Edit Override</span>
                  ) : (
                    <span>Override</span>
                  )}
                </Button>
              </div>

              {lhAddonOverride ? (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                    <span className="line-through text-muted-foreground text-[11px]">
                      {rawLhDisplay}
                    </span>
                    <ArrowRight className="size-3 text-amber-600 shrink-0" />
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {currentLhDisplay}
                    </span>
                  </div>
                  <p className="text-[10px] italic text-muted-foreground">
                    "{lhAddonOverride.reason}"
                  </p>
                </div>
              ) : (
                <div className="text-[11px] font-medium text-foreground">{rawLhDisplay}</div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Starting Dose Override Dialog */}
      <OverrideDialog
        isOpen={activeDialog === "dose"}
        onClose={() => setActiveDialog(null)}
        caseId={caseId}
        engine="starting-dose"
        field="startingDose"
        fieldLabel="Starting Dose"
        currentValue={rawStartingDoseNum}
        currentDisplay={rawStartingDoseDisplay}
        isNumeric
        minVal={37.5}
        maxVal={600}
        stepVal={12.5}
        unit="IU/day"
        activeRole={activeRole}
        onConfirm={onSaveOverride}
        existingOverride={startingDoseOverride}
        onRemoveOverride={
          startingDoseOverride ? () => onRemoveOverride(startingDoseOverride.id) : undefined
        }
      />

      {/* LH Add-on Override Dialog */}
      <OverrideDialog
        isOpen={activeDialog === "lh"}
        onClose={() => setActiveDialog(null)}
        caseId={caseId}
        engine="gonadotropin-selection"
        field="lhAddon"
        fieldLabel="LH Activity Add-on"
        currentValue={rawLhKey}
        currentDisplay={rawLhDisplay}
        options={LH_ADDON_OPTIONS}
        activeRole={activeRole}
        onConfirm={onSaveOverride}
        existingOverride={lhAddonOverride}
        onRemoveOverride={lhAddonOverride ? () => onRemoveOverride(lhAddonOverride.id) : undefined}
      />
    </Card>
  );
}
