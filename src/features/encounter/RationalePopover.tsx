/**
 * Rationale Popover Component (§4 Phase 2, §2.5 Phase 3)
 *
 * Surfaces the evidence citation, engine trace, clinical rationale,
 * and optional extended details (alternatives, nomogram trace)
 * when a clinician clicks "view rationale" or "Evidence & Rationale".
 *
 * Enforces:
 *  - Teal accent (--accent-evidence) reserved exclusively for citation and evidence references (§11)
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
            "ms-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-accent-evidence underline opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
          }
        >
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-84 p-3.5 text-xs shadow-md bg-bg-surface border-border-subtle"
      >
        <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-accent-evidence" />
            <span className="font-bold text-text-primary">{title}</span>
          </div>
          <Badge
            variant="outline"
            className="text-[9px] font-mono uppercase h-4 px-1 border-border-default text-text-muted"
          >
            {engine}
          </Badge>
        </div>

        <div className="space-y-2 text-text-secondary text-[11px] leading-relaxed">
          {rationale && <p className="font-medium text-text-primary">{rationale}</p>}

          {guidelineRule && (
            <div className="rounded bg-bg-surface-muted p-2 border border-border-subtle">
              <span className="font-semibold text-text-primary block text-[10px] uppercase">
                Guideline Standard
              </span>
              <span>{guidelineRule}</span>
            </div>
          )}

          {citationText && (
            <div className="flex items-start gap-1.5 text-[10px] text-text-muted pt-1">
              <BookOpen className="size-3 text-accent-evidence shrink-0 mt-0.5" />
              <span>{citationText}</span>
            </div>
          )}

          {details && (
            <div className="pt-2 border-t border-border-subtle text-[11px] text-text-primary space-y-1.5">
              {details}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
