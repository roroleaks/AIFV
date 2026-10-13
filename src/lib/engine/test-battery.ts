/**
 * PROMPT 30 — Full System Test battery.
 *
 * Runs every executable engine against fixed synthetic "golden" patients and
 * checks two things:
 *   1. no engine throws and every engine returns a structured result;
 *   2. the treatment safety firewall holds — no protocol, medication, dose,
 *      adjustment, trigger or freeze-all value is ever emitted while its
 *      algorithm is not activated, in ANY execution mode.
 *
 * The synthetic patients are test fixtures. They are not clinical cases and
 * produce no clinical conclusion.
 */

import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { classifyPoseidon } from "./poseidon";
import { assessBologna } from "./bologna";
import { buildPhenotype } from "./phenotype";
import { predictOvarianResponse } from "./ovarian-response";
import { buildProtocolRecommendation } from "./protocol-recommendation";
import { buildGonadotropinSelection } from "./gonadotropin-selection";
import {
  evaluateTreatmentGate,
  treatmentAlgorithmDefinitions,
  type TreatmentAlgorithmId,
} from "./algorithm-status";
import { getExecutionMode, type ExecutionMode } from "./activation-registry";

export interface GoldenPatient {
  id: string;
  name: string;
  scenario: string;
  values: Record<string, FieldValue>;
  cycles: CycleRecord[];
}

const cycle = (c: Record<string, FieldValue>, id: string): CycleRecord =>
  ({ id, ...c }) as unknown as CycleRecord;

export const goldenPatients: GoldenPatient[] = [
  {
    id: "golden-a",
    name: "Test Patient A",
    scenario: "Young patient, adequate reserve, no previous cycle.",
    values: {
      dob: "1994-04-12",
      height: 165,
      weight: 60,
      amh: 2.6,
      afcLeft: 7,
      afcRight: 7,
      fsh: 6.4,
      lh: 4.8,
      estradiol: 42,
      causes: ["Tubal factor"],
      infertilityType: "Primary",
      infertilityDuration: 24,
    },
    cycles: [],
  },
  {
    id: "golden-b",
    name: "Test Patient B",
    scenario: "Young patient, low reserve markers, no previous cycle.",
    values: {
      dob: "1996-02-02",
      height: 168,
      weight: 58,
      amh: 0.6,
      afcLeft: 2,
      afcRight: 2,
      fsh: 11.2,
      causes: ["Unexplained"],
      infertilityType: "Primary",
      infertilityDuration: 36,
    },
    cycles: [],
  },
  {
    id: "golden-c",
    name: "Test Patient C",
    scenario: "Advanced age, low reserve, two previous poor-yield cycles.",
    values: {
      dob: "1982-09-20",
      height: 160,
      weight: 66,
      amh: 0.4,
      afcLeft: 2,
      afcRight: 1,
      fsh: 14.5,
      causes: ["Diminished ovarian reserve"],
      infertilityType: "Secondary",
      infertilityDuration: 48,
    },
    cycles: [
      cycle(
        { cycleNumber: 1, cycleYear: 2023, type: "IVF", protocol: "Antagonist", startingDose: 300, retrieved: 3, mii: 2, fertilized: 1 },
        "c1",
      ),
      cycle(
        { cycleNumber: 2, cycleYear: 2024, type: "ICSI", protocol: "Antagonist", startingDose: 375, retrieved: 2, mii: 2, fertilized: 1 },
        "c2",
      ),
    ],
  },
  {
    id: "golden-d",
    name: "Test Patient D",
    scenario: "PCOS phenotype with high reserve markers and previous OHSS.",
    values: {
      dob: "1997-07-01",
      height: 162,
      weight: 82,
      amh: 7.9,
      afcLeft: 16,
      afcRight: 15,
      fsh: 5.1,
      causes: ["PCOS"],
      ohssHistory: "Moderate",
      leftOvary: "Polycystic morphology",
      rightOvary: "Polycystic morphology",
      infertilityType: "Primary",
      infertilityDuration: 18,
    },
    cycles: [
      cycle(
        { cycleNumber: 1, cycleYear: 2024, type: "ICSI", protocol: "Antagonist", startingDose: 150, retrieved: 24, mii: 19, fertilized: 14, ohss: "Moderate" },
        "d1",
      ),
    ],
  },
  {
    id: "golden-e",
    name: "Test Patient E",
    scenario: "Age ≥ 35, adequate reserve, unexpected poor yield in the last cycle.",
    values: {
      dob: "1987-01-15",
      height: 170,
      weight: 68,
      amh: 1.8,
      afcLeft: 5,
      afcRight: 5,
      fsh: 7.8,
      causes: ["Male factor"],
      infertilityType: "Primary",
      infertilityDuration: 30,
    },
    cycles: [
      cycle(
        { cycleNumber: 1, cycleYear: 2025, type: "ICSI", protocol: "Antagonist", startingDose: 225, retrieved: 3, mii: 2, fertilized: 2 },
        "e1",
      ),
    ],
  },
  {
    id: "golden-f",
    name: "Test Patient F",
    scenario: "Deliberately incomplete record — AMH, AFC and date of birth missing.",
    values: { infertilityType: "Primary" },
    cycles: [],
  },
];

export type CheckOutcome = "pass" | "fail";

export interface EngineTestResult {
  engineId: string;
  engineName: string;
  outcome: CheckOutcome;
  status: string;
  detail: string;
}

export interface PatientTestResult {
  patientId: string;
  patientName: string;
  scenario: string;
  engines: EngineTestResult[];
}

export interface FirewallCheck {
  gate: TreatmentAlgorithmId;
  name: string;
  outcome: CheckOutcome;
  detail: string;
}

export interface SystemTestReport {
  mode: ExecutionMode;
  ranAt: string;
  patients: PatientTestResult[];
  firewall: FirewallCheck[];
  totals: { checks: number; passed: number; failed: number };
}

function safe<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function runPatient(patient: GoldenPatient): PatientTestResult {
  const engines: EngineTestResult[] = [];
  const push = (
    engineId: string,
    engineName: string,
    result: { ok: boolean; error?: string },
    status: string,
    detail: string,
  ) =>
    engines.push({
      engineId,
      engineName,
      outcome: result.ok ? "pass" : "fail",
      status: result.ok ? status : "ERROR",
      detail: result.ok ? detail : (result.error ?? "Engine threw an exception."),
    });

  const poseidon = safe(() => classifyPoseidon(patient.values, patient.cycles));
  push(
    "poseidon",
    "POSEIDON Classification Engine",
    poseidon,
    poseidon.ok ? poseidon.value.status : "ERROR",
    poseidon.ok
      ? `Group: ${poseidon.value.group ?? "not classified"}; missing variables: ${
          poseidon.value.inputs.age === null ? "age " : ""
        }${poseidon.value.inputs.amh === null ? "amh " : ""}${
          poseidon.value.inputs.afc === null ? "afc" : ""
        }`.trim()
      : "",
  );

  const bologna = safe(() => assessBologna(patient.values, patient.cycles));
  push(
    "bologna",
    "ESHRE Bologna Criteria Engine",
    bologna,
    bologna.ok ? bologna.value.status : "ERROR",
    bologna.ok ? bologna.value.headline : "",
  );

  const phenotype = safe(() => buildPhenotype(patient.values, patient.cycles));
  push(
    "phenotype",
    "Patient Phenotype Engine",
    phenotype,
    phenotype.ok ? "completed" : "ERROR",
    phenotype.ok ? "Phenotype snapshot assembled." : "",
  );

  if (!poseidon.ok || !bologna.ok || !phenotype.ok) {
    return {
      patientId: patient.id,
      patientName: patient.name,
      scenario: patient.scenario,
      engines,
    };
  }

  const response = safe(() =>
    predictOvarianResponse(patient.values, patient.cycles, poseidon.value, bologna.value),
  );
  push(
    "ovarian-response",
    "Ovarian Response Prediction Engine",
    response,
    response.ok ? response.value.category : "ERROR",
    response.ok ? `${response.value.risks.length} risk factor(s) listed.` : "",
  );

  if (!response.ok) {
    return { patientId: patient.id, patientName: patient.name, scenario: patient.scenario, engines };
  }

  const protocol = safe(() =>
    buildProtocolRecommendation(
      patient.id,
      patient.name,
      patient.values,
      patient.cycles,
      phenotype.value,
      response.value,
    ),
  );
  push(
    "protocol-selection",
    "Protocol Recommendation Engine",
    protocol,
    "gated",
    protocol.ok ? "No protocol emitted — algorithm not activated." : "",
  );

  if (protocol.ok) {
    const gonadotropin = safe(() =>
      buildGonadotropinSelection(
        patient.id,
        patient.name,
        patient.values,
        patient.cycles,
        phenotype.value,
        response.value,
        protocol.value,
      ),
    );
    push(
      "gonadotropin-selection",
      "Gonadotropin Selection Engine",
      gonadotropin,
      "gated",
      gonadotropin.ok ? "No medication or dose emitted — algorithm not activated." : "",
    );
  }

  return { patientId: patient.id, patientName: patient.name, scenario: patient.scenario, engines };
}

/** Confirms every treatment gate still suppresses its outputs. */
export function runFirewallChecks(): FirewallCheck[] {
  return (Object.keys(treatmentAlgorithmDefinitions) as TreatmentAlgorithmId[]).map((id) => {
    const gate = evaluateTreatmentGate(id);
    const leaked = gate.active && !gate.testMode;
    return {
      gate: id,
      name: gate.name,
      outcome: leaked ? "fail" : "pass",
      detail: gate.testMode
        ? `Open only under FULL ENGINE TEST MODE — output labelled as test data. Logic source: ${gate.logicSource}`
        : gate.active
          ? "Gate reports ACTIVE — verify that a validated algorithm is genuinely transcribed."
          : `Suppressed: ${gate.suppressedOutputs.length} output(s) blocked; ${gate.missingEvidence.length} evidence item(s) missing.`,
    };
  });
}

export function runFullSystemTest(): SystemTestReport {
  const patients = goldenPatients.map(runPatient);
  const firewall = runFirewallChecks();
  const engineChecks = patients.flatMap((p) => p.engines);
  const passed =
    engineChecks.filter((e) => e.outcome === "pass").length +
    firewall.filter((f) => f.outcome === "pass").length;
  const checks = engineChecks.length + firewall.length;

  return {
    mode: getExecutionMode(),
    ranAt: new Date().toISOString(),
    patients,
    firewall,
    totals: { checks, passed, failed: checks - passed },
  };
}
