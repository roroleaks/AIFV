/**
 * Intake Adapter & Case Creation Helper (§2.4, §2.5)
 *
 * Translates IntakeData into:
 *  1. PatientRecord with stable internal caseId (Zero PHI in URL).
 *  2. Pre-drafted baseline (D0) Encounter for the longitudinal timeline.
 */

import type { IntakeData } from "./types";
import type { PatientRecord } from "@/lib/assessment/patients";
import type { FieldValue } from "@/lib/assessment/use-assessment";
import type { Encounter } from "@/features/encounter/types";
import type { ClinicalCaseInput, StratificationResult } from "@/services/clinical/types";
import { runStratification } from "@/services/clinical/orchestrators";

import { savePatient } from "@/lib/assessment/patients";
import {
  encryptedStore,
  isEncryptionInitialized,
  initializeEncryption,
} from "@/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "@/services/auth/pinConfig";

/**
 * Generates a stable internal case ID with zero PHI (not based on patient name or MRN).
 */
export function generateCaseId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `case-${ts}-${rand}`;
}

/**
 * Converts IntakeData into a persistent PatientRecord.
 */
export function intakeToPatientRecord(intake: IntakeData, caseId: string): PatientRecord {
  const { identity, anthropometrics, reserveMarkers, diagnosis, cycleIntent } = intake;
  const now = new Date().toISOString();

  const values: Record<string, FieldValue> = {
    fullName: identity.fullName || "Unnamed Patient",
    fileNumber: identity.mrn || "00000",
    dob: identity.dob || "",
    age: identity.age ?? undefined,
    sex: identity.sex || "female",
    partnerName: identity.partnerName || "",
    contactPhone: identity.contactPhone || "",
    allergyBand: identity.allergyBand || "",
    height: anthropometrics.heightCm ?? undefined,
    weight: anthropometrics.weightKg ?? undefined,
    bmi: anthropometrics.bmi ? Number(anthropometrics.bmi.toFixed(1)) : undefined,
    parity: anthropometrics.parity ?? 0,
    gravidity: anthropometrics.gravidity ?? 0,
    previousAttempts: anthropometrics.previousIvfAttempts,
    previousOhss: anthropometrics.previousOhss ? "Yes" : "No",
    smoking: anthropometrics.smokingStatus,
    comorbidities: anthropometrics.comorbidities,
    medications: anthropometrics.currentMedications,
    allergies: anthropometrics.allergies,
    amh: reserveMarkers.amh ?? undefined,
    afc: reserveMarkers.afcTotal ?? undefined,
    afcRight: reserveMarkers.afcRight ?? undefined,
    afcLeft: reserveMarkers.afcLeft ?? undefined,
    fsh: reserveMarkers.basalFsh ?? undefined,
    e2: reserveMarkers.basalE2 ?? undefined,
    lh: reserveMarkers.basalLh ?? undefined,
    infertilityType: diagnosis.primaryCause,
    causes: [diagnosis.primaryCause, ...diagnosis.secondaryFlags],
    infertilityDuration: diagnosis.infertilityDuration ?? undefined,
    cycleType: cycleIntent.cycleType,
    transferPolicy: cycleIntent.transferPolicy,
    cycleNumber: cycleIntent.cycleNumber,
  };

  const record: PatientRecord = {
    id: caseId,
    name: identity.fullName || "Unnamed Patient",
    fileNumber: identity.mrn || "00000",
    age: identity.age ? `${identity.age}` : "—",
    partnerAge: "—",
    infertilityType: diagnosis.primaryCause || "Unexplained",
    causes: [diagnosis.primaryCause, ...diagnosis.secondaryFlags].filter(Boolean),
    cycles: cycleIntent.cycleNumber || 1,
    completion: reserveMarkers.amh && reserveMarkers.afcTotal ? 100 : 50,
    alerts: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    values,
    cycleRecords: [],
  };

  return record;
}

/**
 * Creates a pre-drafted baseline (D0) encounter from intake reserve markers.
 */
export function intakeToBaselineEncounter(intake: IntakeData, caseId: string): Encounter {
  const { reserveMarkers, cycleIntent } = intake;
  const today: string = new Date().toISOString().split("T")[0] ?? "";

  const rightAfc = reserveMarkers.afcRight ?? 0;
  const leftAfc = reserveMarkers.afcLeft ?? 0;

  return {
    id: `enc-${caseId}-d0`,
    caseId,
    day: 0,
    date: today,
    ultrasound: {
      folliclesRight: { lt10: rightAfc, b10_13: 0, b14_16: 0, gte17: 0 },
      folliclesLeft: { lt10: leftAfc, b10_13: 0, b14_16: 0, gte17: 0 },
      largestFollicleMm: undefined,
      endometriumMm: undefined,
    },
    labs: {
      amhNgMl: reserveMarkers.amh ?? undefined,
      estradiolPgMl: reserveMarkers.basalE2 ?? undefined,
      lhMiuMl: reserveMarkers.basalLh ?? undefined,
    },
    medications: {
      gonadotropinType: "Baseline Assessment",
      gonadotropinDoseIU: 0,
    },
    adjustment: {
      direction: "hold",
      deltaIU: 0,
      reason: "Baseline evaluation prior to stimulation initiation.",
    },
    note: `Baseline encounter auto-created from patient intake. Protocol intent: ${cycleIntent.cycleType}.`,
    status: "Draft",
    audit: [
      {
        at: new Date().toISOString(),
        by: "intake_coordinator",
        action: "created_baseline_from_intake",
        hash: `d0-${caseId}-${Date.now()}`,
      },
    ],
  };
}

/**
 * Saves both PatientRecord and baseline Encounter to storage and dispatches sync events.
 */
export function saveCaseFromIntake(intake: IntakeData, caseId: string) {
  const patient = intakeToPatientRecord(intake, caseId);
  const baselineEncounter = intakeToBaselineEncounter(intake, caseId);

  // 1. Save patient record
  savePatient(patient);

  // 2. Persist to EncryptedStore (AES-GCM at rest)
  (async () => {
    if (!isEncryptionInitialized()) {
      try {
        await initializeEncryption(DEFAULT_DEV_PIN);
      } catch {
        /* ignore */
      }
    }
    try {
      await encryptedStore.set("cases", caseId, patient);
      await encryptedStore.set("encounters", caseId, [baselineEncounter]);
    } catch {
      /* ignore */
    }
  })();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ivf-monitoring-changed"));
  }

  return { patient, baselineEncounter };
}

export interface StratificationPreviewChip {
  label: string;
  variant: "default" | "success" | "warning" | "destructive" | "secondary" | "outline";
  icon: string;
}

export interface StratificationPreviewResult {
  isComplete: boolean;
  chips: StratificationPreviewChip[];
  strat?: StratificationResult;
}

/**
 * Pure helper to compute reactive stratification preview from IntakeData.
 * Runs instantly without requiring any button click.
 */
export function computeStratificationPreview(intake: IntakeData): StratificationPreviewResult {
  const { identity, reserveMarkers } = intake;
  const hasAge = identity.age !== null && identity.age > 0;
  const hasAmh = reserveMarkers.amh !== null && reserveMarkers.amh >= 0;
  const hasAfc =
    reserveMarkers.afcTotal !== null ||
    (reserveMarkers.afcRight !== null && reserveMarkers.afcLeft !== null);

  const isMinimumDataPresent = hasAge && hasAmh && hasAfc;

  if (!isMinimumDataPresent) {
    return {
      isComplete: false,
      chips: [],
    };
  }

  const mockCase: ClinicalCaseInput = {
    patient: intakeToPatientRecord(intake, "preview-case"),
    visits: [],
  };

  try {
    const strat = runStratification(mockCase);
    const chips: StratificationPreviewChip[] = [
      {
        label: strat.poseidon.group
          ? `POSEIDON ${strat.poseidon.groupLabel}`
          : "POSEIDON: Non-Low Prognosis",
        variant: strat.poseidon.group ? "warning" : "success",
        icon: "◆",
      },
      {
        label: `Bologna: ${strat.bologna.status === "positive" ? "Fulfilled" : "Negative"}`,
        variant: strat.bologna.status === "positive" ? "destructive" : "success",
        icon: "■",
      },
      {
        label: `Response: ${strat.ovarianResponse.category.toUpperCase()}`,
        variant:
          strat.ovarianResponse.category === "high" || strat.ovarianResponse.category === "hyper"
            ? "destructive"
            : strat.ovarianResponse.category === "poor" ||
                strat.ovarianResponse.category === "very-poor"
              ? "warning"
              : "success",
        icon: "●",
      },
    ];

    return {
      isComplete: true,
      chips,
      strat,
    };
  } catch {
    return {
      isComplete: false,
      chips: [],
    };
  }
}
