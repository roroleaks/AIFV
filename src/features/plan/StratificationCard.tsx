/**
 * StratificationCard Component (§2.2, §3)
 *
 * Displays ovarian reserve stratification: POSEIDON classification,
 * Bologna criteria for poor ovarian response, phenotype reserve category,
 * and predicted ovarian response.
 *
 * STRICT REQUIREMENT:
 *  - Classification, not recommendation.
 *  - READ-ONLY: No override buttons permitted.
 */

import { Stethoscope, Lock } from "lucide-react";
import type { StratificationResult } from "@/services/clinical/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RationalePopover } from "@/features/encounter/RationalePopover";

interface StratificationCardProps {
  stratification: StratificationResult;
}

export function StratificationCard({ stratification }: StratificationCardProps) {
  const { poseidon, bologna, phenotype, ovarianResponse } = stratification;

  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
            <Stethoscope className="size-4 text-primary" />
            <span>1. Ovarian Reserve Stratification</span>
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] gap-1 font-mono text-muted-foreground border-border/70"
            title="Classification algorithms are strictly deterministic and read-only"
          >
            <Lock className="size-3" />
            <span>Read-Only Standard</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* Row 1: POSEIDON Classification */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              POSEIDON Classification
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`font-mono text-xs font-bold ${
                  poseidon.groupLabel
                    ? "border-primary/50 text-primary bg-primary/5"
                    : "border-border text-muted-foreground"
                }`}
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
          <p className="text-[11px] text-muted-foreground">
            {poseidon.headline ||
              (poseidon.groupLabel
                ? `Patient classifies into POSEIDON Group ${poseidon.groupLabel} based on age and reserve markers.`
                : "Baseline ovarian reserve markers place patient in non-low-prognosis cohort.")}
          </p>
        </div>

        {/* Row 2: Bologna Criteria */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Bologna Criteria (POR)
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={bologna.status === "positive" ? "destructive" : "secondary"}
                className="text-[10px] font-semibold"
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
          <p className="text-[11px] text-muted-foreground">
            {bologna.headline ||
              (bologna.status === "positive"
                ? "Patient meets international consensus criteria for Poor Ovarian Response."
                : "Baseline markers do not meet the minimum threshold for Bologna POR definition.")}
          </p>
        </div>

        {/* Row 3: Ovarian Reserve Phenotype & Expected Response */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Reserve Phenotype
            </span>
            <span className="text-foreground font-bold capitalize text-sm block">
              {phenotype.reserve?.category || "Normal"}
            </span>
            <span className="text-muted-foreground text-[10px] block">
              AMH: {phenotype.reserve?.amh ?? "—"} ng/mL · AFC: {phenotype.reserve?.afc ?? "—"}
            </span>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Predicted Response
            </span>
            <span className="text-primary font-bold uppercase text-sm block">
              {ovarianResponse.category || "Normal"}
            </span>
            <span className="text-muted-foreground text-[10px] block">
              Expected yield:{" "}
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
      </CardContent>
    </Card>
  );
}
