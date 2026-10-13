import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gauge,
  Layers,
  ListChecks,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  responseCategoryLabel,
  responseCategoryTone,
  responseConsumerModules,
  responseSpectrum,
  type OvarianResponseResult,
  type ResponseRisk,
} from "@/lib/engine/ovarian-response";

const toneClass: Record<string, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const severityClass: Record<ResponseRisk["severity"], string> = {
  high: toneClass["red"]!,
  moderate: toneClass["amber"]!,
  info: toneClass["blue"]!,
};

function Card({
  icon: Icon,
  title,
  badge,
  children,
  className,
}: {
  icon: typeof Gauge;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-shadow duration-300 hover:shadow-lg",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" /> {title}
        </h3>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Expandable({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        {label}
        <ChevronDown
          className={cn("size-4 transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out print:grid-rows-[1fr]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="grid gap-2">
    {items.map((t, i) => (
      <li key={i} className="text-sm text-foreground/85">
        • {t}
      </li>
    ))}
  </ul>
);

/* ------------------------------------------------------------- spectrum */

export function ResponseSpectrum({ result }: { result: OvarianResponseResult }) {
  const index = responseSpectrum.indexOf(result.category as (typeof responseSpectrum)[number]);
  return (
    <Card
      icon={TrendingUp}
      title="Expected response spectrum"
      badge={
        <Badge
          variant="outline"
          className={cn("rounded-full", toneClass[responseCategoryTone[result.category]])}
        >
          {responseCategoryLabel[result.category]}
        </Badge>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {responseSpectrum.map((c, i) => {
          const active = i === index;
          return (
            <div
              key={c}
              className={cn(
                "relative rounded-xl border px-3 py-3 text-center transition-all duration-300",
                active
                  ? cn(toneClass[responseCategoryTone[c]], "scale-[1.03] shadow-soft")
                  : "border-border/60 bg-muted/30 text-muted-foreground",
              )}
            >
              {active && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Patient
                </span>
              )}
              <p className="text-xs font-semibold leading-tight">{responseCategoryLabel[c]}</p>
            </div>
          );
        })}
      </div>
      {index === -1 && (
        <p className="mt-3 text-xs text-muted-foreground">
          No position is highlighted because the essential variables required for an assessment are
          not recorded.
        </p>
      )}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Data completeness</span>
          <span>{result.confidence}%</span>
        </div>
        <Progress value={result.confidence} className="h-1.5" />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- headline */

export function ResponseProfileCard({ result }: { result: OvarianResponseResult }) {
  const tone = responseCategoryTone[result.category];
  return (
    <section
      className={cn(
        "animate-rise relative overflow-hidden rounded-2xl border p-6 shadow-soft",
        toneClass[tone],
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-current/10 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          <Sparkles className="size-3.5" /> Ovarian response prediction
        </p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          {responseCategoryLabel[result.category]}
        </h2>
        <p className="mt-2 text-sm text-foreground/85">{result.headline}</p>
        <p className="mt-4 text-xs text-foreground/70">
          Expected ovarian response only. No stimulation protocol, medication, gonadotropin, dose or
          trigger strategy is recommended, and no pregnancy or live-birth outcome is predicted.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ validation */

export function ResponseValidationCard({ result }: { result: OvarianResponseResult }) {
  const v = result.validation;
  const clean =
    v.missing.length === 0 &&
    v.conflicting.length === 0 &&
    v.abnormal.length === 0 &&
    v.incompleteHistory.length === 0;

  const qualityTone =
    v.quality === "complete" ? "green" : v.quality === "partial" ? "amber" : "red";

  return (
    <Card
      icon={ListChecks}
      title="Data validation"
      badge={
        <Badge variant="outline" className={cn("rounded-full capitalize", toneClass[qualityTone])}>
          {v.quality === "insufficient" ? "Essential data missing" : `Data ${v.quality}`}
        </Badge>
      }
    >
      {clean ? (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Every variable used by this module is recorded and
          within plausible ranges.
        </p>
      ) : (
        <div className="grid gap-3">
          {v.missing.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Missing data ({v.missing.length})
              </p>
              <p className="mt-1 text-xs text-foreground/80">
                {v.missing.map((m) => m.label).join(", ")}.
              </p>
            </div>
          )}
          {v.conflicting.length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Conflicting data
              </p>
              <ul className="mt-1 grid gap-1 text-xs text-foreground/80">
                {v.conflicting.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
          {v.abnormal.length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Abnormal values
              </p>
              <ul className="mt-1 grid gap-1 text-xs text-foreground/80">
                {v.abnormal.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
          {v.incompleteHistory.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Incomplete history
              </p>
              <ul className="mt-1 grid gap-1 text-xs text-foreground/80">
                {v.incompleteHistory.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
          <Button asChild size="sm" variant="outline" className="w-fit print:hidden">
            <Link to="/assessment">
              Complete in patient assessment <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}

      <Expandable label="Variables retrieved for this module">
        <ul className="grid gap-2 sm:grid-cols-2">
          {result.variables.map((v2) => (
            <li
              key={v2.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2"
            >
              <span className="text-xs text-muted-foreground">{v2.label}</span>
              <span className={cn("text-xs font-medium", !v2.present && "text-muted-foreground")}>
                {v2.value}
              </span>
            </li>
          ))}
        </ul>
      </Expandable>
    </Card>
  );
}

/* ----------------------------------------------------------------- risks */

export function ResponseRiskCard({ result }: { result: OvarianResponseResult }) {
  return (
    <Card
      icon={ShieldAlert}
      title="Risk stratification"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.risks.length} risk{result.risks.length === 1 ? "" : "s"}
        </Badge>
      }
    >
      {result.risks.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="size-4" /> No stimulation-related risk is supported by the
          information currently recorded.
        </p>
      ) : (
        <ul className="grid gap-2">
          {result.risks.map((r) => (
            <li
              key={r.id}
              className={cn("rounded-xl border px-3.5 py-2.5", severityClass[r.severity])}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{r.label}</p>
                <Badge variant="secondary" className="rounded-lg text-[10px] uppercase">
                  {r.severity}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-foreground/80">{r.basis}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------- explanation */

export function ResponseExplanationCard({ result }: { result: OvarianResponseResult }) {
  const e = result.explanation;
  return (
    <Card icon={Gauge} title="Why this response is expected">
      <Bullets items={e.contributingVariables} />
      <Expandable label="Previous cycle information used">
        <Bullets items={e.previousCycleFindings} />
      </Expandable>
      <Expandable label="Biomarkers considered">
        <Bullets items={e.biomarkersConsidered} />
      </Expandable>
      <Expandable label="Information still missing">
        {e.missingInformation.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is missing for this module.</p>
        ) : (
          <Bullets items={e.missingInformation} />
        )}
      </Expandable>
    </Card>
  );
}

/* -------------------------------------------------------------- evidence */

export function ResponseEvidenceCard({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => !!e);
  return (
    <Card icon={BookOpen} title="Supporting evidence">
      <ul className="grid gap-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <Link
                to="/evidence/$id"
                params={{ id: e.id }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {e.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.journal} · {e.year} · Evidence level {e.level}
              </p>
            </div>
            <a
              href={e.url ?? (e.doi ? `https://doi.org/${e.doi}` : "#")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open <ExternalLink className="size-3" />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------- future consumers */

export function ResponseHandoffCard({ result }: { result: OvarianResponseResult }) {
  return (
    <Card
      icon={Layers}
      title="Stored for the next modules"
      badge={
        <Badge variant="outline" className="rounded-full">
          Engine v{result.version}
        </Badge>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {responseConsumerModules.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm"
          >
            {m.name}
            <Badge
              variant="secondary"
              className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
            >
              Pending
            </Badge>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        The predicted category and the identified risks are saved so these engines can read them.
        None of them is active in this release, and no treatment is recommended.
      </p>
    </Card>
  );
}

export function OvarianResponseSection({ result }: { result: OvarianResponseResult }) {
  return (
    <div className="grid gap-5">
      <ResponseProfileCard result={result} />
      <ResponseSpectrum result={result} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ResponseValidationCard result={result} />
        <ResponseRiskCard result={result} />
        <ResponseExplanationCard result={result} />
        <ResponseEvidenceCard ids={result.evidence} />
      </div>
      <ResponseHandoffCard result={result} />
    </div>
  );
}
