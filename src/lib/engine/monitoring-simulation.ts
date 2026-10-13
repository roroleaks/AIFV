/**
 * SIMULATED TEST DATA — NOT REAL PATIENT DATA.
 *
 * Synthetic monitoring visits used exclusively for software regression
 * testing of the monitoring UI and data flow. These values are invented for
 * software testing and MUST NEVER be used to activate, derive or validate any
 * clinical rule, threshold or dose.
 */

import type { MonitoringVisit } from "./monitoring";

export const SIMULATED_DATA_LABEL = "SIMULATED TEST DATA — NOT REAL PATIENT DATA";

export const SIMULATED_DATA_NOTICE =
  "Synthetic values generated for software regression testing of the monitoring interface only. They are not measurements, not clinical guidance, and never activate a dosing rule.";

const visit = (v: Partial<MonitoringVisit> & { day: number }): MonitoringVisit => ({
  id: `sim-${v.day}`,
  date: "",
  dailyDose: null,
  medication: "rFSH (simulated)",
  medicationChange: "",
  follicleCount: null,
  follicleSizes: [],
  largestFollicle: null,
  follicles10: null,
  follicles14: null,
  follicles17: null,
  endometrium: null,
  estradiol: null,
  progesterone: null,
  lh: null,
  notes: SIMULATED_DATA_LABEL,
  triggerDay: false,
  recordedAt: new Date(0).toISOString(),
  ...v,
});

/** Poor-responder regression case (age 42, AMH 0.5, AFC 3, POSEIDON group 4). */
export const simulatedPoorResponderVisits: MonitoringVisit[] = [
  visit({
    day: 1,
    dailyDose: 300,
    follicleCount: 3,
    largestFollicle: 5,
    follicles10: 0,
    follicles14: 0,
    follicles17: 0,
    endometrium: 3.5,
    estradiol: 35,
    lh: 4.2,
    progesterone: 0.3,
    rightFollicles: 2,
    leftFollicles: 1,
  }),
  visit({
    day: 5,
    dailyDose: 300,
    follicleCount: 3,
    largestFollicle: 9,
    follicles10: 0,
    follicles14: 0,
    follicles17: 0,
    endometrium: 5.1,
    estradiol: 180,
    lh: 3.1,
    progesterone: 0.4,
    rightFollicles: 2,
    leftFollicles: 1,
  }),
  visit({
    day: 8,
    dailyDose: 300,
    follicleCount: 3,
    largestFollicle: 13,
    follicles10: 2,
    follicles14: 0,
    follicles17: 0,
    endometrium: 6.8,
    estradiol: 420,
    lh: 2.4,
    progesterone: 0.5,
    rightFollicles: 2,
    leftFollicles: 1,
  }),
  visit({
    day: 10,
    dailyDose: 300,
    follicleCount: 3,
    largestFollicle: 17,
    follicles10: 2,
    follicles14: 2,
    follicles17: 1,
    endometrium: 7.9,
    estradiol: 610,
    lh: 2.0,
    progesterone: 0.7,
    rightFollicles: 2,
    leftFollicles: 1,
  }),
];

/** Negative test: high E2, large cohort, rapid rise, missing LH/P4, partial scan. */
export const simulatedHyperResponseVisits: MonitoringVisit[] = [
  visit({
    id: "sim-neg-1",
    day: 5,
    dailyDose: 225,
    follicleCount: 24,
    largestFollicle: 11,
    follicles10: 16,
    endometrium: 6.2,
    estradiol: 1800,
  }),
  visit({
    id: "sim-neg-2",
    day: 8,
    dailyDose: 225,
    follicleCount: 26,
    largestFollicle: 16,
    follicles10: 22,
    estradiol: 6400,
  }),
];
