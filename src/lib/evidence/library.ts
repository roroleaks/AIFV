/**
 * Evidence Library data model.
 *
 * This module stores bibliographic metadata only. It contains no clinical
 * calculations, no dosing rules and no protocol recommendations. Knowledge
 * modules reference entries here by `id` so that a future decision-support
 * engine can always cite the source of any rule it implements.
 */

import type { EvidencePriority } from "./topics";

export type EvidenceType =
  | "Guideline"
  | "RCT"
  | "Meta-analysis"
  | "Systematic review"
  | "Cohort study"
  | "Observational study"
  | "Review"
  | "Consensus";

export type EvidenceLevel = "I" | "II" | "III" | "IV" | "Not graded";

export type EvidenceQuality = "High" | "Moderate" | "Low" | "Not rated";

export type EvidenceSourceKind =
  | "PDF"
  | "DOI"
  | "PubMed"
  | "Journal URL"
  | "Conference Statement"
  | "Clinical Guideline";

export interface EvidenceEntry {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  volume?: string | undefined;
  issue?: string | undefined;
  pages?: string | undefined;
  doi?: string | undefined;
  pmid?: string | undefined;
  pii?: string | undefined;
  publisher?: string | undefined;
  url?: string | undefined;
  type: EvidenceType;
  level: EvidenceLevel;
  /** Source-hierarchy priority (1 = ASRM practice documents). */
  priority: EvidencePriority;
  quality: EvidenceQuality;
  society?: string | undefined;
  /** Verbatim or condensed abstract, as published. No AI-generated content. */
  abstract?: string | undefined;
  /** Physician-facing summary of what the publication covers. */
  summary: string;
  /** Physician-authored notes. Empty until a specialist writes them. */
  clinicalNotes?: string | undefined;
  /** Index keywords as published. */
  keywords?: string[] | undefined;
  /** Topic tags used for filtering and for knowledge-module linkage. */
  topics: string[];
  /** Knowledge module ids that will cite this reference. */
  modules: string[];
  /** Whether the full text has been reviewed and mapped into the app. */
  status: "indexed" | "pending-review";
  sourceKind?: EvidenceSourceKind | undefined;
  fileName?: string | undefined;
  addedAt: string;
}

export const evidenceLibrary: EvidenceEntry[] = [
  {
    id: "eshre-2025-ovarian-stimulation-update",
    title: "Ovarian stimulation for IVF/ICSI — ESHRE guideline, update 2025",
    authors: [
      "The ESHRE Guideline Group on Ovarian Stimulation",
      "Baris Ata",
      "Ernesto Bosch",
      "Simone Broer",
      "Georg Griesinger",
      "Michael Grynberg",
      "Efstratios Kolibianakis",
      "Michal Kunicki",
      "Antonio La Marca",
      "George Lainas",
      "Nathalie Le Clef",
      "Nathalie Massin",
      "Nikolaos P Polyzos",
      "Sesh K Sunkara",
      "Tanya Timeva",
      "Mete Töyli",
      "János Urbancsek",
      "Frank Broekmans",
    ],
    journal: "ESHRE Guidelines",
    year: 2025,
    publisher: "European Society of Human Reproduction and Embryology",
    doi: "10.1093/humrep/deag018",
    url: "https://doi.org/10.1093/humrep/deag018",
    type: "Guideline",
    level: "I",
    priority: 2,
    quality: "High",
    society: "ESHRE",
    summary:
      "November 2025 update of the ESHRE ovarian stimulation guideline. Structured in parts covering pre-stimulation evaluation (ovarian response and pregnancy prediction from AFC, AMH, basal FSH, inhibin B, oestradiol, progesterone, LH, age and BMI), pre-treatment therapies, stimulation regimens and gonadotrophin choice, adjuvant treatments, monitoring, triggering, luteal phase support and cycle-cancellation considerations. Recommendation statements are transcribed into modules only after specialist review.",
    keywords: [
      "ovarian stimulation",
      "IVF",
      "ICSI",
      "ESHRE guideline",
      "gonadotrophins",
      "ovarian response prediction",
    ],
    topics: [
      "Ovarian Reserve",
      "GnRH Antagonist",
      "Long Agonist",
      "Mild Stimulation",
      "Recombinant FSH",
      "HMG",
      "Trigger",
      "OHSS",
      "Poor Response",
    ],
    modules: [
      "ovarian-reserve",
      "response-prediction",
      "protocol-selection",
      "stimulation-dose",
      "gonadotropin-selection",
      "monitoring",
      "trigger-selection",
      "ohss-risk",
      "luteal-support",
    ],
    status: "indexed",
    sourceKind: "Clinical Guideline",
    fileName: "ESHRE_Ovarian_Stimulation_Guideline_2025.pdf",
    addedAt: "2026-08-08",
  },
  {
    id: "eshre-2020-ovarian-stimulation",
    title: "ESHRE guideline: ovarian stimulation for IVF/ICSI",
    authors: [
      "ESHRE Reproductive Endocrinology Guideline Group",
      "Ernesto Bosch",
      "Simone Broer",
      "Georg Griesinger",
      "Michael Grynberg",
      "Peter Humaidan",
      "Efstratios Kolibianakis",
      "Michal Kunicki",
    ],
    journal: "Human Reproduction Open",
    year: 2020,
    volume: "2020",
    issue: "2",
    pages: "hoaa009",
    doi: "10.1093/hropen/hoaa009",
    pmid: "32395637",
    publisher: "Oxford University Press",
    url: "https://doi.org/10.1093/hropen/hoaa009",
    type: "Guideline",
    level: "I",
    priority: 2,
    quality: "High",
    society: "ESHRE",
    summary:
      "European society guideline on ovarian stimulation for IVF/ICSI. The guideline development group formulated 84 recommendations answering 18 key questions covering pre-stimulation assessment, prediction of ovarian response, stimulation regimens, adjuvant treatments, monitoring, triggering and luteal support.",
    keywords: ["ovarian stimulation", "IVF", "ICSI", "guideline", "gonadotrophins"],
    topics: [
      "Ovarian Reserve",
      "GnRH Antagonist",
      "Long Agonist",
      "Mild Stimulation",
      "Recombinant FSH",
      "HMG",
      "Trigger",
      "OHSS",
    ],
    modules: [
      "ovarian-reserve",
      "protocol-selection",
      "stimulation-dose",
      "trigger-selection",
      "ohss-risk",
      "luteal-support",
      "monitoring",
    ],
    status: "indexed",
    sourceKind: "Clinical Guideline",
    addedAt: "2026-01-01",
  },
  {
    id: "asrm-2020-ovarian-reserve-testing",
    title: "Testing and interpreting measures of ovarian reserve: a committee opinion",
    authors: ["Practice Committee of the American Society for Reproductive Medicine"],
    journal: "Fertility and Sterility",
    year: 2020,
    volume: "114",
    issue: "6",
    pages: "1151-1157",
    doi: "10.1016/j.fertnstert.2020.09.134",
    pmid: "33280722",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.fertnstert.2020.09.134",
    type: "Guideline",
    level: "Not graded",
    priority: 1,
    quality: "High",
    society: "ASRM",
    summary:
      "ASRM Practice Committee opinion describing the available ovarian reserve tests, their performance characteristics and the limitations of using them to counsel patients.",
    keywords: ["ovarian reserve", "anti-Müllerian hormone", "antral follicle count", "FSH"],
    topics: ["Ovarian Reserve", "AMH", "AFC", "Poor Response"],
    modules: ["ovarian-reserve", "response-prediction"],
    status: "indexed",
    sourceKind: "Clinical Guideline",
    addedAt: "2026-08-06",
  },
  {
    id: "asrm-2016-ohss-prevention",
    title:
      "Prevention and treatment of moderate and severe ovarian hyperstimulation syndrome: a guideline",
    authors: ["Practice Committee of the American Society for Reproductive Medicine"],
    journal: "Fertility and Sterility",
    year: 2016,
    volume: "106",
    issue: "7",
    pages: "1634-1647",
    doi: "10.1016/j.fertnstert.2016.08.048",
    pmid: "27678032",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.fertnstert.2016.08.048",
    type: "Guideline",
    level: "Not graded",
    priority: 1,
    quality: "High",
    society: "ASRM",
    summary:
      "ASRM guideline reviewing the evidence on identification of patients at risk for ovarian hyperstimulation syndrome and on the strategies studied for its prevention and management.",
    keywords: ["OHSS", "ovarian hyperstimulation syndrome", "prevention"],
    topics: ["OHSS", "Hyper Response", "Freeze-All", "Trigger", "PCOS"],
    modules: ["ohss-risk", "trigger-selection", "transfer-strategy"],
    status: "indexed",
    sourceKind: "Clinical Guideline",
    addedAt: "2026-08-06",
  },
  {
    id: "rbmo-2009-consort-pilot-olivennes",
    title:
      "Individualizing FSH dose for assisted reproduction using a novel algorithm: the CONSORT study",
    authors: [
      "François Olivennes",
      "Colin M Howles",
      "Andrea Borini",
      "Marc Germond",
      "Geoffrey Trew",
      "Matts Wikland",
      "Fernando Zegers-Hochschild",
      "Helen Saunders",
      "Vaman Alam",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2009,
    volume: "18",
    issue: "2",
    pages: "195-204",
    doi: "10.1016/S1472-6483(10)60256-8",
    pii: "S1472-6483(10)60256-8",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/S1472-6483(10)60256-8",
    type: "Observational study",
    level: "II",
    priority: 3,
    quality: "Moderate",
    summary:
      "CONSORT pilot study (18 centres, 161 ITT patients, normo-ovulatory women 18–34 years, long GnRH agonist protocol). Full text uploaded and verified: it states the four algorithm variables (basal FSH, BMI, age, AFC), the 37.5 IU dose increment, the 75 IU minimum starting dose adopted after the pilot, the inclusion/exclusion criteria and the dose-group outcomes. It does NOT print the band/point table or the score-to-dose crosswalk — those are held in Howles et al., RBMO 2006.",
    keywords: [
      "CONSORT",
      "FSH starting dose",
      "dosing algorithm",
      "follitropin alfa",
      "37.5 IU increments",
    ],
    topics: ["Recombinant FSH", "Ovarian Reserve", "AFC", "Ovarian Stimulation"],
    modules: ["stimulation-dose", "ovarian-reserve", "response-prediction"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "consort-olivennes-2009-pilot.pdf",
    addedAt: "2026-08-10",
  },
  {
    id: "cmro-2006-howles-consort-algorithm",
    title:
      "Predictive factors and a corresponding treatment algorithm for controlled ovarian stimulation in patients treated with recombinant human FSH (follitropin alfa) during ART procedures. An analysis of 1378 patients",
    authors: ["Colin M Howles", "Helen Saunders", "Vaman Alam", "Pierre Engrand"],
    journal: "Current Medical Research and Opinion",
    year: 2006,
    volume: "22",
    issue: "5",
    pages: "907-918",
    doi: "10.1185/030079906X104678",
    publisher: "LibraPharm",
    url: "https://doi.org/10.1185/030079906X104678",
    type: "Observational study",
    level: "II",
    priority: 3,
    quality: "Moderate",
    summary:
      "Development paper for the CONSORT dose calculator (1378 normo-ovulatory women <35 years on r-hFSH monotherapy, pooled from 11 randomised trials). Full text uploaded and verified: it confirms the four predictors and their ranking (basal FSH 15.5, BMI 12, age 9.5, follicles <11 mm 8.5; Table 5), the target of 11 oocytes retrieved, the C-index of 59.5% and the regression form DOSE = (Y − (α + β1·AGE + β2·AGE² + β3·BMI + β4·FSH + β5·FOLL_LT11)) / β6. It does NOT print the numeric α/β coefficients, the variable band cut-offs, the point assignments or the score-to-dose crosswalk — the calculator grid itself is not reproduced in this article.",
    keywords: [
      "CONSORT",
      "dose calculator",
      "backwards stepwise regression",
      "follitropin alfa",
      "predictive factors",
    ],
    topics: ["Recombinant FSH", "Ovarian Reserve", "AFC", "Ovarian Stimulation"],
    modules: ["stimulation-dose", "response-prediction"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "howles-2006-consort-algorithm.pdf",
    addedAt: "2026-08-10",
  },
  {
    id: "rbmo-2015-consort-rct-olivennes",
    title:
      "Randomized, controlled, open-label, non-inferiority study of the CONSORT algorithm for individualized dosing of follitropin alfa",
    authors: [
      "François Olivennes",
      "Geoffrey Trew",
      "Andrea Borini",
      "Frank Broekmans",
      "Pablo Arriagada",
      "David W Warne",
      "Colin M Howles",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "30",
    issue: "3",
    pages: "248-257",
    doi: "10.1016/j.rbmo.2014.11.013",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2014.11.013",
    type: "RCT",
    level: "I",
    priority: 2,
    quality: "High",
    summary:
      "Phase IV randomised non-inferiority trial (n=200; 23 centres) comparing a CONSORT-calculated follitropin alfa starting dose with a fixed 150 IU dose in normo-ovulatory women aged 18-34 (BMI <30, basal FSH <=12 IU/L, long GnRH agonist protocol). Full text uploaded and verified: it confirms the four calculator inputs (age, height/weight for BMI, early follicular FSH, AFC of follicles 2 to <11 mm) and the permitted dose set of 112.5, 150, 187.5, 225, 300 and 450 IU/day. The calculator itself was embedded in the electronic case report form; the article prints NO variable bands, NO point assignments and NO score-to-dose crosswalk. CONSORT dosing gave fewer oocytes (10.0 vs 11.8; P=0.037, non-inferiority not met), lower total dose (1288.5 vs 1810.0 IU), similar clinical pregnancy rates (36.0% vs 35.5%) and less OHSS (6.3% vs 12.5%).",
    keywords: [
      "CONSORT",
      "follitropin alfa",
      "individualised dosing",
      "non-inferiority",
      "OHSS",
    ],
    topics: ["Recombinant FSH", "Ovarian Stimulation", "OHSS", "AFC"],
    modules: ["stimulation-dose", "response-prediction"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "consort-olivennes-2015-rct.pdf",
    addedAt: "2026-08-10",
  },
  {
    id: "rbmo-2015-consort-fsh-dose",
    title:
      "Usability and utility of the CONSORT calculator for FSH starting doses: a prospective observational study",
    authors: [
      "Jean Luc Pouly",
      "François Olivennes",
      "Nathalie Massin",
      "Médéric Celle",
      "Natacha Caizergues",
      "Francis Contard",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "347-355",
    doi: "10.1016/j.rbmo.2015.06.001",
    pii: "S1472-6483(15)00260-6",
    pmid: "26194884",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.001",
    type: "Observational study",
    level: "II",
    priority: 3,
    quality: "Moderate",
    summary:
      "Prospective multicentre observational study (197 women, 45 French centres) of the CONSORT calculator in routine practice. Full text uploaded and verified: it confirms the four calculator inputs (age, BMI, cycle day 2-4 basal FSH, AFC of follicles >=2 mm and <11 mm), the recommendation range of 112.5-450 IU in 37.5 IU increments, and that the calculator was delivered as a password-protected website rather than a printed table. It prints NO variable bands, NO point assignments and NO score-to-dose crosswalk. Usability was high (97.8% of physicians) but the recommendation was followed for only 45.2% of patients; mean CONSORT dose 119.7 IU versus 163.9 IU planned and 151.7 IU prescribed.",
    keywords: ["CONSORT", "FSH starting dose", "individualisation"],
    topics: ["Recombinant FSH", "Ovarian Reserve", "AMH", "AFC"],
    modules: ["stimulation-dose", "ovarian-reserve", "response-prediction"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "consort-pouly-2015-usability.pdf",
    addedAt: "2026-08-10",
  },
  {
    id: "poseidon-2016-alviggi",
    title:
      "A new more detailed stratification of low responders to ovarian stimulation: from a poor ovarian response to a low prognosis concept",
    authors: [
      "Carlo Alviggi",
      "Claus Yding Andersen",
      "Klaus Buehler",
      "Alessandro Conforti",
      "Giuseppe De Placido",
      "Sandro C. Esteves",
      "Robert Fischer",
      "Daniela Galliano",
      "Nikolaos P. Polyzos",
      "Sesh K. Sunkara",
      "Filippo M. Ubaldi",
      "Peter Humaidan",
      "POSEIDON Group (Patient-Oriented Strategies Encompassing IndividualizeD Oocyte Number)",
    ],
    journal: "Fertility and Sterility",
    year: 2016,
    volume: "105",
    issue: "6",
    pages: "1452-1453",
    doi: "10.1016/j.fertnstert.2016.02.005",
    pmid: "26953977",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.fertnstert.2016.02.005",
    type: "Consensus",
    level: "IV",
    priority: 3,
    quality: "Moderate",
    society: "POSEIDON Group",
    summary:
      "Original POSEIDON statement defining the low-prognosis concept and the four groups based on female age (<35 vs ≥35 years), ovarian reserve markers (AFC ≥5 / AMH ≥1.2 ng/mL) and ovarian response to previous conventional stimulation (<4 oocytes = poor; 4-9 oocytes = suboptimal).",
    keywords: ["POSEIDON", "low prognosis", "poor responder"],
    topics: ["POSEIDON", "Poor Response", "Ovarian Reserve", "AMH", "AFC"],
    modules: ["poseidon", "ovarian-reserve", "response-prediction"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  {
    id: "poseidon-2016-humaidan",
    title:
      "The novel POSEIDON stratification of 'Low prognosis patients in Assisted Reproductive Technology' and its proposed marker of successful outcome",
    authors: ["Peter Humaidan", "Carlo Alviggi", "Robert Fischer", "Sandro C. Esteves"],
    journal: "F1000Research",
    year: 2016,
    volume: "5",
    pages: "2911",
    doi: "10.12688/f1000research.10382.1",
    pmid: "28184287",
    publisher: "F1000 Research Ltd",
    url: "https://doi.org/10.12688/f1000research.10382.1",
    type: "Review",
    level: "IV",
    priority: 3,
    quality: "Moderate",
    society: "POSEIDON Group",
    summary:
      "Detailed description of the POSEIDON stratification, including sub-groups 1a/1b and 2a/2b and the rationale for separating expected from unexpected low ovarian response.",
    keywords: ["POSEIDON", "low prognosis", "classification"],
    topics: ["POSEIDON", "Poor Response", "Ovarian Reserve"],
    modules: ["poseidon"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  {
    id: "bologna-2011-ferraretti",
    title:
      "ESHRE consensus on the definition of 'poor response' to ovarian stimulation for in vitro fertilization: the Bologna criteria",
    authors: [
      "A. P. Ferraretti",
      "A. La Marca",
      "B. C. J. M. Fauser",
      "B. Tarlatzis",
      "G. Nargund",
      "L. Gianaroli",
      "ESHRE working group on Poor Ovarian Response Definition",
    ],
    journal: "Human Reproduction",
    year: 2011,
    volume: "26",
    issue: "7",
    pages: "1616-1624",
    doi: "10.1093/humrep/der092",
    pmid: "21505041",
    publisher: "Oxford University Press",
    url: "https://doi.org/10.1093/humrep/der092",
    type: "Consensus",
    level: "IV",
    priority: 3,
    quality: "Moderate",
    society: "ESHRE",
    summary:
      "ESHRE consensus establishing a standardised definition of poor ovarian response for research and clinical reporting, based on advanced maternal age or a risk factor, a previous poor response and abnormal ovarian reserve testing.",
    keywords: ["Bologna criteria", "poor ovarian response", "consensus"],
    topics: ["Bologna", "Poor Response", "Ovarian Reserve", "AFC", "AMH"],
    modules: ["bologna", "ovarian-reserve"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  {
    id: "cochrane-2016-antagonist",
    title:
      "Gonadotrophin-releasing hormone antagonists for assisted reproductive technology",
    authors: [
      "Hesham G. Al-Inany",
      "Mohamed A. Youssef",
      "Reuben Olugbenga Ayeleke",
      "Julie Brown",
      "Wai Sun Lam",
      "Frank J. Broekmans",
    ],
    journal: "Cochrane Database of Systematic Reviews",
    year: 2016,
    issue: "4",
    pages: "CD001750",
    doi: "10.1002/14651858.CD001750.pub4",
    pmid: "27126581",
    publisher: "Wiley",
    url: "https://doi.org/10.1002/14651858.CD001750.pub4",
    type: "Meta-analysis",
    level: "I",
    priority: 6,
    quality: "High",
    summary:
      "Cochrane review comparing GnRH antagonist protocols with long GnRH agonist protocols across randomised trials, reporting live birth, ongoing pregnancy and ovarian hyperstimulation syndrome outcomes.",
    keywords: ["GnRH antagonist", "GnRH agonist", "Cochrane", "meta-analysis"],
    topics: ["GnRH Antagonist", "Long Agonist", "OHSS"],
    modules: ["protocol-selection", "ohss-risk"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  {
    id: "cochrane-2014-agonist-trigger",
    title:
      "Gonadotropin-releasing hormone agonist versus HCG for oocyte triggering in antagonist-assisted reproductive technology",
    authors: [
      "Mohamed A. F. M. Youssef",
      "Fulco Van der Veen",
      "Hesham G. Al-Inany",
      "Monique H. Mochtar",
      "Georg Griesinger",
      "Mohamed Nagi Mohesen",
      "Ismail Aboulfoutouh",
      "Madelon van Wely",
    ],
    journal: "Cochrane Database of Systematic Reviews",
    year: 2014,
    issue: "10",
    pages: "CD008046",
    doi: "10.1002/14651858.CD008046.pub4",
    pmid: "25358904",
    publisher: "Wiley",
    url: "https://doi.org/10.1002/14651858.CD008046.pub4",
    type: "Meta-analysis",
    level: "I",
    priority: 6,
    quality: "High",
    summary:
      "Cochrane review of randomised trials comparing GnRH agonist and hCG final oocyte maturation triggers in antagonist cycles, reporting live birth, ongoing pregnancy and OHSS incidence.",
    keywords: ["trigger", "GnRH agonist trigger", "hCG", "OHSS"],
    topics: ["Trigger", "Dual Trigger", "OHSS", "GnRH Antagonist"],
    modules: ["trigger-selection", "ohss-risk"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  {
    id: "nejm-2016-freeze-all-pcos",
    title: "Fresh versus Frozen Embryos for Infertility in the Polycystic Ovary Syndrome",
    authors: [
      "Zi-Jiang Chen",
      "Yuhua Shi",
      "Yun Sun",
      "Bo Zhang",
      "Xiaoyan Liang",
      "Yunxia Cao",
      "Jing Yang",
      "Junli Zhao",
    ],
    journal: "New England Journal of Medicine",
    year: 2016,
    volume: "375",
    issue: "6",
    pages: "523-533",
    doi: "10.1056/NEJMoa1513873",
    pmid: "27509101",
    publisher: "Massachusetts Medical Society",
    url: "https://doi.org/10.1056/NEJMoa1513873",
    type: "RCT",
    level: "I",
    priority: 4,
    quality: "High",
    summary:
      "Multicentre randomised trial in women with polycystic ovary syndrome comparing elective frozen-embryo transfer with fresh-embryo transfer, reporting live birth, pregnancy complications and OHSS.",
    keywords: ["freeze-all", "frozen embryo transfer", "PCOS", "randomised trial"],
    topics: ["Freeze-All", "Fresh Transfer", "PCOS", "OHSS"],
    modules: ["transfer-strategy", "ohss-risk"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  {
    id: "cochrane-2022-blastocyst-transfer",
    title:
      "Cleavage-stage versus blastocyst-stage embryo transfer in assisted reproductive technology",
    authors: [
      "Demián Glujovsky",
      "Andrea Marta Retamar",
      "Carlos Roberto Alvarez Sedo",
      "Agustín Ciapponi",
      "Simone Cornelisse",
      "Deborah Blake",
    ],
    journal: "Cochrane Database of Systematic Reviews",
    year: 2022,
    issue: "5",
    pages: "CD002118",
    doi: "10.1002/14651858.CD002118.pub6",
    pmid: "35588094",
    publisher: "Wiley",
    url: "https://doi.org/10.1002/14651858.CD002118.pub6",
    type: "Systematic review",
    level: "I",
    priority: 5,
    quality: "High",
    summary:
      "Cochrane systematic review of randomised trials comparing cleavage-stage and blastocyst-stage embryo transfer, reporting live birth, cumulative pregnancy and cycle-cancellation outcomes.",
    keywords: ["blastocyst", "cleavage stage", "embryo transfer", "Cochrane"],
    topics: ["Blastocyst Transfer", "Embryo Culture", "Fresh Transfer"],
    modules: ["transfer-strategy"],
    status: "indexed",
    sourceKind: "DOI",
    addedAt: "2026-08-06",
  },
  // --- Reproductive BioMedicine Online 2015;31(3-4) source bundle (IVF_Evidence_Master_2026.pdf) ---
  {
    id: "rbmo-2015-behre-lh-timing",
    title:
      "Randomized trial comparing luteinizing hormone supplementation timing strategies in older women undergoing ovarian stimulation",
    authors: ["Hermann M Behre", "Colin M Howles", "Salvatore Longobardi", "PERSIST Study Investigators"],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "339-346",
    doi: "10.1016/j.rbmo.2015.06.002",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.002",
    type: "RCT",
    level: "II",
    priority: 5,
    quality: "Moderate",
    abstract:
      "In this open-label study, women aged 36–40 years undergoing ovarian stimulation were randomized to recombinant human FSH (rhFSH) plus recombinant human luteinizing hormone (rhLH) from stimulation day 1 (group A; n = 103), or rhFSH alone (days 1–5) followed by rhFSH plus rhLH from day 6 (group B; n = 99). Daily starting doses of total gonadotrophin were 300 IU in both groups, with dose adjustments permitted only from stimulation day 6.",
    summary:
      "Open-label randomized comparison of two r-hLH supplementation start times (day 1 versus day 6) in women aged 36–40 stimulated with a 300 IU daily starting dose of r-hFSH.",
    keywords: ["luteinizing hormone", "LH supplementation", "ovarian stimulation", "advanced maternal age"],
    topics: ["LH Supplementation", "Recombinant FSH", "Poor Response"],
    modules: ["stimulation-dose", "protocol-selection"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-dhillon-ethnicity",
    title: "Investigating the effect of ethnicity on IVF outcome",
    authors: [
      "Rima K Dhillon",
      "Paul P Smith",
      "Rosamund Malhas",
      "Hoda M Harb",
      "Ioannis D Gallos",
      "Ken Dowell",
      "Simon Fishel",
      "Jon J Deeks",
      "Aravinthan Coomarasamy",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "356-363",
    doi: "10.1016/j.rbmo.2015.05.015",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.05.015",
    type: "Cohort study",
    level: "III",
    priority: 6,
    quality: "Moderate",
    abstract:
      "Results of a cohort study analysing 13,473 first cycles were compared with meta-analysed data from 16 published studies, adjusted for age, body-mass index, cause of infertility, duration of infertility, previous live birth, previous spontaneous abortion and number of embryos transferred. Black and South Asian women had lower live birth rates than White women.",
    summary:
      "Cohort study of 13,473 first IVF cycles with an accompanying meta-analysis of 16 studies, reporting lower live birth rates in Black and South Asian women after adjustment for common confounders.",
    keywords: ["ethnicity", "live birth", "IVF outcome", "cohort study", "meta-analysis"],
    topics: ["Prognosis", "Ethnicity & Outcome"],
    modules: ["prognosis"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-heitmann-air-quality",
    title: "Live births achieved via IVF are increased by improvements in air quality and laboratory environment",
    authors: [
      "Ryan J Heitmann",
      "Micah J Hill",
      "Aidita N James",
      "Tim Schimmel",
      "James H Segars",
      "John M Csokmay",
      "Jacques Cohen",
      "Mark D Payson",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "364-371",
    doi: "10.1016/j.rbmo.2015.04.011",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.04.011",
    type: "Observational study",
    level: "III",
    priority: 6,
    quality: "Moderate",
    abstract:
      "Comparison of two consecutively used assisted reproduction laboratories after a required move, with equipment, physicians, embryologists, nursing staff and protocols kept constant. Embryo implantation (32.4% versus 24.3%; P < 0.01) and live birth (39.3% versus 31.8%; P < 0.05) were significantly increased in the new facility.",
    summary:
      "Before-and-after comparison of two IVF laboratories showing higher implantation and live birth rates after air quality and laboratory environment were improved.",
    keywords: ["air quality", "IVF laboratory", "live birth", "implantation"],
    topics: ["Laboratory Quality", "Embryo Culture"],
    modules: ["prognosis"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-hosseini-culture-media",
    title:
      "Contrasting effects of G1.2/G2.2 and SOF1/SOF2 embryo culture media on pre- and post-implantation development of non-transgenic and transgenic cloned goat embryos",
    authors: [
      "Sayed Morteza Hosseini",
      "Mehdi Hajian",
      "Somayyeh Ostadhosseini",
      "Mohsen Forouzanfar",
      "Parvaneh Abedi",
      "Farnoosh Jafarpour",
      "Mohammad Hossein Nasr-Esfahani",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "372-383",
    doi: "10.1016/j.rbmo.2015.06.008",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.008",
    type: "Observational study",
    level: "IV",
    priority: 7,
    quality: "Low",
    abstract:
      "Comparison of SOF1/SOF2 and G1.2/G2.2 sequential media for pre- and post-implantation development of somatic cell nuclear transfer goat embryos. G1.2/G2.2 supported higher blastocyst development, whereas post-transfer pregnancy outcomes were higher for SOF1/SOF2, with differential expression of 17 developmentally important genes.",
    summary:
      "Preclinical (caprine SCNT) comparison of sequential embryo culture media showing that superior blastocyst rates do not predict post-implantation development. Laboratory background only; not applicable to human clinical decisions.",
    keywords: ["embryo culture", "G1.2/G2.2", "SOF", "gene expression", "nuclear transfer"],
    topics: ["Embryo Culture", "Laboratory Quality"],
    modules: [],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-gunes-sperm-dna-repair",
    title: "Spermatogenesis, DNA damage and DNA repair mechanisms in male infertility",
    authors: ["Sezgin Gunes", "Maha Al-Sadaan", "Ashok Agarwal"],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "309-319",
    doi: "10.1016/j.rbmo.2015.06.010",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.010",
    type: "Review",
    level: "IV",
    priority: 7,
    quality: "Not rated",
    abstract:
      "Review of nucleotide excision repair, base excision repair, DNA mismatch repair, double strand break repair and post-replication repair in male germline cells, and how defects in these mechanisms arrest spermatogenesis and cause male infertility.",
    summary:
      "Narrative review of sperm DNA damage and the germline DNA repair pathways implicated in male infertility.",
    keywords: ["apoptosis", "DNA damage", "DNA repair mechanisms", "infertility", "spermatogenesis"],
    topics: ["Male Factor", "Sperm DNA"],
    modules: ["male-factor"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-feng-tp53-endometriosis",
    title: "The codon 72 polymorphism of the TP53 gene and endometriosis risk: a meta-analysis",
    authors: ["Yi Feng", "Yuan-Yuan Wu", "Li Li", "Zhi-Juan Luo", "Zhong Lin", "Tao Yi", "Xia Zhao"],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "320-326",
    doi: "10.1016/j.rbmo.2015.05.017",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.05.017",
    type: "Meta-analysis",
    level: "III",
    priority: 5,
    quality: "Moderate",
    summary:
      "Meta-analysis of case-control studies assessing the association between the TP53 codon 72 polymorphism and endometriosis risk.",
    keywords: ["TP53", "codon 72", "polymorphism", "endometriosis", "meta-analysis"],
    topics: ["Endometriosis"],
    modules: ["genetics"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-norton-surrogacy-survey",
    title: "A survey of UK fertility clinics' approach to surrogacy arrangements",
    authors: ["Wendy Norton", "Marilyn Crawshaw", "Nicky Hudson", "Lorraine Culley", "Caroline Law"],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "3",
    pages: "327-338",
    doi: "10.1016/j.rbmo.2015.06.009",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.009",
    type: "Observational study",
    level: "IV",
    priority: 7,
    quality: "Not rated",
    summary:
      "National survey of how UK fertility clinics organise, counsel and govern surrogacy arrangements. Service-delivery context, not a clinical rule source.",
    keywords: ["surrogacy", "fertility clinics", "United Kingdom", "survey"],
    topics: ["Third-Party Reproduction"],
    modules: [],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-zilberlicht-cell-phone-sperm",
    title: "Habits of cell phone usage and sperm quality – does it warrant attention?",
    authors: [
      "Ariel Zilberlicht",
      "Zofnat Wiener-Megnazi",
      "Yulia Sheinfeld",
      "Bronislava Grach",
      "Shirly Lahav-Baratz",
      "Martha Dirnfeld",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "4",
    pages: "421-426",
    doi: "10.1016/j.rbmo.2015.06.006",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.006",
    type: "Observational study",
    level: "IV",
    priority: 7,
    quality: "Low",
    summary:
      "Observational study relating self-reported cell phone usage habits to semen analysis parameters in men attending a fertility clinic.",
    keywords: ["cell phone", "electromagnetic radiation", "semen analysis", "sperm quality"],
    topics: ["Male Factor"],
    modules: ["male-factor"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-chikhoune-thymol-sperm",
    title: "In-vitro effects of Thymus munbyanus essential oil and thymol on human sperm motility and function",
    authors: [
      "Amirouche Chikhoune",
      "Laurence Stouvenel",
      "Mokrane Iguer-Ouada",
      "Mohamed Hazzit",
      "Jean Philippe Wolf",
      "Jacques Auger",
      "Daniel Vaiman",
      "Aminata Touré",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "4",
    pages: "411-420",
    doi: "10.1016/j.rbmo.2015.06.011",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.011",
    type: "Observational study",
    level: "IV",
    priority: 7,
    quality: "Low",
    summary:
      "In-vitro laboratory study of the effect of Thymus munbyanus essential oil and thymol on human sperm motility and function.",
    keywords: ["thymol", "essential oil", "sperm motility", "in vitro"],
    topics: ["Male Factor", "Laboratory Quality"],
    modules: ["male-factor"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
  {
    id: "rbmo-2015-seher-consanguinity-reserve",
    title: "Is parental consanguinity associated with reduced ovarian reserve?",
    authors: [
      "Tanja Seher",
      "Elisabeth Thiering",
      "Majdah al Azemi",
      "Joachim Heinrich",
      "Carsten B Schmidt-Weber",
      "Coleen Kivlahan",
      "Jan Gutermuth",
      "Human M Fatemi",
    ],
    journal: "Reproductive BioMedicine Online",
    year: 2015,
    volume: "31",
    issue: "4",
    pages: "427-433",
    doi: "10.1016/j.rbmo.2015.06.003",
    publisher: "Elsevier",
    url: "https://doi.org/10.1016/j.rbmo.2015.06.003",
    type: "Cohort study",
    level: "III",
    priority: 6,
    quality: "Moderate",
    summary:
      "Cohort analysis examining whether parental consanguinity is associated with reduced markers of ovarian reserve in women assessed for assisted reproduction.",
    keywords: ["consanguinity", "ovarian reserve", "AMH", "antral follicle count"],
    topics: ["Ovarian Reserve", "AMH", "AFC"],
    modules: ["ovarian-reserve"],
    status: "indexed",
    sourceKind: "PDF",
    fileName: "IVF_Evidence_Master_2026.pdf",
    addedAt: "2026-08-07",
  },
];

export const evidenceTypes: EvidenceType[] = [
  "Guideline",
  "RCT",
  "Meta-analysis",
  "Systematic review",
  "Cohort study",
  "Observational study",
  "Review",
  "Consensus",
];

export const evidenceLevels: EvidenceLevel[] = ["I", "II", "III", "IV", "Not graded"];

export const evidenceQualities: EvidenceQuality[] = ["High", "Moderate", "Low", "Not rated"];

export const evidenceSourceKinds: EvidenceSourceKind[] = [
  "PDF",
  "DOI",
  "PubMed",
  "Journal URL",
  "Conference Statement",
  "Clinical Guideline",
];

export const evidenceTopics = Array.from(
  new Set(evidenceLibrary.flatMap((e) => e.topics)),
).sort();

export const findEvidence = (id: string) => evidenceLibrary.find((e) => e.id === id);

export const evidenceForModule = (moduleId: string) =>
  evidenceLibrary.filter((e) => e.modules.includes(moduleId));

/** Vancouver-style citation string. */
export function formatCitation(e: EvidenceEntry): string {
  const authors =
    e.authors.length > 3 ? `${e.authors.slice(0, 3).join(", ")}, et al.` : e.authors.join(", ");
  const loc = [e.volume && `${e.volume}${e.issue ? `(${e.issue})` : ""}`, e.pages]
    .filter(Boolean)
    .join(":");
  return `${authors}. ${e.title}. ${e.journal}. ${e.year}${loc ? `;${loc}` : ""}.${
    e.doi ? ` doi:${e.doi}` : ""
  }`;
}

export function searchEvidence(
  entries: EvidenceEntry[],
  query: string,
  type: string,
  topic: string,
): EvidenceEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (type !== "All" && e.type !== type) return false;
    if (topic !== "All" && !e.topics.includes(topic)) return false;
    if (!q) return true;
    return [
      e.title,
      e.journal,
      e.doi ?? "",
      e.pmid ?? "",
      e.pii ?? "",
      e.summary,
      e.abstract ?? "",
      ...(e.keywords ?? []),
      ...e.authors,
      ...e.topics,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export interface EvidenceFilters {
  query: string;
  /** Publication types — empty means every type. */
  types: string[];
  /** Societies / journals — empty means every source. */
  sources: string[];
  /** Clinical topics — empty means every topic. */
  topics: string[];
  level: string;
  year: string;
  journal: string;
  author: string;
  priority: string;
  favoritesOnly: boolean;
  includeArchived: boolean;
}

export const defaultFilters: EvidenceFilters = {
  query: "",
  types: [],
  sources: [],
  topics: [],
  level: "All",
  year: "All",
  journal: "All",
  author: "",
  priority: "All",
  favoritesOnly: false,
  includeArchived: false,
};

export const evidenceSourceFilters = [
  "ESHRE",
  "ASRM",
  "RBMO",
  "Human Reproduction",
  "Fertility and Sterility",
];

/** Does an entry belong to a named society / journal family? */
export function matchesSource(e: EvidenceEntry, source: string): boolean {
  const hay = `${e.society ?? ""} ${e.journal} ${e.publisher ?? ""}`.toLowerCase();
  const s = source.toLowerCase();
  if (s === "rbmo") return hay.includes("reproductive biomedicine online") || hay.includes("rbmo");
  if (s === "fertility and sterility") return hay.includes("fertility and sterility");
  if (s === "human reproduction") return hay.includes("human reproduction");
  return hay.includes(s);
}

export type EvidenceSort =
  | "relevance"
  | "year-desc"
  | "year-asc"
  | "title"
  | "priority"
  | "level"
  | "journal";

export const evidenceSortLabels: Record<EvidenceSort, string> = {
  relevance: "Best match",
  "year-desc": "Newest first",
  "year-asc": "Oldest first",
  level: "Evidence level",
  title: "Alphabetical (A–Z)",
  journal: "Journal A–Z",
  priority: "Source priority",
};

const levelRank: Record<EvidenceLevel, number> = { I: 1, II: 2, III: 3, IV: 4, "Not graded": 5 };

/** Every text field the search box looks at, including linked module ids. */
export function searchHaystack(e: EvidenceEntry): string {
  return [
    e.title,
    e.journal,
    e.publisher ?? "",
    e.society ?? "",
    String(e.year),
    e.doi ?? "",
    e.pmid ?? "",
    e.pii ?? "",
    e.type,
    `level ${e.level}`,
    e.summary,
    e.abstract ?? "",
    ...(e.keywords ?? []),
    ...e.authors,
    ...e.topics,
    ...e.modules,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterAndSortEvidence(
  entries: EvidenceEntry[],
  filters: EvidenceFilters,
  sort: EvidenceSort,
  state: { favorites: string[]; archived: string[] },
): EvidenceEntry[] {
  const q = filters.query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const author = filters.author.trim().toLowerCase();

  const filtered = entries.filter((e) => {
    if (!filters.includeArchived && state.archived.includes(e.id)) return false;
    if (filters.favoritesOnly && !state.favorites.includes(e.id)) return false;
    if (filters.types.length && !filters.types.includes(e.type)) return false;
    if (filters.topics.length && !filters.topics.some((t) => e.topics.includes(t))) return false;
    if (filters.sources.length && !filters.sources.some((s) => matchesSource(e, s))) return false;
    if (filters.level !== "All" && e.level !== filters.level) return false;
    if (filters.year !== "All" && String(e.year) !== filters.year) return false;
    if (filters.journal !== "All" && e.journal !== filters.journal) return false;
    if (filters.priority !== "All" && String(e.priority) !== filters.priority) return false;
    if (author && !e.authors.join(" ").toLowerCase().includes(author)) return false;
    if (!terms.length) return true;
    const hay = searchHaystack(e);
    return terms.every((t) => hay.includes(t));
  });

  const scored = (e: EvidenceEntry) =>
    q && e.title.toLowerCase().includes(q) ? 0 : q && e.topics.join(" ").toLowerCase().includes(q) ? 1 : 2;

  return [...filtered].sort((a, b) => {
    switch (sort) {
      case "year-desc":
        return b.year - a.year;
      case "year-asc":
        return a.year - b.year;
      case "title":
        return a.title.localeCompare(b.title);
      case "journal":
        return a.journal.localeCompare(b.journal) || b.year - a.year;
      case "priority":
        return a.priority - b.priority || b.year - a.year;
      case "level":
        return levelRank[a.level] - levelRank[b.level] || b.year - a.year;
      default:
        return scored(a) - scored(b) || a.priority - b.priority || b.year - a.year;
    }
  });
}
