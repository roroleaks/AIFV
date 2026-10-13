import { useState } from "react";
import { AlertTriangle, ChevronDown, History, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cycleFieldGroups, cycleGroupFields } from "@/lib/assessment/schema";
import { validateCycle } from "@/lib/engine/cycle-intelligence";
import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { AssessmentField } from "./assessment-field";

export function CyclesStep({
  cycles,
  onAdd,
  onRemove,
  onChange,
}: {
  cycles: CycleRecord[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, key: string, value: FieldValue) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(cycles[0]?.id ?? null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
            <History className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Number of Previous Cycles</p>
            <p className="text-xs text-muted-foreground">
              {cycles.length === 0
                ? "No cycles recorded yet"
                : `${cycles.length} cycle${cycles.length > 1 ? "s" : ""} recorded`}
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="rounded-xl"
          onClick={() => {
            onAdd();
            setOpenId(null);
          }}
        >
          <Plus className="size-4" /> Add cycle
        </Button>
      </div>

      {cycles.length === 0 && (
        <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <div>
            <p className="text-sm font-medium">No previous IVF / ICSI cycles added</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a card for each prior cycle. Unlimited entries supported.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {cycles.map((cycle, index) => {
          const open = openId === cycle.id;
          const issues = validateCycle(cycle, index);
          return (
            <div
              key={cycle.id}
              className="animate-rise overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : cycle.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-soft text-sm font-bold text-emerald">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      Cycle {index + 1}
                      {cycle["cycleDate"] ? ` — ${String(cycle["cycleDate"])}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[cycle["clinic"], cycle["protocol"]].filter(Boolean).join(" · ") ||
                        "Tap to expand and record cycle details"}
                    </span>
                  </span>
                  {issues.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-auto hidden shrink-0 gap-1 rounded-lg border-amber-500/40 bg-amber-500/10 text-amber-600 sm:inline-flex dark:text-amber-400"
                    >
                      <AlertTriangle className="size-3" />
                      {issues.length}
                    </Badge>
                  )}
                  {cycle["protocol"] && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "hidden shrink-0 rounded-lg sm:inline-flex",
                        issues.length === 0 && "ml-auto",
                      )}
                    >
                      {String(cycle["protocol"])}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "ml-2 size-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove cycle ${index + 1}`}
                  className="shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(cycle.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {open && (
                <div className="animate-rise space-y-6 border-t border-border/60 p-5">
                  {issues.length > 0 && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3.5" /> Data validation · {issues.length}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {issues.map((issue) => (
                          <li key={issue.id} className="text-xs text-muted-foreground">
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[0.7rem] italic text-muted-foreground">
                        Entered values are never discarded. Review and correct them if needed.
                      </p>
                    </div>
                  )}

                  {cycleFieldGroups.map((group) => {
                    const fields = cycleGroupFields(group).filter((f) =>
                      f.showIf ? f.showIf(cycle as Record<string, unknown>) : true,
                    );
                    if (fields.length === 0) return null;
                    return (
                      <section key={group.id} className="space-y-3">
                        <div className="flex items-baseline gap-2 border-b border-border/50 pb-1.5">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                            {group.title}
                          </h4>
                          {group.description && (
                            <p className="truncate text-[0.7rem] text-muted-foreground">
                              {group.description}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {fields.map((field) => (
                            <AssessmentField
                              key={field.key}
                              field={field}
                              values={cycle}
                              value={cycle[field.key]}
                              idPrefix={`cycle-${cycle.id}`}
                              onChange={(v) => onChange(cycle.id, field.key, v)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
