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
    name: "Recombinant FSH (follitropin alfa / beta / delta)",
    type: "Recombinant FSH",
    route: "Subcutaneous injection (multi-dose pen / prefilled syringe)",
    mechanism:
      "Recombinant follicle stimulating hormone acting on granulosa cell FSH receptors to support multifollicular growth.",
    indications: [
      "Controlled ovarian stimulation in general IVF/ICSI population (ESHRE Rec 25, Strong, ⊕⊕⊕)",
      "Normal responders — daily or long-acting corifollitropin alfa (ESHRE Rec 25, 32)",
      "Predicted high responders & PCOS — enables precise 12.5–25 IU pen titration without LH activity",
      "Low responders / POSEIDON groups — alone or with rLH supplementation (ESHRE Rec 25, 29)",
    ],
    contraindications: [
      "Concurrent combination with hMG is probably not recommended (ESHRE Rec 31, Conditional, ⊕⊕)",
      "Low-dose hCG addition is probably not recommended (ESHRE Rec 36, Conditional, ⊕)",
    ],
    clinicalUse:
      "First-line gonadotropin for ovarian stimulation in GnRH antagonist or agonist protocols.",
    advantages: [
      "Consistent batch-to-batch recombinant purity and potency.",
      "Fine pen titration (12.5–25 IU increments) to avoid over-recruitment in high responders.",
      "Follitropin delta and follitropin alfa/beta are equally recommended (ESHRE Rec 33).",
    ],
    limitations: [
      "Contains no intrinsic LH activity where LH supplementation is specifically desired.",
    ],
    clinicalNotes:
      "Equally recommended to hMG in the general IVF population (ESHRE 2025 Rec 25). Long-acting corifollitropin alfa is equally recommended in antagonist cycles for normal responders (Rec 32).",
    availability: "widely-available",
    evidence: ["eshre-2025-ovarian-stimulation-update"],
  },
  {
    id: "urinary-fsh",
    name: "Urinary FSH (purified / highly purified)",
    type: "Urinary FSH",
    route: "Subcutaneous or intramuscular injection",
    mechanism:
      "Urine-derived follicle stimulating hormone acting on granulosa cell FSH receptors.",
    indications: [
      "Ovarian stimulation in GnRH agonist protocol — equally recommended to r-hFSH (ESHRE Rec 26, 27, Strong, ⊕⊕)",
      "General IVF population where urinary preparations are selected.",
    ],
    contraindications: [
      "Co-administration with hMG is probably not recommended (ESHRE Rec 31)",
    ],
    clinicalUse:
      "Purified (p-FSH) or highly purified (hp-FSH) urinary preparation used in long agonist or antagonist protocols.",
    advantages: [
      "Long-standing clinical evidence base.",
      "Equally recommended to r-hFSH in GnRH agonist protocols (ESHRE Rec 26, 27).",
    ],
    limitations: [
      "Urine-derived biological source with potential minor batch variability.",
      "Less precise dose increments compared to multi-dose pen injectors.",
    ],
    clinicalNotes:
      "hp-FSH and hMG are also equally recommended in GnRH agonist protocols (ESHRE 2025 Rec 34).",
    availability: "region-dependent",
    evidence: ["eshre-2025-ovarian-stimulation-update"],
  },
  {
    id: "hp-hmg",
    name: "Highly purified hMG (menotropins)",
    type: "Human menopausal gonadotropin",
    route: "Subcutaneous injection",
    mechanism:
      "Menotropin preparation providing FSH activity together with LH-like activity (predominantly hCG-driven, 1:1 ratio).",
    indications: [
      "Controlled ovarian stimulation in general IVF population — equally recommended to r-hFSH (ESHRE Rec 25, Strong, ⊕⊕⊕)",
      "Women of advanced maternal age (≥35 years) — provides LH activity (ESHRE Rec 25, 30)",
      "Predicted low responders & POSEIDON groups 1b, 2, 3, 4 (ESHRE Rec 25, 29)",
      "Ovarian stimulation in GnRH agonist protocols (ESHRE Rec 34, Conditional, ⊕⊕)",
    ],
    contraindications: [
      "Combined use of r-hFSH with hMG (start or mid-phase) is probably not recommended (ESHRE Rec 31, Conditional, ⊕⊕)",
    ],
    clinicalUse:
      "First-line gonadotropin providing dual FSH and LH/hCG activity in a single injection.",
    advantages: [
      "Delivers both FSH and theca-stimulating LH activity without requiring separate injections.",
      "Equally recommended to r-hFSH in efficacy and live birth outcomes (ESHRE Rec 25).",
    ],
    limitations: [
      "Fixed 1:1 activity ratio; FSH and LH cannot be titrated independently.",
    ],
    clinicalNotes:
      "In women ≥ 35 years and low responders, preparations with LH activity (hMG or rLH addition) offer physiological theca support.",
    availability: "widely-available",
    evidence: ["eshre-2025-ovarian-stimulation-update"],
  },
  {
    id: "recombinant-lh",
    name: "Recombinant LH (lutropin alfa)",
    type: "Recombinant LH",
    route: "Subcutaneous injection",
    mechanism:
      "Recombinant luteinising hormone acting on theca cell LH receptors to promote androgen substrate synthesis.",
    indications: [
      "Addition to r-hFSH in women of advanced age (≥35 years) — equally recommended to r-hFSH alone (ESHRE Rec 30, Conditional, ⊕⊕)",
      "Addition to r-hFSH for predicted low responders — equally recommended to r-hFSH alone (ESHRE Rec 29, Conditional, ⊕⊕)",
      "Hypo-responders / POSEIDON groups 1b and 2b with documented resistance to pure FSH.",
    ],
    contraindications: [
      "Not recommended for routine addition in the unselected general IVF population (ESHRE Rec 28)",
      "Not recommended as an agent for triggering final oocyte maturation (ESHRE Rec 98, Strong, ⊕)",
      "rFSH+rLH is probably not recommended over hMG in GnRH agonist protocols regarding safety (ESHRE Rec 35)",
    ],
    clinicalUse:
      "Adjunctive LH supplementation (typically 75 IU/day) added to r-hFSH from stimulation start or mid-stimulation (day 6).",
    advantages: [
      "LH dose can be titrated completely independently of FSH dose.",
    ],
    limitations: [
      "Requires a second separate injection unless fixed combo is used.",
      "Additional financial cost.",
    ],
    clinicalNotes:
      "ESHRE 2025 concludes rFSH + rLH and rFSH alone are equally recommended in low responders and women ≥ 35 (Rec 29, 30).",
    availability: "region-dependent",
    evidence: ["eshre-2025-ovarian-stimulation-update"],
  },
  {
    id: "fsh-lh-combination",
    name: "FSH + LH combination (fixed 2:1)",
    type: "Fixed FSH + LH combination",
    route: "Subcutaneous injection",
    mechanism:
      "Fixed combination of recombinant human FSH (150 IU) and recombinant human LH (75 IU).",
    indications: [
      "Low responders / poor ovarian reserve — equally recommended to r-hFSH alone (ESHRE Rec 29)",
      "Women of advanced reproductive age (≥35 years) — equally recommended to r-hFSH alone (ESHRE Rec 30)",
      "Severe LH deficiency or profound pituitary downregulation.",
    ],
    contraindications: [
      "Not recommended over hMG in GnRH agonist protocols with regards to safety (ESHRE Rec 35)",
      "Routine use in normal responders without LH indication (ESHRE Rec 28)",
    ],
    clinicalUse:
      "Single daily injection delivering 150 IU r-hFSH + 75 IU r-hLH.",
    advantages: [
      "Single injection delivering both recombinant FSH and recombinant LH.",
    ],
    limitations: [
      "Fixed 2:1 ratio does not allow independent titration of the LH component.",
    ],
    clinicalNotes:
      "Equally recommended to r-hFSH alone in low responders (Rec 29) and women ≥ 35 years (Rec 30).",
    availability: "region-dependent",
    evidence: ["eshre-2025-ovarian-stimulation-update"],
  },
];

export const findGonadotropin = (id: string) => gonadotropinDatabase.find((g) => g.id === id);
