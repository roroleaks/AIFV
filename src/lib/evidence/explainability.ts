/**
 * Explainable AI framework — reserved contracts only.
 *
 * Defines the shape every future clinical decision module must fill so that
 * no output can ever be a black box. This file contains no clinical logic,
 * no recommendation text and no inference from any publication.
 */

export type RecommendationStrength = "Strong" | "Conditional" | "Good practice point" | "Not graded";

export interface EvidenceCitationRef {
  evidenceId: string;
  /** Optional locator inside the publication (section, table, page). */
  locator?: string;
}

/** The envelope a future engine returns alongside any recommendation. */
export interface ExplainableOutput {
  moduleId: string;
  /** Reserved — no module produces recommendation text in this release. */
  recommendation: null;
  supportingGuidelines: EvidenceCitationRef[];
  supportingPublications: EvidenceCitationRef[];
  /** Reserved — populated from the cited entries once a rule is validated. */
  evidenceLevel: null;
  strength: RecommendationStrength | null;
  clinicalNotes: string | null;
  /** Reserved — no confidence score is computed in this release. */
  confidence: number | null;
  explanation: null;
  generatedAt: string | null;
}

export const explainabilityFields: { id: keyof ExplainableOutput | "year" | "doi"; label: string; description: string }[] = [
  { id: "recommendation", label: "Recommendation", description: "The statement produced by a validated module." },
  { id: "supportingGuidelines", label: "Supporting guideline", description: "ASRM / ESHRE documents backing the statement." },
  { id: "supportingPublications", label: "Supporting publications", description: "Primary studies and syntheses cited." },
  { id: "evidenceLevel", label: "Evidence level", description: "Level carried by the cited references." },
  { id: "strength", label: "Strength of recommendation", description: "Strong, conditional or good practice point." },
  { id: "year", label: "Year", description: "Publication year of each citation." },
  { id: "doi", label: "DOI", description: "Persistent identifier of each citation." },
  { id: "clinicalNotes", label: "Clinical notes", description: "Physician-authored context stored with the reference." },
  { id: "confidence", label: "Confidence", description: "Data completeness and concordance of the inputs used." },
  { id: "explanation", label: "Explanation", description: "Trace of which variables and criteria produced the output." },
];

/** Empty envelope used by modules that are not implemented yet. */
export function reservedExplanation(moduleId: string): ExplainableOutput {
  return {
    moduleId,
    recommendation: null,
    supportingGuidelines: [],
    supportingPublications: [],
    evidenceLevel: null,
    strength: null,
    clinicalNotes: null,
    confidence: null,
    explanation: null,
    generatedAt: null,
  };
}
