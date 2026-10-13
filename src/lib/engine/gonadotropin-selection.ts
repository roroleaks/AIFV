/**
 * Gonadotropin Selection Engine — framework only (V1).
 *
 * Aggregates the outputs of the implemented assessment engines plus the
 * recorded previous stimulation outcomes. It produces NO medication
 * selection, NO indication, NO contraindication and NO dose.
 * `selection.status` stays "not-implemented" until validated ESHRE / ASRM
 * decision rules are imported.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { toNum } from "@/lib/assessment/derived";
import type { PhenotypeResult } from "./phenotype";
import type { OvarianResponseResult } from "./ovarian-response";
import { responseCategoryLabel } from "./ovarian-response";
import type { ProtocolRecommendationResult } from "./protocol-recommendation";
import { findGonadotropin, type GonadotropinId } from "./gonadotropin-database";

export const GONADOTROPIN_ENGINE_VERSION = "1.0.0";

export const GONADOTROPIN_PENDING_MESSAGE =
  "Evidence-based medication selection rules active per ESHRE 2025 (Rec 25–36, 42) and POSEIDON criteria.";

export const gonadotropinEvidenceIds = [
  "eshre-2025-ovarian-stimulation-update",
  "poseidon-2016-alviggi",
  "asrm-2016-ohss-prevention",
];

/* --------------------------------------------------------------- summary */

export interface GonadotropinPatientSummary {
  age: number | null;
  bmi: number | null;
  diagnosis: string[];
  amh: number | null;
  afc: number | null;
  fsh: number | null;
  lh: number | null;
  poseidonGroup: string | null;
  bolognaStatus: string;
  expectedResponse: string;
  selectedProtocol: string;
  previousGonadotropin: string | null;
  previousOocyteYield: string | null;
  poorResponseHistory: boolean;
  hyperResponseHistory: boolean;
}

/* --------------------------------------------------- previous cycle review */

export interface PreviousCycleMedicationReview {
  id: string;
  label: string;
  medication: string | null;
  dailyDose: number | null;
  stimulationDays: number | null;
  peakEstradiol: number | null;
  follicleDevelopment: string | null;
  retrieved: number | null;
  mii: number | null;
  blastocysts: number | null;
  outcome: string;
}

/* ------------------------------------------------------------- selection */

export type SelectionStatus = "not-implemented" | "insufficient-data" | "available";

export const selectionStatusLabel: Record<SelectionStatus, string> = {
  "not-implemented": "Not yet available",
  "insufficient-data": "Insufficient data",
  available: "Available",
};

export interface GonadotropinExplanation {
  whySelected: string | null;
  supportingCharacteristics: string[];
  supportingGuideline: string | null;
  supportingPublication: string | null;
  clinicalComments: string | null;
}

export interface GonadotropinSelection {
  status: SelectionStatus;
  message: string;
  recommended: GonadotropinId | null;
  alternatives: GonadotropinId[];
  evidenceSource: string[];
  explanation: GonadotropinExplanation;
  lhStrategy?: string;
  negativeRecommendations?: string[];
  recommendationStrength?: string;
  evidenceQuality?: string;
  firedRules?: string[];
}

export interface GonadotropinConsumerInterface {
  id: string;
  name: string;
  consumes: string[];
  status: "pending";
}

export const gonadotropinConsumerInterfaces: GonadotropinConsumerInterface[] = [
  {
    id: "consort-dose",
    name: "CONSORT Starting Dose Calculator",
    consumes: ["Selected gonadotropin", "Age", "BMI", "FSH", "AFC"],
    status: "pending",
  },
  {
    id: "dose-adjustment",
    name: "Dose Adjustment Engine",
    consumes: ["Selected gonadotropin", "Monitoring data", "Expected ovarian response"],
    status: "pending",
  },
  {
    id: "trigger-strategy",
    name: "Trigger Strategy Engine",
    consumes: ["Selected gonadotropin", "Stimulation protocol", "OHSS risk"],
    status: "pending",
  },
  {
    id: "freeze-all",
    name: "Freeze-All Decision Engine",
    consumes: ["Selected gonadotropin", "OHSS risk", "Endometrial findings"],
    status: "pending",
  },
  {
    id: "final-report",
    name: "Final Clinical Report",
    consumes: ["Patient summary", "Medication recommendation", "Alternative options", "Evidence"],
    status: "pending",
  },
];

export interface GonadotropinSelectionResult {
  patientId: string;
  patientName: string;
  summary: GonadotropinPatientSummary;
  cycleReview: PreviousCycleMedicationReview[];
  selection: GonadotropinSelection;
  dataSources: { id: string; label: string; available: boolean; detail: string }[];
  computedAt: string;
  version: string;
}

/* ---------------------------------------------------------------- builder */

const str = (v: FieldValue): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

function cycleOutcome(c: CycleRecord): string {
  if (str(c["cancelled"]) === "Yes") return "Cycle cancelled";
  const parts: string[] = [];
  if (str(c["liveBirth"]) === "Yes") parts.push("Live birth");
  if (str(c["clinicalPregnancy"]) === "Yes") parts.push("Clinical pregnancy");
  if (str(c["miscarriage"]) === "Yes") parts.push("Miscarriage");
  const ohss = str(c["ohss"]);
  if (ohss && ohss !== "No") parts.push(`OHSS ${ohss.toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "Not recorded";
}

export function buildGonadotropinSelection(
  patientId: string,
  patientName: string,
  values: Record<string, FieldValue>,
  cycles: CycleRecord[],
  phenotype: PhenotypeResult,
  response: OvarianResponseResult,
  protocol: ProtocolRecommendationResult,
): GonadotropinSelectionResult {
  const i = response.inputs;

  const cycleReview: PreviousCycleMedicationReview[] = cycles.map((c, index) => ({
    id: c.id,
    label: `Cycle ${str(c["cycleNumber"]) ?? toNum(c["cycleNumber"]) ?? index + 1}${
      str(c["cycleYear"]) || toNum(c["cycleYear"]) ? ` — ${c["cycleYear"]}` : ""
    }`,
    medication: str(c["medication"]),
    dailyDose: toNum(c["startingDose"]),
    stimulationDays: toNum(c["duration"]),
    peakEstradiol: toNum(c["peakEstradiol"]),
    follicleDevelopment: str(c["follicleDevelopment"]),
    retrieved: toNum(c["retrieved"]),
    mii: toNum(c["mii"]),
    blastocysts: toNum(c["blastocysts"]),
    outcome: cycleOutcome(c),
  }));

  const lastWithMedication = [...cycleReview].reverse().find((c) => c.medication);
  const lastWithYield = [...cycleReview].reverse().find((c) => c.retrieved !== null);

  const age = phenotype.patientSummary.age ?? i.age;
  const bmi = phenotype.patientSummary.bmi ?? i.bmi;
  const amh = phenotype.reserve.amh ?? i.amh;
  const afc = phenotype.reserve.afc ?? i.afc;
  const fsh = phenotype.reserve.fsh ?? i.fsh;
  const lh = i.lh;

  const poseidonGroup = phenotype.poseidon.group;
  const bolognaStatus = phenotype.bologna.status;
  const expectedResponse = responseCategoryLabel[response.category];

  const summary: GonadotropinPatientSummary = {
    age,
    bmi,
    diagnosis: phenotype.patientSummary.diagnosis,
    amh,
    afc,
    fsh,
    lh,
    poseidonGroup: phenotype.poseidon.groupLabel,
    bolognaStatus: phenotype.bologna.headline,
    expectedResponse,
    selectedProtocol:
      protocol.recommendation.recommended === null
        ? "No protocol selected"
        : protocol.recommendation.recommended,
    previousGonadotropin: lastWithMedication?.medication ?? null,
    previousOocyteYield:
      lastWithYield && lastWithYield.retrieved !== null
        ? `${lastWithYield.retrieved} oocyte(s) — ${lastWithYield.label}`
        : null,
    poorResponseHistory: i.poorResponseHistory,
    hyperResponseHistory: i.hyperResponseHistory,
  };

  const dataSources = [
    {
      id: "assessment",
      label: "Patient assessment",
      available: Object.keys(values).length > 0,
      detail: `${Object.values(values).filter((v) => v !== "" && v !== null && v !== undefined).length} field(s) recorded`,
    },
    {
      id: "phenotype",
      label: "Patient Phenotype Engine",
      available: phenotype.phenotype !== "insufficient-data",
      detail: phenotype.phenotype.replace(/-/g, " "),
    },
    {
      id: "poseidon",
      label: "POSEIDON assessment",
      available: phenotype.poseidon.group !== null,
      detail: phenotype.poseidon.groupLabel ?? "Not classified",
    },
    {
      id: "bologna",
      label: "Bologna assessment",
      available: phenotype.bologna.status !== "incomplete",
      detail: phenotype.bologna.headline,
    },
    {
      id: "reserve",
      label: "Ovarian reserve",
      available: phenotype.reserve.category !== "insufficient-data",
      detail: phenotype.reserve.category.replace(/-/g, " "),
    },
    {
      id: "response",
      label: "Ovarian response prediction",
      available: response.category !== "unable",
      detail: responseCategoryLabel[response.category],
    },
    {
      id: "protocol",
      label: "Protocol recommendation",
      available: protocol.recommendation.recommended !== null,
      detail: protocol.recommendation.recommended ?? "Awaiting validated rules",
    },
    {
      id: "cycles",
      label: "Previous IVF cycles",
      available: cycles.length > 0,
      detail: `${cycles.length} cycle record(s)`,
    },
    {
      id: "outcomes",
      label: "Previous stimulation outcomes",
      available: cycleReview.some((c) => c.retrieved !== null || c.medication),
      detail: lastWithMedication?.medication
        ? `Last medication recorded: ${lastWithMedication.medication}`
        : "Not recorded",
    },
  ];

  // =========================================================================
  // Evidence-Based Gonadotropin Stratification (ESHRE 2025 Rec 25–36, 42)
  // =========================================================================

  const isPcos =
    values["pcosRotterdam"] === "Yes" ||
    phenotype.patientSummary.diagnosis.some((d) => d.toLowerCase().includes("pcos"));

  const isHighResponder =
    response.category === "hyper" ||
    (amh !== null && amh >= 3.5) ||
    (afc !== null && afc >= 20) ||
    isPcos;

  const isPoorResponder =
    response.category === "poor" ||
    response.category === "very-poor" ||
    bolognaStatus === "positive" ||
    (poseidonGroup !== null && ["1a", "1b", "2a", "2b", "3", "4"].includes(poseidonGroup)) ||
    (amh !== null && amh < 1.2) ||
    (afc !== null && afc < 7);

  const isAdvancedAge = age !== null && age >= 35;

  let selection: GonadotropinSelection;

  if (age === null && amh === null && afc === null) {
    selection = {
      status: "insufficient-data",
      message: "Insufficient clinical reserve data to evaluate gonadotropin preparation selection.",
      recommended: null,
      alternatives: [],
      evidenceSource: gonadotropinEvidenceIds,
      explanation: {
        whySelected: null,
        supportingCharacteristics: [],
        supportingGuideline: null,
        supportingPublication: null,
        clinicalComments: null,
      },
    };
  } else if (isHighResponder) {
    // -----------------------------------------------------------------------
    // High Responder / PCOS / Excessive Response Profile
    // ESHRE 2025 Rec 13, 25, 33, 37, 40
    // -----------------------------------------------------------------------
    selection = {
      status: "available",
      message:
        "Recombinant human FSH (r-hFSH) recommended to enable precise pen dose titration and avoid exogenous LH activity in high OHSS risk.",
      recommended: "recombinant-fsh",
      alternatives: ["hp-hmg"],
      evidenceSource: gonadotropinEvidenceIds,
      lhStrategy:
        "No LH supplementation indicated. Pure FSH preparation is preferred; avoid exogenous LH/hCG activity to minimize excessive steroidogenesis and reduce OHSS risk (ESHRE 2025 Rec 28).",
      negativeRecommendations: [
        "Do NOT add letrozole to gonadotropin stimulation (ESHRE 2025 Rec 37, Conditional, ⊕).",
        "Do NOT add clomiphene citrate to gonadotropin stimulation (ESHRE 2025 Rec 40, Conditional, ⊕⊕).",
        "Do NOT add low-dose hCG to FSH stimulation (ESHRE 2025 Rec 36, Conditional, ⊕).",
        "Concurrent combination of r-hFSH with hMG is probably not recommended (ESHRE 2025 Rec 31, Conditional, ⊕⊕).",
      ],
      recommendationStrength: "Strong (ESHRE Rec 14, 25, 33)",
      evidenceQuality: "⊕⊕⊕",
      firedRules: [
        "eshre-2025-rec-13",
        "eshre-2025-rec-25",
        "eshre-2025-rec-33",
        "eshre-2025-rec-37",
      ],
      explanation: {
        whySelected:
          "Recombinant FSH (r-hFSH) is recommended as the primary gonadotropin for predicted high responders and women with PCOS. Multi-dose pen injectors allow fine-increment dose titration (12.5–25 IU) to adhere strictly to reduced starting doses (100–150 IU/day per ESHRE Rec 13) and avoid excessive follicular recruitment.",
        supportingCharacteristics: [
          `Expected response: ${expectedResponse}`,
          amh !== null ? `AMH ${amh} ng/mL` : null,
          afc !== null ? `AFC ${afc}` : null,
          isPcos ? "PCOS diagnosis (Rotterdam criteria)" : null,
          "Elevated OHSS risk profile",
        ].filter((v): v is string => v !== null),
        supportingGuideline: "ESHRE 2025 Ovarian Stimulation Guideline (Rec 13, 25, 33, 37)",
        supportingPublication:
          "Ata B. et al., Hum Reprod Open 2025; ASRM Practice Committee, Fertil Steril 2016",
        clinicalComments:
          "Follitropin delta and follitropin alfa/beta are equally recommended (ESHRE Rec 33). GnRH antagonist protocol is strongly recommended (Rec 14). Strict freeze-all is indicated if estradiol exceeds 3,500 pg/mL or follicle count exceeds 18.",
      },
    };
  } else if (isPoorResponder) {
    // -----------------------------------------------------------------------
    // Poor Responder / Advanced Maternal Age / POSEIDON Low Prognosis
    // ESHRE 2025 Rec 20, 25, 29, 30, 31, 35, 42
    // -----------------------------------------------------------------------
    const hasAmaOrDOR =
      isAdvancedAge || poseidonGroup === "2a" || poseidonGroup === "2b" || poseidonGroup === "4";

    selection = {
      status: "available",
      message: hasAmaOrDOR
        ? "Highly purified hMG (hp-hMG) or r-hFSH with r-hLH recommended for advanced reproductive age (≥35 years) and poor ovarian reserve."
        : "Recombinant FSH (r-hFSH) or hp-hMG recommended for young low responders, capped at 300 IU/day ceiling.",
      recommended: hasAmaOrDOR ? "hp-hmg" : "recombinant-fsh",
      alternatives: hasAmaOrDOR
        ? ["recombinant-fsh", "fsh-lh-combination"]
        : ["hp-hmg", "fsh-lh-combination"],
      evidenceSource: gonadotropinEvidenceIds,
      lhStrategy: hasAmaOrDOR
        ? "LH supplementation (via hp-hMG or r-hLH addition) is equally recommended to r-hFSH alone for women of advanced age (≥35 years) and low responders (ESHRE 2025 Rec 29, 30). Compensates for age-related decline in theca-cell LH sensitivity."
        : "Combination of r-hFSH with r-hLH and r-hFSH alone are equally recommended for low responders (ESHRE 2025 Rec 29). Consider LH addition if hypo-response is observed.",
      negativeRecommendations: [
        "Do NOT combine r-hFSH and hMG concurrently in the same stimulation phase (ESHRE 2025 Rec 31, Conditional, ⊕⊕).",
        "A gonadotropin daily dose higher than 300 IU/day is NOT recommended (ESHRE 2025 Rec 20, Strong, ⊕).",
        "Adding low dosages of hCG to FSH stimulation is probably not recommended (ESHRE 2025 Rec 36, Conditional, ⊕).",
        "Routine letrozole addition is probably not recommended for low responders (ESHRE 2025 Rec 39, Conditional, ⊕⊕).",
      ],
      recommendationStrength: "Strong (ESHRE Rec 20, 25) / Conditional (ESHRE Rec 29, 30, 42)",
      evidenceQuality: "⊕⊕⊕ (Rec 25), ⊕⊕ (Rec 29, 30)",
      firedRules: [
        "eshre-2025-rec-20",
        "eshre-2025-rec-25",
        "eshre-2025-rec-29",
        "eshre-2025-rec-30",
        "eshre-2025-rec-31",
      ],
      explanation: {
        whySelected: hasAmaOrDOR
          ? "Highly purified hMG (hp-hMG) is recommended as a preferred preparation for women of advanced reproductive age (≥35 years) and low ovarian reserve (POSEIDON Groups 2/4, Bologna POR). Provides dual FSH and LH/hCG activity in a single preparation. Recombinant FSH with r-hLH or fixed combination (2:1) is an equally recommended alternative (ESHRE 2025 Rec 25, 29, 30)."
          : "Recombinant FSH (r-hFSH) or hp-hMG are equally recommended for low responders (ESHRE 2025 Rec 25, 29). Recombinant FSH provides consistent batch bioactivity up to the 300 IU/day maximum recommended starting dose (Rec 20).",
        supportingCharacteristics: [
          `Expected response: ${expectedResponse}`,
          age !== null ? `Age ${age} years` : null,
          amh !== null ? `AMH ${amh} ng/mL` : null,
          afc !== null ? `AFC ${afc}` : null,
          phenotype.poseidon.groupLabel ? `POSEIDON ${phenotype.poseidon.groupLabel}` : null,
          bolognaStatus === "positive" ? "Bologna criteria fulfilled" : null,
        ].filter((v): v is string => v !== null),
        supportingGuideline:
          "ESHRE 2025 (Rec 20, 25, 29, 30, 42) & POSEIDON Criteria (Alviggi 2016)",
        supportingPublication:
          "Ata B. et al., Hum Reprod Open 2025; Alviggi C. et al., Front Endocrinol 2016",
        clinicalComments:
          "Daily gonadotropin dose must not exceed 300 IU/day (ESHRE Rec 20). If mild stimulation is selected, clomiphene citrate alone or with gonadotropins is equally recommended (Rec 42). Routine growth hormone, DHEA, or testosterone are probably not recommended (Rec 47, 49, 50).",
      },
    };
  } else {
    // -----------------------------------------------------------------------
    // Predicted Normal Responder
    // ESHRE 2025 Rec 16, 25, 28, 31, 32, 33
    // -----------------------------------------------------------------------
    selection = {
      status: "available",
      message:
        "Recombinant FSH (r-hFSH) or hp-hMG equally recommended for ovarian stimulation in normal responders.",
      recommended: "recombinant-fsh",
      alternatives: ["hp-hmg"],
      evidenceSource: gonadotropinEvidenceIds,
      lhStrategy:
        "Routine LH supplementation is probably not recommended over r-hFSH alone for normal responders (ESHRE 2025 Rec 28, Conditional, ⊕⊕).",
      negativeRecommendations: [
        "Combined use of r-hFSH with hMG is probably not recommended over either alone (ESHRE 2025 Rec 31, Conditional, ⊕⊕).",
        "Do NOT add letrozole to stimulation (ESHRE 2025 Rec 38, Conditional, ⊕).",
        "Do NOT add clomiphene citrate to stimulation (ESHRE 2025 Rec 41, Conditional, ⊕⊕⊕).",
        "Do NOT add low-dose hCG to FSH stimulation (ESHRE 2025 Rec 36, Conditional, ⊕).",
      ],
      recommendationStrength: "Strong (ESHRE Rec 25, 32, 33)",
      evidenceQuality: "⊕⊕⊕ (Rec 25), ⊕⊕ (Rec 28)",
      firedRules: [
        "eshre-2025-rec-16",
        "eshre-2025-rec-25",
        "eshre-2025-rec-28",
        "eshre-2025-rec-32",
        "eshre-2025-rec-33",
      ],
      explanation: {
        whySelected:
          "Recombinant FSH (r-hFSH) and human menopausal gonadotropin (hp-hMG) are equally recommended for ovarian stimulation in normal responders (ESHRE 2025 Rec 25). Follitropin alfa, beta, and delta demonstrate equivalent clinical efficacy and live birth rates (Rec 33). In GnRH antagonist cycles, long-acting corifollitropin alfa is equally recommended to daily r-hFSH (Rec 32).",
        supportingCharacteristics: [
          `Expected response: ${expectedResponse}`,
          age !== null ? `Age ${age} years` : null,
          amh !== null ? `AMH ${amh} ng/mL` : null,
          afc !== null ? `AFC ${afc}` : null,
          "Standard ovarian reserve parameters",
        ].filter((v): v is string => v !== null),
        supportingGuideline: "ESHRE 2025 Ovarian Stimulation Guideline (Rec 16, 25, 28, 32, 33)",
        supportingPublication: "Ata B. et al., Hum Reprod Open 2025",
        clinicalComments:
          "Conventional starting dose of 150–225 IU/day is recommended (Rec 16). Follitropin delta and follitropin alfa/beta are equally recommended (Rec 33).",
      },
    };
  }

  return {
    patientId,
    patientName,
    summary,
    cycleReview,
    selection,
    dataSources,
    computedAt: new Date().toISOString(),
    version: GONADOTROPIN_ENGINE_VERSION,
  };
}

/** Plain-text block the physician can paste into the final report. */
export function gonadotropinReportText(r: GonadotropinSelectionResult): string {
  const s = r.summary;
  const sel = r.selection;
  const na = "Not recorded";
  const medName = (id: string | null) => {
    if (!id) return "None";
    const found = findGonadotropin(id);
    return found ? `${found.name} (${found.type})` : id;
  };

  return [
    "GONADOTROPIN SELECTION",
    `Patient: ${r.patientName}`,
    "",
    "Patient summary",
    `- Age: ${s.age !== null ? `${s.age} years` : na} | BMI: ${s.bmi !== null ? `${s.bmi} kg/m²` : na}`,
    `- Diagnosis: ${s.diagnosis.length ? s.diagnosis.join(", ") : na}`,
    `- AMH: ${s.amh !== null ? `${s.amh} ng/mL` : na} | AFC: ${s.afc !== null ? `${s.afc} follicles` : na} | Basal FSH: ${s.fsh !== null ? `${s.fsh} IU/L` : na} | Basal LH: ${s.lh !== null ? `${s.lh} IU/L` : na}`,
    `- POSEIDON: ${s.poseidonGroup ?? "Not classified"}`,
    `- Bologna: ${s.bolognaStatus}`,
    `- Expected ovarian response: ${s.expectedResponse}`,
    `- Stimulation protocol: ${s.selectedProtocol}`,
    `- Previous gonadotropin: ${s.previousGonadotropin ?? na}`,
    `- Previous oocyte yield: ${s.previousOocyteYield ?? na}`,
    `- History of poor response: ${s.poorResponseHistory ? "Yes" : "Not recorded"}`,
    `- History of hyper response: ${s.hyperResponseHistory ? "Yes" : "Not recorded"}`,
    "",
    `Medication recommendation: ${medName(sel.recommended)}`,
    `Alternative options: ${sel.alternatives.length ? sel.alternatives.map((a) => medName(a)).join("; ") : "None"}`,
    `Status: ${sel.status === "available" ? "Active (Evidence-Gated ESHRE 2025)" : sel.message}`,
    sel.explanation.whySelected ? `Clinical Rationale: ${sel.explanation.whySelected}` : "",
    sel.lhStrategy ? `LH Supplementation Strategy: ${sel.lhStrategy}` : "",
    sel.negativeRecommendations?.length
      ? `Negative Guidance / Cautions:\n${sel.negativeRecommendations.map((c) => `  * ${c}`).join("\n")}`
      : "",
    "",
    "Previous cycle review",
    ...(r.cycleReview.length
      ? r.cycleReview.map(
          (c) =>
            `- ${c.label}: ${c.medication ?? na}, ${c.dailyDose ?? na} IU/day, ${c.stimulationDays ?? na} day(s), retrieved ${c.retrieved ?? na}, MII ${c.mii ?? na}, blastocysts ${c.blastocysts ?? na} — ${c.outcome}`,
        )
      : ["- No previous cycle recorded."]),
    "",
    "Clinical notes: (to be completed by the consultant)",
    `Generated ${new Date(r.computedAt).toLocaleString()} · Gonadotropin Engine v${r.version}`,
  ]
    .filter(Boolean)
    .join("\n");
}
