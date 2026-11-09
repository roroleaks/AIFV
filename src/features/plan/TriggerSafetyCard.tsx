/**
 * TriggerSafetyCard Component (§2.2, §3, §9.3, §2.4)
 *
 * Displays trigger strategy recommendation, readiness criteria,
 * multi-dimensional OHSS risk assessment (shape+color+text), and safety firewalls.
 *
 * OVERRIDES:
 *  - Overridable: Trigger Agent Choice ONLY (hCG, GnRH Agonist, Dual)
 *  - NOT Overridable: OHSS Risk Score and Safety Firewalls (cannot be suppressed)
 *
 * Progressive disclosure: trigger readiness agent & OHSS risk badge prominent;
 * detailed safety firewalls checklist and evidence rationale behind on-demand toggle.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldAlert,
  AlertTriangle,
  Octagon,
  Square,
  Triangle,
  Circle,
  ArrowRight,
  UserCheck,
  ChevronDown,
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();
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
        colorClass: "border-safety-danger bg-safety-danger/10 text-safety-danger font-bold",
        iconClass: "text-safety-danger",
      };
    }
    if (ohssLevel.includes("high") || ohssLevel.includes("severe")) {
      return {
        shape: Triangle,
        label: "HIGH OHSS RISK",
        colorClass: "border-safety-danger bg-safety-danger/10 text-safety-danger font-bold",
        iconClass: "text-safety-danger",
      };
    }
    if (ohssLevel.includes("mod")) {
      return {
        shape: Square,
        label: "MODERATE OHSS RISK",
        colorClass: "border-safety-warning bg-safety-warning/10 text-safety-warning font-bold",
        iconClass: "text-safety-warning rotate-45",
      };
    }
    return {
      shape: Circle,
      label: "LOW OHSS RISK",
      colorClass: "border-safety-success/50 bg-safety-success/10 text-safety-success font-bold",
      iconClass: "text-safety-success",
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
                ? "border-accent-override/60 bg-accent-override/10 text-accent-override hover:bg-accent-override/20"
                : "border-border-default text-text-primary hover:bg-bg-surface-muted"
            }`}
            title={
              isPhysician
                ? "Override trigger agent"
                : "Physician only: coordinators cannot override trigger"
            }
          >
            {override ? (
              <>
                <AlertTriangle className="size-3 text-accent-override" />
                <span>Trigger Overridden</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3 text-accent-primary" />
                <span>Override Trigger</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Section A: Trigger Readiness & Recommended Agent (Primary Focus) */}
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
                    ? "border-safety-success/50 bg-safety-success/10 text-safety-success"
                    : "border-border-default text-text-muted"
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs line-through text-text-muted">{rawTriggerDisplay}</span>
                <ArrowRight className="size-3 text-accent-override shrink-0" />
                <span className="text-sm font-bold text-accent-override">
                  {currentTriggerDisplay}
                </span>
                <Badge
                  variant="outline"
                  className="bg-accent-override/10 border-accent-override/50 text-accent-override text-[9px] font-bold"
                >
                  OVERRIDDEN
                </Badge>
              </div>

              <div className="rounded bg-accent-override/10 border border-accent-override/30 p-2 text-[11px] text-accent-override space-y-0.5">
                <div className="flex justify-between items-center text-[10px] font-semibold">
                  <span>By: {override.by}</span>
                  <span>{new Date(override.at).toLocaleDateString()}</span>
                </div>
                <p className="italic">&quot;{override.reason}&quot;</p>
              </div>
            </div>
          ) : (
            <div className="text-sm font-bold text-text-primary">{rawTriggerDisplay}</div>
          )}

          <p className="text-[11px] text-muted-foreground pt-0.5 line-clamp-2">
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
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {ohss.status ||
              `Evaluated against follicular cohort count, latest estradiol kinematics, and baseline reserve markers.`}
          </p>
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

        {/* Expandable Section C: Safety Firewalls Status (NOT Overridable — §3) */}
        {isExpanded && (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block">
              Clinical Safety Firewalls (Hard Ceilings)
            </span>
            <div className="space-y-1">
              <div className="flex items-center justify-between p-2 rounded bg-bg-surface-muted border border-border-subtle text-[11px]">
                <span className="text-text-primary">
                  ESHRE Starting Dose Ceiling (≤ 300 IU/day)
                </span>
                <Badge
                  variant="outline"
                  className={
                    safetyFirewalls.eshre300CeilingBreached
                      ? "border-safety-danger text-safety-danger font-bold"
                      : "border-safety-success/40 text-safety-success"
                  }
                >
                  {safetyFirewalls.eshre300CeilingBreached ? "BREACHED" : "Enforced"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-bg-surface-muted border border-border-subtle text-[11px]">
                <span className="text-text-primary">Coasting Trigger (E2 ≥ 4,500 pg/mL)</span>
                <Badge
                  variant="outline"
                  className={
                    safetyFirewalls.coastingTriggerBreached
                      ? "border-safety-warning text-safety-warning font-bold"
                      : "text-text-muted"
                  }
                >
                  {safetyFirewalls.coastingTriggerBreached ? "TRIGGERED" : "Not Active"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-bg-surface-muted border border-border-subtle text-[11px]">
                <span className="text-text-primary">Freeze-All Policy (OHSS Prevention)</span>
                <Badge
                  variant="outline"
                  className={
                    safetyFirewalls.freezeAllTriggerBreached
                      ? "border-safety-warning text-safety-warning font-bold"
                      : "text-text-muted"
                  }
                >
                  {cycleCompletion.freezeAll?.status || "Not Indicated"}
                </Badge>
              </div>
            </div>
          </div>
        )}
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
