/**
 * Rationale Popover Component (§4 Phase 2, §2.5 Phase 3)
 *
 * Surfaces the evidence citation, engine trace, clinical rationale,
 * and optional extended details (alternatives, nomogram trace)
 * when a clinician clicks "view rationale" or "Evidence & Rationale".
 */

import type { ReactNode } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import type { InlineEngineChip } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface RationalePopoverProps {
  chip?: InlineEngineChip | undefined;
  engine?: string | undefined;
  title?: string | undefined;
  rationale?: string | undefined;
  guidelineRule?: string | undefined;
  citationText?: string | undefined;
  details?: ReactNode | undefined;
  triggerLabel?: string | undefined;
  className?: string | undefined;
}

export function RationalePopover({
  chip,
  engine = chip?.engine || "Clinical",
  title = chip ? `${chip.engine} Engine Rationale` : "Evidence-Based Rationale",
  rationale = chip?.rationale || "",
  guidelineRule = chip?.guidelineRule || undefined,
  citationText = chip?.citationText || undefined,
  details,
  triggerLabel = "view rationale",
  className,
}: RationalePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            className ||
            "ms-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold underline opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
          }
        >
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-84 p-3.5 text-xs shadow-md">
        <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="font-bold text-foreground">{title}</span>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono uppercase h-4 px-1">
            {engine}
          </Badge>
        </div>

        <div className="space-y-2 text-muted-foreground text-[11px] leading-relaxed">
          {rationale && <p className="font-medium text-foreground">{rationale}</p>}

          {guidelineRule && (
            <div className="rounded bg-muted/40 p-2 border border-border/50">
              <span className="font-semibold text-foreground block text-[10px] uppercase">
                Guideline Standard
              </span>
              <span>{guidelineRule}</span>
            </div>
          )}

          {citationText && (
            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80 pt-1">
              <BookOpen className="size-3 text-primary shrink-0 mt-0.5" />
              <span>{citationText}</span>
            </div>
          )}

          {details && (
            <div className="pt-2 border-t border-border/50 text-[11px] text-foreground space-y-1.5">
              {details}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
