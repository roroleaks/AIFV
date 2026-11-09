import { useState, useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  CalendarPlus,
  Pencil,
  Trash2,
  Sliders,
  AlertTriangle,
  Printer,
  CheckCircle2,
  Calendar,
  TrendingUp,
  ShieldAlert,
  Flame,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePatients, type PatientRecord, savePatient } from "@/lib/assessment/patients";
import { DEFAULT_VIRTUAL_PATIENTS } from "@/lib/assessment/virtual-patients-data";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { ageFromDob } from "@/lib/assessment/schema";
import { useMonitoringVisits, newVisitId } from "@/lib/engine/monitoring-store";
import type { MonitoringVisit } from "@/lib/engine/monitoring";
import { lockSession } from "@/services/auth/session";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/patients/$id/monitoring")({
  head: () => ({
    meta: [
      { title: "Stage 5: Monitoring & Dose Adjustment — AIVF CDSS v3.1" },
      {
        name: "description",
        content:
          "Day-by-day stimulation monitoring, dual-axis follicle growth and estradiol trends, dynamic OHSS risk gauge, and evidence-guided dose adjustment.",
      },
    ],
  }),
  component: PatientMonitoringStage5View,
});

export function PatientMonitoringStage5View() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const { records } = usePatients();
  const { setValue: setAssessmentValue, draft } = useAssessment();

  // Find target patient master record
  const patient = useMemo<PatientRecord>(() => {
    const targetId = id ? decodeURIComponent(id) : "";
    const found = records.find(
      (r) =>
        r.id === targetId ||
        r.fileNumber === targetId ||
        r.id.toLowerCase() === targetId.toLowerCase(),
    );
    if (found) return found;

    const defaultFound = DEFAULT_VIRTUAL_PATIENTS.find(
      (r) =>
        r.id === targetId ||
        r.fileNumber === targetId ||
        r.id.toLowerCase() === targetId.toLowerCase(),
    );
    if (defaultFound) return defaultFound;

    return (
      records[0] ||
      DEFAULT_VIRTUAL_PATIENTS[0] || {
        id: "pt-default",
        name: "Intake Patient",
        fileNumber: "IVF-NEW",
        age: "34 years",
        partnerAge: "36",
        infertilityType: "Primary",
        causes: [],
        cycles: 0,
        completion: 60,
        alerts: 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {},
        cycleRecords: [],
      }
    );
  }, [id, records]);

  // Baseline patient variables
  const patientAge = useMemo<number>(() => {
    if (patient.values?.["age"]) return Number(patient.values["age"]);
    if (patient.values?.["dob"]) {
      const parsed = ageFromDob(String(patient.values["dob"]));
      if (parsed) return Number(parsed);
    }
    const match = patient.age.match(/\d+/);
    return match ? Number(match[0]) : 34;
  }, [patient]);

  const patientStartingDose = useMemo<number>(() => {
    const v = patient.values?.["startingDose"] ?? draft.values["startingDose"];
    return typeof v === "number" ? v : Number(v) || 225;
  }, [patient.values, draft.values]);

  const patientProtocol = useMemo<string>(() => {
    const v = patient.values?.["protocol"] ?? draft.values["protocol"];
    return String(v || "GnRH Antagonist Protocol");
  }, [patient.values, draft.values]);

  // Patient visits store
  const { visits, save: saveVisit, remove: removeVisit } = useMonitoringVisits(patient.id);

  // Active selected stimulation day (1..14)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    if (visits.length > 0) {
      return visits[visits.length - 1]?.day ?? 8;
    }
    return 8;
  });

  // Find visit corresponding to currently selected day
  const selectedVisit = useMemo<MonitoringVisit | undefined>(() => {
    return visits.find((v) => v.day === selectedDay);
  }, [visits, selectedDay]);

  // Derived current daily dose
  const currentDailyDose = useMemo<number>(() => {
    if (selectedVisit?.dailyDose) return selectedVisit.dailyDose;
    const sorted = [...visits].sort((a, b) => b.day - a.day);
    if (sorted[0]?.dailyDose) return sorted[0].dailyDose;
    return patientStartingDose;
  }, [selectedVisit, visits, patientStartingDose]);

  // Latest lab parameters for OHSS evaluation
  const latestVisitWithLabs = useMemo<MonitoringVisit | undefined>(() => {
    const sorted = [...visits].sort((a, b) => b.day - a.day);
    return sorted.find((v) => v.estradiol !== null || v.largestFollicle !== null) || sorted[0];
  }, [visits]);

  const currentE2 = latestVisitWithLabs?.estradiol ?? 1850;
  const currentLargestFollicle = latestVisitWithLabs?.largestFollicle ?? 16.5;
  const currentFollicleCount = latestVisitWithLabs?.follicleCount ?? 14;

  // OHSS Risk Tier calculation
  // Green: E2 < 2500 & Follicles < 15
  // Amber: E2 2500-3500 or Follicles 15-19
  // Red: E2 > 3500 or Follicles >= 20
  const ohssRiskTier = useMemo<"low" | "moderate" | "high">(() => {
    if (currentE2 >= 3500 || currentFollicleCount >= 20) return "high";
    if (currentE2 >= 2500 || currentFollicleCount >= 15) return "moderate";
    return "low";
  }, [currentE2, currentFollicleCount]);

  // Auto-save hook
  const [isModified, setIsModified] = useState(false);
  useAutoSave({
    onSave: () => {
      setAssessmentValue("lastMonitoredDay", selectedDay);
      setAssessmentValue("latestE2", currentE2);
    },
    intervalMs: 30000,
    enabled: isModified,
  });

  // Modals state
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [visitFormDay, setVisitFormDay] = useState<number>(selectedDay);
  const [visitFormE2, setVisitFormE2] = useState<number>(1850);
  const [visitFormP4, setVisitFormP4] = useState<number>(0.85);
  const [visitFormFollicle, setVisitFormFollicle] = useState<number>(16.5);
  const [visitFormCount, setVisitFormCount] = useState<number>(14);
  const [visitFormDose, setVisitFormDose] = useState<number>(currentDailyDose);
  const [visitFormEndo, setVisitFormEndo] = useState<number>(8.5);
  const [visitFormNotes, setVisitFormNotes] = useState<string>("");

  // Dose Adjustment Modal state
  const [adjustDoseModalOpen, setAdjustDoseModalOpen] = useState(false);
  const [newDoseInput, setNewDoseInput] = useState<number>(currentDailyDose);
  const [doseAdjustReason, setDoseAdjustReason] = useState<string>("");

  // Delete Confirm Modal state
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<MonitoringVisit | null>(null);

  // Action 1: [Add Visit Day]
  const handleOpenAddVisit = (targetDay?: number) => {
    const day = targetDay ?? selectedDay;
    setModalMode("add");
    setVisitFormDay(day);
    setVisitFormE2(Math.round(currentE2 * 1.15));
    setVisitFormP4(0.8);
    setVisitFormFollicle(Math.min(22, currentLargestFollicle + 1.5));
    setVisitFormCount(currentFollicleCount);
    setVisitFormDose(currentDailyDose);
    setVisitFormEndo(9.0);
    setVisitFormNotes(`Day ${day} ultrasound & serum monitoring`);
    setAddEditModalOpen(true);
  };

  // Action 2: [Edit Visit]
  const handleOpenEditVisit = (visit?: MonitoringVisit) => {
    const v = visit || selectedVisit;
    if (!v) {
      toast.error("No Visit Selected", {
        description: "Please select an existing monitoring visit to edit.",
      });
      return;
    }
    setModalMode("edit");
    setVisitFormDay(v.day);
    setVisitFormE2(v.estradiol ?? 1500);
    setVisitFormP4(v.progesterone ?? 0.7);
    setVisitFormFollicle(v.largestFollicle ?? 15);
    setVisitFormCount(v.follicleCount ?? 12);
    setVisitFormDose(v.dailyDose ?? currentDailyDose);
    setVisitFormEndo(v.endometrium ?? 8.0);
    setVisitFormNotes(v.notes || "");
    setAddEditModalOpen(true);
  };

  // Save Visit (Add or Edit)
  const handleSaveVisitForm = () => {
    const visitId = modalMode === "edit" && selectedVisit ? selectedVisit.id : newVisitId();
    const newVisitRecord: MonitoringVisit = {
      id: visitId,
      day: visitFormDay,
      date: new Date().toISOString().split("T")[0] || "2026-11-09",
      dailyDose: visitFormDose,
      medication: "rFSH (follitropin alfa)",
      medicationChange: "Maintained",
      follicleCount: visitFormCount,
      follicleSizes: [visitFormFollicle, visitFormFollicle - 2, visitFormFollicle - 3],
      largestFollicle: visitFormFollicle,
      follicles10: Math.max(0, visitFormCount - 2),
      follicles14: Math.floor(visitFormCount / 2),
      follicles17: visitFormFollicle >= 17 ? 2 : 0,
      endometrium: visitFormEndo,
      estradiol: visitFormE2,
      progesterone: visitFormP4,
      lh: 2.1,
      notes: visitFormNotes,
      triggerDay: visitFormFollicle >= 18,
      recordedAt: new Date().toISOString(),
    };

    saveVisit(newVisitRecord);
    setSelectedDay(visitFormDay);
    setAddEditModalOpen(false);
    setIsModified(true);

    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: modalMode === "add" ? "MONITORING_VISIT_ADDED" : "MONITORING_VISIT_EDITED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        day: visitFormDay,
        e2: visitFormE2,
        p4: visitFormP4,
        largestFollicle: visitFormFollicle,
        dose: visitFormDose,
        timestamp: new Date().toISOString(),
      },
    });

    toast.success(
      modalMode === "add"
        ? `Day ${visitFormDay} Visit Recorded`
        : `Day ${visitFormDay} Visit Updated`,
      {
        description: `E2: ${visitFormE2} pg/mL | Leading: ${visitFormFollicle} mm | Dose: ${visitFormDose} IU`,
      },
    );
  };

  // Action 3: [Delete Visit]
  const handlePromptDeleteVisit = (visit?: MonitoringVisit) => {
    const v = visit || selectedVisit;
    if (!v) {
      toast.error("No Visit Selected to Delete");
      return;
    }
    setVisitToDelete(v);
    setDeleteConfirmModalOpen(true);
  };

  const handleConfirmDeleteVisit = () => {
    if (!visitToDelete) return;
    removeVisit(visitToDelete.id);

    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "MONITORING_VISIT_DELETED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        deletedVisitId: visitToDelete.id,
        day: visitToDelete.day,
        timestamp: new Date().toISOString(),
      },
    });

    setDeleteConfirmModalOpen(false);
    setVisitToDelete(null);
    toast.warning("Monitoring Visit Removed", {
      description: `Day ${visitToDelete.day} visit data was excised from the stimulation record.`,
    });
  };

  // Action 4: [Adjust Dose]
  const handleOpenAdjustDose = () => {
    setNewDoseInput(currentDailyDose);
    setDoseAdjustReason("");
    setAdjustDoseModalOpen(true);
  };

  const doseDelta = Math.abs(newDoseInput - currentDailyDose);
  const isHighDelta = doseDelta > 75;

  const handleConfirmDoseAdjustment = () => {
    if (doseAdjustReason.trim().length < 10) {
      toast.error("Adjustment Rationale Incomplete", {
        description: "Please specify clinical indication (minimum 10 characters).",
      });
      return;
    }

    // Update current visit dose or create new day record
    if (selectedVisit) {
      const updated = {
        ...selectedVisit,
        dailyDose: newDoseInput,
        medicationChange: `Adjusted from ${currentDailyDose} to ${newDoseInput} IU`,
        notes: `${selectedVisit.notes || ""} [Dose changed to ${newDoseInput} IU: ${doseAdjustReason.trim()}]`,
      };
      saveVisit(updated);
    }

    // Update patient master record
    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: new Date().toISOString(),
      values: {
        ...patient.values,
        ["currentDose"]: newDoseInput,
        ["lastDoseAdjustment"]: new Date().toISOString(),
      },
    };
    savePatient(updatedPatient);

    // Cryptographic audit log
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "STIMULATION_DOSE_ADJUSTED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        stimulationDay: selectedDay,
        previousDose: currentDailyDose,
        newDose: newDoseInput,
        delta: doseDelta,
        exceededThreshold: isHighDelta,
        rationale: doseAdjustReason.trim(),
        timestamp: new Date().toISOString(),
      },
    });

    setAdjustDoseModalOpen(false);
    toast.success("Stimulation Dose Adjusted", {
      description: `Dose updated to ${newDoseInput} IU/day (Δ ${doseDelta} IU). Cryptographically logged in audit chain.`,
    });
  };

  // Action 5: [Flag OHSS Risk]
  const handleFlagOhssRisk = () => {
    const nextAlertCount = (patient.alerts || 0) + 1;
    const updatedPatient: PatientRecord = {
      ...patient,
      alerts: nextAlertCount,
      updatedAt: new Date().toISOString(),
      values: {
        ...patient.values,
        ["ohssFlagged"]: "true",
        ["ohssRiskTier"]: ohssRiskTier,
        ["ohssFlaggedAt"]: new Date().toISOString(),
      },
    };
    savePatient(updatedPatient);

    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "OHSS_ACUTE_RISK_FLAGGED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        estradiol: currentE2,
        follicleCount: currentFollicleCount,
        tier: ohssRiskTier,
        timestamp: new Date().toISOString(),
      },
    });

    toast.warning("OHSS Critical Alert Flagged", {
      description: `Patient flagged for high hyperstimulation risk (E2: ${currentE2} pg/mL). Segregation and agonist trigger protocols alerted.`,
    });
  };

  // Action 6: [Print Monitoring Sheet]
  const handlePrintMonitoringSheet = () => {
    window.print();
  };

  // Action 9: [Lock]
  const handleLockScreen = () => {
    lockSession("manual_lock");
    toast.info("Session Locked", {
      description: "Clinical workstation locked by clinician. Enter PIN to resume.",
    });
  };

  // Prepare chart series: Day 1 to Day 14
  const chartData = useMemo(() => {
    const dayMap = new Map<number, MonitoringVisit>();
    visits.forEach((v) => dayMap.set(v.day, v));

    const series = [];
    for (let d = 1; d <= 14; d++) {
      const visit = dayMap.get(d);
      series.push({
        day: `Day ${d}`,
        dayNum: d,
        follicle: visit?.largestFollicle ?? null,
        estradiol: visit?.estradiol ?? null,
        dose: visit?.dailyDose ?? null,
        p4: visit?.progesterone ?? null,
      });
    }
    return series;
  }, [visits]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          {/* Button: [Back] */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5"
            aria-label="Back to Starting Dose Engine"
          >
            <Link to="/patients/$id/dose" params={{ id: patient.id }}>
              <ArrowLeft className="size-4" />
              <span>Back to Starting Dose</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-2xs font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20"
              >
                Stage 5: Monitoring & Dose Adjustment
              </Badge>
              {ohssRiskTier === "high" && (
                <Badge
                  variant="outline"
                  className="text-2xs font-bold bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30 animate-pulse"
                >
                  OHSS Alert
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-0.5">
              Cycle Monitoring & Follicular Trajectory
            </h1>
          </div>
        </div>

        {/* Action Button Cluster */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Button: [Add Visit Day] */}
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenAddVisit()}
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            aria-label="Add Visit Day"
          >
            <CalendarPlus className="size-3.5" />
            <span>Add Visit Day</span>
          </Button>

          {/* Button: [Adjust Dose] */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenAdjustDose}
            className="h-8 text-xs font-semibold gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border-amber-500/30"
            aria-label="Adjust Gonadotropin Dose"
          >
            <Sliders className="size-3.5" />
            <span>Adjust Dose</span>
          </Button>

          {/* Button: [Print Monitoring Sheet] */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintMonitoringSheet}
            className="h-8 text-xs font-medium gap-1.5 border-border/80 bg-background hover:bg-muted text-foreground shadow-xs"
            aria-label="Print Monitoring Sheet"
          >
            <Printer className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Print Sheet</span>
          </Button>

          {/* Button: [Next >] */}
          <Button
            asChild
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            aria-label="Proceed to Trigger Decision"
          >
            <Link to="/trigger">
              <span>Next: Trigger</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>

          {/* Button: [Lock] */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLockScreen}
            className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 gap-1.5"
            aria-label="Lock Clinical Session"
          >
            <Lock className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Lock</span>
          </Button>
        </div>
      </div>

      {/* Patient Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 p-3 rounded-lg border border-border/70 bg-card/60 backdrop-blur-xs text-xs">
        <div>
          <span className="text-muted-foreground text-2xs block">Patient</span>
          <span className="font-semibold text-foreground truncate block">{patient.name}</span>
          <span className="text-2xs text-muted-foreground font-mono">{patient.fileNumber}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Stimulation Protocol</span>
          <span className="font-semibold text-foreground block truncate">{patientProtocol}</span>
          <span className="text-2xs text-muted-foreground">Age {patientAge} yrs</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Active Dose</span>
          <span className="font-bold text-primary block">{currentDailyDose} IU/day</span>
          <span className="text-2xs text-muted-foreground">r-hFSH (follitropin)</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Leading Follicle</span>
          <span className="font-semibold text-foreground">{currentLargestFollicle} mm</span>
          <span className="text-2xs text-muted-foreground block">
            {currentFollicleCount} cohort follicles
          </span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Serum Estradiol</span>
          <span className="font-semibold text-foreground">{currentE2} pg/mL</span>
          <span className="text-2xs text-muted-foreground block">
            P4: {latestVisitWithLabs?.progesterone ?? 0.8} ng/mL
          </span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">OHSS Safety Tier</span>
          <Badge
            variant={
              ohssRiskTier === "high"
                ? "destructive"
                : ohssRiskTier === "moderate"
                  ? "outline"
                  : "secondary"
            }
            className={cn(
              "text-2xs font-bold mt-0.5 uppercase",
              ohssRiskTier === "moderate" &&
                "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10",
              ohssRiskTier === "low" &&
                "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
            )}
          >
            {ohssRiskTier} Risk
          </Badge>
        </div>
      </div>

      {/* TOP: Day-by-Day Stimulation Grid (Day 1..Day 14) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Stimulation Timeline Grid (Day 1 .. Day 14)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {Array.from({ length: 14 }, (_, i) => i + 1).map((dayNum) => {
            const dayVisit = visits.find((v) => v.day === dayNum);
            const isSelected = selectedDay === dayNum;

            return (
              <div
                key={dayNum}
                onClick={() => setSelectedDay(dayNum)}
                className={cn(
                  "cursor-pointer rounded-xl border p-2.5 transition-all text-xs flex flex-col justify-between space-y-2",
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-xs"
                    : dayVisit
                      ? "border-border/80 bg-card hover:border-primary/50"
                      : "border-border/40 bg-muted/20 hover:border-border/80 opacity-70 hover:opacity-100",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Day {dayNum}</span>
                  {dayVisit ? (
                    <Badge
                      variant="outline"
                      className="text-3xs font-mono h-4 px-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    >
                      Logged
                    </Badge>
                  ) : (
                    <span className="text-3xs text-muted-foreground">Empty</span>
                  )}
                </div>

                {dayVisit ? (
                  <div className="space-y-1 text-2xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">E2:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {dayVisit.estradiol ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P4:</span>
                      <span className="font-mono text-foreground">
                        {dayVisit.progesterone ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lead:</span>
                      <span className="font-mono font-bold text-primary">
                        {dayVisit.largestFollicle ? `${dayVisit.largestFollicle}mm` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border/50 pt-0.5">
                      <span className="text-muted-foreground">Dose:</span>
                      <span className="font-mono text-foreground">
                        {dayVisit.dailyDose ? `${dayVisit.dailyDose} IU` : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-3xs text-muted-foreground">
                    No visit entered
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Day Action Strip */}
        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-primary-foreground font-mono text-xs">
              Day {selectedDay}
            </Badge>
            {selectedVisit ? (
              <span className="text-xs text-foreground font-medium">
                Recorded on {selectedVisit.date} • E2:{" "}
                <strong>{selectedVisit.estradiol ?? "—"} pg/mL</strong> • Leading:{" "}
                <strong>{selectedVisit.largestFollicle ?? "—"} mm</strong> • Daily Dose:{" "}
                <strong>{selectedVisit.dailyDose ?? currentDailyDose} IU</strong>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                No clinical monitoring data recorded for Day {selectedDay} yet.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedVisit ? (
              <>
                {/* Button: [Edit Visit] */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditVisit(selectedVisit)}
                  className="h-7 text-xs font-medium gap-1.5 border-border/80 bg-background hover:bg-muted text-foreground shadow-xs"
                  aria-label="Edit Selected Visit"
                >
                  <Pencil className="size-3" />
                  <span>Edit Visit</span>
                </Button>

                {/* Button: [Delete Visit] */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePromptDeleteVisit(selectedVisit)}
                  className="h-7 text-xs font-medium gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30 shadow-xs"
                  aria-label="Delete Selected Visit"
                >
                  <Trash2 className="size-3" />
                  <span>Delete Visit</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenAddVisit(selectedDay)}
                className="h-7 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                aria-label="Record Visit for this day"
              >
                <CalendarPlus className="size-3" />
                <span>Record Day {selectedDay}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MIDDLE: Recharts Line Chart (E2 Trend + Follicle Growth, Dual Y-Axes) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Dual-Axis Follicular Kinetics & Serum Estradiol Trajectory
            </h3>
          </div>
          <div className="flex items-center gap-4 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary inline-block" />
              <span>Leading Follicle (mm, Left Axis)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-chart-2 inline-block border border-chart-2" />
              <span>Serum E2 (pg/mL, Right Axis)</span>
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 25, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
              />
              {/* Left Y-Axis: Follicle Diameter (mm) */}
              <YAxis
                yAxisId="left"
                domain={[0, 26]}
                ticks={[0, 5, 10, 14, 17, 20, 24]}
                stroke="hsl(var(--primary))"
                fontSize={11}
                tickLine={false}
                label={{
                  value: "Follicle (mm)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 15,
                  fontSize: 10,
                  fill: "hsl(var(--primary))",
                }}
              />
              {/* Right Y-Axis: Serum Estradiol (pg/mL) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 5000]}
                ticks={[0, 1000, 2000, 3000, 4000, 5000]}
                stroke="hsl(var(--chart-2, 280 65% 60%))"
                fontSize={11}
                tickLine={false}
                label={{
                  value: "Estradiol (pg/mL)",
                  angle: 90,
                  position: "insideRight",
                  offset: 15,
                  fontSize: 10,
                  fill: "hsl(var(--chart-2, 280 65% 60%))",
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const first = payload?.[0];
                  if (active && first?.payload) {
                    const data = first.payload as {
                      day: string;
                      follicle: number | null;
                      estradiol: number | null;
                      dose: number | null;
                      p4: number | null;
                    };
                    return (
                      <div className="rounded-lg border border-border bg-popover p-2.5 text-2xs shadow-md text-popover-foreground space-y-1">
                        <p className="font-bold text-foreground">{data.day}</p>
                        <p className="text-primary font-mono">
                          Leading Follicle: {data.follicle ? `${data.follicle} mm` : "Not measured"}
                        </p>
                        <p className="text-chart-2 font-mono">
                          Serum E2: {data.estradiol ? `${data.estradiol} pg/mL` : "Not measured"}
                        </p>
                        {data.p4 !== null && (
                          <p className="text-muted-foreground font-mono">
                            Progesterone (P4): {data.p4} ng/mL
                          </p>
                        )}
                        {data.dose !== null && (
                          <p className="text-muted-foreground font-mono">
                            Dose: {data.dose} IU/day
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Mature Trigger Threshold Line (17 mm) */}
              <ReferenceLine
                yAxisId="left"
                y={17}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                label={{
                  value: "Mature Cohort (≥ 17mm)",
                  position: "insideTopLeft",
                  fill: "hsl(var(--primary))",
                  fontSize: 9,
                }}
              />
              {/* Critical OHSS Alert Threshold Line (3500 pg/mL) */}
              <ReferenceLine
                yAxisId="right"
                y={3500}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 4"
                label={{
                  value: "Critical OHSS Alert (> 3500 pg/mL)",
                  position: "insideTopRight",
                  fill: "hsl(var(--destructive))",
                  fontSize: 9,
                }}
              />
              {/* Follicle Growth Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="follicle"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                connectNulls
              />
              {/* Estradiol E2 Line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="estradiol"
                stroke="hsl(var(--chart-2, 280 65% 60%))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--chart-2, 280 65% 60%))" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BOTTOM: OHSS Risk Gauge (Green / Amber / Red) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Ovarian Hyperstimulation Syndrome (OHSS) Risk Safety Gauge
              </h3>
              <p className="text-2xs text-muted-foreground">
                Continuous guideline-anchored risk stratification per ESHRE 2025 and ASRM safety
                metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Button: [Flag OHSS Risk] */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFlagOhssRisk}
              className="h-8 text-xs font-semibold gap-1.5 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 border-red-500/40"
              aria-label="Flag Acute OHSS Risk"
            >
              <AlertTriangle className="size-3.5" />
              <span>Flag OHSS Risk</span>
            </Button>
          </div>
        </div>

        {/* 3-Zone Segmented Gauge Visualization */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {/* Zone 1: Green / Low */}
            <div
              className={cn(
                "rounded-lg border p-3 space-y-1 transition-all",
                ohssRiskTier === "low"
                  ? "border-emerald-600 bg-emerald-500/15 ring-2 ring-emerald-500/30"
                  : "border-border/60 bg-muted/20 opacity-60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide text-2xs">
                  Low Risk (Standard)
                </span>
                {ohssRiskTier === "low" && (
                  <Badge className="bg-emerald-600 text-white text-3xs h-4 px-1">Active</Badge>
                )}
              </div>
              <p className="text-2xs text-muted-foreground">
                E2 &lt; 2,500 pg/mL &amp; &lt; 15 follicles ≥ 11mm. Standard hCG trigger safe.
              </p>
            </div>

            {/* Zone 2: Amber / Moderate */}
            <div
              className={cn(
                "rounded-lg border p-3 space-y-1 transition-all",
                ohssRiskTier === "moderate"
                  ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30"
                  : "border-border/60 bg-muted/20 opacity-60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide text-2xs">
                  Moderate Risk (Caution)
                </span>
                {ohssRiskTier === "moderate" && (
                  <Badge className="bg-amber-600 text-white text-3xs h-4 px-1">Active</Badge>
                )}
              </div>
              <p className="text-2xs text-muted-foreground">
                E2 2,500–3,500 pg/mL or 15–19 follicles. Consider dose reduction or dual trigger.
              </p>
            </div>

            {/* Zone 3: Red / Critical */}
            <div
              className={cn(
                "rounded-lg border p-3 space-y-1 transition-all",
                ohssRiskTier === "high"
                  ? "border-red-600 bg-red-500/15 ring-2 ring-red-500/40"
                  : "border-border/60 bg-muted/20 opacity-60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-700 dark:text-red-300 uppercase tracking-wide text-2xs">
                  Critical Risk (Severe)
                </span>
                {ohssRiskTier === "high" && (
                  <Badge className="bg-red-600 text-white text-3xs h-4 px-1">Active</Badge>
                )}
              </div>
              <p className="text-2xs text-muted-foreground">
                E2 &gt; 3,500 pg/mL or ≥ 20 follicles. Mandatory agonist trigger + freeze-all cycle.
              </p>
            </div>
          </div>

          {/* Segmented Color Meter Bar */}
          <div className="h-3 w-full rounded-full bg-muted flex overflow-hidden border border-border/70">
            <div className="h-full w-1/3 bg-emerald-500/70" />
            <div className="h-full w-1/3 bg-amber-500/70" />
            <div className="h-full w-1/3 bg-red-600/70" />
          </div>

          <div className="flex items-center justify-between text-2xs text-muted-foreground px-1">
            <span>0 pg/mL</span>
            <span>2,500 pg/mL Threshold</span>
            <span>3,500 pg/mL Firewall</span>
            <span>5,000+ pg/mL</span>
          </div>
        </div>
      </div>

      {/* Modal 1: Add or Edit Visit Dialog */}
      <Dialog open={addEditModalOpen} onOpenChange={setAddEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="size-5 text-primary" />
              <span>
                {modalMode === "add"
                  ? `Record Visit for Day ${visitFormDay}`
                  : `Edit Day ${visitFormDay} Visit Data`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter updated laboratory endocrinology and transvaginal ultrasound biometric markers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Stimulation Day (1..14)</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={visitFormDay}
                  onChange={(e) => setVisitFormDay(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Daily Dose (IU/day)</label>
                <Input
                  type="number"
                  step="37.5"
                  value={visitFormDose}
                  onChange={(e) => setVisitFormDose(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Estradiol E2 (pg/mL)</label>
                <Input
                  type="number"
                  value={visitFormE2}
                  onChange={(e) => setVisitFormE2(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Progesterone P4 (ng/mL)</label>
                <Input
                  type="number"
                  step="0.05"
                  value={visitFormP4}
                  onChange={(e) => setVisitFormP4(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Leading Follicle (mm)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={visitFormFollicle}
                  onChange={(e) => setVisitFormFollicle(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Follicles Count (≥ 10mm)</label>
                <Input
                  type="number"
                  value={visitFormCount}
                  onChange={(e) => setVisitFormCount(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Endometrium Thickness (mm)</label>
              <Input
                type="number"
                step="0.1"
                value={visitFormEndo}
                onChange={(e) => setVisitFormEndo(Number(e.target.value))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Clinical Progress Notes</label>
              <Textarea
                value={visitFormNotes}
                onChange={(e) => setVisitFormNotes(e.target.value)}
                placeholder="Synchronous cohort recruitment, endometrial pattern trilaminar..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAddEditModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveVisitForm}
              className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save Visit Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Adjust Dose Dialog ([Adjust Dose]) */}
      <Dialog open={adjustDoseModalOpen} onOpenChange={setAdjustDoseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
              <Sliders className="size-5 shrink-0" />
              <span>Stimulation Gonadotropin Dose Adjustment</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Recalibrate daily recombinant FSH injection dose based on follicular recruitment
              velocity and estradiol trajectory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
              <div>
                <span className="text-2xs text-muted-foreground block">Current Active Dose:</span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {currentDailyDose} IU/day
                </span>
              </div>
              <div>
                <span className="text-2xs text-muted-foreground block">Adjustment Delta (Δ):</span>
                <span
                  className={cn(
                    "text-lg font-bold font-mono",
                    isHighDelta ? "text-amber-600" : "text-primary",
                  )}
                >
                  {doseDelta} IU
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Target New Daily Dose (IU/day)
              </label>
              <select
                value={newDoseInput}
                onChange={(e) => setNewDoseInput(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring font-mono"
              >
                <option value={75}>75 IU/day</option>
                <option value={112.5}>112.5 IU/day</option>
                <option value={150}>150 IU/day</option>
                <option value={187.5}>187.5 IU/day</option>
                <option value={225}>225 IU/day</option>
                <option value={262.5}>262.5 IU/day</option>
                <option value={300}>300 IU/day</option>
                <option value={375}>375 IU/day (High Dose)</option>
              </select>
            </div>

            {/* MANDATORY YELLOW WARNING if delta > 75 IU */}
            {isHighDelta && (
              <div className="rounded-lg bg-amber-500/15 border-2 border-amber-500/50 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span>Clinical Precaution: Step Delta Exceeds 75 IU Threshold</span>
                </div>
                <p className="text-2xs leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  A dose step alteration of <strong>{doseDelta} IU</strong> exceeds the standard
                  single-interval adjustment threshold (≤ 75 IU/day). Rapid step alterations risk
                  follicular cohort arrest or acute ovarian hyperstimulation. Ensure close
                  ultrasonic review in 48 hours.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">
                  Clinical Rationale (Mandatory min 10 chars)
                </label>
                <span
                  className={cn(
                    "text-2xs font-mono",
                    doseAdjustReason.trim().length >= 10
                      ? "text-emerald-600 font-bold"
                      : "text-amber-600",
                  )}
                >
                  {doseAdjustReason.trim().length} / 10 chars
                </span>
              </div>
              <Textarea
                value={doseAdjustReason}
                onChange={(e) => setDoseAdjustReason(e.target.value)}
                placeholder="Document clinical reason for dose alteration (e.g. step-down to prevent OHSS, step-up due to sluggish follicular recruitment under 1mm/day)..."
                rows={3}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdjustDoseModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDoseAdjustment}
              disabled={doseAdjustReason.trim().length < 10}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Confirm & Apply Dose</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: RED CONFIRM DIALOG for [Delete Visit] */}
      <Dialog open={deleteConfirmModalOpen} onOpenChange={setDeleteConfirmModalOpen}>
        <DialogContent className="max-w-md border-destructive/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <ShieldAlert className="size-5 shrink-0" />
              <span>Delete Monitoring Visit</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground font-semibold pt-1">
              This visit will be removed from the cycle. Continue?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive-foreground space-y-1">
            <p className="text-destructive font-medium">
              You are excising the monitoring records for <strong>Day {visitToDelete?.day}</strong>{" "}
              ({visitToDelete?.date}).
            </p>
            <p className="text-2xs text-muted-foreground">
              This will recalculate all follicular trajectories and remove corresponding laboratory
              points from downstream trigger decisions. This action is permanently logged to the
              audit trail.
            </p>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDeleteVisit}
              className="text-xs font-semibold bg-destructive hover:bg-destructive/90 text-white gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>Delete Visit</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
