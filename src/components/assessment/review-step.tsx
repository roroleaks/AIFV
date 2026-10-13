import { AlertTriangle, CheckCircle2, CircleDot, Pencil, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { steps, type FieldDef, type StepDef } from "@/lib/assessment/schema";
import type { AssessmentDraft, FieldValue } from "@/lib/assessment/use-assessment";

function displayValue(field: FieldDef, values: Record<string, unknown>, value: FieldValue) {
  if (field.type === "derived") return field.compute?.(values) || "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (value === undefined || value === null || String(value).trim() === "") return "—";
  return field.unit ? `${value} ${field.unit}` : String(value);
}

export function ReviewStep({
  draft,
  completion,
  stepProgress,
  missingByStep,
  onEditStep,
}: {
  draft: AssessmentDraft;
  completion: number;
  stepProgress: { id: string; total: number; filled: number; percent: number }[];
  missingByStep: { step: StepDef; missing: FieldDef[] }[];
  onEditStep: (index: number) => void;
}) {
  const dataSteps = steps.filter((s) => !s.custom);
  const missingTotal = missingByStep.reduce((a, s) => a + s.missing.length, 0);

  return (
    <div className="space-y-5">
      <div className="animate-rise overflow-hidden rounded-2xl border border-emerald/30 bg-emerald-soft/60 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-emerald text-white">
              <ShieldCheck className="size-7" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Assessment Complete</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                All collected information is stored and ready for the future Clinical Decision Engine.
                No calculations, scores or recommendations are produced in this release.
              </p>
            </div>
          </div>
          <div className="min-w-40">
            <p className="text-3xl font-bold text-emerald">{completion}%</p>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data completeness
            </p>
            <Progress value={completion} className="mt-2 h-1.5" />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        <h3 className="text-base font-semibold">Assessment timeline</h3>
        <ol className="mt-4 space-y-0">
          {dataSteps.map((step) => {
            const prog = stepProgress.find((p) => p.id === step.id);
            const pct = Math.round((prog?.percent ?? 0) * 100);
            const Icon = step.icon;
            return (
              <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      pct === 100
                        ? "bg-emerald-soft text-emerald"
                        : pct > 0
                          ? "bg-primary-soft text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-1 w-px flex-1 bg-border last:hidden" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "rounded-lg text-[11px]",
                        pct === 100 && "bg-emerald-soft text-emerald",
                      )}
                    >
                      {pct === 100 ? <CheckCircle2 className="mr-1 size-3" /> : <CircleDot className="mr-1 size-3" />}
                      {prog?.filled ?? 0}/{prog?.total ?? 0} fields
                    </Badge>
                  </div>
                  <Progress value={pct} className="mt-2 h-1" />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Missing data alerts */}
      {missingTotal > 0 && (
        <div className="animate-rise rounded-2xl border border-warning/40 bg-warning-soft/70 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                {missingTotal} field{missingTotal > 1 ? "s" : ""} still missing
              </h3>
              <ul className="mt-3 space-y-2">
                {missingByStep.map(({ step, missing }) => (
                  <li key={step.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{step.title}:</span>
                    <span className="text-muted-foreground">
                      {missing.slice(0, 6).map((m) => m.label).join(", ")}
                      {missing.length > 6 ? ` +${missing.length - 6} more` : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2 text-xs"
                      onClick={() => onEditStep(steps.findIndex((s) => s.id === step.id))}
                    >
                      <Pencil className="size-3" /> Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Grouped summary cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        {dataSteps.map((step) => {
          const Icon = step.icon;
          return (
            <section
              key={step.id}
              className="animate-rise rounded-2xl border border-border/70 bg-card shadow-soft"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="truncate text-sm font-semibold">{step.title}</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-lg"
                  onClick={() => onEditStep(steps.findIndex((s) => s.id === step.id))}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </div>
              <div className="space-y-4 p-5">
                {step.groups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {group.title}
                    </p>
                    <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      {group.fields.map((field) => (
                        <div key={field.key} className="min-w-0 border-b border-border/50 py-1.5">
                          <dt className="text-[11px] text-muted-foreground">{field.label}</dt>
                          <dd className="truncate text-sm font-medium">
                            {displayValue(field, draft.values, draft.values[field.key])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="animate-rise rounded-2xl border border-border/70 bg-card shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <h3 className="text-sm font-semibold">Previous IVF / ICSI Cycles</h3>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => onEditStep(steps.findIndex((s) => s.id === "cycles"))}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          </div>
          <div className="p-5">
            {draft.cycles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous cycles recorded.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {draft.cycles.map((cycle, i) => (
                  <div key={cycle.id} className="rounded-xl border border-border/70 bg-background/60 p-4">
                    <p className="text-sm font-semibold">
                      Cycle {i + 1}
                      {cycle["cycleDate"] ? ` — ${String(cycle["cycleDate"])}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[cycle["clinic"], cycle["protocol"]].filter(Boolean).join(" · ") || "Details pending"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Retrieved: {cycle["retrieved"] ?? "—"} · MII: {cycle["mii"] ?? "—"} · Blastocysts:{" "}
                      {cycle["blastocysts"] ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
        Ready for Clinical Decision. No recommendations, protocols, medications, scores or success
        estimates are generated at this stage.
      </p>
    </div>
  );
}
