/**
 * IVF Clinical Dossier & Report Types (§7 & Phase 4 Spec)
 *
 * Types for the 16-section clinical dossier, live preview, frozen snapshot at
 * sign time, sign / addendum / co-sign lifecycle, and exporter payloads.
 */

import type { CaseSummary } from "@/features/case/types";
import type { Encounter } from "@/features/encounter/types";
import type { Override } from "@/services/clinical/types";
import type {
  StratificationResult,
  ProtocolPlanResult,
  TriggerDecisionResult,
} from "@/services/clinical/types";
import type {
  IntelligenceReport,
  ReportField,
  ReportList,
  ReportTable,
  SectionStatus,
} from "@/lib/report/intelligence-report";

export type { ReportField, ReportList, ReportTable, SectionStatus };

export type ReportStatus = "Draft" | "AwaitingSign" | "Signed" | "Addendum";

export type UserId = string;
export type ISODate = string;

export interface ReportSectionOverride {
  field: string;
  label: string;
  originalValue: string;
  overrideValue: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

export interface ReportSectionContent {
  id: string;
  number: number;
  title: string;
  icon?: string | undefined;
  status: SectionStatus;
  summary: string;
  fields: ReportField[];
  lists: ReportList[];
  tables: ReportTable[];
  pendingNote?: string | undefined;
  /** Presentation overrides active on this section */
  overrides?: ReportSectionOverride[] | undefined;
}

export interface ReportContext {
  caseId: string;
  caseMetadata: CaseSummary;
  encounters: Encounter[];
  orchestratorOutputs: {
    stratification: StratificationResult;
    plan: ProtocolPlanResult;
    trigger: TriggerDecisionResult;
  };
  effectiveOverrides: Override[];
  rawIntelligenceReport: IntelligenceReport;
}

export interface ReportSection {
  id: string;
  title: string;
  defaultOn: boolean;
  renderer: (ctx: ReportContext) => ReportSectionContent;
}

export interface SignEvent {
  at: ISODate;
  by: UserId;
  action: "drafted" | "submitted" | "signed" | "cosigned" | "addendumOpened";
  note?: string;
}

export interface ReportCaseSnapshot {
  encounters: Encounter[];
  orchestratorOutputs: {
    stratification: StratificationResult;
    plan: ProtocolPlanResult;
    trigger: TriggerDecisionResult;
  };
  effectiveOverrides: Override[];
  caseMetadata: CaseSummary;
}

export interface Report {
  id: string;
  caseId: string;
  version: number;
  status: ReportStatus;
  sections: ReportSectionContent[];
  signedBy?: UserId | undefined;
  signedAt?: ISODate | undefined;
  cosignedBy?: UserId | undefined;
  cosignedAt?: ISODate | undefined;
  locked: boolean;
  supersedes?: string | undefined;
  snapshot: ReportCaseSnapshot;
  signEvents: SignEvent[];
}

export interface SectionAdminConfig {
  sectionId: string;
  enabled: boolean;
  order: number;
}
