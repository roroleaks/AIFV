/**
 * TriggerSafetyCard Component (§2.2, §3, §9.3)
 *
 * Displays trigger strategy recommendation, readiness criteria,
 * multi-dimensional OHSS risk assessment (shape+color+text), and safety firewalls.
 *
 * OVERRIDES:
 *  - Overridable: Trigger Agent Choice ONLY (hCG, GnRH Agonist, Dual)
 *  - NOT Overridable: OHSS Risk Score and Safety Firewalls (cannot be suppressed)
 */

import { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Octagon,
  Square,
  Triangle,
  Circle,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import type { TriggerDecisionResult, Override } from "@/services/clinical/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RationalePopover } from "@/features/encounter/RationalePopover";
import { OverrideDialog, type OverrideOption } from "./OverrideDialog";

interface TriggerSafetyCardProps {
  caseId: string;
  decision: TriggerDecisionResult;
  override?: Override | undefined;
  activeRole?: string | undefined;
  onSaveOverride: (override: Omit<Override, "id" | "at">) => void;
  onRemoveOverride: (id: string) => void;
}

const TRIGGER_OPTIONS: OverrideOption[] = [
  {
    value: "hcg",
    label: "Choriogonadotropin alfa (rhCG 250 µg)",
    description: "Standard trigger for low OHSS risk cohorts with < 15 follicles ≥ 11 mm",
  },
  {
    value: "gnrh-agonist",
    label: "GnRH Agonist (Triptorelin 0.2 mg s.c.)",
    description:
      "Eliminates OHSS risk via rapid LH surge with short half-life; requires freeze-all or intensive luteal support",
  },
  {
    value: "dual",
    label: "Dual Trigger (Agonist 0.2 mg + Low-dose hCG 1,000 IU)",
    description:
      "Optimizes oocyte maturity in borderline/poor responders or prior empty follicle syndrome",
  },
];

export function TriggerSafetyCard({
  caseId,
  decision,
  override,
  activeRole = "Physician",
  onSaveOverride,
  onRemoveOverride,
}: TriggerSafetyCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isPhysician = activeRole.toLowerCase() === "physician";

  const { trigger, ohss, cycleCompletion, safetyFirewalls } = decision;

  // Determine raw recommended trigger agent
  const recOption = trigger.options.find(
    (o) => o.applicability === "MATCH" || o.applicability === "PARTIAL MATCH",
  );
  const rawTriggerKey =
    recOption?.triggerType === "gnrh-agonist"
      ? "gnrh-agonist"
      : recOption?.triggerType === "dual"
        ? "dual"
        : "hcg";

  const getTriggerLabel = (key: string) => {
    return TRIGGER_OPTIONS.find((o) => o.value === key)?.label ?? key;
  };

  const rawTriggerDisplay = getTriggerLabel(rawTriggerKey);
  const currentTriggerKey = override ? String(override.toValue) : rawTriggerKey;
  const currentTriggerDisplay = getTriggerLabel(currentTriggerKey);

  // OHSS Risk Badge with shape + color + text (§9.3)
  const ohssLevel = (ohss.level || "low").toLowerCase();
  const getOhssVisual = () => {
    if (ohssLevel.includes("critical")) {
      return {
        shape: Octagon,
        label: "CRITICAL OHSS RISK",
        colorClass: "border-red-600 bg-red-600/10 text-red-700 dark:text-red-400 font-bold",
        iconClass: "text-red-600",
      };
    }
    if (ohssLevel.includes("high") || ohssLevel.includes("severe")) {
      return {
        shape: Triangle,
        label: "HIGH OHSS RISK",
        colorClass:
          "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold",
        iconClass: "text-orange-500",
      };
    }
    if (ohssLevel.includes("mod")) {
      return {
        shape: Square,
        label: "MODERATE OHSS RISK",
        colorClass: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold",
        iconClass: "text-amber-500 rotate-45",
      };
    }
    return {
      shape: Circle,
      label: "LOW OHSS RISK",
      colorClass:
        "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold",
      iconClass: "text-emerald-500",
    };
  };

  const ohssVisual = getOhssVisual();
  const OhssIcon = ohssVisual.shape;

  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
            <ShieldAlert className="size-4 text-primary" />
            <span>4. Trigger Strategy &amp; Safety Firewalls</span>
          </CardTitle>

          {/* Trigger Agent Override Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={!isPhysician}
            onClick={() => setIsDialogOpen(true)}
            className={`h-7 px-2.5 text-xs gap-1 shadow-2xs font-semibold ${
              override
                ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                : "border-border/80 text-foreground hover:bg-muted"
            }`}
            title={
              isPhysician
                ? "Override trigger agent"
                : "Physician only: coordinators cannot override trigger"
            }
          >
            {override ? (
              <>
                <AlertTriangle className="size-3 text-amber-600" />
                <span>Trigger Overridden</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3 text-primary" />
                <span>Override Trigger</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Section A: Trigger Readiness & Recommended Agent */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Trigger Readiness &amp; Agent
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold ${
                  trigger.readiness?.statusLabel?.includes("READY")
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border text-muted-foreground"
                }`}
              >
                {trigger.readiness?.statusLabel || "Stimulation Ongoing"}
              </Badge>
              <RationalePopover
                engine="Trigger"
                title="Trigger Strategy Rationale"
                rationale={
                  trigger.readiness?.explanation ||
                  "Trigger timing evaluated using ESHRE 2025 and ASRM validated follicular criteria (≥3 follicles ≥17 mm or lead ≥18 mm)."
                }
                guidelineRule="ESHRE 2025 Rec 33 & 35 (Trigger Criteria & Agent Selection)"
                citationText="Ovarian Stimulation Guideline Development Group. ESHRE guideline: ovarian stimulation for IVF/ICSI. Hum Reprod Open. 2025;2025(2):hoaf012."
              />
            </div>
          </div>

          {/* Overridden vs Raw Trigger Agent */}
          {override ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs line-through text-muted-foreground">
                  {rawTriggerDisplay}
                </span>
                <ArrowRight className="size-3 text-amber-600" />
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {currentTriggerDisplay}
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
                  <span>By: {override.by}</span>
                  <span>{new Date(override.at).toLocaleDateString()}</span>
                </div>
                <p className="italic">"{override.reason}"</p>
              </div>
            </div>
          ) : (
            <div className="text-sm font-bold text-foreground">{rawTriggerDisplay}</div>
          )}

          <p className="text-[11px] text-muted-foreground pt-0.5">
            {trigger.readiness?.headline || "Continue follicular monitoring."}
          </p>
        </div>

        {/* Section B: OHSS Risk Score (NOT Overridable — §9.3) */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              OHSS Risk Stratification
            </span>
            <Badge
              variant="outline"
              className={`gap-1.5 text-xs px-2 py-0.5 ${ohssVisual.colorClass}`}
            >
              <OhssIcon className={`size-3 ${ohssVisual.iconClass}`} />
              <span>{ohssVisual.label}</span>
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {ohss.status ||
              `Evaluated against follicular cohort count, latest estradiol kinematics, and baseline reserve markers.`}
          </p>
        </div>

        {/* Section C: Safety Firewalls Status (NOT Overridable — §3) */}
        <div className="space-y-1.5">
          <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block">
            Clinical Safety Firewalls (Hard Ceilings)
          </span>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40 text-[11px]">
              <span className="text-foreground">ESHRE Starting Dose Ceiling (≤ 300 IU/day)</span>
              <Badge
                variant="outline"
                className={
                  safetyFirewalls.eshre300CeilingBreached
                    ? "border-destructive text-destructive font-bold"
                    : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                }
              >
                {safetyFirewalls.eshre300CeilingBreached ? "BREACHED" : "Enforced"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40 text-[11px]">
              <span className="text-foreground">Coasting Trigger (E2 ≥ 4,500 pg/mL)</span>
              <Badge
                variant="outline"
                className={
                  safetyFirewalls.coastingTriggerBreached
                    ? "border-amber-500 text-amber-700 dark:text-amber-400 font-bold"
                    : "text-muted-foreground"
                }
              >
                {safetyFirewalls.coastingTriggerBreached ? "TRIGGERED" : "Not Active"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40 text-[11px]">
              <span className="text-foreground">Freeze-All Policy (OHSS Prevention)</span>
              <Badge
                variant="outline"
                className={
                  safetyFirewalls.freezeAllTriggerBreached
                    ? "border-amber-500 text-amber-700 dark:text-amber-400 font-bold"
                    : "text-muted-foreground"
                }
              >
                {cycleCompletion.freezeAll?.status || "Not Indicated"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Trigger Agent Override Dialog */}
      <OverrideDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        caseId={caseId}
        engine="trigger"
        field="triggerType"
        fieldLabel="Trigger Agent Choice"
        currentValue={rawTriggerKey}
        currentDisplay={rawTriggerDisplay}
        options={TRIGGER_OPTIONS}
        activeRole={activeRole}
        onConfirm={onSaveOverride}
        existingOverride={override}
        onRemoveOverride={override ? () => onRemoveOverride(override.id) : undefined}
      />
    </Card>
  );
}
