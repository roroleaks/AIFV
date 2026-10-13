/**
 * Gonadotropin reference database — descriptive only.
 *
 * Entries describe the pharmacological class and the documented practical
 * characteristics of each preparation. `indications`, `contraindications`,
 * `clinicalUse` and `clinicalNotes` stay empty until validated ESHRE / ASRM
 * statements are extracted. No medication is recommended and no dose is
 * stored anywhere in this file.
 */

export type GonadotropinId =
  | "recombinant-fsh"
  | "urinary-fsh"
  | "hp-hmg"
  | "recombinant-lh"
  | "fsh-lh-combination";

export type GonadotropinType =
  | "Recombinant FSH"
  | "Urinary FSH"
  | "Human menopausal gonadotropin"
  | "Recombinant LH"
  | "Fixed FSH + LH combination";

export type AvailabilityStatus = "widely-available" | "region-dependent";

export const availabilityLabel: Record<AvailabilityStatus, string> = {
  "widely-available": "Widely available",
  "region-dependent": "Region dependent",
};

export interface GonadotropinEntry {
  id: GonadotropinId;
  name: string;
  type: GonadotropinType;
  route: string;
  mechanism: string;
  /** Reserved — populated only from validated guidance. */
  indications: string[];
  /** Reserved — populated only from validated guidance. */
  contraindications: string[];
  /** Reserved — populated only from validated guidance. */
  clinicalUse: string | null;
  advantages: string[];
  limitations: string[];
  /** Reserved — physician / guideline commentary added later. */
  clinicalNotes: string | null;
  availability: AvailabilityStatus;
  /** Evidence entry ids from the indexed library. */
  evidence: string[];
}

export const gonadotropinDatabase: GonadotropinEntry[] = [
  {
    id: "recombinant-fsh",
    name: "Recombinant FSH",
    type: "Recombinant FSH",
    route: "Subcutaneous injection",
    mechanism:
      "Recombinant follicle stimulating hormone acting on granulosa cell FSH receptors to support multifollicular growth.",
    indications: [],
    contraindications: [],
    clinicalUse: null,
    advantages: ["Consistent batch-to-batch composition.", "No LH activity in the preparation."],
    limitations: ["Contains no LH activity where LH activity is considered relevant."],
    clinicalNotes: null,
    availability: "widely-available",
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "urinary-fsh",
    name: "Urinary FSH (purified / highly purified)",
    type: "Urinary FSH",
    route: "Subcutaneous or intramuscular injection",
    mechanism: "Urine-derived follicle stimulating hormone acting on granulosa cell FSH receptors.",
    indications: [],
    contraindications: [],
    clinicalUse: null,
    advantages: ["Long-standing clinical use."],
    limitations: ["Urine-derived source with batch variability."],
    clinicalNotes: null,
    availability: "region-dependent",
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "hp-hmg",
    name: "Highly purified hMG",
    type: "Human menopausal gonadotropin",
    route: "Subcutaneous injection",
    mechanism:
      "Menotropin preparation providing FSH activity together with LH activity (largely hCG-driven).",
    indications: [],
    contraindications: [],
    clinicalUse: null,
    advantages: ["Provides both FSH and LH activity in a single preparation."],
    limitations: ["Fixed activity ratio; FSH and LH cannot be titrated separately."],
    clinicalNotes: null,
    availability: "widely-available",
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "recombinant-lh",
    name: "Recombinant LH",
    type: "Recombinant LH",
    route: "Subcutaneous injection",
    mechanism:
      "Recombinant luteinising hormone acting on theca cell LH receptors, used as an addition to FSH stimulation.",
    indications: [],
    contraindications: [],
    clinicalUse: null,
    advantages: ["LH activity can be titrated independently of FSH."],
    limitations: ["Requires a second injection or pen alongside FSH."],
    clinicalNotes: null,
    availability: "region-dependent",
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "fsh-lh-combination",
    name: "FSH + LH combination (fixed 2:1)",
    type: "Fixed FSH + LH combination",
    route: "Subcutaneous injection",
    mechanism:
      "Single preparation combining recombinant FSH and recombinant LH in a fixed activity ratio.",
    indications: [],
    contraindications: [],
    clinicalUse: null,
    advantages: ["Single daily injection delivering both FSH and LH activity."],
    limitations: ["Fixed ratio; the LH component cannot be adjusted separately."],
    clinicalNotes: null,
    availability: "region-dependent",
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
];

export const findGonadotropin = (id: string) => gonadotropinDatabase.find((g) => g.id === id);
