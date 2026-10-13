import { CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { buildTimeline, computeTotals, formatDuration } from "@/lib/assessment/derived";
import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";

const toneMap: Record<string, string> = {
  primary: "bg-primary-soft text-primary border-primary/25",
  emerald: "bg-emerald-soft text-emerald border-emerald/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  purple: "bg-purple-soft text-purple border-purple/25",
  muted: "bg-muted text-muted-foreground border-border",
};

const formatDate = (iso: string | null) => {
  if (!iso) return "Date not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function TimelineStep({
  values,
  cycles,
}: {
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
}) {
  const events = buildTimeline(values, cycles);
  const totals = computeTotals(values, cycles);

  const stats = [
    { label: "Stimulation cycles", value: totals.totalCycles },
    { label: "Transfers", value: totals.transfers },
    { label: "Pregnancies", value: totals.pregnancies },
    { label: "Live births", value: totals.liveBirths },
    { label: "Miscarriages", value: totals.miscarriages },
    { label: "Infertility duration", value: formatDuration(totals.infertilityMonths) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft"
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <div>
            <CalendarClock className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Timeline is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Events appear automatically as reproductive history, procedures and cycles are
              entered.
            </p>
          </div>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-border/70 pl-6">
          {events.map((event) => {
            const Icon = event.icon;
            return (
              <li key={event.id} className="animate-rise relative">
                <span
                  className={cn(
                    "absolute -left-[35px] grid size-[22px] place-items-center rounded-full border bg-background",
                    toneMap[event.tone],
                  )}
                >
                  <Icon className="size-3" />
                </span>
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{event.title}</p>
                    <span
                      className={cn(
                        "rounded-lg border px-2 py-0.5 text-[11px] font-medium",
                        toneMap[event.tone],
                      )}
                    >
                      {event.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.date)}</p>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                    {event.details.map((d) => (
                      <div key={d.label} className="text-xs">
                        <dt className="inline text-muted-foreground">{d.label}: </dt>
                        <dd className="inline font-medium">{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
