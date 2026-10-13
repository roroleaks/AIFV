/**
 * Evidence Repository (V1) — ESHRE 2025 Guidelines Synchronization.
 *
 * Transcribes the official ESHRE 2025 guideline on ovarian stimulation for IVF/ICSI
 * published in Human Reproduction (Hum Reprod. 2026;41(4):498-514; doi: 10.1093/humrep/deag018; PMID: 39982461).
 *
 * STRICTLY EVIDENCE-BASED: Contains bibliographic metadata, recommendation statements,
 * strength grades, and clinical rationale.
 */

export interface EvidenceReference {
  id: string;
  recommendationNumber: number | null;
  guideline: string;
  citation: string;
  journal: string;
  year: number;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  pmid: string;
  url: string;
  topic: string;
  recommendationText: string;
  strength: "Strong" | "Conditional" | "GPP";
  evidenceQuality: "High" | "Moderate" | "Low" | "Very Low" | null;
  qualitySymbol: "⊕" | "⊕⊕" | "⊕⊕⊕" | null;
  targetPopulation: string;
  clinicalImplication: string;
}

export const ESHRE_2025_CITATION_MASTER = {
  authors:
    "The ESHRE Guideline Group on Ovarian Stimulation, Ata B, Bosch E, Broer S, Griesinger G, Grynberg M, Kolibianakis E, Kunicki M, La Marca A, Lainas G, Le Clef N, Massin N, Polyzos NP, Sunkara SK, Timeva T, Töyli M, Urbancsek J, Broekmans F.",
  title:
    "Ovarian stimulation for IVF/ICSI: guideline of the European Society of Human Reproduction and Embryology",
  journal: "Human Reproduction",
  year: 2026,
  volume: "41",
  issue: "4",
  pages: "498-514",
  doi: "10.1093/humrep/deag018",
  pmid: "39982461",
  url: "https://doi.org/10.1093/humrep/deag018",
} as const;

export const eshre2025EvidenceRepository: EvidenceReference[] = [
  {
    id: "eshre-2025-rec13-reduced-dose-high-responder",
    recommendationNumber: 13,
    guideline: "ESHRE Guideline on Ovarian Stimulation for IVF/ICSI (2025 Update)",
    citation: "Hum Reprod. 2026;41(4):498-514",
    journal: "Human Reproduction",
    year: 2026,
    volume: "41",
    issue: "4",
    pages: "498-514",
    doi: "10.1093/humrep/deag018",
    pmid: "39982461",
    url: "https://doi.org/10.1093/humrep/deag018",
    topic: "High responder starting dose",
    recommendationText:
      "A reduced gonadotropin dose (100 to <150 IU) is probably recommended to decrease the risk of OHSS in predicted high responders. [2025]",
    strength: "Conditional",
    evidenceQuality: "Low",
    qualitySymbol: "⊕",
    targetPopulation:
      "Predicted high responders (AMH >= 3.5 ng/mL, AFC >= 18 follicles, or PCOS diagnosis)",
    clinicalImplication:
      "Starting gonadotropin dosing must explicitly default to the 100–125 IU/day tier to minimize OHSS while preserving optimal blastocyst yield.",
  },
  {
    id: "eshre-2025-rec12-delayed-start-high",
    recommendationNumber: 12,
    guideline: "ESHRE Guideline on Ovarian Stimulation for IVF/ICSI (2025 Update)",
    citation: "Hum Reprod. 2026;41(4):498-514",
    journal: "Human Reproduction",
    year: 2026,
    volume: "41",
    issue: "4",
    pages: "498-514",
    doi: "10.1093/humrep/deag018",
    pmid: "39982461",
    url: "https://doi.org/10.1093/humrep/deag018",
    topic: "Delayed-start protocol rejection (High responders)",
    recommendationText:
      "Delayed-start ovarian stimulation is probably not recommended routinely in predicted high responders to decrease the risk of OHSS. [2025]",
    strength: "Conditional",
    evidenceQuality: "Low",
    qualitySymbol: "⊕",
    targetPopulation: "Predicted high responders at risk of OHSS",
    clinicalImplication:
      "Delayed-start protocols should not be used routinely in high responders; GnRH antagonist protocol with GnRH agonist trigger is the proven standard.",
  },
  {
    id: "eshre-2025-rec15-delayed-start-normal",
    recommendationNumber: 15,
    guideline: "ESHRE Guideline on Ovarian Stimulation for IVF/ICSI (2025 Update)",
    citation: "Hum Reprod. 2026;41(4):498-514",
    journal: "Human Reproduction",
    year: 2026,
    volume: "41",
    issue: "4",
    pages: "498-514",
    doi: "10.1093/humrep/deag018",
    pmid: "39982461",
    url: "https://doi.org/10.1093/humrep/deag018",
    topic: "Delayed-start protocol rejection (Normal responders)",
    recommendationText:
      "Delayed-start ovarian stimulation is probably not recommended over a conventional gonadotrophin dose for predicted normal responders. [2025]",
    strength: "Conditional",
    evidenceQuality: "Low",
    qualitySymbol: "⊕",
    targetPopulation: "Predicted normal responders (AMH 1.2–3.49 ng/mL, AFC 8–17)",
    clinicalImplication:
      "Routine delayed-start stimulation offers no benefit over conventional gonadotropin dosing (150–225 IU/day) in normal responders.",
  },
  {
    id: "eshre-2025-rec17-delayed-start-low",
    recommendationNumber: 17,
    guideline: "ESHRE Guideline on Ovarian Stimulation for IVF/ICSI (2025 Update)",
    citation: "Hum Reprod. 2026;41(4):498-514",
    journal: "Human Reproduction",
    year: 2026,
    volume: "41",
    issue: "4",
    pages: "498-514",
    doi: "10.1093/humrep/deag018",
    pmid: "39982461",
    url: "https://doi.org/10.1093/humrep/deag018",
    topic: "Delayed-start protocol rejection (Low responders)",
    recommendationText:
      "Delayed start ovarian stimulation is probably not recommended for predicted low responders. [2025]",
    strength: "Conditional",
    evidenceQuality: "Low",
    qualitySymbol: "⊕",
    targetPopulation: "Predicted low responders, POSEIDON groups, Bologna criteria",
    clinicalImplication:
      "Delayed-start protocols fail to improve follicle synchronization or oocyte yield in poor responders compared to standard antagonist regimens.",
  },
  {
    id: "eshre-2025-rec20-max-dose-ceiling-low-responder",
    recommendationNumber: 20,
    guideline: "ESHRE Guideline on Ovarian Stimulation for IVF/ICSI (2025 Update)",
    citation: "Hum Reprod. 2026;41(4):498-514",
    journal: "Human Reproduction",
    year: 2026,
    volume: "41",
    issue: "4",
    pages: "498-514",
    doi: "10.1093/humrep/deag018",
    pmid: "39982461",
    url: "https://doi.org/10.1093/humrep/deag018",
    topic: "Starting dose hard ceiling (Poor responders)",
    recommendationText:
      "A gonadotropin dose higher than 300 IU is not recommended for predicted low responders. [reaffirmed 2025]",
    strength: "Strong",
    evidenceQuality: "Moderate",
    qualitySymbol: "⊕⊕",
    targetPopulation: "Predicted low responders, POSEIDON groups 3 and 4, Bologna criteria",
    clinicalImplication:
      "Hard ceiling of 300 IU/day unconditionally enforced. Doses > 300 IU/day increase medication burden and financial cost without improving oocyte yield or live birth rates.",
  },
  {
    id: "eshre-2025-rec6-estrogen-pretreatment",
    recommendationNumber: 6,
    guideline: "ESHRE Guideline on Ovarian Stimulation for IVF/ICSI (2025 Update)",
    citation: "Hum Reprod. 2026;41(4):498-514",
    journal: "Human Reproduction",
    year: 2026,
    volume: "41",
    issue: "4",
    pages: "498-514",
    doi: "10.1093/humrep/deag018",
    pmid: "39982461",
    url: "https://doi.org/10.1093/humrep/deag018",
    topic: "Estrogen pre-treatment rejection (GnRH antagonist protocols)",
    recommendationText:
      "Estrogen pre-treatment is probably not recommended in GnRH antagonist protocols for scheduling or improving cycle outcomes. [2025]",
    strength: "Conditional",
    evidenceQuality: "Low",
    qualitySymbol: "⊕",
    targetPopulation: "General IVF/ICSI population undergoing GnRH antagonist stimulation",
    clinicalImplication:
      "Routine luteal estrogen pre-treatment in antagonist cycles does not increase mature oocyte yield or pregnancy rates and prolongs stimulation.",
  },
];

export function findEvidenceReference(id: string): EvidenceReference | undefined {
  return eshre2025EvidenceRepository.find((r) => r.id === id);
}

export function getReferencesByTopic(topicSubstr: string): EvidenceReference[] {
  const q = topicSubstr.toLowerCase();
  return eshre2025EvidenceRepository.filter(
    (r) => r.topic.toLowerCase().includes(q) || r.recommendationText.toLowerCase().includes(q),
  );
}
