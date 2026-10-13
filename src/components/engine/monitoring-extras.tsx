import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  ClipboardCheck,
  GitCompare,
  LineChart as LineChartIcon,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DESCRIPTIVE_ONLY_NOTICE,
  type MonitoringResult,
  type VisitCompletenessLevel,
} from "@/lib/engine/monitoring";

function Card({
  icon: Icon,
  title,
  badge,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-4.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge && <div className="ml-auto shrink-0">{badge}</div>}
      </div>
      {children}
    </section>
  );
}

const levelTone: Record<VisitCompletenessLevel, string> = {
  COMPLETE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "PARTIALLY COMPLETE": "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  INCOMPLETE: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function VisitCompletenessCard({ result }: { result: MonitoringResult }) {
  return (
    <Card icon={ClipboardCheck} title="Monitoring completeness by visit">
      {result.visitCompleteness.length === 0 ? (
        <p className="text-sm text-muted-foreground">No visit recorded yet.</p>
      ) : (
        <ul className="grid gap-2">
          {result.visitCompleteness.map((v) => (
            <li key={v.visitId} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Day {v.day}</span>
                <Badge variant="outline" className={cn("rounded-full", levelTone[v.level])}>
                  {v.level}
                </Badge>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {v.checks.map((c) => (
                  <li
                    key={c.label}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      c.ok
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border/60 bg-background/60 text-muted-foreground",
                    )}
                  >
                    {c.ok ? "✓" : "○"} {c.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Optional fields never block data entry — completeness is informational.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------- validation */

export function MonitoringValidationCard({ result }: { result: MonitoringResult }) {
  return (
    <Card
      icon={AlertOctagon}
      title="Data validation"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.validation.length} flag(s)
        </Badge>
      }
    >
      {result.validation.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No invalid, conflicting or carried-forward value detected in the entered visits.
        </p>
      ) : (
        <ul className="grid gap-2">
          {result.validation.map((v) => (
            <li
              key={v.id}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {v.severity}
                </Badge>
                <span className="text-sm font-semibold">
                  {v.day === null ? "Cycle" : `Day ${v.day}`} · {v.field}
                </span>
              </div>
              <p className="mt-1 text-xs">{v.message}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Flagged values are kept, never discarded, and never replaced with an assumed value.
      </p>
    </Card>
  );
}

/* ------------------------------------------------- expected vs observed */

export function ExpectedVsObservedCard({ result }: { result: MonitoringResult }) {
  const e = result.expectedVsObserved;
  const rows: [string, string][] = [
    ["Expected response", e.expected],
    ["Source of expected value", e.expectedSource],
    ["Observed response", e.observed],
    ["Difference", e.difference],
    ["Evidence status", e.evidenceStatus],
  ];
  return (
    <Card icon={Scale} title="Expected vs observed response">
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-0.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        A difference between expected and observed values is descriptive. It is not interpreted as
        under-response, over-response, insufficient dose or excessive dose.
      </p>
    </Card>
  );
}

/* ------------------------------------------------- descriptive phenotype */

export function ResponseDescriptorsCard({ result }: { result: MonitoringResult }) {
  return (
    <Card icon={Sparkles} title="Observed response (descriptive)">
      {result.descriptors.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          At least two measurements of the same parameter are needed to describe a direction.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {result.descriptors.map((d) => (
            <li key={d.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-sm font-medium">{d.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{d.detail}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{DESCRIPTIVE_ONLY_NOTICE}</p>
    </Card>
  );
}

/* ------------------------------------------ individual follicle trajectories */

export function FollicleTrajectoryCard({ result }: { result: MonitoringResult }) {
  const trajectories = result.follicleTrajectories;

  if (trajectories.length === 0) {
    return (
      <Card icon={LineChartIcon} title="Individual follicle trajectories">
        <p className="text-sm text-muted-foreground">
          No physician-supplied follicle identifiers recorded. Aggregate measurements are used and
          follicle identity is not inferred.
        </p>
      </Card>
    );
  }

  const days = [...new Set(trajectories.flatMap((t) => t.points.map((p) => p.day)))].sort(
    (a, b) => a - b,
  );
  const data = days.map((day) => {
    const row: Record<string, number | null> = { day };
    for (const t of trajectories) {
      row[t.followId] = t.points.find((p) => p.day === day)?.size ?? null;
    }
    return row;
  });
  const palette = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#0ea5e9", "#f43f5e"];

  return (
    <Card icon={LineChartIcon} title="Individual follicle trajectories">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="day"
              tickFormatter={(d: number) => `D${d}`}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
            />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit=" mm" width={56} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--color-popover-foreground)",
              }}
              labelFormatter={(d) => `Stimulation day ${d}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {trajectories.map((t, i) => (
              <Line
                key={t.followId}
                type="monotone"
                dataKey={t.followId}
                name={`${t.followId} (${t.side})`}
                stroke={palette[i % palette.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {trajectories.map((t) => (
          <li key={t.followId} className="rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
            <span className="font-medium">
              {t.followId} ({t.side})
            </span>{" "}
            — baseline {t.baseline ?? "—"} mm · current {t.current ?? "—"} mm · {t.change}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --------------------------------------------------------- cycle comparison */

export function CycleComparisonCard({ result }: { result: MonitoringResult }) {
  const cycles = result.context.previousCycles;
  const latest = result.visits[result.visits.length - 1];

  return (
    <Card icon={GitCompare} title="Previous cycles vs current cycle">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {[
                "Cycle",
                "Protocol",
                "Gonadotropin",
                "Starting dose",
                "Maximum dose",
                "Duration",
                "Retrieved",
                "MII",
                "Embryology",
                "Pregnancy",
                "OHSS",
              ].map((h) => (
                <th key={h} className="py-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-b border-border/40">
                <td className="py-2 pr-3 font-medium">
                  {c.label}
                  <Badge variant="outline" className="ml-2 rounded-full">
                    Historical
                  </Badge>
                </td>
                <td className="py-2 pr-3">{c.protocol}</td>
                <td className="py-2 pr-3">{c.gonadotropin}</td>
                <td className="py-2 pr-3">{c.startingDose}</td>
                <td className="py-2 pr-3">{c.maximumDose}</td>
                <td className="py-2 pr-3">{c.duration}</td>
                <td className="py-2 pr-3">{c.retrieved}</td>
                <td className="py-2 pr-3">{c.mii}</td>
                <td className="py-2 pr-3">{c.embryology}</td>
                <td className="py-2 pr-3">{c.pregnancy}</td>
                <td className="py-2 pr-3">{c.ohss}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 pr-3 font-medium">
                Current cycle
                <Badge variant="outline" className="ml-2 rounded-full">
                  In progress
                </Badge>
              </td>
              <td className="py-2 pr-3">{result.context.currentProtocol}</td>
              <td className="py-2 pr-3">{latest?.medication || result.context.currentGonadotropin}</td>
              <td className="py-2 pr-3">
                {result.doseTimeline[0]?.dose ?? "Not recorded"}
              </td>
              <td className="py-2 pr-3">
                {result.visits.reduce<number | null>(
                  (m, v) => (v.dailyDose === null ? m : m === null ? v.dailyDose : Math.max(m, v.dailyDose)),
                  null,
                ) ?? "Not recorded"}
              </td>
              <td className="py-2 pr-3">{latest ? `${latest.day} day(s) recorded` : "—"}</td>
              <td className="py-2 pr-3" colSpan={5}>
                Outcome not available during stimulation.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Previous cycles are immutable historical records entered in the assessment. No causal link
        between a protocol, dose and outcome is stated or implied.
      </p>
      <Button asChild size="sm" variant="ghost" className="mt-2 rounded-xl print:hidden">
        <Link to="/assessment">Return to assessment</Link>
      </Button>
    </Card>
  );
}
