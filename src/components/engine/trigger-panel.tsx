import { useMemo, useState } from "react";
import {
  Activity,
  ClipboardList,
  FlaskConical,
  Layers,
  Lock,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";

import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  TRIGGER_DESCRIPTIVE_NOTICE,
  applicabilityTone,
  dataAvailabilityTone,
  safetyStatusTone,
  type TriggerGroup,
  type TriggerItem,
  type TriggerResult,
} from "@/lib/engine/trigger";
import {
  isTriggerSelection,
  triggerDecisionKinds,
  triggerDecisionLabel,
  type TriggerAuditEntry,
  type TriggerDecision,
  type TriggerDecisionKind,
} from "@/lib/engine/trigger-decision-store";

function ItemList({ items }: { items: TriggerItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.id} className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd
            className={cn(
              "text-sm font-medium",
              i.present ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {i.value}
          </dd>
          {i.detail && <p className="text-[11px] text-muted-foreground">{i.detail}</p>}
        </div>
      ))}
    </dl>
  );
}

export function TriggerContextCard({ groups }: { groups: TriggerGroup[] }) {
  return (
    <SectionCard
      title="Patient context"
      description="Imported from the canonical patient record and existing engines — nothing is recalculated here."
    >
      <div className="grid gap-5">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {g.title}
            </p>
            <ItemList items={g.items} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function TriggerCycleStatusCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Current stimulation cycle status"
      description="Observed values recorded in monitoring."
      action={
        <Badge variant="outline" className="rounded-full">
          <Activity className="size-3.5" /> Day {result.cycleStatus[0]?.value ?? "—"}
        </Badge>
      }
    >
      <ItemList items={result.cycleStatus} />
    </SectionCard>
  );
}

export function TriggerFollicularCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Follicular assessment"
      description="Measured follicle numbers and diameters — displayed only, with no threshold applied."
    >
      <ItemList items={result.follicular} />

      {result.follicleMeasurements.length > 0 && (
        <div className="mt-4 grid gap-2">
          {result.follicleMeasurements.map((m) => (
            <div key={m.side} className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <p className="text-xs font-semibold">{m.side}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.sizes}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Measurement</th>
              <th className="py-2 pr-3 font-medium">Previous visit</th>
              <th className="py-2 pr-3 font-medium">Latest visit</th>
              <th className="py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {result.follicleTrend.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3">{r.label}</td>
                <td className="py-2 pr-3 text-muted-foreground">{r.previous}</td>
                <td className="py-2 pr-3 font-medium">{r.current}</td>
                <td className="py-2 text-muted-foreground">{r.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.trackedFollicles.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Individually tracked follicles
          </p>
          <div className="flex flex-wrap gap-2">
            {result.trackedFollicles.map((f) => (
              <Badge key={`${f.followId}-${f.side}`} variant="outline" className="rounded-lg">
                {f.followId} ({f.side}): {f.current} · {f.change}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] italic text-muted-foreground">{TRIGGER_DESCRIPTIVE_NOTICE}</p>
    </SectionCard>
  );
}

function TrendTable({ rows }: { rows: TriggerResult["hormonal"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Parameter</th>
            <th className="py-2 pr-3 font-medium">Previous</th>
            <th className="py-2 pr-3 font-medium">Current</th>
            <th className="py-2 pr-3 font-medium">Change</th>
            <th className="py-2 pr-3 font-medium">Interval</th>
            <th className="py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-2 pr-3">{r.label}</td>
              <td className="py-2 pr-3 text-muted-foreground">{r.previous}</td>
              <td className="py-2 pr-3 font-medium">{r.current}</td>
              <td className="py-2 pr-3 text-muted-foreground">{r.change}</td>
              <td className="py-2 pr-3 text-muted-foreground">{r.interval}</td>
              <td className="py-2 text-xs text-muted-foreground">{r.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TriggerHormonalCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Hormonal assessment"
      description="Estradiol, LH and progesterone as entered, with arithmetic change only."
      action={
        <Badge variant="outline" className="rounded-full">
          <FlaskConical className="size-3.5" /> Observed values
        </Badge>
      }
    >
      <TrendTable rows={result.hormonal} />
      <p className="mt-3 text-[11px] italic text-muted-foreground">{TRIGGER_DESCRIPTIVE_NOTICE}</p>
    </SectionCard>
  );
}

export function TriggerEndometrialCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Endometrial assessment"
      description="Thickness and pattern as recorded. No adequacy statement is generated."
    >
      <TrendTable rows={result.endometrial} />
      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">Pattern: </span>
        <span className="font-medium">{result.endometrialPattern}</span>
      </p>
      <p className="mt-2 text-[11px] italic text-muted-foreground">{TRIGGER_DESCRIPTIVE_NOTICE}</p>
    </SectionCard>
  );
}

export function TriggerCompletenessCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Monitoring data completeness"
      description="Each data category required for a future trigger assessment, with its current state."
      action={
        <Badge variant="outline" className="rounded-full">
          {result.completenessPercent}% available
        </Badge>
      }
      contentClassName="p-0"
    >
      <ul className="divide-y divide-border/60">
        {result.completeness.map((c) => (
          <li key={c.id} className="grid gap-1 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full text-[10px]", dataAvailabilityTone[c.state])}
              >
                {c.state}
              </Badge>
              <span className="text-sm font-medium">{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.detail}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function TriggerSafetyCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Trigger safety assessment"
      description="Safety-relevant values imported from the assessment, monitoring and Cycle Completion & Safety Engine."
      action={
        <Badge
          variant="outline"
          className={cn("rounded-full", safetyStatusTone[result.safetyStatus])}
        >
          <ShieldAlert className="size-3.5" /> {result.safetyStatus}
        </Badge>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">{result.safetyStatusDetail}</p>
      <ItemList items={result.safetyContext} />
      <p className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
        No OHSS grade, OHSS threshold, freeze-all decision or trigger-safety cut-off is generated by
        this engine. {TRIGGER_DESCRIPTIVE_NOTICE}
      </p>
    </SectionCard>
  );
}

export function TriggerOptionsCard({ result }: { result: TriggerResult }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <SectionCard
      title="Trigger options — evidence review"
      description="Options are listed for review, never ranked and never selected by the application."
      action={
        <Badge variant="outline" className="rounded-full">
          <Layers className="size-3.5" /> {result.options.length} registered rule(s)
        </Badge>
      }
      contentClassName="p-0"
    >
      <ul className="divide-y divide-border/60">
        {result.options.map((o) => {
          const open = openId === o.rule.triggerRuleId;
          return (
            <li key={o.rule.triggerRuleId} className="grid gap-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{o.triggerTypeLabel}</span>
                <Badge
                  variant="outline"
                  className={cn("rounded-full text-[10px]", applicabilityTone[o.applicability])}
                >
                  {o.applicability}
                </Badge>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  <Lock className="size-3" /> {o.statusLabel}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto rounded-xl"
                  onClick={() => setOpenId(open ? null : o.rule.triggerRuleId)}
                >
                  {open ? "Hide evidence card" : "Evidence card"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{o.applicabilityDetail}</p>
              <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Validated population</dt>
                  <dd>{o.validatedPopulation}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Current patient</dt>
                  <dd>{o.currentPatient}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dose</dt>
                  <dd className="font-medium">{o.doseStatus}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Timing</dt>
                  <dd className="font-medium">{o.timingStatus}</dd>
                </div>
              </dl>
              {open && (
                <div className="mt-1 grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-4 text-xs">
                  <p>
                    <span className="text-muted-foreground">Rule: </span>
                    {o.rule.triggerRuleName} (v{o.rule.version})
                  </p>
                  <p>
                    <span className="text-muted-foreground">Expected source: </span>
                    {o.sourceLabel}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Evidence level: </span>
                    {o.rule.evidenceLevel ?? "Not loaded"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Evidence-supported action: </span>
                    {o.evidenceSupportedAction ?? "None — the rule is not activated."}
                  </p>
                  <div>
                    <p className="text-muted-foreground">Required before activation:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {o.rule.missingComponents.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-muted-foreground">{o.rule.activationPoint}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function TriggerReadinessCard({ result }: { result: TriggerResult }) {
  const r = result.readiness;
  return (
    <SectionCard
      title="Trigger readiness"
      description="Structured status only — no trigger type, dose or timing is produced."
      action={
        <Badge
          variant="outline"
          className={cn(
            "rounded-full",
            r.algorithmStatus === "ACTIVE"
              ? applicabilityTone.MATCH
              : applicabilityTone["EVIDENCE PENDING"],
          )}
        >
          <Lock className="size-3.5" /> {r.statusLabel}
        </Badge>
      }
    >
      <div className="grid gap-2 text-sm">
        <p className="font-semibold">{r.headline}</p>
        <p className="text-muted-foreground">{r.explanation}</p>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {[
          ["Follicular status", r.follicularSummary],
          ["Hormonal status", r.hormonalSummary],
          ["Endometrial status", r.endometrialSummary],
          ["Data completeness", r.completenessSummary],
          ["Safety status", r.safetySummary],
          ["Evidence status", r.evidenceSummary],
          ["Physician decision", r.physicianDecisionSummary],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs">
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          {result.triggerTypeStatus}
        </p>
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          {result.triggerDoseStatus}
        </p>
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          {result.triggerTimingStatus}
        </p>
      </div>
    </SectionCard>
  );
}

export function TriggerAlertsCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Descriptive observations"
      description="Arithmetic echoes of entered values. No alert here is a clinical warning or an instruction."
      contentClassName="p-0"
    >
      {result.alerts.length === 0 ? (
        <div className="p-5">
          <EmptyPlaceholder label="No observation recorded" hint="Enter monitoring visits first." />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {result.alerts.map((a) => (
            <li key={a.id} className="grid gap-1 px-5 py-3">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.observation}</p>
              <p className="text-[11px] italic text-muted-foreground">
                {a.basis} {a.notice}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function TriggerGapsCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Missing information"
      description="Exactly what is missing, invalid, conflicting or outdated — and whether it is required."
      contentClassName="p-0"
    >
      {result.dataGaps.length === 0 ? (
        <div className="p-5">
          <EmptyPlaceholder label="No data gap detected" />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {result.dataGaps.map((g) => (
            <li key={g.id} className="grid gap-1 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {g.kind}
                </Badge>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {g.requirement}
                </Badge>
                <span className="text-sm font-medium">{g.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{g.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function TriggerGuardrailCard({ result }: { result: TriggerResult }) {
  return (
    <SectionCard
      title="Safety gating & evidence limitations"
      description="Explicit statement of what this engine will not do and what evidence is absent."
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Guardrails
      </p>
      <ul className="mt-2 grid list-disc gap-1 pl-5 text-xs text-muted-foreground">
        {result.guardrails.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Evidence limitations
      </p>
      <ul className="mt-2 grid list-disc gap-1 pl-5 text-xs text-muted-foreground">
        {result.evidenceLimitations.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-xs font-semibold">
            CONSORT firewall — {result.consortFirewall.statusLabel}
          </p>
          <ul className="mt-1 grid list-disc gap-1 pl-4 text-[11px] text-muted-foreground">
            {result.consortFirewall.statements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-xs font-semibold">Starting-dose firewall</p>
          <ul className="mt-1 grid list-disc gap-1 pl-4 text-[11px] text-muted-foreground">
            {result.startingDoseFirewall.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}

/* --------------------------------------------------------- decision layer */

export function TriggerDecisionCard({
  result,
  decision,
  audit,
  onSave,
  onClear,
}: {
  result: TriggerResult;
  decision: TriggerDecision | null;
  audit: TriggerAuditEntry[];
  onSave: (d: TriggerDecision) => void;
  onClear: () => void;
}) {
  const [kind, setKind] = useState<TriggerDecisionKind>("physician-selected");
  const [triggerType, setTriggerType] = useState("");
  const [medication, setMedication] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("");
  const [plannedDateTime, setPlanned] = useState("");
  const [plannedRetrievalDateTime, setRetrieval] = useState("");
  const [rationale, setRationale] = useState("");
  const [decidedBy, setDecidedBy] = useState("");

  const monitoringDay = useMemo(() => {
    const raw = result.cycleStatus.find((c) => c.id === "day")?.value ?? "";
    const m = /Day\s+(\d+)/.exec(raw);
    return m ? Number(m[1]) : null;
  }, [result.cycleStatus]);

  const submit = () => {
    onSave({
      patientId: result.patientId,
      patientName: result.patientName,
      kind,
      triggerType: triggerType.trim(),
      medication: medication.trim(),
      dose: dose.trim(),
      route: route.trim(),
      plannedDateTime,
      plannedRetrievalDateTime,
      rationale: rationale.trim(),
      origin: "Physician-selected",
      monitoringDay,
      engineVersion: result.version,
      decidedBy: decidedBy.trim() || "Clinician (local session)",
      decidedAt: new Date().toISOString(),
    });
  };

  const selection = isTriggerSelection(kind);

  return (
    <SectionCard
      title="Physician trigger decision"
      description="Every value below is entered by the physician. The application pre-fills nothing and never suggests a trigger, dose or time."
      action={
        <Badge variant="outline" className="rounded-full">
          <Stethoscope className="size-3.5" /> Physician-entered
        </Badge>
      }
    >
      {decision && (
        <div className="mb-4 rounded-xl border border-border/70 bg-muted/30 p-4 text-xs">
          <p className="text-sm font-semibold">{triggerDecisionLabel[decision.kind]}</p>
          <p className="mt-1 text-muted-foreground">
            {[decision.triggerType, decision.medication, decision.dose, decision.route]
              .filter(Boolean)
              .join(" · ") || "No trigger detail entered"}
          </p>
          {decision.plannedDateTime && (
            <p className="mt-1 text-muted-foreground">
              Planned trigger: {decision.plannedDateTime}
            </p>
          )}
          {decision.plannedRetrievalDateTime && (
            <p className="text-muted-foreground">
              Planned retrieval: {decision.plannedRetrievalDateTime}
            </p>
          )}
          {decision.rationale && <p className="mt-1">Rationale: {decision.rationale}</p>}
          <p className="mt-1 text-muted-foreground">
            {decision.origin} · {decision.decidedBy} ·{" "}
            {new Date(decision.decidedAt).toLocaleString()} · engine v{decision.engineVersion}
          </p>
          <Button size="sm" variant="ghost" className="mt-2 rounded-xl" onClick={onClear}>
            Clear recorded decision
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {triggerDecisionKinds.map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setKind(k)}
            >
              {triggerDecisionLabel[k]}
            </Button>
          ))}
        </div>

        {selection && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="trigger-type">Trigger type</Label>
              <Input
                id="trigger-type"
                value={triggerType}
                placeholder="Entered by physician"
                onChange={(e) => setTriggerType(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trigger-medication">Medication</Label>
              <Input
                id="trigger-medication"
                value={medication}
                placeholder="Entered by physician"
                onChange={(e) => setMedication(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trigger-dose">Dose</Label>
              <Input
                id="trigger-dose"
                value={dose}
                placeholder="Entered by physician"
                onChange={(e) => setDose(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trigger-route">Route</Label>
              <Input
                id="trigger-route"
                value={route}
                placeholder="Entered by physician"
                onChange={(e) => setRoute(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trigger-time">Planned trigger date & time</Label>
              <Input
                id="trigger-time"
                type="datetime-local"
                value={plannedDateTime}
                onChange={(e) => setPlanned(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="retrieval-time">Planned retrieval date & time</Label>
              <Input
                id="retrieval-time"
                type="datetime-local"
                value={plannedRetrievalDateTime}
                onChange={(e) => setRetrieval(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="trigger-rationale">Clinical rationale</Label>
          <Textarea
            id="trigger-rationale"
            value={rationale}
            rows={3}
            placeholder="Physician rationale for this decision"
            onChange={(e) => setRationale(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor="trigger-by">Recorded by</Label>
          <Input
            id="trigger-by"
            value={decidedBy}
            placeholder="Clinician name"
            onChange={(e) => setDecidedBy(e.target.value)}
          />
        </div>

        <div>
          <Button className="rounded-xl" onClick={submit}>
            Record physician decision
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ClipboardList className="size-3.5" /> Decision audit trail
        </p>
        {audit.length === 0 ? (
          <EmptyPlaceholder label="No decision recorded yet" />
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
            {audit.map((a) => (
              <li key={a.id} className="grid gap-0.5 px-4 py-3 text-xs">
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-muted-foreground">{a.summary}</span>
                {a.rationale && <span>Rationale: {a.rationale}</span>}
                <span className="text-muted-foreground">
                  {a.origin} · {a.decidedBy} · {new Date(a.decidedAt).toLocaleString()}
                  {a.monitoringDay === null ? "" : ` · stimulation day ${a.monitoringDay}`} · engine
                  v{a.engineVersion}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
