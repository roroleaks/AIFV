import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileDown,
  Info,
  ListChecks,
  Printer,
  Syringe,
  TriangleAlert,
  UserRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  consortReportText,
  consortStatusLabel,
  type ConsortResult,
  type ConsortVariable,
} from "@/lib/engine/consort-dose";
import {
  CONSORT_FRAMEWORK_STATUS,
  CONSORT_MISSING_COMPONENTS,
  CONSORT_FOLL_LT11_NOTE,
  CONSORT_LOCK_NOTE,
} from "@/lib/engine/consort-model";
import { evaluateTreatmentGate } from "@/lib/engine/algorithm-status";
import {
  ClinicalSafetyBanner,
  EvidencePendingGate,
} from "@/components/engine/clinical-safety-banner";

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

const statusTone: Record<ConsortVariable["status"], string> = {
  available: "text-emerald-600 dark:text-emerald-400",
  missing: "text-amber-600 dark:text-amber-400",
  invalid: "text-destructive",
};

const statusMark: Record<ConsortVariable["status"], string> = {
  available: "✓",
  missing: "⚠",
  invalid: "✕",
};

/* -------------------------------------------------------- imported values */

export function ConsortVariablesCard({ result }: { result: ConsortResult }) {
  return (
    <Card
      icon={UserRound}
      title="Imported patient variables"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.variables.filter((v) => v.status === "available").length}/
          {result.variables.length} available
        </Badge>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {result.variables.map((v) => (
          <div key={v.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {v.label}
                {v.mandatory && <span className="ml-1 text-destructive">*</span>}
              </span>
              <span className={cn("text-sm font-semibold", statusTone[v.status])}>
                {statusMark[v.status]} {v.display}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {v.issue ??
                (v.usedInCalculation
                  ? "Used in the CONSORT calculation"
                  : "Displayed for clinical context — not used by the CONSORT model")}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {result.history.map((h) => (
          <div key={h.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <p className="text-xs text-muted-foreground">{h.label}</p>
            <p
              className={cn("mt-0.5 text-sm font-medium", !h.available && "text-muted-foreground")}
            >
              {h.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        * Mandatory for the published CONSORT model. Missing mandatory variables stop the
        calculation — no value is estimated.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------- validation */

export function ConsortValidationCard({ result }: { result: ConsortResult }) {
  const { missing, invalid, duplicates, conflicts, ready } = result.validation;
  return (
    <Card
      icon={ListChecks}
      title="Data validation"
      badge={
        <Badge
          variant={ready ? "secondary" : "outline"}
          className={cn(
            "rounded-full",
            !ready && "border-amber-500/50 text-amber-600 dark:text-amber-400",
          )}
        >
          {ready ? "Validated" : "Action required"}
        </Badge>
      }
    >
      {ready && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
          All mandatory variables are present, within physiological range and internally consistent.
        </p>
      )}

      <div className="grid gap-2">
        {invalid.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-destructive">
              <XCircle className="size-4" /> Incorrect value — {v.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{v.issue}</p>
          </div>
        ))}
        {missing.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-4" /> Missing — {v.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Required by the CONSORT model. Record it in the patient assessment.
            </p>
          </div>
        ))}
        {[...duplicates, ...conflicts].map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" /> {c.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
          </div>
        ))}
      </div>

      {!ready && (
        <Button asChild size="sm" className="mt-4">
          <Link to="/assessment">
            Return to assessment <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- dose card */

export function ConsortDoseCard({ result }: { result: ConsortResult }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const gate = evaluateTreatmentGate("consort-dose", {
    dataAvailable: result.variables
      .filter((v) => v.status === "available")
      .map((v) => `${v.label}: ${v.display}`),
    dataMissing: [...result.validation.missing, ...result.validation.invalid].map((v) => v.label),
  });
  /* Hard gate: a dose is displayed only when the validated methodology is
     ACTIVE. No estimate, fallback or inferred dose is ever shown. */
  const completed = gate.active && result.status === "completed" && result.dose !== null;

  return (
    <section className="animate-rise overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="border-b border-border/60 bg-gradient-to-br from-primary-soft/70 to-transparent p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Individualized starting dose
            </p>
            <p className="mt-1 text-sm font-medium">{result.medication}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full",
              completed
                ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/50 text-amber-600 dark:text-amber-400",
            )}
          >
            {consortStatusLabel[result.status]}
          </Badge>
        </div>

        <div className="mt-5 flex items-end gap-3">
          <span
            className={cn(
              "font-display text-5xl font-semibold leading-none tracking-tight sm:text-6xl",
              !completed && "text-muted-foreground",
            )}
          >
            {completed ? result.dose : "—"}
          </span>
          <span className="pb-1.5 text-sm font-medium text-muted-foreground">IU/day</span>
        </div>

        {!gate.active && (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            CONSORT dose calculation unavailable — validated methodology not activated.
          </p>
        )}

        {gate.active && !completed && result.reason && (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            {result.reason}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>
            Calculation date: {mounted ? new Date(result.computedAt).toLocaleString() : "—"}
          </span>
          <span>Calculation version: v{result.version}</span>
          <span>Method: {result.modelName}</span>
        </div>
      </div>

      <div className="p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm font-medium transition hover:bg-muted/60"
          aria-expanded={open}
        >
          Calculation details
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="mt-3 grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {result.variables
                .filter((v) => v.usedInCalculation)
                .map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
                  >
                    <p className="text-xs text-muted-foreground">{v.label}</p>
                    <p className="text-sm font-medium">{v.display}</p>
                  </div>
                ))}
            </div>
            {result.contributions.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/60 px-3.5 py-2.5">
                <p className="text-sm font-medium">
                  {c.label} — {c.value} <span className="text-muted-foreground">({c.band})</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.influence}</p>
              </div>
            ))}
            {result.narrative.map((n) => (
              <p key={n} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Internal equations and coefficients are not displayed. Validated population:{" "}
              {result.validatedPopulation}
            </p>
          </div>
        )}

        <ul className="mt-4 grid gap-2">
          {result.clinicalNotes.map((n) => (
            <li
              key={n}
              className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground"
            >
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" /> {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- evidence */

export function ConsortEvidenceCard({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => !!e);
  if (!entries.length) return null;
  return (
    <Card icon={BookOpen} title="Evidence panel">
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
            <p className="mt-1 text-xs text-muted-foreground">{e.authors.join(", ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{e.summary}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{e.journal}</span>
              <span>{e.year}</span>
              {e.doi && <span>DOI {e.doi}</span>}
              <a
                href={e.url ?? (e.doi ? `https://doi.org/${e.doi}` : "#")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open <ExternalLink className="size-3" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------ framework vs activation */

export function ConsortFrameworkStatusCard() {
  const f = CONSORT_FRAMEWORK_STATUS;
  return (
    <Card icon={ListChecks} title="Methodology status">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" /> {f.frameworkLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{f.frameworkDetail}</p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <XCircle className="size-4" /> {f.activeLabel} — not achieved
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{f.activeDetail}</p>
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Evidence required to activate
      </p>
      <ul className="mt-2 grid gap-1.5">
        {CONSORT_MISSING_COMPONENTS.map((c) => (
          <li
            key={c.symbol}
            className="flex flex-wrap items-baseline gap-x-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2"
          >
            <span className="font-mono text-sm font-semibold">{c.symbol}</span>
            <span className="text-xs text-muted-foreground">{c.detail}</span>
            <Badge variant="outline" className="ml-auto rounded-full text-[10px]">
              Missing
            </Badge>
          </li>
        ))}
      </ul>

      <p className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-[11px] text-muted-foreground">
        {CONSORT_FOLL_LT11_NOTE} AMH is never substituted into the CONSORT equation.
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{CONSORT_LOCK_NOTE}</p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link to="/evidence-requirements">
          Open evidence requirements <ArrowRight className="size-4" />
        </Link>
      </Button>
    </Card>
  );
}

/* ----------------------------------------------------------- integration */

const consumers = [
  { id: "dose-adjustment", name: "Dose Adjustment Engine" },
  { id: "trigger", name: "Trigger Strategy Engine" },
  { id: "report", name: "Final Clinical Report" },
];

export function ConsortIntegrationCard({ result }: { result: ConsortResult }) {
  return (
    <Card icon={Database} title="Stored for downstream modules">
      <ul className="grid gap-2 sm:grid-cols-3">
        {consumers.map((c) => (
          <li key={c.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <p className="text-sm font-medium">{c.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Receives:{" "}
              {result.dose === null
                ? "no dose (calculation not completed)"
                : `${result.dose} IU/day`}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- actions */

export function ConsortActions({ result }: { result: ConsortResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(consortReportText(result));
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
        {copied ? "Copied" : "Copy to report"}
      </Button>
    </div>
  );
}

export function ConsortSection({ result }: { result: ConsortResult }) {
  return (
    <div className="grid gap-5">
      <ClinicalSafetyBanner />
      <EvidencePendingGate
        id="consort-dose"
        title="CONSORT dose calculation unavailable — validated methodology not activated"
        options={{
          dataAvailable: result.variables
            .filter((v) => v.status === "available")
            .map((v) => `${v.label}: ${v.display}`),
          dataMissing: [...result.validation.missing, ...result.validation.invalid].map(
            (v) => v.label,
          ),
        }}
      />
      <ConsortDoseCard result={result} />
      <ConsortFrameworkStatusCard />

      <ConsortVariablesCard result={result} />
      <ConsortValidationCard result={result} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ConsortEvidenceCard ids={result.evidenceSource} />
        <ConsortIntegrationCard result={result} />
      </div>
    </div>
  );
}

export const ConsortIcon = Syringe;
