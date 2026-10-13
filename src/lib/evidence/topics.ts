/**
 * Evidence taxonomy — clinical topics and source priority levels.
 *
 * Descriptive metadata only. Nothing here implies a recommendation, a dose,
 * a protocol or any clinical interpretation.
 */

export type EvidencePriority = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PriorityLevel {
  level: EvidencePriority;
  label: string;
  description: string;
  source?: string;
}

export const evidencePriorityLevels: PriorityLevel[] = [
  {
    level: 1,
    label: "ASRM Practice Committee Documents",
    description: "Current practice-committee documents and opinions.",
    source: "https://integration.asrm.org/practice-guidance/practice-committee-documents/",
  },
  {
    level: 2,
    label: "ESHRE Guidelines",
    description: "Current European society guidelines and recommendations.",
    source: "https://www.eshre.eu/Guidelines-and-Legal",
  },
  {
    level: 3,
    label: "Major Evidence Papers",
    description:
      "Landmark publications: CONSORT individualised FSH calculator, POSEIDON, Bologna criteria, OHSS prevention, ovarian stimulation, trigger strategy, freeze-all and embryo transfer.",
  },
  {
    level: 4,
    label: "Randomized Controlled Trials",
    description: "Primary interventional trials.",
  },
  { level: 5, label: "Systematic Reviews", description: "Structured qualitative syntheses." },
  { level: 6, label: "Meta-Analyses", description: "Quantitative pooled syntheses." },
  {
    level: 7,
    label: "Observational Studies",
    description: "Cohort, case-control and registry data.",
  },
];

export const priorityLabel = (level: EvidencePriority) =>
  evidencePriorityLevels.find((p) => p.level === level)?.label ?? `Level ${level}`;

/** Clinical topic taxonomy used for organising and filtering the library. */
export interface TopicGroup {
  id: string;
  label: string;
  topics: string[];
}

export const clinicalTopicGroups: TopicGroup[] = [
  {
    id: "reserve",
    label: "Ovarian Reserve & Prognosis",
    topics: [
      "Ovarian Reserve",
      "AMH",
      "AFC",
      "POSEIDON",
      "Bologna",
      "Poor Response",
      "Hyper Response",
    ],
  },
  {
    id: "safety",
    label: "Safety",
    topics: ["OHSS", "Freeze-All"],
  },
  {
    id: "protocols",
    label: "Stimulation Protocols",
    topics: [
      "GnRH Antagonist",
      "Long Agonist",
      "Short Agonist",
      "Microflare",
      "PPOS",
      "DuoStim",
      "Natural Cycle",
      "Mild Stimulation",
    ],
  },
  {
    id: "medications",
    label: "Gonadotropins",
    topics: ["Recombinant FSH", "HMG", "LH Supplementation"],
  },
  {
    id: "trigger",
    label: "Trigger & Transfer",
    topics: [
      "Trigger",
      "Dual Trigger",
      "Fresh Transfer",
      "Blastocyst Transfer",
      "Embryo Culture",
      "PGT",
    ],
  },
  {
    id: "populations",
    label: "Patient Populations",
    topics: [
      "Male Factor",
      "Sperm DNA",
      "Endometriosis",
      "PCOS",
      "Recurrent Implantation Failure",
      "Recurrent Pregnancy Loss",
    ],
  },
  {
    id: "context",
    label: "Laboratory, Prognosis & Service Delivery",
    topics: ["Laboratory Quality", "Prognosis", "Ethnicity & Outcome", "Third-Party Reproduction"],
  },
];

export const allClinicalTopics = clinicalTopicGroups.flatMap((g) => g.topics);

export const topicGroupFor = (topic: string) =>
  clinicalTopicGroups.find((g) => g.topics.includes(topic));
