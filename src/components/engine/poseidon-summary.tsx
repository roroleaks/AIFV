import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Activity,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PoseidonDataQuality, PoseidonResult } from "@/lib/engine/poseidon";

const qualityMeta: Record<
  PoseidonDataQuality,
  { icon: typeof CheckCircle2; label: string; tone: string; note: string }
> = {
  complete: {
    icon: CheckCircle2,
    label: "✓ Complete",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    note: "All variables required by the published POSEIDON criteria are recorded and internally consistent.",
  },
  missing: {
    icon: AlertTriangle,
    label: "⚠ Missing Data",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    note: "Some variables required by the published criteria have not been recorded yet.",
  },
  invalid: {
    icon: AlertOctagon,
    label: "❌ Invalid Data",
    tone: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    note: "Entries are conflicting or physiologically impossible — classification is withheld until they are corrected.",
  },
};

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function PoseidonSummary({
  result,
  patientName,
}: {
  result: PoseidonResult;
  patientName?: string;
}) {
  const q = qualityMeta[result.dataQuality];
  const QIcon = q.icon;
  const i = result.inputs;
  const c = result.context;

  return (
    <div className="grid gap-5">
      {/* Patient summary */}
      <section className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="size-4 text-primary" /> Patient summary — imported values
          </h3>
          <div className="flex items-center gap-2">
            {patientName && (
              <Badge variant="outline" className="rounded-full">
                {patientName}
              </Badge>
            )}
            <Badge variant="outline" className={cn("rounded-full", q.tone)}>
              {q.label}
            </Badge>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Cell label="Patient age" value={i.age === null ? "—" : `${i.age} y`} />
          <Cell label="BMI" value={c.bmi === null ? "—" : `${c.bmi} kg/m²`} />
          <Cell label="AMH" value={i.amh === null ? "—" : `${i.amh} ng/mL`} />
          <Cell label="Antral follicle count" value={i.afc === null ? "—" : String(i.afc)} />
          <Cell label="Basal FSH" value={c.fsh === null ? "—" : `${c.fsh} IU/L`} />
          <Cell label="Previous IVF / stimulation cycles" value={String(i.previousCycles)} />
          <Cell label="Oocyte retrievals performed" value={String(c.retrievalsPerformed)} />
          <Cell
            label="Retrieved oocytes (lowest / latest)"
            value={`${i.lowestRetrieved ?? "—"} / ${i.latestRetrieved ?? "—"}`}
          />
          <Cell label="Last cycle outcome" value={i.latestOutcome ?? "—"} />
          <Cell
            label="History of poor / suboptimal response"
            value={i.documentedPoorResponse ? "Documented" : "Not documented"}
          />
          <Cell
            label="History of hyper-response"
            value={c.hyperResponseHistory ? "Documented" : "Not documented"}
          />
          <Cell label="Cycle cancellations" value={String(c.cancelledCycles)} />
        </dl>

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Activity className="mt-0.5 size-3.5 shrink-0" />
          BMI, FSH, hyper-response and cancellation history are shown for clinical context only; the
          published POSEIDON criteria classify on age, AMH, AFC and previous ovarian response.
        </p>
      </section>

      {/* Data validation */}
      <section className={cn("animate-rise rounded-2xl border p-5", q.tone.replace(/text-[^\s]+/g, ""))}>
        <div className="flex items-center gap-2">
          <QIcon className={cn("size-4", q.tone.split(" ").filter((x) => x.startsWith("text-")).join(" "))} />
          <h3 className="text-sm font-semibold">Data validation — {q.label}</h3>
        </div>
        <p className="mt-2 text-sm text-foreground/80">{q.note}</p>

        {result.validation.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {result.validation.map((v, idx) => (
              <li key={idx} className="text-sm text-foreground/85">
                • {v}
              </li>
            ))}
          </ul>
        )}

        {result.missing.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Missing information
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {result.missing.map((m) => (
                <li
                  key={m}
                  className="rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-sm"
                >
                  Missing {m}
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="mt-3 print:hidden">
              <Link to="/assessment">
                Complete in patient assessment <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
