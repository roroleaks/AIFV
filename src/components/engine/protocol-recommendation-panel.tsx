import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileDown,
  Layers,
  ListChecks,
  Lock,
  Printer,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  PROTOCOL_PENDING_MESSAGE,
  protocolConsumerInterfaces,
  protocolReportText,
  recommendationStatusLabel,
  type ClinicalConsideration,
  type ProtocolRecommendationResult,
} from "@/lib/engine/protocol-recommendation";
import { protocolDatabase, protocolFamilyLabel } from "@/lib/engine/protocol-database";
import { algorithmStatusTone, evaluateTreatmentGate } from "@/lib/engine/algorithm-status";
import {
  ClinicalSafetyBanner,
  EvidencePendingGate,
} from "@/components/engine/clinical-safety-banner";


const severityClass: Record<ClinicalConsideration["severity"], string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/* ------------------------------------------------ 1. clinical summary */

export function ProtocolSummaryCard({ result }: { result: ProtocolRecommendationResult }) {
  const s = result.summary;
  const dash = "Not recorded";
  return (
    <Card icon={UserRound} title="Patient clinical summary">
      <div className="grid gap-2 sm:grid-cols-2">
        <Row label="Age" value={s.age !== null ? `${s.age} years` : dash} />
        <Row label="BMI" value={s.bmi !== null ? `${s.bmi} kg/m²` : dash} />
        <Row label="AMH" value={s.amh !== null ? `${s.amh} ng/mL` : dash} />
        <Row label="AFC" value={s.afc !== null ? `${s.afc} follicles` : dash} />
        <Row
          label="Diagnosis"
          value={s.diagnosis.length ? s.diagnosis.join(", ") : dash}
        />
        <Row label="POSEIDON group" value={s.poseidonGroup ?? s.poseidonStatus} />
        <Row label="Bologna status" value={s.bolognaStatus} />
        <Row label="Expected response" value={s.expectedResponse} />
      </div>
      <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Major risks
        </p>
        {s.majorRisks.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No moderate or high risk identified from the recorded data.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.majorRisks.map((r) => (
              <span
                key={r}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------- 2. protocol recommendation */

export function ProtocolRecommendationCard({
  result,
}: {
  result: ProtocolRecommendationResult;
}) {
  const [open, setOpen] = useState(false);
  const r = result.recommendation;
  const gate = evaluateTreatmentGate("protocol-recommendation", {
    dataAvailable: result.dataSources.filter((d) => d.available).map((d) => `${d.label}: ${d.detail}`),
  });
  return (
    <Card
      icon={Stethoscope}
      title="Protocol recommendation"
      badge={
        <Badge variant="outline" className={cn("rounded-full", algorithmStatusTone[gate.status])}>
          {gate.statusLabel}
        </Badge>
      }
    >
      {gate.active ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Lock className="mt-0.5 size-4 shrink-0" />
            {r.message || PROTOCOL_PENDING_MESSAGE}
          </p>
        </div>
      ) : (
        <EvidencePendingGate
          id="protocol-recommendation"
          options={{
            dataAvailable: result.dataSources
              .filter((d) => d.available)
              .map((d) => `${d.label}: ${d.detail}`),
            dataMissing: result.dataSources.filter((d) => !d.available).map((d) => d.label),
          }}
        />
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Row label="Algorithm status" value={gate.statusLabel} />
        <Row label="Recommendation status" value={recommendationStatusLabel[r.status]} />
        <Row label="Engine version" value={`v${result.version}`} />
        <Row label="Evidence sources required" value={`${gate.requiredEvidence.length}`} />
      </div>


      <Button
        variant="outline"
        size="sm"
        className="mt-4 print:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? "Collapse details" : "Expand details"}
      </Button>

      {open && (
        <div className="mt-3 grid gap-2">
          {[
            { label: "Clinical rationale", value: r.explanation.clinicalRationale },
            { label: "Guideline", value: r.explanation.guideline },
            { label: "Publication", value: r.explanation.publication },
            { label: "Notes", value: r.explanation.notes },
          ].map((f) => (
            <Row key={f.label} label={f.label} value={f.value ?? "Reserved — not populated"} />
          ))}
          <Row
            label="Supporting variables"
            value={
              r.explanation.supportingVariables.length
                ? r.explanation.supportingVariables.join(", ")
                : "Reserved — not populated"
            }
          />
          <Row
            label="Evidence used"
            value={
              r.explanation.evidenceUsed.length
                ? r.explanation.evidenceUsed.join(", ")
                : "Reserved — not populated"
            }
          />
          <p className="text-xs text-muted-foreground">
            These fields are populated only after the evidence-based decision rules are implemented.
            No protocol, medication, gonadotropin, dose or trigger is produced in this release.
          </p>
        </div>
      )}
    </Card>
  );
}

/* --------------------------------------------- 3. clinical considerations */

export function ProtocolConsiderationsCard({
  result,
}: {
  result: ProtocolRecommendationResult;
}) {
  return (
    <Card
      icon={AlertTriangle}
      title="Clinical considerations"
      badge={
        <Badge variant="secondary" className="rounded-lg text-[10px] uppercase">
          {result.considerations.length} item(s)
        </Badge>
      }
    >
      {result.considerations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No consideration is derived from the recorded data yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {result.considerations.map((c) => (
            <li
              key={c.id}
              className={cn("rounded-xl border px-3.5 py-2.5", severityClass[c.severity])}
            >
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="mt-0.5 text-xs text-foreground/70">{c.source}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------ data sources */

export function ProtocolDataSourcesCard({ result }: { result: ProtocolRecommendationResult }) {
  return (
    <Card icon={Database} title="Data sources">
      <ul className="grid gap-2 sm:grid-cols-2">
        {result.dataSources.map((d) => (
          <li
            key={d.id}
            className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  d.available ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-sm font-medium">{d.label}</span>
            </div>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{d.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------ protocol database */

export function ProtocolDatabaseCard() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card
      icon={Layers}
      title="Protocol reference database"
      badge={
        <Badge variant="outline" className="rounded-full">
          {protocolDatabase.length} protocols
        </Badge>
      }
    >
      <ul className="grid gap-2">
        {protocolDatabase.map((p) => {
          const open = expanded === p.id;
          return (
            <li key={p.id} className="rounded-xl border border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : p.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                </div>
                <Badge
                  variant="secondary"
                  className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
                >
                  {protocolFamilyLabel[p.family]}
                </Badge>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open && (
                <div className="grid gap-3 border-t border-border/60 px-3.5 py-3 sm:grid-cols-2">
                  {[
                    { label: "Indications", items: p.indications },
                    { label: "Contraindications", items: p.contraindications },
                    { label: "Advantages", items: p.advantages },
                    { label: "Disadvantages", items: p.disadvantages },
                  ].map((b) => (
                    <div key={b.label}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {b.label}
                      </p>
                      {b.items.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reserved — added only from validated guidance.
                        </p>
                      ) : (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {b.items.map((it) => (
                            <li key={it}>{it}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Supporting evidence
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {p.evidence.map((id) => {
                        const e = findEvidence(id);
                        return (
                          <li key={id} className="text-xs">
                            <Link
                              to="/evidence/$id"
                              params={{ id }}
                              className="text-primary hover:underline"
                            >
                              {e ? `${e.journal} ${e.year} — ${e.title}` : id}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------- evidence */

export function ProtocolEvidenceCard({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => !!e);
  return (
    <Card icon={BookOpen} title="Evidence source">
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
      <p className="mt-3 text-xs text-muted-foreground">
        References are indexed for the future decision rules. No statement in this release is
        derived from them.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------ integrations */

export function ProtocolIntegrationCard() {
  return (
    <Card icon={ListChecks} title="Downstream engine interfaces">
      <ul className="grid gap-2 sm:grid-cols-2">
        {protocolConsumerInterfaces.map((m) => (
          <li key={m.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{m.name}</span>
              <Badge
                variant="secondary"
                className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
              >
                Pending
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Consumes: {m.consumes.join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------- actions */

export function ProtocolActions({ result }: { result: ProtocolRecommendationResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(protocolReportText(result));
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

export function ProtocolRecommendationSection({
  result,
}: {
  result: ProtocolRecommendationResult;
}) {
  return (
    <div className="grid gap-5">
      <ClinicalSafetyBanner />
      <ProtocolSummaryCard result={result} />

      <ProtocolRecommendationCard result={result} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ProtocolConsiderationsCard result={result} />
        <ProtocolDataSourcesCard result={result} />
      </div>
      <ProtocolDatabaseCard />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ProtocolEvidenceCard ids={result.recommendation.evidenceSource} />
        <ProtocolIntegrationCard />
      </div>
    </div>
  );
}
