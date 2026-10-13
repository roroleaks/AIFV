/**
 * AI IVF CDSS — 20-Source Evidence Master Library (ingestion & indexing layer).
 *
 * This module is a PURE EVIDENCE INDEX. It contains no clinical calculation,
 * no threshold, no coefficient, no dose and no recommendation. Nothing here
 * activates or modifies any algorithm: it only records what the supplied
 * source pack (AI_IVF_CDSS_20_Source_Evidence_Pack.md) states, with full
 * provenance, and audits whether that evidence would be sufficient for a
 * future implementation pass.
 *
 * Rule enforced by construction: PAPER INGESTED ≠ ALGORITHM ACTIVATED.
 */

export const MASTER_PACK_FILE = "AI_IVF_CDSS_20_Source_Evidence_Pack.md";
export const MASTER_PACK_INGESTED_AT = "2026-08-10";

/** Marker used wherever the supplied source does not establish a field. */
export const NOT_VERIFIED = "NOT VERIFIED" as const;

export type MasterEvidenceDomain =
  | "A. CONSORT"
  | "B. Individualized gonadotropin dosing"
  | "C. AMH-based dosing"
  | "D. Follitropin-delta individualized dosing"
  | "E. ESHRE ovarian stimulation guidance"
  | "F. ASRM guidance"
  | "G. POSEIDON"
  | "H. Bologna / poor ovarian response"
  | "I. OHSS prevention / safety"
  | "J. Other IVF/ICSI evidence";

export type EvidenceArtefactKind =
  | "Numerical algorithm"
  | "Clinical practice guideline"
  | "Classification framework"
  | "Systematic review"
  | "Trial registry"
  | "Bibliographic record"
  | "Document collection";

export interface MasterEvidenceRecord {
  /** Stable identifier — never reused. */
  evidenceId: string;
  packNumber: number;
  title: string;
  authors: string | typeof NOT_VERIFIED;
  journal: string | typeof NOT_VERIFIED;
  year: number | typeof NOT_VERIFIED;
  doi: string | typeof NOT_VERIFIED;
  pubmedId: string | typeof NOT_VERIFIED;
  urls: string[];
  domains: MasterEvidenceDomain[];
  artefactKind: EvidenceArtefactKind;
  studyType: string | typeof NOT_VERIFIED;
  population: string | typeof NOT_VERIFIED;
  intervention: string | typeof NOT_VERIFIED;
  mainOutcome: string | typeof NOT_VERIFIED;
  relevantVariables: string[];
  /** Verbatim/condensed relevance statement from the supplied pack. */
  relevance: string;
  validationStatus: string;
  implementationRelevance: string;
  limitations: string;
  /** Existing Evidence Library entry id, when the same publication is present. */
  linkedLibraryId?: string;
  provenance: string;
}

export const masterEvidenceRecords: MasterEvidenceRecord[] = [
  {
    evidenceId: "pack-01-consort-core-2011",
    packNumber: 1,
    title:
      "Individualizing FSH dose for assisted reproduction using a novel algorithm: the CONSORT study",
    authors: NOT_VERIFIED,
    journal: "Reproductive BioMedicine Online",
    year: 2011,
    doi: "10.1016/S1472-6483(11)60012-6",
    pubmedId: "21575853",
    urls: [
      "https://pubmed.ncbi.nlm.nih.gov/21575853/",
      "https://www.sciencedirect.com/science/article/pii/S1472648311600126",
    ],
    domains: ["A. CONSORT", "B. Individualized gonadotropin dosing"],
    artefactKind: "Numerical algorithm",
    studyType: NOT_VERIFIED,
    population:
      "Normo-ovulatory women, age 18–34 years, long GnRH-agonist protocol (as stated in the pack).",
    intervention: "Individualized recombinant FSH starting dose in 37.5-IU increments.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["Basal FSH", "BMI", "Age", "Antral follicle count (AFC)"],
    relevance:
      "Original CONSORT algorithm. Uses basal FSH, BMI, age and AFC; assigns 37.5-IU increments. Published pilot population: normo-ovulatory women aged 18–34 using a long GnRH-agonist protocol.",
    validationStatus: "Pilot publication; validation evidence not contained in the supplied pack.",
    implementationRelevance:
      "Primary source for CONSORT. The pack names the input variables and the dose increment but does not supply the band/points tables or the score-to-dose crosswalk.",
    limitations:
      "Population restricted to normo-ovulatory women 18–34 on a long agonist protocol. Numerical tables are NOT present in the supplied pack.",
    linkedLibraryId: "rbmo-2015-consort-fsh-dose",
    provenance: `${MASTER_PACK_FILE} § 01`,
  },
  {
    evidenceId: "pack-02-consort-development",
    packNumber: 2,
    title: "Original CONSORT development/evaluation paper",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://www.sciencedirect.com/science/article/abs/pii/S1472648310602568"],
    domains: ["A. CONSORT"],
    artefactKind: "Numerical algorithm",
    studyType: NOT_VERIFIED,
    population: NOT_VERIFIED,
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Earlier CONSORT development/evaluation evidence.",
    validationStatus: NOT_VERIFIED,
    implementationRelevance:
      "Potential source of the derivation tables; abstract-only URL supplied, contents not verifiable from the pack.",
    limitations: "Abstract-only publisher link; no metadata supplied.",
    provenance: `${MASTER_PACK_FILE} § 02`,
  },
  {
    evidenceId: "pack-03-consort-rct",
    packNumber: 3,
    title:
      "Individualized versus conventional ovarian stimulation for IVF — randomized controlled non-inferiority study",
    authors: NOT_VERIFIED,
    journal: "Reproductive BioMedicine Online",
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: "25596910",
    urls: [
      "https://www.rbmojournal.com/article/S1472-6483(14)00643-9/fulltext",
      "https://pubmed.ncbi.nlm.nih.gov/25596910/",
    ],
    domains: ["A. CONSORT", "B. Individualized gonadotropin dosing"],
    artefactKind: "Numerical algorithm",
    studyType: "Randomized controlled non-inferiority trial",
    population: NOT_VERIFIED,
    intervention: "Individualized versus conventional ovarian stimulation.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Randomized clinical evaluation of CONSORT.",
    validationStatus: "Validation source for CONSORT.",
    implementationRelevance:
      "Validation evidence only; the pack does not reproduce the algorithm's numerical content.",
    limitations: "Trial population and outcomes not supplied in the pack.",
    provenance: `${MASTER_PACK_FILE} § 03`,
  },
  {
    evidenceId: "pack-04-consort-observational",
    packNumber: 4,
    title: "CONSORT clinical-practice observational study",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://pmc.ncbi.nlm.nih.gov/articles/PMC4403744/"],
    domains: ["A. CONSORT"],
    artefactKind: "Numerical algorithm",
    studyType: "Observational study",
    population: NOT_VERIFIED,
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance:
      "Subsequent use/modification of the CONSORT calculator and starting-dose categories.",
    validationStatus: NOT_VERIFIED,
    implementationRelevance:
      "Describes a MODIFIED use of the calculator — must not be merged with the original algorithm.",
    limitations: "Modification details not supplied; conflict risk with the 2011 original.",
    provenance: `${MASTER_PACK_FILE} § 04`,
  },
  {
    evidenceId: "pack-05-consort-registry",
    packNumber: 5,
    title: "CONSORT trial registry record (NCT00829244)",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://clinicaltrials.gov/study/NCT00829244"],
    domains: ["A. CONSORT"],
    artefactKind: "Trial registry",
    studyType: "Trial registration",
    population: NOT_VERIFIED,
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Trial registration and population/intervention context.",
    validationStatus: "Not an outcome source.",
    implementationRelevance: "Provenance/context only.",
    limitations: "Registry record; contains no algorithm tables.",
    provenance: `${MASTER_PACK_FILE} § 05`,
  },
  {
    evidenceId: "pack-06-amh-based-fsh-rct",
    packNumber: 6,
    title:
      "A randomized controlled trial of AMH-based individualized FSH dosing in a GnRH antagonist protocol for IVF",
    authors: NOT_VERIFIED,
    journal: "Human Reproduction Open",
    year: NOT_VERIFIED,
    doi: "10.1093/hropen/hoz003",
    pubmedId: NOT_VERIFIED,
    urls: ["https://pmc.ncbi.nlm.nih.gov/articles/PMC6396645/"],
    domains: ["C. AMH-based dosing", "B. Individualized gonadotropin dosing"],
    artefactKind: "Numerical algorithm",
    studyType: "Randomized controlled trial",
    population: "GnRH antagonist protocol IVF population (details not supplied).",
    intervention: "AMH-based individualized FSH dosing.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["AMH"],
    relevance: "Important comparator to CONSORT. This is a different AMH-based algorithm.",
    validationStatus: "Distinct algorithm — not CONSORT validation.",
    implementationRelevance:
      "Must be kept architecturally separate from CONSORT; variables and thresholds are not interchangeable.",
    limitations: "Different algorithm, different protocol, different population.",
    provenance: `${MASTER_PACK_FILE} § 06`,
  },
  {
    evidenceId: "pack-07-cochrane-2024-individualised-dosing",
    packNumber: 7,
    title: "Individualized gonadotropin dose selection — Cochrane review",
    authors: NOT_VERIFIED,
    journal: "Cochrane Database of Systematic Reviews",
    year: 2024,
    doi: "10.1002/14651858.CD012693.pub3",
    pubmedId: "38174816",
    urls: [
      "https://pubmed.ncbi.nlm.nih.gov/38174816/",
      "https://www.cochrane.org/evidence/CD012693_how-effective-are-individualised-doses-hormones-women-trying-become-pregnant-through-vitro",
    ],
    domains: ["B. Individualized gonadotropin dosing"],
    artefactKind: "Systematic review",
    studyType: "Systematic review / meta-analysis",
    population: NOT_VERIFIED,
    intervention: "Individualized versus standard gonadotropin dosing.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance:
      "Systematic review of individualized gonadotropin dosing and certainty/limitations of evidence.",
    validationStatus: "Evidence-certainty appraisal source.",
    implementationRelevance:
      "Contextual certainty assessment; contains no dosing algorithm to implement.",
    limitations: "Review-level; no per-patient calculation content supplied.",
    provenance: `${MASTER_PACK_FILE} § 07`,
  },
  {
    evidenceId: "pack-08-follitropin-delta-asian-rct",
    packNumber: 8,
    title: "Follitropin delta individualized dosing — Asian validation RCT",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: "34179971",
    urls: [
      "https://pubmed.ncbi.nlm.nih.gov/34179971/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC8373472/",
    ],
    domains: ["D. Follitropin-delta individualized dosing"],
    artefactKind: "Numerical algorithm",
    studyType: "Randomized controlled trial",
    population: "Asian IVF population (details not supplied).",
    intervention: "AMH + body-weight individualized follitropin-delta regimen.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["AMH", "Body weight"],
    relevance: "AMH + body-weight individualized follitropin-delta regimen. NOT CONSORT.",
    validationStatus: "Validation source for the follitropin-delta algorithm only.",
    implementationRelevance: "Separate dosing system; must never be blended with CONSORT.",
    limitations: "Product-specific algorithm; not transferable to other gonadotropins.",
    provenance: `${MASTER_PACK_FILE} § 08`,
  },
  {
    evidenceId: "pack-09-follitropin-delta-routine-practice",
    packNumber: 9,
    title: "Follitropin delta routine-practice study",
    authors: NOT_VERIFIED,
    journal: "Reproductive BioMedicine Online",
    year: NOT_VERIFIED,
    doi: "10.1016/j.rbmo.2021.12.013",
    pubmedId: "35193799",
    urls: ["https://pubmed.ncbi.nlm.nih.gov/35193799/"],
    domains: ["D. Follitropin-delta individualized dosing"],
    artefactKind: "Numerical algorithm",
    studyType: "Real-world/routine-practice study",
    population: NOT_VERIFIED,
    intervention: "AMH/body-weight individualized follitropin-delta dosing.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["AMH", "Body weight"],
    relevance: "Real-world evidence for the AMH/body-weight individualized follitropin-delta algorithm.",
    validationStatus: "Supporting real-world evidence.",
    implementationRelevance: "Supports the follitropin-delta system only.",
    limitations: "Observational design; product-specific.",
    provenance: `${MASTER_PACK_FILE} § 09`,
  },
  {
    evidenceId: "pack-10-follitropin-delta-long-agonist",
    packNumber: 10,
    title: "Follitropin delta in long GnRH agonist protocol",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: "37194068",
    urls: ["https://pubmed.ncbi.nlm.nih.gov/37194068/"],
    domains: ["D. Follitropin-delta individualized dosing"],
    artefactKind: "Numerical algorithm",
    studyType: NOT_VERIFIED,
    population: "Long GnRH agonist protocol (details not supplied).",
    intervention: "AMH/body-weight individualized follitropin-delta dosing.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["AMH", "Body weight"],
    relevance: "AMH/body-weight individualized follitropin-delta dosing in a long agonist protocol.",
    validationStatus: NOT_VERIFIED,
    implementationRelevance: "Protocol-extension evidence for follitropin-delta only.",
    limitations: "Metadata not supplied in the pack.",
    provenance: `${MASTER_PACK_FILE} § 10`,
  },
  {
    evidenceId: "pack-11-beyond-trial",
    packNumber: 11,
    title: "BEYOND trial",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: "38723189",
    urls: ["https://pubmed.ncbi.nlm.nih.gov/38723189/"],
    domains: ["D. Follitropin-delta individualized dosing"],
    artefactKind: "Numerical algorithm",
    studyType: "Randomized controlled trial",
    population: NOT_VERIFIED,
    intervention: "Individualized follitropin-delta dosing in GnRH agonist versus antagonist protocols.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["AMH", "Body weight"],
    relevance: "Individualized follitropin-delta dosing in GnRH agonist versus antagonist protocols.",
    validationStatus: NOT_VERIFIED,
    implementationRelevance: "Protocol-comparison evidence for follitropin-delta only.",
    limitations: "Metadata not supplied in the pack.",
    provenance: `${MASTER_PACK_FILE} § 11`,
  },
  {
    evidenceId: "pack-12-eshre-2020-ovarian-stimulation",
    packNumber: 12,
    title: "ESHRE ovarian stimulation guideline — 2020",
    authors: "ESHRE Guideline Group on Ovarian Stimulation",
    journal: "Human Reproduction Open",
    year: 2020,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://academic.oup.com/hropen/article/2020/2/hoaa009/5827574"],
    domains: ["E. ESHRE ovarian stimulation guidance"],
    artefactKind: "Clinical practice guideline",
    studyType: "Guideline",
    population: "IVF/ICSI ovarian stimulation.",
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance:
      "Evidence-based guidance on ovarian stimulation, pituitary suppression, gonadotropins, monitoring, triggering, luteal support and OHSS prevention.",
    validationStatus: "Guideline source, not a numerical algorithm.",
    implementationRelevance:
      "Recommendation statements would need verbatim transcription before any protocol logic could be activated.",
    limitations: "Guideline text/tables not supplied with the pack.",
    linkedLibraryId: "eshre-2020-ovarian-stimulation",
    provenance: `${MASTER_PACK_FILE} § 12`,
  },
  {
    evidenceId: "pack-13-eshre-2025-update",
    packNumber: 13,
    title: "ESHRE ovarian stimulation guideline update — 2025",
    authors: "ESHRE Guideline Group on Ovarian Stimulation",
    journal: "Human Reproduction",
    year: 2025,
    doi: "10.1093/humrep/deag018",
    pubmedId: "41732035",
    urls: [
      "https://pubmed.ncbi.nlm.nih.gov/41732035/",
      "https://doi.org/10.1093/humrep/deag018",
    ],
    domains: ["E. ESHRE ovarian stimulation guidance"],
    artefactKind: "Clinical practice guideline",
    studyType: "Guideline",
    population: "IVF/ICSI ovarian stimulation.",
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Current ESHRE guideline update, published in 2026.",
    validationStatus: "Guideline source, not a numerical algorithm.",
    implementationRelevance: "Primary guideline reference for future protocol/monitoring modules.",
    limitations:
      "Pack states guideline year 2025 with publication in 2026 — recorded as supplied, not reconciled.",
    linkedLibraryId: "eshre-2025-ovarian-stimulation-update",
    provenance: `${MASTER_PACK_FILE} § 13`,
  },
  {
    evidenceId: "pack-14-eshre-official-page",
    packNumber: 14,
    title: "Official ESHRE ovarian stimulation guideline page",
    authors: "ESHRE",
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://www.eshre.eu/guidelines-and-legal/guidelines/ovarian-stimulation-in-ivf-icsi"],
    domains: ["E. ESHRE ovarian stimulation guidance"],
    artefactKind: "Document collection",
    studyType: "Official guideline portal",
    population: NOT_VERIFIED,
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Official guideline page and supporting materials.",
    validationStatus: "Provenance source.",
    implementationRelevance: "Access point for the supporting materials still required.",
    limitations: "Generic publisher/portal URL — not a citable article record.",
    provenance: `${MASTER_PACK_FILE} § 14`,
  },
  {
    evidenceId: "pack-15-asrm-ohss-prevention-2023",
    packNumber: 15,
    title:
      "Prevention of moderate and severe ovarian hyperstimulation syndrome — ASRM guideline (2023)",
    authors: "ASRM Practice Committee",
    journal: NOT_VERIFIED,
    year: 2023,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: [
      "https://www.asrm.org/practice-guidance/practice-committee-documents/prevention-of-moderate-and-severe-ovarian-hyperstimulation-syndrome-a-guideline-2023/",
    ],
    domains: ["F. ASRM guidance", "I. OHSS prevention / safety"],
    artefactKind: "Clinical practice guideline",
    studyType: "Guideline",
    population: "ART patients at risk of OHSS.",
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance:
      "Safety layer for individualized stimulation, protocol selection, trigger strategy and OHSS prevention.",
    validationStatus: "Guideline source, not a numerical algorithm.",
    implementationRelevance:
      "Required before trigger/OHSS/freeze-all logic could ever be considered; thresholds are not supplied here.",
    limitations: "Guideline text and threshold tables not supplied with the pack.",
    linkedLibraryId: "asrm-2016-ohss-prevention",
    provenance: `${MASTER_PACK_FILE} § 15`,
  },
  {
    evidenceId: "pack-16-asrm-practice-documents",
    packNumber: 16,
    title: "ASRM Practice Committee documents (collection)",
    authors: "ASRM Practice Committee",
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://integration.asrm.org/practice-guidance/practice-committee-documents/"],
    domains: ["F. ASRM guidance"],
    artefactKind: "Document collection",
    studyType: "Document collection",
    population: NOT_VERIFIED,
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Authoritative source collection for current ASRM practice guidance.",
    validationStatus: "Provenance source.",
    implementationRelevance: "Index of documents that may later be requested individually.",
    limitations: "Generic collection URL; no single citable record.",
    provenance: `${MASTER_PACK_FILE} § 16`,
  },
  {
    evidenceId: "pack-17-poseidon-low-prognosis",
    packNumber: 17,
    title: "POSEIDON low-prognosis classification",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: NOT_VERIFIED,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://pmc.ncbi.nlm.nih.gov/articles/PMC6107695/"],
    domains: ["G. POSEIDON"],
    artefactKind: "Classification framework",
    studyType: "Consensus/classification framework",
    population: "Low-prognosis ART patients.",
    intervention: "Classification only — no dosing.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["Age", "AMH", "AFC", "Previous ovarian response"],
    relevance: "POSEIDON classification/low-prognosis framework. This is classification, not CONSORT dosing.",
    validationStatus: "Already implemented as a classification engine in this application.",
    implementationRelevance:
      "Supports the existing POSEIDON classification module only. No treatment output.",
    limitations: "Classification framework; contains no dose algorithm.",
    linkedLibraryId: "poseidon-2016-alviggi",
    provenance: `${MASTER_PACK_FILE} § 17`,
  },
  {
    evidenceId: "pack-18-bologna-criteria",
    packNumber: 18,
    title: "ESHRE consensus on the definition of poor ovarian response — Bologna criteria",
    authors: NOT_VERIFIED,
    journal: "Human Reproduction",
    year: 2011,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: ["https://academic.oup.com/humrep/article/26/7/1616/2913872"],
    domains: ["H. Bologna / poor ovarian response"],
    artefactKind: "Classification framework",
    studyType: "Consensus",
    population: "Poor ovarian responders.",
    intervention: "Definition only — no dosing.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: ["Age", "AFC", "AMH", "Previous poor response"],
    relevance: "Foundational ESHRE definition of poor ovarian response.",
    validationStatus: "Already implemented as a classification engine in this application.",
    implementationRelevance: "Supports the existing Bologna classification module only.",
    limitations: "Definition framework; contains no dose algorithm.",
    linkedLibraryId: "bologna-2011-ferraretti",
    provenance: `${MASTER_PACK_FILE} § 18`,
  },
  {
    evidenceId: "pack-19-asrm-gonadotropins-ovulation-induction-2020",
    packNumber: 19,
    title:
      "Use of exogenous gonadotropins for ovulation induction in anovulatory women — ASRM committee opinion (2020)",
    authors: "ASRM Practice Committee",
    journal: NOT_VERIFIED,
    year: 2020,
    doi: NOT_VERIFIED,
    pubmedId: NOT_VERIFIED,
    urls: [
      "https://www.asrm.org/practice-guidance/practice-committee-documents/use-of-exogenous-gonadotropins-for-ovulation-induction-in-anovulatory-women-a-committee-opinion-2020/",
    ],
    domains: ["F. ASRM guidance", "J. Other IVF/ICSI evidence"],
    artefactKind: "Clinical practice guideline",
    studyType: "Committee opinion",
    population: "Anovulatory women undergoing ovulation induction (NOT ART stimulation).",
    intervention: "Exogenous gonadotropins for ovulation induction.",
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance:
      "Concerns ovulation induction and explicitly distinguishes that purpose from ovarian stimulation for ART.",
    validationStatus: "Out of scope for IVF stimulation dosing.",
    implementationRelevance:
      "EXCLUDED as a source for IVF protocol or dose logic — different clinical purpose.",
    limitations:
      "Explicit pack warning: do NOT use as an IVF protocol/dose algorithm.",
    provenance: `${MASTER_PACK_FILE} § 19`,
  },
  {
    evidenceId: "pack-20-consort-pubmed-master-record",
    packNumber: 20,
    title: "CONSORT PubMed master record",
    authors: NOT_VERIFIED,
    journal: NOT_VERIFIED,
    year: 2011,
    doi: "10.1016/S1472-6483(11)60012-6",
    pubmedId: "21575853",
    urls: ["https://pubmed.ncbi.nlm.nih.gov/21575853/"],
    domains: ["A. CONSORT"],
    artefactKind: "Bibliographic record",
    studyType: "Bibliographic record",
    population: NOT_VERIFIED,
    intervention: NOT_VERIFIED,
    mainOutcome: NOT_VERIFIED,
    relevantVariables: [],
    relevance: "Bibliographic verification of the core CONSORT publication.",
    validationStatus: "Bibliographic verification only.",
    implementationRelevance: "None beyond provenance.",
    limitations: "Duplicate of pack § 01 (same DOI and PMID).",
    provenance: `${MASTER_PACK_FILE} § 20`,
  },
];

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                 */
/* ------------------------------------------------------------------ */

export interface DuplicateFinding {
  label: string;
  evidenceIds: string[];
  reason: string;
  action: "DUPLICATE / SAME PUBLICATION";
}

export const duplicateFindings: DuplicateFinding[] = [
  {
    label: "Core CONSORT publication (2011)",
    evidenceIds: ["pack-01-consort-core-2011", "pack-20-consort-pubmed-master-record"],
    reason: "Identical DOI 10.1016/S1472-6483(11)60012-6 and PMID 21575853.",
    action: "DUPLICATE / SAME PUBLICATION",
  },
];

/* ------------------------------------------------------------------ */
/* DOI / URL verification                                              */
/* ------------------------------------------------------------------ */

export type DoiStatus =
  | "PRESENT — NOT VERIFIED"
  | "MISSING DOI"
  | "DUPLICATE DOI"
  | "GENERIC PUBLISHER URL"
  | "MALFORMED / NORMALIZED";

export interface DoiFinding {
  evidenceId: string;
  status: DoiStatus;
  note: string;
}

export const doiFindings: DoiFinding[] = [
  {
    evidenceId: "pack-01-consort-core-2011",
    status: "DUPLICATE DOI",
    note: "Same DOI as pack § 20 (same publication). Retained in both records with provenance.",
  },
  {
    evidenceId: "pack-20-consort-pubmed-master-record",
    status: "DUPLICATE DOI",
    note: "Duplicate of pack § 01.",
  },
  {
    evidenceId: "pack-13-eshre-2025-update",
    status: "MALFORMED / NORMALIZED",
    note: "Supplied as a URL form (https://doi.org/10.1093/humrep/deag018); normalized to the bare DOI. Article identity NOT VERIFIED offline.",
  },
  {
    evidenceId: "pack-02-consort-development",
    status: "MISSING DOI",
    note: "Abstract-only ScienceDirect URL supplied; no DOI or PMID in the pack.",
  },
  {
    evidenceId: "pack-04-consort-observational",
    status: "MISSING DOI",
    note: "PMC URL only.",
  },
  {
    evidenceId: "pack-08-follitropin-delta-asian-rct",
    status: "MISSING DOI",
    note: "PMID and PMC URL only.",
  },
  {
    evidenceId: "pack-10-follitropin-delta-long-agonist",
    status: "MISSING DOI",
    note: "PMID only.",
  },
  {
    evidenceId: "pack-11-beyond-trial",
    status: "MISSING DOI",
    note: "PMID only.",
  },
  {
    evidenceId: "pack-12-eshre-2020-ovarian-stimulation",
    status: "MISSING DOI",
    note: "Publisher article URL only.",
  },
  {
    evidenceId: "pack-14-eshre-official-page",
    status: "GENERIC PUBLISHER URL",
    note: "Society portal page, not a citable article record.",
  },
  {
    evidenceId: "pack-15-asrm-ohss-prevention-2023",
    status: "GENERIC PUBLISHER URL",
    note: "ASRM practice-document page; no DOI supplied.",
  },
  {
    evidenceId: "pack-16-asrm-practice-documents",
    status: "GENERIC PUBLISHER URL",
    note: "Document-collection index page.",
  },
  {
    evidenceId: "pack-17-poseidon-low-prognosis",
    status: "MISSING DOI",
    note: "PMC URL only.",
  },
  {
    evidenceId: "pack-18-bologna-criteria",
    status: "MISSING DOI",
    note: "Publisher article URL only.",
  },
  {
    evidenceId: "pack-19-asrm-gonadotropins-ovulation-induction-2020",
    status: "GENERIC PUBLISHER URL",
    note: "ASRM practice-document page; no DOI supplied.",
  },
  {
    evidenceId: "pack-03-consort-rct",
    status: "MISSING DOI",
    note: "PMID and journal full-text URL supplied; no DOI in the pack.",
  },
  {
    evidenceId: "pack-05-consort-registry",
    status: "MISSING DOI",
    note: "Registry record; DOIs do not apply.",
  },
  {
    evidenceId: "pack-06-amh-based-fsh-rct",
    status: "PRESENT — NOT VERIFIED",
    note: "DOI 10.1093/hropen/hoz003 supplied; identity not verified offline.",
  },
  {
    evidenceId: "pack-07-cochrane-2024-individualised-dosing",
    status: "PRESENT — NOT VERIFIED",
    note: "DOI 10.1002/14651858.CD012693.pub3 supplied; identity not verified offline.",
  },
  {
    evidenceId: "pack-09-follitropin-delta-routine-practice",
    status: "PRESENT — NOT VERIFIED",
    note: "DOI 10.1016/j.rbmo.2021.12.013 supplied; identity not verified offline.",
  },
];

/* ------------------------------------------------------------------ */
/* Algorithm ↔ source mapping                                          */
/* ------------------------------------------------------------------ */

export type SourceRole = "PRIMARY SOURCE" | "VALIDATION SOURCE" | "GUIDELINE SOURCE" | "SUPPORTING SOURCE";

export interface AlgorithmSourceMapping {
  algorithm: string;
  /** Verbatim status string; never changed by this ingestion pass. */
  sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION" | "IMPLEMENTED — CLASSIFICATION ONLY";
  sources: { evidenceId: string; role: SourceRole }[];
  note: string;
}

export const algorithmSourceMap: AlgorithmSourceMapping[] = [
  {
    algorithm: "CONSORT",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-01-consort-core-2011", role: "PRIMARY SOURCE" },
      { evidenceId: "pack-02-consort-development", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-03-consort-rct", role: "VALIDATION SOURCE" },
      { evidenceId: "pack-04-consort-observational", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-05-consort-registry", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-20-consort-pubmed-master-record", role: "SUPPORTING SOURCE" },
    ],
    note: "Input variables and the 37.5-IU increment are named, but the band tables, point assignments and score-to-dose crosswalk are not supplied.",
  },
  {
    algorithm: "POSEIDON",
    sufficiency: "IMPLEMENTED — CLASSIFICATION ONLY",
    sources: [{ evidenceId: "pack-17-poseidon-low-prognosis", role: "PRIMARY SOURCE" }],
    note: "Classification framework only. No treatment output is derived from it.",
  },
  {
    algorithm: "BOLOGNA",
    sufficiency: "IMPLEMENTED — CLASSIFICATION ONLY",
    sources: [{ evidenceId: "pack-18-bologna-criteria", role: "PRIMARY SOURCE" }],
    note: "Definition of poor ovarian response only.",
  },
  {
    algorithm: "GONADOTROPIN SELECTION",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-12-eshre-2020-ovarian-stimulation", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-13-eshre-2025-update", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-07-cochrane-2024-individualised-dosing", role: "SUPPORTING SOURCE" },
    ],
    note: "Guideline recommendation statements are not transcribed; ASRM § 19 is explicitly excluded (ovulation induction, not ART).",
  },
  {
    algorithm: "PROTOCOL SELECTION",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-12-eshre-2020-ovarian-stimulation", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-13-eshre-2025-update", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-14-eshre-official-page", role: "SUPPORTING SOURCE" },
    ],
    note: "No protocol-selection recommendation table is present in the pack.",
  },
  {
    algorithm: "STARTING DOSE",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-01-consort-core-2011", role: "PRIMARY SOURCE" },
      { evidenceId: "pack-06-amh-based-fsh-rct", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-08-follitropin-delta-asian-rct", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-09-follitropin-delta-routine-practice", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-10-follitropin-delta-long-agonist", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-11-beyond-trial", role: "SUPPORTING SOURCE" },
      { evidenceId: "pack-07-cochrane-2024-individualised-dosing", role: "SUPPORTING SOURCE" },
    ],
    note: "Three distinct dosing systems (CONSORT, AMH-based FSH, follitropin-delta) — they must not be merged, and none is numerically complete here.",
  },
  {
    algorithm: "DOSE ADJUSTMENT",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-12-eshre-2020-ovarian-stimulation", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-13-eshre-2025-update", role: "GUIDELINE SOURCE" },
    ],
    note: "No monitoring or adjustment table supplied.",
  },
  {
    algorithm: "TRIGGER",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-12-eshre-2020-ovarian-stimulation", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-15-asrm-ohss-prevention-2023", role: "GUIDELINE SOURCE" },
    ],
    note: "No trigger criteria, agent selection rule or threshold supplied.",
  },
  {
    algorithm: "OHSS",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [
      { evidenceId: "pack-15-asrm-ohss-prevention-2023", role: "GUIDELINE SOURCE" },
      { evidenceId: "pack-12-eshre-2020-ovarian-stimulation", role: "GUIDELINE SOURCE" },
    ],
    note: "Risk thresholds and cut-offs are not present in the pack.",
  },
  {
    algorithm: "FREEZE-ALL",
    sufficiency: "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION",
    sources: [{ evidenceId: "pack-15-asrm-ohss-prevention-2023", role: "GUIDELINE SOURCE" }],
    note: "No freeze-all indication list supplied.",
  },
];

/* ------------------------------------------------------------------ */
/* CONSORT evidence audit                                              */
/* ------------------------------------------------------------------ */

export type AuditVerdict = "VERIFIED" | "PARTIALLY VERIFIED" | "NOT VERIFIED" | "NOT PRESENT";

export interface ConsortAuditItem {
  item: string;
  verdict: AuditVerdict;
  evidence: string;
}

export const consortAudit: ConsortAuditItem[] = [
  { item: "Validated population", verdict: "VERIFIED", evidence: "Normo-ovulatory women (pack § 01, CONSORT implementation note)." },
  { item: "Age range", verdict: "VERIFIED", evidence: "18–34 years inclusive (pack § 01, implementation note)." },
  { item: "BMI requirements / range", verdict: "PARTIALLY VERIFIED", evidence: "BMI named as an input; no range or band supplied." },
  { item: "Basal FSH requirements / range", verdict: "PARTIALLY VERIFIED", evidence: "Basal FSH named as an input; no range or band supplied." },
  { item: "AFC requirements / range", verdict: "PARTIALLY VERIFIED", evidence: "AFC named as an input; no range or band supplied." },
  { item: "Stimulation protocol", verdict: "VERIFIED", evidence: "Long GnRH-agonist protocol (pack § 01)." },
  { item: "GnRH analogue requirements", verdict: "PARTIALLY VERIFIED", evidence: "Long agonist stated; agent, dose and timing not supplied." },
  { item: "Starting-dose categories", verdict: "NOT PRESENT", evidence: "Dose categories are not listed in the pack." },
  { item: "Dose increments", verdict: "VERIFIED", evidence: "37.5-IU increments (pack § 01)." },
  { item: "Numerical scoring / banding system", verdict: "NOT PRESENT", evidence: "No band table supplied." },
  { item: "Point assignments", verdict: "NOT PRESENT", evidence: "No points table supplied." },
  { item: "Score-to-dose crosswalk", verdict: "NOT PRESENT", evidence: "No crosswalk supplied." },
  { item: "Minimum dose", verdict: "NOT PRESENT", evidence: "Not stated in the pack." },
  { item: "Maximum dose", verdict: "NOT PRESENT", evidence: "Not stated in the pack." },
  { item: "Exclusion criteria", verdict: "NOT PRESENT", evidence: "Not stated in the pack." },
  { item: "Validation population", verdict: "NOT VERIFIED", evidence: "RCT (§ 03) and observational study (§ 04) cited, but populations are not described." },
  { item: "Validation outcomes", verdict: "NOT VERIFIED", evidence: "Outcomes not supplied." },
  { item: "Algorithm limitations", verdict: "PARTIALLY VERIFIED", evidence: "Population restriction stated; other limitations not enumerated." },
  { item: "Later modifications", verdict: "NOT VERIFIED", evidence: "§ 04 notes a modified calculator; the modification is not described." },
  { item: "Each numerical component directly verified from source", verdict: "NOT VERIFIED", evidence: "Only the 37.5-IU increment and the 18–34 age bound are numerically stated." },
];

export const CONSORT_POPULATION_RESTRICTION = {
  statement:
    "Original CONSORT population: normo-ovulatory women, age 18–34 years, long GnRH-agonist protocol.",
  mustNotGeneralizeTo: [
    "Poor responders",
    "POSEIDON Group 4 patients",
    "Women older than 34 years",
    "Other stimulation protocols",
    "Other clinical populations",
  ],
  outsidePopulationStatus: "CONSORT_OUTSIDE_VALIDATED_POPULATION",
  source: `${MASTER_PACK_FILE} § CRITICAL CONSORT IMPLEMENTATION NOTE`,
} as const;

/* ------------------------------------------------------------------ */
/* Algorithm vs guideline distinction                                  */
/* ------------------------------------------------------------------ */

export const artefactSeparation = {
  numericalAlgorithms: [
    "CONSORT (age, BMI, basal FSH, AFC → FSH dose)",
    "AMH-based individualized FSH dosing",
    "Follitropin-delta AMH + body-weight dosing",
  ],
  guidelines: ["ESHRE ovarian stimulation guideline (2020, 2025 update)", "ASRM practice documents"],
  classifications: ["POSEIDON", "Bologna criteria"],
  rule:
    "Variables, bands and thresholds belonging to one system must never be combined with another. CONSORT ≠ ESHRE ≠ POSEIDON ≠ Bologna ≠ AMH-based dosing ≠ follitropin-delta.",
} as const;

/* ------------------------------------------------------------------ */
/* Conflicts                                                           */
/* ------------------------------------------------------------------ */

export interface EvidenceConflict {
  label: string;
  evidenceIds: string[];
  dimension: string;
  detail: string;
  status: "EVIDENCE CONFLICT — REQUIRES CLINICAL REVIEW";
}

export const evidenceConflicts: EvidenceConflict[] = [
  {
    label: "Competing individualized dosing systems",
    evidenceIds: [
      "pack-01-consort-core-2011",
      "pack-06-amh-based-fsh-rct",
      "pack-08-follitropin-delta-asian-rct",
    ],
    dimension: "Algorithm / input variables / dose output",
    detail:
      "Three different dosing algorithms use different inputs (FSH+BMI+age+AFC vs AMH vs AMH+body weight) and are not interchangeable.",
    status: "EVIDENCE CONFLICT — REQUIRES CLINICAL REVIEW",
  },
  {
    label: "CONSORT original vs modified calculator",
    evidenceIds: ["pack-01-consort-core-2011", "pack-04-consort-observational"],
    dimension: "Algorithm / starting-dose categories",
    detail:
      "The observational study reports use/modification of the calculator and its starting-dose categories; the nature of the modification is not supplied.",
    status: "EVIDENCE CONFLICT — REQUIRES CLINICAL REVIEW",
  },
  {
    label: "Protocol context for individualized dosing",
    evidenceIds: ["pack-01-consort-core-2011", "pack-06-amh-based-fsh-rct", "pack-11-beyond-trial"],
    dimension: "Protocol / population",
    detail:
      "CONSORT was pilot-tested in a long agonist protocol; the AMH-based RCT used an antagonist protocol; BEYOND compares agonist vs antagonist for follitropin-delta.",
    status: "EVIDENCE CONFLICT — REQUIRES CLINICAL REVIEW",
  },
  {
    label: "Ovulation induction vs ART stimulation",
    evidenceIds: ["pack-19-asrm-gonadotropins-ovulation-induction-2020"],
    dimension: "Indication / eligibility criteria",
    detail:
      "The ASRM committee opinion addresses ovulation induction in anovulatory women and explicitly distinguishes this from ART stimulation. Excluded from IVF dosing logic.",
    status: "EVIDENCE CONFLICT — REQUIRES CLINICAL REVIEW",
  },
];

/* ------------------------------------------------------------------ */
/* Missing material required before any future implementation pass     */
/* ------------------------------------------------------------------ */

export const missingImplementationMaterial: { algorithm: string; required: string[] }[] = [
  {
    algorithm: "CONSORT",
    required: [
      "Published band table for age, BMI, basal FSH and AFC",
      "Point assignments per band",
      "Score-to-dose crosswalk",
      "Minimum and maximum permitted dose",
      "Full inclusion/exclusion criteria",
      "Validation population and outcome tables",
    ],
  },
  {
    algorithm: "Protocol selection",
    required: ["ESHRE recommendation statements table (2020 and 2025 update), verbatim"],
  },
  {
    algorithm: "Gonadotropin selection",
    required: ["ESHRE gonadotrophin preparation recommendation statements, verbatim"],
  },
  {
    algorithm: "Dose adjustment",
    required: ["ESHRE monitoring and dose-adjustment recommendation tables"],
  },
  {
    algorithm: "Trigger / OHSS / freeze-all",
    required: [
      "ASRM 2023 OHSS prevention guideline text, thresholds and recommendation statements",
      "ESHRE triggering and OHSS-prevention statements",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Coverage report (derived — no clinical inference)                   */
/* ------------------------------------------------------------------ */

export interface CoverageReport {
  sourcesIngested: number;
  sourcesIndexed: number;
  incompleteMetadata: number;
  duplicates: number;
  doiProblems: number;
  domains: MasterEvidenceDomain[];
  algorithmsWithSupport: string[];
  algorithmsWithoutSufficientEvidence: string[];
  consortVerified: number;
  consortPartiallyVerified: number;
  consortNotVerified: number;
  consortNotPresent: number;
  conflicts: number;
}

const recordHasIncompleteMetadata = (r: MasterEvidenceRecord) =>
  [r.authors, r.journal, r.doi, r.pubmedId, r.studyType, r.population, r.mainOutcome].some(
    (v) => v === NOT_VERIFIED,
  ) || r.year === NOT_VERIFIED;

export function buildCoverageReport(): CoverageReport {
  const domains = [...new Set(masterEvidenceRecords.flatMap((r) => r.domains))].sort();
  const count = (v: AuditVerdict) => consortAudit.filter((i) => i.verdict === v).length;
  return {
    sourcesIngested: masterEvidenceRecords.length,
    sourcesIndexed: masterEvidenceRecords.length,
    incompleteMetadata: masterEvidenceRecords.filter(recordHasIncompleteMetadata).length,
    duplicates: duplicateFindings.length,
    doiProblems: doiFindings.filter((d) => d.status !== "PRESENT — NOT VERIFIED").length,
    domains,
    algorithmsWithSupport: algorithmSourceMap
      .filter((a) => a.sufficiency === "IMPLEMENTED — CLASSIFICATION ONLY")
      .map((a) => a.algorithm),
    algorithmsWithoutSufficientEvidence: algorithmSourceMap
      .filter((a) => a.sufficiency === "EVIDENCE NOT SUFFICIENT FOR IMPLEMENTATION")
      .map((a) => a.algorithm),
    consortVerified: count("VERIFIED"),
    consortPartiallyVerified: count("PARTIALLY VERIFIED"),
    consortNotVerified: count("NOT VERIFIED"),
    consortNotPresent: count("NOT PRESENT"),
    conflicts: evidenceConflicts.length,
  };
}

/** CONSORT readiness is derived strictly from the audit — never asserted. */
export const consortReadiness = {
  status: consortAudit.some((i) => i.verdict === "NOT PRESENT" || i.verdict === "NOT VERIFIED")
    ? ("NOT READY — REQUIRED EVIDENCE MISSING" as const)
    : ("READY FOR IMPLEMENTATION" as const),
  checklist: [
    { item: "Exact input-variable definitions", available: "PARTIAL — variables named, definitions not supplied" },
    { item: "Exact eligibility population", available: "AVAILABLE — normo-ovulatory, 18–34, long agonist" },
    { item: "Exact numerical bands", available: "NOT AVAILABLE" },
    { item: "Exact point assignments", available: "NOT AVAILABLE" },
    { item: "Exact dose crosswalk", available: "NOT AVAILABLE" },
    { item: "Exact dose increments", available: "AVAILABLE — 37.5 IU" },
    { item: "Exact minimum / maximum dose", available: "NOT AVAILABLE" },
    { item: "Validation population", available: "NOT AVAILABLE" },
    { item: "Limitations", available: "PARTIAL — population restriction only" },
  ],
} as const;

export const findMasterRecord = (id: string) =>
  masterEvidenceRecords.find((r) => r.evidenceId === id);
