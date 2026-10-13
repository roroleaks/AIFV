/**
 * ESHRE Ovarian Stimulation for IVF/ICSI — GUIDELINE UPDATE 2025.
 *
 * Verbatim transcription of the numbered statements printed in the guideline's
 * "List of all recommendations", together with the printed strength of the
 * recommendation and the printed quality-of-evidence symbol.
 *
 * RULES OBSERVED IN THIS FILE
 * - Every `text` is the statement as printed. Nothing is paraphrased,
 *   summarised, merged, extended or re-graded.
 * - No numeric threshold, dose or criterion appears here unless the guideline
 *   prints it inside the statement itself (e.g. "150-225 IU", "16-22 mm").
 * - `modules` and `populations` are routing tags only: they decide WHERE a
 *   statement is displayed, never WHAT it says.
 * - Statements that the guideline marks as "no evidence" / "conclusion" are
 *   transcribed with that label so the absence of evidence stays visible.
 *
 * Source document indexed in the Evidence Library:
 *   The ESHRE Guideline Group on Ovarian Stimulation (Ata B., Bosch E.,
 *   Broer S., Griesinger G., Grynberg M., Kolibianakis E., Kunicki M.,
 *   La Marca A., Lainas G., Le Clef N., Massin N., Polyzos N.P., Sunkara S.K.,
 *   Timeva T., Töyli M., Urbancsek J., Broekmans F.)
 *   "Ovarian stimulation for IVF/ICSI — Update 2025", ESHRE.
 */

export const ESHRE_OS_2025 = {
  id: "eshre-2025-ovarian-stimulation-update",
  title:
    "Ovarian stimulation for IVF/ICSI — Guideline of the European Society of Human Reproduction and Embryology, update 2025",
  society: "ESHRE",
  year: 2025,
  assetFile: "ESHRE_Ovarian_Stimulation_Guideline_2025.pdf",
  locator: "List of all recommendations, pages 15–24",
} as const;

export type RecommendationStrength =
  "Strong" | "Conditional" | "GPP" | "Research only" | "Conclusion";

/** Printed quality-of-evidence symbol. `null` for GPP / conclusions. */
export type EvidenceQualitySymbol = "⊕" | "⊕⊕" | "⊕⊕⊕" | null;

export type GuidelineModuleId =
  | "protocol-recommendation"
  | "gonadotropin-selection"
  | "starting-dose"
  | "dose-adjustment"
  | "monitoring"
  | "trigger-recommendation"
  | "ohss-risk"
  | "freeze-all"
  | "luteal-support";

export type PopulationTag =
  | "general"
  | "high-responder"
  | "normal-responder"
  | "low-responder"
  | "pcos"
  | "advanced-age"
  | "ohss-risk"
  | "freeze-all-planned"
  | "fresh-transfer";

export interface GuidelineRecommendation {
  /** Number as printed in the guideline; null for unnumbered conclusions. */
  number: number | null;
  /** Chapter heading as printed. */
  section: string;
  /** Verbatim statement. */
  text: string;
  strength: RecommendationStrength;
  quality: EvidenceQualitySymbol;
  modules: GuidelineModuleId[];
  populations: PopulationTag[];
}

const R = (
  number: number | null,
  section: string,
  text: string,
  strength: RecommendationStrength,
  quality: EvidenceQualitySymbol,
  modules: GuidelineModuleId[],
  populations: PopulationTag[],
): GuidelineRecommendation => ({ number, section, text, strength, quality, modules, populations });

export const eshreOs2025Recommendations: GuidelineRecommendation[] = [
  /* ------------------------------------------- Part B: pre-treatments */
  R(
    6,
    "Pre-treatments",
    "Estrogen pre-treatment is probably not recommended in GnRH antagonist protocols for scheduling or improving cycle outcomes. [2025]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["general", "normal-responder", "low-responder", "high-responder"],
  ),
  /* ------------------------------------------- Part C: stimulation protocols */
  R(
    12,
    "Stimulation protocols",
    "Delayed-start ovarian stimulation is probably not recommended routinely in predicted high responders to decrease the risk of OHSS. [2025]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["high-responder"],
  ),
  R(
    null,
    "Stimulation protocols",
    "There is no evidence to justify the use of NC or MNC for OS in high responders.",
    "Conclusion",
    null,
    ["protocol-recommendation"],
    ["high-responder"],
  ),
  R(
    13,
    "Stimulation protocols",
    "A reduced gonadotropin dose (100 to <150 IU) is probably recommended to decrease the risk of OHSS in predicted high responders. [2025]",
    "Conditional",
    "⊕",
    ["starting-dose", "protocol-recommendation"],
    ["high-responder", "ohss-risk"],
  ),
  R(
    14,
    "Stimulation protocols",
    "The GnRH antagonist protocol is recommended for predicted high responders. [updated]",
    "Strong",
    "⊕",
    ["protocol-recommendation"],
    ["high-responder"],
  ),
  R(
    15,
    "Stimulation protocols",
    "Delayed-start ovarian stimulation is probably not recommended over a conventional gonadotrophin dose for predicted normal responders. [2025]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["normal-responder"],
  ),
  R(
    16,
    "Stimulation protocols",
    "Neither a reduced nor increased gonadotrophin dose is probably recommended over a conventional gonadotrophin dose (equivalent to 150-225 IU) for predicted normal responders. [updated]",
    "Conditional",
    "⊕",
    ["starting-dose"],
    ["normal-responder"],
  ),
  R(
    17,
    "Stimulation protocols",
    "Delayed start ovarian stimulation is probably not recommended for predicted low responders. [2025]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["low-responder"],
  ),
  R(
    18,
    "Stimulation protocols",
    "The use of modified natural cycle is probably not routinely recommended over conventional stimulation for low responders. [updated]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["low-responder"],
  ),
  R(
    19,
    "Stimulation protocols",
    "The GDG recognises that low responders are a heterogeneous group and in women with very low ovarian reserve, clinicians could choose to use a modified natural cycle. [2025]",
    "GPP",
    null,
    ["protocol-recommendation"],
    ["low-responder"],
  ),
  R(
    20,
    "Stimulation protocols",
    "A gonadotropin dose higher than 300 IU is not recommended for predicted low responders. [2019]",
    "Strong",
    "⊕",
    ["starting-dose"],
    ["low-responder"],
  ),
  R(
    21,
    "Pituitary suppression regimens",
    "If GnRH agonists are used, the long GnRH agonist protocol is recommended over the short or ultrashort GnRH agonist protocol. [updated]",
    "Strong",
    "⊕⊕",
    ["protocol-recommendation"],
    ["general"],
  ),
  R(
    22,
    "Pituitary suppression regimens",
    "The GnRH antagonist protocol is recommended over the GnRH agonist protocols given the comparable efficacy and higher safety in the general IVF/ICSI population. [2019]",
    "Strong",
    "⊕⊕⊕",
    ["protocol-recommendation"],
    ["general"],
  ),
  R(
    23,
    "Pituitary suppression regimens",
    "The fixed GnRH antagonist protocol is probably recommended over the flexible GnRH antagonist protocol. [2025]",
    "Conditional",
    "⊕⊕",
    ["protocol-recommendation"],
    ["general"],
  ),
  R(
    24,
    "Pituitary suppression regimens",
    "If freeze-all is planned, the use of progestin for pituitary suppression is probably equally recommended to GnRH analogues. [updated]",
    "Conditional",
    "⊕",
    ["protocol-recommendation", "freeze-all"],
    ["freeze-all-planned"],
  ),

  /* ------------------------------ Part C: types of gonadotropins and drugs */
  R(
    25,
    "Types of gonadotropins",
    "The use of recombinant human FSH (r-hFSH) and human menopausal gonadotropin (hMG) for ovarian stimulation is equally recommended. [2019]",
    "Strong",
    "⊕⊕⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    26,
    "Types of gonadotropins",
    "The use of recombinant human FSH (r-hFSH) and purified FSH (p-FSH) for ovarian stimulation in GnRH agonist protocol is equally recommended. [2019]",
    "Strong",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    27,
    "Types of gonadotropins",
    "The use of either recombinant human FSH (r-hFSH) and highly purified FSH (hp-FSH) for ovarian stimulation in GnRH agonist protocol is equally recommended. [2019]",
    "Strong",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    28,
    "Types of gonadotropins",
    "The combination of r-hFSH with r-hLH and r-hFSH alone are probably equally recommended for the general IVF population. [2025]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    29,
    "Types of gonadotropins",
    "The combination of r-hFSH with r-hLH and r-hFSH alone are probably equally recommended for low responders. [2025]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["low-responder"],
  ),
  R(
    30,
    "Types of gonadotropins",
    "The combination of r-hFSH with r-hLH and r-hFSH alone are probably equally recommended for women of advanced age (≥35 year). [2025]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["advanced-age"],
  ),
  R(
    31,
    "Types of gonadotropins",
    "The combined use of recombinant human FSH (r-hFSH) with human menopausal gonadotropin (hMG), either from the start or mid-phase of ovarian stimulation, is probably not recommended over the use of either r-hFSH or hMG alone in normal and low responders. [2025]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["normal-responder", "low-responder"],
  ),
  R(
    32,
    "Types of gonadotropins",
    "The use of long-acting and daily recombinant human FSH (r-hFSH) is equally recommended in GnRH antagonist cycles for normal responders. [2019]",
    "Strong",
    "⊕",
    ["gonadotropin-selection"],
    ["normal-responder"],
  ),
  R(
    33,
    "Types of gonadotropins",
    "Follitropin delta and follitropin alpha/beta are equally recommended for ovarian stimulation. [2025]",
    "Strong",
    "⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    34,
    "Types of gonadotropins",
    "The use of highly purified FSH (hp-FSH) and human menopausal gonadotropin (hMG) for ovarian stimulation in GnRH agonist protocols is equally recommended. [2019]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    35,
    "Types of gonadotropins",
    "The use of recombinant human LH + recombinant human FSH (r-hFSH+r-hLH) for ovarian stimulation is probably not recommended over human menopausal gonadotropin (hMG) in GnRH agonist protocols with regards to safety. [2019]",
    "Conditional",
    "⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    36,
    "Types of gonadotropins",
    "Adding low dosages of hCG to the FSH stimulation is probably not recommended. [2025]",
    "Conditional",
    "⊕",
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    37,
    "Types of gonadotropins",
    "The addition of letrozole to gonadotropins in stimulation protocols for predicted high responders is probably not recommended. [updated]",
    "Conditional",
    "⊕",
    ["gonadotropin-selection"],
    ["high-responder"],
  ),
  R(
    38,
    "Types of gonadotropins",
    "The addition of letrozole to gonadotropins in stimulation protocols is probably not recommended for predicted normal responders. [2019]",
    "Conditional",
    "⊕",
    ["gonadotropin-selection"],
    ["normal-responder"],
  ),
  R(
    39,
    "Types of gonadotropins",
    "The addition of letrozole to gonadotropins in stimulation protocols is probably not recommended for predicted low responders. [2019]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["low-responder"],
  ),
  R(
    null,
    "Types of gonadotropins",
    "There is no evidence available to recommend the substitution of FSH by Clomiphene Citrate in ovarian stimulation.",
    "Conclusion",
    null,
    ["gonadotropin-selection"],
    ["general"],
  ),
  R(
    40,
    "Types of gonadotropins",
    "The addition of Clomiphene Citrate to gonadotropins in stimulation protocols is probably not recommended for predicted high responders. [2019]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["high-responder"],
  ),
  R(
    41,
    "Types of gonadotropins",
    "The addition of Clomiphene Citrate to gonadotropins in stimulation protocols is probably not recommended for predicted normal responders. [2025]",
    "Conditional",
    "⊕⊕⊕",
    ["gonadotropin-selection"],
    ["normal-responder"],
  ),
  R(
    42,
    "Types of gonadotropins",
    "Clomiphene citrate alone or in combination with gonadotrophins, and gonadotropin stimulation alone are probably equally recommended for predicted low responders. [updated]",
    "Conditional",
    "⊕⊕",
    ["gonadotropin-selection"],
    ["low-responder"],
  ),

  /* ------------------------------------ Part C: adjustment of gonadotropins */
  R(
    43,
    "Adjustment of gonadotropin dose",
    "Adjustment (increase or decrease) of the gonadotrophin dose in the mid-stimulation phase during ovarian stimulation is probably not recommended. [2019]",
    "Conditional",
    "⊕",
    ["dose-adjustment"],
    ["general"],
  ),
  R(
    44,
    "Adjustment of gonadotropin dose",
    "Given the lack of evidence of the value of dose adjustments during ovarian stimulation, it is important that the gonadotropin starting dose is appropriate based on patient characteristics and desired outcome. [2025]",
    "GPP",
    null,
    ["dose-adjustment", "starting-dose"],
    ["general"],
  ),

  /* ----------------------------------------------- Part C: adjunct therapies */
  R(
    45,
    "Adjunct therapies",
    "Routine use of adjunct metformin before and/or during ovarian stimulation is probably not recommended when using the GnRH antagonist protocol for women with PCOS. [updated]",
    "Conditional",
    "⊕⊕",
    ["protocol-recommendation"],
    ["pcos"],
  ),
  R(
    46,
    "Adjunct therapies",
    "Use of adjunct growth hormone before and/or during ovarian stimulation is not recommended for normal responders. [2025]",
    "Strong",
    "⊕",
    ["protocol-recommendation"],
    ["normal-responder"],
  ),
  R(
    47,
    "Adjunct therapies",
    "Use of adjunct growth hormone before and/or during ovarian stimulation is probably not recommended for low responders. [updated]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["low-responder"],
  ),
  R(
    48,
    "Adjunct therapies",
    "Use of adjunct growth hormone before and/or during ovarian stimulation is not recommended for women with PCOS. [2025]",
    "Strong",
    "⊕⊕",
    ["protocol-recommendation"],
    ["pcos"],
  ),
  R(
    49,
    "Adjunct therapies",
    "Use of testosterone before ovarian stimulation is probably not recommended for low responders. [updated]",
    "Conditional",
    "⊕⊕⊕",
    ["protocol-recommendation"],
    ["low-responder"],
  ),
  R(
    50,
    "Adjunct therapies",
    "Use of DHEA before and/or during ovarian stimulation is not recommended for low responders. [2019]",
    "Strong",
    "⊕⊕",
    ["protocol-recommendation"],
    ["low-responder"],
  ),
  R(
    51,
    "Adjunct therapies",
    "Use of DHEA before and/or during ovarian stimulation is not recommended for normal responders. [2025]",
    "Strong",
    "⊕⊕",
    ["protocol-recommendation"],
    ["normal-responder"],
  ),
  R(
    54,
    "Adjunct therapies",
    "Use of myo-inositol before and/or during ovarian stimulation is probably not recommended for women with PCOS undergoing IVF. [2025]",
    "Conditional",
    "⊕",
    ["protocol-recommendation"],
    ["pcos"],
  ),

  /* ------------------------------------------------------ Part E: monitoring */
  R(
    79,
    "Hormonal assessment during ovarian stimulation",
    "The addition of oestradiol measurements to ultrasound monitoring is probably not recommended. [2019]",
    "Conditional",
    "⊕",
    ["monitoring", "dose-adjustment"],
    ["general"],
  ),
  R(
    80,
    "Hormonal assessment during ovarian stimulation",
    "The addition of a hormonal panel consisting of a combination of oestradiol, progesterone and LH measurements to ultrasound monitoring is probably not recommended. [2019]",
    "Conditional",
    "⊕",
    ["monitoring", "dose-adjustment"],
    ["general"],
  ),
  R(
    81,
    "Endometrial thickness",
    "Routine monitoring of endometrial thickness during controlled ovarian stimulation is probably not recommended. [2019]",
    "Conditional",
    "⊕⊕",
    ["monitoring"],
    ["general"],
  ),
  R(
    82,
    "Endometrial thickness",
    "The guideline group suggests performing a single measurement of the endometrium during ultrasound assessment on the day of triggering or oocyte pick-up to counsel patients on potential lower pregnancy chance. [2019]",
    "GPP",
    null,
    ["monitoring", "trigger-recommendation"],
    ["general"],
  ),

  /* --------------------------------------------- Part E: criteria for trigger */
  R(
    83,
    "Criteria for triggering",
    "The association of follicle size as a triggering criterion with outcome has not been sufficiently studied. Physicians may choose the follicle size upon which final oocyte maturation is triggered on a case to case basis. [2019]",
    "GPP",
    null,
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    84,
    "Criteria for triggering",
    "The decision on timing of triggering in relation to follicle size is multi-factorial, taking into account the size of the growing follicle cohort, the hormonal data on the day of pursued trigger, duration of stimulation, embryo transfer strategy, patient burden, financial costs, experience of previous cycles and organizational factors for the centre. Most often, final oocyte maturation is triggered at sizes of several of the leading follicles between 16-22 mm. [reworded]",
    "GPP",
    null,
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    85,
    "Criteria for triggering",
    "The GDG does not recommend to base timing of final oocyte maturation triggering on oestradiol levels alone. [2019]",
    "GPP",
    null,
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    86,
    "Criteria for triggering",
    "The GDG does not recommend to base timing of final oocyte maturation on oestradiol/follicle ratio alone. [2019]",
    "GPP",
    null,
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    87,
    "Hormonal assessment on the day of final oocyte maturation",
    "It is probably recommended to measure serum progesterone levels on the day of final oocyte maturation in cycles aimed for a fresh embryo transfer. [2025]",
    "Conditional",
    "⊕",
    ["trigger-recommendation", "freeze-all"],
    ["fresh-transfer"],
  ),
  R(
    88,
    "Hormonal assessment on the day of final oocyte maturation",
    "If serum progesterone levels are high, the patient should be counselled about potentially lower ongoing pregnancy/live birth rates. The decision to defer embryo transfer should include other factors (number of oocytes, number of embryos, and embryo quality). [2025]",
    "GPP",
    null,
    ["freeze-all"],
    ["fresh-transfer"],
  ),
  R(
    89,
    "Hormonal assessment on the day of final oocyte maturation",
    "It is not recommended to routinely measure serum oestradiol levels on the day of hCG trigger in ovarian stimulation cycles with an intent for a fresh embryo transfer. [2025]",
    "Strong",
    "⊕",
    ["trigger-recommendation", "monitoring"],
    ["fresh-transfer"],
  ),
  R(
    90,
    "Hormonal assessment on the day of final oocyte maturation",
    "It is not recommended to measure serum LH levels on the day of hCG trigger in ovarian stimulation cycles aimed for a fresh embryo transfer. [2025]",
    "Strong",
    "⊕",
    ["trigger-recommendation", "monitoring"],
    ["fresh-transfer"],
  ),
  R(
    91,
    "Hormonal assessment on the day of final oocyte maturation",
    "It is not recommended to measure serum oestradiol, progesterone or luteinizing hormone levels on the day of a GnRH agonist trigger in freeze-all cycles. [2025]",
    "Strong",
    "⊕",
    ["trigger-recommendation", "monitoring", "freeze-all"],
    ["freeze-all-planned"],
  ),

  /* -------------------------------------------- Part E: cycle cancellation */
  R(
    92,
    "Criteria for cycle cancellation",
    "A low response to ovarian stimulation alone is not a reason to cancel a cycle. [2019]",
    "GPP",
    null,
    ["dose-adjustment", "trigger-recommendation"],
    ["low-responder"],
  ),
  R(
    93,
    "Criteria for cycle cancellation",
    "The physician should counsel the individual unexpected low responder regarding pregnancy prospects and decide individually whether to continue this cycle. [updated]",
    "GPP",
    null,
    ["dose-adjustment"],
    ["low-responder"],
  ),
  R(
    94,
    "Criteria for cycle cancellation",
    "In GnRH agonist cycles with an ovarian response of ≥19 follicles of ≥11 mm, there is an increased risk of OHSS and preventative measures are recommended, which should include primarily cancelling final oocyte maturation trigger. [updated]",
    "Strong",
    "⊕",
    ["ohss-risk", "trigger-recommendation"],
    ["high-responder", "ohss-risk"],
  ),
  R(
    95,
    "Criteria for cycle cancellation",
    "In GnRH antagonist cycles, withholding GnRH agonist triggering may still be considered in women with extremely high ovarian response. [2025]",
    "GPP",
    null,
    ["ohss-risk", "trigger-recommendation"],
    ["high-responder", "ohss-risk"],
  ),

  /* --------------------------------------------------------- Part F: trigger */
  R(
    96,
    "Triggering of final oocyte maturation",
    "The use of recombinant hCG and urinary hCG is equally recommended for triggering final oocyte maturation in ovarian stimulation protocols. [2019]",
    "Strong",
    "⊕⊕",
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    97,
    "Triggering of final oocyte maturation",
    "A reduced-dose of 5000 IU urinary hCG for final oocyte maturation is probably recommended over a 10.000 IU dose in GnRH agonist protocols, as it may improve safety. [2019]",
    "Conditional",
    "⊕",
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    98,
    "Triggering of final oocyte maturation",
    "It is not recommended to administer recombinant human LH for triggering final oocyte maturation. [2019]",
    "Strong",
    "⊕",
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    99,
    "Triggering of final oocyte maturation",
    "The use of GnRH agonist for final oocyte maturation is not recommended in the general IVF/ICSI population with fresh transfer, regardless of luteal phase support (with or without LH-activity). [updated]",
    "Strong",
    "⊕⊕",
    ["trigger-recommendation"],
    ["general", "fresh-transfer"],
  ),
  R(
    100,
    "Triggering of final oocyte maturation",
    "If the GnRH agonist trigger with triptorelin is applied, dosages ranging between 0.1-0.4 mg can be chosen. [2019]",
    "GPP",
    null,
    ["trigger-recommendation"],
    ["general"],
  ),
  R(
    101,
    "Triggering of final oocyte maturation",
    "The addition of a GnRH agonist to hCG as a dual trigger for final oocyte maturation is probably not recommended for predicted normal responders. [2019]",
    "Conditional",
    "⊕⊕",
    ["trigger-recommendation"],
    ["normal-responder"],
  ),
  R(
    102,
    "Triggering of final oocyte maturation",
    "The addition of a GnRH agonist to hCG as a dual trigger for final oocyte maturation is probably not recommended for low responders. [2025]",
    "Conditional",
    "⊕⊕",
    ["trigger-recommendation"],
    ["low-responder"],
  ),

  /* --------------------------------------------------- Part F: luteal support */
  R(
    103,
    "Luteal phase support",
    "Progesterone is recommended for luteal phase support after IVF/ICSI. [2019]",
    "Strong",
    "⊕",
    ["luteal-support"],
    ["general"],
  ),
  R(
    104,
    "Luteal phase support",
    "Any of the previously mentioned administration routes (non-oral) for natural progesterone as luteal phase support can be used. [2019]",
    "GPP",
    null,
    ["luteal-support"],
    ["general"],
  ),
  R(
    105,
    "Luteal phase support",
    "The dosing of natural progesterone has evolved empirically, usually dosages used include: 50 mg once daily for intramuscular progesterone; 25 mg once daily for subcutaneous progesterone; 90 mg once daily for vaginal progesterone gel; 200 mg three times daily for micronized vaginal progesterone in-oil capsules; 100 mg two or three times daily for micronized vaginal progesterone in starch suppositories; 400 mg two times daily for vaginal pessary. [2019]",
    "GPP",
    null,
    ["luteal-support"],
    ["general"],
  ),
  R(
    106,
    "Luteal phase support",
    "Starting of progesterone for luteal phase support should be in the window between the evening of the day of oocyte retrieval and day 3 post oocyte retrieval. [2019]",
    "GPP",
    null,
    ["luteal-support"],
    ["general"],
  ),
  R(
    107,
    "Luteal phase support",
    "Progesterone support should be administered until at least the day of the pregnancy test. [2019]",
    "GPP",
    null,
    ["luteal-support"],
    ["general"],
  ),
  R(
    108,
    "Luteal phase support",
    "Dydrogesterone is probably recommended for luteal phase support. [2019]",
    "Conditional",
    "⊕⊕⊕",
    ["luteal-support"],
    ["general"],
  ),
  R(
    109,
    "Luteal phase support",
    "The addition of oestradiol to progesterone for luteal phase support is probably not recommended. [2019]",
    "Conditional",
    "⊕⊕",
    ["luteal-support"],
    ["general"],
  ),
  R(
    110,
    "Luteal phase support",
    "In hCG triggered ovarian stimulation cycles, hCG as luteal phase support in standard dosages of 1500 IU is not recommended. [updated]",
    "Strong",
    "⊕⊕",
    ["luteal-support"],
    ["general"],
  ),
  R(
    111,
    "Luteal phase support",
    "A GnRH agonist bolus, in addition to progesterone for luteal phase support in hCG triggered cycles is probably not recommended. [updated]",
    "Conditional",
    "⊕⊕",
    ["luteal-support"],
    ["general"],
  ),
  R(
    112,
    "Luteal phase support",
    "Repeated GnRH agonist injections, alone or in addition to progesterone for luteal phase support in hCG triggered cycles is probably not recommended. [reworded]",
    "Conditional",
    "⊕",
    ["luteal-support"],
    ["general"],
  ),
  R(
    113,
    "Luteal phase support",
    "Addition of LH to progesterone for luteal phase support can only be used in the context of a clinical trial. [2019]",
    "Research only",
    null,
    ["luteal-support"],
    ["general"],
  ),

  /* -------------------------------------------------- Part G: OHSS prevention */
  R(
    114,
    "Prevention of OHSS",
    "A GnRH agonist trigger is recommended for final oocyte maturation in women at risk of OHSS combined with a freeze-all strategy to minimise the risk of severe OHSS. [updated]",
    "Strong",
    "⊕",
    ["ohss-risk", "trigger-recommendation", "freeze-all"],
    ["ohss-risk", "high-responder"],
  ),
  R(
    115,
    "Prevention of OHSS",
    "If a GnRH agonist protocol with hCG trigger is used in high responders, a freeze-all strategy is recommended to decrease the risk of late-onset OHSS. [updated]",
    "GPP",
    null,
    ["ohss-risk", "freeze-all"],
    ["high-responder", "ohss-risk"],
  ),
  R(
    116,
    "Prevention of OHSS",
    "The addition of hCG to GnRH agonist as a dual trigger for final oocyte maturation is probably not recommended for high responders. [2025]",
    "Conditional",
    "⊕",
    ["trigger-recommendation", "ohss-risk"],
    ["high-responder"],
  ),
  R(
    117,
    "Prevention of OHSS",
    "In patients at risk of OHSS, the use of a GnRH agonist for final oocyte maturation is probably recommended over hCG in cases where no fresh transfer is performed. [2019]",
    "Conditional",
    "⊕",
    ["trigger-recommendation", "ohss-risk"],
    ["ohss-risk", "freeze-all-planned"],
  ),
  R(
    118,
    "Prevention of OHSS",
    "A GnRH agonist trigger for final oocyte maturation with or without a freeze-all strategy is preferred over a coasting strategy in patients at risk of OHSS. [2019]",
    "GPP",
    null,
    ["trigger-recommendation", "ohss-risk"],
    ["ohss-risk"],
  ),
  R(
    119,
    "Prevention of OHSS",
    "Dopamine agonists are recommended to decrease the risk of early OHSS, particularly in patients receiving hCG for final oocyte maturation. [2025]",
    "Strong",
    "⊕⊕",
    ["ohss-risk"],
    ["ohss-risk", "high-responder"],
  ),
  R(
    120,
    "Prevention of OHSS",
    "A freeze-all strategy is recommended to minimise the risk of late-onset OHSS. [updated]",
    "Strong",
    "⊕⊕",
    ["freeze-all", "ohss-risk"],
    ["ohss-risk", "high-responder"],
  ),
  R(
    121,
    "Prevention of OHSS",
    "Prior to start of ovarian stimulation, a risk assessment for high response is advised with the purpose of applying personalised treatment choices on pituitary suppression protocol, FSH dosage, final oocyte maturation trigger and embryo transfer strategy. [updated]",
    "GPP",
    null,
    ["ohss-risk", "protocol-recommendation", "starting-dose"],
    ["general"],
  ),
];

/** Number of transcribed statements available to a module. */
export function guidelineRuleCount(module: GuidelineModuleId): number {
  return eshreOs2025Recommendations.filter((r) => r.modules.includes(module)).length;
}

/** True when a module has at least one transcribed, citable guideline statement. */
export function guidelineRulesLoaded(module: GuidelineModuleId): boolean {
  return guidelineRuleCount(module) > 0;
}

export interface GuidelineContext {
  /** Populations that apply to the current patient, as determined upstream. */
  populations: PopulationTag[];
}

/**
 * Statements applicable to a module for the given patient context.
 * General statements are always included; population-specific statements are
 * included only when the population applies.
 */
export function guidelineRecommendationsFor(
  module: GuidelineModuleId,
  context: GuidelineContext = { populations: [] },
): GuidelineRecommendation[] {
  const pops = new Set<PopulationTag>([...context.populations, "general"]);
  return eshreOs2025Recommendations.filter(
    (r) => r.modules.includes(module) && r.populations.some((p) => pops.has(p)),
  );
}

export const strengthOrder: Record<RecommendationStrength, number> = {
  Strong: 0,
  Conditional: 1,
  GPP: 2,
  "Research only": 3,
  Conclusion: 4,
};

export function sortByStrength(items: GuidelineRecommendation[]): GuidelineRecommendation[] {
  return [...items].sort(
    (a, b) =>
      strengthOrder[a.strength] - strengthOrder[b.strength] ||
      (a.number ?? 999) - (b.number ?? 999),
  );
}

/** Short citation printed with every displayed statement. */
export const ESHRE_OS_2025_CITATION =
  "ESHRE Guideline Group on Ovarian Stimulation. Ovarian stimulation for IVF/ICSI — update 2025. ESHRE, 2025.";
