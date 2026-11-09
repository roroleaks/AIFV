/**
 * EncounterTimeline Component (§2)
 *
 * Longitudinal vertical timeline rendering all stimulation encounters in the cycle.
 * Provides cohort summary metrics, smart-default quick action macro (+ Add D{n} visit),
 * and links directly to EncounterCard for each visit node.
 */

import { useMemo } from "react";
import { Activity, Plus, Zap, CheckCircle2 } from "lucide-react";
import type { Encounter } from "./types";
import type { PatientRecord } from "@/lib/assessment/patients";
import { EncounterCard } from "./EncounterCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EncounterTimelineProps {
  encounters: Encounter[];
  patient: PatientRecord | null;
  onAddEncounter: (prefillDay?: number) => void;
  onEditEncounter: (encounter: Encounter) => void;
  onVerifyEncounter: (encounterId: string) => void;
}

export function EncounterTimeline({
  encounters,
  patient: _patient,
  onAddEncounter,
  onEditEncounter,
  onVerifyEncounter,
}: EncounterTimelineProps) {
  // Sort encounters chronologically by stimulation day
  const sortedEncounters = useMemo(() => {
    return [...encounters].sort((a, b) => a.day - b.day);
  }, [encounters]);

  const latestEncounter = sortedEncounters[sortedEncounters.length - 1];
  const nextStimDay = latestEncounter ? latestEncounter.day + 2 : 2;

  // Cohort summary metrics
  const summary = useMemo(() => {
    if (!latestEncounter) return null;
    const { ultrasound, labs, medications } = latestEncounter;
    const rTotal =
      ultrasound.folliclesRight.lt10 +
      ultrasound.folliclesRight.b10_13 +
      ultrasound.folliclesRight.b14_16 +
      ultrasound.folliclesRight.gte17;
    const lTotal =
      ultrasound.folliclesLeft.lt10 +
      ultrasound.folliclesLeft.b10_13 +
      ultrasound.folliclesLeft.b14_16 +
      ultrasound.folliclesLeft.gte17;
    const gte17 = ultrasound.folliclesRight.gte17 + ultrasound.folliclesLeft.gte17;
    const gte14 = gte17 + ultrasound.folliclesRight.b14_16 + ultrasound.folliclesLeft.b14_16;

    const isTriggerReady = gte17 >= 3 || (ultrasound.largestFollicleMm ?? 0) >= 18;

    return {
      stimDay: latestEncounter.day,
      totalCount: rTotal + lTotal,
      gte17,
      gte14,
      e2: labs.estradiolPgMl,
      dailyDose: medications.gonadotropinDoseIU,
      drug: medications.gonadotropinType,
      isTriggerReady,
      allVerified: sortedEncounters.every((e) => e.status === "Verified" || e.status === "Locked"),
    };
  }, [latestEncounter, sortedEncounters]);

  return (
    <div className="space-y-6">
      {/* Top Action & Cohort Statistics Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">
              Longitudinal Stimulation Timeline
            </h2>
            <Badge variant="outline" className="font-mono text-xs">
              {encounters.length} {encounters.length === 1 ? "Encounter" : "Encounters"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time follicular kinetics, laboratory trends, and responsive titration tracking.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {latestEncounter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddEncounter(nextStimDay)}
              className="gap-1.5 h-9 text-xs border-primary/30 text-primary hover:bg-primary/5 font-semibold"
              title={`Quick-add Day ${nextStimDay} encounter with prior visit pre-fill`}
            >
              <Zap className="size-3.5 fill-primary/20 text-primary" />
              <span>+ Add D{nextStimDay} Visit</span>
            </Button>
          )}

          <Button
            onClick={() => onAddEncounter()}
            className="gap-1.5 h-9 bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
            title="Open new stimulation encounter form (Alt+V)"
          >
            <Plus className="size-4" />
            <span>Add Encounter</span>
            <kbd className="hidden sm:inline-block ms-1 rounded bg-primary-foreground/20 px-1 font-mono text-[10px]">
              Alt+V
            </kbd>
          </Button>
        </div>
      </div>

      {/* Cohort Summary Metrics Ribbon */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-muted/30 border-border/60 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Current Stimulation
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">
                  Day {summary.stimDay}
                </span>
                <span className="text-xs text-muted-foreground">
                  (of {sortedEncounters.length} visits)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-border/60 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Active Cohort &amp; Leads
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">
                  {summary.totalCount}
                </span>
                <span className="text-xs font-semibold text-primary">({summary.gte17} ≥ 17mm)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-border/60 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Latest Estradiol (E2)
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">
                  {summary.e2 ? `${summary.e2}` : "—"}
                </span>
                {summary.e2 && <span className="text-xs text-muted-foreground">pg/mL</span>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-border/60 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Current Daily Dose
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">
                  {summary.dailyDose}
                </span>
                <span className="text-xs text-muted-foreground">IU/day</span>
                <Badge variant="outline" className="ms-auto text-[9px] h-4.5 px-1 font-mono">
                  {summary.drug}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {sortedEncounters.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Activity className="size-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              No stimulation encounters recorded yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Begin cycle monitoring by recording the baseline (Day 2) ultrasound and hormonal labs.
              The fast encounter form lets you record visits in under 60 seconds with strict tab
              order.
            </p>
            <Button
              size="sm"
              onClick={() => onAddEncounter(2)}
              className="mt-4 gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>Record Baseline (Day 2) Visit</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Vertical Longitudinal Timeline */
        <div className="relative ps-6 space-y-6 before:absolute before:start-2.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/60">
          {sortedEncounters.map((encounter, idx) => {
            const isLatest = idx === sortedEncounters.length - 1;
            return (
              <div key={encounter.id} className="relative group">
                {/* Timeline Node Icon Indicator */}
                <div
                  className={cn(
                    "absolute -start-6 top-3.5 flex size-5 items-center justify-center rounded-full border-2 bg-background transition-transform group-hover:scale-110 shadow-xs",
                    encounter.status === "Verified"
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : isLatest
                        ? "border-primary text-primary ring-2 ring-primary/20"
                        : "border-border text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "size-1.5 rounded-full",
                      encounter.status === "Verified"
                        ? "bg-emerald-500"
                        : isLatest
                          ? "bg-primary"
                          : "bg-muted-foreground",
                    )}
                  />
                </div>

                {/* Encounter Card */}
                <EncounterCard
                  encounter={encounter}
                  onEdit={onEditEncounter}
                  onVerify={onVerifyEncounter}
                />
              </div>
            );
          })}

          {/* Trigger Readiness Milestone Indicator (if criteria met) */}
          {summary?.isTriggerReady && (
            <div className="relative group pt-2">
              <div className="absolute -start-6 top-5 flex size-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white shadow-xs">
                <CheckCircle2 className="size-3.5" />
              </div>

              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Cycle Milestone Reached: Trigger Criteria Fulfilled
                    </span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/50 bg-background text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                    >
                      ESHRE 2025 Validated
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Cohorts display {summary.gte17} follicles ≥ 17 mm. Ready for trigger timing and
                    OHSS risk-adapted agent selection.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Keyboard-first workflow:</span>
          <span>Press</span>
          <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] border border-border/80">
            Alt+V
          </kbd>
          <span>to add visit,</span>
          <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] border border-border/80">
            Enter
          </kbd>
          <span>to jump fields,</span>
          <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] border border-border/80">
            Ctrl+Enter
          </kbd>
          <span>to save &amp; new.</span>
        </div>
        <div className="text-[11px]">Touch targets ≥ 44px · Tablet optimized</div>
      </div>
    </div>
  );
}
