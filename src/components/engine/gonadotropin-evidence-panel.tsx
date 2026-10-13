import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ClipboardCopy,
  ClipboardList,
  Columns3,
  ExternalLink,
  FileText,
  FlaskConical,
  History,
  Lock,
  Printer,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applicabilityLabel,
  applicabilityTone,
  gonadotropinEvidenceReportText,
  NOT_REPORTED,
  type Applicability,
  type GonadotropinEvidenceResult,
  type GonadotropinOptionAssessment,
} from "@/lib/engine/gonadotropin-evidence";
import { evidenceStateLabel, evidenceStateTone } from "@/lib/engine/protocol-selection";
import {
  gonadotropinDecisionKinds,
  gonadotropinDecisionLabel,
  isSelectionKind,
  useGonadotropinDecision,
  type GonadotropinDecisionKind,
} from "@/lib/engine/gonadotropin-decision-store";
import { algorithmStatusLabel } from "@/lib/engine/algorithm-status";
import {
  ClinicalSafetyBanner,
  HistoricalBadge,
  HistoricalValueNote,
} from "@/components/engine/clinical-safety-banner";

function ApplicabilityBadge({ value }: { value: Applicability }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full text-[10px] uppercase tracking-wide", applicabilityTone[value])}
    >
      {applicabilityLabel[value]}
    </Badge>
  );
}

function Card({
  icon: Icon,
  title,
  badge,
  children,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
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

function OutcomeList({
  title,
  rows,
}: {
  title: string;
  rows: GonadotropinOptionAssessment["primaryOutcomes"];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1 grid gap-1 text-xs">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-medium">{r.label}:</span>
            <span className={cn(!r.reported && "italic text-muted-foreground")}>{r.finding}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ option card */

function GonadotropinCard({ option }: { option: GonadotropinOptionAssessment }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="flex flex-wrap items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <FlaskConical className="size-5" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h4 className="text-sm font-semibold">{option.name}</h4>
          <p className="text-xs text-muted-foreground">
            {option.category} · {option.preparation}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{option.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-[10px] uppercase tracking-wide",
              evidenceStateTone[option.evidenceState],
            )}
          >
            {evidenceStateLabel[option.evidenceState]}
          </Badge>
          <ApplicabilityBadge value={option.applicability} />
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
            Rule: {algorithmStatusLabel[option.algorithmStatus]}
          </Badge>
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        {option.applicabilityExplanation}
      </div>

      <div className="border-t border-border/60 px-5 py-3">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          {open ? "Collapse evidence" : "View evidence"}
        </Button>

        {open && (
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Why this option is being considered
              </p>
              <ul className="mt-1 grid gap-1 text-xs">
                {option.whyConsidered.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Population studied
                </p>
                <p className="mt-1 text-xs leading-relaxed">{option.populationStudied}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Study design · comparator
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  {option.studyDesigns.join(", ")} — {option.comparator}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <OutcomeList title="Primary outcomes" rows={option.primaryOutcomes} />
              <OutcomeList title="Secondary outcomes" rows={option.secondaryOutcomes} />
              <OutcomeList title="Safety outcomes" rows={option.safetyOutcomes} />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Contraindications and cautions
              </p>
              {option.cautions.length ? (
                <ul className="mt-1 grid gap-1 text-xs">
                  {option.cautions.map((c) => (
                    <li key={c.text}>
                      • {c.text} <span className="text-muted-foreground">({c.source})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  No contraindication or caution is displayed: none is transcribed from an indexed
                  source for this preparation.
                </p>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Evidence limitations
              </p>
              <ul className="mt-1 grid gap-1 text-xs">
                {option.limitations.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Patient applicability
              </p>
              <div className="mt-2 grid gap-2">
                {option.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium">{c.label}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px] uppercase tracking-wide",
                          evidenceStateTone[c.state],
                        )}
                      >
                        {evidenceStateLabel[c.state]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Evidence population: {c.evidencePopulation}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Patient: {c.patientValue}</p>
                    <p className="mt-1 text-[11px] italic text-muted-foreground">{c.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Evidence sources
              </p>
              <div className="mt-2 grid gap-2">
                {option.citations.map((c) => (
                  <div
                    key={c.evidenceId}
                    className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
                  >
                    <p className="text-xs font-medium">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.publication} {c.year ? `· ${c.year}` : ""} · {c.studyDesign}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {c.mainStatement}
                    </p>
                    <ul className="mt-1 grid gap-0.5 text-[11px] text-muted-foreground">
                      {c.limitations.map((l) => (
                        <li key={l}>• {l}</li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-[11px]"
                      >
                        <Link to="/evidence/$id" params={{ id: c.evidenceId }}>
                          <BookOpen className="size-3.5" /> View source
                        </Link>
                      </Button>
                      {c.doi && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-[11px]"
                        >
                          <a
                            href={`https://doi.org/${c.doi}`}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <ExternalLink className="size-3.5" /> Open DOI
                          </a>
                        </Button>
                      )}
                      {c.url && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-[11px]"
                        >
                          <a href={c.url} target="_blank" rel="noreferrer noopener">
                            <ExternalLink className="size-3.5" /> Open journal
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                Evidence algorithm pending — missing for a selection rule
              </p>
              <ul className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
                {option.missingEvidence.map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
              <Button asChild size="sm" variant="outline" className="mt-2 h-7 gap-1.5 text-[11px]">
                <Link to="/evidence-requirements">
                  <ClipboardList className="size-3.5" /> Open Evidence Requirements
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ main panel */

export function GonadotropinEvidenceSection({ result }: { result: GonadotropinEvidenceResult }) {
  const compareRef = useRef<HTMLDivElement>(null);
  const { decision, save, clear } = useGonadotropinDecision(result.patientId);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<GonadotropinDecisionKind>("defer");
  const [medName, setMedName] = useState<string>(result.options[0]?.name ?? "");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const reportText = useMemo(
    () =>
      gonadotropinEvidenceReportText(
        result,
        decision
          ? {
              label: gonadotropinDecisionLabel[decision.kind],
              gonadotropin: decision.gonadotropin,
              note: decision.note,
            }
          : null,
      ),
    [result, decision],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const showForm = editing || !decision;

  return (
    <div className="grid gap-5">
      <ClinicalSafetyBanner />

      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <Columns3 className="size-4" /> Compare
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/protocols">
            <Stethoscope className="size-4" /> Return to protocol
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/assessment">
            <UserRound className="size-4" /> Return to assessment
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/reports">
            <FileText className="size-4" /> View report
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/evidence-requirements">
            <ClipboardList className="size-4" /> Evidence requirements
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={copy}>
          <ClipboardCopy className="size-4" /> {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      {/* protocol integration */}
      <Card icon={Stethoscope} title="Current protocol context">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Current protocol</p>
            <p className="font-semibold">{result.protocolIntegration.protocolName}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Protocol evidence status</p>
            <p className="font-semibold">{result.protocolIntegration.protocolEvidenceStatus}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Protocol decision status</p>
            <p className="font-semibold">{result.protocolIntegration.protocolDecisionStatus}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] italic text-muted-foreground">
          {result.protocolIntegration.note}
        </p>
      </Card>

      {/* patient context */}
      <Card icon={UserRound} title="Patient context received from the assessment">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full">
            POSEIDON: {result.poseidonGroup ?? result.poseidonHeadline}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Bologna: {result.bolognaStatus}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Reserve: {result.reserveCategory}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Predicted response: {result.predictedResponse}
          </Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          POSEIDON and Bologna are shown as patient context for this evidence review. Neither is
          converted into a medication choice: no indexed source maps a classification group to a
          gonadotropin preparation.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {result.contextGroups.map((g) => (
            <div key={g.id} className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {g.title}
                <span>
                  {g.recorded}/{g.total}
                </span>
              </p>
              <ul className="mt-2 grid gap-1 text-xs">
                {g.items.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span className={cn("font-medium", !it.present && "text-muted-foreground")}>
                      {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* previous exposure */}
      <Card icon={History} title="Previous gonadotropin experience" badge={<HistoricalBadge />}>
        {result.previousExposure.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] border-collapse text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Cycle</th>
                    <th className="py-2 pr-3 font-semibold">Gonadotropin</th>
                    <th className="py-2 pr-3 font-semibold">Brand</th>
                    <th className="py-2 pr-3 font-semibold">Starting dose</th>
                    <th className="py-2 pr-3 font-semibold">Max dose</th>
                    <th className="py-2 pr-3 font-semibold">Dose changes</th>
                    <th className="py-2 pr-3 font-semibold">Total exposure</th>
                    <th className="py-2 pr-3 font-semibold">Duration</th>
                    <th className="py-2 pr-3 font-semibold">Oocytes</th>
                    <th className="py-2 pr-3 font-semibold">MII</th>
                    <th className="py-2 pr-3 font-semibold">Blastocysts</th>
                    <th className="py-2 pr-3 font-semibold">Outcome</th>
                    <th className="py-2 pr-3 font-semibold">Complications</th>
                  </tr>
                </thead>
                <tbody>
                  {result.previousExposure.map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="py-2 pr-3 font-medium">{p.label}</td>
                      <td className="py-2 pr-3">{p.gonadotropinType}</td>
                      <td className="py-2 pr-3">{p.brand}</td>
                      <td className="py-2 pr-3">{p.startingDose}</td>
                      <td className="py-2 pr-3">{p.maxDose}</td>
                      <td className="py-2 pr-3">{p.doseChanges}</td>
                      <td className="py-2 pr-3">{p.totalDose}</td>
                      <td className="py-2 pr-3">{p.duration}</td>
                      <td className="py-2 pr-3">{p.retrieved}</td>
                      <td className="py-2 pr-3">{p.mii}</td>
                      <td className="py-2 pr-3">{p.blastocysts}</td>
                      <td className="py-2 pr-3">{p.outcome}</td>
                      <td className="py-2 pr-3">{p.complications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <HistoricalValueNote className="mt-2" />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No previous stimulation cycle is recorded for this patient.
          </p>
        )}
        <p className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {result.previousExposureNote}
        </p>
      </Card>

      {/* options */}
      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">
          Gonadotropin options with an indexed evidence record
        </h3>
        {result.options.map((o) => (
          <GonadotropinCard key={o.id} option={o} />
        ))}
      </div>

      {/* comparison */}
      <div ref={compareRef}>
        <Card icon={Columns3} title="Gonadotropin comparison — evidence review, not a ranking">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Gonadotropin</th>
                  <th className="py-2 pr-3 font-semibold">Evidence population</th>
                  <th className="py-2 pr-3 font-semibold">Study type</th>
                  <th className="py-2 pr-3 font-semibold">Clinical outcomes</th>
                  <th className="py-2 pr-3 font-semibold">Safety</th>
                  <th className="py-2 pr-3 font-semibold">Applicability</th>
                  <th className="py-2 pr-3 font-semibold">Evidence status</th>
                </tr>
              </thead>
              <tbody>
                {result.comparison.map((row) => (
                  <tr key={row.id} className="border-t border-border/60 align-top">
                    <td className="py-2.5 pr-3 font-medium">{row.name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{row.evidencePopulation}</td>
                    <td className="py-2.5 pr-3">{row.studyType}</td>
                    <td className="py-2.5 pr-3 italic text-muted-foreground">
                      {row.clinicalOutcomes}
                    </td>
                    <td className="py-2.5 pr-3 italic text-muted-foreground">{row.safety}</td>
                    <td className="py-2.5 pr-3">
                      <ApplicabilityBadge value={row.applicability} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px] uppercase tracking-wide",
                          evidenceStateTone[row.evidenceState],
                        )}
                      >
                        {evidenceStateLabel[row.evidenceState]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] italic text-muted-foreground">
            No preparation is ranked and no “best”, “preferred” or “superior” medication is
            displayed: no validated evidence rule supporting such a conclusion is loaded. Outcome
            cells read “{NOT_REPORTED}”.
          </p>
        </Card>
      </div>

      {/* patient-specific evidence summary */}
      <Card icon={ShieldCheck} title="Patient-specific gonadotropin evidence summary">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Phenotype and previous exposure
            </p>
            <ul className="mt-2 grid gap-1 text-xs">
              {result.patientEvidenceSummary.phenotype.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
            {result.observedAvailable && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Observed previous response
                </p>
                <ul className="mt-1 grid gap-1 text-xs">
                  {result.observedResponse.map((o) => (
                    <li key={o}>• {o}</li>
                  ))}
                </ul>
                <HistoricalValueNote className="mt-2" />
              </>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Relevant evidence
            </p>
            <ul className="mt-2 grid gap-1 text-xs">
              {result.patientEvidenceSummary.relevantEvidence.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Evidence applicability
            </p>
            <ul className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
              {result.patientEvidenceSummary.applicability.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            Evidence limitations
          </p>
          <ul className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
            {result.patientEvidenceSummary.limitations.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        </div>
      </Card>

      {/* missing information */}
      <Card icon={AlertTriangle} title="Missing information">
        {result.missingInformation.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {result.missingInformation.map((g) => (
              <div key={g.id} className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {g.title}
                </p>
                <ul className="mt-2 grid gap-1.5 text-xs">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-2">
                      <span>{it.label}</span>
                      <Button asChild size="sm" variant="ghost" className="h-6 text-[11px]">
                        <Link to="/assessment">Open</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">All reviewed fields are recorded.</p>
        )}
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Evidence gaps blocking a selection rule
          </p>
          <ul className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
            {result.evidenceGaps.map((g) => (
              <li key={g.item}>
                • {g.item} — {g.source}. {g.blocks}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* firewalls */}
      <Card
        icon={Lock}
        title="Dose firewall and CONSORT firewall"
        badge={
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
            {algorithmStatusLabel[result.consortFirewall.status]}
          </Badge>
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Dose produced by this engine</p>
            <p className="font-semibold">—</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">CONSORT dose</p>
            <p className="font-semibold">{result.consortFirewall.doseDisplay}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">CONSORT model table loaded</p>
            <p className="font-semibold">{result.consortFirewall.modelLoaded ? "Yes" : "No"}</p>
          </div>
        </div>
        <ul className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
          {[...result.doseFirewall.statements, ...result.consortFirewall.statements].map((st) => (
            <li key={st}>• {st}</li>
          ))}
        </ul>
      </Card>

      {/* physician decision */}
      <Card
        icon={ShieldCheck}
        title="Physician gonadotropin decision"
        badge={
          decision ? (
            <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
              Physician-selected
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
              Not selected
            </Badge>
          )
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Everything above is an <strong>evidence review</strong>. The{" "}
          <strong>medication decision</strong> below is made and recorded by the treating physician
          and is labelled <strong>Physician-selected</strong> — never AI-prescribed. No dose is
          recorded here.
        </p>

        {decision && !editing && (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-xs">
            <p className="font-semibold">{gonadotropinDecisionLabel[decision.kind]}</p>
            {decision.gonadotropin && (
              <p className="mt-0.5">Gonadotropin: {decision.gonadotropin}</p>
            )}
            {decision.note && <p className="mt-0.5 text-muted-foreground">Note: {decision.note}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {decision.origin} · recorded {new Date(decision.decidedAt).toLocaleString()} by{" "}
              {decision.decidedBy} · patient context v{decision.patientContextVersion} · evidence
              review v{decision.evidenceVersion}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setKind(decision.kind);
                  setMedName(decision.gonadotropin ?? result.options[0]?.name ?? "");
                  setNote(decision.note);
                  setEditing(true);
                }}
              >
                Change selection
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setKind(decision.kind);
                  setMedName(decision.gonadotropin ?? result.options[0]?.name ?? "");
                  setNote(decision.note);
                  setEditing(true);
                }}
              >
                Edit decision
              </Button>
              <Button size="sm" variant="ghost" onClick={clear}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {gonadotropinDecisionKinds.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={kind === k ? "default" : "outline"}
                  onClick={() => setKind(k)}
                >
                  {gonadotropinDecisionLabel[k]}
                </Button>
              ))}
            </div>

            {isSelectionKind(kind) && (
              <div className="flex flex-wrap gap-2">
                {result.options.map((o) => (
                  <Button
                    key={o.id}
                    size="sm"
                    variant={medName === o.name ? "secondary" : "outline"}
                    onClick={() => setMedName(o.name)}
                  >
                    Select {o.name}
                  </Button>
                ))}
              </div>
            )}

            <label className="grid gap-1 text-xs">
              <span className="font-medium">Decision note</span>
              <textarea
                className="min-h-[4.5rem] rounded-xl border border-border/70 bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Physician rationale for this decision (free text)"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  save({
                    patientId: result.patientId,
                    patientName: result.patientName,
                    kind,
                    gonadotropin: isSelectionKind(kind) ? medName : null,
                    note,
                    origin: "Physician-selected",
                    patientContextVersion: result.version,
                    evidenceVersion: result.version,
                    decidedBy: "Clinician (local session)",
                    decidedAt: new Date().toISOString(),
                  });
                  setEditing(false);
                }}
              >
                Save decision
              </Button>
              {decision && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
