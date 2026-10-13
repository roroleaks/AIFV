/**
 * Clinical Knowledge Model — declarative registry only.
 *
 * Each module describes WHAT a future decision-support engine will handle,
 * WHICH patient variables it will consume and WHICH publications it must cite.
 * No module contains a formula, a dose, a threshold-driven recommendation or a
 * protocol suggestion. Every module is independent and can be implemented,
 * replaced or disabled without affecting the others.
 */

export type ModuleStatus = "not-implemented" | "awaiting-evidence";

export interface KnowledgeModule {
  id: string;
  name: string;
  scope: string;
  /** Canonical clinical variable ids this module will consume. */
  inputs: string[];
  /** What the module will output once evidence is mapped (descriptive only). */
  outputs: string[];
  /** Evidence entry ids that must back every future rule in this module. */
  evidence: string[];
  status: ModuleStatus;
}

export const knowledgeModules: KnowledgeModule[] = [
  {
    id: "ovarian-reserve",
    name: "Ovarian Reserve Classification",
    scope:
      "Descriptive classification of ovarian reserve markers against published reference ranges.",
    inputs: ["age", "amh", "afcTotal", "fsh", "lh", "estradiol"],
    outputs: ["Reserve category", "Marker concordance flags"],
    evidence: ["eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "poseidon",
    name: "POSEIDON Classification",
    scope:
      "Grouping of low-prognosis patients by age, reserve markers and previous ovarian response.",
    inputs: ["age", "amh", "afcTotal", "previousRetrieved", "previousCycles"],
    outputs: ["POSEIDON group"],
    evidence: [],
    status: "awaiting-evidence",
  },
  {
    id: "bologna",
    name: "Bologna Criteria (Poor Response)",
    scope: "Identification of poor ovarian response using published criteria.",
    inputs: ["age", "amh", "afcTotal", "previousRetrieved", "previousCycles"],
    outputs: ["Poor-responder criteria met"],
    evidence: [],
    status: "awaiting-evidence",
  },
  {
    id: "response-prediction",
    name: "Ovarian Response Prediction",
    scope: "Prediction of expected oocyte yield category from baseline markers.",
    inputs: ["age", "amh", "afcTotal", "bmi", "fsh", "previousRetrieved"],
    outputs: ["Expected response category"],
    evidence: ["eshre-2020-ovarian-stimulation", "rbmo-2015-consort-fsh-dose"],
    status: "not-implemented",
  },
  {
    id: "protocol-selection",
    name: "Stimulation Protocol Framework",
    scope:
      "Evidence map of agonist, antagonist, mild and duostim regimens and the patient variables that differentiate them.",
    inputs: ["age", "amh", "afcTotal", "pcos", "endometriosis", "previousProtocol", "previousOhss"],
    outputs: ["Protocol evidence summary"],
    evidence: ["eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "stimulation-dose",
    name: "Gonadotropin Dose Framework",
    scope:
      "Variables used by published individualised starting-dose models. No dose is computed by this application.",
    inputs: ["age", "amh", "afcTotal", "bmi", "fsh", "weight"],
    outputs: ["Dose-model input readiness"],
    evidence: ["rbmo-2015-consort-fsh-dose", "eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "trigger-selection",
    name: "Trigger Framework",
    scope:
      "Evidence map of hCG, agonist and dual trigger and the factors reported to influence the choice.",
    inputs: ["protocolType", "ohssRiskMarkers", "afcTotal", "amh"],
    outputs: ["Trigger evidence summary"],
    evidence: ["eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "ohss-risk",
    name: "OHSS Risk Factors",
    scope:
      "Documented risk factors for ovarian hyperstimulation syndrome as reported in guidelines.",
    inputs: ["age", "amh", "afcTotal", "pcos", "previousOhss", "bmi"],
    outputs: ["Documented risk factor list"],
    evidence: ["eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "endometrial-factor",
    name: "Endometrial Factor",
    scope:
      "Endometrial thickness, pattern and cavity findings relevant to transfer planning literature.",
    inputs: ["endometrium", "endometrialPattern", "cavityFindings", "polyps", "fibroids"],
    outputs: ["Endometrial documentation status"],
    evidence: [],
    status: "awaiting-evidence",
  },
  {
    id: "male-factor",
    name: "Male Factor Assessment",
    scope: "Semen parameters against WHO reference values and DNA fragmentation documentation.",
    inputs: [
      "partnerAge",
      "semenVolume",
      "concentration",
      "progressiveMotility",
      "totalMotility",
      "morphology",
      "dnaFragmentation",
    ],
    outputs: ["WHO reference comparison"],
    evidence: [],
    status: "awaiting-evidence",
  },
  {
    id: "genetics",
    name: "Genetic & PGT Considerations",
    scope: "Karyotype, carrier status and PGT indications documented for the couple.",
    inputs: ["karyotype", "carrierStatus", "pgtIndication", "recurrentLoss"],
    outputs: ["Genetic documentation status"],
    evidence: [],
    status: "awaiting-evidence",
  },
  {
    id: "luteal-support",
    name: "Luteal Phase Support Framework",
    scope: "Evidence map of luteal support routes and timing described in guidelines.",
    inputs: ["protocolType", "transferType", "triggerType"],
    outputs: ["Luteal support evidence summary"],
    evidence: ["eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "monitoring",
    name: "Cycle Monitoring Framework",
    scope: "Monitoring modalities and intervals described in published guidance.",
    inputs: ["protocolType", "ohssRiskMarkers"],
    outputs: ["Monitoring evidence summary"],
    evidence: ["eshre-2020-ovarian-stimulation"],
    status: "not-implemented",
  },
  {
    id: "prognosis",
    name: "Cumulative Outcome Context",
    scope: "Contextual outcome literature for counselling. Never a patient-specific probability.",
    inputs: ["age", "amh", "previousCycles", "previousLiveBirth", "bmi"],
    outputs: ["Literature context"],
    evidence: [],
    status: "awaiting-evidence",
  },
];

export const findModule = (id: string) => knowledgeModules.find((m) => m.id === id);
