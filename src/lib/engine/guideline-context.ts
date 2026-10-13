/**
 * Derivation of guideline population tags for the current patient.
 *
 * This module performs NO clinical calculation. It only translates outputs
 * that other engines have already produced (predicted ovarian response,
 * POSEIDON/Bologna status, recorded PCOS and recorded age) into the
 * population labels the ESHRE 2025 guideline itself uses to scope its
 * recommendations, so that only the applicable verbatim statements are shown.
 */

import type { FieldValue } from "@/lib/assessment/use-assessment";
import type { PopulationTag } from "@/lib/evidence/eshre-os-2025";
import type { OvarianResponseResult } from "./ovarian-response";
import type { PhenotypeResult } from "./phenotype";

export function derivePopulationTags(
  phenotype: PhenotypeResult | null,
  response: OvarianResponseResult | null,
  values: Record<string, FieldValue> = {},
): PopulationTag[] {
  const tags = new Set<PopulationTag>(["general"]);

  switch (response?.category) {
    case "very-poor":
    case "poor":
    case "suboptimal":
      tags.add("low-responder");
      break;
    case "normal":
      tags.add("normal-responder");
      break;
    case "high":
    case "hyper":
      tags.add("high-responder");
      tags.add("ohss-risk");
      break;
    default:
      break;
  }

  if (response?.risks?.some((r) => r.id === "ohss" || /ohss/i.test(r.label ?? ""))) {
    tags.add("ohss-risk");
  }

  const age = phenotype?.poseidon?.inputs?.age ?? null;
  if (typeof age === "number" && age >= 35) tags.add("advanced-age");

  const causes = Array.isArray(values["causes"]) ? (values["causes"] as string[]) : [];
  const pcosField = typeof values["pcos"] === "string" ? (values["pcos"] as string) : "";
  if (causes.some((c) => /pcos|polycystic/i.test(c)) || /yes/i.test(pcosField)) {
    tags.add("pcos");
    tags.add("ohss-risk");
  }

  return [...tags];
}
