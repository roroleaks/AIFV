import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  ClipboardCopy,
  ClipboardList,
  ExternalLink,
  FlaskConical,
  History,
  Lock,
  ShieldCheck,
  Syringe,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  doseStateTone,
  matchStatusLabel,
  matchStatusTone,
  NOT_CALCULATED,
  startingDoseReportText,
  type AlgorithmAssessment,
  type StartingDoseResult,
} from "@/lib/engine/starting-dose";
import {
  startingDoseDecisionKinds,
  startingDoseDecisionLabel,
  useStartingDoseDecision,
  DOSE_UNITS,
  type StartingDoseDecision,
  type StartingDoseDecisionKind,
} from "@/lib/engine/starting-dose-store";
import { algorithmStatusTone } from "@/lib/engine/algorithm-status";
import {
  ClinicalSafetyBanner,
  HistoricalBadge,
  HistoricalValueNote,
} from "@/components/engine/clinical-safety-banner";

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
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-4.5" />
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function AlgorithmCard({ a }: { a: AlgorithmAssessment }) {
  return (
    <article className="rounded-xl border border-border/70 bg-background/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{a.name}</h3>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full text-[10px] uppercase tracking-wide",
            algorithmStatusTone[a.status],
          )}
        >
          {a.statusLabel}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full text-[10px] uppercase tracking-wide",
            matchStatusTone[a.matchStatus],
          )}
        >
          {matchStatusLabel[a.matchStatus]}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{a.source}</p>

      <div className="mt-3 grid gap-1 text-sm">
        <Row
          label="Starting dose produced"
          value={
            a.calculatedDose === null ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Lock className="size-3.5" /> NOT CALCULATED
              </span>
            ) : (
              `${a.calculatedDose} ${a.doseUnit}`
            )
          }
        />
        <Row label="Gonadotropin covered" value={a.gonadotropin} />
        <Row label="Validated population" value={a.validatedPopulation} />
        <Row label="Dose unit / frequency" value={`${a.doseUnit} · ${a.frequency}`} />
        <Row label="Rounding rule" value={a.roundingRule} />
        <Row label="Dose limits" value={a.doseLimits} />
      </div>

      <p className="mt-3 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Patient vs validated population: </span>
        {a.patientDescription}
        <br />
        {a.matchExplanation}
      </p>

      {a.blockReason && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {a.blockReason}
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Required variables (source definition)
          </h4>
          <ul className="mt-1.5 space-y-1.5 text-xs">
            {a.variables.map((v) => (
              <li key={v.id} className="rounded-lg border border-border/60 bg-card p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{v.label}</span>
                  <span
                    className={cn(
                      v.valid ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {v.present ? `${v.originalValue} ${v.normalizedUnit}` : "Not recorded"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{v.sourceDefinition}</p>
                {v.issue && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{v.issue}</p>
                )}
                {v.substitutionNote && (
                  <p className="mt-1 text-[11px] text-violet-600 dark:text-violet-400">
                    {v.substitutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Numerical components required for activation
          </h4>
          <ul className="mt-1.5 space-y-1.5 text-xs">
            {a.components.map((c) => (
              <li key={c.id} className="rounded-lg border border-border/60 bg-card p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.label}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[10px] uppercase",
                      c.loaded
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/40 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {c.loaded ? "Loaded" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{c.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {a.evidenceId && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <BookOpen className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{a.evidenceTitle ?? a.evidenceId}</span>
          {a.evidenceUrl && (
            <a
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              href={a.evidenceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open source <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}

      <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        {a.notes.map((n, idx) => (
          <li key={`${a.id}-note-${idx}`}>• {n}</li>
        ))}
        {a.calculationDetails.map((n, idx) => (
          <li key={`${a.id}-calc-${idx}`}>• {n}</li>
        ))}
      </ul>
    </article>
  );
}

function DecisionForm({ result }: { result: StartingDoseResult }) {
  const { decision, audit, save, clear } = useStartingDoseDecision(result.patientId);
  const [kind, setKind] = useState<StartingDoseDecisionKind>("physician-selected");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState<string>(DOSE_UNITS[0]);
  const [frequency, setFrequency] = useState("Once daily, subcutaneous");
  const [rationale, setRationale] = useState("");

  const parsedDose = Number(dose);
  const doseValid = dose.trim() !== "" && Number.isFinite(parsedDose) && parsedDose > 0;
  const canSave = kind === "physician-selected" ? doseValid : rationale.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    const entry: StartingDoseDecision = {
      patientId: result.patientId,
      patientName: result.patientName,
      kind,
      dose: kind === "physician-selected" ? parsedDose : null,
      unit,
      frequency,
      gonadotropin: result.currentTreatment.gonadotropinName,
      rationale: rationale.trim(),
      origin: "Physician-selected",
      patientContextVersion: result.patientContextVersion,
      engineVersion: result.version,
      decidedBy: "Clinician (local session)",
      decidedAt: new Date().toISOString(),
    };
    save(entry);
    setRationale("");
    setDose("");
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        Any dose entered here is recorded as{" "}
        <span className="font-semibold text-foreground">PHYSICIAN-SELECTED</span> and is never
        presented as an application recommendation. The engine does not pre-fill, suggest or
        validate a clinical dose value.
      </p>

      <div className="flex flex-wrap gap-2">
        {startingDoseDecisionKinds.map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? "default" : "outline"}
            onClick={() => setKind(k)}
          >
            {startingDoseDecisionLabel[k]}
          </Button>
        ))}
      </div>

      {kind === "physician-selected" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium">
            Dose
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              inputMode="decimal"
              maxLength={8}
              placeholder="Enter dose"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            Unit
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {DOSE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Frequency
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              maxLength={80}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
          </label>
        </div>
      )}

      <label className="block text-xs font-medium">
        Clinical rationale
        <textarea
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          rows={3}
          maxLength={1000}
          placeholder="Record the reasoning for this decision."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submit} disabled={!canSave}>
          Record decision
        </Button>
        {decision && (
          <Button size="sm" variant="outline" onClick={clear}>
            Clear decision
          </Button>
        )}
      </div>

      {decision && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft/60 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/40 text-primary">
              {startingDoseDecisionLabel[decision.kind]}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {decision.origin}
            </Badge>
          </div>
          {decision.dose !== null && (
            <p className="mt-2 font-semibold">
              {decision.dose} {decision.unit} · {decision.frequency}
              {decision.gonadotropin ? ` · ${decision.gonadotropin}` : ""}
            </p>
          )}
          {decision.rationale && <p className="mt-1 text-muted-foreground">{decision.rationale}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {decision.decidedBy} · {new Date(decision.decidedAt).toLocaleString()} · engine v
            {decision.engineVersion}
          </p>
        </div>
      )}

      {audit.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Decision audit log
          </h4>
          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {audit.slice(0, 8).map((e) => (
              <li key={e.id}>
                {new Date(e.at).toLocaleString()} — {e.action}: {e.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StartingDoseActions({ result }: { result: StartingDoseResult }) {
  const text = useMemo(() => startingDoseReportText(result), [result]);
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      <ClipboardCopy className="size-3.5" /> {copied ? "Copied" : "Copy to report"}
    </Button>
  );
}

export function StartingDoseSection({ result }: { result: StartingDoseResult }) {
  return (
    <div className="space-y-5">
      <ClinicalSafetyBanner />

      {/* 1 — Dose output */}
      <Card
        icon={Syringe}
        title="Starting gonadotropin dose"
        id="starting-dose-output"
        badge={
          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-[10px] uppercase tracking-wide",
              doseStateTone[result.state],
            )}
          >
            {result.stateLabel}
          </Badge>
        }
      >
        <div className="rounded-xl border border-border/70 bg-background/60 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Starting dose</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {result.dose === null ? "NOT CALCULATED" : `${result.dose} ${result.doseUnit ?? ""}`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{result.stateExplanation}</p>
          {result.dose === null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              <Lock className="size-3.5" /> Evidence algorithm pending
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{result.note}</p>
      </Card>

      {/* 2 — Current treatment context */}
      <Card icon={UserRound} title="Current treatment context">
        <div className="grid gap-1">
          <Row label="Selected protocol" value={result.currentTreatment.protocolName} />
          <Row label="Protocol evidence status" value={result.currentTreatment.protocolStatus} />
          <Row label="Protocol decision" value={result.currentTreatment.protocolDecisionStatus} />
          <Row
            label="Selected gonadotropin"
            value={result.currentTreatment.gonadotropinName ?? "Not selected"}
          />
          <Row label="Gonadotropin decision" value={result.currentTreatment.gonadotropinStatus} />
        </div>
        {result.currentTreatment.blockingMessage && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3.5" />
            {result.currentTreatment.blockingMessage}
            <Link to="/gonadotropins" className="text-primary underline-offset-2 hover:underline">
              Open Gonadotropin Selection Engine
            </Link>
          </p>
        )}
      </Card>

      {/* 3 — Patient data */}
      <Card icon={ClipboardList} title="Patient data used by dosing algorithms">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.contextGroups.map((g) => (
            <div key={g.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{g.title}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {g.recorded}/{g.total}
                </span>
              </div>
              <div className="mt-2 grid gap-1">
                {g.items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span
                      className={cn(
                        "text-right font-medium",
                        !it.present && "text-muted-foreground",
                      )}
                    >
                      {it.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 4 — Algorithm review */}
      <Card icon={FlaskConical} title="Validated dosing algorithms — patient applicability">
        <div className="space-y-4">
          {result.algorithms.map((a) => (
            <AlgorithmCard key={a.id} a={a} />
          ))}
        </div>
      </Card>

      {/* 5 — Evidence-reported doses */}
      <Card icon={BookOpen} title="Evidence-reported starting doses">
        {result.evidenceReportedDoses.length === 0 ? (
          <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            {result.evidenceReportedNote}
          </p>
        ) : (
          <div className="space-y-3">
            {result.evidenceReportedDoses.map((d) => (
              <article
                key={d.id}
                className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm"
              >
                <h3 className="font-semibold">{d.source}</h3>
                <Row label="Population" value={d.population} />
                <Row label="Gonadotropin" value={d.gonadotropin} />
                <Row label="Reported range" value={d.range} />
                <Row label="Study design" value={d.studyDesign} />
                <Row label="Outcome" value={d.outcome} />
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {d.limitations.map((l, idx) => (
                    <li key={`${d.id}-lim-${idx}`}>• {l}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </Card>

      {/* 6 — Historical doses */}
      <Card icon={History} title="Previous stimulation doses" badge={<HistoricalBadge />}>
        <HistoricalValueNote />
        {result.historicalDoses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{result.historicalNote}</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Cycle</th>
                    <th className="py-2 pr-3">Protocol</th>
                    <th className="py-2 pr-3">Gonadotropin</th>
                    <th className="py-2 pr-3">Starting dose</th>
                    <th className="py-2 pr-3">Max dose</th>
                    <th className="py-2 pr-3">Total dose</th>
                    <th className="py-2 pr-3">Duration</th>
                    <th className="py-2 pr-3">Oocytes</th>
                    <th className="py-2 pr-3">MII</th>
                    <th className="py-2 pr-3">Blastocysts</th>
                    <th className="py-2 pr-3">OHSS</th>
                  </tr>
                </thead>
                <tbody>
                  {result.historicalDoses.map((h) => (
                    <tr key={h.id} className="border-t border-border/50">
                      <td className="py-2 pr-3 font-medium">{h.label}</td>
                      <td className="py-2 pr-3">{h.protocol}</td>
                      <td className="py-2 pr-3">{h.gonadotropin}</td>
                      <td className="py-2 pr-3">{h.startingDose}</td>
                      <td className="py-2 pr-3">{h.maxDose}</td>
                      <td className="py-2 pr-3">{h.totalDose}</td>
                      <td className="py-2 pr-3">{h.duration}</td>
                      <td className="py-2 pr-3">{h.retrieved}</td>
                      <td className="py-2 pr-3">{h.mii}</td>
                      <td className="py-2 pr-3">{h.blastocysts}</td>
                      <td className="py-2 pr-3">{h.ohss}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{result.historicalNote}</p>
          </>
        )}
      </Card>

      {/* 7 — CONSORT firewall */}
      <Card
        icon={Lock}
        title="CONSORT firewall"
        badge={
          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-[10px] uppercase",
              algorithmStatusTone[result.consortFirewall.status],
            )}
          >
            {result.consortFirewall.statusLabel}
          </Badge>
        }
      >
        <div className="grid gap-1">
          <Row
            label="CONSORT framework identified"
            value={result.consortFirewall.frameworkIdentified ? "Yes" : "No"}
          />
          <Row
            label="CONSORT dose calculation active"
            value={result.consortFirewall.doseCalculationActive ? "Yes" : "No"}
          />
          <Row label="CONSORT dose" value={result.consortFirewall.doseDisplay} />
          <Row
            label="Dose produced by this engine"
            value={result.dose === null ? NOT_CALCULATED : String(result.dose)}
          />
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {result.consortFirewall.statements.map((st, idx) => (
            <li key={`consort-st-${idx}`}>• {st}</li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/40 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Missing CONSORT components
          </h4>
          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {result.consortFirewall.missingComponents.map((c) => (
              <li key={c.symbol}>
                • <span className="font-semibold text-foreground">{c.symbol}</span> — {c.detail}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* 8 — Safety guardrails */}
      <Card icon={ShieldCheck} title="Scope and safety guardrails">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {result.safetyGuardrails.map((g, idx) => (
            <li key={`guard-${idx}`}>• {g}</li>
          ))}
        </ul>
      </Card>

      {/* 9 — Missing information */}
      <Card icon={AlertTriangle} title="Missing information">
        {result.missingInformation.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All information tracked by this engine has been recorded.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.missingInformation.map((g) => (
              <div key={g.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
                <h3 className="text-sm font-semibold">{g.title}</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{it.label}</span>
                      <Link
                        to="/assessment"
                        search={{ step: it.stepId }}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Add
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 10 — Evidence limitations */}
      <Card icon={BookOpen} title="Evidence limitations">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {result.evidenceLimitations.map((l, idx) => (
            <li key={`lim-${idx}`}>• {l}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{result.reportLanguage}</p>
      </Card>

      {/* 11 — Physician decision */}
      <Card icon={Syringe} title="Physician starting-dose decision">
        <DecisionForm result={result} />
      </Card>
    </div>
  );
}
