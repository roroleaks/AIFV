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
  evidenceStateLabel,
  evidenceStateTone,
  protocolSelectionReportText,
  type EvidenceState,
  type ProtocolOptionAssessment,
  type ProtocolSelectionResult,
} from "@/lib/engine/protocol-selection";
import {
  protocolDecisionLabel,
  useProtocolDecision,
  type ProtocolDecisionKind,
} from "@/lib/engine/protocol-decision-store";
import { algorithmStatusLabel } from "@/lib/engine/algorithm-status";
import {
  ClinicalSafetyBanner,
  HistoricalBadge,
  HistoricalValueNote,
} from "@/components/engine/clinical-safety-banner";

function StateBadge({ state }: { state: EvidenceState }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full text-[10px] uppercase tracking-wide", evidenceStateTone[state])}
    >
      {evidenceStateLabel[state]}
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

/* ------------------------------------------------------------ option card */

function ProtocolCard({ option }: { option: ProtocolOptionAssessment }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="flex flex-wrap items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Stethoscope className="size-5" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h4 className="text-sm font-semibold">{option.name}</h4>
          <p className="text-xs text-muted-foreground">{option.category}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{option.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StateBadge state={option.evidenceState} />
          <StateBadge state={option.populationMatch} />
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
            Rule: {algorithmStatusLabel[option.algorithmStatus]}
          </Badge>
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        {option.applicability}
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
          {open ? "Collapse evidence" : "Expand evidence"}
        </Button>

        {open && (
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Population studied
              </p>
              <p className="mt-1 text-xs leading-relaxed">{option.populationStudied}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Inclusion criteria as stated
                </p>
                <ul className="mt-1 grid gap-1 text-xs">
                  {option.inclusion.map((x) => (
                    <li key={x}>• {x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Exclusion criteria as stated
                </p>
                <ul className="mt-1 grid gap-1 text-xs">
                  {option.exclusion.map((x) => (
                    <li key={x}>• {x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Reported advantages
                </p>
                <ul className="mt-1 grid gap-1 text-xs">
                  {option.advantages.map((x) => (
                    <li key={x}>• {x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Reported limitations
                </p>
                <ul className="mt-1 grid gap-1 text-xs">
                  {option.limitations.map((x) => (
                    <li key={x}>• {x}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Patient relevance
              </p>
              <div className="mt-2 grid gap-2">
                {option.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium">{c.label}</p>
                      <StateBadge state={c.state} />
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
                      {c.publication} {c.year ? `· ${c.year}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {c.mainStatement}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]">
                        <Link to="/evidence/$id" params={{ id: c.evidenceId }}>
                          <BookOpen className="size-3.5" /> View source
                        </Link>
                      </Button>
                      {c.url && (
                        <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5 text-[11px]">
                          <a href={c.url} target="_blank" rel="noreferrer noopener">
                            <ExternalLink className="size-3.5" /> {c.doi ?? "Publisher"}
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
                Missing evidence for a selection rule
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

export function ProtocolSelectionSection({ result }: { result: ProtocolSelectionResult }) {
  const compareRef = useRef<HTMLDivElement>(null);
  const { decision, save, clear } = useProtocolDecision(result.patientId);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<ProtocolDecisionKind>("defer");
  const [protocolName, setProtocolName] = useState<string>(result.options[0]?.name ?? "");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const reportText = useMemo(
    () =>
      protocolSelectionReportText(
        result,
        decision
          ? {
              label: protocolDecisionLabel[decision.kind],
              protocol: decision.protocol,
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

      {/* phenotype context */}
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
          POSEIDON and Bologna are shown as inputs to this evidence review. Neither is converted
          into a protocol recommendation: no transcribed evidence maps a classification group to a
          protocol.
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
              <dl className="mt-2 grid gap-1">
                {g.items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{it.label}</dt>
                    <dd className={cn("text-right font-medium", !it.present && "text-muted-foreground/70 font-normal")}>
                      {it.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Card>

      {/* previous response */}
      <Card
        icon={History}
        title="Previous stimulation response"
        badge={<HistoricalBadge />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Predicted poor response (model output)
            </p>
            <p className="mt-1 text-sm font-semibold">{result.predictedVsObserved.predictedCategory}</p>
            <ul className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
              {result.predictedVsObserved.predictedBasis.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Observed response (recorded outcome)
            </p>
            {result.predictedVsObserved.observedAvailable ? (
              <ul className="mt-2 grid gap-1 text-xs">
                {result.predictedVsObserved.observedStatements.map((o) => (
                  <li key={o}>• {o}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No completed previous stimulation cycle with a recorded oocyte yield.
              </p>
            )}
            <HistoricalValueNote className="mt-2" />
          </div>
        </div>

        <p className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {result.predictedVsObserved.distinctionNote}
        </p>

        {result.previousCycles.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Cycle</th>
                  <th className="py-2 pr-3 font-semibold">Protocol</th>
                  <th className="py-2 pr-3 font-semibold">Gonadotropin</th>
                  <th className="py-2 pr-3 font-semibold">Starting dose</th>
                  <th className="py-2 pr-3 font-semibold">Duration</th>
                  <th className="py-2 pr-3 font-semibold">Retrieved</th>
                  <th className="py-2 pr-3 font-semibold">MII</th>
                  <th className="py-2 pr-3 font-semibold">Blastocysts</th>
                  <th className="py-2 pr-3 font-semibold">Pregnancy</th>
                  <th className="py-2 pr-3 font-semibold">OHSS</th>
                  <th className="py-2 pr-3 font-semibold">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {result.previousCycles.map((c) => (
                  <tr key={c.label} className="border-t border-border/60">
                    <td className="py-2 pr-3 font-medium">{c.label}</td>
                    <td className="py-2 pr-3">{c.protocol}</td>
                    <td className="py-2 pr-3">{c.gonadotropin}</td>
                    <td className="py-2 pr-3">{c.startingDose}</td>
                    <td className="py-2 pr-3">{c.duration}</td>
                    <td className="py-2 pr-3">{c.retrieved}</td>
                    <td className="py-2 pr-3">{c.mii}</td>
                    <td className="py-2 pr-3">{c.blastocysts}</td>
                    <td className="py-2 pr-3">{c.pregnancy}</td>
                    <td className="py-2 pr-3">{c.ohss}</td>
                    <td className="py-2 pr-3">{c.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <HistoricalValueNote className="mt-2" />
          </div>
        )}
      </Card>

      {/* options */}
      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Protocol options with indexed evidence</h3>
        {result.options.map((o) => (
          <ProtocolCard key={o.id} option={o} />
        ))}
      </div>

      {/* comparison */}
      <div ref={compareRef}>
        <Card icon={Columns3} title="Protocol comparison — evidence review, not a ranking">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Dimension</th>
                  {result.options.map((o) => (
                    <th key={o.id} className="py-2 pr-3 font-semibold">
                      {o.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.comparison.map((row) => (
                  <tr key={row.id} className="border-t border-border/60 align-top">
                    <td className="py-2.5 pr-3 font-medium">{row.label}</td>
                    {row.cells.map((c) => (
                      <td key={`${row.id}-${c.optionId}`} className="py-2.5 pr-3">
                        <StateBadge state={c.state} />
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {c.detail}
                        </p>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] italic text-muted-foreground">
            No protocol is ranked and no “best protocol” is displayed: no validated evidence rule
            supporting such a conclusion is loaded.
          </p>
        </Card>
      </div>

      {/* cautions */}
      <Card icon={AlertTriangle} title="Cautions, population mismatch and evidence limitations">
        {result.cautions.length ? (
          <ul className="grid gap-2">
            {result.cautions.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "rounded-xl border px-3.5 py-2.5 text-xs",
                  c.severity === "high"
                    ? "border-rose-500/40 bg-rose-500/5"
                    : c.severity === "moderate"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-sky-500/40 bg-sky-500/5",
                )}
              >
                <p className="font-medium">{c.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.source}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No caution derived from the recorded data. Contraindications are never invented.
          </p>
        )}
      </Card>

      {/* missing information */}
      <Card icon={ClipboardList} title="Missing information">
        {result.missingInformation.length ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              The evidence review below remains available. None of these fields is required by a
              validated algorithm, so nothing is blocked.
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {result.missingInformation.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-xs"
                >
                  <span>{m.label}</span>
                  <Button asChild size="sm" variant="ghost" className="h-6 text-[11px]">
                    <Link to="/assessment">Enter</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">All reviewed fields are recorded.</p>
        )}
      </Card>

      {/* CONSORT firewall */}
      <Card
        icon={Lock}
        title="CONSORT firewall — no dose enters protocol selection"
        badge={
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
            {algorithmStatusLabel[result.consortFirewall.status]}
          </Badge>
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">CONSORT status</p>
            <p className="font-semibold">{algorithmStatusLabel[result.consortFirewall.status]}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Starting dose</p>
            <p className="font-semibold">{result.consortFirewall.doseDisplay}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Model table loaded</p>
            <p className="font-semibold">{result.consortFirewall.modelLoaded ? "Yes" : "No"}</p>
          </div>
        </div>
        <ul className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
          {result.consortFirewall.statements.map((st) => (
            <li key={st}>• {st}</li>
          ))}
        </ul>
      </Card>

      {/* physician decision */}
      <Card
        icon={ShieldCheck}
        title="Physician protocol decision"
        badge={
          decision ? (
            <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
              Recorded
            </Badge>
          ) : undefined
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Everything above is an <strong>evidence review</strong>. The <strong>clinical decision</strong>{" "}
          below is made and recorded by the treating physician.
        </p>

        {decision && !editing && (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-xs">
            <p className="font-semibold">{protocolDecisionLabel[decision.kind]}</p>
            {decision.protocol && <p className="mt-0.5">Protocol: {decision.protocol}</p>}
            {decision.note && <p className="mt-0.5 text-muted-foreground">Note: {decision.note}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Recorded {new Date(decision.decidedAt).toLocaleString()} by {decision.decidedBy}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setKind(decision.kind);
                  setProtocolName(decision.protocol ?? result.options[0]?.name ?? "");
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
              {(
                [
                  "select-protocol",
                  "defer",
                  "need-more-information",
                  "evidence-insufficient",
                ] as ProtocolDecisionKind[]
              ).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={kind === k ? "default" : "outline"}
                  onClick={() => setKind(k)}
                >
                  {protocolDecisionLabel[k]}
                </Button>
              ))}
            </div>

            {kind === "select-protocol" && (
              <div className="flex flex-wrap gap-2">
                {result.options.map((o) => (
                  <Button
                    key={o.id}
                    size="sm"
                    variant={protocolName === o.name ? "secondary" : "outline"}
                    onClick={() => setProtocolName(o.name)}
                  >
                    {o.name}
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
                    protocol: kind === "select-protocol" ? protocolName : null,
                    note,
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
