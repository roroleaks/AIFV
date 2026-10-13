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
  loaded: false,
  name: "CONSORT individualised r-hFSH starting-dose algorithm",
  validatedPopulation:
    "Normo-ovulatory women aged 18–34 years undergoing assisted reproduction (CONSORT pilot study population).",
  increment: 37.5,
  variables: [
    { id: "basalFsh", label: "Basal FSH", unit: "IU/L", bands: [] },
    { id: "bmi", label: "Body mass index", unit: "kg/m²", bands: [] },
    { id: "age", label: "Age", unit: "years", bands: [] },
    { id: "afc", label: "Antral follicle count", unit: "follicles", bands: [] },
  ],
  doseSteps: [],
};

export const CONSORT_MODEL_PENDING_MESSAGE =
  "CONSORT calculation unavailable — validated coefficients and dose crosswalk not loaded.";

/**
 * Exact numerical components that are still absent from every source held in
 * the Evidence Library. Nothing here may be reconstructed, estimated,
 * reverse-engineered or read off a calculator screenshot.
 */
export const CONSORT_MISSING_COMPONENTS = [
  { symbol: "α", detail: "Intercept of the published regression model." },
  { symbol: "β1", detail: "Coefficient for AGE." },
  { symbol: "β2", detail: "Coefficient for AGE² (quadratic age term)." },
  { symbol: "β3", detail: "Coefficient for BMI." },
  { symbol: "β4", detail: "Coefficient for basal FSH." },
  { symbol: "β5", detail: "Coefficient for FOLL_LT11 (follicles < 11 mm at screening)." },
  { symbol: "β6", detail: "Coefficient for DOSE — the divisor that inverts the model to a dose." },
  {
    symbol: "Score-to-dose crosswalk",
    detail: "Validated mapping from the model output to the permitted r-hFSH starting doses.",
  },
  {
    symbol: "Rounding / band rule",
    detail:
      "Published rule for rounding the computed dose to the 37.5 IU increments and for the dose floor and ceiling.",
  },
] as const;

/** The published model structure is known; the numbers are not. */
export const CONSORT_FRAMEWORK_STATUS = {
  frameworkIdentified: true,
  doseCalculationActive: false,
  frameworkLabel: "CONSORT framework identified",
  activeLabel: "CONSORT dose calculation validated and active",
  frameworkDetail:
    "Predictor set (age, BMI, basal FSH, follicles < 11 mm), model form and the 37.5 IU increment are verified in the held publications.",
  activeDetail:
    "Requires the original numerical coefficients (α, β1–β6) and the validated score-to-dose crosswalk. Not available in any held source.",
} as const;

/**
 * FOLL_LT11 is the predictor the source validates: follicles < 11 mm at
 * screening. A general antral follicle count is displayed as the closest
 * captured field but is NOT treated as an equivalent substitution.
 */
export const CONSORT_FOLL_LT11_NOTE =
  "The validated predictor is FOLL_LT11 — follicles < 11 mm at baseline screening. The captured antral follicle count is displayed for reference only and is not substituted into the equation, because no held source validates that substitution.";

export const CONSORT_LOCK_NOTE =
  "The original CONSORT publications describe the model structure and predictor set, but the numerical regression coefficients and complete score-to-dose crosswalk required for independent reproduction are not available in the currently held sources. The dose engine therefore remains intentionally locked rather than reconstructed.";

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
