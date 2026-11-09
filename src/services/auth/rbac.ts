/**
 * Service-Layer RBAC & Permission Enforcement Engine (§2.4)
 *
 * Enforces role authorization strictly in the service layer (not just UI buttons):
 *  - requireRole(allowedRoles, actionName, caseId)
 *  - Throws PermissionDeniedError if role does not match.
 *  - Logs role escalation attempts to the tamper-evident audit log as "role.escalation.denied".
 *  - Enforces session lock checks before allowing mutating actions.
 */

import { getSession, type Role } from "./session";
import { appendAuditEntry } from "../audit/auditLog";

export class PermissionDeniedError extends Error {
  public readonly action: string;
  public readonly currentRole: Role;
  public readonly requiredRoles: Role[];

  constructor(action: string, currentRole: Role, requiredRoles: Role[]) {
    super(
      `PERMISSION_DENIED: Role "${currentRole}" is not authorized to execute "${action}". Required role: [${requiredRoles.join(", ")}].`,
    );
    this.name = "PermissionDeniedError";
    this.action = action;
    this.currentRole = currentRole;
    this.requiredRoles = requiredRoles;
  }
}

/**
 * Service-layer guard that MUST be called at the entry point of all mutating clinical operations.
 */
export function requireRole(
  allowedRoles: Role | Role[],
  actionName: string = "mutating_action",
  caseId?: string,
): void {
  const session = getSession();

  if (session.locked) {
    throw new Error(
      `SESSION_LOCKED: Action "${actionName}" blocked. Re-authenticate with device PIN.`,
    );
  }

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!allowed.includes(session.role)) {
    // Log role escalation attempt to the tamper-evident audit trail
    appendAuditEntry({
      by: session.userId,
      action: "role.escalation.denied",
      caseId,
      details: {
        attemptedAction: actionName,
        currentRole: session.role,
        requiredRoles: allowed,
      },
    }).catch(() => {});

    throw new PermissionDeniedError(actionName, session.role, allowed);
  }
}
