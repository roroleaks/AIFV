import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Braces,
  Calculator,
  Check,
  ChevronDown,
  ClipboardCopy,
  ClipboardList,
  Dna,
  History,
  Scale,
  ExternalLink,
  FileDown,
  FlaskConical,
  ListChecks,
  type LucideIcon,
  Printer,
  Route as RouteIcon,
  ShieldCheck,
  Sheet,
  Syringe,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  PENDING_LABEL,
  intelligenceReportJson,
  intelligenceReportText,
  moduleAlgorithmStatusLabel,
  qualityIssueLabel,
  sectionStatusLabel,
  structuredClinicalData,
  type IntelligenceReport,
  type IntelligenceSection,
  type SectionStatus,
} from "@/lib/report/intelligence-report";

const icons: Record<string, LucideIcon> = {
  user: User,
  flask: FlaskConical,
  dna: Dna,
  route: RouteIcon,
  syringe: Syringe,
  calculator: Calculator,
  activity: Activity,
  shield: ShieldCheck,
  book: BookOpen,
  clipboard: ClipboardList,
  history: History,
  scale: Scale,
  listChecks: ListChecks,
};

const statusTone: Record<SectionStatus, string> = {
  complete: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "pending-evidence": "border-primary/40 bg-primary/10 text-primary",
  "no-data": "border-border bg-muted/60 text-muted-foreground",
};

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Locale-formatted values differ between server and client; render after hydration. */
export function ClientValue({ value }: { value: string }) {
  const mounted = useMounted();
  return <>{mounted ? value : "—"}</>;
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------- actions */

export function ReportActions({ report }: { report: IntelligenceReport }) {
  const [copied, setCopied] = useState(false);
  const slug = report.patientName.replace(/[^\w-]+/g, "-").toLowerCase() || "patient";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(intelligenceReportText(report));
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
        <FileDown className="size-4" /> Professional PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          download(`ivf-report-${slug}.json`, intelligenceReportJson(report), "application/json")
        }
      >
        <Braces className="size-4" /> Export JSON
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          download(`ivf-clinical-data-${slug}.csv`, structuredClinicalData(report), "text/csv")
        }
      >
        <Sheet className="size-4" /> Structured data
      </Button>
      <Button size="sm" onClick={copy}>
        {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
        {copied ? "Copied" : "Copy report"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------- quality control */

export function QualityControlCard({ report }: { report: IntelligenceReport }) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof report.qualityIssues>();
    for (const issue of report.qualityIssues) {
      const arr = map.get(issue.kind) ?? [];
      arr.push(issue);
      map.set(issue.kind, arr);
    }
    return Array.from(map.entries());
  }, [report.qualityIssues]);

  return (
    <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <ListChecks className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Quality control</h2>
            <p className="text-xs text-muted-foreground">
              Checked before generation: missing variables, duplicate values, conflicting
              information and incomplete assessments.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full",
            report.qualityIssues.length === 0 ? statusTone.complete : statusTone.partial,
          )}
        >
          {report.qualityIssues.length === 0
            ? "No issue detected"
            : `${report.qualityIssues.length} issue(s) detected`}
        </Badge>
      </header>

      {grouped.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {grouped.map(([kind, issues]) => (
            <div key={kind} className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {qualityIssueLabel[kind as keyof typeof qualityIssueLabel]} · {issues.length}
              </p>
              <ul className="mt-2 space-y-2">
                {issues.map((i) => (
                  <li key={i.id} className="text-sm">
                    <span className="font-medium">{i.label}</span>
                    <span className="block text-xs text-muted-foreground">{i.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------ table of contents */

export function TableOfContents({ report }: { report: IntelligenceReport }) {
  const entries = [
    ...report.sections.map((s) => ({ number: s.number, title: s.title, id: s.id })),
    {
      number: report.sections.length + 1,
      title: "Clinical Explanation",
      id: "clinical-explanation",
    },
    { number: report.sections.length + 2, title: "Application Status", id: "application-status" },
    { number: report.sections.length + 3, title: "Audit Trail", id: "audit-trail" },
  ];
  return (
    <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        Table of contents
      </h2>
      <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <li key={e.id} className="text-sm">
            <a
              href={`#${e.id}`}
              className="flex items-baseline gap-2 rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="tabular-nums text-xs font-semibold text-primary">
                {String(e.number).padStart(2, "0")}
              </span>
              <span className="truncate">{e.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --------------------------------------------------------------- section */

function SectionBlock({ section }: { section: IntelligenceSection }) {
  const Icon = icons[section.icon] ?? User;
  return (
    <section
      id={section.id}
      className="min-w-0 break-inside-avoid overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
              Section {String(section.number).padStart(2, "0")}
            </p>
            <h2 className="truncate text-base font-semibold">{section.title}</h2>
          </div>
        </div>
        <Badge variant="outline" className={cn("rounded-full", statusTone[section.status])}>
          {sectionStatusLabel[section.status]}
        </Badge>
      </header>

      <p className="mt-3 text-sm text-muted-foreground">{section.summary}</p>

      {section.fields.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {f.label}
              </dt>
              <dd
                className={cn(
                  "truncate text-sm",
                  f.present ? "font-medium" : "italic text-muted-foreground",
                )}
                title={f.value}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {section.lists.map((l) => (
        <div key={l.title} className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {l.title}
          </p>
          {l.items.length === 0 ? (
            <p className="mt-1 text-sm italic text-muted-foreground">
              {l.emptyLabel ?? "None recorded."}
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {l.items.map((item, idx) => (
                <li key={`${l.title}-${idx}`} className="flex gap-2 text-sm">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {section.tables.map((t) => (
        <div key={t.title} className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t.title}
          </p>
          {t.rows.length === 0 ? (
            <p className="mt-1 text-sm italic text-muted-foreground">
              {t.emptyLabel ?? "No data recorded."}
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-muted/50 text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    {t.columns.map((c) => (
                      <th key={c} className="px-3 py-2 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {section.pendingNote && (
        <p className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-primary">{PENDING_LABEL} — </span>
          {section.pendingNote}
        </p>
      )}
    </section>
  );
}

export function ReportSections({ report }: { report: IntelligenceReport }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      {report.sections.map((s) => (
        <SectionBlock key={s.id} section={s} />
      ))}
    </div>
  );
}

/* --------------------------------------------------- explainable AI panel */

export function ExplainablePanel({ report }: { report: IntelligenceReport }) {
  const [open, setOpen] = useState<string | null>(report.explanations[0]?.moduleId ?? null);

  return (
    <section
      id="clinical-explanation"
      className="min-w-0 rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
    >
      <header className="border-b border-border/60 pb-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Section {report.sections.length + 1} · Explainable decision support
        </p>
        <h2 className="mt-0.5 text-base font-semibold">
          Why did the application produce this output?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every module states what it evaluated, which variables it analysed, which evidence it
          used, what was unavailable and which algorithms remain inactive. Internal equations and
          code are never exposed.
        </p>
      </header>

      <div className="mt-4 grid gap-3">
        {report.explanations.map((e) => {
          const expanded = open === e.moduleId;
          return (
            <article
              key={e.moduleId}
              className="break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-muted/20"
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : e.moduleId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {moduleAlgorithmStatusLabel[e.status]}
                    {e.confidence !== null && ` · data completeness ${e.confidence}%`}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform print:hidden",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              <div className={cn("px-4 pb-4", !expanded && "hidden print:block")}>
                <div className="grid gap-3 md:grid-cols-2">
                  <ExplainBlock title="What was evaluated" items={[e.evaluated]} />
                  <ExplainBlock title="Input data analysed" items={e.inputs} />
                  <ExplainBlock title="Clinical logic" items={e.reasoning.filter(Boolean)} />
                  <ExplainBlock
                    title="Evidence source"
                    items={e.evidence.map((id) => findEvidence(id)?.title ?? id)}
                  />
                  <ExplainBlock title="Variables unavailable" items={e.unavailable} />
                  <ExplainBlock title="Algorithms still inactive" items={e.inactive} />
                </div>
                {e.confidence !== null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Confidence (data completeness only, not clinical certainty)</span>
                      <span className="font-semibold text-foreground">{e.confidence}%</span>
                    </div>
                    <Progress value={e.confidence} className="mt-1.5 h-1.5" />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ExplainBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm italic text-muted-foreground">None.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((i, idx) => (
            <li key={idx} className="text-sm leading-snug">
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------- application status */

export function ApplicationStatusPanel({ report }: { report: IntelligenceReport }) {
  const s = report.applicationStatus;
  return (
    <section
      id="application-status"
      className="min-w-0 rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
    >
      <header className="border-b border-border/60 pb-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Section {report.sections.length + 2}
        </p>
        <h2 className="mt-0.5 text-base font-semibold">Application status</h2>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <StatusList
          title={`Active modules · ${s.active.length}`}
          items={s.active.map((m) => m.name)}
        />
        <StatusList
          title={`Framework modules · ${s.framework.length}`}
          items={s.framework.map((m) => m.name)}
        />
        <StatusList
          title={`Pending algorithms · ${s.pending.length}`}
          items={s.pending.map((m) => m.name)}
        />
      </div>

      <div className="mt-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Activation progress
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {s.progress.map((p) => (
            <div key={p.id} className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="tabular-nums text-xs font-semibold text-muted-foreground">
                  {p.percent}%
                </span>
              </div>
              <Progress value={p.percent} className="mt-2 h-1.5" />
              <p className="mt-1.5 text-xs text-muted-foreground">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Missing evidence · {s.requirementCount} outstanding requirement(s)
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {s.missingEvidence.map((m) => (
            <div
              key={m.module}
              className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
            >
              <p className="text-sm font-medium">{m.module}</p>
              <ul className="mt-1 space-y-1">
                {m.items.map((i, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatusList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm italic text-muted-foreground">None.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((i) => (
            <li key={i} className="text-sm leading-snug">
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- evidence */

export function EvidenceTable({ report }: { report: IntelligenceReport }) {
  if (report.evidence.length === 0) return null;
  return (
    <section className="min-w-0 break-inside-avoid rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <h2 className="text-sm font-semibold">Evidence references</h2>
      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
        {report.evidence.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/25 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {e.society ?? e.journal} · {e.year} · {e.level}
                {e.doi ? ` · ${e.doi}` : ""}
              </p>
            </div>
            {e.url && (
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline print:hidden"
              >
                Open <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------- audit trail */

export function AuditPanel({ report }: { report: IntelligenceReport }) {
  const a = report.audit;
  const rows: [string, string][] = [
    ["Date", a.date],
    ["Time", a.time],
    ["Application version", `v${a.applicationVersion}`],
    ["Evidence Library version", a.evidenceLibraryVersion],
    ["Report version", `v${a.reportVersion}`],
    ["User", a.user],
    ["Calculation timestamp", a.calculationTimestamp],
  ];
  return (
    <section
      id="audit-trail"
      className="min-w-0 break-inside-avoid overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
    >
      <header className="border-b border-border/60 pb-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Section {report.sections.length + 3}
        </p>
        <h2 className="mt-0.5 text-base font-semibold">Audit trail</h2>
      </header>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {k}
            </dt>
            <dd className="truncate text-sm font-medium" title={v}>
              <ClientValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
      <Separator className="my-4" />
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Algorithm versions
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {a.algorithmVersions.map((v) => (
          <li key={v.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">{v.label}</span>
            <Badge variant="outline" className="rounded-full text-[0.65rem]">
              v{v.version}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- footer */

export function DisclaimerPanel({ report }: { report: IntelligenceReport }) {
  return (
    <section className="min-w-0 break-before-page break-inside-avoid rounded-2xl border border-border/70 bg-muted/30 p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Disclaimer</h2>
      </div>
      <div className="mt-3 space-y-2">
        {report.disclaimer.map((d, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {d}
          </p>
        ))}
      </div>
      <Separator className="my-5" />
      <div className="grid gap-8 sm:grid-cols-2">
        {["Consultant signature", "Date"].map((label) => (
          <div key={label}>
            <div className="h-14 border-b border-border" />
            <p className="mt-2 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <img
            src="/dr-raouf-roshdy.jpg"
            alt="Dr Raouf Roshdy"
            className="size-8.5 rounded-full object-cover ring-1 ring-border shadow-xs"
          />
          <div>
            <p className="font-semibold text-foreground">Created by Dr Raouf Roshdy</p>
            <p className="text-[11px] text-muted-foreground">All copyrights reserved 2026</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          IVF Clinical Intelligence Report · ESHRE 2025 Synchronized
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------- previous cycle full detail */

export function CycleDetailPanel({ report }: { report: IntelligenceReport }) {
  const [open, setOpen] = useState<string | null>(report.cycleDetails[0]?.id ?? null);
  if (report.cycleDetails.length === 0) return null;

  return (
    <section
      id="previous-cycle-detail"
      className="min-w-0 rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
    >
      <header className="border-b border-border/60 pb-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Previous cycle records · full detail
        </p>
        <h2 className="mt-0.5 text-base font-semibold">
          {report.cycleDetails.length} previous IVF / ICSI cycle(s)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every field entered for each cycle, grouped exactly as it was collected. “Not provided”
          means the item was never answered and is deliberately distinct from a recorded answer of
          “No”. Entered values are never discarded.
        </p>
      </header>

      <div className="mt-4 grid gap-3">
        {report.cycleDetails.map((c) => {
          const expanded = open === c.id;
          return (
            <article
              key={c.id}
              className="break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-muted/20"
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : c.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.outcome} · {c.recorded}/{c.total} fields recorded ({c.percent}%)
                    {c.issues.length > 0 && ` · ${c.issues.length} validation flag(s)`}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform print:hidden",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              <div className={cn("px-4 pb-4", !expanded && "hidden print:block")}>
                {c.issues.length > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-3.5" /> Data validation
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {c.issues.map((i) => (
                        <li key={i.id} className="text-xs text-muted-foreground">
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {c.groups.map((g) => (
                    <div key={g.id} className="rounded-lg border border-border/60 bg-card/60 p-3">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {g.title} · {g.recorded}/{g.total}
                      </p>
                      <dl className="mt-1.5 grid gap-1.5">
                        {g.fields.map((f) => (
                          <div key={f.key} className="flex items-baseline justify-between gap-3">
                            <dt className="min-w-0 truncate text-xs text-muted-foreground">
                              {f.label}
                            </dt>
                            <dd
                              className={cn(
                                "shrink-0 text-right text-xs",
                                f.present ? "font-medium" : "italic text-muted-foreground",
                              )}
                            >
                              {f.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
