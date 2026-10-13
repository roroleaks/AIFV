/**
 * Ovarian stimulation protocol reference database.
 *
 * Descriptive catalogue only. Every entry documents what the named protocol
 * IS, as described in the indexed literature. Nothing here selects a protocol,
 * scores a patient, recommends a medication or produces a dose. The
 * `indications` / `contraindications` arrays stay empty until validated
 * ESHRE / ASRM decision rules are imported.
 */

export type ProtocolId =
  | "gnrh-antagonist"
  | "long-gnrh-agonist"
  | "short-agonist"
  | "microflare"
  | "ppos"
  | "natural-cycle"
  | "modified-natural-cycle"
  | "minimal-stimulation"
  | "mild-stimulation"
  | "duostim";

export type ProtocolFamily = "agonist" | "antagonist" | "progestin" | "natural" | "low-dose" | "dual";

export interface ProtocolEntry {
  id: ProtocolId;
  name: string;
  family: ProtocolFamily;
  description: string;
  /** Reserved — populated only from validated guideline rules. */
  indications: string[];
  /** Reserved — populated only from validated guideline rules. */
  contraindications: string[];
  advantages: string[];
  disadvantages: string[];
  /** Evidence entry ids from the indexed library. */
  evidence: string[];
}

export const protocolDatabase: ProtocolEntry[] = [
  {
    id: "gnrh-antagonist",
    name: "GnRH Antagonist",
    family: "antagonist",
    description:
      "Gonadotropin stimulation from the early follicular phase with a GnRH antagonist introduced to prevent a premature LH surge.",
    indications: [],
    contraindications: [],
    advantages: [
      "Shorter treatment duration than a long agonist schedule.",
      "Allows a GnRH agonist trigger where indicated.",
    ],
    disadvantages: ["Requires close monitoring for antagonist start timing."],
    evidence: ["eshre-2020-ovarian-stimulation", "cochrane-2016-antagonist"],
  },
  {
    id: "long-gnrh-agonist",
    name: "Long GnRH Agonist",
    family: "agonist",
    description:
      "Pituitary downregulation with a GnRH agonist started before stimulation, followed by gonadotropin stimulation once suppression is confirmed.",
    indications: [],
    contraindications: [],
    advantages: ["Predictable cycle scheduling.", "Long-established comparator in the literature."],
    disadvantages: ["Longer treatment duration.", "Downregulation symptoms are common."],
    evidence: ["eshre-2020-ovarian-stimulation", "cochrane-2016-antagonist"],
  },
  {
    id: "short-agonist",
    name: "Short Agonist (Flare)",
    family: "agonist",
    description:
      "GnRH agonist started in the early follicular phase to exploit the initial gonadotropin flare, with stimulation running alongside.",
    indications: [],
    contraindications: [],
    advantages: ["Shorter than the long agonist schedule."],
    disadvantages: ["Early follicular hormone environment is less uniform."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "microflare",
    name: "Microflare",
    family: "agonist",
    description:
      "Low-dose GnRH agonist given from the early follicular phase together with gonadotropin stimulation.",
    indications: [],
    contraindications: [],
    advantages: ["Uses the endogenous flare while limiting agonist exposure."],
    disadvantages: ["Heterogeneous protocols reported across studies."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "ppos",
    name: "PPOS (Progestin-Primed Ovarian Stimulation)",
    family: "progestin",
    description:
      "An oral progestin is used during stimulation instead of a GnRH analogue to prevent a premature LH surge; a freeze-all approach is implied.",
    indications: [],
    contraindications: [],
    advantages: ["Oral suppression agent.", "Compatible with a freeze-all strategy."],
    disadvantages: ["Fresh transfer is not possible in the same cycle."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "natural-cycle",
    name: "Natural Cycle",
    family: "natural",
    description:
      "Retrieval of the single dominant follicle of a spontaneous cycle without exogenous gonadotropins.",
    indications: [],
    contraindications: [],
    advantages: ["No gonadotropin exposure.", "Lowest medication burden."],
    disadvantages: ["Single oocyte expected.", "Higher risk of cycle cancellation."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "modified-natural-cycle",
    name: "Modified Natural Cycle",
    family: "natural",
    description:
      "Natural cycle monitoring supported by a trigger and, in some descriptions, brief adjunct medication to prevent premature ovulation.",
    indications: [],
    contraindications: [],
    advantages: ["Retains a near-physiological cycle with better retrieval timing."],
    disadvantages: ["Still a single-oocyte expectation."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "minimal-stimulation",
    name: "Minimal Stimulation",
    family: "low-dose",
    description:
      "Oral agents with or without low-dose gonadotropins, aiming for a small cohort of oocytes.",
    indications: [],
    contraindications: [],
    advantages: ["Low medication load and cost."],
    disadvantages: ["Fewer oocytes per cycle."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "mild-stimulation",
    name: "Mild Stimulation",
    family: "low-dose",
    description:
      "Reduced gonadotropin exposure compared with conventional stimulation, generally combined with an antagonist.",
    indications: [],
    contraindications: [],
    advantages: ["Lower medication exposure than conventional stimulation."],
    disadvantages: ["Smaller oocyte cohort than conventional stimulation."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
  {
    id: "duostim",
    name: "DuoStim (Dual Stimulation)",
    family: "dual",
    description:
      "Two stimulations and retrievals within a single menstrual cycle, in the follicular and the luteal phase.",
    indications: [],
    contraindications: [],
    advantages: ["Two cohorts collected in a shorter calendar period."],
    disadvantages: ["Freeze-all required.", "Higher treatment intensity."],
    evidence: ["eshre-2020-ovarian-stimulation"],
  },
];

export const findProtocol = (id: string) => protocolDatabase.find((p) => p.id === id);

export const protocolFamilyLabel: Record<ProtocolFamily, string> = {
  agonist: "GnRH agonist",
  antagonist: "GnRH antagonist",
  progestin: "Progestin primed",
  natural: "Natural cycle",
  "low-dose": "Reduced dose",
  dual: "Dual stimulation",
};
