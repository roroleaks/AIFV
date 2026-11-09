/**
 * ProtocolCard Component (§2.2, §2.4)
 *
 * Displays recommended ovarian stimulation protocol, clinical rationale,
 * evidence-based alternatives, and supports structured physician overrides.
 *
 * Progressive disclosure: primary protocol & override status prominent;
 * alternatives, citations, and detailed rationale behind on-demand toggle.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, UserCheck, AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import type { ProtocolPlanResult } from "@/services/clinical/types";
import type { Override } from "@/services/clinical/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RationalePopover } from "@/features/encounter/RationalePopover";
import { OverrideDialog, type OverrideOption } from "./OverrideDialog";

interface ProtocolCardProps {
  caseId: string;
  plan: ProtocolPlanResult;
  override?: Override | undefined;
  activeRole?: string | undefined;
  onSaveOverride: (override: Omit<Override, "id" | "at">) => void;
  onRemoveOverride: (id: string) => void;
}

const PROTOCOL_OPTIONS: OverrideOption[] = [
  {
    value: "gnrh-antagonist",
    label: "GnRH Antagonist Protocol",
    description:
      "Standard safety profile; allows agonist trigger for OHSS prevention (ESHRE Rec 16)",
  },
  {
    value: "gnrh-agonist-long",
    label: "GnRH Agonist Long Protocol",
    description:
      "Classical downregulation; indicated in selected normal/poor responders or endometriosis",
  },
  {
    value: "gnrh-agonist-short",
    label: "GnRH Agonist Short / Flare-up",
    description: "Utilizes initial endogenous flare for low reserve cohorts",
  },
  {
    value: "mild-stimulation",
    label: "Mild Ovarian Stimulation",
    description: "Low-dose gonadotropin or oral agents for patient-friendly minimal intervention",
  },
  {
    value: "duostim",
    label: "DuoStim (Double Stimulation)",
    description:
      "Follicular and luteal phase stimulation in a single cycle for urgent fertility preservation",
  },
];

export function ProtocolCard({
  caseId,
  plan,
  override,
  activeRole = "Physician",
  onSaveOverride,
  onRemoveOverride,
}: ProtocolCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();
  const isPhysician = activeRole.toLowerCase() === "physician";

  const { protocol } = plan;
  const rawRecommendation = protocol.recommendation?.primary ?? "gnrh-antagonist";

  const getProtocolLabel = (key: string) => {
    const opt = PROTOCOL_OPTIONS.find((o) => o.value === key);
    return opt ? opt.label : key;
  };

  const currentDisplay = getProtocolLabel(String(override ? override.toValue : rawRecommendation));
  const rawDisplay = getProtocolLabel(rawRecommendation);

  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
            <Layers className="size-4 text-primary" />
            <span>2. Stimulation Protocol</span>
          </CardTitle>

          {/* Physician Override Trigger */}
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
                ? "Record structured physician override (Ctrl+O)"
                : "Physician only: coordinators cannot override protocol"
            }
          >
            {override ? (
              <>
                <AlertTriangle className="size-3 text-amber-600" />
                <span>Overridden</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3 text-primary" />
                <span>Override</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Main Protocol Statement (Primary Focus) */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Selected Protocol
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold"
              >
                ESHRE Validated
              </Badge>
              <RationalePopover
                engine="Protocol"
                title="Protocol Selection Rationale"
                rationale={
                  protocol.recommendation?.explanation?.clinicalRationale ??
                  protocol.recommendation?.message ??
                  "GnRH antagonist protocol is recommended by ESHRE guidelines due to comparable live birth rates and significantly reduced risk of OHSS."
                }
                guidelineRule="ESHRE 2025 Rec 16 (Strong Recommendation, ⊕⊕⊕⊕)"
                citationText="Ovarian Stimulation Guideline Development Group. ESHRE guideline: ovarian stimulation for IVF/ICSI. Hum Reprod Open. 2025;2025(2):hoaf012."
              />
            </div>
          </div>

          {/* Overridden vs Raw Display */}
          {override ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs line-through text-muted-foreground">{rawDisplay}</span>
                <ArrowRight className="size-3 text-amber-600 shrink-0" />
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {currentDisplay}
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-400 text-[9px] font-bold"
                >
                  OVERRIDDEN
                </Badge>
              </div>

              {/* Override Audit Banner */}
              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
                <div className="flex justify-between items-center text-[10px] font-semibold">
                  <span>By: {override.by}</span>
                  <span>{new Date(override.at).toLocaleDateString()}</span>
                </div>
                <p className="italic">"{override.reason}"</p>
              </div>
            </div>
          ) : (
            <div className="text-base font-bold text-foreground">{rawDisplay}</div>
          )}

          <p className="text-[11px] text-muted-foreground pt-0.5 line-clamp-2">
            {protocol.recommendation?.explanation?.clinicalRationale ??
              protocol.recommendation?.message ??
              "Selected based on maternal age, reserve phenotype, and prior cycle response."}
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

        {/* Expandable Alternatives & Evidence */}
        {isExpanded && (
          <div className="space-y-2 pt-1 border-t border-border/40">
            <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block">
              Evidence Library Alternatives
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {PROTOCOL_OPTIONS.filter((o) => o.value !== rawRecommendation)
                .slice(0, 4)
                .map((opt) => (
                  <div
                    key={opt.value}
                    className="rounded border border-border/40 p-2 bg-muted/10 text-muted-foreground space-y-0.5"
                  >
                    <span className="font-semibold text-foreground block text-[11px]">
                      {opt.label}
                    </span>
                    <span className="text-[10px] line-clamp-2">{opt.description}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Override Dialog Modal */}
      <OverrideDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        caseId={caseId}
        engine="protocol-recommendation"
        field="primary"
        fieldLabel="Stimulation Protocol"
        currentValue={rawRecommendation}
        currentDisplay={rawDisplay}
        options={PROTOCOL_OPTIONS}
        activeRole={activeRole}
        onConfirm={onSaveOverride}
        existingOverride={override}
        onRemoveOverride={override ? () => onRemoveOverride(override.id) : undefined}
      />
    </Card>
  );
}
