import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ChevronRight,
  CircleSlash,
  Cpu,
  Database,
  GitBranch,
  History,
  Layers,
  ListChecks,
  Lock,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { useAssessment } from "@/lib/assessment/use-assessment";
import { engineModules, engineModuleName, findEngineModule } from "@/lib/engine/registry";
import { buildEngineContext, engineSnapshot } from "@/lib/engine/runtime";
import {
  engineIssueLabels,
  engineStages,
  engineStatusLabels,
  engineStatusTone,
  type EngineResult,
} from "@/lib/engine/types";
import { useEngineSettings, databaseOptions } from "@/lib/engine/settings";
import { useAuditLog, auditActionLabels } from "@/lib/engine/audit";
import { reportSections } from "@/lib/engine/report-structure";
import { findEvidence, formatCitation } from "@/lib/evidence/library";

const title = "Clinical Intelligence Engine — IVF Ai Calc";
const description =
  "Modular calculation framework: module states, execution queue, dependency graph, audit trail and report structure. No clinical calculation is performed.";

export const Route = createFileRoute("/_shell/engine")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: EnginePage,
});

function StatusBadge({ status }: { status: EngineResult["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        engineStatusTone[status],
      )}
    >
      {engineStatusLabels[status]}
    </span>
  );
}

function ModuleCard({
  result,
  enabled,
  onToggle,
  onInspect,
  selected,
}: {
  result: EngineResult;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onInspect: () => void;
  selected: boolean;
}) {
  const def = findEngineModule(result.moduleId);
  if (!def) return null;

  return (
    <article
      className={cn(
        "animate-rise flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition-colors",
        selected ? "border-primary/60" : "border-border/70",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Module {def.order}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold">{def.name}</h3>
        </div>
        <StatusBadge status={result.status} />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{def.description}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Input completion</span>
          <span className="font-semibold text-foreground">{result.completion}%</span>
        </div>
        <Progress value={result.completion} className="mt-1.5 h-1.5" />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {[...def.requiredInputs, ...def.optionalInputs].slice(0, 6).map((v) => (
          <Badge key={v} variant="secondary" className="rounded-lg font-normal">
            {v}
          </Badge>
        ))}
        {def.requiredInputs.length + def.optionalInputs.length > 6 && (
          <Badge variant="outline" className="rounded-lg font-normal">
            +{def.requiredInputs.length + def.optionalInputs.length - 6}
          </Badge>
        )}
        {def.requiredInputs.length + def.optionalInputs.length === 0 && (
          <span className="text-xs text-muted-foreground">No patient variables required</span>
        )}
      </div>

      {result.issues.length > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" /> {result.issues.length} data note
          {result.issues.length > 1 ? "s" : ""}
        </p>
      )}

      <Separator className="my-4" />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          <p>
            v{def.version} · updated {def.lastUpdated}
          </p>
          <p className="truncate">Confidence & results reserved</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Enable ${def.name}`} />
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onInspect}>
            Inspect
          </Button>
        </div>
      </div>
    </article>
  );
}

function ExplanationPanel({ result }: { result: EngineResult }) {
  const def = findEngineModule(result.moduleId);
  if (!def) return null;

  return (
    <SectionCard
      title={`${def.name} — clinical explanation`}
      description="Reserved surface. Populated only by future validated engines."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Why this result occurred
          </p>
          <EmptyPlaceholder
            className="mt-2 min-h-20"
            label={result.explanation.rationale ?? "No result generated"}
            hint="Rationale is written by the engine once it is scientifically validated."
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Clinical interpretation
          </p>
          <EmptyPlaceholder
            className="mt-2 min-h-20"
            label={result.explanation.interpretation ?? "Reserved"}
            hint="No clinical interpretation is produced in this release."
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Variables used ({result.explanation.variablesUsed.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.explanation.variablesUsed.length ? (
              result.explanation.variablesUsed.map((v) => (
                <Badge key={v} variant="secondary" className="rounded-lg font-normal">
                  {v}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None captured yet.</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Variables missing ({result.explanation.variablesMissing.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.explanation.variablesMissing.length ? (
              result.explanation.variablesMissing.map((v) => (
                <Badge key={v} variant="outline" className="rounded-lg font-normal">
                  {v}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Complete.</span>
            )}
          </div>
        </div>
      </div>

      {result.issues.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {result.issues.map((issue, i) => (
            <li
              key={`${issue.kind}-${i}`}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {engineIssueLabels[issue.kind]}
                </p>
                <p className="text-sm text-foreground/80">{issue.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Evidence
          </p>
          {def.evidence.length ? (
            <ul className="mt-2 grid gap-1.5">
              {def.evidence.map((id) => {
                const e = findEvidence(id);
                return (
                  <li key={id} className="text-sm text-muted-foreground">
                    {e ? formatCitation(e) : id}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Awaiting evidence mapping before implementation.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Confidence
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Reserved — {result.confidence === null ? "not calculated" : result.confidence}
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Future expansion
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{def.futureExpansion}</p>
        </div>
      </div>
    </SectionCard>
  );
}

function EnginePage() {
  const { draft } = useAssessment();
  const { settings, toggleModule, setDatabase, setAutoUpdate, isEnabled, enabledCount } =
    useEngineSettings();
  const { entries, log, clear } = useAuditLog();
  const [selected, setSelected] = useState<string>("patient-classification");

  const snapshot = useMemo(
    () =>
      engineSnapshot(buildEngineContext(draft.values, draft.cycles), {
        disabled: settings.disabled,
      }),
    [draft.values, draft.cycles, settings.disabled],
  );

  const patientLabel = String(draft.values["fullName"] ?? "Unsaved draft");
  const selectedResult = snapshot.results.get(selected);

  const counts = engineModules.reduce<Record<string, number>>((acc, m) => {
    const s = snapshot.results.get(m.id)?.status ?? "waiting-data";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const handleToggle = (id: string, next: boolean) => {
    toggleModule(id, next);
    log({
      user: "Consultant",
      patient: patientLabel,
      moduleId: id,
      moduleName: engineModuleName(id),
      action: next ? "module-enabled" : "module-disabled",
      version: findEngineModule(id)?.version ?? "0.1.0",
    });
  };

  const handleInspect = (id: string) => {
    setSelected(id);
    log({
      user: "Consultant",
      patient: patientLabel,
      moduleId: id,
      moduleName: engineModuleName(id),
      action: "module-inspected",
      version: findEngineModule(id)?.version ?? "0.1.0",
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Architecture"
        title="Clinical Intelligence Engine"
        description="Every future medical algorithm runs as an independent, versioned engine. This release ships the framework only — no calculation, dose, protocol or recommendation is produced anywhere in the pipeline."
        actions={
          <Button
            className="rounded-xl"
            onClick={() =>
              log({
                user: "Consultant",
                patient: patientLabel,
                moduleId: null,
                moduleName: "Calculation queue",
                action: "queue-evaluated",
                version: "0.1.0",
                detail: `${snapshot.readiness}% average input completion`,
              })
            }
          >
            <Activity className="size-4" /> Re-evaluate queue
          </Button>
        }
      />

      <WorkflowStepper className="mb-5" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Calculation modules", value: engineModules.length, icon: Cpu },
          { label: "Enabled", value: enabledCount, icon: ListChecks },
          { label: "Average input completion", value: `${snapshot.readiness}%`, icon: Database },
          { label: "Awaiting data", value: counts["waiting-data"] ?? 0, icon: CircleSlash },
        ].map((s) => (
          <div
            key={s.label}
            className="animate-rise grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="modules" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="queue">Queue & dependencies</TabsTrigger>
          <TabsTrigger value="report">Report structure</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="settings">System settings</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-5 grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {engineModules.map((m) => {
              const result = snapshot.results.get(m.id);
              if (!result) return null;
              return (
                <ModuleCard
                  key={m.id}
                  result={result}
                  enabled={isEnabled(m.id)}
                  selected={selected === m.id}
                  onToggle={(next) => handleToggle(m.id, next)}
                  onInspect={() => handleInspect(m.id)}
                />
              );
            })}
          </div>
          {selectedResult && <ExplanationPanel result={selectedResult} />}
        </TabsContent>

        <TabsContent value="queue" className="mt-5 grid gap-5">
          <SectionCard
            title="Calculation queue"
            description="Modules execute in dependency order across five pipeline stages."
          >
            <div className="grid gap-4">
              {engineStages.map((stage, index) => {
                const inStage = snapshot.order.filter((m) => m.stage === stage.id);
                return (
                  <div key={stage.id} className="grid gap-3">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{stage.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 grid gap-2 border-l border-dashed border-border pl-6">
                      {stage.id === "validation" ? (
                        <div className="rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5 text-sm">
                          Assessment validation — missing, invalid and conflicting data checks
                        </div>
                      ) : (
                        inStage.map((m) => {
                          const r = snapshot.results.get(m.id);
                          return (
                            <div
                              key={m.id}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-2.5"
                            >
                              <p className="truncate text-sm">
                                <span className="text-muted-foreground">{m.order}. </span>
                                {m.name}
                              </p>
                              {r && <StatusBadge status={r.status} />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Dependency graph"
            description="Each engine resolves only after its upstream engines."
          >
            <div className="grid gap-2.5">
              {snapshot.order.map((m) => (
                <div
                  key={m.id}
                  className="grid gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-center"
                >
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {m.dependsOn.length ? (
                      m.dependsOn.map((dep) => (
                        <span key={dep} className="inline-flex items-center gap-1">
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                          <Badge variant="secondary" className="rounded-lg font-normal">
                            {engineModuleName(dep)}
                          </Badge>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No dependencies</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="report" className="mt-5">
          <SectionCard
            title="Report structure"
            description="Section skeleton for the generated clinical report. All clinical content stays empty."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {reportSections.map((s) => (
                <div key={s.id} className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <p className="truncate font-semibold">{s.title}</p>
                    <Badge variant="outline" className="rounded-lg font-normal">
                      {s.manual ? "Physician" : "Engine"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  <EmptyPlaceholder className="mt-3 min-h-16" label="Empty" />
                  {s.sourceModuleId && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Source: {engineModuleName(s.sourceModuleId)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="audit" className="mt-5">
          <SectionCard
            title="Audit log"
            description="Date, time, user, patient, module, action and version for every framework event."
            action={
              <Button variant="outline" size="sm" className="rounded-xl" onClick={clear}>
                Clear
              </Button>
            }
          >
            {entries.length === 0 ? (
              <EmptyPlaceholder
                label="No activity recorded yet"
                hint="Toggle or inspect a module to create the first audit entry."
              />
            ) : (
              <ul className="grid gap-2">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="grid gap-1 rounded-xl border border-border/70 bg-card px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {auditActionLabels[e.action]} — {e.moduleName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.user} · {e.patient} · v{e.version}
                        {e.detail ? ` · ${e.detail}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.timestamp).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="settings" className="mt-5 grid gap-5">
          <SectionCard
            title="Calculation modules"
            description="Enable or disable engines and review their version. Disabled engines report as Locked."
          >
            <div className="grid gap-2">
              {engineModules.map((m) => (
                <div
                  key={m.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      v{m.version} · updated {m.lastUpdated} · {m.futureExpansion}
                    </p>
                  </div>
                  <Switch
                    checked={isEnabled(m.id)}
                    onCheckedChange={(next) => handleToggle(m.id, next)}
                    aria-label={`Enable ${m.name}`}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Databases & sources"
            description="Reference sources the engines will read from once implemented."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["evidenceSources", "Evidence sources", BookOpen],
                  ["medicationDatabase", "Medication database", Layers],
                  ["protocolDatabase", "Protocol database", GitBranch],
                  ["brandDatabase", "Brand database", Sparkles],
                ] as const
              ).map(([key, label, Icon]) => (
                <div key={key} className="rounded-xl border border-border/70 bg-card p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-primary" /> {label}
                  </p>
                  <select
                    value={settings.databases[key]}
                    onChange={(e) => {
                      setDatabase(key, e.target.value);
                      log({
                        user: "Consultant",
                        patient: patientLabel,
                        moduleId: null,
                        moduleName: label,
                        action: "settings-updated",
                        version: "0.1.0",
                        detail: e.target.value,
                      });
                    }}
                    className="mt-3 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {databaseOptions[key].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Future algorithm updates</p>
                <p className="text-xs text-muted-foreground">
                  Adopt new engine versions automatically once they pass scientific validation.
                </p>
              </div>
              <Switch checked={settings.autoUpdateAlgorithms} onCheckedChange={setAutoUpdate} />
            </div>
          </SectionCard>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-border/70 bg-muted/40 p-5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
              No engine in this release computes a score, dose, protocol or recommendation. Each one
              becomes active only after its source publication has been formally mapped and
              validated.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-border/70 bg-card p-5 text-sm text-muted-foreground shadow-soft">
        <History className="mt-0.5 size-4 shrink-0" />
        <p>
          Framework version 0.1.0 — module contracts, execution queue, dependency resolution,
          validation surface, audit trail and report skeleton. Clinical logic ships separately.
        </p>
      </div>
    </>
  );
}
