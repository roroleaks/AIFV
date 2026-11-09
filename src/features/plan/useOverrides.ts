/**
 * Plan Overrides Hook (§2.3, §2.4)
 *
 * Provides presentation-layer physician override storage and retrieval.
 * Engine outputs remain pure and unmutated; overrides only alter what the Plan
 * and Report cards present.
 *
 * Persisted in EncryptedStore (IndexedDB AES-GCM) with zero plaintext browser storage.
 */

import { useState, useEffect, useCallback } from "react";
import type { Override, EngineName } from "@/services/clinical/types";
import {
  encryptedStore,
  isEncryptionInitialized,
  initializeEncryption,
} from "@/services/persistence/encryptedIndexedDB";
import { DEFAULT_DEV_PIN } from "@/services/auth/pinConfig";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { requireRole } from "@/services/auth/rbac";

const CHANGE_EVENT = "ivf-overrides-changed";
const overridesMemoryCache = new Map<string, Override[]>();

export function useOverrides(caseId: string) {
  const [overrides, setOverrides] = useState<Override[]>(() => {
    return overridesMemoryCache.get(caseId) ?? [];
  });

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      if (!isEncryptionInitialized()) {
        try {
          await initializeEncryption(DEFAULT_DEV_PIN);
        } catch {
          /* ignore */
        }
      }

      try {
        const stored = await encryptedStore.get<Override[]>("overrides", caseId);
        if (stored && mounted) {
          overridesMemoryCache.set(caseId, stored);
          setOverrides(stored);
        } else if (mounted) {
          const cached = overridesMemoryCache.get(caseId) ?? [];
          setOverrides(cached);
        }
      } catch {
        if (mounted) {
          setOverrides(overridesMemoryCache.get(caseId) ?? []);
        }
      }
    };

    sync();

    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      mounted = false;
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, [caseId]);

  const addOverride = useCallback(
    async (input: Omit<Override, "id" | "at">) => {
      requireRole(["Physician", "SeniorPhysician"], "override.apply", caseId);

      const newOverride: Override = {
        ...input,
        id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
      };

      const existing = overridesMemoryCache.get(caseId) ?? [];
      const filtered = existing.filter(
        (o) => !(o.engine === input.engine && o.field === input.field),
      );
      const next = [newOverride, ...filtered];

      overridesMemoryCache.set(caseId, next);
      setOverrides(next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

      if (!isEncryptionInitialized()) {
        try {
          await initializeEncryption(DEFAULT_DEV_PIN);
        } catch {
          return newOverride;
        }
      }

      try {
        await encryptedStore.set("overrides", caseId, next);
        await appendAuditEntry({
          by: newOverride.by || "Physician",
          action: "override.apply",
          caseId,
          details: {
            engine: newOverride.engine,
            field: newOverride.field,
            originalValue: newOverride.fromValue as Record<string, unknown>,
            overrideValue: newOverride.toValue as Record<string, unknown>,
            reason: newOverride.reason,
          },
        });
      } catch {
        /* storage unavailable */
      }

      return newOverride;
    },
    [caseId],
  );

  const removeOverride = useCallback(
    async (id: string) => {
      requireRole(["Physician", "SeniorPhysician"], "override.reverse", caseId);

      const existing = overridesMemoryCache.get(caseId) ?? [];
      const next = existing.filter((o) => o.id !== id);

      overridesMemoryCache.set(caseId, next);
      setOverrides(next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

      if (!isEncryptionInitialized()) {
        try {
          await initializeEncryption(DEFAULT_DEV_PIN);
        } catch {
          return;
        }
      }

      try {
        await encryptedStore.set("overrides", caseId, next);
        await appendAuditEntry({
          by: "Physician",
          action: "override.reverse",
          caseId,
          details: {
            overrideId: id,
            reason: "Physician reversed presentation override",
          },
        });
      } catch {
        /* storage unavailable */
      }
    },
    [caseId],
  );

  const getOverrideFor = useCallback(
    (engine: EngineName, field: string): Override | undefined => {
      return overrides.find((o) => o.engine === engine && o.field === field);
    },
    [overrides],
  );

  return {
    overrides,
    addOverride,
    removeOverride,
    getOverrideFor,
  };
}
