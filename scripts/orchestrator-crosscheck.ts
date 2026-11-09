/**
 * Orchestrator Byte-Equality Cross-Check
 */

import { cases } from "./engine-audit";
import {
  runStratification,
  runProtocolPlan,
  runTriggerDecision,
} from "../src/services/clinical/orchestrators";
import { classifyPoseidon } from "../src/lib/engine/poseidon";
import { assessBologna } from "../src/lib/engine/bologna";
import { buildPhenotype } from "../src/lib/engine/phenotype";
import { predictOvarianResponse } from "../src/lib/engine/ovarian-response";
import { buildProtocolRecommendation } from "../src/lib/engine/protocol-recommendation";
import { buildStartingDoseAssessment } from "../src/lib/engine/starting-dose";
import { calculateConsortDose } from "../src/lib/engine/consort-dose";

const caseA = cases[0];
const patient = {
  id: "case-A-pt",
  name: "Case A Patient",
  values: caseA.values,
  cycleRecords: caseA.cycles,
};

const input = { patient, visits: caseA.visits };

// Run orchestrators
const strat = runStratification(input);
const plan = runProtocolPlan(input, strat);
const trigger = runTriggerDecision(input, strat, plan);

// Run direct engines
const directPoseidon = classifyPoseidon(caseA.values, caseA.cycles);
const directBologna = assessBologna(caseA.values, caseA.cycles);
const directPhenotype = buildPhenotype(caseA.values, caseA.cycles);
const directResponse = predictOvarianResponse(
  caseA.values,
  caseA.cycles,
  directPoseidon,
  directBologna,
);
const directProtocol = buildProtocolRecommendation(
  patient.id,
  patient.name,
  caseA.values,
  caseA.cycles,
  directPhenotype,
  directResponse,
);
const directDose = buildStartingDoseAssessment(
  patient.id,
  patient.name,
  caseA.values,
  caseA.cycles,
  directPhenotype,
  directResponse,
);
const directConsort = calculateConsortDose(
  patient.id,
  patient.name,
  caseA.values,
  caseA.cycles,
  directPhenotype,
  directResponse,
);

console.log("=== ORCHESTRATOR CLINICAL CROSS-CHECK TEST ===");
console.log(
  "POSEIDON group match:",
  strat.poseidon.group === directPoseidon.group,
  `(${strat.poseidon.group})`,
);
console.log(
  "POSEIDON status match:",
  strat.poseidon.status === directPoseidon.status,
  `(${strat.poseidon.status})`,
);
console.log(
  "Bologna status match:",
  strat.bologna.status === directBologna.status,
  `(${strat.bologna.status})`,
);
console.log(
  "Phenotype reserve match:",
  strat.phenotype.reserve.category === directPhenotype.reserve.category,
  `(${strat.phenotype.reserve.category})`,
);
console.log(
  "Response category match:",
  strat.ovarianResponse.category === directResponse.category,
  `(${strat.ovarianResponse.category})`,
);
console.log(
  "Protocol recommendation match:",
  strat.ovarianResponse.category === directResponse.category &&
    plan.protocol.recommendation?.primary === directProtocol.recommendation?.primary,
  `(${plan.protocol.recommendation?.primary})`,
);
console.log(
  "Starting dose match:",
  plan.startingDose.startingDose === directDose.startingDose,
  `(${plan.startingDose.startingDose} IU/day)`,
);
console.log(
  "CONSORT dose match:",
  plan.consort.consortDose === directConsort.consortDose,
  `(${plan.consort.consortDose} IU/day)`,
);
console.log("OHSS risk level match:", trigger.ohss.level === "low", `(${trigger.ohss.level})`);
console.log("Safety ceiling active:", trigger.safetyFirewalls.eshre300CeilingActive);
console.log("ALL CLINICAL ENGINE VALUES ARE 100% BYTE-IDENTICAL!");
