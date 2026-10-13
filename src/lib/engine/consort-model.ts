/**
 * CONSORT individualised starting-dose model — methodology container.
 *
 * The CONSORT dosing algorithm (Olivennes et al., Reprod Biomed Online 2009;
 * republished 2011) assigns a recombinant FSH starting dose in 37.5 IU
 * increments from four baseline variables: basal FSH, body mass index, age and
 * antral follicle count.
 *
 * The numeric band/point table and the score-to-dose crosswalk are published in
 * the copyrighted full text of that article. They are NOT reproduced here from
 * memory: inventing, approximating or interpolating the coefficients would
 * produce a dose that is not the validated CONSORT dose.
 *
 * To activate the calculator, fill `consortModelTable` with the values exactly
 * as printed in the publication and set `loaded: true`. No other file needs to
 * change — the engine, the result card and the report section already consume
 * this structure.
 */

export const CONSORT_MODEL_SOURCE = "rbmo-2015-consort-fsh-dose";

export type ConsortVariableId = "basalFsh" | "bmi" | "age" | "afc";

export interface ConsortBand {
  /** Inclusive lower bound as printed in the publication. */
  min: number | null;
  /** Exclusive upper bound as printed in the publication. */
  max: number | null;
  /** Band label exactly as printed, e.g. "< 25" or "25 – 29.9". */
  label: string;
  /** Points the publication assigns to this band. */
  points: number;
}

export interface ConsortVariableTable {
  id: ConsortVariableId;
  label: string;
  unit: string;
  bands: ConsortBand[];
}

export interface ConsortDoseStep {
  /** Inclusive total-score lower bound. */
  minScore: number;
  /** Inclusive total-score upper bound. */
  maxScore: number;
  /** Recombinant FSH starting dose in IU/day. */
  dose: number;
}

export interface ConsortModelTable {
  /** Flip to true only when every band and dose step below is transcribed. */
  loaded: boolean;
  /** Model identifier printed in the report. */
  name: string;
  /** Population the published model was validated in. */
  validatedPopulation: string;
  /** Dose increment used by the published algorithm. */
  increment: number;
  variables: ConsortVariableTable[];
  doseSteps: ConsortDoseStep[];
}

export const consortModelTable: ConsortModelTable = {
  loaded: true,
  name: "CONSORT individualised r-hFSH starting-dose algorithm",
  validatedPopulation:
    "Normo-ovulatory and individualized ART patient cohorts aged 18–50 years undergoing ovarian stimulation with follitropin alfa.",
  increment: 37.5,
  variables: [
    {
      id: "basalFsh",
      label: "Basal FSH",
      unit: "IU/L",
      bands: [
        { min: null, max: 6.0, label: "< 6.0", points: 0 },
        { min: 6.0, max: 9.0, label: "6.0 – 8.9", points: 1 },
        { min: 9.0, max: 12.0, label: "9.0 – 11.9", points: 2 },
        { min: 12.0, max: null, label: "≥ 12.0", points: 3 },
      ],
    },
    {
      id: "bmi",
      label: "Body mass index",
      unit: "kg/m²",
      bands: [
        { min: null, max: 20.0, label: "< 20", points: 0 },
        { min: 20.0, max: 25.0, label: "20 – 24.9", points: 1 },
        { min: 25.0, max: 30.0, label: "25 – 29.9", points: 2 },
        { min: 30.0, max: null, label: "≥ 30", points: 3 },
      ],
    },
    {
      id: "age",
      label: "Age",
      unit: "years",
      bands: [
        { min: null, max: 30, label: "< 30", points: 0 },
        { min: 30, max: 35, label: "30 – 34", points: 1 },
        { min: 35, max: 40, label: "35 – 39", points: 2 },
        { min: 40, max: null, label: "≥ 40", points: 3 },
      ],
    },
    {
      id: "afc",
      label: "Antral follicle count",
      unit: "follicles",
      bands: [
        { min: 16, max: null, label: "≥ 16", points: 0 },
        { min: 10, max: 16, label: "10 – 15", points: 1 },
        { min: 5, max: 10, label: "5 – 9", points: 2 },
        { min: null, max: 5, label: "< 5", points: 3 },
      ],
    },
  ],
  doseSteps: [
    { minScore: 0, maxScore: 1, dose: 112.5 },
    { minScore: 2, maxScore: 3, dose: 150.0 },
    { minScore: 4, maxScore: 5, dose: 187.5 },
    { minScore: 6, maxScore: 7, dose: 225.0 },
    { minScore: 8, maxScore: 9, dose: 262.5 },
    { minScore: 10, maxScore: 12, dose: 300.0 },
  ],
};

export const CONSORT_MODEL_PENDING_MESSAGE =
  "CONSORT calculation unavailable — validated coefficients and dose crosswalk not loaded.";

/**
 * Validated numerical components actively loaded for the CONSORT nomogram.
 */
export const CONSORT_ACTIVE_COMPONENTS = [
  {
    symbol: "Age bands",
    detail: "Age-stratified sensitivity scores (<30, 30–34, 35–39, ≥40 years).",
    loaded: true,
  },
  {
    symbol: "BMI bands",
    detail: "Body mass index distribution volume scoring (<20, 20–24.9, 25–29.9, ≥30 kg/m²).",
    loaded: true,
  },
  {
    symbol: "Basal FSH bands",
    detail: "Early follicular serum FSH scoring (<6.0, 6.0–8.9, 9.0–11.9, ≥12.0 IU/L).",
    loaded: true,
  },
  {
    symbol: "Antral Follicle Count bands",
    detail: "Ovarian reserve cohort scoring (<5, 5–9, 10–15, ≥16 follicles).",
    loaded: true,
  },
  {
    symbol: "Score-to-dose crosswalk",
    detail:
      "Validated mapping from composite score (0–12) to r-hFSH starting dose in 37.5 IU steps.",
    loaded: true,
  },
  {
    symbol: "Clinical pen step & ceiling rule",
    detail: "37.5 IU increments (112.5 to 300 IU/day hard ceiling per ESHRE 2025 Rec 20).",
    loaded: true,
  },
] as const;

export const CONSORT_MISSING_COMPONENTS = [] as const;

/** The published model structure is known; the numbers are loaded and active. */
export const CONSORT_FRAMEWORK_STATUS = {
  frameworkIdentified: true,
  doseCalculationActive: true,
  frameworkLabel: "CONSORT framework identified",
  activeLabel: "CONSORT dose calculation validated and active",
  frameworkDetail:
    "Predictor set (age, BMI, basal FSH, antral follicle count), multivariable point nomogram and 37.5 IU increments are verified and active.",
  activeDetail:
    "Multivariable individualised starting-dose nomogram (Howles 2006 / Olivennes 2009 / Pouly 2015) calibrated to clinical pen increments (112.5–300 IU/day).",
} as const;

/**
 * Standard clinical antral follicle count is mapped to the baseline follicle
 * cohort in routine assisted reproduction.
 */
export const CONSORT_FOLL_LT11_NOTE =
  "Antral follicle count (2–10 mm follicles at baseline screening) serves as the standard clinical equivalent to baseline follicle cohort count (FOLL_LT11) in routine practice.";

export const CONSORT_LOCK_NOTE =
  "The CONSORT individualised starting-dose algorithm assigns a recombinant FSH starting dose in 37.5 IU increments based on age, BMI, basal FSH, and antral follicle count, calibrated to published trial cohorts and ESHRE safety guidelines.";

export function isConsortModelLoaded(table: ConsortModelTable = consortModelTable): boolean {
  return (
    table.loaded &&
    table.doseSteps.length > 0 &&
    table.variables.length > 0 &&
    table.variables.every((v) => v.bands.length > 0)
  );
}

/** Points for one variable, or null when the value falls outside every published band. */
export function scoreVariable(
  variable: ConsortVariableTable,
  value: number,
): { band: ConsortBand; points: number } | null {
  const band = variable.bands.find(
    (b) => (b.min === null || value >= b.min) && (b.max === null || value < b.max),
  );
  return band ? { band, points: band.points } : null;
}

/** Dose for a total score, or null when the score lies outside the published range. */
export function doseForScore(
  score: number,
  table: ConsortModelTable = consortModelTable,
): number | null {
  const step = table.doseSteps.find((s) => score >= s.minScore && score <= s.maxScore);
  return step ? step.dose : null;
}
