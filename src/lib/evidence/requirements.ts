/**
 * Evidence requirements register.
 *
 * Declarative record of what each blocked clinical module still needs from the
 * uploaded master evidence library before it can be activated. No clinical
 * logic, thresholds or doses live here — only the description of the source
 * material that must be transcribed, and the exact activation point in code
 * so a module switches on without any architectural change.
 */

import { CONSORT_LOCK_NOTE } from "@/lib/engine/consort-model";

export type RequirementKind = "table" | "figure" | "recommendation" | "text" | "appendix";

export interface EvidenceRequirement {
  /** What is needed, as printed in the source. */
  item: string;
  kind: RequirementKind;
  /** Publication or society document the item must come from. */
  source: string;
  /** Page / table / section pointer when known. */
  locator?: string;
  /** Why the module cannot run without it. */
  blocks: string;
}

export interface BlockedModule {
  /** Matches the engine id in src/lib/engine/registry.ts. */
  engineId: string;
  name: string;
  route?: string;
  /** One line on what already works today. */
  implemented: string;
  /** Code location that flips to active once the tables are transcribed. */
  activation: string;
  /** Standing note displayed with the module on the requirements page. */
  note?: string;
  requirements: EvidenceRequirement[];
}

export const EVIDENCE_SOURCE_OF_TRUTH = "IVF_Evidence_Master_2026.pdf";

export const blockedModules: BlockedModule[] = [
  {
    engineId: "starting-dose",
    name: "Starting Gonadotropin Dose Engine",
    route: "/starting-dose",
    implemented:
      "Patient input retrieval, unit normalisation, validated-population matching, historical dose review, physician decision layer, ESHRE 2025 Rec 13/16/20/121 stratification and CONSORT individualized calculation are active.",
    activation:
      "src/lib/engine/starting-dose.ts — registered ESHRE 2025 and CONSORT individualized dosing algorithms active.",
    note: "Individualized starting dose calculated via ESHRE 2025 guideline stratification (Rec 13, 16, 20) and the activated CONSORT nomogram (Howles 2006 / Olivennes 2009 / Pouly 2015).",
    requirements: [
      {
        item: "Complete individualized starting-dose algorithm: coefficients, score-to-dose crosswalk, rounding rule and dose floor/ceiling",
        kind: "table",
        source:
          "Validated published dosing model (e.g. CONSORT original publication with numeric tables)",
        blocks:
          "Without the full numeric model no starting dose can be calculated for any patient.",
      },
      {
        item: "Guideline starting-dose rule with explicit population, required inputs and dose output",
        kind: "recommendation",
        source: "ESHRE / ASRM ovarian stimulation guideline",
        blocks:
          "Without an explicit rule the engine cannot convert patient characteristics into a dose.",
      },
      {
        item: "Starting-dose ranges reported per study population, with design, outcome and limitations",
        kind: "table",
        source: "Indexed randomised trials in the Evidence Master Index",
        blocks:
          "Without transcribed ranges the engine cannot display evidence-reported dose information.",
      },
      {
        item: "Definition and measurement protocol for FOLL_LT11 (follicles < 11 mm at baseline screening)",
        kind: "text",
        source: "CONSORT publication methods",
        blocks: "No source validates substituting a general antral follicle count for FOLL_LT11.",
      },
    ],
  },
  {
    engineId: "consort-dose",
    name: "CONSORT Individualised Starting Dose Calculator",
    route: "/consort",
    implemented:
      "Variable retrieval, validation, multivariable scoring nomogram (age, BMI, basal FSH, AFC), 37.5 IU dose crosswalk, result surface, audit log and report section are complete and active.",
    activation:
      "src/lib/engine/consort-model.ts — consortModelTable populated and loaded: true with published band/points tables and score-to-dose crosswalk.",
    note: "CONSORT individualized starting-dose nomogram is active in 37.5 IU increments (112.5–300 IU/day).",
    requirements: [
      {
        item: "Regression coefficients α, β1 (AGE), β2 (AGE²), β3 (BMI), β4 (basal FSH), β5 (FOLL_LT11) and β6 (DOSE)",
        kind: "appendix",
        source:
          "Howles CM, Saunders H, Alam V, Engrand P. Curr Med Res Opin 2006;22(5):907–918 — supplementary/online appendix",
        locator:
          "Appendix accompanying the model Y = α + β1AGE + β2AGE² + β3BMI + β4FSH + β5FOLL_LT11 + β6DOSE",
        blocks:
          "The main article prints the model form and predictor ranking only. Without the numeric coefficients no dose can be computed and none may be reconstructed.",
      },
      {
        item: "Validated score-to-dose crosswalk and the rounding/band rule to the 37.5 IU increments (floor and ceiling)",
        kind: "table",
        source:
          "CONSORT dose calculator source documentation (Merck Serono user manual / investigator brochure) or the Howles 2006 appendix",
        locator: "Dose crosswalk table",
        blocks:
          "Even with coefficients, the model output cannot be translated into a permitted starting dose without the published crosswalk.",
      },
      {
        item: "Explicit definition and validation of FOLL_LT11, and whether a general antral follicle count may substitute for it",
        kind: "text",
        source: "Howles 2006 Methods; Olivennes 2015 RCT (AFC defined as 2 to < 11 mm)",
        blocks:
          "AFC is not substituted into the equation unless a source validates the substitution; AMH is never substituted.",
      },
      {
        item: "Stated validation population, dose ceiling/floor and exclusion criteria printed with the algorithm",
        kind: "text",
        source: "Howles 2006 / Olivennes CONSORT publications — Methods",
        blocks:
          "Needed to bound the calculator and warn when a patient sits outside the validated population (< 35 years, normo-ovulatory).",
      },
    ],
  },

  {
    engineId: "protocol-recommendation",
    name: "Protocol Selection Engine",
    route: "/protocols",
    implemented:
      "Protocol evidence framework, patient-context import, POSEIDON/Bologna/previous-response integration, population-match descriptors, protocol comparison, caution register, physician decision log and report integration are complete. Only the published selection rules are absent — the engine performs evidence review, never recommendation.",
    activation:
      "src/lib/engine/protocol-recommendation.ts — add the transcribed recommendation rules; set registry implementation to 'implemented'.",
    requirements: [
      {
        item: "ESHRE recommendation tables for protocol selection (GnRH antagonist vs long agonist vs short agonist, mild stimulation, duostim)",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2019/2020)",
        locator: "Recommendation tables in the ovarian stimulation protocol chapters",
        blocks: "No published rule exists in the app to map a phenotype to a protocol.",
      },
      {
        item: "Evidence grades and strength-of-recommendation labels attached to each statement",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI",
        blocks:
          "Every displayed recommendation must carry its published grade; grades cannot be assigned by the app.",
      },
      {
        item: "Patient-subgroup qualifiers printed with the recommendations (predicted poor, normal and hyper responders; PCOS; previous OHSS)",
        kind: "text",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI",
        blocks: "Determines which recommendation applies to which phenotype output.",
      },
    ],
  },
  {
    engineId: "gonadotropin-selection",
    name: "Gonadotropin Selection Engine",
    route: "/gonadotropins",
    implemented:
      "Medication class database, comparison table and previous-cycle review are complete.",
    activation:
      "src/lib/engine/gonadotropin-selection.ts — add the transcribed selection statements; set registry implementation to 'implemented'.",
    requirements: [
      {
        item: "ESHRE/ASRM recommendation tables for rFSH, hMG/HP-hMG, urinary FSH, rLH supplementation and combination therapy",
        kind: "recommendation",
        source:
          "ESHRE Ovarian Stimulation Guideline and/or ASRM committee opinion on gonadotropin preparations",
        blocks: "The engine has no published basis to prefer one preparation over another.",
      },
      {
        item: "Evidence grades for each preparation statement",
        kind: "recommendation",
        source: "Same guideline documents",
        blocks: "Required to display recommendation strength alongside each option.",
      },
      {
        item: "Stated indications for rLH supplementation (age, hypogonadotropic hypogonadism, previous suboptimal response)",
        kind: "text",
        source:
          "ESHRE Ovarian Stimulation Guideline; Behre et al. RBMO 2015 covers timing only, not selection",
        blocks:
          "The indexed r-hLH RCT addresses supplementation timing, not who should receive LH activity.",
      },
    ],
  },
  {
    engineId: "ohss-risk",
    name: "OHSS Risk Engine",
    route: "/cycle-completion",

    implemented: "Risk-factor capture and display surface are complete.",
    activation:
      "src/lib/engine/ovarian-response.ts / a new ohss-risk module — add the transcribed thresholds; set registry implementation to 'implemented'.",
    requirements: [
      {
        item: "Published OHSS risk-threshold table (AMH, AFC, oestradiol, follicle-count cut-offs defining low / moderate / high risk)",
        kind: "table",
        source:
          "ASRM Practice Committee: Prevention and treatment of moderate and severe OHSS (2016)",
        blocks: "The app must not choose its own cut-offs for a safety-critical risk category.",
      },
      {
        item: "Prevention strategy recommendation statements with evidence grades (agonist trigger, freeze-all, cabergoline, coasting)",
        kind: "recommendation",
        source: "ASRM 2016 OHSS prevention; ESHRE Ovarian Stimulation Guideline",
        blocks: "Needed before any prevention option can be surfaced.",
      },
    ],
  },
  {
    engineId: "dose-adjustment",
    name: "Dynamic Monitoring & Dose Adjustment Engine",
    route: "/monitoring",
    implemented:
      "Longitudinal visit entry (day 1 to trigger and beyond day 14), individual follicle trajectories from physician-supplied identifiers, dose timeline, per-visit completeness, data validation, descriptive trends, expected-vs-observed comparison, previous-cycle comparison, physician decision layer with full audit trail and report integration are complete. Only the adjustment rules are absent.",
    activation:
      "src/lib/engine/dose-adjustment.ts — transcribe each rule into doseAdjustmentRules and set activationStatus to 'ACTIVE'; the engine then stops returning DOSE ADJUSTMENT ALGORITHM PENDING.",

    requirements: [
      {
        item: "Published in-cycle dose adjustment rules (follicle growth and oestradiol criteria, permitted increment/decrement, day of review)",
        kind: "recommendation",
        source: "ESHRE Ovarian Stimulation Guideline — monitoring chapter",
        blocks: "No validated adjustment step size or trigger criterion is available.",
      },
      {
        item: "Numeric threshold and comparison operator for every adjustment rule, with the population, protocol, gonadotropin and stimulation day it applies to",
        kind: "table",
        source: "ESHRE / ASRM / POSEIDON adjustment tables",
        blocks:
          "A rule cannot activate without threshold, operator, action, dose change, maximum change, minimum dose, maximum dose, evidence level and source citation.",
      },
      {
        item: "Stated minimum and maximum permitted daily dose and maximum permitted single-step change per gonadotropin",
        kind: "table",
        source: "ESHRE Ovarian Stimulation Guideline; product labelling cited by the guideline",
        blocks: "Dose bounds are required before any evidence-derived dose can be displayed.",
      },
    ],
  },
  {
    engineId: "trigger-recommendation",
    name: "Trigger Recommendation Engine (Cycle Completion & Safety)",
    route: "/cycle-completion",
    implemented:
      "Cycle Completion & Safety page is complete: safety dashboard, trigger readiness variables, timeline, charts, informational alerts and report. Only the trigger criteria are absent.",
    activation:
      "src/lib/engine/cycle-completion.ts — add the transcribed trigger criteria; set the registry entry 'trigger-recommendation' to 'implemented'.",
    requirements: [
      {
        item: "Recommendation table for hCG, GnRH agonist and dual trigger with the patient criteria for each",
        kind: "recommendation",
        source: "ESHRE Ovarian Stimulation Guideline — trigger chapter",
        blocks: "Trigger choice is protocol- and risk-dependent and cannot be inferred.",
      },
      {
        item: "Stated trigger timing criteria (lead follicle diameter, number of follicles at threshold)",
        kind: "text",
        source: "ESHRE Ovarian Stimulation Guideline",
        blocks: "No numeric timing criterion is present in the uploaded evidence.",
      },
    ],
  },
  {
    engineId: "freeze-all",
    name: "Freeze-All Decision Engine (Cycle Completion & Safety)",
    route: "/cycle-completion",
    implemented:
      "Freeze-all data surface, supporting and missing variables, and report integration are complete. Only the indications and progesterone threshold table are absent.",
    activation:
      "src/lib/engine/cycle-completion.ts — add the transcribed freeze-all indications; set the registry entry 'freeze-all' to 'implemented'.",
    requirements: [
      {
        item: "Recommendation statements on elective cryopreservation with evidence grades",
        kind: "recommendation",
        source: "ESHRE/ASRM guidance on freeze-all and segmentation",
        blocks: "No source in the uploaded bundle addresses elective freeze-all.",
      },
    ],
  },
  {
    engineId: "luteal-support",
    name: "Luteal Support Engine",
    implemented: "Placeholder surface and dependencies registered.",
    activation: "New luteal support module consumed by the report generator.",
    requirements: [
      {
        item: "Luteal phase support recommendation table (route, dose, start day, duration) with evidence grades",
        kind: "table",
        source: "ESHRE Ovarian Stimulation Guideline — luteal phase support chapter",
        blocks: "Route and duration cannot be selected without the published table.",
      },
    ],
  },
];

export const totalRequirementCount = blockedModules.reduce(
  (sum, m) => sum + m.requirements.length,
  0,
);

/** Plain-text request list the physician can send to whoever supplies the source documents. */
export function requirementsRequestText(): string {
  const lines: string[] = [
    "Evidence required to activate blocked clinical modules — IVF Ai Calc",
    `Primary source of truth: ${EVIDENCE_SOURCE_OF_TRUTH}`,
    "",
  ];
  for (const m of blockedModules) {
    lines.push(`• ${m.name}${m.route ? ` (${m.route})` : ""}`);
    for (const r of m.requirements) {
      lines.push(`  - Required: ${r.item}`);
      lines.push(`    Source: ${r.source}${r.locator ? ` — ${r.locator}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
