/**
 * Clinical Encounter Validation Engine (§5)
 *
 * Implements strict hard ranges (blocking save) and soft clinical warnings
 * (confirm-on-save with reason audit logging).
 */

import type { Encounter, ValidationIssue, SoftWarning } from "./types";
import type { IntakeData } from "@/features/intake/types";

export interface ValidationResult {
  isValid: boolean;
  hardIssues: ValidationIssue[];
  softWarnings: SoftWarning[];
}

export function validateEncounter(
  current: Encounter,
  previous?: Encounter | null,
): ValidationResult {
  const hardIssues: ValidationIssue[] = [];
  const softWarnings: SoftWarning[] = [];

  // --- HARD RANGES (BLOCKING) ---

  // Stimulation Day (0 - 20)
  if (current.day < 0 || current.day > 20) {
    hardIssues.push({
      field: "day",
      message: `Stimulation day (${current.day}) must be between 0 and 20.`,
      severity: "hard",
    });
  }

  // Weight (30 - 150 kg) if provided
  if (current.weightKg !== undefined && (current.weightKg < 30 || current.weightKg > 150)) {
    hardIssues.push({
      field: "weightKg",
      message: `Patient weight (${current.weightKg} kg) must be between 30 and 150 kg.`,
      severity: "hard",
    });
  }

  // Endometrium thickness (1 - 14 mm)
  if (
    current.ultrasound.endometriumMm !== undefined &&
    (current.ultrasound.endometriumMm < 1 || current.ultrasound.endometriumMm > 14)
  ) {
    hardIssues.push({
      field: "endometriumMm",
      message: `Endometrial thickness (${current.ultrasound.endometriumMm} mm) must be between 1 and 14 mm.`,
      severity: "hard",
    });
  }

  // Follicles per ovary buckets (0 - 30 each)
  const rTotal =
    current.ultrasound.folliclesRight.lt10 +
    current.ultrasound.folliclesRight.b10_13 +
    current.ultrasound.folliclesRight.b14_16 +
    current.ultrasound.folliclesRight.gte17;
  if (rTotal < 0 || rTotal > 40) {
    hardIssues.push({
      field: "folliclesRight",
      message: `Right ovary follicle count (${rTotal}) outside valid physiological range (0–40).`,
      severity: "hard",
    });
  }

  const lTotal =
    current.ultrasound.folliclesLeft.lt10 +
    current.ultrasound.folliclesLeft.b10_13 +
    current.ultrasound.folliclesLeft.b14_16 +
    current.ultrasound.folliclesLeft.gte17;
  if (lTotal < 0 || lTotal > 40) {
    hardIssues.push({
      field: "folliclesLeft",
      message: `Left ovary follicle count (${lTotal}) outside valid physiological range (0–40).`,
      severity: "hard",
    });
  }

  // Estradiol E2 (0 - 6000 pg/mL)
  if (
    current.labs.estradiolPgMl !== undefined &&
    (current.labs.estradiolPgMl < 0 || current.labs.estradiolPgMl > 6000)
  ) {
    hardIssues.push({
      field: "estradiolPgMl",
      message: `Serum estradiol (${current.labs.estradiolPgMl} pg/mL) must be between 0 and 6000 pg/mL.`,
      severity: "hard",
    });
  }

  // LH (0 - 25 mIU/mL)
  if (
    current.labs.lhMiuMl !== undefined &&
    (current.labs.lhMiuMl < 0 || current.labs.lhMiuMl > 25)
  ) {
    hardIssues.push({
      field: "lhMiuMl",
      message: `Serum LH (${current.labs.lhMiuMl} mIU/mL) must be between 0 and 25 mIU/mL.`,
      severity: "hard",
    });
  }

  // Progesterone P4 (0 - 40 ng/mL)
  if (
    current.labs.progesteroneNgMl !== undefined &&
    (current.labs.progesteroneNgMl < 0 || current.labs.progesteroneNgMl > 40)
  ) {
    hardIssues.push({
      field: "progesteroneNgMl",
      message: `Serum progesterone (${current.labs.progesteroneNgMl} ng/mL) must be between 0 and 40 ng/mL.`,
      severity: "hard",
    });
  }

  // Gonadotropin daily dose (37.5 - 600 IU/day)
  const dose = current.medications.gonadotropinDoseIU;
  if (dose < 37.5 || dose > 600) {
    hardIssues.push({
      field: "gonadotropinDoseIU",
      message: `Gonadotropin daily dose (${dose} IU) must be between 37.5 and 600 IU/day.`,
      severity: "hard",
    });
  }

  // Hard ESHRE starting dose ceiling on Day <= 2
  if (current.day <= 2 && dose > 300) {
    hardIssues.push({
      field: "gonadotropinDoseIU",
      message: `ESHRE 2025 Rec 20 Ceiling: Starting dose cannot exceed 300 IU/day (${dose} IU entered).`,
      severity: "hard",
      suggestedAction: "Reduce daily starting dose to ≤ 300 IU/day per guideline recommendations.",
    });
  }

  // --- SOFT WARNINGS (CONFIRM ON SAVE WITH AUDITED REASON) ---

  // 1. Rapid E2 escalation: > 50%/day
  if (current.labs.estradiolPgMl && previous?.labs.estradiolPgMl && current.day > previous.day) {
    const daysDiff = current.day - previous.day;
    const ratio = current.labs.estradiolPgMl / previous.labs.estradiolPgMl;
    const dailyGrowth = Math.pow(ratio, 1 / daysDiff) - 1;
    if (dailyGrowth > 0.5) {
      softWarnings.push({
        field: "estradiolPgMl",
        message: `Estradiol is escalating at +${Math.round(dailyGrowth * 100)}%/day (exceeds 50%/day physiological threshold). Risk of rapid OHSS trajectory.`,
        triggerCondition: "E2 daily growth > 50%",
      });
    }
  }

  // 2. Early lead follicle maturation: Lead >= 18 mm before Day 8
  const leadSize =
    current.ultrasound.largestFollicleMm ??
    (current.ultrasound.folliclesRight.gte17 + current.ultrasound.folliclesLeft.gte17 > 0 ? 18 : 0);
  if (current.day < 8 && leadSize >= 18) {
    softWarnings.push({
      field: "largestFollicleMm",
      message: `Lead follicle has reached ${leadSize} mm on Day ${current.day} (before Day 8). Potential premature LH surge or asynchronous follicular cohort.`,
      triggerCondition: "Lead follicle >= 18mm before D8",
    });
  }

  // 3. Excessive single-step dose jump: > 50%
  if (previous?.medications.gonadotropinDoseIU) {
    const prevDose = previous.medications.gonadotropinDoseIU;
    if (dose > prevDose * 1.5) {
      softWarnings.push({
        field: "gonadotropinDoseIU",
        message: `Dose increment from ${prevDose} IU to ${dose} IU exceeds 50% in one step. Confirm clinical titration rationale.`,
        triggerCondition: "Dose increase > 50%",
      });
    }
  }

  // 4. Antagonist delay: Lead >= 12 mm by Day 6 with no antagonist recorded
  if (current.day >= 6 && leadSize >= 12 && !current.medications.antagonistDoseMg) {
    softWarnings.push({
      field: "antagonistDoseMg",
      message: `Day ${current.day} with lead follicle ${leadSize} mm: GnRH antagonist is typically initiated when lead reaches 12–14 mm to prevent spontaneous LH surge.`,
      triggerCondition: "No antagonist on D6+ with lead >= 12mm",
    });
  }

  return {
    isValid: hardIssues.length === 0,
    hardIssues,
    softWarnings,
  };
}

/**
 * Clinical Intake Validation Engine (§2.3)
 *
 * Implements hard physiological bounds (blocking save) and soft clinical alerts
 * (confirm-on-save) for patient intake.
 */
export function validateIntake(intake: IntakeData): ValidationResult {
  const hardIssues: ValidationIssue[] = [];
  const softWarnings: SoftWarning[] = [];

  const { identity, anthropometrics, reserveMarkers, diagnosis, cycleIntent } = intake;

  // Age (18 - 55)
  if (identity.age !== null && identity.age !== undefined) {
    if (identity.age < 18 || identity.age > 55) {
      hardIssues.push({
        field: "identity.age",
        message: `Patient age (${identity.age} years) must be between 18 and 55.`,
        severity: "hard",
      });
    } else if (identity.age > 42) {
      softWarnings.push({
        field: "identity.age",
        message: `Advanced maternal age (${identity.age}y): High risk of aneuploidy and poor ovarian response (POSEIDON Group 2/4).`,
        triggerCondition: "age > 42",
      });
    }
  }

  // BMI (15 - 50)
  if (anthropometrics.bmi !== null && anthropometrics.bmi !== undefined) {
    if (anthropometrics.bmi < 15 || anthropometrics.bmi > 50) {
      hardIssues.push({
        field: "anthropometrics.bmi",
        message: `BMI (${anthropometrics.bmi.toFixed(1)}) must be between 15 and 50 kg/m².`,
        severity: "hard",
      });
    } else if (anthropometrics.bmi > 30) {
      softWarnings.push({
        field: "anthropometrics.bmi",
        message: `Elevated BMI (${anthropometrics.bmi.toFixed(1)}): May require higher starting gonadotropin dose and vigilance for metabolic hypo-response.`,
        triggerCondition: "bmi > 30",
      });
    } else if (anthropometrics.bmi < 19) {
      softWarnings.push({
        field: "anthropometrics.bmi",
        message: `Low BMI (${anthropometrics.bmi.toFixed(1)}): Watch for heightened sensitivity to gonadotropins.`,
        triggerCondition: "bmi < 19",
      });
    }
  }

  // AMH (0 - 20 ng/mL)
  if (reserveMarkers.amh !== null && reserveMarkers.amh !== undefined) {
    if (reserveMarkers.amh < 0 || reserveMarkers.amh > 20) {
      hardIssues.push({
        field: "reserveMarkers.amh",
        message: `Serum AMH (${reserveMarkers.amh} ng/mL) must be between 0 and 20 ng/mL.`,
        severity: "hard",
      });
    } else if (reserveMarkers.amh < 0.5) {
      softWarnings.push({
        field: "reserveMarkers.amh",
        message: `Severely depleted ovarian reserve (AMH ${reserveMarkers.amh} ng/mL < 0.5): Bologna criteria alert.`,
        triggerCondition: "amh < 0.5",
      });
    } else if (reserveMarkers.amh > 5.0) {
      softWarnings.push({
        field: "reserveMarkers.amh",
        message: `High ovarian reserve (AMH ${reserveMarkers.amh} ng/mL > 5.0): PCOS spectrum / elevated OHSS risk.`,
        triggerCondition: "amh > 5.0",
      });
    }
  }

  // AFC right & left (0 - 30 per ovary)
  if (reserveMarkers.afcRight !== null && reserveMarkers.afcRight !== undefined) {
    if (reserveMarkers.afcRight < 0 || reserveMarkers.afcRight > 30) {
      hardIssues.push({
        field: "reserveMarkers.afcRight",
        message: `Right ovary AFC (${reserveMarkers.afcRight}) must be between 0 and 30 follicles.`,
        severity: "hard",
      });
    } else if (reserveMarkers.afcRight < 5) {
      softWarnings.push({
        field: "reserveMarkers.afcRight",
        message: `Low right antral follicle count (${reserveMarkers.afcRight} < 5).`,
        triggerCondition: "afcRight < 5",
      });
    }
  }

  if (reserveMarkers.afcLeft !== null && reserveMarkers.afcLeft !== undefined) {
    if (reserveMarkers.afcLeft < 0 || reserveMarkers.afcLeft > 30) {
      hardIssues.push({
        field: "reserveMarkers.afcLeft",
        message: `Left ovary AFC (${reserveMarkers.afcLeft}) must be between 0 and 30 follicles.`,
        severity: "hard",
      });
    } else if (reserveMarkers.afcLeft < 5) {
      softWarnings.push({
        field: "reserveMarkers.afcLeft",
        message: `Low left antral follicle count (${reserveMarkers.afcLeft} < 5).`,
        triggerCondition: "afcLeft < 5",
      });
    }
  }

  // Basal FSH (0 - 40 mIU/mL)
  if (reserveMarkers.basalFsh !== null && reserveMarkers.basalFsh !== undefined) {
    if (reserveMarkers.basalFsh < 0 || reserveMarkers.basalFsh > 40) {
      hardIssues.push({
        field: "reserveMarkers.basalFsh",
        message: `Basal FSH (${reserveMarkers.basalFsh} mIU/mL) must be between 0 and 40 mIU/mL.`,
        severity: "hard",
      });
    }
  }

  // Basal E2 (0 - 200 pg/mL)
  if (reserveMarkers.basalE2 !== null && reserveMarkers.basalE2 !== undefined) {
    if (reserveMarkers.basalE2 < 0 || reserveMarkers.basalE2 > 200) {
      hardIssues.push({
        field: "reserveMarkers.basalE2",
        message: `Basal Estradiol (${reserveMarkers.basalE2} pg/mL) must be between 0 and 200 pg/mL.`,
        severity: "hard",
      });
    }
  }

  // Basal LH (0 - 25 mIU/mL)
  if (reserveMarkers.basalLh !== null && reserveMarkers.basalLh !== undefined) {
    if (reserveMarkers.basalLh < 0 || reserveMarkers.basalLh > 25) {
      hardIssues.push({
        field: "reserveMarkers.basalLh",
        message: `Basal LH (${reserveMarkers.basalLh} mIU/mL) must be between 0 and 25 mIU/mL.`,
        severity: "hard",
      });
    }
  }

  // Infertility Duration (0 - 240 months)
  if (diagnosis.infertilityDuration !== null && diagnosis.infertilityDuration !== undefined) {
    if (diagnosis.infertilityDuration < 0 || diagnosis.infertilityDuration > 240) {
      hardIssues.push({
        field: "diagnosis.infertilityDuration",
        message: `Infertility duration (${diagnosis.infertilityDuration} months) must be between 0 and 240 months.`,
        severity: "hard",
      });
    }
  }

  // Previous OHSS + planned fresh transfer warning (§2.3)
  if (anthropometrics.previousOhss && cycleIntent.transferPolicy === "fresh") {
    softWarnings.push({
      field: "cycleIntent.transferPolicy",
      message:
        "Patient has a history of OHSS. Fresh embryo transfer carries heightened risk; freeze-all strategy strongly advised.",
      triggerCondition: "previousOhss && transferPolicy === 'fresh'",
    });
  }

  return {
    isValid: hardIssues.length === 0,
    hardIssues,
    softWarnings,
  };
}
