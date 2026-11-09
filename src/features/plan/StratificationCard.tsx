/**
 * StratificationCard Component (§2.2, §3, §2.4)
 *
 * Displays ovarian reserve stratification: POSEIDON classification,
 * Bologna criteria for poor ovarian response, phenotype reserve category,
 * and predicted ovarian response.
 *
 * STRICT REQUIREMENT:
 *  - Classification, not recommendation.
 *  - READ-ONLY: No override buttons permitted.
 *  - Academic palette: POSEIDON/Bologna/phenotype/response all use --accent-classification (§11)
 *  - Progressive disclosure: 4-metric executive summary with expandable rationale.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Stethoscope, Lock, ChevronDown } from "lucide-react";
import type { StratificationResult } from "@/services/clinical/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RationalePopover } from "@/features/encounter/RationalePopover";

interface StratificationCardProps {
  stratification: StratificationResult;
}

export function StratificationCard({ stratification }: StratificationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();
  const { poseidon, bologna, phenotype, ovarianResponse } = stratification;

  return (
    <Card className="border-border-subtle bg-bg-surface shadow-2xs flex flex-col justify-between">
      <CardHeader className="py-2.5 px-4 border-b border-border-subtle bg-bg-surface-muted/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-text-primary">
            <Stethoscope className="size-4 text-accent-primary" />
            <span>1. Ovarian Reserve Stratification</span>
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] gap-1 font-mono text-text-muted border-border-default"
            title="Classification algorithms are strictly deterministic and read-only"
          >
            <Lock className="size-3" />
            <span>Read-Only Standard</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Executive 4-Metric Grid (Primary View) - Mapped to Academic Classification Slate */}
        <div className="grid grid-cols-2 gap-2.5 text-[11px]">
          {/* POSEIDON Group */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1">
            <span className="text-text-muted block text-[10px] uppercase font-semibold">
              POSEIDON
            </span>
            <span className="text-text-primary font-bold text-sm block">
              {poseidon.groupLabel ? `Group ${poseidon.groupLabel}` : "Normal Reserve"}
            </span>
            <span className="text-text-muted text-[10px] block line-clamp-1">
              {poseidon.groupLabel ? `Subgroup ${poseidon.groupLabel}` : "Non-low cohort"}
            </span>
          </div>

          {/* Bologna Criteria */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1">
            <span className="text-text-muted block text-[10px] uppercase font-semibold">
              Bologna POR
            </span>
            <span className="font-bold text-sm block text-text-primary">
              {bologna.status === "positive" ? "Fulfilled" : "Not Fulfilled"}
            </span>
            <span className="text-text-muted text-[10px] block line-clamp-1">
              {bologna.status === "positive" ? "Poor responder" : "Normal criteria"}
            </span>
          </div>

          {/* Reserve Phenotype */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1">
            <span className="text-text-muted block text-[10px] uppercase font-semibold">
              Reserve Category
            </span>
            <span className="text-text-primary font-bold capitalize text-sm block">
              {phenotype.reserve?.category || "Normal"}
            </span>
            <span className="text-text-muted text-[10px] block">
              AMH: {phenotype.reserve?.amh ?? "—"} · AFC: {phenotype.reserve?.afc ?? "—"}
            </span>
          </div>

          {/* Predicted Response */}
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1">
            <span className="text-text-muted block text-[10px] uppercase font-semibold">
              Predicted Response
            </span>
            <span className="text-accent-classification font-bold uppercase text-sm block">
              {ovarianResponse.category || "Normal"}
            </span>
            <span className="text-text-muted text-[10px] block">
              {ovarianResponse.category === "poor" || ovarianResponse.category === "very-poor"
                ? "≤ 3 oocytes"
                : ovarianResponse.category === "suboptimal"
                  ? "4–9 oocytes"
                  : ovarianResponse.category === "normal"
                    ? "10–15 oocytes"
                    : "≥ 16 oocytes"}
            </span>
          </div>
        </div>

        {/* 1-Line Clinical Rationale */}
        <p className="text-[11px] text-text-muted line-clamp-2">
          {poseidon.headline ||
            (poseidon.groupLabel
              ? `Patient classifies into POSEIDON Group ${poseidon.groupLabel} based on age and reserve markers.`
              : "Baseline ovarian reserve markers place patient in non-low-prognosis cohort.")}
        </p>

        {/* Progressive Disclosure Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between h-7 px-2.5 text-[11px] text-text-muted hover:text-text-primary border border-border-subtle hover:bg-bg-surface-muted"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? t("plan.hideDetails") : t("plan.showDetails")}</span>
          <ChevronDown
            className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </Button>

        {/* Expandable Deep Details & Citations */}
        {isExpanded && (
          <div className="space-y-3 pt-1 border-t border-border-subtle">
            {/* Detailed POSEIDON */}
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider">
                  POSEIDON Classification
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs font-bold border-accent-classification/30 bg-accent-classification/10 text-accent-classification"
                  >
                    {poseidon.groupLabel ? `Group ${poseidon.groupLabel}` : "Normal Reserve"}
                  </Badge>
                  <RationalePopover
                    engine="POSEIDON"
                    title="POSEIDON Stratification Rationale"
                    rationale={
                      Array.isArray(poseidon.rationale)
                        ? poseidon.rationale.join(" ")
                        : poseidon.rationale ||
                          "Stratified according to female age, antral follicle count, AMH, and prior oocyte yield."
                    }
                    guidelineRule="POSEIDON Criteria (Alviggi et al., 2016 / ESHRE 2025)"
                    citationText="Alviggi C, et al. A new more detailed stratification of low responders to ovarian stimulation: The POSEIDON criteria. Fertil Steril. 2016;105(6):1452-1453."
                  />
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                {poseidon.headline ||
                  (poseidon.groupLabel
                    ? `Patient classifies into POSEIDON Group ${poseidon.groupLabel} based on age and reserve markers.`
                    : "Baseline ovarian reserve markers place patient in non-low-prognosis cohort.")}
              </p>
            </div>

            {/* Detailed Bologna */}
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider">
                  Bologna Criteria (POR)
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold border-accent-classification/30 bg-accent-classification/10 text-accent-classification"
                  >
                    {bologna.status === "positive" ? "Criteria Fulfilled" : "Not Fulfilled"}
                  </Badge>
                  <RationalePopover
                    engine="Bologna"
                    title="Bologna Criteria Rationale"
                    rationale={
                      bologna.headline ||
                      "Evaluates at least two of: advanced maternal age (≥40), previous poor response (≤3 oocytes), or abnormal ovarian reserve test."
                    }
                    guidelineRule="ESHRE Consensus on Poor Ovarian Responders (Bologna, Ferraretti et al. 2011)"
                    citationText="Ferraretti AP, et al. ESHRE consensus on the definition of 'poor response' to ovarian stimulation for in vitro fertilization: the Bologna criteria. Hum Reprod. 2011;26(7):1616-1624."
                  />
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                {bologna.headline ||
                  (bologna.status === "positive"
                    ? "Patient meets international consensus criteria for Poor Ovarian Response."
                    : "Baseline markers do not meet the minimum threshold for Bologna POR definition.")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
