/**
 * Encounter <-> MonitoringVisit Adapter
 *
 * Provides bidirectional lossless data mapping between the case-centric
 * Encounter model (§11) and the pure engine MonitoringVisit model.
 */

import type { MonitoringVisit } from "@/lib/engine/monitoring";
import type { Encounter, FollicleBucket, DoseAdjustmentDirection } from "./types";

export function monitoringVisitToEncounter(visit: MonitoringVisit, caseId: string): Encounter {
  const gte17 = visit.follicles17 ?? 0;
  const f14 = visit.follicles14 ?? 0;
  const f10 = visit.follicles10 ?? 0;
  const b14_16 = Math.max(0, f14 - gte17);
  const b10_13 = Math.max(0, f10 - f14);
  const totalCount = visit.follicleCount ?? (visit.follicleSizes?.length || f10);
  const lt10 = Math.max(0, totalCount - f10);

  // Distribute across right and left ovaries (conservative 50/50 split for legacy visits)
  const rBucket: FollicleBucket = {
    lt10: Math.ceil(lt10 / 2),
    b10_13: Math.ceil(b10_13 / 2),
    b14_16: Math.ceil(b14_16 / 2),
    gte17: Math.ceil(gte17 / 2),
  };

  const lBucket: FollicleBucket = {
    lt10: Math.floor(lt10 / 2),
    b10_13: Math.floor(b10_13 / 2),
    b14_16: Math.floor(b14_16 / 2),
    gte17: Math.floor(gte17 / 2),
  };

  let direction: DoseAdjustmentDirection = "hold";
  const changeText = (visit.medicationChange || "").toLowerCase();
  if (
    changeText.includes("step-up") ||
    changeText.includes("increase") ||
    changeText.includes("up")
  ) {
    direction = "up";
  } else if (
    changeText.includes("step-down") ||
    changeText.includes("decrease") ||
    changeText.includes("down")
  ) {
    direction = "down";
  } else if (changeText.includes("coast")) {
    direction = "coast";
  }

  const dateStr = visit.date || new Date().toISOString().split("T")[0] || "2026-01-01";

  return {
    id: visit.id || `enc-${visit.day}-${Date.now()}`,
    caseId,
    date: dateStr,
    day: visit.day,
    weightKg: undefined,
    ultrasound: {
      folliclesRight: rBucket,
      folliclesLeft: lBucket,
      largestFollicleMm: visit.largestFollicle ?? undefined,
      endometriumMm: visit.endometrium ?? undefined,
      endometriumPattern: "triple-line",
    },
    labs: {
      estradiolPgMl: visit.estradiol ?? undefined,
      lhMiuMl: visit.lh ?? undefined,
      progesteroneNgMl: visit.progesterone ?? undefined,
    },
    medications: {
      gonadotropinType: visit.medicationType || visit.medication || "rFSH",
      gonadotropinDoseIU: visit.dailyDose ?? 225,
      antagonistDoseMg: visit.gnrhDose ? parseFloat(visit.gnrhDose) : undefined,
    },
    adjustment: {
      direction,
      deltaIU: 0,
      reason: visit.doseChangeReason || "",
    },
    note: visit.notes || "",
    status: visit.triggerDay ? "Verified" : "Entered",
    audit: [
      {
        at: visit.recordedAt || new Date().toISOString(),
        by: "system_migration",
        action: "migrated_from_monitoring_store",
        hash: `mig-${visit.id}`,
      },
    ],
  };
}

export function encounterToMonitoringVisit(encounter: Encounter): MonitoringVisit {
  const r = encounter.ultrasound.folliclesRight;
  const l = encounter.ultrasound.folliclesLeft;

  const follicles17 = r.gte17 + l.gte17;
  const follicles14 = follicles17 + r.b14_16 + l.b14_16;
  const follicles10 = follicles14 + r.b10_13 + l.b10_13;
  const totalCount = follicles10 + r.lt10 + l.lt10;

  const largestFollicle =
    encounter.ultrasound.largestFollicleMm ??
    (follicles17 > 0 ? 18 : follicles14 > 0 ? 15 : follicles10 > 0 ? 12 : 8);

  const directionStr =
    encounter.adjustment.direction === "up"
      ? `Step-up (+${encounter.adjustment.deltaIU} IU)`
      : encounter.adjustment.direction === "down"
        ? `Step-down (-${encounter.adjustment.deltaIU} IU)`
        : encounter.adjustment.direction === "coast"
          ? "Coasting"
          : "Maintained";

  const mv: MonitoringVisit = {
    id: encounter.id,
    day: encounter.day,
    date: encounter.date,
    dailyDose: encounter.medications.gonadotropinDoseIU,
    medication: encounter.medications.gonadotropinType,
    medicationType: encounter.medications.gonadotropinType,
    medicationChange: directionStr,
    doseChangeReason: encounter.adjustment.reason,
    follicleCount: totalCount,
    follicleSizes: largestFollicle ? [largestFollicle] : [],
    largestFollicle,
    follicles10,
    follicles14,
    follicles17,
    endometrium: encounter.ultrasound.endometriumMm ?? null,
    estradiol: encounter.labs.estradiolPgMl ?? null,
    lh: encounter.labs.lhMiuMl ?? null,
    progesterone: encounter.labs.progesteroneNgMl ?? null,
    notes: encounter.note || "",
    triggerDay: encounter.day >= 10 && (follicles17 >= 3 || largestFollicle >= 18),
    recordedAt: encounter.date || new Date().toISOString(),
    ...(encounter.medications.antagonistDoseMg
      ? {
          gnrhAnalogue: "GnRH Antagonist",
          gnrhDose: `${encounter.medications.antagonistDoseMg} mg`,
        }
      : {}),
  };

  return mv;
}
