/**
 * Report structure — section skeleton only.
 * Every clinical content area stays empty until validated engines exist.
 */

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  /** Engine that will populate this section in a future release. */
  sourceModuleId?: string;
  /** Signature blocks are physician-completed rather than engine-populated. */
  manual?: boolean;
}

export const reportSections: ReportSection[] = [
  {
    id: "patient-summary",
    title: "Patient Summary",
    description: "Identification, demographics and treatment context.",
    sourceModuleId: "patient-classification",
  },
  {
    id: "clinical-findings",
    title: "Clinical Findings",
    description: "Documented history, examination and laboratory findings.",
    sourceModuleId: "ovarian-reserve",
  },
  {
    id: "poseidon",
    title: "POSEIDON Classification",
    description:
      "Classification result, explanation, criteria trace, data completeness and evidence references.",
    sourceModuleId: "poseidon",
  },
  {
    id: "patient-phenotype",
    title: "Patient Phenotype",
    description:
      "Unified phenotype: POSEIDON result, Bologna result, ovarian reserve, assessment summary, evidence references, missing data and assessment date.",
    sourceModuleId: "bologna",
  },
  {
    id: "ovarian-response",
    title: "Expected Ovarian Response",
    description:
      "Predicted response category, identified stimulation risks, contributing variables, data validation and supporting evidence. No protocol, medication, dose or trigger is recommended.",
    sourceModuleId: "poor-response",
  },
  {
    id: "calculated-scores",
    title: "Calculated Scores",
    description: "Reserved for validated classification and risk outputs.",
    sourceModuleId: "poseidon",
  },
  {
    id: "protocol-recommendation",
    title: "Protocol Recommendation",
    description:
      "Patient summary, recommended protocol, alternative protocols, evidence and clinical notes. Remains empty until validated protocol rules are implemented.",
    sourceModuleId: "protocol-recommendation",
  },
  {
    id: "gonadotropin-selection",
    title: "Gonadotropin Selection",
    description:
      "Patient summary, medication recommendation, alternative options, evidence and clinical notes. Remains empty until validated medication selection rules are implemented.",
    sourceModuleId: "gonadotropin-selection",
  },
  {
    id: "starting-dose",
    title: "Starting Dose",
    description:
      "Calculation date, variables used, recommended individualized recombinant FSH starting dose, calculation method, evidence reference and calculation version — produced by the CONSORT model only when every mandatory variable is valid.",
    sourceModuleId: "consort-dose",
  },

  {
    id: "monitoring",
    title: "Stimulation Monitoring",
    description:
      "Stimulation timeline, daily dose history, ultrasound findings, hormone results, response trend, informational observations, clinical notes and evidence references. No dose adjustment, cancellation, trigger timing or freeze-all decision is generated.",
    sourceModuleId: "dose-adjustment",
  },

  {
    id: "cycle-completion",
    title: "Cycle Completion & Safety",
    description:
      "Cycle progress, monitoring summary, follicular summary, hormone summary, safety summary, documented OHSS markers, trigger and freeze-all data surfaces, outstanding information and evidence status. No trigger, OHSS classification, freeze-all indication, fresh-transfer decision or cancellation is generated.",
    sourceModuleId: "trigger-recommendation",
  },

  {
    id: "recommendations",
    title: "Recommendations",
    description: "Reserved. No recommendation is generated in this release.",
    sourceModuleId: "protocol-recommendation",
  },

  {
    id: "evidence",
    title: "Evidence",
    description: "Publications backing each statement in the report.",
    sourceModuleId: "evidence-explanation",
  },
  {
    id: "references",
    title: "References",
    description: "Full citation list in the clinic's chosen format.",
    sourceModuleId: "evidence-explanation",
  },
  {
    id: "doctor-notes",
    title: "Doctor Notes",
    description: "Free-text consultant commentary.",
    manual: true,
  },
  {
    id: "signature",
    title: "Signature",
    description: "Consultant signature and date.",
    manual: true,
  },
];
