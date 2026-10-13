import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  ExternalLink,
  FlaskConical,
  History,
  Layers,
  Lock,
  Microscope,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  bolognaStatusLabel,
  type BolognaCriterion,
  type BolognaResult,
} from "@/lib/engine/bologna";
import {
  futurePhenotypeModules,
  phenotypeLabels,
  phenotypeTone,
  reserveCategoryLabel,
  type PhenotypeResult,
} from "@/lib/engine/phenotype";
import { responseCategoryLabel, type OvarianResponseResult } from "@/lib/engine/ovarian-response";
import { formatDuration } from "@/lib/assessment/derived";
import type { StoredPhenotypeAssessment } from "@/lib/engine/phenotype-store";

const toneClass: Record<string, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function CardShell({
  icon: Icon,
  title,
  badge,
  children,
  className,
}: {
  icon: typeof UserRound;
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

function Expandable({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
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

const criterionIcon = (state: BolognaCriterion["state"]) =>
  state === "met" ? CheckCircle2 : state === "not-met" ? XCircle : CircleDashed;

const criterionTone = (state: BolognaCriterion["state"]) =>
  state === "met"
    ? "text-emerald-600 dark:text-emerald-400"
    : state === "not-met"
      ? "text-muted-foreground"
      : "text-amber-600 dark:text-amber-400";

/* ---------------------------------------------------------------- cards */

export function PatientSummaryCard({ result, name }: { result: PhenotypeResult; name: string }) {
  const s = result.patientSummary;
  return (
    <CardShell
      icon={UserRound}
      title="Patient summary"
      badge={
        <Badge variant="outline" className="rounded-full">
          {name}
        </Badge>
      }
    >
      <dl className="grid gap-2 sm:grid-cols-2">
        <Cell label="Age" value={s.age === null ? "—" : `${s.age} y`} />
        <Cell label="BMI" value={s.bmi === null ? "—" : `${s.bmi} kg/m²`} />
        <Cell
          label="Infertility duration"
          value={
            s.infertilityDurationMonths === null
              ? "—"
              : `${formatDuration(s.infertilityDurationMonths)}${s.infertilityType ? ` · ${s.infertilityType}` : ""}`
          }
        />
        <Cell label="Previous IVF cycles" value={String(s.previousCycles)} />
      </dl>
      <div className="mt-3">
        <p className="text-xs text-muted-foreground">Diagnosis</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {s.diagnosis.length === 0 ? (
            <span className="text-sm text-muted-foreground">Not recorded</span>
          ) : (
            s.diagnosis.map((d) => (
              <Badge key={d} variant="secondary" className="rounded-lg text-[11px]">
                {d}
              </Badge>
            ))
          )}
        </div>
      </div>
    </CardShell>
  );
}

export function OvarianReserveCard({ result }: { result: PhenotypeResult }) {
  const r = result.reserve;
  return (
    <CardShell
      icon={FlaskConical}
      title="Ovarian reserve"
      badge={
        <Badge
          variant="outline"
          className={cn(
            "rounded-full",
            r.category === "insufficient-data"
              ? toneClass["blue"]
              : r.category === "normal"
                ? toneClass["green"]
                : r.category === "high"
                  ? toneClass["violet"]
                  : r.category === "reduced"
                    ? toneClass["amber"]
                    : toneClass["red"],
          )}
        >
          {reserveCategoryLabel[r.category]}
        </Badge>
      }
    >
      <dl className="grid gap-2 sm:grid-cols-2">
        <Cell label="Age" value={r.age === null ? "—" : `${r.age} y`} />
        <Cell label="AMH" value={r.amh === null ? "—" : `${r.amh} ng/mL`} />
        <Cell label="Antral follicle count" value={r.afc === null ? "—" : String(r.afc)} />
        <Cell label="Basal FSH" value={r.fsh === null ? "—" : `${r.fsh} IU/L`} />
      </dl>
      <Expandable label="Which variables contributed">
        {r.contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No biomarker is recorded, so no category can be summarised.
          </p>
        ) : (
          <ul className="grid gap-2">
            {r.contributors.map((c, i) => (
              <li key={i} className="text-sm text-foreground/85">
                • {c}
              </li>
            ))}
          </ul>
        )}
        {r.missing.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Not recorded: {r.missing.join(", ")}.
          </p>
        )}
      </Expandable>
    </CardShell>
  );
}

export function PoseidonPhenotypeCard({ result }: { result: PhenotypeResult }) {
  const p = result.poseidon;
  return (
    <CardShell
      icon={Microscope}
      title="POSEIDON assessment"
      badge={
        <Badge variant="outline" className={cn("rounded-full", toneClass[p.tone])}>
          {p.group ? `Group ${p.group}` : "No group assigned"}
        </Badge>
      }
    >
      <p className="text-sm font-medium">{p.headline}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {p.groupTitle ?? "Classification withheld."}
      </p>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Data completeness</span>
          <span>{p.confidence}%</span>
        </div>
        <Progress value={p.confidence} className="h-1.5" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="rounded-lg text-[11px] capitalize">
          Data {p.dataQuality}
        </Badge>
        {p.evidence.map((id) => {
          const e = findEvidence(id);
          return (
            <Link key={id} to="/evidence/$id" params={{ id }}>
              <Badge variant="outline" className="rounded-lg text-[11px] hover:bg-muted">
                {e ? `${e.journal} ${e.year}` : id}
              </Badge>
            </Link>
          );
        })}
      </div>

      <Expandable label="Explanation">
        <ul className="grid gap-2">
          {p.rationale.map((r, i) => (
            <li key={i} className="text-sm text-foreground/85">
              • {r}
            </li>
          ))}
        </ul>
        <Button asChild size="sm" variant="outline" className="mt-3 print:hidden">
          <Link to="/poseidon">
            Open POSEIDON module <ArrowRight className="size-4" />
          </Link>
        </Button>
      </Expandable>
    </CardShell>
  );
}

export function BolognaCard({ result }: { result: BolognaResult }) {
  return (
    <CardShell
      icon={ClipboardList}
      title="Bologna assessment"
      badge={
        <Badge variant="outline" className={cn("rounded-full", toneClass[result.tone])}>
          {bolognaStatusLabel[result.status]}
        </Badge>
      }
    >
      <p className="text-sm font-medium">{result.headline}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        ESHRE consensus definition of poor ovarian response (Ferraretti et al., Hum Reprod 2011) —{" "}
        {result.featuresMet} of 3 published features confirmed.
      </p>

      <ul className="mt-4 grid gap-2">
        {[...result.satisfied, ...result.notSatisfied, ...result.unknown].map((c) => {
          const Icon = criterionIcon(c.state);
          return (
            <li key={c.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <Icon className={cn("mt-0.5 size-4 shrink-0", criterionTone(c.state))} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                </div>
                <Badge
                  variant="secondary"
                  className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
                >
                  {c.state === "met" ? "Met" : c.state === "not-met" ? "Not met" : "Unknown"}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>

      {result.missing.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Required missing information
          </p>
          <p className="mt-1 text-xs text-foreground/80">
            Missing {result.missing.join("; missing ")}.
          </p>
        </div>
      )}

      <Expandable label="Explanation">
        <ul className="grid gap-2">
          {result.rationale.map((r, i) => (
            <li key={i} className="text-sm text-foreground/85">
              • {r}
            </li>
          ))}
        </ul>
      </Expandable>
    </CardShell>
  );
}

export function OverallPhenotypeCard({ result }: { result: PhenotypeResult }) {
  const tone = phenotypeTone[result.phenotype];
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
          <Sparkles className="size-3.5" /> Overall phenotype
        </p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          {phenotypeLabels[result.phenotype]}
        </h2>
        <ul className="mt-3 grid gap-2">
          {result.phenotypeRationale.map((r, i) => (
            <li key={i} className="text-sm text-foreground/85">
              • {r}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-foreground/70">
          Descriptive phenotype derived from published assessment frameworks only. No treatment,
          protocol, medication, dose or outcome prediction is expressed or implied.
        </p>
      </div>
    </section>
  );
}

export function MissingDataPanel({ result }: { result: PhenotypeResult }) {
  return (
    <CardShell
      icon={AlertTriangle}
      title="Missing information"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.missing.length} item{result.missing.length === 1 ? "" : "s"}
        </Badge>
      }
    >
      {result.missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> All variables consumed by the current assessment
          engines are recorded.
        </p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.missing.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-sm"
              >
                {m.label}
              </li>
            ))}
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-3 print:hidden">
            <Link to="/assessment">
              Complete in patient assessment <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      )}
    </CardShell>
  );
}

export function PhenotypeTimeline({ entries }: { entries: StoredPhenotypeAssessment[] }) {
  return (
    <CardShell icon={History} title="Physician timeline — assessment history">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assessment has been recorded for this data source yet.
        </p>
      ) : (
        <ol className="relative grid gap-4 border-l border-border/70 pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
              <p className="text-sm font-medium">
                {phenotypeLabels[e.phenotype]}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · Phenotype Engine v{e.version}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                POSEIDON: {e.poseidonGroup ? `Group ${e.poseidonGroup}` : e.poseidonStatus} ·
                Bologna: {bolognaStatusLabel[e.bolognaStatus]} · Reserve:{" "}
                {reserveCategoryLabel[e.reserveCategory]}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {new Date(e.assessedAt).toLocaleString()} · {e.missingCount} missing variable(s)
              </p>
            </li>
          ))}
        </ol>
      )}
    </CardShell>
  );
}

export function PhenotypeEvidencePanel({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => !!e);
  return (
    <CardShell icon={BookOpen} title="Evidence used">
      <ul className="grid gap-3">
        {entries.map((e) => (
          <li key={e.id} className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link
                to="/evidence/$id"
                params={{ id: e.id }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {e.title}
              </Link>
              <Badge variant="secondary" className="rounded-lg text-[10px]">
                Level {e.level}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {e.authors.slice(0, 3).join(", ")}
              {e.authors.length > 3 ? " et al." : ""} · {e.journal} · {e.year}
            </p>
            {e.doi && (
              <a
                href={e.url ?? `https://doi.org/${e.doi}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                doi:{e.doi} <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
        <li className="rounded-xl border border-dashed border-border/70 px-3.5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CircleDashed className="size-3.5" /> ASRM and ESHRE guideline sets are indexed for
            future modules and are not consumed by this assessment.
          </span>
        </li>
      </ul>
    </CardShell>
  );
}

export function PhenotypeSummaryPanel({
  result,
  response,
}: {
  result: PhenotypeResult;
  response?: OvarianResponseResult;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const evidenceNames = result.evidence
    .map((id) => findEvidence(id))
    .filter(Boolean)
    .map((e) => `${e!.journal} ${e!.year}`);

  return (
    <CardShell icon={Activity} title="Physician summary">
      <dl className="grid gap-2 sm:grid-cols-2">
        <Cell label="Patient phenotype" value={phenotypeLabels[result.phenotype]} />
        <Cell
          label="POSEIDON status"
          value={result.poseidon.group ? `Group ${result.poseidon.group}` : result.poseidon.status}
        />
        <Cell label="Bologna status" value={bolognaStatusLabel[result.bologna.status]} />
        <Cell label="Ovarian reserve" value={reserveCategoryLabel[result.reserve.category]} />
        <Cell
          label="Expected ovarian response"
          value={response ? responseCategoryLabel[response.category] : "Not assessed"}
        />
        <Cell
          label="Major clinical risks"
          value={
            response && response.risks.length > 0
              ? response.risks
                  .filter((r) => r.severity === "high")
                  .concat(response.risks.filter((r) => r.severity !== "high"))
                  .slice(0, 4)
                  .map((r) => r.label)
                  .join(", ")
              : "None supported by the recorded data"
          }
        />
        <Cell
          label="Assessment status"
          value={
            result.pendingAssessments.length === 0 && result.missing.length === 0
              ? "Complete"
              : `${result.completedAssessments.length} complete · ${result.pendingAssessments.length} pending`
          }
        />
        <Cell
          label="Assessment date"
          value={mounted ? new Date(result.computedAt).toLocaleString() : "—"}
        />
        <Cell
          label="Completed assessments"
          value={result.completedAssessments.join(", ") || "None"}
        />
        <Cell label="Pending assessments" value={result.pendingAssessments.join(", ") || "None"} />
        <Cell
          label="Missing information"
          value={
            result.missing.length === 0
              ? "None"
              : result.missing.map((m) => m.label.replace("Missing ", "")).join(", ")
          }
        />
        <Cell label="Evidence used" value={evidenceNames.join("; ") || "None"} />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Future modules ready to consume this phenotype:{" "}
        {futurePhenotypeModules.map((m) => m.name).join(", ")}. No treatment recommendation is
        produced.
      </p>
    </CardShell>
  );
}

export function FutureModulesPanel() {
  return (
    <CardShell icon={Layers} title="Prepared for future modules">
      <ul className="grid gap-2 sm:grid-cols-2">
        {futurePhenotypeModules.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
          >
            <Lock className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{m.name}</span>
            <Badge
              variant="secondary"
              className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
            >
              Locked
            </Badge>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        These engines are registered placeholders. They perform no calculation and produce no
        recommendation in this release.
      </p>
    </CardShell>
  );
}
