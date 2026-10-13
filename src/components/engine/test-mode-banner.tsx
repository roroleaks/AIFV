import { Link } from "@tanstack/react-router";
import { FlaskConical, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TEST_MODE_DISCLAIMER,
  TEST_OUTPUT_BADGE,
  engineActivationById,
  useEngineActivation,
} from "@/lib/engine/activation-registry";

/** Global, unmissable banner shown on every page while test mode is active. */
export function TestModeBanner({ className }: { className?: string }) {
  const { testMode, state } = useEngineActivation();
  if (!testMode) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border-2 border-orange-500/60 bg-orange-500/10 px-4 py-3 text-xs leading-relaxed text-orange-700 dark:text-orange-300",
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]">
        <TriangleAlert className="size-4" /> Full engine test mode active
        <Badge variant="outline" className="rounded-lg border-orange-500/50 text-[10px]">
          {TEST_OUTPUT_BADGE}
        </Badge>
      </p>
      <p className="mt-1.5">{TEST_MODE_DISCLAIMER}</p>
      <p className="mt-1 text-[11px] opacity-80">
        Enabled {state.acknowledgedAt ? new Date(state.acknowledgedAt).toLocaleString() : "—"} by{" "}
        {state.acknowledgedBy ?? "—"}.{" "}
        <Link to="/system-test" className="underline underline-offset-2">
          Return to production mode
        </Link>
        .
      </p>
    </div>
  );
}

/** Inline chip attached to any value produced while test mode is active. */
export function TestOutputBadge({ className }: { className?: string }) {
  const { testMode } = useEngineActivation();
  if (!testMode) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg border-orange-500/50 bg-orange-500/10 text-[10px] uppercase tracking-wide text-orange-700 dark:text-orange-300",
        className,
      )}
      title={TEST_MODE_DISCLAIMER}
    >
      <FlaskConical className="mr-1 size-3" /> Test output
    </Badge>
  );
}

/** Provenance card: where an engine's executable logic comes from. */
export function EngineProvenance({
  engineId,
  className,
}: {
  engineId: string;
  className?: string;
}) {
  const record = engineActivationById(engineId);
  if (!record) return null;
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <p className="font-semibold uppercase tracking-[0.14em] text-foreground/75">Logic source</p>
      <p className="mt-1">{record.logicSource}</p>
      {record.missingForProduction.length > 0 ? (
        <p className="mt-1">
          Missing for production activation: {record.missingForProduction.join("; ")}.
        </p>
      ) : null}
    </div>
  );
}
