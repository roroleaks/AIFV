import { AlertTriangle, CircleAlert, CircleCheck, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClinicalAlert } from "@/lib/assessment/derived";

export function ClinicalAlertsPanel({
  alerts,
  onGoToStep,
  className,
}: {
  alerts: ClinicalAlert[];
  onGoToStep: (stepId: string) => void;
  className?: string;
}) {
  const missing = alerts.filter((a) => a.severity === "missing");
  const documented = alerts.filter((a) => a.severity === "documented");

  const Section = ({
    title,
    items,
    tone,
  }: {
    title: string;
    items: ClinicalAlert[];
    tone: "warning" | "primary";
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {tone === "warning" ? (
          <AlertTriangle className="size-3.5 text-warning" />
        ) : (
          <Info className="size-3.5 text-primary" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <Badge variant="secondary" className="rounded-lg text-[10px]">
          {items.length}
        </Badge>
      </div>
      <ul className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onGoToStep(a.stepId)}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left transition-colors hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tone === "warning"
                  ? "border-warning/25 bg-warning-soft/60 hover:bg-warning-soft"
                  : "border-primary/25 bg-primary-soft/50 hover:bg-primary-soft",
              )}
            >
              <p className="text-xs font-semibold">{a.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 shadow-soft",
        className,
      )}
      aria-label="Clinical alerts"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4 text-warning" />
          <h3 className="text-sm font-semibold">Clinical Alerts</h3>
        </div>
        <Badge variant="outline" className="rounded-lg text-[10px]">
          {alerts.length} signal{alerts.length === 1 ? "" : "s"}
        </Badge>
      </header>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald/25 bg-emerald-soft/60 px-3 py-3">
          <CircleCheck className="size-4 text-emerald" />
          <p className="text-xs font-medium text-emerald">
            No missing key data detected in the current record.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {missing.length > 0 && (
            <Section title="Missing information" items={missing} tone="warning" />
          )}
          {documented.length > 0 && (
            <Section title="Documented history" items={documented} tone="primary" />
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Alerts describe recorded or missing data only. No treatment guidance is provided.
      </p>
    </section>
  );
}

export function ClinicalAlertsTrigger({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" size="sm" className="rounded-xl" onClick={onClick}>
      <CircleAlert className="size-4 text-warning" />
      Alerts
      <Badge variant="secondary" className="ml-1 rounded-md text-[10px]">
        {count}
      </Badge>
    </Button>
  );
}
