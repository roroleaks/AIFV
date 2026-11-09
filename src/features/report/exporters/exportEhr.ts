/**
 * EHR Export Adapter Interface & Stub (§2.6)
 *
 * Provides a clean extensible adapter interface for hospital Electronic Health
 * Record (EHR) integration (e.g. Epic, Cerner, HL7 v2, openEHR).
 *
 * Phase 4 ships the typed adapter interface and a compliant HL7 v2.5.1 / JSON
 * transmission payload stub.
 */

import type { Report } from "../types";

export interface EhrExportPayload {
  caseId: string;
  reportId: string;
  version: number;
  format: "HL7_V2" | "OPEN_EHR_JSON" | "CUSTOM_INTEGRATION";
  timestamp: string;
  messageType: string;
  payload: string;
  checksum: string;
}

export interface EhrExportAdapter {
  exportToEhr(
    report: Report,
  ): Promise<{ success: boolean; payload: EhrExportPayload; transmissionId: string }>;
}

/**
 * Standard HL7 v2.5.1 ORU^R01 (Observational Report Unsolicited) formatter stub.
 */
export function buildHl7OruMessage(report: Report): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const msgId = `MSG-${report.caseId}-${report.version}-${Date.now()}`;
  const mrn = report.snapshot?.caseMetadata?.patient?.fileNumber || "00482";
  const pName = (report.snapshot?.caseMetadata?.patient?.name || "Patient").replace(/\s+/g, "^");
  const docName = (report.signedBy || "Physician").replace(/\s+/g, "^");

  const segments: string[] = [
    `MSH|^~\\&|AIFV_CDSS|AIFV_CLINIC|HOSPITAL_EHR|LAB_DEPT|${ts}||ORU^R01^ORU_R01|${msgId}|P|2.5.1`,
    `PID|1||${mrn}^^^AIFV^MR||${pName}|||F`,
    `PV1|1|O|REPRO_MED^^^AIFV|||||||||||||||||||||||||||||||||||||||||`,
    `ORC|RE|${report.id}|${report.id}||CM||||${ts}|||${docName}^^^^MD`,
    `OBR|1|${report.id}|${report.id}|IVF_DOSSIER^IVF Clinical Dossier^LN|||${ts}|||||||||||||||F`,
  ];

  // Append OBX lines for each compiled section
  report.sections.forEach((sec, idx) => {
    const obxIdx = idx + 1;
    const cleanSummary = sec.summary.replace(/\|/g, "/");
    segments.push(
      `OBX|${obxIdx}|TX|SEC_${sec.number}^${sec.title}^L||${cleanSummary}||||||F|||${ts}`,
    );
  });

  return segments.join("\r");
}

/**
 * Simple checksum helper (FNV-1a 32-bit hex)
 */
function computeChecksum(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Default Stub EHR Adapter implementation
 */
export const defaultEhrAdapter: EhrExportAdapter = {
  async exportToEhr(report: Report) {
    const payloadStr = buildHl7OruMessage(report);
    const payload: EhrExportPayload = {
      caseId: report.caseId,
      reportId: report.id,
      version: report.version,
      format: "HL7_V2",
      timestamp: new Date().toISOString(),
      messageType: "ORU^R01",
      payload: payloadStr,
      checksum: computeChecksum(payloadStr),
    };

    return {
      success: true,
      payload,
      transmissionId: `TX-${report.caseId}-${Date.now()}`,
    };
  },
};

/**
 * Browser-facing or test helper exportEhr
 */
export function exportEhr(report: Report): EhrExportPayload {
  const payloadStr = buildHl7OruMessage(report);
  return {
    caseId: report.caseId,
    reportId: report.id,
    version: report.version,
    format: "HL7_V2",
    timestamp: new Date().toISOString(),
    messageType: "ORU^R01",
    payload: payloadStr,
    checksum: computeChecksum(payloadStr),
  };
}
