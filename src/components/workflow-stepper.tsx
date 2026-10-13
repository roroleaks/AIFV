import { Link } from "@tanstack/react-router";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STAGES } from "@/lib/clinical/workflow-stages";

interface WorkflowStepperProps {
  currentStage?: number;
  className?: string;
  compact?: boolean;
}

export function WorkflowStepper({
  currentStage,
  className,
  compact = false,
}: WorkflowStepperProps) {
  return (
    <nav
      aria-label="8-Stage Clinical Workflow Stepper"
      className={cn(
        "rounded-2xl border border-border/70 bg-card/60 p-2.5 backdrop-blur-sm shadow-soft print:hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-2 px-2 border-b border-border/50 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            8
          </span>
          <span className="font-semibold text-foreground tracking-tight">
            Clinical Decision Workflow (Stages 1 – 8)
          </span>
        </div>
        {currentStage && (
          <span className="text-[11px] text-muted-foreground">
            Current: <span className="font-semibold text-primary">Stage {currentStage} of 8</span>
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
        {WORKFLOW_STAGES.map((stage, idx) => {
          const isActive = currentStage === stage.stageNumber;
          const isPassed = currentStage ? stage.stageNumber < currentStage : false;
          const Icon = stage.icon;

          return (
            <div key={stage.stageNumber} className="flex items-center shrink-0">
              <Link
                to={stage.to}
                title={`Stage ${stage.stageNumber}: ${stage.label} — ${stage.description}`}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs ring-1 ring-primary/40"
                    : isPassed
                      ? "bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  compact && "px-2 py-1",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-transform group-hover:scale-105",
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : isPassed
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {isPassed ? <CheckCircle2 className="size-3.5" /> : stage.stageNumber}
                </span>

                <span className="truncate whitespace-nowrap">
                  {compact ? stage.shortLabel : `${stage.stageNumber}. ${stage.shortLabel}`}
                </span>
              </Link>

              {idx < WORKFLOW_STAGES.length - 1 && (
                <ChevronRight className="size-3 shrink-0 mx-0.5 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
