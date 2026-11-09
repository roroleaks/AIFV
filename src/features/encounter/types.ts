/**
 * Encounter Domain Types (Phase 2)
 *
 * Longitudinal encounter data model per §11 and §5 of the Redesign Prompt.
 */

export type EncounterStatus = "Draft" | "Entered" | "Verified" | "Locked";

export type DoseAdjustmentDirection = "up" | "down" | "coast" | "hold";

export type EndometriumPattern = "triple-line" | "echogenic" | "homogeneous";

export interface FollicleBucket {
  lt10: number;
  b10_13: number;
  b14_16: number;
  gte17: number;
}

export interface AuditEntry {
  at: string;
  by: string;
  action: string;
  reason?: string | undefined;
  hash: string;
  prevHash?: string | undefined;
}

export interface Encounter {
  id: string;
  caseId: string;
  date: string;
  day: number; // stim day 0, 2, 6, 8...
  weightKg?: number | undefined;
  ultrasound: {
    folliclesRight: FollicleBucket;
    folliclesLeft: FollicleBucket;
    largestFollicleMm?: number | undefined;
    endometriumMm?: number | undefined;
    endometriumPattern?: EndometriumPattern | undefined;
  };
  labs: {
    estradiolPgMl?: number | undefined;
    lhMiuMl?: number | undefined;
    progesteroneNgMl?: number | undefined;
    amhNgMl?: number | undefined;
  };
  medications: {
    gonadotropinType: string;
    gonadotropinDoseIU: number;
    antagonistDoseMg?: number | undefined;
    addons?: string[] | undefined;
  };
  adjustment: {
    direction: DoseAdjustmentDirection;
    deltaIU: number;
    reason: string;
  };
  note?: string | undefined;
  status: EncounterStatus;
  audit: AuditEntry[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "hard" | "soft";
  suggestedAction?: string | undefined;
}

export interface SoftWarning {
  field: string;
  message: string;
  triggerCondition: string;
}

export interface InlineEngineChip {
  id: string;
  engine: "POSEIDON" | "CONSORT" | "OHSS" | "MONITORING" | "ESHRE";
  label: string;
  variant: "info" | "warning" | "success" | "destructive";
  rationale: string;
  citationId?: string | undefined;
  citationText?: string | undefined;
  guidelineRule?: string | undefined;
}
