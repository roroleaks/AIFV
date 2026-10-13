import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ClipboardList,
  History,
  Lock,
  ShieldAlert,
  Stethoscope,
  Timer,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { algorithmStatusLabel, algorithmStatusTone } from "@/lib/engine/algorithm-status";
import {
  DOSE_ADJUSTMENT_NOT_CALCULATED,
  RULE_ACTIVATION_COMPONENTS,
  type DoseAdjustmentEvaluation,
} from "@/lib/engine/dose-adjustment";
import {
  physicianDecisionLabel,
  type DoseEvent,
  type PhysicianDecision,
} from "@/lib/engine/dose-adjustment-store";
import type { MonitoringResult } from "@/lib/engine/monitoring";

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

/* ------------------------------------------------- evidence-gated adjustment */

export function DoseAdjustmentCard({ evaluation }: { evaluation: DoseAdjustmentEvaluation }) {
  const [openRule, setOpenRule] = useState<string | null>(null);
  const active = evaluation.status === "ACTIVE" && evaluation.firedRule !== null;

  return (
    <Card
      icon={ShieldAlert}
      title="Evidence-based dose adjustment"
      badge={
        <Badge
          variant="outline"
          className={cn("rounded-full", algorithmStatusTone[evaluation.status])}
        >
          {algorithmStatusLabel[evaluation.status]}
        </Badge>
      }
    >
      {active ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3.5">
          <Check className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                {evaluation.proposedAction}
              </span>
              {evaluation.proposedDose !== null && (
                <Badge className="bg-emerald-600 text-white">
                  {evaluation.proposedDose === 0
                    ? "Discontinue daily dose"
                    : `Proposed Dose: ${evaluation.proposedDose} IU/day`}
                </Badge>
              )}
            </div>
            {evaluation.rationale && (
              <p className="text-xs leading-relaxed text-foreground/80">{evaluation.rationale}</p>
            )}
            <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80">
              Triggered rule: {evaluation.firedRule?.ruleName}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {DOSE_ADJUSTMENT_NOT_CALCULATED}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{evaluation.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No dose increase, decrease, medication stop, trigger, freeze-all or cancellation is
              produced by this engine.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Current dose
          </p>
          <p className="mt-1 text-sm font-medium">
            {evaluation.currentDose === null ? "Not recorded" : `${evaluation.currentDose} IU/day`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {evaluation.currentDoseSource === "physician-entered"
              ? "PHYSICIAN-ENTERED — recorded at the visit, not algorithmically calculated."
              : "No dose recorded for the latest visit."}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Evidence-derived proposed adjustment
          </p>
          <p className="mt-1 text-sm font-medium">
            {evaluation.proposedAction ?? "None — no validated rule is active"}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Current medication
          </p>
          <p className="mt-1 text-sm font-medium">{evaluation.currentMedication}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Observed values available to the engine
        </p>
        {evaluation.observedValues.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No visit recorded.</p>
        ) : (
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {evaluation.observedValues.map((o) => (
              <li
                key={o.label}
                className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/40 px-3 py-1.5 text-xs"
              >
                <span className="text-muted-foreground">{o.label}</span>
                <span className="font-medium">{o.value}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Values are restated exactly as entered. They are not compared against any threshold
          because no validated threshold is loaded.
        </p>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Registered adjustment rules
        </p>
        <ul className="mt-1.5 grid gap-2">
          {evaluation.registeredRules.map((r) => {
            const expanded = openRule === r.ruleId;
            return (
              <li key={r.ruleId} className="rounded-xl border border-border/60 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setOpenRule(expanded ? null : r.ruleId)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium">{r.ruleName}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 rounded-full",
                      r.activationStatus === "ACTIVE"
                        ? algorithmStatusTone.ACTIVE
                        : algorithmStatusTone.EVIDENCE_PENDING,
                    )}
                  >
                    {r.activationStatus === "ACTIVE" ? "Active" : "Evidence Pending"}
                  </Badge>
                </button>
                {expanded && (
                  <div className="animate-rise border-t border-border/60 px-3.5 py-3 text-xs">
                    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {(
                        [
                          ["Source", r.source],
                          ["Publication", r.publication],
                          ["Year", r.year],
                          ["DOI", r.doi],
                          ["Population", r.population],
                          ["Protocol", r.protocol],
                          ["Gonadotropin", r.gonadotropin],
                          ["Stimulation day", r.stimulationDay],
                          ["Threshold", r.threshold],
                          ["Comparison", r.comparisonOperator],
                          ["Action", r.action],
                          ["Dose change", r.doseChange],
                          ["Maximum change", r.maximumChange],
                          ["Minimum dose", r.minimumDose],
                          ["Maximum dose", r.maximumDose],
                          ["Evidence level", r.evidenceLevel],
                          ["Rule version", r.version],
                        ] as [string, string | number | null][]
                      ).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="font-medium">
                            {value === null || value === "unspecified"
                              ? "Not loaded"
                              : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 font-semibold text-muted-foreground">Missing components</p>
                    <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                      {r.missingComponents.map((m) => (
                        <li key={m}>• {m}</li>
                      ))}
                    </ul>
                    <Button asChild size="sm" variant="ghost" className="mt-2 rounded-xl">
                      <Link to="/evidence-requirements">Open Evidence Requirements</Link>
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          A rule activates only when all of these are transcribed from the source:{" "}
          {RULE_ACTIVATION_COMPONENTS.join(" · ")}.
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------- physician decision layer */

export function DoseDecisionCard({
  evaluation,
  onRecord,
}: {
  evaluation: DoseAdjustmentEvaluation;
  onRecord: (input: {
    newDose: number | null;
    reason: string;
    decision: PhysicianDecision;
    note: string;
  }) => void;
}) {
  const [dose, setDose] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<PhysicianDecision>("accept");
  const [saved, setSaved] = useState(false);

  const evidenceActive = evaluation.status === "ACTIVE" && evaluation.firedRule !== null;

  const submit = () => {
    const parsed = dose.trim() === "" ? null : Number(dose);
    onRecord({
      newDose: Number.isFinite(parsed as number) ? (parsed as number) : null,
      reason: reason.trim(),
      decision,
      note: note.trim(),
    });
    setDose("");
    setReason("");
    setNote("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card icon={Stethoscope} title="Physician decision — dose">
      <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs">
        <p className="font-semibold">Evidence-supported dose adjustment</p>
        <p className="mt-0.5 text-muted-foreground">
          {evidenceActive
            ? evaluation.proposedAction
            : `${DOSE_ADJUSTMENT_NOT_CALCULATED} — any dose you record below is stored as PHYSICIAN-ENTERED.`}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="decision-dose" className="text-xs">
            Physician-selected dose (IU/day)
          </Label>
          <Input
            id="decision-dose"
            inputMode="decimal"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="rounded-xl"
            placeholder="Enter the dose you have decided"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="decision-reason" className="text-xs">
            Reason
          </Label>
          <Input
            id="decision-reason"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-xl"
            placeholder="Documented reason for the decision"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["accept", "modify", "decline", "defer"] as PhysicianDecision[]).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={decision === d ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => setDecision(d)}
            disabled={!evidenceActive && d !== "modify" && d !== "defer"}
            title={
              !evidenceActive && d !== "modify" && d !== "defer"
                ? "Accept / Decline apply to an evidence-supported adjustment, which is not available."
                : undefined
            }
          >
            {physicianDecisionLabel[d]}
          </Button>
        ))}
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="decision-note" className="text-xs">
          Physician note
        </Label>
        <Textarea
          id="decision-note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="rounded-xl" onClick={submit}>
          Record dose decision
        </Button>
        {saved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Recorded in the audit trail.
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The application never changes a dose on its own. A dose only changes when you record it here
        or in a visit, and it is stored as PHYSICIAN-ENTERED.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------- timeline */

export function DoseTimelineCard({ result }: { result: MonitoringResult }) {
  return (
    <Card icon={Timer} title="Dose timeline">
      {result.doseTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No dose recorded yet. Doses appear here as you enter them at each visit.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Day</th>
                <th className="py-2 pr-3 font-semibold">Dose</th>
                <th className="py-2 pr-3 font-semibold">Medication</th>
                <th className="py-2 pr-3 font-semibold">Change</th>
                <th className="py-2 pr-3 font-semibold">Reason</th>
                <th className="py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {result.doseTimeline.map((d) => (
                <tr key={d.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-3 font-medium">Day {d.day}</td>
                  <td className="py-2 pr-3">{d.dose}</td>
                  <td className="py-2 pr-3">{d.medication}</td>
                  <td className="py-2 pr-3">{d.change}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{d.reason}</td>
                  <td className="py-2">
                    <Badge variant="outline" className="rounded-full">
                      {d.physicianDecision}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Historical doses are never overwritten. Each row restates what was recorded at that visit.
      </p>
    </Card>
  );
}

/* ----------------------------------------------------------- audit trail */

export function DoseAuditCard({
  events,
  onDelete,
}: {
  events: DoseEvent[];
  onDelete: (id: string) => void;
}) {
  return (
    <Card
      icon={History}
      title="Dose change audit trail"
      badge={
        <Badge variant="outline" className="rounded-full">
          {events.length} record(s)
        </Badge>
      }
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dose decision recorded yet.</p>
      ) : (
        <ul className="grid gap-2">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {e.origin}
                </Badge>
                {e.physicianDecision && (
                  <Badge variant="outline" className="rounded-full">
                    {physicianDecisionLabel[e.physicianDecision]}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(e.recordedAt).toLocaleString()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto rounded-xl print:hidden"
                  onClick={() => onDelete(e.id)}
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-3">
                {(
                  [
                    [
                      "Stimulation day",
                      e.stimulationDay === null ? "Not recorded" : `Day ${e.stimulationDay}`,
                    ],
                    ["Medication", e.medication || "Not recorded"],
                    [
                      "Previous dose",
                      e.previousDose === null ? "Not recorded" : `${e.previousDose} IU/day`,
                    ],
                    ["New dose", e.newDose === null ? "Not recorded" : `${e.newDose} IU/day`],
                    [
                      "Evidence-derived dose",
                      e.evidenceDerivedDose === null ? "None" : `${e.evidenceDerivedDose} IU/day`,
                    ],
                    ["Evidence rule", e.evidenceRuleId ?? "None"],
                    ["Evidence version", e.evidenceVersion],
                    ["Engine version", e.engineVersion],
                    ["Reason", e.reason || "Not recorded"],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {e.physicianNote && (
                <p className="mt-2 rounded-lg bg-background/60 p-2.5 text-xs">{e.physicianNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <ClipboardList className="mt-0.5 size-3.5 shrink-0" />
        Every record stores the date/time, stimulation day, previous and new dose, medication,
        reason, source, evidence rule (when one is active), physician decision, note and version.
      </p>
    </Card>
  );
}
