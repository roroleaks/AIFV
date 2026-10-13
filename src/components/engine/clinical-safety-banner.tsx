import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  HISTORICAL_VALUE_NOTICE,
  algorithmStatusTone,
  evaluateTreatmentGate,
  type GateOptions,
  type TreatmentAlgorithmId,
  type TreatmentGate,
} from "@/lib/engine/algorithm-status";

/**
 * Persistent, professional safety notice for treatment-related decision
 * support areas. Informative, not obstructive.
 */
export function ClinicalSafetyBanner({ className }: { className?: string }) {
  return (
    <aside
      role="note"
      aria-label="Clinical safety notice"
      className={cn(
        "rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80">
        <ShieldCheck className="size-3.5 text-primary" /> Clinical safety notice
      </p>
      <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
        <li>Results shown here are classification and prediction outputs, not prescriptions.</li>
        <li>Algorithms marked “Evidence Pending” are not active and produce no recommendation.</li>
        <li>No treatment may be prescribed from an inactive or simulated algorithm.</li>
        <li>The final clinical decision remains the responsibility of the treating physician.</li>
      </ul>
    </aside>
  );
}

/** Inline caption for any patient-entered historical treatment value. */
export function HistoricalValueNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] italic text-muted-foreground", className)}>
      {HISTORICAL_VALUE_NOTICE}
    </p>
  );
}

export function HistoricalBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-lg text-[10px] uppercase tracking-wide", className)}
      title={HISTORICAL_VALUE_NOTICE}
    >
      Historical
    </Badge>
  );
}

export function AlgorithmStatusBadge({ gate }: { gate: TreatmentGate }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", algorithmStatusTone[gate.status])}>
      {gate.status === "ACTIVE" ? <ShieldCheck className="size-3" /> : <Lock className="size-3" />}
      {gate.name.split(" ")[0]}: {gate.statusLabel}
    </Badge>
  );
}

/**
 * STATE B renderer. Whenever a treatment algorithm is not ACTIVE this card is
 * shown INSTEAD of any recommendation surface.
 */
export function EvidencePendingGate({
  id,
  title,
  options,
  className,
}: {
  id: TreatmentAlgorithmId;
  title?: string;
  options?: GateOptions;
  className?: string;
}) {
  const gate = evaluateTreatmentGate(id, options);
  if (gate.active) return null;

  return (
    <section
      className={cn("rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4", className)}
      aria-label={`${gate.name} status`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4" />
        </span>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {title ??
            (gate.status === "DATA_INCOMPLETE"
              ? `${gate.name}: Data Incomplete`
              : `${gate.name}: Evidence Pending`)}
        </h3>
        <Badge
          variant="outline"
          className={cn("ml-auto rounded-full", algorithmStatusTone[gate.status])}
        >
          {gate.statusLabel}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-foreground/80">{gate.message}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Block title="Required evidence">
          <ul className="space-y-1">
            {gate.requiredEvidence.map((e, index) => (
              <li key={e.evidenceId ?? `${gate.id}-req-${index}`} className="flex gap-1.5">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    e.loaded ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                <span>
                  {e.evidenceId && findEvidence(e.evidenceId) ? (
                    <Link
                      to="/evidence/$id"
                      params={{ id: e.evidenceId }}
                      className="text-primary hover:underline"
                    >
                      {e.label}
                    </Link>
                  ) : (
                    e.label
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Evidence status">
          <p>
            {gate.missingEvidence.length === 0
              ? "All required sources transcribed."
              : `${gate.missingEvidence.length} required source(s) not transcribed into the Evidence Library.`}
          </p>
          <p className="mt-1">
            <Link to="/evidence-requirements" className="text-primary hover:underline">
              Review the evidence requirements register
            </Link>
          </p>
        </Block>

        <Block title="Data currently available">
          {gate.dataAvailable.length === 0 ? (
            <p>No qualifying variable recorded yet.</p>
          ) : (
            <ul className="list-disc space-y-0.5 pl-4">
              {gate.dataAvailable.map((d, i) => (
                <li key={`${gate.id}-avail-${i}-${d}`}>{d}</li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Missing evidence / data">
          <ul className="list-disc space-y-0.5 pl-4">
            {gate.missingEvidence.map((d, i) => (
              <li key={`${gate.id}-missev-${i}`}>{d}</li>
            ))}
            {gate.dataMissing.map((d, i) => (
              <li key={`${gate.id}-missdata-${i}`}>{d}</li>
            ))}
            {gate.missingEvidence.length === 0 && gate.dataMissing.length === 0 && (
              <li>None recorded.</li>
            )}
          </ul>
        </Block>
      </div>

      <div className="mt-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Suppressed while pending
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{gate.suppressedOutputs.join(" · ")}</p>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-1 text-foreground/80">{children}</div>
    </div>
  );
}
