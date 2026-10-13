/**
 * Engine runtime — orchestration only.
 *
 * Resolves the execution queue, evaluates dependencies, checks variable
 * availability and produces empty result envelopes. It performs no clinical
 * calculation of any kind: every `results` field is null and every
 * `confidence` is null by design.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { buildClinicalDataset, clinicalVariables } from "@/lib/clinical/data-mapping";
import { validateAssessment } from "@/lib/assessment/validation";
import { engineModules, findEngineModule } from "./registry";
import type {
  EngineContext,
  EngineIssue,
  EngineModuleDefinition,
  EngineResult,
  EngineStatus,
} from "./types";

const variableLabel = (id: string) =>
  clinicalVariables.find((v) => v.id === id)?.label ?? id;

const variableFields = (id: string) =>
  clinicalVariables.find((v) => v.id === id)?.source ?? [];

/** Dependency-aware execution order (stable topological sort). */
export function resolveExecutionOrder(
  modules: EngineModuleDefinition[] = engineModules,
): EngineModuleDefinition[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: EngineModuleDefinition[] = [];

  const visit = (module: EngineModuleDefinition) => {
    if (visited.has(module.id) || visiting.has(module.id)) return;
    visiting.add(module.id);
    module.dependsOn.forEach((depId) => {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    });
    visiting.delete(module.id);
    visited.add(module.id);
    ordered.push(module);
  };

  [...modules].sort((a, b) => a.order - b.order).forEach(visit);
  return ordered;
}

export function buildEngineContext(
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  patientId?: string,
): EngineContext {
  return { patientId, values, cycles, dataset: buildClinicalDataset(values, cycles) };
}

export interface EngineRuntimeOptions {
  /** Module ids explicitly disabled in system settings. */
  disabled?: string[];
}

/** Evaluate every module: readiness, issues and an empty result envelope. */
export function runEngineQueue(
  context: EngineContext,
  options: EngineRuntimeOptions = {},
): EngineResult[] {
  const disabled = new Set(options.disabled ?? []);
  const present = new Map(context.dataset.map((d) => [d.variable.id, d.present]));
  const validation = validateAssessment(context.values, context.cycles);
  const order = resolveExecutionOrder();
  const results = new Map<string, EngineResult>();

  for (const module of order) {
    const required = module.requiredInputs;
    const optional = module.optionalInputs;
    const all = [...required, ...optional];
    const used = all.filter((id) => present.get(id));
    const missingRequired = required.filter((id) => !present.get(id));
    const missingOptional = optional.filter((id) => !present.get(id));

    const issues: EngineIssue[] = missingRequired.map((id) => ({
      kind: "missing",
      variableId: id,
      message: `${variableLabel(id)} is required before this engine can run.`,
    }));

    const touched = new Set(all.flatMap(variableFields));
    validation
      .filter((v) => v.fields.some((f) => touched.has(f)))
      .forEach((v) => {
        issues.push({
          kind:
            v.severity === "conflict"
              ? "conflict"
              : v.severity === "error"
                ? "invalid"
                : v.severity === "duplicate"
                  ? "conflict"
                  : "missing",
          message: `${v.title} — ${v.detail}`,
        });
      });

    if (module.id !== "patient-classification" && context.cycles.length === 0 && optional.some((o) => o.startsWith("previous"))) {
      issues.push({
        kind: "incomplete-history",
        message: "No previous cycle recorded — historical variables are unavailable.",
      });
    }

    const blockedBy = module.dependsOn.filter((depId) => {
      const dep = results.get(depId);
      return dep ? dep.status === "waiting-data" || dep.status === "locked" : false;
    });

    let status: EngineStatus;
    if (disabled.has(module.id)) status = "locked";
    else if (module.implementation === "planned") status = "future";
    else if (missingRequired.length > 0 || blockedBy.length > 0) status = "waiting-data";
    else status = "ready";

    if (blockedBy.length > 0 && status === "waiting-data") {
      blockedBy.forEach((depId) => {
        issues.push({
          kind: "incomplete-history",
          message: `Waiting on ${findEngineModule(depId)?.name ?? depId}.`,
        });
      });
    }

    const completion = all.length === 0 ? 100 : Math.round((used.length / all.length) * 100);

    results.set(module.id, {
      moduleId: module.id,
      version: module.version,
      status,
      confidence: null,
      results: null,
      explanation: {
        rationale: null,
        variablesUsed: used.map(variableLabel),
        variablesMissing: [...missingRequired, ...missingOptional].map(variableLabel),
        evidence: module.evidence,
        interpretation: null,
      },
      completion,
      issues,
      computedAt: null,
    });
  }

  return order.map((m) => results.get(m.id)!);
}

export interface EngineSnapshot {
  order: EngineModuleDefinition[];
  results: Map<string, EngineResult>;
  list: EngineResult[];
  readiness: number;
}

export function engineSnapshot(
  context: EngineContext,
  options: EngineRuntimeOptions = {},
): EngineSnapshot {
  const list = runEngineQueue(context, options);
  const order = resolveExecutionOrder();
  const readiness = list.length
    ? Math.round(list.reduce((sum, r) => sum + r.completion, 0) / list.length)
    : 0;
  return { order, results: new Map(list.map((r) => [r.moduleId, r])), list, readiness };
}
