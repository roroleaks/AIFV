/**
 * Clinical Intake Domain Types (§2.1 & §4)
 *
 * Types for the 5-section intake drawer:
 * 1. Identity
 * 2. Anthropometrics & History
 * 3. Reserve Markers
 * 4. Infertility Diagnosis
 * 5. Cycle Intent
 */

export interface IntakeIdentity {
  mrn: string;
  fullName: string;
  dob: string;
  age: number | null;
  sex: string;
  partnerName: string;
  contactPhone: string;
  allergyBand: string;
}

export type SmokingStatus = "never" | "former" | "current";

export interface IntakeAnthropometrics {
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  parity: number | null;
  gravidity: number | null;
  previousIvfAttempts: number;
  previousIvfOutcomes: string;
  previousOhss: boolean;
  smokingStatus: SmokingStatus;
  comorbidities: string[]; // 'PCOS' | 'Endometriosis' | 'Thyroid' | 'Autoimmune' | 'DOR' | 'Other'
  currentMedications: string;
  allergies: string;
}

export interface IntakeReserveMarkers {
  amh: number | null;
  afcRight: number | null;
  afcLeft: number | null;
  afcTotal: number | null;
  basalFsh: number | null;
  basalE2: number | null;
  basalLh: number | null;
  antralFolliclePattern: string;
}

export type PrimaryInfertilityCause =
  | "male-factor"
  | "tubal"
  | "ovulatory"
  | "unexplained"
  | "endometriosis"
  | "genetic"
  | "advanced-maternal-age"
  | "mixed";

export interface IntakeDiagnosis {
  primaryCause: PrimaryInfertilityCause;
  secondaryFlags: string[];
  infertilityDuration: number | null; // months
  previousTreatments: string;
}

export type CycleIntentType = "IVF" | "ICSI" | "ICSI + PGT-A" | "freeze-all" | "DuoStim";

export type EmbryoTransferPolicy = "fresh" | "freeze-all" | "planned fresh with fallback freeze";

export interface IntakeCycleIntent {
  cycleType: CycleIntentType;
  transferPolicy: EmbryoTransferPolicy;
  cycleNumber: number;
}

export interface IntakeData {
  identity: IntakeIdentity;
  anthropometrics: IntakeAnthropometrics;
  reserveMarkers: IntakeReserveMarkers;
  diagnosis: IntakeDiagnosis;
  cycleIntent: IntakeCycleIntent;
}

export const INITIAL_INTAKE_DATA: IntakeData = {
  identity: {
    mrn: "",
    fullName: "",
    dob: "",
    age: null,
    sex: "female",
    partnerName: "",
    contactPhone: "",
    allergyBand: "",
  },
  anthropometrics: {
    heightCm: null,
    weightKg: null,
    bmi: null,
    parity: 0,
    gravidity: 0,
    previousIvfAttempts: 0,
    previousIvfOutcomes: "",
    previousOhss: false,
    smokingStatus: "never",
    comorbidities: [],
    currentMedications: "",
    allergies: "",
  },
  reserveMarkers: {
    amh: null,
    afcRight: null,
    afcLeft: null,
    afcTotal: null,
    basalFsh: null,
    basalE2: null,
    basalLh: null,
    antralFolliclePattern: "",
  },
  diagnosis: {
    primaryCause: "unexplained",
    secondaryFlags: [],
    infertilityDuration: null,
    previousTreatments: "",
  },
  cycleIntent: {
    cycleType: "ICSI",
    transferPolicy: "fresh",
    cycleNumber: 1,
  },
};
