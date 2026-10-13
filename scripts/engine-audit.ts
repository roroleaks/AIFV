/**
 * PROMPT 41 — end-to-end engine execution harness (software audit only).
 *
 * Executes EVERY clinical engine against synthetic software test cases and
 * prints the real returned output. These fixtures are software test data and
 * are not clinical cases; nothing here is a recommendation.
 *
 * Run: bun scripts/engine-audit.ts
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { buildPatientContext } from "@/lib/clinical/data-mapping";
import { classifyPoseidon } from "@/lib/engine/poseidon";
import { assessBologna } from "@/lib/engine/bologna";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "@/lib/engine/protocol-selection";
import { buildGonadotropinSelection } from "@/lib/engine/gonadotropin-selection";
import { calculateConsortDose } from "@/lib/engine/consort-dose";
import { buildStartingDoseAssessment } from "@/lib/engine/starting-dose";
import { buildMonitoringContext, analyzeMonitoring } from "@/lib/engine/monitoring";
import { evaluateDoseAdjustment } from "@/lib/engine/dose-adjustment";
import { buildCycleCompletion } from "@/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "@/lib/engine/trigger";
import { buildIntelligenceReport } from "@/lib/report/intelligence-report";
import type { MonitoringVisit } from "@/lib/engine/monitoring";

interface Case {
  id: string;
  label: string;
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
  visits: MonitoringVisit[];
}

const cyc = (id: string, c: Record<string, FieldValue>): CycleRecord =>
  ({ id, ...c }) as unknown as CycleRecord;

const visit = (day: number, v: Partial<MonitoringVisit>): MonitoringVisit =>
  ({
    id: `v${day}`,
    day,
    date: `2026-01-${String(day).padStart(2, "0")}`,
    largestFollicle: null,
    follicleCount: null,
    follicles10: null,
    follicles14: null,
    follicles17: null,
    estradiol: null,
    lh: null,
    progesterone: null,
    endometrium: null,
    dailyDose: null,
    medication: "",
    notes: "",
    ...v,
  }) as MonitoringVisit;

export const cases: Case[] = [
  {
    id: "A",
    label: "Age 30, AMH 2.5, AFC 15, BMI 24, FSH 7, prev 10 oocytes",
    values: {
      dob: "1996-01-01",
      height: 165,
      weight: 65.3,
      amh: 2.5,
      afcLeft: 8,
      afcRight: 7,
      fsh: 7,
      infertilityType: "Primary",
      causes: ["Tubal factor"],
    },
    cycles: [
      cyc("a1", {
        cycleNumber: 1,
        cycleYear: 2025,
        type: "IVF",
        protocol: "Antagonist",
        startingDose: 225,
        retrieved: 10,
        mii: 8,
      }),
    ],
    visits: [
      visit(5, {
        largestFollicle: 11,
        follicles10: 8,
        estradiol: 620,
        endometrium: 7,
        dailyDose: 225,
      }),
      visit(8, {
        largestFollicle: 16,
        follicles10: 11,
        follicles14: 6,
        estradiol: 1650,
        endometrium: 9,
        dailyDose: 225,
      }),
      visit(10, {
        largestFollicle: 19,
        follicles10: 12,
        follicles14: 9,
        follicles17: 4,
        estradiol: 2400,
        progesterone: 0.9,
        endometrium: 10,
        dailyDose: 225,
      }),
    ],
  },
  {
    id: "B",
    label: "Age 42, AMH 0.5, AFC 3, FSH 12, prev 2 oocytes",
    values: {
      dob: "1984-01-01",
      height: 163,
      weight: 62,
      amh: 0.5,
      afcLeft: 2,
      afcRight: 1,
      fsh: 12,
      infertilityType: "Secondary",
      causes: ["Diminished ovarian reserve"],
    },
    cycles: [
      cyc("b1", {
        cycleNumber: 1,
        cycleYear: 2025,
        type: "ICSI",
        protocol: "Antagonist",
        startingDose: 300,
        retrieved: 2,
        mii: 1,
      }),
    ],
    visits: [visit(6, { largestFollicle: 12, follicles10: 3, estradiol: 380, dailyDose: 300 })],
  },
  {
    id: "C",
    label: "Age 29, AMH 5.0, AFC 28, BMI 23, prev 18 oocytes",
    values: {
      dob: "1997-01-01",
      height: 166,
      weight: 63.4,
      amh: 5,
      afcLeft: 14,
      afcRight: 14,
      fsh: 5,
      infertilityType: "Primary",
      causes: ["PCOS"],
    },
    cycles: [
      cyc("c1", {
        cycleNumber: 1,
        cycleYear: 2025,
        type: "ICSI",
        protocol: "Antagonist",
        startingDose: 150,
        retrieved: 18,
        mii: 15,
      }),
    ],
    visits: [
      visit(5, { largestFollicle: 10, follicles10: 16, estradiol: 1400, dailyDose: 150 }),
      visit(8, {
        largestFollicle: 15,
        follicles10: 22,
        follicles14: 12,
        estradiol: 4800,
        dailyDose: 150,
      }),
    ],
  },
  {
    id: "D",
    label: "Age 36, AMH 1.5, AFC 8, BMI 27, prev 7 oocytes",
    values: {
      dob: "1990-01-01",
      height: 165,
      weight: 73.5,
      amh: 1.5,
      afcLeft: 4,
      afcRight: 4,
      fsh: 8,
      infertilityType: "Primary",
      causes: ["Unexplained"],
    },
    cycles: [
      cyc("d1", {
        cycleNumber: 1,
        cycleYear: 2024,
        type: "ICSI",
        protocol: "Long agonist",
        startingDose: 225,
        retrieved: 7,
        mii: 6,
      }),
    ],
    visits: [visit(7, { largestFollicle: 14, follicles10: 7, estradiol: 1100, dailyDose: 225 })],
  },
  {
    id: "E",
    label: "Incomplete record — no DOB, AMH, AFC, no cycles, no visits",
    values: { infertilityType: "Primary" },
    cycles: [],
    visits: [],
  },
];

type Row = { engine: string; ok: boolean; summary: string };

function run(c: Case): Row[] {
  const rows: Row[] = [];
  const step = <T>(engine: string, fn: () => T, describe: (v: T) => string): T | null => {
    try {
      const v = fn();
      rows.push({ engine, ok: true, summary: describe(v) });
      return v;
    } catch (e) {
      rows.push({
        engine,
        ok: false,
        summary: `THREW: ${e instanceof Error ? e.stack?.split("\n").slice(0, 3).join(" | ") : String(e)}`,
      });
      return null;
    }
  };

  const poseidon = step(
    "POSEIDON",
    () => classifyPoseidon(c.values, c.cycles),
    (r) =>
      `${r.groupLabel} | status=${r.status} | criteria=${r.criteria?.length ?? 0} | missing=${r.missing?.length ?? 0}`,
  );
  const bologna = step(
    "Bologna",
    () => assessBologna(c.values, c.cycles),
    (r) => `${r.headline} | fulfilled=${r.fulfilled}`,
  );
  const phenotype = step(
    "Phenotype",
    () => buildPhenotype(c.values, c.cycles),
    (r) =>
      `poseidon=${r.poseidon.groupLabel} | bologna=${r.bologna.headline} | amh=${r.reserve.amh} afc=${r.reserve.afc}`,
  );
  if (!poseidon || !bologna || !phenotype) return rows;

  const response = step(
    "Ovarian response",
    () => predictOvarianResponse(c.values, c.cycles, poseidon, bologna),
    (r) => `${r.category} | ${r.headline} | risks=${r.risks.length}`,
  );
  if (!response) return rows;

  const ctx = buildPatientContext(c.values, c.cycles, response);

  const protocolRec = step(
    "Protocol recommendation",
    () => buildProtocolRecommendation("t", "Test", c.values, c.cycles, phenotype, response),
    (r) =>
      `recStatus=${r.recommendation.status} | primary=${JSON.stringify(r.recommendation.primary ?? null)} | considerations=${r.considerations.length}`,
  );
  if (!protocolRec) return rows;

  step(
    "Protocol selection",
    () => buildProtocolSelection("t", "Test", c.values, c.cycles, phenotype, response, ctx, null),
    (r) =>
      `options=${r.options.length} | cautions=${r.cautions.length} | missingInfo=${r.missingInformation.length} | consortFirewall=${r.consortFirewall.status}`,
  );

  const gonado = step(
    "Gonadotropin selection",
    () =>
      buildGonadotropinSelection("t", "Test", c.values, c.cycles, phenotype, response, protocolRec),
    (r) =>
      `status=${r.selection.status} | recommended=${JSON.stringify(r.selection.recommended)} | cycleReview=${r.cycleReview.length}`,
  );
  if (!gonado) return rows;

  step(
    "CONSORT dose",
    () => calculateConsortDose("t", "Test", c.values, c.cycles, phenotype, response),
    (r) =>
      `status=${r.status} | dose=${JSON.stringify(r.dose)} | variables=${r.variables.length} | validation=${r.validation.state ?? "-"}`,
  );

  step(
    "Starting dose",
    () => buildStartingDoseAssessment("t", "Test", c.values, c.cycles, phenotype, response),
    (r) =>
      `state=${r.state} | dose=${JSON.stringify(r.dose)} | display=${r.doseDisplay} | algorithms=${r.algorithms.length} | evidenceDoses=${r.evidenceReportedDoses.length}`,
  );

  const mctx = buildMonitoringContext(
    "t",
    "Test",
    c.values,
    c.cycles,
    phenotype,
    response,
    protocolRec,
    gonado,
    null,
  );
  const monitoring = step(
    "Monitoring",
    () => analyzeMonitoring(mctx, c.visits),
    (r) =>
      `visits=${r.visits.length} | status=${JSON.stringify(r.status)} | alerts=${r.alerts.length} | trends=${r.trends.length}`,
  );
  if (!monitoring) return rows;

  step(
    "Dose adjustment",
    () => evaluateDoseAdjustment(monitoring.visits.at(-1) ?? null),
    (r) =>
      `status=${r.status} | proposedDose=${JSON.stringify(r.proposedDose)} | observed=${r.observedValues.length}`,
  );

  const cycleC = step(
    "Cycle completion / OHSS / freeze-all",
    () =>
      buildCycleCompletion("t", "Test", phenotype, response, protocolRec, gonado, null, monitoring),
    (r) =>
      `safety=${r.safetyStatus} | trigger=${r.trigger.status} | freezeAll=${r.freezeAll.status} | ohssLevel=${JSON.stringify(r.ohss.level ?? null)} | alerts=${r.alerts.length}`,
  );
  if (!cycleC) return rows;

  step(
    "Trigger strategy",
    () => buildTriggerAssessment("t", "Test", phenotype, response, monitoring, cycleC, null),
    (r) =>
      `safety=${r.safetyStatus} | readiness=${JSON.stringify(r.readiness.status ?? r.readiness)} | options=${r.options.length} | dose=${r.triggerDoseStatus}`,
  );

  step(
    "Intelligence report",
    () =>
      buildIntelligenceReport({
        patientId: "t",
        patientName: "Test",
        values: c.values,
        cycles: c.cycles,
        phenotype,
        response,
        protocol: protocolRec,
        gonadotropin: gonado,
        consort: calculateConsortDose("t", "Test", c.values, c.cycles, phenotype, response),
        monitoring,
        cycle: cycleC,
      }),
    (r) =>
      `sections=${r.sections.length} | quality=${r.qualityIssues.length} | evidence=${r.evidence.length} | explanations=${r.explanations.length}`,
  );

  return rows;
}

let fails = 0;
for (const c of cases) {
  console.log(`\n=== TEST CASE ${c.id} — ${c.label}`);
  for (const r of run(c)) {
    if (!r.ok) fails++;
    console.log(`${r.ok ? "  OK  " : " FAIL "} ${r.engine.padEnd(34)} ${r.summary}`);
  }
}
console.log(`\nTOTAL FAILURES: ${fails}`);
