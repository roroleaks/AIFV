import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileDown,
  FlaskConical,
  History,
  ListChecks,
  Lock,
  Pill,
  Printer,
  Table2,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  GONADOTROPIN_PENDING_MESSAGE,
  gonadotropinConsumerInterfaces,
  gonadotropinReportText,
  selectionStatusLabel,
  type GonadotropinSelectionResult,
} from "@/lib/engine/gonadotropin-selection";
import { availabilityLabel, gonadotropinDatabase } from "@/lib/engine/gonadotropin-database";
import { algorithmStatusTone, evaluateTreatmentGate } from "@/lib/engine/algorithm-status";
import {
  ClinicalSafetyBanner,
  EvidencePendingGate,
  HistoricalBadge,
  HistoricalValueNote,
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

const NA = "Not recorded";

/* ------------------------------------------------------- patient summary */

export function GonadotropinSummaryCard({ result }: { result: GonadotropinSelectionResult }) {
  const s = result.summary;
  return (
    <Card icon={UserRound} title="Patient summary">
      <div className="grid gap-2 sm:grid-cols-2">
        <Row label="Age" value={s.age !== null ? `${s.age} years` : NA} />
        <Row label="BMI" value={s.bmi !== null ? `${s.bmi} kg/m²` : NA} />
        <Row label="Diagnosis" value={s.diagnosis.length ? s.diagnosis.join(", ") : NA} />
        <Row label="AMH" value={s.amh !== null ? `${s.amh} ng/mL` : NA} />
        <Row label="AFC" value={s.afc !== null ? `${s.afc} follicles` : NA} />
        <Row label="Basal FSH" value={s.fsh !== null ? `${s.fsh} IU/L` : NA} />
        <Row label="Basal LH" value={s.lh !== null ? `${s.lh} IU/L` : NA} />
        <Row label="POSEIDON group" value={s.poseidonGroup ?? "Not classified"} />
        <Row label="Bologna status" value={s.bolognaStatus} />
        <Row label="Expected ovarian response" value={s.expectedResponse} />
        <Row label="Selected stimulation protocol" value={s.selectedProtocol} />
        <Row
          label="Previous gonadotropin used (historical)"
          value={
            <span className="inline-flex items-center gap-1.5">
              {s.previousGonadotropin ?? NA}
              {s.previousGonadotropin ? <HistoricalBadge /> : null}
            </span>
          }
        />
        <Row label="Previous oocyte yield (historical)" value={s.previousOocyteYield ?? NA} />

        <Row
          label="History of poor response"
          value={s.poorResponseHistory ? "Recorded" : "Not recorded"}
        />
        <Row
          label="History of hyper response"
          value={s.hyperResponseHistory ? "Recorded" : "Not recorded"}
        />
      </div>
    </Card>
  );
}

/* ---------------------------------------------------- primary recommendation */

export function GonadotropinRecommendationCard({
  result,
}: {
  result: GonadotropinSelectionResult;
}) {
  const [open, setOpen] = useState(false);
  const sel = result.selection;
  const s = result.summary;
  const gate = evaluateTreatmentGate("gonadotropin-selection", {
    dataAvailable: [
      s.age !== null ? `Age ${s.age} years` : null,
      s.bmi !== null ? `BMI ${s.bmi} kg/m²` : null,
      s.amh !== null ? `AMH ${s.amh} ng/mL` : null,
      s.afc !== null ? `AFC ${s.afc}` : null,
      s.fsh !== null ? `Basal FSH ${s.fsh} IU/L` : null,
      s.poseidonGroup ? `POSEIDON ${s.poseidonGroup}` : null,
      `Expected response: ${s.expectedResponse}`,
    ].filter((v): v is string => v !== null),
    dataMissing: [
      s.amh === null ? "AMH" : null,
      s.afc === null ? "AFC" : null,
      s.fsh === null ? "Basal FSH" : null,
    ].filter((v): v is string => v !== null),
  });
  return (
    <Card
      icon={Pill}
      title="Gonadotropin selection"
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
            {sel.message || GONADOTROPIN_PENDING_MESSAGE}
          </p>
        </div>
      ) : (
        <EvidencePendingGate
          id="gonadotropin-selection"
          title="Gonadotropin selection algorithm: Evidence Pending"
          options={{ dataAvailable: gate.dataAvailable, dataMissing: gate.dataMissing }}
        />
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Row label="Algorithm status" value={gate.statusLabel} />
        <Row label="Selection status" value={selectionStatusLabel[sel.status]} />
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
            { label: "Why this medication was selected", value: sel.explanation.whySelected },
            { label: "Supporting guideline", value: sel.explanation.supportingGuideline },
            { label: "Supporting publication", value: sel.explanation.supportingPublication },
            { label: "Clinical comments", value: sel.explanation.clinicalComments },
          ].map((f) => (
            <Row key={f.label} label={f.label} value={f.value ?? "Reserved — not populated"} />
          ))}
          <Row
            label="Supporting patient characteristics"
            value={
              sel.explanation.supportingCharacteristics.length
                ? sel.explanation.supportingCharacteristics.join(", ")
                : "Reserved — not populated"
            }
          />
          <p className="text-xs text-muted-foreground">
            These fields are populated automatically once the evidence-based decision algorithms are
            implemented. No medication, LH supplementation, hMG or dose is proposed in this release.
          </p>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------- alternative options */

export function GonadotropinOptionsCard() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card
      icon={FlaskConical}
      title="Gonadotropin options"
      badge={
        <Badge variant="outline" className="rounded-full">
          {gonadotropinDatabase.length} preparations
        </Badge>
      }
    >
      <ul className="grid gap-2">
        {gonadotropinDatabase.map((g) => {
          const open = expanded === g.id;
          return (
            <li key={g.id} className="rounded-xl border border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : g.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{g.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{g.mechanism}</p>
                </div>
                <Badge
                  variant="secondary"
                  className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
                >
                  {g.type}
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
                  <Row label="Medication name" value={g.name} />
                  <Row label="Type" value={g.type} />
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Mechanism
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{g.mechanism}</p>
                  </div>
                  {[
                    { label: "Advantages", items: g.advantages },
                    { label: "Limitations", items: g.limitations },
                    { label: "Indications", items: g.indications },
                    { label: "Contraindications", items: g.contraindications },
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
                      Clinical notes
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.clinicalNotes ?? "Reserved — populated after evidence extraction."}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Supporting evidence
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {g.evidence.map((id) => {
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

/* ------------------------------------------------------ comparison table */

export function GonadotropinComparisonTable() {
  return (
    <Card
      icon={Table2}
      title="Medication comparison"
      badge={
        <Badge variant="secondary" className="rounded-lg text-[10px] uppercase">
          Informational only
        </Badge>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {[
                "Medication",
                "Type",
                "Route",
                "Typical clinical use",
                "Evidence",
                "Advantages",
                "Limitations",
                "Availability",
              ].map((h) => (
                <th key={h} className="px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gonadotropinDatabase.map((g) => (
              <tr key={g.id} className="border-b border-border/40 align-top last:border-0">
                <td className="px-3 py-2.5 font-medium">{g.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{g.type}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{g.route}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {g.clinicalUse ?? "Reserved — awaiting validated guidance"}
                </td>
                <td className="px-3 py-2.5">
                  {g.evidence.map((id) => {
                    const e = findEvidence(id);
                    return (
                      <Link
                        key={id}
                        to="/evidence/$id"
                        params={{ id }}
                        className="block text-primary hover:underline"
                      >
                        {e ? `${e.journal} ${e.year}` : id}
                      </Link>
                    );
                  })}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {g.advantages.join("; ") || "—"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {g.limitations.join("; ") || "—"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {availabilityLabel[g.availability]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This table describes preparations only. It is not a selection, a ranking or a
        recommendation.
      </p>
    </Card>
  );
}

/* ---------------------------------------------------- previous cycle review */

export function PreviousCycleReviewCard({ result }: { result: GonadotropinSelectionResult }) {
  return (
    <Card
      icon={History}
      title="Previous cycle review (historical patient-entered data)"
      badge={
        <span className="flex items-center gap-1.5">
          <HistoricalBadge />
          <Badge variant="secondary" className="rounded-lg text-[10px] uppercase">
            {result.cycleReview.length} cycle(s)
          </Badge>
        </span>
      }
    >
      <HistoricalValueNote className="mb-3" />

      {result.cycleReview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No previous stimulation cycle is recorded for this patient.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "Cycle",
                  "Medication used",
                  "Daily dose",
                  "Days of stimulation",
                  "Peak estradiol",
                  "Follicle development",
                  "Retrieved oocytes",
                  "MII oocytes",
                  "Blastocysts",
                  "Clinical outcome",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.cycleReview.map((c) => (
                <tr key={c.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2.5 font-medium">{c.label}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.medication ?? NA}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {c.dailyDose !== null ? `${c.dailyDose} IU` : NA}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {c.stimulationDays !== null ? `${c.stimulationDays} days` : NA}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {c.peakEstradiol !== null ? `${c.peakEstradiol} pg/mL` : NA}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {c.follicleDevelopment ?? NA}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.retrieved ?? NA}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.mii ?? NA}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.blastocysts ?? NA}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Recorded stimulation history only. It will feed the future decision rules; nothing is
        inferred from it today.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------ data sources */

export function GonadotropinDataSourcesCard({ result }: { result: GonadotropinSelectionResult }) {
  return (
    <Card icon={Database} title="Data sources">
      <ul className="grid gap-2 sm:grid-cols-2">
        {result.dataSources.map((d) => (
          <li key={d.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
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

/* --------------------------------------------------------------- evidence */

export function GonadotropinEvidenceCard({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => !!e);
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
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{e.society ?? e.publisher ?? e.type}</span>
              <span>{e.journal}</span>
              <span>{e.year}</span>
              <span>Evidence level {e.level}</span>
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

/* ------------------------------------------------------------ integration */

export function GonadotropinIntegrationCard() {
  return (
    <Card icon={ListChecks} title="Downstream engine interfaces">
      <ul className="grid gap-2 sm:grid-cols-2">
        {gonadotropinConsumerInterfaces.map((m) => (
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
            <p className="mt-0.5 text-xs text-muted-foreground">Consumes: {m.consumes.join(", ")}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- actions */

export function GonadotropinActions({ result }: { result: GonadotropinSelectionResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(gonadotropinReportText(result));
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

export function GonadotropinSelectionSection({
  result,
}: {
  result: GonadotropinSelectionResult;
}) {
  return (
    <div className="grid gap-5">
      <ClinicalSafetyBanner />
      <GonadotropinSummaryCard result={result} />

      <GonadotropinRecommendationCard result={result} />
      <GonadotropinOptionsCard />
      <GonadotropinComparisonTable />
      <PreviousCycleReviewCard result={result} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <GonadotropinEvidenceCard ids={result.selection.evidenceSource} />
        <GonadotropinDataSourcesCard result={result} />
      </div>
      <GonadotropinIntegrationCard />
    </div>
  );
}
