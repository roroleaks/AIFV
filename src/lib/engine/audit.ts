/**
 * Engine audit log — append-only activity trail stored locally.
 * Reserved for future calculation history; no clinical output is recorded.
 */

import { useCallback, useEffect, useState } from "react";

export type AuditAction =
  | "queue-evaluated"
  | "module-enabled"
  | "module-disabled"
  | "module-inspected"
  | "settings-updated"
  | "assessment-completed"
  | "physician-decision";

export const auditActionLabels: Record<AuditAction, string> = {
  "queue-evaluated": "Queue evaluated",
  "module-enabled": "Module enabled",
  "module-disabled": "Module disabled",
  "module-inspected": "Module inspected",
  "settings-updated": "Settings updated",
  "assessment-completed": "Assessment completed",
  "physician-decision": "Physician decision recorded",
};

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  patient: string;
  moduleId: string | null;
  moduleName: string;
  action: AuditAction;
  version: string;
  detail?: string;
}

const KEY = "ivf-ai-calc.audit-log";
const LIMIT = 200;

function read(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  window.dispatchEvent(new CustomEvent("ivf-audit-changed"));
}

export function logAudit(entry: Omit<AuditEntry, "id" | "timestamp">) {
  const full: AuditEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  write([full, ...read()]);
  return full;
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const sync = () => setEntries(read());
    sync();
    window.addEventListener("ivf-audit-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ivf-audit-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const clear = useCallback(() => write([]), []);

  return { entries, log: logAudit, clear };
}
