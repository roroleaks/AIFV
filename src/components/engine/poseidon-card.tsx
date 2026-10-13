import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCopy,
  ExternalLink,
  FileDown,
  Info,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { findEvidence, formatCitation } from "@/lib/evidence/library";
import {
  buildPoseidonReportSection,
  poseidonReportText,
  poseidonStatusLabels,
  poseidonToneClass,
  poseidonToneRing,
  type PoseidonCriterion,
  type PoseidonResult,
} from "@/lib/engine/poseidon";

const stateIcon: Record<PoseidonCriterion["state"], typeof Check> = {
  met: Check,
  "not-met": X,
  unknown: CircleHelp,
};

const stateTone: Record<PoseidonCriterion["state"], string> = {
  met: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "not-met": "text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10",
  unknown: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10",
};

function CriteriaList({ items, empty }: { items: PoseidonCriterion[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {items.map((c) => {
        const Icon = stateIcon[c.state];
        return (
          <li
            key={c.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3"
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 place-items-center rounded-full border",
                stateTone[c.state],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="text-sm text-foreground/80">{c.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.rule}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PoseidonCard({
  result,
  patientName,
}: {
  result: PoseidonResult;
  patientName?: string;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const section = useMemo(() => buildPoseidonReportSection(result), [result]);
  const citations = useMemo(
    () =>
      result.evidence.map((id) => {
        const e = findEvidence(id);
        return e ? formatCitation(e) : id;
      }),
    [result.evidence],
  );

  const copy = async () => {
    const text = poseidonReportText(section, citations);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="grid gap-5 print:gap-3">
      {/* Classification card */}
      <section
        className={cn(
          "animate-rise relative overflow-hidden rounded-2xl border bg-card p-6 shadow-soft",
          poseidonToneClass[result.tone].replace(/text-[^\s]+/g, ""),
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br blur-2xl",
            poseidonToneRing[result.tone],
          )}
          aria-hidden
        />
        <div className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full", poseidonToneClass[result.tone])}
              >
                {poseidonStatusLabels[result.status]}
              </Badge>
              {patientName && <span className="text-xs text-muted-foreground">{patientName}</span>}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {result.headline}
            </h2>
            {result.groupTitle && (
              <p className="mt-1.5 text-sm text-muted-foreground">{result.groupTitle}</p>
            )}
            <p className="mt-3 max-w-2xl text-sm text-foreground/80">
              {result.rationale[0] ??
                "Record the required variables to evaluate the published POSEIDON criteria."}
            </p>
          </div>

          <div className="w-full md:w-56">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Data completeness
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{result.confidence}%</span>
              <span className="text-xs text-muted-foreground">
                {result.completeness.available}/{result.completeness.required} variables
              </span>
            </div>
            <Progress value={result.confidence} className="mt-2 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              Reflects completeness of the entered data only — not clinical certainty.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Assessment date{" "}
              <span className="font-medium text-foreground">
                {new Date(result.computedAt).toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            {open ? "Hide explanation" : "Show explanation"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print summary
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <FileDown className="size-4" /> Export PDF
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            <ClipboardCopy className="size-4" /> {copied ? "Copied" : "Copy to final report"}
          </Button>
        </div>
      </section>

      {/* Validation */}
      {result.validation.length > 0 && (
        <section className="animate-rise rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Data validation — classification withheld
            </h3>
          </div>
          <ul className="mt-3 grid gap-2">
            {result.validation.map((v, i) => (
              <li key={i} className="text-sm text-foreground/85">
                {v}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Explanation panel */}
      {open && (
        <section className="animate-rise grid gap-5 rounded-2xl border border-border/70 bg-card p-5 shadow-soft lg:grid-cols-2">
          <div className="lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Info className="size-4 text-primary" /> Why this result
            </h3>
            <ul className="mt-3 grid gap-2">
              {result.rationale.map((r, i) => (
                <li key={i} className="text-sm text-foreground/85">
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Criteria satisfied
            </h4>
            <div className="mt-3">
              <CriteriaList items={result.satisfied} empty="No criterion is currently satisfied." />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Criteria not satisfied
            </h4>
            <div className="mt-3">
              <CriteriaList items={result.notSatisfied} empty="No criterion was ruled out." />
            </div>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Missing information
            </h4>
            <div className="mt-3">
              {result.missing.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {result.missing.map((m) => (
                    <li
                      key={m}
                      className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-3.5 py-2 text-sm text-foreground/85"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  All variables required by the published criteria are recorded.
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <Separator className="my-1" />
            <h4 className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheck className="size-4" /> Variables used
            </h4>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Female age", result.inputs.age === null ? "—" : `${result.inputs.age} y`],
                ["AMH", result.inputs.amh === null ? "—" : `${result.inputs.amh} ng/mL`],
                ["Total AFC", result.inputs.afc === null ? "—" : String(result.inputs.afc)],
                ["Previous stimulations", String(result.inputs.previousCycles)],
                [
                  "Lowest oocyte yield",
                  result.inputs.lowestRetrieved === null
                    ? "—"
                    : String(result.inputs.lowestRetrieved),
                ],
                [
                  "Most recent yield",
                  result.inputs.latestRetrieved === null
                    ? "—"
                    : String(result.inputs.latestRetrieved),
                ],
                ["Last cycle outcome", result.inputs.latestOutcome ?? "—"],
                [
                  "Poor / suboptimal response documented",
                  result.inputs.documentedPoorResponse ? "Yes" : "No",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Evidence */}
      <section className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4 text-primary" /> Evidence — published criteria applied
        </h3>
        <ul className="mt-4 grid gap-3">
          {result.evidence.map((id) => {
            const e = findEvidence(id);
            if (!e) return null;
            return (
              <li key={id} className="rounded-xl border border-border/60 bg-muted/25 p-4">
                <p className="text-sm font-semibold">{e.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{e.authors.join(", ")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{e.journal}</span>
                  <span>{e.year}</span>
                  <span>DOI: {e.doi ?? "—"}</span>
                  {e.url ? (
                    <a
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      External link <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span>External link: —</span>
                  )}
                </div>
              </li>
            );
          })}
          <li className="rounded-xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
            Reserved for future guideline references mapped to this module.
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          This module classifies only. It does not recommend treatment, protocols, medications,
          doses, triggers or embryo transfer, and it does not predict pregnancy or live birth.
        </p>
      </section>
    </div>
  );
}
