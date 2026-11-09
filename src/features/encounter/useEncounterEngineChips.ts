/**
 * Reactive Inline Engine Chips Hook (§4)
 *
 * Computes debounced (≤ 150ms) clinical advisory chips as the clinician
 * fills in follicles, labs, and doses in the EncounterForm.
 *
 * NON-BLOCKING: Chips inform the clinician and link to guideline rationale,
 * but never block encounter save.
 */

import { useState, useEffect, useMemo } from "react";
import type { Encounter, InlineEngineChip } from "./types";
import type { PatientRecord } from "@/lib/assessment/patients";
import { classifyPoseidon } from "@/lib/engine/poseidon";

export function useEncounterEngineChips(
  current: Encounter,
  patient: PatientRecord | null,
  previous?: Encounter | null,
): InlineEngineChip[] {
  const [debouncedEncounter, setDebouncedEncounter] = useState<Encounter>(current);

  // Debounce ≤ 150 ms per §4 requirement
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEncounter(current);
    }, 120);
    return () => clearTimeout(timer);
  }, [current]);

  const chips = useMemo<InlineEngineChip[]>(() => {
    if (!patient) return [];

    const result: InlineEngineChip[] = [];
    const values = patient.values ?? {};
    const cycles = patient.cycleRecords ?? [];

    const r = debouncedEncounter.ultrasound.folliclesRight;
    const l = debouncedEncounter.ultrasound.folliclesLeft;
    const totalFollicles =
      r.lt10 + r.b10_13 + r.b14_16 + r.gte17 + l.lt10 + l.b10_13 + l.b14_16 + l.gte17;

    const e2 = debouncedEncounter.labs.estradiolPgMl;
    const dose = debouncedEncounter.medications.gonadotropinDoseIU;

    // 1. POSEIDON reserve validation chip
    if (totalFollicles > 0) {
      const poseidon = classifyPoseidon(values, cycles);
      if (poseidon.groupLabel) {
        result.push({
          id: "poseidon-strat",
          engine: "POSEIDON",
          label: `POSEIDON Group ${poseidon.groupLabel} Cohort`,
          variant: "info",
          rationale: `Follicular cohort (${totalFollicles} follicles observed) aligns with POSEIDON Group ${poseidon.groupLabel} prognosis based on baseline AMH (${values["amh"] ?? "—"} ng/mL) and AFC.`,
          citationId: "poseidon-2016",
          citationText:
            "Alviggi C, et al. A new more detailed stratification of low responders to ovarian stimulation: but what's next? Ann Transl Med. 2018.",
          guidelineRule: "POSEIDON Stratification Model",
        });
      }
    }

    // 2. OHSS risk evaluation chip
    if (totalFollicles >= 18 || (e2 && e2 >= 3000)) {
      const isCritical = totalFollicles >= 24 || (e2 && e2 >= 4500);
      result.push({
        id: "ohss-risk-chip",
        engine: "OHSS",
        label: isCritical
          ? "OHSS Risk: High / Critical — Consider Coasting or GnRH Agonist Trigger"
          : "OHSS Risk: Moderate — Close Estradiol Monitoring Required",
        variant: isCritical ? "destructive" : "warning",
        rationale: isCritical
          ? `High follicular density (${totalFollicles} follicles) and elevated serum E2 (${e2 ?? "—"} pg/mL) satisfy high-responder criteria. ESHRE 2025 recommends elective GnRH agonist trigger and freeze-all.`
          : `Emerging cohort of ${totalFollicles} follicles with E2 ${e2 ?? "—"} pg/mL indicates vigorous ovarian responsiveness.`,
        citationId: "eshre-2025-rec13-reduced-dose-high-responder",
        citationText:
          "Hum Reprod. 2026;41(4):498-514. ESHRE 2025 Guideline on Ovarian Stimulation.",
        guidelineRule: "ESHRE 2025 Recommendation 13 / ASRM OHSS Prevention",
      });
    }

    // 3. Estradiol kinetics trend chip
    if (e2 && previous?.labs.estradiolPgMl && debouncedEncounter.day > previous.day) {
      const prevE2 = previous.labs.estradiolPgMl;
      const daysDiff = debouncedEncounter.day - previous.day;
      const pctIncrease = Math.round(((e2 - prevE2) / prevE2) * 100);
      const dailyRate = Math.round(pctIncrease / daysDiff);

      result.push({
        id: "e2-kinetics-chip",
        engine: "MONITORING",
        label: `E2 Trend: ${pctIncrease >= 0 ? "+" : ""}${pctIncrease}% vs D${previous.day} (${dailyRate}%/day)`,
        variant: dailyRate > 50 ? "warning" : "info",
        rationale:
          dailyRate > 50
            ? `E2 growth of ${dailyRate}%/day exceeds standard physiological follicular growth (35–50%/day), signaling rapid recruitment.`
            : `E2 growth of ${dailyRate}%/day reflects normal follicular steroidogenesis commensurate with growing cohort.`,
        citationId: "eshre-2025-monitoring",
        citationText: "ESHRE Guideline on Ovarian Stimulation, Monitoring and Titration Chapters.",
        guidelineRule: "Follicular Steroidogenesis Kinetics",
      });
    }

    // 4. ESHRE Rec 20 300 IU ceiling headroom chip
    if (dose > 0) {
      const headroom = 300 - dose;
      if (headroom >= 0) {
        result.push({
          id: "dose-headroom-chip",
          engine: "ESHRE",
          label: `ESHRE 300 IU Ceiling: ${headroom} IU headroom`,
          variant: "success",
          rationale: `Daily dose of ${dose} IU complies with ESHRE 2025 Recommendation 20 (daily dose > 300 IU is probably not recommended).`,
          citationId: "eshre-2025-rec20-dose-ceiling",
          citationText: "Hum Reprod. 2026;41(4):498-514. ESHRE 2025 Guideline, Rec 20.",
          guidelineRule: "ESHRE 2025 Recommendation 20",
        });
      } else {
        result.push({
          id: "dose-ceiling-exceeded-chip",
          engine: "ESHRE",
          label: `Dose exceeds ESHRE 300 IU benchmark by ${Math.abs(headroom)} IU`,
          variant: "destructive",
          rationale: `A daily dose of > 300 IU FSH does not increase live birth rates in poor responders (ESHRE 2025 Rec 20, Conditional, ⊕⊕).`,
          citationId: "eshre-2025-rec20-dose-ceiling",
          citationText: "Hum Reprod. 2026;41(4):498-514. ESHRE 2025 Guideline, Rec 20.",
          guidelineRule: "ESHRE 2025 Recommendation 20 Ceiling",
        });
      }
    }

    return result;
  }, [debouncedEncounter, patient, previous]);

  return chips;
}
