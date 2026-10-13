/**
 * Verbatim guideline statements applicable to one engine module.
 *
 * Nothing here is generated, paraphrased or ranked by the application: each
 * row is the statement text exactly as printed in the source guideline, with
 * its printed recommendation strength and evidence-quality symbol. The panel
 * is explanatory context for the physician — it is NOT an automated
 * prescription and never produces a patient-specific instruction or dose.
 */

import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/section-card";
import {
  ESHRE_OS_2025,
  ESHRE_OS_2025_CITATION,
  guidelineRecommendationsFor,
  sortByStrength,
  type GuidelineModuleId,
  type PopulationTag,
  type RecommendationStrength,
} from "@/lib/evidence/eshre-os-2025";

const strengthTone: Record<RecommendationStrength, string> = {
  Strong: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  Conditional: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  GPP: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  "Research only": "border-muted-foreground/40 text-muted-foreground",
  Conclusion: "border-muted-foreground/40 text-muted-foreground",
};

export interface GuidelineRecommendationsPanelProps {
  module: GuidelineModuleId;
  populations: PopulationTag[];
  title?: string;
  description?: string;
}

export function GuidelineRecommendationsPanel({
  module,
  populations,
  title = "Applicable guideline statements",
  description,
}: GuidelineRecommendationsPanelProps) {
  const items = sortByStrength(guidelineRecommendationsFor(module, { populations }));

  return (
    <SectionCard
      title={title}
      description={
        description ??
        "Statements transcribed verbatim from the source guideline and filtered to the populations that apply to this patient. Physician decision support — not validated for automated clinical prescription."
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {populations.map((p) => (
            <Badge key={p} variant="secondary" className="text-[11px] capitalize">
              {p.replace(/-/g, " ")}
            </Badge>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transcribed statement in the Evidence Library applies to this module for the current
            patient population. Nothing is inferred in its place.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((r, i) => (
              <li
                key={`${module}-${r.number ?? "conclusion"}-${i}`}
                className="rounded-lg border border-border/70 bg-muted/30 p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[11px]">
                    {r.number === null ? "Conclusion" : `Rec. ${r.number}`}
                  </Badge>
                  <Badge variant="outline" className={`text-[11px] ${strengthTone[r.strength]}`}>
                    {r.strength}
                  </Badge>
                  {r.quality ? (
                    <Badge variant="outline" className="text-[11px]">
                      {r.quality}
                    </Badge>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">{r.section}</span>
                </div>
                <p className="text-sm leading-relaxed">{r.text}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Source: {ESHRE_OS_2025.society} {ESHRE_OS_2025.year} — {ESHRE_OS_2025.title} (
          {ESHRE_OS_2025.locator}). {ESHRE_OS_2025_CITATION}
        </p>
      </div>
    </SectionCard>
  );
}
