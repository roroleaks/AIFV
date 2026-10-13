import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileDown,
  FlaskConical,
  Gauge,
  Info,
  LineChart as LineChartIcon,
  ListChecks,
  Lock,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Timer,
  UserRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { findEvidence } from "@/lib/evidence/library";
import {
  CYCLE_BAND_DISCLAIMER,
  FREEZE_ALL_REQUIRED_EVIDENCE,
  OHSS_REQUIRED_EVIDENCE,
  TRIGGER_REQUIRED_EVIDENCE,
  cycleCompletionReportText,
  cycleConsumerInterfaces,
  pendingStatusLabel,
  safetyStatusLabel,
  type AssessmentCard as AssessmentCardData,
  type CycleAlert,
  type CycleCompletionResult,
  type OhssFactor,
} from "@/lib/engine/cycle-completion";

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

function Expandable({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = icon;
  return (
    <section className="animate-rise rounded-2xl border border-border/70 bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-2xl px-5 py-4 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-4.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="ml-auto flex items-center gap-2">
          {badge}
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </div>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

/* --------------------------------------------------------------- context */

export function CycleContextCard({ result }: { result: CycleCompletionResult }) {
  return (
    <Expandable title="Imported cycle data" icon={UserRound}>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {result.context.map((i) => (
          <li key={i.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {i.label}
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                !i.available && "text-amber-600 dark:text-amber-400",
              )}
            >
              {i.value}
            </p>
            {i.detail && <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>}
          </li>
        ))}
      </ul>
    </Expandable>
  );
}

/* ------------------------------------------------------- safety dashboard */

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" | undefined }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-semibold", tone === "warn" && "text-amber-600 dark:text-amber-400")}>
        {value}
      </p>
    </div>
  );
}

export function SafetyDashboard({ result }: { result: CycleCompletionResult }) {
  const p = result.progress;
  return (
    <Card
      icon={Gauge}
      title="Safety dashboard"
      badge={
        <Badge variant="outline" className="rounded-full">
          {safetyStatusLabel[result.safetyStatus]}
        </Badge>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Cycle progress"
          value={p.currentDay === null ? "No visit" : `Day ${p.currentDay}`}
        />
        <Metric label="Monitoring completeness" value={`${p.monitoringCompleteness}%`} />
        <Metric label="Current response" value={p.currentResponse} />
        <Metric
          label="Outstanding items"
          value={String(result.missingInformation.length)}
          tone={result.missingInformation.length ? "warn" : undefined}
        />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, p.monitoringCompleteness))}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{result.safetyStatusDetail}</p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Cycle Completion, OHSS Risk & Freeze-All Engine Active
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{result.pendingMessage}</p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------- assessment cards */

const statusTone: Record<string, string> = {
  "pending-evidence": "border-amber-500/40 bg-amber-500/10",
  "data-incomplete": "border-border/60 bg-muted/40",
  "data-ready": "border-primary/40 bg-primary-soft/60",
};

export function AssessmentPanel({
  data,
  icon,
}: {
  data: AssessmentCardData;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Expandable
      title={data.title}
      icon={icon}
      badge={
        <Badge variant="outline" className="rounded-full">
          {pendingStatusLabel[data.status]}
        </Badge>
      }
    >
      <div className={cn("rounded-xl border px-3.5 py-3", statusTone[data.status])}>
        <p className="text-sm font-semibold">{data.headline}</p>
        <p className="mt-1 text-xs text-muted-foreground">{data.explanation}</p>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Supporting variables
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {data.supporting.map((v) => (
          <li
            key={v.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2"
          >
            <span className="text-xs text-muted-foreground">{v.label}</span>
            <span
              className={cn(
                "text-sm font-medium",
                !v.present && "text-amber-600 dark:text-amber-400",
              )}
            >
              {v.value}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Missing variables
      </p>
      <p className="mt-1 text-sm">
        {data.missing.length ? data.missing.join(", ") : "None — every listed variable is recorded."}
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-border px-3.5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Future evidence requirements
        </p>
        <ul className="mt-1.5 grid gap-1 text-xs text-muted-foreground">
          {data.requiredEvidence.map((x) => (
            <li key={x}>• {x}</li>
          ))}
        </ul>
      </div>
    </Expandable>
  );
}

/* ------------------------------------------------------------ OHSS panel */

function FactorList({ factors }: { factors: OhssFactor[] }) {
  return (
    <ul className="grid gap-2">
      {factors.map((f) => (
        <li
          key={f.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2"
        >
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <span
            className={cn("text-sm font-medium", !f.present && "text-muted-foreground")}
          >
            {f.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OhssPanelCard({ result }: { result: CycleCompletionResult }) {
  const o = result.ohss;
  return (
    <Expandable
      title="OHSS panel"
      icon={ShieldAlert}
      badge={
        <Badge variant="outline" className="rounded-full">
          {o.status}
        </Badge>
      }
    >
      <div
        className={cn(
          "rounded-xl border px-3.5 py-3",
          o.level === "critical"
            ? "border-rose-500/40 bg-rose-500/10"
            : o.level === "high"
              ? "border-orange-500/40 bg-orange-500/10"
              : o.level === "moderate"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-emerald-500/40 bg-emerald-500/10",
        )}
      >
        <p
          className={cn(
            "text-sm font-semibold",
            o.level === "critical"
              ? "text-rose-700 dark:text-rose-300"
              : o.level === "high"
                ? "text-orange-700 dark:text-orange-300"
                : o.level === "moderate"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300",
          )}
        >
          {o.status}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{o.statusDetail}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Historical risk factors
          </p>
          <FactorList factors={o.historical} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Current monitoring
          </p>
          <FactorList factors={o.current} />
        </div>
      </div>

      <p className="mt-4 text-sm">
        <span className="font-medium">Documented markers: </span>
        {o.documentedMarkers.length ? o.documentedMarkers.join(", ") : "None documented."}
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-border px-3.5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Required to activate OHSS risk
        </p>
        <ul className="mt-1.5 grid gap-1 text-xs text-muted-foreground">
          {OHSS_REQUIRED_EVIDENCE.map((x) => (
            <li key={x}>• {x}</li>
          ))}
        </ul>
      </div>
    </Expandable>
  );
}

/* --------------------------------------------------------------- alerts */

const alertTone: Record<CycleAlert["kind"], string> = {
  "rapid-estradiol-rise": "border-amber-500/40 bg-amber-500/10",
  "large-follicle-cohort": "border-amber-500/40 bg-amber-500/10",
  "incomplete-monitoring": "border-border/60 bg-muted/40",
  "missing-hormones": "border-border/60 bg-muted/40",
  "incomplete-ultrasound": "border-border/60 bg-muted/40",
};

export function CycleAlertsCard({ result }: { result: CycleCompletionResult }) {
  return (
    <Card
      icon={AlertTriangle}
      title="Informational alerts"
      badge={
        <Badge variant="outline" className="rounded-full">
          Informational only
        </Badge>
      }
    >
      {result.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No informational observation generated from the entered data.
        </p>
      ) : (
        <ul className="grid gap-2">
          {result.alerts.map((a) => (
            <li key={a.id} className={cn("rounded-xl border px-3.5 py-2.5", alertTone[a.kind])}>
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="mt-0.5 text-xs">{a.observation}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.basis}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {CYCLE_BAND_DISCLAIMER} No alert is interpreted clinically until the evidence tables are
        activated.
      </p>
    </Card>
  );
}

/* --------------------------------------------------------------- charts */

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
} as const;

const C1 = "var(--color-chart-1, #2563eb)";
const C2 = "var(--color-chart-2, #10b981)";
const C3 = "var(--color-chart-3, #8b5cf6)";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
} as const;

function ChartFrame({ title, children, note }: { title: string; children: React.ReactElement; note: string }) {
  return (
    <Card icon={LineChartIcon} title={title}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}

export function CycleCharts({ result }: { result: CycleCompletionResult }) {
  const data = result.series.map((p) => ({ ...p, label: `D${p.day}` }));

  if (!data.length) {
    return (
      <Card icon={LineChartIcon} title="Cycle visualisation">
        <p className="text-sm text-muted-foreground">
          No monitoring visit recorded yet. Charts populate from the stimulation monitoring
          timeline.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartFrame title="Follicular growth" note="mm and follicle counts as entered.">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="largestFollicle" name="Largest (mm)" stroke={C1} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="follicles14" name="≥14 mm" stroke={C2} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="follicles17" name="≥17 mm" stroke={C3} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ChartFrame>

      <ChartFrame title="Hormone trends" note="Estradiol, progesterone and LH as entered.">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="estradiol" name="E2 (pg/mL)" stroke={C1} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="progesterone" name="P4 (ng/mL)" stroke={C2} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="lh" name="LH (IU/L)" stroke={C3} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ChartFrame>

      <ChartFrame title="Cycle progress" note="Follicles ≥ 10 mm recorded at each visit.">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="follicles10" name="≥10 mm" stroke={C1} fill="var(--color-chart-1, #2563eb)" fillOpacity={0.18} strokeWidth={2} />
        </AreaChart>
      </ChartFrame>

      <ChartFrame title="Endometrium & dose" note="Endometrial thickness and daily dose as entered.">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="endometrium" name="Endometrium (mm)" stroke={C1} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="dailyDose" name="Dose (IU)" stroke={C2} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ChartFrame>
    </div>
  );
}

/* -------------------------------------------------------------- timeline */

export function CycleTimeline({ result }: { result: CycleCompletionResult }) {
  return (
    <Card
      icon={Activity}
      title="Stimulation timeline"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.progress.visits} visit(s)
        </Badge>
      }
    >
      {result.series.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No visit recorded. Enter follow-up visits in the Monitoring module.
        </p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-stretch gap-2">
            {result.series.map((p) => (
              <div
                key={p.day}
                className={cn(
                  "min-w-24 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5",
                  p.day === result.progress.triggerDayRecorded && "border-primary bg-primary-soft",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Day {p.day}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {p.largestFollicle === null ? "—" : `${p.largestFollicle} mm`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.estradiol === null ? "No E2" : `E2 ${p.estradiol}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Button asChild size="sm" variant="ghost" className="mt-3 rounded-xl print:hidden">
        <Link to="/monitoring">Open monitoring module</Link>
      </Button>
    </Card>
  );
}

/* --------------------------------------------------------------- summary */

export function CycleSummaryCard({ result }: { result: CycleCompletionResult }) {
  const s = result.summary;
  const rows: [string, string][] = [
    ["Monitoring summary", s.monitoring],
    ["Follicular summary", s.follicular],
    ["Hormone summary", s.hormone],
    ["Safety summary", s.safety],
  ];
  return (
    <Card icon={FlaskConical} title="Cycle completion summary">
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
    </Card>
  );
}

export function OutstandingCard({ result }: { result: CycleCompletionResult }) {
  return (
    <Card
      icon={ListChecks}
      title="Outstanding information"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.missingInformation.length} item(s)
        </Badge>
      }
    >
      {result.missingInformation.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No outstanding item in the collected data surface.
        </p>
      ) : (
        <ul className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 text-sm">
          {result.missingInformation.map((m) => (
            <li key={m} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2">
              {m}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- evidence */

export function CycleEvidenceCard({ ids }: { ids: string[] }) {
  const entries = useMemo(
    () => ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => Boolean(e)),
    [ids],
  );

  return (
    <Card icon={BookOpen} title="Evidence panel">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No linked reference indexed yet.</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <Link
                to="/evidence/$id"
                params={{ id: e.id }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {e.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{e.journal}</span>
                <span>{e.year}</span>
                <span>Evidence level {e.level}</span>
                {e.doi && <span>DOI {e.doi}</span>}
                <a
                  href={e.url ?? (e.doi ? `https://doi.org/${e.doi}` : "#")}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open <ExternalLink className="size-3" />
                </a>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Indexed record only — the trigger, OHSS and freeze-all tables of this document have
                not been transcribed into the application. Algorithm status: locked.
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3">
        {[
          ["Required to activate trigger strategy", TRIGGER_REQUIRED_EVIDENCE],
          ["Required to activate OHSS risk", OHSS_REQUIRED_EVIDENCE],
          ["Required to activate freeze-all", FREEZE_ALL_REQUIRED_EVIDENCE],
        ].map(([label, items]) => (
          <div key={label as string} className="rounded-xl border border-dashed border-border px-3.5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {label as string}
            </p>
            <ul className="mt-1.5 grid gap-1 text-xs text-muted-foreground">
              {(items as string[]).map((x) => (
                <li key={x}>• {x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Button asChild size="sm" variant="ghost" className="mt-2 rounded-xl print:hidden">
        <Link to="/evidence-requirements">View full requirements list</Link>
      </Button>
    </Card>
  );
}

/* ----------------------------------------------------------- integration */

export function CycleIntegrationCard() {
  return (
    <Card icon={Database} title="Prepared interfaces">
      <ul className="grid gap-2 sm:grid-cols-2">
        {cycleConsumerInterfaces.map((c) => (
          <li key={c.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <p className="text-sm font-medium">{c.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Receives: {c.receives.join(" · ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.status}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --------------------------------------------------------------- actions */

export function CycleCompletionActions({ result }: { result: CycleCompletionResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cycleCompletionReportText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <FileDown className="size-4" /> Export PDF
      </Button>
      <Button size="sm" onClick={copy}>
        {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
        {copied ? "Copied" : "Copy cycle completion report"}
      </Button>
    </div>
  );
}

export const TriggerIcon = Timer;
export const FreezeIcon = Snowflake;
