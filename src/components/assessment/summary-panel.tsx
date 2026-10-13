import { Activity, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ageFromDob } from "@/lib/assessment/schema";
import { computeTotals, formatDuration } from "@/lib/assessment/derived";
import { interpretField, toneClasses } from "@/lib/assessment/interpretations";
import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate font-semibold">{value || "—"}</span>
  </div>
);

export function SummaryPanel({
  values,
  cycles,
  completion,
  className,
}: {
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
  completion: number;
  className?: string;
}) {
  const totals = computeTotals(values, cycles);
  const age = ageFromDob(values["dob"]);
  const str = (k: string) => (values[k] === undefined ? "" : String(values[k]));

  const chips = (["amh", "fsh", "bmi", "afcTotal"] as const)
    .map((key) => ({ key, chip: interpretField(key, values[key], values) }))
    .filter((c) => c.chip);

  return (
    <aside
      className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-soft", className)}
      aria-label="Live patient summary"
    >
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Live Summary</h3>
        <Badge variant="secondary" className="ml-auto rounded-lg text-[10px]">
          {completion}%
        </Badge>
      </header>
      <Progress value={completion} className="h-1.5" />

      <div className="mt-4 space-y-1.5">
        <Row label="Patient" value={str("fullName")} />
        <Row label="Age" value={age} />
        <Row label="Partner age" value={str("partnerAge")} />
        <Row label="Infertility" value={formatDuration(totals.infertilityMonths)} />
        <Row label="Type" value={str("infertilityType")} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Cycles", value: totals.totalCycles },
          { label: "Transfers", value: totals.transfers },
          { label: "Pregnancies", value: totals.pregnancies },
          { label: "Live births", value: totals.liveBirths },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-sm font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {chips.map(({ key, chip }) => (
            <span
              key={key}
              className={cn(
                "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                toneClasses[chip!.tone],
              )}
            >
              {chip!.label}
            </span>
          ))}
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Activity className="mt-0.5 size-3 shrink-0" />
        Summary reflects entered data only. No clinical calculations are performed.
      </p>
    </aside>
  );
}
