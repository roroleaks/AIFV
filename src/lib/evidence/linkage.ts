/**
 * Evidence ↔ module linkage.
 *
 * Resolves which references back each knowledge module and each calculation
 * engine. Linkage is declarative: it never infers a rule, a threshold or a
 * recommendation from any publication.
 */

import { knowledgeModules, findModule } from "@/lib/clinical/knowledge-model";
import { engineModules } from "@/lib/engine/registry";
import type { EvidenceEntry } from "./library";

export interface ModuleEvidenceLink {
  moduleId: string;
  moduleName: string;
  /** "knowledge" = clinical knowledge model, "engine" = calculation engine. */
  kind: "knowledge" | "engine";
  entries: EvidenceEntry[];
  /** Declared evidence ids with no matching entry in the library. */
  missing: string[];
}

export function moduleLinks(library: EvidenceEntry[]): ModuleEvidenceLink[] {
  const byId = new Map(library.map((e) => [e.id, e]));

  const knowledge: ModuleEvidenceLink[] = knowledgeModules.map((m) => {
    const declared = new Set(m.evidence);
    library.forEach((e) => {
      if (e.modules.includes(m.id)) declared.add(e.id);
    });
    return {
      moduleId: m.id,
      moduleName: m.name,
      kind: "knowledge" as const,
      entries: [...declared]
        .map((id) => byId.get(id))
        .filter((e): e is EvidenceEntry => Boolean(e)),
      missing: [...declared].filter((id) => !byId.has(id)),
    };
  });

  const engine: ModuleEvidenceLink[] = engineModules.map((m) => {
    const declared = new Set(m.evidence);
    if (m.knowledgeModuleId) {
      library.forEach((e) => {
        if (e.modules.includes(m.knowledgeModuleId!)) declared.add(e.id);
      });
    }
    return {
      moduleId: m.id,
      moduleName: m.name,
      kind: "engine" as const,
      entries: [...declared]
        .map((id) => byId.get(id))
        .filter((e): e is EvidenceEntry => Boolean(e)),
      missing: [...declared].filter((id) => !byId.has(id)),
    };
  });

  return [...knowledge, ...engine];
}

export function evidenceForEntry(entry: EvidenceEntry, library: EvidenceEntry[]) {
  const links = moduleLinks(library).filter((l) => l.entries.some((e) => e.id === entry.id));
  return links;
}

/** Related references sharing at least one topic. */
export function relatedEntries(entry: EvidenceEntry, library: EvidenceEntry[], limit = 4) {
  return library
    .filter((e) => e.id !== entry.id)
    .map((e) => ({ e, overlap: e.topics.filter((t) => entry.topics.includes(t)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.e.year - a.e.year)
    .slice(0, limit)
    .map((x) => x.e);
}

export const moduleDisplayName = (id: string) => findModule(id)?.name ?? id;
