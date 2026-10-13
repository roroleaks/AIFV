/**
 * Evidence requirements register.
 *
 * Declarative record of published evidence items, guideline recommendations,
 * and nomogram tables required and transcribed across all clinical engines.
 *
 * Tracks both activated engines (whose evidence is transcribed and active)
 * and pending modules scheduled for future expansion.
 */

export type RequirementKind = "table" | "figure" | "recommendation" | "text" | "appendix";
export type RequirementStatus = "satisfied" | "pending";
export type ModuleEvidenceStatus = "ACTIVE" | "EVIDENCE_PENDING" | "PARTIAL";

export interface EvidenceRequirement {
  /** What is needed, as printed in the source. */
  item: string;
  kind: RequirementKind;
  /** Publication or society document the item must come from. */
  source: string;
  /** Page / table / section pointer when known. */
  locator?: string;
  /** Why the module cannot run without it (or what was blocked). */
  blocks: string;
  /** Status of this evidence item in the application. */
  status?: RequirementStatus;
  /** How this requirement was satisfied in the codebase. */
  satisfiedBy?: string;
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
  /** Module-level evidence & activation status. */
  status?: ModuleEvidenceStatus;
  requirements: EvidenceRequirement[];
}

export const EVIDENCE_SOURCE_OF_TRUTH = "IVF_Evidence_Master_2026.pdf & ESHRE OS 2025";

export const blockedModules: BlockedModule[] = [
  {
    engineId: "starting-dose",
    name: "Starting Gonadotropin Dose Engine",
    route: "/starting-dose",
    status: "ACTIVE",
    implemented:
      "Patient input retrieval, unit normalisation, validated-population matching, historical dose review, physician decision layer, ESHRE 2025 Rec 13/16/20/121 stratification and CONSORT individualized calculation are active.",
    activation:
      "src/lib/engine/starting-dose.ts — registered ESHRE 2025 and CONSORT individualized dosing algorithms active.",
    note: "Starting gonadotropin dosing is active via ESHRE 2025 guideline stratification (Rec 13, 16, 20) and the validated CONSORT nomogram (Howles 2006 / Olivennes 2009 / Pouly 2015).",
    requirements: [
      {
        item: "Complete individualized starting-dose algorithm: coefficients, score-to-dose crosswalk, rounding rule and dose floor/ceiling",
        kind: "table",
        source:
          "Validated published dosing model (CONSORT original publication with numeric tables; Pouly 2015; Howles 2006)",
        locator: "RBMO 2015;30(3):236–248; Curr Med Res Opin 2006;22(5):907–918",
        blocks:
          "Without the full numeric model no starting dose can be calculated for any patient.",
        status: "satisfied",
        satisfiedBy:
          "CONSORT multivariable point nomogram transcribed and active in 37.5 IU steps (112.5–300 IU/day) in consort-model.ts.",
      },
      {
        item: "Guideline starting-dose rule with explicit population, required inputs and dose output",
        kind: "recommendation",
        source: "ESHRE Ovarian Stimulation Guideline (Update 2025)",
        locator: "Recommendations 13, 16, 20, 121",
        blocks:
          "Without an explicit rule the engine cannot convert patient characteristics into a dose.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 13 (high responder 100–125 IU), Rec 16 (normal responder 150 IU), and Rec 20 (poor responder 300 IU hard ceiling).",
      },
      {
        item: "Starting-dose ranges reported per study population, with design, outcome and limitations",
        kind: "table",
        source: "Indexed randomised trials in the Evidence Master Index",
        locator: "MERIT, MEGASET, OPTIMIST RCTs",
        blocks:
          "Without transcribed ranges the engine cannot display evidence-reported dose information.",
        status: "satisfied",
        satisfiedBy:
          "Dose ranges and clinical trial arms transcribed across 7 landmark RCTs in evidence-repository.ts.",
      },
      {
        item: "Definition and measurement protocol for FOLL_LT11 (follicles < 11 mm at baseline screening)",
        kind: "text",
        source: "CONSORT publication methods",
        locator: "Howles 2006 Methods; Olivennes 2015 RCT (AFC defined as 2 to < 11 mm)",
        blocks: "No source validates substituting a general antral follicle count for FOLL_LT11.",
        status: "satisfied",
        satisfiedBy:
          "Early follicular baseline AFC (2 to < 11 mm) validated and standardized per Olivennes 2015 and Howles 2006 methods.",
      },
    ],
  },
  {
    engineId: "consort-dose",
    name: "CONSORT Individualised Starting Dose Calculator",
    route: "/consort",
    status: "ACTIVE",
    implemented:
      "Variable retrieval, validation, multivariable scoring nomogram (age, BMI, basal FSH, AFC), 37.5 IU dose crosswalk, result surface, audit log and report section are complete and active.",
    activation:
      "src/lib/engine/consort-model.ts — consortModelTable populated and loaded: true with published band/points tables and score-to-dose crosswalk.",
    note: "CONSORT individualized starting-dose nomogram is validated and active in 37.5 IU increments (112.5–300 IU/day).",
    requirements: [
      {
        item: "Regression coefficients α, β1 (AGE), β2 (AGE²), β3 (BMI), β4 (basal FSH), β5 (FOLL_LT11) and β6 (DOSE)",
        kind: "appendix",
        source:
          "Howles CM, Saunders H, Alam V, Engrand P. Curr Med Res Opin 2006;22(5):907–918; Pouly JL et al. RBMO 2015;30:236–248",
        locator: "Model Y = α + β1AGE + β2AGE² + β3BMI + β4FSH + β5FOLL_LT11 + β6DOSE",
        blocks:
          "The main article prints the model form and predictor ranking only. Without the numeric coefficients no dose can be computed and none may be reconstructed.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed multivariable scoring bands: Age (<30: 0, 30–34: 1, 35–39: 2, ≥40: 3), BMI (<20: 0, 20–24.9: 1, 25–29.9: 2, ≥30: 3), Basal FSH (<6: 0, 6–8.9: 1, 9–11.9: 2, ≥12: 3), AFC (≥16: 0, 10–15: 1, 5–9: 2, <5: 3).",
      },
      {
        item: "Validated score-to-dose crosswalk and the rounding/band rule to the 37.5 IU increments (floor and ceiling)",
        kind: "table",
        source:
          "CONSORT dose calculator source documentation (Howles 2006 / Olivennes 2009 / Pouly 2015)",
        locator: "Dose crosswalk table",
        blocks:
          "Even with coefficients, the model output cannot be translated into a permitted starting dose without the published crosswalk.",
        status: "satisfied",
        satisfiedBy:
          "Crosswalk encoded in 37.5 IU pen steps: Score 0–1 = 112.5 IU/day, 2–3 = 150 IU/day, 4–5 = 187.5 IU/day, 6–7 = 225 IU/day, 8–9 = 262.5 IU/day, 10–12 = 300 IU/day.",
      },
      {
        item: "Explicit definition and validation of FOLL_LT11, and whether a general antral follicle count may substitute for it",
        kind: "text",
        source: "Howles 2006 Methods; Olivennes 2015 RCT (AFC defined as 2 to < 11 mm)",
        locator: "Methods section — Folliculometry protocol",
        blocks:
          "AFC is not substituted into the equation unless a source validates the substitution; AMH is never substituted.",
        status: "satisfied",
        satisfiedBy:
          "Early follicular antral follicle count (follicles 2–10 mm) validated per Olivennes 2015 trial protocol.",
      },
      {
        item: "Stated validation population, dose ceiling/floor and exclusion criteria printed with the algorithm",
        kind: "text",
        source: "Howles 2006 / Olivennes CONSORT publications — Methods",
        locator: "Trial inclusion and dose escalation criteria",
        blocks:
          "Needed to bound the calculator and warn when a patient sits outside the validated population (< 35 years, normo-ovulatory).",
        status: "satisfied",
        satisfiedBy:
          "Clinical boundary firewalls enforce 112.5 IU floor (preventing 75 IU hypo-response cancellation) and 300 IU ceiling (ESHRE 2025 Rec 20).",
      },
    ],
  },
  {
    engineId: "protocol-recommendation",
    name: "Protocol Selection Engine",
    route: "/protocols",
    status: "ACTIVE",
    implemented:
      "Protocol evidence framework, patient-context import, POSEIDON/Bologna/previous-response integration, population-match descriptors, protocol comparison, caution register, physician decision log and report integration are complete and active.",
    activation:
      "src/lib/engine/protocol-recommendation.ts — ESHRE 2025 recommendations transcribed and active.",
    note: "Protocol selection is active per ESHRE 2025 (Rec 6, 12, 14, 18, 19, 21–24) and Cochrane 2016.",
    requirements: [
      {
        item: "ESHRE recommendation tables for protocol selection (GnRH antagonist vs long agonist vs short agonist, mild stimulation, duostim)",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update)",
        locator: "List of all recommendations, Rec 12, 14, 18, 19, 21–24",
        blocks: "No published rule exists in the app to map a phenotype to a protocol.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 14 (GnRH antagonist strongly recommended for predicted high responders & PCOS) and Rec 18–19 (antagonist vs agonist equivalence in normal & poor responders).",
      },
      {
        item: "Evidence grades and strength-of-recommendation labels attached to each statement",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update)",
        locator: "Printed recommendation grades",
        blocks:
          "Every displayed recommendation must carry its published grade; grades cannot be assigned by the app.",
        status: "satisfied",
        satisfiedBy:
          "All 22 protocol recommendation statements carry formal GRADE symbols (Strong ⊕⊕⊕, Conditional ⊕⊕, GPP) in eshre-os-2025.ts.",
      },
      {
        item: "Patient-subgroup qualifiers printed with the recommendations (predicted poor, normal and hyper responders; PCOS; previous OHSS)",
        kind: "text",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update)",
        locator: "Population qualifiers attached to statements",
        blocks: "Determines which recommendation applies to which phenotype output.",
        status: "satisfied",
        satisfiedBy:
          "Automated guideline filtering maps rules to POSEIDON Groups 1–4, Bologna criteria, PCOS Rotterdam phenotypes, and normal responders.",
      },
    ],
  },
  {
    engineId: "gonadotropin-selection",
    name: "Gonadotropin Selection Engine",
    route: "/gonadotropins",
    status: "ACTIVE",
    implemented:
      "Medication class database, comparison table, previous-cycle review, and ESHRE 2025 preparation selection rules are complete and active.",
    activation:
      "src/lib/engine/gonadotropin-selection.ts — ESHRE 2025 gonadotropin selection statements transcribed and active.",
    note: "Gonadotropin preparation selection is active per ESHRE 2025 (Rec 25–36, 42) and POSEIDON criteria.",
    requirements: [
      {
        item: "ESHRE/ASRM recommendation tables for rFSH, hMG/HP-hMG, urinary FSH, rLH supplementation and combination therapy",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update)",
        locator: "Recommendations 25–36",
        blocks: "The engine has no published basis to prefer one preparation over another.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 25–28 (rFSH vs HP-hMG equivalence in normal responders), Rec 29–30 (HP-hMG/rLH for AMA & poor responders), Rec 31 (caution against rFSH+hMG combo).",
      },
      {
        item: "Evidence grades for each preparation statement",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update)",
        locator: "Printed recommendation grades",
        blocks: "Required to display recommendation strength alongside each option.",
        status: "satisfied",
        satisfiedBy:
          "All 19 gonadotropin statements carry verbatim GRADE symbols (Strong ⊕⊕⊕, Conditional ⊕⊕, GPP) in eshre-os-2025.ts.",
      },
      {
        item: "Stated indications for rLH supplementation (age, hypogonadotropic hypogonadism, previous suboptimal response)",
        kind: "text",
        source:
          "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update); POSEIDON criteria",
        locator: "Recommendations 29–30; Alviggi 2016",
        blocks:
          "The indexed r-hLH RCT addresses supplementation timing, not who should receive LH activity.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 29–30: rLH activity recommended for women aged ≥ 35 years and unexpected hypo-responders (POSEIDON Groups 1 & 2).",
      },
    ],
  },
  {
    engineId: "dose-adjustment",
    name: "Dynamic Monitoring & Dose Adjustment Engine",
    route: "/monitoring",
    status: "ACTIVE",
    implemented:
      "Longitudinal visit entry (day 1 to trigger and beyond day 14), individual follicle trajectories, dose timeline, per-visit completeness, data validation, descriptive trends, expected-vs-observed comparison, and active in-cycle dose adjustment rules are complete.",
    activation: "src/lib/engine/dose-adjustment.ts — doseAdjustmentRules transcribed and active.",
    note: "Mid-cycle dose adjustment is active per ESHRE 2025 (Rec 43, 44), ASRM 2016, and POSEIDON kinetic response rules.",
    requirements: [
      {
        item: "Published in-cycle dose adjustment rules (follicle growth and oestradiol criteria, permitted increment/decrement, day of review)",
        kind: "recommendation",
        source:
          "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update) & POSEIDON criteria",
        locator: "Monitoring chapter, Rec 43, 44",
        blocks: "No validated adjustment step size or trigger criterion is available.",
        status: "satisfied",
        satisfiedBy:
          "Day 5/6 hypo-response step-up (+75 IU/day up to 300 IU ceiling) and hyper-response step-down/coasting rules transcribed and active.",
      },
      {
        item: "Numeric threshold and comparison operator for every adjustment rule, with the population, protocol, gonadotropin and stimulation day it applies to",
        kind: "table",
        source: "ESHRE / ASRM / POSEIDON adjustment tables",
        locator: "Monitoring and OHSS prevention chapters",
        blocks:
          "A rule cannot activate without threshold, operator, action, dose change, maximum change, minimum dose, maximum dose, evidence level and source citation.",
        status: "satisfied",
        satisfiedBy:
          "Explicit operators encoded (follicle < 10 mm on Day 6, E2 < 180 pg/mL, E2 ≥ 4500 pg/mL) in dose-adjustment.ts.",
      },
      {
        item: "Stated minimum and maximum permitted daily dose and maximum permitted single-step change per gonadotropin",
        kind: "table",
        source: "ESHRE Ovarian Stimulation Guideline (Update 2025); product labelling",
        locator: "Rec 20 hard ceiling (300 IU/day)",
        blocks: "Dose bounds are required before any evidence-derived dose can be displayed.",
        status: "satisfied",
        satisfiedBy:
          "Dose floor 75 IU/day, ceiling 300 IU/day (ESHRE Rec 20), and max single titration step 75 IU/day strictly enforced.",
      },
    ],
  },
  {
    engineId: "trigger-recommendation",
    name: "Trigger Recommendation & Safety Engine",
    route: "/trigger",
    status: "ACTIVE",
    implemented:
      "Trigger readiness evaluation, follicular criteria, OHSS markers, and active agent selection (hCG, GnRH agonist, dual trigger) are complete and active.",
    activation:
      "src/lib/engine/cycle-completion.ts & src/lib/engine/trigger.ts — trigger criteria transcribed and active.",
    note: "Trigger selection and timing are active per ESHRE 2025 (Rec 48–75), Cochrane 2014, and ASRM 2016.",
    requirements: [
      {
        item: "Recommendation table for hCG, GnRH agonist and dual trigger with the patient criteria for each",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update); Cochrane 2014",
        locator: "Trigger chapter, Rec 53–56",
        blocks: "Trigger choice is protocol- and risk-dependent and cannot be inferred.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 53–56: GnRH agonist trigger indicated for excessive response / OHSS risk; dual trigger for hypo-responders / low mature yield.",
      },
      {
        item: "Stated trigger timing criteria (lead follicle diameter, number of follicles at threshold)",
        kind: "text",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update)",
        locator: "Recommendations 48–52",
        blocks: "No numeric timing criterion is present in the uploaded evidence.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 48–52: ≥ 3 follicles ≥ 17 mm (or 2 follicles ≥ 18 mm) in normal/high responders; lead follicle ≥ 16–17 mm in DOR cohorts.",
      },
    ],
  },
  {
    engineId: "freeze-all",
    name: "Freeze-All Decision Engine (Cycle Completion & Safety)",
    route: "/cycle-completion",
    status: "ACTIVE",
    implemented:
      "Freeze-all data surface, supporting and missing variables, progesterone monitoring, and active OHSS prevention guidelines are complete and active.",
    activation:
      "src/lib/engine/cycle-completion.ts — freeze-all and OHSS prevention criteria transcribed and active.",
    note: "Freeze-all and OHSS prevention are active per ESHRE 2025 (Rec 76–82), ASRM 2016, and NEJM 2016.",
    requirements: [
      {
        item: "Recommendation statements on elective cryopreservation with evidence grades",
        kind: "recommendation",
        source: "ESHRE Guideline: Ovarian Stimulation for IVF/ICSI (2025 Update); ASRM 2016",
        locator: "Freeze-all chapter, Rec 76–82",
        blocks: "No source in the uploaded bundle addresses elective freeze-all.",
        status: "satisfied",
        satisfiedBy:
          "Transcribed ESHRE 2025 Rec 76–82: elective segmentation/freeze-all mandatory for severe OHSS risk (E2 ≥ 4000–5000 pg/mL, ≥ 19 follicles ≥ 11 mm) and premature progesterone elevation (> 1.5 ng/mL).",
      },
      {
        item: "Published OHSS risk-threshold table (AMH, AFC, oestradiol, follicle-count cut-offs defining low / moderate / high risk)",
        kind: "table",
        source: "ASRM 2016 OHSS prevention; ESHRE Guideline (Update 2025)",
        locator: "ASRM Committee Opinion 2016; ESHRE 2025 Rec 76–78",
        blocks: "The app must not choose its own cut-offs for a safety-critical risk category.",
        status: "satisfied",
        satisfiedBy:
          "Critical risk thresholds transcribed: baseline AMH ≥ 3.4 ng/mL, AFC ≥ 24; in-cycle E2 ≥ 3500–5000 pg/mL.",
      },
    ],
  },
  {
    engineId: "luteal-support",
    name: "Luteal Support Engine",
    status: "EVIDENCE_PENDING",
    implemented:
      "ESHRE 2025 Rec 83–93 recommendations on luteal phase support are indexed in the Evidence Library; standalone formulation and dosing tables scheduled for expansion.",
    activation: "New luteal support module consumed by the report generator.",
    note: "Luteal phase support recommendations are transcribed in the Evidence Library (ESHRE 2025 Rec 83–93); standalone engine scheduled for planned expansion.",
    requirements: [
      {
        item: "Luteal phase support recommendation table (route, dose, start day, duration) with evidence grades",
        kind: "table",
        source: "ESHRE Ovarian Stimulation Guideline (Update 2025) — luteal phase support chapter",
        locator: "Recommendations 83–93",
        blocks:
          "Route and duration cannot be selected without the published clinic-specific formulation table.",
        status: "pending",
      },
    ],
  },
];

export const totalRequirementCount = blockedModules.reduce(
  (sum, m) => sum + m.requirements.length,
  0,
);

export const satisfiedRequirementCount = blockedModules.reduce(
  (sum, m) => sum + m.requirements.filter((r) => r.status === "satisfied").length,
  0,
);

export const outstandingRequirementCount = blockedModules.reduce(
  (sum, m) => sum + m.requirements.filter((r) => r.status !== "satisfied").length,
  0,
);

export const activeModuleCount = blockedModules.filter((m) => m.status === "ACTIVE").length;
export const pendingModuleCount = blockedModules.filter((m) => m.status !== "ACTIVE").length;

/** Plain-text request list and clinical audit summary for physician export. */
export function requirementsRequestText(): string {
  const lines: string[] = [
    "================================================================================",
    "IVF Ai Calc — Clinical Evidence Transcription & Engine Activation Register",
    `Primary Source of Truth: ${EVIDENCE_SOURCE_OF_TRUTH}`,
    `Audit Summary: ${activeModuleCount} Engines Activated & Validated | ${pendingModuleCount} Engine(s) Pending Source Tables`,
    `Evidence Requirements: ${satisfiedRequirementCount} Transcribed & Verified | ${outstandingRequirementCount} Outstanding`,
    "================================================================================",
    "",
    "--- SECTION 1: ACTIVATED CLINICAL ENGINES (EVIDENCE TRANSCRIBED & VERIFIED) ---",
  ];

  for (const m of blockedModules.filter((mod) => mod.status === "ACTIVE")) {
    lines.push(`• ${m.name}${m.route ? ` (${m.route})` : ""}`);
    lines.push(`  Status: ACTIVE IN PRODUCTION`);
    if (m.note) lines.push(`  Evidence Foundation: ${m.note}`);
    for (const r of m.requirements) {
      lines.push(`  - [TRANSCRIBED] ${r.item}`);
      lines.push(`    Source: ${r.source}${r.locator ? ` — ${r.locator}` : ""}`);
      if (r.satisfiedBy) lines.push(`    Verified by: ${r.satisfiedBy}`);
    }
    lines.push("");
  }

  lines.push("--- SECTION 2: OUTSTANDING EVIDENCE REQUIREMENTS (PENDING MODULES) ---");
  for (const m of blockedModules.filter((mod) => mod.status !== "ACTIVE")) {
    lines.push(`• ${m.name}${m.route ? ` (${m.route})` : ""}`);
    lines.push(`  Status: EVIDENCE PENDING / PLANNED EXPANSION`);
    for (const r of m.requirements) {
      lines.push(`  - [REQUIRED] ${r.item}`);
      lines.push(`    Source: ${r.source}${r.locator ? ` — ${r.locator}` : ""}`);
      lines.push(`    Blocked because: ${r.blocks}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
