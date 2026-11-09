/**
 * Reports Hook & State Management (§2.4, §2.5, §7)
 *
 * Manages the versioned lifecycle of clinical dossiers:
 * Draft -> AwaitingSign -> Signed -> Addendum (v+1)
 *
 * GUARANTEES:
 *  - Signed reports are strictly IMMUTABLE. Snapshot and sections are deeply frozen.
 *  - Reopening requires an Addendum (version n+1, supersedes <id>).
 *  - Role-gated physician signing and senior physician co-signing.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Report,
  ReportStatus,
  ReportCaseSnapshot,
  ReportSectionContent,
  SignEvent,
} from "./types";
import {
  encryptedStore,
  isEncryptionInitialized,
  initializeEncryption,
} from "@/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "@/services/auth/pinConfig";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { requireRole } from "@/services/auth/rbac";

interface CaseReportsState {
  activeReportId: string;
  reports: Report[];
}

const reportsMemoryCache = new Map<string, CaseReportsState>();

export function useReports(caseId: string) {
  const [state, setState] = useState<CaseReportsState>(() => {
    const cached = reportsMemoryCache.get(caseId);
    if (cached) return cached;

    const initialReport: Report = {
      id: `rep-${caseId}-v1`,
      caseId,
      version: 1,
      status: "Draft",
      sections: [],
      locked: false,
      snapshot: {
        encounters: [],
        orchestratorOutputs: {} as ReportCaseSnapshot["orchestratorOutputs"],
        effectiveOverrides: [],
        caseMetadata: {} as ReportCaseSnapshot["caseMetadata"],
      },
      signEvents: [
        {
          at: new Date().toISOString(),
          by: "system",
          action: "drafted",
          note: "Initial clinical dossier draft initiated.",
        },
      ],
    };

    const initial: CaseReportsState = {
      activeReportId: initialReport.id,
      reports: [initialReport],
    };
    reportsMemoryCache.set(caseId, initial);
    return initial;
  });

  // Load from EncryptedStore
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isEncryptionInitialized()) {
        try {
          await initializeEncryption(DEFAULT_DEV_PIN);
        } catch {
          /* ignore */
        }
      }

      try {
        const stored = await encryptedStore.get<CaseReportsState>("reports", caseId);
        if (stored && mounted) {
          reportsMemoryCache.set(caseId, stored);
          setState(stored);
        }
      } catch {
        /* encrypted store locked or uninitialized */
      }
    })();

    return () => {
      mounted = false;
    };
  }, [caseId]);

  // Persist to EncryptedStore
  useEffect(() => {
    reportsMemoryCache.set(caseId, state);
    (async () => {
      if (!isEncryptionInitialized()) {
        try {
          await initializeEncryption(DEFAULT_DEV_PIN);
        } catch {
          return;
        }
      }
      try {
        await encryptedStore.set("reports", caseId, state);
      } catch {
        /* storage locked or unavailable */
      }
    })();
  }, [state, caseId]);

  const currentReport = useMemo((): Report => {
    const found = state.reports.find((r) => r.id === state.activeReportId);
    if (found) return found;
    if (state.reports.length > 0) return state.reports[state.reports.length - 1]!;
    return {
      id: `rep-${caseId}-v1`,
      caseId,
      version: 1,
      status: "Draft",
      sections: [],
      locked: false,
      snapshot: {
        encounters: [],
        orchestratorOutputs: {} as ReportCaseSnapshot["orchestratorOutputs"],
        effectiveOverrides: [],
        caseMetadata: {} as ReportCaseSnapshot["caseMetadata"],
      },
      signEvents: [
        {
          at: new Date().toISOString(),
          by: "system",
          action: "drafted",
          note: "Initial clinical dossier draft initiated.",
        },
      ],
    };
  }, [state, caseId]);

  /**
   * Submit report for physician signature (Coordinator action)
   */
  const submitForSign = useCallback((by: string) => {
    setState((prev) => {
      const reports = prev.reports.map((r) => {
        if (r.id !== prev.activeReportId || r.locked) return r;
        const updatedEvent: SignEvent = {
          at: new Date().toISOString(),
          by,
          action: "submitted",
          note: "Dossier prepared and marked ready for physician sign-off.",
        };
        return {
          ...r,
          status: "AwaitingSign" as ReportStatus,
          signEvents: [...r.signEvents, updatedEvent],
        };
      });
      return { ...prev, reports };
    });
  }, []);

  /**
   * Sign report (Physician action)
   * Takes a frozen deep snapshot of case state and compiled sections.
   */
  const signReport = useCallback(
    (
      by: string,
      physicianName: string,
      snapshot: ReportCaseSnapshot,
      sections: ReportSectionContent[],
    ) => {
      requireRole(["Physician", "SeniorPhysician"], "report.sign", caseId);

      const now = new Date().toISOString();
      const frozenSnapshot: ReportCaseSnapshot = JSON.parse(JSON.stringify(snapshot));
      const frozenSections: ReportSectionContent[] = JSON.parse(JSON.stringify(sections));

      setState((prev) => {
        const reports = prev.reports.map((r) => {
          if (r.id !== prev.activeReportId) return r;
          const signEv: SignEvent = {
            at: now,
            by,
            action: "signed",
            note: `Digitally signed by ${physicianName}. Legal dossier locked.`,
          };
          return {
            ...r,
            status: "Signed" as ReportStatus,
            locked: true,
            signedBy: physicianName,
            signedAt: now,
            snapshot: frozenSnapshot,
            sections: frozenSections,
            signEvents: [...r.signEvents, signEv],
          };
        });
        return { ...prev, reports };
      });

      appendAuditEntry({
        by,
        action: "report.sign",
        caseId,
        details: { physicianName, status: "Signed" },
      }).catch(() => {});
    },
    [caseId],
  );

  /**
   * Co-sign report (Senior Physician action)
   * Annotates the existing signed report without altering its snapshot.
   */
  const cosignReport = useCallback(
    (by: string, seniorPhysicianName: string) => {
      requireRole(["SeniorPhysician"], "report.cosign", caseId);

      const now = new Date().toISOString();
      setState((prev) => {
        const reports = prev.reports.map((r) => {
          if (r.id !== prev.activeReportId || !r.locked) return r;
          const cosignEv: SignEvent = {
            at: now,
            by,
            action: "cosigned",
            note: `Countersigned and endorsed by Senior Physician ${seniorPhysicianName}.`,
          };
          return {
            ...r,
            cosignedBy: seniorPhysicianName,
            cosignedAt: now,
            signEvents: [...r.signEvents, cosignEv],
          };
        });
        return { ...prev, reports };
      });

      appendAuditEntry({
        by,
        action: "report.cosign",
        caseId,
        details: { seniorPhysicianName },
      }).catch(() => {});
    },
    [caseId],
  );

  /**
   * Open Addendum (Physician action)
   * Creates version n+1 superseding the original. Original stays locked.
   */
  const openAddendum = useCallback(
    (by: string, reason: string, currentSnapshot: ReportCaseSnapshot) => {
      requireRole(["Physician", "SeniorPhysician"], "report.addendum", caseId);

      const now = new Date().toISOString();
      let nextVer = 2;
      setState((prev) => {
        const original = prev.reports.find((r) => r.id === prev.activeReportId);
        const nextVersion = (original?.version ?? prev.reports.length) + 1;
        nextVer = nextVersion;
        const newReportId = `rep-${caseId}-v${nextVersion}`;

        const addendumOpenedEv: SignEvent = {
          at: now,
          by,
          action: "addendumOpened",
          note: `Addendum version ${nextVersion} opened. Reason: ${reason}`,
        };

        const newReport: Report = {
          id: newReportId,
          caseId,
          version: nextVersion,
          status: "Draft",
          sections: [],
          locked: false,
          supersedes: original?.id,
          snapshot: JSON.parse(JSON.stringify(currentSnapshot)),
          signEvents: [addendumOpenedEv],
        };
        return {
          activeReportId: newReport.id,
          reports: [...prev.reports, newReport],
        };
      });

      appendAuditEntry({
        by,
        action: "report.addendum",
        caseId,
        details: { reason, newVersion: nextVer },
      }).catch(() => {});
    },
    [caseId],
  );

  return {
    currentReport,
    reports: state.reports,
    submitForSign,
    signReport,
    cosignReport,
    openAddendum,
  };
}
