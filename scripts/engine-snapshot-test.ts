/**
 * Engine Snapshot Assertion Suite
 *
 * Runs all pure clinical engines across Cases A, B, C, D, E and asserts
 * byte-equal JSON equality against the golden baseline snapshot.
 *
 * Usage:
 *   npx tsx scripts/engine-snapshot-test.ts
 *   npx tsx scripts/engine-snapshot-test.ts --update
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { cases } from "./engine-audit";
import { buildPatientContext } from "../src/lib/clinical/data-mapping";
import { classifyPoseidon } from "../src/lib/engine/poseidon";
import { assessBologna } from "../src/lib/engine/bologna";
import { buildPhenotype } from "../src/lib/engine/phenotype";
import { predictOvarianResponse } from "../src/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "../src/lib/engine/protocol-recommendation";
import { buildProtocolSelection } from "../src/lib/engine/protocol-selection";
import { buildGonadotropinSelection } from "../src/lib/engine/gonadotropin-selection";
import { calculateConsortDose } from "../src/lib/engine/consort-dose";
import { buildStartingDoseAssessment } from "../src/lib/engine/starting-dose";
import { buildMonitoringContext, analyzeMonitoring } from "../src/lib/engine/monitoring";
import { evaluateDoseAdjustment } from "../src/lib/engine/dose-adjustment";
import { buildCycleCompletion } from "../src/lib/engine/cycle-completion";
import { buildTriggerAssessment } from "../src/lib/engine/trigger";
import { buildIntelligenceReport } from "../src/lib/report/intelligence-report";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GOLDEN_PATH = path.join(__dirname, "fixtures", "engine-snapshot-golden.json");

const isUpdate = process.argv.includes("--update");

function sanitizeTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    // If it looks like an ISO date/timestamp (e.g., 2026-11-08T21:35:38.506Z)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(obj)) {
      return "STATIC_TIMESTAMP";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeTimestamps);
  }
  if (typeof obj === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "computedAt" || k === "generatedAt" || k === "evaluatedAt") {
        res[k] = "STATIC_TIMESTAMP";
      } else if (
        k === "date" &&
        typeof v === "string" &&
        (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v))
      ) {
        res[k] = "STATIC_DATE";
      } else if (k === "time" && typeof v === "string" && /^\d{1,2}:\d{2}/.test(v)) {
        res[k] = "STATIC_TIME";
      } else {
        res[k] = sanitizeTimestamps(v);
      }
    }
    return res;
  }
  return obj;
}

export function runSnapshotTest(): { matches: boolean; errorCount: number } {
  const snapshotData: Record<string, unknown> = {};

  for (const c of cases) {
    const caseKey = `case_${c.id}`;

    const poseidon = classifyPoseidon(c.values, c.cycles);
    const bologna = assessBologna(c.values, c.cycles);
    const phenotype = buildPhenotype(c.values, c.cycles);
    const response = predictOvarianResponse(c.values, c.cycles, poseidon, bologna);
    const ctx = buildPatientContext(c.values, c.cycles, response);

    const protocolRec = buildProtocolRecommendation(
      "snap_pt",
      "Snapshot Patient",
      c.values,
      c.cycles,
      phenotype,
      response,
    );

    const protocolSel = buildProtocolSelection(
      "snap_pt",
      "Snapshot Patient",
      c.values,
      c.cycles,
      phenotype,
      response,
      ctx,
      null,
    );

    const gonado = buildGonadotropinSelection(
      "snap_pt",
      "Snapshot Patient",
      c.values,
      c.cycles,
      phenotype,
      response,
      protocolRec,
    );

    const consort = calculateConsortDose(
      "snap_pt",
      "Snapshot Patient",
      c.values,
      c.cycles,
      phenotype,
      response,
    );

    const startingDose = buildStartingDoseAssessment(
      "snap_pt",
      "Snapshot Patient",
      c.values,
      c.cycles,
      phenotype,
      response,
    );

    const mctx = buildMonitoringContext(
      "snap_pt",
      "Snapshot Patient",
      c.values,
      c.cycles,
      phenotype,
      response,
      protocolRec,
      gonado,
      null,
    );

    const monitoring = analyzeMonitoring(mctx, c.visits);
    const doseAdjustment = evaluateDoseAdjustment(monitoring.visits.at(-1) ?? null);

    const cycleCompletion = buildCycleCompletion(
      "snap_pt",
      "Snapshot Patient",
      phenotype,
      response,
      protocolRec,
      gonado,
      null,
      monitoring,
    );

    const trigger = buildTriggerAssessment(
      "snap_pt",
      "Snapshot Patient",
      phenotype,
      response,
      monitoring,
      cycleCompletion,
      null,
    );

    const report = buildIntelligenceReport({
      patientId: "snap_pt",
      patientName: "Snapshot Patient",
      values: c.values,
      cycles: c.cycles,
      phenotype,
      response,
      protocol: protocolRec,
      gonadotropin: gonado,
      consort,
      monitoring,
      cycle: cycleCompletion,
    });

    // Normalize volatile execution timestamps in audit metadata
    snapshotData[caseKey] = {
      poseidon,
      bologna,
      phenotype,
      response,
      protocolRec,
      protocolSel,
      gonado,
      consort,
      startingDose,
      monitoring,
      doseAdjustment,
      cycleCompletion,
      trigger,
      report,
    };
  }

  const sanitized = sanitizeTimestamps(snapshotData);
  const generatedJson = JSON.stringify(sanitized, null, 2);

  if (isUpdate || !fs.existsSync(GOLDEN_PATH)) {
    fs.writeFileSync(GOLDEN_PATH, generatedJson, "utf8");
    console.log(`[SNAPSHOT] Updated golden baseline at: ${GOLDEN_PATH}`);
    return { matches: true, errorCount: 0 };
  }

  const goldenJson = fs.readFileSync(GOLDEN_PATH, "utf8");

  if (generatedJson === goldenJson) {
    console.log("[SNAPSHOT PASS] All engine outputs match golden snapshot byte-for-byte!");
    return { matches: true, errorCount: 0 };
  } else {
    console.error("[SNAPSHOT FAIL] Engine outputs differ from golden snapshot!");
    for (let i = 0; i < Math.min(generatedJson.length, goldenJson.length); i++) {
      if (generatedJson[i] !== goldenJson[i]) {
        console.error(`Diff at char ${i}:`);
        console.error(`Generated: ${generatedJson.slice(Math.max(0, i - 50), i + 50)}`);
        console.error(`Golden:    ${goldenJson.slice(Math.max(0, i - 50), i + 50)}`);
        break;
      }
    }
    return { matches: false, errorCount: 1 };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = runSnapshotTest();
  process.exit(res.matches ? 0 : 1);
}
